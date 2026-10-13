# Frontend

Standalone demo of a single-board Kanban app ("Kanban Studio"). Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `@dnd-kit` for drag and drop. Board state is in-memory only; there is no persistence yet. Sign in goes through the backend (`/api/login`, `/api/me`, `/api/logout`). Built as a static export (`output: "export"` in `next.config.ts`) and served by FastAPI.

## Structure

- `src/app/layout.tsx` - root layout, fonts, metadata.
- `src/app/page.tsx` - renders `<AuthGate />`.
- `src/components/AuthGate.tsx` - checks `/api/me`; shows `LoginForm` when signed out, `KanbanBoard` (with Log out) when signed in.
- `src/components/LoginForm.tsx` - username/password form, posts to `/api/login`, shows an error on failure.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow).
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `initialData` (5 columns, 8 cards), pure helpers `moveCard` and `createId`.
- `src/components/KanbanBoard.tsx` - client component; holds board state, `DndContext`, drag start/end, rename column, add card, update card, delete card.
- `src/components/KanbanColumn.tsx` - droppable column with editable title input, sortable card list, empty state.
- `src/components/KanbanCard.tsx` - sortable card with Edit (inline title/details form; drag is disabled and dnd attributes are not applied while editing) and Remove buttons.
- `src/components/KanbanCardPreview.tsx` - card visual shown in `DragOverlay`.
- `src/components/NewCardForm.tsx` - collapsible add-card form.
- `src/test/setup.ts` - Vitest setup (jest-dom).

## Data model

`BoardData = { columns: Column[]; cards: Record<string, Card> }`. A `Column` holds ordered `cardIds`. Column ids are fixed (`col-backlog`, `col-discovery`, `col-progress`, `col-review`, `col-done`); only titles change.

## Tests

- Unit/component: Vitest + React Testing Library (`npm run test:unit`), files `src/**/*.test.ts(x)`.
- E2E: Playwright (`npm run test:e2e`), files in `tests/`. Runs against the Docker app at `http://localhost:8000` (start it with `scripts/start.sh` first; override with `BASE_URL`). `next dev` alone is not enough because auth needs the backend.
- Coverage: `npx vitest run --coverage`; target is about 80% where sensible; not enforced.

## Known gaps

- No board API client or chat sidebar.
- `README.md` is a stub.
- ESLint also lints the generated `coverage/` directory (harmless warning).
