import { Router } from "express";
import { getCtx } from "../context.js";

export const memoryRoutes = Router();

memoryRoutes.get("/", async (req, res) => {
  try {
    const agentId = req.query.agentId as string | undefined;
    const taskId = req.query.taskId as string | undefined;
    const ctx = getCtx(req);

    if (taskId) {
      const memories = await ctx.memoryService.getByTask(taskId);
      return res.json(memories);
    }
    if (agentId) {
      const memories = await ctx.memoryService.getByAgent(agentId);
      return res.json(memories);
    }
    const memories = await ctx.memoryService.list();
    res.json(memories);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRoutes.post("/", async (req, res) => {
  try {
    const memory = await getCtx(req).memoryService.create(req.body);
    res.status(201).json(memory);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

memoryRoutes.delete("/:id", async (req, res) => {
  try {
    const memory = await getCtx(req).memoryService.delete(req.params.id);
    if (!memory) return res.status(404).json({ error: "Memory not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
