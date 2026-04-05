export type LichessChallengeResult = {
  gameId: string;
  gameUrl: string;
  challengeUrl?: string;
};

export type LichessGameStatus = {
  gameId: string;
  status: string;
  winner?: 'white' | 'black';
  moves: string;
  fen: string;
  gameOver: boolean;
};

export class LichessRateLimitError extends Error {
  retryAfterMs: number;
  constructor(retryAfterMs: number) {
    super(`Lichess rate limit exceeded. Retry after ${Math.ceil(retryAfterMs / 1000)}s.`);
    this.name = 'LichessRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

const LICHESS_BASE = 'https://lichess.org';

const TERMINAL_STATUSES = new Set([
  'mate',
  'resign',
  'stalemate',
  'timeout',
  'draw',
  'outoftime',
  'cheat',
  'noStart',
  'unknownFinish',
  'variantEnd',
  'aborted',
]);

export class LichessClient {
  private token: string;

  constructor(token: string) {
    if (!token) {
      throw new Error('Lichess API token is required');
    }
    this.token = token;
  }

  async createAIChallenge(params: {
    level?: number;
    color?: 'white' | 'black' | 'random';
    clockLimit?: number;
    clockIncrement?: number;
  }): Promise<LichessChallengeResult> {
    const level = Math.max(1, Math.min(8, params.level ?? 3));
    const body = new URLSearchParams();
    body.set('level', String(level));
    body.set('color', params.color ?? 'white');
    body.set('clock.limit', String(params.clockLimit ?? 600));
    body.set('clock.increment', String(params.clockIncrement ?? 0));

    const res = await this.fetchLichess(`${LICHESS_BASE}/api/challenge/ai`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await res.json();
    return {
      gameId: data.id,
      gameUrl: `${LICHESS_BASE}/${data.id}`,
    };
  }

  async createOpenChallenge(params: {
    color?: 'white' | 'black' | 'random';
    clockLimit?: number;
    clockIncrement?: number;
  }): Promise<LichessChallengeResult> {
    const body = new URLSearchParams();
    body.set('color', params.color ?? 'random');
    body.set('clock.limit', String(params.clockLimit ?? 600));
    body.set('clock.increment', String(params.clockIncrement ?? 0));

    const res = await this.fetchLichess(`${LICHESS_BASE}/api/challenge/open`, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = await res.json();
    const challenge = data.challenge ?? data;
    return {
      gameId: challenge.id,
      gameUrl: `${LICHESS_BASE}/${challenge.id}`,
      challengeUrl: challenge.url ?? `${LICHESS_BASE}/${challenge.id}`,
    };
  }

  async getGameStatus(gameId: string): Promise<LichessGameStatus> {
    const res = await this.fetchLichess(`${LICHESS_BASE}/api/game/${gameId}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await res.json();
    return {
      gameId: data.id,
      status: data.status,
      winner: data.winner,
      moves: data.moves ?? '',
      fen: data.lastFen ?? data.fen ?? '',
      gameOver: TERMINAL_STATUSES.has(data.status),
    };
  }

  private async fetchLichess(url: string, options: RequestInit): Promise<Response> {
    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${this.token}`);

    const res = await fetch(url, { ...options, headers });

    if (res.status === 429) {
      const retryAfter = Number.parseInt(res.headers.get('Retry-After') ?? '60', 10);
      throw new LichessRateLimitError(retryAfter * 1000);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Lichess API error ${res.status}: ${text || res.statusText}`);
    }

    return res;
  }
}
