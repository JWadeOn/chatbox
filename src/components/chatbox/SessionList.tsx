/**
 * Chatbox-derived SessionList component.
 *
 * Adapted from chatbox/src/renderer/components/session/SessionList.tsx
 * and SessionItem.tsx:
 *   - Conversation list with active state highlighting
 *   - New chat creation
 *   - User info and logout in footer
 *   - Tailwind CSS instead of MUI/Mantine
 *   - Removed: drag-and-drop reordering, star/archive, context menu, search
 *     (these can be added as the product matures)
 *   - Removed: react-virtuoso (not needed until conversation list is large)
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

type Conversation = {
  id: string;
  title: string | null;
  updatedAt: string;
};

type SessionListProps = {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function SessionList({ activeId, onSelect, onNew }: SessionListProps) {
  const { token, user, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  const loadConversations = useCallback(() => {
    if (!token) return;
    fetch('/api/conversations', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setConversations(data.conversations || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Refresh when active conversation changes (new conversation created)
  useEffect(() => {
    loadConversations();
  }, [activeId, loadConversations]);

  return (
    <div className="flex h-full w-72 flex-col border-r border-white/10 bg-[#122033] text-white shadow-[18px_0_50px_rgba(9,18,30,0.24)]">
      <div className="border-b border-white/10 p-4">
        <div className="mb-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[rgba(214,225,241,0.66)]">Workspace</p>
          <span className="mt-2 block text-lg font-semibold tracking-tight text-white">ChatBridge</span>
        </div>
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[rgba(255,255,255,0.1)] px-3 py-3 text-sm font-medium text-white transition duration-200 hover:bg-[rgba(255,255,255,0.16)]"
        >
          <span className="text-base leading-none">+</span>
          <span>New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        {conversations.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-white/15 bg-white/5 p-4 text-center text-sm text-[rgba(214,225,241,0.62)]">
            No conversations yet
          </div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className={`mb-2 w-full rounded-[1.25rem] border px-3 py-3 text-left transition duration-200 ${
              activeId === conv.id
                ? 'border-transparent bg-[linear-gradient(135deg,rgba(96,220,198,0.18),rgba(255,255,255,0.08))] text-white shadow-[0_12px_28px_rgba(0,0,0,0.14)]'
                : 'border-white/6 bg-white/[0.04] text-[rgba(230,237,246,0.9)] hover:border-white/10 hover:bg-white/[0.08]'
            }`}
          >
            <div className="truncate text-sm font-medium">{conv.title || 'New Chat'}</div>
            <div className="mt-1 text-xs text-[rgba(214,225,241,0.56)]">
              {new Date(conv.updatedAt).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>

      <div className="border-t border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold text-white">
              {user?.displayName?.slice(0, 1).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user?.displayName}</div>
              <div className="truncate text-xs uppercase tracking-[0.2em] text-[rgba(214,225,241,0.54)]">
                {user?.role}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-[rgba(214,225,241,0.72)] transition hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
