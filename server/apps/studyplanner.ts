import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { apps, oauthTokens } from '../lib/schema';
import { oauthService } from '../services/oauth.service';

type StudySession = {
  id: string;
  title: string;
  start: string;
  end: string;
  link?: string;
};

type SessionSnapshot = {
  plannedCount: number;
  lastTitle?: string;
};

type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
};

export class StudyPlannerToolHandler {
  private sessionState = new Map<string, SessionSnapshot>();

  async handleToolInvoke(
    appSessionId: string,
    toolName: string,
    params: Record<string, unknown>,
    userId: string,
    conversationId: string
  ): Promise<Record<string, unknown>> {
    switch (toolName) {
      case 'open_planner':
        return this.openPlanner(userId, conversationId);
      case 'list_upcoming_sessions':
        return this.listUpcomingSessions(userId, params);
      case 'create_study_session':
        return this.createStudySession(userId, appSessionId, params);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  buildAssistantContext(sessionId: string): string {
    const snap = this.sessionState.get(sessionId);
    if (!snap) {
      return '';
    }
    const last = snap.lastTitle ? ` Last planned: "${snap.lastTitle}".` : '';
    return `\n\n## Active App Context\nStudy Planner: ${snap.plannedCount} study sessions planned this session.${last}`;
  }

  private async openPlanner(userId: string, conversationId: string): Promise<Record<string, unknown>> {
    const token = await oauthService.getValidAccessToken(userId, 'studyplanner');
    if (!token) {
      const { url } = oauthService.generateAuthUrl('studyplanner', userId, conversationId);
      return {
        status: 'auth_required',
        needsAuth: true,
        authUrl: url,
        message: 'Connect your Google account to plan study sessions.',
      };
    }
    const sessions = await this.fetchUpcoming(token, 10);
    return {
      status: 'ready',
      needsAuth: false,
      sessions,
    };
  }

  private async listUpcomingSessions(
    userId: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const token = await oauthService.getValidAccessToken(userId, 'studyplanner');
    if (!token) {
      return {
        error: 'Google Calendar is not connected yet. Use studyplanner__open_planner first to connect.',
        needsAuth: true,
      };
    }
    const maxResults = Math.min(Math.max(Number(params.limit ?? 10), 1), 20);
    const sessions = await this.fetchUpcoming(token, maxResults);
    return { sessions, count: sessions.length };
  }

  private async createStudySession(
    userId: string,
    appSessionId: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const token = await oauthService.getValidAccessToken(userId, 'studyplanner');
    if (!token) {
      return {
        error: 'Google Calendar is not connected yet. Use studyplanner__open_planner first to connect.',
        needsAuth: true,
      };
    }

    const title = String(params.title ?? '').trim();
    const startIso = String(params.startIso ?? '').trim();
    const durationMinutes = Number(params.durationMinutes ?? 45);
    const notes = params.notes ? String(params.notes) : '';

    if (!title || !startIso) {
      return { error: 'Missing required parameters: title and startIso' };
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 10 || durationMinutes > 240) {
      return { error: 'durationMinutes must be between 10 and 240' };
    }

    const start = new Date(startIso);
    if (Number.isNaN(start.getTime())) {
      return { error: 'startIso must be a valid ISO datetime string' };
    }
    const end = new Date(start.getTime() + durationMinutes * 60_000);

    const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: title,
        description: notes || undefined,
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { error: `Google Calendar event creation failed (${response.status}): ${text.slice(0, 220)}` };
    }

    const created = (await response.json()) as GoogleCalendarEvent;
    const session: StudySession = {
      id: created.id || '',
      title: created.summary || title,
      start: created.start?.dateTime || start.toISOString(),
      end: created.end?.dateTime || end.toISOString(),
      link: created.htmlLink,
    };

    const prev = this.sessionState.get(appSessionId);
    this.sessionState.set(appSessionId, {
      plannedCount: (prev?.plannedCount ?? 0) + 1,
      lastTitle: session.title,
    });

    return {
      status: 'created',
      session,
    };
  }

  private async fetchUpcoming(token: string, maxResults: number): Promise<StudySession[]> {
    const query = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin: new Date().toISOString(),
      maxResults: String(maxResults),
    });
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${query.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    if (!response.ok) {
      throw new Error(`Google Calendar list failed with status ${response.status}`);
    }
    const json = (await response.json()) as { items?: GoogleCalendarEvent[] };
    return (json.items ?? []).map((item) => ({
      id: item.id || '',
      title: item.summary || 'Untitled session',
      start: item.start?.dateTime || item.start?.date || '',
      end: item.end?.dateTime || item.end?.date || '',
      link: item.htmlLink,
    }));
  }

  async getConnectedStatus(userId: string): Promise<boolean> {
    const [appRow] = await db.select({ id: apps.id }).from(apps).where(eq(apps.slug, 'studyplanner')).limit(1);
    if (!appRow) return false;
    const [token] = await db
      .select({ id: oauthTokens.id })
      .from(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.appId, appRow.id)))
      .limit(1);
    return Boolean(token);
  }
}
