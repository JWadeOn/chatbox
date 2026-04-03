---
name: retrospective-generator
description: Generate a retrospective document or kick off the next iteration cycle by synthesizing feedback, usage data, and lessons learned into updated planning docs. Use this skill when the user says "let's do a retro", "retrospective", "what did we learn", "plan the next iteration", "v2 planning", "what should we change", or wants to reflect on a completed phase and feed learnings back into the planning pipeline. Also trigger when the user says "what's next after launch" or "time to iterate". This skill closes the loop — it takes post-launch learnings and feeds them back into presearch or PRD for the next cycle.
---

# Retrospective Generator

Generate a retrospective that captures what was learned from a completed phase, and optionally feed those learnings back into the planning pipeline for the next iteration. This closes the development loop.

## When to use

- User completed a phase or launch and wants to reflect
- User has feedback, usage data, or observations to process
- User wants to plan the next iteration based on what they learned
- User says "retro", "retrospective", "what's next", "time for v2"

## Position in the lifecycle

The planning pipeline is linear: General Presearch → PRD → Technical Presearch → Spec → CLAUDE.md

But development is a loop. After building and launching, learnings feed back into the pipeline:

**Build → Launch → Observe → Retrospective → Updated Presearch/PRD → next cycle**

This skill is the hinge that turns a one-shot pipeline into an iterative loop.

## Process

### 1. Gather inputs

Ask for whatever the user has:
- User feedback (support tickets, interviews, reviews, NPS)
- Usage data (analytics, feature adoption, error rates)
- Team observations (what was hard, what was easy, what surprised them)
- Performance data (uptime, latency, costs)
- Competitive changes (did the market shift?)
- Original goals vs actual outcomes (from the PRD's success metrics)

### 2. Evaluate against original goals

Pull the success metrics from the PRD. For each:
- What was the target?
- What actually happened?
- Why the gap (if any)?

This is the most important section — it grounds the retrospective in measurable outcomes, not feelings.

### 3. Generate the retrospective

Structure:

```markdown
# Retrospective: [Phase/Version Name]

## Goals vs Outcomes
| Metric | Target | Actual | Assessment |
|--------|--------|--------|------------|

## What Worked
<!-- Things to keep doing, double down on. -->

## What Didn't Work
<!-- Things to stop or change. No blame — focus on systems and processes. -->

## Surprises
<!-- Things nobody predicted. User behavior, technical discoveries, market shifts. -->

## Key Learnings
<!-- The insights that should change how you think about the product or build process. -->

## Recommendations for Next Iteration
<!-- Specific, actionable changes. Categorized: -->
<!-- - Product changes (feed into updated PRD) -->
<!-- - Technical changes (feed into updated spec) -->
<!-- - Process changes (feed into updated CONVENTIONS.md) -->
<!-- - Things to research further (feed into new presearch) -->
```

### 4. Feed back into the pipeline

Based on the retrospective, offer to:
- **Update the PRD** if product direction needs to change (new features, reprioritized scope)
- **Write a new presearch** if entering unfamiliar territory (new market, new user segment)
- **Write a new technical presearch** if technical approach needs rethinking
- **Update the spec** if architecture needs adjustment
- **Write ADRs** for any decisions that came out of the retro
- **Update TASKS.md** with the next phase's work

The user doesn't have to do all of these — surface the ones that are relevant.

### 5. Quality standards

- Ground everything in evidence, not opinion
- Be honest about failures — the whole point is learning
- Recommendations should be specific enough to act on
- Clearly separate "things to do now" from "things to research"
- Don't relitigate past decisions unless the evidence clearly says they were wrong

## Output

Write the retrospective to `/mnt/user-data/outputs/RETROSPECTIVE.md` or a dated file in the project.

End by offering to update specific pipeline documents based on the findings.