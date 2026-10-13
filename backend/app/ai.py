import os
import sqlite3
from json import JSONDecodeError, dumps, loads
import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.board import (
    build_board_state,
    card_ids,
    current_user_id,
    owned_card,
    owned_column,
    set_order,
)
from app.db import get_db

MODEL = "openai/gpt-oss-120b"
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"

router = APIRouter(prefix="/api")


def load_key_from_env_file() -> str:
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return ""

    with open(env_path, encoding="utf-8") as env_file:
        for line in env_file:
            line = line.strip()
            if not line or line.startswith("#") or not line.startswith("OPENROUTER_API_KEY="):
                continue
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def require_api_key() -> str:
    api_key = os.environ.get("OPENROUTER_API_KEY", "").strip() or load_key_from_env_file()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is required")
    return api_key


def ask_model_from_messages(messages: list[dict[str, str]]) -> str:
    client = OpenAI(base_url=OPENROUTER_BASE_URL, api_key=require_api_key())
    response = client.chat.completions.create(
        model=MODEL,
        messages=messages,
    )
    content = response.choices[0].message.content
    if not content:
        raise RuntimeError("Model returned an empty response")
    return content.strip()


def ask_model(prompt: str) -> str:
    return ask_model_from_messages([{"role": "user", "content": prompt}])


def ask_two_plus_two() -> str:
    prompt = "What is 2+2? Answer with either 4 or four."
    return ask_model(prompt)


class ChatHistoryItem(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    message: str = Field(min_length=1)
    history: list[ChatHistoryItem] = []


class CreateCardOperation(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    type: Literal["create_card"]
    column_id: str
    title: str = Field(min_length=1)
    details: str = ""
    position: int | None = None


class EditCardOperation(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    type: Literal["edit_card"]
    card_id: str
    title: str | None = None
    details: str | None = None


class MoveCardOperation(BaseModel):
    type: Literal["move_card"]
    card_id: str
    column_id: str
    position: int


class DeleteCardOperation(BaseModel):
    type: Literal["delete_card"]
    card_id: str


BoardOperation = Annotated[
    CreateCardOperation | EditCardOperation | MoveCardOperation | DeleteCardOperation,
    Field(discriminator="type"),
]


class BoardUpdate(BaseModel):
    operations: list[BoardOperation]


class ChatModelResponse(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    message: str = Field(min_length=1)
    board_update: BoardUpdate | None = None


SYSTEM_PROMPT = (
    "You are a Kanban assistant.\n"
    "You receive the current board JSON, previous chat history, and the latest user message.\n"
    "Return only strict JSON with this shape:\n"
    '{\n  "message": string,\n  "board_update": {\n    "operations": [\n'
    '      {"type":"create_card","column_id":"<id>","title":"<title>","details":"<details>","position":0},\n'
    '      {"type":"edit_card","card_id":"<id>","title":"<title>","details":"<details>"},\n'
    '      {"type":"move_card","card_id":"<id>","column_id":"<id>","position":0},\n'
    '      {"type":"delete_card","card_id":"<id>"}\n'
    "    ]\n  }\n}\n"
    "If no board change is needed, omit board_update.\n"
    "Use only IDs that already exist in the provided board."
)


def parse_ai_chat_response(raw_text: str) -> ChatModelResponse:
    candidate = raw_text.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", candidate, re.DOTALL)
    if fence_match:
        candidate = fence_match.group(1)
    elif not candidate.startswith("{"):
        start = candidate.find("{")
        end = candidate.rfind("}")
        if start != -1 and end > start:
            candidate = candidate[start : end + 1]

    try:
        payload = loads(candidate)
    except JSONDecodeError as exc:
        raise RuntimeError("Model returned invalid JSON") from exc
    try:
        return ChatModelResponse.model_validate(payload)
    except ValidationError as exc:
        raise RuntimeError("Model returned invalid structured response") from exc


def coerce_id(raw_id: str, field_name: str) -> int:
    try:
        return int(raw_id)
    except ValueError as exc:
        raise ValueError(f"AI update has invalid {field_name}: {raw_id}") from exc


def apply_board_update(db: sqlite3.Connection, user_id: int, update: BoardUpdate | None) -> None:
    if update is None:
        return

    try:
        for operation in update.operations:
            if isinstance(operation, CreateCardOperation):
                column_id = coerce_id(operation.column_id, "column_id")
                owned_column(db, user_id, column_id)
                new_card_id = db.execute(
                    "INSERT INTO cards (column_id, title, details, position) VALUES (?, ?, ?, ?)",
                    (
                        column_id,
                        operation.title,
                        operation.details,
                        len(card_ids(db, column_id)),
                    ),
                ).lastrowid
                if operation.position is not None:
                    ids = card_ids(db, column_id, exclude=new_card_id)
                    insert_at = min(max(operation.position, 0), len(ids))
                    ids.insert(insert_at, new_card_id)
                    set_order(db, column_id, ids)

            elif isinstance(operation, EditCardOperation):
                card_id = coerce_id(operation.card_id, "card_id")
                current = owned_card(db, user_id, card_id)
                title = operation.title if operation.title is not None else current["title"]
                details = operation.details if operation.details is not None else current["details"]
                if not title.strip():
                    raise ValueError("AI update has invalid title: blank")
                db.execute(
                    "UPDATE cards SET title = ?, details = ? WHERE id = ?",
                    (title, details, card_id),
                )

            elif isinstance(operation, MoveCardOperation):
                card_id = coerce_id(operation.card_id, "card_id")
                column_id = coerce_id(operation.column_id, "column_id")
                card = owned_card(db, user_id, card_id)
                owned_column(db, user_id, column_id)
                ids = card_ids(db, column_id, exclude=card_id)
                ids.insert(min(max(operation.position, 0), len(ids)), card_id)
                set_order(db, column_id, ids)
                if card["column_id"] != column_id:
                    set_order(db, card["column_id"], card_ids(db, card["column_id"]))

            elif isinstance(operation, DeleteCardOperation):
                card_id = coerce_id(operation.card_id, "card_id")
                card = owned_card(db, user_id, card_id)
                db.execute("DELETE FROM cards WHERE id = ?", (card_id,))
                set_order(db, card["column_id"], card_ids(db, card["column_id"]))
    except HTTPException as exc:
        db.rollback()
        if exc.status_code == 404:
            raise ValueError("AI update references unknown card or column id") from exc
        raise
    except ValueError:
        db.rollback()
        raise
    db.commit()


def ask_kanban_chat(
    message: str,
    history: list[ChatHistoryItem],
    board: dict,
) -> ChatModelResponse:
    user_prompt = (
        f"Board JSON:\n{dumps(board)}\n\n"
        f"History JSON:\n{dumps([item.model_dump() for item in history])}\n\n"
        f"User message:\n{message}"
    )
    raw_text = ask_model_from_messages(
        [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]
    )
    return parse_ai_chat_response(raw_text)


@router.get("/ai/smoke")
def smoke() -> dict[str, str]:
    try:
        answer = ask_two_plus_two()
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return {"answer": answer}


@router.post("/chat")
def chat(
    body: ChatRequest,
    user_id: int = Depends(current_user_id),
    db: sqlite3.Connection = Depends(get_db),
) -> dict:
    board = build_board_state(db, user_id)

    try:
        ai_response = ask_kanban_chat(body.message, body.history, board)
        apply_board_update(db, user_id, ai_response.board_update)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "message": ai_response.message,
        "board_update": (
            ai_response.board_update.model_dump() if ai_response.board_update is not None else None
        ),
        "board": build_board_state(db, user_id),
    }
