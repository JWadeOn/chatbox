'use client';

/**
 * ChatApp — top-level chat shell composing Chatbox-derived sidebar and chat window.
 */

import { useCallback, useEffect, useState } from 'react';
import { SessionList } from '@/components/chatbox/SessionList';
import { useAuth } from '@/lib/auth-context';
import { ChatWindow } from './ChatWindow';
import { IconChevronRight } from './SidebarToggleIcons';

export function ChatApp() {
  const { token } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Resume conversation after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conversationId');
    if (convId) {
      setActiveConversationId(convId);
      // Clean up URL without triggering navigation
      window.history.replaceState({}, '', '/');
    }
  }, []);

  const handleNew = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: null }),
      });
      if (res.ok) {
        const data = await res.json();
        setActiveConversationId(data.conversation.id);
      }
    } catch {
      // Handled by ChatWindow error state
    }
  }, [token]);

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <SessionList
          activeId={activeConversationId}
          onSelect={setActiveConversationId}
          onNew={handleNew}
          onRequestCollapse={() => setSidebarOpen(false)}
        />
      )}
      <main className="relative flex-1 overflow-hidden">
        {activeConversationId && token ? (
          <ChatWindow
            conversationId={activeConversationId}
            token={token}
            onExpandConversationList={sidebarOpen ? undefined : () => setSidebarOpen(true)}
          />
        ) : (
          <div className="relative flex h-full items-center justify-center overflow-hidden p-6 sm:p-10">
            {!sidebarOpen && (
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                title="Show conversation list"
                aria-label="Show conversation list"
                className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-xl border border-[rgba(19,34,56,0.1)] bg-white/90 px-3 py-2 text-sm font-medium text-[#132238] shadow-[0_8px_24px_rgba(19,34,56,0.1)] backdrop-blur-sm transition hover:border-[rgba(15,139,141,0.35)] hover:bg-white"
              >
                <IconChevronRight className="block" />
                <span className="hidden sm:inline">Conversations</span>
              </button>
            )}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(15,139,141,0.16),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(224,149,104,0.16),transparent_24%)]" />
            <div className="relative w-full max-w-3xl rounded-[2rem] border border-white/70 bg-[rgba(255,252,247,0.68)] p-8 text-center shadow-[0_24px_70px_rgba(19,34,56,0.14)] backdrop-blur-xl sm:p-12">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[rgba(19,34,56,0.08)] bg-white/70 px-4 py-1.5 text-xs uppercase tracking-[0.28em] text-[rgba(96,113,134,0.88)]">
                Learning workspace
              </div>
              <h2 className="mt-6 text-4xl font-semibold tracking-tight text-[#132238] sm:text-5xl">
                Chat that feels like a focused studio.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-[rgba(96,113,134,0.96)] sm:text-base">
                Start a fresh conversation, revisit an old one, or use app-powered workflows without leaving the thread.
              </p>

              <div className="mt-8 grid gap-3 text-left sm:grid-cols-3">
                <div className="rounded-[1.5rem] border border-[rgba(19,34,56,0.08)] bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[rgba(96,113,134,0.78)]">Chat</p>
                  <p className="mt-2 text-sm font-medium text-[#132238]">Fast prompts and cleaner message flow.</p>
                </div>
                <div className="rounded-[1.5rem] border border-[rgba(19,34,56,0.08)] bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[rgba(96,113,134,0.78)]">Apps</p>
                  <p className="mt-2 text-sm font-medium text-[#132238]">
                    Open tools in-context when a task needs more than text.
                  </p>
                </div>
                <div className="rounded-[1.5rem] border border-[rgba(19,34,56,0.08)] bg-white/75 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-[rgba(96,113,134,0.78)]">Continuity</p>
                  <p className="mt-2 text-sm font-medium text-[#132238]">
                    Keep conversations organized and easy to resume.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleNew}
                className="mt-10 inline-flex items-center gap-2 rounded-full bg-[#132238] px-6 py-3 text-sm font-medium text-white shadow-[0_16px_36px_rgba(19,34,56,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#0d1a2b]"
              >
                <span className="text-base leading-none">+</span>
                <span>Start a new chat</span>
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
