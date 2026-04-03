import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
let weatherAppId: string;

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

  const weatherApp = await appService.register({
    slug: `weather-multiapp-${Date.now()}`,
    name: 'Weather',
    description: 'Weather info',
    authType: 'none',
    iframeUrl: 'https://weather.example.com',
    toolSchemas: [{ name: 'get_weather', description: 'Get weather for a location', parameters: {} }],
  });
  weatherAppId = weatherApp.id;
});

afterAll(async () => {
  await db.delete(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
  await db.delete(intents).where(eq(intents.conversationId, testConversationId));
  await db.delete(appSessions).where(eq(appSessions.conversationId, testConversationId));
  await db.delete(conversations).where(eq(conversations.id, testConversationId));
  await db.delete(apps).where(eq(apps.id, chessAppId));
  await db.delete(apps).where(eq(apps.id, weatherAppId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('Multi-app switching', () => {
  let chessSessionId: string;

  it('invokes chess app and creates active session', async () => {
    const result = await toolRouter.invoke({
      conversationId: testConversationId,
      appSlug:
        (await appService.getAppBySlug(`chess-multiapp-${chessAppId.slice(0, 8)}`))?.slug ||
        (await db.select().from(apps).where(eq(apps.id, chessAppId)).limit(1))[0].slug,
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

  it('switching to weather app after chess works', async () => {
    const [weatherApp] = await db.select().from(apps).where(eq(apps.id, weatherAppId)).limit(1);
    const result = await toolRouter.invoke({
      conversationId: testConversationId,
      appSlug: weatherApp.slug,
      toolName: 'get_weather',
      toolParams: { location: 'Austin' },
      userId: testUserId,
    });
    expect(result.invocationId).toBeDefined();
    expect(result.sessionId).toBeDefined();
  });

  it('chess context_summary still available after switching to weather', async () => {
    const context = await completionService.buildContextWithSummaries(testConversationId);
    expect(context).toContain('White wins by checkmate');
  });

  it('refuses invocation for non-existent tool', async () => {
    const [weatherApp] = await db.select().from(apps).where(eq(apps.id, weatherAppId)).limit(1);
    const result = await toolRouter.invoke({
      conversationId: testConversationId,
      appSlug: weatherApp.slug,
      toolName: 'nonexistent_tool',
      toolParams: {},
      userId: testUserId,
    });
    expect(result.error).toBeDefined();
  });
});
