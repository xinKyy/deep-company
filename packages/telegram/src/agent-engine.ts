import type { AppContext } from "./types.js";
import { resolveAgentWorkDir, type LlmMessage, type LlmTool, type LlmContentPart } from "@ai-dev-pro/core";

interface ProcessContext {
  chatId: string;
  userId?: string;
  username?: string;
  isGroup: boolean;
  imageUrls?: string[];
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
  figma_get_design: "正在获取 Figma 设计数据…",
  figma_download_images: "正在下载 Figma 图片资源…",
  figma_parse_url: "正在解析 Figma URL…",
  list_agents: "正在获取 Agent 列表…",
  clawhub_search: "正在搜索技能…",
  clawhub_install: "正在安装技能…",
  clawhub_list_installed: "正在获取已安装技能列表…",
  clawhub_skill_info: "正在读取技能详情…",
  clawhub_uninstall: "正在卸载技能…",
  lark_read_doc: "正在读取飞书文档…",
  lark_create_doc: "正在创建飞书文档…",
  lark_get_wiki_node: "正在获取飞书 Wiki 节点信息…",
  lark_read_wiki: "正在读取飞书 Wiki 页面…",
  lark_search_wiki: "正在搜索飞书 Wiki…",
  lark_create_wiki_node: "正在创建飞书 Wiki 页面…",
  lark_parse_url: "正在解析飞书链接…",
  pencil_open_document: "正在打开设计文件…",
  pencil_get_editor_state: "正在获取编辑器状态…",
  pencil_get_guidelines: "正在获取设计规范…",
  pencil_get_style_guide_tags: "正在获取风格标签…",
  pencil_get_style_guide: "正在获取风格指南…",
  pencil_batch_get: "正在读取设计节点…",
  pencil_batch_design: "正在执行设计操作…",
  pencil_get_screenshot: "正在截取设计截图…",
  pencil_export_nodes: "正在导出设计图…",
  pencil_snapshot_layout: "正在检查布局结构…",
  pencil_get_variables: "正在获取设计变量…",
  pencil_set_variables: "正在更新设计变量…",
  send_tg_photo: "正在发送图片到 Telegram…",
  design_html_screenshot: "正在生成 HTML 设计截图…",
  design_url_screenshot: "正在截取网页截图…",
  design_component_preview: "正在预览 UI 组件…",
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

