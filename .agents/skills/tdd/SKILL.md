---
name: tdd
description: "A workflow for fixing bugs using Test-Driven Development (TDD). Trigger this when the user describes a bug and wants you to do TDD or Red-Green-Refactor."
---

# Red-Green-Refactor Workflow

When the user invokes this skill by describing a problem or bug, you must follow the strict Red-Green-Refactor Test-Driven Development (TDD) loop.

## 1. Feasibility Check
- Evaluate if the problem described can be easily unit tested within the current test architecture.
- **IF NOT:** Stop immediately. Tell the user that the problem cannot be easily unit tested and explain why. Do NOT take any further actions or write any code.
- **IF YES:** Proceed to step 2.

## 2. Red (Write the Failing Test)
- Write a unit test that specifically reproduces the bug or problem described by the user.
- Run the test suite using the project's testing command (e.g., `npx jest`, `pytest`, etc.).
- Verify that the new unit test **FAILS**. This proves the test is valid and actually catches the bug.

## 3. Green (Fix the Code)
- Modify the source code to fix the problem. Do the simplest thing that makes the test pass.
- Run the test suite again.
- Verify that **ALL** tests, including your new test, now pass (Green).
- **CRITICAL COLLATERAL DAMAGE RULE:** If an unrelated unit test fails, STOP the Red-Green-Refactor process immediately and tell the user. Do not try to fix more than 1 core problem at a time. Wait for the user to tell you how to proceed.

## 4. Refactor (Optional but Recommended)
- Review the code you just wrote. Can it be cleaner, more efficient, or more maintainable?
- If you refactor, you **MUST** run the test suite again to ensure everything is still Green.

## 5. Report
- End your turn by reporting the results to the user. Show them the test you added, the fix you applied, and confirm that the test suite is 100% green.
