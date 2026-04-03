# Pipeline Initialization Prompt

<!-- 
GREENFIELD setup (new project from scratch):
1. Create your project directory
2. Put your spec in docs/SPEC.md
3. Put your PRD in docs/PRD.md
4. Put your CONVENTIONS.md in docs/CONVENTIONS.md (template is fine)
5. Put your TECHNICAL_PRESEARCH.md in docs/TECHNICAL_PRESEARCH.md (if you have one)
6. cd into the project directory
7. Run claude
8. Paste everything inside the code fence below

BROWNFIELD setup (forking or building on top of existing code):
1. Fork/clone the upstream repo
2. Put your spec in docs/SPEC.md
3. Put your PRD in docs/PRD.md
4. Put your CONVENTIONS.md in docs/CONVENTIONS.md (template is fine)
5. Put your TECHNICAL_PRESEARCH.md in docs/TECHNICAL_PRESEARCH.md (if you have one)
6. cd into the project directory
7. Run claude
8. Paste everything inside the code fence below

Pipeline (greenfield):
  Read docs → Populate CONVENTIONS.md → Spec branches to CLAUDE.md + TASKS.md → git init → scaffold → build

Pipeline (brownfield):
  Read docs → Populate CONVENTIONS.md → Generate RECONCILIATION.md (spec + codebase) → branches to CLAUDE.md + TASKS.md → verify setup → build
-->

```
You are initializing a project using the AI-native development workflow. Follow these steps IN ORDER. Do not skip steps. Do not start coding until all foundation documents are ready.

## Step 1: Read all existing docs

Read these files and internalize the full project context:
- docs/PRD.md (product requirements — what we're building and why)
- docs/SPEC.md (engineering specification — how we're building it)
- docs/TECHNICAL_PRESEARCH.md (technical research — why these technology choices)
- docs/CONVENTIONS.md (coding standards — may be a template that needs populating)
- docs/CLAUDE.md (AI onboarding doc — may be empty)

After reading, confirm you understand:
- The product (what it does, who it's for)
- The architecture (key technical decisions and why)
- The build priority / critical path
- The timeline and constraints

## Step 2: Detect project type

Determine whether this is greenfield or brownfield by checking for existing code:

**Greenfield signals:** No source files, no package.json/pyproject.toml/go.mod, no existing application code, empty or near-empty repo.

**Brownfield signals:** Existing source code, existing dependencies, existing build system, the PRD/spec references a fork or upstream project, there's a git history with prior commits.

Report which mode you detected and why. Then follow the corresponding path below.

---

## GREENFIELD PATH (new project from scratch)

### Step 3G: Populate CONVENTIONS.md

If docs/CONVENTIONS.md is still an HTML-comment template (all content inside <!-- --> tags), convert it into a real conventions file:
- Turn each commented section into actual rules
- Use the conventions implied by the PRD/spec (e.g., TypeScript, conventional commits)
- Keep it under 100 lines, actionable, no fluff
- Write to docs/CONVENTIONS.md

If already populated, skip.

### Step 4G: Generate CLAUDE.md and TASKS.md (spec is the branching point)

The spec branches into two independent outputs. Generate BOTH. They don't depend on each other.

#### 4Ga: CLAUDE.md

Generate a complete CLAUDE.md for the project root using the PRD, spec, and technical presearch:

- Project: one sentence — what, who, stage
- Stack: specific technologies with versions that matter
- Repo Layout: planned directory structure from the spec
- Commands: table of dev commands (install, dev, build, test, lint, etc.)
- Code Conventions: key rules from CONVENTIONS.md + project-specific rules
- Architecture & Patterns: key decisions from the spec/technical presearch with reasoning
- Gotchas: non-obvious things from the spec
- Testing: strategy, where tests go, how to run
- Environment: env vars needed, local setup steps
- Do NOT: hard constraints and guardrails from the PRD (security, compliance, scope)

Write to CLAUDE.md in the project root. Keep it under 150 lines.

#### 4Gb: TASKS.md (dependency DAG)

DO NOT generate a flat linear task list. Generate a dependency DAG that enables parallel workstreams.

Process:
1. Read the spec's task DAG (or build priority from the PRD if incomplete)
2. Break each item into concrete tasks (roughly one PR each)
3. For each task, determine what MUST be complete before it can START
4. Compute layers: Layer N = tasks whose deepest dependency is in layer N-1
5. Within each layer, group into workstreams (vertical slices that minimize file conflicts)
6. Extract shared foundations (types, schemas, interfaces, configs) into Layer 0

After generating, report: critical path, max parallelism, conflict points.

Write to docs/TASKS.md.

### Step 5G: Initialize git

- git init
- Create .gitignore appropriate for the stack
- git add docs/ and CLAUDE.md
- Commit: "docs: initialize project with PRD, spec, CLAUDE.md, and task DAG"

### Step 6G: Scaffold the project

- Initialize the package manager (npm/pnpm init)
- Install core dependencies from the spec
- Create the directory structure matching the CLAUDE.md repo layout
- Set up TypeScript config, linter, formatter
- Create a minimal entry point that proves the stack works
- Run the dev server to verify it starts

Commit: "chore: scaffold project structure with core dependencies"

Then proceed to **Step 7: Begin parallel TDD build loop**.

---

## BROWNFIELD PATH (forking / building on existing code)

### Step 3B: Populate CONVENTIONS.md

If docs/CONVENTIONS.md is still a template, populate it. But first scan the existing codebase:
- Check git log for commit message patterns
- Check linter/formatter configs for code style
- Check existing code for naming patterns, import style, error handling

Start from the codebase's actual conventions, then layer on the spec's requirements. Where they conflict, note both and mark for ADR.

### Step 4B: Generate RECONCILIATION.md (the brownfield branching point)

In brownfield, the spec doesn't branch directly to CLAUDE.md and TASKS.md. It first collides with the existing codebase. RECONCILIATION.md captures that collision.

```
Spec ─┐
      ├→ RECONCILIATION.md ─┬→ CLAUDE.md
