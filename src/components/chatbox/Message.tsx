/**
 * Chatbox-derived Message component.
 *
 * Renders a ChatMessageViewModel using the contentParts model.
 * Replaces the old MessageBubble.tsx with richer, Chatbox-inspired rendering.
 *
 * Derived from chatbox/src/renderer/components/chat/Message.tsx:
 *   - Renders by content part type (text, tool-call, info)
 *   - Supports streaming indicator via `generating` flag
 *   - Markdown rendering for assistant messages via Chatbox-derived Markdown component
 */

'use client';

import { memo } from 'react';
import type { ChatMessageViewModel, MessageToolCallPart } from '@/types/chat';
import { getTextContent, getToolCallParts } from '@/types/chat';
import Markdown from './Markdown';

// ---------------------------------------------------------------------------
// Tool call renderer
// ---------------------------------------------------------------------------

function ToolCallPartView({ part }: { part: MessageToolCallPart }) {
  let parsedResult: Record<string, unknown> = {};
  if (part.result != null) {
    if (typeof part.result === 'object') {
      parsedResult = part.result as Record<string, unknown>;
    } else {
      parsedResult = { raw: String(part.result) };
    }
  }

  const isError = part.state === 'error' || 'error' in parsedResult;

  return (
    <div className="overflow-hidden rounded-lg border border-indigo-100 bg-indigo-50 text-xs">
      <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-100 px-3 py-1.5">
        <span className="font-semibold text-indigo-700">{part.appSlug}</span>
        <span className="text-indigo-500">{part.toolName}</span>
        {part.state === 'call' && (
          <span className="ml-auto inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
        )}
      </div>
      <div className="px-3 py-2">
        {isError ? (
          <span className="text-red-600">Error: {String(parsedResult.error || part.result)}</span>
        ) : part.state === 'call' ? (
          <span className="italic text-gray-500">Invoking...</span>
        ) : (
          <pre className="overflow-x-auto whitespace-pre-wrap text-gray-700">
            {JSON.stringify(parsedResult, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Message component
// ---------------------------------------------------------------------------

type MessageProps = {
  message: ChatMessageViewModel;
};

function MessageComponent({ message }: MessageProps) {
  const { role, contentParts, generating } = message;

  // Tool messages — render tool-call parts
  if (role === 'tool') {
    const toolParts = getToolCallParts(message);
    if (toolParts.length > 0) {
      return (
        <div className="mx-auto max-w-2xl space-y-2">
          {toolParts.map((part) => (
            <ToolCallPartView key={part.toolCallId} part={part} />
          ))}
        </div>
      );
    }
  }

  // System / info messages
  if (role === 'system') {
    const text = getTextContent(message);
    return (
      <div className="mx-auto max-w-lg rounded-md bg-gray-100 px-3 py-1.5 text-center text-xs text-gray-500 italic">
        {text}
      </div>
    );
  }

  // User messages
  if (role === 'user') {
    const text = getTextContent(message);
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-2xl bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white">
          {text}
        </div>
      </div>
    );
  }

  // Assistant messages — render contentParts with Markdown
  const text = getTextContent(message);
  const toolParts = getToolCallParts(message);

  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] space-y-2">
        {/* Tool call parts inline with assistant response */}
        {toolParts.map((part) => (
          <ToolCallPartView key={part.toolCallId} part={part} />
        ))}

        {/* Text content rendered as markdown */}
        {(text || generating) && (
          <div className="prose prose-sm rounded-2xl bg-gray-100 px-4 py-2.5 text-gray-900">
            {text ? (
              <Markdown uniqueId={message.id} generating={generating}>
                {text}
              </Markdown>
            ) : generating ? (
              <span className="inline-flex items-center gap-1 text-gray-400">
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
                <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
              </span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export const Message = memo(MessageComponent);
