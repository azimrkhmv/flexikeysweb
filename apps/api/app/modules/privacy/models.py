"""Files to remove from storage after a child or an account is deleted (A12.2). The database rows go at once; the
files go with the next nightly run of the worker (app/worker.py purge_files)."""

from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base, IdTimeMixin


class StorageCleanup(IdTimeMixin, Base):
    __tablename__ = "storage_cleanup"

    prefix: Mapped[str] = mapped_column(String(128))  # e.g. "children/<id>/": every file under it
