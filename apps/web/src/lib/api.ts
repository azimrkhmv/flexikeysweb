"use client";

// ponytail: in-browser mock of the FastAPI backend (PRD §14). Every mutation is shaped like its
// endpoint (comment above each) so swapping a body for `fetch("/api/v1/...")` is local to this file.
// Reads go through `useDb()` + the pure selectors below; replace with TanStack Query hooks later.
// All authorization lives here (never in components), mirroring `can_access_child` (PRD §15.4).

import { AAC_CARDS } from "@/content/aac";
import { FREE_LEVELS, LEVELS, LEVEL_BY_ID } from "@/content/levels";
import { SHOP_BY_ID } from "@/content/shop";
import { applyPolicy, bkt, DEFAULT_PROFILE } from "./adaptive";
import { translate, type Lang } from "./i18n";
import { persisted, useStore } from "./store";
import type {
  AacCustomCard, AacEvent, AdaptationChange, AdaptiveProfile, AiMessage, Assignment, AuditLog, CareLink, Child,
  ClassRoom, Consent, ConsentScope, Enrollment, FeatureFlag, Goal, InputProfile, InteractionEvent, LearningSession,
  LevelProgress, Note, Notification, Order, Plan, ProfileRecord, Role, SkillMastery, Subscription, User, UserStatus, Wallet,
} from "./types";

export interface ChildAuth {
  childId: string;
  grantedBy: "parent" | "class";
  exp: number;
}

export interface DB {
  v: number;
  auth: { userId: string | null; child: ChildAuth | null };
  users: User[];
  children: Child[];
  consents: Consent[];
  profiles: ProfileRecord[];
  changes: AdaptationChange[];
  sessions: LearningSession[];
  events: InteractionEvent[];
  mastery: SkillMastery[];
  progress: LevelProgress[];
  wallets: Wallet[];
  classes: ClassRoom[];
  enrollments: Enrollment[];
  assignments: Assignment[];
  careLinks: CareLink[];
  notes: Note[];
  goals: Goal[];
  aacEvents: AacEvent[];
  aacCards: AacCustomCard[];
  notifications: Notification[];
  subscriptions: Subscription[];
  orders: Order[];
  audit: AuditLog[];
  flags: FeatureFlag[];
  aiMessages: AiMessage[];
}

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export const CONSENT_VERSION = "2026-09-v1";
export const DEMO_PASSWORD = "demo12345";
export const PRICES: Record<Exclude<Plan, "free">, number> = { monthly: 49_000_00, yearly: 390_000_00 }; // tiyin
const AI_DAILY_QUOTA = 30;
const CHILD_TOKEN_MS = 8 * 3600_000;
const DAY = 86_400_000;

const id = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
const iso = (t = Date.now()) => new Date(t).toISOString();
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L (SEC-5)
export const makeCode = (n = 6) => Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

