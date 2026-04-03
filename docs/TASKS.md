# TASKS.md

> Dependency DAG for parallel execution. Tasks in the same layer can run concurrently.
> The spec has the static plan; this is the dynamic execution tracker.
> Statuses: [ ] todo  [~] in progress  [x] done  [!] blocked  [-] cut

---

## DAG Overview

```
Layer 0:  [T00] ──────────────────────────────────────────────────────
             │
Layer 1:  [T01] ──────────────────────────────────────────────────────
             │
             ├──────────┬──────────┬──────────┐
Layer 2:  [T02]       [T05]     [T08]       [T10]
             │          │         │            │
             │          │         │            │
Layer 3:  [T03]       [T06]      │            │
             │          │         │            │
             │          │         │            │
Layer 4:  [T04]       [T07]      │            │
             │          │         │            │
             │          ├─────────┘            │
             │          │                      │
Layer 5:    [T11]  ←── ├──────────────────────┘
             │         │
             │         │
Layer 6:  [T09] ←─────┘
             │
             │
Layer 7:  [T12]
             │
             │
Layer 8:  [T13] ──────── [T16]
             │
             │
Layer 9:  [T14]
             │
             │
Layer 10: [T15] ──────── [T17]
             │
             ├──────────┬──────────┐
Layer 11: [T18]       [T19]     [T20]
                                   │
Layer 12:                        [T21]
```

### Detailed ASCII DAG (with names)

```
L0:  [T00 Codebase Sep.]
       │
L1:  [T01 Scaffold+DB]
       │
       ├───────────────┬────────────────┬───────────────┐
L2:  [T02 Auth]      [T05 Sanitizer]  [T08 StateMach]  [T10 Intent Svc]
       │               │                │                │
L3:  [T03 Conv CRUD]  [T06 App Reg]    │                │
       │               │                │                │
L4:  [T04 WS Chat]   [T07 Tool Disc]   │                │
       │               │                │                │
       │               ├────────────────┘                │
       │               │                                 │
L5:  [T11 Iframe] ←───┤                                 │
       │               │                                 │
       │               ├─────────────────────────────────┘
       │               │
L6:    │             [T09 Tool Router]
       │               │
       ├───────────────┘
       │
L7:  [T12 Completion Sig.]
       │
L8:  [T13 Chess App] ──── [T16 Error Handling]
       │
L9:  [T14 Weather App]
       │
L10: [T15 Spotify/OAuth] ─── [T17 Multi-App Switch]
       │
       ├───────────────┬───────────────┐
L11: [T18 UI Polish]  [T19 Docs]     [T20 Deploy]
                                        │
L12:                                  [T21 Deliverables]
```

### Dependency Arrows (compact)

```
T00 → T01
T01 → T02, T05, T08, T10
T02 → T03
T03 → T04
T04 → T11
T05 → T06
T06 → T07
T07 + T08 + T10 → T09
T04 → T11
T09 + T11 → T12
T12 → T13
T13 → T14
T09 → T16
T14 → T15, T17
T15 → T18, T19, T20
T20 → T21
```

---

## Workstreams

| Workstream | Scope | Tasks |
|---|---|---|
| WS-A | Server Core — auth, conversations, WebSocket chat | T00, T01, T02, T03, T04 |
| WS-B | Plugin System — sanitizer, app registry, tool discovery, tool router | T05, T06, T07, T08, T09, T10 |
| WS-C | Client Integration — iframe rendering, postMessage, completion signaling | T11, T12 |
| WS-D | Apps — chess, weather, spotify | T13, T14, T15 |
| WS-E | Hardening & Ship — error handling, multi-app, polish, docs, deploy | T16, T17, T18, T19, T20, T21 |

---

## Ready to Start

PARALLEL OPPORTUNITY: 2 tasks ready, independent workstreams.

