# RECONCILIATION.md

> Bridge between the spec (plan) and the existing Chatbox codebase (reality).
> Brownfield artifact. Feeds CLAUDE.md and TASKS.md generation.
> Generated from: SPEC.md (Draft) + Chatbox codebase at commit `0d3139e`

---

## Codebase Summary

**Stack:**
- Electron 26 (desktop app with main/preload/renderer process split)
- React 18 with TypeScript 5.8
- Vite 7 via electron-vite 4 (build tooling)
- Mantine 7 + MUI 5 + Tailwind CSS 3 (UI — dual component library)
- Jotai 2 + Zustand 5 (state management — atoms for granular, stores for settings/auth)
- Vercel AI SDK 6 (`ai` package) with provider adapters (@ai-sdk/openai, @ai-sdk/anthropic, etc.)
- MCP SDK (@modelcontextprotocol/sdk 1.15, @ai-sdk/mcp 1.0) for Model Context Protocol
- TanStack Router 1.114 + TanStack React Query 5.74
- LibSQL (@libsql/client 0.15) + Mastra (@mastra/core, @mastra/libsql, @mastra/rag) for knowledge base / RAG
- electron-store 8 for persistent config (JSON files on disk)
- Zod 4 for schema validation
- Biome 2.0 for linting and formatting
- Vitest 4 for testing
- pnpm 10 as package manager
- Capacitor for mobile builds (iOS/Android)

**Structure:**
```
chatbox/
├── src/
│   ├── main/              # Electron main process
│   │   ├── main.ts        # App entry, window management, IPC
│   │   ├── store-node.ts  # electron-store persistence (JSON config)
│   │   ├── mcp/           # MCP server management (stdio/HTTP transports)
│   │   ├── knowledge-base/# Server-side RAG pipeline
│   │   └── menu.ts        # Native OS menus
│   ├── preload/           # Electron preload scripts (IPC bridge)
│   ├── renderer/          # React frontend (Electron renderer process)
│   │   ├── components/    # UI components (chat/, settings/, mcp/, etc.)
│   │   ├── stores/        # Zustand stores (settings, chat sessions, auth, UI)
│   │   ├── packages/      # Feature modules (model-calls, context-management, mcp, tools, web-search)
│   │   ├── hooks/         # React hooks (useOAuth, useProviders, useMCP, etc.)
│   │   ├── pages/         # Dialog pages (settings, search, picture)
│   │   ├── routes/        # TanStack Router route definitions
│   │   ├── platform/      # Platform abstraction (desktop, web, mobile)
│   │   ├── storage/       # Storage abstraction (BaseStorage, StoreStorage, SQLite)
│   │   ├── adapters/      # Model provider adapters
│   │   └── i18n/          # Internationalization (i18next, 14+ languages)
│   └── shared/            # Code shared between main and renderer
│       ├── types.ts       # Core types (Session, Message, Settings)
│       ├── types/         # Type modules (session, settings, provider)
│       ├── models/        # Model abstraction layer (AI SDK wrappers)
│       ├── providers/     # Provider definitions (OpenAI, Anthropic, etc.)
│       ├── oauth/         # OAuth stubs (no-op in open-source edition)
│       └── utils/         # Shared utilities (message formatting, etc.)
├── test/                  # Integration and E2E tests
├── biome.json             # Biome linter/formatter config
├── vitest.config.ts       # Vitest test config
├── electron.vite.config.ts# electron-vite build config (main, preload, renderer)
├── tailwind.config.js     # Tailwind CSS config
└── package.json           # Single package, all deps as devDeps
```

**Entry points:**
- Electron main: `src/main/main.ts` (21KB, window management, IPC handlers, auto-update)
- Renderer: `src/renderer/index.tsx` (React app root, providers, router mount)
- Web build: `pnpm run dev:web` or `build:web` (renderer only, no Electron)
- Preload: `src/preload/index.ts` (IPC bridge between main and renderer)

**Build system:**
- electron-vite for development and production builds
- Three build targets: main (Node.js), preload (sandboxed), renderer (browser)
- Web-only build supported via `CHATBOX_BUILD_PLATFORM=web` env var
- electron-builder for packaging desktop distributables
- pnpm workspaces (monorepo-style, though currently single package)
- Capacitor for mobile (iOS/Android) builds

**Test setup:**
- Vitest 4 with `node` environment (not jsdom by default)
- Test files colocated: `*.test.ts` / `*.spec.ts` within `src/`
- Integration tests in `test/integration/`
- Path aliases: `@` -> `src/renderer`, `@shared` -> `src/shared`
- Coverage via @vitest/coverage-v8
- React Testing Library available but minimal test coverage (most `__tests__/` contains a single `.bk` file)
- MSW 2.10 available for mocking HTTP requests

