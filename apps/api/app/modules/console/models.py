"""Feature flags (A13.8): an admin turns a known feature on or off for everyone. Only the flags named in FLAGS exist;
a row is stored once an admin changes one."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin, TimeMixin

# key: (on until an admin changes it, what it does)
FLAGS: dict[str, tuple[bool, str]] = {
    "ai_assistant": (True, "The parent's assistant chat"),
    "ai_weekly_reports": (False, "The weekly two-sentence summary written by AI"),
}


class FeatureFlag(TimeMixin, Base):
    __tablename__ = "feature_flags"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    enabled: Mapped[bool]


class Feedback(IdTimeMixin, Base):
    """What a tester or a parent tells the team from any page (the pilot's "Send feedback" box). Admins read it."""

    __tablename__ = "feedback"

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    page: Mapped[str] = mapped_column(String(200))  # the website path it was sent from
    text: Mapped[str] = mapped_column(String(2000))
