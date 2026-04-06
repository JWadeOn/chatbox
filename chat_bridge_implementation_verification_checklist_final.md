# ChatBridge Implementation Verification Checklist

Use this checklist to verify that the coding agent implemented the agreed spec and that the solution is positioned to pass the project requirements.

## Status legend
- ✅ Implemented
- ⚠️ Partial
- ❌ Missing
- 📝 Evidence

---

## 1. Core Submission Requirements

| Check | Status | Evidence |
|---|---|---|
| Publicly accessible deployed app exists | ⚠️ | Not verified — no deployment URL found in repo |
| GitLab repo is up to date | ⚠️ | Not verified — requires manual check |
| Setup guide exists and is accurate | ✅ | 📝 `README.md` lines 25-44: Quick Start with prerequisites, install, env config, db setup, demo credentials |
| Architecture overview exists and matches implementation | ⚠️ | 📝 `docs/ARCHITECTURE.md` is nearly empty (1-line comment). Architecture content scattered across `README.md` lines 59-100 (ASCII diagram, three-layer model, key decisions) and `docs/SPEC.md`. Not consolidated. |
| API / integration docs exist for third-party apps | ✅ | 📝 `README.md` lines 143-239: Full REST/WebSocket/postMessage API reference, app registration contract, SSE event types, OAuth endpoints |
| Demo video can show chat + app lifecycle clearly | ❌ | No demo video or demo script exists in repo. `CHECKLIST.md` line 91 marks incomplete. |
| AI cost analysis exists | ❌ | No cost analysis document exists. `CHECKLIST.md` lines 78-84 marks incomplete; `docs/TASKS.md` T21 still pending. |

---

## 2. Brownfield / Chatbox Integration

| Check | Status | Evidence |
|---|---|---|
| Frontend uses Chatbox web build as the actual shell | ✅ | 📝 `server/index.ts` lines 14-15, 42-86: Serves `chatbox/release/app/dist/renderer/` as SPA with fallback routing |
| ChatBridge provider is registered in Chatbox provider registry | ✅ | 📝 `chatbox/src/shared/providers/definitions/chatbridge.ts` lines 11-31: `defineProvider({ id: 'chatbridge' })`. Imported first in `index.ts` line 8 |
| ChatBridge `model.chat()` routes to server `/api/chat` | ✅ | 📝 `chatbox/src/shared/providers/definitions/models/chatbridge.ts` line 117: `fetch('/api/chat', ...)` with Bearer token + conversationId |
| AuthGate wraps Chatbox UI | ✅ | 📝 `chatbox/src/renderer/components/chatbridge/AuthGate.tsx` lines 23-160. Wrapped in `__root.tsx` lines 273-276 around `<Outlet />` |
| Conversation mapping exists between Chatbox sessions and backend conversations | ✅ | 📝 `chatbox/src/renderer/stores/chatbridge/conversationMap.ts` lines 11-89: localStorage-backed `{sessionId → conversationId}` map, lazy-creates via POST `/api/conversations` |
| AppRenderer is integrated into Chatbox message rendering path | ✅ | 📝 `chatbox/src/renderer/components/message-parts/ToolCallPartUI.tsx` lines 419-428: Detects `__chatbridge_app_render` marker → renders `<AppRenderer>`. SSE `app_render` events trigger this in `chatbridge.ts` lines 172-188 |
| The solution still feels recognizably Chatbox-derived | ✅ | 📝 Chatbox source is 6.5M vs ChatBridge additions 284K (23:1 reuse ratio). Core chat UI, markdown, message rendering, Jotai state, provider registry all preserved |
| Brownfield reuse is visible in code/docs, not just claimed | ✅ | 📝 Minimal modifications to Chatbox: AuthGate wrapper, provider definition, 3 new Jotai stores in `/stores/chatbridge/`, AppRenderer in `/components/chatbridge/`. Chatbox architecture intact |

---

## 3. Server Authority / Trust Boundary

| Check | Status | Evidence |
|---|---|---|
| All LLM calls are server-side | ✅ | 📝 `src/app/api/chat/route.ts` line 15: OpenAI instantiated server-side. Lines 171-298: all completions server-side. Client only receives SSE stream |
| App/tool routing is server-side | ✅ | 📝 `server/services/tool-router.service.ts` lines 34-110: `invoke()` with circuit breaker, tool validation, session management. Client cannot invoke tools directly |
| Conversation persistence is server-side authoritative | ✅ | 📝 `server/services/conversation.service.ts` lines 26-31: DB queries with userId check. Messages persisted in `route.ts` lines 93, 307. Client state is UI cache only |
| App session lifecycle is server-owned | ✅ | 📝 `server/services/tool-router.service.ts` lines 187-223: Session create/terminate. `completion.service.ts` lines 65-92: timeout handling. Status validated server-side |
| Auth is platform-owned | ✅ | 📝 `server/services/auth.service.ts` lines 69-79: JWT sign/verify. `server/middleware/auth.middleware.ts` lines 9-16: Bearer token extraction. Role-based access for operators |
| App iframes do not handle raw credentials directly | ✅ | 📝 Iframes receive only sessionId as query param (`iframe-bridge/iframe-url.ts` lines 4-8). JWT never passed to iframe. PostMessage validates origin (`postmessage.ts` line 35) |
| Client is not the system of record for completion/state | ✅ | 📝 `server/services/completion.service.ts` lines 18-59: Idempotent server-side completion. Circuit breaker, intent state, tool logs all server-owned. Client POST to `/api/app-complete` triggers server update |

