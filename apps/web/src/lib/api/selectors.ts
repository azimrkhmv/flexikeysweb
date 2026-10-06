"use client";

// Pure read functions over the DB. `sel.access` is the single authorization rule (PRD §15.4).

import { FREE_LEVELS, LEVEL_BY_ID, LEVELS, levelComplete } from "@/content/levels";
import { DEFAULT_PROFILE } from "../adaptive";
import { DAY, iso, type DB } from "./schema";
import type { AdaptiveProfile, Child, ClassRoom, ConsentScope, InputProfile, LevelProgress, Subscription, Wallet } from "../types";

// ---------------------------------------------------------------- selectors (pure)
export const sel = {
  me: (db: DB) => db.users.find((u) => u.id === db.auth.userId) ?? null,
  /** Live mode: server data not loaded yet — show a spinner, don't conclude "signed out". */
  loading: (db: DB) => !!db.loading,
  childAuth: (db: DB) => (db.auth.child && db.auth.child.exp > Date.now() ? db.auth.child : null),
  child: (db: DB, childId: string) => db.children.find((c) => c.id === childId) ?? null,
  childrenOf: (db: DB, parentId: string) => db.children.filter((c) => c.parentId === parentId),
  consents: (db: DB, childId: string) => db.consents.filter((c) => c.childId === childId && !c.withdrawnAt),
  hasConsent: (db: DB, childId: string, scope: ConsentScope) => db.consents.some((c) => c.childId === childId && c.scope === scope && !c.withdrawnAt),

  /** PRD §15.4 — the single authorization rule. Returns the relation or null (→ 404). */
  access(db: DB, userId: string | null, childId: string): "owner" | "admin" | "therapist" | "teacher" | null {
    const u = db.users.find((x) => x.id === userId);
    const c = db.children.find((x) => x.id === childId);
    if (!u || !c || u.status === "disabled") return null;
    if (u.role === "admin") return "admin";
    if (u.role === "parent" && c.parentId === u.id) return "owner";
    if (u.role === "therapist" && db.careLinks.some((l) => l.childId === childId && l.professionalId === u.id && l.status === "active" && l.kind === "therapist")) return "therapist";
    if (u.role === "teacher") {
      const mine = db.classes.filter((k) => k.teacherId === u.id).map((k) => k.id);
      const enrolled = db.enrollments.some((e) => e.childId === childId && mine.includes(e.classId));
      if (enrolled && (c.parentId === null || sel.hasConsent(db, childId, "school_sharing"))) return "teacher";
    }
    return null;
  },

  profile(db: DB, childId: string, input: InputProfile = "touch"): AdaptiveProfile {
    return (db.profiles.find((p) => p.childId === childId && p.input === input) ?? db.profiles.find((p) => p.childId === childId))?.params ?? DEFAULT_PROFILE;
  },
  changes: (db: DB, childId: string) => db.changes.filter((c) => c.childId === childId).sort((a, b) => b.at.localeCompare(a.at)),
  sessions: (db: DB, childId: string) => db.sessions.filter((s) => s.childId === childId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  mastery: (db: DB, childId: string) => LEVELS.map((l) => db.mastery.find((m) => m.childId === childId && m.skill === l.id) ?? { childId, skill: l.id, pKnown: 0, attempts: 0, updatedAt: "" }),
  wallet: (db: DB, childId: string): Wallet => db.wallets.find((w) => w.childId === childId) ?? { childId, coins: 0, stars: 0, owned: [] },
  levelProgress: (db: DB, childId: string, levelId: string): LevelProgress =>
    db.progress.find((p) => p.childId === childId && p.levelId === levelId) ?? { childId, levelId, completed: [], stars: 0 },

  subscription: (db: DB, userId: string): Subscription => {
    const s = db.subscriptions.find((x) => x.userId === userId);
    if (s && s.plan !== "free" && s.until && s.until < iso()) return { ...s, status: "expired" };
    return s ?? { userId, plan: "free", status: "active" };
  },
  /** Paid access: family subscription, or school/therapist link (free during pilot). Never affects rewards. */
  entitled(db: DB, childId: string) {
    const c = sel.child(db, childId);
    if (!c) return false;
    if (c.parentId === null) return true;
    const s = sel.subscription(db, c.parentId);
    if (s.plan !== "free" && s.status !== "expired") return true;
    return db.enrollments.some((e) => e.childId === childId) || db.careLinks.some((l) => l.childId === childId && l.status === "active");
  },
  /**
   * done (required activities finished — replayable) | started (some activities finished) | open | plan (needs
   * subscription — shown to the child as a sleeping cloud). Levels are independent: any level the child has
   * access to can be played in any order; nothing depends on finishing the level before it.
   */
  levelState(db: DB, childId: string, index: number): "done" | "started" | "open" | "plan" {
    const level = LEVELS[index];
    const p = sel.levelProgress(db, childId, level.id);
    if (levelComplete(level, p.completed)) return "done";
    if (index >= FREE_LEVELS && !sel.entitled(db, childId)) return "plan";
    return p.completed.length ? "started" : "open";
  },
  /**
   * Why a level can't be opened — null when it is playable. The only lock is access: paid levels need the
   * family plan (or a school/therapist link). Teacher/therapist assignments never change this (product rule 5).
   */
  lockReason(db: DB, childId: string, levelId: string): null | { kind: "plan" } {
    const level = LEVEL_BY_ID[levelId];
    if (!level) return null;
    return sel.levelState(db, childId, level.n - 1) === "plan" ? { kind: "plan" } : null;
  },
  /** Levels finished out of the levels the child can play (done ones always count) — from real completions. */
  levelsProgress(db: DB, childId: string) {
    const states = LEVELS.map((_, i) => sel.levelState(db, childId, i));
    const done = states.filter((s) => s === "done").length;
    const total = states.filter((s) => s !== "plan").length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  },
  dailyMinutes(db: DB, childId: string, days = 14) {
    const out: { date: string; minutes: number }[] = [];
    for (let d = days - 1; d >= 0; d--) {
      const date = iso(Date.now() - d * DAY).slice(0, 10);
      const minutes = db.sessions.filter((s) => s.childId === childId && s.startedAt.slice(0, 10) === date).reduce((a, s) => a + (s.minutes ?? 0), 0);
      out.push({ date, minutes });
    }
    return out;
  },
  streak(db: DB, childId: string) {
    let n = 0;
    for (let d = 0; d < 60; d++) {
      const date = iso(Date.now() - d * DAY).slice(0, 10);
      const played = db.sessions.some((s) => s.childId === childId && s.startedAt.slice(0, 10) === date);
      if (played) n++;
      else if (d > 0) break;
    }
    return n;
  },
  assignmentsFor(db: DB, childId: string) {
    const classIds = db.enrollments.filter((e) => e.childId === childId).map((e) => e.classId);
    // A therapist's recommendations count only while their parent-approved link is active (FR-PAR-2).
    const linked = (userId: string) => db.careLinks.some((l) => l.childId === childId && l.professionalId === userId && l.status === "active");
    return db.assignments.filter((a) => (a.childId === childId && (a.kind !== "therapist" || linked(a.byUserId))) || (a.classId && classIds.includes(a.classId)));
  },
  classesOf: (db: DB, teacherId: string) => db.classes.filter((c) => c.teacherId === teacherId),
  classChildren: (db: DB, classId: string) =>
    db.enrollments.filter((e) => e.classId === classId).map((e) => sel.child(db, e.childId)).filter((c): c is Child => !!c),
  therapistChildren: (db: DB, userId: string) =>
    db.careLinks.filter((l) => l.professionalId === userId && l.status === "active").map((l) => sel.child(db, l.childId)).filter((c): c is Child => !!c),
  invitesFor: (db: DB, email: string) => db.careLinks.filter((l) => l.status === "invited" && l.email.toLowerCase() === email.toLowerCase()),
  careLinks: (db: DB, childId: string) => db.careLinks.filter((l) => l.childId === childId && l.status !== "revoked"),
  notifications: (db: DB, userId: string) => db.notifications.filter((n) => n.userId === userId).sort((a, b) => b.at.localeCompare(a.at)),
  aacStats(db: DB, childId: string) {
    const ev = db.aacEvents.filter((e) => e.childId === childId && e.at > iso(Date.now() - 7 * DAY));
    const counts = new Map<string, number>();
    ev.forEach((e) => e.cardIds.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1)));
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    const avgLen = ev.length ? ev.reduce((a, e) => a + e.cardIds.length, 0) / ev.length : 0;
    return { sentences: ev.length, avgLen: Math.round(avgLen * 10) / 10, top, recent: ev.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8) };
  },

  // ---- reads used by the dashboards (one place to swap for API calls; components never touch db.* directly)
  user: (db: DB, userId: string) => db.users.find((u) => u.id === userId) ?? null,
  flag: (db: DB, key: string, fallback = false) => db.flags.find((f) => f.key === key)?.enabled ?? fallback,
  profiles: (db: DB, childId: string) => db.profiles.filter((p) => p.childId === childId),
  aacCustomCards: (db: DB, childId: string) => db.aacCards.filter((c) => c.childId === childId),
  aiMessages: (db: DB, userId: string, childId: string | null) => db.aiMessages.filter((m) => m.userId === userId && m.childId === childId),
  ordersOf: (db: DB, userId: string) => db.orders.filter((o) => o.userId === userId),
  /** Notes about a child: a therapist sees their own; a parent sees the ones shared with them. */
  notes: (db: DB, childId: string, by: { authorId: string } | { visibleToParent: true }) =>
    db.notes.filter((n) => n.childId === childId && ("authorId" in by ? n.authorId === by.authorId : n.visibleToParent)),
  goals: (db: DB, childId: string) => db.goals.filter((g) => g.childId === childId),
  openGoals: (db: DB, childId: string) => db.goals.filter((g) => g.childId === childId && !g.done).length,
  recommendations: (db: DB, childId: string) => db.assignments.filter((a) => a.kind === "therapist" && a.childId === childId),
  classAssignments: (db: DB, classId: string) => db.assignments.filter((a) => a.classId === classId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  /** The class only if it belongs to this teacher (→ 404 otherwise). */
  teacherClass: (db: DB, teacherId: string, classId: string) => db.classes.find((c) => c.id === classId && c.teacherId === teacherId) ?? null,
  classesOfChild: (db: DB, childId: string) =>
    db.enrollments.filter((e) => e.childId === childId).map((e) => db.classes.find((k) => k.id === e.classId)).filter((k): k is ClassRoom => !!k),

  // ---- admin-only reads (/admin/*)
  admin: {
    users: (db: DB) => db.users,
    subscriptions: (db: DB) => db.subscriptions,
    orders: (db: DB) => db.orders,
    audit: (db: DB) => db.audit,
    flags: (db: DB) => db.flags,
    /** AI questions asked (user turns only), with the asker's role for the usage chart. */
    aiQuestions: (db: DB) => db.aiMessages.filter((m) => m.role === "user").map((m) => ({ ...m, askerRole: sel.user(db, m.userId)?.role ?? "parent" })),
    /** AI questions per day (the given ISO dates) and per asker role. */
    aiUsage(db: DB, days: string[]) {
      if (db.adminStats) return { byDay: days.map((d) => db.adminStats!.aiByDay[d] ?? 0), byRole: db.adminStats.aiByRole };
      const asked = sel.admin.aiQuestions(db);
      const byRole: Record<string, number> = {};
      for (const m of asked) byRole[m.askerRole] = (byRole[m.askerRole] ?? 0) + 1;
      return { byDay: days.map((d) => asked.filter((m) => m.at.startsWith(d)).length), byRole };
    },
    /** Live: which services answer (null = not checked; demo shows none). */
    health: (db: DB): Record<string, boolean> | null => (db.adminStats ? { api: true, ...db.adminStats.health } : null),
    stats(db: DB, since: string) {
      if (db.adminStats) return { users: db.adminStats.users, children: db.adminStats.children, paying: db.adminStats.paying, sessions: db.adminStats.sessions };
      return {
        users: db.users.length,
        children: db.children.length,
        paying: db.subscriptions.filter((s) => s.plan !== "free" && sel.subscription(db, s.userId).status !== "expired").length,
        sessions: db.sessions.filter((s) => s.startedAt > since).length,
      };
    },
  },
};
