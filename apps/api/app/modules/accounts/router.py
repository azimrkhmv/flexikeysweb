"""Your own account: who you are, the sign-up step, and changing your details."""

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import AppError
from app.modules.accounts import consent
from app.modules.accounts.models import Lang, User
from app.modules.auth.router import UserOut
from app.modules.auth.session import CurrentUser, SignedInUser
from app.schemas import ApiModel

router = APIRouter(tags=["me"])

# Region ids and their districts, copied from the website (apps/web/src/content/backend/districts.json).
_REGIONS: dict[str, set[str]] = {
    r["id"]: set(r["districts"])
    for r in json.loads((Path(__file__).parents[2] / "content" / "districts.json").read_text("utf-8"))
}


def _check_place(region: str | None, district: str | None) -> None:
    if region is None and district is None:
        return
    if region not in _REGIONS or district not in _REGIONS[region]:
        raise AppError(422, "invalid_district")


class Me(UserOut):
    name: str | None
    consent_version: str | None
    needs_signup: bool  # true until the basic consent is given: the website shows the sign-up step


def _me(user: User) -> Me:
    out = UserOut.model_validate(user, from_attributes=True).model_dump()
    return Me(**out, name=user.name, consent_version=user.consent_version, needs_signup=user.consent_version is None)


class ConsentText(ApiModel):
    version: str
    text: str
    detail: str


@router.get("/consents/basic")
async def basic_consent(lang: Lang = Lang.uz) -> ConsentText:
    """The basic consent text to show at sign-up."""
    text, detail = consent.TEXTS[lang]
    return ConsentText(version=consent.VERSION, text=text, detail=detail)


@router.get("/me")
async def get_me(user: SignedInUser) -> Me:
    return _me(user)


class Signup(ApiModel):
    name: str = Field(default="", max_length=80)
    region: str
    district: str
    consent: bool


@router.patch("/me/signup")
async def signup(body: Signup, user: SignedInUser, db: Annotated[AsyncSession, Depends(get_session)]) -> Me:
    """The sign-up step: basic consent, city and district (spec §4). Required before anything else."""
    if not body.consent:
        raise AppError(422, "consent_required")
    _check_place(body.region, body.district)
    user.name = body.name.strip() or user.name
    user.region, user.district = body.region, body.district
    user.consent_version, user.consent_at = consent.VERSION, datetime.now(UTC)
    await db.commit()
    return _me(user)


class MeChange(ApiModel):
    name: str | None = Field(default=None, max_length=80)
    lang: Lang | None = None
    region: str | None = None
    district: str | None = None


@router.patch("/me")
async def change_me(body: MeChange, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> Me:
    """Change your name, language, city or district. Only the fields sent are changed."""
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if "region" in changes or "district" in changes:
        _check_place(changes.get("region", user.region), changes.get("district", user.district))
    for field, value in changes.items():
        setattr(user, field, value)
    await db.commit()
    return _me(user)
