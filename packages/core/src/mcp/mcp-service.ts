import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, mcpServers } from "../db/index.js";

export interface CreateMcpServerInput {
  name: string;
  description?: string;
  command: string;
  args?: string[];
  envVars?: Record<string, string>;
}

export class McpService {
  private db = getDb();

  async create(input: CreateMcpServerInput) {
    const id = nanoid(12);
    const [server] = await this.db
      .insert(mcpServers)
      .values({
        id,
        name: input.name,
        description: input.description || "",
        command: input.command,
        args: JSON.stringify(input.args || []),
        envVars: JSON.stringify(input.envVars || {}),
      })
      .returning();
    return server;
  }

  async getById(id: string) {
    const [server] = await this.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.id, id));
    return server || null;
  }

  async list() {
    return this.db.select().from(mcpServers);
  }

  async listActive() {
    return this.db
      .select()
      .from(mcpServers)
      .where(eq(mcpServers.status, "active"));
  }

  async update(
    id: string,
    input: Partial<CreateMcpServerInput> & { status?: "active" | "disabled" | "error" }
  ) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.command !== undefined) updates.command = input.command;
    if (input.args !== undefined) updates.args = JSON.stringify(input.args);
    if (input.envVars !== undefined)
      updates.envVars = JSON.stringify(input.envVars);
    if (input.status !== undefined) updates.status = input.status;

    const [server] = await this.db
      .update(mcpServers)
      .set(updates)
      .where(eq(mcpServers.id, id))
      .returning();
    return server || null;
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(mcpServers)
      .where(eq(mcpServers.id, id))
      .returning();
    return deleted || null;
  }
}
