"""Centre links (B113): a partner centre's own sign-up link, https://flexikeys.org/?ref=<code>. A parent who opened it
keeps the code on their account (users.ref_code), so the pilot numbers show the reach through each centre."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin


class CenterLink(IdTimeMixin, Base):
    __tablename__ = "center_links"

    name: Mapped[str] = mapped_column(String(80))
    code: Mapped[str] = mapped_column(String(32), unique=True)  # lowercase letters, digits and "-", e.g. "dvijeniye"
