import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/lib/db';
import { appSessions, apps, conversations, intents, toolLogs, users } from '../../server/lib/schema';
import { ToolRouter } from '../../server/services/tool-router.service';

let testUserId: string;
let testConversationId: string;
let testAppId: string;
let testAppSlug: string;
let testApp2Id: string;
let testApp2Slug: string;
let router: ToolRouter;

const TEST_EMAIL = `tool-router-test-${Date.now()}@chatbridge-test.local`;
const APP_SLUG_1 = `router-app-1-${Date.now()}`;
const APP_SLUG_2 = `router-app-2-${Date.now()}`;

beforeAll(async () => {
  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      email: TEST_EMAIL,
      passwordHash: 'hashed-password',
      displayName: 'Router Test User',
    })
    .returning();
  testUserId = user.id;

  // Create test conversation
  const [conv] = await db
    .insert(conversations)
    .values({ userId: testUserId, title: 'Router Test Conversation' })
    .returning();
  testConversationId = conv.id;

  // Create test app 1 with tool schemas
  const [app1] = await db
    .insert(apps)
    .values({
      slug: APP_SLUG_1,
      name: 'Router Test App 1',
      description: 'App for tool router tests',
      authType: 'none',
      iframeUrl: 'https://example.com/router-test-1',
      status: 'active',
      toolSchemas: [
        {
          name: 'search',
          description: 'Search for items',
          parameters: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
          },
        },
      ],
    })
    .returning();
  testAppId = app1.id;
  testAppSlug = app1.slug;

  // Create test app 2 (for single-active-app tests)
  const [app2] = await db
    .insert(apps)
    .values({
      slug: APP_SLUG_2,
      name: 'Router Test App 2',
      description: 'Second app for router tests',
      authType: 'none',
      iframeUrl: 'https://example.com/router-test-2',
      status: 'active',
      toolSchemas: [
        {
          name: 'lookup',
          description: 'Look up a record',
          parameters: {
            type: 'object',
            properties: { id: { type: 'string' } },
            required: ['id'],
          },
        },
      ],
    })
    .returning();
  testApp2Id = app2.id;
  testApp2Slug = app2.slug;
});

beforeEach(() => {
  router = new ToolRouter();
});

afterAll(async () => {
  // Clean up in FK order
  await db.delete(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
  await db.delete(appSessions).where(eq(appSessions.conversationId, testConversationId));
  await db.delete(intents).where(eq(intents.conversationId, testConversationId));
  await db.delete(conversations).where(eq(conversations.id, testConversationId));
  await db.delete(apps).where(eq(apps.id, testAppId));
  await db.delete(apps).where(eq(apps.id, testApp2Id));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('ToolRouter.invoke', () => {
  it('valid tool invocation creates tool_log with pending status and returns invocationId + sessionId', async () => {
    const result = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'hello' },
      userId: testUserId,
    });

    expect(result.success).toBe(true);
    expect(result.invocationId).toBeDefined();
    expect(result.sessionId).toBeDefined();

    // Verify tool_log was created with status 'pending'
    const [log] = await db.select().from(toolLogs).where(eq(toolLogs.invocationId, result.invocationId!));

    expect(log).toBeDefined();
    expect(log.status).toBe('pending');
    expect(log.toolName).toBe('search');
    expect(log.params).toEqual({ query: 'hello' });
    expect(log.sessionId).toBe(result.sessionId);
    expect(log.conversationId).toBe(testConversationId);
    expect(log.appId).toBe(testAppId);
  });

  it('non-existent tool (hallucination) returns error result with no tool_log created', async () => {
    const beforeCount = await db.select().from(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
    const countBefore = beforeCount.length;

    const result = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'nonexistent_hallucinated_tool',
      toolParams: {},
      userId: testUserId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');

    // Verify no new tool_log was created
    const afterCount = await db.select().from(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
    expect(afterCount.length).toBe(countBefore);
  });

  it('non-existent app slug returns error result', async () => {
    const result = await router.invoke({
      conversationId: testConversationId,
      appSlug: 'totally-fake-app-slug',
      toolName: 'search',
      toolParams: {},
      userId: testUserId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('not found');
  });

  it('creates an app_session with active status on invoke', async () => {
    const result = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'session test' },
      userId: testUserId,
    });

    expect(result.sessionId).toBeDefined();

    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, result.sessionId!));

    expect(session).toBeDefined();
    expect(session.status).toBe('active');
    expect(session.conversationId).toBe(testConversationId);
    expect(session.appId).toBe(testAppId);
  });

  it('creates an intent via intentService on invoke', async () => {
    await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'intent test' },
      userId: testUserId,
    });

    const [activeIntent] = await db
      .select()
      .from(intents)
      .where(and(eq(intents.conversationId, testConversationId), eq(intents.status, 'active')));

    expect(activeIntent).toBeDefined();
    expect(activeIntent.name).toBe('search');
    expect(activeIntent.appId).toBe(testAppId);
  });
});