---

## 4. Third-Party App Platform Contract

| Check | Status | Evidence |
|---|---|---|
| Apps can register with metadata and tool definitions | ✅ | 📝 `src/app/api/apps/register/route.ts` lines 6-38: POST with slug, name, toolSchemas. `server/services/app.service.ts` lines 38-83: validates authType, schema fields, slug uniqueness |
| Tool names use the agreed namespace format `{appSlug}__{toolName}` | ✅ | 📝 `server/services/tool.service.ts` line 52: `namespacedName: "${app.slug}__${schema.name}"`. Used in LLM function definitions (line 74) |
| Tool schemas are validated before use | ✅ | 📝 `server/lib/schema-sanitizer.ts` lines 45-51: sanitizes names, strips injection patterns, truncates to 200 chars. `tool.service.ts` lines 82-132: normalizes JSON Schema parameters |
| Tool discovery endpoint exists and is used by chat orchestration | ✅ | 📝 `src/app/api/tools/route.ts` lines 5-13: GET endpoint. `src/app/api/chat/route.ts` lines 101-103: chat calls `discoverTools()` + `formatForLLM()`. 5-min cache with invalidation |
| Tool router maps tool call → app + capability | ✅ | 📝 `server/services/tool-router.service.ts` lines 34-110: `invoke()` validates tool, manages sessions, creates tool logs, circuit breaker integration |
| Apps render via sandboxed iframes inside chat | ✅ | 📝 `src/components/chat/AppRenderer.tsx` lines 30-159 (Next.js) + `chatbox/.../AppRenderer.tsx` lines 26-100 (Chatbox). `iframe-bridge/constants.ts` lines 11-15: sandbox attrs |
| Apps communicate via JSON-RPC over `postMessage` | ✅ | 📝 `src/lib/postmessage.ts` lines 1-13: JSON-RPC 2.0 types. Lines 106-117: `createToolInvokeMessage()`. Lines 28-104: listener with origin validation |
| Apps can send `iframe_ready` | ✅ | 📝 `src/components/chat/AppRenderer.tsx` lines 101-105: handles `iframe_ready`, marks buffer ready. `postmessage.ts` line 77: recognized in switch |
| Apps can send `app_state_update` | ✅ | 📝 `src/lib/postmessage.ts` lines 65-66: handler dispatches summary + data. Interface at line 18 |
| Apps can send `app_complete` | ✅ | 📝 `src/lib/postmessage.ts` lines 59-63: handler. `src/app/api/app-complete/route.ts` lines 14-35: server endpoint. `tool-router.service.ts` lines 159-185: persists completion |
| Apps can send `app_error` | ✅ | 📝 `src/lib/postmessage.ts` lines 68-72: handler with message + recoverable flag. AppRenderer sets error state on non-recoverable |
| Message buffering exists until iframe is ready | ✅ | 📝 `src/lib/invocation-buffer.ts` lines 3-57: `InvocationBuffer` queues until `markReady()`. 30s timeout (`iframe-bridge/constants.ts` line 4). Comprehensive tests in `postmessage.test.ts` lines 111-185 |

---

## 5. Lifecycle / Orchestration

| Check | Status | Evidence |
|---|---|---|
| Lifecycle state machine exists: `IDLE → TOOL_REQUESTED → APP_RENDERED → ACTIVE → COMPLETED → IDLE` | ✅ | 📝 `server/lib/invocation-state.ts` lines 1-50: Full `InvocationState` type with all states + ERROR/TIMEOUT. Transition map lines 14-24. Terminal states enforced lines 12, 47-49 |
| Error terminal path exists | ✅ | 📝 `invocation-state.ts` line 19: `ACTIVE:APP_ERROR → ERROR`. Line 12: ERROR in TERMINAL_STATES. Line 22: `ERROR:RESET → IDLE` for recovery |
| Timeout terminal path exists | ✅ | 📝 `invocation-state.ts` line 20: `ACTIVE:TIMEOUT → TIMEOUT`. `tool-router.service.ts` lines 131-157: `handleTimeout()`. `completion.service.ts` lines 65-92: 60s timeout handling |
| `tool_invocation_requested` is logged | ✅ | 📝 `tool-router.service.ts` line 94: `logEvent({ event: 'tool_invocation_requested', ... })` |
| `tool_invocation_dispatched` is logged | ✅ | 📝 `api/chat/route.ts`: `logEvent({ event: 'tool_invocation_dispatched', ... })` before `executeToolHandler()` |
| `tool_invocation_succeeded` is logged | ✅ | 📝 `tool-router.service.ts` line 128: `logEvent({ event: 'tool_invocation_succeeded', ... })` |
| `tool_invocation_failed` is logged | ✅ | 📝 `api/chat/route.ts`: `logEvent({ event: 'tool_invocation_failed', ... })` in catch block with error detail |
| `tool_invocation_timed_out` is logged | ✅ | 📝 `tool-router.service.ts` line 156: `logEvent({ event: 'tool_invocation_timed_out', ... })` |
| `app_session_started` is logged | ✅ | 📝 `tool-router.service.ts` `ensureSession()`: `logEvent({ event: 'app_session_started', ... })` after session insert |
| `app_session_completed` is logged | ✅ | 📝 `tool-router.service.ts` line 184: `logEvent({ event: 'app_session_completed', ... })`. `completion.service.ts` line 56: same event |
| `app_session_terminated` is logged | ✅ | 📝 `tool-router.service.ts`: `logEvent({ event: 'app_session_terminated', ... })` when new app replaces previous |
| Completion summaries are stored for later chat context | ✅ | 📝 `schema.ts` line 75: `contextSummary` JSONB column. `completion.service.ts` lines 112-140: `buildContextWithSummaries()` retrieves and formats for LLM system prompt |
| Chat resumes naturally after completion | ✅ | 📝 `completion.service.ts` lines 97-106: `buildCompletionMessage()`. Context injected into system prompt line 150. Tested in `multi-app.test.ts` lines 87-96 |
| Only one active app session per conversation is enforced | ✅ | 📝 `tool-router.service.ts` lines 187-223: `ensureSession()` terminates previous session if different app. Index on `(conversationId, status)` in schema. Tested in `tool-router.test.ts` lines 399-454 |

