import json
import os
import sys

# Add project root to sys.path so we can import api.agent when this script is moved
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from dotenv import load_dotenv
from google import genai
from google.genai import types
from pydantic import BaseModel

from api.agent import (
    SYSTEM_PROMPT,
    generate_branches,
    generate_seed_stories,
    get_target_words,
)

# Load .env.local from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env.local"))


# Define the expected JSON output format for the LLM judge
class JudgeResult(BaseModel):
    score: int
    explanation: str


def evaluate_traces():
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    judge_model = os.environ[
        "GEMINI_MODEL"
    ]  # might consider larger, more powerful model

    # Load dataset resiliently from the new location
    dataset_path = os.path.join(
        os.path.dirname(__file__), "datasets", "basic-dataset.json"
    )
    with open(dataset_path, "r") as f:
        dataset = json.load(f)

    results = []

    print("=" * 80)
    print("🚀 RUNNING LOCAL EVALUATIONS (LLM-AS-A-JUDGE)")
    print("=" * 80)

    for case in dataset["eval_cases"]:
        print(f"\nEvaluating: {case['id']}...")
        print(f"Goal: {case['description']}")

        is_seed_function = case.get("function") == "generate_seed_stories"
        target_words = (
            90 if is_seed_function else get_target_words(case.get("player_wpm", 0))
        )

        # 1. Generate the narrative response (or use hardcoded bad response for judge testing)
        try:
            if "intentional_bad_response" in case:
                print("-> Injecting intentional bad response to test True Negatives...")
                response_json = json.dumps(case["intentional_bad_response"], indent=2)
            else:
                if is_seed_function:
                    agent_response = generate_seed_stories(
                        selected_genres=case.get("selected_genres")
                    )
                else:
                    agent_response = generate_branches(
                        selected_genre=case.get("selected_genre"),
                        selected_archetypes=case.get("selected_archetypes"),
                        story_so_far=case.get("story_so_far", ""),
                        player_wpm=case.get("player_wpm", 0),
                    )
                response_json = agent_response.model_dump_json(indent=2)
        except Exception as e:
            print(f"Error running agent: {e}")
            results.append({"id": case["id"], "score": 1, "explanation": f"Crash: {e}"})
            continue

        # 2. Score with the LLM Judge
        judge_prompt = f"""
You are an expert, highly critical AI evaluator. Your job is to assess if an AI Game Master successfully followed its given system prompt.

AGENT's SYSTEM PROMPT:
-----------------------
{SYSTEM_PROMPT}
-----------------------

Does the following JSON output from the agent strictly adhere to ALL constraints and instructions defined in the system prompt above? 

CRITICAL EXCEPTION: Assume the JSON schema is 100% correct. Do not penalize the agent for its JSON structure. 
You must ONLY evaluate the following specific constraints:
- Did it break the 4th wall?
- Did it mention player typing on a keyboard?
- Did it mention WPM, levels, rounds, or game mechanics?
- Are the action summaries strictly 10 words or fewer?
- Are there ANY non-ASCII characters (e.g. smart quotes ‘ ’ “ ” or em-dashes —)?
- Is each `full_narrative` approximately {target_words} words long (a variance of +/- 15 words is acceptable)?

If ALL rules are perfectly followed, score = 5.
If there is a minor violation (e.g., narrative is 20 words off target), score = 4.
If there is a moderate violation, score = 2 or 3.
If there is a blatant violation (e.g. explicit mention of meta-game mechanics, ANY action summary exceeding 10 words, or the use of non-ASCII typography), score = 1.

CRITICAL INSTRUCTION FOR SCORING: You must count the words in each `action_summary`. If any `action_summary` has 11 or more words, you MUST give a score of 1.
CRITICAL INSTRUCTION FOR SCORING 2: You must check for smart quotes or em-dashes. If any exist, you MUST give a score of 1.

OUTPUT JSON FORMAT:
{{"score": <1-5>, "explanation": "<short reason>"}}

EVALUATE THIS AGENT OUTPUT:
{response_json}
"""
        try:
            judge_response = client.models.generate_content(
                model=judge_model,
                contents=judge_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=JudgeResult,
                    temperature=0.0,
                ),
            )
            score_data = JudgeResult.model_validate_json(judge_response.text)
            expected_score = 1 if "intentional_bad_response" in case else 5
            accuracy = (1 - (abs(expected_score - score_data.score) / 4)) * 100

            results.append(
                {
                    "id": case["id"],
                    "score": score_data.score,
                    "expected": expected_score,
                    "accuracy": accuracy,
                    "explanation": score_data.explanation,
                }
            )
            print(f"-> Score: {score_data.score}/5 | {score_data.explanation}")
        except Exception as e:
            print(f"Error running judge: {e}")
            expected_score = 1 if "intentional_bad_response" in case else 5
            results.append(
                {
                    "id": case["id"],
                    "score": 1,
                    "expected": expected_score,
                    "accuracy": 0.0,
                    "explanation": f"Judge Crash: {e}",
                }
            )

    # Print Summary Table
    print("\n\n" + "=" * 80)
    print("📊 EVALUATION SUMMARY REPORT")
    print("=" * 80)
    print(
        f"{'CASE ID':<25} | {'SCORE':<5} | {'EXPECTED':<8} | {'ACCURACY':<8} | {'EXPLANATION'}"
    )
    print("-" * 100)
    for res in results:
        # Truncate explanation for table
        expl = res["explanation"]
        if len(expl) > 45:
            expl = expl[:42] + "..."
        print(
            f"{res['id']:<25} | {res['score']:<5} | {res['expected']:<8} | {res['accuracy']:>7.1f}% | {expl}"
        )
    print("-" * 100)

    avg_accuracy = sum(r["accuracy"] for r in results) / len(results)
    print(f"Overall Accuracy: {avg_accuracy:.1f}%")


if __name__ == "__main__":
    evaluate_traces()
