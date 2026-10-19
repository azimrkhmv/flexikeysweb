// Pure mappings between the FastAPI backend's shapes and the web's types (lib/types.ts). All the places
// where the two differ live here, so the rest of the app never sees backend field names.

import { AAC_BY_ID, CUSTOM_PREFIX } from "@/content/aac";
import { DEFAULT_PROFILE } from "@/lib/adaptive";
import type { CardOut, ChildOut, ClipOut, ConsentKind, Consents, DailyOut, InUse, Me, PlanOut, ReviewItem, RoundOut, ShareOut, SharedChild, UserOut } from "@/lib/server/types";
import type { DB } from "@/lib/api/schema";
import type { Lang } from "@/lib/translate";
import type { ChildSupport, ActivityKind, AgeBand, BodyArea, DailyAnswer, ExerciseVideo, FnLevel, GoalKey, IntakeAnswer, IntakeValue, L10n, PausedDay, Restriction, Roadmap, TaskDone,
  AacCustomCard, AacEvent, AccessMode, AuditLog, AdaptationChange, AdaptiveProfile, Assignment, CareLink, Child, ClassRoom, Consent, ConsentScope, Goal,
  InteractionEvent, LearningSession, LevelProgress, Note, Notification, Order, ParamKey, Role, SkillMastery, Subscription, User, UserStatus,
} from "@/lib/types";

// ---------------------------------------------------------------- backend shapes (subset we read)
/** GET /me on the new server; the admin list (UserOut) has no name or consent fields. */
export type BUser = UserOut & Partial<Pick<Me, "name" | "consentVersion" | "needsSignup" | "needsSecondStep">>;
export interface BChild {
  id: string; parent_id: string | null; display_name: string; learning_language: string; ui_language: string;
  birth_year: number | null; avatar_id: string | null; access_mode?: string; equipped?: Record<string, string>; created_at: string;
  /** JSON column; the backend stores it as given (ChildSupport). */
  support?: ChildSupport | null;
}
export interface BConsent { id: string; child_id: string; consent_type: string; granted_at: string; version: string | null }
export interface BLevel { slug: string; completed: string[]; stars: number; state: string }
export interface BChange { id: string; changed_at: string; param: string; old_value: string | null; new_value: string | null; reason_code: string; sentence: string }
export interface BSkill { skill_key: string; p_known: number; attempts: number }
export interface BPoint { date: string; value: number | null }
export interface BSummary { child_id: string; streak_days: number; coins: number; stars: number }
export interface BProfile { profile: { params: Record<string, unknown>; version: number; updated_at: string } }
export interface BClass { id: string; name: string; grade: string; learning_language: string; join_code: string; created_at: string }
export interface BRosterChild {
  id: string; display_name: string; avatar_id: string | null; learning_language: string; ui_language: string; access_mode: string;
  birth_year: number | null; school_managed: boolean; created_at: string;
}
export interface BChildOverview { child: BRosterChild; levels: BLevel[]; skills: BSkill[]; minutes: BPoint[]; changes: BChange[] }
export interface BTask {
  id: string; kind: string; class_id: string | null; child_id: string | null; created_by: string | null; level_slug: string | null;
  instructions: string | null; due_at: string | null; created_at: string;
}
export interface BCareLink { id: string; child_id: string; email: string; kind: string; status: string; code: string; professional_user_id: string | null; created_at: string; revoked_at: string | null }
export interface BNote { id: string; child_id: string; author_id: string; text: string; visible_to_parent: boolean; created_at: string }
export interface BGoal { id: string; child_id: string; author_id: string; text: string; done: boolean; created_at: string }

const lang = (x: string | null | undefined, fallback: Lang = "uz"): Lang => (x === "uz" || x === "ru" || x === "en" ? x : fallback);

// ---------------------------------------------------------------- accounts & children
/** The new server's person (GET /me, apps/api). Phone sign-in: there is no email or password. */
export function userFrom(u: BUser): User {
  return {
    id: u.id,
    email: "",
    name: u.name ?? "",
    // ponytail: "clinic" has no screens until M6; it gets the parent area, where the server shows it nothing.
    role: (["parent", "therapist", "physio", "admin"].includes(u.role) ? u.role : "parent") as Role,
    status: u.status === "disabled" ? "disabled" : "active",
    password: "",
    uiLang: u.lang,
    emailVerified: true,
    phone: u.phone,
    district: u.region && u.district ? { region: u.region, district: u.district } : undefined,
    consentVersion: u.consentVersion ?? undefined,
    needsSecondStep: u.needsSecondStep || undefined,
    createdAt: "",
  };
}

