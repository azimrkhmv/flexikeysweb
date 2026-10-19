"""Find help (spec §11): verified places, each checked by phone by our team. About 40 at launch, Tashkent first."""

from datetime import date
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import CheckConstraint, Date, Numeric, String
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
