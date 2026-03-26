import { Router } from "express";
import { getLogEntries, type LogQueryLevel } from "../runtime-logger.js";

const VALID: LogQueryLevel[] = ["all", "debug", "info", "warn", "error"];

export const logRoutes = Router();

logRoutes.get("/", (req, res) => {
  const raw = String(req.query.level || "all");
  const level = VALID.includes(raw as LogQueryLevel)
    ? (raw as LogQueryLevel)
    : "all";
  const limit = parseInt(String(req.query.limit || "500"), 10);
  const result = getLogEntries({ minLevel: level, limit });
  res.json(result);
});
