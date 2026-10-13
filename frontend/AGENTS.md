# Frontend

Standalone demo of a single-board Kanban app ("Kanban Studio"). Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, `@dnd-kit` for drag and drop. State is in-memory only; there is no backend, auth or persistence yet.

## Structure

- `src/app/layout.tsx` - root layout, fonts, metadata.
- `src/app/page.tsx` - renders `<KanbanBoard />`.
- `src/app/globals.css` - Tailwind import and CSS variables for the color scheme (`--accent-yellow`, `--primary-blue`, `--secondary-purple`, `--navy-dark`, `--gray-text`, plus surface/stroke/shadow).
- `src/lib/kanban.ts` - types (`Card`, `Column`, `BoardData`), `initialData` (5 columns, 8 cards), pure helpers `moveCard` and `createId`.
- `src/components/KanbanBoard.tsx` - client component; holds board state, `DndContext`, drag start/end, rename column, add card, delete card.
- `src/components/KanbanColumn.tsx` - droppable column with editable title input, sortable card list, empty state.
- `src/components/KanbanCard.tsx` - sortable card with a Remove button.
- `src/components/KanbanCardPreview.tsx` - card visual shown in `DragOverlay`.
- `src/components/NewCardForm.tsx` - collapsible add-card form.
- `src/test/setup.ts` - Vitest setup (jest-dom).

## Data model

`BoardData = { columns: Column[]; cards: Record<string, Card> }`. A `Column` holds ordered `cardIds`. Column ids are fixed (`col-backlog`, `col-discovery`, `col-progress`, `col-review`, `col-done`); only titles change.

## Tests

- Unit/component: Vitest + React Testing Library (`npm run test:unit`), files `src/**/*.test.ts(x)`.
- E2E: Playwright (`npm run test:e2e`), files in `tests/`, runs against `next dev` on port 3000.
- Coverage: `npx vitest run --coverage`. Target is at least 80%.

## Known gaps (from audit)

- Cards cannot be edited (only added, moved, removed); required by the product.
- Coverage is about 77% overall; `KanbanCardPreview.tsx` and `src/app/*` are uncovered.
- `next.config.ts` is default; static export (`output: "export"`) is needed for FastAPI serving.
- No auth, API client, or chat sidebar.
- `README.md` is a stub.
- ESLint also lints the generated `coverage/` directory (harmless warning).
