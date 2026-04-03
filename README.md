# ChatBridge

AI chat platform with sandboxed third-party app integration, built for TutorMeAI (K-12 education, 200K DAU).

Apps register tools via an MCP-aligned schema, render UI inside sandboxed iframes, and communicate with the platform over JSON-RPC 2.0 postMessage. The server handles all LLM interaction -- clients never call OpenAI directly.

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

| Field | Value |
|-------|-------|
| Email | `demo@chatbridge.com` |
| Password | `demo1234` |

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
- **Context window management** -- compaction at 80% capacity. Completed app interactions replaced with `context_summary`, not raw JSON. Last 10 messages always retained.

## Integrated Apps

### Chess
Interactive chess game with AI opponent. The LLM uses function calling to manage game state, and the chess board renders in a sandboxed iframe with local move validation via chess.js.

**Tools:** `chess__start_game`, `chess__make_move`, `chess__get_board_state`, `chess__resign`

### Weather
Current weather information for any location.

**Tools:** `weather__get_weather`

## API Reference

All endpoints except auth return `401` without a valid JWT in the `Authorization: Bearer <token>` header.

### Auth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create account. Body: `{ email, password, displayName }` |
| `/api/auth/login` | POST | Login. Body: `{ email, password }`. Returns `{ user, token }` |
| `/api/auth/me` | GET | Get authenticated user |

### Conversations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | GET | List user's conversations |
| `/api/conversations` | POST | Create new conversation |
| `/api/conversations/:id` | GET | Get conversation with messages |

### Apps

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/apps` | GET | List registered apps |
| `/api/apps/:slug` | GET | Get app by slug |
| `/api/apps/register` | POST | Register a new app with tool schemas |
| `/api/tools` | GET | Flat list of all tools from active apps |

### Chat (SSE)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Send message, receive SSE stream with tool calls and responses |

**SSE event types:**
- `{ content }` -- streamed assistant text
- `{ type: "tool_call", appSlug, toolName, args, result }` -- tool invocation
- `{ type: "app_render", appSlug, iframeUrl, sessionId }` -- render iframe
- `{ done: true }` -- stream complete
- `{ error }` -- error message

### WebSocket

| Endpoint | Protocol | Description |
|----------|----------|-------------|
| `/api/chat` | WS | Real-time chat with streaming. Requires `?token=<jwt>` |

### OAuth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/oauth/:appSlug/authorize` | GET | Redirect to OAuth provider |
| `/api/oauth/:appSlug/callback` | GET | Handle OAuth redirect |
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

`allow-same-origin` is **deliberately omitted** for external apps. Internal apps (`/apps/*`) get `allow-same-origin` since they're served from the same domain. Every message handler validates `event.origin`.

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
- `LOG_LEVEL` -- pino log level (default: `info`)
- `WEATHER_API_KEY` -- for weather app
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` -- for Spotify OAuth app

After deploying, run against the production database:
```bash
DATABASE_URL="<railway-url>" pnpm db:push
DATABASE_URL="<railway-url>" pnpm db:seed
```

## Brownfield Context

This project is a brownfield build on top of a fork of [Chatbox](https://github.com/nicepkg/chatbox), an open-source Electron chat client. The architectural shift from Electron desktop app to Next.js web platform meant most code was built new, but Chatbox's patterns for markdown rendering, context window management, and token estimation informed the design. The `chatbox/` directory is retained as a read-only reference -- it is not imported or modified.

## Testing

TDD workflow: Red (failing test) -> Green (minimal implementation) -> Refactor.

Every feature tests: happy path, error path, edge cases, and auth (401/403). Test files live in `__tests__/` mirroring source structure.

```bash
pnpm test                          # all tests
pnpm test -- path/to/file.test.ts  # single file
```
