"""Clinic accounts (A10.3): a clinic sees only the places an admin linked to it, and publishes their free times.
Everyone else gets 404 for those places, as if they did not exist."""

import uuid
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from pydantic import Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import require_role
from app.modules.accounts.models import Role, User
from app.modules.places.models import Booking, BookingStatus, Place, Slot
from app.schemas import ApiModel

router = APIRouter(prefix="/clinic", tags=["clinic"])
Clinic = Annotated[User, Depends(require_role(Role.clinic))]
AHEAD = timedelta(days=90)  # free times are published at most 3 months ahead


class MyPlace(ApiModel):
    id: uuid.UUID
    name: str
    district: str


class SlotIn(ApiModel):
    starts_at: datetime
    minutes: int = Field(ge=10, le=240)
    specialist: str | None = Field(default=None, max_length=80)
    in_person: bool = True
    online: bool = False

    @model_validator(mode="after")
    def _mode(self) -> "SlotIn":
        if not (self.in_person or self.online):
            raise ValueError("in person, online, or both")
        if self.starts_at.tzinfo is None:
            raise ValueError("a time with its zone")
        return self


class SlotOut(SlotIn):
    id: uuid.UUID


async def my_place(db: AsyncSession, user: User, place_id: uuid.UUID) -> Place:
    place = await db.get(Place, place_id)
    if place is None or place.clinic_id != user.id:
        raise AppError(404, "not_found")
    return place


@router.get("/places")
async def my_places(user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]) -> list[MyPlace]:
    rows = await db.scalars(select(Place).where(Place.clinic_id == user.id).order_by(Place.name))
    return [MyPlace(id=p.id, name=p.name, district=p.district) for p in rows]


@router.get("/places/{place_id}/slots")
async def slots(place_id: uuid.UUID, user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]) -> list[SlotOut]:
    """This place's free times from now on, earliest first."""
    await my_place(db, user, place_id)
    rows = await db.scalars(
        select(Slot).where(Slot.place_id == place_id, Slot.starts_at >= datetime.now(UTC)).order_by(Slot.starts_at)
    )
    return [SlotOut.model_validate(s, from_attributes=True) for s in rows]


@router.post("/places/{place_id}/slots", status_code=201)
async def add_slot(
    place_id: uuid.UUID, body: SlotIn, user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]
) -> SlotOut:
    """422 slot_in_past, slot_too_far (more than 3 months ahead); 409 slot_overlaps when the same specialist (or
    the place, when no specialist is named) already has a time then."""
    await my_place(db, user, place_id)
    now = datetime.now(UTC)
    if body.starts_at <= now:
        raise AppError(422, "slot_in_past")
    if body.starts_at > now + AHEAD:
        raise AppError(422, "slot_too_far")
    end = body.starts_at + timedelta(minutes=body.minutes)
    same = await db.scalars(
        select(Slot).where(
            Slot.place_id == place_id,
            Slot.specialist.is_(None) if body.specialist is None else Slot.specialist == body.specialist,
            Slot.starts_at < end,
            Slot.starts_at > body.starts_at - timedelta(minutes=240),
        )
    )
    if any(s.starts_at + timedelta(minutes=s.minutes) > body.starts_at for s in same):
        raise AppError(409, "slot_overlaps")
    slot = Slot(place_id=place_id, **body.model_dump())
    db.add(slot)
    await db.commit()
    return SlotOut.model_validate(slot, from_attributes=True)


@router.delete("/places/{place_id}/slots/{slot_id}", status_code=204)
async def delete_slot(
    place_id: uuid.UUID, slot_id: uuid.UUID, user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]
) -> Response:
    await my_place(db, user, place_id)
    slot = await db.get(Slot, slot_id)
    if slot is None or slot.place_id != place_id:
        raise AppError(404, "not_found")
    booked = select(Booking.id).where(Booking.slot_id == slot_id, Booking.status != BookingStatus.cancelled)
    if await db.scalar(booked):
        raise AppError(409, "slot_booked")  # cancel the booking first, so the family is told
    await db.delete(slot)
    await db.commit()
    return Response(status_code=204)
