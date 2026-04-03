# ChatBridge

ChatBridge is an AI chat platform with sandboxed third-party app integration, built for TutorMeAI (K-12 education, 200K DAU). Apps register tools via an MCP-aligned schema, render UI inside sandboxed iframes, and communicate with the platform over JSON-RPC 2.0 postMessage. The server handles all LLM interaction -- clients never call OpenAI directly.

## Quick Start

**Prerequisites:** Node 20+, PostgreSQL, pnpm

```bash
git clone <repo-url> && cd chatbridge
pnpm install

# Configure environment
cp .env.example .env.local
# Set required vars: DATABASE_URL, JWT_SECRET, OPENAI_API_KEY

# Set up database
pnpm db:push

# Start dev server
pnpm dev
```

### Test Credentials

A demo account is seeded if you run the API manually, or register via the UI:

| Field | Value |
|---|---|
| Email | `demo@chatbridge.dev` |
| Password | `password123` |
| Display Name | Demo User |
| Role | student |

Or create a new account from the login page — click "Sign up" and fill in the form.

## Architecture

```
Client (Next.js)                          Server (Node.js)
+-----------+  +--------------+           +-----------+  +------------+
| Chat UI   |  | App Renderer |           | Chat Svc  |  | App        |
|           |  | (iframes)    |           |           |  | Registry   |
+-----+-----+  +------+-------+           +-----+-----+  +------+-----+
      |               |                         |               |
      | WebSocket     | postMessage             |               |
      v               v (JSON-RPC)              v               v
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

**Three-layer state model:**

1. **Chat state (server):** Conversations, messages, and intents live in PostgreSQL. The server is the single source of truth for all chat history and LLM context.
2. **App state (iframe):** Each third-party app manages its own internal state (e.g., a chess board) inside a sandboxed iframe. The platform cannot read this state directly.
3. **Contextual bridge:** When an app session completes, it sends a `context_summary` that replaces the full tool-call history in the LLM context window, keeping token usage efficient.

**Key components:** Chat Service (message persistence, LLM orchestration), Tool Router (invocation lifecycle, circuit breaker, rate limiting), App Registry (registration, schema validation, sanitization), Completion Service (app_complete handling, context summary persistence).

## API Reference

All endpoints except auth return `401` without a valid JWT in the `Authorization: Bearer <token>` header.

### Auth

#### `POST /api/auth/register`
```json
// Request
{ "email": "student@school.edu", "password": "password123", "displayName": "Alice" }
// 201 Response
{ "user": { "id": "uuid", "email": "student@school.edu", "displayName": "Alice", "role": "student" }, "token": "jwt..." }
// 400: "Email already exists" | "Password must be at least 8 characters"
```

#### `POST /api/auth/login`
```json
// Request
{ "email": "student@school.edu", "password": "password123" }
// 200 Response
{ "user": { "id": "uuid", "email": "...", "displayName": "...", "role": "..." }, "token": "jwt..." }
// 401: "Invalid credentials"
```

#### `GET /api/auth/me`
Returns the authenticated user. `200: { user }` or `401`.

### Conversations

#### `GET /api/conversations`
Returns all conversations for the authenticated user, ordered by `updated_at` descending.
```json
// 200
{ "conversations": [{ "id": "uuid", "title": "...", "createdAt": "...", "updatedAt": "..." }] }
```

#### `POST /api/conversations`
Creates a new conversation. `201: { conversation }`.

### Apps

#### `POST /api/apps/register`
```json
// Request
{
  "slug": "chess",
  "name": "Chess",
  "description": "Play chess against the AI",
  "authType": "none",
  "iframeUrl": "https://chess.example.com",
  "toolSchemas": [
    {
      "name": "start_game",
      "description": "Start a new chess game.",
      "parameters": { "type": "object", "properties": { "color": { "type": "string", "enum": ["white","black"] } }, "required": [] },
      "returns": { "type": "object", "properties": { "board_fen": { "type": "string" }, "player_color": { "type": "string" }, "status": { "type": "string" } } }
    },
    {
      "name": "make_move",
      "description": "Make a chess move in UCI notation.",
      "parameters": { "type": "object", "properties": { "move": { "type": "string" } }, "required": ["move"] },
      "returns": { "type": "object", "properties": { "success": { "type": "boolean" }, "board_fen": { "type": "string" } } }
    }
  ]
}
// 201: { app: { id, slug, name, toolSchemas, status: "active" } }
// 400: "slug already exists" | "Invalid tool schema"
```

#### `GET /api/apps`
Returns all registered apps. `200: { apps[] }`.

#### `GET /api/apps/:slug`
Returns a single app by slug. `200: { app }` or `404`.

### Tools

#### `GET /api/tools`
Flat list of all tools from active apps. Each entry includes `appId`, `appSlug`, `toolName`, `description`, and `parameters`. Returns `[]` if no apps are registered.

### OAuth

#### `GET /api/oauth/:appSlug/authorize`
Redirects to the third-party OAuth provider. Encodes a state parameter with `userId`, `conversationId`, `appSlug`, and a CSRF nonce (5-min TTL).

#### `GET /api/oauth/:appSlug/callback`
Handles the OAuth redirect. Validates the nonce, exchanges the authorization code for tokens, stores them in `oauth_tokens`, and redirects the user back to `/chat/{conversationId}`.

#### `GET /api/oauth/:appSlug/status`
Returns `{ authenticated: true|false }` based on whether a valid token exists for the user+app pair.

### WebSocket

#### `WS /api/chat`
Requires JWT auth on connection. Message types:

**Client -> Server:**
```json
{ "type": "user_message", "conversationId": "uuid", "content": "let's play chess" }
```

**Server -> Client:**
```json
{ "type": "stream_start", "messageId": "uuid" }
{ "type": "stream_chunk", "messageId": "uuid", "content": "Sure! " }
{ "type": "stream_end", "messageId": "uuid" }
{ "type": "tool_invoke", "appId": "uuid", "tool": "start_game", "params": { "color": "white" } }
{ "type": "app_render", "appId": "uuid", "iframeUrl": "https://...", "sessionId": "uuid" }
{ "type": "error", "message": "App timed out", "recoverable": true }
```

## Third-Party App Integration Guide

### Registering an App

POST your app's metadata and tool schemas to `/api/apps/register`. Tools are namespaced automatically as `{appSlug}__{toolName}` (e.g., `chess__start_game`). Tool descriptions are sanitized at registration to strip prompt-injection patterns and truncated to 200 chars.

### Tool Schema Format

Schemas follow the MCP tool definition format:

```json
{
  "name": "tool_name",
  "description": "What this tool does (max 200 chars, plain text).",
  "parameters": {
    "type": "object",
    "properties": { "param1": { "type": "string", "description": "..." } },
    "required": ["param1"]
  },
  "returns": {
    "type": "object",
    "properties": { "result": { "type": "string" } }
  }
}
```

### postMessage Protocol

All iframe-platform communication uses **JSON-RPC 2.0** over `window.postMessage`.

**1. Handshake -- app signals readiness:**
```json
{ "jsonrpc": "2.0", "method": "iframe_ready", "params": {} }
```
The platform buffers all `tool_invoke` messages until `iframe_ready` is received. If not received within 10s, the iframe is removed with an error.

**2. Platform invokes a tool:**
```json
{ "jsonrpc": "2.0", "method": "tool_invoke", "params": { "tool": "make_move", "arguments": { "move": "e2e4" }, "invocationId": "uuid" }, "id": 1 }
```

**3. App returns result:**
```json
{ "jsonrpc": "2.0", "result": { "success": true, "board_fen": "..." }, "id": 1 }
```

**4. App signals completion:**
```json
{ "jsonrpc": "2.0", "method": "app_complete", "params": { "summary": "White wins by checkmate.", "data": { "winner": "white", "moves": 24 } } }
```

**5. App reports error:**
```json
{ "jsonrpc": "2.0", "method": "app_error", "params": { "message": "Invalid move", "recoverable": true } }
```

**6. Heartbeat (recommended, every 10s while active):**
```json
{ "jsonrpc": "2.0", "method": "heartbeat", "params": { "timestamp": 1712097600 } }
```
Sessions with no message or heartbeat for 60s are timed out automatically.

### Iframe Sandbox

Apps are rendered in iframes with restricted sandbox attributes:

```
sandbox="allow-scripts allow-forms allow-popups"
```

`allow-same-origin` is **deliberately omitted** -- apps cannot access the parent page's cookies, localStorage, or DOM. `allow-popups` is included to support OAuth flows that open a new window.

Every `message` event handler **must** validate `event.origin` against the app's registered `iframe_url` origin. Messages from unrecognized origins are dropped silently.

## Testing

```bash
pnpm test          # Run all tests (vitest)
pnpm test:watch    # Watch mode
```

**Approach:** TDD (Red -> Green -> Refactor). Every feature requires tests covering: happy path, error path, edge cases, and auth (401/403). Test files live in `__tests__/` mirroring source structure, named `{module}.test.ts`.

## Scripts

| Script           | Command               | Description                         |
|------------------|-----------------------|-------------------------------------|
| `dev`            | `pnpm dev`            | Start Next.js dev server            |
| `build`          | `pnpm build`          | Production build                    |
| `start`          | `pnpm start`          | Start production server             |
| `test`           | `pnpm test`           | Run tests (vitest)                  |
| `test:watch`     | `pnpm test:watch`     | Run tests in watch mode             |
| `lint`           | `pnpm lint`           | Check linting/formatting (Biome)    |
| `lint:fix`       | `pnpm lint:fix`       | Auto-fix lint/format issues         |
| `typecheck`      | `pnpm typecheck`      | TypeScript type checking            |
| `db:generate`    | `pnpm db:generate`    | Generate Drizzle migrations         |
| `db:push`        | `pnpm db:push`        | Push schema to database             |
| `db:studio`      | `pnpm db:studio`      | Open Drizzle Studio GUI             |
