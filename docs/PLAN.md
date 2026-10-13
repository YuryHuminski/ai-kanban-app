# Project plan

Conventions for every part:
- Tick checklist items as they are completed.
- Coverage must be at least 80% (frontend: Vitest coverage; backend: pytest-cov). Enforce with thresholds in config.
- Keep it simple; no emojis; follow the color scheme in `AGENTS.md`.
- Do not start the next part until the current part's success criteria are met. Parts 1 and 5 also require user approval.

Decisions agreed with the user:
- Test tooling: Vitest + React Testing Library, Playwright, pytest. Minimum 80% coverage.
- Auth: simple backend-set cookie.
- Scripts: bash (`.sh`) for Mac/Linux, PowerShell (`.ps1`) for Windows.
- Database: normalized SQLite tables (users, boards, columns, cards) plus a JSON document describing the schema.
- `OPENROUTER_API_KEY` is passed at runtime via `--env-file`, never baked into the image.
- Frontend audited before Part 3 (see `frontend/AGENTS.md`).

## Frontend audit summary

- 6 unit tests and 3 e2e tests exist; unit tests pass; lint has no errors.
- Coverage is 76.81% overall, below the 80% target. `KanbanCardPreview.tsx` and `src/app/*` are uncovered.
- Cards cannot be edited; required by the product.
- No static export configured.
- Playwright runs against `next dev`; it must also run against the Docker/FastAPI app.

## Part 1: Plan

- [x] Review `AGENTS.md` and existing code
- [x] Audit frontend (tests, coverage, lint, gaps)
- [x] Write `frontend/AGENTS.md`
- [x] Expand this plan
- [x] User approves plan

Success: user approval.

## Part 2: Scaffolding

Substeps:
- [x] `backend/` FastAPI app managed with `uv` (`pyproject.toml`); `GET /api/hello` returns JSON
- [x] `GET /` serves a static hello-world HTML page that fetches `/api/hello` and displays the result
- [x] `Dockerfile` at the root (Python base image, install `uv`, copy backend, run uvicorn on 8000)
- [x] `scripts/start.sh`, `stop.sh` (Mac/Linux), `start.ps1`, `stop.ps1` (Windows); start builds image and runs container with `--env-file .env`
- [x] Update `backend/AGENTS.md` and `scripts/AGENTS.md`
- [x] pytest tests for the hello route and static page

Tests: pytest (API returns expected JSON; `/` returns HTML). Manual: run start script, open `http://localhost:8000`.

Success: container starts via script, page at `/` shows the API result, stop script removes the container, tests pass.

## Part 3: Add in Frontend

Substeps:
- [ ] Set `output: "export"` in `next.config.ts`
- [ ] Multi-stage Dockerfile: Node builds the frontend, output copied to the image
- [ ] FastAPI serves the static build at `/` (replaces the hello page)
- [ ] Add card editing (title and details) to the frontend, since it is required by the product
- [ ] Raise unit coverage to at least 80% (tests for `KanbanCardPreview`, drag handlers, card edit, `kanban.ts` branches)
- [ ] Point Playwright at the Docker app (`baseURL` configurable)
- [ ] Add coverage thresholds in `vitest.config.ts`; exclude config files from coverage

Tests: Vitest unit and component tests; Playwright e2e (load, add, edit, move, rename, remove) against the container.

Success: Kanban demo shown at `http://localhost:8000/`, all tests pass, coverage at least 80%.

## Part 4: Fake user sign in

Substeps:
- [ ] Backend `POST /api/login` (checks `user` / `password`, sets an HTTP-only session cookie), `POST /api/logout`, `GET /api/me`
- [ ] Frontend login page shown when not authenticated; board shown when authenticated; logout button
- [ ] Cookie signing with a secret (simple signed value)

Tests: pytest (good/bad credentials, cookie set and cleared, `/api/me` with and without cookie); Vitest (login form, error message, logout); Playwright (redirected to login, sign in, see board, log out, wrong password rejected).

Success: `/` requires login, logout works, tests pass, coverage at least 80%.

## Part 5: Database modeling

Substeps:
- [ ] Propose schema: `users(id, username)`, `boards(id, user_id, name)`, `columns(id, board_id, title, position)`, `cards(id, column_id, title, details, position)`; one board per user for MVP; multiple users supported
- [ ] Save schema as JSON in `docs/schema.json`
- [ ] Document the approach in `docs/DATABASE.md` (SQLite file location, created on startup if missing, seed data for `user`)
- [ ] User signs off

Success: user approval of the schema.

## Part 6: Backend API

Substeps:
- [ ] DB module: create DB and tables if missing, seed user and default board with 5 columns
- [ ] Routes (authenticated): `GET /api/board`, `PUT /api/columns/{id}` (rename), `POST /api/cards`, `PUT /api/cards/{id}` (edit), `DELETE /api/cards/{id}`, `POST /api/cards/{id}/move`
- [ ] Update `backend/AGENTS.md`

Tests: pytest with temporary DB: DB created when missing, each route happy path, unauthorized access, invalid ids, ordering after moves, per-user isolation.

Success: all routes tested, coverage at least 80%.

## Part 7: Frontend + Backend

Substeps:
- [ ] Frontend API client; board loaded from `/api/board`
- [ ] All actions (rename, add, edit, delete, move) call the API
- [ ] Loading and error states
- [ ] Remove in-memory `initialData` use from the app

Tests: Vitest with mocked fetch; Playwright against the container, including persistence across reload and after container restart (DB volume).

Success: changes persist across reloads and restarts; all tests pass.

## Part 8: AI connectivity

Substeps:
- [ ] Backend OpenRouter client (`openai/gpt-oss-120b`), key from `OPENROUTER_API_KEY`
- [ ] Simple endpoint or test that asks "2+2" and returns the answer

Tests: pytest with the client mocked; one live connectivity test (skipped when no key) asserting the answer contains "4".

Success: live "2+2" call returns a correct answer.

## Part 9: Structured outputs with board context

Substeps:
- [ ] `POST /api/chat` takes the user message and history; sends board JSON, history and message to the AI
- [ ] Define response schema: `{ message: string, board_update: optional (create/edit/move/delete card operations) }`
- [ ] Validate and apply the update to the DB, return message and fresh board
- [ ] Update `backend/AGENTS.md`

Tests: pytest with mocked AI for reply only, create, edit, move, multiple operations, invalid output, and unknown ids; one live test.

Success: AI reply and board updates work end to end via the API.

## Part 10: Chat sidebar

Substeps:
- [ ] Sidebar chat widget (history, input, loading state) styled with the color scheme
- [ ] Sends messages to `/api/chat`; renders replies
- [ ] When the response includes a board update, the board refreshes automatically

Tests: Vitest (send, render reply, refresh on update); Playwright with a mocked or stubbed AI response verifying board refresh.

Success: user can chat, the AI can create, edit and move cards, the UI updates without reload, all tests pass with coverage at least 80%.
