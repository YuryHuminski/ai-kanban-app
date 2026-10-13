# Backend

FastAPI app managed with `uv` (`pyproject.toml`, `uv.lock`).

- `app/main.py` - FastAPI app. `GET /api/hello` returns `{"message": ...}`. Static files from `static/` are mounted at `/` (placeholder hello page for now; replaced by the Next.js build in Part 3).
- `static/` - static files served at `/`.
- `tests/` - pytest tests. Coverage is enforced at 80% minimum via `pyproject.toml`.

## Commands

- Run tests: `uv run pytest`
- Run locally: `uv run uvicorn app.main:app --reload`

The Docker image is built from the root `Dockerfile`.
