/**
 * ChatBridge view-model types — derived from Chatbox's contentParts message model,
 * adapted for ChatBridge's server-authoritative architecture.
 *
 * These types decouple the presentation layer from the server's storage schema
 * and transport format. Components render ChatMessageViewModel; adapters translate
 * server responses into this shape.
 */

// ---------------------------------------------------------------------------
// Content Parts (inspired by Chatbox MessageContentPart)
// ---------------------------------------------------------------------------

export type MessageTextPart = {
  type: 'text';
  text: string;
};

export type MessageToolCallPart = {
  type: 'tool-call';
  state: 'call' | 'result' | 'error';
  toolCallId: string;
  appSlug: string;
  toolName: string;
  args: unknown;
  result?: unknown;
};

export type MessageInfoPart = {
  type: 'info';
  text: string;
};

export type MessageContentPart = MessageTextPart | MessageToolCallPart | MessageInfoPart;

// ---------------------------------------------------------------------------
// View Model
// ---------------------------------------------------------------------------

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type ChatMessageViewModel = {
  id: string;
  role: MessageRole;
  contentParts: MessageContentPart[];
  generating?: boolean;
  error?: string;
  timestamp?: number;
  isSummary?: boolean;
};

// ---------------------------------------------------------------------------
// App Session (client-side representation)
// ---------------------------------------------------------------------------

export type AppEmbedState = {
  appSlug: string;
  iframeUrl: string;
  sessionId: string;
};

// ---------------------------------------------------------------------------
// Transport Events (SSE stream from /api/chat)
// ---------------------------------------------------------------------------

export type StreamEventToolCall = {
  type: 'tool_call';
  appSlug: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
};

export type StreamEventAppRender = {
  type: 'app_render';
  appSlug: string;
  iframeUrl: string;
  sessionId: string;
};

export type StreamEventContent = {
  content: string;
};

export type StreamEventError = {
  error: string;
};

export type StreamEventDone = {
  done: true;
};

export type StreamEvent =
  | StreamEventToolCall
  | StreamEventAppRender
  | StreamEventContent
  | StreamEventError
  | StreamEventDone;

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Shape returned by GET /api/conversations/:id for each persisted message */
export type ServerMessage = {
  id: string;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

/** Convert a server-persisted message into the presentation view model. */
export function normalizeServerMessage(msg: ServerMessage): ChatMessageViewModel {
  const role = normalizeRole(msg.role);

  // Tool-result messages stored by the old format: "[appSlug] toolName(args) → result"
  if (role === 'system' && msg.content.startsWith('[')) {
    const toolPart = parseToolCallContent(msg.content);
    if (toolPart) {
      return {
        id: msg.id,
        role: 'tool',
        contentParts: [toolPart],
        timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : undefined,
      };
    }
  }

  return {
    id: msg.id,
    role,
    contentParts: [{ type: 'text', text: msg.content }],
    timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : undefined,
  };
}

/** Map a stream tool_call event into a view-model message. */
export function toolCallEventToMessage(event: StreamEventToolCall): ChatMessageViewModel {
  const part: MessageToolCallPart = {
    type: 'tool-call',
    state: event.result && typeof event.result === 'object' && 'error' in event.result ? 'error' : 'result',
    toolCallId: `tc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    appSlug: event.appSlug,
    toolName: event.toolName,
    args: event.args,
    result: event.result,
  };
  return {
    id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    role: 'tool',
    contentParts: [part],
  };
}

/** Create an empty assistant message for streaming accumulation. */
export function createStreamingAssistantMessage(id: string): ChatMessageViewModel {
  return {
    id,
    role: 'assistant',
    contentParts: [],
    generating: true,
  };
}

/** Create a user message view model from raw input. */
export function createUserMessage(content: string): ChatMessageViewModel {
  return {
    id: `user-${Date.now()}`,
    role: 'user',
    contentParts: [{ type: 'text', text: content }],
    timestamp: Date.now(),
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeRole(raw: string): MessageRole {
  switch (raw) {
    case 'user':
      return 'user';
    case 'assistant':
      return 'assistant';
    case 'tool_result':
    case 'tool':
      return 'tool';
    default:
      return 'system';
  }
}

/** Attempt to parse the legacy "[appSlug] toolName(args) → result" format. */
function parseToolCallContent(content: string): MessageToolCallPart | null {
  const match = content.match(/^\[(.+?)\] (.+?)\((.+?)\) → (.+)$/s);
  if (!match) return null;

  const [, appSlug, toolName, argsStr, resultStr] = match;
  let args: unknown;
  let result: unknown;
  try {
    args = JSON.parse(argsStr);
  } catch {
    args = argsStr;
  }
  try {
    result = JSON.parse(resultStr);
  } catch {
    result = resultStr;
  }

  return {
    type: 'tool-call',
    state: typeof result === 'object' && result !== null && 'error' in result ? 'error' : 'result',
    toolCallId: `legacy-${Date.now()}`,
    appSlug,
    toolName,
    args,
    result,
  };
}

// ---------------------------------------------------------------------------
// Content extraction helpers (for rendering)
// ---------------------------------------------------------------------------

/** Extract the concatenated text content from a message's content parts. */
export function getTextContent(msg: ChatMessageViewModel): string {
  return msg.contentParts
    .filter((p): p is MessageTextPart => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** Extract all tool-call parts from a message. */
export function getToolCallParts(msg: ChatMessageViewModel): MessageToolCallPart[] {
  return msg.contentParts.filter((p): p is MessageToolCallPart => p.type === 'tool-call');
}
