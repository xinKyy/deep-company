import { Router } from "express";
import { getCtx } from "../context.js";

export const envVarRoutes = Router();

envVarRoutes.get("/", async (req, res) => {
  try {
    const rows = await getCtx(req).envVarService.listSafe();
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

envVarRoutes.get("/:id", async (req, res) => {
  try {
    const row = await getCtx(req).envVarService.getById(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, value: row.isSecret ? "••••••••" : row.value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

envVarRoutes.post("/", async (req, res) => {
  try {
    const row = await getCtx(req).envVarService.create(req.body);
    res.status(201).json({ ...row, value: row.isSecret ? "••••••••" : row.value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

envVarRoutes.put("/:id", async (req, res) => {
  try {
    const row = await getCtx(req).envVarService.update(req.params.id, req.body);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ ...row, value: row.isSecret ? "••••••••" : row.value });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

envVarRoutes.delete("/:id", async (req, res) => {
  try {
    const row = await getCtx(req).envVarService.delete(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ deleted: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
