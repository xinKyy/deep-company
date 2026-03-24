import { Router } from "express";
import { getCtx } from "../context.js";

export const sopRoutes = Router();

sopRoutes.get("/", async (req, res) => {
  try {
    const sops = await getCtx(req).sopService.list();
    res.json(sops);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.get("/:id", async (req, res) => {
  try {
    const sop = await getCtx(req).sopService.getById(req.params.id);
    if (!sop) return res.status(404).json({ error: "SOP not found" });
    res.json(sop);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.post("/", async (req, res) => {
  try {
    const sop = await getCtx(req).sopService.create(req.body);
    res.status(201).json(sop);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.put("/:id", async (req, res) => {
  try {
    const sop = await getCtx(req).sopService.update(req.params.id, req.body);
    if (!sop) return res.status(404).json({ error: "SOP not found" });
    res.json(sop);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.delete("/:id", async (req, res) => {
  try {
    const sop = await getCtx(req).sopService.delete(req.params.id);
    if (!sop) return res.status(404).json({ error: "SOP not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Steps
sopRoutes.get("/:id/steps", async (req, res) => {
  try {
    const steps = await getCtx(req).sopService.getSteps(req.params.id);
    res.json(steps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.post("/:id/steps", async (req, res) => {
  try {
    const step = await getCtx(req).sopService.addStep({
      ...req.body,
      sopId: req.params.id,
    });
    res.status(201).json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.put("/steps/:stepId", async (req, res) => {
  try {
    const step = await getCtx(req).sopService.updateStep(req.params.stepId, req.body);
    if (!step) return res.status(404).json({ error: "Step not found" });
    res.json(step);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

sopRoutes.delete("/steps/:stepId", async (req, res) => {
  try {
    const step = await getCtx(req).sopService.deleteStep(req.params.stepId);
    if (!step) return res.status(404).json({ error: "Step not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
