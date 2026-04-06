---
name: tasks-generator
description: Generate or update a TASKS.md file that tracks project work items. Use this skill when the user says "create a task list", "what's left to do", "update tasks", "break down the work", "track progress", "generate TASKS.md", or wants to turn a spec's task breakdown into a living, trackable work list. Also trigger when the user completes work and wants to update task status, or when they want to reprioritize or restructure their task list. This is the dynamic execution tracker that complements the spec's static plan.
---

# Tasks Generator

Generate and maintain a TASKS.md — the living task list that tracks what's been done, what's in progress, and what's next. Derived from the spec's task breakdown but updated as work progresses.

## When to use

- User has a spec and wants to generate an initial task list
- User completed work and wants to mark tasks done
- User wants to reprioritize, add, or restructure tasks
- User says "what should I work on next"
- User wants a snapshot of project progress

## Relationship to the spec

The spec's task breakdown is a plan. TASKS.md is reality. They diverge — that's expected. When they diverge significantly, consider updating the spec (and writing an ADR if the change is architectural).

## Process

### Generating from a spec

1. Read the spec's task breakdown section
2. Break high-level tasks into actionable work items (one PR's worth of work each)
3. Identify dependencies between tasks
4. Estimate effort (S = hours, M = a day, L = multiple days, XL = a week+)
5. Organize by phase, with Phase 1 broken down in detail and later phases kept high-level
6. Set the "Current Sprint / Focus" to the first 1-3 tasks with no blockers

### Updating status

When the user reports progress:
- Mark tasks ✅ done and move to the Completed section with a date
- Mark new tasks 🔵 in progress
- Update the "Current Sprint / Focus" section
- If something is blocked, move to Blocked with the reason and unblock owner
- If something is cut, move to Cut/Deferred with the reason

### Suggesting next tasks

When asked "what's next":
- Look at what's done and what that unblocks
- Consider dependencies — don't suggest tasks whose prerequisites aren't done
- Prioritize the critical path (tasks that block other tasks)
- If multiple tasks are unblocked, suggest the highest-impact one

### Status markers

- 🔲 todo — not started
- 🔵 in progress — actively being worked on
- ✅ done — completed
- ⛔ blocked — can't proceed (include why)
- 🚫 cut — decided not to do (include why)

### Quality standards

- Each task should be one PR's worth of work
- Tasks that are too big ("Build the API") need decomposing
- Tasks that are too small ("Add a comma") should be grouped
- Dependencies should be explicit — [depends on: task name]
- The "Current Sprint / Focus" section should never have more than 3 items
- Completed section keeps a record — don't delete history

## Output

Write to `/mnt/user-data/outputs/TASKS.md` or update the existing one.