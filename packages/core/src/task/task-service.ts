import { eq, like, or, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, tasks, taskEvents } from "../db/index.js";

const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ["assigned", "in_progress", "cancelled"],
  assigned: ["in_progress", "cancelled"],
  in_progress: ["review", "blocked", "cancelled"],
  blocked: ["in_progress", "cancelled"],
  review: ["completed", "rejected"],
  rejected: ["in_progress", "cancelled"],
  completed: [],
  cancelled: [],
};

export type TaskStatus =
  | "created"
  | "assigned"
  | "in_progress"
  | "review"
  | "blocked"
  | "completed"
  | "rejected"
  | "cancelled";

export interface CreateTaskInput {
  projectId?: string;
  parentTaskId?: string;
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high" | "urgent";
  assignedAgentId?: string;
  createdByAgentId?: string;
  sopId?: string;
  metadata?: Record<string, unknown>;
}

export interface TaskDetail {
  task: typeof tasks.$inferSelect;
  subtasks: (typeof tasks.$inferSelect)[];
  events: (typeof taskEvents.$inferSelect)[];
  subtaskProgress: { total: number; completed: number };
}

export class TaskService {
  private db = getDb();

  async create(input: CreateTaskInput) {
    const id = `TASK-${nanoid(8).toUpperCase()}`;
    const [task] = await this.db
      .insert(tasks)
      .values({
        id,
        projectId: input.projectId || null,
        parentTaskId: input.parentTaskId || null,
        title: input.title,
        description: input.description || "",
        priority: input.priority || "medium",
        assignedAgentId: input.assignedAgentId || null,
        createdByAgentId: input.createdByAgentId || null,
        sopId: input.sopId || null,
        metadata: JSON.stringify(input.metadata || {}),
      })
      .returning();

    await this.db.insert(taskEvents).values({
      id: nanoid(12),
      taskId: id,
      fromStatus: null,
      toStatus: "created",
      agentId: input.createdByAgentId || null,
      comment: "Task created",
    });

    return task;
  }

  async getById(id: string) {
    const [task] = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.id, id));
    return task || null;
  }

  async getDetail(id: string): Promise<TaskDetail | null> {
    const task = await this.getById(id);
    if (!task) return null;

    const subtasks = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, id));

    const events = await this.db
      .select()
      .from(taskEvents)
      .where(eq(taskEvents.taskId, id))
      .orderBy(desc(taskEvents.createdAt));

    const completed = subtasks.filter(
      (s) => s.status === "completed"
    ).length;

    return {
      task,
      subtasks,
      events,
      subtaskProgress: { total: subtasks.length, completed },
    };
  }

  async list(filters?: { projectId?: string; status?: string; assignedAgentId?: string }) {
    let query = this.db.select().from(tasks);
    const conditions = [];

    if (filters?.projectId) conditions.push(eq(tasks.projectId, filters.projectId));
    if (filters?.status) conditions.push(eq(tasks.status, filters.status as TaskStatus));
    if (filters?.assignedAgentId) conditions.push(eq(tasks.assignedAgentId, filters.assignedAgentId));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return query.orderBy(desc(tasks.createdAt));
  }

  async search(keyword: string) {
    return this.db
      .select()
      .from(tasks)
      .where(
        or(
          like(tasks.id, `%${keyword}%`),
          like(tasks.title, `%${keyword}%`),
          like(tasks.description, `%${keyword}%`)
        )
      )
      .orderBy(desc(tasks.createdAt));
  }

  async transition(
    taskId: string,
    toStatus: TaskStatus,
    agentId?: string,
    comment?: string
  ): Promise<{ success: boolean; error?: string; task?: typeof tasks.$inferSelect }> {
    const task = await this.getById(taskId);
    if (!task) return { success: false, error: "Task not found" };

    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed || !allowed.includes(toStatus)) {
      return {
        success: false,
        error: `Cannot transition from "${task.status}" to "${toStatus}"`,
      };
    }

    const [updated] = await this.db
      .update(tasks)
      .set({
        status: toStatus,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    await this.db.insert(taskEvents).values({
      id: nanoid(12),
      taskId,
      fromStatus: task.status,
      toStatus,
      agentId: agentId || null,
      comment: comment || "",
    });

    return { success: true, task: updated };
  }

  async assign(taskId: string, agentId: string, byAgentId?: string) {
    const [updated] = await this.db
      .update(tasks)
      .set({
        assignedAgentId: agentId,
        status: "assigned",
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId))
      .returning();

    if (updated) {
      await this.db.insert(taskEvents).values({
        id: nanoid(12),
        taskId,
        fromStatus: "created",
        toStatus: "assigned",
        agentId: byAgentId || null,
        comment: `Assigned to agent ${agentId}`,
      });
    }

    return updated || null;
  }

  async updateSopStep(taskId: string, stepId: string) {
    const [updated] = await this.db
      .update(tasks)
      .set({
        currentSopStepId: stepId,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId))
      .returning();
    return updated || null;
  }

  async getSubtasks(parentTaskId: string) {
    return this.db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, parentTaskId))
      .orderBy(desc(tasks.createdAt));
  }

  async getEvents(taskId: string) {
    return this.db
      .select()
      .from(taskEvents)
      .where(eq(taskEvents.taskId, taskId))
      .orderBy(desc(taskEvents.createdAt));
  }

  async completeWithSubtasks(taskId: string, agentId?: string) {
    const subtasks = await this.getSubtasks(taskId);
    for (const sub of subtasks) {
      if (sub.status !== "completed" && sub.status !== "cancelled") {
        await this.transition(sub.id, "completed", agentId, "Parent task completed");
      }
    }
    return this.transition(taskId, "completed", agentId, "Task and subtasks completed");
  }

  async delete(id: string) {
    const [deleted] = await this.db
      .delete(tasks)
      .where(eq(tasks.id, id))
      .returning();
    return deleted || null;
  }
}
