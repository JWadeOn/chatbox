'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool_result';
  content: string;
  streaming?: boolean;
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
  const wsRef = useRef<WebSocket | null>(null);
  const streamContentRef = useRef('');
  const streamIdRef = useRef('');

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

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/chat?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'stream_start':
          streamIdRef.current = data.messageId;
          streamContentRef.current = '';
          setStreaming(true);
          setMessages((prev) => [...prev, { id: data.messageId, role: 'assistant', content: '', streaming: true }]);
          break;

        case 'stream_chunk':
          streamContentRef.current += data.content;
          setMessages((prev) =>
            prev.map((m) => (m.id === streamIdRef.current ? { ...m, content: streamContentRef.current } : m))
          );
          break;

        case 'stream_end':
          setStreaming(false);
          setMessages((prev) => prev.map((m) => (m.id === streamIdRef.current ? { ...m, streaming: false } : m)));
          break;

        case 'tool_invoke':
          setMessages((prev) => [
            ...prev,
            {
              id: `tool-${Date.now()}`,
              role: 'system',
              content: `Invoking ${data.tool} on ${data.appId}...`,
            },
          ]);
          break;

        case 'app_render':
          setAppEmbed({
            appId: data.appId,
            appSlug: data.appSlug || 'app',
            iframeUrl: data.iframeUrl,
            sessionId: data.sessionId,
          });
          break;

        case 'error':
          setError(data.message);
          setStreaming(false);
          break;
      }
    };

    ws.onclose = () => {
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          setError('Connection lost. Refresh to reconnect.');
        }
      }, 3000);
    };

    return () => {
      ws.close();
    };
  }, [token]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected');
        return;
      }

      setMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: 'user', content }]);
      setError(null);

      wsRef.current.send(JSON.stringify({ type: 'user_message', conversationId, content }));
    },
    [conversationId]
  );

  const closeApp = useCallback(() => {
    setAppEmbed(null);
  }, []);

  return { messages, streaming, appEmbed, error, sendMessage, closeApp };
}
