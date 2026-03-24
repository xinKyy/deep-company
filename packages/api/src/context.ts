import {
  AgentService,
  SopService,
  TaskService,
  ProjectService,
  SkillService,
  McpService,
  MemoryService,
  MessageService,
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

  registerBuiltinSkills(skillService, taskService, projectService);

  return {
    agentService,
    sopService,
    taskService,
    projectService,
    skillService,
    mcpService,
    memoryService,
    messageService,
    llmRouter,
  };
}

function registerBuiltinSkills(
  skillService: SkillService,
  taskService: TaskService,
  projectService: ProjectService
) {
  skillService.registerHandler("create_task", async (params, ctx) => {
    return taskService.create({
      ...(params as any),
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
    return taskService.create({
      ...(params as any),
      createdByAgentId: ctx.agentId,
    });
  });
}

export function getCtx(req: any): AppContext {
  return req.ctx as AppContext;
}