// ---------------------------------------------------------------- the new server (apps/api)

/** A child of the family (GET /children). Uzbek Cyrillic plays with the Uzbek content. */
export function familyChildFrom(c: ChildOut): Child {
  const lang = c.lang === "uz_cyrl" ? "uz" : c.lang;
  return {
    id: c.id, familyId: c.familyId, name: c.name, birthYear: Number(c.birthDate.slice(0, 4)), birthDate: c.birthDate, sex: c.sex,
    learningLang: lang, uiLang: lang, avatar: "☁️", access: "touch", equipped: c.color ? { color: c.color } : {}, createdAt: "",
  };
}

/** The web's consent scopes the server knows; "core" is the basic consent every family gave at sign-up. */
export const CONSENT_KIND: Partial<Record<ConsentScope, ConsentKind>> = { health: "health", movement_videos: "movement_videos", therapist_sharing: "therapist_share" };

export function familyConsentsFrom(childId: string, c: Consents): Consent[] {
  const on: ConsentScope[] = ["core", ...(c.health ? ["health" as const] : []), ...(c.movementVideos ? ["movement_videos" as const] : []), ...(c.therapistShare ? ["therapist_sharing" as const] : [])];
  return on.map((scope) => ({ id: `${childId}-${scope}`, childId, scope, version: "", grantedBy: "", grantedAt: "" }));
}

export function answersFrom(childId: string, r: RoundOut): IntakeAnswer[] {
  return Object.entries(r.answers).map(([questionId, value]) => ({ childId, round: r.number, questionId, value: value as IntakeValue, answeredAt: "", respondent: "parent" }));
}

/** The current plan (GET /children/{id}/plan) as the website's roadmap. */
export function planFrom(childId: string, round: number, p: PlanOut): Roadmap {
  // The level the plan was made with (the reasons keep it); the website moves it by the ratings itself
  // (sel.exerciseLevel, the same rule as the server), so the server's level now would count them twice.
  const made = new Map(p.reasons.filter((r) => r.slot === "exercise").map((r) => [r.ref, r.level]));
  return {
    id: p.id, childId, round, startDate: p.startDate, exercisesAllowed: p.exercisesAllowed, createdAt: "",
    days: p.days.map((d) => ({
      date: d.date,
      exercises: d.exercises.map((e) => ({ videoId: e.exerciseId, level: Math.min(3, Math.max(1, made.get(e.exerciseId) ?? e.level)) as 1 | 2 | 3 })),
      games: d.games.map((g) => ({ kind: g.kind as ActivityKind, minutes: g.minutes })),
    })),
    reasons: p.reasons.map((r) => ({ slot: r.slot, goal: r.goal as GoalKey, ref: r.ref, level: r.level })),
  };
}

/** The plan's done marks (A5.3), oldest plan day first, the way the server orders the ratings. */
export function doneFrom(childId: string, p: PlanOut): TaskDone[] {
  return p.days.flatMap((d) =>
    d.exercises.flatMap((e) => (e.done ? [{ id: e.done.id, childId, roadmapId: p.id, day: d.day, videoId: e.exerciseId, feeling: e.done.feeling ?? undefined, at: d.date }] : [])),
  );
}

export const pausedFrom = (childId: string, p: PlanOut): PausedDay[] => p.paused.map((date) => ({ childId, roadmapId: p.id, date }));

export const dailyFrom = (childId: string, d: DailyOut): DailyAnswer[] =>
  d.answer === null || d.answer === undefined ? [] : [{ childId, questionId: d.questionId, date: d.date, value: d.answer as 0 | 1 | 2, at: "" }];

/** The plan's exercises as library entries, so the plan screen can show each one's name and tool. Display only:
 *  the tags that keep a plan safe are applied by the server's engine, never from these entries. */
