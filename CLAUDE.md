# CLAUDE.md

## Project

ChatBridge is an AI chat platform with sandboxed third-party app integration, built for TutorMeAI (K-12, 200K DAU). Built as a brownfield extension on top of the forked Chatbox codebase -- proving we can work with and extend an existing project.

## Stack

- Next.js 14+ (App Router) with TypeScript 5 (strict mode)
- PostgreSQL (conversations, messages, users, apps, tool_logs, intents, app_sessions, oauth_tokens)
- WebSockets (ws) for real-time streaming chat
- OpenAI API (function calling, tiered model routing)
- Zod for request validation
- Tailwind CSS with chatbox design tokens
- Vitest + React Testing Library + Supertest
- pnpm as package manager
- Biome for linting/formatting (not Prettier)

## Repo Layout

```
chatbridge/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── auth/               # login, register pages
│   │   ├── chat/[conversationId]/page.tsx
│   │   └── api/                # Route handlers: auth, conversations, apps, tools, oauth
│   ├── components/
│   │   ├── chat/               # ChatWindow, MessageList, MessageInput, StreamingMessage, AppRenderer
│   │   ├── auth/               # LoginForm, RegisterForm
│   │   └── ui/                 # Shared (loading, errors)
│   ├── lib/                    # db, llm, ws, tools, postmessage, circuit-breaker, invocation-state, auth
│   └── types/
├── server/
│   ├── index.ts                # Express + WebSocket setup
│   ├── routes/                 # auth, conversations, apps, tools, oauth
│   ├── services/               # chat, tool-router, intent, app, tool, auth, oauth
│   ├── middleware/              # auth (JWT), validation
│   └── lib/                    # db, llm, circuit-breaker, invocation-state, schema-sanitizer, logger, ws-manager
├── __tests__/                  # Mirrors src/ and server/ structure
├── chatbox/                    # Forked Chatbox codebase -- the foundation we build on top of
├── docs/                       # PRD, SPEC, RECONCILIATION, CONVENTIONS, ADRs
└── CLAUDE.md
```

## Commands

| Action              | Command              |
|---------------------|----------------------|
| Install deps        | `pnpm install`       |
| Dev server          | `pnpm dev`           |
| Build               | `pnpm build`         |
| Run tests           | `pnpm test`          |
| Run single test     | `pnpm test -- path/to/file.test.ts` |
| Lint + format check | `pnpm biome check .` |
| Lint + format fix   | `pnpm biome check . --apply` |
| Type check          | `pnpm tsc --noEmit`  |
| DB migrations       | `pnpm db:migrate`    |

## Code Conventions

- Biome enforced: 2-space indent, 120 char width, single quotes, trailing commas ES5
- File naming: PascalCase for React components, snake_case for utilities
- Functions/variables: camelCase. Booleans: `is`/`has`/`should`/`can` prefix. Constants: UPPER_SNAKE.
- `import type { Foo }` for type-only imports. Avoid `any` and non-null assertions.
- Import order: external packages, `@shared/*`, `@/*`, relative
- Commit format: `type(scope): description` -- always include scope
- Scopes: chat, auth, apps, tools, iframe, chess, weather, spotify, ci, setup, db
- Fail early, fail loudly. User-facing errors: actionable. Internal errors: detailed with context.
- No `console.log` in production. Use `console.error`/`warn`/`info`/`assert` only.

## Architecture & Patterns

- **Server-side LLM only.** All LLM calls happen on the server. Client never talks to OpenAI directly.
- **Sandboxed iframes** for app UI. Sandbox: `allow-scripts allow-forms allow-popups`. No `allow-same-origin`.
- **JSON-RPC 2.0 over postMessage** for app-platform communication. Validate `event.origin` on every message.
- **Three-layer state:** chat state (server), app state (iframe), contextual bridge (summaries linking them).
- **Intent tracking:** user intent is a first-class concept. One active intent per conversation. Transitions: general_chat <-> app_intent.
- **Tool router** (server-side): owns full invocation lifecycle. Namespace tools as `{appSlug}__{toolName}`. Handles hallucinated tools with retry (max 2), then falls back to plain chat.
- **Invocation state machine:** IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED -> IDLE (also ERROR, TIMEOUT paths). Persisted in `app_sessions.status`.
- **Completion signaling:** app sends `app_complete` with `context_summary`. Summary replaces full tool history in LLM context. This is the #1 failure point -- build and test before adding apps.
- **Single-active-app rule:** new invocation terminates previous app session.
- **Context window management:** inject only active app schemas. Compact at 80% capacity. Keep last 10 messages + active context. Summarize old tool interactions.
- **Circuit breaker:** 3 consecutive failures opens breaker. Half-open after 30s.

## Gotchas

- Iframe readiness: buffer postMessage calls until iframe signals channel open. Race condition otherwise.
- `allow-same-origin` is deliberately OMITTED from iframe sandbox. Adding it breaks the security model.
- Tool schema sanitization: strip prompt injection ("ignore previous instructions", "you are", etc.) at registration AND injection. Truncate descriptions to 200 chars.
- Context window compaction: replace completed app histories with `context_summary`, not raw JSON. Never silently truncate -- error instead.
- Completion signaling is the #1 failure point. Test the full lifecycle before building additional apps.
- Single-active-app: starting a new app terminates the previous session. No concurrent app sessions.
- OAuth flows use top-level window redirect, not iframe redirect (cookie restrictions).
- Rate limit: max 10 tool invocations per minute per user.
- Duplicate `app_complete` on non-active session must be ignored (idempotent).
- LLM retry limit: max 2 retries for hallucinated tools, then strip tools and respond as plain chat.

## Testing

- TDD workflow: Red (failing test) -> Green (minimal impl) -> Refactor. Every feature.
- Vitest for unit/integration, Supertest for API routes, React Testing Library for components, Playwright for E2E (stretch).
- Test file naming: `{module}.test.ts` in `__tests__/` mirroring source structure.
- Every feature tests: happy path, error path, edge case, auth (401/403).
- Test names describe scenarios: `'expired subscription blocks access'` not `'process'`.
- No test interdependencies. Each test stands alone.
- Vertical slice rule: Chess must pass ALL lifecycle tests before any second app is started.

## Environment

- PostgreSQL (local or hosted). Tables: users, conversations, messages, apps, tool_schemas, tool_logs, intents, app_sessions, oauth_tokens.
- Required env vars: `DATABASE_URL`, `JWT_SECRET`, `OPENAI_API_KEY`
- Optional env vars: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `WEATHER_API_KEY`, `PORT`
- Never commit secrets. Use `.env.local` (gitignored).

## Chatbox Foundation

The `chatbox/` directory contains the forked Chatbox codebase that ChatBridge is built on top of. Key areas:
- Markdown rendering component design (`src/renderer/components/`)
- Context management algorithms (`src/renderer/packages/context-management/`)
- Token estimation utilities (`src/renderer/packages/`)
- General React chat UI patterns

This is a brownfield project -- the goal is to demonstrate building on an existing codebase. Chatbox-derived modules live in `src/lib/extracted/chatbox/` and `src/components/chatbox/` as owned, adapted code.

## Do NOT

- Add `allow-same-origin` to iframe sandbox attributes
- Make client-side LLM calls -- all LLM interaction is server-side
- Use `console.log` in production code
- Build a second app before chess works end-to-end (vertical slice rule)
- Break the Chatbox foundation -- ChatBridge extends it, doesn't replace it
- Commit secrets, tokens, or API keys
- Use SQL string interpolation -- parameterized queries only
- Develop apps horizontally -- get one app fully working before touching the next
- Skip TDD -- write the test first, always
