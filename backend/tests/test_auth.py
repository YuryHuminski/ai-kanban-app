import pytest

from app.auth import COOKIE_NAME

GOOD = {"username": "user", "password": "password"}


def test_login_success_sets_http_only_cookie(client):
    response = client.post("/api/login", json=GOOD)
    assert response.status_code == 200
    assert response.json() == {"username": "user"}
    set_cookie = response.headers["set-cookie"]
    assert COOKIE_NAME in set_cookie
    assert "HttpOnly" in set_cookie


@pytest.mark.parametrize(
    "body",
    [
        {"username": "user", "password": "wrong"},
        {"username": "other", "password": "password"},
    ],
)
def test_login_bad_credentials_rejected(client, body):
    response = client.post("/api/login", json=body)
    assert response.status_code == 401
    assert "set-cookie" not in response.headers


def test_me_without_cookie_is_unauthorized(client):
    assert client.get("/api/me").status_code == 401


def test_me_with_cookie(client):
    client.post("/api/login", json=GOOD)
    response = client.get("/api/me")
    assert response.status_code == 200
    assert response.json() == {"username": "user"}


def test_me_rejects_tampered_cookie(client):
    client.cookies.set(COOKIE_NAME, "user.not-a-valid-signature")
    assert client.get("/api/me").status_code == 401


def test_logout_clears_cookie(client):
    client.post("/api/login", json=GOOD)
    assert client.post("/api/logout").status_code == 200
    assert client.get("/api/me").status_code == 401
