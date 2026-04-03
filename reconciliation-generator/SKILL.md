---
name: reconciliation-generator
description: Generate a RECONCILIATION.md that maps a spec (written for greenfield) to an existing codebase (fork or brownfield). Use this skill when the user is building on top of a fork, existing project, or upstream repo and needs to bridge the gap between what the spec assumes and what the code actually does. Triggers include "reconcile the spec with the codebase", "map spec to fork", "what does the fork already have", "gap analysis", "audit the codebase against the spec", "reconciliation", or any indication the user needs to understand how an existing codebase relates to their spec. This is a BROWNFIELD-ONLY pipeline artifact that sits between the spec and the CLAUDE.md/TASKS.md branching point.
---

# Reconciliation Generator

Generate a RECONCILIATION.md that bridges the gap between a spec (the plan) and an existing codebase (the reality). This is the brownfield-specific artifact that replaces the spec as the branching point — CLAUDE.md and TASKS.md are derived from the reconciliation, not directly from the spec.

## When to use

- User is forking an existing project and building on top of it
- User has a spec written for greenfield but is applying it to an existing codebase
- User wants to understand what an existing codebase already provides vs what needs building
- User says "reconcile", "gap analysis", "what does the fork give us", "map spec to code"

## When NOT to use

- Greenfield projects — the spec branches directly to CLAUDE.md + TASKS.md
- Existing projects with no spec — use the claude-md-generator to infer from repo contents

## Position in the pipeline

**Greenfield:**
```
Spec ─┬→ CLAUDE.md
      └→ TASKS.md
```

**Brownfield:**
```
Spec + Existing Codebase → RECONCILIATION.md ─┬→ CLAUDE.md
                                               └→ TASKS.md
```

The reconciliation consumes two inputs:
1. The spec (what we plan to build)
2. The actual codebase (what already exists)

It produces a document that feeds both CLAUDE.md (so the AI agent knows the real repo, not the idealized spec) and TASKS.md (so the DAG reflects pre-satisfied dependencies and modification tasks instead of building everything from scratch).

## Inputs

Required:
- The spec (docs/SPEC.md)
- Access to the actual codebase (filesystem)

Helpful:
- The PRD (docs/PRD.md) — for understanding intent behind features
- The technical presearch (docs/TECHNICAL_PRESEARCH.md) — for understanding why certain tech was chosen
- Upstream documentation (README, docs, wiki) — for understanding the fork's original design intent

## Process

### 1. Structural audit

Explore the existing codebase. Produce a map of what's there:

- **Directory structure** — how the code is organized
- **Stack** — languages, frameworks, versions (from package manifests, lock files, configs)
- **Dependencies** — what's installed, what versions
- **Entry points** — where the app starts, routing structure
- **Build system** — scripts, CI config, Dockerfile
- **Test setup** — framework, location, coverage
- **Database** — what's used, schema location, migration system
- **Auth** — how authentication works currently
- **API surface** — existing routes/endpoints

This is fact-finding, not judgment. Just document what exists.

### 2. Feature gap analysis

For every feature, component, or requirement in the spec, classify:

| Status | Meaning | DAG impact |
|--------|---------|------------|
| **EXISTS** | Already implemented, meets spec requirements | Pre-satisfied dependency — no task needed |
| **PARTIAL** | Implemented but doesn't fully meet spec | Modification task (cheaper than building from scratch) |
| **NEW** | Not present in the codebase at all | Creation task (same as greenfield) |
| **CONFLICTS** | Exists but contradicts the spec's approach | Removal + replacement task pair, and likely an ADR |

