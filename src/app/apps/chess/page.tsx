'use client';

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
const SELECTED_LIGHT = '#829769';
const SELECTED_DARK = '#646d40';

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

function squareToAlgebraic(row: number, col: number, flipped: boolean): string {
  const r = flipped ? row : 7 - row;
  const c = flipped ? 7 - col : col;
  return `${'abcdefgh'[c]}${r + 1}`;
}

export default function ChessApp() {
  const [fen, setFen] = useState('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState('Waiting to start...');
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const readyRef = useRef(false);

  const flipped = playerColor === 'black';
  const board = fenToBoard(fen);

  // postMessage communication with parent
  const sendToParent = useCallback((msg: Record<string, unknown>) => {
    if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify(msg), '*');
    }
  }, []);

  // Handle incoming messages from platform
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (data.method === 'tool_invoke' && data.params) {
        const params = data.params as { tool: string; arguments: Record<string, unknown>; invocationId: string };
        const id = data.id as number;

        // Handle different tools
        switch (params.tool) {
          case 'start_game': {
            const color = (params.arguments?.color as string) || 'white';
            setPlayerColor(color === 'black' ? 'black' : 'white');
            setFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
            setStatus(`Game started! You are playing ${color}.`);
            setMoveHistory([]);
            setGameOver(false);
            sendToParent({
              jsonrpc: '2.0',
              result: {
                board_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                player_color: color,
                status: 'in_progress',
              },
              id,
            });
            break;
          }
          case 'make_move': {
            // Move result comes from server — update the board
            // The server handles validation, so we just accept the result
            break;
          }
          case 'get_board_state': {
            sendToParent({
              jsonrpc: '2.0',
              result: {
                board_fen: fen,
                move_history: moveHistory,
                current_turn: fen.split(' ')[1] === 'w' ? 'white' : 'black',
              },
              id,
            });
            break;
          }
          case 'resign': {
            setGameOver(true);
            setStatus('You resigned.');
            sendToParent({
              jsonrpc: '2.0',
              result: { result: 'resigned' },
              id,
            });
            sendToParent({
              jsonrpc: '2.0',
              method: 'app_complete',
              params: { summary: 'Player resigned.', data: { result: 'resigned' } },
            });
            break;
          }
        }
      }

      // Handle move results from server (forwarded via platform)
      if (data.jsonrpc === '2.0' && data.result && typeof data.result === 'object') {
        const result = data.result as Record<string, unknown>;
        if (result.board_fen) {
          setFen(result.board_fen as string);
          if (result.last_move) {
            setMoveHistory((prev) => [...prev, result.last_move as string]);
          }
          if (result.game_over) {
            setGameOver(true);
            setStatus(`Game over: ${result.result}`);
            sendToParent({
              jsonrpc: '2.0',
              method: 'app_complete',
              params: {
                summary: `Game ended: ${result.result}`,
                data: { result: result.result, moves: moveHistory.length + 1 },
              },
            });
          }
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [fen, moveHistory, sendToParent]);

  // Signal iframe_ready
  useEffect(() => {
    if (!readyRef.current) {
      readyRef.current = true;
      sendToParent({ jsonrpc: '2.0', method: 'iframe_ready', params: {} });
    }
  }, [sendToParent]);

  const handleSquareClick = useCallback(
    (row: number, col: number) => {
      if (gameOver) return;
      const sq = squareToAlgebraic(row, col, flipped);

      if (selected) {
        // Attempt move: selected → sq
        const move = `${selected}${sq}`;
        setStatus(`Moving ${move}...`);
        setSelected(null);

        // Tell parent about the move attempt (parent routes to server)
        sendToParent({
          jsonrpc: '2.0',
          method: 'app_state_update',
          params: { summary: `Player attempts move: ${move}`, move },
        });
      } else {
        // Select a piece
        const piece = board[row][col];
        if (piece) {
          setSelected(sq);
        }
      }
    },
    [selected, gameOver, flipped, board, sendToParent]
  );

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
      <div style={{ marginBottom: '12px', fontSize: '14px', color: '#555', textAlign: 'center' }}>{status}</div>

      {/* Board */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(8, 48px)',
          gridTemplateRows: 'repeat(8, 48px)',
          border: '2px solid #333',
          borderRadius: '4px',
          overflow: 'hidden',
        }}
      >
        {displayBoard.map((row, ri) =>
          row.map((piece, ci) => {
            const actualRow = flipped ? 7 - ri : ri;
            const actualCol = flipped ? 7 - ci : ci;
            const sq = squareToAlgebraic(actualRow, actualCol, flipped);
            const isLight = (actualRow + actualCol) % 2 === 0;
            const isSelected = selected === sq;
            const bg = isSelected ? (isLight ? SELECTED_LIGHT : SELECTED_DARK) : isLight ? LIGHT : DARK;

            return (
              <button
                type="button"
                key={sq}
                onClick={() => handleSquareClick(actualRow, actualCol)}
                style={{
                  width: '48px',
                  height: '48px',
                  backgroundColor: bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: 'none',
                  padding: 0,
                  fontSize: '32px',
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

      {/* Move history */}
      {moveHistory.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '12px', color: '#888', maxWidth: '384px', textAlign: 'center' }}>
          Moves: {moveHistory.join(', ')}
        </div>
      )}

      {/* Resign button */}
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
            marginTop: '12px',
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
