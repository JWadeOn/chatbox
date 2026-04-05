import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChessToolHandler } from '../../server/apps/chess';

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers(),
  });
}

describe('ChessToolHandler — Lichess modes', () => {
  describe('vs_computer', () => {
    it('creates a Lichess AI game and returns game URL', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'abc123' }));

      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', {
        mode: 'vs_computer',
        level: 5,
        color: 'black',
      });

      expect(result.mode).toBe('vs_computer');
      expect(result.game_url).toBe('https://lichess.org/abc123');
      expect(result.game_id).toBe('abc123');
      expect(result.level).toBe(5);
      expect(result.status).toBe('in_progress');
    });

    it('uses default level 3 when not specified', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g1' }));

      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });

      expect(result.level).toBe(3);
    });
  });

  describe('vs_human', () => {
    it('creates an open challenge and returns URLs', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      mockFetch.mockReturnValueOnce(jsonResponse({ challenge: { id: 'ch456', url: 'https://lichess.org/ch456' } }));

      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_human' });

      expect(result.mode).toBe('vs_human');
      expect(result.game_url).toBe('https://lichess.org/ch456');
      expect(result.challenge_url).toBeDefined();
      expect(result.status).toBe('waiting_for_opponent');
    });
  });

  describe('get_board_state for Lichess game', () => {
    it('fetches game status from Lichess API', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      const handler = new ChessToolHandler();

      // Start a game
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g1' }));
      await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });

      // Check status
      mockFetch.mockReturnValueOnce(
        jsonResponse({
          id: 'g1',
          status: 'started',
          moves: 'e4 e5',
          lastFen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        })
      );
      const state = await handler.handleToolInvoke('session-1', 'get_board_state', {});

      expect(state.mode).toBe('vs_computer');
      expect(state.game_url).toBe('https://lichess.org/g1');
      expect(state.status).toBe('started');
      expect(state.game_over).toBe(false);
    });

    it('returns game_over for finished game', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      const handler = new ChessToolHandler();

      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g2' }));
      await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });

      mockFetch.mockReturnValueOnce(
        jsonResponse({ id: 'g2', status: 'mate', winner: 'white', moves: 'e4 e5 Qh5', lastFen: 'fen' })
      );
      const state = await handler.handleToolInvoke('session-1', 'get_board_state', {});

      expect(state.game_over).toBe(true);
      expect(state.winner).toBe('white');
      expect(state.status).toBe('mate');
    });
  });

  describe('make_move on Lichess game', () => {
    it('returns instructive error', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      const handler = new ChessToolHandler();

      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g1' }));
      await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });

      const result = await handler.handleToolInvoke('session-1', 'make_move', { move: 'e4' });
      expect(result.error).toContain('Lichess');
    });
  });

  describe('resign on Lichess game', () => {
    it('cleans up and returns abandoned', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      const handler = new ChessToolHandler();

      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'g1' }));
      await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });

      const result = await handler.handleToolInvoke('session-1', 'resign', {});
      expect(result.result).toBe('abandoned');
      expect(result.game_url).toBeDefined();
    });
  });

  describe('get_game_link', () => {
    it('returns URLs for active Lichess game', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      const handler = new ChessToolHandler();

      mockFetch.mockReturnValueOnce(jsonResponse({ challenge: { id: 'ch1', url: 'https://lichess.org/ch1' } }));
      await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_human' });

      const result = await handler.handleToolInvoke('session-1', 'get_game_link', {});
      expect(result.game_url).toBe('https://lichess.org/ch1');
      expect(result.mode).toBe('vs_human');
    });

    it('returns error when no Lichess game', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'get_game_link', {});
      expect(result.error).toContain('No active Lichess game');
    });
  });

  describe('graceful degradation', () => {
    it('returns friendly error without LICHESS_API_TOKEN', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', '');
      const handler = new ChessToolHandler();

      const result = await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });
      expect(result.error).toContain('LICHESS_API_TOKEN');
    });

    it('tutoring mode works without token', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', '');
      const handler = new ChessToolHandler();

      const result = await handler.handleToolInvoke('session-1', 'start_game', { mode: 'tutoring' });
      expect(result.board_fen).toBeDefined();
      expect(result.status).toBe('in_progress');
    });
  });

  describe('backward compatibility', () => {
    it('defaults to tutoring when no mode specified', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', {});
      expect(result.board_fen).toBeDefined();
      expect(result.status).toBe('in_progress');
    });

    it('start_game with only color param works as tutoring', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', { color: 'black' });
      expect(result.player_color).toBe('black');
      expect(result.board_fen).toBeDefined();
    });
  });

  describe('Lichess API errors', () => {
    it('propagates API error message', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
          text: () => Promise.resolve('server error'),
        })
      );

      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', { mode: 'vs_computer' });
      expect(result.error).toContain('500');
    });
  });

  describe('session isolation', () => {
    it('tutoring and Lichess games coexist on different sessions', async () => {
      vi.stubEnv('LICHESS_API_TOKEN', 'lip_test');
      const handler = new ChessToolHandler();

      // Start tutoring game on session A
      const tutoring = await handler.handleToolInvoke('session-a', 'start_game', { mode: 'tutoring' });
      expect(tutoring.board_fen).toBeDefined();

      // Start Lichess game on session B
      mockFetch.mockReturnValueOnce(jsonResponse({ id: 'lich1' }));
      const lichess = await handler.handleToolInvoke('session-b', 'start_game', { mode: 'vs_computer' });
      expect(lichess.game_url).toBeDefined();

      // Both work independently
      const moveResult = await handler.handleToolInvoke('session-a', 'make_move', { move: 'e4' });
      expect(moveResult.success).toBe(true);

      const lichessMove = await handler.handleToolInvoke('session-b', 'make_move', { move: 'e4' });
      expect(lichessMove.error).toContain('Lichess');
    });
  });
});
