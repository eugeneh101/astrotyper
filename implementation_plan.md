# Implementation Plan: Zero-Latency Sci-Fi Typing RPG

The Game Design Spec is fully complete and approved. This document outlines the technical architecture and the step-by-step implementation phases required to build the game.

## User Review Required
> [!IMPORTANT]
> Please review this implementation plan. Once approved, I will begin scaffolding the Next.js frontend and the Python ADK backend in the target directory.

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

### Phase 0: The Agentic Foundation
*   Create the `.agents/AGENTS.md` file to strictly enforce TypeScript, testing rules, and modular decoupling for all future subagents working on this codebase.
*   Build the `evaluate_narrative` Python script (LLM-as-a-judge) to deterministically test that the Gemini prompts successfully generate 3 distinct archetypes without breaking the 4th wall.

### Phase 1: Project Scaffolding
*   Use `npx create-next-app` to scaffold a clean Next.js repository in the workspace.
*   Set up the `/api/python` directory for the backend.
*   Configure the Python virtual environment, install the Google ADK and `google-genai` SDK, and create a `requirements.txt`.
*   Create the `vercel.json` to properly route API requests to the Python functions.
*   **Centralized Configuration:** Create a `.env.local` file for backend secrets (`GEMINI_API_KEY`, `GEMINI_MODEL`, `API_TIMEOUT_MS`) and a frontend `gameConfig.ts` file to expose all mechanical tuning dials.

### Phase 2: The ADK "Game Master" Backend
*   Build the core ADK Agent (`agent.py`).
*   Define the `GameMasterRequest` and `GameMasterResponse` Pydantic schemas to strictly enforce the JSON structure coming back from Gemini.
*   Implement the core prompt logic:
    *   **Round 1 Generation:** Randomly selecting from the 7 sub-genres and generating 3 hooks.
    *   **Round 2+ Generation:** Using the WPM Tiers to target the exact word counts, and using the Dynamic Archetype pool to force narrative divergence.
    *   **The Game Over Generation:** The 2-sentence tragic death prompt.
*   Build the Flask/FastAPI endpoint to bridge Next.js with the ADK.

### Phase 3: The HTML5 Canvas Game Engine
*   Build the `GameEngine` class to manage the 60fps loop.
*   Implement the Scrolling 2D Starfield renderer.
*   Implement the **Typing Mechanics**: Mapping keyboard events to the current active word, tracking correct/incorrect strokes for the Combo Multiplier.
*   Implement **Entities**:
    *   Player Ship (Animations, Combo-scaling Lasers, Death Blossom spin).
    *   Enemy Ships (Round 1 Rushers, Round 2+ Shooters, Health mapping to letters).
    *   The Final Boss (Massive sprite, multi-component hitboxes mapped to the final sentences, bullet hell projectiles, Standoff state).

### Phase 3.5: Visual & Animation Overhaul (NEW)
*   **Player Ship Movement:** Calculate the trajectory vector to the active enemy and use linear interpolation (`lerp`) to smoothly rotate the player's ship to aim directly at them before firing.
*   **Player Ship Thrusters:** Added animated cyan plasma thruster flames at the rear of the player's ship that flicker and thrust against the scrolling starfield.
*   **Upgraded Laser VFX:** Replace the simple blue dot with a high-velocity, glowing plasma bolt (capsule shape) featuring a bright core and an outer neon bloom.
*   **Upgraded Enemy Sprite:** Replaced the flat red triangle with a stylized, multi-layered geometric dreadnought featuring swept wings, glowing cockpit cores, neon wing-vents, and flickering gradient exhaust trails.
*   **Crash & Explosion Animations:** When an enemy hits the shield or is destroyed, spawn an `Explosion` entity that renders expanding, fading particle debris.
*   **Critical Shield States & Dynamic Integrity:** As the player's health drops from 100% to 25%, the shield ring physically shrinks (from 5px to 1px) and its color smoothly interpolates from Cyan to Yellow to Orange. When health drops below 25%, a critical warning state triggers: the screen edges pulse with a red vignette, and a glowing, glitching red sphere renders around the player ship.
*   **Game Over Physics & Cinematic Death:** When the player dies, a massive cinematic `PlayerDeathExplosion` is triggered, featuring expanding shockwaves, dark smoke clouds, high-velocity shrapnel sparks, and shattered hull debris that spins into the void. Enemies immediately detach, lose their UI/exhaust elements, and coast downward along their last known trajectory vectors.

### Phase 4: The Zero-Latency Narrative Loop & Backend Security (Integration)
*   **Backend Security Mitigations (STRIDE):**
    *   **Rate Limiting:** Implement a lightweight IP-based rate limiter on the `/api/generate` endpoint to protect the Gemini API quota from DoS attacks.
    *   **Input Validation:** Implement strict Pydantic `Field` boundaries (e.g., max lengths for `story_so_far`, reasonable int bounds for `player_wpm`) to prevent prompt tampering.
    *   **Error Sanitization:** Catch explicit exceptions in `api/index.py` and return generic, safe error messages to the client rather than exposing raw stack traces.
*   **Frontend Integration:**
    *   Build the overarching React container (`<Game />`).
    *   Implement the WPM Calculator.
    *   Implement the **70% Trigger Logic**: When the player reaches 70% of the current text wave, React asynchronously fetches (`fetch('/api/generate')`) the next story segment from the Python backend without pausing the Canvas loop.
    *   Implement the End Screen cinematic scroll and the `.txt` download blob.

### Phase 5: Polish and The Browser Subagent QA
*   Inject the epic CSS design system (neon glowing text, retro-futuristic UI elements).
*   **The Browser Subagent QA:** We will leverage Antigravity's `browser_subagent` tool. The agent will physically open a Chromium browser, navigate to the local dev server, and *actually play the game* by simulating rapid keystrokes. This automatically records a WebP video of the session so you can sit back and watch the AI playtest its own game!
*   (Stretch Goal) Implement the "Auto-Dodging" ship movement logic based on typing combo.
*   (Stretch Goal) Wire up browser-native Speech Synthesis (or Gemini TTS) to read the final story at the End Screen.

---

## Open Questions
*   **Rate Limiting Architecture:** For the IP-based rate limiting on Vercel Serverless, we have two options:
    1.  **In-Memory Dictionary (Fast/Free):** A simple Python dictionary tracking IPs. It is slightly leaky (because Vercel spins up multiple parallel serverless instances that don't share memory), but it requires zero setup and effectively stops massive single-instance abuse.
    2.  **Upstash Redis / Vercel KV (Robust):** True global rate limiting. It requires you to click a few buttons in your Vercel Dashboard to enable Vercel KV or Upstash, and then pass me the connection string.
    *Which route would you prefer for the MVP?*