**Database:**
- No traditional database. All persistence via:
  - electron-store (JSON files on disk, main process)
  - BaseStorage abstraction (key-value, delegates to platform)
  - LibSQL (SQLite-based, used for knowledge base / RAG only, not chat data)
  - localStorage / IndexedDB (web platform)

**Auth:**
- No user authentication system. No users table, no login/register.
- Auth tokens exist only for LLM provider API keys (per-provider settings)
- authInfoStore manages ChatboxAI service tokens (access/refresh), not user auth
- OAuth stubs in `shared/oauth/` are no-ops in the open-source edition
- useOAuth hook returns `{ isOAuthActive: false }` always

---

## Feature Gap Analysis

### Status definitions:
- **EXISTS** — Implemented, meets spec requirements. Pre-satisfied dependency.
- **PARTIAL** — Implemented but incomplete. Modification task needed.
- **NEW** — Not present. Creation task needed (same as greenfield).
- **CONFLICTS** — Present but contradicts spec approach. Removal + replacement needed. ADR required.

### Core Platform

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| Next.js web app with App Router | CONFLICTS | `electron.vite.config.ts`, `src/renderer/router.tsx` (TanStack Router + Electron) | Chatbox is an Electron desktop app. Spec requires Next.js with App Router, SSR-capable routes, and API route handlers. The web build mode strips Electron but still uses Vite + TanStack Router, not Next.js. | XL |
| PostgreSQL database (8 tables) | CONFLICTS | `src/main/store-node.ts` (electron-store JSON), `src/renderer/storage/` (BaseStorage key-value) | Chatbox uses flat JSON files via electron-store. Spec requires PostgreSQL with relational tables (users, conversations, messages, apps, tool_logs, oauth_tokens, intents, app_sessions). No SQL, no migrations, no relational data model. | XL |
| WebSocket chat with streaming | CONFLICTS | `src/renderer/packages/model-calls/stream-text.ts` (Vercel AI SDK direct streaming) | Chatbox streams directly from LLM providers in the renderer process (client-side API calls). Spec requires server-side WebSocket connection where the server talks to the LLM and streams to the client. The streaming UX concepts (chunks, progress) are similar but the architecture is inverted. | L |
| User authentication (JWT, register/login) | NEW | `src/renderer/stores/authInfoStore.ts` (ChatboxAI service tokens, not user auth) | No user system exists. authInfoStore manages ChatboxAI service tokens, not platform user accounts. Spec requires users table, bcrypt hashing, JWT, register/login/me endpoints, role-based access (student/teacher/admin). | L |
| Conversation CRUD API | PARTIAL | `src/renderer/stores/chatStore.ts` (session list/CRUD via storage) | Session CRUD exists in chatStore but persists to electron-store/localStorage, not PostgreSQL. Session data model (Session type) differs from spec (no user_id, no server-side API endpoints). Logic for list/create/delete exists but needs complete rewrite for server-backed REST API. | L |
| Message persistence | PARTIAL | `src/shared/types/session.ts` (Message type), `chatStore.ts` | Messages are stored as arrays within sessions in electron-store. Spec requires messages table in PostgreSQL with conversation_id FK, role enum, metadata JSONB. Message type structure is different (contentParts array vs content string). | L |
| Real-time streaming UI | PARTIAL | `src/renderer/components/chat/MessageList.tsx`, `MessageLoading.tsx` | Chat message rendering exists with streaming indicators. Components use Mantine/MUI and are tightly coupled to Chatbox's session model. Core rendering concepts (message list, streaming chunks, loading states) are reusable as reference but need rewrite for new data model. | M |

