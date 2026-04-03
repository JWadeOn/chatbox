---
name: spec-generator
description: Generate a technical specification from a PRD, product description, or conversation context. Use this skill when the user says "write a spec", "technical specification", "engineering plan", "how should we build this", "system design", "architecture doc", or wants to translate product requirements into an implementation blueprint. Also trigger when a user has completed a PRD and wants to move to the engineering phase, or says "let's plan the build" or "define the architecture". This is the THIRD step in the presearch → PRD → spec → CLAUDE.md pipeline.
---

# Spec Generator

Generate a complete technical specification that defines HOW to build the product. The spec translates product requirements into engineering decisions, architecture, data models, and a work plan.

## When to use

- User has a PRD and wants to plan the implementation
- User wants to define architecture, data model, or API design
- User says "write a spec", "technical spec", "system design", "how do we build this"
- User wants to go from product definition to engineering blueprint

## Position in the pipeline

General Presearch → PRD → Technical Presearch → **Spec** → CLAUDE.md

Spec answers: "How exactly are we building it?"
It takes input from the PRD (requirements) and technical presearch (evaluated options), and feeds into CLAUDE.md (developer onboarding).

## Inputs

Accept any combination of:
- A PRD (provides requirements and constraints)
- A technical presearch doc (ideal — provides evaluated options and recommendations)
- A general presearch doc (provides domain context)
- A product description or feature list
- Existing technical docs, architecture diagrams, or code
- Conversational description of the system
- The actual codebase (if accessible via filesystem)

If the user has a PRD, read it first. Every technical decision should trace back to a product requirement.

## Process

### 1. Extract technical requirements

From the PRD (or conversation), identify:
- What data needs to be stored, queried, and how often?
- What are the performance requirements (latency, throughput, scale)?
- What integrations are needed (third-party APIs, auth providers, payment)?
- What are the security and compliance requirements?
- What's the team's existing expertise? (This influences stack choices)
- What's the deployment target (cloud, self-hosted, serverless)?
- What's the timeline? (This affects build-vs-buy decisions)

If information is missing, ask the user — but batch questions into one round. If they don't know, make a reasonable default choice and document the assumption.

### 2. Make stack decisions

For each technology choice, document:
- What it is and the version
- Why this over alternatives (1-2 sentences)
- What risk or tradeoff it introduces

Don't just pick the trendy option. Consider: team familiarity, ecosystem maturity, hiring pool, operational complexity, cost, and whether it actually fits the requirements.

If the user hasn't specified preferences, research what's commonly used for this type of application and present 1-2 options with tradeoffs. Make a recommendation but let them decide.

### 3. Design the architecture

Start with the simplest architecture that meets the requirements. Common mistake: over-engineering for scale you don't have yet.

For each major component:
- What it does (single responsibility)
- How it communicates with other components (sync/async, protocol)
- Where the trust boundary is
- How it fails and what happens when it does

### 4. Design the data model

