# Technical & Game Design Specification

## 1. System Architecture (Vercel + Python)
To fulfill your requirement of a **Python AI Agent backend** hosted on a **single free Vercel website**, we will use Vercel's Python Serverless Function capabilities. Here is exactly how the languages and frameworks interact:

*   **The Frontend (TypeScript/React/Next.js):** This is the visual game client your friends will interact with in their browser. It handles the HTML5 Canvas rendering (the Top-Down 2D graphics), captures keyboard input, and manages the homing missiles. 
*   **The Backend Agent (Python/FastAPI/Google ADK):** Vercel allows us to create an `/api` folder containing Python files. When the frontend needs the next story beat, it makes an HTTP request to this Python endpoint. Vercel spins up a lightweight Python environment to run our ADK Agent. The Agent uses the Gemini API to do the heavy lifting, structures the response, and sends it back to the React frontend as JSON. 
*   **The Benefit:** Everything lives in one repository and is deployed with a single click to Vercel, completely for free.

> [!WARNING]
> **Vercel Hobby Tier Timeout Constraint**
> Vercel's free tier has a strict **10-second timeout** for serverless functions. When the player makes a choice, our Python backend must prompt Gemini and return the response within 10 seconds. Gemini is typically very fast, but we must keep our prompts optimized and avoid overly complex multi-agent LangGraph chains that might exceed this time limit.

## 2. Core Game Mechanics (The "Strategic RPG" Vibe)
*   **Visuals & UI:** Top-Down 2D HTML5 Canvas. Cool blue/green holographic UI.
    *   *The Text Box:* The story text is anchored at the bottom center of the screen (optimized for a comfortable reading width) so the player can easily read ahead while tracking the combat above. It displays a static block of 2 to 3 lines at a time. To prevent eye strain, the text does *not* continuously scroll like a ticker or Star Wars crawl. Instead, when the player finishes typing a line, the entire block of text shifts up by exactly one line, keeping the active word in a consistent position.
    *   *Widescreen Optimization:* Since most monitors are 16:9, the left and right flanks of the screen will house immersive holographic UI elements to maximize real estate. The left side will feature a real-time WPM line graph and Combo Multiplier. The right side will feature a massive, vertical Player Health/Shield pillar and a Narrative Progress bar.
    *   *Round Transitions & Backgrounds:* Each round features a distinct, auto-scrolling parallax background to signify narrative progression (e.g., Deep Space -> Atmosphere -> Cityscape -> Reactor Core). Between rounds, the player's ship performs a cinematic "Warp" animation (stretching and blasting upward in a flash of light) to seamlessly load the next environment.
