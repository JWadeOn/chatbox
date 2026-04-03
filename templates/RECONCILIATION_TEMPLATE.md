# RECONCILIATION.md

> Bridge between the spec (plan) and the existing codebase (reality).
> Brownfield-only artifact. Feeds CLAUDE.md and TASKS.md generation.
> Generated from: [spec version/date] + [codebase at commit SHA]

## Codebase Summary

<!-- Facts only. What's here, not what should be here. -->

**Stack:**
**Structure:**
**Entry points:**
**Build system:**
**Test setup:**
**Database:**
**Auth:**

## Feature Gap Analysis

<!-- For every feature in the spec, classify its status in the existing codebase. -->

| Feature (from spec) | Status | Existing Code | Gap | Effort |
|---|---|---|---|---|
| feature name | EXISTS / PARTIAL / NEW / CONFLICTS | file paths or "—" | what's missing or different | S/M/L/XL |

### Status definitions:
- **EXISTS** — Implemented, meets spec requirements. Pre-satisfied dependency.
- **PARTIAL** — Implemented but incomplete. Modification task needed.
- **NEW** — Not present. Creation task needed (same as greenfield).
- **CONFLICTS** — Present but contradicts spec approach. Removal + replacement needed. ADR required.

## Convention Decisions

<!-- How existing patterns relate to the spec's conventions. -->

| Area | Existing Convention | Spec Convention | Decision | Reasoning |
|---|---|---|---|---|
| area | what the fork does | what the spec says | ADOPT / EVOLVE / REPLACE | why |

## Dependency Delta

| Package | Fork Version | Spec Requires | Action |
|---|---|---|---|
| package | version or "—" | version or "—" | keep / add / remove / upgrade |

## Pre-Satisfied Dependencies

<!-- EXISTS features the DAG can treat as done. Tasks can depend on these from Layer 0. -->

- feature — file paths — verified at commit SHA

## ADR Triggers

<!-- Decisions that need Architecture Decision Records. Don't write them here — flag them. -->

- [ ] ADR needed: description — triggered by: CONFLICTS/REPLACE finding

## Risks

<!-- Brownfield-specific risks. -->

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hidden coupling in X | | | |
| Test gap in Y | | | |

## Impact on CLAUDE.md

<!-- What should CLAUDE.md say differently because of this reconciliation? -->
<!-- e.g., "Repo Layout should describe actual structure, not spec's planned structure" -->

## Impact on TASKS.md

<!-- How should the DAG change? -->
<!-- e.g., "Auth is EXISTS → pre-satisfied. Chat UI is PARTIAL → modification task. Iframe embedding is CONFLICTS → removal + replacement pair." -->
