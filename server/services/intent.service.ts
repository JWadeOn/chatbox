import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { intents } from '../lib/schema';

type Intent = typeof intents.$inferSelect;

export class IntentService {
  async createIntent(params: {
    conversationId: string;
    name: string;
    confidence: number;
    appId: string | null;
  }): Promise<Intent> {
    // Auto-resolve any existing active intent for this conversation
    await db
      .update(intents)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(and(eq(intents.conversationId, params.conversationId), eq(intents.status, 'active')));

    // Create the new active intent
    const [intent] = await db
      .insert(intents)
      .values({
        conversationId: params.conversationId,
        name: params.name,
        confidence: params.confidence,
        appId: params.appId,
        status: 'active',
      })
      .returning();

    return intent;
  }

  async getActiveIntent(conversationId: string): Promise<Intent | null> {
    const [intent] = await db
      .select()
      .from(intents)
      .where(and(eq(intents.conversationId, conversationId), eq(intents.status, 'active')));

    return intent ?? null;
  }

  async resolveIntent(intentId: string): Promise<void> {
    await db.update(intents).set({ status: 'resolved', resolvedAt: new Date() }).where(eq(intents.id, intentId));
  }

  async abandonIntent(intentId: string): Promise<void> {
    await db.update(intents).set({ status: 'abandoned', resolvedAt: new Date() }).where(eq(intents.id, intentId));
  }
}
