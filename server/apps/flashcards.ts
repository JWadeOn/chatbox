import { and, desc, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { studyDecks, studyProgress } from '../lib/schema';

type Card = { front: string; back: string };

type SessionStudySnapshot = {
  deckTitle: string;
  deckId: string;
  cardCount: number;
  lastCardIndex: number;
};

export class FlashcardsToolHandler {
  private sessionStudy = new Map<string, SessionStudySnapshot>();
  async handleToolInvoke(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>,
    userId: string
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      case 'create_deck':
        return this.createDeck(userId, params);
      case 'load_deck':
        return this.loadDeck(userId, sessionId, params);
      case 'answer_card':
        return this.answerCard(userId, sessionId, params);
      case 'get_progress':
        return this.getProgress(userId, params);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private async createDeck(userId: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const title = params.title as string | undefined;
    if (!title) {
      return { error: 'Missing required parameter: title' };
    }

    const cards = params.cards as Card[] | undefined;
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return { error: 'Missing or empty required parameter: cards' };
    }

    for (let i = 0; i < cards.length; i++) {
      if (!cards[i].front || !cards[i].back) {
        return { error: `Card at index ${i} must have both front and back text` };
      }
    }

    const [deck] = await db
      .insert(studyDecks)
      .values({
        userId,
        title,
        description: (params.description as string) || null,
        cards,
        cardCount: cards.length,
      })
      .returning();

    return {
      deck: { id: deck.id, title: deck.title, cardCount: deck.cardCount },
      status: 'created',
    };
  }

  private async loadDeck(
    userId: string,
    appSessionId: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const deckId = params.deckId as string | undefined;
    if (!deckId) {
      return { error: 'Missing required parameter: deckId' };
    }

    const [deck] = await db
      .select()
      .from(studyDecks)
      .where(and(eq(studyDecks.id, deckId), eq(studyDecks.userId, userId)))
      .limit(1);

    if (!deck) {
      return { error: 'Deck not found or access denied' };
    }

    const cards = deck.cards as Card[];
    this.sessionStudy.set(appSessionId, {
      deckTitle: deck.title,
      deckId: deck.id,
      cardCount: cards.length,
      lastCardIndex: 0,
    });

    return {
      deck: {
        id: deck.id,
        title: deck.title,
        description: deck.description,
        cards: deck.cards,
        cardCount: deck.cardCount,
      },
      currentCard: 0,
    };
  }

  buildAssistantContext(sessionId: string): string {
    const snap = this.sessionStudy.get(sessionId);
    if (!snap) {
      return '';
    }
    return `\n\n## Active App Context\nFlashcards: studying deck "${snap.deckTitle}" (${snap.lastCardIndex + 1} of ${snap.cardCount} cards touched this session).`;
  }

  private async answerCard(
    userId: string,
    sessionId: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const deckId = params.deckId as string | undefined;
    if (!deckId) {
      return { error: 'Missing required parameter: deckId' };
    }

    const cardIndex = params.cardIndex as number | undefined;
    if (cardIndex === undefined || cardIndex === null) {
      return { error: 'Missing required parameter: cardIndex' };
    }

    const answer = params.answer as string | undefined;
    if (!answer) {
      return { error: 'Missing required parameter: answer' };
    }

    const [deck] = await db
      .select()
      .from(studyDecks)
      .where(and(eq(studyDecks.id, deckId), eq(studyDecks.userId, userId)))
      .limit(1);

    if (!deck) {
      return { error: 'Deck not found or access denied' };
    }

    const cards = deck.cards as Card[];
    if (cardIndex < 0 || cardIndex >= cards.length) {
      return { error: `Card index ${cardIndex} out of range (0-${cards.length - 1})` };
    }

    const expected = cards[cardIndex].back;
    const correct = answer.trim().toLowerCase() === expected.trim().toLowerCase();

    // Upsert progress for this session
    const [existing] = await db
      .select()
      .from(studyProgress)
      .where(
        and(eq(studyProgress.userId, userId), eq(studyProgress.deckId, deckId), eq(studyProgress.sessionId, sessionId))
      )
      .limit(1);

    if (existing) {
      await db
        .update(studyProgress)
        .set({
          cardsSeen: existing.cardsSeen + 1,
          cardsCorrect: existing.cardsCorrect + (correct ? 1 : 0),
        })
        .where(eq(studyProgress.id, existing.id));
    } else {
      await db.insert(studyProgress).values({
        userId,
        deckId,
        sessionId,
        cardsSeen: 1,
        cardsCorrect: correct ? 1 : 0,
      });
    }

    const nextCard = cardIndex + 1 < cards.length ? cardIndex + 1 : null;

    const snap = this.sessionStudy.get(sessionId);
    if (snap && snap.deckId === deckId) {
      const idx = nextCard !== null ? nextCard : cardIndex;
      this.sessionStudy.set(sessionId, { ...snap, lastCardIndex: idx });
    }

    return {
      correct,
      expected,
      cardIndex,
      nextCard,
    };
  }

  private async getProgress(userId: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const deckId = params.deckId as string | undefined;
    if (!deckId) {
      return { error: 'Missing required parameter: deckId' };
    }

    const records = await db
      .select()
      .from(studyProgress)
      .where(and(eq(studyProgress.userId, userId), eq(studyProgress.deckId, deckId)))
      .orderBy(desc(studyProgress.createdAt))
      .limit(10);

    return {
      deckId,
      sessions: records.map((r) => ({
        cardsSeen: r.cardsSeen,
        cardsCorrect: r.cardsCorrect,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
      })),
    };
  }
}