export function planVideosFrom(p: PlanOut): ExerciseVideo[] {
  const seen = new Map<string, ExerciseVideo>();
  for (const e of p.days.flatMap((d) => d.exercises))
    if (!seen.has(e.exerciseId))
      seen.set(e.exerciseId, { id: e.exerciseId, title: e.title as L10n, tool: e.tool ?? null, bodyArea: "hands", goals: [], gmfcs: [], ages: [], difficulty: 1, conflicts: [], versions: {} });
  return [...seen.values()];
}

/** The physiotherapist's review queue: one ExerciseVideo per exercise, one version per language file. */
export function reviewVideosFrom(items: ReviewItem[]): ExerciseVideo[] {
  const byExercise = new Map<string, ExerciseVideo>();
  for (const v of items) {
    const video = byExercise.get(v.exerciseId) ?? {
      id: v.exerciseId, title: v.title as L10n, bodyArea: v.bodyArea as BodyArea, goals: v.goals as GoalKey[], gmfcs: v.gmfcs as FnLevel[],
      ages: v.ages as AgeBand[], tool: v.tool, difficulty: Math.min(3, Math.max(1, v.difficulty)) as 1 | 2 | 3, conflicts: v.conflicts as Restriction[], versions: {},
    };
    video.versions[v.lang] = {
      id: v.id, url: v.watchUrl, durationS: v.durationS ?? 0,
      status: v.status === "waiting_review" ? "generated" : v.status, // the web's name for "waiting for review"
      approvedBy: v.approvedBy ?? undefined, approvedAt: v.approvedAt ?? undefined,
      notes: v.history.filter((h) => h.note).map((h) => ({ by: h.reviewerId ?? "", text: h.note!, at: h.at })),
    };
    byExercise.set(v.exerciseId, video);
  }
  return [...byExercise.values()];
}

// ---------------------------------------------------------------- the old backend (areas not moved yet)

export function childFrom(c: BChild): Child {
  const eq = c.equipped ?? {};
  return {
    id: c.id,
    familyId: c.parent_id, // old backend: the parent's id stands in for the family
    name: c.display_name,
    birthYear: c.birth_year ?? new Date(c.created_at).getFullYear() - 6,
    learningLang: lang(c.learning_language),
    uiLang: lang(c.ui_language, lang(c.learning_language)),
    avatar: c.avatar_id ?? "🦊",
    access: (["touch", "dwell", "scan"].includes(c.access_mode ?? "") ? c.access_mode : "touch") as AccessMode,
    support: c.support ?? undefined,
    equipped: { hat: eq.hat, color: eq.color, bg: eq.bg },
    createdAt: c.created_at,
  };
}

export function childTo(c: Partial<Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access" | "support">>) {
  const body: Record<string, unknown> = {};
  if (c.name !== undefined) body.display_name = c.name;
  if (c.birthYear !== undefined) body.birth_year = c.birthYear;
  if (c.learningLang !== undefined) body.learning_language = c.learningLang;
  if (c.uiLang !== undefined) body.ui_language = c.uiLang;
  if (c.avatar !== undefined) body.avatar_id = c.avatar;
  if (c.access !== undefined) body.access_mode = c.access;
  if (c.support !== undefined) body.support = c.support;
  return body;
}

// "core" consent is the backend's data_processing scope; the other four have the same names.
export const scopeTo = (s: ConsentScope) => (s === "core" ? "data_processing" : s);
export const scopeFrom = (s: string): ConsentScope | null =>
  s === "data_processing" ? "core" : (["ai_processing", "voice_recording", "school_sharing", "therapist_sharing"] as const).find((x) => x === s) ?? null;

export function consentsFrom(list: BConsent[]): Consent[] {
  return list.flatMap((c) => {
    const scope = scopeFrom(c.consent_type);
    return scope ? [{ id: c.id, childId: c.child_id, scope, version: c.version ?? "", grantedBy: "", grantedAt: c.granted_at }] : [];
  });
}

// ---------------------------------------------------------------- progress
export const levelsFrom = (childId: string, list: BLevel[]): LevelProgress[] =>
  list.map((l) => ({ childId, levelId: l.slug, completed: l.completed, stars: l.stars }));

/** Web events send skill_key = level id, so skill mastery is per level. */
export const masteryFrom = (childId: string, list: BSkill[]): SkillMastery[] =>
  list.map((s) => ({ childId, skill: s.skill_key, pKnown: s.p_known, attempts: s.attempts, updatedAt: "" }));

