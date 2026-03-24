# AI Dev Pro — 项目架构文档

> 一人公司多 Agent 协作系统。每个 Agent 对应一个 Telegram Bot，通过 SOP 流程驱动任务流转。

---

## 1. 整体架构

```
用户 (Telegram)
    │
    ▼
┌────────────────────────────────────────────────────┐
│  packages/telegram                                  │
│  ┌──────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │ BotManager   │→│ MsgHandler  │→│ AgentEngine│ │
│  │ (多Bot生命期) │  │ (收发/去重)  │  │ (LLM循环)  │ │
│  └──────────────┘  └─────────────┘  └─────┬──────┘ │
│                                           │        │
│  ┌────────────────┐                       │        │
│  │ GroupNotifier   │← ─ ─ 任务状态通知 ─ ─┘        │
│  └────────────────┘                                │
└─────────────────────────┬──────────────────────────┘
                          │ 调用
                          ▼
┌────────────────────────────────────────────────────┐
│  packages/core                                      │
│  ┌────────────┐ ┌──────────┐ ┌───────────────────┐ │
│  │AgentService│ │SopService│ │  SopExecutor      │ │
│  │            │ │+SopSteps │ │  (DAG 步骤执行)   │ │
│  └────────────┘ └──────────┘ └───────────────────┘ │
│  ┌────────────┐ ┌──────────┐ ┌───────────────────┐ │
│  │TaskService │ │ProjectSvc│ │  SkillService     │ │
│  │(状态机/搜索)│ │          │ │  (handler注册/执行)│ │
│  └────────────┘ └──────────┘ └───────────────────┘ │
│  ┌────────────┐ ┌──────────┐ ┌───────────────────┐ │
│  │MemoryService│ │MessageSvc│ │  McpService       │ │
│  │(摘要/上下文) │ │(去重存储) │ │  (MCP Server管理) │ │
│  └────────────┘ └──────────┘ └───────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │  LlmRouter (OpenAI / Anthropic / DeepSeek / Google)│
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │  Drizzle ORM + SQLite (db/schema.ts)           │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────┬──────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────┐
│  packages/api — Express REST API                    │
│  routes: agents, sops, tasks, projects,             │
│          skills, mcps, memories, messages            │
└─────────────────────────┬──────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────┐
│  packages/web — React + Vite + TailwindCSS          │
│  pages: Dashboard, Agents, SOPs, Tasks (看板+列表), │
│         Projects, Skills, MCPs, Messages            │
└────────────────────────────────────────────────────┘
```

---

## 2. 文件结构

