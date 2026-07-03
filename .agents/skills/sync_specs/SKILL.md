---
name: sync-specs
description: Analyzes recent code changes and updates the game_design_spec.md, implementation_plan.md, and task.md to ensure the documentation stays perfectly synchronized with the actual implementation. Summarizes all changes made.
---

# Sync Specs Skill

When the user asks to "sync specs" or "update the documentation to match the code", follow these exact steps:

## 1. Analyze Recent Code Changes
- Review the `src/` directory (or use `git status` / `git diff` if available) to understand what features, mechanics, or visual changes have been implemented recently that might not be documented.
- Pay special attention to game mechanics, collision logic, input handling, and architectural shifts.

## 2. Review Current Documentation
- Read `game_design_spec.md` (The source of truth for game rules and mechanics).
- Read `implementation_plan.md` (The architectural roadmap and phase tracking).
- Read `task.md` (The granular progress checklist).

## 3. Identify Discrepancies
- Compare the actual code implementation against the rules and plans defined in the documentation.
- Note any new features, tweaked mechanics, or deviations from the original plan.

## 4. Update the Markdown Files
- Use the `replace_file_content` tool to surgically update `game_design_spec.md` and `implementation_plan.md` with the accurate, up-to-date logic.
- Update `task.md` to check off completed items or add newly discovered requirements.

## 5. Summarize Changes
- In your final response to the user, provide a clear, bulleted summary of exactly what was modified in the markdown files so they are aware of how the specifications evolved.
