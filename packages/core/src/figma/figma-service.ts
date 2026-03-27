import type { McpClientManager, McpToolCallResult } from "../mcp/mcp-client.js";

const SERVER_NAME = "figma";

function extractText(result: McpToolCallResult): string {
  if (result.isError) {
    const errText = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    throw new Error(errText || "Figma MCP call failed");
  }
  return result.content
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
}

export interface FigmaImageNode {
  nodeId: string;
  fileName: string;
  imageRef?: string;
  gifRef?: string;
}

export class FigmaService {
  constructor(private mcpManager: McpClientManager) {}

  private async call(tool: string, args: Record<string, unknown> = {}): Promise<McpToolCallResult> {
    const client = await this.mcpManager.get(SERVER_NAME);
    return client.callTool(tool, args);
  }

  /**
   * Get comprehensive design data from a Figma file node.
   */
  async getDesignData(params: {
    fileKey: string;
    nodeId?: string;
    depth?: number;
  }): Promise<string> {
    const args: Record<string, unknown> = { fileKey: params.fileKey };
    if (params.nodeId) args.nodeId = params.nodeId;
    if (params.depth != null) args.depth = params.depth;
    const result = await this.call("get_figma_data", args);
    return extractText(result);
  }

  /**
   * Download images (SVG/PNG/GIF) from Figma nodes to a local directory.
   */
  async downloadImages(params: {
    fileKey: string;
    nodes: FigmaImageNode[];
    localPath: string;
    pngScale?: number;
  }): Promise<string> {
    const result = await this.call("download_figma_images", {
      fileKey: params.fileKey,
      nodes: params.nodes,
      localPath: params.localPath,
      pngScale: params.pngScale,
    });
    return extractText(result);
  }

  async listAvailableTools(): Promise<Array<{ name: string; description?: string }>> {
    const client = await this.mcpManager.get(SERVER_NAME);
    return client.listTools();
  }

  /**
   * Parse Figma URL to extract fileKey and nodeId.
   */
  static parseUrl(url: string): { fileKey: string; nodeId?: string } | null {
    try {
      const u = new URL(url);
      if (!u.hostname.includes("figma.com")) return null;

      const pathParts = u.pathname.split("/").filter(Boolean);

      if (pathParts[0] === "design" || pathParts[0] === "file") {
        const hasBranch = pathParts.includes("branch");
        const fileKey = hasBranch ? pathParts[pathParts.indexOf("branch") + 1] : pathParts[1];
        const nodeIdParam = u.searchParams.get("node-id");
        const nodeId = nodeIdParam ? nodeIdParam.replace(/-/g, ":") : undefined;
        return { fileKey, nodeId };
      }

      if (pathParts[0] === "make") {
        return { fileKey: pathParts[1] };
      }

      if (pathParts[0] === "board") {
        const nodeIdParam = u.searchParams.get("node-id");
        const nodeId = nodeIdParam ? nodeIdParam.replace(/-/g, ":") : undefined;
        return { fileKey: pathParts[1], nodeId };
      }

      return null;
    } catch {
      return null;
    }
  }
}
