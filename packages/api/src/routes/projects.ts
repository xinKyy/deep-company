import { Router } from "express";
import { getCtx } from "../context.js";

export const projectRoutes = Router();

projectRoutes.get("/", async (req, res) => {
  try {
    const projects = await getCtx(req).projectService.list();
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRoutes.get("/:id", async (req, res) => {
  try {
    const project = await getCtx(req).projectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRoutes.post("/", async (req, res) => {
  try {
    const project = await getCtx(req).projectService.create(req.body);
    res.status(201).json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRoutes.put("/:id", async (req, res) => {
  try {
    const project = await getCtx(req).projectService.update(req.params.id, req.body);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

projectRoutes.delete("/:id", async (req, res) => {
  try {
    const project = await getCtx(req).projectService.delete(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
