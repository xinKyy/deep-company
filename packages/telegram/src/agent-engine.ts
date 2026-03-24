import type { AppContext } from "./types.js";
import type { LlmMessage, LlmTool } from "@ai-dev-pro/core";

interface ProcessContext {
  chatId: string;
  userId?: string;
  username?: string;
  isGroup: boolean;
}

export class AgentEngine {
  private ctx: AppContext;
  private agentId: string;

  constructor(ctx: AppContext, agentId: string) {
    this.ctx = ctx;
    this.agentId = agentId;
  }

  async process(userMessage: string, pCtx: ProcessContext): Promise<string | null> {
    const agent = await this.ctx.agentService.getById(this.agentId);
    if (!agent) return "Agent configuration not found.";

    const agentSops = await this.ctx.sopService.getSopsByAgentId(this.agentId);

    const recentMemories = await this.ctx.memoryService.getRelevantContext(this.agentId);
    const conversationHistory = await this.ctx.messageService.getConversationHistory(
      pCtx.chatId,
      this.agentId,
      10
    );

    const systemPrompt = this.buildSystemPrompt(agent, agentSops, recentMemories);
    const tools = this.buildTools();

    const messages: LlmMessage[] = [
      { role: "system", content: systemPrompt },
    ];

    const historyMsgs = conversationHistory.reverse();
    for (const msg of historyMsgs) {
      messages.push({
        role: msg.direction === "incoming" ? "user" : "assistant",
        content: msg.content,
      });
    }

    messages.push({ role: "user", content: userMessage });

    try {
      let result = await this.ctx.llmRouter.complete({
        provider: agent.llmProvider,
        model: agent.llmModel,
        messages,
        tools,
        temperature: 0.7,
      });

      let iterations = 0;
      const maxIterations = 5;

      while (result.toolCalls.length > 0 && iterations < maxIterations) {
        iterations++;

        messages.push({
          role: "assistant",
          content: result.content || "",
          tool_calls: result.toolCalls,
        });

        for (const tc of result.toolCalls) {
          const params = JSON.parse(tc.function.arguments);
          const execResult = await this.ctx.skillService.execute(
            tc.function.name,
            params,
            { agentId: this.agentId }
          );

          messages.push({
            role: "tool",
            content: JSON.stringify(execResult),
            tool_call_id: tc.id,
          });
        }

        result = await this.ctx.llmRouter.complete({
          provider: agent.llmProvider,
          model: agent.llmModel,
          messages,
          tools,
          temperature: 0.7,
        });
      }

      const reply = result.content;

      if (reply) {
        await this.ctx.memoryService.create({
          agentId: this.agentId,
          type: "summary",
          content: `User: ${userMessage}\nAgent: ${reply.substring(0, 500)}`,
        });
      }

      return reply;
    } catch (err: any) {
      console.error(`AgentEngine LLM error:`, err);

      if (err.message?.includes("not registered")) {
        return this.handleNoLlmProvider(agent, userMessage, agentSops, pCtx);
      }

      return `Error processing request: ${err.message}`;
    }
  }

  private buildSystemPrompt(
    agent: any,
    agentSops: any[],
    memories: any[]
  ): string {
    const parts = [
      agent.systemPrompt || `You are ${agent.name}. ${agent.description}`,
      "",
      "## Your Capabilities (SOPs):",
    ];

    if (agentSops.length > 0) {
      for (const sop of agentSops) {
        parts.push(`- **${sop.name}**: ${sop.description}`);
      }
    } else {
      parts.push("- No SOPs configured yet. You can answer general questions.");
    }

    parts.push("", "## Available Tools:");
    const handlers = this.ctx.skillService.listRegisteredHandlers();
    for (const name of handlers) {
      parts.push(`- ${name}`);
    }

    if (memories.length > 0) {
      parts.push("", "## Recent Context:");
      for (const mem of memories.slice(0, 5)) {
        parts.push(`- [${mem.type}] ${mem.content.substring(0, 200)}`);
      }
    }

    parts.push(
      "",
      "## Important Rules:",
      "- When you cannot handle a request with your SOPs, explain what capability is missing and suggest the user configure it.",
      "- Always respond in the user's language.",
      "- For task queries, use the search_tasks or get_task_detail tools.",
      "- When delegating to another agent, mention them with @username in the group.",
    );

    return parts.join("\n");
  }