---

## 6. Required App Set

### 6.1 Chess

| Check | Status | Evidence |
|---|---|---|
| Chess app exists and renders in iframe | ✅ | 📝 `src/app/apps/chess/page.tsx` line 50: React client component. Uses `useIframeSessionPostMessage()`. Three modes: tutoring (local board), vs_computer, vs_human (Lichess iframe) |
| User can start a game from chat | ✅ | 📝 `server/seed.ts` lines 20-73: `chess__start_game` tool with mode/color/level params. `api/chat/route.ts` lines 123-134: system prompt offers three modes |
| Board state updates during play | ✅ | 📝 `chess/page.tsx` lines 119-146: `tryMove()` updates FEN, lastMove, sends `app_state_update` with `board_fen` and `last_move` via postMessage |
| Invalid moves are handled gracefully | ✅ | 📝 `chess/page.tsx` lines 140-142: try-catch on move. `server/apps/chess.ts` lines 69-74: returns `success: false` with error. Test at `chess.test.ts` lines 58-72 |
| User can ask for help mid-game | ✅ | 📝 `server/apps/chess.ts` lines 364-372: `buildAssistantContext()` injects FEN, turn, history, material into LLM. `route.ts` lines 108-114: context injected every chat turn |
| Chatbot can reason over current board state | ✅ | 📝 `chess.ts` lines 374-403: `getActiveGameState()` returns board_fen, turn, history, material. `get_board_state` tool (lines 250-261) also available. System prompt line 130: "coach the student on tactics" |
| Game completion triggers `app_complete` | ✅ | 📝 `chess/page.tsx` lines 92-111: Sends `app_complete` on checkmate (with winner/moves) and draw. Lines 472-481: resign button also sends `app_complete` |
| Post-game chat can reference what happened | ✅ | 📝 `completion.service.ts` lines 112-140: `buildContextWithSummaries()` injects `[Chess]: summary` into system prompt for subsequent turns |

### 6.2 Khan Academy Companion

| Check | Status | Evidence |
|---|---|---|
| Khan Companion exists as a non-auth educational app | ✅ | 📝 `src/app/apps/khan/page.tsx`: Client React component. `seed.ts` line 75-111: registered with `authType: 'none'` |
| Khan Companion purpose is concrete and well-defined (not vague) | ✅ | 📝 `seed.ts` lines 75-80: "Topic exploration companion for any subject — opens lessons, explains concepts, and generates quiz questions" |
| It behaves as a guided topic / lesson companion, not a random iframe wrapper | ✅ | 📝 `khan/page.tsx` lines 141-287: Shows topic header, concept explanation card, quiz questions with 4 options, stats tracking |
| User can open a topic from chat | ✅ | 📝 `seed.ts` lines 83-92: `open_topic` tool. `server/apps/khan.ts` lines 56-81: handler accepts topic param, initializes session |
| App can surface lesson/topic context | ✅ | 📝 `khan/page.tsx` lines 152-169: topic header. Lines 188-212: explanation card. Lines 214-287: quiz. `khan.ts` lines 45-54: `buildAssistantContext()` injects into LLM |
| Student can return to chat and ask follow-up questions | ✅ | 📝 `api/chat/route.ts` lines 109-114: Active app context injected into LLM system prompt via `buildActiveAppContextForConversation()`. Khan topics/stats available to LLM |
| Completion summary captures topic reviewed / learning outcome | ✅ | 📝 `khan/page.tsx` lines 130-139: `app_complete` with "Reviewed topic: X. Questions: N asked, M correct. Topics reviewed: K" |
| No durable per-user auth is required for Khan Companion | ✅ | 📝 `authType: 'none'` in seed. State in memory Map keyed by sessionId (`khan.ts` line 22). No DB queries, no OAuth |
| Any Khan state is clearly session-only unless otherwise documented | ✅ | 📝 `khan.ts` lines 1-6, 22: In-memory `sessions` Map. Cleared when session ends or new app starts (single-active-app rule) |

### 6.3 Flashcards (Authenticated Third-Party App)

