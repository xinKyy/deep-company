import type { Context as GrammyContext } from "grammy";
import type { AppContext } from "../types.js";
import { AgentEngine } from "../agent-engine.js";
import { splitMessage } from "../split-message.js";

function handlerLog(agentId: string, ...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23);
  console.log(`[${ts}][MsgHandler:${agentId}]`, ...args);
}

async function downloadTgPhoto(grammyCtx: GrammyContext, fileId: string): Promise<string | null> {
  try {
    const file = await grammyCtx.api.getFile(fileId);
    if (!file.file_path) return null;

    const token = grammyCtx.api.token;
    const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    const ext = file.file_path.split(".").pop() || "jpg";
    const mimeType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch (err) {
    console.error("[downloadTgPhoto] failed:", err);
    return null;
  }
}

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
    const hasPhoto = !!(msg.photo && msg.photo.length > 0);

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

    if (!text.trim() && !hasPhoto) return;

    const isPrivate = msg.chat.type === "private";
    const isMentioned = text.includes(`@${await getBotUsername(grammyCtx)}`);

    if (!isPrivate && !isMentioned && !hasPhoto) return;

    const cleanText = text.replace(/@\w+/g, "").trim();
    if (!cleanText && !hasPhoto) return;

    const imageUrls: string[] = [];
    if (hasPhoto) {
      const photo = msg.photo![msg.photo!.length - 1];
      handlerLog(agentId, `  📷 downloading photo file_id=${photo.file_id}`);
      const dataUrl = await downloadTgPhoto(grammyCtx, photo.file_id);
      if (dataUrl) imageUrls.push(dataUrl);
    }

    const handlerStart = Date.now();
    const userText = cleanText || (hasPhoto ? "请分析这张图片" : "");
    handlerLog(agentId, `▶ incoming msg | chat=${chatId} user=${username || userId} | "${userText.substring(0, 80)}" | photos=${imageUrls.length}`);

    try {
      await grammyCtx.react("👀").catch(() => {});

      const progressSent = new Set<string>();

      const onProgress = async (progressMsg: string) => {
        if (progressSent.has(progressMsg)) return;
        progressSent.add(progressMsg);
        handlerLog(agentId, `  📤 progress → TG: "${progressMsg.substring(0, 100)}"`);

        try {
          await grammyCtx.reply(progressMsg, { parse_mode: "Markdown" });
        } catch {
          await grammyCtx.reply(progressMsg).catch((e) => {
            handlerLog(agentId, `  ⚠ progress send failed:`, e);
          });
        }
      };

      const reply = await engine.process(
        userText,
        { chatId, userId, username, isGroup: !isPrivate, imageUrls },
        onProgress
      );

      if (reply) {
        const chunks = splitMessage(reply);
        handlerLog(agentId, `  📤 final reply → TG (${chunks.length} chunk(s), ${reply.length} chars)`);
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
      } else {
        handlerLog(agentId, `  ⚠ engine returned null reply`);
      }

      handlerLog(agentId, `■ handler done (${((Date.now() - handlerStart) / 1000).toFixed(1)}s)`);
    } catch (err: any) {
      handlerLog(agentId, `✖ handler FAILED (${((Date.now() - handlerStart) / 1000).toFixed(1)}s):`, err.message || err);
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
