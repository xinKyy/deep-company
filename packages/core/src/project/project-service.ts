import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, projects } from "../db/index.js";

export interface CreateProjectInput {
  name: string;
  description?: string;
  repoUrl?: string;
  config?: Record<string, unknown>;
}

export class ProjectService {
  private db = getDb();

  async create(input: CreateProjectInput) {
    const id = nanoid(12);
    const [project] = await this.db
      .insert(projects)
      .values({
        id,
        name: input.name,
        description: input.description || "",
        repoUrl: input.repoUrl || null,
        config: JSON.stringify(input.config || {}),
      })
      .returning();
    return project;
  }

  async getById(id: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id));
    return project || null;
  }

  async getByName(name: string) {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.name, name));
    return project || null;
  }

  async list() {
    return this.db.select().from(projects);
  }

  async update(id: string, input: Partial<CreateProjectInput>) {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.repoUrl !== undefined) updates.repoUrl = input.repoUrl;
    if (input.config !== undefined) updates.config = JSON.stringify(input.config);

    const [project] = await this.db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();
    return project || null;
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();
    return deleted || null;
  }
}
