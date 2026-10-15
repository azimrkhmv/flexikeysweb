import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase

from app.db import IdTimeMixin

pytestmark = pytest.mark.anyio


async def test_test_database_is_at_the_newest_change(session: AsyncSession) -> None:
    assert (await session.execute(text("select current_database()"))).scalar() == "flexikeys_test"
    head = ScriptDirectory.from_config(Config("alembic.ini")).get_current_head()
    assert (await session.execute(text("select version_num from alembic_version"))).scalar() == head


def test_every_change_rolls_back_and_applies_again() -> None:
    config = Config("alembic.ini")
    command.downgrade(config, "base")
    command.upgrade(config, "head")


def test_shared_columns() -> None:
    class Scratch(DeclarativeBase):  # kept apart from the real tables
        pass

    class Thing(IdTimeMixin, Scratch):
        __tablename__ = "thing"

    columns = Thing.__table__.columns
    assert {"id", "created_at", "updated_at"} <= set(columns.keys())
    assert columns["id"].primary_key
    assert columns["created_at"].server_default is not None
