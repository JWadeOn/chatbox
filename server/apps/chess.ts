import { Chess } from 'chess.js';
import { LichessClient } from '../lib/lichess-client';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export class ChessGame {
  private game: Chess;
  private playerColor: 'white' | 'black';
  private resigned: boolean;

  constructor() {
    this.game = new Chess();
    this.playerColor = 'white';
    this.resigned = false;
  }

  startGame(color?: 'white' | 'black'): { board_fen: string; player_color: string; status: string } {
    this.game = new Chess();
    this.playerColor = color ?? 'white';
    this.resigned = false;

    return {
      board_fen: this.game.fen(),
      player_color: this.playerColor,
      status: 'in_progress',
    };
  }

  makeMove(move: string): {
    success: boolean;
    board_fen: string;
    last_move?: string;
    game_over: boolean;
    result?: string;
    error?: string;
  } {
    // Try the move as-is (SAN notation) first
    try {
      const result = this.game.move(move);
      return this.buildMoveResult(result.san);
    } catch {
      // If that fails, try converting from UCI to { from, to } object
    }

    // Try UCI format: e.g. "e2e4" -> { from: "e2", to: "e4" }
    if (move.length >= 4 && move.length <= 5) {
      const from = move.slice(0, 2);
      const to = move.slice(2, 4);
      const promotion = move.length === 5 ? move[4] : undefined;
      try {
        const moveObj: { from: string; to: string; promotion?: string } = { from, to };
        if (promotion) {
          moveObj.promotion = promotion;
        }
        const result = this.game.move(moveObj);
        return this.buildMoveResult(result.san);
      } catch {
        // Fall through to error
      }
    }

    return {
      success: false,
      board_fen: this.game.fen(),
      game_over: this.game.isGameOver(),
      error: `Invalid move: ${move}`,
    };
  }

  getBoardState(): {
    board_fen: string;
    move_history: string[];
    current_turn: string;
    material_balance: Record<string, number>;
  } {
    return {
      board_fen: this.game.fen(),
      move_history: this.game.history(),
      current_turn: this.game.turn() === 'w' ? 'white' : 'black',
      material_balance: this.calculateMaterialBalance(),
    };
  }

  resign(): { result: string } {
    this.resigned = true;
    return { result: 'resigned' };
  }

  isGameOver(): boolean {
    return this.resigned || this.game.isGameOver();
  }

  getSummary(): { result: string; winner?: string; moves: number } {
    const history = this.game.history();
    const moveCount = Math.ceil(history.length / 2);

    if (this.resigned) {
      return { result: 'resigned', moves: moveCount };
    }

    if (this.game.isCheckmate()) {
      // The side whose turn it is has been checkmated, so the other side wins
      const winner = this.game.turn() === 'w' ? 'black' : 'white';
      return { result: 'checkmate', winner, moves: moveCount };
    }

    if (this.game.isDraw()) {
      if (this.game.isStalemate()) {
        return { result: 'stalemate', moves: moveCount };
      }
      if (this.game.isInsufficientMaterial()) {
        return { result: 'insufficient_material', moves: moveCount };
      }
      if (this.game.isThreefoldRepetition()) {
        return { result: 'threefold_repetition', moves: moveCount };
      }
      if (this.game.isDrawByFiftyMoves()) {
        return { result: 'fifty_move_rule', moves: moveCount };
      }
      return { result: 'draw', moves: moveCount };
    }

    return { result: 'in_progress', moves: moveCount };
  }

  private buildMoveResult(san: string): {
    success: boolean;
    board_fen: string;
    last_move?: string;
    game_over: boolean;
    result?: string;
    error?: string;
  } {
    const gameOver = this.game.isGameOver();
    const response: {
      success: boolean;
      board_fen: string;
      last_move?: string;
      game_over: boolean;
      result?: string;
      error?: string;
    } = {
      success: true,
      board_fen: this.game.fen(),
      last_move: san,
      game_over: gameOver,
    };

    if (gameOver) {
      if (this.game.isCheckmate()) {
        response.result = 'checkmate';
      } else if (this.game.isStalemate()) {
        response.result = 'stalemate';
      } else if (this.game.isDraw()) {
        response.result = 'draw';
      }
    }

    return response;
  }

  private calculateMaterialBalance(): Record<string, number> {
    const board = this.game.board();
    let white = 0;
    let black = 0;

    for (const row of board) {
      for (const square of row) {
        if (square) {
          const value = PIECE_VALUES[square.type] ?? 0;
          if (square.color === 'w') {
            white += value;
          } else {
            black += value;
          }
        }
      }
    }

    return { white, black, advantage: white - black };
  }
}

type LichessGameInfo = {
  gameId: string;
  mode: 'vs_computer' | 'vs_human';
  gameUrl: string;
  challengeUrl?: string;
  playerColor: string;
  level?: number;
};

export class ChessToolHandler {
  private games = new Map<string, ChessGame>();
  private lichessGames = new Map<string, LichessGameInfo>();
  private _lichessClient: LichessClient | null = null;

