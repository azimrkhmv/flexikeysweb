"""The tries table is split by month (one PostgreSQL partition per month, named tries_yYYYYmMM). A month must exist
before tries from it arrive; a whole month is removed in one step once it is older than 90 days (A6.2)."""

from datetime import date

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

PREFIX = "tries_y"


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