```
ai-dev-pro/
├── package.json                    # Monorepo 根配置 (pnpm workspace)
├── pnpm-workspace.yaml             # workspace: packages/*
├── tsconfig.json                   # 全局 TS 配置 (ES2022, ESNext, bundler)
├── .env / .env.example             # 环境变量 (API Keys, TG Token, DB路径)
├── .gitignore
├── README.md                       # 快速开始指南
├── ARCHITECTURE.md                 # ← 本文件
├── data/
│   └── ai-dev-pro.db              # SQLite 数据库文件 (WAL模式)
│
├── packages/core/                  # @ai-dev-pro/core — 核心引擎
│   ├── package.json                # deps: better-sqlite3, drizzle-orm, nanoid
│   ├── tsconfig.json
│   ├── drizzle.config.ts           # Drizzle Kit 配置 (schema路径, db路径)
│   ├── drizzle/                    # 自动生成的 SQL 迁移文件
│   │   ├── 0000_married_lester.sql
│   │   └── meta/
│   └── src/
│       ├── index.ts                # 统一导出入口 (所有 Service + Types)
│       ├── db/
│       │   ├── schema.ts           # ★ 13张表的 Drizzle 定义
│       │   ├── index.ts            # getDb() / initDb() 单例
│       │   └── migrate.ts          # CLI 迁移脚本
│       ├── agent/
│       │   └── agent-service.ts    # AgentService (CRUD + SOP绑定)
│       ├── sop/
│       │   ├── sop-service.ts      # SopService (SOP/Step CRUD + 查询)
│       │   └── sop-executor.ts     # SopExecutor (DAG 运行时执行引擎)
│       ├── task/
│       │   └── task-service.ts     # TaskService (状态机 + 搜索 + 详情)
│       ├── project/
│       │   └── project-service.ts  # ProjectService (CRUD + 按名查询)
│       ├── skill/
│       │   └── skill-service.ts    # SkillService (handler注册 + 执行)
│       ├── mcp/
│       │   └── mcp-service.ts      # McpService (MCP Server CRUD)
│       ├── memory/
│       │   ├── memory-service.ts   # MemoryService (记忆CRUD + 上下文检索)
│       │   └── message-service.ts  # MessageService (消息去重记录)
│       └── llm/
│           └── llm-router.ts       # LlmRouter + OpenAI/Anthropic适配器
│
├── packages/telegram/              # @ai-dev-pro/telegram — TG Bot 集成
│   ├── package.json                # deps: @ai-dev-pro/core, grammy
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                # 导出 BotManager, GroupNotifier, AgentEngine
│       ├── types.ts                # AppContext 接口定义
│       ├── bot-manager.ts          # ★ BotManager (多Bot启动/停止/重启)
│       ├── agent-engine.ts         # ★ AgentEngine (消息→LLM→工具调用循环)
│       ├── group-notifier.ts       # GroupNotifier (群内格式化通知)
│       └── handlers/
│           └── message-handler.ts  # createMessageHandler (grammy中间件)
│
├── packages/api/                   # @ai-dev-pro/api — REST API
│   ├── package.json                # deps: express, cors, dotenv, workspace:*
│   ├── tsconfig.json
│   └── src/
│       ├── server.ts               # ★ 入口: Express + BotManager.startAll()
│       ├── context.ts              # createAppContext() + 内置Skill注册
│       └── routes/
│           ├── agents.ts           # /api/agents     (CRUD + SOP绑定)
│           ├── sops.ts             # /api/sops       (CRUD + Steps管理)
│           ├── tasks.ts            # /api/tasks      (CRUD + 搜索 + 状态流转)
│           ├── projects.ts         # /api/projects   (CRUD)
│           ├── skills.ts           # /api/skills     (CRUD + 已注册handler列表)
│           ├── mcps.ts             # /api/mcps       (CRUD)
│           ├── memories.ts         # /api/memories   (查询 + 删除)
│           └── messages.ts         # /api/messages   (按agent/chat查询)
│
└── packages/web/                   # @ai-dev-pro/web — Web 管理后台
    ├── package.json                # react, react-router-dom, @tanstack/react-query, lucide-react, tailwindcss
    ├── vite.config.ts              # Vite + React + TailwindCSS, proxy /api → :3000
    ├── index.html
    └── src/
        ├── main.tsx                # 入口
        ├── index.css               # CSS 变量 (暗色主题)
        ├── App.tsx                 # BrowserRouter + 路由定义
        ├── api/
        │   └── client.ts           # ★ API 客户端 (所有接口封装)
        ├── components/
        │   ├── Layout.tsx           # 侧边栏导航布局 (8个菜单项)
        │   └── ui.tsx               # ★ UI 组件库 (Card, Button, Modal, Badge, StatusBadge...)
        └── pages/
            ├── DashboardPage.tsx    # 统计卡片 + 最近任务 + 活跃Agent
            ├── AgentsPage.tsx       # Agent 卡片列表 + 创建/编辑 Modal
            ├── SopsPage.tsx         # SOP 折叠列表 + Steps 管理
            ├── TasksPage.tsx        # ★ 看板视图 + 列表视图 + 搜索 + 详情展开
            ├── ProjectsPage.tsx     # 项目卡片 + CRUD
            ├── SkillsPage.tsx       # Skills + 已注册Handler展示
            ├── McpsPage.tsx         # MCP Server 卡片 + CRUD
            └── MessagesPage.tsx     # 按Agent筛选消息记录
```

---

## 3. 数据库表结构 (13 张表)

