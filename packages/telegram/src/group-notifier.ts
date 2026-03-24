import { Bot } from "grammy";
import type { AppContext } from "./types.js";

export class GroupNotifier {
  private ctx: AppContext;
  private groupChatId: string;

  constructor(ctx: AppContext, groupChatId: string) {
    this.ctx = ctx;
    this.groupChatId = groupChatId;
  }

  async notifyTaskStatusChange(
    bot: Bot,
    taskId: string,
    fromStatus: string | null,
    toStatus: string,
    agentName: string,
    comment?: string
  ) {
    const lines = [
      `📋 *Task Status Update*`,
      `Task: \`${taskId}\``,
      `Status: ${fromStatus || "new"} → *${toStatus}*`,
      `By: ${agentName}`,
    ];
    if (comment) lines.push(`Comment: ${comment}`);

    await this.sendToGroup(bot, lines.join("\n"));
  }

  async notifyTaskAssignment(
    bot: Bot,
    taskId: string,
    taskTitle: string,
    fromAgentName: string,
    toAgentUsername: string,
    description?: string
  ) {
    const lines = [
      `🔄 *Task Assignment*`,
      `Task: \`${taskId}\` - ${taskTitle}`,
      `From: ${fromAgentName}`,
      `To: @${toAgentUsername}`,
    ];
    if (description) lines.push(`\nDetails: ${description}`);

    await this.sendToGroup(bot, lines.join("\n"));
  }

  async notifyTaskCompletion(
    bot: Bot,
    taskId: string,
    taskTitle: string,
    agentName: string,
    subtaskProgress?: { total: number; completed: number }
  ) {
    const lines = [
      `✅ *Task Completed*`,
      `Task: \`${taskId}\` - ${taskTitle}`,
      `Completed by: ${agentName}`,
    ];
    if (subtaskProgress) {
      lines.push(
        `Subtasks: ${subtaskProgress.completed}/${subtaskProgress.total} done`
      );
    }

    await this.sendToGroup(bot, lines.join("\n"));
  }

  async notifyDelegation(
    bot: Bot,
    fromAgentName: string,
    toAgentUsername: string,
    message: string
  ) {
    const text = [
      `🤝 *Task Delegation*`,
      `From: ${fromAgentName}`,
      `To: @${toAgentUsername}`,
      `\n${message}`,
    ].join("\n");

    await this.sendToGroup(bot, text);
  }

  async sendToGroup(bot: Bot, text: string) {
    if (!this.groupChatId) {
      console.warn("GroupNotifier: no group chat ID configured");
      return;
    }
    try {
      await bot.api.sendMessage(this.groupChatId, text, {
        parse_mode: "Markdown",
      });
    } catch (err) {
      console.error("GroupNotifier: failed to send message:", err);
    }
  }
}