/** Daily "time" series → one pseudo-session per active day (what the minutes chart and streak need). */
export function sessionsFrom(childId: string, points: BPoint[]): LearningSession[] {
  return points
    .filter((p) => (p.value ?? 0) > 0)
    .map((p) => {
      const minutes = Math.max(1, Math.round(p.value ?? 0));
      const start = `${p.date}T12:00:00.000Z`;
      return { id: `day-${childId}-${p.date}`, childId, input: "touch", platform: "web", startedAt: start, endedAt: start, minutes, activities: 0 };
    });
}

// ---------------------------------------------------------------- adaptive profile & changes
const num = (x: unknown, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? x : fallback);
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Backend profile params → the web's AdaptiveProfile. key_spacing is a factor of the 8 px base gap. */
export function profileFrom(params: Record<string, unknown>): AdaptiveProfile {
  const hints = Object.values((params.hint_level as Record<string, number> | undefined) ?? {}).filter((h) => typeof h === "number");
  return {
    keyScale: num(params.key_scale, DEFAULT_PROFILE.keyScale),
    spacing: Math.round(8 * num(params.key_spacing, 1)),
    dwellMs: num(params.dwell_time_ms, DEFAULT_PROFILE.dwellMs),
    debounceMs: clamp(num(params.debounce_ms, DEFAULT_PROFILE.debounceMs), 150, 600),
    hintLevel: hints.length ? Math.max(...hints) : DEFAULT_PROFILE.hintLevel,
    optionCount: num(params.option_count, DEFAULT_PROFILE.optionCount),
    targetScale: num(params.target_scale, DEFAULT_PROFILE.targetScale),
    traceTolerance: num(params.trace_tolerance, DEFAULT_PROFILE.traceTolerance),
    breakAfterMin: num(params.break_after_min, DEFAULT_PROFILE.breakAfterMin),
  };
}

const PARAM: Record<string, ParamKey> = {
  key_scale: "keyScale",
  key_spacing: "spacing",
  dwell_time_ms: "dwellMs",
  debounce_ms: "debounceMs",
  target_scale: "targetScale",
  trace_tolerance: "traceTolerance",
  option_count: "optionCount",
  break_after_min: "breakAfterMin",
};
const LOWER_IS_HELP: ParamKey[] = ["optionCount", "breakAfterMin"];

/** Adaptation feed item → the parent's "what changed and why" entry (localized sentence via adapt.* keys). */
export function changeFrom(childId: string, c: BChange): AdaptationChange | null {
  const base = c.param.split(".")[0];
  const param: ParamKey | undefined = PARAM[c.param] ?? (base === "key_scale" ? "keyScale" : base === "hint_level" ? "hintLevel" : undefined);
  if (!param) return null;
  let from = Number(c.old_value);
  let to = Number(c.new_value);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  if (param === "spacing") [from, to] = [Math.round(8 * from), Math.round(8 * to)];
  const moreHelp = LOWER_IS_HELP.includes(param) ? to < from : to > from;
  return { id: c.id, childId, input: "touch", param, from, to, reasonKey: `adapt.${param}.${moreHelp ? "more" : "less"}`, at: c.changed_at };
}

// ---------------------------------------------------------------- telemetry
/**
 * Web interaction event → backend EventIn. Answers and rejected taps become keystrokes (the backend's
 * motor + accuracy signals); geometry only from touch/pen (PRD §9.5.2). Trace points and completions
 * aren't sent (completions go to /activities/complete).
 */
export function eventTo(e: Omit<InteractionEvent, "sessionId">, sessionStartMs: number) {
  const occurred_at = new Date(sessionStartMs + e.t).toISOString();
  const geometry = e.pointerType === "touch" || e.pointerType === "pen" ? e.offsetRatio : undefined;
  const key = { target_key: e.target ?? "?", actual_key: e.actual ?? e.target ?? "?", latency_ms: Math.max(0, e.latencyMs ?? 0) };
  const skill_key = e.levelId ?? null;
  if ((e.type === "select" || e.type === "key") && e.correct !== undefined)
    return { occurred_at, skill_key, payload: { event_type: "keystroke", ...key, correct: e.correct, offset_ratio: geometry ?? null, skill_key } };
  if (e.type === "accidental_tap")
    return { occurred_at, skill_key, payload: { event_type: "keystroke", ...key, correct: false, accidental_tap: true, skill_key } };
  if (e.type === "debounced")
    return { occurred_at, skill_key, payload: { event_type: "keystroke", ...key, correct: false, rejected_by_debounce: true, skill_key } };
  return null;
}

