"""Home Kit orders (A11.1, spec §9): the family's owner orders the standard box for a child, by courier to an address
or for pickup at a partner centre; an admin moves the order on until it is delivered. No money passes here yet
(payments are simulated until after the pilot); the order keeps the price and the items of the day."""

import json
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import Field
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.crypto import decrypt_json, encrypt_json
from app.db import get_session
from app.errors import AppError
from app.modules.accounts.access import Admin
from app.modules.accounts.models import MemberRole
from app.modules.accounts.router import _check_place
from app.modules.audit import models as audit
from app.modules.auth.router import normalize_phone
from app.modules.auth.session import CurrentUser
from app.modules.billing.router import family_of
from app.modules.children.router import get_visible_child
from app.modules.kits.models import Delivery, KitOrder, KitProduct, KitStatus
from app.modules.places.models import Place
from app.schemas import ApiModel

router = APIRouter(tags=["home kit"])
admin_router = APIRouter(prefix="/admin/kit-orders", tags=["home kit"])
KITS = Path(__file__).parents[2] / "content" / "kits.json"
# What an admin may move an order to next; a cancelled or delivered order stays as it is.
NEXT = {
    KitStatus.placed: {KitStatus.confirmed, KitStatus.cancelled},
    KitStatus.confirmed: {KitStatus.shipped, KitStatus.cancelled},
    KitStatus.shipped: {KitStatus.delivered},
}


async def load_kits(db: AsyncSession) -> int:
    """Add or update every box of kits.json; one that left the file stays, inactive (old orders name it)."""
    rows = [
        {"slug": k["slug"], "name": k["name"], "items": k["items"], "price_som": k["priceSom"], "active": True}
        for k in json.loads(KITS.read_text())["kits"]
    ]
    stmt = insert(KitProduct).values(rows)
    changed = {c: stmt.excluded[c] for c in ("name", "items", "price_som", "active")}
    await db.execute(stmt.on_conflict_do_update(index_elements=["slug"], set_=changed | {"updated_at": func.now()}))
    await db.execute(update(KitProduct).where(KitProduct.slug.not_in([r["slug"] for r in rows])).values(active=False))
    await db.commit()
    return len(rows)


class KitOut(ApiModel):
    slug: str
    name: dict[str, str]
    items: list[str]
    price_som: int


class KitOrderIn(ApiModel):
    product_slug: str
    child_id: uuid.UUID
    delivery: Delivery
    region: str
    district: str
    address: str | None = Field(default=None, max_length=300)  # needed for a courier
    pickup_place_id: uuid.UUID | None = None  # needed for a pickup
    phone: str
    # P17a "Allergies to materials (latex, rubber, dyes)?" Required to order (A11.2); "yes" names them.
    allergy: Literal["yes", "no"] | None = None
    allergy_which: str | None = Field(default=None, max_length=200)


class KitOrderOut(ApiModel):
    id: uuid.UUID
    product_slug: str
    child_id: uuid.UUID | None
    items: list[str]
    price_som: int
    delivery: Delivery
    region: str
    district: str
    address: str | None
    pickup_place_id: uuid.UUID | None
    phone: str
    allergy: Literal["yes", "no"]
    allergy_which: str | None
    allergy_checked: bool
    status: KitStatus
    status_at: datetime
    created_at: datetime


def _out(o: KitOrder) -> KitOrderOut:
    allergy = decrypt_json(o.allergy_secret)
    return KitOrderOut.model_validate(
        {**o.__dict__, "allergy": allergy["answer"], "allergy_which": allergy["which"],
         "allergy_checked": o.allergy_checked_at is not None}
    )  # fmt: skip


