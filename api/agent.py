import os
import random
from typing import List
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# Define Output Schemas
class Branch(BaseModel):
    action_summary: str = Field(description="A short 1-sentence hook or action summarizing this path.")
    full_narrative: str = Field(description="The complete narrative text for this path.")

class GameMasterResponse(BaseModel):
    branches: List[Branch] = Field(description="List of narrative branches.")

# Predefined Archetypes and Genres
GENRES = [
    "Space Western (Smugglers, bounty hunters, lawless frontiers)",
    "Sci-Fi Noir / Cyberpunk (Gritty detectives in neon cities)",
    "Sci-Fi Horror (Creeping dread, abandoned space stations)",
    "Sci-Fi Romance (Star-crossed lovers, saving a companion)",
    "Space Opera (Grand political intrigue, galactic empires)",
    "Military Sci-Fi (Tactical battles against alien invasions)",
    "Cosmic Mystery (Decoding strange alien signals or anomalies)"
]

ARCHETYPES = [
    "Aggressive / Combat (Direct confrontation, brute force)",
    "Stealth / Evasion (Sneaking, hiding, running away)",
    "Diplomacy / Bluffing (Talking, negotiating, deceiving)",
    "Technological / Hacking (Overriding systems, slicing terminals, deploying drones)",
    "Environmental / Tactical (Using the surroundings, e.g., shooting a coolant pipe)",
    "Reckless / Chaotic (Highly unpredictable, desperate maneuvers)",
    "Sacrificial / Heroic (Taking a hit to save someone, drawing fire)",
    "Psionic / Alien (Using weird artifacts, telepathy, or unknown tech)"
]

def get_target_words(wpm: int) -> int:
    """Calculate the target word count for the next level based on WPM."""
    if wpm < 40:
        return 45
    elif wpm < 70:
        return 90
    elif wpm < 90:
        return 90
    else:
        return 120

from dotenv import load_dotenv
load_dotenv(".env.local")

def generate_narrative(story_so_far: str, player_health: int, player_wpm: int, current_level: int) -> GameMasterResponse:
    # Initialize the Gemini Client
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    model_name = os.environ["GEMINI_MODEL"]

    system_prompt = (
        "You are a gritty, epic sci-fi narrator. You must strictly output JSON matching the provided schema. "
        "NEVER break the 4th wall. NEVER reference the player typing, WPM, rounds, or game mechanics. "
        "CRITICAL: You MUST use ONLY standard ASCII characters. Do NOT use smart quotes (‘, ’, “, ”), em-dashes (—), or any non-ASCII typography. Use standard straight single quotes (') and double quotes (\")."
    )

    prompt = ""
    
    # 1. Tragic Death Scenario
    if player_health <= 0:
        prompt = (
            f"The story so far: {story_so_far}\n\n"
            "The protagonist has just suffered a fatal blow and died. Generate a 2-sentence tragic ending "
            "based on the context of their death. Return a single branch."
        )
    # 2. Main Menu (Level 1 Hooks)
    elif current_level <= 1 and not story_so_far:
        selected_genres = random.sample(GENRES, 3)
        prompt = (
            "Generate 3 completely distinct sci-fi seed stories (hooks). "
            "Each branch must belong to one of these 3 sub-genres: "
            f"1) {selected_genres[0]}, 2) {selected_genres[1]}, 3) {selected_genres[2]}.\n"
            "The 'full_narrative' for each must be exactly ~90 words establishing the setting and immediate danger."
        )
    # 3. Mid-Game Branching
    else:
        selected_archetypes = random.sample(ARCHETYPES, 3)
        target_words = get_target_words(wpm=player_wpm)
        prompt = (
            f"The story so far: {story_so_far}\n\n"
            "Continue the narrative from this exact moment. Generate 3 distinct branching choices. "
            "Each branch must follow one of these 3 archetypes to ensure divergence: "
            f"1) {selected_archetypes[0]}, 2) {selected_archetypes[1]}, 3) {selected_archetypes[2]}.\n"
            f"The 'full_narrative' for each branch must be approximately {target_words} words."
        )

    max_retries = 3
    for attempt in range(max_retries):
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=GameMasterResponse,
                temperature=0.7,
            ),
        )
        
        # Parse the structured output
        parsed_response = GameMasterResponse.model_validate_json(response.text)
        
        # Validation: check if all strings are ASCII
        is_ascii = True
        for branch in parsed_response.branches:
            if not branch.action_summary.isascii() or not branch.full_narrative.isascii():
                is_ascii = False
                break
                
        if is_ascii:
            return parsed_response
            
        print(f"Warning: Non-ASCII characters detected in attempt {attempt + 1}. Retrying...")

    # If we exhaust retries, sanitize it manually to guarantee ASCII compliance
    for branch in parsed_response.branches:
        branch.action_summary = branch.action_summary.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"').replace("—", "-")
        branch.action_summary = "".join(c for c in branch.action_summary if c.isascii())
        
        branch.full_narrative = branch.full_narrative.replace("‘", "'").replace("’", "'").replace("“", '"').replace("”", '"').replace("—", "-")
        branch.full_narrative = "".join(c for c in branch.full_narrative if c.isascii())
        
    return parsed_response
