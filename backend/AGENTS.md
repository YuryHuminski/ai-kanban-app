# Backend

FastAPI app managed with `uv` (`pyproject.toml`, `uv.lock`).

- `app/main.py` - FastAPI app. `GET /api/hello` returns `{"message": ...}`. The static dir (`STATIC_DIR` env var, default `static/`) is mounted at `/`. In Docker it holds the Next.js export copied from the frontend build stage; it does not exist in the repo.
- `app/auth.py` - `POST /api/login` (hardcoded `user` / `password`, sets HTTP-only `session` cookie signed with HMAC-SHA256), `POST /api/logout`, `GET /api/me` (401 without a valid cookie). Secret from `SESSION_SECRET` env var, with a dev default.
- `app/db.py` - SQLite (`sqlite3`). `DB_PATH` env var, default `data/pm.db` (`/app/data/pm.db` in Docker). `init_db()` runs at startup (FastAPI lifespan): creates dir, file and tables if missing, seeds user `user` with a board and 5 columns. `get_db` is the per-request connection dependency. Schema: `docs/schema.json`, `docs/DATABASE.md`.
- `app/board.py` - authenticated routes (401 without a session; 404 for ids not owned by the user): `GET /api/board` (returns `{columns: [{id, title, cardIds}], cards: {id: {id, title, details}}}` with string ids), `PUT /api/columns/{id}` (rename), `POST /api/cards` (201, appended to the column), `PUT /api/cards/{id}` (edit), `DELETE /api/cards/{id}` (204), `POST /api/cards/{id}/move` (204, body `{column_id, position}`, 0-based position, clamped). Positions are renumbered after every change.
- `tests/` - pytest tests. `conftest.py` points `STATIC_DIR` at a temp dir and provides a `client` fixture with a fresh temp database per test. Coverage is reported (target about 80% where sensible), not enforced.

## Commands

- Run tests: `uv run pytest`
- Run locally: `uv run uvicorn app.main:app --reload`

The Docker image is built from the root `Dockerfile`.
