/**
 * Stream chunk processor — derived from Chatbox's stream-chunk-processor.ts.
 *
 * Adapted for ChatBridge's SSE event protocol. Converts a sequence of
 * StreamEvents into an evolving contentParts array suitable for rendering
 * via the ChatMessageViewModel model.
 *
 * Original: chatbox/src/renderer/stores/session/stream-chunk-processor.ts
 *
 * Key differences from Chatbox:
 *   - Input is ChatBridge StreamEvent (SSE), not Vercel AI SDK ModelStreamPart
 *   - No reasoning-delta or file handling (server-only LLM)
 *   - Tool calls come as complete events, not partial deltas
 */

import type { MessageContentPart, MessageTextPart, MessageToolCallPart, StreamEvent } from '@/types/chat';

export type StreamProcessorState = {
  contentParts: MessageContentPart[];
  currentTextPart: MessageTextPart | undefined;
};

export function createInitialState(): StreamProcessorState {
  return {
    contentParts: [],
    currentTextPart: undefined,
  };
}

/**
 * Process a single stream event, mutating and returning the state.
 * Returns { updated: true } when the contentParts changed and the UI should re-render.
 */
export function processStreamEvent(
  event: StreamEvent,
  state: StreamProcessorState
): { state: StreamProcessorState; updated: boolean } {
  const { contentParts } = state;
  let { currentTextPart } = state;

  // Text content chunk
  if ('content' in event && typeof event.content === 'string') {
    if (currentTextPart) {
      currentTextPart.text += event.content;
    } else {
      currentTextPart = { type: 'text', text: event.content };
      contentParts.push(currentTextPart);
    }
    return { state: { contentParts, currentTextPart }, updated: true };
  }

  // Tool call (complete invocation with result)
  if ('type' in event && event.type === 'tool_call') {
    currentTextPart = undefined;
    const toolPart: MessageToolCallPart = {
      type: 'tool-call',
      state: event.result && typeof event.result === 'object' && 'error' in event.result ? 'error' : 'result',
      toolCallId: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      appSlug: event.appSlug,
      toolName: event.toolName,
      args: event.args,
      result: event.result,
    };
    contentParts.push(toolPart);
    return { state: { contentParts, currentTextPart }, updated: true };
  }

  // Error
  if ('error' in event && typeof event.error === 'string') {
    return { state: { contentParts, currentTextPart }, updated: false };
  }

  // Done, app_render — no content change
  return { state: { contentParts, currentTextPart }, updated: false };
}
