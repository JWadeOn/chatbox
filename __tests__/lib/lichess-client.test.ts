import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LichessClient, LichessRateLimitError } from '../../server/lib/lichess-client';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(headers),
  });
}

describe('LichessClient', () => {
  describe('constructor', () => {
    it('throws if token is empty', () => {
      expect(() => new LichessClient('')).toThrow('Lichess API token is required');
    });

    it('creates client with valid token', () => {
      const client = new LichessClient('lip_test123');
      expect(client).toBeDefined();
    });
  });

  describe('createAIChallenge', () => {
    it('sends correct request and returns game info', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'abc123' }));
      const client = new LichessClient('lip_test');

      const result = await client.createAIChallenge({ level: 5, color: 'black' });

      expect(result.gameId).toBe('abc123');
      expect(result.gameUrl).toBe('https://lichess.org/abc123');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('https://lichess.org/api/challenge/ai');
      expect(options.method).toBe('POST');
      const body = options.body as URLSearchParams;
      expect(body.get('level')).toBe('5');
      expect(body.get('color')).toBe('black');
    });

    it('clamps level to 1-8 range', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g1' }));
      const client = new LichessClient('lip_test');

      await client.createAIChallenge({ level: 15 });
      const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('level')).toBe('8');
    });

    it('uses defaults when params omitted', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g2' }));
      const client = new LichessClient('lip_test');

      await client.createAIChallenge({});
      const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('level')).toBe('3');
      expect(body.get('color')).toBe('white');
      expect(body.get('clock.limit')).toBe('600');
      expect(body.get('clock.increment')).toBe('0');
    });

    it('sets Authorization header', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g3' }));
      const client = new LichessClient('lip_secret');

      await client.createAIChallenge({});
      const headers = mockFetch.mock.calls[0][1].headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer lip_secret');
    });
  });

  describe('createOpenChallenge', () => {
    it('returns gameUrl and challengeUrl', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ challenge: { id: 'ch123', url: 'https://lichess.org/ch123' } }));
      const client = new LichessClient('lip_test');

      const result = await client.createOpenChallenge({ color: 'white' });

      expect(result.gameId).toBe('ch123');
      expect(result.gameUrl).toBe('https://lichess.org/ch123');
      expect(result.challengeUrl).toBe('https://lichess.org/ch123');
    });

    it('sends correct form body', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ challenge: { id: 'ch1' } }));
      const client = new LichessClient('lip_test');

      await client.createOpenChallenge({ color: 'random', clockLimit: 300, clockIncrement: 5 });
      const body = mockFetch.mock.calls[0][1].body as URLSearchParams;
      expect(body.get('color')).toBe('random');
      expect(body.get('clock.limit')).toBe('300');
      expect(body.get('clock.increment')).toBe('5');
    });
  });

  describe('getGameStatus', () => {
    it('returns status for finished game', async () => {
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          id: 'g1',
          status: 'mate',
          winner: 'white',
          moves: 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7',
          lastFen: 'some/fen',
        })
      );
      const client = new LichessClient('lip_test');

      const result = await client.getGameStatus('g1');
      expect(result.gameId).toBe('g1');
      expect(result.status).toBe('mate');
      expect(result.winner).toBe('white');
      expect(result.gameOver).toBe(true);
      expect(result.fen).toBe('some/fen');
    });

    it('returns in-progress status', async () => {
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g2', status: 'started', moves: 'e4 e5', lastFen: 'fen2' }));
      const client = new LichessClient('lip_test');

      const result = await client.getGameStatus('g2');
      expect(result.status).toBe('started');
      expect(result.gameOver).toBe(false);
      expect(result.winner).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('throws LichessRateLimitError on 429', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'Retry-After': '30' }),
          text: () => Promise.resolve(''),
        })
      );
      const client = new LichessClient('lip_test');

      await expect(client.createAIChallenge({})).rejects.toThrow(LichessRateLimitError);
      try {
        await client.createAIChallenge({});
      } catch (err) {
        // The first call already threw; this is just for type checking
      }
    });

    it('throws descriptive error on 500', async () => {
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          text: () => Promise.resolve('server error'),
        })
      );
      const client = new LichessClient('lip_test');

      await expect(client.createAIChallenge({})).rejects.toThrow('Lichess API error 500');
    });

    it('throws on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));
      const client = new LichessClient('lip_test');

      await expect(client.getGameStatus('g1')).rejects.toThrow('fetch failed');
    });
  });
});
