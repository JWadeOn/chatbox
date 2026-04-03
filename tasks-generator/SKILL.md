---
name: tasks-generator
description: Generate or update a TASKS.md file that tracks project work items as a dependency DAG with parallel workstreams. Use this skill when the user says "create a task list", "what's left to do", "update tasks", "break down the work", "track progress", "generate TASKS.md", or wants to turn a spec's task breakdown into a living, trackable work list. Also trigger when the user completes work and wants to update task status, or when they want to reprioritize or restructure their task list. This is the dynamic execution tracker that complements the spec's static plan.
---

# Tasks Generator

Generate and maintain a TASKS.md — the living task list that tracks what's been done, what's in progress, and what's next. Organized as a dependency DAG so parallel workstreams are explicit and agents can work concurrently on independent tasks.

## When to use

- User has a spec and wants to generate an initial task list
- User completed work and wants to mark tasks done
- User wants to reprioritize, add, or restructure tasks
- User says "what should I work on next"
- User wants a snapshot of project progress

## Relationship to the spec

The spec's task breakdown is a plan. TASKS.md is reality. They diverge — that's expected. When they diverge significantly, consider updating the spec (and writing an ADR if the change is architectural).

## Core concept: DAG-based task organization

Tasks are organized into **layers** by dependency depth, not chronological order. Within each layer, tasks have no dependencies on each other and CAN run in parallel. A task in layer N only depends on tasks in layers 0 through N-1.

This structure enables:
- Multiple Claude Code agents (via worktrees) working simultaneously on independent tasks
- Clear visibility into what's blocked vs what's ready to start
- Honest critical path identification

### Dependency rules

- Every task gets a short ID: `T01`, `T02`, etc.
- Dependencies are explicit: `← T01, T03` means "depends on T01 and T03"
- A task is **ready** when all its dependencies are done
- Tasks within the same layer have no dependencies on each other
- Cross-layer dependencies must point upward (to earlier layers only)

## Process

### Generating from a spec

1. Read the spec's task breakdown and/or the PRD's build priority
2. List every concrete work item (roughly one PR each)
3. For each task, identify what it ACTUALLY depends on — not what feels related, but what must be DONE before this task can START
4. Compute the dependency depth of each task (layer = max depth of dependencies + 1)
5. Group tasks into layers
6. Within each layer, identify workstreams (logical groupings that a single agent would handle end-to-end)
7. Map layers to project phases/deadlines from the PRD
8. Estimate effort (S = hours, M = a day, L = multiple days, XL = a week+)

### Identifying real parallelism

Ask for each pair of tasks in the same layer:
- Do they touch the same files? If yes, they may conflict — note it
- Do they share database tables? If yes, schema must be settled first (push schema to an earlier layer)
- Do they share API contracts? If yes, define the interface first (push interface to an earlier layer)

**Common pattern:** Extract shared interfaces/schemas/types into a foundation layer, then the implementations that use them can run in parallel.

### DAG visualization

Include an ASCII DAG at the top of TASKS.md showing the layer structure:

```
Layer 0: [T01] [T02] [T03]          ← foundation, all parallel
            \     |     /
Layer 1:   [T04] [T05]              ← can run in parallel
              \   /  \
Layer 2:     [T06]  [T07] [T08]     ← T06 waits for both; T07, T08 parallel
                \     |    /
Layer 3:        [T09] [T10]         ← integration + apps
```

### Updating status

When the user reports progress:
- Mark tasks done with date
- Check: did completing this task UNBLOCK any tasks in the next layer?
- Update "Ready to Start" section with newly unblocked tasks
- If multiple tasks are now ready, flag them as parallelizable
- If something is blocked by a non-task issue, move to Blocked with reason

### Workstream assignment

When running parallel agents, assign workstreams:
- Each workstream is a vertical slice through the DAG
- Workstreams should minimize file conflicts
- Label workstreams: `WS-A: Chat`, `WS-B: App Platform`, `WS-C: Apps`
- An agent picks up a workstream and works through its tasks top to bottom

## Format

```markdown
# TASKS.md

> Dependency DAG for parallel execution. Tasks in the same layer can run concurrently.
> Statuses: [ ] todo  [~] in progress  [x] done  [!] blocked  [-] cut

## DAG Overview

(ASCII graph showing layer dependencies)

## Ready to Start

(Tasks whose dependencies are ALL done — these can be picked up NOW, in parallel)

## Layer 0 — Foundation (no dependencies)

- [ ] T01: description (effort) [workstream] ← none
- [ ] T02: description (effort) [workstream] ← none

## Layer 1 — description (depends on Layer 0)

- [ ] T04: description (effort) [workstream] ← T01, T03
- [ ] T05: description (effort) [workstream] ← T01, T03

## Layer N — ...

## Blocked

(task, blocked by, what needs to happen)

## Cut / Deferred

(task, reason for cutting)

## Completed

(task, date completed)
```

## Quality checklist

- [ ] Every task has an explicit dependency list (even if `← none`)
- [ ] No circular dependencies
- [ ] Tasks in the same layer are truly independent (no file/schema conflicts)
- [ ] Shared interfaces are extracted to earlier layers
- [ ] Critical path is identifiable by following the longest chain
- [ ] "Ready to Start" section reflects current state
- [ ] Effort estimates are present
- [ ] Each task is roughly one PR's worth of work

## Output

Write the TASKS.md file. If in Claude.ai, save to `/mnt/user-data/outputs/TASKS.md`.

After generating, call out:
- The critical path (longest chain through the DAG)
- Maximum parallelism (how many agents could work simultaneously at peak)
- Any tasks that seem independent but might have hidden conflicts
