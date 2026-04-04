# ChatBridge Integration Plan — Option C: Chatbox Web Build as Frontend Shell

## Goal

Use Chatbox's actual web build as the ChatBridge frontend, with the ChatBridge server as the backend. This makes the brownfield relationship real: ChatBridge features (server-side LLM, tool routing, app platform, auth, persistence) are delivered through the Chatbox UI, not a parallel rebuild.

---

## Architecture

```
Chatbox Web Build (SPA)  <-->  ChatBridge Server (Next.js API routes)
   |                              |
   +- ChatBridge provider         +- /api/auth/* (JWT)
   |  (routes model.chat()        +- /api/conversations/* (CRUD)
   |   to server /api/chat)       +- /api/chat (SSE streaming + tool calls)
   +- Auth gate (JWT)             +- /api/tools (discovery)
   +- AppRenderer (iframes)       +- /api/apps/* (registry)
   +- Session-conversation        +- /api/oauth/* (Spotify)
   |  mapping                     +- /apps/* (chess, spotify pages)
   +- Chatbox native UI
```

Single-origin deployment: server serves Chatbox SPA static files and the API.

---

## How It Works

### 1. ChatBridge Provider

A custom provider registered in Chatbox's provider registry via `defineProvider()`. When selected, all `model.chat()` calls POST to `/api/chat` on the ChatBridge server instead of calling OpenAI directly. The server handles LLM orchestration, tool routing, and app lifecycle.

**Files:**
- `chatbox/src/shared/providers/definitions/chatbridge.ts` — provider definition
- `chatbox/src/shared/providers/definitions/models/chatbridge.ts` — model class implementing `ModelInterface`
- `chatbox/src/shared/providers/index.ts` — import registration (1 line)

### 2. Auth Gate

Chatbox is a local app with no user auth. ChatBridge adds a JWT-based login/register gate that wraps the Chatbox UI. Users must authenticate before accessing chat.

**Files:**
- `chatbox/src/renderer/stores/chatbridge/authStore.ts` — Jotai atoms + login/register/logout
- `chatbox/src/renderer/components/chatbridge/AuthGate.tsx` — Mantine login/register form
- `chatbox/src/renderer/routes/__root.tsx` — wraps `<Outlet />` in `<AuthGate>`

### 3. Conversation Mapping

Maps Chatbox session IDs to ChatBridge conversation IDs in PostgreSQL. Auto-creates conversations via `POST /api/conversations` on first message in a new session.

**Files:**
- `chatbox/src/renderer/stores/chatbridge/conversationMap.ts` — mapping with localStorage cache

### 4. App Platform

Third-party apps (chess, weather, spotify) render in sandboxed iframes within Chatbox's message rendering. When the server returns an `app_render` SSE event, a special tool-call content part is created that triggers the `AppRenderer` component.

**Files:**
- `chatbox/src/renderer/components/chatbridge/AppRenderer.tsx` — sandboxed iframe component
- `chatbox/src/renderer/components/chatbridge/postmessage.ts` — JSON-RPC 2.0 protocol
- `chatbox/src/renderer/components/chatbridge/invocation-buffer.ts` — message queue until iframe ready
- `chatbox/src/renderer/components/message-parts/ToolCallPartUI.tsx` — renders AppRenderer for app_render events

### 5. Auto-Configuration

On startup, forces the ChatBridge provider as default for new sessions and ensures global settings include the ChatBridge provider entry.

**Files:**
- `chatbox/src/renderer/setup/chatbridge_init.ts` — initialization + provider defaults

### 6. Build and Serving

The Chatbox web build produces a SPA. The ChatBridge server serves it as static files, with API routes handled by Next.js.

**Files:**
- `server/index.ts` — static file serving for Chatbox SPA + SPA fallback
- `package.json` — `build:chatbox` and `build:all` scripts

---

## Server (Unchanged)

The entire server control plane is unchanged:

- `server/services/chat.service.ts` — LLM orchestration
- `server/services/tool-router.service.ts` — tool invocation lifecycle
- `server/services/intent.service.ts` — intent tracking
- `server/services/completion.service.ts` — context retention
- `server/services/conversation.service.ts` — persistence
- `server/services/auth.service.ts` — JWT auth
- `server/services/oauth.service.ts` — Spotify OAuth
- `server/apps/chess.ts`, `weather.ts`, `spotify.ts` — app handlers
- `server/lib/*` — database, logging, circuit breaker, etc.
- `src/app/api/*` — all API routes
- `src/app/apps/*` — chess and spotify app pages

---

## What Changed vs. Previous Plan

| Aspect | Old Plan | Option C |
|---|---|---|
| Frontend | Custom Next.js UI with extracted Chatbox components | Chatbox's actual web build |
| Relationship to chatbox/ | Read-only reference; copy and adapt | Modify and build on top of |
| Provider | Direct OpenAI calls from server | ChatBridge provider in Chatbox's registry |
| UI framework | Tailwind CSS (custom) | Mantine (Chatbox's design system) |
| State management | React hooks (useChat, useTranscriptStore) | Chatbox's Jotai + Zustand + React Query |
| Brownfield proof | Minimal — 4 adapted components | Strong — 9 new files in chatbox/, 5 modified |

---

## Deprecated

The following files in `src/` were part of the parallel rebuild and are superseded by the Chatbox integration:

- `src/components/chat/*` — replaced by Chatbox UI
- `src/components/chatbox/*` — no longer needed (using real Chatbox)
- `src/lib/extracted/chatbox/*` — no longer needed (using real Chatbox packages)
- `src/lib/use-chat.ts` — replaced by Chatbox's session/generation system
- `src/lib/chat-transport.ts` — replaced by ChatBridge provider
- `src/lib/transcript-store.ts` — replaced by Chatbox's session store
- `src/lib/app-orchestrator.ts` — logic moved into Chatbox components
- `src/lib/auth-context.tsx` — replaced by AuthGate in Chatbox

These files remain in the repo for reference but are not used in the Chatbox shell flow.
