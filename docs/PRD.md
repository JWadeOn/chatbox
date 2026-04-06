# ChatBridge — Product Requirements Document

**Project:** ChatBridge — AI Chat Platform with Third-Party App Integration  
**Context:** TutorMeAI case study (Gauntlet AI, Week 7)  
**Sprint:** 7 days  
**Status:** Draft, revised for brownfield execution

---

## 1. Problem Statement

TutorMeAI needs more than a configurable chatbot. Its next defensible advantage is a chat experience that can launch and coordinate third-party learning tools without forcing students or teachers to leave the conversation.

The hardest product problem is not chat itself. Chatbox already demonstrates that a polished AI chat interface, streaming replies, markdown rendering, and session-oriented UX can be delivered well. The harder problem is turning that foundation into a **safe orchestration platform**:

- The system must launch third-party app experiences from natural language
- The app must coexist with the conversation, not replace it
- The platform must know when an app starts, updates, fails, or finishes
- Teachers and platform operators must retain control over what is available
- The trust boundary must hold for K-12 usage

ChatBridge is therefore a **brownfield platform extension of Chatbox**. The product goal is to add orchestration, app lifecycle, and server authority on top of an existing chat foundation, not to spend the sprint rebuilding the chat client from scratch.

---

## 2. Product Goal

Build a publicly accessible Chatbox-derived chat experience that can:

1. Route a user request to an appropriate third-party app
2. Render the app safely inside the chat experience
3. Preserve conversational continuity before, during, and after the app interaction
4. Support at least three app patterns:
   - One complex stateful app (`Chess`)
   - One public app with no user auth (`Weather` or equivalent)
   - One OAuth-backed app (`Spotify` or equivalent)

The product must prove that Chatbox can be extended into a platform, not just used as a UI reference.

---

## 3. Brownfield Product Constraint

This requirement is foundational:

- ChatBridge must build on top of Chatbox's strengths
- Rebuilding solved Chatbox features is out of scope unless required by the new trust model
- Reused code should become ChatBridge-owned code after extraction or adaptation; the runtime should not depend on `chatbox/` as a live import boundary

**Implication:** Product requirements should prioritize new platform behavior over rebuilding baseline chat behavior.

---

## 4. Target Users

| User | Needs | Constraints |
|---|---|---|
| Students (K-12) | Seamless app experiences inside chat, low-friction interaction, natural follow-up conversation | Limited patience, safety-sensitive, little tolerance for confusing state changes |
| Teachers | Confidence that only approved apps are used and that student experience stays coherent | Need control, not engineering complexity |
| Third-party developers | Clear app contract, predictable lifecycle, documentation, testability | Must operate inside a sandbox and platform-owned auth model |
| Platform operators | Reliability, auditability, cost control, data minimization | Small team, high safety expectations, public demo requirement |

---

## 5. In Scope

### Core Product Capabilities

- Chatbox-derived chat UI with streaming responses
- Persistent conversations and follow-up continuity
- Server-authoritative chat orchestration
- App invocation from natural language requests
- App UI rendered inside the chat flow
- Completion signaling so the conversation resumes naturally
- Context retention after app completion
- Graceful recovery from app failure, timeout, or invalid tool calls

### Platform Capabilities

- App registration with tool schemas and metadata
- Tool discovery and routing
- Invocation state tracking
- Sandboxed iframe rendering with strict origin checks
- OAuth proxy flow for authenticated apps
- Teacher/operator control over enabled apps at a basic level

### Required App Demonstrations

- `Chess`: complex stateful app with ongoing back-and-forth
- `Weather`: public or internal app with no user-specific auth
- `Spotify`: OAuth-backed app proving delegated authorization flow

### Brownfield Reuse Requirement

The implementation should explicitly reuse or adapt Chatbox strengths where they accelerate delivery:

- Chat transcript UX patterns
- Streaming response presentation
- Markdown rendering
- Context management ideas
- Token estimation / prompt-budget utilities where relevant

---

## 6. Out of Scope

- Full rewrite of the chat shell for purely aesthetic reasons
- Replacing Chatbox-derived interaction patterns before the app lifecycle works
- Building an app marketplace
- Deep teacher admin tooling beyond simple enable/disable controls
- Mobile-native clients
- Broad feature parity with full Chatbox desktop capabilities
- Any second-wave app work before the Chess lifecycle is stable

---

## 7. User Stories

### Student Flow

**US-1: Start an app from conversation**  
As a student, I can say "let's play chess" and the chess board appears inside the chat experience.

**US-2: Stay in context mid-app**  
As a student, I can ask "what should I do here?" during a chess game and the assistant answers using the current game state.

**US-3: Resume conversation after app completion**  
When the app interaction ends, the assistant can discuss what happened without losing context.

**US-4: Switch tasks naturally**  
After using one app, I can ask for a different tool and the assistant routes correctly without confusion.

**US-5: Authenticate when needed**  
If I ask for a Spotify action, the platform guides me through auth and resumes the task after authorization.

### Chat / Platform Behavior

**US-6: Route correctly**  
When a request clearly matches an app capability, the platform invokes the right tool.

**US-7: Ask for clarification**  
When a request is ambiguous, the system asks instead of guessing.

**US-8: Refuse unrelated app use**  
The assistant does not invoke apps when normal chat is the correct response.

