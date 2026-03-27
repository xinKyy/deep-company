import type {
  AgentService,
  SopService,
  TaskService,
  ProjectService,
  SkillService,
  McpService,
  McpClientManager,
  FigmaService,
  MemoryService,
  MessageService,
  LlmRouter,
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
  memoryService: MemoryService;
  messageService: MessageService;
  llmRouter: LlmRouter;
}
