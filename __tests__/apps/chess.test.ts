import { describe, expect, it } from 'vitest';
import { ChessGame, ChessToolHandler } from '../../server/apps/chess';

describe('ChessGame', () => {
  describe('startGame', () => {
    it('returns initial FEN, player_color, and status in_progress', () => {
      const game = new ChessGame();
      const result = game.startGame();

      expect(result.board_fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(result.player_color).toBe('white');
      expect(result.status).toBe('in_progress');
    });

    it('accepts explicit color white', () => {
      const game = new ChessGame();
      const result = game.startGame('white');

      expect(result.player_color).toBe('white');
      expect(result.status).toBe('in_progress');
    });

    it('accepts explicit color black', () => {
      const game = new ChessGame();
      const result = game.startGame('black');

      expect(result.player_color).toBe('black');
      expect(result.status).toBe('in_progress');
    });
  });

  describe('makeMove', () => {
    it('valid SAN move returns success with updated FEN', () => {
      const game = new ChessGame();
      game.startGame();

      const result = game.makeMove('e4');

      expect(result.success).toBe(true);
      expect(result.board_fen).toContain('4P3'); // e4 pawn
      expect(result.last_move).toBe('e4');
      expect(result.game_over).toBe(false);
      expect(result.error).toBeUndefined();
    });

    it('valid UCI move (e2e4) is converted and succeeds', () => {
      const game = new ChessGame();
      game.startGame();

      const result = game.makeMove('e2e4');

      expect(result.success).toBe(true);
      expect(result.board_fen).toContain('4P3');
      expect(result.last_move).toBe('e4');
      expect(result.game_over).toBe(false);
    });

    it('invalid move returns success false with error, game continues', () => {
      const game = new ChessGame();
      game.startGame();

      const result = game.makeMove('e5'); // black pawn move on white's turn

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.board_fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(result.game_over).toBe(false);

      // Game should still be playable after invalid move
      const validResult = game.makeMove('e4');
      expect(validResult.success).toBe(true);
    });

    it('completely invalid string returns error', () => {
      const game = new ChessGame();
      game.startGame();

      const result = game.makeMove('zzz99');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('getBoardState', () => {
    it('returns current FEN, move history, current turn, and material balance', () => {
      const game = new ChessGame();
      game.startGame();

      const state = game.getBoardState();

      expect(state.board_fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(state.move_history).toEqual([]);
      expect(state.current_turn).toBe('white');
      expect(state.material_balance).toBeDefined();
    });

    it('reflects moves in the history and current turn', () => {
      const game = new ChessGame();
      game.startGame();
      game.makeMove('e4');
      game.makeMove('e5');

      const state = game.getBoardState();

      expect(state.move_history).toEqual(['e4', 'e5']);
      expect(state.current_turn).toBe('white');
    });
  });

  describe('resign', () => {
    it('returns result resigned', () => {
      const game = new ChessGame();
      game.startGame();

      const result = game.resign();

      expect(result.result).toBe('resigned');
    });

    it('marks game as over after resignation', () => {
      const game = new ChessGame();
      game.startGame();
      game.resign();

      expect(game.isGameOver()).toBe(true);
    });
  });

  describe("checkmate detection (Scholar's mate)", () => {
    it("detects checkmate after Scholar's mate sequence", () => {
      const game = new ChessGame();
      game.startGame();

      game.makeMove('e4');
      game.makeMove('e5');
      game.makeMove('Bc4');
      game.makeMove('Nc6');
      game.makeMove('Qh5');
      game.makeMove('Nf6');

      const result = game.makeMove('Qxf7');

      expect(result.success).toBe(true);
      expect(result.game_over).toBe(true);
      expect(result.result).toBe('checkmate');
    });

    it('isGameOver returns true after checkmate', () => {
      const game = new ChessGame();
      game.startGame();

      game.makeMove('e4');
      game.makeMove('e5');
      game.makeMove('Bc4');
      game.makeMove('Nc6');
      game.makeMove('Qh5');
      game.makeMove('Nf6');
      game.makeMove('Qxf7');

      expect(game.isGameOver()).toBe(true);
    });
  });

  describe('getSummary', () => {
    it('returns summary after checkmate with winner and move count', () => {
      const game = new ChessGame();
      game.startGame();

      game.makeMove('e4');
      game.makeMove('e5');
      game.makeMove('Bc4');
      game.makeMove('Nc6');
      game.makeMove('Qh5');
      game.makeMove('Nf6');
      game.makeMove('Qxf7');

      const summary = game.getSummary();

      expect(summary.result).toBe('checkmate');
      expect(summary.winner).toBe('white');
      expect(summary.moves).toBe(4);
    });

    it('returns summary after resignation', () => {
      const game = new ChessGame();
      game.startGame('white');

      game.makeMove('e4');
      const summary_before = game.getSummary();
      expect(summary_before.result).toBe('in_progress');

      game.resign();

      const summary = game.getSummary();

      expect(summary.result).toBe('resigned');
      expect(summary.moves).toBe(1);
    });

    it('returns in_progress summary during active game', () => {
      const game = new ChessGame();
      game.startGame();
      game.makeMove('e4');

      const summary = game.getSummary();

      expect(summary.result).toBe('in_progress');
      expect(summary.moves).toBe(1);
      expect(summary.winner).toBeUndefined();
    });
  });
});

describe('ChessToolHandler', () => {
  describe('handleToolInvoke', () => {
    it('start_game returns initial board state', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-1', 'start_game', {});

      expect(result.board_fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
      expect(result.player_color).toBe('white');
      expect(result.status).toBe('in_progress');
    });

    it('start_game with color param', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-2', 'start_game', { color: 'black' });

      expect(result.player_color).toBe('black');
    });

    it('start_game supports local_computer mode', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('session-local', 'start_game', { mode: 'local_computer' });

      expect(result.mode).toBe('local_computer');
      expect(result.status).toBe('in_progress');
      expect(result.board_fen).toBeDefined();
    });

    it('make_move with valid move', async () => {
      const handler = new ChessToolHandler();
      await handler.handleToolInvoke('session-3', 'start_game', {});
      const result = await handler.handleToolInvoke('session-3', 'make_move', { move: 'e4' });

      expect(result.success).toBe(true);
      expect(result.board_fen).toContain('4P3');
      expect(result.game_over).toBe(false);
    });

    it('make_move with invalid move', async () => {
      const handler = new ChessToolHandler();
      await handler.handleToolInvoke('session-4', 'start_game', {});
      const result = await handler.handleToolInvoke('session-4', 'make_move', { move: 'e5' });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('get_board_state returns current state', async () => {
      const handler = new ChessToolHandler();
      await handler.handleToolInvoke('session-5', 'start_game', {});
      await handler.handleToolInvoke('session-5', 'make_move', { move: 'e4' });

      const result = await handler.handleToolInvoke('session-5', 'get_board_state', {});

      expect(result.board_fen).toBeDefined();
      expect(result.move_history).toEqual(['e4']);
      expect(result.current_turn).toBe('black');
      expect(result.material_balance).toBeDefined();
    });

    it('resign returns resigned result', async () => {
      const handler = new ChessToolHandler();
      await handler.handleToolInvoke('session-6', 'start_game', {});
      const result = await handler.handleToolInvoke('session-6', 'resign', {});

      expect(result.result).toBe('resigned');
    });

    it('tool on non-existent session returns error', async () => {
      const handler = new ChessToolHandler();
      const result = await handler.handleToolInvoke('no-such-session', 'make_move', { move: 'e4' });

      expect(result.error).toBeDefined();
    });

    it('unknown tool name returns error', async () => {
      const handler = new ChessToolHandler();
      await handler.handleToolInvoke('session-7', 'start_game', {});
      const result = await handler.handleToolInvoke('session-7', 'unknown_tool', {});

      expect(result.error).toBeDefined();
    });
  });

  describe('multiple simultaneous games', () => {
    it('different sessionIds maintain independent games', async () => {
      const handler = new ChessToolHandler();

      await handler.handleToolInvoke('game-a', 'start_game', { color: 'white' });
      await handler.handleToolInvoke('game-b', 'start_game', { color: 'black' });

      // Make different moves in each game
      await handler.handleToolInvoke('game-a', 'make_move', { move: 'e4' });
      await handler.handleToolInvoke('game-b', 'make_move', { move: 'd4' });

      const stateA = await handler.handleToolInvoke('game-a', 'get_board_state', {});
      const stateB = await handler.handleToolInvoke('game-b', 'get_board_state', {});

      expect(stateA.move_history).toEqual(['e4']);
      expect(stateB.move_history).toEqual(['d4']);
      expect(stateA.board_fen).not.toBe(stateB.board_fen);
    });
  });

  describe('getGame', () => {
    it('returns undefined for non-existent session', () => {
      const handler = new ChessToolHandler();
      expect(handler.getGame('non-existent')).toBeUndefined();
    });

    it('returns the game instance for an active session', async () => {
      const handler = new ChessToolHandler();
      await handler.handleToolInvoke('session-g', 'start_game', {});

      const game = handler.getGame('session-g');
      expect(game).toBeDefined();
      expect(game).toBeInstanceOf(ChessGame);
    });
  });
});
