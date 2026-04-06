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
      className={`overflow-hidden rounded-[1.25rem] border text-xs shadow-[0_10px_24px_rgba(19,34,56,0.08)] ${
        isError
          ? 'border-red-200 bg-[rgba(255,245,244,0.92)]'
          : 'border-[rgba(15,139,141,0.12)] bg-[rgba(246,252,252,0.92)]'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={`flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors ${
          isError ? 'hover:bg-red-100/80' : 'hover:bg-[rgba(15,139,141,0.08)]'
        }`}
      >
        <span
          className={`flex-shrink-0 font-mono text-[10px] uppercase tracking-wider ${isError ? 'text-red-600' : 'text-[#0f8b8d]'}`}
        >
          {part.appSlug}
        </span>
        <span className={`flex-1 truncate ${isError ? 'text-red-700' : 'text-[#314357]'}`}>{summary}</span>
        {part.state === 'call' && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#0f8b8d]" />
        )}
        <span className={`flex-shrink-0 text-[10px] ${isError ? 'text-red-400' : 'text-[#0f8b8d]/60'}`}>
          {expanded ? '−' : '+'}
        </span>
      </button>

      {/* Inline action buttons for known link patterns */}
      {!expanded && !isError && (gameUrl || challengeUrl) && (
        <div className="flex gap-2 border-t border-[rgba(15,139,141,0.1)] px-3 py-2">
          {gameUrl && (
            <a
              href={gameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-[#132238] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#0d1a2b]"
            >
              Open on Lichess
            </a>
          )}
          {challengeUrl && challengeUrl !== gameUrl && (
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(challengeUrl)}
              className="inline-flex items-center rounded-full border border-[rgba(15,139,141,0.2)] bg-white px-3 py-1 text-[11px] font-medium text-[#0f8b8d] hover:bg-[rgba(15,139,141,0.06)]"
            >
              Copy challenge link
            </button>
          )}
        </div>
      )}

      {expanded && (
        <div className="border-t border-[rgba(15,139,141,0.1)] px-3 py-2">
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11px] text-[#607186]">
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
        <div className="mx-auto max-w-3xl space-y-2">
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
      <div className="mx-auto max-w-xl rounded-full border border-[rgba(19,34,56,0.08)] bg-white/70 px-4 py-2 text-center text-xs italic text-[rgba(96,113,134,0.86)] backdrop-blur">
        {text}
      </div>
    );
  }

  // User messages
  if (role === 'user') {
    const text = getTextContent(message);
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-2">
          <p className="text-right text-xs font-medium uppercase tracking-[0.22em] text-[rgba(96,113,134,0.78)]">You</p>
          <div className="rounded-[1.75rem] rounded-tr-md bg-[linear-gradient(135deg,#132238,#0f8b8d)] px-5 py-3 text-sm leading-7 text-white shadow-[0_18px_40px_rgba(19,34,56,0.18)]">
            {text}
          </div>
        </div>
      </div>
    );
  }

  // Assistant messages — render contentParts with Markdown
  const text = getTextContent(message);
  const toolParts = getToolCallParts(message);

  return (
    <div className="flex justify-start">
      <div className="max-w-[80%] space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(15,139,141,0.12)] text-sm font-semibold text-[#0f8b8d]">
            CB
          </div>
          <div>
            <p className="text-sm font-semibold text-[#132238]">ChatBridge</p>
            <p className="text-xs uppercase tracking-[0.22em] text-[rgba(96,113,134,0.72)]">Assistant</p>
          </div>
        </div>

        {/* Tool call parts inline with assistant response */}
        {toolParts.map((part) => (
          <ToolCallPartView key={part.toolCallId} part={part} />
        ))}

        {(text || generating) && (
          <div className="prose prose-sm max-w-none rounded-[1.75rem] rounded-tl-md border border-white/80 bg-[rgba(255,252,247,0.9)] px-5 py-4 text-[#132238] shadow-[0_14px_36px_rgba(19,34,56,0.08)] backdrop-blur">
            {text ? (
              <Markdown uniqueId={message.id} generating={generating}>
                {text}
              </Markdown>
            ) : generating ? (
              <span className="inline-flex items-center gap-1 text-[rgba(96,113,134,0.78)]">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#0f8b8d]" style={{ animationDelay: '0ms' }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#0f8b8d]" style={{ animationDelay: '150ms' }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-[#0f8b8d]" style={{ animationDelay: '300ms' }} />
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export const Message = memo(MessageComponent);
