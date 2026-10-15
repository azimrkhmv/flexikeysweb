"""The audit log: who changed what, and when. Rows are only ever added, never changed or deleted by the app."""

import uuid
from typing import Any

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin
from app.errors import request_id


class AuditEntry(IdTimeMixin, Base):
    __tablename__ = "audit_log"

    # Who did it; empty for the server itself (for example the create-admin command).
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    action: Mapped[str] = mapped_column(String(64))  # for example "user.role_changed"
    target_id: Mapped[uuid.UUID | None] = mapped_column(index=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    request_id: Mapped[str | None] = mapped_column(String(64))  # find the matching log lines


def record(db: AsyncSession, actor_id: uuid.UUID | None, action: str, target_id: uuid.UUID | None, **data: Any) -> None:
    """Add an entry in the same transaction as the change, so there is never a change without its entry."""
    rid = request_id.get()
    db.add(
        AuditEntry(
            actor_id=actor_id, action=action, target_id=target_id, data=data, request_id=None if rid == "-" else rid
        )
    )
