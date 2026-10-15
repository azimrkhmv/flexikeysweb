import uuid
from datetime import date
from enum import StrEnum

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.modules.accounts.models import Lang, enum_column


class Sex(StrEnum):
    boy = "boy"
    girl = "girl"


class Child(IdTimeMixin, Base):
    """A child belongs to one family. The basics are intake questions P1-P3 and P8 (apps/web/src/content/intake.ts)."""

    __tablename__ = "children"

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(40))
    birth_date: Mapped[date] = mapped_column(Date)
    sex: Mapped[Sex] = mapped_column(enum_column(Sex))
    color: Mapped[str | None] = mapped_column(String(16))  # P8: sky, leaf, sun, lavender, peach
    lang: Mapped[Lang] = mapped_column(enum_column(Lang), default=Lang.uz)  # the language the child plays in
