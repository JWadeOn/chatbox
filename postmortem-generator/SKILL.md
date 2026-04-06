---
name: postmortem-generator
description: Generate a postmortem document after a production incident or significant failure. Use this skill when the user says "write a postmortem", "incident report", "what went wrong", "post-incident review", "root cause analysis", or describes a production issue that needs to be documented for learning. Also trigger when the user says "we had an outage" or "let's do a retro on that incident". The goal is blameless learning, not finger-pointing.
---

# Postmortem Generator

Generate a structured, blameless postmortem that captures what happened, why, and what to do differently. The goal is organizational learning, not blame.

## When to use

- After a production incident or outage
- After a significant bug that affected users
- After a near-miss that could have been worse
- User says "write a postmortem", "incident report", "what went wrong"

## Core principle: blameless

Postmortems document system failures, not people failures. "The monitoring didn't catch it" not "John didn't check the dashboard." People make mistakes because systems allow them to — fix the system.

## Process

### 1. Gather the facts

Ask the user for:
- What happened (the user-visible impact)
- When it happened (timeline of events)
- How it was discovered (alert, user report, luck)
- What the root cause was
- How it was fixed
- Who was affected and how badly

### 2. Build the timeline

Chronological events with timestamps. This is the backbone of the postmortem. Include:
- When the issue started (or when the triggering change was deployed)
- When it was detected
- Key investigation steps
- When root cause was identified
- When the fix was applied
- When it was confirmed resolved

### 3. Find the real root cause

Keep asking "why" until you hit a systemic cause:
- "The server crashed" → why?
- "It ran out of memory" → why?
- "The query loaded all records instead of paginating" → why?
- "There was no limit on the query and no test for large datasets" → **this is the root cause**

The root cause should suggest a systemic fix, not "be more careful."

### 4. Write the postmortem

Structure:
- **Summary** — One paragraph: what, when, who affected, how long
- **Timeline** — Chronological events with timestamps
- **Impact** — Quantified: users affected, duration, data/revenue impact
- **Root Cause** — The systemic why, not the surface what
- **What Went Well** — Detection, response, communication, tooling
- **What Went Poorly** — Gaps in detection, response, documentation
- **Action Items** — Concrete, owned, deadlined (these are the whole point)
- **Lessons Learned** — Broader takeaways

### 5. Action items are the deliverable

Every postmortem must produce action items. Each one needs:
- A specific, actionable description
- An owner (a person, not a team)
- A deadline
- A way to verify it's done

Bad: "Improve monitoring"
Good: "Add alert for query execution time > 5s on the invoices endpoint — @alice — by 2025-02-15"

## Output

Write to `/mnt/user-data/outputs/postmortems/YYYY-MM-DD-short-title.md` or the project's postmortem directory.

After writing, remind the user to follow up on action items — a postmortem without follow-through is just documentation theater.