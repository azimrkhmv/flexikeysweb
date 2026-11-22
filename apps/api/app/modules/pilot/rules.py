"""The pilot's rules (B113, Update 4 spec 4.3), counted from the saved exercise and game records, never from what
parents say. The website's demo uses the same rules (apps/web/src/lib/pilot.ts); both are tested with fixed dates.

- Active day: a Tashkent day with at least one finished exercise or game of the family (a task marked done, or a
  game try).
- Retained family (spec 2.3): at least 3 active days a week, in at least 3 of every 4 weeks. Counted over the last 4
  full weeks (Monday to Sunday) before the current week, so a family needs 4 weeks of use before it can count.
- Quiet family: finished sign-up, and no active day in the last 3 days (today and the two days before).
"""

from collections.abc import Iterable
from datetime import date, timedelta

WEEKS = 4  # the window
GOOD_WEEKS = 3  # weeks in the window with enough days
DAYS_A_WEEK = 3  # active days that make a week count
QUIET_DAYS = 3


def full_weeks(today: date, n: int = WEEKS) -> list[date]:
    """The Mondays of the last n full weeks before the week of `today`, newest first."""
    this_monday = today - timedelta(days=today.weekday())
    return [this_monday - timedelta(weeks=i + 1) for i in range(n)]


def is_retained(active: Iterable[date], today: date) -> bool:
    days = set(active)
    good = sum(1 for monday in full_weeks(today) if sum(monday + timedelta(i) in days for i in range(7)) >= DAYS_A_WEEK)
    return good >= GOOD_WEEKS


def is_quiet(active: Iterable[date], today: date) -> bool:
    days = set(active)
    return not any(today - timedelta(days=i) in days for i in range(QUIET_DAYS))


def last_active(active: Iterable[date], today: date) -> date | None:
    return max((d for d in active if d <= today), default=None)
