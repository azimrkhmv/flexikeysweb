"""My Voice cards the parent made (spec §11 AAC, Q2): a label, an emoji or the parent's own photo, and their recorded
voice. On the server, so the cards are the same on every device of the family. The files go straight to storage."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import storage
from app.db import get_session
from app.errors import AppError
from app.modules.auth.session import CurrentUser
from app.modules.children.router import get_visible_child
from app.modules.play.models import VoiceCard
from app.schemas import ApiModel

router = APIRouter(prefix="/children", tags=["my voice"])
MAX_CARDS = 200


class UploadKind(ApiModel):
    kind: Literal["photo", "audio"]


class CardUpload(ApiModel):
    storage_key: str  # give it as photoKey or audioKey once the file is uploaded
    upload_url: str  # PUT the file here within 10 minutes


class CardIn(ApiModel):
    category: str = Field(min_length=1, max_length=24)
    label: str = Field(min_length=1, max_length=60)
    emoji: str = Field(min_length=1, max_length=16)
    photo_key: str | None = None
    audio_key: str | None = None


class CardChange(ApiModel):
    category: str | None = Field(default=None, min_length=1, max_length=24)
    label: str | None = Field(default=None, min_length=1, max_length=60)
    emoji: str | None = Field(default=None, min_length=1, max_length=16)
    photo_key: str | None = None
    audio_key: str | None = None


class CardOut(ApiModel):
    id: uuid.UUID
    category: str
    label: str
    emoji: str
    photo_url: str | None  # links work for 7 days, so the cards keep working on a weak connection
    audio_url: str | None
    created_at: datetime


def _out(c: VoiceCard) -> CardOut:
    def url(key: str | None) -> str | None:
        return storage.download_url(key, storage.OFFLINE_TTL) if key else None

    return CardOut(
        id=c.id,
        category=c.category,
        label=c.label,
        emoji=c.emoji,
        photo_url=url(c.photo_key),
        audio_url=url(c.audio_key),
        created_at=c.created_at,
    )


def _check_file(child_id: uuid.UUID, key: str | None) -> None:
    """Only this child's own uploaded files."""
    if key is not None and not (key.startswith(f"children/{child_id}/voice/") and storage.exists(key)):
        raise AppError(422, "unknown_file")


@router.post("/{child_id}/voice-cards/upload-link")
async def upload_link(
    child_id: uuid.UUID, body: UploadKind, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> CardUpload:
    await get_visible_child(db, user, child_id)
    key = f"children/{child_id}/voice/{body.kind}-{uuid.uuid4()}"
    return CardUpload(storage_key=key, upload_url=storage.upload_url(key))


@router.get("/{child_id}/voice-cards")
async def list_cards(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[CardOut]:
    await get_visible_child(db, user, child_id)
    cards = await db.scalars(select(VoiceCard).where(VoiceCard.child_id == child_id).order_by(VoiceCard.created_at))
    return [_out(c) for c in cards]


@router.post("/{child_id}/voice-cards", status_code=201)
async def add_card(
    child_id: uuid.UUID, body: CardIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> CardOut:
    """A new card. 409 too_many_cards beyond 200."""
    await get_visible_child(db, user, child_id)
    count = select(func.count()).select_from(VoiceCard).where(VoiceCard.child_id == child_id)
    if (await db.scalar(count) or 0) >= MAX_CARDS:
        raise AppError(409, "too_many_cards")
    _check_file(child_id, body.photo_key)
    _check_file(child_id, body.audio_key)
    card = VoiceCard(child_id=child_id, made_by=user.id, **body.model_dump())
    db.add(card)
    await db.commit()
    await db.refresh(card)
    return _out(card)


async def _card(db: AsyncSession, child_id: uuid.UUID, card_id: uuid.UUID) -> VoiceCard:
    card = await db.get(VoiceCard, card_id)
    if card is None or card.child_id != child_id:
        raise AppError(404, "not_found")
    return card


@router.patch("/{child_id}/voice-cards/{card_id}")
async def change_card(
    child_id: uuid.UUID,
    card_id: uuid.UUID,
    body: CardChange,
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> CardOut:
    """Change what was sent; a new photo or recording replaces the old file."""
    await get_visible_child(db, user, child_id)
    card = await _card(db, child_id, card_id)
    change = body.model_dump(exclude_unset=True)
    for field in ("photo_key", "audio_key"):
        if field in change:
            _check_file(child_id, change[field])
            if getattr(card, field) and getattr(card, field) != change[field]:
                storage.remove(getattr(card, field))
    for k, v in change.items():
        setattr(card, k, v)
    await db.commit()
    await db.refresh(card)
    return _out(card)


@router.delete("/{child_id}/voice-cards/{card_id}", status_code=204)
async def delete_card(
    child_id: uuid.UUID, card_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """The card and its files are gone."""
    await get_visible_child(db, user, child_id)
    card = await _card(db, child_id, card_id)
    for key in (card.photo_key, card.audio_key):
        if key:
            storage.remove(key)
    await db.delete(card)
    await db.commit()