describe('ToolRouter.handleResult', () => {
  it('updates tool_log status to success with duration_ms', async () => {
    const invokeResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'result test' },
      userId: testUserId,
    });

    expect(invokeResult.invocationId).toBeDefined();

    // Small delay to have a non-zero duration
    await new Promise((r) => setTimeout(r, 10));

    await router.handleResult(invokeResult.invocationId!, { items: ['a', 'b'] });

    const [log] = await db.select().from(toolLogs).where(eq(toolLogs.invocationId, invokeResult.invocationId!));

    expect(log.status).toBe('success');
    expect(log.result).toEqual({ items: ['a', 'b'] });
    expect(log.durationMs).toBeDefined();
    expect(log.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('records success on the circuit breaker', async () => {
    const invokeResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'breaker success' },
      userId: testUserId,
    });

    await router.handleResult(invokeResult.invocationId!, { ok: true });

    // After success, circuit breaker should be closed (no error on next invoke)
    const nextResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'after success' },
      userId: testUserId,
    });

    expect(nextResult.success).toBe(true);
  });
});

describe('ToolRouter.handleTimeout', () => {
  it('updates tool_log status to timeout', async () => {
    const invokeResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'timeout test' },
      userId: testUserId,
    });

    expect(invokeResult.invocationId).toBeDefined();

    await router.handleTimeout(invokeResult.invocationId!);

    const [log] = await db.select().from(toolLogs).where(eq(toolLogs.invocationId, invokeResult.invocationId!));

    expect(log.status).toBe('timeout');
    expect(log.durationMs).toBeDefined();
  });

  it('abandons the active intent on timeout', async () => {
    const invokeResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'timeout intent test' },
      userId: testUserId,
    });

    // Grab the active intent before timeout
    const [intentBefore] = await db
      .select()
      .from(intents)
      .where(and(eq(intents.conversationId, testConversationId), eq(intents.status, 'active')));
    expect(intentBefore).toBeDefined();

    await router.handleTimeout(invokeResult.invocationId!);

    // After timeout, the intent should be abandoned
    const [intentAfter] = await db.select().from(intents).where(eq(intents.id, intentBefore.id));
    expect(intentAfter.status).toBe('abandoned');
  });

  it('records failure on the circuit breaker', async () => {
    // Create a fresh router so breaker state is clean
    const freshRouter = new ToolRouter();

    // Trigger 3 timeouts to open the breaker
    for (let i = 0; i < 3; i++) {
      const result = await freshRouter.invoke({
        conversationId: testConversationId,
        appSlug: testAppSlug,
        toolName: 'search',
        toolParams: { query: `breaker fail ${i}` },
        userId: testUserId,
      });
      await freshRouter.handleTimeout(result.invocationId!);
    }

    // Next invocation should fail due to open circuit breaker
    const result = await freshRouter.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'after breaker open' },
      userId: testUserId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('circuit breaker');
  });
});

