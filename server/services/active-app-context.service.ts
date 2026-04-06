import { and, eq } from 'drizzle-orm';
import type { ChessToolHandler } from '../apps/chess';
import type { FirstPrinciplesToolHandler } from '../apps/firstprinciples';
import type { FlashcardsToolHandler } from '../apps/flashcards';
import type { KhanToolHandler } from '../apps/khan';
import { db } from '../lib/db';
import { appSessions, apps } from '../lib/schema';

type Handlers = {
  chess: ChessToolHandler;
  khan: KhanToolHandler;
  flashcards: FlashcardsToolHandler;
  firstprinciples: FirstPrinciplesToolHandler;
};

/**
 * Builds mid-app assistance context from the active `app_sessions` row and per-app handler state.
 */
export async function buildActiveAppContextForConversation(
  conversationId: string,
  handlers: Handlers
): Promise<string> {
  const [session] = await db
    .select({ id: appSessions.id, appId: appSessions.appId })
    .from(appSessions)
    .where(and(eq(appSessions.conversationId, conversationId), eq(appSessions.status, 'active')))
    .limit(1);

  if (!session) {
    return '';
  }

  const [appRow] = await db.select({ slug: apps.slug }).from(apps).where(eq(apps.id, session.appId)).limit(1);

  if (!appRow) {
    return '';
  }

  const sessionId = session.id;
  const slug = appRow.slug;

  switch (slug) {
    case 'chess':
      return handlers.chess.buildAssistantContext(sessionId);
    case 'khan':
      return handlers.khan.buildAssistantContext(sessionId);
    case 'flashcards':
      return handlers.flashcards.buildAssistantContext(sessionId);
    case 'firstprinciples':
      return handlers.firstprinciples.buildAssistantContext(sessionId);
    default:
      return '';
  }
}
