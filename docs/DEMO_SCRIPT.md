# ChatBridge Demo Script (3-5 Minutes)

## Opening (15-20 sec)

"ChatBridge turns a chatbot into an orchestrator. Instead of just answering questions, it can invoke third-party apps, embed them inside the chat, track their lifecycle, and resume conversation with context."

"I'll show three working educational apps, one recovery scenario, and then walk through the architecture that makes this possible."

## Demo 1: Three Working Apps (2.5-3 min)

### 1. Chess — Stateful, Interactive App

Say:

"Let's start with a complex, stateful app."

Action:
Type: **"Let's play chess"**

Narrate:

- "The model selects `chess__start_game`."
- "Server creates an app session."
- "Iframe renders inside chat."

Do:

- Make 1-2 moves.

Ask:

- "What should I do here?"

Explain:

"The chatbot is reading live board state via `app_state_update` events."

Finish:

- Click resign.

"The app sends `app_complete`, and the system stores a summary so chat can continue naturally."

### 2. Khan Companion — Non-Auth Learning App

Say:

"Now a non-auth educational app."

Action:
Type: **"Teach me photosynthesis"**

Narrate:

- "Model calls `khan__open_topic`."
- "App loads a guided lesson context."

Do:

Ask: **"Quiz me"**

Explain:

"This app is session-based only—no persistence, no auth. It's lightweight but still integrated into chat."

### 3. Study Planner — Authenticated OAuth App

Say:

"Now an authenticated app with real third-party user data."

Action:
Type: **"Plan three 45-minute study sessions for this week"**

Narrate:

- "This uses OAuth with Google Calendar."
- "If needed, the user connects Google through the auth flow."
- "Study sessions are created in the user's calendar account."

Do:

- Create 1-2 sessions.
- Ask: **"Show my upcoming study sessions"**

Then say:

"If I come back later and ask again, it persists because it's backed by the external account."

## Transition (5 sec)

"So we've shown three distinct K-12 apps: stateful, session-based, and authenticated OAuth."

## Demo 2: Recovery (45-60 sec)

Say:

"Now what happens when things fail?"

Explain clearly (no need to simulate):

"We use a three-layer recovery system:"

1. **Timeout**
   - "If an app doesn't respond in 15 seconds -> timeout."
   - "User gets a graceful message."
2. **Circuit breaker**
   - "After 3 failures -> app is temporarily disabled."
   - "Requests fail fast."
3. **Recovery**
   - "After 30 seconds -> system retries automatically."

"This prevents cascading failures when thousands of students hit the system at once."

## Demo 3: Architecture (1-1.5 min)

### Core Idea

"The hard problem is the boundary between chat and apps."

"We solve this with a standardized app contract + server orchestration layer."

### Lifecycle

"Every app follows the same lifecycle:"

`IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED -> IDLE`

### Flow (talk through Chess)

"User says 'play chess' -> LLM selects tool -> server validates and routes -> iframe renders -> app communicates via postMessage -> completion is explicitly signaled -> chat resumes with summary."

### Trust & Safety

"All apps are untrusted by default."

Key points:

- sandboxed iframes
- no direct credential access
- strict message validation
- data minimization
- app approval workflow (teachers approve apps)

"We don't rely on full visual moderation—instead we enforce safety at the boundary and through human approval."

### Key Architecture Decisions

- server owns all LLM + tool routing
- apps communicate via JSON-RPC over postMessage
- summaries replace raw state for efficiency
- single active app per conversation

## Closing (15-20 sec)

"ChatBridge transforms chat from a passive interface into an orchestration platform."

"It supports unknown third-party apps through a standardized contract, maintains state across interactions, and enforces safety through both technical boundaries and human governance."

"That's how we solve the core case study problem."

## What this demo proves (implicitly)

- 3 working apps
- real orchestration (not just embedding)
- lifecycle handling
- recovery strategy
- trust & safety model
- technical depth