| 表名 | 用途 | 关键字段 | 关键约束 |
|------|------|----------|----------|
| `agents` | Agent 定义 | id, name, system_prompt, llm_provider, llm_model, tg_bot_token, status | — |
| `sops` | SOP 流程定义 | id, name, trigger_type, trigger_config | — |
| `sop_steps` | SOP 步骤 | id, sop_id(FK), step_order, action_type, action_config, condition, next_step_id | FK→sops (cascade) |
| `agent_sops` | Agent-SOP 绑定 | agent_id(FK), sop_id(FK) | UNIQUE(agent_id, sop_id) |
| `skills` | 技能/工具定义 | id, name, type, input_schema, config | UNIQUE(name) |
| `sop_step_skills` | 步骤-技能绑定 | sop_step_id(FK), skill_id(FK) | UNIQUE(sop_step_id, skill_id) |
| `mcp_servers` | MCP 服务器配置 | id, name, command, args, env_vars, status | UNIQUE(name) |
| `projects` | 项目 | id, name, repo_url, config, status | UNIQUE(name) |
| `tasks` | 任务 | id, project_id(FK), parent_task_id, title, status, priority, assigned_agent_id(FK), sop_id(FK), current_sop_step_id(FK) | 5个FK |
| `task_events` | 任务状态事件流 | id, task_id(FK), from_status, to_status, agent_id(FK), comment | FK→tasks (cascade) |
| `messages` | TG 消息全量记录 | id, agent_id(FK), tg_chat_id, tg_message_id, direction, content | **UNIQUE(tg_chat_id, tg_message_id)** 去重 |
| `memories` | Agent 记忆 | id, agent_id(FK), task_id(FK), type, content, metadata | — |
| `group_configs` | TG 群组配置 | id, tg_chat_id, type, project_id(FK) | UNIQUE(tg_chat_id) |

Schema 定义文件: `packages/core/src/db/schema.ts`

---

## 4. 核心模块详解

### 4.1 Agent 引擎 (`packages/telegram/src/agent-engine.ts`)

**类**: `AgentEngine`

这是系统的核心运行时。当 Agent 的 TG Bot 收到消息后，处理流程如下:

```
收到消息
  ↓
1. 消息去重写入 messages 表 (tg_chat_id + tg_message_id 唯一约束)
  ↓
2. 加载 Agent 配置 (system_prompt + 绑定的 SOP 列表)
  ↓
3. 从 MemoryService 获取相关上下文 (任务记忆 + Agent 摘要)
  ↓
4. 从 MessageService 获取最近对话历史 (最近10条)
  ↓
5. 构建 system prompt (身份 + SOP能力 + 可用工具 + 记忆上下文 + 规则)
  ↓
6. 调用 LlmRouter.complete() (带 tools/function calling)
  ↓
7. 如果 LLM 返回 tool_calls → 执行 SkillService.execute() → 将结果反馈 LLM
   (最多循环5次)
  ↓
8. 返回最终回复
```

**SOP 匹配兜底** (第5步 `handleNoLlmProvider`):
- 查询系统内所有 active Agent → 找到能处理的 → @mention 转发
- 都没有 → 回复用户引导如何配置

### 4.2 任务系统 (`packages/core/src/task/task-service.ts`)

**类**: `TaskService`

**Task ID 格式**: `TASK-{8位随机大写}` (如 `TASK-6JF__5X-`)

**状态机**:
```
created → assigned → in_progress → review → completed
                         ↓    ↑        ↓
                       blocked      rejected → in_progress
```

**关键方法**:
- `create()` — 创建任务，自动写入 "created" 事件
- `transition()` — 状态流转，校验合法性，写入 task_events
- `getDetail()` — 返回任务 + 子任务列表 + 事件流 + 子任务完成进度
- `search()` — 按 ID / 标题 / 描述模糊搜索
- `completeWithSubtasks()` — 完成任务并级联完成所有子任务

### 4.3 SOP 执行器 (`packages/core/src/sop/sop-executor.ts`)

**类**: `SopExecutor`

SOP 是一个有向图 (DAG)，每个 Step 定义:
- `actionType`: `llm_call | skill_call | mcp_call | human_input | notify | create_task | transition_task | condition`
- `actionConfig`: JSON 配置
- `condition`: 进入条件 (如 `var:xxx`, `always`, `never`)
- `nextStepId` / `nextStepOnFail`: 分支路由

执行流程: 从第一步开始 → 检查 condition → 调用注册的 StepHandler → 根据 nextAction 决定继续/等待/完成

### 4.4 LLM 路由 (`packages/core/src/llm/llm-router.ts`)

**类**: `LlmRouter`

统一接口，通过 `registerProvider(name, adapter)` 注册适配器。

**已实现适配器**:
| 函数 | 支持的 Provider |
|------|----------------|
| `createOpenAIAdapter(apiKey, baseUrl)` | OpenAI, DeepSeek, Google (OpenAI兼容) |
| `createAnthropicAdapter(apiKey)` | Anthropic Claude |

