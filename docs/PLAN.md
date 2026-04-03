# ChatBridge Refactor Plan

## Goal

Refactor the current implementation so ChatBridge genuinely extends and builds on top of Chatbox instead of continuing as a parallel custom rebuild.

The core strategy is:

- keep the existing server-side orchestration and persistence foundation
- replace the hand-rolled chat UI layer with Chatbox-derived, extracted, and owned modules
- preserve clear ownership boundaries so `chatbox/` remains read-only reference code

---

## Target Outcome

By the end of this refactor, the system should have:

- a Chatbox-derived client experience for transcript rendering, markdown, streaming, and input ergonomics
- a ChatBridge-owned server control plane for auth, conversations, tool routing, app sessions, and OAuth
- a clean extraction boundary where reused Chatbox code lives in ChatBridge-owned modules
- no runtime imports from `chatbox/`
- the `Chess` vertical slice still working end to end

---

## Refactor Principles

### 1. Do Not Rewrite the Server

The current server stack is already aligned with the intended platform direction and should remain the foundation:

- `server/services/chat.service.ts`
- `server/services/tool-router.service.ts`
- `server/services/intent.service.ts`
- `server/services/oauth.service.ts`
- `server/services/conversation.service.ts`
- `server/lib/schema.ts`
- `app/api/*`

These pieces should be stabilized and adapted only where needed for client integration.

### 2. Refactor the Client Into a Chatbox-Derived Shell

The client currently behaves more like a custom rebuild than a true extension of Chatbox. The main client refactor target is to replace bespoke chat presentation with extracted Chatbox-derived modules.

### 3. Extract, Do Not Import

`chatbox/` stays read-only.

Rules:

- do not add runtime imports from `chatbox/`
- copy or extract isolated modules into ChatBridge-owned code
- simplify extracted code to remove Electron or unrelated coupling
- add regression tests around each extracted module

### 4. Preserve the Vertical Slice

Every refactor step must preserve:

- chat send/receive flow
- tool invocation rendering
- app iframe rendering
- completion signaling
- context retention
- `Chess` end-to-end behavior

---

## Current State Assessment

### Keep As Foundation

These areas are already consistent with the intended platform architecture:

- server-side OpenAI chat orchestration
- conversation persistence
- tool discovery and routing
- app sessions and intent tracking
- OAuth proxy routes and service
- database-backed platform state
- app-specific server modules in `server/apps/*`

### Refactor In Place

These areas are valid conceptually but need restructuring:

- `src/lib/use-chat.ts`
- `src/components/chat/AppRenderer.tsx`
- tool/app event handling in the client
- message normalization between backend responses and UI

### Replace With Chatbox-Derived Modules

These areas should stop being custom-first implementations:

- `src/components/chat/MessageBubble.tsx`
- likely `ChatWindow.tsx`
- likely `MessageInput.tsx`
- likely `Sidebar.tsx`
- any simplistic streaming or markdown rendering helpers

---

## Proposed Architecture

### Server

Keep the server as the control plane:

- auth
- chat orchestration
- tool routing
- app session lifecycle
- intent management
- OAuth
- persistence

### Client

Refactor the client into three layers:

1. Transport layer  
   Handles REST/SSE or WebSocket communication, message streaming, and app lifecycle events.

2. Orchestration layer  
   Converts transport events into normalized UI state such as transcript updates, tool result entries, active app sessions, and completion summaries.

3. Presentation layer  
   Renders Chatbox-derived chat components and app containers using the normalized state.

### Extraction Layer

Add a dedicated owned location for reused Chatbox modules, for example:

```text
src/lib/extracted/chatbox/
src/components/chatbox/
```

This is where copied and adapted Chatbox modules should live.

---

## Refactor Phases

## Phase 0: Freeze Boundaries

Goal: decide what stays, what moves, and what gets replaced before more implementation churn.

Tasks:

- declare the backend as stable platform foundation
- declare the client as the primary brownfield refactor target
- define the extraction destination for Chatbox-derived code
- document that `chatbox/` is reference-only, never a runtime dependency

Deliverable:

- repo-level agreement on keep/adapt/replace boundaries

---

## Phase 1: Normalize the Client Data Model

Goal: decouple the UI from the current minimal message shape so richer Chatbox-derived rendering can slot in cleanly.

Tasks:

- introduce a `ChatMessageViewModel`
- map server responses into that normalized shape
- separate transcript state from transport concerns
- separate app session state from transcript rendering

Why first:

- Chatbox-derived components will likely expect richer semantics than `{ id, role, content }`
- this prevents the UI extraction from being blocked by storage schema details

Deliverable:

- a stable presentation-facing message model

---

## Phase 2: Split `use-chat` Into Adapters

Goal: remove the current all-in-one client hook bottleneck.

Current responsibilities mixed inside `src/lib/use-chat.ts`:

- optimistic user message insertion
- streaming response handling
- SSE parsing
- tool result insertion
- app render triggering
- error handling

Refactor into:

- chat transport client
- transcript state adapter
- app session adapter
- error/recovery adapter

Deliverable:

- UI components consume normalized state instead of transport logic directly

---

## Phase 3: Replace Message Rendering With Chatbox-Derived Components

Goal: make the visible chat experience truly build on Chatbox.

Highest-priority replacement:

- `src/components/chat/MessageBubble.tsx`

Tasks:

- extract Chatbox-derived markdown rendering
- support richer markdown and code block rendering
- preserve tool/system message rendering through a small ChatBridge adapter
- move transcript presentation closer to Chatbox behavior

Deliverable:

