# Frontend

Standalone demo of a single-board Kanban app ("Kanban Studio"). Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `@dnd-kit` for drag and drop. The board is loaded from and saved to the backend (`/api/board` and the card/column routes); sign in goes through `/api/login`, `/api/me`, `/api/logout`. Built as a static export (`output: "export"` in `next.config.ts`) and served by FastAPI.

## Structure

- `src/app/layout.tsx` - root layout, fonts, metadata.
- `src/app/page.tsx` - renders `<AuthGate />`.
- `src/components/AuthGate.tsx` - checks `/api/me`; shows `LoginForm` when signed out, `KanbanBoard` (with Log out) when signed in.
- `src/components/LoginForm.tsx` - username/password form, posts to `/api/login`, shows an error on failure.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow).
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`) and the pure helper `moveCard`.
- `src/lib/api.ts` - fetch wrappers for the backend. It prefixes ids (`col-<n>`, `card-<n>`) on the way in and strips them on the way out: the database numbers columns and cards separately, so a column and a card can share an id, which breaks drag and drop.
- `src/components/KanbanBoard.tsx` - client component; loads the board (loading and error/retry states), holds board state and `DndContext`. Every action calls the API: add, edit and delete wait for the server; a drag updates the board immediately and then calls the move route. If a call fails it shows an error banner and reloads the board.
- `src/components/KanbanColumn.tsx` - droppable column with a title input (saved on blur or Enter; a blank title is reverted), sortable card list, empty state.
- `src/components/KanbanCard.tsx` - sortable card with Edit (inline title/details form; drag is disabled and dnd attributes are not applied while editing) and Remove buttons.
- `src/components/KanbanCardPreview.tsx` - card visual shown in `DragOverlay`.
- `src/components/NewCardForm.tsx` - collapsible add-card form.
- `src/test/setup.ts` - Vitest setup (jest-dom).
- `src/test/mockServer.ts` - fake backend for unit tests (replaces `fetch`; `requestsTo` returns the request bodies sent to a route).

## Data model

`BoardData = { columns: Column[]; cards: Record<string, Card> }`. A `Column` holds ordered `cardIds`. The five columns are fixed; only titles change. An empty `details` is shown as "No details yet.".

## Tests

- Unit/component: Vitest + React Testing Library (`npm run test:unit`), files `src/**/*.test.ts(x)`.
- E2E: Playwright (`npm run test:e2e`), files in `tests/`. Runs against the Docker app at `http://localhost:8000` (start it with `scripts/start.sh` first; override with `BASE_URL`). Tests share one database, so they run serially, and each starts by resetting the board of `user` (`tests/helpers.ts`): do not run them against an app whose data you want to keep. `tests/restart.spec.ts` removes and recreates the `pm-app` container to prove the database volume works. `next dev` alone is not enough because auth needs the backend.
- Coverage: `npx vitest run --coverage`; target is about 80% where sensible; not enforced.

## Known gaps

- No chat sidebar.
- `README.md` is a stub.
- ESLint also lints the generated `coverage/` directory (harmless warning).
