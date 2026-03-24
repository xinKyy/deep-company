import { eq, and, asc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, sops, sopSteps, agentSops, sopStepSkills } from "../db/index.js";

export interface CreateSopInput {
  name: string;
  description?: string;
  triggerType?: "keyword" | "intent" | "manual" | "event";
  triggerConfig?: Record<string, unknown>;
}

export interface CreateSopStepInput {
  sopId: string;
  stepOrder: number;
  name: string;
  description?: string;
  actionType:
    | "llm_call"
    | "skill_call"
    | "mcp_call"
    | "human_input"
    | "notify"
    | "create_task"
    | "transition_task"
    | "condition";
  actionConfig?: Record<string, unknown>;
  condition?: string;
  nextStepId?: string;
  nextStepOnFail?: string;
}

export class SopService {
  private db = getDb();

  async create(input: CreateSopInput) {
    const id = nanoid(12);
    const [sop] = await this.db
      .insert(sops)
      .values({
        id,
        name: input.name,
        description: input.description || "",
        triggerType: input.triggerType || "intent",
        triggerConfig: JSON.stringify(input.triggerConfig || {}),
      })
      .returning();
    return sop;
  }

  async getById(id: string) {
    const [sop] = await this.db.select().from(sops).where(eq(sops.id, id));
    return sop || null;
  }

  async list() {
    return this.db.select().from(sops);
  }

  async update(id: string, input: Partial<CreateSopInput>) {
    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.triggerType !== undefined) updates.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined)
      updates.triggerConfig = JSON.stringify(input.triggerConfig);

    const [sop] = await this.db
      .update(sops)
      .set(updates)
      .where(eq(sops.id, id))
      .returning();
    return sop || null;
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(sops)
      .where(eq(sops.id, id))
      .returning();
    return deleted || null;
  }

  // ─── Steps ──────────────────────────────────────────────────────────

  async addStep(input: CreateSopStepInput) {
    const id = nanoid(12);
    const [step] = await this.db
      .insert(sopSteps)
      .values({
        id,
        sopId: input.sopId,
        stepOrder: input.stepOrder,
        name: input.name,
        description: input.description || "",
        actionType: input.actionType,
        actionConfig: JSON.stringify(input.actionConfig || {}),
        condition: input.condition || null,
        nextStepId: input.nextStepId || null,
        nextStepOnFail: input.nextStepOnFail || null,
      })
      .returning();
    return step;
  }

  async getSteps(sopId: string) {
    return this.db
      .select()
      .from(sopSteps)
      .where(eq(sopSteps.sopId, sopId))
      .orderBy(asc(sopSteps.stepOrder));
  }

  async getStepById(stepId: string) {
    const [step] = await this.db
      .select()
      .from(sopSteps)
      .where(eq(sopSteps.id, stepId));
    return step || null;
  }

  async updateStep(stepId: string, input: Partial<CreateSopStepInput>) {
    const updates: Record<string, unknown> = {};
    if (input.stepOrder !== undefined) updates.stepOrder = input.stepOrder;
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.actionType !== undefined) updates.actionType = input.actionType;
    if (input.actionConfig !== undefined)
      updates.actionConfig = JSON.stringify(input.actionConfig);
    if (input.condition !== undefined) updates.condition = input.condition;
    if (input.nextStepId !== undefined) updates.nextStepId = input.nextStepId;
    if (input.nextStepOnFail !== undefined)
      updates.nextStepOnFail = input.nextStepOnFail;

    const [step] = await this.db
      .update(sopSteps)
      .set(updates)
      .where(eq(sopSteps.id, stepId))
      .returning();
    return step || null;
  }

  async deleteStep(stepId: string) {
    const [deleted] = await this.db
      .delete(sopSteps)
      .where(eq(sopSteps.id, stepId))
      .returning();
    return deleted || null;
  }

  async bindSkillToStep(stepId: string, skillId: string) {
    await this.db
      .insert(sopStepSkills)
      .values({ sopStepId: stepId, skillId })
      .onConflictDoNothing();
  }

  async unbindSkillFromStep(stepId: string, skillId: string) {
    await this.db
      .delete(sopStepSkills)
      .where(
        and(
          eq(sopStepSkills.sopStepId, stepId),
          eq(sopStepSkills.skillId, skillId)
        )
      );
  }

  async getSopsByAgentId(agentId: string) {
    const bindings = await this.db
      .select({ sopId: agentSops.sopId })
      .from(agentSops)
      .where(eq(agentSops.agentId, agentId));

    if (bindings.length === 0) return [];

    const sopIds = bindings.map((b) => b.sopId);
    const allSops = await this.db.select().from(sops);
    return allSops.filter((s) => sopIds.includes(s.id));
  }

  async getFirstStep(sopId: string) {
    const steps = await this.getSteps(sopId);
    return steps[0] || null;
  }
}
