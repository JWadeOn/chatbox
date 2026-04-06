# ChatBridge App Integration Guide

> One-page reference for building a third-party app that runs inside ChatBridge.

## How It Works

Your app runs in a **sandboxed iframe**. The platform loads it when the LLM calls one of your tools. You communicate with the host via **JSON-RPC 2.0 over `postMessage`**. The LLM never calls your app directly -- the platform mediates everything.

```
User -> Chat -> LLM -> tool call -> ToolRouter -> iframe loads your app
                                                    |
                                          postMessage (JSON-RPC 2.0)
                                                    |
                                              Your App (iframe)
```

## 1. Register Your App

```
POST /api/apps/register
Authorization: Bearer <operator-jwt>
Content-Type: application/json

{
  "slug": "myapp",
  "name": "My App",
  "description": "Short description for the LLM",
  "authType": "none",               // "none" | "platform" | "oauth"
  "iframeUrl": "/apps/myapp",       // internal: /apps/*  |  external: https://...
  "toolSchemas": [
    {
      "name": "do_thing",
      "description": "What this tool does (max 200 chars, no prompt injection)",
      "parameters": {
        "type": "object",
        "properties": {
          "input": { "type": "string", "description": "The input value" }
        },
        "required": ["input"]
      }
    }
  ]
}
```

Tools are namespaced automatically: `myapp__do_thing`. Descriptions are sanitized (injection patterns stripped, 200-char max).

## 2. Build Your Iframe Page

Your app receives `sessionId` via URL query param: `/apps/myapp?sessionId=<uuid>`.

### Minimal Template

```typescript
// src/app/apps/myapp/page.tsx
'use client';
import { useEffect, useCallback } from 'react';

export default function MyApp() {
  const sessionId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('sessionId') ?? ''
    : '';

  const send = useCallback((msg: Record<string, unknown>) => {
    window.parent.postMessage(JSON.stringify(msg), '*');
  }, []);

  // Step 1: Signal ready
  useEffect(() => {
    const signal = () => send({ jsonrpc: '2.0', method: 'iframe_ready', params: { sessionId } });
    signal();
    const iv = setInterval(signal, 500);       // retry until ack'd
    const to = setTimeout(() => clearInterval(iv), 15000);
    return () => { clearInterval(iv); clearTimeout(to); };
  }, [send, sessionId]);

  // Step 2: Handle tool invocations
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (data.method !== 'tool_invoke') return;

      const { tool, arguments: args, invocationId } = data.params;
      const id = data.id;

      // --- Your logic here ---
      const result = { greeting: `Hello, ${args.input}!` };

      // Step 3: Return result
      send({ jsonrpc: '2.0', result: { sessionId, invocationId, ...result }, id });

      // Step 4: Signal completion with context summary
      send({
        jsonrpc: '2.0',
        method: 'app_complete',
        params: {
          sessionId,
          summary: `Greeted ${args.input}.`,           // <-- goes into LLM context
          data: result,                                  // <-- optional structured data
        },
      });
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [send, sessionId]);

  return <div>My App UI</div>;
}
```

## 3. Message Protocol Reference

### App -> Platform

| Method | When | Payload |
|--------|------|---------|
| `iframe_ready` | On mount (retry every 500ms) | `{ sessionId }` |
| `tool_invoke` result | After processing a tool call | `{ sessionId, invocationId, ...yourResult }` |
| `app_state_update` | Mid-session state changes | `{ sessionId, summary, ...stateData }` |
| `app_complete` | Session done | `{ sessionId, summary, data? }` |
| `app_error` | Unrecoverable error | `{ sessionId, error, code? }` |

### Platform -> App

| Method | When | Payload |
|--------|------|---------|
| `tool_invoke` | LLM called your tool | `{ tool, arguments, invocationId }` |

## 4. Lifecycle & State Machine

```
IDLE --[LLM calls tool]--> TOOL_REQUESTED --[iframe loads]--> APP_RENDERED
     --[iframe_ready]--> ACTIVE --[app_complete]--> COMPLETED --> IDLE
                                --[app_error]----> ERROR -------> IDLE
                                --[15s timeout]--> TIMEOUT -----> IDLE
```

- **Single-active-app rule:** Only one app session per conversation. New app terminates previous.
- **Completion summary** replaces raw tool history in LLM context (token efficiency).
- **Duplicate `app_complete`** on an already-completed session is safely ignored.

## 5. Security Rules

| App Type | Sandbox | `allow-same-origin` |
|----------|---------|---------------------|
| Internal (`/apps/*`) | `allow-scripts allow-forms allow-popups allow-same-origin` | Yes |
| External (`https://...`) | `allow-scripts allow-forms allow-popups` | **No** |

- Validate `event.origin` on every incoming message.
- OAuth flows must use **top-level redirect**, not iframe redirect.
- Tool descriptions are sanitized: no "ignore previous instructions", "you are", etc.

## 6. Recovery & Limits

| Mechanism | Config |
|-----------|--------|
| Tool invocation timeout | 15 seconds |
| Iframe load timeout | 10 seconds |
| Circuit breaker opens after | 3 consecutive failures |
| Circuit breaker resets after | 30 seconds (half-open) |
| Rate limit | 10 tool invocations / minute / user |
| Max LLM retries (hallucinated tool) | 2, then falls back to plain chat |

When the circuit breaker is open, invocations return an error and the LLM gets a recovery prompt suggesting the user try again later.

## 7. Auth Types

| Type | How it works |
|------|-------------|
| `none` | No auth. Session state only (e.g., Khan Academy companion). |
| `platform` | User must be logged in. App gets `userId` via platform JWT. Deck/progress data scoped to user (e.g., Flashcards). |
| `oauth` | External OAuth flow. Tokens stored in `oauth_tokens` table. Redirect via top-level window. |

## 8. Existing Apps as Examples

| App | Auth | Tools | Key Pattern |
|-----|------|-------|-------------|
| **Chess** | none | `start_game`, `make_move`, `get_board_state`, `resign` | Long-running session, mid-app LLM assistance, Lichess integration |
| **Khan** | none | `open_topic`, `explain_concept`, `quiz` | Session-only state, user-triggered completion |
| **Flashcards** | platform | `create_deck`, `load_deck`, `answer_card`, `get_progress` | Platform auth, persistent user data, progress tracking |
| **First Principles** | none | `analyze` | Single-shot tool, auto-complete after 500ms render |

## Quick Checklist

- [ ] Register app with valid tool schemas
- [ ] Iframe signals `iframe_ready` on mount with retry
- [ ] Handle `tool_invoke` messages and return results with `invocationId`
- [ ] Call `app_complete` with a concise `summary` when done
- [ ] Summary is human-readable (it goes into LLM context for future messages)
- [ ] No `allow-same-origin` if external app
- [ ] Validate `event.origin` on incoming messages
- [ ] Handle graceful degradation if postMessage times out
