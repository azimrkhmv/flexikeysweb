// Roadmap engine (spec §8, §13): fixed rules, no AI, no randomness — the same inputs give the same roadmap, and
// every choice comes with a structured reason a therapist can check. Safety rules are hard filters.

import type { Answers } from "@/content/intake";
import { KIT_TOOLS } from "@/content/exercises";
import type { Lang } from "./i18n";
import type { ActivityKind, AgeBand, BodyArea, ExerciseVideo, FnLevel, GoalKey, Restriction, Roadmap, RoadmapDay, RoadmapReason, TherapistInput } from "./types";

export const ROADMAP_DAYS = 28;
export const GAME_LIMIT_MIN = 20;
const GAME_SLOT_MIN = 5;
const P14_TAGS: Restriction[] = ["jumping", "prone", "neck_flexion", "single_leg_weight"];
const GOALS: GoalKey[] = ["walk", "hands", "sit", "communicate", "understand", "eat", "play_others", "school"];
/** P33 "Not sure": start broad and gentle. */
const DEFAULT_GOALS: GoalKey[] = ["hands", "sit", "communicate"];

/** Games that serve each goal (the θ/Elo game choice replaces this in build #8). */
const GOAL_GAMES: Record<GoalKey, ActivityKind[]> = {
  walk: ["path", "light_path"],
  hands: ["trace", "color", "dots"],
  sit: ["find_same", "scene"],
  communicate: ["listen_pick", "sentence"],
  understand: ["missing", "sort", "sequence"],
  eat: ["sort", "find_same"],
  play_others: ["story", "scene"],
  school: ["count", "type", "trace"],
};

export interface PlanInput {
  childId: string;
  round: number;
  /** YYYY-MM-DD */
  birthDate: string;
  startDate: string;
  lang: Lang;
  answers: Answers;
  /** Health consent declined → games and Find help only. */
  healthConsent: boolean;
  therapist?: TherapistInput;
  /** Home Kit tools the family has. Default: the standard box. */
  tools?: readonly string[];
}

/** P12 → GMFCS I–V. "Not sure" stays null (= sitting exercises only until a therapist confirms). */
const P12_GMFCS: Record<string, FnLevel> = { walks: 1, walks_help: 2, walker: 3, wheelchair: 4, needs_help_sit: 5 };

const arr = (v: unknown): string[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" ? v : null);
function mean(...xs: (number | null)[]) {
  const k = xs.filter((x): x is number => x !== null);
  return k.length ? k.reduce((a, b) => a + b, 0) / k.length : null;
}
/** 0–2 ability average → starting difficulty 1–3. Unknown → 1. */
const levelFrom = (score: number | null): 1 | 2 | 3 => (score === null || score < 1 ? 1 : score < 1.7 ? 2 : 3);

export function ageBand(birthDate: string, on: string): AgeBand {
  const b = new Date(birthDate), d = new Date(on);
  let y = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) y--;
  return y <= 4 ? "2-4" : y <= 8 ? "5-8" : y <= 12 ? "9-12" : "13-20";
}

/** Everything the rules need, derived from the answers. Therapist answers win (spec §6). */
export function planFacts(input: PlanInput) {
  const a = input.answers;
  const th = input.therapist;
  const health = input.healthConsent;
  const cp = arr(a.P9).includes("cp");
  const gmfcs: FnLevel | null = th?.gmfcs ?? (health && typeof a.P12 === "string" ? P12_GMFCS[a.P12] ?? null : null);

  const restrictions = new Set<Restriction>(th?.restrictions ?? []);
  // P14: the listed tags; "Not sure" (null) or unanswered → treat every listed restriction as present.
  if (a.P14 === null || a.P14 === undefined) P14_TAGS.forEach((r) => restrictions.add(r));
  else arr(a.P14).forEach((r) => P14_TAGS.includes(r as Restriction) && restrictions.add(r as Restriction));
  if (gmfcs === null || gmfcs >= 4) (["standing", "walking"] as const).forEach((r) => restrictions.add(r));
  if (cp && !th?.legBalanceApproved) restrictions.add("leg_balance");
  // ponytail: "Not sure" on seizures / surgery is read as the cautious answer (safety beats convenience, spec rule 2).
  if (a.P13 !== "never" && a.P13 !== "earlier") restrictions.add("high_intensity");
  if (a.P15 !== "no" && a.P15 !== "yes") restrictions.add("high_intensity");
  if (a.P17 !== "no") restrictions.add("mouth_face");

  const surgery = new Set<BodyArea>(a.P15 === "yes" ? (arr(a.P15_part) as BodyArea[]) : []);
  const parentGoals = arr(a.P33).filter((g): g is GoalKey => GOALS.includes(g as GoalKey));
  const goals = th?.goals.length ? th.goals : parentGoals.length ? parentGoals : DEFAULT_GOALS;
  const minutes = a.P34 === "20" ? 20 : a.P34 === "30" ? 30 : 10; // "Not sure" → the shortest plan

  const hands = levelFrom(mean(num(a.P23), num(a.P24), num(a.P26)));
  const talk = levelFrom(mean(num(a.P20), num(a.P21)));
  const move: 1 | 2 | 3 = gmfcs === null || gmfcs >= 4 ? 1 : gmfcs === 3 ? 2 : 3;
  const startLevel: Record<BodyArea, 1 | 2 | 3> = { hands, arms: hands, legs: move, trunk: move, head_neck: move, mouth_face: talk };

  return { exercisesAllowed: health, gmfcs, restrictions, surgery, goals, minutes, startLevel, band: ageBand(input.birthDate, input.startDate) };
}
export type PlanFacts = ReturnType<typeof planFacts>;

