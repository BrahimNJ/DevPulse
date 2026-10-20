# Architecture

This document records the architectural constraints that apply to DevPulse and the
process by which technical decisions are made. Features are specified in issues; this
document only records the structure they fit into.

## Current State

DevPulse is a command-line tool that analyses public GitHub repositories. Its first
feature reports branch statistics (#12). The repository also contains standards,
documentation, quality tooling, CI/CD, and agent configuration.

Decided, see [decision records](decisions/):

- TypeScript in strict mode on Node.js 24 LTS, with npm (ADR 0002).
- Linting, formatting, and commit validation tools (ADR 0002).
- Shared Claude Code configuration (ADR 0003).
- Release automation with release-please (ADR 0004).
- Command-line interface, `src/` layout, native TypeScript execution, `node:test`,
  GitHub GraphQL and REST through `fetch` (ADR 0005).

Undecided:

- Application framework, for any server or client component.
- Data stores, messaging, and external services.
- Hosting model beyond local deployment, which is proposed in ADR 0004.

These decisions are made through the process in this document, not by assuming a
default from similar projects.

## Repository Layout

| Path       | Responsibility                                            |
| ---------- | --------------------------------------------------------- |
| `src/`     | Application code, layered as described in ADR 0005        |
| `docs/`    | Architecture decisions and development documentation      |
| `.github/` | Workflows, Dependabot, issue forms, pull request template |
| `.claude/` | Shared Claude Code settings, hooks, subagents, skills     |
| `.husky/`  | Git hooks                                                 |

Constraint: a top-level source directory is created only by the decision record that
introduces the component it holds. Each area is self-contained: code is placed in the
area that owns the responsibility, and a change touching multiple areas is split into
separate pull requests unless the coupling is explicitly accepted in a decision record.

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

```text
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

| Question                             | Notes                                                                   |
| ------------------------------------ | ----------------------------------------------------------------------- |
| What is the problem DevPulse solves? | No product definition exists yet                                        |
| Which application framework?         | Blocked on the product definition                                       |
| Hosting beyond local deployment?     | Blocked on the product definition; local deployment proposed (ADR 0004) |

These questions are open by design. They are listed here so that no decision is made
silently.
