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
    return [
      {
        type: "function",
        function: {
          name: "create_task",
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
      },
      {
        type: "function",
        function: {
          name: "update_task_status",
          description: "Update a task's status",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "Task ID" },
              status: {
                type: "string",
                enum: ["assigned", "in_progress", "review", "blocked", "completed", "rejected", "cancelled"],
              },
              comment: { type: "string", description: "Status change comment" },
            },
            required: ["taskId", "status"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "search_tasks",
          description: "Search tasks by keyword (matches ID, title, or description)",
          parameters: {
            type: "object",
            properties: {
              keyword: { type: "string", description: "Search keyword" },
            },
            required: ["keyword"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_task_detail",
          description: "Get detailed task info including subtask progress and event history",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "Task ID" },
            },
            required: ["taskId"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_project_info",
          description: "Get project information by name",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Project name" },
            },
            required: ["name"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_subtask",
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
      },
    ];
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
