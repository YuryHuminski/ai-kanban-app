import os

from fastapi import APIRouter, HTTPException
from openai import OpenAI

MODEL = "openai/gpt-oss-120b"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

router = APIRouter(prefix="/api")


def load_key_from_env_file() -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return ""

    with open(env_path, encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or not line.startswith("OPENROUTER_API_KEY="):
                continue
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def require_api_key() -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip() or load_key_from_env_file()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required")
    return api_key


def ask_model(prompt: str) -> str:
    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=require_api_key())
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Model returned an empty response")
    return content.strip()


def ask_two_plus_two() -> str:
    prompt = "What is 2+2? Answer with either 4 or four."
    return ask_model(prompt)


@router.get("/ai/smoke")
def smoke() -> dict[str, str]:
    try:
        answer = ask_two_plus_two()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"answer": answer}
