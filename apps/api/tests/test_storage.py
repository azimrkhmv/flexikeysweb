"""A3.2: short-lived upload and download links, tried for real against MinIO."""

import uuid
from collections.abc import Iterator

import httpx2
import pytest

from app import storage
from app.settings import settings


@pytest.fixture(scope="module", autouse=True)
def bucket() -> Iterator[None]:
    client = storage.internal()
    if not client.bucket_exists(settings.s3_bucket):
        client.make_bucket(settings.s3_bucket)
    yield


def key() -> str:
    return f"tests/{uuid.uuid4()}.mp4"


def test_upload_then_download() -> None:
    k, data = key(), b"\x00\x00\x00\x18ftypmp42 a tiny pretend video"
    assert not storage.exists(k)

    put = httpx2.put(storage.upload_url(k), content=data)  # what the browser does with the link
    assert put.status_code == 200, put.text
    assert storage.exists(k)

    got = httpx2.get(storage.download_url(k))
    assert got.status_code == 200
    assert got.content == data


def test_links_point_at_the_public_address_and_expire() -> None:
    link = httpx2.URL(storage.download_url(key()))
    assert f"{link.scheme}://{link.netloc.decode()}" == (settings.s3_public_endpoint or settings.s3_endpoint)
    assert link.params["X-Amz-Expires"] == str(int(storage.DOWNLOAD_TTL.total_seconds()))
    assert httpx2.URL(storage.upload_url(key())).params["X-Amz-Expires"] == "600"


def test_a_changed_link_is_refused() -> None:
    k = key()
    httpx2.put(storage.upload_url(k), content=b"x")
    link = storage.download_url(k)
    other_file = link.replace(k, key())  # someone edits the link to reach another file
    assert httpx2.get(other_file).status_code == 403


def test_an_upload_link_cannot_be_used_to_read() -> None:
    k = key()
    httpx2.put(storage.upload_url(k), content=b"secret")
    assert httpx2.get(storage.upload_url(k)).status_code == 403
