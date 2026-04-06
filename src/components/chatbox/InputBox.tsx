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
    <div className="border-t border-[rgba(19,34,56,0.08)] bg-[rgba(255,252,247,0.7)] px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="rounded-[1.75rem] border border-white/80 bg-[rgba(255,255,255,0.82)] p-3 shadow-[0_20px_50px_rgba(19,34,56,0.12)]">
          <div className="flex items-end gap-3">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled && !streaming}
              rows={1}
              className="min-h-[52px] flex-1 resize-none rounded-[1.25rem] border border-[rgba(19,34,56,0.08)] bg-[rgba(247,243,237,0.9)] px-4 py-3 text-sm leading-6 text-[#132238] outline-none transition duration-200 placeholder:text-[rgba(96,113,134,0.74)] focus:border-[rgba(15,139,141,0.28)] focus:bg-white focus:ring-4 focus:ring-[rgba(15,139,141,0.12)] disabled:opacity-50"
              style={{ maxHeight: '200px' }}
            />
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="rounded-[1.25rem] bg-[#d65a4a] px-5 py-3 text-sm font-medium text-white transition duration-200 hover:bg-[#c44a3a]"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={disabled || !value.trim()}
                className="rounded-[1.25rem] bg-[#132238] px-5 py-3 text-sm font-medium text-white shadow-[0_16px_28px_rgba(19,34,56,0.18)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#0d1a2b] disabled:translate-y-0 disabled:opacity-50"
              >
                Send
              </button>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-xs text-[rgba(96,113,134,0.82)]">
            <span>Press Enter to send and Shift+Enter for a new line.</span>
            <span>{streaming ? 'Streaming response...' : 'Ready when you are'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
