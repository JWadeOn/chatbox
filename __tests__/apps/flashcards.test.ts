import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FlashcardsToolHandler } from '../../server/apps/flashcards';
import { db } from '../../server/lib/db';
import { appSessions, apps, conversations, studyDecks, studyProgress, users } from '../../server/lib/schema';

const handler = new FlashcardsToolHandler();

let testUserId: string;
let otherUserId: string;
let testConversationId: string;
let testSessionId: string;

beforeAll(async () => {
  const [user] = await db
    .insert(users)
    .values({ email: `flashcards-test-${Date.now()}@test.com`, passwordHash: 'hash', displayName: 'FC Tester' })
    .returning();
  testUserId = user.id;

  const [other] = await db
    .insert(users)
    .values({ email: `flashcards-other-${Date.now()}@test.com`, passwordHash: 'hash', displayName: 'Other User' })
    .returning();
  otherUserId = other.id;

  const [conv] = await db.insert(conversations).values({ userId: testUserId, title: 'Flashcards Test' }).returning();
  testConversationId = conv.id;

  // Create a minimal app entry for FK references
  const [app] = await db
    .insert(apps)
    .values({
      slug: `fc-test-${Date.now()}`,
      name: 'Flashcards Test',
      description: 'Test app',
      authType: 'none',
      iframeUrl: '/apps/flashcards',
      status: 'active',
      approvalStatus: 'approved',
      toolSchemas: [],
    })
    .returning();

  const [session] = await db
    .insert(appSessions)
    .values({ conversationId: testConversationId, appId: app.id })
    .returning();
  testSessionId = session.id;
});

afterAll(async () => {
  await db.delete(studyProgress).where(eq(studyProgress.userId, testUserId));
  await db.delete(studyDecks).where(eq(studyDecks.userId, testUserId));
  await db.delete(studyDecks).where(eq(studyDecks.userId, otherUserId));
  await db.delete(appSessions).where(eq(appSessions.conversationId, testConversationId));
  await db.delete(conversations).where(eq(conversations.id, testConversationId));
  await db.delete(users).where(eq(users.id, testUserId));
  await db.delete(users).where(eq(users.id, otherUserId));
});

describe('FlashcardsToolHandler', () => {
  let createdDeckId: string;

  describe('create_deck', () => {
    it('creates a deck and returns it', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'create_deck',
        {
          title: 'Biology Terms',
          cards: [
            { front: 'Mitosis', back: 'Cell division producing two identical cells' },
            { front: 'Meiosis', back: 'Cell division producing four genetically different cells' },
          ],
        },
        testUserId
      );

      expect(result.status).toBe('created');
      const deck = result.deck as { id: string; title: string; cardCount: number };
      expect(deck.title).toBe('Biology Terms');
      expect(deck.cardCount).toBe(2);
      createdDeckId = deck.id;
    });

    it('returns error when title is missing', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'create_deck',
        {
          cards: [{ front: 'a', back: 'b' }],
        },
        testUserId
      );
      expect(result.error).toContain('title');
    });

    it('returns error when cards is empty', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'create_deck',
        {
          title: 'Empty',
          cards: [],
        },
        testUserId
      );
      expect(result.error).toContain('cards');
    });

    it('returns error when cards is missing', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'create_deck',
        {
          title: 'No Cards',
        },
        testUserId
      );
      expect(result.error).toContain('cards');
    });
  });

  describe('load_deck', () => {
    it('loads a deck belonging to the user', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'load_deck',
        {
          deckId: createdDeckId,
        },
        testUserId
      );

      const deck = result.deck as { id: string; title: string; cards: unknown[]; cardCount: number };
      expect(deck.id).toBe(createdDeckId);
      expect(deck.title).toBe('Biology Terms');
      expect(deck.cards).toHaveLength(2);
      expect(result.currentCard).toBe(0);
    });

    it('returns error for non-existent deck', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'load_deck',
        {
          deckId: '00000000-0000-0000-0000-000000000000',
        },
        testUserId
      );
      expect(result.error).toContain('not found');
    });

    it('returns error for deck belonging to another user', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'load_deck',
        {
          deckId: createdDeckId,
        },
        otherUserId
      );
      expect(result.error).toContain('not found');
    });

    it('returns error when deckId is missing', async () => {
      const result = await handler.handleToolInvoke(testSessionId, 'load_deck', {}, testUserId);
      expect(result.error).toContain('deckId');
    });
  });

  describe('answer_card', () => {
    it('returns correct for matching answer', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'answer_card',
        {
          deckId: createdDeckId,
          cardIndex: 0,
          answer: 'Cell division producing two identical cells',
        },
        testUserId
      );

      expect(result.correct).toBe(true);
      expect(result.cardIndex).toBe(0);
      expect(result.nextCard).toBe(1);
    });

    it('returns incorrect for wrong answer', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'answer_card',
        {
          deckId: createdDeckId,
          cardIndex: 0,
          answer: 'wrong answer',
        },
        testUserId
      );

      expect(result.correct).toBe(false);
      expect(result.expected).toBe('Cell division producing two identical cells');
    });

    it('returns null nextCard on last card', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'answer_card',
        {
          deckId: createdDeckId,
          cardIndex: 1,
          answer: 'whatever',
        },
        testUserId
      );

      expect(result.nextCard).toBeNull();
    });

    it('returns error for out of range cardIndex', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'answer_card',
        {
          deckId: createdDeckId,
          cardIndex: 99,
          answer: 'test',
        },
        testUserId
      );
      expect(result.error).toContain('out of range');
    });

    it('returns error when deckId is missing', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'answer_card',
        {
          cardIndex: 0,
          answer: 'test',
        },
        testUserId
      );
      expect(result.error).toContain('deckId');
    });
  });

  describe('get_progress', () => {
    it('returns progress records after answering cards', async () => {
      const result = await handler.handleToolInvoke(
        testSessionId,
        'get_progress',
        {
          deckId: createdDeckId,
        },
        testUserId
      );

      expect(result.deckId).toBe(createdDeckId);
      const sessions = result.sessions as { cardsSeen: number; cardsCorrect: number }[];
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].cardsSeen).toBeGreaterThan(0);
    });

    it('returns error when deckId is missing', async () => {
      const result = await handler.handleToolInvoke(testSessionId, 'get_progress', {}, testUserId);
      expect(result.error).toContain('deckId');
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const result = await handler.handleToolInvoke(testSessionId, 'delete_deck', {}, testUserId);
      expect(result.error).toBe('Unknown tool: delete_deck');
    });
  });
});
