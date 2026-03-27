import { Router } from "express";
import { getCtx } from "../context.js";
import { FigmaService } from "@ai-dev-pro/core";

export const figmaRoutes = Router();

figmaRoutes.post("/design-data", async (req, res) => {
  try {
    const { fileKey, nodeId, depth } = req.body;
    if (!fileKey) {
      return res.status(400).json({ error: "fileKey is required" });
    }
    const data = await getCtx(req).figmaService.getDesignData({ fileKey, nodeId, depth });
    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

figmaRoutes.post("/download-images", async (req, res) => {
  try {
    const { fileKey, nodes, localPath, pngScale } = req.body;
    if (!fileKey || !nodes || !localPath) {
      return res.status(400).json({ error: "fileKey, nodes, localPath are required" });
    }
    const result = await getCtx(req).figmaService.downloadImages({ fileKey, nodes, localPath, pngScale });
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

figmaRoutes.post("/parse-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "url is required" });
    const parsed = FigmaService.parseUrl(url);
    if (!parsed) return res.status(400).json({ error: "Unable to parse Figma URL" });
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

figmaRoutes.get("/status", async (req, res) => {
  try {
    const ctx = getCtx(req);
    const hasFigma = ctx.mcpClientManager.has("figma");
    if (!hasFigma) {
      return res.json({ connected: false, reason: "Figma MCP not configured" });
    }
    const tools = await ctx.figmaService.listAvailableTools();
    res.json({ connected: true, tools: tools.map((t) => t.name) });
  } catch (err: any) {
    res.json({ connected: false, reason: err.message });
  }
});

figmaRoutes.get("/tools", async (req, res) => {
  try {
    const tools = await getCtx(req).figmaService.listAvailableTools();
    res.json(tools);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
