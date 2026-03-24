import { Router } from "express";
import { getCtx } from "../context.js";

export const messageRoutes = Router();

messageRoutes.get("/", async (req, res) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const chatId = req.query.chatId as string | undefined;
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const ctx = getCtx(req);

    if (chatId) {
      const messages = await ctx.messageService.getRecentByChat(chatId, limit);
      return res.json(messages);
    }
    if (agentId) {
      const messages = await ctx.messageService.getRecentByAgent(agentId, limit);
      return res.json(messages);
    }
    res.status(400).json({ error: "Provide agentId or chatId query param" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
