import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SpotifyToolHandler } from '../../server/apps/spotify';
import { db } from '../../server/lib/db';
import { apps, oauthTokens, users } from '../../server/lib/schema';
import { OAuthService } from '../../server/services/oauth.service';

const TEST_EMAIL = `spotify-test-${Date.now()}@test.com`;
let testUserId: string;
let testAppId: string;
const oauthService = new OAuthService();

beforeAll(async () => {
  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      email: TEST_EMAIL,
      passwordHash: 'fake-hash-for-testing',
      displayName: 'Spotify Test User',
    })
    .returning();
  testUserId = user.id;

  // Ensure spotify app exists in registry
  const existing = await db.select().from(apps).where(eq(apps.slug, 'spotify')).limit(1);
  if (existing.length > 0) {
    testAppId = existing[0].id;
  } else {
    const [app] = await db
      .insert(apps)
      .values({
        slug: 'spotify',
        name: 'Spotify',
        description: 'Music streaming integration',
        authType: 'oauth',
        iframeUrl: '',
        oauthConfig: {
          authorizationUrl: 'https://accounts.spotify.com/authorize',
          tokenUrl: 'https://accounts.spotify.com/api/token',
          scopes: ['playlist-modify-public', 'playlist-modify-private'],
          clientId: 'mock-client-id',
        },
        toolSchemas: [
          { name: 'get_auth_status', description: 'Check Spotify auth status', parameters: {} },
          {
            name: 'create_playlist',
            description: 'Create a mood playlist',
            parameters: {
              name: { type: 'string', required: true },
              mood: { type: 'string', required: true },
              track_count: { type: 'number' },
            },
          },
        ],
      })
      .returning();
    testAppId = app.id;
  }
});

afterAll(async () => {
  // Clean up oauth_tokens for test user
  await db.delete(oauthTokens).where(eq(oauthTokens.userId, testUserId));
  // Clean up test user
  await db.delete(users).where(eq(users.id, testUserId));
});

// --- OAuthService Tests ---

describe('OAuthService', () => {
  describe('generateAuthUrl', () => {
    it('creates valid URL with base64-encoded state containing nonce', () => {
      const result = oauthService.generateAuthUrl('spotify', testUserId, 'conv-123');

      expect(result.url).toBeDefined();
      expect(result.nonce).toBeDefined();
      expect(typeof result.nonce).toBe('string');
      expect(result.nonce.length).toBeGreaterThan(0);

      // Parse the URL and decode state
      const url = new URL(result.url);
      const stateParam = url.searchParams.get('state');
      expect(stateParam).toBeDefined();

      const decoded = JSON.parse(Buffer.from(stateParam as string, 'base64').toString());
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.conversationId).toBe('conv-123');
      expect(decoded.appSlug).toBe('spotify');
      expect(decoded.nonce).toBe(result.nonce);
    });

    it('includes required OAuth parameters in URL', () => {
      const result = oauthService.generateAuthUrl('spotify', testUserId, 'conv-456');
      const url = new URL(result.url);

      expect(url.origin + url.pathname).toBe('https://accounts.spotify.com/authorize');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBeDefined();
    });
  });

  describe('handleCallback', () => {
    it('validates nonce exists in state', async () => {
      const { nonce } = oauthService.generateAuthUrl('spotify', testUserId, 'conv-789');

      const state = Buffer.from(
        JSON.stringify({
          userId: testUserId,
          conversationId: 'conv-789',
          appSlug: 'spotify',
          nonce,
        })
      ).toString('base64');

      const result = await oauthService.handleCallback('spotify', 'mock-auth-code', state);
      expect(result.conversationId).toBe('conv-789');
    });

    it('throws with invalid nonce', async () => {
      const state = Buffer.from(
        JSON.stringify({
          userId: testUserId,
          conversationId: 'conv-invalid',
          appSlug: 'spotify',
          nonce: 'invalid-nonce-that-was-never-generated',
        })
      ).toString('base64');

      await expect(oauthService.handleCallback('spotify', 'mock-auth-code', state)).rejects.toThrow();
    });
  });

  describe('storeTokens', () => {
    it('persists to oauth_tokens table', async () => {
      await oauthService.storeTokens(testUserId, testAppId, 'access-token-123', 'refresh-token-456');

      const [token] = await db
        .select()
        .from(oauthTokens)
        .where(and(eq(oauthTokens.userId, testUserId), eq(oauthTokens.appId, testAppId)))
        .limit(1);

      expect(token).toBeDefined();
      expect(token.accessToken).toBe('access-token-123');
      expect(token.refreshToken).toBe('refresh-token-456');
    });

    it('upserts when token already exists for same user+app', async () => {
      await oauthService.storeTokens(testUserId, testAppId, 'new-access-token', 'new-refresh-token');

      const tokens = await db
        .select()
        .from(oauthTokens)
        .where(and(eq(oauthTokens.userId, testUserId), eq(oauthTokens.appId, testAppId)));

      expect(tokens.length).toBe(1);
      expect(tokens[0].accessToken).toBe('new-access-token');
    });
  });

  describe('getTokenStatus', () => {
    it('returns true when unexpired token exists', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'valid-token', 'refresh', futureDate);

      const status = await oauthService.getTokenStatus(testUserId, 'spotify');
      expect(status.authenticated).toBe(true);
    });

    it('returns false when no token exists for user', async () => {
      const status = await oauthService.getTokenStatus('00000000-0000-0000-0000-000000000000', 'spotify');
      expect(status.authenticated).toBe(false);
    });

    it('returns false when token is expired', async () => {
      const pastDate = new Date(Date.now() - 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'expired-token', 'refresh', pastDate);

      const status = await oauthService.getTokenStatus(testUserId, 'spotify');
      expect(status.authenticated).toBe(false);
    });
  });
});

