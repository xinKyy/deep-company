import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export type McpServerConfig =
  | { name: string; transport: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { name: string; transport: "http"; url: string; headers?: Record<string, string> };

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export class McpClient {
  private client: Client;
  private connected = false;
  private config: McpServerConfig;

  constructor(config: McpServerConfig) {
    this.config = config;
    this.client = new Client(
      { name: "ai-dev-pro", version: "0.1.0" },
      { capabilities: {} }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;

    if (this.config.transport === "stdio") {
      const transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
        env: { ...process.env, ...this.config.env } as Record<string, string>,
      });
      await this.client.connect(transport);
    } else {
      const transport = new StreamableHTTPClientTransport(
        new URL(this.config.url),
        { requestInit: { headers: this.config.headers || {} } }
      );
      await this.client.connect(transport);
    }

    this.connected = true;
    console.log(`[McpClient] Connected to "${this.config.name}" (${this.config.transport})`);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    try {
      await this.client.close();
    } catch {
      // ignore cleanup errors
    }
    this.connected = false;
    console.log(`[McpClient] Disconnected from "${this.config.name}"`);
  }

  isConnected(): boolean {
    return this.connected;
  }

  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema: unknown }>> {
    await this.ensureConnected();
    const result = await this.client.listTools();
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  async callTool(name: string, args: Record<string, unknown> = {}, options?: { timeout?: number }): Promise<McpToolCallResult> {
    await this.ensureConnected();
    const result = await this.client.callTool(
      { name, arguments: args },
      undefined,
      options?.timeout ? { timeout: options.timeout } : undefined,
    );
    return {
      content: result.content as McpToolCallResult["content"],
      isError: result.isError as boolean | undefined,
    };
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connected) {
      await this.connect();
    }
  }
}

/**
 * Manages multiple MCP client connections with lazy initialization.
 */
export class McpClientManager {
  private clients = new Map<string, McpClient>();

  register(config: McpServerConfig): void {
    if (this.clients.has(config.name)) {
      console.log(`[McpClientManager] Replacing existing client "${config.name}"`);
    }
    this.clients.set(config.name, new McpClient(config));
  }

  async get(name: string): Promise<McpClient> {
    const client = this.clients.get(name);
    if (!client) {
      throw new Error(`MCP server "${name}" is not registered`);
    }
    if (!client.isConnected()) {
      await client.connect();
    }
    return client;
  }

  has(name: string): boolean {
    return this.clients.has(name);
  }

  async disconnectAll(): Promise<void> {
    for (const [, client] of this.clients) {
      await client.disconnect();
    }
  }

  listRegistered(): string[] {
    return Array.from(this.clients.keys());
  }
}