- [ ] T04: WebSocket chat + LLM streaming (L) [WS-A] ← T03 (done)
- [ ] T07: Tool discovery (M) [WS-B] ← T06 (done)

---

## Layer 0 — Codebase Separation (deadline: MVP Tue)

> Brownfield-specific prerequisite. Ensures chatbox/ is isolated before new code is written.

- [~] T00: Codebase separation — isolate chatbox/ directory, verify no cross-boundary imports, configure .gitignore, ensure chatbox/ is read-only reference only (S) [WS-A] ← none

## Layer 1 — Scaffold (deadline: MVP Tue)

> Project foundation. Everything else depends on this.

- [x] T01: Project scaffold + DB schema — init Next.js with TypeScript, set up PostgreSQL connection, run migrations for all 8 tables (users, conversations, messages, apps, tool_logs, oauth_tokens, intents, app_sessions), configure Vitest, Biome, set up pino structured logger (L) [WS-A] ← T00 — done 2026-04-02

## Layer 2 — Core Services (deadline: MVP Tue)

> Four independent modules that only need the scaffold. Maximum parallelism: 4 agents.

- [x] T02: User authentication — register/login/logout/me endpoints, JWT, bcrypt, role-based access (student/teacher/admin), auth middleware (M) [WS-A] ← T01 — done 2026-04-02
- [x] T05: Tool schema sanitizer — strip prompt injection from tool descriptions, name validation (alphanumeric + underscore), description truncation (200 char), HTML/markdown stripping (S) [WS-B] ← T01 — done 2026-04-02
- [x] T08: Invocation state machine — IDLE/TOOL_REQUESTED/APP_RENDERED/ACTIVE/COMPLETED/ERROR/TIMEOUT transitions, invalid transition rejection, idempotent duplicate handling (M) [WS-B] ← T01 — done 2026-04-02
- [x] T10: Intent service — intent creation on tool invocation, one-active-per-conversation rule, intent resolution/abandonment on app_complete/timeout (M) [WS-B] ← T01 — done 2026-04-02

## Layer 3 — Auth-Dependent Services (deadline: MVP Tue)

> Requires auth (T02) or sanitizer (T05) to be complete.

- [x] T03: Conversation CRUD — create/list/get/delete conversations, user isolation (only own conversations), message inclusion on get, ordered by updated_at DESC (M) [WS-A] ← T02 — done 2026-04-02
- [x] T06: App registration — POST/GET/PUT/DELETE for app registry, slug uniqueness, tool schema validation + sanitization on register, auth_type handling (M) [WS-B] ← T05 — done 2026-04-02

## Layer 4 — Real-Time + Discovery (deadline: Early Fri)

> Chat goes live. Tool discovery becomes available.

- [ ] T04: WebSocket chat + LLM streaming — WS /api/chat with auth, stream_start/stream_chunk/stream_end protocol, message persistence, conversation history as LLM context (L) [WS-A] ← T03
- [ ] T07: Tool discovery — GET /api/tools returns flat list from all active apps, appSlug__toolName namespacing, OpenAI function definition format, inactive apps excluded (M) [WS-B] ← T06

## Layer 5 — Client Integration (deadline: Early Fri)

> Iframe rendering in the chat experience. Requires WebSocket chat for message flow.

- [ ] T11: Iframe rendering + postMessage — AppRenderer component, sandboxed iframe (allow-scripts allow-forms allow-popups, NO allow-same-origin), JSON-RPC 2.0 postMessage protocol, origin validation, iframe_ready handshake with invocation buffering, 10s load timeout (L) [WS-C] ← T04

## Layer 6 — Tool Router (deadline: Early Fri)

> Server-side orchestration layer. Requires tool discovery, state machine, and intent service.

- [ ] T09: Tool router — full invocation lifecycle: validate tool exists, check circuit breaker, create tool_log (pending), set intent, manage app_session (single-active-app), dispatch to client via WS, await result with 15s timeout, update tool_log, hallucinated tool handling with 2-retry limit, rate limiting (10/min/user) (XL) [WS-B] ← T07, T08, T10

