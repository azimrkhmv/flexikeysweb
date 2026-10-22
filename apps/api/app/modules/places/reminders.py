"""Visit reminders (A10.5, spec §11 PROPOSAL): 1 day and 2 hours before, to the parent who booked.
Run by the worker every 5 minutes (app/worker.py). Each reminder is handled once; a cancelled visit gets none.

G10: they will go through the mobile app's notifications, with the other reminders (Q5). Until then the job still
finds and marks each due reminder, but sends no SMS (BY_SMS)."""

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.accounts.models import Lang, User
from app.modules.auth.sms import SmsSender
from app.modules.places.models import Booking, BookingStatus, Place, Slot

TASHKENT = ZoneInfo("Asia/Tashkent")
DAY, SOON = timedelta(hours=24), timedelta(hours=2)
BY_SMS = False  # G10: no SMS; the mobile app sends these once it exists

TEXT = {
    Lang.uz: ("FlexiKeys: ertaga {time} — {place}", "FlexiKeys: bugun {time} — {place}"),
    Lang.ru: ("FlexiKeys: завтра в {time} — {place}", "FlexiKeys: сегодня в {time} — {place}"),
    Lang.en: ("FlexiKeys: tomorrow at {time} — {place}", "FlexiKeys: today at {time} — {place}"),
}


async def send_due(db: AsyncSession, sms: SmsSender, now: datetime) -> int:
    """Handle every reminder that is due at `now` (sent by SMS only with BY_SMS); returns how many."""
    rows = await db.execute(
        select(Booking, Slot, Place, User)
        .join(Slot, Slot.id == Booking.slot_id)
        .join(Place, Place.id == Slot.place_id)
        .join(User, User.id == Booking.booked_by)
        .where(
            Booking.status != BookingStatus.cancelled,
            Slot.starts_at > now,
            Slot.starts_at <= now + DAY,
            Booking.reminded_soon_at.is_(None),
        )
    )
    sent = 0
    for b, slot, place, user in rows:
        soon = slot.starts_at - now <= SOON
        if not soon and b.reminded_day_at is not None:
            continue
        if BY_SMS:
            text = TEXT[user.lang][1 if soon else 0]
            await sms.send(
                user.phone, text.format(time=slot.starts_at.astimezone(TASHKENT).strftime("%H:%M"), place=place.name)
            )
        if soon:
            b.reminded_soon_at = now
        b.reminded_day_at = b.reminded_day_at or now
        sent += 1
    await db.commit()
    return sent
