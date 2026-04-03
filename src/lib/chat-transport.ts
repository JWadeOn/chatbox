/**
 * Chat transport client — owns SSE streaming and fetch logic.
 * Extracted from use-chat.ts to separate transport from state management.
 *
 * Derived from Chatbox's streaming architecture but adapted for
 * ChatBridge's server-authoritative SSE protocol.
 */

import type { ServerMessage, StreamEvent } from '@/types/chat';

type TransportCallbacks = {
  onEvent: (event: StreamEvent) => void;
  onError: (error: string) => void;
  onDone: () => void;
};

/** Fetch conversation history from the server. */
export async function fetchConversation(conversationId: string, token: string): Promise<{ messages: ServerMessage[] }> {
  const res = await fetch(`/api/conversations/${conversationId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load conversation');
  return res.json();
}

/**
 * Send a chat message and stream the SSE response.
 * Returns an abort function to cancel the stream.
 */
export function streamChatMessage(
  conversationId: string,
  content: string,
  token: string,
  callbacks: TransportCallbacks
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversationId, content }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Chat request failed' }));
        callbacks.onError(data.error || 'Chat request failed');
        callbacks.onDone();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        callbacks.onError('No response stream');
        callbacks.onDone();
        return;
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6);
          try {
            const data = JSON.parse(json) as StreamEvent;
            if ('done' in data && data.done) {
              callbacks.onDone();
              return;
            }
            callbacks.onEvent(data);
          } catch {
            // Skip malformed chunks
          }
        }
      }

      callbacks.onDone();
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      callbacks.onError(err instanceof Error ? err.message : 'Failed to send message');
      callbacks.onDone();
    }
  })();

  return () => controller.abort();
}
