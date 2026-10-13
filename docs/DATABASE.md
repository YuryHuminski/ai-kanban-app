# Database

SQLite, accessed from the FastAPI backend with the standard `sqlite3` module. The full schema is in `schema.json`.

## Tables

```
users(id, username)
boards(id, user_id, name)
columns(id, board_id, title, position)
cards(id, column_id, title, details, position)
```

- `users` -> `boards` -> `columns` -> `cards`. Foreign keys cascade on delete (`PRAGMA foreign_keys = ON` per connection).
- One board per user for the MVP: `boards.user_id` is `UNIQUE`. Multiple users are supported.
- Columns are fixed: five per board, created at seed time. They can be renamed, not added or removed.
- `position` is a 0-based order within the board (columns) or column (cards). It is not unique-constrained, so a move can renumber siblings in one transaction without constraint conflicts.
- A card move changes `column_id` and `position`, then renumbers the affected columns' cards.
- `users` has no password column. Sign-in is the hardcoded `user` / `password` in `backend/app/auth.py`; the user row exists so boards have an owner.

## Location and startup

- Path from the `DB_PATH` env var. Default in Docker: `/app/data/pm.db`. Default locally: `backend/data/pm.db`.
- On startup the backend creates the directory, file and tables if missing (`CREATE TABLE IF NOT EXISTS`), then seeds if there is no user.
- Seed: user `user`, board "My Board", columns Backlog, Discovery, In Progress, Review, Done, no cards.
- In Docker the data directory is a named volume (`pm-data`) so data survives container restarts and rebuilds. The start scripts mount it. `scripts/stop.sh` removes the container but keeps the volume; `docker volume rm pm-data` resets the data.

## IDs

Integer ids in the database. The API returns them as strings so the frontend keeps its string-keyed `BoardData` model (`columns[].cardIds`, `cards` record).

## Not in scope for the MVP

Migrations, soft deletes, timestamps, passwords in the database.
