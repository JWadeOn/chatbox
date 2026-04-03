---
name: general-presearch-generator
description: Generate a general presearch document for a new project idea — covering market landscape, competitors, user pain points, and business context. Use this skill when the user wants to explore a problem space before committing to building something. Triggers include "general presearch", "presearch", "research phase", "explore the landscape", "what's out there", "competitive analysis", "market research for my idea", "before I build this", "who are the competitors", or any indication the user wants to investigate the market, users, or competitive landscape before writing a PRD. This is the FIRST step in the general presearch → PRD → technical presearch → spec → CLAUDE.md pipeline. Do NOT use for technical stack evaluation or architecture research — that's technical presearch, which comes after the PRD.
---

# General Presearch Generator

Generate a thorough general presearch document that surveys the market, competitive, and user landscape around a project idea. This is divergent research — the goal is evidence gathering about the problem space, not technical evaluation or decision making.

## When to use

- User has a project idea and wants to explore the market before committing
- User wants competitive analysis, user research, or market context
- User says anything like "before I build this, I want to understand what's out there"
- User explicitly asks for a presearch or general presearch document

## When NOT to use

- User wants to evaluate technical options (frameworks, databases, APIs) → use technical-presearch-generator
- User already knows what to build and wants to plan the implementation → use spec-generator

## Position in the pipeline

**General Presearch** → PRD → Technical Presearch → Spec → CLAUDE.md

General presearch answers: "What's out there, who needs this, and is it worth building?"
Its output feeds into the PRD, which answers: "What are we building and why?"

## Inputs

Accept any of:
- A rough project idea (even a single sentence is fine)
- A problem statement
- A domain or market the user wants to explore
- Existing notes, bookmarks, or research the user has already done

## Process

### 1. Understand the idea

Get clear on what the user is investigating. You need enough to search effectively. At minimum:
- What problem or opportunity are they exploring?
- Who would use this / who has this problem?
- Any specific technologies or approaches they're already considering?

If the user gives you a single sentence like "I want to build a better invoicing tool," that's enough to start. Don't over-interview — you can always come back with follow-up questions after initial research.

### 2. Research

Use web search aggressively. This is the one phase where more information is better. Research in this order:

**Existing solutions:** Search for competitors and alternatives. For each, find what they do well, where they fall short, who they target, and how they price. Look at product pages, review sites, comparison articles, and user complaints on forums.

**User pain points:** Search for real users talking about the problem. Reddit, Hacker News, Stack Overflow, Twitter/X, niche forums. What language do they use? What specifically frustrates them? How are they cobbling together solutions today?

**Technical landscape:** What APIs, libraries, frameworks, and platforms are relevant? What's mature and battle-tested? What's new and promising? What are the technical constraints?

**Market context:** Market size estimates (if available), trends, regulatory considerations, timing factors. Why would now be the right time?

### 3. Synthesize

Organize findings into the presearch document structure. The key sections:

- **Problem Space** — The pain, who feels it, evidence it's real
- **Existing Solutions** — Competitor analysis with honest pros/cons
- **User Research** — Real voices from real users (paraphrased, with sources)
- **Technical Landscape** — What's available to build with, tradeoffs
- **Market & Business Context** — Size, trends, timing
- **Risks & Unknowns** — What could kill this, categorized by type
- **Open Questions** — What still needs answers before committing
- **Recommendation** — Where does the evidence point? 3-5 sentences.

### 4. Quality standards

- Cite sources. Every claim about a competitor, market size, or user pain should be traceable.
- Be honest about gaps. If you couldn't find good data on something, say so.
- Include negative signals. If the research suggests this might not be worth building, say that too.
- Keep the recommendation section balanced — present the evidence and let the user decide.
- The "Open Questions" section is critical. These are the things the user needs to resolve before writing a PRD.

## Output

Write the presearch as a markdown file. If in Claude.ai, save to `/mnt/user-data/outputs/GENERAL-PRESEARCH.md`.

End your response by offering to proceed to the PRD phase: "When you're ready to turn this research into a product requirements document, I can help with that next."

## Handoff to PRD

When the user is ready to move to the PRD, they should have:
- The completed general presearch doc (this output)
- Answers to the open questions (or decisions to defer them)
- A clear direction from the recommendation section

The PRD generator skill picks up from here. After the PRD is done, technical presearch evaluates implementation options before the spec.