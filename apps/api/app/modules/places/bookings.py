"""Booking (A10.4, spec §11): a family books a free time, in person or online; the clinic confirms or cancels and adds
the online link; either side can cancel. The database refuses a second booking of the same time
(uq_bookings_one_per_slot), so two families pressing at once cannot both get it.

The family pays the clinic directly; no money passes here. The clinic sees the child's first name and age and the
parent's phone, which the family gives by booking.
"""

import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.models import User
from app.modules.audit import models as audit
from app.modules.auth.session import CurrentUser
from app.modules.children.models import Child
from app.modules.children.router import get_visible_child
from app.modules.places.clinic import Clinic, my_place
from app.modules.places.models import Booking, BookingMode, BookingStatus, Place, Slot
from app.schemas import ApiModel

router = APIRouter(tags=["booking"])

OPEN = (BookingStatus.booked, BookingStatus.confirmed)


class FreeSlot(ApiModel):
    id: uuid.UUID
    starts_at: datetime
    minutes: int
    specialist: str | None
    in_person: bool
    online: bool


class BookingIn(ApiModel):
    slot_id: uuid.UUID
    mode: BookingMode


class BookingOut(ApiModel):
    id: uuid.UUID
    slot_id: uuid.UUID
    place_id: uuid.UUID
    place_name: str
    starts_at: datetime
    minutes: int
    specialist: str | None
    mode: BookingMode
    status: BookingStatus
    online_link: str | None
    cancelled_by: str | None


class ClinicBooking(BookingOut):
    child_name: str
    child_birth_date: date
    parent_phone: str | None


async def _out(db: AsyncSession, b: Booking) -> BookingOut:
    slot = await db.get(Slot, b.slot_id)
    assert slot is not None  # noqa: S101 (a booking's slot goes only with the booking)
    place = await db.get(Place, slot.place_id)
    return BookingOut(
        id=b.id,
        slot_id=b.slot_id,
        place_id=slot.place_id,
        place_name=place.name if place else "",
        starts_at=slot.starts_at,
        minutes=slot.minutes,
        specialist=slot.specialist,
        mode=b.mode,
        status=b.status,
        online_link=b.online_link,
        cancelled_by=b.cancelled_by,
    )


# ---------------------------------------------------------------- the family


