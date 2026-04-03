import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../server/lib/db';
import { appSessions, apps, conversations, intents, toolLogs, users } from '../../server/lib/schema';
import { CompletionService } from '../../server/services/completion.service';

let testUserId: string;
let testConversationId: string;
let testAppId: string;
let _testAppName: string;
let activeSessionId: string;
let completionService: CompletionService;

const TEST_EMAIL = `completion-test-${Date.now()}@chatbridge-test.local`;
const APP_SLUG = `completion-app-${Date.now()}`;

beforeAll(async () => {
  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      email: TEST_EMAIL,
      passwordHash: 'hashed-password',
      displayName: 'Completion Test User',
    })
    .returning();
  testUserId = user.id;

  // Create test conversation
  const [conv] = await db
    .insert(conversations)
    .values({ userId: testUserId, title: 'Completion Test Conversation' })
    .returning();
  testConversationId = conv.id;

  // Create test app
  const [app] = await db
    .insert(apps)
    .values({
      slug: APP_SLUG,
      name: 'Completion Test App',
      description: 'App for completion service tests',
      authType: 'none',
      iframeUrl: 'https://example.com/completion-test',
      status: 'active',
      toolSchemas: [],
    })
    .returning();
  testAppId = app.id;
  _testAppName = app.name;
});

