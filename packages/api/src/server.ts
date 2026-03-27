import { config as dotenvConfig } from "dotenv";
import { existsSync } from "fs";
import { resolve, dirname } from "path";

function loadEnv() {
  let dir = process.cwd();
  while (dir !== dirname(dir)) {
    const envPath = resolve(dir, ".env");
    if (existsSync(envPath)) {
      dotenvConfig({ path: envPath });
      return;
    }
    dir = dirname(dir);
  }
  dotenvConfig();
}
loadEnv();
import "./runtime-logger.js";
import { ProxyAgent, setGlobalDispatcher } from "undici";

const proxyUrl =
  process.env.HTTPS_PROXY || process.env.https_proxy ||
  process.env.HTTP_PROXY || process.env.http_proxy;
if (proxyUrl) {
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
  console.log(`Global proxy set: ${proxyUrl}`);
}

import express from "express";
import cors from "cors";
import { initDb } from "@ai-dev-pro/core";
import { agentRoutes } from "./routes/agents.js";
import { sopRoutes } from "./routes/sops.js";
import { taskRoutes } from "./routes/tasks.js";
import { projectRoutes } from "./routes/projects.js";
import { skillRoutes } from "./routes/skills.js";
import { mcpRoutes } from "./routes/mcps.js";
import { memoryRoutes } from "./routes/memories.js";
import { messageRoutes } from "./routes/messages.js";
import { envVarRoutes } from "./routes/env-vars.js";
import { logRoutes } from "./routes/logs.js";
import { figmaRoutes } from "./routes/figma.js";
import { createAppContext, type AppContext } from "./context.js";
import { BotManager } from "@ai-dev-pro/telegram";

const PORT = parseInt(process.env.API_PORT || "3000", 10);

async function main() {
  initDb();

  const ctx = createAppContext();
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    (req as any).ctx = ctx;
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.use("/api/agents", agentRoutes);
  app.use("/api/sops", sopRoutes);
  app.use("/api/tasks", taskRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/skills", skillRoutes);
  app.use("/api/mcps", mcpRoutes);
  app.use("/api/memories", memoryRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/env-vars", envVarRoutes);
  app.use("/api/logs", logRoutes);
  app.use("/api/figma", figmaRoutes);

  const botManager = new BotManager(ctx);
  await botManager.startAll();

  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
