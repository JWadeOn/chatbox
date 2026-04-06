# ChatBridge

AI chat platform with sandboxed third-party app integration, built for TutorMeAI (K-12 education, 200K DAU). A brownfield project built on top of a fork of [Chatbox](https://github.com/nicepkg/chatbox).

Third-party learning tools register via an MCP-aligned schema, render UI inside sandboxed iframes, and communicate with the platform over JSON-RPC 2.0 postMessage. The server handles all LLM interaction -- clients never call OpenAI directly.

**Frontend:** The forked **Chatbox** tree under `chatbox/` is the canonical chat shell; ChatBridge injects auth, the ChatBridge model provider, and iframe rendering there. The Next.js chat UI under `src/components/chat/` is a secondary path for parity and experiments. When a built Chatbox web bundle is present at `chatbox/release/app/dist/renderer`, the custom Node server can serve it as the primary static shell (see `server/index.ts`).

**Live:** [chatbox-production-9695.up.railway.app](https://chatbox-production-9695.up.railway.app)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS |
| Backend | Custom Node.js server (tsx), Next.js API routes |
| Real-time | WebSockets (ws) |
| Database | PostgreSQL via Drizzle ORM |
| AI | OpenAI API (function calling, server-side only) |
| Auth | JWT + bcryptjs |
| Validation | Zod |
| Tooling | Biome, Vitest, pnpm |
| Deployment | Railway (Docker) |

## Quick Start

**Prerequisites:** Node 20+, PostgreSQL, pnpm

```bash
git clone https://github.com/JWadeOn/chatbox.git && cd chatbox
git checkout chatbridge
pnpm install

# Configure environment
cp .env.example .env.local
# Set: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY

# Set up database and seed data
pnpm db:push
pnpm db:seed

# Start dev server
pnpm dev
```

### Demo Credentials

After running `pnpm db:seed`:

| Account | Email | Password |
|---------|-------|----------|
| Student (demo) | `demo@chatbridge.com` | `demo1234` |
| Teacher (operator: app registration & approval) | `teacher@chatbridge.com` | `teacher1234` |
| Admin (app governance) | `admin@chatbridge.com` | `admin1234` |

The admin account can call `POST /api/apps/register`, `GET /api/apps/pending`, and `PATCH /api/apps/:slug` (approve/disable). New app registrations start as **pending** until an operator approves them.

Or register a new account from the login page.

## Architecture

```
Client (Next.js)                          Server (Node.js)
+-----------+  +--------------+           +-----------+  +------------+
| Chat UI   |  | App Renderer |           | Chat Svc  |  | App        |
|           |  | (iframes)    |           |           |  | Registry   |
+-----+-----+  +------+-------+           +-----+-----+  +------+-----+
      |               |                         |               |
      | SSE           | postMessage             |               |
      v               v (JSON-RPC 2.0)          v               v
+---------------------------------------------------+   +------------+
|                    API Layer                       |   | Tool       |
|   /api/auth  /api/conversations  /api/apps  ...   |   | Router     |
+---------------------------------------------------+   +------+-----+
                                                               |
                        +---------------------------+          |
                        |       PostgreSQL          |<---------+
                        | users | conversations     |
                        | messages | apps | intents  |
                        | app_sessions | tool_logs   |
                        +---------------------------+
```

### Three-Layer State Model

1. **Chat state (server):** Conversations, messages, and intents live in PostgreSQL. The server is the single source of truth for all chat history and LLM context.
2. **App state (iframe):** Each third-party app manages its own internal state (e.g., a chess board) inside a sandboxed iframe. The platform cannot read this state directly.
3. **Contextual bridge:** When an app session completes, it sends a `context_summary` that replaces the full tool-call history in the LLM context window, keeping token usage efficient.

### Key Design Decisions

- **Server-side LLM only** -- client never talks to OpenAI. API keys stay on the server.
- **Sandboxed iframes** -- `allow-scripts allow-forms allow-popups` only. No `allow-same-origin`. JSON-RPC 2.0 over postMessage with origin validation on every message.
- **Namespaced tool router** -- tools registered as `{appSlug}__{toolName}` (e.g., `chess__start_game`). Full invocation lifecycle: IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED.
- **Single active app** -- one app session per conversation at a time. New invocation terminates the previous session.
- **Intent tracking** -- one active intent per conversation (`general_chat` or `app_intent`). Determines which tool schemas are injected into LLM context.
- **Circuit breaker** -- 3 consecutive failures opens the breaker. Half-open after 30s.
- **Rate limiting** -- 10 tool invocations per minute per user. Sliding window, returns 429 with retry-after.
- **Timeouts** -- 15s per tool invocation, 60s per request. Dead connections cleaned up via WebSocket heartbeat (30s ping/pong).
- **Context window management** -- last 50 messages loaded per request. Completed app interactions replaced with `context_summary`, not raw JSON.

### Scalability: The "Recess Rush" Problem

TutorMeAI serves 200K DAU on school schedules. The hardest scenario is the **thundering herd**: thousands of students return from recess simultaneously and start interacting with apps. Each student's request may invoke a tool, render an iframe, and wait for the app to finish. We don't control how long the third-party app takes.

See `docs/TECHNICAL_PRESEARCH.md` for the full analysis. Here's what we built and what the production path looks like:

**What's implemented:**
- **Timeouts** -- 15s per tool invocation (`Promise.race`), 60s per request. Prevents any single slow app from holding a connection indefinitely.
- **Rate limiting** -- 10 tool invocations/min/user (sliding window). Prevents thundering herd from overwhelming downstream LLM APIs.
- **DB pool configuration** -- explicit `max`, `connectionTimeoutMillis` (5s fail-fast), `idleTimeoutMillis`. Configurable via `DB_POOL_MAX`.
- **WebSocket limits** -- 2 connections per user, 30s heartbeat ping/pong to detect and clean dead sockets.
- **Paginated queries** -- conversations and messages capped at 50 per request. Prevents unbounded memory growth.
- **Tool discovery cache** -- 5-minute TTL avoids querying the apps table on every chat message.
- **Health endpoint** -- `GET /health` returns DB pool stats and memory usage for load balancer probes.
- **Circuit breaker** -- 3 consecutive failures opens the breaker for 30s. Prevents cascade failures when an app is down.
- **OAuth nonce TTL** -- 10-minute expiry with periodic cleanup. Prevents unbounded memory growth.

**Production scaling path (not yet implemented):**
- **Non-blocking app invocation** -- decouple tool wait from the SSE response. Return `app_render` immediately, close the stream, let completion arrive async via `POST /api/app-complete` (endpoint already exists).
- **Externalize in-memory state to Redis** -- chess games, circuit breaker, rate limiter currently use in-process Maps. Required for multi-instance horizontal scaling.
- **Connection pooling proxy** -- PgBouncer for 10K+ concurrent DB clients.
- **Predictive scaling** -- school schedules are predictable. Pre-warm instances before known bell times.

## Integrated Learning Apps

All apps are framed through an educational lens for the K-12 case study. See `docs/TECHNICAL_PRESEARCH.md` for the full rationale.

### Chess (Strategic Thinking)
Chess tutor that builds problem-solving, pattern recognition, and planning skills. The LLM coaches students during games -- analyzing positions, explaining tactics, and helping them think through consequences. The board renders in a sandboxed iframe with local move validation via chess.js. Supports three modes: tutoring (local board), vs Computer, and vs Human (both via Lichess integration).

**Tools:** `chess__start_game`, `chess__make_move`, `chess__get_board_state`, `chess__resign`

### Khan Academy Companion (Topic Exploration)
Non-authenticated educational companion for guided topic exploration. Students open a topic from chat, receive concept explanations, take quiz questions, and track learning stats. All state is session-only -- no durable per-user auth required.

**Tools:** `khan__open_topic`, `khan__explain_concept`, `khan__quiz`

### Flashcards (Active Recall Study)
Platform-authenticated study app with user-specific decks and progress tracking. Students create decks from chat, work through cards in the iframe with flip/score mechanics, and track mastery over time. Auth is platform-owned (JWT) -- no external OAuth in MVP. User-specific data is gated by authenticated identity.

**Tools:** `flashcards__create_deck`, `flashcards__load_deck`, `flashcards__answer_card`, `flashcards__get_progress`

### First Principles Tutor (Critical Thinking) -- Bonus
Structured reasoning tool that decomposes questions into assumptions, first principles, reasoning steps, and conclusions. Students submit a question and receive a structured analysis they can discuss with the chatbot afterward.

**Tools:** `firstprinciples__analyze`

## API Reference

All endpoints except auth and health return `401` without a valid JWT in the `Authorization: Bearer <token>` header.

### Health

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with DB pool stats and memory usage |

### Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account. Body: `{ email, password, displayName }` |
| `/api/auth/login` | POST | Login. Body: `{ email, password }`. Returns `{ user, token }` |
| `/api/auth/me` | GET | Get authenticated user |

### Conversations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | GET | List user's conversations (paginated, last 50) |
| `/api/conversations` | POST | Create new conversation |
| `/api/conversations/:id` | GET | Get conversation with messages (last 50) |

### Apps

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/apps` | GET | List registered apps |
| `/api/apps/:slug` | GET | Get app by slug |
| `/api/apps/register` | POST | Register a new app with tool schemas |
| `/api/tools` | GET | Flat list of all tools from active apps (cached 5min) |

### Chat (SSE)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message, receive SSE stream. 60s request timeout, 15s per tool. |

**SSE event types:**
- `{ content }` -- streamed assistant text
- `{ type: "tool_call", appSlug, toolName, args, result }` -- tool invocation
- `{ type: "app_render", appSlug, iframeUrl, sessionId }` -- render iframe
- `{ done: true }` -- stream complete
- `{ error }` -- error message

**Rate limit:** 10 tool invocations per minute per user. Returns tool error with retry-after on limit.

### App Completion

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/app-complete` | POST | Signal app session completion with context summary |

### WebSocket

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `/api/chat` | WS | Real-time chat with streaming. Requires `?token=<jwt>`. Max 2 connections per user. 30s heartbeat. |

### OAuth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/:appSlug/authorize` | GET | Redirect to OAuth provider |
| `/api/oauth/:appSlug/callback` | GET | Handle OAuth redirect (10min nonce TTL) |
| `/api/oauth/:appSlug/status` | GET | Check if user has valid tokens |

## Third-Party App Integration

### Registering an App

POST to `/api/apps/register` with tool schemas. Tools are namespaced automatically as `{appSlug}__{toolName}`. Descriptions are sanitized to strip prompt-injection patterns and truncated to 200 chars.

### postMessage Protocol

All iframe-platform communication uses JSON-RPC 2.0 over `window.postMessage`:

```
1. App -> Platform:  iframe_ready          (handshake, must arrive within 30s)
2. Platform -> App:  tool_invoke           (with invocationId)
3. App -> Platform:  result                (tool return value)
4. App -> Platform:  app_complete          (summary + data, ends session)
5. App -> Platform:  app_error             (recoverable or fatal)
6. App -> Platform:  heartbeat             (every 10s, timeout after 60s silence)
```

### Iframe Sandbox

```
sandbox="allow-scripts allow-forms allow-popups"
```

`allow-same-origin` is **deliberately omitted** -- adding it would break the security model. Every message handler validates `event.origin`.

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Accounts (email, password hash, role) |
| `conversations` | Chat sessions per user |
| `messages` | Messages with role, content, metadata |
| `apps` | Registered third-party apps and tool schemas |
| `app_sessions` | Active app invocation state and context summaries |
| `tool_logs` | Tool call audit log |
| `intents` | User intent tracking per conversation |
| `oauth_tokens` | OAuth credentials per user/app |

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `pnpm dev` | Start dev server |
| `build` | `pnpm build` | Production build |
| `start` | `pnpm start` | Start production server (tsx) |
| `test` | `pnpm test` | Run tests (Vitest) |
| `test:watch` | `pnpm test:watch` | Tests in watch mode |
| `lint` | `pnpm lint` | Lint/format check (Biome) |
| `lint:fix` | `pnpm lint:fix` | Auto-fix lint/format |
| `typecheck` | `pnpm typecheck` | TypeScript type check |
| `db:push` | `pnpm db:push` | Push schema to database |
| `db:seed` | `pnpm db:seed` | Seed demo user + apps |
| `db:generate` | `pnpm db:generate` | Generate Drizzle migrations |
| `db:studio` | `pnpm db:studio` | Open Drizzle Studio GUI |

## Deployment

Deployed on **Railway** with Docker. The `railway.toml` and `Dockerfile` are included.

**Required environment variables:**
- `DATABASE_URL` -- PostgreSQL connection string (Railway provides this)
- `JWT_SECRET` -- strong random string for signing tokens
- `OPENAI_API_KEY` -- OpenAI API key

**Optional:**
- `OPENAI_MODEL` -- model to use (default: `gpt-4o-mini`)
- `PORT` -- server port (default: `3000`)
- `DB_POOL_MAX` -- database connection pool size (default: `20`)
- `LOG_LEVEL` -- pino log level (default: `info`)

After deploying, run against the production database:
```bash
DATABASE_URL="<railway-url>" pnpm db:push
DATABASE_URL="<railway-url>" pnpm db:seed
```

## Brownfield Context

This project is a brownfield build on top of a fork of [Chatbox](https://github.com/nicepkg/chatbox), an open-source Electron chat client. The architectural shift from Electron desktop app to Next.js web platform meant most code was built new, but Chatbox's patterns for markdown rendering, context window management, and token estimation informed the design. Chatbox-derived modules live in `src/lib/extracted/chatbox/` and `src/components/chatbox/` as owned, adapted code. The `chatbox/` directory is the forked foundation.

## Testing

TDD workflow: Red (failing test) -> Green (minimal implementation) -> Refactor.

Every feature tests: happy path, error path, edge cases, and auth (401/403). Test files live in `__tests__/` mirroring source structure.

```bash
pnpm test                          # all tests
pnpm test -- path/to/file.test.ts  # single file
```
