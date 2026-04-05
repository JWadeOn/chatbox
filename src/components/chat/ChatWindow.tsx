'use client';

/**
 * ChatWindow — main chat view composing Chatbox-derived components.
 *
 * Uses the refactored useChat hook (adapter-based) and renders messages
 * via the Chatbox-derived Message component with contentParts model.
 */

import { useEffect, useRef } from 'react';
import { InputBox } from '@/components/chatbox/InputBox';
import { CodeCollapseProvider } from '@/components/chatbox/Markdown';
import { Message } from '@/components/chatbox/Message';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { useChat } from '@/lib/use-chat';
import { AppRenderer } from './AppRenderer';

const SUGGESTIONS = [
  { label: "Let's play chess", icon: '\u265E' },
  { label: 'Teach me about photosynthesis', icon: '\u{1F4D6}' },
  { label: 'Create flashcards for vocabulary', icon: '\u{1F4DD}' },
  { label: 'Break down: Why is the sky blue?', icon: '\u{1F9E0}' },
];

type ChatWindowProps = {
  conversationId: string;
  token: string;
};

export function ChatWindow({ conversationId, token }: ChatWindowProps) {
  const { messages, streaming, appEmbed, error, sendMessage, closeApp, handleAppComplete, handleAppError } = useChat({
    conversationId,
    token,
  });
  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on message count change
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

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

          <CodeCollapseProvider defaultCollapsed>
            {messages.map((msg) => (
              <Message key={msg.id} message={msg} />
            ))}
          </CodeCollapseProvider>

          {appEmbed && (
            <AppRenderer
              appSlug={appEmbed.appSlug}
              iframeUrl={appEmbed.iframeUrl}
              sessionId={appEmbed.sessionId}
              onToolResult={() => {}}
              onAppComplete={(summary, data) => handleAppComplete(summary, data)}
              onAppError={(message, recoverable) => handleAppError(message, recoverable)}
              onClose={closeApp}
            />
          )}

          {error && <ErrorMessage message={error} />}
        </div>
      </div>

      {/* Input area — Chatbox-derived InputBox */}
      <InputBox onSend={sendMessage} disabled={streaming} streaming={streaming} sessionId={conversationId} />
    </div>
  );
}