### Plugin / App Integration System

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| App registration API (REST) | NEW | -- | Nothing. Chatbox has no concept of third-party app registration. Spec requires POST/GET/PUT/DELETE endpoints for app registry with slug, tool_schemas, iframe_url, auth_type. | L |
| Tool schema definition (MCP-aligned JSON) | PARTIAL | `src/renderer/packages/mcp/controller.ts`, `@ai-sdk/mcp`, `@modelcontextprotocol/sdk` | Chatbox has MCP client support for connecting to external MCP servers (stdio/HTTP transports). However, MCP in Chatbox is for connecting to developer tools (file system, code search), not for third-party app registration. The schema format concepts overlap but the use case is fundamentally different. | M |
| Tool discovery endpoint (/api/tools) | NEW | -- | No server-side tool aggregation. Chatbox discovers tools at runtime from MCP server connections in the renderer process. Spec requires a server endpoint that aggregates tool schemas from registered apps. | M |
| LLM function calling with tool namespacing | PARTIAL | `src/renderer/packages/model-calls/stream-text.ts`, `toolsets/` | Chatbox uses Vercel AI SDK's tool calling for built-in tools (web search, file search, knowledge base). The function calling mechanism exists but tools are hardcoded, not dynamically registered. Spec requires `appSlug__toolName` namespacing and dynamic injection. | M |
| Tool Router (server-side orchestration) | NEW | -- | Nothing. All LLM interaction happens client-side in Chatbox. Spec requires a server-side ToolRouter service that manages the full invocation lifecycle (validate, circuit break, log, dispatch, timeout, retry). | XL |
| Invocation state machine | NEW | -- | No state machine for app invocations. Spec requires IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED/ERROR/TIMEOUT with explicit transitions. | M |
| Iframe embedding (sandboxed) | NEW | -- | No iframe rendering. Chatbox renders everything in the main React tree. Spec requires sandboxed iframes with `allow-scripts allow-forms allow-popups` (no `allow-same-origin`), CSP headers, and origin validation. | L |
| postMessage protocol (JSON-RPC 2.0) | NEW | -- | No postMessage communication. Spec requires bidirectional JSON-RPC 2.0 over window.postMessage between platform (parent) and app (iframe child). | L |
| Iframe readiness handshake | NEW | -- | No iframe lifecycle management. Spec requires `iframe_ready` signal, invocation buffering until ready, and 10s load timeout. | M |
| Completion signaling (app_complete) | NEW | -- | Nothing. Spec requires apps to signal completion with summary data, platform to validate, persist context_summary, remove iframe, resolve intent, and inject system message. | L |
| App state updates (app_state_update) | NEW | -- | No concept of app-to-platform state synchronization. | S |
| Heartbeat protocol | NEW | -- | No heartbeat mechanism. Spec requires apps to send heartbeats every 10s, platform to timeout after 60s of silence. | S |
| Intent tracking (first-class) | NEW | -- | No intent concept. Chatbox has no notion of user intent as a persisted entity. Spec requires intents table, one-active-per-conversation rule, intent transitions on tool invocation and completion. | M |
| App sessions (single-active-app rule) | NEW | -- | No app session concept. Spec requires app_sessions table with active/completed/error/timeout status, context_summary JSONB, single-active-app enforcement. | M |
| Context retention (context_summary) | PARTIAL | `src/renderer/packages/context-management/` | Chatbox has context management for LLM window (compaction, summary generation, tool cleanup). Concepts are related but implementation serves a different purpose (managing token budget, not app result summaries). The compaction/summary pattern could inform the spec's context_summary approach. | M |

### Applications

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| Chess app (full lifecycle) | NEW | -- | Nothing. No chess game, no board UI, no FEN state management. | L |
| Weather app | NEW | -- | Nothing. No weather API integration. | S |
| Spotify app (OAuth) | NEW | -- | Nothing. No Spotify integration. | M |

### Authentication & Authorization

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| User roles (student/teacher/admin) | NEW | -- | No role system. Chatbox is single-user. | S |
| OAuth proxy for third-party apps | CONFLICTS | `src/shared/oauth/` (stubs), `src/renderer/hooks/useOAuth.ts` (no-op) | OAuth exists as stubs only (open-source edition). The stubs return false/undefined for all operations. Chatbox's OAuth was designed for LLM provider auth (e.g., ChatboxAI service), not for third-party app user authorization. Spec requires platform-managed OAuth2 with authorization URL generation, callback handling, token storage in PostgreSQL, and CSRF protection via nonce. | L |
| JWT middleware | NEW | -- | No JWT verification middleware. authInfoStore manages tokens client-side only. | S |

### Error Handling & Observability

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| Circuit breaker (per-app) | NEW | -- | No circuit breaker. Chatbox has basic error handling in model calls (retry with `ai-retry`) but no circuit breaker pattern for external apps. | M |
| Timeout strategy (iframe 10s, tool 15s, OAuth 60s, WS 30s) | NEW | -- | No systematic timeout management. Chatbox has `testTimeout` in vitest config and some AbortController usage in model calls, but no timeout framework for the app lifecycle. | M |
| LLM recovery prompts | NEW | -- | No recovery prompt injection on tool failure. | S |
| Structured logging (pino/winston) | PARTIAL | `src/renderer/lib/utils.ts` (getLogger), `src/main/util.ts` (getLogger) | Chatbox has a `getLogger` utility but it wraps `console.*` methods, not a structured JSON logger. Spec requires pino or winston with structured JSON output and correlation context (invocationId, sessionId, conversationId). | M |
| Observability event catalog | NEW | -- | No structured event catalog. Spec defines 13 required log events with typed data payloads. | M |

