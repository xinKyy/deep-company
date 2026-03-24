import { eq, and, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, memories } from "../db/index.js";

export interface CreateMemoryInput {
  agentId?: string;
  taskId?: string;
  type: "summary" | "task_context" | "decision" | "knowledge";
  content: string;
  metadata?: Record<string, unknown>;
}

export class MemoryService {
  private db = getDb();

  async create(input: CreateMemoryInput) {
    const id = nanoid(12);
    const [memory] = await this.db
      .insert(memories)
      .values({
        id,
        agentId: input.agentId || null,
        taskId: input.taskId || null,
        type: input.type,
        content: input.content,
        metadata: JSON.stringify(input.metadata || {}),
      })
      .returning();
    return memory;
  }

  async getByAgent(agentId: string, limit = 20) {
    return this.db
      .select()
      .from(memories)
      .where(eq(memories.agentId, agentId))
      .orderBy(desc(memories.createdAt))
      .limit(limit);
  }

  async getByTask(taskId: string) {
    return this.db
      .select()
      .from(memories)
      .where(eq(memories.taskId, taskId))
      .orderBy(desc(memories.createdAt));
  }

  async getByAgentAndType(
    agentId: string,
    type: "summary" | "task_context" | "decision" | "knowledge",
    limit = 20
  ) {
    return this.db
      .select()
      .from(memories)
      .where(and(eq(memories.agentId, agentId), eq(memories.type, type)))
      .orderBy(desc(memories.createdAt))
      .limit(limit);
  }

  async getRelevantContext(agentId: string, taskId?: string, limit = 10) {
    if (taskId) {
      const taskMemories = await this.getByTask(taskId);
      const agentMemories = await this.getByAgent(agentId, limit);
      const combined = [...taskMemories, ...agentMemories];
      const seen = new Set<string>();
      return combined.filter((m) => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }).slice(0, limit);
    }
    return this.getByAgent(agentId, limit);
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(memories)
      .where(eq(memories.id, id))
      .returning();
    return deleted || null;
  }

  async list(limit = 100) {
    return this.db
      .select()
      .from(memories)
      .orderBy(desc(memories.createdAt))
      .limit(limit);
  }
}
