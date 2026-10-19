import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, false
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin


class RefreshToken(IdTimeMixin, Base):
    """A long sign-in token. Only its hash is stored. Each use replaces it with a new one in the same chain;
    using an old one again means it was stolen, so every token of that user is revoked (signed out everywhere)."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    chain_id: Mapped[uuid.UUID] = mapped_column(index=True)  # one chain per signed-in device
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The chain began with the admin's second step (A13.1): its access tokens carry mfa.
    mfa: Mapped[bool] = mapped_column(default=False, server_default=false())
