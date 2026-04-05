# ChatBridge — Engineering Specification (Brownfield)

**Source documents:** `PRD.md`, `TECHNICAL_PRESEARCH.md`, `RECONCILIATION.md`
**Sprint:** 7 days
**Methodology:** TDD, trunk-based development, vertical-slice-first
**Status:** Draft, revised for brownfield execution and educational app alignment

---

## 1. Executive Summary

ChatBridge is a Chatbox-derived chat platform that can invoke third-party apps inside the conversation, track their lifecycle, and resume normal chat with retained context after the app interaction ends.

This is **not** a greenfield chat product. The implementation should preserve and adapt Chatbox strengths where they accelerate delivery, while introducing a new server-side control plane for:

* authentication
* conversation persistence
* tool discovery
* tool routing
* app lifecycle tracking
* auth / OAuth proxying where required
* safety enforcement

The correct engineering framing is:

* **brownfield on the interaction layer**
* **greenfield where trust, persistence, and orchestration require it**

The app set is now intentionally aligned with the K–12 case-study lens rather than generic demo integrations. The primary demonstration apps are:

* **Chess** — required flagship, complex and stateful
* **Khan Academy Companion** — non-auth, session-only lesson/topic companion (no server-persisted state)
* **Flashcards** — platform-authenticated study app with user-specific decks/progress (no external OAuth in MVP)
* **First Principles Tutor** — bonus fourth app, may be hosted in-repo or standalone, but must use the same iframe + JSON-RPC contract as all other apps

---

## 2. Engineering Principles

### 2.1 Build on Chatbox, Do Not Shadow-Rewrite It

The project is meant to build on top of Chatbox. That means:

* reuse or adapt Chatbox interaction patterns first
* do not redesign the chat shell unless a platform requirement forces it
* treat the `chatbox/` directory as the foundation codebase that ChatBridge extends
* extract and adapt Chatbox code into ChatBridge-owned modules as needed

### 2.2 Server Authority Is Non-Negotiable

All privileged operations belong on the server:

* LLM calls
* auth
* app registration
* tool routing
* tool logs
* app sessions
* token / credential handling for authenticated apps

### 2.3 One Vertical Slice Before Breadth

`Chess` is the proof-of-system slice. It must demonstrate:

1. invocation
2. app render
3. mid-app assistance
4. completion signaling
5. context retention
6. follow-up conversation

No second-wave app work should weaken this rule.

### 2.4 Timebox Reuse Decisions

Use the following rule:

* if a Chatbox module can be extracted or adapted in under 30 minutes, reuse it
* if it is tightly coupled to Electron-only or client-authority assumptions, rewrite it

This prevents brownfield drift from turning into wasted time.

### 2.5 Educational Value Is a Product Constraint

App selection should be evaluated through the TutorMeAI case-study lens. The goal is not merely to prove arbitrary plugin capability, but to show that the platform can orchestrate educationally meaningful experiences for K–12 users.

---

## 3. Reuse Boundary Matrix

| Area                                   | Decision                       | Notes                                               |
| -------------------------------------- | ------------------------------ | --------------------------------------------------- |
| Markdown rendering                     | Reuse / adapt                  | High-value and relatively isolated                  |
| Chat transcript layout patterns        | Reuse / adapt                  | Preserve proven interaction quality                 |
| Streaming response presentation        | Reuse patterns                 | Existing UX should inform the implementation        |
| Context compaction / summary logic     | Reuse algorithms               | Adapt to server-authoritative data model            |
| Token estimation                       | Reuse                          | Directly relevant                                   |
| Provider abstraction ideas             | Adapt carefully                | Move execution server-side                          |
| Electron-specific runtime code         | Do not port                    | Windowing, preload, IPC are not target architecture |
| Local-only persistence                 | Do not port as source of truth | Server persistence is authoritative                 |
| App registry / tool router             | New                            | Not present in Chatbox                              |
| App session lifecycle                  | New                            | Not present in Chatbox                              |
| Authenticated app broker / OAuth proxy | New                            | Chatbox OSS stubs are insufficient                  |

---

## 4. Target Architecture

