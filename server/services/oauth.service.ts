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
};

export class OAuthService {
  // Track valid nonces for CSRF protection
  private pendingNonces = new Set<string>();

  generateAuthUrl(appSlug: string, userId: string, conversationId: string): { url: string; nonce: string } {
    const nonce = crypto.randomUUID();
    this.pendingNonces.add(nonce);

    const state: OAuthState = {
      userId,
      conversationId,
      appSlug,
      nonce,
    };

    const encodedState = Buffer.from(JSON.stringify(state)).toString('base64');

    // Build Spotify-style OAuth authorization URL
    const config = this.getOAuthConfig(appSlug);
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

    if (!this.pendingNonces.has(decoded.nonce)) {
      throw new OAuthError('Invalid or expired nonce', 403);
    }

    // Consume the nonce (one-time use)
    this.pendingNonces.delete(decoded.nonce);

    // In a real implementation, we'd exchange `code` for tokens via the token endpoint.
    // For MVP, we mock the token exchange and store mock tokens.
    const appRecord = await this.getAppBySlug(appSlug);
    if (appRecord) {
      const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
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
    // Default configs for known apps. In production, these come from the apps table.
    const configs: Record<string, OAuthConfig> = {
      spotify: {
        authorizationUrl: 'https://accounts.spotify.com/authorize',
        tokenUrl: 'https://accounts.spotify.com/api/token',
        scopes: ['playlist-modify-public', 'playlist-modify-private'],
        clientId: process.env.SPOTIFY_CLIENT_ID || 'mock-client-id',
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