### Content Safety

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| Tool schema sanitization | NEW | -- | No schema sanitization. Spec requires stripping prompt injection attempts from tool descriptions, name character validation, description truncation. `@braintree/sanitize-url` exists in deps but serves a different purpose. | M |
| CSP headers | NEW | -- | No CSP configuration. Electron has its own security model. Spec requires frame-src, script-src, connect-src directives for the web app. | S |
| Iframe sandbox enforcement | NEW | -- | No iframe security. Spec requires explicit sandbox attributes with `allow-same-origin` omitted. | S |

### UI & Client Architecture

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| Chat window component | PARTIAL | `src/renderer/components/chat/` (Message, MessageList, MessageLoading, etc.) | Rich chat UI exists with message rendering, markdown support, code highlighting, image display, and streaming indicators. However, components are coupled to Chatbox's Session model, electron-store, and platform abstraction. Cannot be used as-is; valuable as design reference. | M |
| Message input component | PARTIAL | `src/renderer/components/InputBox/` | Full-featured input with file attachment, drag-and-drop, multiline, hotkeys. Coupled to Chatbox's session actions and store. Useful as design reference. | M |
| Sidebar / conversation list | PARTIAL | `src/renderer/Sidebar.tsx` (14KB) | Full sidebar with session list, pinning, search, drag-and-drop reorder. Coupled to chatStore and session model. Useful as reference. | M |
| Markdown rendering | EXISTS | `src/renderer/components/Markdown.tsx` | Full markdown renderer with syntax highlighting, LaTeX (KaTeX), Mermaid diagrams, link handling. Well-isolated component. Could potentially be extracted and reused. | S |
| Loading / error UI components | PARTIAL | `src/renderer/components/ui/`, `MessageLoading.tsx`, `MessageErrTips.tsx` | UI primitives exist. Coupled to Mantine/MUI. | S |
| AppRenderer component (iframe manager) | NEW | -- | Nothing. Spec requires a component that manages iframe lifecycle, postMessage communication, origin validation, invocation buffering, and cleanup on completion/error. | L |

### LLM Integration

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| Multi-provider LLM support | EXISTS | `src/shared/providers/`, `src/shared/models/`, `src/renderer/adapters/` | Extensive multi-provider support (OpenAI, Anthropic, Google, Mistral, DeepSeek, Perplexity, OpenRouter, Azure, Cohere, etc.). All via Vercel AI SDK. This runs client-side; spec requires server-side LLM calls. The provider abstraction layer and model configuration are well-structured. | M |
| System prompt construction | PARTIAL | `src/renderer/packages/model-calls/message-utils.ts` (injectModelSystemPrompt) | System prompt injection exists but for Chatbox's own prompts, not the spec's tool-aware prompt structure. | S |
| Context window management | PARTIAL | `src/renderer/packages/context-management/` (compaction-detector, context-builder, summary-generator, tool-cleanup) | Sophisticated context management exists: compaction detection, summary generation, tool call cleanup, token estimation. Architecture is similar to spec's requirements but implementation is client-side and tied to Chatbox's message model. The algorithms and patterns are highly relevant. | M |
| Token estimation | EXISTS | `src/renderer/packages/token-estimation/`, `js-tiktoken` | Token counting utilities exist with tiktoken integration. Reusable concept. | S |

---

## Convention Decisions

