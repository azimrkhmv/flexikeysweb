"""Places for Find help. A10.1: an admin adds and edits them; every change goes into the audit log.
A10.2: parents search them (free state centres first, then by distance) and report wrong information."""

import math
import uuid
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.router import _check_place
from app.modules.audit import models as audit
from app.modules.auth.router import normalize_phone
from app.modules.auth.session import CurrentUser
from app.modules.places.models import Need, Place, PlaceKind, PlaceReport, ReportReason
from app.schemas import ApiModel

admin_router = APIRouter(prefix="/admin/places", tags=["places"])
router = APIRouter(prefix="/places", tags=["places"])
PRICE_FRESH = timedelta(days=183)  # spec §11: a price older than 6 months shows "price not recently checked"

PlaceLang = Literal["uz", "ru", "en", "kaa"]  # kaa: Karakalpak


class PlaceIn(ApiModel):
    name: str = Field(min_length=1, max_length=120)
    kind: PlaceKind
    region: str
    district: str
    address: str | None = Field(default=None, max_length=200)
    map_url: str | None = Field(default=None, max_length=500, pattern=r"^https://")
    lat: Decimal | None = Field(default=None, ge=-90, le=90)
    lng: Decimal | None = Field(default=None, ge=-180, le=180)
    phone: str | None = None
    telegram: str | None = Field(default=None, max_length=64)
    languages: list[PlaceLang] = Field(min_length=1)
    needs: list[Need] = Field(min_length=1)
    age_min: int = Field(ge=0, le=30)
    age_max: int = Field(ge=0, le=30)
    works_with_cp: bool
    price_min: int | None = Field(default=None, ge=0)
    price_max: int | None = Field(default=None, ge=0)
    checked_at: date
    active: bool = True


class PlaceChange(ApiModel):
    """Only what is sent changes."""

    name: str | None = Field(default=None, min_length=1, max_length=120)
    kind: PlaceKind | None = None
    region: str | None = None
    district: str | None = None
    address: str | None = Field(default=None, max_length=200)
    map_url: str | None = Field(default=None, max_length=500, pattern=r"^https://")
    lat: Decimal | None = Field(default=None, ge=-90, le=90)
    lng: Decimal | None = Field(default=None, ge=-180, le=180)
    phone: str | None = None
    telegram: str | None = Field(default=None, max_length=64)
    languages: list[PlaceLang] | None = Field(default=None, min_length=1)
    needs: list[Need] | None = Field(default=None, min_length=1)
    age_min: int | None = Field(default=None, ge=0, le=30)
    age_max: int | None = Field(default=None, ge=0, le=30)
    works_with_cp: bool | None = None
    price_min: int | None = Field(default=None, ge=0)
    price_max: int | None = Field(default=None, ge=0)
    checked_at: date | None = None
    active: bool | None = None


REQUIRED = [name for name, f in PlaceIn.model_fields.items() if f.is_required() or f.default is True]


class PlaceOut(PlaceIn):
    id: uuid.UUID
    flagged_at: datetime | None  # a parent reported wrong information since the last check


def _out(p: Place) -> PlaceOut:
    return PlaceOut.model_validate(p, from_attributes=True)


def _check(p: Place) -> None:
    """The rules every saved place keeps: a real district, ages and prices in order, a mobile or landline number."""
    _check_place(p.region, p.district)
    if p.age_min > p.age_max:
        raise AppError(422, "invalid_ages")
    if p.price_min is not None and p.price_max is not None and p.price_min > p.price_max:
        raise AppError(422, "invalid_prices")
    if p.phone is not None:
        phone = normalize_phone(p.phone)
        if not phone:
            raise AppError(422, "invalid_phone")
        p.phone = phone


