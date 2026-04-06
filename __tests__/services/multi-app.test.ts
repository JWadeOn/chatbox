import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP_APPROVAL_APPROVED } from '../../server/lib/app-approval';
import { db } from '../../server/lib/db';
import { appSessions, apps, conversations, intents, toolLogs, users } from '../../server/lib/schema';
import { AppService } from '../../server/services/app.service';
import { CompletionService } from '../../server/services/completion.service';
import { IntentService } from '../../server/services/intent.service';
import { ToolRouter } from '../../server/services/tool-router.service';

const toolRouter = new ToolRouter();
const intentService = new IntentService();
const completionService = new CompletionService();
const appService = new AppService();

let testUserId: string;
let testConversationId: string;
let chessAppId: string;
let khanAppId: string;
let chessSlug: string;
let khanSlug: string;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ email: `multiapp-test-${Date.now()}@test.com`, passwordHash: 'hash', displayName: 'Multi App Tester' })
    .returning();
  testUserId = user.id;

  const [conv] = await db.insert(conversations).values({ userId: testUserId, title: 'Multi App Test' }).returning();
  testConversationId = conv.id;

  const chessApp = await appService.register({
    slug: `chess-multiapp-${Date.now()}`,
    name: 'Chess',
    description: 'Chess game',
    authType: 'none',
    iframeUrl: 'https://chess.example.com',
    toolSchemas: [{ name: 'start_game', description: 'Start a chess game', parameters: {} }],
  });
  chessAppId = chessApp.id;
  chessSlug = chessApp.slug;
  await appService.setApprovalStatus(chessApp.slug, APP_APPROVAL_APPROVED);

  const khanApp = await appService.register({
    slug: `khan-multiapp-${Date.now()}`,
    name: 'Khan Academy Companion',
    description: 'Topic exploration companion',
    authType: 'none',
    iframeUrl: 'https://khan.example.com',
    toolSchemas: [{ name: 'open_topic', description: 'Open a topic', parameters: {} }],
  });
  khanAppId = khanApp.id;
  khanSlug = khanApp.slug;
  await appService.setApprovalStatus(khanApp.slug, APP_APPROVAL_APPROVED);
});

afterAll(async () => {
  await db.delete(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
  await db.delete(intents).where(eq(intents.conversationId, testConversationId));
  await db.delete(appSessions).where(eq(appSessions.conversationId, testConversationId));
  await db.delete(conversations).where(eq(conversations.id, testConversationId));
  await db.delete(apps).where(eq(apps.id, chessAppId));
  await db.delete(apps).where(eq(apps.id, khanAppId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('Multi-app switching', () => {
  let chessSessionId: string;

  it('invokes chess app and creates active session', async () => {
    const result = await toolRouter.invoke({
      conversationId: testConversationId,
      appSlug: chessSlug,
      toolName: 'start_game',
      toolParams: {},
      userId: testUserId,
    });
    expect(result.invocationId).toBeDefined();
    expect(result.sessionId).toBeDefined();
    chessSessionId = result.sessionId;

    const intent = await intentService.getActiveIntent(testConversationId);
    expect(intent).not.toBeNull();
  });

  it('completing chess preserves context_summary', async () => {
    await completionService.handleComplete(chessSessionId, 'White wins by checkmate', {
      result: 'checkmate',
      winner: 'white',
      moves: 24,
    });

    const context = await completionService.buildContextWithSummaries(testConversationId);
    expect(context).toContain('White wins by checkmate');
  });

  it('switching to khan app after chess works', async () => {
    const result = await toolRouter.invoke({
      conversationId: testConversationId,
      appSlug: khanSlug,
      toolName: 'open_topic',
      toolParams: { topic: 'Fractions' },
      userId: testUserId,
    });
    expect(result.invocationId).toBeDefined();
    expect(result.sessionId).toBeDefined();
  });

  it('chess context_summary still available after switching to khan', async () => {
    const context = await completionService.buildContextWithSummaries(testConversationId);
    expect(context).toContain('White wins by checkmate');
  });

  it('refuses invocation for non-existent tool', async () => {
    const result = await toolRouter.invoke({
      conversationId: testConversationId,
      appSlug: khanSlug,
      toolName: 'nonexistent_tool',
      toolParams: {},
      userId: testUserId,
    });
    expect(result.error).toBeDefined();
  });
});
