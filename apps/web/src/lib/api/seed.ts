"use client";

// Demo data: 6 accounts, 7 children and ~2 weeks of play history (deterministic apart from ids).

import { exerciseLibrary } from "@/content/exercises";
import { LEVEL_BY_ID } from "@/content/levels";
import { DEFAULT_PROFILE } from "../adaptive";
import { buildRoadmap } from "../roadmap";
import type { Lang } from "../i18n";
import { CONSENT_VERSION, DEMO_PASSWORD, DEMO_PHONES, DAY, DB_VERSION, id, iso, type DB } from "./schema";
import type { AdaptationChange, Child, Consent, ConsentScope, IntakeValue, ProfileRecord, Role, User, UserStatus } from "../types";

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
  const user = (uid: string, email: string, name: string, role: Role, status: UserStatus = "active", phone?: string): User => ({
    id: uid, email, name, role, status, password: DEMO_PASSWORD, uiLang: "uz", emailVerified: true, createdAt: iso(now - 40 * DAY),
    ...(phone && { phone, district: { region: "tashkent_city", district: "Chilonzor" }, consentVersion: CONSENT_VERSION }),
  });
  const kid = (cid: string, parentId: string | null, name: string, birthYear: number, avatar: string, learningLang: Lang = "uz", access: Child["access"] = "touch"): Child => ({
    id: cid, parentId, name, birthYear, avatar, learningLang, uiLang: learningLang, access, equipped: {}, createdAt: iso(now - 30 * DAY),
  });
  const consent = (childId: string, scope: ConsentScope, by = "u_parent"): Consent => ({
    id: id(), childId, scope, version: CONSENT_VERSION, grantedBy: by, grantedAt: iso(now - 30 * DAY),
  });

  const db: DB = {
    v: DB_VERSION,
    auth: { userId: null, child: null },
    users: [
      user("u_parent", "parent@demo.uz", "Dilnoza", "parent", "active", DEMO_PHONES.parent),
      user("u_teacher", "teacher@demo.uz", "Gulnora Karimova", "teacher"),
      user("u_therapist", "therapist@demo.uz", "Kamola Rashidova", "therapist", "active", DEMO_PHONES.therapist),
      user("u_physio", "physio@demo.uz", "Rustam Yusupov", "physio", "active", DEMO_PHONES.physio),
      user("u_admin", "admin@demo.uz", "FlexiKeys Admin", "admin", "active", DEMO_PHONES.admin),
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
      { key: "legacy", enabled: false, description: "Pre-spec features: teacher/class, 16-level map, cloud shop, email login" },
    ],
    aiMessages: [],
    otp: [],
    intakeAnswers: [],
    intakeRounds: [],
    videos: exerciseLibrary("u_physio", iso(now - 10 * DAY)),
    roadmaps: [],
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

  // Ali finished the intake 3 days ago (spec §5): CP, walks with help on stairs, no jumping, 20 minutes a day.
  const aliAnswers: Record<string, IntakeValue> = {
    P1: "Ali", P2: "2019-04-12", P3: "boy", P4: "mother", P5: "parent", P8: "sky",
    P9: ["cp"], P10: "spastic", P11: "one_side", P12: "walks_help", P13: "never", P14: ["jumping"], P15: "no", P16: ["braces"], P17: "no",
    P18: 2, P19: 2, P20: 1, P21: 1, P22: "words", P23: 1, P24: 1, P25: "lines", P26: 1, P27: 2,
    P28: "yes", P29: 2, P30: 1, P31: 1, P32: 1, P33: ["hands", "walk", "communicate"], P34: "20", P35: "evening",
  };
  const doneAt = iso(now - 3 * DAY);
  db.consents.push(consent("ch_ali", "health"));
  db.intakeRounds.push({ childId: "ch_ali", round: 1, startedAt: doneAt, completedAt: doneAt });
  db.intakeAnswers = Object.entries(aliAnswers).map(([questionId, value]) => ({ childId: "ch_ali", round: 1, questionId, value, answeredAt: doneAt, respondent: "parent" }));
  db.roadmaps.push({
    ...buildRoadmap({ childId: "ch_ali", round: 1, birthDate: "2019-04-12", startDate: doneAt.slice(0, 10), lang: "uz", answers: aliAnswers, healthConsent: true }, db.videos),
    id: "rm_ali", createdAt: doneAt,
  });
  Object.assign(db.children.find((c) => c.id === "ch_ali")!, { birthDate: "2019-04-12", sex: "boy", relationship: "mother" });

  const phrases = [["i", "want", "water"], ["i", "want", "more"], ["mom", "hug"], ["happy"], ["go", "outside"], ["i", "like", "music"], ["tired"], ["i", "want", "ball"], ["help"], ["finished"]];
  for (let k = 0; k < 26; k++) {
    const cardIds = phrases[Math.floor(r() * phrases.length)];
    db.aacEvents.push({ id: id(), childId: "ch_ali", cardIds, sentence: cardIds.join(" "), lang: "uz", at: iso(now - r() * 7 * DAY) });
  }
  return db;
}
