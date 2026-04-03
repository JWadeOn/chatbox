GENERAL PRESEARCH -> PRD -> TECHNICAL PRESEARCH -> Spec -> CLAUDE.md

Presearch: answers "What's out there and what's possble?"

PRD: (Product Requirements Document) answers "What are we building and why?"
+ input: take the raw findings from presearch and converge on a product direction
+ output: align stakeholders(engineering, design, business, whoever needs to agree on what success looks like)
defines:
1. problem you're solving
2. who you're solving it for
3. what the product does at the feature level
4. success metrics
5. scope boundaries (explicitly what's OUT)
6. user stories or jobs to be done
7. priority/phasing


Spec (Technical Specification) answers: "How exactly are we building it?"
The spec translates the PRD into an engineering blueprint. This is where you choose the stack, define the data model, design the API surface, plan the architecture, and identify technical risks.

A spec covers: tech tack and justifications, system architecture, data models and schemas, API contracts, infrastructure and deployment, security considerations, error handling strategy, performance requirements, and migration/rollback plans.

The order matters: 
Presearch defines the evidence for the PRD
PRD defines the agreed upon solution that aligns with all stakeholders
SPEC transforms PRD into the engineering blueprint