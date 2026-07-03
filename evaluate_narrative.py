import os
from dotenv import load_dotenv
load_dotenv(".env.local")
from api.agent import generate_narrative, GameMasterResponse

def evaluate():
    print("Testing Level 1 Generation (Seeds)...")
    # Simulate Level 1
    res1: GameMasterResponse = generate_narrative(
        story_so_far="", 
        player_wpm=100, 
        player_health=60, 
        current_level=1
    )
    
    assert len(res1.branches) == 3, "Expected 3 branches for seeds."
    for b in res1.branches:
        print(f"[{b.action_summary}]\n{b.full_narrative[:100]}...\n")
        assert len(b.full_narrative.split()) > 40, "Seed narrative too short."
        assert "WPM" not in b.full_narrative, "Broke 4th wall!"
        
    print("Testing Level 2 Generation (Branching)...")
    story_so_far = res1.branches[0].full_narrative
    res2: GameMasterResponse = generate_narrative(
        story_so_far=story_so_far, 
        player_wpm=100, 
        player_health=80, 
        current_level=2
    )
    
    assert len(res2.branches) == 3, "Expected 3 branches for mid-game."
    for b in res2.branches:
        print(f"[{b.action_summary}]\n{b.full_narrative[:100]}...\n")
        
    print("Testing Death Generation...")
    res_death: GameMasterResponse = generate_narrative(
        story_so_far=story_so_far, 
        player_wpm=0, 
        player_health=80, 
        current_level=2
    )
    assert len(res_death.branches) >= 1, "Expected at least 1 branch for death."
    print(f"DEATH: {res_death.branches[0].full_narrative}")
    
    print("All tests passed!")

if __name__ == "__main__":
    if not os.environ.get("GEMINI_API_KEY"):
        print("Set GEMINI_API_KEY to run evaluations.")
    else:
        evaluate()
