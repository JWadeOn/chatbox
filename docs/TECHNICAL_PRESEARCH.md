# Technical Presearch — ChatBridge (Brownfield)

## Case Study Analysis

ChatBridge is not starting from a blank page. The project goal is to extend the existing `chatbox` product foundation into a platform that can safely orchestrate third-party learning apps inside a conversational experience. That changes the core technical question. The hard problem is no longer "how do we build a chat app?" but "how do we preserve the strengths of Chatbox while adding the missing platform boundaries for trusted orchestration, server authority, and app lifecycle control?"

Chatbox already proves several high-value pieces:

- A mature chat UX with streaming interactions
- Strong markdown rendering and message presentation
- Context management and token estimation patterns
- Existing model/provider abstractions
- A web-capable renderer architecture that can inform public deployment

Because of that, a full rewrite would be strategically wrong for a 7-day solo sprint. Rebuilding the chat shell, message rendering stack, and interaction model would consume the schedule before the risky integration work is even tested. The project should instead treat Chatbox as the brownfield substrate: extract or adapt the parts that accelerate delivery, and add only the missing platform-specific layers.

The real technical challenge is **safe orchestration under uncertainty**. Third-party apps have unknown UI behavior, unknown state models, and varying authentication needs. The platform cannot deeply understand every app. The correct abstraction is to make **intent** and **invocation lifecycle** first-class platform concepts while leaving app-specific state inside the app. This yields a clean three-layer model:

1. Chat state: conversation, messages, model context
2. App state: owned by the embedded app
3. Context bridge: structured summaries/results that reconnect app activity back into the conversation

The next challenge is **privilege separation**. Chatbox today is optimized for direct user-to-model interaction. ChatBridge requires a stronger trust boundary:

- All LLM calls must move server-side
- App registration and tool schemas must be validated centrally
- Third-party UI must be sandboxed
- OAuth must be brokered by the platform, not delegated to the app iframe

This means the architecture should be **brownfield on the client, greenfield at the server boundary**. Reuse the proven user-facing shell where possible; build new server services where trust, persistence, and orchestration require it.

Finally, there is the risk of the **brownfield illusion**: code that looks reusable but is too tightly coupled to old assumptions. The mitigation is explicit reuse rules:

- Reuse directly only when the code is isolated and adapts in under 30 minutes
- Extract and own copied code in ChatBridge modules rather than depending on `chatbox/` at runtime
- Rewrite only when the old behavior conflicts with server authority, security, or the app lifecycle model

This produces the right balance: move fast because Chatbox already solved many UX problems, but do not inherit client-side trust assumptions that conflict with the new platform.

---

## Phase 1: Define Constraints

## 1. Product Constraint: Brownfield, Not Rewrite

- The project is meant to build on top of Chatbox
- A full client rewrite is out of scope for the sprint
- Existing Chatbox strengths should reduce time-to-value

**Decision:** Treat Chatbox as the donor codebase for chat UX, rendering, and context-management patterns. New platform features must wrap or extend that foundation rather than replace it wholesale.

---

## 2. Time to Ship

- 7-day sprint
- Solo developer
- Required to prove one full vertical slice before widening scope

**Decision:** Reuse proven chat shell concepts first, then spend effort on the new hard parts: server orchestration, iframe lifecycle, and app completion signaling.

---

## 3. Public Deployment Requirement

- Final submission must be publicly accessible
- Chatbox is desktop-first, but has a web-capable renderer path

**Decision:** Use a web-facing deployment model for ChatBridge while preserving Chatbox-derived client UX and component patterns. Public deployment is a delivery constraint, not a reason to discard the Chatbox foundation.

---

## 4. Security and K-12 Trust Model

- Third-party apps are untrusted by default
- Student data exposure must be minimized
- OAuth cannot happen inside the sandboxed iframe

**Decisions:**

- Sandboxed iframes for third-party UI
- Strict origin validation on all `postMessage` traffic
- Platform-owned OAuth broker
- Server-side LLM access only

---

## 5. Brownfield Reuse Constraints

Not every Chatbox feature is equally reusable.

**Likely reusable with adaptation:**

- Markdown rendering
- Message list and streaming presentation patterns
- Context compaction / summary logic
- Token estimation utilities
- Provider/model configuration patterns

**Must be replaced or added new:**

- Client-side LLM calls
- Electron-only runtime assumptions
- Local persistence as system-of-record
- App registry, tool router, app session lifecycle, OAuth proxy

**Decision:** Explicitly document reuse, adaptation, and rewrite boundaries before implementation to avoid wasted effort.

---

## Phase 2: Architecture Discovery

## 6. Client Shell Strategy

The client should be derived from Chatbox interaction patterns rather than redesigned from scratch.

**Adopt / Adapt:**

- Chat transcript layout
- Streaming response presentation
- Markdown display pipeline
- Input ergonomics
- Context-budget management ideas

**Add new client capabilities:**

- App rendering slot within the conversation flow
- Invocation state UI
- Iframe handshake and completion handling
- Conversation state backed by the platform, not local-only storage

---

## 7. Server Authority Model

