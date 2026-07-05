import json
import os
import sys

# Add project root to sys.path so we can import api.agent when this script is moved
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from pydantic import BaseModel
from google import genai
from google.genai import types
from dotenv import load_dotenv
from api.agent import generate_narrative, SYSTEM_PROMPT

# Load .env.local from project root
load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env.local'))

# Define the expected JSON output format for the LLM judge
class JudgeResult(BaseModel):
    score: int
    explanation: str

def evaluate_traces():
    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    judge_model = os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")

    # Load dataset resiliently from the new location
    dataset_path = os.path.join(os.path.dirname(__file__), 'datasets', 'basic-dataset.json')
    with open(dataset_path, "r") as f:
        dataset = json.load(f)

    results = []

    print("=" * 80)
    print("🚀 RUNNING LOCAL EVALUATIONS (LLM-AS-A-JUDGE)")
    print("=" * 80)

    for case in dataset["eval_cases"]:
        print(f"\nEvaluating: {case['id']}...")
        print(f"Goal: {case['description']}")

        # 1. Generate the narrative response (or use hardcoded bad response for judge testing)
        try:
            if "intentional_bad_response" in case:
                print("-> Injecting intentional bad response to test True Negatives...")
                response_json = json.dumps(case["intentional_bad_response"], indent=2)
            else:
                agent_response = generate_narrative(
                    story_so_far=case["story_so_far"],
                    player_health=100, # Not actually used in the prompt
                    player_wpm=case["player_wpm"],
                    current_level=case["current_level"]
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
You must ONLY evaluate the negative constraints:
- Did it break the 4th wall?
- Did it mention player typing on a keyboard?
- Did it mention WPM, levels, rounds, or game mechanics?
- Are the action summaries strictly 10 words or fewer?

If ALL rules are perfectly followed, score = 5.
If there is a minor violation (e.g. an action summary is 11 words), score = 4.
If there is a moderate violation, score = 2 or 3.
If there is a blatant violation (e.g. explicit mention of meta-game mechanics that were forbidden), score = 1.

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
                )
            )
            score_data = JudgeResult.model_validate_json(judge_response.text)
            results.append({
                "id": case["id"],
                "score": score_data.score,
                "explanation": score_data.explanation
            })
            print(f"-> Score: {score_data.score}/5 | {score_data.explanation}")
        except Exception as e:
            print(f"Error running judge: {e}")
            results.append({"id": case["id"], "score": 1, "explanation": f"Judge Crash: {e}"})

    # Print Summary Table
    print("\n\n" + "=" * 80)
    print("📊 EVALUATION SUMMARY REPORT")
    print("=" * 80)
    print(f"{'CASE ID':<25} | {'SCORE':<5} | {'EXPLANATION'}")
    print("-" * 80)
    for res in results:
        # Truncate explanation for table
        expl = res['explanation']
        if len(expl) > 65:
            expl = expl[:62] + "..."
        print(f"{res['id']:<25} | {res['score']:<5} | {expl}")
    print("-" * 80)
    
    avg_score = sum(r['score'] for r in results) / len(results)
    print(f"Average Score: {avg_score:.1f} / 5.0")

if __name__ == "__main__":
    evaluate_traces()
