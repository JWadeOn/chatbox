# AI-Native Development Workflow

A complete system for building software with AI agents as first-class collaborators. Every document and skill is designed so both humans and AI (Claude Code, etc.) can read, generate, and maintain them.

---

## The Pipeline

Ideas don't become code in one step. This pipeline breaks the journey into phases, each producing a document that feeds the next.

The pipeline has two modes depending on whether you're starting from scratch or building on existing code:

**Greenfield** (new project):
```
General Presearch → PRD → Technical Presearch → Spec ─┬→ CLAUDE.md  (AI context)
                                                       └→ TASKS.md   (execution DAG)
```

**Brownfield** (fork, existing codebase):
```
General Presearch → PRD → Technical Presearch → Spec ─┐
                                                       ├→ RECONCILIATION.md ─┬→ CLAUDE.md
                                              Codebase ┘                     └→ TASKS.md
```

In greenfield, the spec is the branching point — it produces CLAUDE.md and TASKS.md directly.

In brownfield, the spec collides with an existing codebase. The **RECONCILIATION.md** bridges that gap — it maps the spec's assumptions to the codebase's reality, classifies every feature (EXISTS / PARTIAL / NEW / CONFLICTS), and becomes the branching point that feeds CLAUDE.md and TASKS.md with ground-truth information instead of idealized plans.

| Phase | Question it answers | Who reads it | Output |
|---|---|---|---|
| General Presearch | What's out there? Is this worth building? | Product / founder | Market landscape, competitors, user pain, risks |
| PRD | What are we building and why? | Everyone | Features, scope, success metrics, user stories |
| Technical Presearch | What are our implementation options? | Engineering | Stack evaluation, architecture options, build vs buy |
| Spec | How exactly do we build it? | Engineers + AI agents | Architecture, data model, API, task dependency DAG |
| Reconciliation | What does the fork already give us? | Engineers + AI agents | Gap analysis, convention decisions, pre-satisfied deps |
| CLAUDE.md | What does the AI need to know? | Claude Code | Commands, conventions, gotchas, guardrails |
| TASKS.md | What do we build next? What's parallel? | Engineers + AI agents | Dependency DAG, workstreams, ready queue |

### Why this order

**General Presearch before PRD** — You can't define a product without understanding the landscape. Skip this and your PRD is built on assumptions.

**PRD before Technical Presearch** — You can't evaluate a database until you know your data model, and you don't know your data model until you know your features.

**Technical Presearch before Spec** — You can't commit to an architecture without evaluating alternatives. Skip this and you're guessing.

**Spec before branching** — The spec is the richest source of truth. It has the architecture (component boundaries), data model (shared schemas), and API contracts (shared interfaces) — all required to compute what's truly independent and parallelizable.

**Reconciliation before CLAUDE.md and TASKS.md (brownfield only)** — Without reconciliation, CLAUDE.md describes an idealized repo that doesn't match reality, and TASKS.md creates work items for features that already exist. The reconciliation grounds both documents in the actual codebase.

### Why the pipeline branches

CLAUDE.md and TASKS.md are independent outputs — neither requires the other:
- CLAUDE.md tells the agent HOW to work in this codebase (context, conventions, guardrails)
- TASKS.md tells the agent WHAT to build and in what order (dependency DAG, workstreams)

In greenfield, both derive from the spec. In brownfield, both derive from the reconciliation (which itself derives from the spec + codebase).

### RECONCILIATION.md — the brownfield bridge

A spec is written with greenfield assumptions — "we'll use Postgres", "the API will look like this", "here's the data model." When you're building on a fork, many of those assumptions collide with reality. The reconciliation captures:

- **Feature gap analysis** — What exists, what's partial, what's new, what conflicts
- **Convention decisions** — Adopt the fork's patterns, evolve toward the spec, or replace (with ADR)
- **Dependency delta** — What to keep, add, remove, upgrade
- **Pre-satisfied dependencies** — Existing features the task DAG treats as already done
- **ADR triggers** — Every CONFLICTS finding or REPLACE decision that needs a decision record

### Jumping in

