import time
import logging
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv(".env.local")

app = FastAPI()
logger = logging.getLogger(__name__)

# Basic In-Memory Rate Limiting Dictionary
# Note: On Vercel this is transient per-instance, but provides basic protection
# against naive spam on a single hot instance.
RATE_LIMIT_STORE = {}
RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_WINDOW_SECONDS = 60


class GameState(BaseModel):
    story_so_far: str = Field(
        ..., max_length=15000, description="The accumulated story text"
    )
    player_health: int = Field(..., ge=0, le=100)
    player_wpm: int = Field(..., ge=0, le=2000)
    current_level: int = Field(..., ge=1, le=50)


from api.agent import generate_narrative as run_agent


def check_rate_limit(client_ip: str):
    now = time.time()

    # Initialize or get IP record
    if client_ip not in RATE_LIMIT_STORE:
        RATE_LIMIT_STORE[client_ip] = []

    # Filter out old requests
    requests = [
        req_time
        for req_time in RATE_LIMIT_STORE[client_ip]
        if now - req_time < RATE_LIMIT_WINDOW_SECONDS
    ]

    if len(requests) >= RATE_LIMIT_MAX_REQUESTS:
        raise HTTPException(
            status_code=429, detail="Too many requests. Please wait a moment."
        )

    requests.append(now)
    RATE_LIMIT_STORE[client_ip] = requests


@app.post("/api/generate")
async def generate_narrative_endpoint(request: Request, state: GameState):
    # 1. IP Rate Limiting
    client_ip = request.client.host if request.client else "unknown"
    # Fallback to standard proxy headers if behind Vercel edge
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0]

    check_rate_limit(client_ip)

    # 2. Process Game State
    try:
        response = run_agent(
            story_so_far=state.story_so_far,
            player_health=state.player_health,
            player_wpm=state.player_wpm,
            current_level=state.current_level,
        )
        return response
    except Exception as e:
        logger.error(f"Error generating narrative: {e}")
        # Sanitize exception output (Do not leak stack traces)
        raise HTTPException(
            status_code=500,
            detail="The Game Master encountered an internal error. Please try again.",
        )