两个适配器都支持 **function calling / tool use**，返回统一的 `LlmCompletionResult`。

Provider 注册在 `packages/api/src/context.ts` 的 `createAppContext()` 中，根据 `.env` 中的 API Key 自动注册。

### 4.5 Skills 系统 (`packages/core/src/skill/skill-service.ts`)

**类**: `SkillService`

双层设计:
1. **DB 层**: skills 表存储技能定义 (名称/描述/类型/schema)
2. **Runtime 层**: `handlers: Map<string, SkillHandler>` 存储可执行的函数

**内置 Skill** (注册在 `packages/api/src/context.ts`):

| Skill 名称 | 功能 |
|-----------|------|
| `create_task` | 创建任务 |
| `update_task_status` | 更新任务状态 (带状态机校验) |
| `search_tasks` | 按关键词搜索任务 |
| `get_task_detail` | 获取任务详情 (含子任务进度 + 事件流) |
| `get_project_info` | 按项目名获取项目信息 |
| `create_subtask` | 创建子任务 |

这些 Skill 同时也作为 LLM 的 tools 传给 AgentEngine。

### 4.6 记忆系统

**两个 Service**:

| Service | 文件 | 用途 |
|---------|------|------|
| `MessageService` | `packages/core/src/memory/message-service.ts` | TG 消息全量存储 (INSERT OR IGNORE 去重) |
| `MemoryService` | `packages/core/src/memory/memory-service.ts` | 结构化记忆 (摘要/任务上下文/决策/知识) |

**记忆类型** (`memories.type`):
- `summary` — 对话摘要 (AgentEngine 自动生成)
- `task_context` — 任务关联的关键决策
- `decision` — 重要决策记录
- `knowledge` — 通用知识

**检索**: `getRelevantContext(agentId, taskId?)` — 先取任务记忆，再取 Agent 记忆，去重后合并返回。

### 4.7 Telegram 集成

| 组件 | 文件 | 职责 |
|------|------|------|
| `BotManager` | `packages/telegram/src/bot-manager.ts` | 管理所有 Agent Bot 的 grammy 实例生命周期 |
| `createMessageHandler` | `packages/telegram/src/handlers/message-handler.ts` | 消息接收 → 去重记录 → 路由到 AgentEngine |
| `GroupNotifier` | `packages/telegram/src/group-notifier.ts` | 任务状态变更/分配/完成/委派的群内 Markdown 通知 |

**消息处理规则**:
- 私聊: 直接处理
- 群聊: 只响应 @mention 本 Bot 的消息
- 所有消息都记录到 messages 表 (无论是否处理)

---

## 5. API 路由索引

| 路由文件 | 基础路径 | 端点 |
|----------|----------|------|
| `routes/agents.ts` | `/api/agents` | GET / POST / PUT /:id / DELETE /:id / POST /:id/sops/:sopId / DELETE /:id/sops/:sopId / GET /:id/sops |
| `routes/sops.ts` | `/api/sops` | GET / POST / PUT /:id / DELETE /:id / GET /:id/steps / POST /:id/steps / PUT /steps/:stepId / DELETE /steps/:stepId |
| `routes/tasks.ts` | `/api/tasks` | GET / GET /search?q= / GET /:id (detail) / POST / POST /:id/transition / POST /:id/assign / GET /:id/subtasks / GET /:id/events / DELETE /:id |
| `routes/projects.ts` | `/api/projects` | GET / POST / PUT /:id / DELETE /:id |
| `routes/skills.ts` | `/api/skills` | GET (含registeredHandlers) / POST / PUT /:id / DELETE /:id |
| `routes/mcps.ts` | `/api/mcps` | GET / POST / PUT /:id / DELETE /:id |
| `routes/memories.ts` | `/api/memories` | GET ?agentId= / GET ?taskId= / POST / DELETE /:id |
| `routes/messages.ts` | `/api/messages` | GET ?agentId= / GET ?chatId= |

---

## 6. 前端页面索引

