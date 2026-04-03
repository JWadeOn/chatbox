'use client';

import { Chess } from 'chess.js';
import { useCallback, useEffect, useRef, useState } from 'react';

const PIECE_UNICODE: Record<string, string> = {
  K: '\u2654',
  Q: '\u2655',
  R: '\u2656',
  B: '\u2657',
  N: '\u2658',
  P: '\u2659',
  k: '\u265A',
  q: '\u265B',
  r: '\u265C',
  b: '\u265D',
  n: '\u265E',
  p: '\u265F',
};

const LIGHT = '#f0d9b5';
const DARK = '#b58863';
const HIGHLIGHT = '#829769';
const HIGHLIGHT_DARK = '#646d40';
const LAST_MOVE_LIGHT = '#cdd26a';
const LAST_MOVE_DARK = '#aaa23a';

function fenToBoard(fen: string): (string | null)[][] {
  const rows = fen.split(' ')[0].split('/');
  return rows.map((row) => {
    const cells: (string | null)[] = [];
    for (const ch of row) {
      if (ch >= '1' && ch <= '8') {
        for (let i = 0; i < Number.parseInt(ch, 10); i++) cells.push(null);
      } else {
        cells.push(ch);
      }
    }
    return cells;
  });
}

function toSquare(row: number, col: number, flipped: boolean): string {
  const r = flipped ? row : 7 - row;
  const c = flipped ? 7 - col : col;
  return `${'abcdefgh'[c]}${r + 1}`;
}

