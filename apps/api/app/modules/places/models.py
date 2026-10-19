"""Find help (spec §11): verified places, each checked by phone by our team. About 40 at launch, Tashkent first."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.modules.accounts.models import enum_column


class PlaceKind(StrEnum):
    state_centre = "state_centre"  # free; listed first
    private_clinic = "private_clinic"
    specialist = "specialist"  # one specialist working on their own


class Need(StrEnum):
    """What the parent picks in plain words (spec §11); "I'm not sure" is not a need of a place."""

    speech = "speech"
    movement = "movement"  # movement and hands
    learning = "learning"  # learning and attention
    checkup = "checkup"  # a medical check-up


class Place(IdTimeMixin, Base):
    __tablename__ = "places"
    __table_args__ = (
        CheckConstraint("age_min <= age_max", name="ages"),
        CheckConstraint("price_min is null or price_max is null or price_min <= price_max", name="prices"),
    )

    name: Mapped[str] = mapped_column(String(120))
    kind: Mapped[PlaceKind] = mapped_column(enum_column(PlaceKind))
    # Ids from apps/web/src/content/districts.ts, checked like the parent's district.
    region: Mapped[str] = mapped_column(String(32))
    district: Mapped[str] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(String(200))
    map_url: Mapped[str | None] = mapped_column(String(500))
    lat: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))  # for "by distance" (A10.2)
    lng: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    phone: Mapped[str | None] = mapped_column(String(16))
    telegram: Mapped[str | None] = mapped_column(String(64))
    languages: Mapped[list[str]] = mapped_column(ARRAY(String(8)))
    needs: Mapped[list[str]] = mapped_column(ARRAY(String(16)))
    age_min: Mapped[int]  # ages served, in years
    age_max: Mapped[int]
    works_with_cp: Mapped[bool]
    # Approximate price of one session in so'm; empty for a free state centre or when unknown.
    price_min: Mapped[int | None]
    price_max: Mapped[int | None]
    checked_at: Mapped[date] = mapped_column(Date)  # when our team last checked it by phone
    active: Mapped[bool] = mapped_column(default=True)  # an admin hides a closed place instead of deleting it
    # A parent reported wrong information; cleared when our team checks the place again (a new checked_at).
    flagged_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The clinic account that publishes this place's free times (A10.3); an admin links it.
    clinic_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)


class ReportReason(StrEnum):
    wrong_price = "wrong_price"
    closed = "closed"
    other = "other"


class PlaceReport(IdTimeMixin, Base):
    """A parent says a listing is wrong. The place is flagged for our team (spec §11: within 24 hours)."""

    __tablename__ = "place_reports"
    __table_args__ = (UniqueConstraint("place_id", "user_id"),)  # one report per person and place

    place_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reason: Mapped[ReportReason] = mapped_column(enum_column(ReportReason))
    note: Mapped[str | None] = mapped_column(String(500))


class Slot(IdTimeMixin, Base):
    """A free time a clinic publishes (spec §11): booked in person, online, or either."""

    __tablename__ = "slots"
    __table_args__ = (
        CheckConstraint("minutes between 10 and 240", name="minutes"),
        CheckConstraint("in_person or online", name="mode"),
    )

    place_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("places.id", ondelete="CASCADE"), index=True)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    minutes: Mapped[int]
    specialist: Mapped[str | None] = mapped_column(String(80))  # who sees the child, when the clinic says
    in_person: Mapped[bool]
    online: Mapped[bool]


class BookingMode(StrEnum):
    in_person = "in_person"
    online = "online"


class BookingStatus(StrEnum):
    booked = "booked"  # waiting for the clinic
    confirmed = "confirmed"
    cancelled = "cancelled"


class Booking(IdTimeMixin, Base):
    """A family books one free time (spec §11). The family pays the clinic directly; no money passes here."""

    __tablename__ = "bookings"
    __table_args__ = (
        # The database itself refuses a second booking of the same time, even from two requests at once.
        Index("uq_bookings_one_per_slot", "slot_id", unique=True, postgresql_where=text("status <> 'cancelled'")),
    )

    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("slots.id", ondelete="CASCADE"))
    child_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    booked_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    mode: Mapped[BookingMode] = mapped_column(enum_column(BookingMode))
    status: Mapped[BookingStatus] = mapped_column(enum_column(BookingStatus), default=BookingStatus.booked)
    online_link: Mapped[str | None] = mapped_column(String(500))  # the clinic adds it for an online session
    cancelled_by: Mapped[str | None] = mapped_column(String(8))  # "family" or "clinic"
    # Reminders sent (A10.5): 1 day and 2 hours before. Each one goes once.
    reminded_day_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reminded_soon_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
