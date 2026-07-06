# Implementation Plan: Zero-Latency Sci-Fi Typing RPG

The Game Design Spec is fully complete and approved. This document outlines the technical architecture and the step-by-step implementation phases required to build the game.

## System Architecture

We will build this entirely within a single repository optimized for Vercel's free tier.

**1. The Frontend (Next.js & HTML5 Canvas)**
*   **Framework:** Next.js (App Router, React).
*   **Game Engine:** A custom 2D HTML5 `<canvas>` rendering loop running at 60fps. The canvas will be drawn with a classic Top-Down 2D scrolling starfield.
*   **State Management:** React hooks will manage the overarching game state (Current Round, WPM calculations, Story Text), while the Canvas loop manages the granular physics (Enemy positions, Lasers, Hitboxes).
*   **Styling:** Vanilla CSS modules as requested, focusing on a dark, neon, glassmorphism aesthetic.

**2. The Backend (Python ADK & Vercel Serverless)**
*   **Framework:** Python 3 using the Google ADK, deployed via Next.js's `/api` directory (which Vercel automatically compiles into Serverless Functions).
*   **LLM Provider:** Gemini API (using structured JSON outputs).
*   **Execution Time:** The API must execute and return within 10 seconds to respect Vercel's free tier limits. The ADK agent will be lightweight—maintaining only the "story so far" as its memory graph.
*   **Endpoint Security (Anti-Abuse):** To protect your Gemini API tokens from malicious actors hitting the Vercel endpoint directly:
    *   **Strict CORS Policy:** The API will reject any requests not originating from your exact Vercel production domain.
    *   **Rate Limiting:** We will implement Vercel Edge rate-limiting (e.g., via `@upstash/ratelimit` or custom middleware) to restrict requests to a reasonable game cadence (e.g., max 3 requests per IP per minute).
    *   **Origin Validation:** We will add a lightweight secret token or header validation to ensure requests are structurally valid game state payloads.

---

## Proposed Phases of Execution

### Phase 0: The Agentic Foundation [COMPLETED]
*   Create the `.agents/AGENTS.md` file to strictly enforce TypeScript, testing rules, and modular decoupling for all future subagents working on this codebase.
*   Build the `evaluate_narrative` Python script (LLM-as-a-judge) to deterministically test that the Gemini prompts successfully generate 3 distinct archetypes without breaking the 4th wall.

### Phase 1: Project Scaffolding [COMPLETED]
*   Use `npx create-next-app` to scaffold a clean Next.js repository in the workspace.
*   Set up the `/api/python` directory for the backend.
*   Configure the Python virtual environment, install the Google ADK and `google-genai` SDK, and create a `requirements.txt`.
*   Create the `vercel.json` to properly route API requests to the Python functions.
*   **Centralized Configuration:** Create a `.env.local` file for backend secrets (`GEMINI_API_KEY`, `GEMINI_MODEL`) and a frontend `gameConfig.ts` file to expose all mechanical tuning dials.

### Phase 2: The ADK "Game Master" Backend [COMPLETED]
*   Build the core ADK Agent (`agent.py`).
*   Define the `GameMasterRequest` and `GameMasterResponse` Pydantic schemas to strictly enforce the JSON structure coming back from Gemini.
*   Implement the core prompt logic:
    *   **Round 1 Generation:** Randomly selecting from the 7 sub-genres and generating 3 hooks.
    *   **Round 2+ Generation:** Using the WPM Tiers to target the exact word counts, and using the Dynamic Archetype pool to force narrative divergence.
    *   **The Game Over Generation:** The 2-sentence tragic death prompt.
*   Build the Flask/FastAPI endpoint to bridge Next.js with the ADK.

### Phase 3: The HTML5 Canvas Game Engine [COMPLETED]
*   Build the `GameEngine` class to manage the 60fps loop.
*   Implement the Scrolling 2D Starfield renderer.
*   Implement the **Typing Mechanics**: Mapping keyboard events to the current active word, tracking correct/incorrect strokes for the Combo Multiplier.
*   Implement **Entities**:
    *   Player Ship (Animations, Combo-scaling Lasers, Death Blossom spin).
    *   Enemy Ships (Round 1 Rushers, Round 2+ Shooters, Health mapping to letters).
    *   The Final Boss (Massive sprite, multi-component hitboxes mapped to the final sentences, bullet hell projectiles, Standoff state).

