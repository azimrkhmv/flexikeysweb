// Pure mappings between the FastAPI backend's shapes and the web's types (lib/types.ts). All the places
// where the two differ live here, so the rest of the app never sees backend field names.

import { AAC_BY_ID, CUSTOM_PREFIX } from "@/content/aac";
import { DEFAULT_PROFILE } from "@/lib/adaptive";
import type { Lang } from "@/lib/translate";
import type { ChildSupport,
  AacCustomCard, AacEvent, AccessMode, AuditLog, AdaptationChange, AdaptiveProfile, Assignment, CareLink, Child, ClassRoom, Consent, ConsentScope, Goal,
  InteractionEvent, LearningSession, LevelProgress, Note, Notification, Order, ParamKey, Role, SkillMastery, Subscription, User, UserStatus,
} from "@/lib/types";

// ---------------------------------------------------------------- backend shapes (subset we read)
export interface BUser { id: string; email: string | null; display_name: string | null; role: string; status?: string; locale: string; email_verified: boolean; created_at: string }
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
export function userFrom(u: BUser): User {
  return {
    id: u.id,
    email: u.email ?? "",
    name: u.display_name ?? u.email?.split("@")[0] ?? "",
    role: (["parent", "teacher", "therapist", "admin"].includes(u.role) ? u.role : "parent") as Role,
    status: ({ pending: "pending_verification", disabled: "disabled" }[u.status ?? ""] ?? "active") as UserStatus,
    password: "",
    uiLang: lang(u.locale),
    emailVerified: u.email_verified,
    createdAt: u.created_at,
  };
}

export function childFrom(c: BChild): Child {
  const eq = c.equipped ?? {};
  return {
    id: c.id,
    parentId: c.parent_id,
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

