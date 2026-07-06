---
name: run-tests
description: Runs all unit tests (Jest) and Python evaluations (tests/eval/run_evals.py) for the AstroTyper project, then reports the results. Does NOT refactor or fix any failures unless explicitly asked.
---

# Run Tests & Evaluations

This skill runs the full test suite for the AstroTyper project and reports the results.

## Steps

1. **Run Jest unit tests** (TypeScript game engine tests):
   ```bash
   source ~/.nvm/nvm.sh && npx jest 2>&1
   ```
   Run this from the project root: `/Users/eugenehuang/Desktop/type-your-adventure-antigravity`

2. **Run Python narrative evaluations** (LLM-as-judge):
   
   **⚠️ The IDE sandbox blocks pyenv's `libpython3.10.dylib`, so this CANNOT be run by the agent.**
   
   After reporting the Jest results, remind the user to run this command manually in their terminal:
   ```bash
   .venv/bin/python tests/eval/run_evals.py
   ```
   This requires `GEMINI_API_KEY` in `.env.local`.

3. **Report results** — After both commands complete, summarize:
   - Total test suites and individual tests passed/failed
   - Any specific test failure messages (assertion mismatches, errors)
   - Python evaluation pass/fail status
   - **Do NOT refactor or fix anything.** Only report the results. Wait for the user to explicitly request fixes.
