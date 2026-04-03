/**
 * Chatbox-derived InputBox component.
 *
 * Extracted and adapted from chatbox/src/renderer/components/InputBox/InputBox.tsx:
 *   - Auto-expanding textarea
 *   - Keyboard shortcuts: Enter to send, Shift+Enter for newline
 *   - Draft persistence to localStorage per session
 *   - Stop button during streaming
 *   - Tailwind CSS instead of MUI/Mantine
 *   - Removed: file upload, token counting, model selector, web browsing toggle
 *     (these can be added later as ChatBridge features mature)
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type InputBoxProps = {
  onSend: (content: string) => void;
  disabled?: boolean;
  streaming?: boolean;
  onStop?: () => void;
  sessionId?: string;
  placeholder?: string;
};

const DRAFT_PREFIX = 'chatbridge_draft_';

export function InputBox({
  onSend,
  disabled,
  streaming,
  onStop,
  sessionId,
  placeholder = 'Message ChatBridge...',
}: InputBoxProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const draftKeyRef = useRef<string | null>(null);

  // --- Draft persistence (derived from Chatbox useMessageInput) ---
  useEffect(() => {
    if (!sessionId) return;
    const key = `${DRAFT_PREFIX}${sessionId}`;
    draftKeyRef.current = key;

    const saved = localStorage.getItem(key);
    if (saved) setValue(saved);
    else setValue('');
  }, [sessionId]);

  useEffect(() => {
    if (!draftKeyRef.current) return;
    if (value) {
      localStorage.setItem(draftKeyRef.current, value);
    } else {
      localStorage.removeItem(draftKeyRef.current);
    }
  }, [value]);

  // --- Auto-expand textarea (derived from Chatbox) ---
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  // --- Send handler ---
  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    if (draftKeyRef.current) {
      localStorage.removeItem(draftKeyRef.current);
    }
    textareaRef.current?.focus();
  }, [value, disabled, onSend]);

  // --- Keyboard shortcuts (derived from Chatbox) ---
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-gray-200 bg-white p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled && !streaming}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 disabled:opacity-50"
          style={{ maxHeight: '200px' }}
        />
        {streaming ? (
          <button
            type="button"
            onClick={onStop}
            className="rounded-xl bg-red-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-red-600"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !value.trim()}
            className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        )}
      </div>
    </div>
  );
}