| Area | Existing Convention | Spec Convention | Decision | Reasoning |
|---|---|---|---|---|
| Linter/Formatter | Biome 2.0 (unified lint + format) | Implied ESLint + Prettier | **REPLACE** | Spec explicitly mentions ESLint in CI checks. Next.js has native ESLint integration. Biome config cannot transfer to Next.js project. Adopt ESLint + Prettier for the new project. |
| App framework | Electron + electron-vite | Next.js with App Router | **REPLACE** | Fundamental architecture change. Chatbox is a desktop app; spec requires a web app with server-side rendering, API routes, and WebSocket server. No path from Electron to Next.js. |
| Routing | TanStack Router (client-side, hash history) | Next.js App Router (file-based, server components) | **REPLACE** | TanStack Router cannot be used with Next.js App Router. Different paradigms (imperative vs file-based). |
| State management | Jotai atoms + Zustand stores | Not specified (Next.js conventions) | **EVOLVE** | Zustand is framework-agnostic and works well with Next.js for client-side state. Keep Zustand for client state (chat UI, streaming). Drop Jotai (adds complexity without benefit in a simpler app). Server state managed by React Query or server components. |
| UI component library | Mantine 7 + MUI 5 (dual) | Not specified | **EVOLVE** | Using two component libraries is accidental complexity. Pick one. Mantine is more modern, lighter, and has better DX. Drop MUI. Alternatively, use shadcn/ui for maximum Next.js ecosystem alignment. |
| CSS | Tailwind CSS 3 + Mantine styles + Emotion + CSS modules | Not specified | **EVOLVE** | Tailwind is spec-compatible. Keep Tailwind, drop Emotion and CSS modules. Consolidate to Tailwind + component library styles only. |
| Data persistence | electron-store (JSON on disk) + LibSQL (knowledge base) | PostgreSQL (relational, server-side) | **REPLACE** | Fundamentally different. electron-store is client-side JSON; spec requires PostgreSQL with migrations, foreign keys, indexes. No migration path. |
| Build system | electron-vite (Vite with Electron extensions) | Next.js built-in (Webpack/Turbopack) | **REPLACE** | electron-vite is Electron-specific. Next.js has its own build system. |
| Test framework | Vitest 4 | Jest or Vitest | **ADOPT** | Vitest works with Next.js. Keep Vitest. Add React Testing Library, Supertest for API tests. |
| Package manager | pnpm 10 | Not specified | **ADOPT** | pnpm is efficient and well-supported. Keep it. |
| Schema validation | Zod 4 | Not specified | **ADOPT** | Zod is excellent for TypeScript validation. Already used extensively in Chatbox. Keep for API validation, form validation, and runtime type checking. |
| API communication | Direct LLM API calls from client | WebSocket (chat) + REST (CRUD) | **REPLACE** | Chatbox calls LLM APIs directly from the browser/renderer. Spec requires all LLM calls to go through the server. Client communicates via WebSocket for chat and REST for CRUD. |
| Internationalization | i18next with 14+ languages | Not in spec scope | **REPLACE** | i18n is out of scope for the 7-day sprint. Remove to reduce complexity. Can be added later. |
| Commit convention | Not enforced (Husky + lint-staged for formatting) | `<type>(<scope>): <description>` | **ADOPT** | Spec defines explicit commit convention. Adopt it. Husky + lint-staged pattern from Chatbox is reusable for pre-commit hooks. |

---

## Dependency Delta

### Remove (Electron / desktop-specific)