    if (pCtx.imageUrls && pCtx.imageUrls.length > 0) {
      const contentParts: LlmContentPart[] = pCtx.imageUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url, detail: "auto" as const },
      }));
      contentParts.push({ type: "text", text: userMessage || "请描述这张图片" });
      messages.push({ role: "user", content: contentParts });
    } else {
      messages.push({ role: "user", content: userMessage });
    }

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
              { agentId: this.agentId, agentWorkDir, chatId: pCtx.chatId }
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
      list_agents: {
        description: "List all agents in the system with their name, description, status, and Telegram username. Use this to discover other agents, check who is available, or find the right agent to delegate a task to.",
        parameters: { type: "object", properties: {} },
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
      // ─── Figma Skills ──────────────────────────────────────────────
      figma_get_design: {
        description: "Get comprehensive Figma design data including layout, content, visuals, and component info. Use fileKey from a Figma URL (figma.com/design/<fileKey>/...) and optionally a nodeId for a specific frame.",
        parameters: {
          type: "object",
          properties: {
            fileKey: { type: "string", description: "Figma file key (from URL: figma.com/design/<fileKey>/...)" },
            nodeId: { type: "string", description: "Node ID (format '1234:5678', from URL param node-id)" },
            depth: { type: "number", description: "Tree traversal depth (only if user explicitly requests)" },
          },
          required: ["fileKey"],
        },
      },
      figma_download_images: {
        description: "Download SVG/PNG/GIF images from Figma nodes to a local directory",
        parameters: {
          type: "object",
          properties: {
            fileKey: { type: "string", description: "Figma file key" },
            nodes: {
              type: "array",
              description: "Image nodes to download",
              items: {
                type: "object",
                properties: {
                  nodeId: { type: "string", description: "Figma node ID (e.g. '1234:5678')" },
                  fileName: { type: "string", description: "Local filename with extension (e.g. 'icon.svg', 'hero.png')" },
                  imageRef: { type: "string", description: "Image ref from Figma data (for raster images)" },
                  gifRef: { type: "string", description: "GIF ref from Figma data (for animated GIFs)" },
                },
                required: ["nodeId", "fileName"],
              },
            },
            localPath: { type: "string", description: "Directory to save images (e.g. 'public/images')" },
            pngScale: { type: "number", description: "PNG export scale (default 2)" },
          },
          required: ["fileKey", "nodes", "localPath"],
        },
      },
      figma_parse_url: {
        description: "Parse a Figma URL to extract fileKey and nodeId for use with other Figma tools",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "Figma URL (figma.com/design/..., figma.com/board/..., etc.)" },
          },
          required: ["url"],
        },
      },
      // ─── ClawHub / Skills Marketplace ──────────────────────────────
      clawhub_search: {
        description: "Search for agent skills on ClawHub (clawhub.ai) or skills.sh marketplace. Use when you need a new capability or the user asks to find/install skills.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keywords (e.g. 'react testing', 'deploy vercel', 'code review')" },
            source: { type: "string", enum: ["clawhub", "skills-sh", "both"], description: "Which marketplace to search (default: both)" },
          },
          required: ["query"],
        },
      },
      clawhub_install: {
        description: "Install an agent skill from ClawHub or skills.sh. Skills are SKILL.md bundles that extend agent capabilities with specialized knowledge and workflows.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Skill name or package identifier (e.g. 'sonoscli' for ClawHub, 'vercel-labs/agent-skills@react-best-practices' for skills.sh)" },
            version: { type: "string", description: "Specific version to install (ClawHub only)" },
            source: { type: "string", enum: ["clawhub", "skills-sh"], description: "Install source (default: clawhub)" },
            dir: { type: "string", description: "Custom install directory (default: ~/.agents/skills/)" },
            force: { type: "boolean", description: "Force reinstall if already exists" },
          },
          required: ["name"],
        },
      },
      clawhub_list_installed: {
        description: "List all locally installed agent skills",
        parameters: {
          type: "object",
          properties: {
            dir: { type: "string", description: "Skills directory to scan (default: ~/.agents/skills/)" },
          },
        },
      },
      clawhub_skill_info: {
        description: "Read the full SKILL.md content of an installed skill to understand its capabilities and usage",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Installed skill name (folder name)" },
            dir: { type: "string", description: "Skills directory (default: ~/.agents/skills/)" },
          },
          required: ["name"],
        },
      },
      clawhub_uninstall: {
        description: "Remove an installed agent skill",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Skill name to uninstall" },
            dir: { type: "string", description: "Skills directory (default: ~/.agents/skills/)" },
          },
          required: ["name"],
        },
      },
      // ─── Lark / 飞书 Skills ───────────────────────────────────────
      lark_read_doc: {
        description: "Read a Lark/Feishu document's text content by document ID. You can get the document ID from a Lark URL or from wiki node info.",
        parameters: {
          type: "object",
          properties: {
            documentId: { type: "string", description: "Lark document ID (e.g. 'JDYSdxxxxxx')" },
          },
          required: ["documentId"],
        },
      },
      lark_create_doc: {
        description: "Create a new Lark/Feishu document. Supports simple markdown formatting (# headings, plain text paragraphs). Returns the new document ID.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Document title" },
            content: { type: "string", description: "Document content (supports simple markdown: # headings, plain text)" },
            folderToken: { type: "string", description: "Folder token to create the document in (optional)" },
          },
          required: ["title"],
        },
      },
      lark_get_wiki_node: {
        description: "Get Lark/Feishu Wiki node info (title, space, type, timestamps, etc.) by node token",
        parameters: {
          type: "object",
          properties: {
            token: { type: "string", description: "Wiki node token" },
          },
          required: ["token"],
        },
      },
      lark_read_wiki: {
        description: "Read a Lark/Feishu Wiki page's text content by node token. Also returns node metadata.",
        parameters: {
          type: "object",
          properties: {
            nodeToken: { type: "string", description: "Wiki node token (from URL or search results)" },
          },
          required: ["nodeToken"],
        },
      },
      lark_search_wiki: {
        description: "Search Lark/Feishu Wiki pages by keyword. Optionally scope to a specific wiki space.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search keyword" },
            spaceId: { type: "string", description: "Wiki space ID to search within (optional, searches all accessible spaces if omitted)" },
          },
          required: ["query"],
        },
      },
      lark_create_wiki_node: {
        description: "Create a new page in a Lark/Feishu Wiki space. Supports simple markdown content.",
        parameters: {
          type: "object",
          properties: {
            spaceId: { type: "string", description: "Wiki space ID" },
            parentNodeToken: { type: "string", description: "Parent node token (optional; creates at space root if omitted)" },
            title: { type: "string", description: "Page title" },
            content: { type: "string", description: "Page content (supports simple markdown: # headings, plain text)" },
          },
          required: ["spaceId", "title"],
        },
      },
      lark_parse_url: {
        description: "Parse a Lark/Feishu URL to extract document type and token. Use this to get the document ID or wiki node token from a URL shared by the user.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "Lark/Feishu URL (e.g. https://xxx.feishu.cn/docx/xxx or https://xxx.feishu.cn/wiki/xxx)" },
          },
          required: ["url"],
        },
      },
      // ─── Pencil Design Skills ─────────────────────────────────────
      pencil_open_document: {
        description: "Open or create a .pen design file. Pass 'new' for a blank file, or a path to an existing .pen file.",
        parameters: {
          type: "object",
          properties: {
            filePathOrTemplate: { type: "string", description: "File path to .pen file, or 'new' for blank" },
          },
          required: ["filePathOrTemplate"],
        },
      },
      pencil_get_editor_state: {
        description: "Get the current Pencil editor state: active file, selection, and schema info.",
        parameters: {
          type: "object",
          properties: {
            includeSchema: { type: "boolean", description: "Include .pen file schema (default true)" },
          },
        },
      },
      pencil_get_guidelines: {
        description: "Get design guidelines for a specific topic (web-app, mobile-app, landing-page, design-system, slides, code, table, tailwind).",
        parameters: {
          type: "object",
          properties: {
            topic: { type: "string", enum: ["code", "table", "tailwind", "landing-page", "design-system", "slides", "mobile-app", "web-app"] },
          },
          required: ["topic"],
        },
      },
      pencil_get_style_guide_tags: {
        description: "Get all available style guide tags for design inspiration.",
        parameters: { type: "object", properties: {} },
      },
      pencil_get_style_guide: {
        description: "Get a style guide based on tags or name for design inspiration.",
        parameters: {
          type: "object",
          properties: {
            tags: { type: "array", items: { type: "string" }, description: "5-10 style tags" },
            name: { type: "string", description: "Specific style guide name" },
          },
        },
      },
      pencil_batch_get: {
        description: "Read nodes from a .pen design file by patterns or IDs. Use to discover components and structure.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: ".pen file path" },
            patterns: { type: "array", description: "Search patterns [{reusable: true}, {type: 'frame'}]" },
            nodeIds: { type: "array", items: { type: "string" }, description: "Node IDs to read" },
            readDepth: { type: "number", description: "How deep to read children (default 1)" },
            searchDepth: { type: "number", description: "How deep to search (default unlimited)" },
          },
          required: ["filePath"],
        },
      },
      pencil_batch_design: {
        description: "Execute design operations (insert/copy/update/replace/move/delete/image) in a .pen file. Max 25 ops per call.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: ".pen file path" },
            operations: { type: "string", description: "Operation script (e.g. 'sidebar=I(\"parentId\",{type:\"frame\",layout:\"vertical\"})')" },
          },
          required: ["filePath", "operations"],
        },
      },
      pencil_get_screenshot: {
        description: "Get a screenshot of a design node. Returns the image file path. Use send_tg_photo to share it.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: ".pen file path" },
            nodeId: { type: "string", description: "Node ID to screenshot" },
          },
          required: ["filePath", "nodeId"],
        },
      },
      pencil_export_nodes: {
        description: "Export design nodes to image files (PNG/JPEG/WEBP/PDF).",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: ".pen file path" },
            outputDir: { type: "string", description: "Output directory for exported files" },
            nodeIds: { type: "array", items: { type: "string" }, description: "Node IDs to export" },
            format: { type: "string", enum: ["png", "jpeg", "webp", "pdf"], description: "Export format (default png)" },
            scale: { type: "number", description: "Scale factor (default 2)" },
          },
          required: ["filePath", "outputDir", "nodeIds"],
        },
      },
      pencil_snapshot_layout: {
        description: "Check the computed layout of nodes in a .pen file to verify positioning.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: ".pen file path" },
            maxDepth: { type: "number", description: "Max depth to traverse" },
            parentId: { type: "string", description: "Parent node to check" },
            problemsOnly: { type: "boolean", description: "Only return nodes with layout issues" },
          },
          required: ["filePath"],
        },
      },
      pencil_get_variables: {
        description: "Get design variables and themes from a .pen file.",
        parameters: {
          type: "object",
          properties: { filePath: { type: "string", description: ".pen file path" } },
          required: ["filePath"],
        },
      },
      pencil_set_variables: {
        description: "Update design variables and themes in a .pen file.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: ".pen file path" },
            variables: { type: "object", description: "Variable definitions" },
            replace: { type: "boolean", description: "Replace all existing variables" },
          },
          required: ["filePath", "variables"],
        },
      },
      // ─── Telegram Photo ──────────────────────────────────────────
      send_tg_photo: {
        description: "Send an image file to a Telegram chat. Use after design tools (design_html_screenshot, pencil_export_nodes, etc.) to share screenshots. If chatId is omitted, sends to current chat.",
        parameters: {
          type: "object",
          properties: {
            filePath: { type: "string", description: "Local path to the image file" },
            caption: { type: "string", description: "Photo caption text" },
            chatId: { type: "string", description: "Target Telegram chat ID (optional, defaults to current chat)" },
          },
          required: ["filePath"],
        },
      },
      // ─── Puppeteer Design Skills (available when Pencil is not configured) ──
      design_html_screenshot: {
        description: "Render HTML code to a PNG screenshot. Write full HTML (with CSS, Tailwind, etc.) and get a high-quality image. Use send_tg_photo to share the result. Great for creating UI mockups, dashboards, landing pages, and any visual design.",
        parameters: {
          type: "object",
          properties: {
            html: { type: "string", description: "Complete HTML code to render (can include <style>, Tailwind classes, inline styles, etc.)" },
            width: { type: "number", description: "Viewport width in pixels (default 1280)" },
            height: { type: "number", description: "Viewport height in pixels (default 800)" },
            outputPath: { type: "string", description: "Custom output file path (optional)" },
            deviceScaleFactor: { type: "number", description: "Pixel density (default 2 for retina)" },
          },
          required: ["html"],
        },
      },
      design_url_screenshot: {
        description: "Take a screenshot of a live webpage by URL. Optionally capture only a specific CSS selector.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL to screenshot" },
            width: { type: "number", description: "Viewport width (default 1280)" },
            height: { type: "number", description: "Viewport height (default 800)" },
            selector: { type: "string", description: "CSS selector to capture specific element (optional)" },
            outputPath: { type: "string", description: "Custom output path (optional)" },
            deviceScaleFactor: { type: "number", description: "Pixel density (default 2)" },
          },
          required: ["url"],
        },
      },
      design_component_preview: {
        description: "Preview a UI component as an image. Supports raw HTML, Tailwind HTML, or React JSX. The component is rendered with proper styling and captured as a screenshot. Perfect for quickly prototyping and sharing UI designs.",
        parameters: {
          type: "object",
          properties: {
            componentCode: { type: "string", description: "Component code (HTML, Tailwind HTML, or React JSX)" },
            framework: { type: "string", enum: ["html", "tailwind", "react"], description: "Framework: 'html' (plain), 'tailwind' (auto-loads Tailwind CSS), 'react' (auto-loads React+Babel+Tailwind)" },
            width: { type: "number", description: "Viewport width (default 1280)" },
            height: { type: "number", description: "Viewport height (default 800)" },
            theme: { type: "string", enum: ["light", "dark"], description: "Background theme (default light)" },
            outputPath: { type: "string", description: "Custom output path (optional)" },
          },
          required: ["componentCode"],
        },
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
