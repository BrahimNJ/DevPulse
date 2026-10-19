# Git Workflow

The path every change takes from idea to release. Naming and message rules are defined
in [CONTRIBUTING.md](../CONTRIBUTING.md); this document shows how they fit together.

```text
 issue ──► branch ──► atomic commits ──► pull request ──► squash merge ──► release PR ──► tag
  #12     docs/fix-x   hooks validate     CI + review      main updated    release-please  vX.Y.Z
```

## 1. Issue

Every change starts from an issue that states the problem. The issue title is written
as a Conventional Commit header (`docs: clarify release process`) so that it can become
the pull request title unchanged.

## 2. Branch

```sh
git switch main
git pull --ff-only
git switch -c docs/clarify-release-process
```

Branches are short-lived: one issue, one branch, merged within days.

## 3. Commits

- One logical change per commit, staged explicitly with `git add <paths>`.
- Header: `<type>(<scope>): <imperative description>`; body explains why; footer
  `Refs #<issue>`.
- Formatting-only changes are a separate `style:` commit.
- The hooks run lint-staged and commitlint. A rejected commit is fixed, never forced
  through with `--no-verify`.

Keep the branch current by rebasing onto `main` before review:

```sh
git fetch origin
git rebase origin/main
git push --force-with-lease   # own feature branch only, never main
```

## 4. Pull request

- Title: a Conventional Commit header. It becomes the commit message on `main`.
- Body: the template, with `Closes #<issue>` and an honest Verification section.
- Required to merge: `ci-success` and `pr-title` green, one approval, all
  conversations resolved.

## 5. Merge

Pull requests are squash-merged so `main` has one Conventional Commit per change. The
branch is deleted after merge. `main` is never pushed to directly.

## 6. Release

release-please reads the commits on `main` and keeps a release pull request up to
date. Merging it bumps the version, updates `CHANGELOG.md`, and tags the release.

| Commit type on `main`       | Version change before 1.0.0 | After 1.0.0 |
| --------------------------- | --------------------------- | ----------- |
| `fix`, `perf`               | Patch                       | Patch       |
| `feat`                      | Minor                       | Minor       |
| `!` or `BREAKING CHANGE:`   | Minor                       | Major       |
| `docs`, `chore`, `ci`, etc. | None                        | None        |

## Recovering from mistakes

| Situation                           | Action                                                               |
| ----------------------------------- | -------------------------------------------------------------------- |
| Wrong message on an unpushed commit | `git commit --amend`                                                 |
| Bad commit already on `main`        | `git revert <sha>` in a new pull request                             |
| Secret committed                    | Rotate the secret first, then report it privately; see `SECURITY.md` |
| Branch far behind `main`            | `git rebase origin/main`, resolve conflicts commit by commit         |
