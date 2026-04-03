/**
 * Context management — derived from Chatbox's context-management package.
 *
 * Adapted for ChatBridge's server-authoritative architecture:
 *   - Context building logic runs on the server, not the client
 *   - Compaction uses app_complete summaries (not LLM-generated client-side summaries)
 *   - Tool cleanup removes old tool-call content parts to save context space
 *
 * Original:
 *   chatbox/src/renderer/packages/context-management/context-builder.ts
 *   chatbox/src/renderer/packages/context-management/compaction-detector.ts
 *   chatbox/src/renderer/packages/context-management/tool-cleanup.ts
 */

import type { ChatMessageViewModel, MessageContentPart } from '@/types/chat';
import { estimateTokens } from './token-estimation';

// ---------------------------------------------------------------------------
// Constants (derived from Chatbox compaction-detector.ts)
// ---------------------------------------------------------------------------

/** Reserve tokens for model output. */
export const OUTPUT_RESERVE_TOKENS = 4096;

/** Default threshold: compact when context reaches 80% of window. */
export const DEFAULT_COMPACTION_THRESHOLD = 0.8;

/** Default context window size for chat models. */
export const DEFAULT_CONTEXT_WINDOW = 128000;

/** Number of recent messages to always keep in context. */
export const KEEP_RECENT_MESSAGES = 10;

// ---------------------------------------------------------------------------
// Compaction detection (derived from Chatbox)
// ---------------------------------------------------------------------------

export type CompactionCheckResult = {
  isOverflow: boolean;
  currentTokens: number;
  thresholdTokens: number;
};

/**
 * Check if the conversation context exceeds the compaction threshold.
 * Derived from Chatbox's checkOverflow().
 */
export function checkCompactionNeeded(
  messages: { role: string; content: string }[],
  contextWindow: number = DEFAULT_CONTEXT_WINDOW,
  threshold: number = DEFAULT_COMPACTION_THRESHOLD
): CompactionCheckResult {
  const thresholdTokens = Math.floor((contextWindow - OUTPUT_RESERVE_TOKENS) * threshold);
  let currentTokens = 3; // conversation overhead

  for (const msg of messages) {
    currentTokens += estimateTokens(msg.content);
  }

  return {
    isOverflow: currentTokens >= thresholdTokens,
    currentTokens,
    thresholdTokens,
  };
}

// ---------------------------------------------------------------------------
// Context building (derived from Chatbox context-builder.ts)
// ---------------------------------------------------------------------------

/**
 * Build the context messages for an LLM call.
 *
 * Strategy (aligned with Chatbox):
 *   1. Always include system message(s)
 *   2. If there's a compaction summary, include it as a boundary
 *   3. Include the last N messages after the boundary
 *   4. Clean tool-call parts from older messages
 *
 * In ChatBridge, this runs server-side. The function is extracted here
 * for shared use and testing.
 */
export function buildContext(
  messages: ChatMessageViewModel[],
  maxMessages: number = KEEP_RECENT_MESSAGES
): ChatMessageViewModel[] {
  if (messages.length === 0) return [];

  // Find the latest summary message (compaction boundary)
  let boundaryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].isSummary) {
      boundaryIndex = i;
      break;
    }
  }

  // Collect system messages (always included)
  const systemMessages = messages.filter((m) => m.role === 'system' && !m.isSummary);

  // Messages after the boundary (or all if no boundary)
  const startIndex = boundaryIndex >= 0 ? boundaryIndex : 0;
  let contextMessages = messages.slice(startIndex);

  // Limit to maxMessages (keep the most recent)
  if (contextMessages.length > maxMessages) {
    contextMessages = contextMessages.slice(-maxMessages);
  }

  // Prepend system messages if not already included
  const contextIds = new Set(contextMessages.map((m) => m.id));
  const missingSystem = systemMessages.filter((m) => !contextIds.has(m.id));

  return [...missingSystem, ...contextMessages];
}

// ---------------------------------------------------------------------------
// Tool cleanup (derived from Chatbox tool-cleanup.ts)
// ---------------------------------------------------------------------------

/**
 * Remove tool-call content parts from messages older than the specified
 * number of rounds. This reduces context size while keeping recent tool
 * interactions visible.
 *
 * Derived from Chatbox's cleanToolCalls().
 */
export function cleanToolCallParts(
  messages: ChatMessageViewModel[],
  keepRounds: number = 2
): ChatMessageViewModel[] {
  // Find the boundary: everything before the Nth-from-last user message gets cleaned.
  // If there aren't enough rounds, keep everything (boundaryIndex = -1 means nothing is old).
  let userCount = 0;
  let boundaryIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      userCount++;
      if (userCount > keepRounds) {
        boundaryIndex = i;
        break;
      }
    }
  }

  // If no boundary found, all messages are within keepRounds — nothing to clean
  if (boundaryIndex < 0) return messages;

  return messages.map((msg, idx) => {
    if (idx >= boundaryIndex) return msg;
    if (msg.role !== 'tool' && msg.role !== 'assistant') return msg;

    const hasToolParts = msg.contentParts.some((p) => p.type === 'tool-call');
    if (!hasToolParts) return msg;

    // Remove tool-call parts, keep text/info parts
    const cleanedParts: MessageContentPart[] = msg.contentParts.filter((p) => p.type !== 'tool-call');
    if (cleanedParts.length === 0) {
      // Replace with a summary info part
      return {
        ...msg,
        contentParts: [{ type: 'info' as const, text: '[tool interaction removed for context]' }],
      };
    }
    return { ...msg, contentParts: cleanedParts };
  });
}
