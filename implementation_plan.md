# Implementation Plan: Centralized Configuration & Stability Polish

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
