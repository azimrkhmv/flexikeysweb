"""The tries table is split by month (one PostgreSQL partition per month, named tries_yYYYYmMM). A month must exist
before tries from it arrive; a whole month is removed in one step once it is older than 90 days (A6.2)."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from app.modules.play.models import Try

PREFIX = "tries_y"
KEEP_DAYS = 90  # TASKS.md section 3: tries are deleted after 90 days
TASHKENT = ZoneInfo("Asia/Tashkent")


def month_table(month: date) -> str:
    return f"{PREFIX}{month.year}m{month.month:02d}"


def next_month(month: date) -> date:
    return date(month.year + month.month // 12, month.month % 12 + 1, 1)


async def add_month(db: AsyncSession | AsyncConnection, month: date) -> None:
    """Make the partition for the month of `month` (nothing happens if it exists)."""
    start = month.replace(day=1)
    await db.execute(
        text(
            f"create table if not exists {month_table(start)} partition of tries "
            f"for values from ('{start}') to ('{next_month(start)}')"
        )
    )


async def drop_month(db: AsyncSession | AsyncConnection, month: date) -> None:
    """Remove every try of that month at once."""
    await db.execute(text(f"drop table if exists {month_table(month)}"))


async def months(db: AsyncSession) -> list[date]:
    """The months that have a part, oldest first."""
    names = await db.scalars(
        text(
            "select c.relname from pg_inherits i join pg_class c on c.oid = i.inhrelid "
            "join pg_class p on p.oid = i.inhparent where p.relname = 'tries'"
        )
    )
    return sorted(date(int(n[len(PREFIX) : -3]), int(n[-2:]), 1) for n in names)


async def clean(db: AsyncSession, today: date) -> list[date]:
    """The nightly clean-up: drop every month whose tries are all older than 90 days, delete the older tries of the
    month on the edge, and make sure this month and the next two exist. Returns the months dropped."""
    cutoff = today - timedelta(days=KEEP_DAYS)
    dropped = [m for m in await months(db) if next_month(m) <= cutoff]
    for m in dropped:
        await drop_month(db, m)
    await db.execute(delete(Try).where(Try.ts < datetime.combine(cutoff, time(), TASHKENT)))
    month = today.replace(day=1)
    for _ in range(3):
        await add_month(db, month)
        month = next_month(month)
    await db.commit()
    return dropped
