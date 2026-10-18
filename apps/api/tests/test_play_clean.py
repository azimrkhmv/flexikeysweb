"""A6.2: the nightly job deletes tries older than 90 days; whole old months are dropped at once."""

from datetime import UTC, date, datetime

import pytest
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.play.models import Try
from app.modules.play.tries import add_month, clean, drop_month, month_table, months, next_month
from tests.test_play_tables import a_child, a_try

pytestmark = pytest.mark.anyio


async def test_old_months_are_gone_after_the_job(session: AsyncSession) -> None:
    today = date(2027, 3, 15)
    old = date(2026, 11, 1)  # every try in it is more than 90 days old on 15 March
    edge = date(2026, 12, 1)  # 90 days before 15 March is 15 December
    for m in (old, edge):
        await add_month(session, m)
    child = await a_child(session)
    rows = {
        "old": a_try(child, datetime(2026, 11, 20, tzinfo=UTC)),
        "edge_old": a_try(child, datetime(2026, 12, 10, tzinfo=UTC)),
        "edge_kept": a_try(child, datetime(2026, 12, 20, tzinfo=UTC)),
    }
    await session.execute(insert(Try), list(rows.values()))
    await session.commit()

    dropped = await clean(session, today)
    assert old in dropped and edge not in dropped
    left = set(await session.scalars(select(Try.id).where(Try.child_id == child)))
    assert left == {rows["edge_kept"]["id"]}  # nothing older than 90 days, nothing newer lost
    have = await months(session)
    assert old not in have and edge in have
    assert {date(2027, 3, 1), date(2027, 4, 1), date(2027, 5, 1)} <= set(have)  # this month and the next two
    assert month_table(next_month(old)) == "tries_y2026m12"

    # Put the test database back: the months the migration made, nothing else.
    for m in have:
        await drop_month(session, m)
    month = datetime.now(UTC).date().replace(day=1)
    for _ in range(3):
        await add_month(session, month)
        month = next_month(month)
    await session.commit()