You don't always need all steps. The pipeline supports entry at any point:

- **Have an idea?** Start at General Presearch.
- **Know what to build but not how?** Start at Technical Presearch.
- **Have a spec already (greenfield)?** Go straight to CLAUDE.md + TASKS.md.
- **Have a spec + existing codebase (brownfield)?** Generate RECONCILIATION.md first, then CLAUDE.md + TASKS.md.
- **Existing codebase, no docs?** The CLAUDE.md generator can infer from the repo itself.

---

## Foundation Documents

These live outside the pipeline. Set them once, reference from every project.

### CONVENTIONS.md

Your universal coding standards — commit message format, branch naming, PR expectations, testing philosophy, naming conventions, dependency rules. Every project's CLAUDE.md links back to this instead of repeating it.

Lives at: org level or personal dotfiles repo. Referenced by every CLAUDE.md.

---

## During Development

Once you're writing code, these documents keep the work organized and traceable.

### TASKS.md (Dependency DAG)

The execution plan, structured as a directed acyclic graph. Derived from the spec's task breakdown + architecture, it answers: "what can I build right now, and what can run in parallel?"

**Why a DAG, not a list:** A linear task list forces sequential execution. But most projects have real parallelism — the chat backend and the app registration API don't depend on each other; they share a foundation (DB schema, types) and converge later (tool invocation). A DAG makes this explicit so multiple agents can work simultaneously via worktrees.

**Key concepts:**
- **Layers** — Tasks grouped by dependency depth. All tasks in the same layer are independent and can run in parallel.
- **Workstreams** — Vertical slices through the DAG that one agent owns end-to-end (e.g., WS-A: Chat, WS-B: App Platform). Workstreams minimize file conflicts between concurrent agents.
- **Ready queue** — Tasks whose dependencies are all satisfied. Updated every time a task completes.
- **Critical path** — The longest dependency chain through the DAG. This bounds total wall-clock time regardless of parallelism.

**Where the DAG comes from:** The spec's task breakdown provides the tasks. The spec's architecture provides the dependency information — component boundaries tell you what's independent, shared schemas/interfaces tell you what must be defined first. The tasks-generator skill computes the DAG from these inputs.

The spec's DAG is a plan. TASKS.md is reality. They will diverge — that's expected.

### CHANGELOG.md

Running log of what shipped, written for humans. Follows Keep a Changelog format. Generated from git history, grouped by Added / Changed / Fixed / Removed.

Updated at the end of each feature or at release time.

### PR Descriptions

Generated per pull request. Links changes back to the spec or PRD, explains WHY (not just what), flags risks, and suggests what reviewers should focus on.

### Architecture Decision Records (ADRs)

Written when you deviate from the spec, choose between meaningful alternatives, or make any decision that future-you will question.

Format: Context → Options Considered → Decision → Consequences.

The test: "Would a new engineer joining in 6 months ask 'why did we do it this way?'" If yes, write an ADR.

Lives at: `adr/` directory in the project root.

---

## Quality and Maintenance

Things break. Weird bugs surface. These documents capture the hard-won knowledge.

### TROUBLESHOOTING.md

A growing record of non-obvious problems and their solutions. Every entry follows the pattern: symptom (what you saw) → cause (what was wrong) → fix (what you did).

The symptom is the most important part — it's what people search for. Include exact error messages.

### Postmortems

Written after production incidents. Blameless. Timeline of events, root cause analysis (keep asking "why" until you hit a systemic cause), action items with owners and deadlines.

A postmortem without follow-through on action items is documentation theater.

Lives at: `postmortems/` directory, named `YYYY-MM-DD-short-title.md`.

---

## Closing the Loop

### Retrospectives

The hinge that turns a one-shot pipeline into an iterative loop.

After a phase ships, evaluate outcomes against the PRD's success metrics. What worked, what didn't, what surprised you. Recommendations feed back into updated planning documents for the next cycle.

```
Build → Launch → Observe → Retrospective → Updated Presearch/PRD → next cycle
```

---

## Complete Document Map

