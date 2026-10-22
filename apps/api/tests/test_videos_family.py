"""A3.5: families only ever get approved videos (product rule 3)."""

from collections.abc import Iterator

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.accounts.models import Role
from tests.test_admin_changes import make
from tests.test_children import API, parent
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import title
from tests.test_videos_review import decide, new_video


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def watch(client: TestClient, auth: dict[str, str], exercise: str, lang: str) -> httpx2.Response:
    return client.get(f"{API}/videos/{exercise}", headers=auth, params={"lang": lang})


def test_a_parent_never_gets_a_video_that_is_not_approved(client: TestClient) -> None:
    video = new_video(client, "sit_reach_sides", "ru")
    family = parent(client)
    _, physio, _ = make(client, Role.physio)

    assert title(watch(client, family, "sit_reach_sides", "ru")) == (404, "not_found")  # waiting for review
    for decision in ("changes_requested", "rejected"):
        assert decide(client, physio, video, decision, "Not yet").status_code == 200
        assert title(watch(client, family, "sit_reach_sides", "ru")) == (404, "not_found")

    assert decide(client, physio, video, "approved").status_code == 200
    r = watch(client, family, "sit_reach_sides", "ru")
    assert (r.status_code, r.json()["exerciseId"], r.json()["lang"]) == (200, "sit_reach_sides", "ru")
    assert httpx2.get(r.json()["watchUrl"]).content == b"pretend video"
    assert title(watch(client, family, "sit_reach_sides", "en")) == (404, "not_found")  # no English video yet

    assert decide(client, physio, video, "changes_requested", "One more fix").status_code == 200
    assert title(watch(client, family, "sit_reach_sides", "ru")) == (404, "not_found")  # an approval taken back


def test_there_is_no_uzbek_cyrillic(client: TestClient) -> None:
    """FA3: three languages (founders, 2026-10-22)."""
    assert watch(client, parent(client), "walk_line", "uz_cyrl").status_code == 422


def test_signed_out_gets_nothing(client: TestClient) -> None:
    assert watch(client, {}, "walk_line", "uz").status_code == 401
