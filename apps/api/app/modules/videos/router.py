"""The exercise library and its video files (spec §8).

The library comes from app/content/exercises.json (a copy of the website's apps/web/src/content/backend/exercises.json):
`uv run python -m app.cli load-exercises` after each change. An admin registers a finished video file in two steps:
ask for an upload link, upload the file straight to storage, then register it. Every new file waits for a
physiotherapist's review (A3.4) before any family can see it.
"""

import json
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.audit import models as audit
from app.modules.videos.models import Exercise, Video, VideoLang, VideoStatus
from app.schemas import ApiModel

router = APIRouter(prefix="/admin/videos", tags=["videos"])

LIBRARY = Path(__file__).parents[2] / "content" / "exercises.json"
FIELDS = ("title", "body_area", "goals", "gmfcs", "ages", "tool", "difficulty", "conflicts")


async def load_exercises(db: AsyncSession) -> int:
    """Add or update every exercise of exercises.json. One that left the file is kept, inactive: old plans use it."""
    rows = [
        {"id": e["id"], **{k: e[k] for k in FIELDS}, "active": True}
        for e in json.loads(LIBRARY.read_text())["exercises"]
    ]
    stmt = insert(Exercise).values(rows)
    changed = {k: stmt.excluded[k] for k in (*FIELDS, "active")}
    await db.execute(stmt.on_conflict_do_update(index_elements=["id"], set_=changed | {"updated_at": func.now()}))
    await db.execute(
        update(Exercise).where(Exercise.id.not_in([r["id"] for r in rows]), Exercise.active).values(active=False)
    )
    await db.commit()
    return len(rows)


class VideoFile(ApiModel):
    exercise_id: str
    lang: VideoLang


class UploadLink(ApiModel):
    storage_key: str
    upload_url: str  # PUT the file here within 10 minutes


class NewVideo(VideoFile):
    storage_key: str
    duration_s: int | None = None


class VideoOut(ApiModel):
    id: uuid.UUID
    exercise_id: str
    lang: VideoLang
    status: VideoStatus
    duration_s: int | None


async def _active_exercise(db: AsyncSession, exercise_id: str) -> None:
    if not await db.scalar(select(Exercise.active).where(Exercise.id == exercise_id)):
        raise AppError(422, "unknown_exercise")


def _folder(body: VideoFile) -> str:
    return f"videos/{body.exercise_id}/{body.lang.value}/"


@router.post("/upload-link")
async def upload_link(body: VideoFile, _: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> UploadLink:
    """A short-lived link to upload one video file straight to storage."""
    await _active_exercise(db, body.exercise_id)
    key = f"{_folder(body)}{uuid.uuid4()}.mp4"
    return UploadLink(storage_key=key, upload_url=storage.upload_url(key))


@router.post("", status_code=201)
async def register(body: NewVideo, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> VideoOut:
    """Register an uploaded file as the exercise's video in that language. It replaces the old file, and waits for
    review again even if the old one was approved."""
    await _active_exercise(db, body.exercise_id)
    if not body.storage_key.startswith(_folder(body)):
        raise AppError(422, "wrong_storage_key")  # only a file uploaded for this exercise and language
    if not storage.exists(body.storage_key):
        raise AppError(422, "file_missing")
    video = await db.scalar(
        select(Video).where(Video.exercise_id == body.exercise_id, Video.lang == body.lang).with_for_update()
    )
    if video is None:
        video = Video(exercise_id=body.exercise_id, lang=body.lang)
        db.add(video)
    video.storage_key, video.duration_s = body.storage_key, body.duration_s
    video.status, video.approved_by, video.approved_at = VideoStatus.waiting_review, None, None
    await db.flush()
    audit.record(db, admin.id, "video.registered", video.id, exercise=body.exercise_id, lang=body.lang.value)
    await db.commit()
    return VideoOut.model_validate(video, from_attributes=True)