// --- SpotifyToolHandler Tests ---

describe('SpotifyToolHandler', () => {
  describe('get_auth_status', () => {
    it('when not authenticated returns authenticated false with auth_url', async () => {
      // Clean up any tokens first
      await db.delete(oauthTokens).where(eq(oauthTokens.userId, testUserId));

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke('get_auth_status', { conversationId: 'conv-test' }, testUserId);

      expect(result.authenticated).toBe(false);
      expect(result.auth_url).toBeDefined();
      expect(typeof result.auth_url).toBe('string');
    });

    it('when authenticated returns authenticated true', async () => {
      // Insert valid token
      const futureDate = new Date(Date.now() + 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'valid-token', 'refresh', futureDate);

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke('get_auth_status', { conversationId: 'conv-test' }, testUserId);

      expect(result.authenticated).toBe(true);
      expect(result.auth_url).toBeUndefined();
    });
  });

  describe('create_playlist', () => {
    it('with valid params returns playlist_id, playlist_url, tracks', async () => {
      // Ensure authenticated
      const futureDate = new Date(Date.now() + 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'valid-token', 'refresh', futureDate);

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke(
        'create_playlist',
        { name: 'Chill Vibes', mood: 'relaxed', track_count: 5 },
        testUserId
      );

      expect(result.playlist_id).toBeDefined();
      expect(result.playlist_url).toBeDefined();
      expect(result.tracks).toBeDefined();
      expect(Array.isArray(result.tracks)).toBe(true);
      expect(result.tracks.length).toBe(5);
    });

    it('defaults to 10 tracks when track_count not specified', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'valid-token', 'refresh', futureDate);

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke(
        'create_playlist',
        { name: 'Study Mix', mood: 'focused' },
        testUserId
      );

      expect(result.tracks.length).toBe(10);
    });

    it('when not authenticated returns auth required error', async () => {
      await db.delete(oauthTokens).where(eq(oauthTokens.userId, testUserId));

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke(
        'create_playlist',
        { name: 'Party Mix', mood: 'energetic' },
        testUserId
      );

      expect(result.error).toBeDefined();
      expect(result.error).toContain('auth');
    });

    it('with missing name returns error', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'valid-token', 'refresh', futureDate);

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke('create_playlist', { mood: 'happy' }, testUserId);

      expect(result.error).toBeDefined();
    });

    it('with missing mood returns error', async () => {
      const futureDate = new Date(Date.now() + 3600 * 1000);
      await oauthService.storeTokens(testUserId, testAppId, 'valid-token', 'refresh', futureDate);

      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke('create_playlist', { name: 'My Mix' }, testUserId);

      expect(result.error).toBeDefined();
    });
  });

  describe('unknown tool', () => {
    it('returns error for unknown tool name', async () => {
      const handler = new SpotifyToolHandler();
      const result = await handler.handleToolInvoke('unknown_tool', {}, testUserId);

      expect(result.error).toBeDefined();
    });
  });
});
