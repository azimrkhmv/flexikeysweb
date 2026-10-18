"""Free and Pro (spec §14), one plan per family. Payments are simulated until after the pilot (TASKS.md section 3)."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, TimeMixin


class FamilyPlan(TimeMixin, Base):
    """A family without a row is on Free and has not tried Pro yet."""

    __tablename__ = "family_plans"

    family_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), primary_key=True)
    # The 7-day trial of Pro, once per family, started when the parent chooses it (spec §3, step 20).
    trial_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Pro until this moment: a payment (A7.3) or an admin's upgrade.
    paid_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
