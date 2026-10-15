from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.health import router as health


@pytest.fixture(scope="module")
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:  # one event loop for all requests, so pooled database connections stay valid
        yield c


async def ok() -> None:
    return None


async def down() -> None:
    raise ConnectionError


def test_healthz(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readyz_ok_when_db_and_redis_answer(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(health.CHECKS, "redis", ok)  # the real database is checked; Redis is not needed in tests
    r = client.get("/readyz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "checks": {"db": "ok", "redis": "ok"}}


def test_readyz_503_when_something_is_down(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(health.CHECKS, "redis", down)
    r = client.get("/readyz")
    assert r.status_code == 503
    assert r.json()["title"] == "not_ready"
    assert r.json()["checks"] == {"db": "ok", "redis": "fail"}
