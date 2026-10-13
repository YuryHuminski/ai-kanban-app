import json

import pytest

from app import ai

GOOD = {"username": "user", "password": "password"}


@pytest.fixture
def signed_in(client):
    client.post("/api/login", json=GOOD)
    return client


def column_ids(client):
    return [column["id"] for column in client.get("/api/board").json()["columns"]]


def add_card(client, column_id, title="Card", details=""):
    response = client.post(
        "/api/cards", json={"column_id": column_id, "title": title, "details": details}
    )
    assert response.status_code == 201
    return response.json()


def stub_ai_response(monkeypatch, payload):
    monkeypatch.setattr(ai, "ask_model_from_messages", lambda _messages: json.dumps(payload))


def test_chat_reply_only(monkeypatch, signed_in):
    before = signed_in.get("/api/board").json()
    stub_ai_response(monkeypatch, {"message": "Hi from AI"})

    response = signed_in.post("/api/chat", json={"message": "hello", "history": []})

    assert response.status_code == 200
    assert response.json()["message"] == "Hi from AI"
    assert response.json()["board_update"] is None
    assert response.json()["board"] == before


def test_chat_create_card(monkeypatch, signed_in):
    backlog = column_ids(signed_in)[0]
    stub_ai_response(
        monkeypatch,
        {
            "message": "Created a card.",
            "board_update": {
                "operations": [
                    {
                        "type": "create_card",
                        "column_id": backlog,
                        "title": "AI card",
                        "details": "from chat",
                    }
                ]
            },
        },
    )

    response = signed_in.post("/api/chat", json={"message": "create", "history": []})
    body = response.json()
    assert response.status_code == 200
    assert body["board"]["columns"][0]["cardIds"] == ["1"]
    assert body["board"]["cards"]["1"] == {"id": "1", "title": "AI card", "details": "from chat"}


def test_chat_edit_card(monkeypatch, signed_in):
    backlog = column_ids(signed_in)[0]
    card = add_card(signed_in, backlog, title="Old", details="old")
    stub_ai_response(
        monkeypatch,
        {
            "message": "Edited.",
            "board_update": {
                "operations": [
                    {
                        "type": "edit_card",
                        "card_id": card["id"],
                        "title": "New",
                        "details": "new",
                    }
                ]
            },
        },
    )

    response = signed_in.post("/api/chat", json={"message": "edit", "history": []})
    assert response.status_code == 200
    assert response.json()["board"]["cards"][card["id"]] == {
        "id": card["id"],
        "title": "New",
        "details": "new",
    }


def test_chat_move_card(monkeypatch, signed_in):
    backlog, discovery = column_ids(signed_in)[:2]
    first = add_card(signed_in, backlog, title="First")
    second = add_card(signed_in, backlog, title="Second")
    stub_ai_response(
        monkeypatch,
        {
            "message": "Moved.",
            "board_update": {
                "operations": [
                    {
                        "type": "move_card",
                        "card_id": second["id"],
                        "column_id": discovery,
                        "position": 0,
                    }
                ]
            },
        },
    )

    response = signed_in.post("/api/chat", json={"message": "move", "history": []})
    body = response.json()["board"]
    assert response.status_code == 200
    assert body["columns"][0]["cardIds"] == [first["id"]]
    assert body["columns"][1]["cardIds"] == [second["id"]]


def test_chat_multiple_operations(monkeypatch, signed_in):
    backlog, discovery = column_ids(signed_in)[:2]
    first = add_card(signed_in, backlog, title="First")
    second = add_card(signed_in, backlog, title="Second")
    third = add_card(signed_in, discovery, title="Third")
    stub_ai_response(
        monkeypatch,
        {
            "message": "Updated multiple cards.",
            "board_update": {
                "operations": [
                    {"type": "edit_card", "card_id": first["id"], "title": "First updated"},
                    {
                        "type": "move_card",
                        "card_id": second["id"],
                        "column_id": discovery,
                        "position": 0,
                    },
                    {"type": "delete_card", "card_id": third["id"]},
                ]
            },
        },
    )

    response = signed_in.post("/api/chat", json={"message": "do all", "history": []})
    body = response.json()["board"]
    assert response.status_code == 200
    assert body["cards"][first["id"]]["title"] == "First updated"
    assert body["columns"][0]["cardIds"] == [first["id"]]
    assert body["columns"][1]["cardIds"] == [second["id"]]
    assert third["id"] not in body["cards"]


def test_chat_rejects_invalid_model_output(monkeypatch, signed_in):
    monkeypatch.setattr(ai, "ask_model_from_messages", lambda _messages: "not-json")
    response = signed_in.post("/api/chat", json={"message": "bad", "history": []})
    assert response.status_code == 500
    assert response.json()["detail"] == "Model returned invalid JSON"


def test_chat_rejects_unknown_ids(monkeypatch, signed_in):
    stub_ai_response(
        monkeypatch,
        {
            "message": "Try edit unknown.",
            "board_update": {
                "operations": [{"type": "edit_card", "card_id": "9999", "title": "Nope"}]
            },
        },
    )

    response = signed_in.post("/api/chat", json={"message": "unknown", "history": []})
    assert response.status_code == 400
    assert response.json()["detail"] == "AI update references unknown card or column id"


def test_chat_live_model_reply(signed_in):
    response = signed_in.post(
        "/api/chat",
        json={
            "message": "Reply with a short confirmation and do not change the board.",
            "history": [],
        },
    )
    assert response.status_code == 200
    assert response.json()["message"]
