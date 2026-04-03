'use client';

import { useEffect, useRef } from 'react';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { StreamingDots } from '@/components/ui/StreamingDots';
import { useChat } from '@/lib/use-chat';
import { AppRenderer } from './AppRenderer';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';

type ChatWindowProps = {
  conversationId: string;
  token: string;
};

export function ChatWindow({ conversationId, token }: ChatWindowProps) {
  const { messages, streaming, appEmbed, error, sendMessage, closeApp } = useChat({ conversationId, token });
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <h2 className="text-2xl font-semibold text-gray-800">ChatBridge</h2>
              <p className="mt-2 text-sm text-gray-500">Ask me anything, or try &quot;let&apos;s play chess&quot;</p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}

          {streaming && (
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
