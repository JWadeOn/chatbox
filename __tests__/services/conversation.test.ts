import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, pool } from '../../server/lib/db';
import { conversations, messages, users } from '../../server/lib/schema';
import { ConversationService } from '../../server/services/conversation.service';

const service = new ConversationService();
let testUserId: string;
let testUser2Id: string;
let createdConversationId: string;

beforeAll(async () => {
  const [user1] = await db
    .insert(users)
    .values({ email: `conv-test-${Date.now()}@test.com`, passwordHash: 'hash', displayName: 'Conv Tester' })
    .returning();
  testUserId = user1.id;

  const [user2] = await db
    .insert(users)
    .values({ email: `conv-test2-${Date.now()}@test.com`, passwordHash: 'hash', displayName: 'Conv Tester 2' })
    .returning();
  testUser2Id = user2.id;
});

afterAll(async () => {
  await db.delete(messages);
  await db.delete(conversations);
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, testUser2Id));
  await pool.end();
});

describe('ConversationService.create', () => {
  it('creates a conversation and returns it', async () => {
    const conv = await service.create(testUserId, 'Test Chat');
    expect(conv.id).toBeDefined();
    expect(conv.userId).toBe(testUserId);
    expect(conv.title).toBe('Test Chat');
    createdConversationId = conv.id;
  });

  it('creates a conversation without title', async () => {
    const conv = await service.create(testUserId);
    expect(conv.title).toBeNull();
  });
});

describe('ConversationService.list', () => {
  it('returns only conversations for the given user', async () => {
    const list = await service.list(testUserId);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const c of list) {
      expect(c.userId).toBe(testUserId);
    }
  });

  it('returns empty for user with no conversations', async () => {
    const list = await service.list(testUser2Id);
    expect(list).toEqual([]);
  });

  it('orders by updatedAt descending', async () => {
    const list = await service.list(testUserId);
    for (let i = 1; i < list.length; i++) {
      expect(new Date(list[i - 1].updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(list[i].updatedAt).getTime());
    }
  });
});

describe('ConversationService.get', () => {
  it('returns conversation with messages', async () => {
    await service.addMessage(createdConversationId, 'user', 'Hello');
    await service.addMessage(createdConversationId, 'assistant', 'Hi there!');

    const result = await service.get(createdConversationId, testUserId);
    expect(result).not.toBeNull();
    expect(result?.id).toBe(createdConversationId);
    expect(result?.messages).toHaveLength(2);
    expect(result?.messages[0].role).toBe('user');
    expect(result?.messages[1].role).toBe('assistant');
  });

  it('returns null for other users conversation', async () => {
    const result = await service.get(createdConversationId, testUser2Id);
    expect(result).toBeNull();
  });

  it('returns null for non-existent id', async () => {
    const result = await service.get('00000000-0000-0000-0000-000000000000', testUserId);
    expect(result).toBeNull();
  });
});

describe('ConversationService.delete', () => {
  it('deletes a conversation owned by user', async () => {
    const conv = await service.create(testUserId, 'To Delete');
    const deleted = await service.delete(conv.id, testUserId);
    expect(deleted).toBe(true);

    const result = await service.get(conv.id, testUserId);
    expect(result).toBeNull();
  });

  it('returns false when deleting other users conversation', async () => {
    const deleted = await service.delete(createdConversationId, testUser2Id);
    expect(deleted).toBe(false);
  });
});

describe('ConversationService.addMessage', () => {
  it('adds a message and updates conversation updatedAt', async () => {
    const before = await service.get(createdConversationId, testUserId);
    const beforeTime = new Date(before?.updatedAt).getTime();

    await new Promise((r) => setTimeout(r, 10));
    const msg = await service.addMessage(createdConversationId, 'user', 'New message');
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('New message');

    const after = await service.get(createdConversationId, testUserId);
    expect(new Date(after?.updatedAt).getTime()).toBeGreaterThan(beforeTime);
  });
});