/** Why a video can never be used for this child, or null when it is safe (spec §13 step 2). */
export function exclusionReason(v: ExerciseVideo, f: PlanFacts, lang: Lang, tools: readonly string[], th?: TherapistInput): string | null {
  if (!f.exercisesAllowed) return "no_health_consent";
  if (v.versions[lang]?.status !== "approved") return "not_approved";
  if (v.conflicts.some((c) => f.restrictions.has(c))) return "restriction";
  if (f.surgery.has(v.bodyArea)) return "surgery";
  if (!v.gmfcs.includes(f.gmfcs ?? 5)) return "movement_level";
  if (!v.ages.includes(f.band)) return "age";
  if (v.tool && !tools.includes(v.tool)) return "tool";
  if (th?.exclude.includes(v.id)) return "therapist_excluded";
  return null;
}

const exercisesPerDay = (minutes: number, day: number) => (minutes === 10 ? [1, 2] : minutes === 20 ? [2, 3] : [4, 5])[day % 2];

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function buildRoadmap(input: PlanInput, library: ExerciseVideo[]): Omit<Roadmap, "id" | "createdAt"> {
  const f = planFacts(input);
  const th = input.therapist;
  const tools = input.tools ?? KIT_TOOLS;
  const goalOf = (v: ExerciseVideo) => f.goals.find((g) => v.goals.includes(g));

  const safe = library.filter((v) => exclusionReason(v, f, input.lang, tools, th) === null);
  const easyEnough = safe.filter((v) => v.difficulty <= f.startLevel[v.bodyArea] || th?.assign.includes(v.id));
  const serving = easyEnough.filter((v) => goalOf(v) || th?.assign.includes(v.id));
  const pool = (serving.length ? serving : easyEnough)
    .slice()
    .sort((x, y) => Number(!!th?.assign.includes(y.id)) - Number(!!th?.assign.includes(x.id)) || f.goals.indexOf(goalOf(x) ?? f.goals[0]) - f.goals.indexOf(goalOf(y) ?? f.goals[0]) || x.id.localeCompare(y.id));

  const used = new Map<string, number>();
  const games = [...new Set(f.goals.flatMap((g) => GOAL_GAMES[g]))];
  const gameSlots = Math.min(GAME_LIMIT_MIN, Math.ceil(f.minutes / 2)) / GAME_SLOT_MIN;
  const days: RoadmapDay[] = [];
  let yesterday = new Set<BodyArea>();
  let yesterdayIds = new Set<string>();

  for (let d = 0; d < ROADMAP_DAYS; d++) {
    const want = Math.min(exercisesPerDay(f.minutes, d), pool.length);
    const picked: ExerciseVideo[] = [];
    // Least-used first; avoid yesterday's body areas and repeating an area today; relax only if the pool is too small.
    const rank = (strict: 0 | 1 | 2) =>
      pool
        .filter((v) => !picked.includes(v) && !yesterdayIds.has(v.id))
        .filter((v) => strict < 1 || !yesterday.has(v.bodyArea))
        .filter((v) => strict < 2 || !picked.some((p) => p.bodyArea === v.bodyArea))
        .sort((x, y) => (used.get(x.id) ?? 0) - (used.get(y.id) ?? 0) || pool.indexOf(x) - pool.indexOf(y));
    for (const strict of [2, 1, 0] as const) while (picked.length < want && rank(strict).length) picked.push(rank(strict)[0]);
    picked.forEach((v) => used.set(v.id, (used.get(v.id) ?? 0) + 1));
    yesterday = new Set(picked.map((v) => v.bodyArea));
    yesterdayIds = new Set(picked.map((v) => v.id));
    days.push({
      date: addDays(input.startDate, d),
      exercises: picked.map((v) => ({ videoId: v.id, level: v.difficulty })),
      games: Array.from({ length: gameSlots }, (_, k) => ({ kind: games[(d * gameSlots + k) % games.length], minutes: GAME_SLOT_MIN })),
    });
  }

  const reasons: RoadmapReason[] = [
    ...[...used.keys()].map((id) => {
      const v = pool.find((x) => x.id === id)!;
      return { slot: "exercise" as const, goal: goalOf(v) ?? f.goals[0], ref: id, level: v.difficulty };
    }),
    ...games.map((kind) => ({ slot: "game" as const, goal: f.goals.find((g) => GOAL_GAMES[g].includes(kind))!, ref: kind, level: 1 })),
  ];
  return { childId: input.childId, round: input.round, startDate: input.startDate, days, reasons, exercisesAllowed: f.exercisesAllowed };
}
