"""A12.2: deleting a child or the whole account; the rows go at once, the files with the nightly job."""

import uuid
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app import storage
from app.main import app
from app.modules.accounts.models import Family, Role, User
from app.modules.children.models import Child
from app.modules.privacy.router import purge_files
from app.worker import WorkerSettings, purge_deleted_files
from tests.test_admin_changes import make
from tests.test_children import API, add_child, add_helper, parent
from tests.test_play_cards import upload
from tests.test_storage import bucket  # noqa: F401 (makes the test bucket)
from tests.test_videos_register import run, title


@pytest.fixture
def client(bucket: None) -> Iterator[TestClient]:  # noqa: F811
    with TestClient(app) as c:
        yield c


def purge(client: TestClient) -> int:
    async def go(db: Any) -> int:
        return await purge_files(db)

    return run(client, go)  # type: ignore[no-any-return]


def test_a_deleted_childs_files_go_with_the_nightly_job(client: TestClient) -> None:
    owner = parent(client)
    child = add_child(client, owner)
    key = upload(client, owner, child, "photo", b"a photo")
    assert storage.exists(key)
    assert client.delete(f"{API}/children/{child}", headers=owner).status_code == 204
    assert title(client.get(f"{API}/children/{child}", headers=owner)) == (404, "not_found")  # the rows: at once
    assert purge(client) >= 1
    assert not storage.exists(key)  # the files: after the job
    job = next(j for j in WorkerSettings.cron_jobs if j.coroutine is purge_deleted_files)
    assert (job.hour, job.minute) == (22, 30)  # 03:30 in Tashkent


def test_a_parent_deletes_the_whole_account(client: TestClient) -> None:
    owner = parent(client)
    me = uuid.UUID(client.get(f"{API}/me", headers=owner).json()["id"])
    child = add_child(client, owner)
    key = upload(client, owner, child, "audio", b"a voice")
    helper = add_helper(client, owner)
    other = parent(client)
    theirs = add_child(client, other)

    assert client.delete(f"{API}/me", headers=owner).status_code == 204

    async def left(db: Any) -> tuple[Any, ...]:
        return (
            await db.get(User, me),
            await db.get(Child, uuid.UUID(child)),
            await db.scalar(
                select(Family.id).join(Child, Child.family_id == Family.id).where(Child.id == uuid.UUID(theirs))
            ),
        )

    user, gone_child, other_family = run(client, left)
    assert user is None and gone_child is None and other_family is not None  # another family is untouched
    assert client.get(f"{API}/children", headers=helper).json() == []  # the helper's access ended with it
    assert client.get(f"{API}/me", headers=owner).status_code == 401
    purge(client)
    assert not storage.exists(key)


def test_staff_accounts_are_closed_by_an_admin(client: TestClient) -> None:
    _, physio, _ = make(client, Role.physio)
    assert title(client.delete(f"{API}/me", headers=physio)) == (403, "ask_admin")
