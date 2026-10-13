import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# The app mounts the static dir on import, so it must exist before then.
static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<h1>Kanban Studio</h1>")
os.environ["STATIC_DIR"] = str(static_dir)

from app.main import app  # noqa: E402  (after STATIC_DIR is set)


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A client with its own empty database; startup creates and seeds it."""
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    with TestClient(app) as test_client:
        yield test_client
