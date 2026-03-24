import { eq, and, desc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, messages } from "../db/index.js";

export interface RecordMessageInput {
  agentId?: string;
  tgChatId: string;
  tgMessageId: string;
  tgUserId?: string;
  tgUsername?: string;
  direction: "incoming" | "outgoing";
  content: string;
  messageType?: "text" | "photo" | "document" | "voice" | "video" | "other";
  rawData?: string;
}

export class MessageService {
  private db = getDb();

  async record(input: RecordMessageInput): Promise<{ saved: boolean; id?: string }> {
    const id = nanoid(12);
    try {
      await this.db
        .insert(messages)
        .values({
          id,
          agentId: input.agentId || null,
          tgChatId: input.tgChatId,
          tgMessageId: input.tgMessageId,
          tgUserId: input.tgUserId || null,
          tgUsername: input.tgUsername || null,
          direction: input.direction,
          content: input.content,
          messageType: input.messageType || "text",
          rawData: input.rawData || null,
        })
        .onConflictDoNothing();
      return { saved: true, id };
    } catch {
      return { saved: false };
    }
  }

  async getRecentByChat(chatId: string, limit = 50) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.tgChatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async getRecentByAgent(agentId: string, limit = 50) {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.agentId, agentId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async getConversationHistory(
    chatId: string,
    agentId: string,
    limit = 20
  ) {
    return this.db
      .select()
      .from(messages)
      .where(
        and(eq(messages.tgChatId, chatId), eq(messages.agentId, agentId))
      )
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  async countByAgent(agentId: string) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.agentId, agentId));
    return result[0]?.count || 0;
  }
}
