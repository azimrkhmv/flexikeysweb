"""Movement and feedback clips (A8.3).

The family: get an upload link, add the clip, watch their own clips with the replies, delete any clip (the file goes
too). Adding needs the child's `movement_videos` consent.
The therapist: watch the clips of a child shared with them, and reply. Only while the share is active and the consent
is given; every time a therapist opens the clips it goes into the audit log.
"""

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import User
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.billing.router import require_pro
from app.modules.children.consents import ConsentKind, has_consent, require_consent
from app.modules.children.router import get_visible_child
from app.modules.clips.models import Clip, ClipKind, ClipReply
from app.modules.therapists.router import get_shared_child
from app.modules.videos.models import Exercise
from app.schemas import ApiModel
from app.settings import settings

router = APIRouter(prefix="/children", tags=["clips"])
therapist_router = APIRouter(prefix="/therapist", tags=["clips"])
MAX = {ClipKind.movement: 3, ClipKind.feedback: 30}  # P40: up to 3 movement clips


class ClipUpload(ApiModel):
    storage_key: str  # give it to POST …/clips once the file is uploaded
    upload_url: str  # PUT the file here within 10 minutes


class ClipIn(ApiModel):
    kind: ClipKind
    storage_key: str
    exercise_id: str | None = None  # required for a feedback clip


class ReplyIn(ApiModel):
    text: str = Field(min_length=1, max_length=1000)


class ReplyOut(ApiModel):
    therapist_name: str | None
    text: str
    at: datetime


class ClipOut(ApiModel):
    id: uuid.UUID
    kind: ClipKind
    exercise_id: str | None
    url: str  # a 15-minute link to watch it
    created_at: datetime
    replies: list[ReplyOut]


async def _clips(db: AsyncSession, child_id: uuid.UUID) -> list[ClipOut]:
    clips = list(await db.scalars(select(Clip).where(Clip.child_id == child_id).order_by(Clip.created_at)))
    rows = await db.execute(
        select(ClipReply, User.name)
        .outerjoin(User, User.id == ClipReply.therapist_id)
        .where(ClipReply.clip_id.in_([c.id for c in clips]))
        .order_by(ClipReply.created_at)
    )
    replies: dict[uuid.UUID, list[ReplyOut]] = {}
    for r, name in rows:
        replies.setdefault(r.clip_id, []).append(ReplyOut(therapist_name=name, text=r.text, at=r.created_at))
    return [
        ClipOut(
            id=c.id,
            kind=c.kind,
            exercise_id=c.exercise_id,
            url=storage.download_url(c.storage_key),
            created_at=c.created_at,
            replies=replies.get(c.id, []),
        )
        for c in clips
    ]


# ---------------------------------------------------------------- the family


@router.post("/{child_id}/clips/upload-link")
async def upload_link(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> ClipUpload:
    await get_visible_child(db, user, child_id)
    await require_consent(db, child_id, ConsentKind.movement_videos)
    key = f"children/{child_id}/clips/{uuid.uuid4()}"
    return ClipUpload(storage_key=key, upload_url=storage.upload_url(key))


@router.post("/{child_id}/clips", status_code=201)
async def add_clip(
    child_id: uuid.UUID, body: ClipIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> ClipOut:
    """Add an uploaded clip. 409 too_many_clips beyond 3 movement or 30 feedback clips."""
    await get_visible_child(db, user, child_id)
    await require_consent(db, child_id, ConsentKind.movement_videos)
    if not (body.storage_key.startswith(f"children/{child_id}/clips/") and storage.exists(body.storage_key)):
        raise AppError(422, "unknown_file")
    if body.kind == ClipKind.feedback:
        await require_pro(db, child_id, free_allows=settings.free_therapist_sharing)
        if body.exercise_id is None or await db.get(Exercise, body.exercise_id) is None:
            raise AppError(422, "unknown_exercise")
    elif body.exercise_id is not None:
        raise AppError(422, "unknown_exercise")  # a movement clip is not about one exercise
    count = select(func.count()).select_from(Clip).where(Clip.child_id == child_id, Clip.kind == body.kind)
    if (await db.scalar(count) or 0) >= MAX[body.kind]:
        raise AppError(409, "too_many_clips", max=MAX[body.kind])
    clip = Clip(child_id=child_id, uploaded_by=user.id, **body.model_dump())
    db.add(clip)
    await db.commit()
    return next(c for c in await _clips(db, child_id) if c.id == clip.id)


@router.get("/{child_id}/clips")
async def family_clips(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[ClipOut]:
    """The family's own clips with the therapists' replies, oldest first."""
    await get_visible_child(db, user, child_id)
    return await _clips(db, child_id)


@router.delete("/{child_id}/clips/{clip_id}", status_code=204)
async def delete_clip(
    child_id: uuid.UUID, clip_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    """The clip, its replies and its file are gone."""
    await get_visible_child(db, user, child_id)
    clip = await db.get(Clip, clip_id)
    if clip is None or clip.child_id != child_id:
        raise AppError(404, "not_found")
    key = clip.storage_key
    await db.delete(clip)
    audit.record(db, user.id, "clip.deleted", child_id, clip=str(clip_id))
    await db.commit()
    storage.remove(key)
    return Response(status_code=204)


# ---------------------------------------------------------------- the therapist


async def _shared_with_clips(db: AsyncSession, user: User, child_id: uuid.UUID) -> None:
    """A shared child whose parent allows movement videos; 404 otherwise, as if there were no child."""
    await get_shared_child(db, user, child_id)
    if not await has_consent(db, child_id, ConsentKind.movement_videos):
        raise AppError(404, "not_found")


@therapist_router.get("/children/{child_id}/clips")
async def therapist_clips(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[ClipOut]:
    await _shared_with_clips(db, user, child_id)
    audit.record(db, user.id, "therapist.clips_viewed", child_id)
    await db.commit()
    return await _clips(db, child_id)


@therapist_router.post("/children/{child_id}/clips/{clip_id}/replies", status_code=201)
async def reply(
    child_id: uuid.UUID,
    clip_id: uuid.UUID,
    body: ReplyIn,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> ReplyOut:
    await _shared_with_clips(db, user, child_id)
    clip = await db.get(Clip, clip_id)
    if clip is None or clip.child_id != child_id:
        raise AppError(404, "not_found")
    r = ClipReply(clip_id=clip_id, therapist_id=user.id, text=body.text)
    db.add(r)
    await db.commit()
    await db.refresh(r)
    return ReplyOut(therapist_name=user.name, text=r.text, at=r.created_at)
