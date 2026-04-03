/**
 * Transcript state adapter — manages the message list as ChatMessageViewModels.
 * Extracted from use-chat.ts to decouple UI state from transport.
 *
 * Derived from Chatbox's contentParts-based message model.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatMessageViewModel, MessageTextPart, ServerMessage, StreamEventToolCall } from '@/types/chat';
import {
  createStreamingAssistantMessage,
  createUserMessage,
  normalizeServerMessage,
  toolCallEventToMessage,
} from '@/types/chat';

export function useTranscriptStore() {
  const [messages, setMessages] = useState<ChatMessageViewModel[]>([]);
  const streamingMsgIdRef = useRef<string | null>(null);

  /** Replace transcript with server-loaded messages. */
  const loadMessages = useCallback((serverMessages: ServerMessage[]) => {
    setMessages(serverMessages.map(normalizeServerMessage));
  }, []);

  /** Clear all messages. */
  const clear = useCallback(() => {
    setMessages([]);
    streamingMsgIdRef.current = null;
  }, []);

  /** Optimistically add a user message and prepare an assistant placeholder. */
  const addUserMessage = useCallback((content: string): string => {
    const userMsg = createUserMessage(content);
    const assistantId = `assistant-${Date.now()}`;
    const assistantMsg = createStreamingAssistantMessage(assistantId);

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    streamingMsgIdRef.current = assistantId;
    return assistantId;
  }, []);

  /** Insert a tool-call message before the streaming assistant placeholder. */
  const insertToolCall = useCallback((event: StreamEventToolCall) => {
    const toolMsg = toolCallEventToMessage(event);
    setMessages((prev) => {
      const idx = prev.findIndex((m) => m.id === streamingMsgIdRef.current);
      if (idx >= 0) {
        const copy = [...prev];
        copy.splice(idx, 0, toolMsg);
        return copy;
      }
      return [...prev, toolMsg];
    });
  }, []);

  /** Append streamed text content to the assistant placeholder. */
  const appendStreamContent = useCallback((text: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== streamingMsgIdRef.current) return m;

        const parts = [...m.contentParts];
        const lastPart = parts[parts.length - 1];

        if (lastPart && lastPart.type === 'text') {
          // Append to existing text part
          const updated: MessageTextPart = { type: 'text', text: lastPart.text + text };
          return { ...m, contentParts: [...parts.slice(0, -1), updated] };
        }
        // Create new text part
        return { ...m, contentParts: [...parts, { type: 'text', text }] };
      })
    );
  }, []);

  /** Mark the streaming assistant message as done. */
  const finalizeStream = useCallback(() => {
    setMessages((prev) => prev.map((m) => (m.id === streamingMsgIdRef.current ? { ...m, generating: false } : m)));
    streamingMsgIdRef.current = null;
  }, []);

  /** Remove the assistant placeholder if it has no content (error case). */
  const removeEmptyAssistant = useCallback(() => {
    const id = streamingMsgIdRef.current;
    if (!id) return;
    setMessages((prev) => prev.filter((m) => m.id !== id || m.contentParts.length > 0));
    streamingMsgIdRef.current = null;
  }, []);

  return {
    messages,
    loadMessages,
    clear,
    addUserMessage,
    insertToolCall,
    appendStreamContent,
    finalizeStream,
    removeEmptyAssistant,
  };
}