*   **Enemies & Combat:** The visual design of the enemies is *not* tied to the length of the word they carry. Enemies are drawn as sleek, dark multi-layered dreadnoughts with swept-back wings, glowing red cockpit cores, neon wing-vents, and flickering orange/white gradient exhaust trails.
    *   **Enemy Type Behaviors:**
        *   *Kamikaze:* Rushes straight down the screen to crash into the player. Does not shoot. These targets dynamically swoop in from the far edges (off-screen) to utilize the full width of the monitor.
            *   *Variant: The Nitro Kamikaze:* Introduced in later rounds, this variant behaves normally until it suddenly flashes blue and engages a short "nitro boost," instantly covering a large chunk of screen distance in a split second before returning to normal speed. Because you type sequentially, this sudden dash creates massive panic, forcing you to rapidly clear the preceding words in the queue so your ship can target the Nitro Kamikaze before it crashes into you!
        *   *Shooters:* Hang back at the top/middle of the screen, strafing side-to-side. They *never* kamikaze. They enter the combat zone via a sudden sci-fi "warp-in" animation. **The Charge Attack:** Since the player's ship is stationary and cannot dodge, Shooters do not fire slow, damaging bullet-hell projectiles at the player. Instead, they begin charging an un-dodgeable laser beam (acting as a visual timer). The player must type fast enough to reach that Shooter's word in the paragraph and destroy it before the laser fires! To maintain the "bullet hell" visual aesthetic, Shooters will constantly fire harmless "scatter shots" that intentionally miss the player and explode in the background.
    *   **Round 1:** 1 Enemy Type (Kamikaze only).
    *   **Round 2:** 2 Enemy Types (Kamikaze + Shooter A).
    *   **Round 3:** 
        *   *Slow/Medium Typers:* The Final Boss.
        *   *Fast/Very Fast Typers:* 3 Enemy Types (Kamikaze + Shooter A + Shooter B). 
            *   *Shooter B (The Scrambler):* To increase the difficulty for fast typers without being overly punitive, Shooter B does not deal health damage or destroy combos (there are no EMPs). Instead, if its Charge Timer finishes, it launches a "Scrambler" attack. This temporarily glitches the *next* word in the story text box (turning it into random symbols like `$#@%&`) for 1.5 seconds. However, if the player remembers the word, they can still type the correct characters to progress! It becomes a thrilling test of short-term memory rather than a forced pause.
    *   **Round 4 (Fast/Very Fast Only):** The Final Boss.
    *   **The Final Boss Mechanic:** At the end of the final round, a massive "Boss" ship spawns. Instead of each word being a separate ship, the entire final sentence (or two) of the story belongs to this single Boss. As the player types the words, they systematically deal damage to the Boss's health pool to win the game!
        *   **Dynamic Encounters:** The boss encountered is dynamically selected based on the player's WPM. Slow/Medium typers face the **Cybernetic Dreadnought** (Tech mechanics: Core Obliteration Laser, Turret Bullet Hell). Fast/Very Fast typers face the **Abyssal Bio-Entity** (Organic mechanics: Spinning Toxic Danmaku, QTE Beam Attack, Black Hole Spaghettification death).
        *   **The Standoff:** During the Boss fight, the scrolling/forward movement stops. It is a static standoff where the Boss and the player's ship are duking it out face-to-face. The Boss fires multiple different projectiles that the player must manage while frantically typing the final sentence to destroy the Boss's components.
        *   **Overcharge Deflector Shield:** To prevent instant death during boss fights, the player builds up a "Deflector Charge" meter by typing rapidly and accurately. Once full, an Energy Deflector Shield expands outward for 5 seconds, vaporizing all incoming bullet hell projectiles and allowing the health shield to regenerate.
        *   **Cinematic Finisher (Death Blossom):** When the Boss's health reaches 0, the final correct keystroke triggers the ultimate cinematic finisher where the player's ship spins rapidly, firing a massive screen-filling radial pattern of plasma bolts that obliterate the boss.
*   **Progression & Health (Regenerating Shields):** The player has a Shield/Life bar (not discrete hearts) and can take some damage during a round. If the player takes damage from a Kamikaze or a Shooter's Charge Laser, the shield depletes. However, if the player avoids taking damage for 5 consecutive seconds, their ship's shields will automatically begin to recharge (healing at a slow rate of 2 points per second) until they are struck again. There are no other power-ups to keep the focus on the narrative and survival.
    *   **Dynamic Visual Feedback:** To instantly communicate shield integrity without the player looking away from the action, the shield ring dynamically scales. At 100% health, it is a thick, 5-pixel glowing Cyan aura. As health drops, the ring shrinks to a 1-pixel hairline and smoothly shifts color from Cyan -> Yellow -> Orange. If health drops below 25%, a critical warning state triggers: the screen edges pulse with a red vignette, and the shield glitches out as a trembling, semi-transparent red sphere.
*   **Pacing & The Threat of Death:** The game dynamically calculates the player's WPM, but to maintain intense suspense, it does not just match it perfectly. 
    *   **Dynamic Spawning (Threat Scaling):** **Shooters** are the "Dangerous" elite units (because their Charge Attack creates immediate, high-stress timers), while **Kamikazes** are the weaker "Grunt" units (they take time to travel down the screen). If the player is doing very well (high WPM, high combo), the engine dynamically spawns a higher ratio of Shooters, forcing the player to defuse overlapping charge timers. If the player is struggling, the engine dials back the Shooters and spawns mostly Kamikazes. The player can still easily lose if they do badly, as Kamikazes will eventually crash into them, but the immediate timer stress is reduced.
    *   **The Burst Mechanic:** The game periodically spawns "Bursts" where enemies spawn 15% faster than the player's average speed. This forces the player to push beyond their comfort zone. 
    *   **The Climax:** After Round 2, the game locks in the highest established pace for the Climax. The game will *not* slow down if the player gets fatigued.
