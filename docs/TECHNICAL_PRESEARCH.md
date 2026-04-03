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