// ---------------------------------------------------------------- seed
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed(): DB {
  const r = rng(42);
  const now = Date.now();
  const user = (uid: string, email: string, name: string, role: Role, status: UserStatus = "active"): User => ({
    id: uid, email, name, role, status, password: DEMO_PASSWORD, uiLang: "uz", emailVerified: true, createdAt: iso(now - 40 * DAY),
  });
  const kid = (cid: string, parentId: string | null, name: string, birthYear: number, avatar: string, learningLang: Lang = "uz", access: Child["access"] = "touch"): Child => ({
    id: cid, parentId, name, birthYear, avatar, learningLang, uiLang: learningLang, access, equipped: {}, createdAt: iso(now - 30 * DAY),
  });
  const consent = (childId: string, scope: ConsentScope, by = "u_parent"): Consent => ({
    id: id(), childId, scope, version: CONSENT_VERSION, grantedBy: by, grantedAt: iso(now - 30 * DAY),
  });

  const db: DB = {
    v: 1,
    auth: { userId: null, child: null },
    users: [
      user("u_parent", "parent@demo.uz", "Dilnoza", "parent"),
      user("u_teacher", "teacher@demo.uz", "Gulnora Karimova", "teacher"),
      user("u_therapist", "therapist@demo.uz", "Kamola Rashidova", "therapist"),
      user("u_admin", "admin@demo.uz", "FlexiKeys Admin", "admin"),
      user("u_pending", "new.therapist@demo.uz", "Sardor Aliev", "therapist", "pending_verification"),
      user("u_parent2", "family@demo.uz", "Aziza", "parent"),
    ],
    children: [
      { ...kid("ch_ali", "u_parent", "Ali", 2019, "🦊"), equipped: { hat: "hat_crown" } },
      kid("ch_madina", "u_parent", "Madina", 2021, "🐰", "ru", "dwell"),
      kid("ch_other", "u_parent2", "Jasur", 2020, "🐼"),
      kid("ch_s1", null, "Bekzod", 2019, "🐻"),
      kid("ch_s2", null, "Sevara", 2019, "🐱"),
      kid("ch_s3", null, "Timur", 2020, "🐯"),
      kid("ch_s4", null, "Zarina", 2019, "🦋"),
    ],
    consents: [
      consent("ch_ali", "core"), consent("ch_ali", "ai_processing"), consent("ch_ali", "school_sharing"), consent("ch_ali", "therapist_sharing"),
      consent("ch_madina", "core"), consent("ch_madina", "voice_recording"),
      consent("ch_other", "core", "u_parent2"),
    ],
    profiles: [],
    changes: [],
    sessions: [],
    events: [],
    mastery: [],
    progress: [],
    wallets: [
      { childId: "ch_ali", coins: 120, stars: 46, owned: ["hat_crown", "color_mint"] },
      { childId: "ch_madina", coins: 35, stars: 12, owned: [] },
    ],
    classes: [{ id: "cl_sun", teacherId: "u_teacher", name: "Quyoshcha", grade: "Tayyorlov guruhi", learningLang: "uz", code: "KQ7M4P", createdAt: iso(now - 25 * DAY) }],
    enrollments: ["ch_ali", "ch_s1", "ch_s2", "ch_s3", "ch_s4"].map((childId) => ({ classId: "cl_sun", childId })),
    assignments: [
      { id: id(), kind: "teacher", byUserId: "u_teacher", classId: "cl_sun", levelId: "animals", note: "Hayvonlar haftasi", due: iso(now + 3 * DAY), createdAt: iso(now - 2 * DAY) },
      { id: id(), kind: "therapist", byUserId: "u_therapist", childId: "ch_ali", levelId: "body", note: "Tana aʼzolari soʻzlari — kuniga 5 daqiqa", createdAt: iso(now - DAY) },
    ],
    careLinks: [
      { id: "cl_link1", childId: "ch_ali", kind: "therapist", email: "therapist@demo.uz", professionalId: "u_therapist", status: "active", code: "TH4K9Q", createdAt: iso(now - 20 * DAY) },
      { id: "cl_link2", childId: "ch_madina", kind: "therapist", email: "therapist@demo.uz", status: "invited", code: "MD7PX3", createdAt: iso(now - 1 * DAY) },
    ],
    notes: [
      { id: id(), childId: "ch_ali", authorId: "u_therapist", text: "Ali oʻng qoʻl bilan aniqroq bosmoqda. Kattaroq tugmalar yordam beryapti.", visibleToParent: true, createdAt: iso(now - 6 * DAY) },
      { id: id(), childId: "ch_ali", authorId: "u_therapist", text: "Charchoq 12-daqiqadan keyin seziladi — tanaffus foydali.", visibleToParent: false, createdAt: iso(now - 2 * DAY) },
    ],
    goals: [
      { id: id(), childId: "ch_ali", authorId: "u_therapist", text: "5 ta hayvon nomini tanlash", done: true, createdAt: iso(now - 15 * DAY) },
      { id: id(), childId: "ch_ali", authorId: "u_therapist", text: "AAC orqali 3 soʻzli gap tuzish", done: false, createdAt: iso(now - 5 * DAY) },
    ],
    aacEvents: [],
    aacCards: [{ id: id(), childId: "ch_ali", category: "people", emoji: "🐈", label: "Mosh", createdAt: iso(now - 9 * DAY) }],
    notifications: [
      { id: id(), userId: "u_parent", titleKey: "notif.weekly_report", vars: { name: "Ali" }, read: false, at: iso(now - 1 * DAY) },
      { id: id(), userId: "u_parent", titleKey: "notif.adaptation", vars: { name: "Ali" }, read: false, at: iso(now - 2 * DAY) },
      { id: id(), userId: "u_parent", titleKey: "notif.care_invite_sent", vars: { name: "Madina" }, read: true, at: iso(now - 1 * DAY) },
      { id: id(), userId: "u_therapist", titleKey: "notif.care_invite", vars: { name: "Madina" }, read: false, at: iso(now - 1 * DAY) },
      { id: id(), userId: "u_teacher", titleKey: "notif.class_joined", vars: { name: "Ali" }, read: true, at: iso(now - 20 * DAY) },
    ],
    subscriptions: [{ userId: "u_parent", plan: "free", status: "active" }],
    orders: [],
    audit: [
      { id: id(), actorId: "u_admin", action: "content.publish", target: "curriculum v12", at: iso(now - 3 * DAY) },
      { id: id(), actorId: "u_therapist", action: "child.read", target: "ch_ali", at: iso(now - 2 * DAY) },
    ],
    flags: [
      { key: "ai_assistant", enabled: true, description: "Parent AI assistant" },
      { key: "teacher_ai", enabled: true, description: "Teacher AI helper" },
      { key: "ai_weekly_reports", enabled: true, description: "AI-written weekly reports" },
      { key: "recurring_payments", enabled: false, description: "Card tokenization + auto-renew" },
      { key: "auto_approve_professionals", enabled: false, description: "Skip admin verification for teachers/therapists (pilot)" },
      { key: "connect_dots", enabled: false, description: "Connect-the-dots activity (cut line)" },
    ],
    aiMessages: [],
  };

  // ~2 weeks of play history so dashboards have something real to show.
  const history: [string, number, string[]][] = [
    ["ch_ali", 14, ["letters", "numbers", "shapes", "colors", "family", "animals"]],
    ["ch_madina", 9, ["letters", "numbers", "shapes"]],
    ["ch_s1", 10, ["letters", "numbers", "shapes", "colors"]],
    ["ch_s2", 8, ["letters", "numbers", "shapes"]],
    ["ch_s3", 6, ["letters", "numbers"]],
    ["ch_s4", 12, ["letters", "numbers", "shapes", "colors", "family"]],
  ];
  for (const [childId, days, levels] of history) {
    for (let d = days; d >= 1; d--) {
      if (r() < 0.25) continue;
      const start = now - d * DAY + 16 * 3600_000 * r();
      const minutes = Math.round(6 + r() * 12);
      db.sessions.push({ id: id(), childId, input: "touch", platform: "web", startedAt: iso(start), endedAt: iso(start + minutes * 60_000), minutes, activities: 2 + Math.floor(r() * 4) });
    }
    levels.forEach((levelId, i) => {
      const p = Math.min(0.95, 0.35 + (levels.length - i) * 0.1 + r() * 0.1);
      db.mastery.push({ childId, skill: levelId, pKnown: Math.round(p * 100) / 100, attempts: 20 + Math.floor(r() * 40), updatedAt: iso(now - i * DAY) });
      const acts = LEVEL_BY_ID[levelId].activities.map((a) => a.id);
      const done = i < levels.length - 1 ? acts : acts.slice(0, 1);
      db.progress.push({ childId, levelId, completed: done, stars: done.length * 3 });
    });
  }

  const ali: ProfileRecord = {
    childId: "ch_ali", input: "touch", version: 5, lastDir: {}, updatedAt: iso(now - DAY),
    params: { ...DEFAULT_PROFILE, keyScale: 1.2, spacing: 12, dwellMs: 150, hintLevel: 1, optionCount: 3, targetScale: 1.1, traceTolerance: 48 },
  };
  const madina: ProfileRecord = {
    childId: "ch_madina", input: "touch", version: 2, lastDir: {}, updatedAt: iso(now - 2 * DAY),
    params: { ...DEFAULT_PROFILE, hintLevel: 2, optionCount: 2, targetScale: 1.2 },
  };
  db.profiles.push(ali, madina);
  const ch = (childId: string, param: AdaptationChange["param"], from: number, to: number, reasonKey: string, daysAgo: number): AdaptationChange => ({
    id: id(), childId, input: "touch", param, from, to, reasonKey, at: iso(now - daysAgo * DAY),
  });
  db.changes.push(
    ch("ch_ali", "keyScale", 1, 1.1, "adapt.keyScale.more", 12),
    ch("ch_ali", "dwellMs", 0, 150, "adapt.dwellMs.more", 11),
    ch("ch_ali", "spacing", 8, 12, "adapt.spacing.more", 9),
    ch("ch_ali", "keyScale", 1.1, 1.2, "adapt.keyScale.more", 7),
    ch("ch_ali", "hintLevel", 2, 1, "adapt.hintLevel.less", 4),
    ch("ch_ali", "traceTolerance", 40, 48, "adapt.traceTolerance.more", 3),
    ch("ch_ali", "breakAfterMin", 15, 12, "adapt.breakAfterMin.more", 2),
    ch("ch_madina", "hintLevel", 1, 2, "adapt.hintLevel.more", 5),
    ch("ch_madina", "optionCount", 3, 2, "adapt.optionCount.more", 5),
    ch("ch_madina", "targetScale", 1.1, 1.2, "adapt.targetScale.more", 2),
  );

  const phrases = [["i", "want", "water"], ["i", "want", "more"], ["mom", "hug"], ["happy"], ["go", "outside"], ["i", "like", "music"], ["tired"], ["i", "want", "ball"], ["help"], ["finished"]];
  for (let k = 0; k < 26; k++) {
    const cardIds = phrases[Math.floor(r() * phrases.length)];
    db.aacEvents.push({ id: id(), childId: "ch_ali", cardIds, sentence: cardIds.join(" "), lang: "uz", at: iso(now - r() * 7 * DAY) });
  }
  return db;
}

