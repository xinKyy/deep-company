import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, envVars } from "../db/index.js";

export interface CreateEnvVarInput {
  key: string;
  value: string;
  description?: string;
  category?: "git" | "jenkins" | "codex" | "google" | "custom";
  isSecret?: boolean;
}

export class EnvVarService {
  private db = getDb();

  async create(input: CreateEnvVarInput) {
    const id = nanoid(12);
    const now = new Date().toISOString();
    const [row] = await this.db
      .insert(envVars)
      .values({
        id,
        key: input.key,
        value: input.value,
        description: input.description || "",
        category: input.category || "custom",
        isSecret: input.isSecret ?? true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  }

  async getById(id: string) {
    const [row] = await this.db
      .select()
      .from(envVars)
      .where(eq(envVars.id, id));
    return row || null;
  }

  async getByKey(key: string) {
    const [row] = await this.db
      .select()
      .from(envVars)
      .where(eq(envVars.key, key));
    return row || null;
  }

  async getValue(key: string): Promise<string | null> {
    const row = await this.getByKey(key);
    return row?.value ?? null;
  }

  async getValues(keys: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    const all = await this.db.select().from(envVars);
    for (const row of all) {
      if (keys.includes(row.key)) {
        result[row.key] = row.value;
      }
    }
    return result;
  }

  async list() {
    return this.db.select().from(envVars);
  }

  async listByCategory(category: string) {
    return this.db
      .select()
      .from(envVars)
      .where(eq(envVars.category, category));
  }

  async listSafe() {
    const rows = await this.db.select().from(envVars);
    return rows.map((r) => ({
      ...r,
      value: r.isSecret ? "••••••••" : r.value,
    }));
  }

  async update(
    id: string,
    input: Partial<CreateEnvVarInput>
  ) {
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.key !== undefined) updates.key = input.key;
    if (input.value !== undefined) updates.value = input.value;
    if (input.description !== undefined) updates.description = input.description;
    if (input.category !== undefined) updates.category = input.category;
    if (input.isSecret !== undefined) updates.isSecret = input.isSecret;

    const [row] = await this.db
      .update(envVars)
      .set(updates)
      .where(eq(envVars.id, id))
      .returning();
    return row || null;
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(envVars)
      .where(eq(envVars.id, id))
      .returning();
    return deleted || null;
  }

  async resolve(key: string): Promise<string> {
    const val = await this.getValue(key);
    if (!val) throw new Error(`Environment variable "${key}" not configured`);
    return val;
  }

  async resolveMany(keys: string[]): Promise<Record<string, string>> {
    const vals = await this.getValues(keys);
    const missing = keys.filter((k) => !vals[k]);
    if (missing.length > 0) {
      throw new Error(
        `Missing environment variables: ${missing.join(", ")}`
      );
    }
    return vals;
  }
}
