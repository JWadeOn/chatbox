import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { logEvent } from '../lib/logger';
import { appSessions, apps } from '../lib/schema';
import { sanitizeDescription } from '../lib/schema-sanitizer';
import { IntentService } from './intent.service';

export class CompletionService {
  private intentService: IntentService;

  constructor() {
    this.intentService = new IntentService();
  }

  /**
   * Handle app_complete signal from an app iframe.
   * Only processes if the session exists and is 'active'.
   */
  async handleComplete(
    sessionId: string,
    summary: string,
    data: Record<string, unknown>
  ): Promise<{ processed: boolean }> {
    // Look up the session
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, sessionId));

    // Non-existent or non-active session: idempotent no-op
    if (!session || session.status !== 'active') {
      logEvent(
        { event: 'completion_ignored', sessionId },
        { reason: session ? `session status is ${session.status}` : 'session not found' }
      );
      return { processed: false };
    }

    // Update session to completed with context_summary
    const contextSummary = {
      human_summary: sanitizeDescription(summary),
      data,
    };

    await db
      .update(appSessions)
      .set({
        status: 'completed',
        contextSummary,
        updatedAt: new Date(),
      })
      .where(eq(appSessions.id, sessionId));

    // Resolve the active intent for this conversation
    const activeIntent = await this.intentService.getActiveIntent(session.conversationId);
    if (activeIntent) {
      await this.intentService.resolveIntent(activeIntent.id);
    }

    logEvent({ event: 'app_session_completed', sessionId, conversationId: session.conversationId }, { summary });

    return { processed: true };
  }

  /**
   * Handle 60s timeout for a session.
   * Only processes if the session exists and is 'active'.
   */
  async handleTimeout(sessionId: string): Promise<void> {
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, sessionId));

    if (!session || session.status !== 'active') {
      logEvent(
        { event: 'timeout_ignored', sessionId },
        { reason: session ? `session status is ${session.status}` : 'session not found' }
      );
      return;
    }

    // Update session to timeout
    await db
      .update(appSessions)
      .set({
        status: 'timeout',
        updatedAt: new Date(),
      })
      .where(eq(appSessions.id, sessionId));

    // Abandon the active intent for this conversation
    const activeIntent = await this.intentService.getActiveIntent(session.conversationId);
    if (activeIntent) {
      await this.intentService.abandonIntent(activeIntent.id);
    }

    logEvent({ event: 'app_session_timed_out', sessionId, conversationId: session.conversationId });
  }

  /**
   * Build system message for LLM after successful completion.
   */
  buildCompletionMessage(appName: string, summary: string): string {
    return `The ${appName} session has ended. Summary: ${summary}. You can now discuss the results with the user.`;
  }

  /**
   * Build system message for LLM after timeout.
   */
  buildTimeoutMessage(appName: string): string {
    return `The ${appName} session timed out. Apologize to the user and offer to try again.`;
  }

  /**
   * Build context for LLM that includes past app summaries from completed sessions.
   * This replaces full tool history with concise summaries.
   */
  async buildContextWithSummaries(conversationId: string): Promise<string> {
    // Fetch all completed sessions for this conversation, joined with app name
    const completedSessions = await db
      .select({
        contextSummary: appSessions.contextSummary,
        appName: apps.name,
        completedAt: appSessions.updatedAt,
      })
      .from(appSessions)
      .innerJoin(apps, eq(appSessions.appId, apps.id))
      .where(and(eq(appSessions.conversationId, conversationId), eq(appSessions.status, 'completed')));

    // Filter to only completed sessions by checking contextSummary has human_summary
    const summaries = completedSessions
      .filter((s) => {
        const ctx = s.contextSummary as Record<string, unknown> | null;
        return ctx && typeof ctx === 'object' && 'human_summary' in ctx && ctx.human_summary;
      })
      .map((s) => {
        const ctx = s.contextSummary as { human_summary: string; data?: Record<string, unknown> };
        return `[${s.appName}]: ${ctx.human_summary}`;
      });

    if (summaries.length === 0) {
      return '';
    }

    return `Previous app session summaries:\n${summaries.join('\n')}`;
  }
}

export const completionService = new CompletionService();