*   **Combat Loop (Zero-Latency Architecture):**
    *   **Sequential Typing (No Manual Targeting):** The player does *not* choose which enemy to shoot. The player simply reads and types the story sequentially from the text box at the bottom of the screen. Each word in the story is intrinsically linked to a spawned enemy. As the player types the next word in the story, their ship automatically targets and shoots the corresponding enemy.
    *   **Typing Rules (Punctuation & Capitalization):** To make it feel like an authentic typing experience, players must type capital letters, spaces, commas, and periods (ASCII only). However, to prevent frustration, the game engine will automatically strip out complex LLM punctuation (like em-dashes, semicolons, and quotation marks) before rendering the text.
    *   **Typo Handling (No Backspace Required):** The player does *not* need to use the Delete/Backspace key. The text box displays a single unified block of text (untyped characters are grey, correctly typed characters turn glowing green). If the player presses a wrong key, the game registers a "Typo" (the combo multiplier breaks, weapons power down, and the active letter flashes red), but the wrong character is simply ignored. The player just presses the correct key to continue. This prevents the flow-breaking frustration of having to backspace during a fast-paced action sequence.
    *   **Punctuation & Space Mapping (Tokenization):** To ensure the UI looks clean and typing feels intrinsically linked to the combat, spaces are completely decoupled from the enemy ships themselves.
        *   **The Enemy Label:** The text rendered above the enemy is strictly the alphanumeric word and its trailing punctuation (e.g., `Fire` or `lasers,`). Typing the letters fires lasers. Typing the final character destroys the enemy.
        *   **The Spacebar Trigger:** The space character is *not* associated with an enemy, but it *must* still be physically typed by the player to progress the global sentence! After an enemy is destroyed, the player must hit the spacebar to advance the cursor. This spacebar stroke simply increases the combo and acts as a "target lock" trigger, causing the player's ship to dynamically rotate and acquire the *next* enemy. 
        *   **HUD Visuals:** The story text box displays the entire sentence. The active character is highlighted with a glowing cyan cursor block. If the active character is a space, the game renders a prominent cyan underscore `_` to make it unmistakably obvious that a spacebar hit is required.
    *   **Collisions & Explosions:** Enemies are destroyed the moment they touch the *outer radius* of the player's shield (the engine calculates collision at exactly 95px away from the center to account for the 80px shield radius + the 15px enemy nose cone). A crashing enemy triggers a massive red explosion and permanently anchors to the outer edge of the shield as a "Leech." It does NOT deal any initial burst impact damage. Instead, it continuously drains 10 health per second (and spawns tiny red damage sparks) until the player types its word to destroy it point-blank.
    *   **Game Over Sequence:** When the player reaches 0 health, the engine immediately enters a 'GAMEOVER' state and triggers a massive cinematic PlayerDeathExplosion. This explosion features expanding cyan/white shockwaves, shattered hull debris that spins off into the void, billowing smoke clouds, and high-velocity shrapnel sparks that streak completely off the screen. All UI elements on enemies (text boxes, exhaust trails) instantly disappear. All enemies disengage, stop homing, and coast along their last known trajectory vector until they fly off the screen, allowing the camera to linger on the smoking ruins.
    *   **Ship Movement:** The player's ship remains relatively stationary at the bottom center of the screen but smoothly rotates (`lerps`) to point at whichever enemy is currently being targeted by the sequential typing. 
    *   **Homing Shots:** The player's shots (lasers/letters) are homing. Even if the targeted enemy (like a Shooter) strafes, the shot will curve and hit it.
    *   **Stretch Goal (Auto-Dodging):** Later, we can add a visual flair where the stationary ship slightly shifts or "auto-dodges" incoming projectiles based on high typing accuracy, taking damage if the player hesitates or makes a typo.
    *   **Player Weapons (Combo-Scaling):** The player's projectiles are classic sci-fi lasers, but their visual intensity scales with the typing combo (error-free typing). For example: 0-10 combo fires thin blue lasers, 11-30 combo fires solid green plasma with particle trails, and 30+ combo fires massive, screen-shaking red energy beams.
    *   **The Death Blossom:** When the player types the very final word of the Boss fight (the killing blow), their ship performs a 360-degree spin and unleashes a blinding barrage of lasers in all directions. This instantly destroys all remaining bullet-hell projectiles and obliterates the Boss in a cinematic explosion.
    1.  A "Round/Wave" begins. The player is typing the story option they selected in the previous round (about 10 sentences long, taking 1-2 minutes).
    2.  **Background Prefetching (The 70% Trigger):** To accurately measure the player's Words Per Minute (WPM), the game tracks their typing speed throughout the round. When the player reaches **70% completion** of the current wave, the frontend calculates their running average WPM and fires **one** asynchronous API request to the Python Agent. This provides an accurate WPM to the Agent while still giving the LLM enough time to generate the next choices before the player finishes the final 30% of the text.
    3.  **Gameplay:** While the backend generates the next branches, the player fights the current wave. Enemies spawn with words above them. The player types the letters to shoot homing missiles; the last letter destroys the enemy. The full story sentences are clearly visible at the bottom of the screen so the player can type quickly and read ahead.
    4.  **Path Selection:** When the wave is cleared, the 3 `action_summary` choices appear. The player types out the summary (e.g. "Evasive maneuvers") to select that path. The `full_narrative` of that path instantly becomes the text for the next wave!
    5.  **Zero-Latency Transition:** Once they begin typing an option, the game instantly transitions to the new wave (since the text is already loaded) and the cycle repeats!