### Phase 3.5: Visual & Animation Overhaul (NEW) [COMPLETED]
*   **Player Ship Movement:** Calculate the trajectory vector to the active enemy and use linear interpolation (`lerp`) to smoothly rotate the player's ship to aim directly at them before firing.
*   **Player Ship Thrusters:** Added animated cyan plasma thruster flames at the rear of the player's ship that flicker and thrust against the scrolling starfield.
*   **Upgraded Laser VFX:** Replace the simple blue dot with a high-velocity, glowing plasma bolt (capsule shape) featuring a bright core and an outer neon bloom.
*   **Upgraded Enemy Sprite:** Replaced the flat red triangle with a stylized, multi-layered geometric dreadnought featuring swept wings, glowing cockpit cores, neon wing-vents, and flickering gradient exhaust trails.
*   **Crash & Explosion Animations:** When an enemy hits the shield or is destroyed, spawn an `Explosion` entity that renders expanding, fading particle debris.
*   **Critical Shield States & Dynamic Integrity:** As the player's health drops from 100% to 25%, the shield ring physically shrinks (from 5px to 1px) and its color smoothly interpolates from Cyan to Yellow to Orange. When health drops below 25%, a critical warning state triggers: the screen edges pulse with a red vignette, and a glowing, glitching red sphere renders around the player ship.
*   **Game Over Physics & Cinematic Death:** When the player dies, a massive cinematic `PlayerDeathExplosion` is triggered, featuring expanding shockwaves, dark smoke clouds, high-velocity shrapnel sparks, and shattered hull debris that spins into the void. Enemies immediately detach, lose their UI/exhaust elements, and coast downward along their last known trajectory vectors.

### Phase 4: The Zero-Latency Narrative Loop (Integration) [COMPLETED]
*   Build the overarching React container (`<Game />`).
*   Implement the WPM Calculator.
*   Implement the **70% Trigger Logic**: When the player reaches 70% of the current text wave, React asynchronously fetches the next story segment from the Python backend without pausing the Canvas loop.
*   Implement the End Screen cinematic scroll and the `.txt` download blob.

### Phase 5: Polish and The Browser Subagent QA [COMPLETED]
*   Inject the epic CSS design system (neon glowing text, retro-futuristic UI elements).
*   **The Browser Subagent QA:** We will leverage Antigravity's `browser_subagent` tool. The agent will physically open a Chromium browser, navigate to the local dev server, and *actually play the game* by simulating rapid keystrokes. This automatically records a WebP video of the session so you can sit back and watch the AI playtest its own game!
*   (Stretch Goal) Implement the "Auto-Dodging" ship movement logic based on typing combo.
*   (Stretch Goal) Wire up browser-native Speech Synthesis (or Gemini TTS) to read the final story at the End Screen.

## Phase 5.5: Centralized Configuration (`gameConfig.ts`) [COMPLETED]
All important gameplay parameters have been successfully extracted from the core engine files and moved to a centralized parameter file (`src/gameConfig.ts`). 

### Refactored Parameters
*   **Player & Defenses**: Max Health, Shield Regeneration Delay, Shield Regeneration Rate, Deflector Max Charge, Deflector Active Duration, Deflector Cooldown, Collision Radii.
*   **Spawning Engine**: Target Density, Base Spawn Delay, Minimum Spawn Delay.
*   **Enemy Mechanics**: Kamikaze Damage, Shooter Bullet Damage, Scrambler Glitch Duration.
*   **Boss Mechanics**: Boss Difficulty Threshold, Dreadnought/BioBoss QTE Windows, Beam Damages, Bullet Damages.

## Phase 6: TDD Bug Fixes and Stability Polish [COMPLETED]
A series of strict TDD (Red-Green-Refactor) sessions were executed to resolve several critical edge cases and bugs discovered during playtesting.

### 1. Boss Bullet Collision (ReferenceError)
*   **Issue:** Refactoring collision radii into `gameConfig.ts` inadvertently removed the distance calculation (`Math.hypot`) for Boss bullets, causing a `ReferenceError` when bullets impacted the player shield.
*   **Fix:** Restored the `dx`, `dy`, and `dist` calculations prior to the collision radius check. 
*   **Verification:** TDD unit test added to simulate boss bullet impacts on the player.

### 2. Fast Typing Enemy Desync
*   **Issue:** The dynamic rubber-band spawner (`pendingSpawnQueue`) queued enemies to spawn over time. If a player typed incredibly fast, they could input characters for an enemy that hadn't physically spawned yet, permanently desynchronizing the global text progress from the enemy's local character count, stranding unkillable enemies on screen when the wave transitioned.
*   **Fix:** Updated `handleInput` to instantly force-spawn the next enemy from the `pendingSpawnQueue` if the player types its characters before the spawn timer expires.
*   **Verification:** TDD unit test added to simulate typing faster than the spawn timer.

