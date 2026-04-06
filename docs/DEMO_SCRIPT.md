We # ChatBridge Demo Script

> Covers: 3 working apps, 1 recovery demo, host/app lifecycle walkthrough.

---

## Prerequisites

- App running at `http://localhost:3000` (or Render deployment)
- Demo accounts seeded: `demo@chatbridge.com` / `demo1234` (student), `teacher@chatbridge.com` / `teacher1234` (teacher operator), `admin@chatbridge.com` / `admin1234` (admin operator)
- All 4 apps registered (chess, khan, flashcards, firstprinciples)

---

## Demo 1: Three Working Apps (5 min)

### App 1 -- Chess (Interactive Session)

1. Log in as `demo@chatbridge.com`
2. Start a new conversation
3. Type: **"Let's play chess! Start a game as white."**
4. **What happens:**
   - LLM detects intent, calls `chess__start_game`
   - ToolRouter creates app_session (status: `active`)
   - Chess iframe loads at `/apps/chess?sessionId=<uuid>`
   - Board renders, iframe signals `iframe_ready`
   - State: `IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE`
5. Make a few moves on the board (click piece, click destination)
6. Each move sends `app_state_update` via postMessage to host
7. Type: **"What's a good next move?"** -- LLM reads board state via mid-app context and coaches
8. Click "Resign" -- app sends `app_complete` with summary
9. **State: `ACTIVE -> COMPLETED -> IDLE`**
10. Summary appears in LLM context: *"Player resigned."*

### App 2 -- Khan Academy Companion (Topic Exploration)

1. In a new conversation, type: **"I want to learn about photosynthesis"**
2. **What happens:**
   - LLM calls `khan__open_topic` with topic "photosynthesis"
   - Khan iframe loads, shows topic header
3. Type: **"Explain the light reactions"**
   - LLM calls `khan__explain_concept`, explanation card appears
4. Type: **"Quiz me on this"**
   - LLM calls `khan__quiz`, multiple-choice quiz appears
5. Answer the quiz -- result sends `app_state_update`
6. Click "Done" -- app sends `app_complete` with stats summary
7. **Key point:** No auth required, session-only state, no persistence

### App 3 -- Flashcards (Platform-Authenticated)

1. In a new conversation, type: **"Create a flashcard deck about the solar system with 5 cards"**
2. **What happens:**
   - LLM calls `flashcards__create_deck` -- requires logged-in user (platform auth)
   - Server creates deck in `study_decks` table scoped to userId
   - Flashcards iframe loads, shows first card
3. Click card to flip, press "Got it" or "Missed it"
4. Complete all 5 cards -- app sends `app_complete` with score
5. **Key point:** User data persists across sessions. Type **"Load my solar system deck"** later and it's still there.

**Transition callout:** Point out that starting Khan mid-chess-session would have terminated chess (single-active-app rule). Each conversation has at most one active app.

---

## Demo 2: Recovery (2 min)

### Circuit Breaker + Timeout Recovery

**Setup:** This demo shows what happens when an app fails repeatedly.

1. Open browser dev tools (Network tab) to show requests
2. Start a conversation and type: **"Analyze why the sky is blue using first principles"**
3. First Principles app loads and works normally -- circuit breaker state: `closed`

**Simulating failure (explain to audience):**

The platform has three layers of resilience:

**Layer 1 -- Tool Invocation Timeout (15s):**
- If an app doesn't respond within 15 seconds, the invocation times out
- ToolRouter calls `handleTimeout()` -- logs the timeout, updates tool_log status
- LLM receives a recovery prompt: *"The tool timed out. Inform the user and offer to try again."*
- User sees a friendly message, not a crash

**Layer 2 -- Circuit Breaker (3 strikes):**
- After 3 consecutive failures, the circuit breaker opens
- All subsequent tool invocations are blocked immediately (fail-fast)
- LLM gets: *"The app is temporarily unavailable due to repeated failures."*
- User sees: *"This app is having trouble right now. Try again in about 30 seconds."*

**Layer 3 -- Half-Open Recovery (30s):**
- After 30 seconds, circuit breaker enters `half-open` state
- Allows one request through as a probe
- If it succeeds: breaker closes, normal operation resumes
- If it fails: breaker reopens for another 30s

**Live demo with tests:**

```bash
pnpm test -- __tests__/lib/circuit-breaker.test.ts
pnpm test -- __tests__/lib/error-recovery.test.ts
```

Show test output proving:
- `closed -> open` after 3 failures
- `open -> half-open` after 30s
- `half-open -> closed` on success
- Recovery prompts generated for each failure type

**Bonus -- Show the code (30 seconds):**
- `server/lib/circuit-breaker.ts` (52 lines -- simple, auditable)
- `server/lib/error-recovery.ts` (24 lines -- timeout constants + prompt builders)
- `server/services/tool-router.service.ts:44` -- circuit breaker check at invocation entry

