# Working with Claude Code

How Claude Code is configured in this repository, how to use it, and how to keep
sessions efficient. The decision behind this setup is
[ADR 0003](../decisions/0003-adopt-claude-code-workflow.md).

## Configuration map

| Path                          | Loaded                     | Purpose                                    |
| ----------------------------- | -------------------------- | ------------------------------------------ |
| `CLAUDE.md`                   | Every session              | Entry point; imports `AGENTS.md`           |
| `AGENTS.md`                   | Every session (via import) | Agent rules, tool-agnostic                 |
| `.claude/settings.json`       | Every session              | Permissions and hooks, shared              |
| `.claude/settings.local.json` | Every session, if present  | Personal overrides, not committed          |
| `.claude/agents/*.md`         | Description only, on start | Subagents, run in their own context        |
| `.claude/skills/*/SKILL.md`   | Description only, on start | Workflows invoked with `/name`             |
| `.claude/hooks/*.mjs`         | On matching tool calls     | Enforced checks, run by the harness itself |

Everything loaded "every session" costs tokens on every request, which is why
`CLAUDE.md` and `AGENTS.md` are short and link to other documents instead of copying
them.

## Daily workflow

```text
/issue <problem>      create the GitHub issue
/start-work <n>       branch from an up-to-date main
  explore → plan → edit
/check                run and fix every quality gate
/commit <n>           atomic Conventional Commits
/pr <n>               review, push, open the pull request
```

Use plan mode (`Shift+Tab`) for any change touching more than one file: Claude reads
and proposes without editing until you approve.

## Subagents

A subagent works in its own context window and returns only a summary, so the main
conversation does not fill with file dumps.

| Agent           | Model  | Tools                  | Use it to                                  |
| --------------- | ------ | ---------------------- | ------------------------------------------ |
| `repo-explorer` | haiku  | Read, Grep, Glob       | Answer "where is / does X exist" cheaply   |
| `code-reviewer` | sonnet | Read, Grep, Glob, Bash | Review the branch before a pull request    |
| `adr-writer`    | sonnet | Read, Write, Edit, …   | Draft a decision record                    |
| `docs-writer`   | sonnet | Read, Write, Edit, …   | Bring documentation in line with behaviour |
| `ci-doctor`     | sonnet | Bash, Read, Grep, Glob | Find the root cause of a red pipeline      |

Invoke one explicitly ("use the code-reviewer agent on this branch") or let Claude
delegate based on the description. `/agents` lists and edits them.

Write a new agent when a task is repeated, self-contained, and produces a short
result. Give it the fewest tools that work and the cheapest model that is good enough.

## Hooks and permissions

- **Permissions** (`.claude/settings.json`): verification and read-only Git or GitHub
  commands run without prompts; pushes, pull requests, merges and installs ask first;
  force pushes, pushes to `main`, hard resets, `--no-verify` and reading `.env` files
  are denied.
- **`protect-files.mjs`** (before edits): blocks `.env*`, `package-lock.json`,
  `CHANGELOG.md`, the release manifest, and Git internals.
- **`format-file.mjs`** (after edits): runs Prettier on the edited file.

Hooks are enforced by the harness, not by the model. A rule that must always hold
belongs in a hook or permission; guidance belongs in `CLAUDE.md`.

## Token efficiency

| Practice                                              | Why it helps                                       |
| ----------------------------------------------------- | -------------------------------------------------- |
| `/clear` between unrelated tasks                      | Old context is re-sent with every request          |
| `/compact <focus>` in long sessions                   | Replaces history with a summary you steer          |
| Reference files with `@path` instead of pasting       | Claude reads only what it needs                    |
| Ask for a line range or a symbol, not "read the repo" | Avoids whole-file reads                            |
| Delegate wide searches to `repo-explorer`             | Search results stay out of the main context        |
| Pick the model per task (`/model`)                    | Smaller models for mechanical work                 |
| Keep `CLAUDE.md` short and link out                   | It is loaded on every request                      |
| Give precise prompts with acceptance criteria         | Fewer correction rounds                            |
| Let hooks format and gates verify                     | No turns spent on style or on re-checking manually |

`/cost` shows the current session's usage; `/context` shows what fills the window.

## Learning path

1. Read `CLAUDE.md`, then ask Claude to explain the repository using only
   `repo-explorer`. Compare the answer with the files.
2. Make a documentation fix end to end with `/issue`, `/start-work`, `/commit`, `/pr`.
3. Ask `code-reviewer` to review the branch, then fix its findings yourself.
4. Break a gate on purpose (a malformed commit message, an unformatted file) and watch
   the hooks and CI catch it.
5. Write your own subagent or skill in a branch and open a pull request for it.
6. Use `ci-doctor` on a failing pipeline before reading the logs yourself.

## Personal settings

Put preferences that should not be shared (model choice, extra allowed commands) in
`.claude/settings.local.json` or `CLAUDE.local.md`. Both are ignored by Git.
