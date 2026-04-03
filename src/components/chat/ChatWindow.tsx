'use client';

import { useEffect, useRef } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { StreamingDots } from '@/components/ui/StreamingDots';
import { useChat } from '@/lib/use-chat';
import { AppRenderer } from './AppRenderer';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

const SUGGESTIONS = [
  { label: "Let's play chess", icon: '\u265E' },
  { label: "What's the weather in Austin?", icon: '\u2600' },
  { label: 'Help me study math', icon: '\u03C0' },
];

type ChatWindowProps = {
  conversationId: string;
  token: string;
};

export function ChatWindow({ conversationId, token }: ChatWindowProps) {
  const { messages, streaming, appEmbed, error, sendMessage, closeApp } = useChat({ conversationId, token });
  const scrollRef = useRef<HTMLDivElement>(null);

  const messageCount = messages.length;
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messageCount]);

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <h2 className="text-2xl font-semibold text-gray-800">ChatBridge</h2>
              <p className="mt-2 text-sm text-gray-500">Ask me anything, or try one of these:</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => sendMessage(s.label)}
                    className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 shadow-sm transition-all hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}

          {streaming && messages[messages.length - 1]?.content === '' && (
            <div className="flex justify-start">
              <StreamingDots />
            </div>
          )}

          {appEmbed && (
            <AppRenderer
              appSlug={appEmbed.appSlug}
              iframeUrl={appEmbed.iframeUrl}
              sessionId={appEmbed.sessionId}
              onToolResult={() => {}}
              onAppComplete={() => closeApp()}
              onAppError={() => closeApp()}
              onClose={closeApp}
            />
          )}

          {error && <ErrorMessage message={error} />}
        </div>
      </div>

      {/* Input area */}
      <MessageInput onSend={sendMessage} disabled={streaming} />
    </div>
  );
}
