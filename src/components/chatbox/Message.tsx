/**
 * Chatbox-derived Message component.
 *
 * Renders a ChatMessageViewModel using the contentParts model.
 * Replaces the old MessageBubble.tsx with richer, Chatbox-inspired rendering.
 *
 * Derived from chatbox/src/renderer/components/chat/Message.tsx:
 *   - Renders by content part type (text, tool-call, info)
 *   - Supports streaming indicator via `generating` flag
 *   - Markdown rendering for assistant messages via Chatbox-derived Markdown component
 */

'use client';

import { memo, useState } from 'react';
import type { ChatMessageViewModel, MessageToolCallPart } from '@/types/chat';
import { getTextContent, getToolCallParts } from '@/types/chat';
import Markdown from './Markdown';

// ---------------------------------------------------------------------------
// Tool call renderer
// ---------------------------------------------------------------------------

/** Build a human-readable one-line summary of a tool result. */
function buildSummary(appSlug: string, toolName: string, result: Record<string, unknown>): string {
  // Chess-specific summaries
  if (appSlug === 'chess') {
    if (toolName === 'start_game') {
      const mode = result.mode as string | undefined;
      if (mode === 'vs_computer') {
        return `Started game vs Stockfish (level ${result.level ?? '?'})`;
      }
      if (mode === 'vs_human') {
        return 'Created multiplayer challenge';
      }
      return `Started tutoring game — playing as ${result.player_color ?? 'white'}`;
    }
    if (toolName === 'make_move') {
      if (result.success) return `Played ${result.last_move}${result.game_over ? ` — ${result.result}` : ''}`;
      return `Invalid move: ${result.error}`;
    }
    if (toolName === 'get_board_state') {
      if (result.game_over) return `Game over: ${result.status}${result.winner ? ` (${result.winner} wins)` : ''}`;
      if (result.mode) return `Game status: ${result.status}`;
      return `Turn: ${result.current_turn}, ${(result.move_history as unknown[] | undefined)?.length ?? 0} moves played`;
    }
    if (toolName === 'resign') return 'Game resigned';
    if (toolName === 'get_game_link') return 'Retrieved game link';
  }

  // Khan-specific
  if (appSlug === 'khan') {
    if (toolName === 'open_topic') return `Opened topic: ${result.topic}`;
    if (toolName === 'explain_concept') return `Explained: ${result.concept}`;
    if (toolName === 'quiz') return 'Generated quiz question';
  }

  // Flashcards-specific
  if (appSlug === 'flashcards') {
    if (toolName === 'create_deck') {
      const deck = result.deck as { title?: string; cardCount?: number } | undefined;
      return `Created deck "${deck?.title}" (${deck?.cardCount} cards)`;
    }
    if (toolName === 'load_deck') {
      const deck = result.deck as { title?: string; cardCount?: number } | undefined;
      return `Loaded deck "${deck?.title}" (${deck?.cardCount} cards)`;
    }
    if (toolName === 'answer_card') return result.correct ? 'Correct answer' : `Incorrect (expected: ${result.expected})`;
    if (toolName === 'get_progress') {
      const sessions = result.sessions as unknown[] | undefined;
      return `Retrieved ${sessions?.length ?? 0} progress records`;
    }
  }

  // First Principles
  if (appSlug === 'firstprinciples' && toolName === 'analyze') {
    return `Analyzed: ${result.question}`;
  }

  return `${toolName} completed`;
}

function ToolCallPartView({ part }: { part: MessageToolCallPart }) {
  const [expanded, setExpanded] = useState(false);

  let parsedResult: Record<string, unknown> = {};
  if (part.result != null) {
    if (typeof part.result === 'object') {
      parsedResult = part.result as Record<string, unknown>;
    } else {
      parsedResult = { raw: String(part.result) };
    }
  }

  const isError = part.state === 'error' || 'error' in parsedResult;
  const summary = isError
    ? String(parsedResult.error || part.result)
    : part.state === 'call'
      ? 'Invoking...'
      : buildSummary(part.appSlug, part.toolName, parsedResult);

  // Extract shareable link if present (for chess Lichess modes)
  const gameUrl = parsedResult.game_url as string | undefined;
  const challengeUrl = parsedResult.challenge_url as string | undefined;

  return (
    <div
      className={`overflow-hidden rounded-lg border text-xs ${
        isError ? 'border-red-200 bg-red-50' : 'border-indigo-100 bg-indigo-50'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
          isError ? 'hover:bg-red-100' : 'hover:bg-indigo-100'
        }`}
      >
        <span className={`flex-shrink-0 font-mono text-[10px] uppercase tracking-wider ${isError ? 'text-red-600' : 'text-indigo-600'}`}>
          {part.appSlug}
        </span>
        <span className={`flex-1 truncate ${isError ? 'text-red-700' : 'text-gray-700'}`}>{summary}</span>
        {part.state === 'call' && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
        )}
        <span className={`flex-shrink-0 text-[10px] ${isError ? 'text-red-400' : 'text-indigo-400'}`}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {/* Inline action buttons for known link patterns */}
      {!expanded && !isError && (gameUrl || challengeUrl) && (
        <div className="flex gap-2 border-t border-indigo-100 px-3 py-1.5">
          {gameUrl && (
            <a
              href={gameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded bg-indigo-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-indigo-700"
            >
              Open on Lichess
            </a>
          )}
          {challengeUrl && challengeUrl !== gameUrl && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(challengeUrl)}
              className="inline-flex items-center rounded border border-indigo-300 bg-white px-2 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-50"
            >
              Copy challenge link
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t border-indigo-100 px-3 py-2">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-gray-600">
            {JSON.stringify(parsedResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Message component
// ---------------------------------------------------------------------------

type MessageProps = {
  message: ChatMessageViewModel;
};

function MessageComponent({ message }: MessageProps) {
  const { role, contentParts, generating } = message;

  // Tool messages — render tool-call parts
  if (role === 'tool') {
    const toolParts = getToolCallParts(message);
    if (toolParts.length > 0) {
      return (
        <div className="mx-auto max-w-2xl space-y-2">
          {toolParts.map((part) => (
            <ToolCallPartView key={part.toolCallId} part={part} />
          ))}
        </div>
      );
    }
  }

  // System / info messages
  if (role === 'system') {
    const text = getTextContent(message);
    return (
      <div className="mx-auto max-w-lg rounded-md bg-gray-100 px-3 py-1.5 text-center text-xs text-gray-500 italic">
        {text}
      </div>
    );
  }

  // User messages
  if (role === 'user') {
    const text = getTextContent(message);
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white">
          {text}
        </div>
      </div>
    );
  }

  // Assistant messages — render contentParts with Markdown
  const text = getTextContent(message);
  const toolParts = getToolCallParts(message);

  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] space-y-2">
        {/* Tool call parts inline with assistant response */}
        {toolParts.map((part) => (
          <ToolCallPartView key={part.toolCallId} part={part} />
        ))}

        {/* Text content rendered as markdown */}
        {(text || generating) && (
          <div className="prose prose-sm rounded-2xl bg-gray-100 px-4 py-2.5 text-gray-900">
            {text ? (
              <Markdown uniqueId={message.id} generating={generating}>
                {text}
              </Markdown>
            ) : generating ? (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export const Message = memo(MessageComponent);
