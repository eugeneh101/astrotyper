import json
import os
import random
from typing import List

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel, Field

load_dotenv(".env.local")
config_path = os.path.join(os.path.dirname(__file__), "..", "config", "narrative.json")
with open(config_path, "r") as f:
    narrative_config = json.load(f)

GENRES = narrative_config["genres"]
ARCHETYPES = narrative_config["archetypes"]

GEMINI_API_KEY = os.environ["GEMINI_API_KEY"]
GEMINI_MODEL = os.environ["GEMINI_MODEL"]

GEMINI_CLIENT = genai.Client(api_key=GEMINI_API_KEY)

SYSTEM_PROMPT = (
    "You are a gritty, epic sci-fi narrator. You must strictly output JSON matching the provided schema. "
    "NEVER break the 4th wall. NEVER reference the player typing, WPM, levels, or game mechanics. "
    "CRITICAL: You MUST use ONLY standard ASCII characters. Do NOT use smart quotes (‘, ’, “, ”), em-dashes (—), or any non-ASCII typography. Use standard straight single quotes (') and double quotes (\"). "
    "Keep each 'action_summary' very concise (10 words maximum)."
)


# Define Output Schemas
class Branch(BaseModel):
    action_summary: str = Field(
        description="A short 1-sentence hook or action summarizing this path."
    )
    full_narrative: str = Field(
        description="The complete narrative text for this path."
    )


class GameMasterResponse(BaseModel):
    branches: List[Branch] = Field(
        min_length=3, max_length=3, description="List of exactly 3 narrative branches."
    )


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


def generate_seed_stories(
    selected_genres: list[str] = None, max_retries: int = 3
) -> GameMasterResponse:
    genres_to_use = selected_genres if selected_genres else random.sample(GENRES, 3)
    prompt = (
        "Generate 3 completely distinct sci-fi seed stories. "
        "Each branch must belong to one of these 3 sub-genres: "
        f"1) {genres_to_use[0]}, 2) {genres_to_use[1]}, 3) {genres_to_use[2]}.\n"
        "CRITICAL INSTRUCTION: You must return exactly 3 branches, and they must appear in the exact same order as the sub-genres listed above.\n"
        "The 'full_narrative' for each must be exactly ~90 words establishing the setting and immediate danger."
    )

    parsed_response = None
    for attempt in range(max_retries):
        try:
            response = GEMINI_CLIENT.models.generate_content(
                model=GEMINI_MODEL,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    response_mime_type="application/json",
                    response_schema=GameMasterResponse,
                    temperature=0.8,
                ),
            )
            return GameMasterResponse.model_validate_json(response.text)
        except Exception as e:
            print(f"Warning: Attempt {attempt + 1} failed validation: {e}. Retrying...")

    # Fallback if all retries fail
    print(
        "Error: Failed to generate valid seed stories after all retries. Using fallback."
    )
    return GameMasterResponse(
        branches=[
            Branch(
                action_summary="System error", full_narrative="Communications offline."
            ),
            Branch(
                action_summary="System error", full_narrative="Communications offline."
            ),
            Branch(
                action_summary="System error", full_narrative="Communications offline."
            ),
        ]
    )


def generate_branches(
    selected_genre: str = None,
    selected_archetypes: list[str] = None,
    story_so_far: str = "",
    player_wpm: int = 0,
    max_retries: int = 3,
) -> GameMasterResponse:
    archetypes_to_use = (
        selected_archetypes if selected_archetypes else random.sample(ARCHETYPES, 3)
    )
    target_words = get_target_words(wpm=player_wpm)
    genre_instruction = (
        f"CRITICAL INSTRUCTION: Ensure the overarching narrative remains consistent with the '{selected_genre}' genre.\n"
        if selected_genre
        else ""
    )

    prompt = (
        f"The story so far: {story_so_far}\n\n"
        "Continue the narrative from this exact moment. Generate 3 distinct branching choices. "
        "Each branch must follow one of these 3 archetypes to ensure divergence: "
        f"1) {archetypes_to_use[0]}, 2) {archetypes_to_use[1]}, 3) {archetypes_to_use[2]}.\n"
        "CRITICAL INSTRUCTION: You must return exactly 3 branches, and they must appear in the exact same order as the archetypes listed above.\n"
        f"{genre_instruction}"
        f"The 'full_narrative' for each branch must be approximately {target_words} words."
    )

    parsed_response = None
    for attempt in range(max_retries):
        response = GEMINI_CLIENT.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
                response_schema=GameMasterResponse,
                temperature=0.7,
            ),
        )

        # Parse the structured output and validate exactly 3 branches
        try:
            parsed_response = GameMasterResponse.model_validate_json(response.text)
        except Exception as e:
            print(f"Warning: Attempt {attempt + 1} failed validation: {e}. Retrying...")
            continue

        # Validation: check if all strings are ASCII
        is_ascii = True
        for branch in parsed_response.branches:
            if (
                not branch.action_summary.isascii()
                or not branch.full_narrative.isascii()
            ):
                is_ascii = False
                break

        if is_ascii:
            return parsed_response

        print(
            f"Warning: Non-ASCII characters detected in attempt {attempt + 1}. Retrying..."
        )

    # If we exhaust retries and never got a valid response, use fallback
    if parsed_response is None:
        print(
            "Error: Failed to generate valid branches after all retries. Using fallback."
        )
        return GameMasterResponse(
            branches=[
                Branch(
                    action_summary="System error",
                    full_narrative="Communications offline.",
                ),
                Branch(
                    action_summary="System error",
                    full_narrative="Communications offline.",
                ),
                Branch(
                    action_summary="System error",
                    full_narrative="Communications offline.",
                ),
            ]
        )

    # If we exhaust retries but have a parsed response, sanitize it manually to guarantee ASCII compliance
    for branch in parsed_response.branches:
        branch.action_summary = (
            branch.action_summary.replace("‘", "'")
            .replace("’", "'")
            .replace("“", '"')
            .replace("”", '"')
            .replace("—", "-")
        )
        branch.action_summary = "".join(c for c in branch.action_summary if c.isascii())

        branch.full_narrative = (
            branch.full_narrative.replace("‘", "'")
            .replace("’", "'")
            .replace("“", '"')
            .replace("”", '"')
            .replace("—", "-")
        )
        branch.full_narrative = "".join(c for c in branch.full_narrative if c.isascii())

    return parsed_response
