import os
import sqlite3
from contextlib import closing
from pathlib import Path

DEFAULT_DB_PATH = Path(__file__).parent.parent / "data" / "pm.db"
DEFAULT_COLUMNS = ["Backlog", "Discovery", "In Progress", "Review", "Done"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS boards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS columns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_columns_board ON columns(board_id, position);
CREATE TABLE IF NOT EXISTS cards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cards_column ON cards(column_id, position);
"""


def connect() -> sqlite3.Connection:
    path = Path(os.environ.get("DB_PATH", DEFAULT_DB_PATH))
    # Requests run in a thread pool, so the connection may change threads between
    # the dependency and the endpoint. It is never used concurrently.
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_user_with_board(conn: sqlite3.Connection, username: str) -> int:
    user_id = conn.execute("INSERT INTO users (username) VALUES (?)", (username,)).lastrowid
    board_id = conn.execute(
        "INSERT INTO boards (user_id, name) VALUES (?, ?)", (user_id, "My Board")
    ).lastrowid
    conn.executemany(
        "INSERT INTO columns (board_id, title, position) VALUES (?, ?, ?)",
        [(board_id, title, position) for position, title in enumerate(DEFAULT_COLUMNS)],
    )
    conn.commit()
    return user_id


def init_db() -> None:
    path = Path(os.environ.get("DB_PATH", DEFAULT_DB_PATH))
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect()) as conn:
        conn.executescript(SCHEMA)
        if conn.execute("SELECT 1 FROM users LIMIT 1").fetchone() is None:
            create_user_with_board(conn, "user")


def get_db():
    with closing(connect()) as conn:
        yield conn
