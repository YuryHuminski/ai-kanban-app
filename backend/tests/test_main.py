from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_hello():
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "Hello from FastAPI"}


def test_index_served():
    response = client.get("/")
    assert response.status_code == 200
    assert "Kanban Studio" in response.text