| 页面 | 路由 | 功能 |
|------|------|------|
| `DashboardPage` | `/` | 统计卡片 (Agent/Task/Project/SOP 数量) + 最近任务 + 活跃 Agent |
| `AgentsPage` | `/agents` | Agent 卡片网格 + 创建/编辑 Modal (含 LLM/TG 配置) |
| `SopsPage` | `/sops` | SOP 折叠列表 + 内联 Steps 管理 (增/删) |
| `TasksPage` | `/tasks` | 看板视图 (6列状态) + 列表视图 (可展开详情/子任务/事件流) + 关键词搜索 |
| `ProjectsPage` | `/projects` | 项目卡片 + CRUD |
| `SkillsPage` | `/skills` | 已注册 handler 展示 + 自定义 Skill CRUD |
| `McpsPage` | `/mcps` | MCP Server 配置卡片 + CRUD |
| `MessagesPage` | `/messages` | 按 Agent 筛选消息记录 (方向/用户/时间) |

**UI 组件库**: `packages/web/src/components/ui.tsx` — Card, Button, Input, Textarea, Select, Badge, StatusBadge, Modal, PageHeader, EmptyState, Label, FormGroup

---

## 7. 关键代码位置速查

| 需要找的内容 | 文件路径 |
|-------------|---------|
| 数据库表结构 | `packages/core/src/db/schema.ts` |
| 数据库连接/初始化 | `packages/core/src/db/index.ts` |
| 数据库迁移 | `packages/core/src/db/migrate.ts` + `packages/core/drizzle/` |
| Agent 增删改查 | `packages/core/src/agent/agent-service.ts` |
| SOP 增删改查 + 步骤管理 | `packages/core/src/sop/sop-service.ts` |
| SOP 运行时执行 | `packages/core/src/sop/sop-executor.ts` |
| 任务状态机 + 搜索 | `packages/core/src/task/task-service.ts` |
| 项目管理 | `packages/core/src/project/project-service.ts` |
| Skill handler 注册与执行 | `packages/core/src/skill/skill-service.ts` |
| 内置 Skill 注册 (6个) | `packages/api/src/context.ts` → `registerBuiltinSkills()` |
| MCP Server 管理 | `packages/core/src/mcp/mcp-service.ts` |
| 消息去重存储 | `packages/core/src/memory/message-service.ts` |
| 记忆管理与检索 | `packages/core/src/memory/memory-service.ts` |
| LLM 统一接口 + 适配器 | `packages/core/src/llm/llm-router.ts` |
| LLM Provider 注册 | `packages/api/src/context.ts` → `createAppContext()` |
| TG Bot 多实例管理 | `packages/telegram/src/bot-manager.ts` |
| Agent 消息处理主循环 | `packages/telegram/src/agent-engine.ts` |
| TG 消息接收/路由 | `packages/telegram/src/handlers/message-handler.ts` |
| 群内通知格式化 | `packages/telegram/src/group-notifier.ts` |
| API 服务器入口 | `packages/api/src/server.ts` |
| AppContext 创建 | `packages/api/src/context.ts` |
| 前端 API 客户端 | `packages/web/src/api/client.ts` |
| 前端路由配置 | `packages/web/src/App.tsx` |
| 前端 UI 组件库 | `packages/web/src/components/ui.tsx` |
| 前端布局/导航 | `packages/web/src/components/Layout.tsx` |
| Vite 配置 (含 API 代理) | `packages/web/vite.config.ts` |
| 环境变量模板 | `.env.example` |
| pnpm workspace 配置 | `pnpm-workspace.yaml` |
| 全局 TypeScript 配置 | `tsconfig.json` |

---

## 8. 启动命令

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 API Key 和 TG Bot Token

# 数据库迁移
pnpm db:migrate

# 启动 API + TG Bots (端口 3000)
pnpm dev

# 启动 Web 管理后台 (端口 5173, 代理 /api → :3000)
cd packages/web && pnpm dev
```

---

## 9. 技术栈

| 层 | 技术 |
|----|------|
| 运行时 | Node.js 20+ / TypeScript / ESM |
| 后端框架 | Express |
| 数据库 | SQLite (better-sqlite3, WAL模式) |
| ORM | Drizzle ORM |
| Telegram | grammy |
| LLM | 自研 LlmRouter (OpenAI-compatible + Anthropic 适配) |
| 前端框架 | React 19 + Vite |
| 前端样式 | TailwindCSS v4 |
| 前端状态 | @tanstack/react-query |
| 前端路由 | react-router-dom v7 |
| 前端图标 | lucide-react |
| 包管理 | pnpm workspace (monorepo) |