@admin_router.get("")
async def list_places(_: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> list[PlaceOut]:
    """Every place, hidden ones too: flagged ones first, then by region, district and name."""
    rows = await db.scalars(
        select(Place).order_by(Place.flagged_at.is_(None), Place.region, Place.district, Place.name)
    )
    return [_out(p) for p in rows]


@admin_router.post("", status_code=201)
async def add_place(body: PlaceIn, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> PlaceOut:
    place = Place(**body.model_dump())
    _check(place)
    db.add(place)
    await db.flush()
    audit.record(db, admin.id, "place.created", place.id, name=place.name)
    await db.commit()
    return _out(place)


@admin_router.patch("/{place_id}")
async def change_place(
    place_id: uuid.UUID, body: PlaceChange, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]
) -> PlaceOut:
    place = await db.get(Place, place_id)
    if place is None:
        raise AppError(404, "not_found")
    changes = body.model_dump(exclude_unset=True)
    if emptied := [f for f in REQUIRED if f in changes and changes[f] is None]:
        raise AppError(422, "invalid_place", fields=emptied)  # these can change, never be emptied
    for field, value in changes.items():
        setattr(place, field, value)
    if "checked_at" in changes:
        place.flagged_at = None  # our team checked it again
    _check(place)
    audit.record(db, admin.id, "place.changed", place.id, fields=sorted(changes))
    await db.commit()
    return _out(place)


# ---------------------------------------------------------------- parents


class PlaceView(ApiModel):
    id: uuid.UUID
    name: str
    kind: PlaceKind
    region: str
    district: str
    address: str | None
    map_url: str | None
    phone: str | None
    telegram: str | None
    languages: list[str]
    needs: list[str]
    age_min: int
    age_max: int
    works_with_cp: bool
    price_min: int | None
    price_max: int | None
    checked_at: date
    price_not_recently_checked: bool  # checked more than 6 months ago
    distance_km: float | None  # when the parent's position and the place's are known


def _km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distance on the Earth's surface (haversine)."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lng2 - lng1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(a))


@router.get("")
async def search(
    user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_session)],
    need: Need | None = None,
    lat: float | None = None,
    lng: float | None = None,
    region: str | None = None,
    district: str | None = None,
) -> list[PlaceView]:
    """Places that help with this need (all places without one): free state centres first, then by distance from
    the parent's position, or without it the parent's district, then region, first. Hidden places never show."""
    stmt = select(Place).where(Place.active)
    if need is not None:
        stmt = stmt.where(Place.needs.contains([need.value]))
    today = datetime.now(UTC).date()
    region, district = region or user.region, district or user.district
    views = []
    for p in await db.scalars(stmt):
        km = _km(lat, lng, float(p.lat), float(p.lng)) if None not in (lat, lng, p.lat, p.lng) else None  # type: ignore[arg-type]
        views.append(
            PlaceView.model_validate(
                {**p.__dict__, "price_not_recently_checked": today - p.checked_at > PRICE_FRESH, "distance_km": km}
            )
        )
    # ponytail: sorted in Python over every active place (about 40 at launch); a SQL distance order when thousands.
    views.sort(
        key=lambda v: (
            v.kind != PlaceKind.state_centre,
            v.distance_km if v.distance_km is not None else math.inf,
            v.district != district,
            v.region != region,
            v.name,
        )
    )
    return views


class ReportIn(ApiModel):
    reason: ReportReason
    note: str | None = Field(default=None, max_length=500)


@router.post("/{place_id}/reports", status_code=204)
async def report(
    place_id: uuid.UUID, body: ReportIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> None:
    """A wrong price or a closed place: the place is flagged for our team. A second report by the same person
    changes nothing."""
    place = await db.get(Place, place_id)
    if place is None or not place.active:
        raise AppError(404, "not_found")
    if await db.scalar(select(PlaceReport.id).where(PlaceReport.place_id == place_id, PlaceReport.user_id == user.id)):
        return
    db.add(PlaceReport(place_id=place_id, user_id=user.id, reason=body.reason, note=body.note))
    place.flagged_at = place.flagged_at or datetime.now(UTC)
    audit.record(db, user.id, "place.reported", place_id, reason=body.reason.value)
    await db.commit()