## 3. The "Game Master" Agent (Python)
To ensure the game doesn't break, the LLM cannot return raw text; it must return structured data that the game engine can parse. We will use Gemini's **Structured Outputs (JSON Schema)** feature.

**System Prompt Constraints:**
*   **No 4th Wall Breaks:** The LLM will be instructed to act strictly as a gritty/epic sci-fi narrator. It must never reference the game mechanics, the player typing, or the concepts of "rounds" or "WPM".
*   **Dynamic Archetype Divergence:** To guarantee the 3 choices feel like meaningful, distinct branching paths, the game engine will randomly select **3 archetypes** from a predefined pool and pass them to the ADK Agent for each round. The LLM must map its 3 generated choices to these specific archetypes. The pool includes:
    *   *Aggressive / Combat* (Direct confrontation, brute force)
    *   *Stealth / Evasion* (Sneaking, hiding, running away)
    *   *Diplomacy / Bluffing* (Talking, negotiating, deceiving)
    *   *Technological / Hacking* (Overriding systems, slicing terminals, deploying drones)
    *   *Environmental / Tactical* (Using the surroundings, e.g., shooting a coolant pipe)
    *   *Reckless / Chaotic* (Highly unpredictable, desperate maneuvers)
    *   *Sacrificial / Heroic* (Taking a hit to save someone, drawing fire)
    *   *Psionic / Alien* (Using weird artifacts, telepathy, or unknown tech)

**Input from Client (Fired asynchronously during gameplay):**
```json
{
  "story_so_far": "...",
  "player_health": 80,
  "player_wpm": 75,
  "current_round": 2
}
```

**Output from Python Agent (Enforced via Gemini JSON Schema):**
The agent returns 3 distinct narrative branches. Each branch contains a short action summary AND the full 10-sentence story for that path.
```json
{
  "branches": [
    {
      "action_summary": "Evasive maneuvers",
      "full_narrative": "You punch the thrusters, banking hard to the left as lasers scorch the hull. The G-forces press you into your seat, but you manage to slip through the asteroid field unharmed..."
    },
    {
      "action_summary": "Counter-attack with heavy lasers",
      "full_narrative": "Rerouting power to the forward batteries, you unleash a blinding beam of plasma..."
    },
    {
      "action_summary": "Attempt diplomacy transmission",
      "full_narrative": "You broadcast a universal peace signal on all frequencies, lowering your shields as a sign of goodwill..."
    }
  ]
}
```

## 4. Agentic Engineering: Final Architecture & Framework
Per your requirements, the entire application will be deployed as a single project on **Vercel** without relying on GCP Cloud Run.

