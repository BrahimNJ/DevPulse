---
name: pr
description: Push the current branch and open a pull request that follows the repository template.
argument-hint: <issue number>
disable-model-invocation: true
---

Open a pull request that closes #$ARGUMENTS.

1. Refuse if the current branch is `main`.
2. Run `npm run check`. If it fails, stop and report; do not open the pull request.
3. Delegate a review to the `code-reviewer` subagent and fix any blocking finding first.
4. Read `.github/PULL_REQUEST_TEMPLATE.md` and fill every section from the commits
   (`git log origin/main..HEAD`) and the diff. Be specific and honest in Verification:
   list the commands run and their results.
5. Title: a Conventional Commit header, because it becomes the squash commit on `main`.
6. `git push -u origin HEAD`, then `gh pr create --base main --title "..." --body-file -`.
7. Return the URL and the status of `gh pr checks` once it starts. Never merge.
