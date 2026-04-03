---
name: prd-generator
description: Generate a Product Requirements Document (PRD) from a presearch document, project description, or conversation context. Use this skill when the user says "write a PRD", "product requirements", "define what we're building", "create a PRD", or wants to go from research/idea to a structured product definition. Also trigger when a user has completed a presearch and wants to move to the next phase, or when they say "let's define the product" or "what should we build". This is the SECOND step in the presearch → PRD → spec pipeline.
---

# PRD Generator

Generate a complete Product Requirements Document that defines WHAT to build and WHY. The PRD is the decision document — it takes divergent research and converges on a product direction.

## When to use

- User has completed a presearch and wants to define the product
- User has a clear product idea and wants to formalize requirements
- User says "write a PRD", "define the product", "product requirements"
- User wants to align stakeholders on what to build

## Position in the pipeline

General Presearch → **PRD** → Technical Presearch → Spec → CLAUDE.md

PRD answers: "What are we building and why?"
It takes input from general presearch (evidence) and feeds into technical presearch (implementation research).

## Inputs

Accept any combination of:
- A presearch document (ideal — this provides the evidence base)
- A product idea or description
- User stories or feature lists the user has drafted
- Existing product docs, pitch decks, or design mockups
- Conversational description of what they want to build

If the user has a presearch doc, read it first. The presearch's recommendation, competitive landscape, and user research should directly inform the PRD.

## Process

### 1. Extract product decisions

If coming from a presearch, identify:
- Which problem from the research are we actually solving?
- Which user segment are we targeting first?
- Which existing solution's weaknesses are we exploiting?
- What technical approach does the research support?

If there's no presearch, interview the user. Batch questions into one round:
- What problem are you solving and for whom?
- How do target users solve this today?
- What's the must-have feature set for v1?
- What are you explicitly NOT building?
- How will you know if this is working? (success metrics)

### 2. Define scope boundaries

This is the most important part of the PRD. Scope creep kills projects. Be rigorous:
- **In scope:** Only what's needed for the stated goals. Push back if the user lists too many P0s.
- **Out of scope:** Explicitly list things that might seem related but aren't in v1. Include the reasoning — "Not building mobile app in v1 because research shows 90% of target users are desktop-first."

### 3. Write user stories with priorities

Every user story gets a priority:
- **P0 (Must have):** Product is unusable without this. Launch blockers only.
- **P1 (Should have):** Expected by users, needed soon after launch.
- **P2 (Nice to have):** Adds value but can wait.

If a user pushes for too many P0s, challenge them: "If everything is P0, nothing is. Which of these could you launch without and add in week 2?"

### 4. Define success metrics

Every PRD needs measurable goals. Push the user to be specific:
- Bad: "Users should find it easy to use"
- Good: "Task completion rate above 85% in usability testing"
- Bad: "Get a lot of users"
- Good: "500 active users within 60 days of launch"

### 5. Generate the PRD

Follow this structure:

- **Overview** — 2-3 sentences, what is this product
- **Problem** — Specific problem, evidence, current alternatives and their gaps
- **Goals & Success Metrics** — Measurable targets in a table
- **Target Users** — Primary and secondary personas, who we're NOT building for
- **User Stories** — Prioritized P0/P1/P2 with clear format
- **Scope** — In scope and out of scope (with reasoning)
- **User Flows** — Key happy paths described step by step
- **Requirements** — Functional requirements by feature area (behavior, not implementation)
- **Design Considerations** — UX principles, accessibility, branding
- **Dependencies & Constraints** — External systems, timeline, budget, team
- **Risks** — What could go wrong, likelihood, impact, mitigation
- **Open Questions** — Decisions still needed, who owns them
- **Timeline & Phases** — High-level milestones
- **Appendix** — Links to presearch, mockups, research

### 6. Quality checklist

Before delivering, verify:
- [ ] Every feature traces back to a user problem (no "wouldn't it be cool if")
- [ ] P0 list is ruthlessly small — only true launch blockers
- [ ] Out of scope is populated and reasoned
- [ ] Success metrics are specific and measurable
- [ ] No implementation details leaked in (no mention of specific databases, frameworks, APIs)
- [ ] A non-technical stakeholder could read this and understand what we're building
- [ ] Open questions have owners and deadlines

## Output

Write the PRD as a markdown file. If in Claude.ai, save to `/mnt/user-data/outputs/PRD.md`.

End your response by offering to proceed to the technical presearch phase: "When you're ready to evaluate technical options for implementation, I can help research and compare approaches next."

## Handoff to Technical Presearch

When the user is ready to move to technical presearch, they should have:
- The completed PRD (this output)
- Answers to the open questions (or decisions to defer them)
- Alignment from stakeholders (or at least from themselves if solo)

The technical-presearch-generator skill picks up from here, evaluating implementation options against the product requirements. After that, the spec generator turns chosen options into a committed engineering plan.