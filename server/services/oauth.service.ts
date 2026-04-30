import crypto from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../lib/db';
import { apps, oauthTokens } from '../lib/schema';

type OAuthState = {
  userId: string;
  conversationId: string;
  appSlug: string;
  nonce: string;
  redirectBaseUrl: string;
  createdAt: number;
};

type SignedOAuthState = OAuthState & { sig: string };

type OAuthConfig = {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  clientId: string;
  clientSecret?: string;
};

const STATE_TTL_MS = 10 * 60_000; // 10 minutes

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function getSigningSecret(): string {
  return process.env.JWT_SECRET || 'dev-secret';
}

function signState(state: OAuthState): string {
  const payload = JSON.stringify(state);
  const sig = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
  const signed: SignedOAuthState = { ...state, sig };
  return Buffer.from(JSON.stringify(signed)).toString('base64');
}

function verifyAndDecodeState(encoded: string): OAuthState {
  const signed = JSON.parse(Buffer.from(encoded, 'base64').toString()) as SignedOAuthState;
  const { sig, ...state } = signed;

  const expectedSig = crypto.createHmac('sha256', getSigningSecret()).update(JSON.stringify(state)).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new OAuthError('Invalid OAuth state signature', 403);
  }

  if (Date.now() - state.createdAt > STATE_TTL_MS) {
    throw new OAuthError('OAuth state expired — please try connecting again', 403);
  }

  return state;
}

export class OAuthService {

  generateAuthUrl(
    appSlug: string,
    userId: string,
    conversationId: string,
    redirectBaseUrl?: string
  ): { url: string; nonce: string } {
    const nonce = crypto.randomUUID();
    const resolvedRedirectBaseUrlRaw =
      redirectBaseUrl ||
      process.env.OAUTH_REDIRECT_BASE_URL ||
      process.env.NEXT_PUBLIC_BASE_URL ||
      'http://localhost:3000';
    const resolvedRedirectBaseUrl = normalizeBaseUrl(resolvedRedirectBaseUrlRaw);

    console.info(
      '[OAuthService.generateAuthUrl] appSlug=%s redirectBaseUrl=%s (raw=%s, arg=%s, OAUTH_REDIRECT_BASE_URL=%s, NEXT_PUBLIC_BASE_URL=%s)',
      appSlug,
      resolvedRedirectBaseUrl,
      resolvedRedirectBaseUrlRaw,
      redirectBaseUrl ?? '(none)',
      process.env.OAUTH_REDIRECT_BASE_URL ?? '(not set)',
      process.env.NEXT_PUBLIC_BASE_URL ?? '(not set)'
    );

    const state: OAuthState = {
      userId,
      conversationId,
      appSlug,
      nonce,
      redirectBaseUrl: resolvedRedirectBaseUrl,
      createdAt: Date.now(),
    };

    const encodedState = signState(state);

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
      redirect_uri: `${resolvedRedirectBaseUrl}/api/oauth/${appSlug}/callback`,
      state: encodedState,
    });

    const url = `${config.authorizationUrl}?${params.toString()}`;

    return { url, nonce };
  }

  async handleCallback(appSlug: string, code: string, stateParam: string): Promise<{ conversationId: string; redirectBaseUrl: string }> {
    // Verify HMAC signature and decode state (stateless — survives restarts)
    const decoded = verifyAndDecodeState(stateParam);

    const appRecord = await this.getAppBySlug(appSlug);
    if (!appRecord) {
      throw new OAuthError('App not found', 404);
    }

    const config = this.getOAuthConfig(appSlug);
    if (appSlug === 'studyplanner') {
      if (!config.clientId || !config.clientSecret || !config.tokenUrl) {
        throw new OAuthError('Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 501);
      }
      const baseUrl = normalizeBaseUrl(
        decoded.redirectBaseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
      );
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

    return { conversationId: decoded.conversationId, redirectBaseUrl: decoded.redirectBaseUrl };
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
