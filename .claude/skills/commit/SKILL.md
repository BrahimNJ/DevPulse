---
name: commit
description: Split the current changes into atomic Conventional Commits with explanatory bodies.
argument-hint: '[issue number]'
disable-model-invocation: true
---

Commit the current changes. Related issue: $ARGUMENTS

1. Inspect: `git status --short` and `git diff` (staged and unstaged).
2. Group the changes into logical units: one concern per commit. Formatting-only
   changes get their own `style:` commit.
3. For each unit, stage the exact files with `git add <paths>` (never `git add .` or
   `-A`) and commit with:

   ```text
   <type>(<optional scope>): <imperative description, max 72 chars, no period>

   <why the change was needed, wrapped at 72 columns>

   Refs #<issue>
   ```

4. Let the hooks run. If commitlint or lint-staged fails, fix the cause and create a
   new commit attempt. Never use `--no-verify` and never amend a pushed commit.
5. Finish with `git log --oneline origin/main..HEAD`.
