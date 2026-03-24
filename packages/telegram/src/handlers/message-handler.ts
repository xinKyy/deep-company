import type { Context as GrammyContext } from "grammy";
import type { AppContext } from "../types.js";
import { AgentEngine } from "../agent-engine.js";
import { splitMessage } from "../split-message.js";

export function createMessageHandler(ctx: AppContext, agentId: string) {
  const engine = new AgentEngine(ctx, agentId);

  return async (grammyCtx: GrammyContext) => {
    const msg = grammyCtx.message;
    if (!msg) return;

    const chatId = String(msg.chat.id);
    const messageId = String(msg.message_id);
    const userId = msg.from ? String(msg.from.id) : undefined;
    const username = msg.from?.username || undefined;
    const text = msg.text || msg.caption || "";

    await ctx.messageService.record({
      agentId,
      tgChatId: chatId,
      tgMessageId: messageId,
      tgUserId: userId,
      tgUsername: username,
      direction: "incoming",
      content: text,
      messageType: msg.text ? "text" : msg.photo ? "photo" : msg.document ? "document" : "other",
      rawData: JSON.stringify(msg),
    });

    if (!text.trim()) return;

    const isPrivate = msg.chat.type === "private";
    const isMentioned = text.includes(`@${await getBotUsername(grammyCtx)}`);

    if (!isPrivate && !isMentioned) return;

    const cleanText = text.replace(/@\w+/g, "").trim();
    if (!cleanText) return;

    try {
      const reply = await engine.process(cleanText, {
        chatId,
        userId,
        username,
        isGroup: !isPrivate,
      });

      if (reply) {
        const chunks = splitMessage(reply);
        for (const chunk of chunks) {
          try {
            await grammyCtx.reply(chunk, { parse_mode: "Markdown" });
          } catch {
            await grammyCtx.reply(chunk);
          }
        }

        await ctx.messageService.record({
          agentId,
          tgChatId: chatId,
          tgMessageId: `out-${Date.now()}`,
          direction: "outgoing",
          content: reply,
        });
      }
    } catch (err: any) {
      console.error(`AgentEngine error:`, err);
      await grammyCtx.reply("Sorry, an error occurred while processing your request.");
    }
  };
}

async function getBotUsername(ctx: GrammyContext): Promise<string> {
  try {
    const me = await ctx.api.getMe();
    return me.username || "";
  } catch {
    return "";
  }
}
