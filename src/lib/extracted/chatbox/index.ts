/**
 * Chatbox-extracted utilities barrel export.
 *
 * All modules in this directory are derived from the chatbox/ reference
 * codebase, adapted for ChatBridge's server-authoritative architecture.
 * No runtime imports from chatbox/ — these are owned copies.
 */

export { estimateTokens, estimateConversationTokens } from './token-estimation';
export {
  checkCompactionNeeded,
  buildContext,
  cleanToolCallParts,
  OUTPUT_RESERVE_TOKENS,
  DEFAULT_COMPACTION_THRESHOLD,
  DEFAULT_CONTEXT_WINDOW,
  KEEP_RECENT_MESSAGES,
} from './context-management';
export { createInitialState, processStreamEvent } from './stream-processor';
export type { StreamProcessorState } from './stream-processor';
export type { CompactionCheckResult } from './context-management';
