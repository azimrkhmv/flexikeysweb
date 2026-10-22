"""A5.7: the next 7 days of videos, with links that work for 7 days, so they can be saved and played offline."""

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import httpx2
import pytest
from fastapi.testclient import TestClient

from app.main import app
from tests.test_children import API, parent
from tests.test_plan_create import approved_putty  # noqa: F401 (fixture)
from tests.test_plan_read import family_with_plan, move_start
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_today_done import putty_days
from tests.test_videos_register import title


@pytest.fixture
def client() -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


def test_the_week_of_videos_with_7_day_links(client: TestClient, approved_putty: None) -> None:  # noqa: F811
    owner, child = family_with_plan(client)
    days = putty_days(client, owner, child)
    move_start(client, child, days[0] + 7)  # a week after the first putty day: putty is not in the coming 7 days
    later = [d for d in days if days[0] + 7 <= d < days[0] + 14]
    got = client.get(f"{API}/children/{child}/videos", headers=owner).json()  # the child's language: Uzbek
    assert (len(got) == 1) == bool(later)

    move_start(client, child, days[0])  # today is a putty day
    (video,) = client.get(f"{API}/children/{child}/videos", headers=owner, params={"lang": "uz"}).json()
    assert (video["exerciseId"], video["lang"]) == ("putty_squeeze", "uz")
    assert parse_qs(urlparse(video["url"]).query)["X-Amz-Expires"] == [str(7 * 24 * 3600)]
    expires = datetime.fromisoformat(video["expiresAt"])
    assert timedelta(days=6, hours=23) < expires - datetime.now(UTC) <= timedelta(days=7)
    assert httpx2.get(video["url"]).status_code == 200  # the file itself downloads with the link

    again = client.get(f"{API}/children/{child}/videos", headers=owner).json()[0]
    assert again["cacheKey"] == video["cacheKey"]  # same file, same key: no second download
    assert (
        client.get(f"{API}/children/{child}/videos", headers=owner, params={"lang": "en"}).json() == []
    )  # not approved


def test_only_the_family(client: TestClient) -> None:
    _, child = family_with_plan(client)
    assert title(client.get(f"{API}/children/{child}/videos", headers=parent(client))) == (404, "not_found")
