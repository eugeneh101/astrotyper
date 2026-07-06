# Agentic Engineering Rules

Welcome to the Type Your Adventure codebase. This project follows strict Agentic Engineering principles. Any subagent operating in this repository MUST adhere to the following rules:

## 1. Source of Truth
*   Always consult `game_design_spec.md` for game mechanics, lore, and architecture rules. It is the absolute source of truth. Do not invent new game mechanics that contradict this spec.
*   Consult `implementation_plan.md` to understand the overarching architectural roadmap and current Phase.
*   Update `task.md` continuously to reflect your granular progress.

## 2. Modular Architecture & Strict Typing
*   **Frontend (Next.js):** Always use strict TypeScript. No `any` types. 
*   **The Game Engine:** The HTML5 Canvas game loop MUST be built as a pure, standalone TypeScript class (`GameEngine.ts`). It must be entirely decoupled from React so that it can be tested deterministically offline. React should only be used as a thin wrapper to mount the canvas.
*   **Backend (Python):** Use the Google ADK. Ensure all Python code is strictly type-hinted. Decouple the core prompt/LLM logic from the Vercel API route wrapper so it can be tested with `pytest`.

## 3. Centralized Configuration
*   **Never hardcode mechanical values** (e.g., charge timers, burst multipliers, WPM scalar logic). 
*   All frontend game mechanics must be read from a centralized `src/gameConfig.ts` file.
*   All backend secrets and API timeouts must be read from `.env.local`.

## 4. Test-Driven Verification
*   Before considering a task complete, you must verify it works.
*   If you are building the Canvas Engine, write Jest tests that simulate keystrokes and verify the game state mathematically.
*   If you are building the ADK backend, ensure the generated branching schemas pass validation and don't break the 4th wall (utilize the `evaluate_narrative` LLM-as-a-judge script once built).

## 5. Do Not "Vibe Code"
*   Do not dump 1000 lines of code into a single file and hope it works. Break components down, verify them incrementally, and keep the architecture pristine.

## 6. Code Style
*   **Python Named Parameters:** When calling custom Python functions (not built-ins), always use named parameters (keyword arguments) rather than positional arguments. This improves readability and maintainability.
*   **Python Strings:** Always prefer using double quotes (`"`) over single quotes (`'`) for strings when feasible, aligning with PEP-8 formatting standards like Black.
*   **Python Formatting:** Before committing or finalizing Python changes, always run `isort` to organize imports, followed immediately by `black` to format the code perfectly.
*   **JavaScript / TypeScript Strings:** Always prefer using single quotes (`'`) over double quotes (`"`) for strings when feasible. This aligns with modern JS/TS ecosystem conventions (Prettier, StandardJS).
*   **Javascript/TypeScript Linting:** Ensure all JS/TS files are formatted cleanly (e.g. using Prettier if available in the workspace) and adhere strictly to ESLint rules. 

## 7. Framework Rules
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