**Google ADK (Agent Development Kit):** We will use Google's ADK for the Python backend agent to manage the narrative generation. To respect Vercel's 10-second execution limit on free serverless functions, we will keep the agent's logic lightweight. The agent's memory will simply be the "story so far." When a player commits to a path, the other 2 speculative paths are discarded to maintain a coherent narrative context.

## 5. Game Length & Adaptive Pacing
*   **Round 1 Baseline (The Calibration Round):** Round 1 (The Beginning) will always target **~90 words**. At the 70% mark, the game calculates WPM. The ADK Agent uses this to generate Round 2 (The Middle) with a target word count based on the player's tier.
*   **The Round 2 Decision Point (The 4 Tiers):** The total number of rounds is not locked in until the 70% mark of Round 2. The game calculates the *new* running average WPM to determine the structure for Round 3:
    *   **Slow (20-39 WPM):** 3 rounds total. Round 3 is the combined **Climax & Ending** (~45 words per round for R2 and R3). Game ends after Round 3. Total Words: ~180.
    *   **Medium (40-69 WPM):** 3 rounds total. Round 3 is the combined **Climax & Ending** (~90 words per round for R2 and R3). Game ends after Round 3. Total Words: ~270.
    *   **Fast (70-89 WPM):** 4 rounds total. Round 3 is the **Climax**. Round 4 is the **Ending** (~90 words per round for R2, R3, R4). Total Words: ~360.
    *   **Very Fast (90+ WPM):** 4 rounds total. Round 3 is the **Climax**. Round 4 is the **Ending** (~120 words per round for R2, R3, R4). Total Words: ~450.
*   **Why Target Words?** By giving the LLM a target word count rather than an exact time limit, we ensure the narrative is structurally complete when prefetched. This adaptive system guarantees the total gameplay time stays consistently around 4-6 minutes for *everyone*, but faster typists get a richer, more detailed story.
*   **The End Screen (Victory or Defeat):** 
    *   *If the player wins*, they are presented with a cinematic scroll of the full, unique story they just typed out.
    *   *If the player dies* (life bar hits zero), the game makes one final, rapid API call to generate a **2-sentence tragic ending** based on the exact context of their death. The game then proceeds to the exact same End Screen scroll, appending the tragic death.
    *   In both scenarios, there is a **"Download Story"** button allowing the player to save their unique tale as a `.txt` file.
*   **Stretch Goal (TTS):** Integrate Gemini's Text-to-Speech (or browser-native Speech Synthesis) to read the entire completed story aloud in an epic voice at the end of the game.

## 6. The Starting Hook (Main Menu)
When the game first loads, the backend randomly selects **3 distinct sub-genres** from a predefined list and prompts the ADK Agent to generate **3 distinct "Seed Stories"**.
*   **The Genre Pool:** The game will pull from the following sci-fi sub-genres to ensure massive replayability:
    *   *Space Western* (Smugglers, bounty hunters, lawless frontiers)
    *   *Sci-Fi Noir / Cyberpunk* (Gritty detectives in neon cities)
    *   *Sci-Fi Horror* (Creeping dread, abandoned space stations)
    *   *Sci-Fi Romance* (Star-crossed lovers, saving a companion)
    *   *Space Opera* (Grand political intrigue, galactic empires)
    *   *Military Sci-Fi* (Tactical battles against alien invasions)
    *   *Cosmic Mystery* (Decoding strange alien signals or anomalies)
*   The game displays the `action_summary` (the hook or first sentence) of the 3 generated seeds on the Main Menu so the player can see exactly what kind of narrative flavor they are getting into.
*   The player starts the game by **typing** the hook of the seed they want. 
*   Once typed, the 90-word `full_narrative` of that chosen seed immediately begins as Round 1, and enemies start spawning. 
*   The other 2 unchosen seed stories are permanently discarded from the ADK Agent's memory graph.

---
> [!IMPORTANT]
> ### 🚀 Ready to Execute?
> The technical spec and game design are locked in. Everything will be built in one Vercel Next.js repository with a Python backend using the Gemini API. 
> 
> Review the JSON structure in Section 3 to ensure the game loop logic is exactly what you want. If it looks good, give me the green light and I will scaffold the project and start writing the code!
