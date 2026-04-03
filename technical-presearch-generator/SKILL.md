---
name: technical-presearch-generator
description: Generate a technical presearch document that evaluates implementation options for a product. Use this skill when the user has a PRD or clear product requirements and wants to explore technical approaches before writing a spec. Triggers include "technical presearch", "tech research", "evaluate stack options", "what should we build this with", "compare frameworks", "technical feasibility", "architecture options", "build vs buy", or any indication the user wants to research and compare technical approaches before committing to an implementation plan. This is the THIRD step in the general presearch → PRD → technical presearch → spec → CLAUDE.md pipeline, sitting between the PRD and the spec.
---

# Technical Presearch Generator

Evaluate implementation options and produce evidence-based technical recommendations. This is the technical counterpart to general presearch — where general presearch explores the market and users, technical presearch explores how to build the thing.

## When to use

- User has a PRD and wants to evaluate technical options before writing a spec
- User wants to compare frameworks, databases, hosting options, or architectures
- User needs build-vs-buy analysis for specific components
- User says "what stack should I use", "compare these options", "technical feasibility"
- User has product requirements and wants to explore how to implement them

## Position in the pipeline

General Presearch → PRD → **Technical Presearch** → Spec → CLAUDE.md

Technical presearch answers: "What are our implementation options and which should we choose?"
It takes input from the PRD (requirements that constrain choices) and feeds into the spec (where choices become commitments).

## Why this exists separately from general presearch

General presearch is divergent exploration of a problem space — competitors, users, market. It informs WHAT to build. Technical presearch is focused evaluation of implementation options. It informs HOW to build. Mixing them creates a document that's too long, serves two audiences, and conflates product decisions with technical ones.

The split also matches how decisions flow: you shouldn't pick a database until you know your data model, and you don't know your data model until you know your features (PRD).

## Inputs

Accept any combination of:
- A PRD (ideal — provides the requirements that constrain technical choices)
- A general presearch doc (provides context on the domain)
- Specific technical questions ("should we use Postgres or MongoDB?")
- Team context (what the team already knows, existing infrastructure)
- Constraints (budget, timeline, compliance requirements)

If the user has a PRD, read it first. Extract every requirement that has technical implications: performance targets, scale expectations, data complexity, integration needs, security/compliance, team size.

## Process

### 1. Extract technical requirements from the PRD

Before evaluating any technology, be clear about what it needs to do. Pull from the PRD:
- Data model complexity (relational? hierarchical? graph-like?)
- Expected query patterns (read-heavy? write-heavy? complex joins? full-text search?)
- Scale expectations (10 users? 10,000? 10 million?)
- Performance targets (latency, throughput)
- Integration requirements (third-party APIs, auth providers, payment systems)
- Security and compliance (SOC2, GDPR, HIPAA, PCI)
- Team expertise (what does the team already know?)
- Timeline (how fast does this need to ship?)

### 2. Identify decision points

Not every technical choice needs deep research. Categorize:
- **Obvious choices:** Team already uses it, it clearly fits, no real alternatives. Document the choice, move on.
- **Needs evaluation:** Multiple viable options with meaningful tradeoffs. This is where research time goes.
- **Needs a proof of concept:** Can't evaluate without building something small. Flag it.

### 3. Research options

For each decision that needs evaluation, use web search to get current information:

**Architecture patterns:** Search for how similar products are built. Look at engineering blog posts, architecture case studies, and technical postmortems. What worked, what didn't, what would they do differently?

**Frameworks and libraries:** Check release dates, maintenance activity, GitHub stars/issues trends, breaking change history. A framework that was great 2 years ago might be abandoned now. Look at the "used by" or "dependents" count — ecosystem adoption matters.

**Services and APIs:** Check current pricing, uptime track record, API documentation quality, SDK support for the chosen language, migration/exit story. Search for "[service] outage" and "[service] migration away" to find the horror stories.

**Infrastructure:** Compare cost at current scale AND projected scale. A service that's cheap at launch might be expensive at 10x. Use pricing calculators where available.

### 4. Evaluate honestly

For each option, assess against the actual requirements — not abstract ideals:
- Does it solve the specific problems in the PRD?
- What's the operational burden? (The best technology you can't operate is the worst technology)
- What's the learning curve given the team's current skills?
- What's the vendor lock-in risk and exit cost?
- What's the community like? (Matters for debugging and hiring)

Be direct about tradeoffs. "X is better for our query patterns but Y has lower operational overhead and the team already knows it" is more useful than a feature comparison table.

### 5. Identify proof-of-concept needs

Some questions can't be answered by research alone. Flag things that need to be validated by building a small prototype:
- Performance under realistic data volumes
- API integration quirks that documentation doesn't cover
- Whether a library actually works for your specific use case
- Whether the team can be productive with an unfamiliar tool

For each POC: what you're testing, how long it should take, and what success looks like.

### 6. Generate the document

Structure:
- **Requirements Summary** — Technical requirements extracted from the PRD
- **Architecture Options** — Viable approaches with tradeoffs
- **Language & Framework Evaluation** — Candidate stacks compared against requirements
- **Database & Storage Options** — Data layer options
- **Third-Party Services & APIs** — External dependencies evaluated
- **Infrastructure & Deployment** — Hosting and CI/CD options
- **Build vs Buy Decisions** — For each component where both are viable
- **Proof of Concepts** — Things that need hands-on validation
- **Technical Risks** — Implementation-specific risks
- **Open Technical Questions** — Decisions needing more input
- **Recommendations** — Your recommended direction with confidence levels

### 7. Quality checklist

Before delivering, verify:
- [ ] Every recommendation traces back to a requirement from the PRD
- [ ] Tradeoffs are explicit, not hidden behind enthusiasm for a technology
- [ ] Team expertise is weighted appropriately (not ignored for the "best" tool)
- [ ] Cost is considered at current AND projected scale
- [ ] Vendor lock-in and exit strategies are addressed
- [ ] POC needs are identified with clear success criteria
- [ ] Confidence levels are honest (don't say "high" if you're guessing)
- [ ] The document is useful to someone who disagrees with your recommendations

## Output

Write the technical presearch as a markdown file. If in Claude.ai, save to `/mnt/user-data/outputs/TECHNICAL-PRESEARCH.md`.

End your response by offering to proceed to the spec phase: "When you're comfortable with the technical direction, I can turn these decisions into a full technical specification."

## Handoff to Spec

When the user is ready to move to the spec, they should have:
- The completed technical presearch (this output)
- Decisions on the key choices (or agreement to go with recommendations)
- POC results (if any were needed)

The spec generator skill picks up from here, turning chosen options into committed architecture.