## Layer 7 — Completion Signaling (deadline: Early Fri)

> The #1 failure point. Connects iframe lifecycle back to chat context.

- [ ] T12: Completion signaling — app_complete handling (session completed, summary persisted, iframe removed, intent resolved, system message injected), app_state_update for context bridge, 60s timeout monitor, context_summary injection into LLM (replacing full tool history), follow-up conversation referencing results (L) [WS-C] ← T09, T11

## Layer 8 — Chess + Error Handling (deadline: Early Fri)

> Full vertical slice. Chess must pass ALL lifecycle tests. Error handling can run in parallel.

- [ ] T13: Chess app (end-to-end lifecycle) — chess.js game logic, interactive board UI in iframe, start_game/make_move/get_board_state/resign tools, FEN state management, completion on checkmate/resign, intent transitions, full state machine cycle (XL) [WS-D] ← T12
- [ ] T16: Error handling — circuit breaker (3 failures → open, 30s → half-open), timeout strategy (iframe 10s, tool 15s, OAuth 60s, WS heartbeat 30s), LLM recovery prompts on failure, WS auto-reconnect (L) [WS-E] ← T09

## Layer 9 — Weather App (deadline: Early Fri)

> GATE: Do not start until ALL chess lifecycle tests pass (vertical slice rule).

- [ ] T14: Weather app — get_weather tool, location parameter, external weather API, result display in chat, no auth required, verify chess context_summary still available after switching (M) [WS-D] ← T13

## Layer 10 — Spotify + Multi-App (deadline: Final Sun)

> OAuth flow integration. Multi-app switching can run in parallel.

- [ ] T15: Spotify app (OAuth) — get_auth_status/create_playlist tools, OAuth2 proxy (authorize/callback/status endpoints), token storage in oauth_tokens, CSRF protection via nonce, token refresh on expiry (L) [WS-D] ← T14
- [ ] T17: Multi-app switching — session context preservation across app switches, single-active-app enforcement on switch, ambiguity resolution (clarification prompt), unrelated query refusal (M) [WS-E] ← T14

## Layer 11 — Polish & Ship (deadline: Final Sun)

> All features complete. Focus on quality, docs, and deployment.

- [ ] T18: UI polish — loading spinners during LLM streaming, progress indicators during tool invocation, smooth iframe mount/unmount transitions, responsive layout (M) [WS-E] ← T15
- [ ] T19: Documentation — API docs for third-party developers, setup guide (README), architecture overview (M) [WS-E] ← T15
- [ ] T20: Deployment — deploy frontend (Vercel), deploy backend (Railway/Render), configure production PostgreSQL, verify all 3 apps work in production (M) [WS-E] ← T15

## Layer 12 — Final Deliverables (deadline: Final Sun)

- [ ] T21: Deliverables — 3-5 min demo video, AI cost analysis (actual spend + projections for 100/1K/10K/100K users), social media post (M) [WS-E] ← T20

---

## Blocked

<!-- Items that can't proceed due to non-task issues (external, unclear requirements, etc.) -->
<!-- Format: task | blocked by | what needs to happen | who owns unblocking -->

(none)

## Cut / Deferred

<!-- Things you decided not to do (yet). Include why — prevents re-litigating. -->

- [-] Programmatic Tool Calling (PTC) — standard function calling first; PTC is a stretch goal per PRD Section 3
- [-] Teacher admin dashboard — beyond basic app availability controls per PRD scope
- [-] App marketplace / discovery UI — out of scope per PRD
- [-] Mobile-native apps — web responsive is sufficient per PRD
- [-] Multi-language / i18n — out of scope for 7-day sprint
- [-] Analytics dashboard — out of scope per PRD
- [-] E2E tests (Playwright) — stretch goal per spec Section 11.1

## Completed

