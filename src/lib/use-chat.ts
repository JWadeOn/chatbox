'use client';

import { useCallback, useEffect, useState } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string;
};

type AppEmbed = {
  appId: string;
  appSlug: string;
  iframeUrl: string;
  sessionId: string;
};

type UseChatOptions = {
  conversationId: string;
  token: string;
};

export function useChat({ conversationId, token }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [appEmbed, setAppEmbed] = useState<AppEmbed | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load existing messages
  useEffect(() => {
    fetch(`/api/conversations/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as Message['role'],
              content: m.content,
            }))
          );
        }
      })
      .catch(() => setError('Failed to load conversation'));
  }, [conversationId, token]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (streaming) return;

      // Add user message immediately
      const userMsgId = `user-${Date.now()}`;
      setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content }]);
      setError(null);
      setStreaming(true);

      // Add empty assistant message for streaming
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }]);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ conversationId, content }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Chat request failed');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let assistantContent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const json = line.slice(6);
            try {
              const data = JSON.parse(json);
              if (data.type === 'tool_call') {
                // Insert a system message showing the tool invocation
                const toolMsg: Message = {
                  id: `tool-${Date.now()}-${Math.random()}`,
                  role: 'system',
                  content: `[${data.appSlug}] ${data.toolName}(${JSON.stringify(data.args)}) → ${JSON.stringify(data.result)}`,
                };
                setMessages((prev) => {
                  // Insert before the assistant placeholder
                  const idx = prev.findIndex((m) => m.id === assistantMsgId);
                  if (idx >= 0) {
                    const copy = [...prev];
                    copy.splice(idx, 0, toolMsg);
                    return copy;
                  }
                  return [...prev, toolMsg];
                });
              } else if (data.type === 'app_render') {
                setAppEmbed({
                  appId: data.appSlug,
                  appSlug: data.appSlug,
                  iframeUrl: data.iframeUrl,
                  sessionId: data.sessionId,
                });
              } else if (data.content) {
                assistantContent += data.content;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: assistantContent } : m))
                );
              }
              if (data.error) {
                setError(data.error);
              }
            } catch {
              // Skip malformed chunks
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
        // Remove empty assistant message on error
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId || m.content));
      } finally {
        setStreaming(false);
      }
    },
    [conversationId, token, streaming]
  );

  const closeApp = useCallback(() => {
    setAppEmbed(null);
  }, []);

  return { messages, streaming, appEmbed, error, sendMessage, closeApp };
}
