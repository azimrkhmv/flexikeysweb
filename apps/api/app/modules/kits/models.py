"""Home Kit (spec §9, A11.1): one standard box for every family now, customised boxes later. Its own price, apart
from Pro. Delivery to all of Uzbekistan by courier, or pickup at a partner centre. Kept as long as accounting needs
(spec §19), so an order stays when the child or the family is deleted, without them."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin, TimeMixin
from app.modules.accounts.models import enum_column


class KitProduct(TimeMixin, Base):
    """A box that can be ordered, loaded from app/content/kits.json (`load-kits`)."""

    __tablename__ = "kit_products"

    slug: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[dict[str, str]] = mapped_column(JSONB)  # uz, ru, en
    items: Mapped[list[str]] = mapped_column(JSONB)  # the tools in the box
    price_som: Mapped[int]
    active: Mapped[bool] = mapped_column(default=True)  # a box that left the file can't be ordered; old orders keep it


class Delivery(StrEnum):
    courier = "courier"  # to the family's address
    pickup = "pickup"  # at a partner centre (a place of Find help)


class KitStatus(StrEnum):
    placed = "placed"
    confirmed = "confirmed"
    shipped = "shipped"
    delivered = "delivered"
    cancelled = "cancelled"


class KitOrder(IdTimeMixin, Base):
    __tablename__ = "kit_orders"

    family_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("families.id", ondelete="SET NULL"), index=True)
    child_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("children.id", ondelete="SET NULL"))
    product_slug: Mapped[str] = mapped_column(ForeignKey("kit_products.slug"))
    items: Mapped[list[str]] = mapped_column(JSONB)  # what was in the box when ordered
    price_som: Mapped[int]  # the price when ordered
    delivery: Mapped[Delivery] = mapped_column(enum_column(Delivery))
    region: Mapped[str] = mapped_column(String(32))
    district: Mapped[str] = mapped_column(String(64))
    address: Mapped[str | None] = mapped_column(String(300))  # courier only
    pickup_place_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("places.id", ondelete="SET NULL"))
    phone: Mapped[str] = mapped_column(String(16))  # for the courier or the centre
    # P17a, asked when ordering (A11.2): {"answer": "yes"|"no", "which": str|None}, encrypted like health answers.
    allergy_secret: Mapped[str] = mapped_column(Text)
    allergy_checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # our team, before shipping
    status: Mapped[KitStatus] = mapped_column(enum_column(KitStatus), default=KitStatus.placed)
    status_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ordered_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
