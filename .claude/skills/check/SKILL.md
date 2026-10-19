---
name: check
description: Run every local quality gate and fix what fails. Use before committing or when asked to verify the repository.
---

1. Run `npm run check`.
2. If it passes, report "all gates passed" and stop.
3. Otherwise, fix the reported problems one gate at a time: `npm run lint:fix` and
   `npm run format` for mechanical issues, manual fixes for the rest. Never disable a
   rule inline or in configuration to make a gate pass.
4. Re-run `npm run check` and report the final result honestly.
