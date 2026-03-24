import { Router } from "express";
import { getCtx } from "../context.js";

export const taskRoutes = Router();

taskRoutes.get("/", async (req, res) => {
  try {
    const filters = {
      projectId: req.query.projectId as string | undefined,
      status: req.query.status as string | undefined,
      assignedAgentId: req.query.assignedAgentId as string | undefined,
    };
    const tasks = await getCtx(req).taskService.list(filters);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.get("/search", async (req, res) => {
  try {
    const keyword = (req.query.q as string) || "";
    const tasks = await getCtx(req).taskService.search(keyword);
    res.json(tasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.get("/:id", async (req, res) => {
  try {
    const detail = await getCtx(req).taskService.getDetail(req.params.id);
    if (!detail) return res.status(404).json({ error: "Task not found" });
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.post("/", async (req, res) => {
  try {
    const task = await getCtx(req).taskService.create(req.body);
    res.status(201).json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.post("/:id/transition", async (req, res) => {
  try {
    const { status, agentId, comment } = req.body;
    const result = await getCtx(req).taskService.transition(
      req.params.id,
      status,
      agentId,
      comment
    );
    if (!result.success) return res.status(400).json({ error: result.error });
    res.json(result.task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.post("/:id/assign", async (req, res) => {
  try {
    const { agentId, byAgentId } = req.body;
    const task = await getCtx(req).taskService.assign(req.params.id, agentId, byAgentId);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.get("/:id/subtasks", async (req, res) => {
  try {
    const subtasks = await getCtx(req).taskService.getSubtasks(req.params.id);
    res.json(subtasks);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.get("/:id/events", async (req, res) => {
  try {
    const events = await getCtx(req).taskService.getEvents(req.params.id);
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

taskRoutes.delete("/:id", async (req, res) => {
  try {
    const task = await getCtx(req).taskService.delete(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