@router.get("/places/{place_id}/slots")
async def free_slots(
    place_id: uuid.UUID, _: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[FreeSlot]:
    """The free times still to come, earliest first. A taken time is not listed."""
    taken = select(Booking.slot_id).where(Booking.status.in_(OPEN))
    rows = await db.scalars(
        select(Slot)
        .join(Place, Place.id == Slot.place_id)
        .where(Slot.place_id == place_id, Place.active, Slot.starts_at > datetime.now(UTC), Slot.id.not_in(taken))
        .order_by(Slot.starts_at)
    )
    return [FreeSlot.model_validate(s, from_attributes=True) for s in rows]


@router.post("/children/{child_id}/bookings", status_code=201)
async def book(
    child_id: uuid.UUID, body: BookingIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> BookingOut:
    """409 slot_taken when someone booked it first; 422 slot_gone (past or removed), mode_not_offered."""
    await get_visible_child(db, user, child_id)
    slot = await db.get(Slot, body.slot_id)
    place = await db.get(Place, slot.place_id) if slot else None
    if slot is None or place is None or not place.active or slot.starts_at <= datetime.now(UTC):
        raise AppError(422, "slot_gone")
    if not (slot.online if body.mode == BookingMode.online else slot.in_person):
        raise AppError(422, "mode_not_offered")
    booking = Booking(slot_id=slot.id, child_id=child_id, booked_by=user.id, mode=body.mode)
    db.add(booking)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise AppError(409, "slot_taken") from None
    audit.record(db, user.id, "booking.made", child_id, booking=str(booking.id))
    await db.commit()
    return await _out(db, booking)


@router.get("/children/{child_id}/bookings")
async def family_bookings(
    child_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[BookingOut]:
    """This child's bookings, cancelled ones too, by time."""
    await get_visible_child(db, user, child_id)
    rows = await db.scalars(
        select(Booking)
        .join(Slot, Slot.id == Booking.slot_id)
        .where(Booking.child_id == child_id)
        .order_by(Slot.starts_at)
    )
    return [await _out(db, b) for b in rows]


@router.post("/children/{child_id}/bookings/{booking_id}/cancel")
async def family_cancel(
    child_id: uuid.UUID, booking_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> BookingOut:
    """The time is free again for others."""
    await get_visible_child(db, user, child_id)
    b = await db.get(Booking, booking_id)
    if b is None or b.child_id != child_id:
        raise AppError(404, "not_found")
    if b.status in OPEN:
        b.status, b.cancelled_by = BookingStatus.cancelled, "family"
        audit.record(db, user.id, "booking.cancelled", child_id, booking=str(b.id), by="family")
        await db.commit()
    return await _out(db, b)


# ---------------------------------------------------------------- the clinic


async def _clinic_out(db: AsyncSession, b: Booking) -> ClinicBooking:
    child = await db.get(Child, b.child_id)
    parent = await db.get(User, b.booked_by) if b.booked_by else None
    assert child is not None  # noqa: S101 (a child's bookings go with the child)
    return ClinicBooking(
        **(await _out(db, b)).model_dump(), child_name=child.name, child_birth_date=child.birth_date,
        parent_phone=parent.phone if parent else None,
    )  # fmt: skip


@router.get("/clinic/places/{place_id}/bookings")
async def clinic_bookings(
    place_id: uuid.UUID, user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]
) -> list[ClinicBooking]:
    """Bookings of this place from now on, earliest first; cancelled ones too."""
    await my_place(db, user, place_id)
    rows = await db.scalars(
        select(Booking)
        .join(Slot, Slot.id == Booking.slot_id)
        .where(Slot.place_id == place_id, Slot.starts_at >= datetime.now(UTC))
        .order_by(Slot.starts_at)
    )
    return [await _clinic_out(db, b) for b in rows]


class Decision(ApiModel):
    online_link: str | None = Field(default=None, max_length=500, pattern=r"^https://")


async def _clinic_booking(db: AsyncSession, user: User, booking_id: uuid.UUID) -> Booking:
    b = await db.get(Booking, booking_id)
    slot = await db.get(Slot, b.slot_id) if b else None
    if b is None or slot is None:
        raise AppError(404, "not_found")
    await my_place(db, user, slot.place_id)  # another clinic's booking does not exist for this one
    return b


@router.post("/clinic/bookings/{booking_id}/confirm")
async def confirm(
    booking_id: uuid.UUID, body: Decision, user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]
) -> ClinicBooking:
    """Confirm, and for an online session give the link (422 online_link_needed without one)."""
    b = await _clinic_booking(db, user, booking_id)
    if b.status == BookingStatus.cancelled:
        raise AppError(409, "booking_cancelled")
    link = body.online_link or b.online_link
    if b.mode == BookingMode.online and not link:
        raise AppError(422, "online_link_needed")
    b.status, b.online_link = BookingStatus.confirmed, link
    audit.record(db, user.id, "booking.confirmed", b.child_id, booking=str(b.id))
    await db.commit()
    return await _clinic_out(db, b)


@router.post("/clinic/bookings/{booking_id}/cancel")
async def clinic_cancel(
    booking_id: uuid.UUID, user: Clinic, db: Annotated[AsyncSession, Depends(get_session)]
) -> ClinicBooking:
    b = await _clinic_booking(db, user, booking_id)
    if b.status in OPEN:
        b.status, b.cancelled_by = BookingStatus.cancelled, "clinic"
        audit.record(db, user.id, "booking.cancelled", b.child_id, booking=str(b.id), by="clinic")
        await db.commit()
    return await _clinic_out(db, b)
