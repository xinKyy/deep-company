import { Router } from "express";
import { getCtx } from "../context.js";

export const mcpRoutes = Router();

mcpRoutes.get("/", async (req, res) => {
  try {
    const servers = await getCtx(req).mcpService.list();
    res.json(servers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mcpRoutes.get("/:id", async (req, res) => {
  try {
    const server = await getCtx(req).mcpService.getById(req.params.id);
    if (!server) return res.status(404).json({ error: "MCP server not found" });
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mcpRoutes.post("/", async (req, res) => {
  try {
    const server = await getCtx(req).mcpService.create(req.body);
    res.status(201).json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mcpRoutes.put("/:id", async (req, res) => {
  try {
    const server = await getCtx(req).mcpService.update(req.params.id, req.body);
    if (!server) return res.status(404).json({ error: "MCP server not found" });
    res.json(server);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

mcpRoutes.delete("/:id", async (req, res) => {
  try {
    const server = await getCtx(req).mcpService.delete(req.params.id);
    if (!server) return res.status(404).json({ error: "MCP server not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
