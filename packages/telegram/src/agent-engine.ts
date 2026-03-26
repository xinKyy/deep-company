import type { AppContext } from "./types.js";
import { resolveAgentWorkDir, type LlmMessage, type LlmTool } from "@ai-dev-pro/core";

interface ProcessContext {
  chatId: string;
  userId?: string;
  username?: string;
  isGroup: boolean;
}

export type ProgressCallback = (message: string) => Promise<void>;

function agentLog(agentId: string, ...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}][Agent:${agentId}]`, ...args);
}

function agentError(agentId: string, ...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.error(`[${ts}][Agent:${agentId}]`, ...args);
}

function elapsed(start: number): string {
  return `${((Date.now() - start) / 1000).toFixed(1)}s`;
}

const TOOL_PROGRESS_LABELS: Record<string, string> = {
  git_clone: "正在克隆仓库…",
  git_pull: "正在拉取最新代码…",
  git_push: "正在推送代码到远程…",
  git_commit: "正在提交代码变更…",
  git_branch: "正在创建/切换分支…",
  git_merge: "正在合并分支…",
  git_status: "正在检查仓库状态…",
  git_log: "正在查看提交历史…",
  git_diff: "正在查看文件差异…",
  git_create_pr: "正在创建 Pull Request…",
  git_trigger_action: "正在触发 GitHub Actions…",
  run_bash: "正在执行命令…",
  codex_write_code: "正在编写/修改代码…",
  codex_explain: "正在分析代码…",
  jenkins_trigger_job: "正在触发 Jenkins 构建…",
  jenkins_get_job_status: "正在查询构建状态…",
  jenkins_list_jobs: "正在获取 Jenkins 任务列表…",
  create_task: "正在创建任务…",
  create_subtask: "正在创建子任务…",
  update_task_status: "正在更新任务状态…",
  search_tasks: "正在搜索任务…",
  get_task_detail: "正在获取任务详情…",
  get_project_info: "正在查询项目信息…",
  list_projects: "正在获取项目列表…",
  search_projects: "正在搜索项目…",
  gog_create_doc: "正在创建 Google 文档…",
  gog_update_doc: "正在更新 Google 文档…",
  gog_read_doc: "正在读取 Google 文档…",
  gog_share_doc: "正在共享 Google 文档…",
  gog_list_docs: "正在获取文档列表…",
};

export class AgentEngine {
  private ctx: AppContext;
  private agentId: string;

  constructor(ctx: AppContext, agentId: string) {
    this.ctx = ctx;
    this.agentId = agentId;
  }

  async process(
    userMessage: string,
    pCtx: ProcessContext,
    onProgress?: ProgressCallback
  ): Promise<string | null> {
    const agent = await this.ctx.agentService.getById(this.agentId);
    if (!agent) return "Agent configuration not found.";

    const agentWorkDir = resolveAgentWorkDir(agent.id, agent.workDir);

    const agentSops = await this.ctx.sopService.getSopsByAgentId(this.agentId);
    const projectList = await this.ctx.projectService.list();

    const recentMemories = await this.ctx.memoryService.getRelevantContext(this.agentId);
    const conversationHistory = await this.ctx.messageService.getConversationHistory(
      pCtx.chatId,
      this.agentId,
      10
    );

    const systemPrompt = this.buildSystemPrompt(agent, agentSops, recentMemories, agentWorkDir, projectList);
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

    const emitProgress = async (msg: string) => {
      if (onProgress && msg.trim()) {
        try {
          await onProgress(msg.trim());
        } catch (e) {
          agentError(this.agentId, "progress callback failed:", e);
        }
      }
    };

    const processStart = Date.now();
    agentLog(this.agentId, `▶ process() start | user="${userMessage.substring(0, 80)}" | chat=${pCtx.chatId} | model=${agent.llmProvider}/${agent.llmModel}`);

    try {
      agentLog(this.agentId, "  → LLM call #0 (initial)");
      const llm0 = Date.now();
      let result = await this.ctx.llmRouter.complete({
        provider: agent.llmProvider,
        model: agent.llmModel,
        messages,
        tools,
        temperature: 0.7,
      });
      agentLog(this.agentId, `  ← LLM call #0 done (${elapsed(llm0)}) | content=${result.content ? result.content.length + "chars" : "null"} | toolCalls=${result.toolCalls.length} [${result.toolCalls.map(tc => tc.function.name).join(", ")}]`);

      let iterations = 0;
      let llmCallCount = 0;
      const maxIterations = 15;

      while (result.toolCalls.length > 0 && iterations < maxIterations) {
        const hasRealTools = result.toolCalls.some((tc) => tc.function.name !== "report_progress");
        if (hasRealTools) {
          iterations++;
        }

        llmCallCount++;
        agentLog(this.agentId, `  ── iteration ${iterations}/${maxIterations} (llmCall=${llmCallCount}) | ${result.toolCalls.length} tool call(s): [${result.toolCalls.map(tc => tc.function.name).join(", ")}]${hasRealTools ? "" : " (progress-only, not counted)"}`);

        if (result.content) {
          agentLog(this.agentId, `  📢 LLM intermediate content: "${result.content.substring(0, 120)}"`);
          await emitProgress(result.content);
        }

        messages.push({
          role: "assistant",
          content: result.content || "",
          tool_calls: result.toolCalls,
        });

        const progressLabels = result.toolCalls
          .filter((tc) => tc.function.name !== "report_progress")
          .map((tc) => TOOL_PROGRESS_LABELS[tc.function.name])
          .filter(Boolean);

        if (progressLabels.length > 0 && !result.content) {
          await emitProgress(`⏳ ${progressLabels.join(" ")}`);
        }

        for (const tc of result.toolCalls) {
          if (tc.function.name === "report_progress") {
            const params = JSON.parse(tc.function.arguments);
            agentLog(this.agentId, `  🔔 report_progress: "${params.message}"`);
            await emitProgress(`💬 ${params.message}`);
            messages.push({
              role: "tool",
              content: JSON.stringify({ ok: true }),
              tool_call_id: tc.id,
            });
            continue;
          }

          const toolStart = Date.now();
          agentLog(this.agentId, `  → tool[${tc.function.name}] start | args=${tc.function.arguments.substring(0, 200)}`);
          try {
            const params = JSON.parse(tc.function.arguments);
            const execResult = await this.ctx.skillService.execute(
              tc.function.name,
              params,
              { agentId: this.agentId, agentWorkDir }
            );

            const resultStr = JSON.stringify(execResult);
            agentLog(this.agentId, `  ← tool[${tc.function.name}] done (${elapsed(toolStart)}) | result=${resultStr.substring(0, 200)}${resultStr.length > 200 ? "…" : ""}`);

            messages.push({
              role: "tool",
              content: resultStr,
              tool_call_id: tc.id,
            });
          } catch (toolErr: any) {
            agentError(this.agentId, `  ✖ tool[${tc.function.name}] ERROR (${elapsed(toolStart)}):`, toolErr.message || toolErr);
            messages.push({
              role: "tool",
              content: JSON.stringify({ error: toolErr.message || String(toolErr) }),
              tool_call_id: tc.id,
            });
          }
        }

        agentLog(this.agentId, `  → LLM call #${llmCallCount}`);
        const llmN = Date.now();
        result = await this.ctx.llmRouter.complete({
          provider: agent.llmProvider,
          model: agent.llmModel,
          messages,
          tools,
          temperature: 0.7,
        });
        agentLog(this.agentId, `  ← LLM call #${llmCallCount} done (${elapsed(llmN)}) | content=${result.content ? result.content.length + "chars" : "null"} | toolCalls=${result.toolCalls.length} [${result.toolCalls.map(tc => tc.function.name).join(", ")}]`);
      }

      let reply = result.content;

      if (iterations >= maxIterations && result.toolCalls.length > 0) {
        agentLog(this.agentId, `  ⚠ max iterations (${maxIterations}) reached, still had ${result.toolCalls.length} pending tool calls — forcing final summary`);

        messages.push({
          role: "assistant",
          content: result.content || "",
          tool_calls: result.toolCalls,
        });
        for (const tc of result.toolCalls) {
          messages.push({
            role: "tool",
            content: JSON.stringify({ error: "Execution skipped: agent reached maximum iteration limit." }),
            tool_call_id: tc.id,
          });
        }
        messages.push({
          role: "user",
          content: "你已经达到了最大执行步数限制。请根据目前已完成的工作，给出一个总结回复：已经做了什么、还有什么没完成、下一步建议是什么。",
        });

        agentLog(this.agentId, `  → LLM final summary call`);
        const llmFinal = Date.now();
        const finalResult = await this.ctx.llmRouter.complete({
          provider: agent.llmProvider,
          model: agent.llmModel,
          messages,
          temperature: 0.7,
        });
        agentLog(this.agentId, `  ← LLM final summary done (${elapsed(llmFinal)}) | content=${finalResult.content ? finalResult.content.length + "chars" : "null"}`);
        reply = finalResult.content;
      }

      agentLog(this.agentId, `■ process() done (${elapsed(processStart)}) | iterations=${iterations} | llmCalls=${llmCallCount + 1} | reply=${reply ? reply.length + "chars" : "null"}`);

      if (reply) {
        await this.ctx.memoryService.create({
          agentId: this.agentId,
          type: "summary",
          content: `User: ${userMessage}\nAgent: ${reply.substring(0, 500)}`,
        });
      }

      return reply;
    } catch (err: any) {
      agentError(this.agentId, `✖ process() FAILED (${elapsed(processStart)}):`, err.message || err);
      agentError(this.agentId, `  stack:`, err.stack);

      if (err.message?.includes("not registered")) {
        return this.handleNoLlmProvider(agent, userMessage, agentSops, pCtx);
      }

      return `Error processing request: ${err.message}`;
    }
  }

  private buildSystemPrompt(
    agent: any,
    agentSops: any[],
    memories: any[],
    agentWorkDir: string,
    projectList?: any[]
  ): string {
    const parts = [
      agent.systemPrompt || `You are ${agent.name}. ${agent.description}`,
      "",
      "## Workspace (filesystem):",
      `Your default directory for run_bash, git_*, and codex_* tools is:\n\`${agentWorkDir}\`\n`,
      "Do not create files in the ai-dev-pro application source tree unless the user explicitly asks.",
      "",
    ];

    if (projectList && projectList.length > 0) {
      parts.push("## Registered Projects:");
      for (const p of projectList) {
        parts.push(`- **${p.name}** (id: ${p.id}) repo: ${p.repoUrl || "N/A"} — ${p.description || "No description"}`);
      }
      parts.push("");
      parts.push("When users refer to a project by abbreviation or partial name, match against the list above. Use `get_project_info` or `search_projects` if unsure.");
      parts.push("");
    }

    parts.push("## Your Capabilities (SOPs):");

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
      "## Progress Reporting:",
      "- When executing multi-step operations, use the `report_progress` tool to inform the user what you are currently doing BEFORE calling other tools.",
      "- For example, before pulling code and creating a branch, call report_progress with '正在拉取最新代码并准备创建分支'.",
      "- Keep progress messages concise and natural — describe the current action and next step.",
      "- Always report progress before time-consuming operations (git clone, codex, bash commands, etc.).",
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
        description: "Get project information by name or keyword. Supports fuzzy match — you can pass a partial name, abbreviation, or keyword.",
        parameters: {
          type: "object",
          properties: { name: { type: "string", description: "Project name or keyword (supports partial/fuzzy match)" } },
          required: ["name"],
        },
      },
      list_projects: {
        description: "List all registered projects in the system",
        parameters: { type: "object", properties: {} },
      },
      search_projects: {
        description: "Search projects by keyword (matches name, description, or repo URL)",
        parameters: {
          type: "object",
          properties: { keyword: { type: "string", description: "Search keyword" } },
          required: ["keyword"],
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
            cwd: { type: "string", description: "Optional; defaults to this agent's workspace directory" },
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
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            remote: { type: "string", description: "Remote name (default: origin)" },
            branch: { type: "string", description: "Branch name" },
          },
          required: [],
        },
      },
      git_push: {
        description: "Push commits to remote",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            remote: { type: "string", description: "Remote name" },
            branch: { type: "string", description: "Branch name" },
            force: { type: "boolean", description: "Force push" },
          },
          required: [],
        },
      },
      git_commit: {
        description: "Commit changes (optionally git add -A first)",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            message: { type: "string", description: "Commit message" },
            addAll: { type: "boolean", description: "Run git add -A before commit" },
          },
          required: ["message"],
        },
      },
      git_branch: {
        description: "Create or checkout a git branch",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            name: { type: "string", description: "Branch name" },
            checkout: { type: "boolean", description: "Checkout the new branch" },
            from: { type: "string", description: "Base branch to create from" },
          },
          required: ["name"],
        },
      },
      git_merge: {
        description: "Merge a branch into current branch",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            branch: { type: "string", description: "Branch to merge" },
            noFf: { type: "boolean", description: "No fast-forward merge" },
            message: { type: "string", description: "Merge commit message" },
          },
          required: ["branch"],
        },
      },
      git_status: {
        description: "Show working tree status (git status --porcelain)",
        parameters: {
          type: "object",
          properties: { cwd: { type: "string", description: "Repo root (defaults to agent workspace)" } },
          required: [],
        },
      },
      git_log: {
        description: "Show recent commit log",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            count: { type: "number", description: "Number of commits to show (default 10)" },
          },
          required: [],
        },
      },
      git_diff: {
        description: "Show file differences",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            staged: { type: "boolean", description: "Show staged changes only" },
          },
          required: [],
        },
      },
      git_create_pr: {
        description: "Create a Pull Request (GitHub) or Merge Request (GitLab)",
        parameters: {
          type: "object",
          properties: {
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            title: { type: "string", description: "PR/MR title" },
            body: { type: "string", description: "PR/MR description" },
            base: { type: "string", description: "Base branch (default: main)" },
            head: { type: "string", description: "Head branch" },
            platform: { type: "string", enum: ["github", "gitlab"], description: "Git platform" },
          },
          required: ["title"],
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
        description: "Trigger a Jenkins build job. Use `branch` for the git branch to build, and `buildParams` for any additional Jenkins build parameters.",
        parameters: {
          type: "object",
          properties: {
            jobUrl: { type: "string", description: "Full Jenkins job URL (e.g. https://jenkins.example.com/job/my-project)" },
            branch: { type: "string", description: "Git branch to build (e.g. 'feature/xxx', 'develop', 'main')" },
            branchParamName: { type: "string", description: "Jenkins parameter name for the branch (default: 'GIT_BRANCH'). Only set if the job uses a non-standard name." },
            buildParams: { type: "object", description: "Additional Jenkins build parameters as key-value pairs (e.g. {\"ENV\": \"staging\", \"DEPLOY\": \"true\"})" },
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
            cwd: { type: "string", description: "Repo root (defaults to agent workspace)" },
            model: { type: "string", description: "Model to use" },
            approval: { type: "string", enum: ["suggest", "auto-edit", "full-auto"], description: "Approval mode" },
          },
          required: ["prompt"],
        },
      },
      codex_explain: {
        description: "Use Codex CLI to explain or analyze code",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "What to explain" },
            cwd: { type: "string", description: "Working directory (defaults to agent workspace)" },
          },
          required: ["prompt"],
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
    const tools: LlmTool[] = [
      {
        type: "function",
        function: {
          name: "report_progress",
          description:
            "Send a real-time progress update to the user. Use this to communicate what you are currently doing during multi-step operations (e.g. '正在拉取代码并准备创建分支'). Keep messages concise and informative.",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "A short, user-facing progress message describing the current step",
              },
            },
            required: ["message"],
          },
        },
      },
    ];

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
