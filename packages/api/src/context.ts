import {
  AgentService,
  SopService,
  TaskService,
  ProjectService,
  SkillService,
  McpService,
  McpClientManager,
  FigmaService,
  LarkService,
  MemoryService,
  MessageService,
  EnvVarService,
  LlmRouter,
  createOpenAIAdapter,
  createAnthropicAdapter,
  ensureAgentWorkDir,
  type SkillExecutionContext,
} from "@ai-dev-pro/core";

export interface AppContext {
  agentService: AgentService;
  sopService: SopService;
  taskService: TaskService;
  projectService: ProjectService;
  skillService: SkillService;
  mcpService: McpService;
  mcpClientManager: McpClientManager;
  figmaService: FigmaService;
  larkService: LarkService | null;
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
  const mcpClientManager = new McpClientManager();
  const memoryService = new MemoryService();
  const messageService = new MessageService();
  const envVarService = new EnvVarService();
  const llmRouter = new LlmRouter();

  if (process.env.FIGMA_MCP_URL) {
    mcpClientManager.register({
      name: "figma",
      transport: "http",
      url: process.env.FIGMA_MCP_URL,
      headers: {
        ...(process.env.FIGMA_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.FIGMA_ACCESS_TOKEN}` } : {}),
      },
    });
    console.log(`[AppContext] Figma MCP registered (HTTP: ${process.env.FIGMA_MCP_URL})`);
  } else if (process.env.FIGMA_MCP_COMMAND) {
    const figmaToken = process.env.FIGMA_ACCESS_TOKEN || "";
    mcpClientManager.register({
      name: "figma",
      transport: "stdio",
      command: process.env.FIGMA_MCP_COMMAND,
      args: process.env.FIGMA_MCP_ARGS ? process.env.FIGMA_MCP_ARGS.split(" ") : [],
      env: {
        ...(figmaToken ? { FIGMA_ACCESS_TOKEN: figmaToken, FIGMA_API_KEY: figmaToken } : {}),
      },
    });
    console.log("[AppContext] Figma MCP registered (stdio)");
  }

  const figmaService = new FigmaService(mcpClientManager);

  let larkService: LarkService | null = null;
  if (process.env.LARK_APP_ID && process.env.LARK_APP_SECRET) {
    larkService = new LarkService(
      process.env.LARK_APP_ID,
      process.env.LARK_APP_SECRET,
      process.env.LARK_BASE_URL,
    );
    console.log("[AppContext] Lark service initialized");
  }

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
  registerFigmaSkills(skillService, figmaService);
  if (larkService) registerLarkSkills(skillService, larkService);
  registerClawHubSkills(skillService);

  return {
    agentService,
    sopService,
    taskService,
    projectService,
    skillService,
    mcpService,
    mcpClientManager,
    figmaService,
    larkService,
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
    const exact = await projectService.getByName(name);
    if (exact) return exact;
    const fuzzy = await projectService.search(name);
    if (fuzzy.length > 0) return fuzzy;
    return null;
  });

  skillService.registerHandler("list_projects", async () => {
    return projectService.list();
  });

  skillService.registerHandler("search_projects", async (params) => {
    const { keyword } = params as any;
    return projectService.search(keyword);
  });

  skillService.registerHandler("list_agents", async () => {
    const agents = await agentService.list();
    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      status: a.status,
      tgBotUsername: a.tgBotUsername || null,
    }));
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

function resolveSkillCwd(
  params: { cwd?: string },
  ctx: SkillExecutionContext
): string {
  const c = params.cwd?.trim();
  const dir = c || ctx.agentWorkDir;
  ensureAgentWorkDir(dir);
  return dir;
}

function registerSystemSkills(
  skillService: SkillService,
  envVarService: EnvVarService
) {
  // ─── Shell / Bash ───────────────────────────────────────────────────────

  skillService.registerHandler("run_bash", async (params, ctx) => {
    const { command, cwd, timeout } = params as {
      command: string;
      cwd?: string;
      timeout?: number;
    };
    const ms = Math.min(timeout || 120_000, 300_000);
    const workDir = resolveSkillCwd({ cwd }, ctx);
    return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      const proc = spawn("bash", ["-c", command], {
        cwd: workDir,
        env: process.env as Record<string, string>,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error(`Command timed out after ${ms}ms`));
      }, ms);
      proc.stdout.on("data", (d) => (stdout += d));
      proc.stderr.on("data", (d) => (stderr += d));
      proc.stdin.end();
      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`Exit ${code}: ${stderr || stdout}`));
      });
      proc.on("error", (e) => {
        clearTimeout(timer);
        reject(e);
      });
    });
  });

  // ─── Git Skills ───────────────────────────────────────────────────────────

  skillService.registerHandler("git_clone", async (params, ctx) => {
    const { repoUrl, targetDir, platform } = params as {
      repoUrl: string;
      targetDir?: string;
      platform?: "github" | "gitlab";
    };
    ensureAgentWorkDir(ctx.agentWorkDir);
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
    return run("git", args, { cwd: ctx.agentWorkDir });
  });

  skillService.registerHandler("git_pull", async (params, ctx) => {
    const { cwd, remote, branch } = params as {
      cwd?: string;
      remote?: string;
      branch?: string;
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
    const args = ["pull"];
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    return run("git", args, { cwd: dir });
  });

  skillService.registerHandler("git_push", async (params, ctx) => {
    const { cwd, remote, branch, force } = params as {
      cwd?: string;
      remote?: string;
      branch?: string;
      force?: boolean;
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
    const args = ["push"];
    if (force) args.push("--force");
    if (remote) args.push(remote);
    if (branch) args.push(branch);
    return run("git", args, { cwd: dir });
  });

  skillService.registerHandler("git_commit", async (params, ctx) => {
    const { cwd, message, addAll } = params as {
      cwd?: string;
      message: string;
      addAll?: boolean;
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
    if (addAll) {
      await run("git", ["add", "-A"], { cwd: dir });
    }
    return run("git", ["commit", "-m", message], { cwd: dir });
  });

  skillService.registerHandler("git_branch", async (params, ctx) => {
    const { cwd, name, checkout, from } = params as {
      cwd?: string;
      name: string;
      checkout?: boolean;
      from?: string;
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
    if (checkout) {
      const args = ["checkout", "-b", name];
      if (from) args.push(from);
      return run("git", args, { cwd: dir });
    }
    const args = ["branch", name];
    if (from) args.push(from);
    return run("git", args, { cwd: dir });
  });

  skillService.registerHandler("git_merge", async (params, ctx) => {
    const { cwd, branch, noFf, message } = params as {
      cwd?: string;
      branch: string;
      noFf?: boolean;
      message?: string;
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
    const args = ["merge", branch];
    if (noFf) args.push("--no-ff");
    if (message) args.push("-m", message);
    return run("git", args, { cwd: dir });
  });

  skillService.registerHandler("git_status", async (params, ctx) => {
    const { cwd } = params as { cwd?: string };
    const dir = resolveSkillCwd({ cwd }, ctx);
    return run("git", ["status", "--porcelain"], { cwd: dir });
  });

  skillService.registerHandler("git_log", async (params, ctx) => {
    const { cwd, count } = params as { cwd?: string; count?: number };
    const dir = resolveSkillCwd({ cwd }, ctx);
    return run(
      "git",
      ["log", `--oneline`, `-n`, String(count || 10)],
      { cwd: dir }
    );
  });

  skillService.registerHandler("git_diff", async (params, ctx) => {
    const { cwd, staged } = params as { cwd?: string; staged?: boolean };
    const dir = resolveSkillCwd({ cwd }, ctx);
    const args = ["diff"];
    if (staged) args.push("--cached");
    return run("git", args, { cwd: dir });
  });

  skillService.registerHandler("git_create_pr", async (params, ctx) => {
    const { cwd, title, body, base, head, platform } = params as {
      cwd?: string;
      title: string;
      body?: string;
      base?: string;
      head?: string;
      platform?: "github" | "gitlab";
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
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
        { cwd: dir }
      );
      const match = remoteUrl.trim().match(/gitlab\.com[:/](.+?)(?:\.git)?$/);
      if (!match) throw new Error("Cannot parse GitLab project from remote URL");
      const projectPath = encodeURIComponent(match[1]);
      const payload = JSON.stringify({
        title,
        description: body || "",
        source_branch: head || (await run("git", ["branch", "--show-current"], { cwd: dir })).stdout.trim(),
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
      cwd: dir,
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
    const { jobUrl, branch, branchParamName, buildParams } = params as {
      jobUrl: string;
      branch?: string;
      branchParamName?: string;
      buildParams?: Record<string, string>;
    };
    const token = await envVarService.resolve("JENKINS_TOKEN");
    const allParams: Record<string, string> = { ...buildParams };
    if (branch) {
      const key = branchParamName || "GIT_BRANCH";
      allParams[key] = branch;
    }

    let url: string;
    if (Object.keys(allParams).length > 0) {
      const qs = new URLSearchParams(allParams).toString();
      url = `${jobUrl.replace(/\/$/, "")}/buildWithParameters?${qs}`;
    } else {
      url = `${jobUrl.replace(/\/$/, "")}/build`;
    }
    console.log(`[jenkins_trigger_job] POST ${url} | params=${JSON.stringify(allParams)}`);
    const result = await run("curl", [
      "-X",
      "POST",
      "-s",
      "-w",
      "\n%{http_code}",
      "-H",
      `Authorization: Basic ${Buffer.from(token).toString("base64")}`,
      url,
    ]);
    console.log(`[jenkins_trigger_job] response: ${JSON.stringify(result).substring(0, 300)}`);
    return result;
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

  skillService.registerHandler("codex_write_code", async (params, ctx) => {
    const { prompt, cwd, model, approval } = params as {
      prompt: string;
      cwd?: string;
      model?: string;
      approval?: "suggest" | "auto-edit" | "full-auto";
    };
    const dir = resolveSkillCwd({ cwd }, ctx);
    const args = [];
    if (model) args.push("--model", model);
    if (approval) args.push(`--approval-mode`, approval);
    args.push(prompt);
    return run("codex", args, { cwd: dir });
  });

  skillService.registerHandler("codex_explain", async (params, ctx) => {
    const { prompt, cwd } = params as { prompt: string; cwd?: string };
    const dir = resolveSkillCwd({ cwd }, ctx);
    return run("codex", [prompt], { cwd: dir });
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

function registerFigmaSkills(
  skillService: SkillService,
  figmaService: FigmaService
) {
  skillService.registerHandler("figma_get_design", async (params) => {
    const { fileKey, nodeId, depth } = params as {
      fileKey: string;
      nodeId?: string;
      depth?: number;
    };
    return { data: await figmaService.getDesignData({ fileKey, nodeId, depth }) };
  });

  skillService.registerHandler("figma_download_images", async (params, ctx) => {
    const { fileKey, nodes, localPath, pngScale } = params as {
      fileKey: string;
      nodes: Array<{ nodeId: string; fileName: string; imageRef?: string; gifRef?: string }>;
      localPath: string;
      pngScale?: number;
    };
    return { result: await figmaService.downloadImages({ fileKey, nodes, localPath, pngScale }) };
  });

  skillService.registerHandler("figma_parse_url", async (params) => {
    const { url } = params as { url: string };
    const parsed = FigmaService.parseUrl(url);
    if (!parsed) return { error: "Unable to parse Figma URL" };
    return parsed;
  });
}

// ─── Lark / 飞书 Skills ──────────────────────────────────────────────────────

function registerLarkSkills(
  skillService: SkillService,
  larkService: LarkService
) {
  skillService.registerHandler("lark_read_doc", async (params) => {
    const { documentId } = params as { documentId: string };
    const { content } = await larkService.readDocument(documentId);
    return { content };
  });

  skillService.registerHandler("lark_create_doc", async (params) => {
    const { title, content, folderToken } = params as {
      title: string;
      content?: string;
      folderToken?: string;
    };
    if (content) {
      return larkService.createDocumentWithContent({ title, content, folderToken });
    }
    return larkService.createDocument({ title, folderToken });
  });

  skillService.registerHandler("lark_get_wiki_node", async (params) => {
    const { token } = params as { token: string };
    return larkService.getWikiNode(token);
  });

  skillService.registerHandler("lark_read_wiki", async (params) => {
    const { nodeToken } = params as { nodeToken: string };
    return larkService.readWikiContent(nodeToken);
  });

  skillService.registerHandler("lark_search_wiki", async (params) => {
    const { query, spaceId } = params as {
      query: string;
      spaceId?: string;
    };
    return larkService.searchWiki({ query, spaceId });
  });

  skillService.registerHandler("lark_create_wiki_node", async (params) => {
    const { spaceId, parentNodeToken, title, content } = params as {
      spaceId: string;
      parentNodeToken?: string;
      title: string;
      content?: string;
    };
    if (content) {
      return larkService.createWikiNodeWithContent({
        spaceId,
        parentNodeToken,
        title,
        content,
      });
    }
    return larkService.createWikiNode({ spaceId, parentNodeToken, title });
  });

  skillService.registerHandler("lark_parse_url", async (params) => {
    const { url } = params as { url: string };
    const parsed = LarkService.parseUrl(url);
    if (!parsed) return { error: "Unable to parse Lark/Feishu URL" };
    return parsed;
  });
}

// ─── ClawHub / Skills Marketplace ────────────────────────────────────────────

import { readdir, readFile, rm, stat } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

const SKILLS_DIR = process.env.AGENT_SKILLS_DIR || join(homedir(), ".agents", "skills");

function registerClawHubSkills(skillService: SkillService) {
  skillService.registerHandler("clawhub_search", async (params) => {
    const { query, source } = params as {
      query: string;
      source?: "clawhub" | "skills-sh" | "both";
    };
    const src = source || "both";
    const results: Array<{ source: string; output: string }> = [];

    if (src === "clawhub" || src === "both") {
      try {
        const { stdout } = await run("npx", ["-y", "clawhub@latest", "search", query], {});
        results.push({ source: "clawhub", output: stdout.trim() });
      } catch (err: any) {
        results.push({ source: "clawhub", output: `Search failed: ${err.message}` });
      }
    }

    if (src === "skills-sh" || src === "both") {
      try {
        const { stdout } = await run("npx", ["-y", "skills", "find", query], {});
        results.push({ source: "skills.sh", output: stdout.trim() });
      } catch (err: any) {
        results.push({ source: "skills.sh", output: `Search failed: ${err.message}` });
      }
    }

    return results;
  });

  skillService.registerHandler("clawhub_install", async (params) => {
    const { name, version, source, dir, force } = params as {
      name: string;
      version?: string;
      source?: "clawhub" | "skills-sh";
      dir?: string;
      force?: boolean;
    };
    const installDir = dir || SKILLS_DIR;
    const src = source || "clawhub";

    if (src === "clawhub") {
      const pkg = version ? `${name}@${version}` : name;
      const args = ["-y", "clawhub@latest", "install", pkg, "--dir", installDir, "--no-input"];
      if (force) args.push("--force");
      const { stdout, stderr } = await run("npx", args, {});
      return { success: true, output: stdout.trim(), warnings: stderr.trim() || undefined, installDir };
    }

    const pkg = name.includes("/") ? name : name;
    const args = ["-y", "skills", "add", pkg, "-g", "-y"];
    const { stdout, stderr } = await run("npx", args, {});
    return { success: true, output: stdout.trim(), warnings: stderr.trim() || undefined };
  });

  skillService.registerHandler("clawhub_list_installed", async (params) => {
    const { dir } = params as { dir?: string };
    const skillsDir = dir || SKILLS_DIR;

    try {
      await stat(skillsDir);
    } catch {
      return { skills: [], dir: skillsDir, message: "Skills directory does not exist yet." };
    }

    const entries = await readdir(skillsDir, { withFileTypes: true });
    const installed: Array<{
      name: string;
      description?: string;
      hasSkillMd: boolean;
    }> = [];

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const skillMdPath = join(skillsDir, entry.name, "SKILL.md");
      let description: string | undefined;
      let hasSkillMd = false;
      try {
        const content = await readFile(skillMdPath, "utf-8");
        hasSkillMd = true;
        const descMatch = content.match(/^description:\s*(.+)$/m);
        if (descMatch) description = descMatch[1].trim();
      } catch { /* no SKILL.md */ }
      installed.push({ name: entry.name, description, hasSkillMd });
    }

    return { skills: installed, dir: skillsDir };
  });

  skillService.registerHandler("clawhub_skill_info", async (params) => {
    const { name, dir } = params as { name: string; dir?: string };
    const skillsDir = dir || SKILLS_DIR;
    const skillMdPath = join(skillsDir, name, "SKILL.md");

    try {
      const content = await readFile(skillMdPath, "utf-8");
      return { name, path: skillMdPath, content };
    } catch (err: any) {
      return { error: `Skill "${name}" not found: ${err.message}` };
    }
  });

  skillService.registerHandler("clawhub_uninstall", async (params) => {
    const { name, dir } = params as { name: string; dir?: string };
    const skillsDir = dir || SKILLS_DIR;
    const skillPath = join(skillsDir, name);

    try {
      await stat(skillPath);
    } catch {
      return { error: `Skill "${name}" not found in ${skillsDir}` };
    }

    await rm(skillPath, { recursive: true, force: true });
    return { success: true, removed: skillPath };
  });
}

export function getCtx(req: any): AppContext {
  return req.ctx as AppContext;
}