// ---------------------------------------------------------------- school & care
/** A child seen from a class or a therapist link: a parent's child gets a placeholder parent id (the
 *  professional never learns who the parent is); school-managed children have none. */
export function rosterChildFrom(c: BRosterChild): Child {
  return childFrom({
    id: c.id, parent_id: c.school_managed ? null : "family", display_name: c.display_name, learning_language: c.learning_language,
    ui_language: c.ui_language, birth_year: c.birth_year, avatar_id: c.avatar_id, access_mode: c.access_mode, created_at: c.created_at,
  });
}

export const classFrom = (k: BClass, teacherId: string): ClassRoom => ({
  id: k.id, teacherId, name: k.name, grade: k.grade, learningLang: lang(k.learning_language), code: k.join_code, createdAt: k.created_at,
});

/** Assignments (teacher, class) and recommendations (therapist, one child) → the web's Assignment. */
export const taskFrom = (t: BTask, fallbackChild?: string): Assignment | null =>
  t.level_slug
    ? {
        id: t.id, kind: t.kind === "therapist" ? "therapist" : "teacher", byUserId: t.created_by ?? "", classId: t.class_id ?? undefined,
        childId: t.child_id ?? (t.class_id ? undefined : fallbackChild), levelId: t.level_slug, note: t.instructions ?? "",
        due: t.due_at ?? undefined, createdAt: t.created_at,
      }
    : null;

export const careLinkFrom = (l: BCareLink): CareLink => ({
  id: l.id, childId: l.child_id, kind: l.kind === "teacher" ? "teacher" : "therapist", email: l.email,
  professionalId: l.professional_user_id ?? undefined, status: (["invited", "active", "revoked"].includes(l.status) ? l.status : "invited") as CareLink["status"],
  code: l.code, createdAt: l.created_at, revokedAt: l.revoked_at ?? undefined,
});

export const noteFrom = (n: BNote): Note => ({ id: n.id, childId: n.child_id, authorId: n.author_id, text: n.text, visibleToParent: n.visible_to_parent, createdAt: n.created_at });
export const goalFrom = (g: BGoal): Goal => ({ id: g.id, childId: g.child_id, authorId: g.author_id, text: g.text, done: g.done, createdAt: g.created_at });

export interface BNotification { id: string; kind: string; payload: Record<string, string | number> | null; read_at: string | null; created_at: string }
/** Server notice → the bell's entry (localized via notif.<kind>, with the payload as variables). */
export const notificationFrom = (n: BNotification, userId: string): Notification => ({
  id: n.id, userId, titleKey: `notif.${n.kind}`, vars: n.payload ?? {}, read: !!n.read_at, at: n.created_at,
});

export interface BAacCard { id: string; child_id: string; category: string; label: string; emoji: string; created_at: string; has_photo?: boolean; has_audio?: boolean }
export interface BAacSentence { card_ids: string[]; sentence: string; language: string; at: string }
/** `asChild`: the playing child's own device reads media through the child endpoints. */
export function aacCardFrom(c: BAacCard, asChild = false): AacCustomCard {
  const base = asChild ? `/api/v1/aac/cards/${c.id}` : `/api/v1/children/${c.child_id}/aac/cards/${c.id}`;
  return {
    id: c.id, childId: c.child_id, category: c.category, emoji: c.emoji || "⭐", label: c.label, createdAt: c.created_at,
    photo: c.has_photo ? `${base}/photo` : undefined, audio: c.has_audio ? `${base}/audio` : undefined,
  };
}
/** A My Voice card on the new server (A6.8): the photo and voice come as storage links. */
export const voiceCardFrom = (childId: string, c: CardOut): AacCustomCard => ({
  id: c.id, childId, category: c.category, emoji: c.emoji, label: c.label, createdAt: c.createdAt, photo: c.photoUrl ?? undefined, audio: c.audioUrl ?? undefined,
});
/** A spoken sentence; custom card ids get the web's custom: prefix back. */
export const aacEventFrom = (childId: string, s: BAacSentence, k: number): AacEvent => ({
  id: `${childId}-${s.at}-${k}`, childId, cardIds: s.card_ids.map((c) => (AAC_BY_ID[c] ? c : `${CUSTOM_PREFIX}${c}`)), sentence: s.sentence, lang: lang(s.language), at: s.at,
});

