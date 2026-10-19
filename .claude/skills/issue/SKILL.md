---
name: issue
description: Create a GitHub issue in English that follows the repository issue forms.
argument-hint: <short description of the problem or change>
disable-model-invocation: true
---

Create a GitHub issue for: $ARGUMENTS

1. Search for duplicates: `gh issue list --state all --search "<keywords>"`. If one
   exists, show it and stop.
2. Choose the form: bug (`.github/ISSUE_TEMPLATE/bug_report.yml`) or change
   (`feature_request.yml`) and follow its sections. For maintenance work, use the
   sections Problem, Proposed change, Out of scope.
3. Title: a Conventional Commit header, for example
   `docs: clarify release process`. English, lowercase description, no period.
4. Describe the problem, not the solution. Do not invent requirements; ask if the
   request is ambiguous.
5. Show the title and body, then create it with
   `gh issue create --title "..." --label <label> --body-file -`.
6. Return the issue URL and the branch name `/start-work` would use.