### 4.1 High-Level Shape

The deployable application may be a web-first shell, but it must remain Chatbox-derived in UX and extracted modules.

```text
┌──────────────────────────────────────────────────────────────┐
│                  ChatBridge Client (web)                    │
│                                                              │
│  Chatbox-derived Chat UI   App Slot / Iframe Renderer       │
│  - transcript              - sandboxed iframe               │
│  - markdown                - lifecycle UI                   │
│  - input ergonomics        - postMessage bridge             │
│  - streaming UX            - completion handling            │
└───────────────┬───────────────────────────────┬─────────────┘
                │                               │
                │ REST / WS                     │ JSON-RPC 2.0
                │                               │ over postMessage
                ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                 ChatBridge Server Control Plane             │
│                                                              │
│  auth  conversations  chat  tools  apps  tokens  logging    │
│                                                              │
│  - server-side LLM calls                                     │
│  - tool routing                                              │
│  - app session state machine                                 │
│  - intent tracking                                           │
│  - timeout / circuit breaker                                 │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
                    PostgreSQL / durable storage
```

### 4.2 Brownfield Interpretation (Option C)

ChatBridge uses Chatbox's actual web build as the frontend shell. This means:

* Chatbox's web build is the deployed frontend — not a separate Next.js UI
* ChatBridge features are injected INTO Chatbox via a custom provider, auth gate, and app renderer
* The server control plane (auth, LLM, tools, apps, authenticated app flows) is owned by ChatBridge
* Chatbox handles UI, state management, message rendering, and chat ergonomics

---

## 5. Repo Ownership and Boundaries

```text
chatbridge/
├── chatbox/                  # Forked Chatbox — the frontend shell (modified)
│   ├── src/shared/providers/definitions/chatbridge.ts   # ChatBridge provider
│   ├── src/shared/providers/definitions/models/chatbridge.ts  # Model class
│   ├── src/renderer/stores/chatbridge/                  # Auth + conversation mapping
│   ├── src/renderer/components/chatbridge/              # AuthGate + AppRenderer
│   ├── src/renderer/setup/chatbridge_init.ts            # Startup config
│   └── (rest of Chatbox — UI, routing, state, etc.)
├── src/                      # ChatBridge server app (Next.js)
│   ├── app/api/              # API route handlers
│   └── app/apps/             # Chess, Khan, Flashcards, First Principles app pages
├── server/                   # Server control plane
│   ├── services/             # chat, tool-router, intent, completion, auth, token broker
│   ├── apps/                 # chess, khan, flashcards, firstprinciples handlers
│   ├── lib/                  # db, logger, circuit-breaker, schema, ws-manager
│   └── middleware/           # auth
└── docs/
```

### 5.1 Rules

* `chatbox/` is the forked foundation — ChatBridge builds on top of it
* New ChatBridge code inside chatbox/ lives in clearly namespaced directories (`chatbridge/`)
* The server control plane is fully owned by ChatBridge
* App pages are served by Next.js at `/apps/*`
* `First Principles Tutor` may be served either from `/apps/firstprinciples` or as a standalone sandboxed web app

---

## 6. System Responsibilities

### 6.1 Client Responsibilities

* render the chat transcript
* render assistant streaming output
* host the sandboxed iframe
* show app lifecycle state
* deliver user messages to the server
* receive streamed assistant output and invocation events
* relay iframe lifecycle events back to the server when required

### 6.2 Server Responsibilities

* authenticate the user
* persist conversations and messages
* choose and call the LLM
* discover app tools
* namespace and route tool calls
* create and manage app sessions
* enforce single-active-app behavior
* broker authenticated app access and token/session handling where required
* manage timeouts, circuit breakers, and logs

### 6.3 App Responsibilities

* render its own UI within sandbox limits
* respond to structured tool invocation requests
* send state updates when needed
* explicitly signal completion with a summary payload

---

## 7. Core Data Model

The storage model remains server-authoritative even if the client keeps temporary UI state.

### 7.1 Core Entities