ChatBridge needs a new server-owned control plane that Chatbox does not provide.

**Server responsibilities:**

- Authenticate users
- Persist conversations, app sessions, and tool logs
- Own LLM calls and streaming
- Discover registered tools
- Route tool invocations
- Enforce rate limits, circuit breakers, and timeouts
- Manage OAuth tokens

**Key insight:** Chatbox remains the UX accelerator; the server becomes the trust anchor.

---

## 8. App Integration Model

- Third-party app UI lives in a sandboxed iframe
- Platform and app communicate via JSON-RPC 2.0 over `postMessage`
- App completion is explicit, not inferred

**Key lifecycle states:**

`IDLE -> TOOL_REQUESTED -> APP_RENDERED -> ACTIVE -> COMPLETED`

With additional `ERROR` and `TIMEOUT` exits.

This lifecycle is the critical control point for reliability. It must be designed and tested before broad app expansion.

---

## 9. State Model

The brownfield architecture should preserve separation:

1. Chat state belongs to the platform
2. App state belongs to the app
3. Context bridge belongs to the orchestration layer

**Decision:** Do not force Chatbox-style local session state to become the primary system of record. Server persistence is authoritative; client state is a synchronized view.

---

## 10. Data and Persistence

- Existing Chatbox local persistence is useful for UX patterns but not sufficient as platform storage
- ChatBridge requires durable backend persistence for users, conversations, apps, tool logs, intents, app sessions, and OAuth tokens

**Decision:** Introduce a backend data model while avoiding unnecessary rewrites of client-side message rendering and state presentation.

---

## 11. Authentication and OAuth

- Platform auth is new work
- OAuth for third-party apps is new work
- Chatbox provider auth patterns are not the same as end-user platform auth

**Decision:** Build platform auth and OAuth proxying as new server-side capabilities; do not try to stretch Chatbox's existing auth-related code into this role.

---

## Phase 3: Brownfield Refinement

## 12. Reuse Matrix

| Area | Decision | Why |
|---|---|---|
| Markdown rendering | Reuse / adapt | High-value, relatively isolated |
| Streaming chat UX | Reuse patterns | Already solved well in Chatbox |
| Context management | Reuse algorithms | Relevant to token pressure and summary flow |
| Token estimation | Reuse | Directly applicable |
| Provider abstractions | Adapt carefully | Useful shape, but server-owned now |
| Conversation persistence | Replace | Platform needs server authority |
| LLM call path | Replace | Client-side model calls violate trust model |
| App platform / iframe lifecycle | New | Not present in Chatbox |
| App registry / tool router | New | Not present in Chatbox |
| OAuth proxy | New | Not meaningfully implemented in Chatbox OSS |

---

## 13. Delivery Strategy

The correct order is:

1. Establish brownfield boundaries and reusable components
2. Move core chat authority server-side
3. Add iframe rendering + app lifecycle
4. Prove Chess as the full vertical slice
5. Add secondary apps only after lifecycle stability

This keeps the schedule focused on risk retirement rather than architecture churn.

---

## 14. Main Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Brownfield illusion: code appears reusable but is tightly coupled | High | High | Timebox reuse attempts; extract only isolated modules |
| Client-side Chatbox assumptions leak into server-owned platform flows | High | High | Draw a hard authority boundary; server owns persistence and LLM calls |
| Completion signaling remains brittle | High | High | Build and test the full lifecycle before additional apps |
| Public web deploy diverges from desktop-first assumptions | Medium | Medium | Reuse renderer patterns, not Electron runtime assumptions |
| Scope expands before Chess is complete | High | High | Enforce the vertical slice rule |

---

## Final Insight

ChatBridge should be framed as **a brownfield platform extension of Chatbox, not a replacement for it**.

The winning strategy is:

1. Reuse Chatbox where it already solves UX and context problems well
2. Add a new server-side orchestration layer where trust and lifecycle control require it
3. Prove one app end-to-end before scaling breadth

If the docs and implementation keep that boundary clear, the project remains achievable. If they drift back into silent rewrite mode, the sprint will spend its time rebuilding solved problems instead of validating the actual product risk.
# Technical Presearch — ChatBridge (High-Quality)

## Case Study Analysis

ChatBridge represents a shift from a traditional chatbot into a **platform for orchestrating third-party applications within a conversational interface**. The core challenge is not conversational AI itself, but designing a system that can safely, flexibly, and reliably integrate unknown external applications into a structured, real-time chat experience—especially in a K–12 educational context.

The first major challenge is **orchestration under uncertainty**. Unlike fixed integrations, the platform must support arbitrary third-party apps with different capabilities, UI patterns, and state models. This introduces a key tradeoff: flexibility vs. reliability. A tightly controlled system would simplify orchestration but limit extensibility, while a fully open system would introduce ambiguity and instability. The solution is to treat **user intent as a first-class abstraction**. Instead of deeply understanding every app’s internal state, the system tracks what the user is trying to accomplish (e.g., “playing chess,” “studying,” “checking weather”). This simplifies routing, reduces cognitive load for the LLM, and enables scalable orchestration.

