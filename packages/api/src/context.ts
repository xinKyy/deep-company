import {
  AgentService,
  SopService,
  TaskService,
  ProjectService,
  SkillService,
  McpService,
  MemoryService,
  MessageService,
  EnvVarService,
  LlmRouter,
  createOpenAIAdapter,
  createAnthropicAdapter,
} from "@ai-dev-pro/core";

export interface AppContext {
  agentService: AgentService;
  sopService: SopService;
  taskService: TaskService;
  projectService: ProjectService;
  skillService: SkillService;
  mcpService: McpService;
  memoryService: MemoryService;
  messageService: MessageService;
  envVarService: EnvVarService;
  llmRouter: LlmRouter;
}

export function createAppContext(): AppContext {
  const agentService = new AgentService();
  const sopService = new SopService();
  const taskService = new TaskService();
  const projectService = new ProjectService();
  const skillService = new SkillService();
  const mcpService = new McpService();
  const memoryService = new MemoryService();
  const messageService = new MessageService();
  const envVarService = new EnvVarService();
  const llmRouter = new LlmRouter();

  if (process.env.OPENAI_API_KEY) {
    llmRouter.registerProvider(
      "openai",
      createOpenAIAdapter(
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
      )
    );
  }

  if (process.env.ANTHROPIC_API_KEY) {
    llmRouter.registerProvider(
      "anthropic",
      createAnthropicAdapter(process.env.ANTHROPIC_API_KEY)
    );
  }

  if (process.env.DEEPSEEK_API_KEY) {
    llmRouter.registerProvider(
      "deepseek",
      createOpenAIAdapter(
        process.env.DEEPSEEK_API_KEY,
        process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"
      )
    );
  }

  if (process.env.GOOGLE_API_KEY) {
    llmRouter.registerProvider(
      "google",
      createOpenAIAdapter(
        process.env.GOOGLE_API_KEY,
        "https://generativelanguage.googleapis.com/v1beta/openai"
      )
    );
  }

  registerBuiltinSkills(skillService, taskService, projectService, agentService);
  registerSystemSkills(skillService, envVarService);

  return {
    agentService,
    sopService,
    taskService,
    projectService,
    skillService,
    mcpService,
    memoryService,
    messageService,
    envVarService,
    llmRouter,
  };
}

function registerBuiltinSkills(
  skillService: SkillService,
  taskService: TaskService,
  projectService: ProjectService,
  agentService: AgentService
) {
  skillService.registerHandler("create_task", async (params, ctx) => {
    const p = params as any;

    if (p.projectId) {
      const project = await projectService.getById(p.projectId);
      if (!project) p.projectId = null;
    }
    if (p.assignedAgentId) {
      const agent = await agentService.getById(p.assignedAgentId);
      if (!agent) p.assignedAgentId = null;
    }

    return taskService.create({
      ...p,
      createdByAgentId: ctx.agentId,
    });
  });

  skillService.registerHandler("update_task_status", async (params) => {
    const { taskId, status, comment } = params as any;
    return taskService.transition(taskId, status, undefined, comment);
  });

  skillService.registerHandler("search_tasks", async (params) => {
    const { keyword } = params as any;
    return taskService.search(keyword);
  });

  skillService.registerHandler("get_task_detail", async (params) => {
    const { taskId } = params as any;
    return taskService.getDetail(taskId);
  });

  skillService.registerHandler("get_project_info", async (params) => {
    const { name } = params as any;
    return projectService.getByName(name);
  });

  skillService.registerHandler("create_subtask", async (params, ctx) => {
    const p = params as any;

    if (p.assignedAgentId) {
      const agent = await agentService.getById(p.assignedAgentId);
      if (!agent) p.assignedAgentId = null;
    }

    return taskService.create({
      ...p,
      createdByAgentId: ctx.agentId,
    });
  });
}

import { execFile, spawn } from "child_process";
import { promisify } from "util";
const execFileAsync = promisify(execFile);

async function run(
  cmd: string,
  args: string[],
  options: { cwd?: string; env?: Record<string, string>; input?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    if (options.input) proc.stdin.end(options.input);
    else proc.stdin.end();
    proc.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`Command failed (exit ${code}): ${stderr || stdout}`));
    });
    proc.on("error", reject);
  });
}

