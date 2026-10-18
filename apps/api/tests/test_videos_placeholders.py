"""C7: placeholder videos on test servers, so plans hold exercises before the real videos exist; never in production."""

from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

from app.errors import AppError
from app.main import app
from app.modules.videos.models import PLACEHOLDERS, Exercise, Video
from app.modules.videos.router import PLACEHOLDER_FILES, load_placeholders
from app.settings import settings
from tests.test_children import API, parent
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import run, title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def placeholders(client: TestClient) -> Iterator[None]:
    run(client, load_placeholders)
    yield

    async def remove(db: Any) -> None:  # the other tests expect a library without them
        await db.execute(delete(Video).where(Video.storage_key.startswith(PLACEHOLDERS)))
        await db.commit()

    run(client, remove)


def test_every_exercise_and_language_has_a_clip() -> None:
    files = {p.name for p in PLACEHOLDER_FILES.glob("*.mp4")}
    if not files:
        pytest.skip("website files not present")
    assert len(files) == 33 * 3 and "putty_squeeze.uz.mp4" in files


def test_a_family_watches_the_placeholder_on_a_test_server(client: TestClient, placeholders: None) -> None:
    async def counts(db: Any) -> tuple[int, int]:
        exercises = await db.scalar(select(func.count()).select_from(Exercise).where(Exercise.active))
        return exercises, await db.scalar(select(func.count()).select_from(Video))

    exercises, videos = run(client, counts)
    assert videos >= exercises * 3  # every exercise in every language
    assert run(client, load_placeholders) == 0  # nothing twice, and a real video is never replaced
    got = client.get(f"{API}/videos/finger_walk", headers=parent(client), params={"lang": "ru"})
    assert got.status_code == 200 and "placeholders/finger_walk/ru.mp4" in got.json()["watchUrl"]


def test_production_refuses_placeholders(
    client: TestClient, placeholders: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "env", "prod")
    got = client.get(f"{API}/videos/finger_walk", headers=parent(client), params={"lang": "ru"})
    assert title(got) == (404, "not_found")
    with pytest.raises(AppError) as e:
        run(client, load_placeholders)
    assert e.value.code == "placeholders_not_in_production"
