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
    <div className="flex h-full w-64 flex-col border-r border-gray-200 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-3">
        <span className="text-sm font-semibold text-gray-700">ChatBridge</span>
        <button
          type="button"
          onClick={onNew}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="p-3 text-center text-xs text-gray-400">No conversations yet</p>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            type="button"
            onClick={() => onSelect(conv.id)}
            className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
              activeId === conv.id
                ? 'bg-blue-100 text-blue-800'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <div className="truncate">{conv.title || 'New Chat'}</div>
            <div className="text-xs text-gray-400">
              {new Date(conv.updatedAt).toLocaleDateString()}
            </div>
          </button>
        ))}
      </div>

      {/* User info footer */}
      <div className="border-t border-gray-200 p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-700">{user?.displayName}</div>
            <div className="truncate text-xs text-gray-400">{user?.role}</div>
          </div>
          <button
            type="button"
            onClick={logout}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
