"""A6.1: the play tables. Tries are split by month, so one month of tries is dropped in a single step."""

import uuid
from datetime import UTC, date, datetime

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts.models import Family, Lang
from app.modules.children.models import Child, Sex
from app.modules.play.models import AccessProfile, InputMode, Try
from app.modules.play.tries import add_month, drop_month, next_month

pytestmark = pytest.mark.anyio


async def a_child(db: AsyncSession) -> uuid.UUID:
    family = Family()
    db.add(family)
    await db.flush()
    child = Child(family_id=family.id, name="Ali", birth_date=date(2019, 5, 1), sex=Sex.boy, lang=Lang.uz)
    db.add(child)
    await db.flush()
    return child.id


def a_try(child: uuid.UUID, ts: datetime) -> dict[str, object]:
    return {
        "id": uuid.uuid4(), "ts": ts, "child_id": child, "game": "whats_missing", "level": 1, "item_id": "tray_1",
        "input_mode": InputMode.dwell, "outcome": "correct", "attempts": 2, "hint_shown": "none",
        "access_event": False, "helped_by_adult": False, "response_ms": 8400,
    }  # fmt: skip


async def test_one_month_of_tries_is_dropped_in_one_step(session: AsyncSession) -> None:
    child = await a_child(session)
    this = datetime.now(UTC).date().replace(day=1)
    later = next_month(this)
    for month in (this, later):
        await add_month(session, month)
        await add_month(session, month)  # already there: nothing happens
    rows = [a_try(child, datetime(m.year, m.month, d, tzinfo=UTC)) for m in (this, later) for d in (1, 2)]
    await session.execute(insert(Try), rows)
    count = select(func.count()).select_from(Try).where(Try.child_id == child)
    assert await session.scalar(count) == 4

    await drop_month(session, this)  # one step
    assert await session.scalar(count) == 2
    first = await session.scalar(select(func.min(Try.ts)).where(Try.child_id == child))
    assert first is not None and first >= datetime(later.year, later.month, 1, tzinfo=UTC)
    await session.rollback()  # keep this month's part for the other tests


async def test_the_same_try_is_stored_once(session: AsyncSession) -> None:
    child = await a_child(session)
    row = a_try(child, datetime.now(UTC))
    await session.execute(insert(Try), [row])
    with pytest.raises(IntegrityError):
        await session.execute(insert(Try), [row])
    await session.rollback()


@pytest.mark.parametrize(("field", "value"), [("min_target_mm", 11), ("dwell_ms", 499), ("dwell_ms", 3001)])
async def test_access_settings_stay_in_the_spec_ranges(session: AsyncSession, field: str, value: int) -> None:
    child = await a_child(session)
    good = {"min_target_mm": 12, "dwell_ms": 1000}
    session.add(
        AccessProfile(
            child_id=child, input_mode=InputMode.touch, repeat_lock=True, release_ok=True, **{**good, field: value}
        )
    )
    with pytest.raises(IntegrityError):
        await session.flush()
    await session.rollback()
