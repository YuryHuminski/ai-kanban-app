import hashlib
import hmac
import os

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from pydantic import BaseModel

# MVP: single hardcoded user. The secret signs the session cookie.
USERNAME = "user"
PASSWORD = "password"
SECRET = os.environ.get("SESSION_SECRET", "dev-secret-change-me").encode()
COOKIE_NAME = "session"

router = APIRouter(prefix="/api")


class Credentials(BaseModel):
    username: str
    password: str


def sign(username: str) -> str:
    signature = hmac.new(SECRET, username.encode(), hashlib.sha256).hexdigest()
    return f"{username}.{signature}"


def verify(value: str | None) -> str | None:
    if not value or "." not in value:
        return None
    username, _ = value.rsplit(".", 1)
    return username if hmac.compare_digest(value, sign(username)) else None


@router.post("/login")
def login(credentials: Credentials, response: Response):
    if credentials.username != USERNAME or credentials.password != PASSWORD:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    response.set_cookie(
        COOKIE_NAME, sign(credentials.username), httponly=True, samesite="lax"
    )
    return {"username": credentials.username}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {}


def current_username(session: str | None = Cookie(default=None)) -> str:
    username = verify(session)
    if username is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return username


@router.get("/me")
def me(username: str = Depends(current_username)):
    return {"username": username}