@router.get("/kits")
async def kits(_: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> list[KitOut]:
    rows = await db.scalars(select(KitProduct).where(KitProduct.active).order_by(KitProduct.slug))
    return [KitOut.model_validate(k, from_attributes=True) for k in rows]


async def _owner_family(db: AsyncSession, user: CurrentUser) -> uuid.UUID:
    family_id, role = await family_of(db, user)
    if role != MemberRole.owner:
        raise AppError(403, "owner_only")
    return family_id


@router.post("/family/kit-orders", status_code=201)
async def order(body: KitOrderIn, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> KitOrderOut:
    """Owner only. 422 allergy_needed (P17a unanswered, or "yes" without which materials), unknown_kit,
    address_needed, unknown_place, invalid_phone, invalid_district."""
    family_id = await _owner_family(db, user)
    child = await get_visible_child(db, user, body.child_id)
    if child.family_id != family_id:
        raise AppError(404, "not_found")
    which = (body.allergy_which or "").strip() or None
    if body.allergy is None or (body.allergy == "yes" and which is None):
        raise AppError(422, "allergy_needed")  # spec: material allergies are checked before the kit is sent
    kit = await db.get(KitProduct, body.product_slug)
    if kit is None or not kit.active:
        raise AppError(422, "unknown_kit")
    _check_place(body.region, body.district)
    if body.delivery == Delivery.courier and not (body.address or "").strip():
        raise AppError(422, "address_needed")
    if body.delivery == Delivery.pickup:
        place = await db.get(Place, body.pickup_place_id) if body.pickup_place_id else None
        if place is None or not place.active:
            raise AppError(422, "unknown_place")
    phone = normalize_phone(body.phone)
    if not phone:
        raise AppError(422, "invalid_phone")
    o = KitOrder(
        family_id=family_id,
        child_id=child.id,
        product_slug=kit.slug,
        items=kit.items,
        price_som=kit.price_som,
        delivery=body.delivery,
        region=body.region,
        district=body.district,
        address=body.address.strip() if body.delivery == Delivery.courier and body.address else None,
        pickup_place_id=body.pickup_place_id if body.delivery == Delivery.pickup else None,
        phone=phone,
        allergy_secret=encrypt_json({"answer": body.allergy, "which": which if body.allergy == "yes" else None}),
        status_at=datetime.now(UTC),
        ordered_by=user.id,
    )
    db.add(o)
    await db.flush()
    audit.record(db, user.id, "kit.ordered", child.id, order=str(o.id), kit=kit.slug)
    await db.commit()
    return _out(o)


@router.get("/family/kit-orders")
async def family_orders(user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]) -> list[KitOrderOut]:
    """The family's orders, newest first; every member sees them."""
    family_id, _ = await family_of(db, user)
    rows = await db.scalars(
        select(KitOrder).where(KitOrder.family_id == family_id).order_by(KitOrder.created_at.desc())
    )
    return [_out(o) for o in rows]


@router.post("/family/kit-orders/{order_id}/cancel")
async def cancel(
    order_id: uuid.UUID, user: CurrentUser, db: Annotated[AsyncSession, Depends(get_session)]
) -> KitOrderOut:
    """Owner only, while the order is still placed (409 too_late after our team confirmed it)."""
    family_id = await _owner_family(db, user)
    o = await db.get(KitOrder, order_id)
    if o is None or o.family_id != family_id:
        raise AppError(404, "not_found")
    if o.status != KitStatus.placed:
        raise AppError(409, "too_late")
    o.status, o.status_at = KitStatus.cancelled, datetime.now(UTC)
    audit.record(db, user.id, "kit.cancelled", o.child_id, order=str(o.id), by="family")
    await db.commit()
    return _out(o)


# ---------------------------------------------------------------- our team


@admin_router.get("")
async def all_orders(_: Admin, db: Annotated[AsyncSession, Depends(get_session)]) -> list[KitOrderOut]:
    """Every order, the open ones first, newest first."""
    done = KitOrder.status.in_([KitStatus.delivered, KitStatus.cancelled])
    rows = await db.scalars(select(KitOrder).order_by(done, KitOrder.created_at.desc()))
    return [_out(o) for o in rows]


class StatusChange(ApiModel):
    status: KitStatus
    allergy_checked: bool = False  # confirming an order with material allergies: our team checked the box's materials


@admin_router.patch("/{order_id}")
async def move(
    order_id: uuid.UUID, body: StatusChange, admin: Admin, db: Annotated[AsyncSession, Depends(get_session)]
) -> KitOrderOut:
    """placed -> confirmed -> shipped -> delivered; cancelled before shipping. 409 invalid_status_change otherwise.
    An order with material allergies is confirmed only with allergyChecked (409 allergy_not_checked)."""
    o = await db.get(KitOrder, order_id)
    if o is None:
        raise AppError(404, "not_found")
    if body.status not in NEXT.get(o.status, set()):
        raise AppError(409, "invalid_status_change", now=o.status.value)
    if body.status == KitStatus.confirmed and decrypt_json(o.allergy_secret)["answer"] == "yes":
        if not body.allergy_checked:
            raise AppError(409, "allergy_not_checked")
        o.allergy_checked_at = datetime.now(UTC)
    o.status, o.status_at = body.status, datetime.now(UTC)
    audit.record(db, admin.id, f"kit.{body.status.value}", o.child_id, order=str(o.id))
    await db.commit()
    return _out(o)