  private getLichessClient(): LichessClient | null {
    const token = process.env.LICHESS_API_TOKEN;
    if (!token) return null;
    if (!this._lichessClient) {
      this._lichessClient = new LichessClient(token);
    }
    return this._lichessClient;
  }

  async handleToolInvoke(
    sessionId: string,
    toolName: string,
    params: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    if (toolName === 'start_game') {
      return this.startGame(sessionId, params);
    }

    if (toolName === 'get_game_link') {
      return this.getGameLink(sessionId);
    }

    // Check Lichess games first
    const lichessGame = this.lichessGames.get(sessionId);
    if (lichessGame) {
      switch (toolName) {
        case 'get_board_state':
          return this.getLichessBoardState(lichessGame);
        case 'make_move':
          return { error: 'Moves are made on Lichess. Use the game link to play.' };
        case 'resign':
          this.lichessGames.delete(sessionId);
          return { result: 'abandoned', game_url: lichessGame.gameUrl };
        default:
          return { error: `Unknown tool: ${toolName}` };
      }
    }

    // Local tutoring game
    const game = this.games.get(sessionId);
    if (!game) {
      return { error: `No active game for session: ${sessionId}` };
    }

    switch (toolName) {
      case 'make_move':
        return game.makeMove(params.move as string);
      case 'get_board_state':
        return game.getBoardState();
      case 'resign':
        return game.resign();
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  private async startGame(sessionId: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const mode = (params.mode as string) || 'tutoring';
    const color = (params.color as 'white' | 'black') || 'white';

    if (mode === 'tutoring') {
      const game = new ChessGame();
      const result = game.startGame(color);
      this.games.set(sessionId, game);
      return result;
    }

    const client = this.getLichessClient();
    if (!client) {
      return { error: 'Lichess integration not configured. Set LICHESS_API_TOKEN environment variable.' };
    }

    try {
      if (mode === 'vs_computer') {
        const level = Math.max(1, Math.min(8, (params.level as number) ?? 3));
        const result = await client.createAIChallenge({ level, color });
        this.lichessGames.set(sessionId, {
          gameId: result.gameId,
          mode: 'vs_computer',
          gameUrl: result.gameUrl,
          playerColor: color,
          level,
        });
        return {
          mode: 'vs_computer',
          game_url: result.gameUrl,
          game_id: result.gameId,
          player_color: color,
          level,
          status: 'in_progress',
        };
      }

      if (mode === 'vs_human') {
        const result = await client.createOpenChallenge({ color: color ?? 'random' });
        this.lichessGames.set(sessionId, {
          gameId: result.gameId,
          mode: 'vs_human',
          gameUrl: result.gameUrl,
          challengeUrl: result.challengeUrl,
          playerColor: color ?? 'random',
        });
        return {
          mode: 'vs_human',
          game_url: result.gameUrl,
          challenge_url: result.challengeUrl,
          game_id: result.gameId,
          status: 'waiting_for_opponent',
        };
      }

      return { error: `Unknown mode: ${mode}. Use tutoring, vs_computer, or vs_human.` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lichess API error';
      return { error: msg };
    }
  }

  private async getLichessBoardState(info: LichessGameInfo): Promise<Record<string, unknown>> {
    const client = this.getLichessClient();
    if (!client) {
      return { error: 'Lichess client not available' };
    }

    try {
      const status = await client.getGameStatus(info.gameId);
      return {
        mode: info.mode,
        game_id: info.gameId,
        game_url: info.gameUrl,
        challenge_url: info.challengeUrl,
        fen: status.fen,
        status: status.status,
        winner: status.winner,
        moves: status.moves,
        game_over: status.gameOver,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch game status';
      return { error: msg };
    }
  }

  private getGameLink(sessionId: string): Record<string, unknown> {
    const lichessGame = this.lichessGames.get(sessionId);
    if (lichessGame) {
      return {
        game_url: lichessGame.gameUrl,
        challenge_url: lichessGame.challengeUrl,
        mode: lichessGame.mode,
      };
    }
    return { error: 'No active Lichess game. This tool is only for vs_computer and vs_human modes.' };
  }

  getGame(sessionId: string): ChessGame | undefined {
    return this.games.get(sessionId);
  }

  /** Get active game state for mid-app assistance context injection. */
  getActiveGameState(sessionId: string): {
    fen: string;
    turn: string;
    history: string[];
    material: string;
  } | null {
    // Check Lichess games
    const lichessGame = this.lichessGames.get(sessionId);
    if (lichessGame) {
      return {
        fen: 'Game on Lichess',
        turn: 'See Lichess',
        history: [],
        material: `Mode: ${lichessGame.mode}, URL: ${lichessGame.gameUrl}`,
      };
    }

    // Check local games
    const game = this.games.get(sessionId);
    if (!game || game.isGameOver()) return null;
    const state = game.getBoardState();
    const adv = state.material_balance.advantage;
    const material = adv > 0 ? `White +${adv}` : adv < 0 ? `Black +${-adv}` : 'even';
    return {
      fen: state.board_fen,
      turn: state.current_turn,
      history: state.move_history,
      material,
    };
  }
}