| Check | Status | Evidence |
|---|---|---|
| Flashcards app exists | ✅ | 📝 `src/app/apps/flashcards/page.tsx`: Client React component with card flip mechanic, progress tracking, completion screen |
| Flashcards is the authenticated third-party app | ✅ | 📝 Auth enforced at platform level via chat API Bearer token. User-scoped deck/progress queries require authenticated userId |
| Auth model is clearly implemented as platform-owned auth | ✅ | 📝 `api/chat/route.ts` line 78: `extractAuth(request)` required. JWT verified in `auth.service.ts`. No iframe-level auth |
| User-specific decks or progress are tied to authenticated user identity | ✅ | 📝 `server/apps/flashcards.ts` line 56: `userId` in deck insert. Line 83: deck access gated by `eq(studyDecks.userId, userId)`. `schema.ts` lines 153-188: `studyDecks.userId` FK, `studyProgress.userId` FK |
| App does not handle raw credentials in iframe | ✅ | 📝 Iframe loaded without credentials. Communicates via postMessage JSON-RPC. Auth handled server-side only |
| User can load a deck from chat | ✅ | 📝 `seed.ts` lines 121-129: `load_deck` tool with `deckId` param. `flashcards.ts` lines 70-108: queries deck by deckId + userId |
| User can work through cards in iframe | ✅ | 📝 `flashcards/page.tsx` lines 204-319: Card flip (lines 239-275), "Missed it"/"Got it" buttons (lines 278-317), progress bar (lines 217-236) |
| Progress is tracked | ✅ | 📝 Client: `flashcards/page.tsx` lines 28, 52-67: results array. Server: `flashcards.ts` lines 156-181: upsert `studyProgress`. `schema.ts` lines 171-188: `studyProgress` table with cardsSeen, cardsCorrect |
| Completion summary captures study outcome | ✅ | 📝 `flashcards/page.tsx` lines 53-60: `app_complete` with "Studied deck 'X': N/N cards, M correct." Includes deckId, title, cardsSeen, cardsCorrect |
| Unauthenticated user is gated correctly before access | ✅ | 📝 `api/chat/route.ts` line 78: throws AuthError 401 without Bearer token. Deck access gated by userId. Conversation access checks userId |
| Flow resumes after auth succeeds | ✅ | 📝 OAuth flow via `api/oauth/[appSlug]/authorize` + callback routes. Platform auth: login → token → chat API → flashcards tools available with userId context |

### 6.4 First Principles Tutor (Bonus)

| Check | Status | Evidence |
|---|---|---|
| Bonus app exists, or omission is explicitly documented | ✅ | 📝 `src/app/apps/firstprinciples/page.tsx`: Client React component. `server/apps/firstprinciples.ts`: Server handler. Tests in `__tests__/apps/firstprinciples.test.ts` |
| If present, it uses the same iframe + JSON-RPC contract | ✅ | 📝 `page.tsx` lines 40-42: receives `tool_invoke` via postMessage. Line 80: sends JSON-RPC 2.0 response `{ jsonrpc: '2.0', result, id }`. Uses shared iframe-bridge |
| If standalone-hosted, the same lifecycle/security rules still apply | ✅ | 📝 Hosted internally at `/apps/firstprinciples`. Same sandbox, origin validation, session binding as other apps |
| User can submit a reasoning question | ✅ | 📝 `firstprinciples.ts` lines 4-20: `analyze` tool with required `question` param. Missing question returns error (line 14). Tested lines 5-57 |
| App returns structured assumptions, principles, and reasoning steps | ✅ | 📝 Returns `{ question, assumptions[], principles[], reasoning_steps[], conclusion }`. UI renders each section: `page.tsx` lines 56-76 |
| Chat can reference the analysis afterward | ✅ | 📝 `firstprinciples.ts` lines 22-29: `buildAssistantContext(sessionId)` injects context. `route.ts` lines 109-114: active app context in system prompt |

---

## 7. Trust, Safety, and Governance