beforeEach(async () => {
  completionService = new CompletionService();

  // Clean up sessions and intents from previous tests
  await db.delete(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
  await db.delete(appSessions).where(eq(appSessions.conversationId, testConversationId));
  await db.delete(intents).where(eq(intents.conversationId, testConversationId));

  // Create a fresh active session for each test
  const [session] = await db
    .insert(appSessions)
    .values({
      conversationId: testConversationId,
      appId: testAppId,
      status: 'active',
    })
    .returning();
  activeSessionId = session.id;
});

afterAll(async () => {
  // Clean up in FK order
  await db.delete(toolLogs).where(eq(toolLogs.conversationId, testConversationId));
  await db.delete(appSessions).where(eq(appSessions.conversationId, testConversationId));
  await db.delete(intents).where(eq(intents.conversationId, testConversationId));
  await db.delete(conversations).where(eq(conversations.id, testConversationId));
  await db.delete(apps).where(eq(apps.id, testAppId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('CompletionService.handleComplete', () => {
  it('app_complete on active session sets status to completed, persists context_summary, and resolves intent', async () => {
    // Create an active intent for this conversation
    const [intent] = await db
      .insert(intents)
      .values({
        conversationId: testConversationId,
        name: 'test_tool',
        confidence: 1.0,
        appId: testAppId,
        status: 'active',
      })
      .returning();

    const summary = 'User completed the quiz with 80% accuracy';
    const data = { score: 80, total: 100 };

    const result = await completionService.handleComplete(activeSessionId, summary, data);

    expect(result.processed).toBe(true);

    // Session should be completed with context_summary
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(session.status).toBe('completed');
    expect(session.contextSummary).toEqual({
      human_summary: summary,
      data,
    });

    // Intent should be resolved
    const [updatedIntent] = await db.select().from(intents).where(eq(intents.id, intent.id));
    expect(updatedIntent.status).toBe('resolved');
  });

  it('app_complete on already-completed session is ignored and returns processed: false', async () => {
    // First, complete the session
    await completionService.handleComplete(activeSessionId, 'First completion', { a: 1 });

    // Verify it was completed
    const [sessionBefore] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(sessionBefore.status).toBe('completed');
    const originalSummary = sessionBefore.contextSummary;

    // Try to complete again
    const result = await completionService.handleComplete(activeSessionId, 'Second completion', { b: 2 });

    expect(result.processed).toBe(false);

    // Original summary should remain unchanged
    const [sessionAfter] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(sessionAfter.contextSummary).toEqual(originalSummary);
  });

  it('app_complete on non-existent session is ignored and returns processed: false', async () => {
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';

    const result = await completionService.handleComplete(fakeSessionId, 'Should be ignored', {});

    expect(result.processed).toBe(false);
  });

  it('duplicate app_complete on non-active session is idempotent and throws no error', async () => {
    // Complete the session
    await completionService.handleComplete(activeSessionId, 'Done', {});

    // Call again multiple times - should not throw
    await expect(completionService.handleComplete(activeSessionId, 'Again', { x: 1 })).resolves.not.toThrow();

    await expect(completionService.handleComplete(activeSessionId, 'Yet again', { y: 2 })).resolves.not.toThrow();

    // All should return processed: false
    const result = await completionService.handleComplete(activeSessionId, 'Once more', {});
    expect(result.processed).toBe(false);
  });
});

describe('CompletionService.handleTimeout', () => {
  it('60s timeout sets session status to timeout and abandons intent', async () => {
    // Create an active intent
    const [intent] = await db
      .insert(intents)
      .values({
        conversationId: testConversationId,
        name: 'timeout_tool',
        confidence: 1.0,
        appId: testAppId,
        status: 'active',
      })
      .returning();

    await completionService.handleTimeout(activeSessionId);

    // Session should be timed out
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(session.status).toBe('timeout');

    // Intent should be abandoned
    const [updatedIntent] = await db.select().from(intents).where(eq(intents.id, intent.id));
    expect(updatedIntent.status).toBe('abandoned');
  });

  it('timeout on non-existent session does not throw', async () => {
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';

    await expect(completionService.handleTimeout(fakeSessionId)).resolves.not.toThrow();
  });

  it('timeout on already-completed session does not change status', async () => {
    // Complete the session first
    await completionService.handleComplete(activeSessionId, 'Already done', {});

    const [sessionBefore] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(sessionBefore.status).toBe('completed');

    // Timeout should be a no-op
    await completionService.handleTimeout(activeSessionId);

    const [sessionAfter] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(sessionAfter.status).toBe('completed');
  });
});

describe('CompletionService.buildCompletionMessage', () => {
  it('returns the correct completion message format', () => {
    const message = completionService.buildCompletionMessage('MathQuiz', 'Student scored 90%');

    expect(message).toBe(
      'The MathQuiz session has ended. Summary: Student scored 90%. You can now discuss the results with the user.'
    );
  });
});

describe('CompletionService.buildTimeoutMessage', () => {
  it('returns the correct timeout message format', () => {
    const message = completionService.buildTimeoutMessage('MathQuiz');

    expect(message).toBe('The MathQuiz session timed out. Apologize to the user and offer to try again.');
  });
});

describe('CompletionService.buildContextWithSummaries', () => {
  it('includes human_summary from all completed sessions in the conversation', async () => {
    // Complete the active session
    await completionService.handleComplete(activeSessionId, 'First session result', { score: 85 });

    // Create and complete a second session
    const [session2] = await db
      .insert(appSessions)
      .values({
        conversationId: testConversationId,
        appId: testAppId,
        status: 'active',
      })
      .returning();

    await completionService.handleComplete(session2.id, 'Second session result', { score: 92 });

    const context = await completionService.buildContextWithSummaries(testConversationId);

    expect(context).toContain('First session result');
    expect(context).toContain('Second session result');
  });

  it('returns empty context when no completed sessions exist', async () => {
    // Don't complete any sessions - the active one is still active
    const context = await completionService.buildContextWithSummaries(testConversationId);

    // Should not contain any summaries, could be empty or a header-only message
    expect(context).not.toContain('First session result');
  });

  it('does not include summaries from non-completed sessions', async () => {
    // Set the active session to timeout (not completed)
    await db
      .update(appSessions)
      .set({ status: 'timeout', contextSummary: { human_summary: 'Should not appear' } })
      .where(eq(appSessions.id, activeSessionId));

    const context = await completionService.buildContextWithSummaries(testConversationId);

    expect(context).not.toContain('Should not appear');
  });
});

describe('CompletionService context_summary availability', () => {
  it('after completion, context_summary is available for LLM follow-up questions', async () => {
    const summary = 'Student answered 8 out of 10 questions correctly on fractions';
    const data = { correct: 8, total: 10, topic: 'fractions' };

    await completionService.handleComplete(activeSessionId, summary, data);

    // Verify context_summary is persisted and retrievable
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, activeSessionId));
    expect(session.contextSummary).toBeDefined();

    const contextSummary = session.contextSummary as { human_summary: string; data: Record<string, unknown> };
    expect(contextSummary.human_summary).toBe(summary);
    expect(contextSummary.data).toEqual(data);

    // buildContextWithSummaries should include this summary
    const context = await completionService.buildContextWithSummaries(testConversationId);
    expect(context).toContain(summary);
  });
});
