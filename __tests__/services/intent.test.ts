import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '../../server/lib/db';
import { apps, conversations, intents, users } from '../../server/lib/schema';
import { IntentService } from '../../server/services/intent.service';

const intentService = new IntentService();

let testUserId: string;
let testConversationId: string;
let testConversation2Id: string;
let testAppId: string;

beforeAll(async () => {
  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      email: `intent-test-${Date.now()}@chatbridge-test.local`,
      passwordHash: 'hashed-password',
      displayName: 'Intent Test User',
    })
    .returning();
  testUserId = user.id;

  // Create test conversations
  const [conv1] = await db
    .insert(conversations)
    .values({ userId: testUserId, title: 'Intent Test Conversation 1' })
    .returning();
  testConversationId = conv1.id;

  const [conv2] = await db
    .insert(conversations)
    .values({ userId: testUserId, title: 'Intent Test Conversation 2' })
    .returning();
  testConversation2Id = conv2.id;

  // Create test app
  const [app] = await db
    .insert(apps)
    .values({
      slug: `intent-test-app-${Date.now()}`,
      name: 'Intent Test App',
      description: 'App for intent service tests',
      authType: 'none',
      iframeUrl: 'https://example.com/intent-test',
    })
    .returning();
  testAppId = app.id;
});

afterAll(async () => {
  // Clean up in FK order
  await db.delete(intents).where(eq(intents.conversationId, testConversationId));
  await db.delete(intents).where(eq(intents.conversationId, testConversation2Id));
  await db.delete(conversations).where(eq(conversations.id, testConversationId));
  await db.delete(conversations).where(eq(conversations.id, testConversation2Id));
  await db.delete(apps).where(eq(apps.id, testAppId));
  await db.delete(users).where(eq(users.id, testUserId));
});

describe('IntentService', () => {
  it('createIntent returns a row with correct name, appId, and status=active', async () => {
    const intent = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'search_web',
      confidence: 0.95,
      appId: testAppId,
    });

    expect(intent).toBeDefined();
    expect(intent.id).toBeDefined();
    expect(intent.name).toBe('search_web');
    expect(intent.confidence).toBeCloseTo(0.95);
    expect(intent.appId).toBe(testAppId);
    expect(intent.status).toBe('active');
    expect(intent.conversationId).toBe(testConversationId);
    expect(intent.createdAt).toBeInstanceOf(Date);
  });

  it('creating a new intent auto-resolves the previous active intent', async () => {
    const first = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'first_intent',
      confidence: 0.8,
      appId: null,
    });

    const second = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'second_intent',
      confidence: 0.9,
      appId: null,
    });

    // Fetch the first intent from DB to verify it was resolved
    const [updatedFirst] = await db.select().from(intents).where(eq(intents.id, first.id));

    expect(updatedFirst.status).toBe('resolved');
    expect(updatedFirst.resolvedAt).toBeInstanceOf(Date);
    expect(second.status).toBe('active');
  });

  it('only one active intent per conversation at a time', async () => {
    // Create three intents in sequence
    await intentService.createIntent({
      conversationId: testConversationId,
      name: 'intent_a',
      confidence: 0.7,
      appId: null,
    });
    await intentService.createIntent({
      conversationId: testConversationId,
      name: 'intent_b',
      confidence: 0.8,
      appId: null,
    });
    const latest = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'intent_c',
      confidence: 0.9,
      appId: null,
    });

    // Query all active intents for this conversation
    const activeIntents = await db
      .select()
      .from(intents)
      .where(eq(intents.conversationId, testConversationId))
      .then((rows) => rows.filter((r) => r.status === 'active'));

    expect(activeIntents).toHaveLength(1);
    expect(activeIntents[0].id).toBe(latest.id);
  });

  it('getActiveIntent returns the current active intent', async () => {
    const created = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'active_lookup',
      confidence: 0.85,
      appId: testAppId,
    });

    const active = await intentService.getActiveIntent(testConversationId);

    expect(active).not.toBeNull();
    expect(active?.id).toBe(created.id);
    expect(active?.name).toBe('active_lookup');
    expect(active?.status).toBe('active');
  });

  it('getActiveIntent returns null when no active intent exists', async () => {
    // Resolve all intents for conversation 2 (there are none yet, so should be null)
    const active = await intentService.getActiveIntent(testConversation2Id);
    expect(active).toBeNull();
  });

  it('resolveIntent sets status to resolved and resolved_at', async () => {
    const intent = await intentService.createIntent({
      conversationId: testConversation2Id,
      name: 'to_resolve',
      confidence: 0.75,
      appId: null,
    });

    await intentService.resolveIntent(intent.id);

    const [updated] = await db.select().from(intents).where(eq(intents.id, intent.id));

    expect(updated.status).toBe('resolved');
    expect(updated.resolvedAt).toBeInstanceOf(Date);
  });

  it('abandonIntent sets status to abandoned and resolved_at', async () => {
    const intent = await intentService.createIntent({
      conversationId: testConversation2Id,
      name: 'to_abandon',
      confidence: 0.6,
      appId: null,
    });

    await intentService.abandonIntent(intent.id);

    const [updated] = await db.select().from(intents).where(eq(intents.id, intent.id));

    expect(updated.status).toBe('abandoned');
    expect(updated.resolvedAt).toBeInstanceOf(Date);
  });

  it('intent with no app has appId = null', async () => {
    const intent = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'no_app_intent',
      confidence: 1.0,
      appId: null,
    });

    expect(intent.appId).toBeNull();

    const [fromDb] = await db.select().from(intents).where(eq(intents.id, intent.id));
    expect(fromDb.appId).toBeNull();
  });

  it('different conversations do not affect each other', async () => {
    // Create active intent in conversation 1
    const intent1 = await intentService.createIntent({
      conversationId: testConversationId,
      name: 'conv1_intent',
      confidence: 0.9,
      appId: null,
    });

    // Create active intent in conversation 2
    const intent2 = await intentService.createIntent({
      conversationId: testConversation2Id,
      name: 'conv2_intent',
      confidence: 0.85,
      appId: null,
    });

    // Both should still be active
    const active1 = await intentService.getActiveIntent(testConversationId);
    const active2 = await intentService.getActiveIntent(testConversation2Id);

    expect(active1).not.toBeNull();
    expect(active1?.id).toBe(intent1.id);
    expect(active1?.status).toBe('active');

    expect(active2).not.toBeNull();
    expect(active2?.id).toBe(intent2.id);
    expect(active2?.status).toBe('active');

    // Resolving in one conversation doesn't affect the other
    await intentService.resolveIntent(intent1.id);

    const stillActive2 = await intentService.getActiveIntent(testConversation2Id);
    expect(stillActive2).not.toBeNull();
    expect(stillActive2?.id).toBe(intent2.id);

    const nowNull1 = await intentService.getActiveIntent(testConversationId);
    expect(nowNull1).toBeNull();
  });
});
