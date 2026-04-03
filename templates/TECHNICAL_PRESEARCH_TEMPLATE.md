# Technical Presearch: [Project Name]

> Technical exploration phase. Evaluate implementation options AFTER the product direction is set.
> Input: a PRD (or at minimum, clear product requirements).
> Output: evidence-based technical recommendations that feed into the spec.

## Requirements Summary

<!-- Pull from the PRD: what does the system need to do technically? -->
<!-- Performance targets, scale expectations, integration needs, compliance constraints -->
<!-- This section grounds every evaluation below — no tech choice matters without context. -->

## Architecture Options

<!-- For each viable architectural approach: -->
<!-- - Description (1-2 sentences) -->
<!-- - What it handles well given our requirements -->
<!-- - Where it struggles or adds complexity -->
<!-- - Operational cost and complexity -->
<!-- - Example: "Monolith vs microservices vs modular monolith" -->
<!-- - Example: "Server-rendered vs SPA vs hybrid" -->
<!-- - Example: "REST vs GraphQL vs tRPC" -->

## Language & Framework Evaluation

<!-- For each candidate stack: -->
<!-- - What it is (language + framework + version) -->
<!-- - Team familiarity (critical — don't ignore this) -->
<!-- - Ecosystem maturity for our use case -->
<!-- - Performance characteristics relevant to our requirements -->
<!-- - Hiring pool / community size -->
<!-- - Tradeoffs and risks -->

## Database & Storage Options

<!-- For each candidate: -->
<!-- - Type (relational, document, key-value, graph, time-series) -->
<!-- - How it handles our data model and query patterns -->
<!-- - Scale characteristics -->
<!-- - Operational complexity (managed vs self-hosted, backup, migration tooling) -->
<!-- - Cost model -->

## Third-Party Services & APIs

<!-- For each external dependency the product requires: -->
<!-- - What it does (auth, payments, email, search, etc.) -->
<!-- - Options evaluated (e.g., Stripe vs Paddle vs LemonSqueezy for payments) -->
<!-- - Pricing model and projected cost at our scale -->
<!-- - API quality, documentation, SDK support -->
<!-- - Vendor lock-in risk -->
<!-- - What happens if this service goes down? -->

## Infrastructure & Deployment

<!-- Hosting options (cloud provider, PaaS, serverless, self-hosted) -->
<!-- CI/CD approach -->
<!-- Environment strategy (local, staging, production) -->
<!-- Cost projections at launch and at 10x scale -->

## Build vs Buy Decisions

<!-- For each component where both options exist: -->
<!-- - What we'd build: effort, maintenance burden, full control -->
<!-- - What we'd buy/use: cost, integration effort, dependency risk -->
<!-- - Recommendation with reasoning -->

## Proof of Concepts

<!-- Things that need to be validated before committing. -->
<!-- For each: what are we testing, how, what's the success criteria, how long will it take -->
<!-- Example: "Can we get sub-200ms search on 500k records with Postgres full-text?" -->
<!-- Example: "Does the Stripe Connect onboarding flow work for our multi-tenant model?" -->

## Technical Risks

<!-- Risks specific to implementation. For each: -->
<!-- - What could go wrong -->
<!-- - Likelihood (low/medium/high) -->
<!-- - Impact (low/medium/high) -->
<!-- - Mitigation or fallback -->

## Open Technical Questions

<!-- Decisions that need more information or team input. -->
<!-- For each: the question, who can answer it, deadline -->

## Recommendations

<!-- Your recommended technical direction. For each major decision: -->
<!-- - The choice and why -->
<!-- - What you're trading off -->
<!-- - Confidence level (high / medium / low — be honest) -->
<!-- This feeds directly into the spec. -->