| Check | Status | Evidence |
|---|---|---|
| Trust and safety is treated as a first-class system requirement in implementation/docs | ✅ | 📝 `docs/SPEC.md` Section 11: dedicated "Security Rules" section. Section 11.4: concrete failure modes. `TECHNICAL_PRESEARCH.md` emphasizes K-12 trust |
| Default-deny model is enforced for app loading | ✅ | 📝 `app.service.ts` lines 86-88: `listApps()` returns only APPROVED. New apps start as PENDING (line 78). `getAppBySlug()` enforces approval (line 102). Tested in `apps-governance.test.ts` |
| Only allowlisted origins can load | ✅ | 📝 Database IS the allowlist — only registered + approved apps discoverable. iframeUrl stored per-app. Registration requires operator role |
| No `allow-same-origin` in sandbox for embedded apps, unless a clearly documented and justified exception exists | ✅ | 📝 `iframe-bridge/constants.ts` lines 11-15: External apps get `allow-scripts allow-forms allow-popups` only. Internal apps get `allow-same-origin` additionally. Tested in `iframe-bridge.test.ts` lines 31-36 |
| If an exception exists, spec/docs/code are reconciled and consistent | ✅ | 📝 `docs/SPEC.md` Section 11.1 lines 449-457: documents internal app exception with rationale. Single control point at `isInternalAppIframe()` in `constants.ts` line 7 |
| `postMessage` origin validation is implemented | ✅ | 📝 `postmessage.ts` lines 35-37: `event.origin !== expectedOrigin` check. `allowNullOrigin` for sandboxed external iframes. Test at `postmessage.test.ts` lines 20-24 |
| Session-bound message validation is implemented | ✅ | 📝 `postmessage.ts` lines 23-26: `paramsSessionOk()`. Line 54-55: app message session check. Lines 83-92: tool result session check. Test lines 66-90 |
| Invalid/malformed payloads are rejected | ✅ | 📝 `postmessage.ts` lines 40-46: JSON parse try/catch. Lines 48-51: jsonrpc 2.0 validation. `tool-invocation-result/route.ts` lines 17-19: UUID format validation |
| Tool schemas are sanitized/normalized | ✅ | 📝 `schema-sanitizer.ts` lines 24-51: Truncates 200 chars, strips injection patterns ("ignore previous instructions", "you are", "system:"), strips HTML. 17 test cases in `schema-sanitizer.test.ts` |
| App output is treated as untrusted data, not instructions | ✅ | 📝 `completion.service.ts` lines 35-39: summaries stored as JSON data. Line 131-132: formatted as literal text `[AppName]: summary`, not evaluated |
| Text crossing into chat or LLM context is sanitized/moderated | ✅ | 📝 `human_summary` from `app_complete` is sanitized via `sanitizeDescription()` before storage in both `app-complete/route.ts` and `completion.service.ts`. Strips injection patterns, HTML, truncates to 200 chars |
| Data minimization is implemented (apps only receive scoped data) | ✅ | 📝 Apps receive only invocation parameters + sessionId. No conversation history, no user data beyond tool call params. Study progress is app-scoped |
| Full conversation history is not leaked to third-party apps by default | ✅ | 📝 Iframes receive only tool invocation params. No conversation context sent to apps. Session isolation enforced |
| Logging exists for rejected origins / suspicious payloads / failures | ✅ | 📝 `postmessage.ts` line 36: origin rejection warning. Line 44: invalid JSON. Line 55: session mismatch. Line 90: tool result mismatch. Server uses `logEvent()` via pino logger |
| COPPA/FERPA-aware data minimization is acknowledged in docs | ⚠️ | 📝 `docs/SPEC.md` line 650: COPPA/FERPA compliance "out of scope for the sprint". PRD acknowledges K-12 data minimization as goal. Architectural minimization in place but no PII inventory, retention policy, or parental consent flow |
| Full legal/compliance certification is not overclaimed | ✅ | 📝 No claims of "COPPA-compliant" or "FERPA-certified". `SPEC.md` section 14.1: "formal regulatory compliance auditing and certification are out of scope". Honest positioning |

---

## 8. App Approval Workflow

| Check | Status | Evidence |
|---|---|---|
| App approval workflow exists | ✅ | 📝 `server/services/app.service.ts`: AppService with full lifecycle. `server/lib/app-approval.ts`: status constants/types. Routes in `src/app/api/apps/` |
| App lifecycle states include `PENDING → APPROVED → DISABLED` or equivalent | ✅ | 📝 `app-approval.ts` lines 2-4: `APP_APPROVAL_PENDING`, `APP_APPROVAL_APPROVED`, `APP_APPROVAL_DISABLED`. Type union line 6-9. Schema default 'pending' (`schema.ts` line 58) |
| Apps are not student-accessible before approval | ✅ | 📝 `app.service.ts` lines 85-89: `listApps()` filters APPROVED only. `getAppBySlug()` lines 98-108 same. `tool.service.ts` line 41: discovery filters by APPROVED. Tested in `apps-governance.test.ts` lines 125-129 |
| Teacher/admin review flow exists | ✅ | 📝 `app.service.ts` lines 91-95: `listPendingApps()` for review queue. `auth.middleware.ts` lines 26-33: `requireOperatorRole()` gates access. Operator roles: `['admin', 'teacher']` |
| Reviewer can launch and use app before approval | ✅ | 📝 `app.service.ts` lines 111-117: `getAppBySlugAny()` method returns any app regardless of status for operators |
| Reviewer can approve app | ✅ | 📝 `src/app/api/apps/[slug]/route.ts` lines 23-48: PATCH endpoint. Requires operator role (line 26). Body `{ approvalStatus: 'approved' }`. Invalidates tool cache |
| Reviewer can disable app later | ✅ | 📝 Same PATCH endpoint supports `approvalStatus: 'disabled'`. Tested in `apps-governance.test.ts` lines 56-65: registers → approves → disables |
| Only approved apps appear in student-facing flows | ✅ | 📝 `tool.service.ts` line 41: `WHERE approvalStatus = 'approved'`. `app.service.ts` line 87: same filter. Chat route lines 101-103: LLM only sees approved tools. Tested lines 118-148 |
| Governance model is reflected in docs/demo | ✅ | 📝 `docs/PLAN.md` line 11: "public listing and tool discovery only for approved; register + PATCH gated to operators". `docs/SPEC.md` section 7.2. Comprehensive test: `apps-governance.test.ts` (149 lines) |

---

## 9. Communication and State

