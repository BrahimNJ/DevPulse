# 0001. Record architecture decisions

- Status: accepted
- Date: 2026-10-19

## Context

Technical choices for DevPulse must be traceable. Rationale left in issue comments or
chat history is hard to find, and AI agents working on the repository cannot use
context they never see.

## Decision

We record every significant technical decision as a numbered Markdown file in
`docs/decisions/`, using the structure defined in
[ARCHITECTURE.md](../ARCHITECTURE.md#decision-records): context, decision,
alternatives considered, consequences, and status.

## Alternatives considered

- **Do nothing.** Decisions stay implicit and are re-argued case by case.
- **Wiki or issue tracker.** Lives outside the repository, so it is not versioned with
  the code and is invisible to agents working from a checkout.

## Consequences

- Each stack, tooling, or layout change ships with a record in the same pull request.
- Records are immutable once accepted; a reversal is a new record that supersedes the
  old one.
- Agents can be pointed to a single directory to learn why the repository is the way
  it is.
