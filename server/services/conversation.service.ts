import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../lib/db';
import { conversations, messages } from '../lib/schema';

const DEFAULT_CONVERSATION_LIMIT = 50;
const DEFAULT_MESSAGE_LIMIT = 50;

export class ConversationService {
  async create(userId: string, title?: string) {
    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title: title || null })
      .returning();
    return conversation;
  }

  async list(userId: string, limit = DEFAULT_CONVERSATION_LIMIT) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);
  }

  async get(conversationId: string, userId: string, messageLimit = DEFAULT_MESSAGE_LIMIT) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversation) {
      return null;
    }

    // Load most recent messages (ordered ascending for LLM context)
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(messageLimit);

    return { ...conversation, messages: msgs.reverse() };
  }

  async delete(conversationId: string, userId: string): Promise<boolean> {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversation) {
      return false;
    }

    await db.delete(conversations).where(eq(conversations.id, conversationId));
    return true;
  }

  async addMessage(conversationId: string, role: string, content: string, metadata?: Record<string, unknown>) {
    const [message] = await db
      .insert(messages)
      .values({ conversationId, role, content, metadata: metadata || {} })
      .returning();

    // Update timestamp; auto-title first user message if untitled (single UPDATE, no SELECT)
    if (role === 'user') {
      const title = content.length > 50 ? `${content.slice(0, 47)}...` : content;
      // COALESCE keeps existing title if set; otherwise uses first user message
      await db
        .update(conversations)
        .set({
          updatedAt: new Date(),
          title: sql`COALESCE(${conversations.title}, ${title})`,
        })
        .where(eq(conversations.id, conversationId));
    } else {
      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
    }

    return message;
  }
}

export const conversationService = new ConversationService();
