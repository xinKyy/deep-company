import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

// ─── Agents ──────────────────────────────────────────────────────────────────

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  systemPrompt: text("system_prompt").notNull().default(""),
  llmProvider: text("llm_provider").notNull().default("openai"),
  llmModel: text("llm_model").notNull().default("gpt-4o"),
  tgBotToken: text("tg_bot_token"),
  tgBotUsername: text("tg_bot_username"),
  status: text("status", { enum: ["active", "paused", "disabled"] })
    .notNull()
    .default("active"),
  /** Absolute or template path; null = use AGENT_WORK_DIR_TEMPLATE or /data/agent-pro/{agentId} */
  workDir: text("work_dir"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── SOPs ────────────────────────────────────────────────────────────────────

export const sops = sqliteTable("sops", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  triggerType: text("trigger_type", {
    enum: ["keyword", "intent", "manual", "event"],
  })
    .notNull()
    .default("intent"),
  triggerConfig: text("trigger_config").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sopSteps = sqliteTable("sop_steps", {
  id: text("id").primaryKey(),
  sopId: text("sop_id")
    .notNull()
    .references(() => sops.id, { onDelete: "cascade" }),
  stepOrder: integer("step_order").notNull().default(0),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  actionType: text("action_type", {
    enum: [
      "llm_call",
      "skill_call",
      "mcp_call",
      "human_input",
      "notify",
      "create_task",
      "transition_task",
      "condition",
    ],
  }).notNull(),
  actionConfig: text("action_config").notNull().default("{}"),
  condition: text("condition"),
  nextStepId: text("next_step_id"),
  nextStepOnFail: text("next_step_on_fail"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const agentSops = sqliteTable(
  "agent_sops",
  {
    agentId: text("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    sopId: text("sop_id")
      .notNull()
      .references(() => sops.id, { onDelete: "cascade" }),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("agent_sops_unique").on(table.agentId, table.sopId),
  ]
);

// ─── Skills ──────────────────────────────────────────────────────────────────

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  type: text("type", { enum: ["builtin", "custom", "mcp"] })
    .notNull()
    .default("builtin"),
  inputSchema: text("input_schema").notNull().default("{}"),
  config: text("config").notNull().default("{}"),
  status: text("status", { enum: ["active", "disabled"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const sopStepSkills = sqliteTable(
  "sop_step_skills",
  {
    sopStepId: text("sop_step_id")
      .notNull()
      .references(() => sopSteps.id, { onDelete: "cascade" }),
    skillId: text("skill_id")
      .notNull()
      .references(() => skills.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("sop_step_skills_unique").on(table.sopStepId, table.skillId),
  ]
);

// ─── MCP Servers ─────────────────────────────────────────────────────────────

export const mcpServers = sqliteTable("mcp_servers", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  command: text("command").notNull(),
  args: text("args").notNull().default("[]"),
  envVars: text("env_vars").notNull().default("{}"),
  status: text("status", { enum: ["active", "disabled", "error"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Projects ────────────────────────────────────────────────────────────────

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  repoUrl: text("repo_url"),
  config: text("config").notNull().default("{}"),
  status: text("status", { enum: ["active", "archived", "paused"] })
    .notNull()
    .default("active"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  parentTaskId: text("parent_task_id"),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", {
    enum: [
      "created",
      "assigned",
      "in_progress",
      "review",
      "blocked",
      "completed",
      "rejected",
      "cancelled",
    ],
  })
    .notNull()
    .default("created"),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .notNull()
    .default("medium"),
  assignedAgentId: text("assigned_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  createdByAgentId: text("created_by_agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  sopId: text("sop_id").references(() => sops.id, { onDelete: "set null" }),
  currentSopStepId: text("current_sop_step_id").references(
    () => sopSteps.id,
    { onDelete: "set null" }
  ),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const taskEvents = sqliteTable("task_events", {
  id: text("id").primaryKey(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "set null",
  }),
  comment: text("comment").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    agentId: text("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    tgChatId: text("tg_chat_id").notNull(),
    tgMessageId: text("tg_message_id").notNull(),
    tgUserId: text("tg_user_id"),
    tgUsername: text("tg_username"),
    direction: text("direction", { enum: ["incoming", "outgoing"] })
      .notNull()
      .default("incoming"),
    content: text("content").notNull().default(""),
    messageType: text("message_type", {
      enum: ["text", "photo", "document", "voice", "video", "other"],
    })
      .notNull()
      .default("text"),
    rawData: text("raw_data"),
    createdAt: text("created_at")
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [
    uniqueIndex("messages_chat_msg_unique").on(
      table.tgChatId,
      table.tgMessageId
    ),
  ]
);

// ─── Memories ────────────────────────────────────────────────────────────────

export const memories = sqliteTable("memories", {
  id: text("id").primaryKey(),
  agentId: text("agent_id").references(() => agents.id, {
    onDelete: "cascade",
  }),
  taskId: text("task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  type: text("type", {
    enum: ["summary", "task_context", "decision", "knowledge"],
  })
    .notNull()
    .default("summary"),
  content: text("content").notNull(),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Environment Variables ───────────────────────────────────────────────────

export const envVars = sqliteTable("env_vars", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  description: text("description").notNull().default(""),
  category: text("category", {
    enum: ["git", "jenkins", "codex", "google", "custom"],
  })
    .notNull()
    .default("custom"),
  isSecret: integer("is_secret", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// ─── Group Configs ───────────────────────────────────────────────────────────

export const groupConfigs = sqliteTable("group_configs", {
  id: text("id").primaryKey(),
  tgChatId: text("tg_chat_id").notNull().unique(),
  name: text("name").notNull().default(""),
  type: text("type", { enum: ["main", "project", "custom"] })
    .notNull()
    .default("main"),
  projectId: text("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),
  config: text("config").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
