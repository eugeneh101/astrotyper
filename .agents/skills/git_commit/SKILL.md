---
name: git-commit
description: Analyzes uncommitted changes, formats a concise changelog, and automatically runs git add and git commit.
---

# Git Commit Skill

When the user requests to commit their code (e.g. using the `/git-commit` slash command or asking to "commit changes"), follow these steps:

## 1. Analyze Changes
Run the following commands to understand what has changed:
- `git status` to see modified and untracked files.
- `git diff` (and `git diff --cached` if files are already staged) to read the specific line-by-line changes.

## 2. Generate a Changelog
Synthesize the changes into a concise, professional commit message. 
- Use the Conventional Commits format for the title (e.g., `feat:`, `fix:`, `refactor:`, `chore:`).
- Summarize the core logic changes in the body using a bulleted list.

## 3. Execute the Commit
Use the `run_command` tool to execute the commit:
```bash
git add .
git commit -m "<type>: <brief summary>" -m "<bulleted list of detailed changes>"
```

## 4. Prompt the User
Since the secure sandbox blocks `git push` from accessing the network and macOS Keychain, do **NOT** attempt to run `git push` yourself.
Instead, inform the user that the local commit was successful, print the commit message you used, and politely ask them to run `git push` manually in their own terminal.
