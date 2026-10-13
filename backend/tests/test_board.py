import pytest
from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME, sign
from app.db import connect, create_user_with_board, init_db
from app.main import app

GOOD = {"username": "user", "password": "password"}
COLUMN_TITLES = ["Backlog", "Discovery", "In Progress", "Review", "Done"]


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


def order(client):
    """Card titles per column, in order."""
    board = client.get("/api/board").json()
    return [[board["cards"][card_id]["title"] for card_id in c["cardIds"]] for c in board["columns"]]


def test_db_created_and_seeded_when_missing(tmp_path, monkeypatch):
    path = tmp_path / "nested" / "pm.db"
    monkeypatch.setenv("DB_PATH", str(path))
    init_db()
    init_db()  # second run must not duplicate the seed
    assert path.exists()
    conn = connect()
    assert conn.execute("SELECT username FROM users").fetchall()[0]["username"] == "user"
    assert conn.execute("SELECT count(*) FROM users").fetchone()[0] == 1
    titles = [r["title"] for r in conn.execute("SELECT title FROM columns ORDER BY position")]
    assert titles == COLUMN_TITLES
    conn.close()


@pytest.mark.parametrize(
    "method, url, body",
    [
        ("get", "/api/board", None),
        ("put", "/api/columns/1", {"title": "x"}),
        ("post", "/api/cards", {"column_id": 1, "title": "x"}),
        ("put", "/api/cards/1", {"title": "x"}),
        ("delete", "/api/cards/1", None),
        ("post", "/api/cards/1/move", {"column_id": 1, "position": 0}),
    ],
)
def test_routes_require_login(client, method, url, body):
    assert client.request(method, url, json=body).status_code == 401


def test_get_board_returns_seeded_columns(signed_in):
    board = signed_in.get("/api/board").json()
    assert [c["title"] for c in board["columns"]] == COLUMN_TITLES
    assert all(c["cardIds"] == [] for c in board["columns"])
    assert board["cards"] == {}


def test_rename_column(signed_in):
    column_id = column_ids(signed_in)[0]
    response = signed_in.put(f"/api/columns/{column_id}", json={"title": "  Ideas "})
    assert response.json() == {"id": column_id, "title": "Ideas"}
    assert signed_in.get("/api/board").json()["columns"][0]["title"] == "Ideas"


def test_rename_column_rejects_blank_and_unknown(signed_in):
    column_id = column_ids(signed_in)[0]
    assert signed_in.put(f"/api/columns/{column_id}", json={"title": "  "}).status_code == 422
    assert signed_in.put("/api/columns/9999", json={"title": "x"}).status_code == 404


def test_create_card_appends_to_column(signed_in):
    column_id = column_ids(signed_in)[0]
    first = add_card(signed_in, column_id, "First", "notes")
    add_card(signed_in, column_id, "Second")
    assert first["details"] == "notes"
    board = signed_in.get("/api/board").json()
    assert board["columns"][0]["cardIds"][0] == first["id"]
    assert order(signed_in)[0] == ["First", "Second"]
    assert board["cards"][first["id"]] == first


def test_create_card_unknown_column_and_blank_title(signed_in):
    assert signed_in.post("/api/cards", json={"column_id": 9999, "title": "x"}).status_code == 404
    column_id = column_ids(signed_in)[0]
    assert signed_in.post("/api/cards", json={"column_id": column_id, "title": " "}).status_code == 422


def test_update_card(signed_in):
    card = add_card(signed_in, column_ids(signed_in)[0], "Old", "old")
    response = signed_in.put(f"/api/cards/{card['id']}", json={"title": "New", "details": "new"})
    assert response.json() == {"id": card["id"], "title": "New", "details": "new"}
    assert signed_in.get("/api/board").json()["cards"][card["id"]]["title"] == "New"
    assert signed_in.put("/api/cards/9999", json={"title": "x"}).status_code == 404


def test_delete_card_keeps_order(signed_in):
    column_id = column_ids(signed_in)[0]
    a, b, c = (add_card(signed_in, column_id, t) for t in "ABC")
    assert signed_in.delete(f"/api/cards/{b['id']}").status_code == 204
    assert order(signed_in)[0] == ["A", "C"]
    add_card(signed_in, column_id, "D")
    assert order(signed_in)[0] == ["A", "C", "D"]
    assert signed_in.delete(f"/api/cards/{b['id']}").status_code == 404


def test_move_within_column(signed_in):
    column_id = column_ids(signed_in)[0]
    a, b, c = (add_card(signed_in, column_id, t) for t in "ABC")
    signed_in.post(f"/api/cards/{c['id']}/move", json={"column_id": column_id, "position": 0})
    assert order(signed_in)[0] == ["C", "A", "B"]
    signed_in.post(f"/api/cards/{c['id']}/move", json={"column_id": column_id, "position": 2})
    assert order(signed_in)[0] == ["A", "B", "C"]


def test_move_to_another_column(signed_in):
    backlog, discovery = column_ids(signed_in)[:2]
    a, b = add_card(signed_in, backlog, "A"), add_card(signed_in, backlog, "B")
    x = add_card(signed_in, discovery, "X")
    response = signed_in.post(f"/api/cards/{a['id']}/move", json={"column_id": discovery, "position": 0})
    assert response.status_code == 204
    assert order(signed_in)[:2] == [["B"], ["A", "X"]]
    signed_in.post(f"/api/cards/{b['id']}/move", json={"column_id": discovery, "position": 1})
    assert order(signed_in)[:2] == [[], ["A", "B", "X"]]
    # a position past the end appends
    signed_in.post(f"/api/cards/{a['id']}/move", json={"column_id": backlog, "position": 99})
    assert order(signed_in)[:2] == [["A"], ["B", "X"]]


def test_move_unknown_ids(signed_in):
    column_id = column_ids(signed_in)[0]
    card = add_card(signed_in, column_id)
    assert signed_in.post("/api/cards/9999/move", json={"column_id": column_id, "position": 0}).status_code == 404
    assert signed_in.post(f"/api/cards/{card['id']}/move", json={"column_id": 9999, "position": 0}).status_code == 404


def test_users_are_isolated(signed_in):
    column_id = column_ids(signed_in)[0]
    card = add_card(signed_in, column_id, "Mine")

    conn = connect()
    create_user_with_board(conn, "other")
    conn.close()
    other = TestClient(app)
    other.cookies.set(COOKIE_NAME, sign("other"))

    board = other.get("/api/board").json()
    assert board["cards"] == {}
    assert board["columns"][0]["id"] != column_id
    assert other.put(f"/api/cards/{card['id']}", json={"title": "x"}).status_code == 404
    assert other.delete(f"/api/cards/{card['id']}").status_code == 404
    assert other.put(f"/api/columns/{column_id}", json={"title": "x"}).status_code == 404
    assert other.post("/api/cards", json={"column_id": column_id, "title": "x"}).status_code == 404
    other_column = board["columns"][0]["id"]
    assert other.post(f"/api/cards/{card['id']}/move", json={"column_id": other_column, "position": 0}).status_code == 404
    assert order(signed_in)[0] == ["Mine"]


def test_signed_cookie_for_unknown_user_is_rejected(client):
    client.cookies.set(COOKIE_NAME, sign("ghost"))
    assert client.get("/api/board").status_code == 401
