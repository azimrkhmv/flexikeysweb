"use client";

// Pure read functions over the DB. `sel.access` is the single authorization rule (PRD §15.4).

import { FREE_LEVELS, LEVEL_BY_ID, LEVELS, levelComplete } from "@/content/levels";
import { computeMetrics, startingProfile, withFloors } from "../adaptive";
import { levelAfter } from "../roadmap";
import { AREAS, startingTheta, type Area } from "../skill";
import type { Answers } from "@/content/intake";
import { FREE, TRIAL_DAYS, TRIAL_REMIND_DAYS } from "@/content/plans";
import { replaces, therapistInput, type Profession } from "@/content/therapist";
import { LANGS, type Lang } from "../i18n";
import { DAY, iso, localDate, type DB } from "./schema";
import type { AdaptiveProfile, Child, ConsentScope, InputProfile, LevelProgress, Roadmap, User, VideoStatus, Wallet } from "../types";

// ---------------------------------------------------------------- selectors (pure)
export const sel = {
  // ---- intake, roadmap, video library (product spec 2026-10-06)
  /** Latest intake round of a child. */
  intakeRound: (db: DB, childId: string) => db.intakeRounds.filter((r) => r.childId === childId).sort((a, b) => b.round - a.round)[0] ?? null,
  intakeAnswers: (db: DB, childId: string, round: number): Answers =>
    Object.fromEntries(db.intakeAnswers.filter((a) => a.childId === childId && a.round === round).map((a) => [a.questionId, a.value])),
  roadmap: (db: DB, childId: string): Roadmap | null => db.roadmaps.filter((r) => r.childId === childId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null,
  video: (db: DB, videoId: string) => db.videos.find((v) => v.id === videoId) ?? null,
  videos: (db: DB) => db.videos,
  /** Exercises of the child's current plan marked done, oldest first. */
  tasksDone: (db: DB, childId: string) => {
    const plan = sel.roadmap(db, childId);
    return plan ? (db.tasksDone ?? []).filter((t) => t.roadmapId === plan.id).sort((a, b) => a.at.localeCompare(b.at)) : [];
  },
  /** Paused dates of the child's current plan. */
  pausedDays: (db: DB, childId: string) => {
    const plan = sel.roadmap(db, childId);
    return plan ? (db.pausedDays ?? []).filter((p) => p.roadmapId === plan.id).map((p) => p.date) : [];
  },
  /** The date of each plan day: each paused day moves the rest of the plan one day later (the server's day_dates). */
  planDates: (db: DB, childId: string): string[] => {
    const plan = sel.roadmap(db, childId);
    if (!plan) return [];
    const paused = new Set(sel.pausedDays(db, childId));
    const dates: string[] = [];
    for (let t = Date.parse(plan.startDate); dates.length < plan.days.length; t += DAY) {
      const d = new Date(t).toISOString().slice(0, 10);
      if (!paused.has(d)) dates.push(d);
    }
    return dates;
  },
  /**
   * Which plan day falls on this date (YYYY-MM-DD): each paused day before it moves the plan forward one day, so a
   * paused day is never missed (spec §10). "paused" on a paused date, null before the plan starts or after it ends.
   */
  planDayOn: (db: DB, childId: string, date: string): number | "paused" | null => {
    const plan = sel.roadmap(db, childId);
    if (!plan) return null;
    const paused = sel.pausedDays(db, childId);
    if (paused.includes(date)) return "paused";
    const i = Math.round((Date.parse(date) - Date.parse(plan.startDate)) / DAY) - paused.filter((p) => p < date).length;
    return i >= 0 && i < plan.days.length ? i : null;
  },
  /** θ of every skill area: what clean tries made of it, or the first guess from the latest finished intake. */
  skills: (db: DB, childId: string): Record<Area, { theta: number; n: number }> => {
    const round = db.intakeRounds.filter((r) => r.childId === childId && r.completedAt).sort((a, b) => b.round - a.round)[0];
    const answers = round ? sel.intakeAnswers(db, childId, round.round) : {};
    return Object.fromEntries(
      AREAS.map((area) => {
        const row = (db.skills ?? []).find((s) => s.childId === childId && s.area === area);
        return [area, row ? { theta: row.theta, n: row.n } : { theta: startingTheta(area, answers), n: 0 }];
      }),
    ) as Record<Area, { theta: number; n: number }>;
  },
  /** Seconds of game time today (this device's date). */
  playedToday: (db: DB, childId: string) => (db.playTime ?? []).find((p) => p.childId === childId && p.date === localDate())?.seconds ?? 0,
  /** The child's answer to the question of this day, if given. */
  dailyAnswer: (db: DB, childId: string, date: string) => (db.dailyAnswers ?? []).find((a) => a.childId === childId && a.date === date) ?? null,
  /** An exercise's level now: the plan's level, moved by the parent's easy / hard ratings (spec §8). */
  exerciseLevel: (db: DB, childId: string, videoId: string) => {
    const start = sel.roadmap(db, childId)?.days.flatMap((d) => d.exercises).find((e) => e.videoId === videoId)?.level ?? 1;
    return levelAfter(start, sel.tasksDone(db, childId).filter((t) => t.videoId === videoId).map((t) => t.feeling));
  },
  /** Language versions with this review status, and how many there are of each status. */
  videosByStatus: (db: DB, status: VideoStatus) => db.videos.flatMap((video) => LANGS.filter((l) => video.versions[l]?.status === status).map((lang) => ({ video, lang }))),
  /** The single rule for "a family may see this video": a physio approved this language version (spec §8). */
  usableVideos: (db: DB, lang: Lang) => db.videos.filter((v) => v.versions[lang]?.status === "approved"),

  me: (db: DB) => db.users.find((u) => u.id === db.auth.userId) ?? null,
  /** A parent who signed in by phone but has not given the basic consent and district yet. Staff skip it (A1.9). */
  needsSignup: (u: Pick<User, "role" | "phone" | "consentVersion">) => u.role === "parent" && !!u.phone && !u.consentVersion,
  /** Live mode: server data not loaded yet — show a spinner, don't conclude "signed out". */
  loading: (db: DB) => !!db.loading,
  childAuth: (db: DB) => (db.auth.child && db.auth.child.exp > Date.now() ? db.auth.child : null),
  child: (db: DB, childId: string) => db.children.find((c) => c.id === childId) ?? null,
  /** The family this person owns (a person owns at most one), or null. */
  ownFamily: (db: DB, userId: string) => db.familyMembers.find((m) => m.userId === userId && m.role === "owner")?.familyId ?? null,
  familyOwner: (db: DB, familyId: string | null) => db.familyMembers.find((m) => m.familyId === familyId && m.role === "owner")?.userId ?? null,
  /** The children of every family this person belongs to (owner or helper). */
  childrenOf: (db: DB, userId: string) => {
    const families = new Set(db.familyMembers.filter((m) => m.userId === userId).map((m) => m.familyId));
    return db.children.filter((c) => c.familyId !== null && families.has(c.familyId));
  },
  consents: (db: DB, childId: string) => db.consents.filter((c) => c.childId === childId && !c.withdrawnAt),
  hasConsent: (db: DB, childId: string, scope: ConsentScope) => db.consents.some((c) => c.childId === childId && c.scope === scope && !c.withdrawnAt),

  /** PRD §15.4 — the single authorization rule. Returns the relation or null (→ 404). */
  access(db: DB, userId: string | null, childId: string): "owner" | "helper" | "admin" | "therapist" | null {
    const u = db.users.find((x) => x.id === userId);
    const c = db.children.find((x) => x.id === childId);
    if (!u || !c || u.status === "disabled") return null;
    if (u.role === "admin") return "admin";
    if (u.role === "parent" && sel.ownFamily(db, u.id) === c.familyId) return "owner";
    if (u.role === "parent" && db.familyMembers.some((m) => m.userId === u.id && m.familyId === c.familyId && m.role === "helper")) return "helper";
    if (u.role === "therapist" && db.careLinks.some((l) => l.childId === childId && l.professionalId === u.id && l.status === "active" && l.kind === "therapist")) return "therapist";
    return null;
  },

  /** The adapted profile, never below the adult-set floors; a child with no sessions yet starts from their levels. */
  profile(db: DB, childId: string, input: InputProfile = "touch"): AdaptiveProfile {
    const support = db.children.find((c) => c.id === childId)?.support;
    const p = (db.profiles.find((p) => p.childId === childId && p.input === input) ?? db.profiles.find((p) => p.childId === childId))?.params;
    return p ? withFloors(p, support?.floors) : startingProfile(support);
  },
  changes: (db: DB, childId: string) => db.changes.filter((c) => c.childId === childId).sort((a, b) => b.at.localeCompare(a.at)),
  sessions: (db: DB, childId: string) => db.sessions.filter((s) => s.childId === childId).sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  /** Newest sessions with their adaptive-engine metrics (only sessions with events; live mode has none client-side). */
  sessionMetrics: (db: DB, childId: string, limit: number) =>
    sel
      .sessions(db, childId)
      .map((s) => ({ s, m: computeMetrics(db.events.filter((e) => e.sessionId === s.id)) }))
      .filter((r) => r.m.taps > 0)
      .slice(0, limit),
  mastery: (db: DB, childId: string) => LEVELS.map((l) => db.mastery.find((m) => m.childId === childId && m.skill === l.id) ?? { childId, skill: l.id, pKnown: 0, attempts: 0, updatedAt: "" }),
  wallet: (db: DB, childId: string): Wallet => db.wallets.find((w) => w.childId === childId) ?? { childId, coins: 0, stars: 0, owned: [] },
  levelProgress: (db: DB, childId: string, levelId: string): LevelProgress =>
    db.progress.find((p) => p.childId === childId && p.levelId === levelId) ?? { childId, levelId, completed: [], stars: 0 },

  /** The old level map's paid levels open with the family's Pro (B55). Never affects rewards. */
  entitled: (db: DB, childId: string) => sel.isPro(db, childId),
  /** done | open | sleeping (mastery gate) | plan (needs subscription — shown to the child as sleeping too). */
  levelState(db: DB, childId: string, index: number): "done" | "open" | "sleeping" | "plan" {
    const level = LEVELS[index];
    const p = sel.levelProgress(db, childId, level.id);
    if (levelComplete(level, p.completed)) return "done";
    if (index >= FREE_LEVELS && !sel.entitled(db, childId)) return "plan";
    if (index === 0) return "open";
    const prev = LEVELS[index - 1];
    return levelComplete(prev, sel.levelProgress(db, childId, prev.id).completed) ? "open" : "sleeping";
  },
  /**
   * Why a level can't be opened yet — null when it is playable. Therapist recommendations never change
   * this: levels open only through mastery, and paid levels only with access (FR-CUR-4, product rule 5).
   */
  lockReason(db: DB, childId: string, levelId: string): null | { kind: "mastery"; after: string } | { kind: "plan" } {
    const level = LEVEL_BY_ID[levelId];
    if (!level) return null;
    const state = sel.levelState(db, childId, level.n - 1);
    if (state === "plan") return { kind: "plan" };
    if (state === "sleeping") return { kind: "mastery", after: LEVELS[level.n - 2].id };
    return null;
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
  /** Activities finished in the last 7 days. */
  weekActivities: (db: DB, childId: string) =>
    db.sessions.filter((s) => s.childId === childId && s.startedAt > iso(Date.now() - 7 * DAY)).reduce((a, s) => a + (s.activities ?? 0), 0),
  /** The level the child is working on now (first open, unfinished one) and how far along; null when all are done. */
  currentLevel(db: DB, childId: string) {
    const i = LEVELS.findIndex((_, k) => sel.levelState(db, childId, k) === "open");
    if (i < 0) return null;
    const level = LEVELS[i];
    const required = level.activities.filter((a) => !a.optional);
    const completed = sel.levelProgress(db, childId, level.id).completed;
    return { level, done: required.filter((a) => completed.includes(a.id)).length, total: required.length };
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
    // A therapist's recommendations count only while their parent-approved link is active (FR-PAR-2).
    const linked = (userId: string) => db.careLinks.some((l) => l.childId === childId && l.professionalId === userId && l.status === "active");
    return db.assignments.filter((a) => a.childId === childId && linked(a.byUserId));
  },
  therapistChildren: (db: DB, userId: string) =>
    db.careLinks.filter((l) => l.professionalId === userId && l.status === "active").map((l) => sel.child(db, l.childId)).filter((c): c is Child => !!c),
  invitesFor: (db: DB, phone?: string) => db.careLinks.filter((l) => l.status === "invited" && !!phone && l.phone === phone),
  therapistProfile: (db: DB, userId: string) => (db.therapistProfiles ?? []).find((p) => p.userId === userId) ?? null,
  therapistAnswers: (db: DB, childId: string, therapistId: string) =>
    (db.therapistAnswers ?? []).find((r) => r.childId === childId && r.therapistId === therapistId)?.answers ?? {},
  /** The parent's answers the therapists replaced, and by whom (newest wins), plus their messages (T11), newest first. */
  therapistUpdates(db: DB, childId: string) {
    const live = db.answersInUse?.[childId];
    if (live) return { ...live, mustNotText: [] as string[] };
    const health = sel.hasConsent(db, childId, "health");
    const rows = (db.therapistAnswers ?? []).filter((r) => r.childId === childId).sort((a, b) => a.at.localeCompare(b.at));
    const who = (r: (typeof rows)[number]) => ({
      name: db.users.find((u) => u.id === r.therapistId)?.name ?? "",
      profession: sel.therapistProfile(db, r.therapistId)?.profession,
      at: r.at,
    });
    const updated: Record<string, { value: string | string[]; name: string; profession?: Profession; at: string }> = {};
    for (const r of rows) for (const [q, value] of Object.entries(replaces(r.answers, health))) updated[q] = { value, ...who(r) };
    const messages = rows.filter((r) => r.answers.T11).map((r) => ({ text: r.answers.T11!, ...who(r) })).reverse();
    const mustNotText = rows.map((r) => r.answers.T6?.text.trim()).filter((x): x is string => !!x && health);
    return { updated, messages, mustNotText };
  },
  /** The plan input from what the therapists set (the engine's TherapistInput), or undefined. */
  therapistInput: (db: DB, childId: string) =>
    therapistInput(
      (db.therapistAnswers ?? []).filter((r) => r.childId === childId).sort((a, b) => a.at.localeCompare(b.at)).map((r) => r.answers),
      sel.hasConsent(db, childId, "health"),
    ),
  /** The answers the plan is built from: the parent's, with the therapists' answers put in. */
  answersInUse: (db: DB, childId: string, answers: Answers): Answers => {
    const merged: Answers = { ...answers };
    for (const [q, u] of Object.entries(sel.therapistUpdates(db, childId).updated)) merged[q] = u.value;
    return merged;
  },
  /** The parent's movement clips (P40 media ids, latest round) when the movement-videos consent is given. */
  movementClips(db: DB, childId: string): string[] {
    if (db.clips) return db.clips.filter((c) => c.childId === childId && !c.exerciseId).map((c) => c.id);
    const round = sel.intakeRound(db, childId);
    const ids = round ? sel.intakeAnswers(db, childId, round.round).P40 : undefined;
    return sel.hasConsent(db, childId, "movement_videos") && Array.isArray(ids) ? ids : [];
  },
  /** Feedback clips of one child (B29), oldest first, with the exercise each one shows; only with the consent. */
  feedbackClips(db: DB, childId: string): { id: string; exerciseId: string }[] {
    if (!sel.hasConsent(db, childId, "movement_videos")) return [];
    if (db.clips) return db.clips.filter((c) => c.childId === childId && c.exerciseId).map((c) => ({ id: c.id, exerciseId: c.exerciseId! }));
    return (db.feedbackClips ?? []).filter((c) => c.childId === childId).map((c) => ({ id: c.id, exerciseId: c.exerciseId }));
  },
  /** Live: the server's short-lived link to watch a clip (demo clips are on this device). */
  clipUrl: (db: DB, clipId: string) => db.clips?.find((c) => c.id === clipId)?.url,
  clipReplies: (db: DB, childId: string, clipId: string) =>
    (db.clipReplies ?? []).filter((r) => r.childId === childId && r.clipId === clipId).map((r) => ({ ...r, name: r.name ?? db.users.find((u) => u.id === r.therapistId)?.name ?? "" })),
  /** Free or Pro for this family now (the server's status_of, apps/api billing/router.py). */
  familyPlan(db: DB, familyId: string | null, now = Date.now()) {
    const row = (db.familyPlans ?? []).find((p) => p.familyId === familyId);
    const trialEndsAt = row?.trialStartedAt ? iso(Date.parse(row.trialStartedAt) + TRIAL_DAYS * DAY) : undefined;
    const paid = !!row?.paidUntil && Date.parse(row.paidUntil) > now;
    const trial = !!trialEndsAt && Date.parse(trialEndsAt) > now;
    return { plan: paid || trial ? ("pro" as const) : ("free" as const), trial: trial && !paid, trialUsed: !!trialEndsAt, trialEndsAt, paidUntil: row?.paidUntil };
  },
  /** When the family's trial ends, if that is within TRIAL_REMIND_DAYS (spec §14: a reminder 2 days before). */
  trialEndsSoon(db: DB, familyId: string | null, now = Date.now()): string | null {
    const p = sel.familyPlan(db, familyId, now);
    return p.trial && p.trialEndsAt && Date.parse(p.trialEndsAt) - now <= TRIAL_REMIND_DAYS * DAY ? p.trialEndsAt : null;
  },
  /** The family this adult uses: their own, or the one they help. */
  familyOf: (db: DB, userId: string) => sel.ownFamily(db, userId) ?? db.familyMembers.find((m) => m.userId === userId)?.familyId ?? null,
  isPro: (db: DB, childId: string) => sel.familyPlan(db, sel.child(db, childId)?.familyId ?? null).plan === "pro",
  /** How many plan days the child's family has (null on Pro): Free has the first week (A7.2). */
  freeDays: (db: DB, childId: string): number | null => (sel.isPro(db, childId) ? null : FREE.planDays),
  /** The helpers of a family and the invites still open (A8.4). */
  helpers: (db: DB, familyId: string | null) => ({
    helpers: db.familyMembers.filter((m) => m.familyId === familyId && m.role === "helper").map((m) => db.users.find((u) => u.id === m.userId)).filter((u): u is User => !!u),
    invites: (db.helperInvites ?? []).filter((i) => i.familyId === familyId),
  }),
  /** Invites to help in another family, for this person's number. */
  helperInvitesFor: (db: DB, phone?: string) =>
    (db.helperInvites ?? []).filter((i) => !!phone && i.phone === phone).map((i) => ({ ...i, ownerName: i.ownerName ?? db.users.find((u) => u.id === sel.familyOwner(db, i.familyId))?.name ?? "" })),
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
  /** The assistant chats about one child: one per adult who asked, newest first (B40). */
  chats(db: DB, childId: string): { userId: string; name: string; messages: number; at: string }[] {
    const by = new Map<string, { userId: string; name: string; messages: number; at: string }>();
    for (const m of db.aiMessages.filter((x) => x.childId === childId)) {
      const c = by.get(m.userId) ?? { userId: m.userId, name: sel.user(db, m.userId)?.name ?? "", messages: 0, at: m.at };
      by.set(m.userId, { ...c, messages: c.messages + 1, at: m.at > c.at ? m.at : c.at });
    }
    return [...by.values()].sort((a, b) => b.at.localeCompare(a.at));
  },
  /** How many of each kind of thing we store about one child, in the order a parent reads them (B40). */
  stored(db: DB, childId: string): [kind: string, n: number][] {
    const of = <T extends { childId?: string }>(xs: T[] | undefined) => (xs ?? []).filter((x) => x.childId === childId).length;
    return (
      [
        ["answers", of(db.intakeAnswers)],
        ["plans", of(db.roadmaps)],
        ["tasks", of(db.tasksDone)],
        ["daily", of(db.dailyAnswers)],
        ["tries", of(db.tries)],
        ["videos", sel.movementClips(db, childId).length + sel.feedbackClips(db, childId).length],
        ["chats", sel.chats(db, childId).length],
        ["voice", of(db.aacCards)],
        ["therapists", of(db.therapistAnswers) + of(db.clipReplies)],
        ["consents", of(db.consents)],
      ] as [string, number][]
    ).filter(([, n]) => n > 0);
  },
  /** Notes about a child: a therapist sees their own; a parent sees the ones shared with them. */
  notes: (db: DB, childId: string, by: { authorId: string } | { visibleToParent: true }) =>
    db.notes.filter((n) => n.childId === childId && ("authorId" in by ? n.authorId === by.authorId : n.visibleToParent)),
  goals: (db: DB, childId: string) => db.goals.filter((g) => g.childId === childId),
  openGoals: (db: DB, childId: string) => db.goals.filter((g) => g.childId === childId && !g.done).length,
  recommendations: (db: DB, childId: string) => db.assignments.filter((a) => a.kind === "therapist" && a.childId === childId),

  // ---- admin-only reads (/admin/*)
  admin: {
    users: (db: DB) => db.users,
    /** Every family with its owner and its plan now (Free, Pro or the trial). */
    familyPlans: (db: DB) =>
      db.familyMembers.filter((m) => m.role === "owner").map((m) => ({ familyId: m.familyId, ownerId: m.userId, ...sel.familyPlan(db, m.familyId) })),
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
        paying: db.familyMembers.filter((m) => m.role === "owner" && sel.familyPlan(db, m.familyId).plan === "pro").length,
        sessions: db.sessions.filter((s) => s.startedAt > since).length,
      };
    },
  },
};