Codebase ┘                  └→ TASKS.md
```

This is a pipeline artifact, not a development log. CLAUDE.md and TASKS.md depend on it.

#### 4B-i: Structural audit

Explore the existing codebase systematically:
- Directory structure and organization pattern
- Package manifest — dependencies, scripts, versions
- Entry points — where does the app start? Routing structure?
- Build system — how is it built, tested, deployed?
- Config files (TypeScript, linter, formatter, CI)
- Existing tests — where, what framework, coverage?
- Database — what's used, schema location, migration system
- Auth — how authentication works currently

#### 4B-ii: Feature gap analysis

For EVERY feature in the spec, classify against the existing codebase:

| Status | Meaning | DAG impact |
|--------|---------|------------|
| **EXISTS** | Implemented, meets spec requirements | Pre-satisfied dependency — no task created |
| **PARTIAL** | Implemented but incomplete | Modification task ("extend X" not "build X") |
| **NEW** | Not present at all | Creation task (same as greenfield) |
| **CONFLICTS** | Present but contradicts spec approach | Removal + replacement task pair, ADR trigger |

Format as a table with columns: Feature | Status | Existing Code (file paths) | Gap | Effort

**Be rigorous about EXISTS.** "It looks similar" is not EXISTS. The test: "Could the existing implementation be used as-is by the rest of the spec's architecture?" If no, it's PARTIAL or CONFLICTS.

#### 4B-iii: Convention decisions

For each pattern found in the codebase, decide:
- **ADOPT** — existing convention is fine, follow it
- **EVOLVE** — gradually shift new code toward spec convention, don't rewrite existing
- **REPLACE** — spec explicitly requires different approach, write an ADR

#### 4B-iv: Dependency delta

Compare spec's required dependencies vs what's installed:
- Already installed (check version compatibility)
- Needs adding
- Needs removing (conflicts with spec approach)
- Needs upgrading

#### 4B-v: ADR triggers

List every finding that needs an Architecture Decision Record:
- Every CONFLICTS classification
- Every REPLACE convention decision
- Every dependency conflict
- Any fundamental architectural disagreement between spec and fork

#### 4B-vi: Write RECONCILIATION.md

Compile all findings into docs/RECONCILIATION.md with these sections:
- Codebase Summary (facts)
- Feature Gap Analysis (table)
- Convention Decisions (table)
- Dependency Delta (table)
- Pre-Satisfied Dependencies (list of EXISTS features for the DAG)
- ADR Triggers (checklist)
- Risks (brownfield-specific: hidden coupling, test gaps, undocumented behavior)
- Impact on CLAUDE.md (what should differ from a greenfield CLAUDE.md)
- Impact on TASKS.md (how the DAG changes: pre-satisfied deps, modification tasks, conflict pairs)

Record the commit SHA this was generated from.

### Step 5B: Generate CLAUDE.md and TASKS.md (reconciliation is the branching point)

Now generate both outputs from the RECONCILIATION.md, not directly from the spec.

#### 5Ba: CLAUDE.md

Same sections as greenfield, BUT informed by the reconciliation:
- **Repo Layout** — the ACTUAL directory structure, noting directories you'll add
- **Stack** — what's ACTUALLY installed, plus what you're adding
- **Commands** — EXISTING build/test/dev commands from package.json, plus new ones
- **Architecture & Patterns** — BOTH inherited architecture AND spec changes. Be clear about what's inherited vs new.
- **Gotchas** — include upstream quirks discovered during the audit
- **Do NOT** — include "Do NOT break existing [feature] while adding [new feature]" guardrails

Write to CLAUDE.md in the project root. Keep it under 150 lines.

#### 5Bb: TASKS.md (dependency DAG)

Same DAG structure as greenfield, BUT:

**EXISTS features are pre-satisfied dependencies.** Pull them from the reconciliation's "Pre-Satisfied Dependencies" section. Other tasks can depend on them. Don't create tasks for done work.

**PARTIAL features → modification tasks.** "Extend auth to support refresh tokens" not "Build auth system." Cheaper (S/M), depends on understanding existing code.

**CONFLICTS features → removal + replacement pairs.** Layer carefully:
- Layer N: Remove or isolate the conflicting code
- Layer N+1: Build the replacement

**The DAG may have a "Layer -1" — brownfield prep:**
- Fork cleanup, removing unused upstream features
- Adding missing configs the spec requires
- Creating docs/ directory, committing planning docs

Process:
1. Start from the reconciliation's gap analysis table
2. EXISTS → pre-satisfied, no tasks
3. PARTIAL → modification tasks
4. NEW → creation tasks (same as greenfield)
5. CONFLICTS → removal + replacement pairs
6. Compute layers, workstreams, critical path
7. Flag tasks that modify existing files (higher merge conflict risk)

After generating, report:
- % of spec already satisfied by existing code
- Critical path (accounting for pre-satisfied deps)
- Max parallelism
- High-conflict zones (existing files that multiple tasks touch)

Write to docs/TASKS.md.

### Step 6B: Verify git state

The repo should already have git history. Verify:
- git status — clean working tree?
- git log — confirm fork point
- Create a branch: `git checkout -b feat/chatbridge-init`
- git add docs/ and CLAUDE.md
- Commit: "docs: initialize pipeline with PRD, spec, reconciliation, CLAUDE.md, and task DAG"

Do NOT reinitialize git. Do NOT lose upstream history.

### Step 7B: Validate existing setup

Validate that the existing project works before modifying it:
- Install dependencies
- Run the existing build — does it succeed?
- Run existing tests — do they pass?
- Start the dev server — does it boot?
- If anything fails, fix it or document it in TROUBLESHOOTING.md before proceeding

If the spec requires additional tooling not in the upstream:
- Install and configure it
- Verify it works alongside existing setup
- Commit: "chore: add [tooling] for ChatBridge development"

Then proceed to **Step 8: Begin parallel TDD build loop**.

---

## Step 8: Begin parallel TDD build loop

(Both paths converge here.)

Start with the first layer from TASKS.md that has ready tasks. For the current layer:

1. Identify all ready tasks (dependencies satisfied)
2. If multiple tasks are ready and independent, work through them — noting which could be handed to parallel agents via worktrees
3. For each task, follow the TDD loop:
   a. Write a failing test that captures the acceptance criteria
   b. Write the minimum code to make the test pass
   c. Refactor if needed
   d. Commit with a conventional commit message
4. After completing a task:
   a. Mark it done in TASKS.md with the date
   b. Update "Ready to Start" — check if completing this task unblocked anything in the next layer
   c. Move to the next ready task
5. When all tasks in a layer are done, move to the next layer

Before writing any code for a task, re-read the relevant sections of the spec and PRD to make sure you're building what was specified.

**Brownfield caution:** When modifying existing files, run existing tests after every change to make sure you haven't broken upstream functionality. If you do break something, fix it before moving on — don't accumulate regressions.

### Parallel agent handoff

When multiple tasks in the same layer are ready and touch different files/areas, note:
"PARALLEL OPPORTUNITY: Tasks T04 and T05 are both ready and independent. T04 touches [files]. T05 touches [files]. These can be assigned to separate agents via worktrees."

**Brownfield parallel caution:** Tasks that modify the SAME existing files cannot safely parallelize even if they're in the same DAG layer. Flag these: "CONFLICT RISK: T04 and T06 both modify src/routes/chat.ts — run sequentially or merge carefully."

START NOW. Begin with Step 1 — read all the docs and confirm your understanding.
```
