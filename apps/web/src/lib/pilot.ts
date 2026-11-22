// The pilot numbers (B113, Update 4 spec 4.3): the demo's copy of the server's rules (apps/api app/modules/pilot/
// rules.py), counted from saved exercise and game records only, never from parents' answers. Same tests on both sides.
//
// Active day: a Tashkent day with a finished exercise or game (a task marked done or a game try).
// Retained: at least 3 active days a week in at least 3 of the last 4 full weeks (Monday-Sunday, before this week).
// Quiet: finished sign-up and no active day in the last 3 days (today and the two days before).

import type { DB } from "./api/schema";

/** Days as "YYYY-MM-DD". */
type Day = string;

const DAY_MS = 86_400_000;
const toDay = (ms: number): Day => new Date(ms).toISOString().slice(0, 10);
const fromDay = (d: Day) => Date.parse(`${d}T00:00:00Z`);
const addDays = (d: Day, n: number) => toDay(fromDay(d) + n * DAY_MS);

/** The Tashkent day (UTC+5, no summer time) of an ISO time. */
export const tashkentDay = (iso: string): Day => toDay(Date.parse(iso) + 5 * 3_600_000);

/** Mondays of the last n full weeks before the week of `today`, newest first. */
export function fullWeeks(today: Day, n = 4): Day[] {
  const weekday = (new Date(fromDay(today)).getUTCDay() + 6) % 7; // Monday = 0
  const monday = addDays(today, -weekday);
  return Array.from({ length: n }, (_, i) => addDays(monday, -7 * (i + 1)));
}

export function isRetained(active: Iterable<Day>, today: Day): boolean {
  const days = new Set(active);
  const good = fullWeeks(today).filter((m) => Array.from({ length: 7 }, (_, i) => addDays(m, i)).filter((d) => days.has(d)).length >= 3);
  return good.length >= 3;
}

export function isQuiet(active: Iterable<Day>, today: Day): boolean {
  const days = new Set(active);
  return ![0, 1, 2].some((i) => days.has(addDays(today, -i)));
}

export function lastActive(active: Iterable<Day>, today: Day): Day | null {
  return [...active].filter((d) => d <= today).sort().at(-1) ?? null;
}

// ---------------------------------------------------------------- the page's numbers (same shape as GET /admin/pilot)

export interface QuietFamily {
  userId: string;
  name: string | null;
  phone: string;
  region: string | null;
  district: string | null;
  refCode: string | null;
  signedUp: Day;
  lastActive: Day | null;
}

export interface PilotNumbers {
  today: Day;
  signedUp: number;
  signupsByDay: { day: Day; count: number }[];
  byRegion: { region: string | null; count: number }[];
  byCenter: { code: string | null; name: string | null; count: number }[];
  retained: number;
  quiet: QuietFamily[];
}

export interface CenterLink {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  signups: number;
}

const counted = <K,>(keys: K[]) => {
  const m = new Map<K, number>();
  keys.forEach((k) => m.set(k, (m.get(k) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

/** The demo database's pilot numbers, worked out like the server does. */
export function pilotFromDb(db: DB, now = Date.now()): PilotNumbers {
  const today = tashkentDay(new Date(now).toISOString());
  const owners = db.users.filter((u) => u.role === "parent" && u.consentVersion);
  const familyOf = (userId: string) => db.familyMembers.find((m) => m.userId === userId && m.role === "owner")?.familyId;
  const childFamily = new Map(db.children.map((c) => [c.id, c.familyId]));
  const active = new Map<string, Set<Day>>();
  const mark = (childId: string, iso: string) => {
    const f = childFamily.get(childId);
    if (f) (active.get(f) ?? active.set(f, new Set()).get(f)!).add(tashkentDay(iso));
  };
  db.tasksDone.forEach((t) => mark(t.childId, t.at));
  db.tries.forEach((t) => mark(t.childId, t.ts));
  const rows = owners.map((u) => {
    const f = familyOf(u.id);
    return { u, days: (f && active.get(f)) || new Set<Day>(), signedUp: tashkentDay(u.signedUpAt ?? u.createdAt) };
  });
  const names = new Map((db.centerLinks ?? []).map((l) => [l.code, l.name]));
  return {
    today,
    signedUp: rows.length,
    signupsByDay: counted(rows.map((r) => r.signedUp)).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day)),
    byRegion: counted(rows.map((r) => r.u.district?.region ?? null)).map(([region, count]) => ({ region, count })),
    byCenter: counted(rows.map((r) => r.u.ref ?? null)).map(([code, count]) => ({ code, name: code ? (names.get(code) ?? null) : null, count })),
    retained: rows.filter((r) => isRetained(r.days, today)).length,
    quiet: rows
      .filter((r) => isQuiet(r.days, today))
      .map((r) => ({
        userId: r.u.id,
        name: r.u.name || null,
        phone: r.u.phone ?? "",
        region: r.u.district?.region ?? null,
        district: r.u.district?.district || null,
        refCode: r.u.ref ?? null,
        signedUp: r.signedUp,
        lastActive: lastActive(r.days, today),
      }))
      .sort((a, b) => (a.lastActive ?? "").localeCompare(b.lastActive ?? "")),
  };
}

export function centerLinksFromDb(db: DB): CenterLink[] {
  return (db.centerLinks ?? []).map((l) => ({ id: l.id, name: l.name, code: l.code, createdAt: l.at, signups: db.users.filter((u) => u.ref === l.code).length }));
}

/** One table as a CSV file (Excel opens it: UTF-8 with a BOM, quotes doubled). */
export function toCsv(header: string[], rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(",")).join("\n");
}