  private buildTools(): LlmTool[] {
    const toolDefs: Record<string, { description: string; parameters: Record<string, unknown> }> = {
      create_task: {
        description: "Create a new task in the task system",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            description: { type: "string", description: "Task description" },
            projectId: { type: "string", description: "Project ID" },
            parentTaskId: { type: "string", description: "Parent task ID for subtasks" },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            assignedAgentId: { type: "string", description: "Agent ID to assign" },
          },
          required: ["title"],
        },
      },
      update_task_status: {
        description: "Update a task's status",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID" },
            status: { type: "string", enum: ["assigned", "in_progress", "review", "blocked", "completed", "rejected", "cancelled"] },
            comment: { type: "string", description: "Status change comment" },
          },
          required: ["taskId", "status"],
        },
      },
      search_tasks: {
        description: "Search tasks by keyword (matches ID, title, or description)",
        parameters: {
          type: "object",
          properties: { keyword: { type: "string", description: "Search keyword" } },
          required: ["keyword"],
        },
      },
      get_task_detail: {
        description: "Get detailed task info including subtask progress and event history",
        parameters: {
          type: "object",
          properties: { taskId: { type: "string", description: "Task ID" } },
          required: ["taskId"],
        },
      },
      get_project_info: {
        description: "Get project information by name",
        parameters: {
          type: "object",
          properties: { name: { type: "string", description: "Project name" } },
          required: ["name"],
        },
      },
      create_subtask: {
        description: "Create a subtask under an existing task",
        parameters: {
          type: "object",
          properties: {
            parentTaskId: { type: "string", description: "Parent task ID" },
            title: { type: "string", description: "Subtask title" },
            description: { type: "string", description: "Subtask description" },
            priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
            assignedAgentId: { type: "string", description: "Agent ID to assign" },
          },
          required: ["parentTaskId", "title"],
        },
      },
      // ─── Shell / Bash ─────────────────────────────────────────────
      run_bash: {
        description: "Execute an arbitrary bash command. Use for file operations, installing deps, running tests, or anything not covered by other tools.",
        parameters: {
          type: "object",
          properties: {
            command: { type: "string", description: "The bash command to execute" },
            cwd: { type: "string", description: "Working directory (defaults to server cwd)" },
            timeout: { type: "number", description: "Timeout in milliseconds (default 120000, max 300000)" },
          },
          required: ["command"],
        },
      },
      // ─── Git Skills ─────────────────────────────────────────────────
      git_clone: {
        description: "Clone a git repository (supports GitHub/GitLab token auth)",
        parameters: {
          type: "object",
          properties: {
            repoUrl: { type: "string", description: "Repository URL (https or git)" },
            targetDir: { type: "string", description: "Target directory path" },
            platform: { type: "string", enum: ["github", "gitlab"], description: "Git platform for token auth" },
          },
          required: ["repoUrl"],
        },
      },
      git_pull: {
        description: "Pull latest changes from remote",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            remote: { type: "string", description: "Remote name (default: origin)" },
            branch: { type: "string", description: "Branch name" },
          },
          required: ["cwd"],
        },
      },
      git_push: {
        description: "Push commits to remote",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            remote: { type: "string", description: "Remote name" },
            branch: { type: "string", description: "Branch name" },
            force: { type: "boolean", description: "Force push" },
          },
          required: ["cwd"],
        },
      },
      git_commit: {
        description: "Commit changes (optionally git add -A first)",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            message: { type: "string", description: "Commit message" },
            addAll: { type: "boolean", description: "Run git add -A before commit" },
          },
          required: ["cwd", "message"],
        },
      },
      git_branch: {
        description: "Create or checkout a git branch",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            name: { type: "string", description: "Branch name" },
            checkout: { type: "boolean", description: "Checkout the new branch" },
            from: { type: "string", description: "Base branch to create from" },
          },
          required: ["cwd", "name"],
        },
      },
      git_merge: {
        description: "Merge a branch into current branch",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            branch: { type: "string", description: "Branch to merge" },
            noFf: { type: "boolean", description: "No fast-forward merge" },
            message: { type: "string", description: "Merge commit message" },
          },
          required: ["cwd", "branch"],
        },
      },
      git_status: {
        description: "Show working tree status (git status --porcelain)",
        parameters: {
          type: "object",
          properties: { cwd: { type: "string", description: "Working directory of the repo" } },
          required: ["cwd"],
        },
      },
      git_log: {
        description: "Show recent commit log",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            count: { type: "number", description: "Number of commits to show (default 10)" },
          },
          required: ["cwd"],
        },
      },
      git_diff: {
        description: "Show file differences",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            staged: { type: "boolean", description: "Show staged changes only" },
          },
          required: ["cwd"],
        },
      },
      git_create_pr: {
        description: "Create a Pull Request (GitHub) or Merge Request (GitLab)",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Working directory of the repo" },
            title: { type: "string", description: "PR/MR title" },
            body: { type: "string", description: "PR/MR description" },
            base: { type: "string", description: "Base branch (default: main)" },
            head: { type: "string", description: "Head branch" },
            platform: { type: "string", enum: ["github", "gitlab"], description: "Git platform" },
          },
          required: ["cwd", "title"],
        },
      },
      git_trigger_action: {
        description: "Trigger a GitHub Actions workflow",
        parameters: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            workflow: { type: "string", description: "Workflow file name or ID" },
            ref: { type: "string", description: "Git ref (branch/tag)" },
            inputs: { type: "object", description: "Workflow input parameters" },
          },
          required: ["owner", "repo", "workflow"],
        },
      },
      // ─── Jenkins Skills ─────────────────────────────────────────────
      jenkins_trigger_job: {
        description: "Trigger a Jenkins build job",
        parameters: {
          type: "object",
          properties: {
            jobUrl: { type: "string", description: "Full Jenkins job URL" },
            branch: { type: "string", description: "Branch to build" },
            parameters: { type: "object", description: "Build parameters" },
          },
          required: ["jobUrl"],
        },
      },
      jenkins_get_job_status: {
        description: "Get Jenkins build job status",
        parameters: {
          type: "object",
          properties: {
            jobUrl: { type: "string", description: "Full Jenkins job URL" },
            buildNumber: { type: "string", description: "Build number (default: lastBuild)" },
          },
          required: ["jobUrl"],
        },
      },
      jenkins_list_jobs: {
        description: "List Jenkins jobs",
        parameters: {
          type: "object",
          properties: { jenkinsUrl: { type: "string", description: "Jenkins server URL" } },
          required: ["jenkinsUrl"],
        },
      },
      // ─── Codex CLI Skills ───────────────────────────────────────────
      codex_write_code: {
        description: "Use Codex CLI to write/modify code in a repository",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "What code to write or modify" },
            cwd: { type: "string", description: "Working directory (repo root)" },
            model: { type: "string", description: "Model to use" },
            approval: { type: "string", enum: ["suggest", "auto-edit", "full-auto"], description: "Approval mode" },
          },
          required: ["prompt", "cwd"],
        },
      },
      codex_explain: {
        description: "Use Codex CLI to explain or analyze code",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "What to explain" },
            cwd: { type: "string", description: "Working directory" },
          },
          required: ["prompt", "cwd"],
        },
      },
      // ─── Google Docs Skills ─────────────────────────────────────────
      gog_create_doc: {
        description: "Create a Google Doc",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Document title" },
            content: { type: "string", description: "Initial content" },
          },
          required: ["title"],
        },
      },
      gog_update_doc: {
        description: "Update a Google Doc",
        parameters: {
          type: "object",
          properties: {
            docId: { type: "string", description: "Document ID" },
            content: { type: "string", description: "Content to write" },
            append: { type: "boolean", description: "Append instead of overwrite" },
          },
          required: ["docId", "content"],
        },
      },
      gog_read_doc: {
        description: "Read a Google Doc",
        parameters: {
          type: "object",
          properties: { docId: { type: "string", description: "Document ID" } },
          required: ["docId"],
        },
      },
      gog_share_doc: {
        description: "Share a Google Doc",
        parameters: {
          type: "object",
          properties: {
            docId: { type: "string", description: "Document ID" },
            email: { type: "string", description: "Email to share with" },
            role: { type: "string", enum: ["reader", "writer", "commenter"] },
          },
          required: ["docId", "email"],
        },
      },
      gog_list_docs: {
        description: "List all Google Docs",
        parameters: { type: "object", properties: {} },
      },
    };

    const registeredHandlers = this.ctx.skillService.listRegisteredHandlers();
    const tools: LlmTool[] = [];

    for (const name of registeredHandlers) {
      const def = toolDefs[name];
      if (def) {
        tools.push({
          type: "function",
          function: { name, description: def.description, parameters: def.parameters },
        });
      }
    }

    return tools;
  }

  private async handleNoLlmProvider(
    agent: any,
    userMessage: string,
    agentSops: any[],
    pCtx: ProcessContext
  ): Promise<string> {
    const allAgents = await this.ctx.agentService.listActive();
    const otherAgents = allAgents.filter((a) => a.id !== this.agentId);

    if (otherAgents.length > 0) {
      const agentList = otherAgents
        .map((a) => `- ${a.name} (@${a.tgBotUsername || "unknown"})`)
        .join("\n");
      return (
        `I cannot process this request directly (LLM provider not configured). ` +
        `Here are other agents in the system that might help:\n${agentList}\n\n` +
        `Try reaching out to one of them in the group.`
      );
    }

    return (
      `I'm unable to process this request. ` +
      `To enable me to handle this, please:\n` +
      `1. Configure an LLM provider (API key) in .env\n` +
      `2. Ensure my Agent config has the correct llmProvider and llmModel\n` +
      `3. Add relevant SOPs to define my capabilities`
    );
  }
}
