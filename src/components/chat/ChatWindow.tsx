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
import { IconChevronRight } from './SidebarToggleIcons';

const SUGGESTIONS = [
  { label: "Let's play chess", icon: '\u265E' },
  { label: 'Teach me about photosynthesis', icon: '\u{1F4D6}' },
  { label: 'Plan my study schedule for this week', icon: '\u{1F4C5}' },
  { label: 'Break down: Why is the sky blue?', icon: '\u{1F9E0}' },
];

type ChatWindowProps = {
  conversationId: string;
  token: string;
  /** Shown when the conversation list sidebar is hidden so the user can open it again. */
  onExpandConversationList?: () => void;
};

export function ChatWindow({ conversationId, token, onExpandConversationList }: ChatWindowProps) {
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
      <div className="border-b border-[rgba(19,34,56,0.08)] bg-[rgba(255,252,247,0.62)] px-6 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {onExpandConversationList && (
              <button
                type="button"
                onClick={onExpandConversationList}
                title="Show conversation list"
                aria-label="Show conversation list"
                className="shrink-0 rounded-xl border border-[rgba(19,34,56,0.12)] bg-white/80 p-2 text-[#132238] shadow-sm transition hover:border-[rgba(15,139,141,0.35)] hover:bg-white"
              >
                <IconChevronRight className="block" />
              </button>
            )}
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.24em] text-[rgba(96,113,134,0.82)]">Active workspace</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[#132238]">ChatBridge Studio</h2>
            </div>
          </div>
          <div className="rounded-full border border-[rgba(19,34,56,0.08)] bg-white/75 px-3 py-1.5 text-xs font-medium text-[rgba(96,113,134,0.92)]">
            Conversation ready
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
        style={{
          background:
            'radial-gradient(circle at top, rgba(15, 139, 141, 0.08), transparent 20%), radial-gradient(circle at bottom right, rgba(224, 149, 104, 0.12), transparent 22%)',
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-5">
          {messages.length === 0 && !streaming && (
            <div className="rounded-[2rem] border border-white/70 bg-[rgba(255,252,247,0.78)] px-6 py-10 text-center shadow-[0_24px_70px_rgba(19,34,56,0.12)] backdrop-blur-xl sm:px-10">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(19,34,56,0.08)] bg-white/80 px-4 py-1.5 text-xs uppercase tracking-[0.26em] text-[rgba(96,113,134,0.86)]">
                Start here
              </div>
              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[#132238] sm:text-5xl">
                Ask, explore, then open an app when you need it.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[rgba(96,113,134,0.96)] sm:text-base">
                Try a starter below for a smoother first interaction, or jump straight into your own question.
              </p>
              <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => sendMessage(s.label)}
                    className="group flex min-h-24 items-start gap-4 rounded-[1.5rem] border border-[rgba(19,34,56,0.08)] bg-white/80 px-5 py-4 text-left text-sm text-[#132238] shadow-[0_12px_30px_rgba(19,34,56,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-[rgba(15,139,141,0.28)] hover:shadow-[0_18px_36px_rgba(19,34,56,0.12)]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(15,139,141,0.1)] text-xl transition group-hover:bg-[rgba(15,139,141,0.16)]">
                      {s.icon}
                    </span>
                    <span className="pt-1 font-medium leading-6">{s.label}</span>
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
              iframeToolRelay={appEmbed.iframeToolRelay}
              token={token}
              onAppComplete={(summary, data) => handleAppComplete(summary, data)}
              onAppError={(message, recoverable) => handleAppError(message, recoverable)}
              onClose={closeApp}
            />
          )}

          {error && <ErrorMessage message={error} />}
        </div>
      </div>

      <InputBox onSend={sendMessage} disabled={streaming} streaming={streaming} sessionId={conversationId} />
    </div>
  );
}
