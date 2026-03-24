import { Router } from "express";
import { getCtx } from "../context.js";

export const skillRoutes = Router();

skillRoutes.get("/", async (req, res) => {
  try {
    const skills = await getCtx(req).skillService.list();
    const registered = getCtx(req).skillService.listRegisteredHandlers();
    res.json({ skills, registeredHandlers: registered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

skillRoutes.get("/:id", async (req, res) => {
  try {
    const skill = await getCtx(req).skillService.getById(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

skillRoutes.post("/", async (req, res) => {
  try {
    const skill = await getCtx(req).skillService.create(req.body);
    res.status(201).json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

skillRoutes.put("/:id", async (req, res) => {
  try {
    const skill = await getCtx(req).skillService.update(req.params.id, req.body);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

skillRoutes.delete("/:id", async (req, res) => {
  try {
    const skill = await getCtx(req).skillService.delete(req.params.id);
    if (!skill) return res.status(404).json({ error: "Skill not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
