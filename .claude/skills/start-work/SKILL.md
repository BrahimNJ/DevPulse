---
name: start-work
description: Start work on a GitHub issue by creating a correctly named branch from an up-to-date main.
argument-hint: <issue number>
disable-model-invocation: true
---

Start work on issue #$ARGUMENTS.

1. `gh issue view $ARGUMENTS` and summarise the goal in one sentence.
2. Ensure the working tree is clean (`git status`). If it is not, stop and report.
3. `git switch main && git pull --ff-only`.
4. Create `<type>/<short-kebab-description>` (types and rules in `CONTRIBUTING.md`,
   at most five words, no issue number): `git switch -c <branch>`.
5. For a non-trivial issue, propose a plan (files to touch, commits to make) and wait
   for approval before editing.
