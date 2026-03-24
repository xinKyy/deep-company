import { Router } from "express";
import { getCtx } from "../context.js";

export const agentRoutes = Router();

agentRoutes.get("/", async (req, res) => {
  try {
    const agents = await getCtx(req).agentService.list();
    res.json(agents);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.get("/:id", async (req, res) => {
  try {
    const agent = await getCtx(req).agentService.getById(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.post("/", async (req, res) => {
  try {
    const agent = await getCtx(req).agentService.create(req.body);
    res.status(201).json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.put("/:id", async (req, res) => {
  try {
    const agent = await getCtx(req).agentService.update(req.params.id, req.body);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json(agent);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.delete("/:id", async (req, res) => {
  try {
    const agent = await getCtx(req).agentService.delete(req.params.id);
    if (!agent) return res.status(404).json({ error: "Agent not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.post("/:id/sops/:sopId", async (req, res) => {
  try {
    await getCtx(req).agentService.bindSop(req.params.id, req.params.sopId);
    res.json({ bound: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.delete("/:id/sops/:sopId", async (req, res) => {
  try {
    await getCtx(req).agentService.unbindSop(req.params.id, req.params.sopId);
    res.json({ unbound: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

agentRoutes.get("/:id/sops", async (req, res) => {
  try {
    const sops = await getCtx(req).sopService.getSopsByAgentId(req.params.id);
    res.json(sops);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
