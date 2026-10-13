from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

STATIC_DIR = Path(__file__).parent.parent / "static"

app = FastAPI()


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