// ---------------------------------------------------------------- billing
export interface BOrder { id: string; plan: string; amount_tiyin: number; provider: string; state: string; created_at: string }
export const subscriptionFrom = (userId: string, s?: { plan: string; status: string; paid_until: string | null }): Subscription =>
  !s || s.plan === "free"
    ? { userId, plan: "free", status: "active" }
    : { userId, plan: s.plan === "yearly" ? "yearly" : "monthly", status: (["active", "canceled", "expired"].includes(s.status) ? s.status : "active") as Subscription["status"], until: s.paid_until ?? undefined };
export const orderFrom = (userId: string, o: BOrder): Order => ({
  id: o.id, userId, plan: o.plan === "yearly" ? "yearly" : "monthly", amountTiyin: o.amount_tiyin, provider: o.provider === "click" ? "click" : "payme",
  state: o.state === "paid" ? "paid" : o.state === "canceled" ? "canceled" : "created", createdAt: o.created_at,
});

// ---------------------------------------------------------------- admin console
export interface BAudit { id: string; actor_id: string | null; action: string; resource_type: string; resource_id: string | null; payload: Record<string, unknown> | null; created_at: string }
export interface BAdminSub { user_id: string; plan: string; status: string; paid_until: string | null }
export interface BOverview {
  users: number; children: number; paying: number; sessions_7d: number; ai_questions_by_role: Record<string, number>; ai_questions_by_day: Record<string, number>;
  health: { database: boolean; redis: boolean };
}
/** Audit entry: the diff is the server's payload, shown compactly. */
export const auditFrom = (a: BAudit): AuditLog => ({
  id: a.id, actorId: a.actor_id ?? "", action: a.action, target: a.resource_id ?? a.resource_type,
  diff: a.payload && Object.keys(a.payload).length ? Object.entries(a.payload).map(([k, v]) => `${k}: ${String(v)}`).join(", ") : undefined,
  at: a.created_at,
});


// ---------------------------------------------------------------- therapists (apps/api therapists/, clips/)
export const sharedChildFrom = (c: SharedChild): Child => familyChildFrom({ ...c, familyId: "", color: null });

/** A share or invite of one child, as the parent's Sharing tab lists it. `code` is a link invite's code (once). */
export const shareFrom = (childId: string, l: ShareOut): CareLink => ({
  id: l.id, childId, kind: "therapist", email: "", phone: l.phone ?? undefined, therapistName: l.therapistName ?? undefined,
  professionalId: l.status === "active" ? `therapist-${l.id}` : undefined, status: l.status === "active" ? "active" : "invited",
  code: l.code ?? "", createdAt: l.invitedAt,
});

export const inUseFrom = (u: InUse): NonNullable<DB["answersInUse"]>[string] => ({
  updated: Object.fromEntries(
    Object.entries(u.updatedBy).map(([q, by]) => [q, { value: u.answers[q] as string | string[], name: by.therapistName ?? "", profession: by.profession ?? undefined, at: by.at }]),
  ),
  messages: u.messages.map((m) => ({ text: m.text, name: m.therapistName ?? "", profession: m.profession ?? undefined, at: m.at })),
});

/** Movement (P40) and feedback clips with their links and the therapists' replies. */
export function clipsFrom(childId: string, list: ClipOut[]) {
  return {
    clips: list.map((c) => ({ id: c.id, childId, url: c.url, exerciseId: c.kind === "feedback" ? (c.exerciseId ?? undefined) : undefined })),
    replies: list.flatMap((c) => c.replies.map((r, i) => ({ id: `${c.id}-${i}`, childId, clipId: c.id, therapistId: "", name: r.therapistName ?? "", text: r.text, at: r.at }))),
  };
}
