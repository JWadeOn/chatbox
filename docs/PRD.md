# ChatBridge — Product Requirements Document

**Project:** ChatBridge — AI Chat Platform with Third-Party App Integration
**Context:** TutorMeAI case study (Gauntlet AI, Week 7)
**Sprint:** 7 days (MVP Tuesday, Early Friday, Final Sunday)
**Author:** Generated from General Presearch + Project Brief
**Status:** Draft

---

## 1. Problem Statement

TutorMeAI is a 30-person startup serving 10,000+ K-12 districts with 200,000 daily active students and teachers. Their competitive advantage is configurability — teachers shape chatbot behavior in ways competitors can't match. Competitors are closing that gap.

The next defensible moat is orchestration: letting the chatbot invoke third-party applications (games, flashcards, simulators) inside the chat experience, while teachers retain control over what's available. The hard problem is the boundary between chat and app — the platform must support apps it can't predict, from simple calculators to complex stateful workflows, while keeping students safe.

## 2. Target Users

| User | Needs | Constraints |
|---|---|---|
| Students (K-12) | Seamless learning tools inside chat, no context switching, natural language interaction | COPPA/FERPA protected, limited technical sophistication, attention span |
| Teachers | Control over which apps are available, visibility into student activity, configurability | Time-constrained, non-technical, need admin tools not engineering tools |
| Third-party developers | Clear API contract, easy registration, testable integration, documentation | No access to platform internals, must work within sandbox constraints |
| Platform operators (TutorMeAI) | Scalable architecture, cost control, safety guarantees, regulatory compliance | 30-person team, must support 200K DAU, K-12 regulatory environment |

## 3. Product Scope

### In Scope (Must Ship)

**Chat platform fundamentals:**
- Real-time AI chat with streaming responses
- Persistent conversation history across sessions
- User authentication for the platform
- Multi-turn conversation support spanning app interactions
- Graceful error recovery when apps fail, timeout, or return errors

**Third-party app integration architecture:**
- Programmatic app registration and capability declaration
- Tool schema definition and discovery by the chatbot
- App UI rendering within the chat experience (iframe-based)
- Bidirectional communication: chatbot invokes app tools, app signals completion
- App state independence from chat state, with a contextual bridge for merging results back into conversation
- Context retention — chatbot remembers app results in subsequent turns

**Required applications (3 minimum):**
- Chess (required) — high complexity, ongoing state, bidirectional communication, interactive board with legal move validation
- One app requiring OAuth2 user authentication (e.g., Spotify playlist creator)
- One public/internal app with no user auth (e.g., weather dashboard, calculator)

**Authentication architecture spanning three app types:**
- Internal (no auth) — bundled with platform
- External public (API key or none) — no user-specific auth
- External authenticated (OAuth2) — user must authorize; platform handles token lifecycle

**Safety and compliance:**
- Iframe sandboxing with CSP enforcement
- Content validation at platform boundary
- Teacher/admin control over app availability
- FERPA/COPPA-aware data handling (minimize data shared with apps)

### Out of Scope (Not This Sprint)

- Teacher admin dashboard (beyond basic app availability controls)
- App marketplace or discovery UI
- Programmatic Tool Calling (PTC) — standard function calling first, PTC is a stretch goal
- Multi-language support
- Mobile-native apps (web responsive is sufficient)
- Analytics dashboard for usage patterns
- Billing or metering for third-party developers

## 4. User Stories

### Student Flow

**US-1: Start an app from conversation**
> As a student, I say "let's play chess" and a chess board appears in the chat without leaving the page.

**US-2: Get help mid-interaction**
> As a student playing chess, I ask "what should I do here?" and the chatbot analyzes the current board state and suggests a move.

**US-3: Return to conversation after app completes**
> When the chess game ends, the conversation continues naturally — the chatbot discusses the game and I can ask follow-up questions about what happened.

**US-4: Switch between apps**
> I finish a chess game and say "now show me the weather in Austin" — the chatbot routes to the weather app without confusion.

**US-5: Authenticate with an external service**
> I say "make me a study playlist on Spotify" — the platform walks me through OAuth login, then the app creates the playlist inside the chat.

### Chatbot Behavior

**US-6: Discover and route to correct app**
> When a student's request maps to a registered app's capabilities, the chatbot invokes the right tool with the right parameters.

**US-7: Handle ambiguity**
> When a request could map to multiple apps, the chatbot asks for clarification rather than guessing.

**US-8: Refuse unrelated requests**
> The chatbot does not invoke apps for queries unrelated to any registered tool.

**US-9: Recover from app failure**
> If an app times out or crashes, the chatbot acknowledges the issue, offers to retry or continue without the app.

### Third-Party Developer Flow

**US-10: Register an app**
> As a developer, I register my app by defining tool schemas, specifying my UI endpoint, and declaring what data I need — the platform validates my registration.

**US-11: Receive tool invocations**
> My app receives structured tool calls from the chatbot via postMessage with JSON-RPC 2.0, processes them, and returns results.

**US-12: Signal completion**
> When my app's task is done, I send a completion signal back to the platform so the chatbot knows to resume the conversation.

## 5. Feature Requirements by Deadline

