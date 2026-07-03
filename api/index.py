from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class GameState(BaseModel):
    story_so_far: str
    player_health: int
    player_wpm: int
    current_round: int

from api.agent import generate_narrative as run_agent

@app.post("/api/generate")
async def generate_narrative_endpoint(state: GameState):
    try:
        response = run_agent(
            story_so_far=state.story_so_far,
            player_health=state.player_health,
            player_wpm=state.player_wpm,
            current_round=state.current_round
        )
        return response
    except Exception as e:
        return {"error": str(e)}
