---
name: commit-message
description: Generate a conventional commit message from the current staged git diff. Use when the user asks to write/suggest a commit message.
---

Look at the staged diff (`git diff --cached`). If nothing is staged, look at the unstaged diff instead and say so.

Write a commit message that:
- Uses the Conventional Commits format: `type(scope): summary` (types: feat, fix, refactor, docs, test, chore, perf).
- Keeps the summary line under 72 characters, imperative mood ("add", not "added").
- Adds a body only if the diff touches more than one concern — explain the why, not a restatement of the diff.

Output just the commit message, ready to paste into `git commit -m`.
