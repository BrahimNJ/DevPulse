# Development Guide

This document covers environment expectations, the daily development loop, quality
gates, and the role of CI/CD. It is deliberately tool-independent: the concrete
commands are defined once the technology stack is decided (see
[ARCHITECTURE.md](ARCHITECTURE.md)).

## Current State

There is **no application code, no build system, and no CI pipeline** in this
repository yet. Therefore there is currently no test, lint, or build command to run.
Any instruction in this document that references a specific command is marked as
pending and must not be treated as available.

## Tooling Baseline

The following tools are decided for every change, regardless of stack:

| Concern | Expectation | Status |
| --- | --- | --- |
| Line endings | LF, enforced by `.editorconfig` and `.gitattributes` | Decided |
| Indentation | Spaces; 2 by default, 4 for Python | Decided |
| Final newline | Required in every text file | Decided |
| Trailing whitespace | Removed, except in Markdown hard line breaks | Decided |
| Encoding | UTF-8 | Decided |
| Editor and OS artefacts | Ignored, never committed | Decided |
| Formatter | To be selected with the stack | Pending |
| Linter | To be selected with the stack | Pending |
| Formatter and linter for YAML and Markdown | To be selected | Pending |
| Test runner | To be selected with the stack | Pending |

## Local Environment

- Git is the only hard requirement at this stage.
- A runtime and its package manager are required once the stack is decided. The
  required version is pinned in the repository, not assumed from the host.
- No secrets are needed for local development. When they are, they come from an
  untracked `.env` file; a committed `.env.example` carries placeholder values only.

## Development Loop

1. **Update `main`.** Work only from an up-to-date `main`.
2. **Open or comment on an issue.** Non-trivial changes are discussed before code is
   written.
3. **Create a branch** named `<type>/<short-kebab-case-description>`. See
   [CONTRIBUTING.md](../CONTRIBUTING.md) for the permitted prefixes.
4. **Make the change.** One concern per branch. Follow the conventions already present
   in the files you touch.
5. **Verify locally.** Run the project's format, lint, and test commands. When a
   command does not exist yet, record that it does not exist rather than claiming the
   change is verified.
6. **Update documentation** in the same change as the behaviour it describes.
7. **Open a pull request** using
   [.github/PULL_REQUEST_TEMPLATE.md](../.github/PULL_REQUEST_TEMPLATE.md) and reference
   the issue with `Closes #<number>`.
8. **Respond to review** and merge only when CI is green and a reviewer has approved.

## Quality Gates

A change is complete when all of the following hold.

**Before pushing**

- The change is limited to one concern and the branch follows the naming convention.
- Commits follow Conventional Commits and explain why.
- Formatting and linting are clean.
- Tests pass, and a bug fix includes a test that failed before the fix.
- Documentation matches the behaviour.
- No secrets, `.env` files, build output, or editor artefacts are staged.

**In CI, on every pull request**

- Tests pass.
- Lint and format checks pass.
- The project builds.
- No secret is present in the diff.

**At merge**

- At least one approving review.
- All review comments resolved.
- `main` is green.

## CI/CD Role

CI exists to make the quality gates objective. It is the mechanism that enforces
[CONTRIBUTING.md](../CONTRIBUTING.md) without relying on reviewer memory.

Continuous integration is expected to:

- Run on every pull request and on every push to a protected branch.
- Report a pass/fail status on the pull request and block merge on failure.
- Be reproducible: the same commit yields the same result.
- Pin the versions of all actions and runtimes it uses.
- Use pull requests with least-privilege permissions and no write scope by default.
- Document every required repository or organisation secret, and use secrets only for
  credentials that cannot be avoided.

Continuous delivery and deployment are out of scope until a deployable application
exists. When introduced, they will:

- Run only from `main` after continuous integration succeeds.
- Produce an immutable, versioned artefact.
- Require an explicit promotion step, never an automatic production change.
- Be documented in this file, including the rollback procedure.

No pipeline is implemented in this repository. This section is the contract that the
first pipeline must satisfy.

## Definition of Done

A piece of work is done when it is merged into `main` and:

- The problem it solves is described in the linked issue and closed by the pull request.
- All quality gates above are satisfied.
- Documentation and architectural decision records are updated where required.
- Any follow-up work is filed as a new issue rather than left undocumented.