| Check | Status | Evidence |
|---|---|---|
| Three-layer state model is actually reflected in code: chat state / app state / context bridge | ✅ | 📝 Chat: `conversation.service.ts` (messages). App: `appSessions` table with status/lifecycle. Bridge: `completion.service.ts` `buildContextWithSummaries()` injects summaries into LLM |
| Chat state is separate from app state | ✅ | 📝 `messages` table (conversational content) is distinct from `appSessions` table (app lifecycle). Independent persistence and lifecycle management |
| App state remains app-owned | ✅ | 📝 App session state scoped per sessionId. Apps communicate via postMessage. Platform only stores `contextSummary` after completion |
| Context bridge persists summaries/results back to conversation | ✅ | 📝 `tool-router.service.ts` `handleAppComplete()`: stores `contextSummary` JSONB. `completion.service.ts` lines 112-140: retrieves and formats for LLM system prompt |
| State updates are schema-validated | ✅ | 📝 `schema-sanitizer.ts` validates tool schemas. Database schema enforced via Drizzle ORM. Messages use typed `metadata` JSONB. App sessions use structured `contextSummary` |
| Context is retained across follow-up turns | ✅ | 📝 `api/chat/route.ts`: `buildContextWithSummaries()` + active app context injected into system prompt on every chat POST request |
| Conversation can switch between apps without confusion | ✅ | 📝 `tool-router.service.ts` `ensureSession()`: terminates previous session when different app invoked. Intent service resolves old intent. Tested in `multi-app.test.ts` lines 68-125 |
| New app sessions cleanly replace/archive prior active sessions | ✅ | 📝 Prior session set to `status: 'completed'` with `contextSummary` preserved. New session created as `status: 'active'`. No dangling references |

---

## 10. Auth Model

| Check | Status | Evidence |
|---|---|---|
| Platform auth exists (JWT or equivalent) | ✅ | 📝 `server/services/auth.service.ts`: JWT sign (7d expiry) + verify. bcrypt password hashing (SALT_ROUNDS=10). Token payload: `{ userId, role }` |
| Flashcards auth relies on platform auth, not ad hoc iframe login | ✅ | 📝 `flashcards.ts` handler receives `userId` from authenticated request context. All deck/progress queries scoped by userId. No iframe-level login |
| App-specific auth model is clearly documented | ✅ | 📝 `docs/SPEC.md` Section 10.5: "platform authentication only — user logs into ChatBridge, platform gates app data based on platform user identity. No external OAuth flow in MVP" |
| Token/session handling for authenticated app access is server-owned | ✅ | 📝 `auth.middleware.ts` lines 9-16: `extractAuth()` validates Bearer token on all API endpoints. OAuth tokens stored server-side in `oauthTokens` table. Client never holds plaintext credentials |
| Resume-after-auth flow is implemented if required | ✅ | 📝 OAuth flow: `api/oauth/[appSlug]/authorize` embeds conversationId in state. Callback redirects to `conversations/{id}?oauth=success`. Platform auth: login → token → chat API resumes |
| Auth docs/tests/spec all describe the same model consistently | ✅ | 📝 `auth.test.ts`: register/login/verify tests. `SPEC.md` sections 7, 10.5: platform-auth-first. `oauth.service.ts` + `auth.middleware.ts`: implementation aligned. All consistent |

---

## 11. Database and Persistence

| Check | Status | Evidence |
|---|---|---|
| Required migrations exist and run cleanly | ✅ | 📝 `drizzle/0000_stiff_corsair.sql` (initial schema), `0001_aromatic_wrecking_crew.sql` (study tables), `0002_app_approval_status.sql` (approval column). Config in `drizzle.config.ts` |
| Conversations table/schema supports durable history | ✅ | 📝 `schema.ts` lines 14-27: id, userId (FK cascade), title, createdAt, updatedAt. Index on `(userId, updatedAt)` |
| Messages table/schema supports persisted transcript | ✅ | 📝 `schema.ts` lines 29-43: id, conversationId (FK cascade), role, content, metadata (JSONB), createdAt. Index on `(conversationId, createdAt)` |
| Apps table/schema supports metadata and tool definitions | ✅ | 📝 `schema.ts` lines 45-61: slug (unique), name, description, authType, iframeUrl, oauthConfig (JSONB), toolSchemas (JSONB array), approvalStatus |
| Tool logs table/schema exists | ✅ | 📝 `schema.ts` lines 85-110: invocationId (unique), sessionId, conversationId, appId, toolName, params/result (JSONB), status, durationMs. Indexes on conversation, session, invocation |
| App sessions table/schema exists | ✅ | 📝 `schema.ts` lines 63-83: id, conversationId (FK cascade), appId, status (active/completed/timeout), contextSummary (JSONB), timestamps. Indexes on conversation and conversation+status |
| App auth token/credential storage exists if needed | ✅ | 📝 `schema.ts` lines 112-129: `oauthTokens` table with userId, appId, accessToken, refreshToken, expiresAt. Unique constraint on user+app. FK cascade delete |
| `study_decks` table/schema exists for flashcards | ✅ | 📝 `schema.ts` lines 152-168: userId (FK cascade), title, description, cards (JSONB array), cardCount. Index on userId. Migration in `0001_aromatic_wrecking_crew.sql` |
| `study_progress` table/schema exists for flashcards | ✅ | 📝 `schema.ts` lines 170-188: userId, deckId, sessionId (FK to appSessions), cardsSeen, cardsCorrect, completedAt. Indexes on user and deck |
| Completion summaries are persisted | ✅ | 📝 `appSessions.contextSummary` (JSONB) stores `{ human_summary, data }`. Updated in `completion.service.ts` lines 36-48. Retrieved by `buildContextWithSummaries()` |
| Migration step is included in setup docs / deployment flow | ✅ | 📝 README.md Quick Start: `pnpm db:push` + `pnpm db:seed`. Deployment section: `DATABASE_URL="<url>" pnpm db:push`. Railway.toml for automated deployment |

