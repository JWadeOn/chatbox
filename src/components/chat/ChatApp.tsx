'use client';

/**
 * ChatApp — top-level chat shell composing Chatbox-derived sidebar and chat window.
 */

import { useCallback, useState } from 'react';
import { SessionList } from '@/components/chatbox/SessionList';
import { useAuth } from '@/lib/auth-context';
import { ChatWindow } from './ChatWindow';

export function ChatApp() {
  const { token } = useAuth();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);

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
    <div className="flex h-screen">
      <SessionList activeId={activeConversationId} onSelect={setActiveConversationId} onNew={handleNew} />
      <main className="flex-1">
        {activeConversationId && token ? (
          <ChatWindow conversationId={activeConversationId} token={token} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h2 className="text-2xl font-semibold text-gray-800">ChatBridge</h2>
            <p className="mt-2 text-sm text-gray-500">Start a new conversation or select one from the sidebar</p>
            <button
              type="button"
              onClick={handleNew}
              className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              New Chat
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
