import type { Lang } from "./i18n";

export type L10n<T = string> = Record<Lang, T>;

// ---------- Accounts ----------
export type Role = "parent" | "teacher" | "therapist" | "admin";
export type UserStatus = "active" | "pending_verification" | "disabled";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  /** MOCK ONLY — the real backend stores an Argon2id hash, never the password. */
  password: string;
  uiLang: Lang;
  emailVerified: boolean;
  createdAt: string;
}

// ---------- Children ----------
/** How the child selects things (design: 4 input methods; physical keyboard always works). */
export type AccessMode = "touch" | "dwell" | "scan";
export type InputProfile = "touch" | "pointer" | "keyboard";

export interface Child {
  id: string;
  /** null = school‑managed profile (created by a teacher, no parent account). */
  parentId: string | null;
  name: string;
  birthYear: number;
  learningLang: Lang;
  uiLang: Lang;
  avatar: string;
  access: AccessMode;
  equipped: { hat?: string; color?: string; bg?: string };
  createdAt: string;
}

export type ConsentScope = "core" | "ai_processing" | "voice_recording" | "school_sharing" | "therapist_sharing";

export interface Consent {
  id: string;
  childId: string;
  scope: ConsentScope;
  version: string;
  grantedBy: string;
  grantedAt: string;
  withdrawnAt?: string;
}

// ---------- Adaptive ----------
export interface AdaptiveProfile {
  keyScale: number; // 1.0 – 1.6 multiplier on the 76px base key
  spacing: number; // px gap between keys/targets
  dwellMs: number; // press‑and‑hold before accept (0 = plain tap)
  debounceMs: number; // repeated presses inside this window are ignored
  hintLevel: number; // 0 none · 1 highlight · 2 pulse + arrow · 3 audio prompt
  optionCount: number; // how many choices in Prompt & Options activities (2–4)
  targetScale: number; // size multiplier for non‑keyboard targets
  traceTolerance: number; // px distance accepted from a tracing path
  breakAfterMin: number; // suggest a break after N minutes
}

export type ParamKey = keyof AdaptiveProfile;

export interface ProfileRecord {
  childId: string;
  input: InputProfile;
  params: AdaptiveProfile;
  version: number;
  /** Hysteresis: last direction per param, blocks the opposite direction for `left` sessions, then expires. */
  lastDir: Partial<Record<ParamKey, { dir: 1 | -1; left: number }>>;
  updatedAt: string;
}

export interface AdaptationChange {
  id: string;
  childId: string;
  input: InputProfile;
  param: ParamKey;
  from: number;
  to: number;
  /** i18n key under `adapt.*` — plain‑language explanation for adults. */
  reasonKey: string;
  at: string;
}

// ---------- Sessions & telemetry ----------
export interface LearningSession {
  id: string;
  childId: string;
  input: InputProfile;
  platform: "web";
  startedAt: string;
  endedAt?: string;
  minutes?: number;
  activities: number;
}

export type EventType = "select" | "key" | "accidental_tap" | "debounced" | "hint_shown" | "trace_point" | "item_completed";

export interface InteractionEvent {
  sessionId: string;
  t: number; // ms since session start
  type: EventType;
  levelId?: string;
  activityId?: string;
  target?: string;
  actual?: string;
  correct?: boolean;
  latencyMs?: number;
  /** Distance from target center divided by target size (touch/pen only). */
  offsetRatio?: number;
  pointerType?: "touch" | "pen" | "mouse" | "keyboard" | "switch";
}

export interface SkillMastery {
  childId: string;
  skill: string; // level id
  pKnown: number; // 0..1
  attempts: number;
  updatedAt: string;
}

export interface LevelProgress {
  childId: string;
  levelId: string;
  completed: string[]; // activity ids
  stars: number;
}

export interface Wallet {
  childId: string;
  coins: number;
  stars: number;
  owned: string[];
}

// ---------- School / care ----------
export interface ClassRoom {
  id: string;
  teacherId: string;
  name: string;
  grade: string;
  learningLang: Lang;
  code: string;
  createdAt: string;
}