function registerSystemSkills(
  skillService: SkillService,
  envVarService: EnvVarService
) {
  // ─── Git Skills ───────────────────────────────────────────────────────────

  skillService.registerHandler("git_clone", async (params) => {
    const { repoUrl, targetDir, platform } = params as {
      repoUrl: string;
      targetDir?: string;
      platform?: "github" | "gitlab";
    };
    let url = repoUrl;
    if (url.startsWith("https://")) {
      const tokenKey =
        platform === "gitlab" ? "GITLAB_TOKEN" : "GITHUB_TOKEN";
      const token = await envVarService.getValue(tokenKey);
      if (token) {
        const urlObj = new URL(url);
        if (platform === "gitlab") {
          urlObj.username = "oauth2";
          urlObj.password = token;
        } else {
          urlObj.username = token;
        }
        url = urlObj.toString();
      }
    }
    const args = ["clone", url];
    if (targetDir) args.push(targetDir);
    return run("git", args);
  });

  skillService.registerHandler("git_pull", async (params) => {
    const { cwd, remote, branch } = params as {
      cwd: string;
      remote?: string;
      branch?: string;
    };
    const args = ["pull"];
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    return run("git", args, { cwd });
  });

  skillService.registerHandler("git_push", async (params) => {
    const { cwd, remote, branch, force } = params as {
      cwd: string;
      remote?: string;
      branch?: string;
      force?: boolean;
    };
    const args = ["push"];
    if (force) args.push("--force");
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    return run("git", args, { cwd });
  });

  skillService.registerHandler("git_commit", async (params) => {
    const { cwd, message, addAll } = params as {
      cwd: string;
      message: string;
      addAll?: boolean;
    };
    if (addAll) {
      await run("git", ["add", "-A"], { cwd });
    }
    return run("git", ["commit", "-m", message], { cwd });
  });

  skillService.registerHandler("git_branch", async (params) => {
    const { cwd, name, checkout, from } = params as {
      cwd: string;
      name: string;
      checkout?: boolean;
      from?: string;
    };
    if (checkout) {
      const args = ["checkout", "-b", name];
      if (from) args.push(from);
      return run("git", args, { cwd });
    }
    const args = ["branch", name];
    if (from) args.push(from);
    return run("git", args, { cwd });
  });

  skillService.registerHandler("git_merge", async (params) => {
    const { cwd, branch, noFf, message } = params as {
      cwd: string;
      branch: string;
      noFf?: boolean;
      message?: string;
    };
    const args = ["merge", branch];
    if (noFf) args.push("--no-ff");
    if (message) args.push("-m", message);
    return run("git", args, { cwd });
  });

  skillService.registerHandler("git_status", async (params) => {
    const { cwd } = params as { cwd: string };
    return run("git", ["status", "--porcelain"], { cwd });
  });

  skillService.registerHandler("git_log", async (params) => {
    const { cwd, count } = params as { cwd: string; count?: number };
    return run(
      "git",
      ["log", `--oneline`, `-n`, String(count || 10)],
      { cwd }
    );
  });

  skillService.registerHandler("git_diff", async (params) => {
    const { cwd, staged } = params as { cwd: string; staged?: boolean };
    const args = ["diff"];
    if (staged) args.push("--cached");
    return run("git", args, { cwd });
  });

  skillService.registerHandler("git_create_pr", async (params) => {
    const { cwd, title, body, base, head, platform } = params as {
      cwd: string;
      title: string;
      body?: string;
      base?: string;
      head?: string;
      platform?: "github" | "gitlab";
    };
    if (platform === "gitlab") {
      const token = await envVarService.resolve("GITLAB_TOKEN");
      const args = [
        "-X",
        "POST",
        "-H",
        `PRIVATE-TOKEN: ${token}`,
        "-H",
        "Content-Type: application/json",
      ];
      const { stdout: remoteUrl } = await run(
        "git",
        ["remote", "get-url", "origin"],
        { cwd }
      );
      const match = remoteUrl.trim().match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
      if (!match) throw new Error("Cannot parse GitLab project from remote URL");
      const projectPath = encodeURIComponent(match[1]);
      const payload = JSON.stringify({
        title,
        description: body || "",
        source_branch: head || (await run("git", ["branch", "--show-current"], { cwd })).stdout.trim(),
        target_branch: base || "main",
      });
      args.push("-d", payload);
      args.push(
        `https://gitlab.com/api/v4/projects/${projectPath}/merge_requests`
      );
      return run("curl", args);
    }

    const token = await envVarService.resolve("GITHUB_TOKEN");
    const ghArgs = ["pr", "create", "--title", title];
    if (body) ghArgs.push("--body", body);
    if (base) ghArgs.push("--base", base);
    if (head) ghArgs.push("--head", head);
    return run("gh", ghArgs, {
      cwd,
      env: { GH_TOKEN: token },
    });
  });

  skillService.registerHandler("git_trigger_action", async (params) => {
    const { owner, repo, workflow, ref, inputs } = params as {
      owner: string;
      repo: string;
      workflow: string;
      ref?: string;
      inputs?: Record<string, string>;
    };
    const token = await envVarService.resolve("GITHUB_TOKEN");
    const ghArgs = [
      "workflow",
      "run",
      workflow,
      "--repo",
      `${owner}/${repo}`,
    ];
    if (ref) ghArgs.push("--ref", ref);
    if (inputs) {
      for (const [k, v] of Object.entries(inputs)) {
        ghArgs.push("-f", `${k}=${v}`);
      }
    }
    return run("gh", ghArgs, { env: { GH_TOKEN: token } });
  });

  // ─── Jenkins Skills ───────────────────────────────────────────────────────

  skillService.registerHandler("jenkins_trigger_job", async (params) => {
    const { jobUrl, branch, parameters } = params as {
      jobUrl: string;
      branch?: string;
      parameters?: Record<string, string>;
    };
    const token = await envVarService.resolve("JENKINS_TOKEN");
    const allParams: Record<string, string> = { ...parameters };
    if (branch) allParams.BRANCH = branch;

    let url: string;
    if (Object.keys(allParams).length > 0) {
      const qs = new URLSearchParams(allParams).toString();
      url = `${jobUrl.replace(/\/$/, "")}/buildWithParameters?${qs}`;
    } else {
      url = `${jobUrl.replace(/\/$/, "")}/build`;
    }
    return run("curl", [
      "-X",
      "POST",
      "-H",
      `Authorization: Basic ${Buffer.from(token).toString("base64")}`,
      url,
    ]);
  });

  skillService.registerHandler("jenkins_get_job_status", async (params) => {
    const { jobUrl, buildNumber } = params as {
      jobUrl: string;
      buildNumber?: string;
    };
    const token = await envVarService.resolve("JENKINS_TOKEN");
    const num = buildNumber || "lastBuild";
    const url = `${jobUrl.replace(/\/$/, "")}/${num}/api/json`;
    return run("curl", [
      "-s",
      "-H",
      `Authorization: Basic ${Buffer.from(token).toString("base64")}`,
      url,
    ]);
  });

  skillService.registerHandler("jenkins_list_jobs", async (params) => {
    const { jenkinsUrl } = params as { jenkinsUrl: string };
    const token = await envVarService.resolve("JENKINS_TOKEN");
    const url = `${jenkinsUrl.replace(/\/$/, "")}/api/json?tree=jobs[name,url,color]`;
    return run("curl", [
      "-s",
      "-H",
      `Authorization: Basic ${Buffer.from(token).toString("base64")}`,
      url,
    ]);
  });

  // ─── Codex CLI Skill ──────────────────────────────────────────────────────

  skillService.registerHandler("codex_write_code", async (params) => {
    const { prompt, cwd, model, approval } = params as {
      prompt: string;
      cwd: string;
      model?: string;
      approval?: "suggest" | "auto-edit" | "full-auto";
    };
    const args = [];
    if (model) args.push("--model", model);
    if (approval) args.push(`--approval-mode`, approval);
    args.push(prompt);
    return run("codex", args, { cwd });
  });

  skillService.registerHandler("codex_explain", async (params) => {
    const { prompt, cwd } = params as { prompt: string; cwd: string };
    return run("codex", [prompt], { cwd });
  });

  // ─── Google Docs (gog) Skills ─────────────────────────────────────────────

  skillService.registerHandler("gog_create_doc", async (params) => {
    const { title, content } = params as {
      title: string;
      content?: string;
    };
    const args = ["create", "doc", "--title", title];
    if (content) args.push("--content", content);
    return run("gog", args);
  });

  skillService.registerHandler("gog_update_doc", async (params) => {
    const { docId, content, append } = params as {
      docId: string;
      content: string;
      append?: boolean;
    };
    const args = ["update", "doc", docId];
    if (append) args.push("--append");
    args.push("--content", content);
    return run("gog", args);
  });

  skillService.registerHandler("gog_read_doc", async (params) => {
    const { docId } = params as { docId: string };
    return run("gog", ["read", "doc", docId]);
  });

  skillService.registerHandler("gog_share_doc", async (params) => {
    const { docId, email, role } = params as {
      docId: string;
      email: string;
      role?: "reader" | "writer" | "commenter";
    };
    const args = ["share", docId, "--email", email];
    if (role) args.push("--role", role);
    return run("gog", args);
  });

  skillService.registerHandler("gog_list_docs", async () => {
    return run("gog", ["list", "docs"]);
  });
}

export function getCtx(req: any): AppContext {
  return req.ctx as AppContext;
}