export const dbStore = persisted<DB>("fk_db_v1", seed());
export const useDb = () => useStore(dbStore);

const read = () => dbStore.get();
const write = (fn: (db: DB) => void) =>
  dbStore.set((prev) => {
    const next = structuredClone(prev);
    fn(next);
    return next;
  });
/** Simulated network latency so loading states are exercised. */
const net = <T>(value: T, ms = 120) => new Promise<T>((res) => setTimeout(() => res(value), ms));

// ---------------------------------------------------------------- selectors (pure)
export const sel = {
  me: (db: DB) => db.users.find((u) => u.id === db.auth.userId) ?? null,
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
  /** done | open | sleeping (mastery gate) | plan (needs subscription — shown to the child as sleeping too). */
  levelState(db: DB, childId: string, index: number): "done" | "open" | "sleeping" | "plan" {
    const level = LEVELS[index];
    const p = sel.levelProgress(db, childId, level.id);
    if (p.completed.length >= level.activities.length) return "done";
    if (index >= FREE_LEVELS && !sel.entitled(db, childId)) return "plan";
    if (index === 0) return "open";
    const prev = LEVELS[index - 1];
    return sel.levelProgress(db, childId, prev.id).completed.length >= prev.activities.length ? "open" : "sleeping";
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
    return db.assignments.filter((a) => a.childId === childId || (a.classId && classIds.includes(a.classId)));
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
};

// ---------------------------------------------------------------- guards
function requireUser(roles?: Role[]): User {
  const db = read();
  const u = sel.me(db);
  if (!u || u.status === "disabled") throw new ApiError("unauthorized");
  if (roles && !roles.includes(u.role)) throw new ApiError("forbidden");
  return u;
}
function requireChildAccess(childId: string, allow: ReturnType<typeof sel.access>[]) {
  const u = requireUser();
  const rel = sel.access(read(), u.id, childId);
  if (!rel || !allow.includes(rel)) throw new ApiError("not_found"); // 404, never 403 (PRD §15.4)
  return { user: u, rel };
}
function requireChildToken(): ChildAuth {
  const c = sel.childAuth(read());
  if (!c) throw new ApiError("child_session_expired");
  return c;
}
function audit(db: DB, actorId: string, action: string, target: string, diff?: string) {
  db.audit.unshift({ id: id(), actorId, action, target, diff, at: iso() });
}
function notify(db: DB, userId: string | null, titleKey: string, vars?: Notification["vars"]) {
  if (userId) db.notifications.unshift({ id: id(), userId, titleKey, vars, read: false, at: iso() });
}

// ---------------------------------------------------------------- auth  (/auth/*, /users/me)
export const api = {
  /** POST /auth/register */
  async register(input: { email: string; password: string; name: string; role: Exclude<Role, "admin">; uiLang: Lang }) {
    const email = input.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("invalid_email");
    if (input.password.length < 10) throw new ApiError("weak_password");
    if (read().users.some((u) => u.email === email)) throw new ApiError("email_taken");
    const autoApprove = read().flags.find((f) => f.key === "auto_approve_professionals")?.enabled;
    const user: User = {
      id: id(), email, name: input.name.trim(), role: input.role, password: input.password, uiLang: input.uiLang,
      status: input.role === "parent" || autoApprove ? "active" : "pending_verification", emailVerified: false, createdAt: iso(),
    };
    write((db) => {
      db.users.push(user);
      db.auth.userId = user.id;
      if (user.role === "parent") db.subscriptions.push({ userId: user.id, plan: "free", status: "active" });
    });
    return net(user);
  },
  /** POST /auth/login */
  async login(email: string, password: string) {
    const u = read().users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.password !== password) throw await net(new ApiError("invalid_credentials"), 300);
    if (u.status === "disabled") throw new ApiError("account_disabled");
    write((db) => {
      db.auth.userId = u.id;
    });
    return net(u);
  },
  /** POST /auth/google — demo: signs in (or creates) a Google-linked parent. */
  async loginWithGoogle() {
    const email = "google.parent@demo.uz";
    let u = read().users.find((x) => x.email === email);
    if (!u) {
      u = { id: id(), email, name: "Google Parent", role: "parent", status: "active", password: id(), uiLang: "uz", emailVerified: true, createdAt: iso() };
      const nu = u;
      write((db) => {
        db.users.push(nu);
        db.subscriptions.push({ userId: nu.id, plan: "free", status: "active" });
      });
    }
    const uid = u.id;
    write((db) => {
      db.auth.userId = uid;
    });
    return net(u);
  },
  /** POST /auth/logout */
  async logout() {
    write((db) => {
      db.auth = { userId: null, child: null };
    });
    return net(true);
  },
  /** POST /auth/forgot-password — always succeeds (never reveals whether the email exists). */
  async forgotPassword(email: string) {
    void email;
    return net(true, 400);
  },
  /** POST /auth/verify-email */
  async verifyEmail() {
    const u = requireUser();
    write((db) => {
      db.users.find((x) => x.id === u.id)!.emailVerified = true;
    });
    return net(true);
  },
  /** PATCH /users/me */
  async updateMe(patch: Partial<Pick<User, "name" | "uiLang">>) {
    const u = requireUser();
    write((db) => Object.assign(db.users.find((x) => x.id === u.id)!, patch));
    return net(true);
  },
  /** DELETE /users/me — deletes the account and every owned child (PRD §20). */
  async deleteMe() {
    const u = requireUser();
    write((db) => {
      const kids = db.children.filter((c) => c.parentId === u.id).map((c) => c.id);
      kids.forEach((k) => purgeChild(db, k));
      db.users = db.users.filter((x) => x.id !== u.id);
      db.auth = { userId: null, child: null };
    });
    return net(true);
  },

  // ------------------------------------------------------------ children (/children/*)
  /** POST /children — consent + child in one transaction; core consent is mandatory (FR-CHILD-1). */
  async createChild(input: Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access">, scopes: ConsentScope[]) {
    const u = requireUser(["parent"]);
    if (!u.emailVerified) throw new ApiError("email_not_verified");
    if (!scopes.includes("core")) throw new ApiError("consent_required");
    if (!input.name.trim()) throw new ApiError("name_required");
    const child: Child = { ...input, name: input.name.trim(), id: id(), parentId: u.id, equipped: {}, createdAt: iso() };
    write((db) => {
      db.children.push(child);
      scopes.forEach((scope) => db.consents.push({ id: id(), childId: child.id, scope, version: CONSENT_VERSION, grantedBy: u.id, grantedAt: iso() }));
      db.wallets.push({ childId: child.id, coins: 0, stars: 0, owned: [] });
    });
    return net(child);
  },
  /** PATCH /children/{id} */
  async updateChild(childId: string, patch: Partial<Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access">>) {
    requireChildAccess(childId, ["owner", "admin"]);
    write((db) => Object.assign(db.children.find((c) => c.id === childId)!, patch));
    return net(true);
  },
  /** DELETE /children/{id} */
  async deleteChild(childId: string) {
    const { user } = requireChildAccess(childId, ["owner", "admin"]);
    write((db) => {
      purgeChild(db, childId);
      audit(db, user.id, "child.delete", childId);
    });
    return net(true);
  },
  /** GET /children/{id}/export — everything we hold about the child (FR-CHILD-3). */
  async exportChild(childId: string) {
    requireChildAccess(childId, ["owner", "admin"]);
    const db = read();
    const by = <T extends { childId?: string }>(xs: T[]) => xs.filter((x) => x.childId === childId);
    return net({
      exportedAt: iso(),
      child: sel.child(db, childId),
      consents: by(db.consents),
      adaptiveProfiles: by(db.profiles),
      adaptationChanges: by(db.changes),
      sessions: by(db.sessions),
      mastery: by(db.mastery),
      progress: by(db.progress),
      wallet: sel.wallet(db, childId),
      aacEvents: by(db.aacEvents),
      aacCustomCards: by(db.aacCards),
      careLinks: by(db.careLinks),
      notesVisibleToParent: by(db.notes).filter((n) => n.visibleToParent),
      goals: by(db.goals),
    });
  },
  /** POST /children/{id}/consent — grant or withdraw one scope. */
  async setConsent(childId: string, scope: ConsentScope, granted: boolean) {
    const { user } = requireChildAccess(childId, ["owner"]);
    if (scope === "core" && !granted) throw new ApiError("core_consent_required_use_delete");
    write((db) => {
      const cur = db.consents.find((c) => c.childId === childId && c.scope === scope && !c.withdrawnAt);
      if (granted && !cur) db.consents.push({ id: id(), childId, scope, version: CONSENT_VERSION, grantedBy: user.id, grantedAt: iso() });
      if (!granted && cur) cur.withdrawnAt = iso();
      if (!granted && scope === "school_sharing") db.enrollments = db.enrollments.filter((e) => e.childId !== childId);
      if (!granted && scope === "therapist_sharing")
        db.careLinks.forEach((l) => {
          if (l.childId === childId && l.kind === "therapist" && l.status !== "revoked") Object.assign(l, { status: "revoked", revokedAt: iso() });
        });
    });
    return net(true);
  },

  // ------------------------------------------------------------ child mode (/children/{id}/session, /class-login/*)
  /** POST /children/{id}/session — parent path. */
  async startChildMode(childId: string) {
    requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.auth.child = { childId, grantedBy: "parent", exp: Date.now() + CHILD_TOKEN_MS };
    });
    return net(true, 60);
  },
  /** POST /class-login/start — class code → roster (nickname + avatar only). */
  async classLoginStart(code: string) {
    const k = read().classes.find((c) => c.code === code.trim().toUpperCase());
    if (!k) throw await net(new ApiError("class_code_invalid"), 400);
    const roster = sel.classChildren(read(), k.id).map(({ id, name, avatar }) => ({ id, name, avatar }));
    return net({ classId: k.id, className: k.name, roster });
  },
  /** POST /class-login/child */
  async classLoginChild(classId: string, childId: string) {
    if (!read().enrollments.some((e) => e.classId === classId && e.childId === childId)) throw new ApiError("not_found");
    write((db) => {
      db.auth.child = { childId, grantedBy: "class", exp: Date.now() + CHILD_TOKEN_MS };
    });
    return net(true, 60);
  },
  async exitChildMode() {
    write((db) => {
      db.auth.child = null;
    });
    return net(true, 0);
  },

  // ------------------------------------------------------------ sessions & events
  /** POST /sessions */
  async startSession(input: InputProfile) {
    const c = requireChildToken();
    const s: LearningSession = { id: id(), childId: c.childId, input, platform: "web", startedAt: iso(), activities: 0 };
    write((db) => {
      db.sessions.push(s);
    });
    return net(s.id, 0);
  },
  /** POST /sessions/{id}/events — session must belong to the child token (fixes B2). */
  async postEvents(sessionId: string, events: Omit<InteractionEvent, "sessionId">[]) {
    const c = requireChildToken();
    const s = read().sessions.find((x) => x.id === sessionId);
    if (!s || s.childId !== c.childId) throw new ApiError("not_found");
    write((db) => {
      db.events.push(...events.map((e) => ({ ...e, sessionId })));
      if (db.events.length > 4000) db.events = db.events.slice(-4000); // ponytail: retention cap for localStorage
    });
    return net(true, 0);
  },
  /** Server-side reward rule on item/activity completion — the client never sends amounts (fixes B3). */
  async completeActivity(sessionId: string, levelId: string, activityId: string) {
    const c = requireChildToken();
    const level = LEVEL_BY_ID[levelId];
    if (!level || !level.activities.some((a) => a.id === activityId)) throw new ApiError("not_found");
    let result = { coins: 0, stars: 0, levelDone: false, first: false };
    write((db) => {
      const s = db.sessions.find((x) => x.id === sessionId && x.childId === c.childId);
      if (s) s.activities += 1;
      let p = db.progress.find((x) => x.childId === c.childId && x.levelId === levelId);
      if (!p) db.progress.push((p = { childId: c.childId, levelId, completed: [], stars: 0 }));
      const first = !p.completed.includes(activityId);
      const wasDone = p.completed.length >= level.activities.length;
      if (first) p.completed.push(activityId);
      const levelDone = !wasDone && p.completed.length >= level.activities.length;
      const stars = first ? 3 : 1;
      const coins = (first ? 5 : 2) + (levelDone ? 10 : 0);
      p.stars += stars;
      let w = db.wallets.find((x) => x.childId === c.childId);
      if (!w) db.wallets.push((w = { childId: c.childId, coins: 0, stars: 0, owned: [] }));
      w.coins += coins;
      w.stars += stars;
      result = { coins, stars, levelDone, first };
    });
    return net(result, 80);
  },
  /** PATCH /sessions/{id} (end) → worker job: metrics → BKT → bounded policy → audit log. */
  async endSession(sessionId: string) {
    const c = requireChildToken();
    let changed: AdaptationChange[] = [];
    write((db) => {
      const s = db.sessions.find((x) => x.id === sessionId && x.childId === c.childId);
      if (!s || s.endedAt) return;
      s.endedAt = iso();
      s.minutes = Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000));
      const events = db.events.filter((e) => e.sessionId === sessionId);

      for (const e of events) {
        if (!e.levelId || e.correct === undefined) continue;
        let m = db.mastery.find((x) => x.childId === c.childId && x.skill === e.levelId);
        if (!m) db.mastery.push((m = { childId: c.childId, skill: e.levelId, pKnown: 0.2, attempts: 0, updatedAt: iso() }));
        m.pKnown = Math.round(bkt(m.pKnown, e.correct) * 100) / 100;
        m.attempts += 1;
        m.updatedAt = iso();
      }

      let rec = db.profiles.find((p) => p.childId === c.childId && p.input === s.input);
      if (!rec) {
        rec = { childId: c.childId, input: s.input, params: { ...DEFAULT_PROFILE }, version: 1, lastDir: {}, updatedAt: iso() };
        db.profiles.push(rec);
      }
      const { record, changes } = applyPolicy(rec, events);
      Object.assign(rec, record);
      changed = changes.map((x) => ({ ...x, id: id(), childId: c.childId, input: s.input, at: iso() }));
      db.changes.push(...changed);
      const child = db.children.find((x) => x.id === c.childId);
      if (changed.length && child?.parentId) notify(db, child.parentId, "notif.adaptation", { name: child.name });
    });
    return net(changed, 0);
  },

  // ------------------------------------------------------------ rewards
  /** POST /rewards/{id}/redeem */
  async redeem(itemId: string) {
    const c = requireChildToken();
    const item = SHOP_BY_ID[itemId];
    if (!item) throw new ApiError("not_found");
    const w = sel.wallet(read(), c.childId);
    if (w.owned.includes(itemId)) return net(true);
    if (w.coins < item.price) throw new ApiError("insufficient_coins");
    write((db) => {
      const wallet = db.wallets.find((x) => x.childId === c.childId)!;
      wallet.coins -= item.price;
      wallet.owned.push(itemId);
    });
    return net(true);
  },
  /** PUT /rewards/equip */
  async equip(slot: "hat" | "color" | "bg", itemId: string | null) {
    const c = requireChildToken();
    if (itemId && !sel.wallet(read(), c.childId).owned.includes(itemId)) throw new ApiError("not_owned");
    write((db) => {
      const child = db.children.find((x) => x.id === c.childId)!;
      child.equipped = { ...child.equipped, [slot]: itemId ?? undefined };
    });
    return net(true, 0);
  },

  // ------------------------------------------------------------ AAC (/aac/*)
  /** POST /aac/events */
  async aacLog(cardIds: string[], sentence: string, lang: Lang) {
    const c = requireChildToken();
    write((db) => {
      db.aacEvents.push({ id: id(), childId: c.childId, cardIds, sentence, lang, at: iso() });
    });
    return net(true, 0);
  },
  /** POST /aac/compose — AI only with `ai_processing` consent (FR-AAC-3); otherwise plain join. */
  async aacCompose(labels: string[], lang: Lang) {
    const c = requireChildToken();
    const plain = labels.join(" ");
    if (!sel.hasConsent(read(), c.childId, "ai_processing")) return net({ sentence: plain, ai: false }, 0);
    // ponytail: stub composer — the real one calls LlmProvider with the ordered labels only.
    const s = plain.charAt(0).toUpperCase() + plain.slice(1) + (lang === "en" ? "." : ".");
    return net({ sentence: s, ai: true }, 350);
  },
  /** POST /aac/cards (parent only) */
  async aacAddCard(childId: string, card: Pick<AacCustomCard, "category" | "emoji" | "label">) {
    requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.aacCards.push({ ...card, id: id(), childId, createdAt: iso() });
    });
    return net(true);
  },
  /** DELETE /aac/cards/{id} */
  async aacDeleteCard(cardId: string) {
    const card = read().aacCards.find((x) => x.id === cardId);
    if (!card) throw new ApiError("not_found");
    requireChildAccess(card.childId, ["owner"]);
    write((db) => {
      db.aacCards = db.aacCards.filter((x) => x.id !== cardId);
    });
    return net(true);
  },

  // ------------------------------------------------------------ care links & classes (parent side)
  /** POST /parent/children/{id}/care-links */
  async inviteCare(childId: string, email: string, kind: "therapist" | "teacher" = "therapist") {
    const { user } = requireChildAccess(childId, ["owner"]);
    if (!sel.hasConsent(read(), childId, "therapist_sharing")) throw new ApiError("consent_required");
    const link: CareLink = { id: id(), childId, kind, email: email.trim().toLowerCase(), status: "invited", code: makeCode(), createdAt: iso() };
    write((db) => {
      db.careLinks.push(link);
      const pro = db.users.find((u) => u.email === link.email);
      notify(db, pro?.id ?? null, "notif.care_invite", { name: sel.child(db, childId)?.name ?? "" });
      audit(db, user.id, "care_link.invite", childId);
    });
    return net(link);
  },
  /** DELETE /parent/care-links/{id} — access stops immediately (FR-PAR-2). */
  async revokeCare(linkId: string) {
    const link = read().careLinks.find((l) => l.id === linkId);
    if (!link) throw new ApiError("not_found");
    const { user } = requireChildAccess(link.childId, ["owner"]);
    write((db) => {
      Object.assign(db.careLinks.find((l) => l.id === linkId)!, { status: "revoked", revokedAt: iso() });
      audit(db, user.id, "care_link.revoke", link.childId);
    });
    return net(true);
  },
  /** POST /teacher/classes/join — parent links own child with a class code; needs school_sharing (fixes B4). */
  async joinClass(childId: string, code: string) {
    requireChildAccess(childId, ["owner"]);
    if (!sel.hasConsent(read(), childId, "school_sharing")) throw new ApiError("consent_required");
    const k = read().classes.find((c) => c.code === code.trim().toUpperCase());
    if (!k) throw new ApiError("class_code_invalid");
    write((db) => {
      if (!db.enrollments.some((e) => e.classId === k.id && e.childId === childId)) db.enrollments.push({ classId: k.id, childId });
      notify(db, k.teacherId, "notif.class_joined", { name: sel.child(db, childId)?.name ?? "" });
    });
    return net(k);
  },
  /** DELETE enrollment by parent. */
  async leaveClass(childId: string, classId: string) {
    requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.enrollments = db.enrollments.filter((e) => !(e.childId === childId && e.classId === classId));
    });
    return net(true);
  },

  // ------------------------------------------------------------ therapist (/therapist/*)
  /** POST /therapist/care-links/{id}/accept (by code) */
  async acceptInvite(code: string) {
    const u = requireUser(["therapist"]);
    if (u.status !== "active") throw new ApiError("pending_verification");
    const link = read().careLinks.find((l) => l.code === code.trim().toUpperCase() && l.status === "invited");
    if (!link) throw new ApiError("invite_invalid");
    write((db) => {
      Object.assign(db.careLinks.find((l) => l.id === link.id)!, { status: "active", professionalId: u.id });
      const child = sel.child(db, link.childId);
      notify(db, child?.parentId ?? null, "notif.care_accepted", { name: child?.name ?? "" });
    });
    return net(true);
  },
  /** Every therapist read is audit-logged (FR-THR-2). */
  async logChildRead(childId: string) {
    const { user, rel } = requireChildAccess(childId, ["therapist", "teacher", "admin", "owner"]);
    if (rel === "therapist" || rel === "admin")
      write((db) => audit(db, user.id, "child.read", childId));
    return net(true, 0);
  },
  async addNote(childId: string, text: string, visibleToParent: boolean) {
    const { user } = requireChildAccess(childId, ["therapist"]);
    write((db) => {
      db.notes.unshift({ id: id(), childId, authorId: user.id, text: text.trim(), visibleToParent, createdAt: iso() });
      if (visibleToParent) notify(db, sel.child(db, childId)?.parentId ?? null, "notif.therapist_note", { name: sel.child(db, childId)?.name ?? "" });
    });
    return net(true);
  },
  async addGoal(childId: string, text: string) {
    const { user } = requireChildAccess(childId, ["therapist"]);
    write((db) => {
      db.goals.push({ id: id(), childId, authorId: user.id, text: text.trim(), done: false, createdAt: iso() });
    });
    return net(true);
  },
  async toggleGoal(goalId: string) {
    const g = read().goals.find((x) => x.id === goalId);
    if (!g) throw new ApiError("not_found");
    requireChildAccess(g.childId, ["therapist"]);
    write((db) => {
      const goal = db.goals.find((x) => x.id === goalId)!;
      goal.done = !goal.done;
    });
    return net(true, 0);
  },
  /** Therapist recommendation → appears as a suggestion for the child and parent. */
  async recommend(childId: string, levelId: string, note: string) {
    const { user } = requireChildAccess(childId, ["therapist"]);
    write((db) => {
      db.assignments.push({ id: id(), kind: "therapist", byUserId: user.id, childId, levelId, note: note.trim(), createdAt: iso() });
    });
    return net(true);
  },

  // ------------------------------------------------------------ teacher (/teacher/*)
  async createClass(input: Pick<ClassRoom, "name" | "grade" | "learningLang">) {
    const u = requireUser(["teacher"]);
    if (u.status !== "active") throw new ApiError("pending_verification");
    const k: ClassRoom = { ...input, id: id(), teacherId: u.id, code: makeCode(), createdAt: iso() };
    write((db) => {
      db.classes.push(k);
    });
    return net(k);
  },
  /** POST /teacher/classes/{id}/children — school-managed profile; school attests it holds parental consent. */
  async addSchoolChild(classId: string, input: { name: string; avatar: string; attested: boolean }) {
    const u = requireUser(["teacher"]);
    const k = read().classes.find((c) => c.id === classId && c.teacherId === u.id);
    if (!k) throw new ApiError("not_found");
    if (!input.attested) throw new ApiError("consent_required");
    const child: Child = {
      id: id(), parentId: null, name: input.name.trim(), birthYear: new Date().getFullYear() - 6, avatar: input.avatar,
      learningLang: k.learningLang, uiLang: k.learningLang, access: "touch", equipped: {}, createdAt: iso(),
    };
    write((db) => {
      db.children.push(child);
      db.enrollments.push({ classId, childId: child.id });
      db.wallets.push({ childId: child.id, coins: 0, stars: 0, owned: [] });
      audit(db, u.id, "school_child.create", child.id, "school consent attested");
    });
    return net(child);
  },
  /** Removing a child revokes teacher access immediately (FR-TCH-3). */
  async removeFromClass(classId: string, childId: string) {
    const u = requireUser(["teacher"]);
    if (!read().classes.some((c) => c.id === classId && c.teacherId === u.id)) throw new ApiError("not_found");
    write((db) => {
      db.enrollments = db.enrollments.filter((e) => !(e.classId === classId && e.childId === childId));
    });
    return net(true);
  },
  async assign(input: { classId: string; levelId: string; note: string; due?: string }) {
    const u = requireUser(["teacher"]);
    if (!read().classes.some((c) => c.id === input.classId && c.teacherId === u.id)) throw new ApiError("not_found");
    write((db) => {
      db.assignments.push({ ...input, id: id(), kind: "teacher", byUserId: u.id, createdAt: iso() });
    });
    return net(true);
  },
  async deleteAssignment(assignmentId: string) {
    const u = requireUser(["teacher", "therapist"]);
    write((db) => {
      db.assignments = db.assignments.filter((a) => !(a.id === assignmentId && a.byUserId === u.id));
    });
    return net(true, 0);
  },

  // ------------------------------------------------------------ AI (/ai-assistant/*, /teacher/ai/summary)
  /** POST /ai-assistant/chat — pseudonymized context, consent-gated, quota-limited (PRD §16). */
  async askAssistant(childId: string, text: string, lang: Lang) {
    const { user } = requireChildAccess(childId, ["owner"]);
    const db = read();
    if (!sel.hasConsent(db, childId, "ai_processing")) throw new ApiError("consent_required");
    const today = iso().slice(0, 10);
    if (db.aiMessages.filter((m) => m.userId === user.id && m.role === "user" && m.at.startsWith(today)).length >= AI_DAILY_QUOTA) throw new ApiError("quota_exceeded");
    const answer = stubAssistant(db, childId, text, lang);
    write((d) => {
      d.aiMessages.push({ id: id(), userId: user.id, childId, role: "user", text, at: iso() });
      d.aiMessages.push({ id: id(), userId: user.id, childId, role: "assistant", text: answer, at: iso() });
    });
    return net(answer, 700);
  },
  async clearAssistant(childId: string) {
    const { user } = requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.aiMessages = db.aiMessages.filter((m) => !(m.userId === user.id && m.childId === childId));
    });
    return net(true, 0);
  },
  async teacherAiSummary(classId: string, lang: Lang) {
    const u = requireUser(["teacher"]);
    const db = read();
    const k = db.classes.find((c) => c.id === classId && c.teacherId === u.id);
    if (!k) throw new ApiError("not_found");
    const kids = sel.classChildren(db, classId);
    const avg = (childId: string) => {
      const m = sel.mastery(db, childId).filter((x) => x.attempts > 0);
      return m.length ? m.reduce((a, x) => a + x.pKnown, 0) / m.length : 0;
    };
    const sorted = [...kids].sort((a, b) => avg(b.id) - avg(a.id));
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const lines = [
      t("ai.teacher.summary", { n: kids.length }),
      t("ai.teacher.groups", { a: sorted.slice(0, Math.ceil(sorted.length / 2)).map((c) => c.name).join(", "), b: sorted.slice(Math.ceil(sorted.length / 2)).map((c) => c.name).join(", ") || "—" }),
      t("ai.teacher.suggest"),
      t("ai.disclaimer"),
    ];
    return net(lines.join("\n\n"), 800);
  },

  // ------------------------------------------------------------ notifications
  async markRead(notificationId?: string) {
    const u = requireUser();
    write((db) => db.notifications.forEach((n) => {
      if (n.userId === u.id && (!notificationId || n.id === notificationId)) n.read = true;
    }));
    return net(true, 0);
  },

  // ------------------------------------------------------------ billing (/billing/*)
  /** POST /billing/checkout → provider page → merchant callback (simulated) → entitlement. */
  async checkout(plan: Exclude<Plan, "free">, provider: "payme" | "click") {
    const u = requireUser(["parent"]);
    const order: Order = { id: id(), userId: u.id, plan, amountTiyin: PRICES[plan], provider, state: "created", createdAt: iso() };
    write((db) => {
      db.orders.unshift(order);
    });
    await net(true, 900); // redirect to provider sandbox + PerformTransaction / Complete callback
    write((db) => {
      const o = db.orders.find((x) => x.id === order.id)!;
      if (o.state !== "created") return; // idempotent: duplicate callbacks never double-credit (FR-BILL-1)
      o.state = "paid";
      const cur = sel.subscription(db, u.id);
      const base = cur.plan !== "free" && cur.until && cur.until > iso() ? Date.parse(cur.until) : Date.now();
      const until = iso(base + (plan === "monthly" ? 30 : 365) * DAY);
      db.subscriptions = db.subscriptions.filter((s) => s.userId !== u.id);
      db.subscriptions.push({ userId: u.id, plan, status: "active", until });
      notify(db, u.id, "notif.payment_ok");
    });
    return order;
  },
  /** POST /billing/cancel — keeps access until the paid period ends. */
  async cancelSubscription() {
    const u = requireUser(["parent"]);
    write((db) => {
      const s = db.subscriptions.find((x) => x.userId === u.id);
      if (s && s.plan !== "free") s.status = "canceled";
    });
    return net(true);
  },

  // ------------------------------------------------------------ admin (/admin/*) — every mutation audited (FR-ADM-1)
  async setUserStatus(userId: string, status: UserStatus) {
    const u = requireUser(["admin"]);
    write((db) => {
      const target = db.users.find((x) => x.id === userId);
      if (!target) return;
      audit(db, u.id, "user.status", target.email, `${target.status} → ${status}`);
      target.status = status;
      if (status === "active") notify(db, target.id, "notif.account_approved");
    });
    return net(true);
  },
  async setFlag(key: string, enabled: boolean) {
    const u = requireUser(["admin"]);
    write((db) => {
      const f = db.flags.find((x) => x.key === key);
      if (!f) return;
      audit(db, u.id, "flag.set", key, `${f.enabled} → ${enabled}`);
      f.enabled = enabled;
    });
    return net(true, 0);
  },
  async grantComp(userId: string, days: number) {
    const u = requireUser(["admin"]);
    write((db) => {
      db.subscriptions = db.subscriptions.filter((s) => s.userId !== userId);
      db.subscriptions.push({ userId, plan: "monthly", status: "active", until: iso(Date.now() + days * DAY) });
      audit(db, u.id, "subscription.comp", userId, `${days} days`);
    });
    return net(true);
  },
  /** Resets the whole demo database to the seed (keeps you logged out). */
  resetDemo() {
    dbStore.set(seed());
  },
};

