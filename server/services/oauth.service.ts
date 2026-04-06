import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { apps, oauthTokens } from '../lib/schema';

type OAuthState = {
  userId: string;
  conversationId: string;
  appSlug: string;
  nonce: string;
};

type OAuthConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret?: string;
};

const NONCE_TTL_MS = 10 * 60_000; // 10 minutes
const NONCE_CLEANUP_INTERVAL_MS = 60_000; // 1 minute

export class OAuthService {
  // Track valid nonces for CSRF protection with expiry timestamps
  private pendingNonces = new Map<string, number>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    // Periodically evict expired nonces to prevent memory leaks
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [nonce, expiresAt] of this.pendingNonces) {
        if (now > expiresAt) this.pendingNonces.delete(nonce);
      }
    }, NONCE_CLEANUP_INTERVAL_MS);
    this.cleanupTimer.unref();
  }

  generateAuthUrl(appSlug: string, userId: string, conversationId: string): { url: string; nonce: string } {
    const nonce = crypto.randomUUID();
    this.pendingNonces.set(nonce, Date.now() + NONCE_TTL_MS);

    const state: OAuthState = {
      userId,
      conversationId,
      appSlug,
      nonce,
    };

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

    const config = this.getOAuthConfig(appSlug);
    if (!config.clientId?.trim()) {
      throw new OAuthError(
        'OAuth is not configured for this app. Add provider credentials in environment variables and try again.',
        501
      );
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      scope: config.scopes.join(' '),
      redirect_uri: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/oauth/${appSlug}/callback`,
      state: encodedState,
    });

    const url = `${config.authorizationUrl}?${params.toString()}`;

    return { url, nonce };
  }

  async handleCallback(appSlug: string, code: string, stateParam: string): Promise<{ conversationId: string }> {
    // Decode and validate state
    const decoded = JSON.parse(Buffer.from(stateParam, 'base64').toString()) as OAuthState;

    const nonceExpiry = this.pendingNonces.get(decoded.nonce);
    if (!nonceExpiry || Date.now() > nonceExpiry) {
      this.pendingNonces.delete(decoded.nonce);
      throw new OAuthError('Invalid or expired nonce', 403);
    }

    // Consume the nonce (one-time use)
    this.pendingNonces.delete(decoded.nonce);

    const appRecord = await this.getAppBySlug(appSlug);
    if (!appRecord) {
      throw new OAuthError('App not found', 404);
    }

    const config = this.getOAuthConfig(appSlug);
    if (appSlug === 'studyplanner') {
      if (!config.clientId || !config.clientSecret || !config.tokenUrl) {
        throw new OAuthError('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 501);
      }
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: `${baseUrl}/api/oauth/${appSlug}/callback`,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenResponse.ok) {
        const body = await tokenResponse.text();
        throw new OAuthError(`OAuth token exchange failed (${tokenResponse.status}): ${body.slice(0, 220)}`, 502);
      }
      const tokens = (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (!tokens.access_token) {
        throw new OAuthError('OAuth token exchange returned no access token.', 502);
      }
      const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
      await this.storeTokens(
        decoded.userId,
        appRecord.id,
        tokens.access_token,
        tokens.refresh_token,
        expiresAt ?? undefined
      );
    } else {
      const expiresAt = new Date(Date.now() + 3600 * 1000);
      await this.storeTokens(decoded.userId, appRecord.id, `mock-access-${code}`, `mock-refresh-${code}`, expiresAt);
    }

    return { conversationId: decoded.conversationId };
  }

  async getTokenStatus(userId: string, appSlug: string): Promise<{ authenticated: boolean }> {
    const appRecord = await this.getAppBySlug(appSlug);
    if (!appRecord) {
      return { authenticated: false };
    }

    const now = new Date();
    const [token] = await db
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.appId, appRecord.id)))
      .limit(1);

    if (!token) {
      return { authenticated: false };
    }

    // If there's an expiry and it's in the past, token is invalid
    if (token.expiresAt && token.expiresAt <= now) {
      return { authenticated: false };
    }

    return { authenticated: true };
  }

  async getValidAccessToken(userId: string, appSlug: string): Promise<string | null> {
    const appRecord = await this.getAppBySlug(appSlug);
    if (!appRecord) return null;

    const [token] = await db
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.userId, userId), eq(oauthTokens.appId, appRecord.id)))
      .limit(1);
    if (!token) return null;

    const now = Date.now();
    const expiryMs = token.expiresAt ? token.expiresAt.getTime() : now + 60_000;
    if (expiryMs - now > 60_000) {
      return token.accessToken;
    }

    if (!token.refreshToken) {
      return null;
    }

    const config = this.getOAuthConfig(appSlug);
    if (!config.clientId || !config.clientSecret || !config.tokenUrl) {
      return null;
    }

    const response = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: token.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) {
      return null;
    }

    const refreshed = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
    };
    if (!refreshed.access_token) return null;

    const expiresAt = refreshed.expires_in ? new Date(Date.now() + refreshed.expires_in * 1000) : null;
    await this.storeTokens(
      userId,
      appRecord.id,
      refreshed.access_token,
      refreshed.refresh_token ?? token.refreshToken ?? undefined,
      expiresAt ?? undefined
    );
    return refreshed.access_token;
  }

  async storeTokens(
    userId: string,
    appId: string,
    accessToken: string,
    refreshToken?: string,
    expiresAt?: Date
  ): Promise<void> {
    // Upsert: insert or update on conflict (user_id + app_id unique constraint)
    await db
      .insert(oauthTokens)
      .values({
        userId,
        appId,
        accessToken,
        refreshToken: refreshToken ?? null,
        expiresAt: expiresAt ?? null,
      })
      .onConflictDoUpdate({
        target: [oauthTokens.userId, oauthTokens.appId],
        set: {
          accessToken,
          refreshToken: refreshToken ?? null,
          expiresAt: expiresAt ?? null,
        },
      });
  }

  private getOAuthConfig(appSlug: string): OAuthConfig {
    const configs: Record<string, OAuthConfig> = {
      studyplanner: {
        authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        scopes: [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly',
        ],
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      },
    };

    return (
      configs[appSlug] ?? {
        authorizationUrl: '',
        tokenUrl: '',
        scopes: [],
        clientId: '',
      }
    );
  }

  private async getAppBySlug(slug: string) {
    const [appRecord] = await db.select().from(apps).where(eq(apps.slug, slug)).limit(1);
    return appRecord ?? null;
  }
}

export class OAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

export const oauthService = new OAuthService();