For each entry, note:
- What the spec says
- What the codebase actually does (with file paths)
- The gap (what's missing or different)
- Effort estimate for closing the gap

**Be rigorous about EXISTS.** A feature that superficially matches the spec but has different data models, API shapes, or architectural patterns is PARTIAL or CONFLICTS, not EXISTS. Test your classification: "Could the existing implementation be used as-is by the rest of the spec's architecture?" If no, it's not EXISTS.

### 3. Convention discovery

The existing codebase has implicit conventions — patterns the original developers followed. Identify them:

- File/directory naming
- Component structure (if frontend)
- State management approach
- Import style (relative, aliases, barrel files)
- Error handling patterns
- API route structure
- Test organization and naming
- Commit message style (from git log)

For each convention, decide:

| Decision | When to use |
|----------|-------------|
| **ADOPT** | Existing convention is fine and doesn't conflict with the spec |
| **EVOLVE** | Gradually shift new code toward the spec's convention; don't rewrite existing code |
| **REPLACE** | The spec explicitly requires a different approach; write an ADR explaining why |

### 4. Dependency delta

Compare the spec's required dependencies against what's already installed:

- **Already installed** — note the version, check if it meets the spec's requirements
- **Needs adding** — new dependency the spec requires that the fork doesn't have
- **Needs removing** — dependency in the fork that conflicts with the spec's approach or is unused
- **Needs upgrading** — installed but wrong version
- **Conflicts** — fork uses library A, spec requires library B for the same purpose

### 5. Risk assessment

Brownfield-specific risks:

- **Hidden coupling** — fork code that looks independent but is tightly coupled (modifying A breaks B)
- **Undocumented behavior** — things the fork does that aren't obvious from reading the code
- **Test gaps** — areas of the fork with no test coverage that you'll be modifying
- **Upgrade debt** — outdated dependencies that could cause compatibility issues with new code
- **Data migration** — if the fork has a different data model, migrating existing data

### 6. ADR triggers

List every finding that warrants an Architecture Decision Record:

- Every CONFLICTS classification from the gap analysis
- Every REPLACE decision from convention discovery
- Every dependency conflict
- Any case where the spec's architecture fundamentally disagrees with the fork's approach

Don't write the ADRs here — just flag them. They get written as development progresses.

### 7. Generate the document

Structure:

```markdown
# RECONCILIATION.md

> Bridge between the spec (plan) and the existing codebase (reality).
> Generated from: [spec version/date] + [codebase at commit SHA]

## Codebase Summary
(Stack, structure, entry points, build system — facts only)

## Feature Gap Analysis
(Table: feature | status | existing code | gap | effort)

## Convention Decisions
(Table: area | existing convention | spec convention | decision: adopt/evolve/replace)

## Dependency Delta
(Table: package | fork version | spec requires | action)

## Pre-Satisfied Dependencies
(List of EXISTS features that the DAG can treat as already done)

## ADR Triggers
(List of decisions that need ADRs before or during implementation)

## Risks
(Brownfield-specific risks with mitigation)

## Impact on CLAUDE.md
(What CLAUDE.md should say differently because of this reconciliation)

## Impact on TASKS.md
(How the DAG changes: pre-satisfied deps, modification tasks, conflict pairs)
```

### 8. Quality checklist

- [ ] Every spec feature is classified (no gaps in the gap analysis)
- [ ] EXISTS classifications are verified (not just "it looks similar")
- [ ] File paths are included for every existing code reference
- [ ] Convention decisions include reasoning
- [ ] ADR triggers are specific enough to write ADRs from
- [ ] The "Impact on" sections give actionable guidance for CLAUDE.md and TASKS.md generation
- [ ] Commit SHA is recorded so you know what state of the codebase this was generated from

## Output

Write to docs/RECONCILIATION.md.

End your response by offering to generate CLAUDE.md and TASKS.md: "The reconciliation is complete. This feeds into two documents that can be generated in parallel:
1. **CLAUDE.md** — AI agent context, informed by the actual codebase (not just the spec)
2. **TASKS.md** — Execution DAG with pre-satisfied dependencies from existing code

Ready to generate either or both?"

## Staleness

The reconciliation can go stale as development progresses — you modify existing code, add features, resolve conflicts. It doesn't need constant updating like TASKS.md, but check it when:
- You discover something the audit missed
- You realize an EXISTS classification was wrong (it's actually PARTIAL or CONFLICTS)
- You find hidden coupling the risk assessment didn't catch

Update the relevant section and note the date.
