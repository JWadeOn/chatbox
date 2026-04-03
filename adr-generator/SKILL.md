---
name: adr-generator
description: Generate an Architecture Decision Record (ADR) to capture why a significant technical decision was made. Use this skill when the user says "write an ADR", "document this decision", "we're deviating from the spec", "why did we choose X over Y", "architecture decision record", or when a meaningful technical choice is being made or has been made that future developers should understand. Also trigger when the user is debating between options and wants the analysis structured, or when they say "let's capture this decision" or "we need to document why we switched to X".
---

# ADR Generator

Generate Architecture Decision Records — structured documents that capture WHY significant technical decisions were made. ADRs prevent future developers (human or AI) from undoing past decisions without understanding the reasoning.

## When to use

- User makes a technical decision that deviates from the spec
- User chooses between meaningful alternatives
- User makes a decision that future-them will question
- User says "why did we pick X" and the answer isn't documented
- User is debating options and wants the analysis structured

## When NOT to use

- Trivial decisions ("should this variable be named X or Y")
- Decisions that are standard practice and need no justification
- Decisions already captured in the spec (unless you're changing them)

## The test

"Would a new engineer joining in 6 months ask 'why did we do it this way?'" If yes, write an ADR.

## Process

### 1. Capture the decision context

Understand:
- What situation prompted this decision?
- What were the constraints?
- What did the spec originally say (if relevant)?
- What options were on the table?
- Who was involved in the decision?

### 2. Evaluate options fairly

For each option considered:
- What it is (1-2 sentences)
- Key advantages given the current context
- Key disadvantages or risks
- Why it was or wasn't chosen

Be fair to rejected options. "We didn't choose X because Y" is more useful than "X was bad." A rejected option might become the right choice later when constraints change.

### 3. Write the ADR

Structure:
- **Status:** Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
- **Date:** When the decision was made
- **Context:** The situation and constraints
- **Options Considered:** Fair evaluation of each
- **Decision:** What was chosen and the reasoning
- **Consequences:** What changes, what gets easier, what gets harder

### 4. Numbering and naming

ADRs are numbered sequentially: ADR-0001, ADR-0002, etc.
File name includes a short slug: `ADR-0001-use-postgres-over-mongodb.md`

If you have access to the project's `adr/` directory, check the last number and increment. If no directory exists, suggest creating one.

### 5. Quality standards

- The "Context" section should be understandable without reading other docs
- "Options Considered" should be fair enough that someone who disagreed with the decision would still find it accurate
- "Decision" should be unambiguous — a reader should know exactly what was decided
- "Consequences" should include what needs to be updated (spec, CLAUDE.md, etc.)
- Keep each ADR to one decision. If you made two related decisions, write two ADRs.

## Output

Write to `/mnt/user-data/outputs/adr/ADR-NNNN-short-title.md` or the project's ADR directory.

After writing, remind the user: "You may want to update CLAUDE.md and/or the spec to reflect this decision."