For each entity:
- Fields with types
- Primary key strategy
- Relationships and foreign keys
- Indexes (based on query patterns from the PRD's user stories)
- Soft deletes, audit fields, multi-tenancy keys as appropriate

Think through the queries the application will need to run. The data model should make common queries simple and fast.

### 5. Design the API

If the system has an API layer:
- Resource-oriented design (REST) or query-oriented (GraphQL) — pick one, justify it
- Endpoint list with methods, paths, request/response shapes
- Auth requirements per endpoint
- Pagination, filtering, and sorting conventions
- Error response format (standardized)
- Versioning strategy

### 6. Plan the rest

For each of these, only include what's relevant to the project:

- **Auth & authorization** — How users prove identity, how permissions are checked
- **Infrastructure** — Where it runs, how it deploys, environments
- **Error handling** — Strategy at each layer, user-facing vs logged
- **Performance** — Targets, caching strategy, optimization approach
- **Security** — Input validation, secrets management, encryption, compliance
- **Testing** — What gets tested, how, where tests live
- **Migration** — How to get from zero to running, rollback plan
- **Observability** — Logging, metrics, alerting, tracing

### 7. Create the task dependency DAG

This is where the spec becomes actionable. The output is a dependency graph that enables parallel execution, not a linear list.

**Step 7a — List tasks:**
Break the build into concrete work items, roughly one PR each. Each task gets an ID (`T01`, `T02`, ...).

**Step 7b — Compute dependencies:**
For each task, ask: "What MUST be complete before this can START?" Use the architecture you just designed:
- Does this task depend on a database table? → It depends on the schema task
- Does this task implement one side of an API? → It depends on the interface/types task
- Does this task render UI for data? → It depends on the data layer task
- Does this task have no real dependencies? → It goes in Layer 0

**Step 7c — Extract shared foundations:**
Look for tasks that multiple other tasks depend on. Pull shared concerns into earlier layers:
- Database schema + migrations → Layer 0
- Shared TypeScript types/interfaces → Layer 0
- API contracts (request/response shapes) → Layer 0 or 1
- Auth middleware → Layer 0 or 1

This is the key move that unlocks parallelism: define the contracts first, then implementations can proceed independently.

**Step 7d — Assign layers:**
Layer N = tasks whose deepest dependency is in Layer N-1. Tasks in the same layer have no dependencies on each other and CAN run in parallel.

**Step 7e — Define workstreams:**
Group related tasks across layers into vertical workstreams. Each workstream is a slice of the system that one agent can own end-to-end. Workstreams should minimize file conflicts:
- WS-A might own chat backend, WebSocket, streaming
- WS-B might own app registration, tool schemas, iframe embedding
- WS-C might own individual apps (chess, weather, etc.)

**Step 7f — Identify the critical path:**
The longest dependency chain through the DAG. This bounds total wall-clock time no matter how many agents you run.

**Step 7g — Estimate effort:**
T-shirt sizes: S = hours, M = a day, L = multiple days, XL = a week+

**Step 7h — Map to deadlines:**
Align layers with the PRD's milestones (MVP, Early, Final).

**Output format in the spec:**

```markdown
## Task DAG

### Layer 0 — Foundation (no dependencies, all parallel)
- T01: description (effort) [WS-A] ← none
- T02: description (effort) [WS-B] ← none

### Layer 1 — description
- T04: description (effort) [WS-A] ← T01, T03
- T05: description (effort) [WS-B] ← T02, T03

### Critical path: T01 → T04 → T08 → T12 (estimated: X days)
### Max parallelism: N agents at Layer 0
### Workstreams: WS-A (Chat), WS-B (App Platform), WS-C (Apps)
```

### 8. Quality checklist

Before delivering, verify:
- [ ] Every technical decision traces back to a product requirement
- [ ] Stack choices include justifications, not just names
- [ ] Data model supports all the queries implied by user stories
- [ ] API design covers all features in the PRD's P0 scope
- [ ] Error handling, auth, and security aren't afterthoughts
- [ ] Task DAG has no circular dependencies
- [ ] Tasks in the same layer are truly independent (no shared file conflicts)
- [ ] Shared interfaces/schemas are extracted to earlier layers
- [ ] Critical path is identified
- [ ] No product decisions are being made here (those belong in the PRD)
- [ ] A senior engineer could start building from this doc tomorrow
- [ ] Assumptions are explicitly called out

## Output

Write the spec as a markdown file. If in Claude.ai, save to `/mnt/user-data/outputs/SPEC.md`.

The spec branches into two independent outputs. End your response by offering both:
"This spec feeds into two documents that can be generated in parallel:
1. **CLAUDE.md** — AI agent onboarding context (run the claude-md-generator skill)
2. **TASKS.md** — Living execution DAG (run the tasks-generator skill)

Ready to generate either or both?"

## Handoff to CLAUDE.md and TASKS.md

The spec is a **branching point** in the pipeline:

```
Spec ─┬→ CLAUDE.md  (what the AI needs to know — context)
      └→ TASKS.md   (what to build and in what order — execution DAG)
```

These are independent — generate them in parallel if possible.

**For CLAUDE.md**, the claude-md-generator skill condenses the spec into the concise onboarding format Claude Code reads.

**For TASKS.md**, the tasks-generator skill takes the spec's task DAG and hydrates it into a living tracker with ready queue, status tracking, and workstream assignments.

## Important: Spec ≠ PRD

Watch for scope creep in the wrong direction:
- If you find yourself defining new features → stop, that's PRD territory
- If you find yourself writing user stories → stop, that's PRD territory
- If you find yourself debating whether to build a feature → stop, that decision should already be made

The spec implements what the PRD decided. If the PRD is ambiguous, call it out in "Open Technical Questions" and ask the user to clarify the requirement before you design the solution.