# Architecture

This document records the architectural constraints that apply to DevPulse and the
process by which technical decisions are made. It does not describe application
features, because none have been defined.

## Current State

DevPulse has no application code. The repository contains standards, documentation, and
directory placeholders only. The following are all undecided:

- Language and runtime for the backend.
- Framework and build tooling for the frontend.
- Data stores, messaging, and external services.
- Deployment target and hosting model.
- Testing, linting, and formatting tools.

These decisions are made through the process in this document, not by assuming a
default from similar projects.

## Repository Layout

| Path | Responsibility | State |
| --- | --- | --- |
| `backend/` | Server-side application code and its tests | Empty |
| `frontend/` | Client-side application code and its tests | Empty |
| `infrastructure/` | Infrastructure as code and operational configuration | Empty |
| `docs/` | Architecture decisions and development documentation | Active |
| `.github/` | Issue forms, pull request template, CI/CD workflows | Partially active |

Constraint: each area is self-contained. Code is placed in the area that owns the
responsibility, and a change touching multiple areas is split into separate pull
requests unless the coupling is explicitly accepted in a decision record.

## Architectural Constraints

These constraints hold regardless of the stack that is chosen.

- **Explicit dependencies.** Every dependency is declared explicitly and justified.
  Implicit or transitive reliance is not acceptable.
- **Standard library first.** A new library is added only when it solves a problem the
  standard library cannot, and only after approval.
- **Layered separation.** Dependency direction flows one way. Presentation and
  interface layers depend on domain logic; domain logic never depends on interface
  concerns or on infrastructure. The concrete layer mapping is decided with the stack.
- **Testable boundaries.** Behaviour is separated from infrastructure so that it can be
  tested without a network, a clock, or an external service. Where a boundary cannot be
  avoided, the coupling is documented in a decision record.
- **Configuration over constants.** Environment-specific values are externalised
  through configuration, never hardcoded.
- **Secrets are never in the repository.** Secrets are supplied at runtime through
  environment variables or a secret manager. Only placeholder values are committed.
- **Reproducibility.** A given commit must produce the same result on every machine and
  in CI. Versions are pinned.
- **Observability is designed, not added later.** Logging, error reporting, and health
  signals are part of the design of each service.

## Decision Records

Technical decisions are recorded here, not in issue comments. Each decision is a new
file under `docs/decisions/`, numbered sequentially:

```
docs/decisions/0001-record-architecture-decisions.md
```

A decision record contains:

1. **Context** — the forces and constraints that make a decision necessary.
2. **Decision** — what is being decided, stated in the active voice.
3. **Alternatives considered** — including the option of doing nothing, and why each
   was rejected.
4. **Consequences** — what becomes easier, harder, or newly constrained.
5. **Status** — `proposed`, `accepted`, `deprecated`, or `superseded by <record>`.

Rules:

- A record starts as `proposed` and is merged only when the change it describes is
  merged. A decision is not recorded as accepted before it is implemented.
- Reversing an accepted decision requires a new record that supersedes it. Records are
  never deleted.
- A decision that would require a new dependency, a public interface, or a change to
  the repository layout needs a review of the whole record, not just a summary.

## Architectural Review

A pull request is subject to architectural review when it:

- Introduces or changes a public interface or data contract.
- Changes the repository layout or module boundaries.
- Adds a dependency, or removes one.
- Introduces state, caching, concurrency, or background work.
- Changes the build, packaging, or deployment model.

Reviewers of such a change are expected to confirm that the decision is recorded, that
alternatives were considered, and that the consequences are stated honestly.

## Open Questions

| Question | Notes |
| --- | --- |
| What is the problem DevPulse solves? | No product definition exists yet |
| Which runtimes and frameworks? | Blocked on the product definition |
| Deployment target? | Blocked on the stack decision |
| Testing and coverage strategy? | Tool-independent expectations are defined in [CONTRIBUTING.md](CONTRIBUTING.md); tools pending the stack decision |

These questions are open by design. They are listed here so that no decision is made
silently.
