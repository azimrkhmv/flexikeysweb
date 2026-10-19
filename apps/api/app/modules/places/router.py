"""Places for Find help (A10.1): an admin adds and edits them; every change goes into the audit log.
Parents search them in A10.2."""

import uuid
from datetime import date
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
from app.modules.places.models import Need, Place, PlaceKind
from app.schemas import ApiModel

admin_router = APIRouter(prefix="/admin/places", tags=["places"])

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
    """Every place, hidden ones too, by region, district and name."""
    rows = await db.scalars(select(Place).order_by(Place.region, Place.district, Place.name))
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
    _check(place)
    audit.record(db, admin.id, "place.changed", place.id, fields=sorted(changes))
    await db.commit()
    return _out(place)
