import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, agents, agentSops } from "../db/index.js";

export interface CreateAgentInput {
  name: string;
  description?: string;
  systemPrompt?: string;
  llmProvider?: string;
  llmModel?: string;
  tgBotToken?: string;
  tgBotUsername?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  llmProvider?: string;
  llmModel?: string;
  tgBotToken?: string;
  tgBotUsername?: string;
  status?: "active" | "paused" | "disabled";
}

export class AgentService {
  private db = getDb();

  async create(input: CreateAgentInput) {
    const id = nanoid(12);
    const [agent] = await this.db
      .insert(agents)
      .values({
        id,
        name: input.name,
        description: input.description || "",
        systemPrompt: input.systemPrompt || "",
        llmProvider: input.llmProvider || "openai",
        llmModel: input.llmModel || "gpt-4o",
        tgBotToken: input.tgBotToken || null,
        tgBotUsername: input.tgBotUsername || null,
      })
      .returning();
    return agent;
  }

  async getById(id: string) {
    const [agent] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.id, id));
    return agent || null;
  }

  async list() {
    return this.db.select().from(agents);
  }

  async listActive() {
    return this.db
      .select()
      .from(agents)
      .where(eq(agents.status, "active"));
  }

  async update(id: string, input: UpdateAgentInput) {
    const [agent] = await this.db
      .update(agents)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(agents.id, id))
      .returning();
    return agent || null;
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(agents)
      .where(eq(agents.id, id))
      .returning();
    return deleted || null;
  }

  async getByBotToken(token: string) {
    const [agent] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.tgBotToken, token));
    return agent || null;
  }

  async getByBotUsername(username: string) {
    const [agent] = await this.db
      .select()
      .from(agents)
      .where(eq(agents.tgBotUsername, username));
    return agent || null;
  }

  async bindSop(agentId: string, sopId: string) {
    await this.db
      .insert(agentSops)
      .values({ agentId, sopId })
      .onConflictDoNothing();
  }

  async unbindSop(agentId: string, sopId: string) {
    await this.db
      .delete(agentSops)
      .where(
        eq(agentSops.agentId, agentId) 
      );
  }

  async getAgentSopIds(agentId: string): Promise<string[]> {
    const rows = await this.db
      .select({ sopId: agentSops.sopId })
      .from(agentSops)
      .where(eq(agentSops.agentId, agentId));
    return rows.map((r) => r.sopId);
  }
}
