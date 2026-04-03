'use client';

import { useCallback, useRef, useState } from 'react';

type MessageInputProps = {
  onSend: (content: string) => void;
  disabled?: boolean;
};

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue('');
    inputRef.current?.focus();
  }, [value, disabled, onSend]);

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
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message ChatBridge..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition-colors focus:border-blue-500 disabled:opacity-50"
          style={{ maxHeight: '120px' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