---

## Demo 3: Host/App Lifecycle (3 min)

Walk through one complete lifecycle with the audience, using Chess as the example.

### The Flow (narrate while showing)

```
Step 1: User types "Let's play chess"
        |
Step 2: POST /api/chat -> ChatService streams to LLM
        LLM returns: function_call { name: "chess__start_game", arguments: { color: "white" } }
        |
Step 3: ToolRouter.invoke()
        - Checks circuit breaker: closed? proceed
        - Validates tool exists via ToolService.discoverTools()
        - ensureSession(): creates app_sessions row (status: active)
        - Creates tool_logs entry (status: pending)
        - State: IDLE -> TOOL_REQUESTED
        |
Step 4: Client receives tool call response
        - AppRenderer creates iframe: /apps/chess?sessionId=<uuid>
        - Iframe sandbox: allow-scripts allow-forms allow-popups allow-same-origin
          (internal app, so allow-same-origin is safe)
        - State: TOOL_REQUESTED -> APP_RENDERED
        |
Step 5: Chess iframe loads, calls useIframeSessionPostMessage()
        - Reads sessionId from URL query param
        - Sends { method: "iframe_ready", params: { sessionId } }
        - Retries every 500ms until platform acknowledges
        - State: APP_RENDERED -> ACTIVE
        |
Step 6: Platform relays tool_invoke to iframe
        - { method: "tool_invoke", params: { tool: "start_game", arguments: { color: "white" }, invocationId } }
        - Chess app initializes board, returns result with board_fen
        |
Step 7: User plays chess (interactive phase)
        - Clicks pieces, app sends app_state_update with each move
        - User asks "What should I do?" -> LLM gets active app context (board FEN, move history)
        - LLM responds as chess coach without new tool call
        |
Step 8: Game ends (checkmate, draw, or resign)
        - App sends { method: "app_complete", params: { sessionId, summary: "Checkmate. White wins in 24 moves." } }
        - State: ACTIVE -> COMPLETED
        |
Step 9: CompletionService.handleComplete()
        - Updates app_sessions.status = 'completed'
        - Stores contextSummary (replaces full tool history in LLM context)
        - Resolves active intent
        |
Step 10: State: COMPLETED -> (reset) -> IDLE
         - Next message: LLM sees summary "Checkmate. White wins in 24 moves."
         - Full tool invocation history is compacted to one line
         - Ready for next app invocation
```

### Visual: State Machine in Action

```
  IDLE ----[chess__start_game]----> TOOL_REQUESTED
                                       |
                              [iframe loads chess]
                                       |
                                  APP_RENDERED
                                       |
                              [iframe sends iframe_ready]
                                       |
                                    ACTIVE
                                   /   |   \
                         [complete] [error] [15s timeout]
                              |       |         |
                         COMPLETED  ERROR    TIMEOUT
                              |       |         |
                           [reset] [reset]   [reset]
                              |       |         |
                             IDLE    IDLE      IDLE
```

### Key Architecture Points to Highlight

1. **Server authority:** LLM calls happen server-side only. Client never talks to OpenAI.
2. **Sandboxed isolation:** Each app runs in its own iframe. External apps get no `allow-same-origin`.
3. **Context efficiency:** Completed app sessions become one-line summaries, not raw JSON blobs.
4. **Single-active-app:** Starting a new app terminates the previous one. No resource leaks.
5. **Idempotent completion:** Duplicate `app_complete` on a completed session is safely ignored.
6. **Resilience stack:** Timeouts (15s) -> circuit breaker (3 failures) -> recovery prompts -> graceful degradation.

---

## Test Suite Validation (optional, 1 min)

Run the full test suite to prove everything works:

```bash
pnpm test
```

Key test files to highlight:
- `__tests__/lib/invocation-state.test.ts` -- 63 tests covering all state transitions
- `__tests__/lib/circuit-breaker.test.ts` -- open/half-open/closed + failure counting
- `__tests__/apps/chess.test.ts` -- move validation, board state, game over
- `__tests__/apps/khan.test.ts` -- session state, quiz mechanics
- `__tests__/apps/flashcards.test.ts` -- deck CRUD, progress tracking
- `__tests__/services/tool-router.test.ts` -- invocation flow, single-active-app enforcement

---

## Summary Slide

| Deliverable | Where |
|-------------|-------|
| 3 working apps | Chess (interactive), Khan (exploration), Flashcards (authenticated) |
| Recovery demo | Circuit breaker: 3 failures -> open -> 30s -> half-open -> success -> closed |
| Integration guide | `docs/INTEGRATION_GUIDE.md` -- one page, copy-paste template |
| Host/app lifecycle | IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED -> IDLE |