```
CONVENTIONS.md (set once, org-wide)
│
├── Project: my-app/
│   ├── docs/
│   │   ├── GENERAL-PRESEARCH.md
│   │   ├── PRD.md
│   │   ├── TECHNICAL-PRESEARCH.md
│   │   ├── SPEC.md
│   │   ├── RECONCILIATION.md    ← brownfield only
│   │   └── TASKS.md
│   ├── adr/
│   │   ├── ADR-0001-use-postgres.md
│   │   └── ADR-0002-switch-to-redis.md
│   ├── postmortems/
│   │   └── 2025-03-15-payment-outage.md
│   ├── CLAUDE.md
│   ├── CHANGELOG.md
│   ├── TROUBLESHOOTING.md
│   └── RETROSPECTIVE.md
```

---

## Skills Reference

Every document has a corresponding skill that can generate or update it.

| Skill | Trigger phrases | What it does |
|---|---|---|
| `general-presearch-generator` | "presearch", "what's out there", "competitive analysis" | Researches market, users, competitors |
| `prd-generator` | "write a PRD", "define the product" | Turns research into product requirements |
| `technical-presearch-generator` | "evaluate stack options", "what should we build with" | Evaluates implementation approaches |
| `spec-generator` | "write a spec", "system design", "how do we build this" | Translates requirements into engineering plan + task DAG |
| `reconciliation-generator` | "reconcile spec with codebase", "gap analysis", "audit the fork" | Maps spec to existing code (brownfield only) |
| `claude-md-generator` | "generate CLAUDE.md", "set up for Claude Code" | Creates AI onboarding doc from spec + repo |
| `conventions-generator` | "set up my conventions", "coding standards" | Codifies universal development standards |
| `tasks-generator` | "create task list", "what's left to do", "update tasks" | Hydrates spec's DAG into living tracker with workstreams |
| `changelog-generator` | "update changelog", "release notes" | Generates changelog from git history |
| `pr-description-generator` | "write a PR description", "describe this PR" | Context-rich PR descriptions |
| `adr-generator` | "write an ADR", "document this decision" | Captures architectural decisions |
| `troubleshooting-generator` | "add to troubleshooting", "document this fix" | Records non-obvious problem solutions |
| `postmortem-generator` | "write a postmortem", "incident report" | Blameless incident analysis |
| `retrospective-generator` | "let's do a retro", "plan next iteration" | Evaluates outcomes, feeds back into pipeline |

---

## Getting Started

**Quickstart — Greenfield (new project from scratch):**

1. Set up CONVENTIONS.md (once, reuse across all projects)
2. Run the general presearch skill with your idea
3. Feed the presearch into the PRD skill
4. Feed the PRD into the technical presearch skill
5. Feed everything into the spec skill (produces task DAG)
6. From the spec, generate in parallel:
   - CLAUDE.md (AI context) — run claude-md-generator
   - TASKS.md (execution DAG) — run tasks-generator
7. Scaffold the project, initialize git
8. Start building — pick up tasks from the ready queue, run parallel agents on independent workstreams

**Quickstart — Brownfield (fork, existing codebase, or building on top of prior work):**

1. Fork/clone the upstream repo
2. Run the pipeline (presearch → PRD → tech presearch → spec) or bring existing docs
3. **Audit the existing codebase** — map structure, stack, conventions, entry points
4. **Gap analysis** — classify every spec feature as EXISTS / PARTIAL / NEW / CONFLICTS
5. **Convention discovery** — identify existing patterns, decide adopt / evolve / replace for each
6. From the spec + audit, generate in parallel:
   - CLAUDE.md — informed by ACTUAL repo structure, not just the spec
   - TASKS.md — existing features = pre-satisfied dependencies, PARTIAL = modification tasks, CONFLICTS = removal + replacement pairs
7. Validate existing setup works (build, test, dev server)
8. Start building — same DAG-driven loop, but run existing tests after every change to prevent regressions

The brownfield path adds three steps greenfield doesn't need: codebase audit, gap analysis, and convention discovery. These prevent you from fighting the existing code instead of building on it.

**After launch:**

1. Run a retrospective
2. Update the PRD with learnings
3. Start the next cycle