---

## 12. Scalability / Recess-Rush Thinking

| Check | Status | Evidence |
|---|---|---|
| Docs explicitly address third-party app wait time under load | ✅ | 📝 `docs/TECHNICAL_PRESEARCH.md` lines 436-472: "Recess Rush Problem" — analyzes 1000 simultaneous tool invocations. Solution: decouple tool invocation from HTTP, close SSE, async completion via POST |
| Implementation does not require long-lived blocking waits for app completion if that was part of the final design | ✅ | 📝 `api/chat/route.ts`: 15s tool timeout + 60s request timeout via `Promise.race()`. Separate `POST /api/app-complete` endpoint for async completion. No indefinite waits |
| App sessions are modeled asynchronously or at least documented for production scaling | ✅ | 📝 App sessions have explicit status field (active/completed/timeout) in DB. Completion endpoint separate from chat. Idempotent handling prevents duplicate processing. Stateless-server ready |
| Recess-rush / spike-handling strategy is explained in docs | ✅ | 📝 `TECHNICAL_PRESEARCH.md` lines 532-540: Pre-warming before bell times, staggered app loading, CDN for iframe bundles, LLM request batching. DB pool: max 50 connections, 5s timeout, 30s idle |
| Rate limiting / timeout / circuit breaker behavior exists or is clearly documented | ✅ | 📝 Rate limiter: `server/lib/rate-limiter.ts` (10 invocations/min/user). Timeouts: 15s tool, 60s request. Circuit breaker: `server/lib/circuit-breaker.ts` (3 failures opens, 30s half-open) |
| Resource ownership under concurrent app sessions is explained | ✅ | 📝 `TECHNICAL_PRESEARCH.md` lines 494-507: Documents in-memory state issue for multi-instance. Three solutions: Redis-backed state, DB-backed state, session affinity. Per-user WS limit: 2 connections |

---

## 13. End-to-End Grader Scenarios

| Scenario | Status | Evidence |
|---|---|---|
| User asks chatbot to use third-party app | ✅ | 📝 `api/chat/route.ts` lines 116-150: System prompt explicitly offers Chess, Khan, Flashcards, First Principles with invocation guidance |
| Correct app/tool is discovered and invoked | ✅ | 📝 `route.ts` lines 101-103: `discoverTools()` + `formatForLLM()`. `tool-router.service.ts` lines 52-65: validates tool exists before invocation. Tested in `tool-router.test.ts` |
| App UI renders inside chat | ✅ | 📝 `route.ts` lines 262-286: sends `app_render` SSE event. `AppRenderer.tsx` renders sandboxed iframe. Chatbox `ToolCallPartUI.tsx` lines 419-428: detects `__chatbridge_app_render` marker |
| User interacts with app and returns to chat | ✅ | 📝 All apps (chess, khan, flashcards, firstprinciples) use postMessage JSON-RPC for interaction. `app_complete` signals return to chat. Context summaries injected for follow-up |
| Chatbot answers about app results after completion | ✅ | 📝 `completion.service.ts` lines 112-140: `buildContextWithSummaries()` formats `[AppName]: summary`. Injected into system prompt on every subsequent chat turn |
| User switches between multiple apps in one conversation | ✅ | 📝 `tool-router.service.ts` `ensureSession()` enforces single-active-app. `multi-app.test.ts` lines 68-125: chess→khan switching with context preservation |
| Ambiguous question is clarified or routed correctly | ✅ | 📝 System prompt line 147: "If a request is ambiguous between multiple tools, ask for clarification". Line 124: chess mode clarification required before `start_game` |
| Unrelated question does not trigger app invocation | ✅ | 📝 System prompt line 148: "Never invoke tools for unrelated queries — respond conversationally instead". LLM decides tool use vs plain chat. Rate limiter prevents spam |
| App failure is surfaced gracefully | ✅ | 📝 `route.ts` `executeToolHandler()`: 15s timeout via `Promise.race()`. Circuit breaker: 3 failures opens. `AppRenderer.tsx` lines 82-84: `onAppError` with recoverable flag. Tested in `error-recovery.test.ts` |
| Authenticated app flow works end to end | ✅ | 📝 Flashcards: `extractAuth()` required → userId scoped deck/progress queries → iframe receives only sessionId → platform auth gates all access. Tested in `flashcards.test.ts` |

---

## 14. Implementation Consistency Checks

