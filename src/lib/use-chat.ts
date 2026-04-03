'use client';

/**
 * Composite chat hook — composes transport, transcript, and app orchestrator.
 *
 * Each concern is a separate module:
 *   - chat-transport.ts     → SSE streaming and fetch logic
 *   - transcript-store.ts   → message state (ChatMessageViewModel)
 *   - app-orchestrator.ts   → app lifecycle coordination
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppEmbedState, ChatMessageViewModel, StreamEvent } from '@/types/chat';
import { useAppOrchestrator } from './app-orchestrator';
import { fetchConversation, streamChatMessage } from './chat-transport';
import { useTranscriptStore } from './transcript-store';

type UseChatOptions = {
  conversationId: string;
  token: string;
};

export type UseChatReturn = {
  messages: ChatMessageViewModel[];
  streaming: boolean;
  appEmbed: AppEmbedState | null;
  error: string | null;
  sendMessage: (content: string) => void;
  closeApp: () => void;
  handleAppComplete: (summary: string, data: Record<string, unknown>) => void;
  handleAppError: (message: string, recoverable: boolean) => void;
};

export function useChat({ conversationId, token }: UseChatOptions): UseChatReturn {
  const transcript = useTranscriptStore();
  const app = useAppOrchestrator();
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<(() => void) | null>(null);

  // Reset and load conversation when ID changes.
  // Adapter functions are stable refs — only conversationId/token should trigger re-runs.
  // biome-ignore lint/correctness/useExhaustiveDependencies: stable adapter refs excluded intentionally
  useEffect(() => {
    transcript.clear();
    app.reset();
    setError(null);
    setStreaming(false);
    abortRef.current?.();

    fetchConversation(conversationId, token)
      .then((data) => {
        if (data.messages) {
          transcript.loadMessages(data.messages);
        }
      })
      .catch(() => setError('Failed to load conversation'));
  }, [conversationId, token]);

  const sendMessage = useCallback(
    (content: string) => {
      if (streaming) return;

      transcript.addUserMessage(content);
      setError(null);
      setStreaming(true);

      const abort = streamChatMessage(conversationId, content, token, {
        onEvent: (event: StreamEvent) => {
          if ('type' in event) {
            if (event.type === 'tool_call') {
              transcript.insertToolCall(event);
            } else if (event.type === 'app_render') {
              app.handleAppRender(event);
            }
          }
          if ('content' in event && typeof event.content === 'string') {
            transcript.appendStreamContent(event.content);
          }
          if ('error' in event && typeof event.error === 'string') {
            setError(event.error);
          }
        },
        onError: (errMsg: string) => {
          setError(errMsg);
          transcript.removeEmptyAssistant();
        },
        onDone: () => {
          transcript.finalizeStream();
          setStreaming(false);
        },
      });

      abortRef.current = abort;
    },
    [conversationId, token, streaming, transcript, app]
  );

  return {
    messages: transcript.messages,
    streaming,
    appEmbed: app.appEmbed,
    error,
    sendMessage,
    closeApp: app.closeApp,
    handleAppComplete: app.handleAppComplete,
    handleAppError: app.handleAppError,
  };
}
