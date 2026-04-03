import { and, eq } from 'drizzle-orm';
import { CircuitBreaker } from '../lib/circuit-breaker';
import { db } from '../lib/db';
import { logEvent } from '../lib/logger';
import { appSessions, toolLogs } from '../lib/schema';
import { IntentService } from './intent.service';
import { ToolService } from './tool.service';

export type ContextSummary = {
  app: string;
  key_results: Record<string, unknown>;
  human_summary: string;
};

export type ToolResult = {
  success: boolean;
  invocationId?: string;
  sessionId?: string;
  error?: string;
};

export class ToolRouter {
  private toolService: ToolService;
  private intentService: IntentService;
  private circuitBreaker: CircuitBreaker;
  private invocationTimestamps: Map<string, number> = new Map();

  constructor() {
    this.toolService = new ToolService();
    this.intentService = new IntentService();
    this.circuitBreaker = new CircuitBreaker();
  }

  async invoke(params: {
    conversationId: string;
    appSlug: string;
    toolName: string;
    toolParams: Record<string, unknown>;
    userId: string;
  }): Promise<ToolResult> {
    const { conversationId, appSlug, toolName, toolParams, userId } = params;

    // Check circuit breaker
    if (this.circuitBreaker.isOpen()) {
      logEvent({ event: 'tool_invoke_blocked', conversationId, userId }, { reason: 'circuit breaker open' });
      return {
        success: false,
        error: 'Tool invocation blocked: circuit breaker is open. Please try again later.',
      };
    }

    // Validate tool exists via discoverTools
    const tools = await this.toolService.discoverTools();
    const tool = tools.find((t) => t.appSlug === appSlug && t.toolName === toolName);

    if (!tool) {
      logEvent(
        { event: 'tool_not_found', conversationId, userId },
        { appSlug, toolName, reason: 'hallucinated or non-existent tool' }
      );
      return {
        success: false,
        error: `Tool "${appSlug}__${toolName}" not found. The tool may not exist or the app is inactive.`,
      };
    }

    // Enforce single-active-app: terminate previous session if different app
    const sessionId = await this.ensureSession(conversationId, tool.appId);

    // Create intent
    await this.intentService.createIntent({
      conversationId,
      name: toolName,
      confidence: 1.0,
      appId: tool.appId,
    });

    // Create tool_log entry with status 'pending'
    const [toolLog] = await db
      .insert(toolLogs)
      .values({
        sessionId,
        conversationId,
        appId: tool.appId,
        toolName,
        params: toolParams,
        status: 'pending',
      })
      .returning();

    // Track invocation start time
    this.invocationTimestamps.set(toolLog.invocationId, Date.now());

    logEvent(
      {
        event: 'tool_invoked',
        invocationId: toolLog.invocationId,
        sessionId,
        conversationId,
        userId,
      },
      { appSlug, toolName }
    );

    return {
      success: true,
      invocationId: toolLog.invocationId,
      sessionId,
    };
  }

  async handleResult(invocationId: string, result: unknown): Promise<void> {
    const startTime = this.invocationTimestamps.get(invocationId);
    const durationMs = startTime ? Date.now() - startTime : null;

    await db
      .update(toolLogs)
      .set({
        status: 'success',
        result: result as Record<string, unknown>,
        durationMs,
      })
      .where(eq(toolLogs.invocationId, invocationId));

    this.invocationTimestamps.delete(invocationId);
    this.circuitBreaker.recordSuccess();

    logEvent({ event: 'tool_result_received', invocationId }, { durationMs });
  }

  async handleTimeout(invocationId: string): Promise<void> {
    const startTime = this.invocationTimestamps.get(invocationId);
    const durationMs = startTime ? Date.now() - startTime : null;

    // Update tool_log to 'timeout'
    const [log] = await db
      .update(toolLogs)
      .set({
        status: 'timeout',
        durationMs,
      })
      .where(eq(toolLogs.invocationId, invocationId))
      .returning();

    this.invocationTimestamps.delete(invocationId);
    this.circuitBreaker.recordFailure();

    // Abandon the active intent for this conversation
    if (log) {
      const activeIntent = await this.intentService.getActiveIntent(log.conversationId);
      if (activeIntent) {
        await this.intentService.abandonIntent(activeIntent.id);
      }
    }

    logEvent({ event: 'tool_timeout', invocationId }, { durationMs });
  }

  async handleAppComplete(sessionId: string, summary: ContextSummary): Promise<void> {
    // Check if session is already completed (idempotent)
    const [session] = await db.select().from(appSessions).where(eq(appSessions.id, sessionId));

    if (!session || session.status === 'completed') {
      logEvent({ event: 'app_complete_ignored', sessionId }, { reason: 'session already completed or not found' });
      return;
    }

    // Update app_session to completed with context_summary
    await db
      .update(appSessions)
      .set({
        status: 'completed',
        contextSummary: summary,
        updatedAt: new Date(),
      })
      .where(eq(appSessions.id, sessionId));

    // Resolve the active intent for this conversation
    const activeIntent = await this.intentService.getActiveIntent(session.conversationId);
    if (activeIntent) {
      await this.intentService.resolveIntent(activeIntent.id);
    }

    logEvent({ event: 'app_complete', sessionId }, { app: summary.app });
  }

  private async ensureSession(conversationId: string, appId: string): Promise<string> {
    // Find any existing active session for this conversation
    const [existingSession] = await db
      .select()
      .from(appSessions)
      .where(and(eq(appSessions.conversationId, conversationId), eq(appSessions.status, 'active')));

    if (existingSession) {
      // Same app: reuse session
      if (existingSession.appId === appId) {
        return existingSession.id;
      }

      // Different app: terminate previous session
      await db
        .update(appSessions)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(appSessions.id, existingSession.id));

      logEvent(
        { event: 'session_terminated', sessionId: existingSession.id, conversationId },
        { reason: 'new app invocation' }
      );
    }

    // Create new session
    const [newSession] = await db
      .insert(appSessions)
      .values({
        conversationId,
        appId,
        status: 'active',
      })
      .returning();

    return newSession.id;
  }
}

export const toolRouter = new ToolRouter();
