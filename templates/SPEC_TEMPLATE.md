# Spec: [Project Name]

> Technical Specification. Defines HOW we're building it.
> Derived from the PRD. This is the engineering blueprint.
> If someone can't build from this doc + the codebase, the spec is incomplete.

## Overview

<!-- 2-3 sentences. What are we building technically? Reference the PRD for product context. -->

## Tech Stack

<!-- Every technology choice with version and brief justification. -->
<!-- Example: Python 3.12 — team expertise, async support, ecosystem -->
<!-- Example: PostgreSQL 16 — relational data, JSONB for flexible fields, mature tooling -->

| Layer        | Technology   | Version | Why |
| ------------ | ------------ | ------- | --- |
| Language     |              |         |     |
| Framework    |              |         |     |
| Database     |              |         |     |
| Cache        |              |         |     |
| Queue        |              |         |     |
| Auth         |              |         |     |
| Hosting      |              |         |     |
| CI/CD        |              |         |     |
| Monitoring   |              |         |     |

## Architecture

<!-- High-level system design. Describe the major components and how they interact. -->
<!-- Include a diagram if the system has more than 3 components. -->
<!-- Call out: synchronous vs async boundaries, data flow direction, trust boundaries -->

## Data Model

<!-- Tables/collections, key fields, relationships, indexes. -->
<!-- Be explicit about: primary keys, foreign keys, soft deletes, audit fields, multi-tenancy keys -->
<!-- For each entity: what creates it, what reads it, what updates it, what deletes it -->

## API Design

<!-- Endpoints, methods, request/response shapes, auth requirements. -->
<!-- Group by resource or feature area. -->
<!-- Include error response format. -->

### Conventions
<!-- Base URL, versioning strategy, pagination, filtering, sorting -->
<!-- Auth header format, rate limiting -->

### Endpoints
<!-- For each endpoint: method, path, description, request body, response shape, auth level -->

## Authentication & Authorization

<!-- How users authenticate. How permissions are checked. -->
<!-- Token format, session management, role definitions, permission model -->

## Infrastructure & Deployment

<!-- Where it runs, how it's deployed, how it scales. -->
<!-- Environments: local → staging → production -->
<!-- Deploy process: PR → merge → CI → deploy (manual or auto?) -->

## Error Handling

<!-- Strategy for errors at each layer. -->
<!-- How are errors surfaced to users? How are they logged? How are they alerted? -->
<!-- Standard error response envelope. Retry policies. Circuit breaker patterns. -->

## Performance Requirements

<!-- Latency targets, throughput targets, resource constraints. -->
<!-- Informed by PRD success metrics. -->

| Operation       | Target Latency | Target Throughput |
| --------------- | -------------- | ----------------- |
|                 |                |                   |

## Security Considerations

<!-- Input validation, output encoding, secrets management, data encryption -->
<!-- OWASP top 10 relevance, compliance requirements (SOC2, GDPR, etc.) -->

## Testing Strategy

<!-- What gets tested, how, and where. -->
<!-- Unit tests: what they cover, mocking strategy -->
<!-- Integration tests: what they cover, test database approach -->
<!-- E2E tests: if applicable, tooling and scope -->
<!-- Performance/load tests: if applicable -->

## Migration & Rollback

<!-- How do we get from current state to new state? -->
<!-- Database migrations: strategy, zero-downtime approach -->
<!-- Feature flags: which features are gated? -->
<!-- Rollback plan: what happens if we need to revert? -->

## Observability

<!-- Logging: what, where, format, retention -->
<!-- Metrics: what do we track, dashboards -->
<!-- Alerting: what triggers alerts, who gets paged -->
<!-- Tracing: distributed tracing approach (if applicable) -->

## Technical Risks

<!-- What's hard or uncertain? For each: what makes it risky, mitigation, fallback plan -->

## Open Technical Questions

<!-- Decisions still needed from engineering. Owner and deadline for each. -->

## Task Breakdown

<!-- Ordered list of implementation tasks. This becomes the work plan. -->
<!-- For each: description, estimated effort, dependencies, assignee (if known) -->

### Phase 1
- [ ] 

### Phase 2
- [ ] 

## Appendix

<!-- Link to PRD, architecture diagrams, API docs, relevant RFCs -->