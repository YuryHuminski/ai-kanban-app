import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, ConfigDict, Field

from app.auth import current_username
from app.db import get_db

router = APIRouter(prefix="/api")


class TitleBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1)


class CardBody(TitleBody):
    details: str = ""


class NewCardBody(CardBody):
    column_id: int


class MoveBody(BaseModel):
    column_id: int
    position: int


def current_user_id(
    username: str = Depends(current_username), db: sqlite3.Connection = Depends(get_db)
) -> int:
    row = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return row["id"]


def owned_column(db: sqlite3.Connection, user_id: int, column_id: int) -> sqlite3.Row:
    row = db.execute(
        "SELECT c.id, c.title FROM columns c JOIN boards b ON b.id = c.board_id "
        "WHERE c.id = ? AND b.user_id = ?",
        (column_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Column not found")
    return row


def owned_card(db: sqlite3.Connection, user_id: int, card_id: int) -> sqlite3.Row:
    row = db.execute(
        "SELECT cd.id, cd.column_id, cd.title, cd.details FROM cards cd "
        "JOIN columns c ON c.id = cd.column_id JOIN boards b ON b.id = c.board_id "
        "WHERE cd.id = ? AND b.user_id = ?",
        (card_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Card not found")
    return row


def card_ids(db: sqlite3.Connection, column_id: int, exclude: int | None = None) -> list[int]:
    rows = db.execute(
        "SELECT id FROM cards WHERE column_id = ? AND id != ? ORDER BY position",
        (column_id, exclude or -1),
    )
    return [row["id"] for row in rows]


def set_order(db: sqlite3.Connection, column_id: int, ids: list[int]) -> None:
    db.executemany(
        "UPDATE cards SET column_id = ?, position = ? WHERE id = ?",
        [(column_id, position, card_id) for position, card_id in enumerate(ids)],
    )


def card_json(row: sqlite3.Row) -> dict:
    return {"id": str(row["id"]), "title": row["title"], "details": row["details"]}


@router.get("/board")
def get_board(user_id: int = Depends(current_user_id), db: sqlite3.Connection = Depends(get_db)):
    columns = db.execute(
        "SELECT c.id, c.title FROM columns c JOIN boards b ON b.id = c.board_id "
        "WHERE b.user_id = ? ORDER BY c.position",
        (user_id,),
    ).fetchall()
    cards = db.execute(
        "SELECT cd.id, cd.column_id, cd.title, cd.details FROM cards cd "
        "JOIN columns c ON c.id = cd.column_id JOIN boards b ON b.id = c.board_id "
        "WHERE b.user_id = ? ORDER BY cd.position",
        (user_id,),
    ).fetchall()
    return {
        "columns": [
            {
                "id": str(column["id"]),
                "title": column["title"],
                "cardIds": [str(c["id"]) for c in cards if c["column_id"] == column["id"]],
            }
            for column in columns
        ],
        "cards": {str(card["id"]): card_json(card) for card in cards},
    }


@router.put("/columns/{column_id}")
def rename_column(
    column_id: int,
    body: TitleBody,
    user_id: int = Depends(current_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    owned_column(db, user_id, column_id)
    db.execute("UPDATE columns SET title = ? WHERE id = ?", (body.title, column_id))
    db.commit()
    return {"id": str(column_id), "title": body.title}


@router.post("/cards", status_code=201)
def create_card(
    body: NewCardBody,
    user_id: int = Depends(current_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    owned_column(db, user_id, body.column_id)
    position = len(card_ids(db, body.column_id))
    card_id = db.execute(
        "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
        (body.column_id, body.title, body.details, position),
    ).lastrowid
    db.commit()
    return {"id": str(card_id), "title": body.title, "details": body.details}


@router.put("/cards/{card_id}")
def update_card(
    card_id: int,
    body: CardBody,
    user_id: int = Depends(current_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    owned_card(db, user_id, card_id)
    db.execute(
        "UPDATE cards SET title = ?, details = ? WHERE id = ?",
        (body.title, body.details, card_id),
    )
    db.commit()
    return {"id": str(card_id), "title": body.title, "details": body.details}


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    user_id: int = Depends(current_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    card = owned_card(db, user_id, card_id)
    db.execute("DELETE FROM cards WHERE id = ?", (card_id,))
    set_order(db, card["column_id"], card_ids(db, card["column_id"]))
    db.commit()
    return Response(status_code=204)


@router.post("/cards/{card_id}/move", status_code=204)
def move_card(
    card_id: int,
    body: MoveBody,
    user_id: int = Depends(current_user_id),
    db: sqlite3.Connection = Depends(get_db),
):
    card = owned_card(db, user_id, card_id)
    owned_column(db, user_id, body.column_id)
    ids = card_ids(db, body.column_id, exclude=card_id)
    ids.insert(min(max(body.position, 0), len(ids)), card_id)
    set_order(db, body.column_id, ids)
    if card["column_id"] != body.column_id:
        set_order(db, card["column_id"], card_ids(db, card["column_id"]))
    db.commit()
    return Response(status_code=204)