function purgeChild(db: DB, childId: string) {
  const keep = <T extends { childId?: string }>(xs: T[]) => xs.filter((x) => x.childId !== childId);
  const sessionIds = new Set(db.sessions.filter((s) => s.childId === childId).map((s) => s.id));
  db.children = db.children.filter((c) => c.id !== childId);
  db.consents = keep(db.consents);
  db.profiles = keep(db.profiles);
  db.changes = keep(db.changes);
  db.sessions = keep(db.sessions);
  db.events = db.events.filter((e) => !sessionIds.has(e.sessionId));
  db.mastery = keep(db.mastery);
  db.progress = keep(db.progress);
  db.wallets = keep(db.wallets);
  db.enrollments = keep(db.enrollments);
  db.assignments = db.assignments.filter((a) => a.childId !== childId);
  db.careLinks = keep(db.careLinks);
  db.notes = keep(db.notes);
  db.goals = keep(db.goals);
  db.aacEvents = keep(db.aacEvents);
  db.aacCards = keep(db.aacCards);
  db.aiMessages = keep(db.aiMessages);
  if (db.auth.child?.childId === childId) db.auth.child = null;
}

const MEDICAL = /(cerebral|palsy|diagnos|therapy|medic|doctor|autism|церебр|диагноз|врач|лечени|аутизм|shifokor|tashxis|kasal|autizm|davolash)/i;

// ponytail: rule-based stand-in for the Anthropic LlmProvider. Uses only aggregated, name-free stats.
function stubAssistant(db: DB, childId: string, text: string, lang: Lang): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const mastery = sel.mastery(db, childId).filter((m) => m.attempts > 0).sort((a, b) => b.pKnown - a.pKnown);
  const strong = mastery[0] ? LEVEL_BY_ID[mastery[0].skill].title[lang] : "—";
  const weak = mastery.length ? LEVEL_BY_ID[mastery[mastery.length - 1].skill].title[lang] : "—";
  const minutes = sel.dailyMinutes(db, childId, 7).reduce((a, d) => a + d.minutes, 0);
  const change = sel.changes(db, childId)[0];
  const parts = [
    t("ai.parent.intro", { minutes }),
    t("ai.parent.strong", { skill: strong }),
    t("ai.parent.practice", { skill: weak }),
    change ? t("ai.parent.adapt", { change: t(change.reasonKey) }) : "",
    t("ai.parent.tip"),
  ];
  if (MEDICAL.test(text)) parts.push(t("ai.disclaimer"));
  return parts.filter(Boolean).join("\n\n");
}

export const AAC_CORE = AAC_CARDS.filter((c) => c.core);
