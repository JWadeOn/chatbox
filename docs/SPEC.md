# ChatBridge — Engineering Specification (Brownfield)

**Source documents:** `PRD.md`, `TECHNICAL_PRESEARCH.md`, `RECONCILIATION.md`  
**Sprint:** 7 days  
**Methodology:** TDD, trunk-based development, vertical-slice-first  
**Status:** Draft, revised for brownfield execution

---

## 1. Executive Summary

ChatBridge is a Chatbox-derived chat platform that can invoke third-party apps inside the conversation, track their lifecycle, and resume normal chat with retained context after the app interaction ends.

This is **not** a greenfield chat product. The implementation should preserve and adapt Chatbox strengths where they accelerate delivery, while introducing a new server-side control plane for:

- authentication
- conversation persistence
- tool discovery
- tool routing
- app lifecycle tracking
- OAuth proxying
- safety enforcement

The correct engineering framing is:

- **brownfield on the interaction layer**
- **greenfield where trust, persistence, and orchestration require it**

---

## 2. Engineering Principles

### 2.1 Build on Chatbox, Do Not Shadow-Rewrite It

The project is meant to build on top of Chatbox. That means:

- reuse or adapt Chatbox interaction patterns first
- do not redesign the chat shell unless a platform requirement forces it
- treat the `chatbox/` directory as a donor/reference codebase, not a live runtime dependency
- extract copied code into ChatBridge-owned modules before relying on it

### 2.2 Server Authority Is Non-Negotiable

All privileged operations belong on the server:

- LLM calls
- auth
- app registration
- tool routing
- tool logs
- app sessions
- OAuth token handling

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

- if a Chatbox module can be extracted or adapted in under 30 minutes, reuse it
- if it is tightly coupled to Electron-only or client-authority assumptions, rewrite it

This prevents brownfield drift from turning into wasted time.

---

## 3. Reuse Boundary Matrix

| Area | Decision | Notes |
|---|---|---|
| Markdown rendering | Reuse / adapt | High-value and relatively isolated |
| Chat transcript layout patterns | Reuse / adapt | Preserve proven interaction quality |
| Streaming response presentation | Reuse patterns | Existing UX should inform the implementation |
| Context compaction / summary logic | Reuse algorithms | Adapt to server-authoritative data model |
| Token estimation | Reuse | Directly relevant |
| Provider abstraction ideas | Adapt carefully | Move execution server-side |
| Electron-specific runtime code | Do not port | Windowing, preload, IPC are not target architecture |
| Local-only persistence | Do not port as source of truth | Server persistence is authoritative |
| App registry / tool router | New | Not present in Chatbox |
| App session lifecycle | New | Not present in Chatbox |
| OAuth proxy | New | Chatbox OSS stubs are insufficient |

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
│  auth  conversations  chat  tools  apps  oauth  logging     │
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

### 4.2 Brownfield Interpretation

This architecture does **not** mean "ignore Chatbox and rebuild in a new framework." It means:

- use a deployable web shell where public access and server authority demand it
- keep Chatbox-derived interaction primitives and extracted modules in that shell
- replace only the parts Chatbox was never designed to own

---

## 5. Repo Ownership and Boundaries

Recommended repo contract:

```text
chatbridge/
├── chatbox/                  # read-only donor/reference codebase
├── src/                      # ChatBridge-owned client app
│   ├── app/                  # routes/pages if using Next.js App Router
│   ├── components/
│   │   ├── chat/             # adapted chat UI
│   │   ├── apps/             # app renderer / lifecycle UI
│   │   └── ui/
│   ├── lib/
│   │   ├── extracted/        # Chatbox-derived owned modules
│   │   ├── chat/
│   │   ├── postmessage/
│   │   └── api/
│   └── types/
├── server/                   # server control plane
│   ├── routes/
│   ├── services/
│   ├── lib/
│   └── types/
└── docs/
```

### 5.1 Rules

- `chatbox/` stays read-only
- no runtime imports from `chatbox/`
- any reused code is copied/extracted into ChatBridge-owned files
- extracted modules must get focused regression tests

---

## 6. System Responsibilities

### 6.1 Client Responsibilities

- render the chat transcript
- render assistant streaming output
- host the sandboxed iframe
- show app lifecycle state
- deliver user messages to the server
- receive streamed assistant output and invocation events
- relay iframe lifecycle events back to the server when required

### 6.2 Server Responsibilities

- authenticate the user
- persist conversations and messages
- choose and call the LLM
- discover app tools
- namespace and route tool calls
- create and manage app sessions
- enforce single-active-app behavior
- broker OAuth flows
- manage timeouts, circuit breakers, and logs

### 6.3 App Responsibilities

- render its own UI within sandbox limits
- respond to structured tool invocation requests
- send state updates when needed
- explicitly signal completion with a summary payload

---

## 7. Core Data Model

The storage model remains server-authoritative even if the client keeps temporary UI state.

### 7.1 Core Entities

| Entity | Purpose |
|---|---|
| `users` | platform identity and roles |
| `conversations` | top-level chat sessions |
| `messages` | durable conversation history |
| `apps` | registered app metadata and tool definitions |
| `tool_logs` | every attempted invocation and result |
| `intents` | current user goal / app context |
| `app_sessions` | active or completed app lifecycle instances |
| `oauth_tokens` | platform-managed third-party tokens |

### 7.2 Design Rules

- the server is the system of record
- the client never becomes the canonical source for app completion
- app session state must be queryable and auditable
- completed app history is compressed into a context summary for future chat turns

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
spotify__create_playlist
weather__get_weather
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

