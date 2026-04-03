import { and, desc, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { conversations, messages } from '../lib/schema';

export class ConversationService {
  async create(userId: string, title?: string) {
    const [conversation] = await db
      .insert(conversations)
      .values({ userId, title: title || null })
      .returning();
    return conversation;
  }

  async list(userId: string) {
    return db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(desc(conversations.updatedAt));
  }

  async get(conversationId: string, userId: string) {
    const [conversation] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
      .limit(1);

    if (!conversation) {
      return null;
    }

    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);

    return { ...conversation, messages: msgs };
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

    // Auto-title: set title from first user message if untitled
    if (role === 'user') {
      const [conv] = await db.select().from(conversations).where(eq(conversations.id, conversationId)).limit(1);
      if (conv && !conv.title) {
        const title = content.length > 50 ? `${content.slice(0, 47)}...` : content;
        await db
          .update(conversations)
          .set({ title, updatedAt: new Date() })
          .where(eq(conversations.id, conversationId));
      } else {
        await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
      }
    } else {
      await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, conversationId));
    }

    return message;
  }
}

export const conversationService = new ConversationService();