<!-- Move items here when done. Include date. Check if completing this unblocked anything. -->

- [x] T00: Codebase separation (S) [WS-A] — done 2026-04-02. Unblocked: T01.
- [x] T01: Project scaffold + DB schema (L) [WS-A] — done 2026-04-02. Unblocked: T02, T05, T08, T10.
- [x] T02: User authentication (M) [WS-A] — done 2026-04-02. Unblocked: T03.
- [x] T05: Tool schema sanitizer (S) [WS-B] — done 2026-04-02. Unblocked: T06.
- [x] T08: Invocation state machine (M) [WS-B] — done 2026-04-02. Unblocked: T09 (partial, needs T07+T10).
- [x] T10: Intent service (M) [WS-B] — done 2026-04-02. Unblocked: T09 (partial, needs T07+T08).
- [x] T03: Conversation CRUD (M) [WS-A] — done 2026-04-02. Unblocked: T04.
- [x] T06: App registration (M) [WS-B] — done 2026-04-02. Unblocked: T07.

---

## Summary

### Critical Path

The longest dependency chain determines the minimum calendar time:

```
T00 → T01 → T02 → T03 → T04 → T11 → T12 → T13 → T14 → T15 → T20 → T21
 S      L     M     M     L      L     L     XL     M      L      M      M
```

**Critical path length:** 12 tasks
**Estimated effort on critical path:** ~S + L + M + M + L + L + L + XL + M + L + M + M = approximately 5-6 full days of work

### Effort Key

| Size | Estimated Hours |
|---|---|
| S | 2-4 hours |
| M | 4-8 hours |
| L | 8-12 hours |
| XL | 12-16 hours |

### Max Parallelism by Layer

| Layer | Parallel Tasks | Max Agents |
|---|---|---|
| L0 | 1 (T00) | 1 |
| L1 | 1 (T01) | 1 |
| L2 | 4 (T02, T05, T08, T10) | **4** |
| L3 | 2 (T03, T06) | 2 |
| L4 | 2 (T04, T07) | 2 |
| L5 | 1 (T11) | 1 |
| L6 | 1 (T09) | 1 |
| L7 | 1 (T12) | 1 |
| L8 | 2 (T13, T16) | 2 |
| L9 | 1 (T14) | 1 |
| L10 | 2 (T15, T17) | 2 |
| L11 | 3 (T18, T19, T20) | **3** |
| L12 | 1 (T21) | 1 |

**Peak parallelism: 4 agents at Layer 2**

### Deadline Mapping

| Deadline | Date | Layers | Tasks | What Must Be Done |
|---|---|---|---|---|
| **MVP** | Tuesday | L0-L3 | T00-T03, T05, T06, T08, T10 | Scaffold, DB, auth, conversations, sanitizer, app registration, state machine, intent service |
| **Early** | Friday | L4-L9 | T04, T07, T09, T11-T14, T16 | WebSocket chat, tool discovery, tool router, iframe rendering, completion signaling, chess (full lifecycle), weather app, error handling |
| **Final** | Sunday | L10-L12 | T15, T17-T21 | Spotify/OAuth, multi-app switching, polish, docs, deployment, deliverables |

### Risk Notes

1. **Completion signaling (T12) is the #1 risk** — if this does not work, the entire app lifecycle breaks. Spec calls it out as the top failure point.
2. **Chess (T13) is the gate** — vertical slice rule: no second app until chess passes ALL lifecycle tests end-to-end.
3. **Tool router (T09) is the largest single task (XL)** — it orchestrates the entire invocation lifecycle and has the most integration points.
4. **Layer 2 is the best parallelism opportunity** — four fully independent modules (auth, sanitizer, state machine, intent service) can be built simultaneously.
5. **Brownfield overhead is approximately neutral** — per RECONCILIATION.md, reference code savings (~0.5 day) roughly offset exploration/ADR overhead (~0.5-1 day).
