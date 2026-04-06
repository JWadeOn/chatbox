import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ChessToolHandler } from '../../server/apps/chess';
import { FirstPrinciplesToolHandler } from '../../server/apps/firstprinciples';
import { FlashcardsToolHandler } from '../../server/apps/flashcards';
import { KhanToolHandler } from '../../server/apps/khan';
import { StudyPlannerToolHandler } from '../../server/apps/studyplanner';
import { APP_APPROVAL_APPROVED } from '../../server/lib/app-approval';
import { db } from '../../server/lib/db';
import { apps, conversations, toolLogs, users } from '../../server/lib/schema';
import { buildActiveAppContextForConversation } from '../../server/services/active-app-context.service';
import { toolService } from '../../server/services/tool.service';
import { ToolRouter } from '../../server/services/tool-router.service';

describe('buildActiveAppContextForConversation', () => {
  const chessHandler = new ChessToolHandler();
  const khanHandler = new KhanToolHandler();
  const flashcardsHandler = new FlashcardsToolHandler();
  const firstHandler = new FirstPrinciplesToolHandler();
  const studyPlannerHandler = new StudyPlannerToolHandler();
  const router = new ToolRouter();

  let userId: string;
  let conversationId: string;

  beforeAll(async () => {
    const [u] = await db
      .insert(users)
      .values({ email: `ctx-${Date.now()}@t.com`, passwordHash: 'h', displayName: 'Ctx' })
      .returning();
    userId = u.id;
    const [c] = await db.insert(conversations).values({ userId, title: 'Ctx conv' }).returning();
    conversationId = c.id;

    const [chessApp] = await db.select().from(apps).where(eq(apps.slug, 'chess')).limit(1);
    if (!chessApp) {
      throw new Error('Expected seeded chess app; run pnpm db:seed');
    }
    if (chessApp.approvalStatus !== APP_APPROVAL_APPROVED) {
      await db
        .update(apps)
        .set({ approvalStatus: APP_APPROVAL_APPROVED, status: 'active', updatedAt: new Date() })
        .where(eq(apps.id, chessApp.id));
    }
    toolService.invalidateCache();

    const inv = await router.invoke({
      conversationId,
      appSlug: 'chess',
      toolName: 'start_game',
      toolParams: { mode: 'tutoring' },
      userId,
    });
    expect(inv.success).toBe(true);
    expect(inv.sessionId).toBeDefined();
    if (!inv.sessionId) {
      throw new Error('Missing sessionId from tool router invoke');
    }
    await chessHandler.handleToolInvoke(inv.sessionId, 'start_game', { mode: 'tutoring' });
  });

  afterAll(async () => {
    await db.delete(toolLogs).where(eq(toolLogs.conversationId, conversationId));
    await db.delete(conversations).where(eq(conversations.id, conversationId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('includes chess board context for active session', async () => {
    const ctx = await buildActiveAppContextForConversation(conversationId, {
      chess: chessHandler,
      khan: khanHandler,
      flashcards: flashcardsHandler,
      firstprinciples: firstHandler,
      studyplanner: studyPlannerHandler,
    });
    expect(ctx).toContain('Active App Context');
    expect(ctx).toContain('FEN:');
  });
});
