// Shared display formatters (one implementation each; previously duplicated in parent/pro/marketing code).

/** "date" = 12 Sep 2026 (parent views) · "dayMonth" = 12 Sep (professional lists) · "dateTime" = 12 Sep, 14:05 ·
 * "visit" = Mon 12 Sep, 14:05 in Tashkent time (bookings, wherever the parent is). */
export type DateStyle = "date" | "dayMonth" | "dateTime" | "visit";

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  date: { day: "numeric", month: "short", year: "numeric" },
  dayMonth: { day: "numeric", month: "short" },
  dateTime: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" },
  visit: { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" },
};

export function fmtDate(iso: string | undefined, lang: string, style: DateStyle = "date") {
  if (!iso) return "—";
  const d = new Date(iso);
  return style === "dateTime" || style === "visit" ? d.toLocaleString(lang, DATE_OPTIONS[style]) : d.toLocaleDateString(lang, DATE_OPTIONS[style]);
}

/** Tiyin → so'm with thin grouping: 49_000_00 → "49 000". Deterministic on server and client. */
export const fmtSum = (tiyin: number) => String(Math.round(tiyin / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
