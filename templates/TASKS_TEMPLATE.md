# TASKS.md

> Dependency DAG for parallel execution. Tasks in the same layer can run concurrently.
> The spec has the static plan; this is the dynamic execution tracker.
> Statuses: [ ] todo  [~] in progress  [x] done  [!] blocked  [-] cut

## DAG Overview

<!-- ASCII dependency graph. Layers = rows. Tasks in the same row are parallel. -->
<!-- Arrows point downward (earlier layers feed later layers). -->

```
Layer 0: [T01] [T02] [T03]
            \    |    /
Layer 1:   [T04] [T05]
              \   /
Layer 2:     [T06]
```

## Workstreams

<!-- Vertical slices through the DAG that one agent can own end-to-end. -->
<!-- Workstreams should minimize file conflicts between concurrent agents. -->

| Workstream | Scope | Tasks |
|---|---|---|
| WS-A | description | T01, T04, T06, ... |
| WS-B | description | T02, T05, T07, ... |

## Ready to Start

<!-- Tasks whose dependencies are ALL done. These can be picked up NOW, in parallel. -->
<!-- Update this section every time a task completes. -->

- [ ] T01: description (effort) ← none
- [ ] T02: description (effort) ← none

## Layer 0 — Foundation (no dependencies, all parallel)

<!-- Infra, schemas, configs, scaffolding — things everything else depends on. -->

- [ ] T01: description (S/M/L) [WS-A] ← none
- [ ] T02: description (S/M/L) [WS-B] ← none
- [ ] T03: description (S/M/L) [WS-C] ← none

## Layer 1 — description

<!-- What this layer unlocks. What must be done in Layer 0 first. -->

- [ ] T04: description (S/M/L) [WS-A] ← T01, T03
- [ ] T05: description (S/M/L) [WS-B] ← T02, T03

## Layer 2 — description

- [ ] T06: description (S/M/L) [WS-A] ← T04, T05

<!-- Continue layers as needed... -->

## Blocked

<!-- Items that can't proceed due to non-task issues (external, unclear requirements, etc.) -->
<!-- Format: task | blocked by | what needs to happen | who owns unblocking -->

## Cut / Deferred

<!-- Things you decided not to do (yet). Include why — prevents re-litigating. -->

## Completed

<!-- Move items here when done. Include date. Check if completing this unblocked anything. -->
<!-- - [x] T01: description (S) [WS-A] — done 2025-04-02 -->