### 3. Infinite Deflector Shield
*   **Issue:** The deflector shield active timer was incorrectly trying to increment `deflectorCharge` instead of decrementing `deflectorActiveTime`, resulting in the shield staying active forever.
*   **Fix:** Replaced the corrupted logic block with a proper `dt` countdown that triggers the cooldown phase when `deflectorActiveTime <= 0`.
*   **Verification:** TDD unit test added to verify the 5-second countdown and cooldown transition.

### 4. Player Ship Rotation
*   **Issue:** The player ship's dynamic rotation (`Math.atan2` targeting) was accidentally deleted during a previous refactor, causing the ship to always point straight up (0 radians).
*   **Fix:** Restored the `targetAngle` calculation and interpolation logic.
*   **Verification:** TDD unit test added to verify ship angle changes upon typing.

### 5. Dynamic Difficulty & Deflector Balancing
*   **Feature Update:** The Dynamic Difficulty Adjustment (DDA) algorithm for Enemy Density was updated. It now enforces a *strict* hard cap, pausing all enemy spawns entirely if the screen is too crowded for the player's current health. Additionally, the density floor at critical health was lowered from 5 to 4 enemies to grant more breathing room.
*   **Feature Update:** The Deflector Shield 5-second cooldown was completely removed, allowing players to instantly begin recharging it once it expires during Boss encounters.
*   **Verification:** TDD unit tests modified and added to strictly verify the `<= 4` spawn hard cap and the `0` cooldown on boss levels.

### 6. Balancing and UI Polish
*   **Feature Update:** Reduced Dreadnought turret fire rate to `0.15` and added 2 new erratic strafing patterns (total 5).
*   **Feature Update:** Added real-time `displayWpm` and `wordsTyped` metrics to the `BRANCHING` state (end of level screen).
*   **UI Tweaks:** Increased opacity of the textbot progress fill from `0.15` to `0.35` and brightened untyped text color from `#555555` to `#aaaaaa` for better readability.
*   **Security:** Performed STRIDE threat model assessment, added Pydantic input validation, sanitization, and IP rate limiting to `api/index.py`.

### 7. Background Prefetch & Defeat Metrics
*   **Issue:** The 70% threshold background prefetch mechanism was accidentally disabled due to an incorrect, nested guard clause (`!this.prefetchTriggered`), causing the game to infinitely hang waiting for choices that were never requested.
*   **Issue:** The "Words Typed" metric on the Mission Failed screen was incorrectly inflating its count by measuring the total `fullStoryHistory` length (which included LLM action summaries and unplayed level text), instead of exactly what the player typed.
*   **Issue:** Level 1 text was being duplicated in the story history, causing the Mission Failed screen to leak untyped narrative snippets to the player upon death.
*   **Fix:** Removed the redundant guard clause to restore seamless prefetching. Introduced a precise `cumulativeTypedChars` tracker to guarantee exactly 0 words typed if the player dies immediately, and removed the duplicate append logic.
*   **Verification:** TDD unit tests added to rigorously verify prefetch execution and strict 0-word Mission Failed edge cases.

## Phase 7: LLM Evaluation & Terminology Overhaul [COMPLETED]
*   **Evaluation Engine:** Created a pure Python LLM-as-a-judge evaluation suite (`tests/eval/run_evals.py`) to systematically grade the Game Master agent's JSON outputs against negative containment constraints.
*   **True Negative Testing:** Designed a robust dataset (`basic-dataset.json`) featuring "True Positive" cases (grading the live agent) and "True Negative" cases (injecting intentional bad JSONs to test the Judge's ability to catch rule violations).
*   **Dynamic Rubric:** Refactored `api/agent.py` to extract `SYSTEM_PROMPT` into a global constant, allowing the Judge to dynamically read and grade based on the exact same constraints given to the Agent.
*   **Terminology:** Executed a global refactor across the entire codebase and documentation, replacing all instances of "round" with "level" to unify the game's internal and external language.

## Phase 7.5: Architecture Security & DevOps Polish [COMPLETED]
*   **Code Standards:** Introduced stringent rules into `.agents/AGENTS.md` to enforce `isort` and `black` for Python formatting, and `ESLint` for TypeScript to prevent 'Vibe Coding'.
*   **Dependency Management:** Split requirements into production (`requirements.txt`) and development (`requirements-dev.txt`), strictly pinning exact versions of FastAPI, Pydantic, Uvicorn, and GenAI to guarantee deterministic Vercel deployments.
*   **Threat Model Optimization:** Updated the `threat_model.md` to document our mitigations against Supply Chain Tampering (pinned dependencies) and Prompt Injection (offline LLM evaluation guardrails).
