"""People and families. A child (A2.1) belongs to a family; the family has one owner and at most one helper."""

import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin


class Role(StrEnum):
    parent = "parent"
    therapist = "therapist"
    physio = "physio"
    clinic = "clinic"
    admin = "admin"


class UserStatus(StrEnum):
    active = "active"
    disabled = "disabled"


class Lang(StrEnum):
    """The website's interface languages (apps/web/src/lib/translate.ts UiLang)."""

    uz = "uz"
    uz_cyrl = "uz_cyrl"
    ru = "ru"
    en = "en"


class MemberRole(StrEnum):
    owner = "owner"
    helper = "helper"


def _enum(e: type[StrEnum]) -> Enum:
    # Stored as text with a check, not a PostgreSQL enum type: adding a value later is a one-line change.
    return Enum(e, native_enum=False, create_constraint=True, length=16, values_callable=lambda x: [m.value for m in x])


class User(IdTimeMixin, Base):
    __tablename__ = "users"

    phone: Mapped[str] = mapped_column(String(16), unique=True)  # E.164, for example +998901234567
    role: Mapped[Role] = mapped_column(_enum(Role))
    status: Mapped[UserStatus] = mapped_column(_enum(UserStatus), default=UserStatus.active)
    lang: Mapped[Lang] = mapped_column(_enum(Lang), default=Lang.uz)
    # Ids from apps/web/src/content/districts.ts; empty until the sign-up step (A1.6).
    region: Mapped[str | None] = mapped_column(String(32))
    district: Mapped[str | None] = mapped_column(String(64))
    name: Mapped[str | None] = mapped_column(String(80))
    # Basic consent (A1.6): which text version the person agreed to, and when. Empty = not given yet.
    consent_version: Mapped[str | None] = mapped_column(String(32))
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # "Sign out everywhere": access tokens issued before this moment are refused (app/modules/auth/session.py).
    signed_out_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Family(IdTimeMixin, Base):
    __tablename__ = "families"


class FamilyMember(IdTimeMixin, Base):
    __tablename__ = "family_members"
    __table_args__ = (
        UniqueConstraint("family_id", "user_id"),
        # One owner per family, and a person owns at most one family. The helper limit is a setting, checked in code.
        Index("uq_family_members_one_owner", "family_id", unique=True, postgresql_where=text("role = 'owner'")),
        Index("uq_family_members_owns_one", "user_id", unique=True, postgresql_where=text("role = 'owner'")),
    )

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    role: Mapped[MemberRole] = mapped_column(_enum(MemberRole))