| Package | Fork Version | Action | Reason |
|---|---|---|---|
| electron | ^26.6.10 | remove | Desktop runtime, not needed for web app |
| electron-builder | ^24.2.1 | remove | Desktop packaging |
| electron-vite | ^4.0.1 | remove | Electron build tooling |
| electron-store | ^8.1.0 | remove | Desktop persistence |
| electron-debug | ^3.2.0 | remove | Desktop debugging |
| electron-devtools-installer | ^3.2.0 | remove | Desktop dev tools |
| electron-log | ^5.3.4 | remove | Desktop logging |
| electron-updater | ^6.3.9 | remove | Desktop auto-update |
| electronmon | ^2.0.2 | remove | Desktop dev server |
| @electron/notarize | ^2.0.0 | remove | macOS notarization |
| @electron/rebuild | ^3.2.13 | remove | Native module rebuilding |
| auto-launch | ^5.0.6 | remove | Desktop auto-start |
| @capacitor/* | various | remove | Mobile platform |
| capacitor-* | various | remove | Mobile plugins |

### Remove (unnecessary for spec)

| Package | Fork Version | Action | Reason |
|---|---|---|---|
| @mui/material | ^5.11.11 | remove | Duplicate UI library; consolidate to one |
| @mui/icons-material | ^5.11.11 | remove | MUI icons |
| @emotion/react | ^11.14.0 | remove | MUI dependency |
| @emotion/styled | ^11.14.0 | remove | MUI dependency |
| @emotion/css | ^11.13.5 | remove | MUI dependency |
| @emotion/babel-plugin | ^11.13.5 | remove | MUI dependency |
| @emotion/babel-preset-css-prop | ^11.12.0 | remove | MUI dependency |
| i18next | ^22.4.13 | remove | i18n out of scope |
| react-i18next | ^12.2.0 | remove | i18n out of scope |
| @tanstack/react-router | ^1.114.23 | remove | Replaced by Next.js App Router |
| @tanstack/router-plugin | ^1.120.15 | remove | TanStack Router Vite plugin |
| @tanstack/router-devtools | ^1.114.23 | remove | TanStack Router devtools |
| jotai | ^2.1.0 | remove | Simplify to Zustand only |
| jotai-immer | ^0.4.1 | remove | Jotai middleware |
| jotai-optics | ^0.3.0 | remove | Jotai middleware |
| optics-ts | ^2.4.0 | remove | Jotai optics |
| @mastra/core | ^0.13.2 | remove | RAG framework, not needed |
| @mastra/libsql | ^0.13.2 | remove | LibSQL for RAG |
| @mastra/rag | ^1.0.8 | remove | RAG pipeline |
| @libsql/client | ^0.15.6 | remove | LibSQL client |
| @sentry/react | ^10.12.0 | remove | Can add later if needed |
| @sentry/node | ^9.28.1 | remove | Can add later if needed |
| @sentry/vite-plugin | ^4.6.1 | remove | Sentry Vite integration |
| javascript-obfuscator | ^4.0.2 | remove | Code obfuscation, not needed |
| webpack-obfuscator | ^3.5.1 | remove | Webpack obfuscation |
| All webpack-* packages | various | remove | Next.js manages its own bundling |
| @biomejs/biome | 2.0.0 | remove | Replaced by ESLint + Prettier |
| mermaid | ^11.4.0 | remove | Diagram rendering, nice-to-have later |
| d3 types | ^7.4.3 | remove | Mermaid dependency |
| photoswipe / react-photoswipe-gallery | various | remove | Image gallery, not needed |
| epub | ^1.3.0 | remove | File parsing |
| officeparser | 5.0.0 | remove | File parsing |
| cohere-ai | ^7.17.1 | remove | LLM provider, can re-add if needed |

### Keep (reusable)

| Package | Fork Version | Action | Reason |
|---|---|---|---|
| react | ^18.2.0 | keep | Core framework |
| react-dom | ^18.2.0 | keep | React DOM |
| typescript | ^5.8.3 | keep | Type system |
| zod | ^4.0.17 | keep | Schema validation |
| zustand | ^5.0.6 | keep | Client state management |
| @tanstack/react-query | ^5.74.4 | keep | Server state / caching |
| ai | ^6.0.11 | keep | Vercel AI SDK (server-side usage) |
| @ai-sdk/openai | ^3.0.4 | keep | OpenAI provider |
| @ai-sdk/anthropic | ^3.0.6 | keep | Anthropic provider |
| tailwindcss | ^3.4.0 | keep | CSS framework |
| clsx | ^2.0.0 | keep | Class name utility |
| uuid | ^9.0.0 | keep | UUID generation |
| dayjs | ^1.11.13 | keep | Date handling |
| lodash | ^4.17.21 | keep | Utility library |
| vitest | ^4.0.16 | keep | Test framework |
| @testing-library/react | ^14.0.0 | keep | Component testing |
| msw | ^2.10.5 | keep | API mocking |
| husky | ^9.0.11 | keep | Git hooks |
| lint-staged | ^16.1.2 | keep | Pre-commit formatting |
| react-markdown | ^9.0.0 | keep | Markdown rendering |
| react-syntax-highlighter | ^15.5.0 | keep | Code blocks |
| rehype-katex / remark-math / remark-gfm | various | keep | Markdown extensions |
| highlight.js | ^11.7.0 | keep | Syntax highlighting |
| axios | ^1.3.4 | keep | HTTP client |
| sonner | ^2.0.3 | keep | Toast notifications |
| immer | ^10.1.1 | keep | Immutable state updates (Zustand middleware) |

### Add (new for spec)

| Package | Version | Action | Reason |
|---|---|---|---|
| next | latest | add | App framework (spec requirement) |
| pg / @vercel/postgres | latest | add | PostgreSQL client |
| drizzle-orm or prisma | latest | add | Database ORM / migrations |
| bcryptjs | latest | add | Password hashing |
| jsonwebtoken | latest | add | JWT creation / verification |
| ws | latest | add | WebSocket server |
| pino | latest | add | Structured JSON logging |
| chess.js | latest | add | Chess game logic (chess app) |
| eslint | latest | add | Linter (replacing Biome) |
| prettier | latest | add | Formatter (replacing Biome) |
| eslint-config-next | latest | add | Next.js ESLint config |
| supertest | latest | add | API route testing |

---

## Pre-Satisfied Dependencies

Very few features from Chatbox can be treated as genuinely pre-satisfied. The fundamental architecture change (Electron desktop app -> Next.js web app) means almost nothing works as-is.

**Genuinely reusable (as code reference, not drop-in):**

- **Markdown rendering** — `src/renderer/components/Markdown.tsx` — Well-isolated component with react-markdown, syntax highlighting, LaTeX, GFM. Can be adapted to the new project with minimal changes (remove Mantine wrapper dependencies). Verified at commit `0d3139e`.

- **Context management algorithms** — `src/renderer/packages/context-management/` — Compaction detection, summary generation, and tool cleanup algorithms. The logic for managing LLM context windows (when to compact, how to summarize) is directly relevant to the spec's context window management requirements. Needs extraction from Chatbox's data model but algorithms transfer. Verified at commit `0d3139e`.

- **Token estimation** — `src/renderer/packages/token-estimation/` — Token counting with js-tiktoken. Reusable utility. Verified at commit `0d3139e`.

- **Zod schemas** — `src/shared/types/session.ts`, `src/shared/types/settings.ts` — Pattern of using Zod for runtime type validation. The specific schemas don't transfer (different data model) but the approach does.

**NOT pre-satisfied (despite superficial similarity):**

- Chat UI components — Deeply coupled to Chatbox's session model, electron-store, platform abstraction, Mantine+MUI, and i18next.
- MCP integration — Used for developer tool connections (stdio/HTTP), not third-party app registration. Different purpose.
- OAuth — Stubs only in open-source edition. No real implementation.
- LLM provider support — Client-side only. Spec requires server-side LLM calls.
- Streaming — Client-side direct streaming. Spec requires server->client WebSocket streaming.

---

## ADR Triggers

- [ ] **ADR-001: Electron to Next.js migration** — triggered by: CONFLICTS on app framework. The entire application architecture changes from Electron desktop to Next.js web. This ADR must document: why Next.js (spec requirement), what can be salvaged (very little), how to structure the new project, and the relationship between the Chatbox fork and the new codebase.

- [ ] **ADR-002: electron-store to PostgreSQL** — triggered by: CONFLICTS on data persistence. All data storage changes from client-side JSON files to server-side relational database. Must document: migration of data model concepts, ORM choice (Drizzle vs Prisma), migration strategy, and seed data approach.

- [ ] **ADR-003: Client-side LLM to server-side LLM** — triggered by: CONFLICTS on streaming architecture. LLM calls move from direct client-side API calls to server-mediated WebSocket streaming. Must document: why server-side (spec security requirements, tool routing), WebSocket protocol design, and impact on token/cost management.

- [ ] **ADR-004: Biome to ESLint + Prettier** — triggered by: REPLACE on linter/formatter. Must document: why the change (Next.js ecosystem alignment, spec implies ESLint), config migration approach, and CI integration.

- [ ] **ADR-005: TanStack Router to Next.js App Router** — triggered by: REPLACE on routing. Must document: route structure mapping, server component usage, and middleware approach.

- [ ] **ADR-006: OAuth stub replacement** — triggered by: CONFLICTS on OAuth proxy. Must document: new OAuth flow (platform as proxy), token storage in PostgreSQL, CSRF protection, and iframe OAuth popup pattern.

- [ ] **ADR-007: Dual UI library consolidation** — triggered by: REPLACE decision on Mantine + MUI. Must document: which library to keep (or replace with shadcn/ui), migration approach for any reused components.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Electron coupling in shared code** — `src/shared/` may have hidden dependencies on Electron APIs (e.g., `app.getPath`, IPC, `BrowserWindow`) that break when extracted. | High | Medium | Audit every file in `src/shared/` before reuse. The `platform` abstraction layer exists but is designed for Electron first. Test shared code in Node.js environment. |
| **"Brownfield illusion" wastes time** — Attempting to reuse Chatbox code that looks similar but requires more effort to adapt than rewriting from scratch. The fork creates a false sense of progress. | High | High | Be honest about what's reusable. Most Chatbox code is NOT reusable as-is. Default to greenfield for anything that requires more than 30 min of adaptation. Use Chatbox as design reference only. |
| **Vercel AI SDK version mismatch** — Chatbox uses `ai@6.0.11` (client-side). Server-side Next.js usage may require different patterns or versions. | Medium | Low | Review AI SDK docs for Next.js server-side usage. The SDK supports both client and server usage. |
| **Chatbox dependency bloat** — Chatbox's package.json has 200+ dependencies, many desktop-specific. New project inheriting any of this creates supply chain risk and bloat. | Medium | Medium | Start with a clean package.json. Only add dependencies explicitly needed. Do not copy Chatbox's package.json. |
| **Platform abstraction layer mismatch** — Chatbox's `src/renderer/platform/` has desktop/web/mobile variants, but the web variant may not match Next.js requirements. | Medium | Low | Do not use Chatbox's platform abstraction. Build new abstractions for Next.js. |
| **Test infrastructure gap** — Chatbox has minimal test coverage (mostly `.bk` stub files). No test patterns to learn from for the new project. | Low | Low | Follow spec's TDD approach from scratch. Chatbox offers no test patterns to reuse. |
| **i18next removal may break extracted components** — Any component extracted from Chatbox that uses `t()` (i18next) will break. | Medium | Low | Search for `t(` and `useTranslation` in any code considered for extraction. Replace with hardcoded strings. |
| **Context management extraction complexity** — The context management algorithms in `src/renderer/packages/context-management/` depend on Chatbox's Message and Session types. | Medium | Medium | Extract algorithms as pure functions with new type signatures matching the spec's data model. Rewrite the data access layer while preserving the compaction/summary logic. |

---

## Impact on CLAUDE.md

CLAUDE.md must be written with the understanding that this is **effectively a greenfield project** that happens to have a reference codebase available:

1. **Repo Layout** — Should describe the NEW Next.js project structure (from spec Section 9-10), not the Chatbox structure. Mention that `chatbox/` exists as a read-only reference but is not the working codebase.

2. **Build & Run** — Should describe Next.js commands (`npm run dev`, `npm run build`, `npm test`), not electron-vite commands. No Electron-specific instructions.

3. **Dependencies** — Should list the new dependency set (Next.js, PostgreSQL, ws, etc.), not Chatbox's 200+ dependencies.

4. **Code Patterns** — Should describe spec patterns (server-side API routes, WebSocket protocol, PostgreSQL queries, Zod validation), not Chatbox patterns (electron-store, Jotai atoms, IPC channels).

5. **Reference Codebase** — Should include a section noting: "The `chatbox/` directory contains the forked Chatbox codebase. Consult it for: (a) Markdown rendering component design, (b) context management algorithms, (c) token estimation utilities, (d) general React chat UI patterns. Do NOT import from or depend on `chatbox/` code directly."

6. **Conventions** — Should specify ESLint + Prettier (not Biome), Next.js App Router patterns (not TanStack Router), PostgreSQL (not electron-store), Vitest (carried over from Chatbox).

7. **Testing** — Should emphasize TDD workflow from spec Section 11.1. Note that Chatbox has minimal test coverage and provides no test patterns to follow.

---

## Impact on TASKS.md

The reconciliation significantly changes the task DAG compared to a pure greenfield approach:

### Pre-Satisfied Tasks (can skip or reduce scope)
- None. No features from Chatbox qualify as EXISTS in a way that eliminates a task entirely. The architecture delta is too large.

### Modified Tasks (reference available, not creation from scratch)
- **Task 1.1 (Project scaffold)** — Instead of pure scaffolding, this also involves deciding what to extract from Chatbox. Decision: extract nothing at scaffold time. Start clean. Time estimate stays the same.
- **Markdown rendering** — When the chat UI needs markdown, extract and adapt `Markdown.tsx` from Chatbox instead of building from scratch. Saves ~2-4 hours.
- **Context window management** — When implementing context compaction (spec Section 6.3), reference Chatbox's `context-management/` algorithms. Saves ~2-4 hours of algorithm design.
- **Token estimation** — When implementing token counting, adapt Chatbox's `token-estimation/` module. Saves ~1-2 hours.

### New Tasks Added (brownfield-specific)
- **Task 0.0 (Codebase separation)** — Ensure `chatbox/` is isolated from the new project. Verify no build scripts, imports, or configs reference across the boundary. This must be Layer 0 in the DAG.
- **ADR writing** — 7 ADRs triggered by this reconciliation. Each should be written before starting the corresponding feature. Add as prerequisites to relevant tasks.

### Task Ordering Changes
- The spec's task breakdown (Sections 12.1-12.5) remains valid as-is. The brownfield context does not change the critical path.
- Every task is effectively a creation task. The word "modification" applies only to the 3 items above (markdown, context management, token estimation) where Chatbox provides reference code.

### Effort Recalibration
- Original spec estimates assume greenfield. Brownfield adds ~0.5-1 day of overhead for: initial codebase exploration, ADR decisions, resisting the temptation to "reuse" code that costs more to adapt than to rewrite.
- Net savings from Chatbox reference code: ~0.5 day (markdown + context management + token estimation).
- **Net impact: approximately neutral.** The brownfield context neither significantly helps nor hurts the timeline.

---

*This reconciliation feeds into CLAUDE.md (AI agent onboarding) and TASKS.md (living task tracker).*
