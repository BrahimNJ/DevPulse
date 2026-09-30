# AGENTS.md

Rules for AI coding agents working in this repository. These are mandatory and take
precedence over an agent's default habits. Human contributors follow
[CONTRIBUTING.md](CONTRIBUTING.md), which enforces the same standards.

## Current State of the Repository

DevPulse is at the standards-only stage. There is **no application functionality**, no
chosen technology stack, and no CI pipeline. Do not assume a language, framework,
package manager, or test runner exists. Verify with `ls` before assuming.

## Scope Discipline

This is the rule most often violated, so state it plainly.

- **Do not invent features.** Do not implement, stub, mock, or describe functionality
  that has not been specified. If a request implies a feature that was never defined,
  ask before writing code.
- **Do not invent technology.** Do not add a language, framework, or runtime because
  it is popular or because another project uses it. Stack decisions go through the
  decision process in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- **Do not add dependencies** unless the task explicitly requires it and the
  justification is documented. Prefer the standard library.
- **Do not create speculative scaffolding**: no placeholder classes, no
  `NotImplementedError` modules, no empty interfaces, no TODOs standing in for
  undefined features.
- **Documentation may be written for undefined features only if explicitly marked as
  proposed or undecided.**

## Workflow

1. Read `README.md`, `CONTRIBUTING.md`, and this file before making changes.
2. Confirm the current state of the repository rather than assuming it.
3. Explain the plan for a non-trivial change and get approval before editing.
4. Work on a branch named per the convention below. Never commit directly to `main`.
5. Make the change, following existing conventions in the touched files.
6. Verify: run whatever lint, typecheck, and test commands the project defines. If
   none are defined yet, say so explicitly rather than claiming verification.
7. Open a pull request using the template and report results honestly.

## Branch Naming

Create branches as `<type>/<short-kebab-case-description>`, where `type` is one of
`feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`, `ci`, `build`.

```
feat/initial-toolchain
docs/clarify-testing-expectations
```

Never use placeholder names such as `patch-1`, `temp`, or `wip`.

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <imperative short description>
```

- Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`,
  `ci`, `chore`, `revert`.
- Imperative mood, under 72 characters, no trailing period.
- Explain *why* in the body, not what.
- One logical change per commit. Never `git add .` across unrelated edits.
- Use `BREAKING CHANGE:` footers for breaking changes.

## Pull Requests

- Reference an issue with `Closes #<number>`.
- Explain the problem, the approach, and how the change was verified.
- One concern per pull request.
- Do not merge, push to `main`, or force-push without explicit instruction.
- Never disable CI checks, skip hooks, or force-push to overcome a failing build. Fix
  the cause.

## Code Quality

- Follow the conventions of the code being edited, not personal preference.
- Keep functions small and single-purpose. Avoid deep nesting; prefer guard clauses.
- Handle errors explicitly. Never swallow errors silently.
- Never log or commit secrets, tokens, passwords, or private keys. Use environment
  variables and ship `*.env.example` with placeholder values.
- Never commit build output, dependency directories, caches, or editor/OS artefacts.
- Write comments for *why*, not *what*. Do not add comments that restate the code.
- Update documentation in the same change as the behaviour it describes.

## Testing

- Add a test with every bug fix that fails before the fix and passes after it.
- Tests must be deterministic, isolated, and order-independent. No reliance on
  wall-clock time, network access, or shared mutable state.
- Never skip, comment out, or weaken a test to make a suite pass.
- If no test framework exists yet, do not introduce one unilaterally. State that
  tests cannot be written until the stack is decided.

## Documentation

- All documentation is written in English, in a clear and professional tone.
- Keep documentation concise and practical. No marketing language, no filler.
- Record technical decisions in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) rather than
  scattering rationale across issue comments.
- Do not document behaviour that does not exist.

## Security

- Do not commit secrets. If a secret is ever committed, report it to the maintainer
  immediately rather than opening a public issue.
- Treat vulnerability reports as private until a fix is available.
- Do not weaken input validation, authentication, or authorisation to make tests pass.
- Do not disable or bypass security tooling.

## Tooling Discipline

- Do not add dependencies, scripts, or tooling that the project has not adopted.
- Pin action versions in workflows.
- Prefer running an existing command over writing a new one.
- If a required command does not exist, say so and ask instead of inventing it.