### MVP (Tuesday — 24 hours)

| Feature | Acceptance Criteria |
|---|---|
| Basic AI chat | Streaming responses, conversation history persisted, context maintained across turns |
| User auth | Login/logout, session management |
| Pre-search document | Submitted with case study analysis (500 words) |
| Architecture video | 3-5 minute technical architecture presentation |

### Early Submission (Friday — 4 days)

| Feature | Acceptance Criteria |
|---|---|
| App registration API | Third-party apps can register tool schemas and UI endpoint |
| Tool discovery and invocation | Chatbot discovers registered tools, invokes them with correct parameters |
| UI embedding | App renders inside chat via sandboxed iframe |
| Completion signaling | App signals done, chatbot resumes conversation |
| Context retention | Chatbot remembers app results in follow-up turns |
| 3+ working apps | Chess (required) + 2 others demonstrating different patterns |
| Auth flows | At least one app with OAuth2, platform manages token lifecycle |
| Error handling | Timeouts, crashes, invalid tool calls handled gracefully |

### Final Submission (Sunday — 7 days)

| Feature | Acceptance Criteria |
|---|---|
| Polish | Loading indicators, progress feedback, smooth transitions |
| Documentation | API docs for third-party developers, setup guide, architecture overview |
| Deployment | Publicly accessible deployed application |
| Demo video | 3-5 min showing chat + app integration, plugin lifecycle, architecture |
| AI cost analysis | Dev spend tracked + projections for 100/1K/10K/100K users |
| Social post | Published on X or LinkedIn with description, features, demo |

## 6. Architecture Decisions (from Presearch)

These decisions were made during presearch and carry forward:

| Decision | Choice | Rationale |
|---|---|---|
| App isolation | Sandboxed iframes | True security boundary for untrusted K-12 code; Web Components share main thread |
| Tool registration | MCP-aligned schema | Standardized, reduces integration complexity from multiplicative to additive |
| App-platform communication | postMessage with JSON-RPC 2.0 | Secure cross-origin messaging, structured request/response |
| Real-time chat | WebSockets | Bidirectional, low-latency, supports streaming |
| State architecture | Three-layer (chat state, app state, contextual bridge) | Clean separation of concerns, apps remain independent |
| Intent tracking | Explicit user intent as first-class concept | Simplifies orchestration without requiring deep app state visibility |
| LLM strategy | Tiered model routing (flagship for orchestration, budget for simple Q&A, nano for moderation) | Cost control at scale |
| Auth for external apps | OAuth2 with platform as authenticated proxy | Apps never handle student credentials directly |

## 7. Success Metrics

### Functional (Graded)

- All 7 testing scenarios pass (tool discovery, UI rendering, completion signaling, context retention, multi-app switching, ambiguity routing, refusal accuracy)
- Performance is reasonable with visual feedback (spinners, progress indicators)
- 3+ apps integrated with different complexity and auth patterns
- Chess lifecycle works end-to-end: start → play → ask for help → game ends → discuss

### Quality Signals

- Third-party developer could register a new app using only the API documentation
- App failure doesn't crash the chat — recovery is graceful
- OAuth flow completes without manual token management by the user
- Cost analysis projections are grounded in actual dev spend data

## 8. Technical Constraints

- **Timeline:** 7 days, solo developer
- **LLM costs:** Track actual spend; project to 100K users
- **Regulatory:** FERPA/COPPA awareness required for K-12 context
- **Deployment:** Must be publicly accessible
- **Codebase:** Fork of Chatbox as starting point
- **Security:** Iframe sandbox must omit `allow-same-origin` for untrusted apps

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Completion signaling is harder than expected | High | High — breaks the chat-app lifecycle | Build and test this before adding more apps. Vertical slice first. |
| OAuth2 in iframes is complex (cookie restrictions, redirect handling) | High | Medium — one app may not work | Use top-level window for initial auth, not iframe redirect |
| Context window bloat from multiple app schemas | Medium | Medium — degraded LLM performance | Inject only active app schemas, not all registered apps |
| Iframe rendering inconsistencies across browsers | Medium | Low — cosmetic issues | Test in Chrome + one other browser early |
| LLM routing mistakes (wrong app, hallucinated tools) | Medium | Medium — broken UX | Clear tool descriptions, disambiguation prompts, testing scenario coverage |

## 10. Build Priority

This is the critical path, in order:

1. Basic chat (streaming, history, auth)
2. App registration API (define the contract)
3. Tool invocation (chatbot discovers and calls one app's tools)
4. UI embedding (iframe renders in chat)
5. Completion signaling (app tells chatbot it's done)
6. Context retention (chatbot remembers app results)
7. Chess fully integrated (end-to-end lifecycle)
8. Second and third apps
9. Auth flows (OAuth2 for authenticated app)
10. Error handling (timeouts, crashes, invalid calls)
11. Polish (loading states, transitions, visual feedback)
12. Documentation and deployment

**Rule:** Get one app fully working before touching a second. Vertical, not horizontal.

---

*This PRD feeds into Technical Presearch (stack evaluation) → Spec (detailed engineering plan) → CLAUDE.md (AI agent onboarding) → TASKS.md (living task tracker).*
