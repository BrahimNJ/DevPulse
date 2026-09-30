# Contributing to DevPulse

Thank you for contributing. This document defines the expectations for every change
that lands in this repository: how branches are named, how commits are written, what a
pull request must contain, and what quality checks are required.

The same standards apply to human contributors and to AI coding agents. Agents must
also read [AGENTS.md](AGENTS.md).

## 1. General Principles

- Discuss non-trivial changes in an issue before writing code.
- One concern per pull request. Mixed refactoring and feature work is not accepted.
- Prefer small, reviewable changes over large ones.
- Never commit generated artifacts, editor state, credentials, or local environment files.
- Do not introduce a new dependency without an issue that justifies it.

## 2. Branch Naming Conventions

All work branches are created from an up-to-date `main`. Branch names are lowercase,
use a slash prefix matching the change type, and a short kebab-case description.

```
<type>/<short-description>
```

Permitted prefixes:

| Prefix | Use for |
| --- | --- |
| `feat/` | New functionality |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Maintenance, dependency bumps, config |
| `refactor/` | Behaviour-preserving code changes |
| `test/` | Adding or correcting tests |
| `perf/` | Performance improvements |
| `ci/` | CI/CD workflow changes |
| `build/` | Build system changes |

Rules:

- Use the singular prefix form (`feat/`, not `feature/`).
- Keep the description under five words.
- Use hyphens, never spaces or underscores.
- Do not embed ticket numbers in the branch name; reference the issue in the PR body.
- Delete the branch once it is merged.

Examples:

```
feat/user-authentication
fix/session-timeout-handling
docs/update-contribution-guidelines
chore/initialise-toolchain
```

`main` is a protected branch. All changes reach it through pull request.

## 3. Commit Messages: Conventional Commits

Every commit message follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<optional scope>): <short description>

<optional body>

<optional footer>
```

### Types

| Type | Meaning |
| --- | --- |
| `feat` | New functionality |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Formatting only, no logic change |
| `refactor` | Code change with no feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `build` | Build system or packaging changes |
| `ci` | CI/CD configuration changes |
| `chore` | Maintenance that fits nowhere else |
| `revert` | Revert of a previous commit |

### Rules

- Use the imperative mood: `add`, not `added` or `adds`.
- Keep the short description under 72 characters, with no trailing period.
- Use a scope when it adds clarity, for example `docs` or a module name.
- Write the body to explain **why** the change was needed. Do not restate the diff.
- Reference issues with `Closes #123` or `Refs #123` in the footer.
- One logical change per commit. Do not bundle unrelated edits with `git add .`.

### Breaking changes

Mark breaking changes with an exclamation mark and a footer:

```
feat(api)!: change authentication response shape

Clients previously received a token wrapper. The token is now returned directly,
which aligns the response with the published contract.

BREAKING CHANGE: the `data.access_token` field is removed.
```

### Examples

```
docs: define branch naming conventions
chore: add editor configuration
feat: add initial project scaffolding
fix: correct example command in development guide
```

## 4. Pull Requests

All work lands via pull request into `main`.

### Branch targeting

- Feature and fix branches target `main`.
- Long-running work targets a `release/*` branch when one exists; this will be
  defined when releases are introduced.

### Required content

Every pull request must:

1. Reference at least one issue (`Closes #<number>`).
2. Explain the problem being solved and the chosen approach.
3. State how the change was verified (tests run, manual checks performed).
4. Declare any change that requires a coordinated release or migration.
5. Confirm that no secrets, credentials, or local environment files are included.

Use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md).

### Review expectations

- At least one approving review is required before merge.
- Reviewers approve the change, not the person. Comment on correctness, clarity, and
  scope; assume good intent.
- The pull request author responds to all review comments. Unresolved comments block merge.
- Reviewers are expected to check correctness and standards within two working days.
- Squashing or rebasing to keep the branch tidy is fine as long as commits remain
  Conventional Commits.

### Merge policy

- `main` is merged into only with a passing CI run and an approving review.
- Prefer squash merge for feature branches so `main` history stays readable.
- The commit message of a squash merge follows Conventional Commits.

## 5. Testing Expectations

No test framework is selected yet. The requirements below are tool-independent and
become enforceable once the stack is chosen.

Principles:

- Every bug fix includes a test that fails before the fix and passes after it.
- New behaviour is covered by tests proportional to its risk and blast radius.
- Tests are deterministic: no reliance on wall-clock time, network access, test order,
  or shared mutable state.
- Tests must be independent and runnable in isolation and in any order.
- Test names describe behaviour and expected outcome, not implementation details.
- Slow or flaky tests are defects. Flakiness is fixed or removed, not retried into passing.
- Test coverage is a signal, not a target. Coverage of critical paths matters more
  than a percentage. A coverage threshold will be set once the stack is decided.
- No test may be skipped, commented out, or weakened to make a suite pass. Any such
  change is a pull request on its own and requires justification in review.

## 6. Code Quality Expectations

- Follow the conventions already present in the code you touch. Consistency beats
  personal preference.
- Format and linting are automated. Fix what the tools report rather than debating it.
- Name things for what they do or represent, not for implementation detail. Avoid
  abbreviations that are not widely understood.
- Keep functions and units of work small and single-purpose. Long functions and deep
  nesting are review blockers.
- Guard clauses and early returns are preferred over deeply nested conditionals.
- Handle errors explicitly. Never swallow exceptions or errors silently.
- Never commit secrets, tokens, passwords, or private keys. Use environment variables
  and provide an example file (`*.env.example`) with placeholder values only.
- Never commit build output, dependency directories, editor state, or OS artefacts.
- New dependencies require an issue explaining what problem they solve, why the
  standard library or an existing dependency is insufficient, the maintenance status,
  and the licence. Approval is required before adding one.
- Keep comments for *why* a decision was made. Comments restating the code are removed.
- Documentation is updated in the same change as the behaviour it describes.
- Technical decisions are recorded in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 7. CI/CD Role

CI/CD exists to make the standards in this document objective and automatic. It is a
verification system, not a deployment mechanism yet. No pipeline is defined at this
stage; the expectations below are the contract that future pipelines must satisfy.

Continuous integration must verify, on every pull request and push to `main`:

- All tests pass.
- Linting and formatting checks pass.
- The project builds successfully.
- No committed secret is detected in the change.

Continuous integration must additionally:

- Run automatically on pull requests and pushes to protected branches.
- Report a clear pass/fail status on the pull request itself, and block merge on failure.
- Be reproducible: the same commit must produce the same result.
- Pin action versions and document any required CI secrets.

Continuous deployment and release automation are out of scope until a deployable
application exists. When they are introduced, they will run only from `main` after CI
succeeds, require version tagging, and be documented in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## 8. Reporting Issues

Use the issue templates in [.github/ISSUE_TEMPLATE](.github/ISSUE_TEMPLATE). Report bugs
with reproduction steps, expected behaviour, and actual behaviour. Search existing
issues first.

Security issues must not be opened as public issues. Follow the reporting process
described in [AGENTS.md](AGENTS.md).

## 9. Code of Conduct

Contributors are expected to be respectful, constructive, and professional. Reviews
address the code, never the contributor.
