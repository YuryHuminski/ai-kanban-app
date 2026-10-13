import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.ai import router as ai_router
from app.auth import router as auth_router
from app.board import router as board_router
from app.db import init_db

STATIC_DIR = Path(os.environ.get("STATIC_DIR", Path(__file__).parent.parent / "static"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(ai_router)
app.include_router(auth_router)
app.include_router(board_router)


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