| Entity            | Purpose                                                                |
| ----------------- | ---------------------------------------------------------------------- |
| `users`           | platform identity and roles                                            |
| `conversations`   | top-level chat sessions                                                |
| `messages`        | durable conversation history                                           |
| `apps`            | registered app metadata and tool definitions                           |
| `tool_logs`       | every attempted invocation and result                                  |
| `intents`         | current user goal / app context                                        |
| `app_sessions`    | active or completed app lifecycle instances                            |
| `app_auth_tokens` | platform-managed tokens for authenticated app access (platform auth only in MVP) |
| `study_decks`     | user-specific flashcard decks or deck metadata                         |
| `study_progress`  | per-user flashcard progress and session results                        |

> **Note:** Khan Academy Companion is session-only and has no dedicated persistence tables. Topic/lesson state lives only in the app session and context summary.

### 7.2 Design Rules

* the server is the system of record
* the client never becomes the canonical source for app completion
* app session state must be queryable and auditable
* completed app history is compressed into a context summary for future chat turns
* educational outcomes should be representable in durable summaries (for example: deck completion, lesson/topic reviewed, reasoning analysis completed)

---

## 8. Message and Lifecycle Protocols

### 8.1 Tool Namespace Format

Tools exposed to the LLM use:

```text
{appSlug}__{toolName}
```

Example:

```text
chess__start_game
khan__open_topic
flashcards__load_deck
firstprinciples__analyze
```

### 8.2 Invocation Lifecycle

The required state machine is:

```text
IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED -> IDLE
```

Additional terminal paths:

```text
ACTIVE -> ERROR
ACTIVE -> TIMEOUT
```

### 8.3 Required Server Events

* `tool_invocation_requested`
* `tool_invocation_dispatched`
* `tool_invocation_succeeded`
* `tool_invocation_failed`
* `tool_invocation_timed_out`
* `app_session_started`
* `app_session_completed`
* `app_session_terminated`
* `postmessage_origin_rejected`

### 8.4 Required App Signals

* `iframe_ready`
* `app_state_update`
* `app_complete`
* `app_error`
* optional `heartbeat`

### 8.5 Completion Payload

Every app must complete with a structured summary payload that can be injected back into the conversation context. Example shape:

```ts
type AppCompletePayload = {
  sessionId: string
  invocationId: string
  status: 'completed'
  contextSummary: string
  result?: Record<string, unknown>
}
```

The summary is more important than the raw result for long-term conversational continuity.

For educational apps, `contextSummary` should capture the learning outcome in a way the chatbot can reference later. Examples:

* `student completed 8 biology flashcards with 6 correct`
* `student reviewed Khan lesson on fractions and asked for extra practice`
* `student completed firstprinciples analysis on gravity and identified two assumptions`

---

## 9. Client Architecture

### 9.1 Chat UI

The chat UI should be visibly Chatbox-derived:

* message list behavior should preserve streaming clarity
* markdown rendering should retain quality
* input ergonomics should not regress
* loading and error states should feel native to the chat flow

### 9.2 Extracted Modules

Likely extraction candidates:

* markdown renderer
* token estimation
* context compaction helpers
* transcript presentation helpers

Each extracted module should be:

* copied into ChatBridge-owned code
* simplified to remove irrelevant coupling
* covered by focused tests

### 9.3 App Renderer

The client needs a new `AppRenderer` capability that Chatbox does not provide.

It must:

* render a sandboxed iframe
* validate origin
* wait for `iframe_ready`
* buffer messages until ready
* surface lifecycle state to the user
* clean up on completion, error, timeout, or forced replacement

### 9.4 Single-Active-App Rule

Only one app session may be active in the conversation at a time. Starting a new app session must terminate or archive the previous active one cleanly.

---

## 10. Server Architecture

### 10.1 Services

Recommended services:

* `auth.service`
* `conversation.service`
* `chat.service`
* `app.service`
* `tool.service`
* `tool-router.service`
* `intent.service`
* `app-session.service`
* `app-auth.service` (or `oauth.service` if a true OAuth flow is used)

### 10.2 Chat Service

The chat service must:

* build LLM context from conversation + active app context
* inject only relevant tool schemas
* stream model output to the client
* persist final messages
* recover gracefully when tool routing fails