describe('ToolRouter.handleAppComplete', () => {
  it('updates app_session status to completed with context_summary and resolves intent', async () => {
    const invokeResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'complete test' },
      userId: testUserId,
    });

    expect(invokeResult.sessionId).toBeDefined();

    // Grab the active intent
    const [activeIntent] = await db
      .select()
      .from(intents)
      .where(and(eq(intents.conversationId, testConversationId), eq(intents.status, 'active')));
    expect(activeIntent).toBeDefined();

    const summary = {
      app: testAppSlug,
      key_results: { found: 5 },
      human_summary: 'Found 5 matching items',
    };

    await router.handleAppComplete(invokeResult.sessionId!, summary);

    // Session should be completed with context_summary
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, invokeResult.sessionId!));
    expect(session.status).toBe('completed');
    expect(session.contextSummary).toEqual(summary);

    // Intent should be resolved
    const [intentAfter] = await db.select().from(intents).where(eq(intents.id, activeIntent.id));
    expect(intentAfter.status).toBe('resolved');
  });

  it('is idempotent: duplicate handleAppComplete on completed session is ignored', async () => {
    const invokeResult = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'idempotent test' },
      userId: testUserId,
    });

    const summary = {
      app: testAppSlug,
      key_results: { count: 1 },
      human_summary: 'Idempotent test',
    };

    await router.handleAppComplete(invokeResult.sessionId!, summary);

    // Call again - should not throw
    await expect(
      router.handleAppComplete(invokeResult.sessionId!, {
        app: testAppSlug,
        key_results: { count: 999 },
        human_summary: 'Should be ignored',
      })
    ).resolves.not.toThrow();

    // Original summary should remain
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, invokeResult.sessionId!));
    expect(session.contextSummary).toEqual(summary);
  });
});

describe('Single-active-app enforcement', () => {
  it('new invocation with different app terminates previous session', async () => {
    // Start an invocation with app 1
    const result1 = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'first app' },
      userId: testUserId,
    });

    expect(result1.sessionId).toBeDefined();

    // Start an invocation with app 2 (different app)
    const result2 = await router.invoke({
      conversationId: testConversationId,
      appSlug: testApp2Slug,
      toolName: 'lookup',
      toolParams: { id: '123' },
      userId: testUserId,
    });

    expect(result2.sessionId).toBeDefined();
    expect(result2.sessionId).not.toBe(result1.sessionId);

    // Previous session should be completed
    const [session1] = await db.select().from(appSessions).where(eq(appSessions.id, result1.sessionId!));
    expect(session1.status).toBe('completed');

    // New session should be active
    const [session2] = await db.select().from(appSessions).where(eq(appSessions.id, result2.sessionId!));
    expect(session2.status).toBe('active');
  });

  it('same app reuses existing active session', async () => {
    // Start an invocation with app 1
    const result1 = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'reuse session 1' },
      userId: testUserId,
    });

    // Start another invocation with the SAME app
    const result2 = await router.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'reuse session 2' },
      userId: testUserId,
    });

    expect(result1.sessionId).toBe(result2.sessionId);
  });
});

describe('Circuit breaker', () => {
  it('3 failures open the circuit breaker, subsequent invocation returns error', async () => {
    const freshRouter = new ToolRouter();

    for (let i = 0; i < 3; i++) {
      const result = await freshRouter.invoke({
        conversationId: testConversationId,
        appSlug: testAppSlug,
        toolName: 'search',
        toolParams: { query: `circuit fail ${i}` },
        userId: testUserId,
      });
      await freshRouter.handleTimeout(result.invocationId!);
    }

    const result = await freshRouter.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'should be blocked' },
      userId: testUserId,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('circuit breaker');
  });

  it('successful result resets the circuit breaker', async () => {
    const freshRouter = new ToolRouter();

    // 2 failures (not enough to open)
    for (let i = 0; i < 2; i++) {
      const result = await freshRouter.invoke({
        conversationId: testConversationId,
        appSlug: testAppSlug,
        toolName: 'search',
        toolParams: { query: `partial fail ${i}` },
        userId: testUserId,
      });
      await freshRouter.handleTimeout(result.invocationId!);
    }

    // 1 success resets the breaker
    const successResult = await freshRouter.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'reset success' },
      userId: testUserId,
    });
    await freshRouter.handleResult(successResult.invocationId!, { ok: true });

    // 2 more failures should NOT open the breaker (reset happened)
    for (let i = 0; i < 2; i++) {
      const result = await freshRouter.invoke({
        conversationId: testConversationId,
        appSlug: testAppSlug,
        toolName: 'search',
        toolParams: { query: `post-reset fail ${i}` },
        userId: testUserId,
      });
      await freshRouter.handleTimeout(result.invocationId!);
    }

    // Should still work (only 2 failures, not 3)
    const finalResult = await freshRouter.invoke({
      conversationId: testConversationId,
      appSlug: testAppSlug,
      toolName: 'search',
      toolParams: { query: 'still works' },
      userId: testUserId,
    });

    expect(finalResult.success).toBe(true);
  });
});