| Check | Status | Evidence |
|---|---|---|
| PRD, spec, docs, and code all use the same final app lineup | ✅ | 📝 PRD.md, SPEC.md, README.md, code, and system prompt all reference Chess, Khan Academy Companion, Flashcards, First Principles. Legacy Weather/Spotify references removed |
| Khan Companion is described consistently everywhere | ✅ | 📝 "Khan Academy Companion" in SPEC, system prompt, seed. Slug `khan` consistent. `authType: 'none'` confirmed. Session-only state confirmed. All references aligned |
| Flashcards auth model is described consistently everywhere | ✅ | 📝 SPEC.md: "platform-authenticated, no external OAuth in MVP". README: "Platform-authenticated study app with user-specific decks". Code: userId-gated queries. All aligned |
| `firstprinciples` naming is consistent across routes, tool names, docs, and code | ✅ | 📝 Slug: `firstprinciples`. Tool: `firstprinciples__analyze`. Route: `/apps/firstprinciples`. Class: `FirstPrinciplesToolHandler`. System prompt: "First Principles Tutor". All consistent |
| Sandbox policy is consistent across code, spec, and agent docs | ✅ | 📝 `iframe-bridge/constants.ts`: external no `allow-same-origin`, internal gets it. `SPEC.md` section 11.1: exception documented with rationale. `README.md`: sandbox policy stated. All aligned |
| Demo script matches what is actually implemented | ❌ | No demo script or demo video exists in the repository. `CHECKLIST.md` marks incomplete. Required deliverable |

---

## 15. Final Pass / No-Pass Review

| Gate | Status | Evidence |
|---|---|---|
| At least 3 meaningful K–12 apps are actually working | ✅ | 📝 Chess (strategic thinking, 3 modes, Lichess integration), Khan Companion (topic exploration, quizzes), Flashcards (platform-auth, user-scoped decks/progress), + bonus First Principles Tutor |
| One app is clearly complex and stateful (`Chess`) | ✅ | 📝 FEN board state, move history, game-over detection (checkmate/stalemate/resign), Lichess integration for vs_computer/vs_human, mid-game LLM coaching. `chess.test.ts` 150+ lines |
| One app is clearly authenticated (`Flashcards`) | ✅ | 📝 Platform auth: JWT Bearer token required. User-scoped: deck queries gated by `eq(studyDecks.userId, userId)`. Progress tracked per-user in `studyProgress` table. No iframe-level login |
| The platform demonstrates real orchestration, not just embedded widgets | ✅ | 📝 Dynamic tool discovery, tool routing to correct app handler, invocation state machine (7 states), single-active-app enforcement, context retention via completion summaries, circuit breaker, rate limiting, timeout enforcement |
| Trust and safety are visibly built into the contract | ✅ | 📝 Default-deny app approval, sandbox isolation, origin validation, session binding, schema sanitization (strips injection patterns), data minimization (apps don't get conversation history), rate limiting (10/min) |
| Teacher/admin control over app availability is demonstrated | ✅ | 📝 `app-approval.ts` PENDING→APPROVED→DISABLED lifecycle. `requireOperatorRole()` gates approval. `apps-governance.test.ts` (149 lines) demonstrates full workflow. Seed creates admin account |
| The project can be defended as an extension of Chatbox, not a separate prototype | ✅ | 📝 23:1 reuse ratio (Chatbox 6.5M vs ChatBridge 284K). Provider registered in Chatbox registry. AuthGate wraps Chatbox UI. AppRenderer in message rendering path. Chatbox design system preserved |
| The implementation directly addresses the core case-study boundary problem | ✅ | 📝 Launch apps from natural language ✅. Apps coexist with chat ✅. Platform tracks lifecycle (state machine) ✅. Teachers control availability (approval workflow) ✅. K-12 trust boundary (sandbox + origin + sanitization) ✅ |

---

## 16. Highest-Risk Items to Verify First

1. ✅ **Chess lifecycle fully works end to end.** — `chess.test.ts` (150+ lines), `chess/page.tsx` (500+ lines), system prompt guidance, completion in `multi-app.test.ts`. Three game modes, board state, completion signaling all verified.
2. ✅ **Flashcards authenticated flow is real and consistent with docs.** — `flashcards.test.ts` with user isolation, `flashcards.ts` userId-gated queries, SPEC.md documents platform-auth-only MVP. Code and spec aligned.
3. ✅ **Khan Companion is concrete, educational, and actually useful.** — Topic header, concept explanations, quiz with 4 options, stats tracking. Non-auth, session-only state. `khan.test.ts` covers session isolation and topic switching.
4. ✅ **Sandbox / `allow-same-origin` policy is consistent across code and docs.** — `iframe-bridge/constants.ts` enforces policy. `SPEC.md` section 11.1 documents exception with rationale. Single control point at `isInternalAppIframe()`.
5. ✅ **App approval workflow is implemented, not just described.** — Full `AppService` with PENDING→APPROVED→DISABLED lifecycle. PATCH endpoint with operator role check. `apps-governance.test.ts` (149 lines) comprehensive test.
6. ✅ **Completion summaries are actually injected back into later chat turns.** — `completion.service.ts` `buildContextWithSummaries()` formats `[AppName]: summary`. Injected into system prompt at `route.ts` line 150. Multi-app test verifies.
7. ⚠️ **All 3 apps are demo-ready in the deployed environment.** — All 4 apps seeded and route-wired. UIs functional. Deployed environment not verified (no deployment URL confirmed in repo).

