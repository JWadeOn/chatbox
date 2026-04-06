# ChatBridge Integration Plan — Option C: Chatbox Web Build as Frontend Shell

## Status (living document)

Last aligned with implementation: **2026-04**.

| Area | State |
|------|--------|
| **Canonical frontend** | Chatbox web build under `chatbox/`, served when `chatbox/release/app/dist/renderer/index.html` exists. Routing rules: `server/lib/http-static-routing.ts` (+ tests in `__tests__/server/`). |
| **Secondary frontend** | Next App Router chat UI (`src/components/chat/*`, `src/app/page.tsx`) remains for dev/parity; **not** removed. See `CLAUDE.md` and `docs/SPEC.md` §4.2. |
| **App governance** | `apps.approval_status`: pending → approved → disabled; public listing and tool discovery only for **approved**; register + PATCH gated to operators. |
| **Iframe bridge** | Shared `src/lib/iframe-bridge/` (sandbox, iframe `src` + session, postMessage targets). Next imports `@/lib/iframe-bridge`; Chatbox imports `@chatbridge/iframe-bridge` (Vite alias in `chatbox/electron.vite.config.ts`). JSON-RPC handlers remain duplicated in `src/lib/postmessage.ts` and `chatbox/.../postmessage.ts` — keep behaviorally in sync. |
| **Active app context** | App-agnostic mid-chat context via `server/services/active-app-context.service.ts` (not chess-only). |
| **Spec / gaps** | Broader product spec and reconciliation: `docs/SPEC.md`. This file is the **integration / serving** plan; it does not replace SPEC. |

**Note:** A separate Cursor-generated “Close spec gaps” checklist may live under `.cursor/plans/`; that file is optional for tracking. **This** `docs/PLAN.md` is the repo copy of the integration plan and should be updated when architecture changes.

---

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
- `chatbox/src/renderer/components/chatbridge/AppRenderer.tsx` — sandboxed iframe component (uses `@chatbridge/iframe-bridge`)
- `src/components/chat/AppRenderer.tsx` — Next secondary shell (uses `@/lib/iframe-bridge`)
- `src/lib/iframe-bridge/*` — shared trust boundary, iframe URL, postMessage target/origin helpers
- `chatbox/src/renderer/components/chatbridge/postmessage.ts` — JSON-RPC 2.0 protocol (keep in sync with `src/lib/postmessage.ts`)
- `chatbox/src/renderer/components/chatbridge/invocation-buffer.ts` — message queue until iframe ready (ported twin of `src/lib/invocation-buffer.ts`)
- `chatbox/src/renderer/components/message-parts/ToolCallPartUI.tsx` — renders AppRenderer for app_render events

### 5. Auto-Configuration

On startup, forces the ChatBridge provider as default for new sessions and ensures global settings include the ChatBridge provider entry.

**Files:**
- `chatbox/src/renderer/setup/chatbridge_init.ts` — initialization + provider defaults

### 6. Build and Serving

The Chatbox web build produces a SPA. The ChatBridge server serves it as static files, with API routes handled by Next.js.

**Files:**
- `server/index.ts` — static file serving for Chatbox SPA + SPA fallback; delegates `/api/*`, `/apps/*`, `/_next/*` to Next
- `server/lib/http-static-routing.ts` — pure rules for “Next vs static SPA” (+ unit tests)
- `package.json` — `build:chatbox` and `build:all` scripts

---

## Server and APIs (evolving)

Core services remain centered here:

- `server/services/chat.service.ts` — LLM orchestration
- `server/services/tool-router.service.ts` — tool invocation lifecycle
- `server/services/intent.service.ts` — intent tracking
- `server/services/completion.service.ts` — context retention
- `server/services/conversation.service.ts` — persistence
- `server/services/auth.service.ts` — JWT auth
- `server/services/app.service.ts` — app registry + **approval lifecycle** (pending / approved / disabled)
- `server/services/tool.service.ts` — tool discovery (approved apps only)
- `server/services/oauth.service.ts` — OAuth broker (configure per app)
- `server/services/active-app-context.service.ts` — mid-app assistant context by active session
- `server/apps/*` — per-app tool handlers (chess, khan, flashcards, firstprinciples, etc.)
- `server/lib/*` — database, logging, circuit breaker, `http-static-routing`, etc.
- `src/app/api/*` — route handlers (including `apps/register`, `apps/pending`, `apps/[slug]` PATCH, `app-complete`, `tool-invocation-result`)
- `src/app/apps/*` — first-party iframe app pages (chess, khan, flashcards, …)

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

## Secondary Next path (not deprecated)

For **Chatbox shell** deployments, the Chatbox UI is primary. The following `src/` areas still exist as a **secondary** Next-based chat surface (development, parity, and routes that must stay on Next: `/api/*`, `/apps/*` pages):

- `src/components/chat/*`, `src/app/page.tsx`, `src/lib/use-chat.ts`, `src/lib/auth-context.tsx`, etc.

They are **not** deleted; they must stay aligned on iframe protocol and governance with the Chatbox path (shared `iframe-bridge`, same approval and API behavior).

**Extracted Chatbox-derived modules** (`src/lib/extracted/chatbox/`, `src/components/chatbox/*`) support the Next UI and tests; they are not “dead” code.

When the team explicitly retires the Next chat UI, this section can be replaced with a true deprecation list.
