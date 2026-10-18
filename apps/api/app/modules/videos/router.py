"""The exercise library and its video files (spec §8).

The library comes from app/content/exercises.json (a copy of the website's apps/web/src/content/backend/exercises.json):
`uv run python -m app.cli load-exercises` after each change. An admin registers a finished video file in two steps:
ask for an upload link, upload the file straight to storage, then register it. Every new file waits for a
physiotherapist's review (A3.4) before any family can see it.
"""

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin, require_role
from app.modules.accounts.models import Lang, Role, User
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.videos.models import (
    PLACEHOLDERS,
    Exercise,
    ReviewDecision,
    Video,
    VideoLang,
    VideoReview,
    VideoStatus,
    servable,
)
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/admin/videos", tags=["videos"])
review_router = APIRouter(prefix="/review/videos", tags=["videos"])
family_router = APIRouter(prefix="/videos", tags=["videos"])
# Only a physiotherapist decides about a video, not even an admin (product rule 3).
Physio = Annotated[User, Depends(require_role(Role.physio))]

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


# The placeholder clips (C7): apps/web/scripts/placeholder-videos.py makes them, the demo plays them from here.
PLACEHOLDER_FILES = Path(__file__).parents[4] / "web" / "public" / "placeholder-videos"


async def load_placeholders(db: AsyncSession, folder: Path = PLACEHOLDER_FILES) -> int:
    """Test servers only: a placeholder video for every exercise and language that has no video yet, approved, so
    plans hold exercises before the real videos exist. A real video is never replaced. Refused in production."""
    if settings.env == "prod":
        raise AppError(403, "placeholders_not_in_production")
    await load_exercises(db)
    added = 0
    for file in sorted(folder.glob("*.mp4")):  # noqa: ASYNC240 (a command run by hand, not a request)
        exercise_id, lang = file.stem.rsplit(".", 1)
        key = f"{PLACEHOLDERS}{exercise_id}/{lang}.mp4"
        storage.internal().fput_object(settings.s3_bucket, key, str(file), content_type="video/mp4")
        new = await db.scalar(
            insert(Video)
            .values(
                id=uuid.uuid4(),
                exercise_id=exercise_id,
                lang=VideoLang(lang),
                storage_key=key,
                duration_s=4,
                status=VideoStatus.approved,
                approved_at=datetime.now(UTC),
            )
            .on_conflict_do_nothing(index_elements=["exercise_id", "lang"])
            .returning(Video.id)
        )
        added += new is not None
    await db.commit()
    return added


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


class ReviewNote(ApiModel):
    decision: ReviewDecision
    note: str | None
    reviewer_id: uuid.UUID | None
    at: datetime


class ReviewItem(VideoOut):
    title: dict[str, str]  # the exercise's name in uz, ru, en
    watch_url: str  # a 15-minute link to the file
    # The exercise's tags, so the physiotherapist also checks they fit what the video shows.
    body_area: str
    goals: list[str]
    gmfcs: list[int]
    ages: list[str]
    tool: str | None
    difficulty: int
    conflicts: list[str]
    approved_by: uuid.UUID | None
    approved_at: datetime | None
    history: list[ReviewNote]  # every earlier decision on this video, oldest first


@review_router.get("")
async def review_queue(
    _: Physio, db: Annotated[AsyncSession, Depends(get_session)], status: VideoStatus = VideoStatus.waiting_review
) -> list[ReviewItem]:
    """Videos with this status (by default: waiting for review), oldest first, with their tags and history."""
    rows = list(
        await db.execute(
            select(Video, Exercise)
            .join(Exercise, Exercise.id == Video.exercise_id)
            .where(Video.status == status)
            .order_by(Video.updated_at)
        )
    )
    history: dict[uuid.UUID, list[ReviewNote]] = {}
    for r in await db.scalars(
        select(VideoReview).where(VideoReview.video_id.in_([v.id for v, _ in rows])).order_by(VideoReview.created_at)
    ):
        history.setdefault(r.video_id, []).append(
            ReviewNote(decision=r.decision, note=r.note, reviewer_id=r.reviewer_id, at=r.created_at)
        )
    return [
        ReviewItem(
            id=v.id,
            exercise_id=v.exercise_id,
            lang=v.lang,
            status=v.status,
            duration_s=v.duration_s,
            title=e.title,
            watch_url=storage.download_url(v.storage_key),
            body_area=e.body_area,
            goals=e.goals,
            gmfcs=e.gmfcs,
            ages=e.ages,
            tool=e.tool,
            difficulty=e.difficulty,
            conflicts=e.conflicts,
            approved_by=v.approved_by,
            approved_at=v.approved_at,
            history=history.get(v.id, []),
        )
        for v, e in rows
    ]


class Decision(ApiModel):
    decision: ReviewDecision
    note: str | None = None


@review_router.post("/{video_id}")
async def decide(
    video_id: uuid.UUID, body: Decision, physio: Physio, db: Annotated[AsyncSession, Depends(get_session)]
) -> VideoOut:
    """Approve, reject, or ask for changes. Rejecting and asking for changes need a note for the video team. Every
    decision is kept with who, when and which file, and goes into the audit log."""
    note = (body.note or "").strip() or None
    if body.decision != ReviewDecision.approved and note is None:
        raise AppError(422, "note_required")
    video = await db.scalar(select(Video).where(Video.id == video_id).with_for_update())
    if video is None:
        raise AppError(404, "not_found")
    db.add(
        VideoReview(
            video_id=video.id, reviewer_id=physio.id, decision=body.decision, note=note, storage_key=video.storage_key
        )
    )
    video.status = VideoStatus(body.decision.value)
    approved = body.decision == ReviewDecision.approved
    video.approved_by, video.approved_at = (physio.id, datetime.now(UTC)) if approved else (None, None)
    audit.record(db, physio.id, f"video.{body.decision.value}", video.id, note=note, file=video.storage_key)
    await db.commit()
    return VideoOut.model_validate(video, from_attributes=True)


class FamilyVideo(ApiModel):
    exercise_id: str
    lang: VideoLang
    duration_s: int | None
    watch_url: str  # a 15-minute link to the file


@family_router.get("/{exercise_id}")
async def watch(
    exercise_id: str, lang: Lang, _: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> FamilyVideo:
    """The exercise's video in this language, only once a physiotherapist approved it (product rule 3). Anything
    else, even a video waiting for review, answers "not found". Uzbek Cyrillic gets the Uzbek video."""
    video_lang = VideoLang.uz if lang == Lang.uz_cyrl else VideoLang(lang.value)
    video = await db.scalar(select(Video).where(Video.exercise_id == exercise_id, Video.lang == video_lang, servable()))
    if video is None:
        raise AppError(404, "not_found")
    return FamilyVideo(
        exercise_id=video.exercise_id,
        lang=video.lang,
        duration_s=video.duration_s,
        watch_url=storage.download_url(video.storage_key),
    )
