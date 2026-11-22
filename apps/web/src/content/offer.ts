// The offer (B114, Update 4 spec 5.1). Change the numbers here only: the landing page, Account → Plan, the reminder
// and the admin pages all read them. The server does not need them (it only keeps the sign-up time and the payments).
// TASKS.md Q18: final price and free period; Q19: what happens when the free month ends unpaid (only a reminder).

export const OFFER = {
  /** Free days from the moment sign-up finished. */
  freeDays: 30,
  /** The price after the free period, in so'm (UZS), for `periodMonths` months. */
  priceUzs: 299_000,
  periodMonths: 3,
} as const;

const DAY = 86_400_000;

/** When this family's free period ends (null before sign-up finished). */
export function freeEndsAt(signedUpAt: string | undefined): string | null {
  if (!signedUpAt) return null;
  const t = Date.parse(signedUpAt);
  return Number.isNaN(t) ? null : new Date(t + OFFER.freeDays * DAY).toISOString();
}

/** The parent's gentle reminder shows when the free period is over and the family is not paid. Never on child screens,
 * and nothing is ever locked because of it. */
export function needsPayReminder(signedUpAt: string | undefined, paidUntil: string | undefined, now = Date.now()): boolean {
  const end = freeEndsAt(signedUpAt);
  if (!end || Date.parse(end) > now) return false;
  return !(paidUntil && Date.parse(paidUntil) > now);
}

/** "299 000" (a narrow space between thousands, as the rest of the app writes sums). */
export const fmtUzs = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
