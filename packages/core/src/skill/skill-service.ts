import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, skills } from "../db/index.js";

export interface CreateSkillInput {
  name: string;
  description?: string;
  type?: "builtin" | "custom" | "mcp";
  inputSchema?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export type SkillExecutionContext = {
  agentId: string;
  taskId?: string;
  /** Resolved absolute path for shell, git, codex default cwd */
  agentWorkDir: string;
};

export type SkillHandler = (
  params: Record<string, unknown>,
  context: SkillExecutionContext
) => Promise<unknown>;

export class SkillService {
  private db = getDb();
  private handlers = new Map<string, SkillHandler>();

  registerHandler(name: string, handler: SkillHandler) {
    this.handlers.set(name, handler);
  }

  getHandler(name: string): SkillHandler | undefined {
    return this.handlers.get(name);
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    context: SkillExecutionContext
  ): Promise<{ success: boolean; result?: unknown; error?: string }> {
    const handler = this.handlers.get(name);
    if (!handler) {
      return { success: false, error: `Skill handler "${name}" not registered` };
    }
    try {
      const result = await handler(params, context);
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async create(input: CreateSkillInput) {
    const id = nanoid(12);
    const [skill] = await this.db
      .insert(skills)
      .values({
        id,
        name: input.name,
        description: input.description || "",
        type: input.type || "builtin",
        inputSchema: JSON.stringify(input.inputSchema || {}),
        config: JSON.stringify(input.config || {}),
      })
      .returning();
    return skill;
  }

  async getById(id: string) {
    const [skill] = await this.db
      .select()
      .from(skills)
      .where(eq(skills.id, id));
    return skill || null;
  }

  async getByName(name: string) {
    const [skill] = await this.db
      .select()
      .from(skills)
      .where(eq(skills.name, name));
    return skill || null;
  }

  async list() {
    return this.db.select().from(skills);
  }

  async listActive() {
    return this.db
      .select()
      .from(skills)
      .where(eq(skills.status, "active"));
  }

  async update(id: string, input: Partial<CreateSkillInput> & { status?: "active" | "disabled" }) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.type !== undefined) updates.type = input.type;
    if (input.inputSchema !== undefined)
      updates.inputSchema = JSON.stringify(input.inputSchema);
    if (input.config !== undefined) updates.config = JSON.stringify(input.config);
    if (input.status !== undefined) updates.status = input.status;

    const [skill] = await this.db
      .update(skills)
      .set(updates)
      .where(eq(skills.id, id))
      .returning();
    return skill || null;
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(skills)
      .where(eq(skills.id, id))
      .returning();
    return deleted || null;
  }

  listRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}
