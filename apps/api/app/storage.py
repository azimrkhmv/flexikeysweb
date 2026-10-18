"""File storage (S3 style: MinIO on our computers). Files never pass through this server: it hands out
short-lived signed links, and the browser or app uploads and downloads directly.

Two addresses, because inside Docker the server reaches MinIO as `minio:9000`, while a browser needs the address
it can see (`localhost:9100`, later the real storage domain). Links are signed for S3_PUBLIC_ENDPOINT.
"""

from datetime import timedelta
from functools import cache
from urllib.parse import urlsplit

from minio import Minio
from minio.error import S3Error

from app.settings import settings

UPLOAD_TTL = timedelta(minutes=10)
DOWNLOAD_TTL = timedelta(minutes=15)
OFFLINE_TTL = timedelta(days=7)  # the longest S3 allows; for the next 7 days of videos (A5.7)
REGION = "us-east-1"  # fixed, so signing a link needs no network call


def _client(endpoint: str) -> Minio:
    url = urlsplit(endpoint)
    return Minio(
        url.netloc,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        secure=url.scheme == "https",
        region=REGION,
    )


@cache
def internal() -> Minio:
    """For the server's own calls (checks, deletes)."""
    return _client(settings.s3_endpoint)


@cache
def public() -> Minio:
    """Only signs links for browsers and apps; never connects anywhere itself."""
    return _client(settings.s3_public_endpoint or settings.s3_endpoint)


def upload_url(key: str) -> str:
    """A link that accepts one PUT of the file at `key`, for 10 minutes."""
    return public().presigned_put_object(settings.s3_bucket, key, expires=UPLOAD_TTL)


def download_url(key: str, ttl: timedelta = DOWNLOAD_TTL) -> str:
    """A link to read the file at `key`, for 15 minutes unless said otherwise. Callers decide who may get one (A3.5:
    approved only)."""
    return public().presigned_get_object(settings.s3_bucket, key, expires=ttl)


def exists(key: str) -> bool:
    """Did the upload really happen? (Checked before a video is registered, A3.3.)"""
    try:
        internal().stat_object(settings.s3_bucket, key)
    except S3Error as e:
        if e.code in ("NoSuchKey", "NoSuchObject"):
            return False
        raise  # storage itself is broken: say so, do not pretend the file is missing
    return True