### 10.3 Tool Router

The tool router is the center of the new platform behavior. It must:

* validate that the requested tool exists
* map tool name back to app + capability
* create a `tool_log`
* open or update an `app_session`
* enforce rate limits and circuit breakers
* wait for result or timeout
* update durable logs and session state

### 10.4 Intent Service

The platform tracks one active intent per conversation. The intent service must:

* create intent on tool invocation
* resolve prior intent when a new app session replaces it
* mark intent resolved on completion
* mark intent abandoned on timeout or failure when appropriate

### 10.5 Authenticated App Service

Authenticated app access is platform-owned. In the MVP, this means **platform authentication only** — the user logs into ChatBridge, and the platform gates app-specific data based on the platform user identity. There is no external OAuth flow in the MVP.

It must:

* gate access to user-specific flashcard decks or progress data using the platform user session
* associate authenticated app actions with the current platform user
* support resumable app flows when the user must authenticate before continuing
* keep app iframes away from direct credential handling

If external OAuth is added post-MVP, the same trust boundary applies: the platform manages authorization URL creation, state validation, token storage, and refresh.

---

## 11. Security Rules

### 11.1 Iframe Rules

The platform distinguishes between **internal apps** (first-party, served from the platform's own origin at `/apps/*`) and **external apps** (third-party, served from other origins). They have different trust models and sandbox profiles:

**External third-party apps** (the primary security concern):
* sandbox MUST omit `allow-same-origin`
* minimum sandbox: `allow-scripts allow-forms allow-popups`
* origin validated against allowlist on registration
* all incoming `postMessage` events validated against `"null"` origin (because sandboxed external iframes report null)

**Internal first-party apps** (bundled with the platform):
* sandbox MAY include `allow-same-origin` because they are code the platform ships and trusts — the third-party threat model does not apply
* this is required in practice: internal apps are Next.js SSR pages that need to load their own JS/CSS bundles from the platform origin
* all incoming `postMessage` events are validated against the platform's own origin
* app code for internal apps is subject to normal code review, not the sandbox isolation boundary

**Why the exception is safe:** the sandbox is a trust boundary for *untrusted* third-party code. Internal apps are first-party code the platform ships, so the trust boundary for them lives in the code review / deploy pipeline, not the browser sandbox. Granting `allow-same-origin` to code we already trust adds no real attack surface.

**Concrete rule:** the `AppRenderer` checks `iframeUrl.startsWith('/')` to determine internal vs external. Internal apps get `allow-same-origin`; external apps do not. This check is the single place the trust boundary is enforced.

### 11.2 Data Minimization

* share only the data an app needs for the current task
* do not leak full conversation history to third-party apps
* route authenticated app access through the platform

### 11.3 Tool Schema Hygiene

App tool descriptions must be sanitized:

* strip prompt-injection-style instructions
* cap description length
* normalize tool names
* reject malformed schemas

### 11.4 Concrete Failure Modes

The system must specifically guard against:

* **prompt injection via app output** — app output is treated as data, not instructions
* **malicious tool schemas** — schemas are validated and normalized before registration/use
* **data leakage via tool parameters** — apps receive scoped input only
* **state drift / falsified app state** — app state updates are shape-validated and session-bound

### 11.5 Logging

Every critical lifecycle event must be logged with enough context to trace:

* user
* conversation
* app session
* invocation
* outcome

---

## 12. Testing Strategy

### 12.1 Brownfield Regression Tests

When extracting Chatbox-derived modules, add focused tests that preserve the expected behavior. Highest-value candidates:

* markdown rendering
* streaming transcript chunk display
* context summary / compaction helpers

### 12.2 Platform Tests

The new server-driven behavior requires:

* auth tests
* conversation CRUD tests
* tool discovery tests
* tool router tests
* iframe lifecycle tests
* completion signaling tests
* authenticated app access tests

### 12.3 Vertical Slice Tests

The `Chess` slice must prove:

1. "let's play chess" triggers the correct tool
2. the iframe renders in chat
3. a move updates game state
4. "what should I do?" can reference board state
5. resign or checkmate triggers `app_complete`
6. a follow-up question references the context summary

### 12.3a Khan Academy Companion Tests

1. user asks for help on a topic such as fractions
2. the correct Khan companion tool is selected
3. the app iframe renders a session-only lesson/topic companion view
4. the student can return to chat and ask for explanation or quiz questions
5. on completion, a context summary captures the topic reviewed and any follow-up the student requested
6. no server-persisted state remains after the session ends

### 12.3b Flashcards Authenticated App Tests

1. user asks to review a saved deck
2. unauthenticated user is prompted through the **platform** auth gate (ChatBridge login)
3. after platform auth, the app resumes correctly with the user's identity
4. deck loads in the iframe, scoped to the platform user
5. card progress updates are tracked via `study_progress`
6. completion summary is retained in chat context

### 12.3c Bonus First Principles Tutor Tests

1. user submits a conceptual or problem-solving question
2. the app loads via the standard iframe + JSON-RPC contract (same as all other apps)
3. the app returns structured assumptions, principles, and reasoning steps
4. the chatbot can reference the analysis afterward

### 12.4 Failure Tests

At minimum:

* invalid tool name
* iframe load timeout
* origin mismatch
* duplicate completion signal
* app crash / error
* circuit breaker open state
* authenticated app attempted without valid platform session
* app resume after platform auth interruption
* malformed educational summary payload
* stale deck/session mismatch in flashcards app

---

## 13. Delivery Plan

### Phase 0: Brownfield Setup

* audit Chatbox reuse candidates
* extract the first owned modules
* document what will not be reused

### Phase 1: Server Authority

* auth
* conversations
* message persistence
* server-side LLM streaming

### Phase 2: App Platform

* app registration
* tool discovery
* tool router
* app session state machine
* iframe lifecycle bridge
* database migrations for new tables (`study_decks`, `study_progress`, `app_auth_tokens`)

### Phase 3: Chess Vertical Slice

* chess app UI
* chess tools
* mid-game analysis support
* completion signaling
* context retention

### Phase 4: Breadth and Hardening

* Khan Academy companion app
* authenticated flashcards app
* optional First Principles Tutor
* timeout and recovery paths
* developer onboarding docs
* polish and deployment

---

## 14. Done Criteria

The system is "done enough" for the sprint when:

* it still feels recognizably Chatbox-derived on the client side
* it proves server-authoritative orchestration
* `Chess` works end to end
* `Khan Academy Companion` works as the non-auth educational app
* `Flashcards` works as the authenticated third-party app
* app failures are recoverable
* the architecture can be explained as an extension of Chatbox rather than a disconnected rewrite
* bonus: `First Principles Tutor` demonstrates a fourth educational interaction pattern

### 14.1 Educational App Alignment

The case study should be interpreted through a K–12 educational lens. App selection is therefore not just a technical demonstration choice but a product decision.

The selected app set intentionally emphasizes educational value:

* `Chess` demonstrates strategic reasoning, stateful interaction, and tutoring support
* `Khan Academy Companion` demonstrates lesson guidance, follow-up explanation, and content-linked conversation
* `Flashcards` demonstrates authenticated, user-specific study workflows
* `First Principles Tutor` demonstrates structured conceptual reasoning and explanation

This is preferable to generic demo apps such as weather or entertainment integrations because it better reflects how TutorMeAI would create classroom value while still proving the architecture across multiple interaction patterns.

---

## 15. Explicit Non-Goals

These are out of scope for the sprint:

* perfect parity with full Chatbox desktop features
* deep admin tooling
* generalized marketplace infrastructure
* refactoring the donor codebase itself
* broad UI redesign unrelated to app-platform behavior
* full COPPA/FERPA compliance — the platform is designed with K–12 users in mind and should avoid collecting unnecessary PII, but formal regulatory compliance auditing and certification are out of scope for the sprint

---

## 16. Final Engineering Rule

Whenever there is a choice between:

* spending time rebuilding a solved Chatbox UX concern, or
* spending time validating app orchestration and lifecycle reliability

the second option wins.

That is the central discipline required to keep this project both brownfield and achievable.
