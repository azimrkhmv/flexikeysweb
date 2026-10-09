import type { Lang, UiLang } from "./i18n";

export type L10n<T = string> = Record<Lang, T>;

// ---------- Accounts ----------
/** `physio` reviews exercise videos before families see them (spec §8). `teacher` is legacy (hidden). */
export type Role = "parent" | "teacher" | "therapist" | "physio" | "admin";
export type UserStatus = "active" | "pending_verification" | "disabled";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  /** MOCK ONLY — the real backend stores an Argon2id hash, never the password. */
  password: string;
  uiLang: UiLang;
  emailVerified: boolean;
  /** Sign-in is phone + SMS code (spec §4): +998XXXXXXXXX. */
  phone?: string;
  /** City/region and district ids from content/districts.ts (Find help, booking, Home Kit delivery). */
  district?: { region: string; district: string };
  /** Basic consent (account, play data) accepted at sign-up. */
  consentVersion?: string;
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
  /** Optional: how the child moves, sees and communicates, and the access settings adults chose. */
  support?: ChildSupport;
  equipped: { hat?: string; color?: string; bg?: string };
  /** Spec §5 P2/P3/P4 (children made by the intake). birthYear stays for the older screens. */
  birthDate?: string;
  sex?: "boy" | "girl";
  relationship?: "mother" | "father" | "grandparent" | "carer";
  createdAt: string;
}

export type CviColor = "yellow" | "red" | "green" | "blue";

/** Function level I–V of a classification system; undefined = the parent doesn't know. */
export type FnLevel = 1 | 2 | 3 | 4 | 5;
/** Params an adult can set a minimum for — the adaptive engine never goes below it. */
export type FloorKey = "dwellMs" | "debounceMs" | "keyScale" | "targetScale";

export interface ChildSupport {
  /** Hand use (MACS), communication (CFCS), vision (VFCS) — parent-reported, used only for starting settings. */
  macs?: FnLevel;
  cfcs?: FnLevel;
  vfcs?: FnLevel;
  /** No moving or glowing effects (seizures, photosensitivity, vision difficulties). */
  calm?: boolean;
  /**
   * Vision mode for cerebral/cortical visual impairment: calm screen + plain dark background, no mascot, every
   * target outlined in the child's preferred colour, slower "watch" sequences.
   */
  cvi?: { color: CviColor };
  floors?: Partial<Record<FloorKey, number>>;
  /** Switch scanning: ms per item, auto (1 switch) or step (2 switches: Space moves, Enter selects), speak items. */
  scan?: { stepMs: number; mode: "auto" | "step"; speak: boolean };
  /** Hover / eye-gaze "waiting" time in ms. */
  hoverMs?: number;
}

/** `health` gates the exercise roadmap; `movement_videos` gates P40 clips (spec §4). */
export type ConsentScope = "core" | "health" | "movement_videos" | "ai_processing" | "voice_recording" | "school_sharing" | "therapist_sharing";

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
  /** Invites by phone (spec P41); email stays for older invites. */
  phone?: string;
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
  /** The parent's own photo / recorded voice (live: served by the API; demo: in this browser). */
  photo?: string;
  audio?: string;
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

/** Drawing sets imported from the Flutter app (src/content/drawing, scripts/import-flutter-drawing.py). */
export type TraceSet = "letters" | "numbers" | "objects";
export type ColoringSet = "fruits" | "animals" | "nature" | "transport";

/**
 * `optional`: rewarded, but not needed to finish the level (mastery gate) — the drawing activities, so a
 * child who can't draw is never held back and levels already finished stay finished.
 */
export type Activity = (
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
  | { id: string; kind: "story"; pages: { scene: string; text: L10n }[]; question?: SceneRound }
  // Drawing (PRD §9.7) — trace / connect-the-dots use the Flutter stroke data; items: glyph labels or object ids.
  | { id: string; kind: "trace"; set: TraceSet; items: L10n<string[]> }
  | { id: string; kind: "dots"; items: string[] }
  | { id: string; kind: "color"; set: ColoringSet }
  | { id: string; kind: "maze"; size: 3 | 4 | 5; rounds: number }
  | { id: string; kind: "paint" }
) & { optional?: boolean };

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

// ---------- Intake, video library, roadmap (product spec 2026-10-06) ----------
/** "Not sure" is stored as null (spec §5). Everyday abilities: 2 yes · 1 sometimes · 0 not yet. */
export type IntakeValue = string | string[] | number | null;
export type Respondent = "parent" | "therapist" | "together";

export interface IntakeAnswer {
  childId: string;
  /** 1 at sign-up, +1 at every 3-month re-intake. */
  round: number;
  questionId: string;
  value: IntakeValue;
  answeredAt: string;
  respondent: Respondent;
}

export interface IntakeRound {
  childId: string;
  round: number;
  startedAt: string;
  completedAt?: string;
}

/** Things a child must not do. P14 / T6 restrictions plus tags the engine derives (standing, high intensity…). */
export type Restriction = "jumping" | "prone" | "neck_flexion" | "single_leg_weight" | "standing" | "walking" | "high_intensity" | "leg_balance" | "mouth_face";
export type BodyArea = "legs" | "arms" | "hands" | "trunk" | "head_neck" | "mouth_face";
/** P33 goals. */
export type GoalKey = "walk" | "hands" | "sit" | "communicate" | "understand" | "eat" | "play_others" | "school";
export type AgeBand = "2-4" | "5-8" | "9-12" | "13-20";
export type VideoStatus = "generated" | "changes_requested" | "rejected" | "approved";

export interface VideoVersion {
  url: string;
  durationS: number;
  status: VideoStatus;
  approvedBy?: string;
  approvedAt?: string;
  notes: { by: string; text: string; at: string }[];
}

/** One exercise of the AI-generated, physio-approved library (spec §8). */
export interface ExerciseVideo {
  id: string;
  title: L10n;
  bodyArea: BodyArea;
  goals: GoalKey[];
  gmfcs: FnLevel[];
  ages: AgeBand[];
  /** Home Kit tool the exercise uses, or null. */
  tool: string | null;
  difficulty: 1 | 2 | 3;
  conflicts: Restriction[];
  versions: Partial<Record<Lang, VideoVersion>>;
}

/** What a therapist set (T2–T8). Their answers override the parent's (spec §6). */
export interface TherapistInput {
  gmfcs?: FnLevel;
  restrictions: Restriction[];
  goals: GoalKey[];
  assign: string[];
  exclude: string[];
  legBalanceApproved: boolean;
}

export interface RoadmapDay {
  date: string;
  exercises: { videoId: string; level: 1 | 2 | 3 }[];
  games: { kind: ActivityKind; minutes: number }[];
}

/** Structured reasons the rules give for each choice; AI (later) only rewords these. */
export interface RoadmapReason {
  slot: "exercise" | "game";
  goal: GoalKey;
  ref: string;
  level: number;
}

export interface Roadmap {
  id: string;
  childId: string;
  round: number;
  startDate: string;
  /** 28 days. */
  days: RoadmapDay[];
  reasons: RoadmapReason[];
  /** false when health consent was declined: games and Find help only. */
  exercisesAllowed: boolean;
  createdAt: string;
}