- `tool_invocation_requested`
- `tool_invocation_dispatched`
- `tool_invocation_succeeded`
- `tool_invocation_failed`
- `tool_invocation_timed_out`
- `app_session_started`
- `app_session_completed`
- `app_session_terminated`
- `postmessage_origin_rejected`

### 8.4 Required App Signals

- `iframe_ready`
- `app_state_update`
- `app_complete`
- `app_error`
- optional `heartbeat`

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

---

## 9. Client Architecture

### 9.1 Chat UI

The chat UI should be visibly Chatbox-derived:

- message list behavior should preserve streaming clarity
- markdown rendering should retain quality
- input ergonomics should not regress
- loading and error states should feel native to the chat flow

### 9.2 Extracted Modules

Likely extraction candidates:

- markdown renderer
- token estimation
- context compaction helpers
- transcript presentation helpers

Each extracted module should be:

- copied into ChatBridge-owned code
- simplified to remove irrelevant coupling
- covered by focused tests

### 9.3 App Renderer

The client needs a new `AppRenderer` capability that Chatbox does not provide.

It must:

- render a sandboxed iframe
- validate origin
- wait for `iframe_ready`
- buffer messages until ready
- surface lifecycle state to the user
- clean up on completion, error, timeout, or forced replacement

### 9.4 Single-Active-App Rule

Only one app session may be active in the conversation at a time. Starting a new app session must terminate or archive the previous active one cleanly.

---

## 10. Server Architecture

### 10.1 Services

Recommended services:

- `auth.service`
- `conversation.service`
- `chat.service`
- `app.service`
- `tool.service`
- `tool-router.service`
- `intent.service`
- `app-session.service`
- `oauth.service`

### 10.2 Chat Service

The chat service must:

- build LLM context from conversation + active app context
- inject only relevant tool schemas
- stream model output to the client
- persist final messages
- recover gracefully when tool routing fails

### 10.3 Tool Router

The tool router is the center of the new platform behavior. It must:

- validate that the requested tool exists
- map tool name back to app + capability
- create a `tool_log`
- open or update an `app_session`
- enforce rate limits and circuit breakers
- wait for result or timeout
- update durable logs and session state

### 10.4 Intent Service

The platform tracks one active intent per conversation. The intent service must:

- create intent on tool invocation
- resolve prior intent when a new app session replaces it
- mark intent resolved on completion
- mark intent abandoned on timeout or failure when appropriate

### 10.5 OAuth Service

OAuth is platform-owned. It must:

- create authorization URLs
- manage nonce / state validation
- store and refresh tokens
- keep app iframes away from direct credential handling

---

## 11. Security Rules

### 11.1 Iframe Rules

- sandbox must omit `allow-same-origin`
- minimum sandbox: `allow-scripts allow-forms allow-popups`
- app origins must be allowlisted
- all incoming `postMessage` events must validate origin and session context

### 11.2 Data Minimization

- share only the data an app needs for the current task
- do not leak full conversation history to third-party apps
- route OAuth through the platform

### 11.3 Tool Schema Hygiene

App tool descriptions must be sanitized:

- strip prompt-injection-style instructions
- cap description length
- normalize tool names
- reject malformed schemas

### 11.4 Logging

Every critical lifecycle event must be logged with enough context to trace:

- user
- conversation
- app session
- invocation
- outcome

---

## 12. Testing Strategy

### 12.1 Brownfield Regression Tests

When extracting Chatbox-derived modules, add focused tests that preserve the expected behavior. Highest-value candidates:

- markdown rendering
- streaming transcript chunk display
- context summary / compaction helpers

### 12.2 Platform Tests

The new server-driven behavior requires:

- auth tests
- conversation CRUD tests
- tool discovery tests
- tool router tests
- iframe lifecycle tests
- completion signaling tests
- OAuth tests

### 12.3 Vertical Slice Tests

The `Chess` slice must prove:

1. "let's play chess" triggers the correct tool
2. the iframe renders in chat
3. a move updates game state
4. "what should I do?" can reference board state
5. resign or checkmate triggers `app_complete`
6. a follow-up question references the context summary

### 12.4 Failure Tests

At minimum:

- invalid tool name
- iframe load timeout
- origin mismatch
- duplicate completion signal
- app crash / error
- circuit breaker open state

---

## 13. Delivery Plan

### Phase 0: Brownfield Setup

- audit Chatbox reuse candidates
- extract the first owned modules
- document what will not be reused

### Phase 1: Server Authority

- auth
- conversations
- message persistence
- server-side LLM streaming

### Phase 2: App Platform

- app registration
- tool discovery
- tool router
- app session state machine
- iframe lifecycle bridge

### Phase 3: Chess Vertical Slice

- chess app UI
- chess tools
- mid-game analysis support
- completion signaling
- context retention

### Phase 4: Breadth and Hardening

- weather app
- OAuth app
- timeout and recovery paths
- polish and deployment

---

## 14. Done Criteria

The system is "done enough" for the sprint when:

- it still feels recognizably Chatbox-derived on the client side
- it proves server-authoritative orchestration
- `Chess` works end to end
- at least one public app and one OAuth app also work
- app failures are recoverable
- the architecture can be explained as an extension of Chatbox rather than a disconnected rewrite

---

## 15. Explicit Non-Goals

These are out of scope for the sprint:

- perfect parity with full Chatbox desktop features
- deep admin tooling
- generalized marketplace infrastructure
- refactoring the donor codebase itself
- broad UI redesign unrelated to app-platform behavior

---

## 16. Final Engineering Rule

Whenever there is a choice between:

- spending time rebuilding a solved Chatbox UX concern, or
- spending time validating app orchestration and lifecycle reliability

the second option wins.

That is the central discipline required to keep this project both brownfield and achievable.