**US-9: Recover gracefully**  
If an app fails or times out, the assistant explains the issue and offers a recovery path.

### Third-Party Developer Flow

**US-10: Register an app**  
A developer can define an app, its tools, and its UI endpoint through a documented contract.

**US-11: Participate in a controlled lifecycle**  
The app receives structured invocations and can send state updates and completion signals back to the platform.

**US-12: Work within platform trust boundaries**  
The app never receives raw platform credentials and does not own the OAuth flow.

---

## 8. Milestones

### MVP

Goal: prove the brownfield foundation is real and avoid silent rewrite.

- Brownfield audit complete: reuse / adapt / rewrite boundaries documented
- Chatbox-derived chat shell or interaction patterns preserved
- One server-authoritative chat path works end to end
- Baseline conversation persistence works
- Architecture narrative clearly explains how Chatbox is being extended

### Early Submission

Goal: prove the vertical slice.

- Tool discovery and invocation working
- Sandboxed app rendering inside chat
- Completion signaling working
- Context retention after app completion
- Chess fully works through its full lifecycle
- Failure paths handled for the vertical slice

### Final Submission

Goal: prove breadth after reliability.

- Weather app working
- OAuth-backed app working
- Basic app enablement controls present
- Public deployment live
- Developer-facing setup / integration docs written
- Demo and cost analysis complete

---

## 9. Architecture Decisions

| Decision Area | Product Direction | Rationale |
|---|---|---|
| Starting point | Brownfield on Chatbox | Reuse proven chat UX and avoid wasting the sprint on a rewrite |
| Trust model | Server owns LLM calls and orchestration | Student-facing platform cannot rely on client-side privileged flows |
| App rendering | Sandboxed iframe inside chat | Strongest boundary for untrusted third-party UI |
| App communication | JSON-RPC 2.0 over `postMessage` | Structured lifecycle and cross-origin compatibility |
| State model | Chat state, app state, context bridge | Preserves modularity and conversational continuity |
| Delivery strategy | Vertical slice first (`Chess`) | Completion signaling is the highest-risk behavior |
| Brownfield policy | Extract/adapt, do not live-import from `chatbox/` | Keeps ownership clear while still building on top of Chatbox |

---

## 10. Success Metrics

### Must-Have Functional Outcomes

- User can launch `Chess` from a chat message
- App UI renders inside the conversation
- User can ask about app state during interaction
- App can signal completion and the conversation resumes
- Follow-up questions reference app results
- User can switch to another app afterward
- OAuth flow works for at least one app

### Brownfield Success Signals

- The final product visibly retains Chatbox-derived interaction quality
- The implementation reuses or adapts proven Chatbox concepts instead of silently replacing them
- The team can clearly explain what was reused, what was added, and why

### Reliability Signals

- App failure does not crash the chat experience
- Ambiguous requests are clarified
- Unrelated requests do not trigger app invocations
- Completion signaling and context retention are stable for the Chess slice

---

## 11. Technical Constraints

- **Timeline:** 7 days, solo developer
- **Security:** no `allow-same-origin` on untrusted app iframes
- **Deployment:** must be publicly accessible
- **Authority boundary:** all LLM calls must be server-side
- **Codebase constraint:** build on top of Chatbox rather than replacing it wholesale
- **Ownership rule:** copied or extracted code becomes ChatBridge-owned

---

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Brownfield drift becomes rewrite-by-accident | High | High | Keep reuse matrix explicit and review against it continuously |
| Completion signaling proves brittle | High | High | Build and test the Chess lifecycle before wider app scope |
| Hidden Chatbox coupling slows reuse | High | Medium | Timebox extraction attempts; rewrite only after failed isolation attempt |
| Public deployment diverges from desktop assumptions | Medium | Medium | Reuse renderer patterns, not Electron runtime requirements |
| OAuth flow complexity expands late | Medium | High | Defer OAuth app until after Chess is stable |

---

## 13. Build Priority

1. Lock brownfield boundaries and reuse candidates
2. Establish server-owned chat authority and persistence
3. Add app registration and tool discovery
4. Add iframe rendering and lifecycle messaging
5. Prove `Chess` end to end
6. Harden error handling and context retention
7. Add `Weather`
8. Add OAuth app
9. Polish, document, deploy

**Rule:** Do not broaden scope until `Chess` works all the way through launch, interaction, completion, and follow-up conversation.

---

## 14. Final Product Principle

ChatBridge succeeds if it feels like **Chatbox evolved into a safe app platform**, not like a separate prototype that happens to live in the same repository.
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

**Required applications (3 minimum, final lineup):**
- Chess (required) — high complexity, ongoing state, bidirectional communication, interactive board with legal move validation
- Flashcards (platform-authenticated) — user-specific decks and progress tied to platform identity, no external OAuth in MVP
- Khan Academy Companion (no auth) — guided topic exploration with concept explanations and quizzes, session-only state
- First Principles Tutor (bonus) — structured reasoning decomposition tool

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
> I finish a chess game and say "let's explore photosynthesis" — the chatbot routes to the Khan Companion without confusion.

**US-5: Use an authenticated app**
> I say "create a flashcard deck for vocabulary" — the platform uses my authenticated identity to create a personal deck, and I study cards in the iframe.

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
