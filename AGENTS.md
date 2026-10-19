# AGENTS.md

Mandatory rules for AI coding agents in this repository. They add to, and never relax,
the rules in [CONTRIBUTING.md](CONTRIBUTING.md) (branching, commits, pull requests,
testing, code quality) and [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) (environment,
quality gates, CI/CD). Read those sections when the task touches them; do not
re-derive the rules from memory.

## Current State

No application functionality is defined. Verify the repository state with `ls` and
`git status` before assuming that a language, tool, or command exists.

## Scope Discipline

This is the rule most often violated.

- **Do not invent features.** Do not implement, stub, mock, or describe functionality
  that has not been specified. If a request implies an undefined feature, ask first.
- **Do not invent technology.** Stack decisions go through the decision process in
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Do not add dependencies, scripts, or tooling** that the project has not adopted,
  unless the task explicitly requires it and the justification is documented.
- **No speculative scaffolding**: no placeholder modules, empty interfaces, or TODOs
  standing in for undefined features.
- Documentation for undefined features is allowed only when marked as proposed.

## Workflow

1. Confirm the current state of the repository rather than assuming it.
2. For a non-trivial change, explain the plan and get approval before editing.
3. Work on a branch named per [CONTRIBUTING.md](CONTRIBUTING.md#2-branch-naming-conventions).
   Never commit directly to `main`.
4. Stage files explicitly, one logical change per commit. Never `git add .` across
   unrelated edits.
5. Run the verification commands defined in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
   If none exist, say so instead of claiming verification.
6. Open a pull request with the template and report results honestly.

## Hard Limits

- Do not merge, push to `main`, or force-push without explicit instruction.
- Do not skip hooks, disable CI checks, or weaken, skip, or delete tests to make a
  build pass. Fix the cause.
- Do not weaken input validation, authentication, or authorisation.
- Never read, log, or commit secrets. If a secret is ever committed, report it to the
  maintainer immediately and privately rather than in a public issue.
- If a required command does not exist, say so and ask instead of inventing it.