export default function ChessApp() {
  const gameRef = useRef(new Chess());
  const [fen, setFen] = useState(gameRef.current.fen());
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [selected, setSelected] = useState<string | null>(null);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [status, setStatus] = useState('Click a piece to start playing');
  const [gameOver, setGameOver] = useState(false);

  const flipped = playerColor === 'b';
  const board = fenToBoard(fen);

  const sendToParent = useCallback((msg: Record<string, unknown>) => {
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  }, []);

  const updateStatus = useCallback(() => {
    const game = gameRef.current;
    if (game.isCheckmate()) {
      const winner = game.turn() === 'w' ? 'Black' : 'White';
      setStatus(`Checkmate! ${winner} wins.`);
      setGameOver(true);
      sendToParent({
        jsonrpc: '2.0',
        method: 'app_complete',
        params: {
          summary: `Checkmate. ${winner} wins in ${Math.ceil(game.moveNumber())} moves.`,
          data: { result: 'checkmate', winner: winner.toLowerCase(), moves: game.moveNumber() },
        },
      });
    } else if (game.isDraw()) {
      setStatus('Draw!');
      setGameOver(true);
      sendToParent({
        jsonrpc: '2.0',
        method: 'app_complete',
        params: { summary: 'Game drawn.', data: { result: 'draw', moves: game.moveNumber() } },
      });
    } else if (game.isCheck()) {
      setStatus(`Check! ${game.turn() === 'w' ? 'White' : 'Black'} to move.`);
    } else {
      setStatus(`${game.turn() === 'w' ? 'White' : 'Black'} to move.`);
    }
  }, [sendToParent]);

  const tryMove = useCallback(
    (from: string, to: string) => {
      const game = gameRef.current;
      try {
        const move = game.move({ from, to, promotion: 'q' });
        if (move) {
          setFen(game.fen());
          setLastMove({ from, to });
          setSelected(null);
          updateStatus();
          sendToParent({
            jsonrpc: '2.0',
            method: 'app_state_update',
            params: {
              summary: `Move: ${move.san}`,
              board_fen: game.fen(),
              last_move: move.san,
            },
          });
          return true;
        }
      } catch {
        // Invalid move
      }
      return false;
    },
    [updateStatus, sendToParent]
  );

  const handleSquareClick = useCallback(
    (row: number, col: number) => {
      if (gameOver) return;
      const sq = toSquare(row, col, flipped);
      const game = gameRef.current;
      const piece = game.get(sq as Parameters<typeof game.get>[0]);

      if (selected) {
        // Try to move
        if (tryMove(selected, sq)) return;
        // If invalid move but clicked own piece, re-select
        if (piece && piece.color === game.turn()) {
          setSelected(sq);
          return;
        }
        setSelected(null);
      } else {
        // Select a piece (only own color on own turn)
        if (piece && piece.color === game.turn()) {
          setSelected(sq);
        }
      }
    },
    [selected, gameOver, flipped, tryMove]
  );

  // Handle postMessage from parent (tool invocations)
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data.method === 'tool_invoke') {
        const params = data.params as { tool: string; arguments: Record<string, unknown> };
        const id = data.id as number;

        if (params.tool === 'start_game') {
          const color = (params.arguments?.color as string)?.[0] || 'w';
          gameRef.current = new Chess();
          setPlayerColor(color === 'b' ? 'b' : 'w');
          setFen(gameRef.current.fen());
          setSelected(null);
          setLastMove(null);
          setGameOver(false);
          setStatus(`Game started! You are ${color === 'b' ? 'Black' : 'White'}.`);
          sendToParent({
            jsonrpc: '2.0',
            result: {
              board_fen: gameRef.current.fen(),
              player_color: color === 'b' ? 'black' : 'white',
              status: 'in_progress',
            },
            id,
          });
        } else if (params.tool === 'get_board_state') {
          const game = gameRef.current;
          sendToParent({
            jsonrpc: '2.0',
            result: {
              board_fen: game.fen(),
              move_history: game.history(),
              current_turn: game.turn() === 'w' ? 'white' : 'black',
            },
            id,
          });
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [sendToParent]);

  // Signal iframe_ready — retry until acknowledged
  useEffect(() => {
    const signal = () => sendToParent({ jsonrpc: '2.0', method: 'iframe_ready', params: {} });
    signal();
    const interval = setInterval(signal, 500);
    const timeout = setTimeout(() => clearInterval(interval), 15000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [sendToParent]);

  const displayBoard = flipped ? [...board].reverse().map((row) => [...row].reverse()) : board;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px',
        fontFamily: 'system-ui, sans-serif',
        background: '#fff',
        minHeight: '100vh',
      }}
    >
      <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#333' }}>{status}</div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 52px)',
          gridTemplateRows: 'repeat(8, 52px)',
          border: '2px solid #333',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {displayBoard.map((row, ri) =>
          row.map((piece, ci) => {
            const actualRow = flipped ? 7 - ri : ri;
            const actualCol = flipped ? 7 - ci : ci;
            const sq = toSquare(actualRow, actualCol, flipped);
            const isLight = (actualRow + actualCol) % 2 === 0;
            const isSelected = selected === sq;
            const isLastMove = lastMove && (sq === lastMove.from || sq === lastMove.to);

            let bg: string;
            if (isSelected) bg = isLight ? HIGHLIGHT : HIGHLIGHT_DARK;
            else if (isLastMove) bg = isLight ? LAST_MOVE_LIGHT : LAST_MOVE_DARK;
            else bg = isLight ? LIGHT : DARK;

            return (
              <button
                type="button"
                key={sq}
                onClick={() => handleSquareClick(actualRow, actualCol)}
                style={{
                  width: '52px',
                  height: '52px',
                  backgroundColor: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  padding: 0,
                  fontSize: '36px',
                  cursor: gameOver ? 'default' : 'pointer',
                  userSelect: 'none',
                  lineHeight: 1,
                }}
              >
                {piece ? PIECE_UNICODE[piece] : ''}
              </button>
            );
          })
        )}
      </div>

      <div style={{ marginTop: '8px', fontSize: '11px', color: '#999' }}>
        Move {gameRef.current.moveNumber()} &middot; {gameRef.current.history().length} moves played
      </div>

      {!gameOver && (
        <button
          type="button"
          onClick={() => {
            setGameOver(true);
            setStatus('You resigned.');
            sendToParent({
              jsonrpc: '2.0',
              method: 'app_complete',
              params: { summary: 'Player resigned.', data: { result: 'resigned' } },
            });
          }}
          style={{
            marginTop: '8px',
            padding: '6px 16px',
            fontSize: '12px',
            color: '#dc2626',
            background: 'transparent',
            border: '1px solid #dc2626',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          Resign
        </button>
      )}
    </div>
  );
}