- assistant and transcript rendering clearly derived from Chatbox instead of custom prose blocks

---

## Phase 4: Replace Streaming Transcript Presentation

Goal: align streaming UX with Chatbox instead of maintaining a custom flow.

Tasks:

- extract or adapt Chatbox streaming message presentation patterns
- ensure partial assistant content renders smoothly
- maintain compatibility with current server streaming events

Deliverable:

- Chatbox-style streaming UX powered by the current backend contracts

---

## Phase 5: Replace Input and Sidebar

Goal: stop rebuilding solved chat ergonomics.

Candidates:

- `src/components/chat/MessageInput.tsx`
- `src/components/layout/Sidebar.tsx`
- related chat shell layout components

Tasks:

- extract Chatbox-derived input behavior and layout ideas
- preserve current platform-specific flows like auth and conversation navigation
- keep app rendering integrated in the chat shell

Deliverable:

- core app shell feels recognizably Chatbox-derived

---

## Phase 6: Refactor App Lifecycle Wiring

Goal: keep the app-platform behavior, but move it out of the rendering layer.

Current issue:

- tool result handling and app render behavior are interpreted inside the same hook that owns streaming transcript state

Tasks:

- move app lifecycle handling into a client orchestration layer
- let presentation components render state rather than interpret transport events
- keep `AppRenderer` focused on iframe lifecycle only

Deliverable:

- clearer separation between app orchestration and chat presentation

---

## Phase 7: Harden `AppRenderer`

Goal: align iframe behavior with the actual security model.

Important concern:

- current implementation gives internal iframe URLs `allow-same-origin`
- long-term architecture should avoid convenience exceptions that weaken the boundary

Tasks:

- decide whether internal apps are trusted-first-party or should follow the same sandbox model
- remove accidental security exceptions where possible
- keep origin validation, handshake buffering, and cleanup behavior

Deliverable:

- app rendering path matches the documented trust model

---

## Phase 8: Extract Context and Token Utilities

Goal: adopt the highest-value non-visual Chatbox logic after the transcript layer is stable.

Candidates:

- token estimation helpers
- context compaction logic
- summary-generation helpers

Tasks:

- extract only isolated pieces
- adapt to server-authoritative conversations and app summaries
- avoid coupling to Electron- or local-storage-oriented assumptions

Deliverable:

- Chatbox-informed context management without inheriting incorrect client authority assumptions

---

## Phase 9: Remove Dead Custom UI Paths

Goal: clean out the parts of the current implementation that were effectively parallel rebuilds.

Tasks:

- remove superseded custom message rendering
- remove obsolete UI state branches
- collapse temporary adapters that are no longer needed
- document the final extraction boundaries

Deliverable:

- a simpler client architecture that is clearly Chatbox-derived and ChatBridge-owned

---

## Keep / Adapt / Replace Matrix

| Category | Action | Files / Areas |
|---|---|---|
| Server orchestration | Keep | `server/services/chat.service.ts`, `tool-router.service.ts`, `intent.service.ts`, `oauth.service.ts` |
| Persistence and schema | Keep | `server/lib/schema.ts`, DB-backed routes and services |
| Transport contracts | Adapt | `app/api/chat/route.ts`, client stream handling |
| Client chat state | Refactor | `src/lib/use-chat.ts` |
| App lifecycle UI | Adapt | `src/components/chat/AppRenderer.tsx` |
| Markdown + transcript rendering | Replace with extracted Chatbox modules | `src/components/chat/MessageBubble.tsx` and related render helpers |
| Input and shell ergonomics | Replace with extracted Chatbox modules | `MessageInput.tsx`, `Sidebar.tsx`, shell layout |
| Context and token helpers | Extract selectively | future `src/lib/extracted/chatbox/*` |

---

## Recommended Branch Order

1. `refactor/chat-view-model`
2. `refactor/chat-transport-split`
3. `refactor/chatbox-markdown-renderer`
4. `refactor/chatbox-streaming-transcript`
5. `refactor/chatbox-input-sidebar`
6. `refactor/app-lifecycle-adapter`
7. `refactor/iframe-security-boundary`
8. `refactor/chatbox-context-utils`
9. `refactor/remove-dead-custom-ui`

Each branch should keep the app functional and preserve the `Chess` flow.

---

## Testing Strategy

### Regression Coverage Needed

- markdown rendering behavior
- streaming transcript assembly
- tool result rendering
- iframe mount / ready / close flow
- completion summary rendering
- conversation switching
- `Chess` vertical slice after each major UI extraction

### Test Rule

Before swapping in a Chatbox-derived module:

- capture the current expected behavior with focused tests
- add extraction-specific tests for the new owned module
- verify the `Chess` flow still works

---

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Refactor drifts back into rewrite mode | High | Keep the backend stable and refactor only one client layer at a time |
| Chatbox extraction introduces hidden coupling | High | Timebox extraction attempts and simplify aggressively |
| UI extraction breaks app lifecycle flows | High | Preserve orchestration as a separate adapter and regression-test `Chess` continuously |
| Security exceptions remain in place by convenience | Medium | Resolve iframe trust rules explicitly during the `AppRenderer` refactor |
| Too many components move at once | Medium | Use phased branch order and preserve a working app each step |

---

## Exit Criteria

This refactor is successful when:

- the client experience is recognizably Chatbox-derived
- the backend remains ChatBridge-owned and server-authoritative
- no runtime code imports from `chatbox/`
- the app lifecycle still works cleanly
- the `Chess` vertical slice still passes end to end
- the codebase clearly reads as "Chatbox extended into a platform," not "another rewrite beside Chatbox"
