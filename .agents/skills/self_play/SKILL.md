---
name: self-play
description: A skill to autonomously play the AstroType game in a Chromium browser at a specific WPM.
---

# AstroType Self-Play Bot

When the user asks you to "play the game yourself", "self play", or "test the game at X WPM", follow these exact instructions:

## 1. Do Not Install Puppeteer
You do NOT need to install any external dependencies or run node scripts. The game engine has a native, headless-bot mode built directly into it.

## 2. Launch the Browser Subagent
You must invoke your `browser_subagent` tool to physically open a Chromium browser and navigate to the game. The subagent will record a WebP video of the gameplay.

- **Task Summary:** "Self-Play Bot Test"
- **TaskName:** "Run Native Bot at [X] WPM"
- **Task:** 
  "Navigate to `http://localhost:3000?bot=[X]` (replace [X] with the requested WPM, e.g., 100). The game will automatically start playing itself! You do not need to type anything. Just let the game run continuously. There is no need to wait for the final state (GAMEOVER or VICTORY) unless explicitly requested."
- **RecordingName:** "self_play_bot_[X]wpm"

The subagent will open the URL and the game will mathematically simulate keystrokes at the exact requested WPM. The subagent runs as a background task, so you will receive a Task ID.

## 3. Terminating Self-Play
If the user asks you to "terminate", "stop playing", or "stop the bot", you should immediately use the `manage_task` tool with `Action: "kill"` and provide the Task ID of the running browser subagent. This will close the browser and end the session.