The second challenge is **trust and safety**, which is amplified in a K–12 environment. Third-party apps are inherently untrusted and may attempt to access sensitive data or behave unpredictably. The system must assume adversarial conditions by default. This leads to architectural decisions such as **sandboxed iframes, strict Content Security Policies, and controlled message passing via structured protocols**. The tradeoff here is between developer freedom and system safety. While strict boundaries increase integration friction, they are necessary to protect student data and maintain compliance with FERPA/COPPA requirements. Ethical considerations—such as minimizing data exposure, preventing harmful content, and enabling teacher control—are embedded directly into the architecture.

The third challenge is **state synchronization across independent systems**. Chat, apps, and platform each maintain their own state. Fully merging these would create tight coupling and fragility, while full separation would break user experience continuity. The solution is a **three-layer state model**:
1. Chat state (conversation + LLM context)
2. App state (owned entirely by the third-party app)
3. Contextual bridge (structured outputs injected into chat)

This approach preserves modularity while enabling continuity in conversation.

Another critical challenge is **lifecycle coordination**—specifically, how the system knows when an app starts, updates, or completes. Completion signaling is especially difficult because apps are asynchronous and external. This is addressed through **explicit lifecycle contracts using JSON-RPC over postMessage**, ensuring deterministic transitions between chat and app states.

Finally, **cost and scalability constraints** significantly influence system design. Multi-turn conversations with tool usage can lead to exponential token growth. To mitigate this, the system uses **tiered model routing and prompt caching**, trading moderate complexity for substantial cost savings.

Overall, the architecture is built around **controlled extensibility**: enabling third-party innovation while enforcing strict boundaries for safety, predictability, and scalability.

---

# Phase 1: Define Constraints

## 1. Scale & Load Profile
- Launch: ~1K users
- 6 months: 50K–100K users
- Target DAU: 200K+
- Traffic: Highly spiky (school schedules, exams)
- Concurrency: 1–2 apps per user, 100K+ concurrent sessions

**Performance Targets:**
- Chat latency: <100ms
- Reasoning latency: 1–5s
- App load time: <200ms

**Decision:** Use WebSockets + horizontal scaling + caching.

---

## 2. Budget & Cost Ceiling
- High sensitivity to LLM token costs
- Multi-turn + tools → exponential cost growth

**Strategy:**
- Tiered model routing (premium / mid / cheap)
- Prompt caching (target 70–90% hit rate)

**Tradeoff:** Slight complexity increase for major cost reduction.

---

## 3. Time to Ship
- 7-day sprint (solo developer)
- Priority: vertical slice over scalability perfection

**Decision:**
- Use Next.js + Node.js
- Avoid microservices initially

---

## 4. Security & Sandboxing
- Strict K–12 compliance required
- Zero trust for third-party apps

**Decisions:**
- Sandboxed iframes (no same-origin)
- CSP enforcement
- Input/output validation

---

## 5. Team & Skill Constraints
- Solo developer
- Need rapid iteration

**Decision:** Use familiar tools and frameworks.

---

# Phase 2: Architecture Discovery

## 6. Plugin Architecture
- Iframe-based rendering
- MCP-style tool schemas
- JSON-RPC over postMessage

**Key Insight:** Platform orchestrates, apps execute.

---

## 7. LLM & Function Calling
- Inject only relevant tool schemas
- Intent-based routing
- Avoid context bloat

---

## 8. Real-Time Communication
- WebSockets for chat
- postMessage for app communication

---

## 9. State Management
Three-layer system:
1. Chat state
2. App state
3. Context bridge

---

## 10. Authentication Architecture
- Internal (no auth)
- Public (API key)
- OAuth apps

**Decision:** Platform acts as auth proxy, OAuth outside iframe.

---

## 11. Database & Persistence
- PostgreSQL
- Stores: conversations, app registry, tool logs

---

# Phase 3: Post-Stack Refinement

## 12. Security Deep Dive
- Iframe sandbox (scripts/forms only)
- CSP, COOP, COEP
- Data minimization

---

## 13. Error Handling & Resilience
- Circuit breakers
- Timeout handling
- Graceful fallback UX

---

## 14. Testing Strategy
- Mock apps
- End-to-end lifecycle testing
- Load testing

---

## 15. Developer Experience
- Clear API contracts
- Tool schema docs
- Debugging tools

---

## 16. Deployment & Operations
- Vercel (frontend) + Node backend
- Blue-green deployment
- Monitoring (latency, failures)

---

# Key Architectural Decisions

| Area | Decision | Rationale |
|------|--------|----------|
| Rendering | Iframes | Security boundary |
| Communication | JSON-RPC | Structured messaging |
| State | 3-layer model | Decoupling |
| LLM | Tiered routing | Cost control |
| Auth | Proxy model | Security |
| Real-time | WebSockets | Low latency |

---

# Final Insight

The success of ChatBridge depends on three things:

1. Clear tool schema contracts  
2. Reliable lifecycle signaling  
3. Strong state boundaries  

If these are correct, the platform scales cleanly.  
If they are weak, the system becomes unpredictable and breaks under complexity.