export interface Enrollment {
  classId: string;
  childId: string;
}

export interface Assignment {
  id: string;
  kind: "teacher" | "therapist";
  byUserId: string;
  classId?: string;
  childId?: string;
  levelId: string;
  note: string;
  due?: string;
  createdAt: string;
}

export interface CareLink {
  id: string;
  childId: string;
  kind: "therapist" | "teacher";
  email: string;
  professionalId?: string;
  status: "invited" | "active" | "revoked";
  code: string;
  createdAt: string;
  revokedAt?: string;
}

export interface Note {
  id: string;
  childId: string;
  authorId: string;
  text: string;
  visibleToParent: boolean;
  createdAt: string;
}

export interface Goal {
  id: string;
  childId: string;
  authorId: string;
  text: string;
  done: boolean;
  createdAt: string;
}

// ---------- AAC ----------
export interface AacCard {
  id: string;
  category: string;
  emoji: string;
  label: L10n;
  core?: boolean;
}

export interface AacCustomCard {
  id: string;
  childId: string;
  category: string;
  emoji: string;
  label: string;
  createdAt: string;
}

export interface AacEvent {
  id: string;
  childId: string;
  cardIds: string[];
  sentence: string;
  lang: Lang;
  at: string;
}

// ---------- Misc ----------
export interface Notification {
  id: string;
  userId: string;
  titleKey: string;
  vars?: Record<string, string | number>;
  read: boolean;
  at: string;
}

export type Plan = "free" | "monthly" | "yearly";

export interface Subscription {
  userId: string;
  plan: Plan;
  status: "active" | "canceled" | "expired";
  until?: string;
}

export interface Order {
  id: string;
  userId: string;
  plan: Exclude<Plan, "free">;
  amountTiyin: number;
  provider: "payme" | "click";
  state: "created" | "paid" | "canceled";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  action: string;
  target: string;
  diff?: string;
  at: string;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
  description: string;
}

export interface AiMessage {
  id: string;
  userId: string;
  childId?: string;
  role: "user" | "assistant";
  text: string;
  at: string;
}

// ---------- Content ----------
export interface VocabItem {
  id: string;
  emoji?: string;
  /** Hex swatch for colors. */
  color?: string;
  /** SVG shape name for shapes. */
  shape?: "circle" | "square" | "triangle" | "star" | "heart" | "rectangle";
  /** Drawn picture for things with no widely supported emoji (Emoji ≥13 shows as a blank box on older devices). */
  art?: "toothbrush";
  /** Big glyph for numbers/letters. */
  glyph?: string;
  word: L10n;
}

export interface SceneRound {
  scene: string; // emoji composition shown large
  prompt: L10n;
  options: string[]; // vocab ids
  answer: string;
}

export type Activity =
  | { id: string; kind: "find_same"; items: string[] }
  | { id: string; kind: "listen_pick"; items: string[] }
  | { id: string; kind: "count"; items: string[]; max: number }
  | { id: string; kind: "sort"; groups: { label: L10n; icon: string; items: string[] }[] }
  | { id: string; kind: "sequence"; items: string[]; length: number }
  | { id: string; kind: "missing"; items: string[] }
  | { id: string; kind: "light_path"; length: number }
  | { id: string; kind: "path"; shape: "wave" | "hill" | "zigzag" | "loop" }
  | { id: string; kind: "scene"; rounds: SceneRound[] }
  | { id: string; kind: "puzzle"; item: string; grid: 2 | 3 }
  | { id: string; kind: "type"; mode: "letter" | "word" | "listen"; words: L10n<string[]> }
  | { id: string; kind: "sentence"; sentences: L10n<string[]> }
  | { id: string; kind: "story"; pages: { scene: string; text: L10n }[]; question?: SceneRound };

export type ActivityKind = Activity["kind"];

export interface Level {
  id: string;
  n: number;
  emoji: string;
  title: L10n;
  color: "sky" | "leaf" | "sun" | "lavender" | "teal" | "peach";
  activities: Activity[];
}

export type MascotMood = "calm" | "happy" | "curious" | "sleepy" | "wave" | "thinking" | "celebrate";
