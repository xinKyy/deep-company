# AI Dev Pro - One-Person Company Multi-Agent System

A multi-agent collaboration system where each agent has its own Telegram bot, SOP workflows, and tool capabilities. Designed for one-person companies to automate project management, development, and operations through AI agents.

## Architecture

```
Telegram Bots ←→ Message Router ←→ Agent Engine ←→ SOP Executor
                                        ↓               ↓
                                   LLM Router      Skills / MCP
                                        ↓
                                  Memory System
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Backend**: Express + Drizzle ORM + SQLite
- **Telegram**: grammy
- **LLM**: Multi-provider (OpenAI, Anthropic, DeepSeek, Google)
- **Frontend**: React + Vite + TailwindCSS
- **Monorepo**: pnpm workspace

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys and TG bot tokens

# Run database migration
pnpm db:migrate

# Start development server (API + TG bots)
pnpm dev

# Start web admin (in another terminal)
cd packages/web && pnpm dev
```

## Project Structure

```
packages/
├── core/       # Core engine (agent, sop, task, project, skill, mcp, memory, llm, db)
├── telegram/   # Telegram bot integration (bot-manager, agent-engine, group-notifier)
├── api/        # REST API server (Express routes for all modules)
└── web/        # Web admin dashboard (React + TailwindCSS)
```

## Configuration

Set the following in `.env`:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite database path |
| `OPENAI_API_KEY` | OpenAI API key |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `DEEPSEEK_API_KEY` | DeepSeek API key |
| `GOOGLE_API_KEY` | Google AI API key |
| `TG_GROUP_CHAT_ID` | Telegram group for agent collaboration |
| `API_PORT` | API server port (default: 3000) |

## Core Concepts

### Agents
Each agent has an identity (system prompt), LLM configuration, and a dedicated Telegram bot. Agents are bound to SOPs that define their capabilities.

### SOPs (Standard Operating Procedures)
Directed graphs of steps that define workflows. Each step has an action type (LLM call, skill call, notification, etc.) and can branch conditionally.

### Tasks
Tasks track work with a state machine (created → assigned → in_progress → review → completed). Tasks support parent-child relationships and cross-agent handoffs.

### Skills
Built-in tool functions (create_task, search_tasks, get_project_info, etc.) that agents can invoke through LLM function calling.

### Memory
Three-layer memory: raw messages, conversation summaries, and task-context memories. All Telegram messages are deduplicated by (chat_id, message_id) and stored for context retrieval.

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `CRUD /api/agents` | Agent management |
| `CRUD /api/sops` | SOP management |
| `CRUD /api/tasks` | Task management |
| `GET /api/tasks/search?q=` | Task search |
| `POST /api/tasks/:id/transition` | Task status transition |
| `CRUD /api/projects` | Project management |
| `CRUD /api/skills` | Skill management |
| `CRUD /api/mcps` | MCP server management |
| `GET /api/memories` | Memory queries |
| `GET /api/messages` | Message log queries |
