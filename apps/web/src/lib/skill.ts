// Skill levels and game choice (spec §13). A fixed model, not an AI guess, so every choice can be explained, tested
// and repeated. One number, θ (theta), per area. Parents and therapists see it as a level 1–100 (rule 1, 8 Nov 2026);
// the child never sees a number.
//
// θ and a step's difficulty d share one scale: a child with θ = d gets that step right half the time.

import type { Answers } from "@/content/intake";
import type { GameKind } from "./types";

/**
 * The skill areas (games spec 8 Nov 2026, §2.1). `literacy` and `numeracy` keep their stored names; people see
 * "Language" and "Math". `access` stays in the model but is a setting, never shown as a skill.
 */
export const AREAS = ["access", "attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed"] as const;
export type Area = (typeof AREAS)[number];
/** The areas people see, in the order they are shown (access never is; speed only when `speedOpen`). */
export const SHOWN_AREAS = ["attention", "memory", "flexibility", "reasoning", "literacy", "numeracy", "speed"] as const satisfies readonly Area[];

/** What each kind of game trains (the four placement games: attention, memory, literacy, flexibility). */
export const AREA_OF: Record<GameKind, Area> = {
  find_same: "attention", scene: "attention", story: "attention",
  odd_one_out: "attention", track_fish: "attention", which_way: "attention",
  sequence: "memory", missing: "memory", light_path: "memory",
  card_pairs: "memory", shopping_list: "memory", n_back: "memory", pairs_recall: "memory",
  sort: "flexibility", maze: "flexibility",
  switch_sort: "flexibility", opposite: "flexibility", secret_rule: "flexibility",
  puzzle: "reasoning",
  next_pattern: "reasoning", balance: "reasoning", pipes: "reasoning", logic_houses: "reasoning", shadow_match: "reasoning",
  more_less: "numeracy", number_line: "numeracy", bazaar: "numeracy", missing_number: "numeracy",
  rhyme: "literacy", word_builder: "literacy", do_what_i_say: "literacy",
  listen_pick: "literacy", type: "literacy", sentence: "literacy",
  count: "numeracy",
  quick_snap: "speed", tap_star: "speed", fast_sort: "speed",
  path: "access", trace: "access", dots: "access", color: "access", paint: "access",
}; // prettier-ignore

/**
 * The intake's ability answers (0–2 each) that tell about each area. ponytail: a first mapping, to be checked with
 * the physiotherapist; numeracy has no question yet, so it starts in the middle. Reasoning and speed have no
 * question: they start from another area's θ (START_FROM).
 */
export const AREA_QUESTIONS: Record<Area, string[]> = {
  access: ["P23", "P24", "P26"],
  attention: ["P30"],
  memory: ["P19"],
  flexibility: ["P32"],
  reasoning: [],
  literacy: ["P18", "P20", "P21"],
  numeracy: [],
  speed: [],
};

/** A new area with no intake question starts at the child's current θ of this area (games spec §2.1). */
export const START_FROM: Partial<Record<Area, Area>> = { reasoning: "flexibility", speed: "attention" };

/** One bucket step (not yet → with help → yes) on the θ scale. */
export const STEP = 1.5;

export type Tier = 1 | 2 | 3 | 4;
export type StepN = 1 | 2 | 3;
/** The four tiers of every area (games spec §3): Seed, Sprout, Tree, Summit. */
export const TIERS = ["seed", "sprout", "tree", "summit"] as const;

/** Difficulty of a step: 12 evenly spaced steps from Seed 1 (−1.5) to Summit 3 (2.9). */
export const difficulty = (tier: number, step: number) => ((tier - 1) * 3 + (step - 1)) * 0.4 - STEP;

/** The old difficulty of a world level (1, 2, 3, …), for tries that have only a level. */
export const levelDifficulty = (level: number) => (level - 1) * 0.3 - STEP;

/** A try's difficulty: from its tier and step when it has both, else from its world level (old tries). */
export const tryDifficulty = (t: { level: number; tier?: number | null; step?: number | null }) =>
  t.tier && t.step ? difficulty(t.tier, t.step) : levelDifficulty(t.level);

/** 1. The first guess from the intake: answers 0–2 give −1.5…+1.5; a therapist's answers count twice. */
export function startingTheta(area: Area, parent: Answers, therapist: Answers = {}): number {
  let sum = 0;
  let weight = 0;
  for (const q of AREA_QUESTIONS[area])
    for (const [answers, w] of [[parent, 1], [therapist, 2]] as const) {
      const v = answers[q];
      if (typeof v === "number") {
        sum += v * w;
        weight += w;
      }
    }
  return weight ? (sum / weight) * STEP - STEP : 0;
}

export type Bucket = "not_yet" | "with_help" | "yes";
const BUCKET_THETA: Record<Bucket, number> = { not_yet: -STEP, with_help: 0, yes: STEP };

/** 2. Corrected by the play check: the play check wins, but moves the guess by one step at most. */
export const corrected = (theta: number, bucket: Bucket) => theta + Math.max(-STEP, Math.min(STEP, BUCKET_THETA[bucket] - theta));

/** P(correct) = 1 / (1 + e^−(θ − d)). */
export const pCorrect = (theta: number, d: number) => 1 / (1 + Math.exp(-(theta - d)));

/** 3. After every clean try: θnew = θ + K × (correct − P(correct)), K = 1 / (1 + 0.05 × n). */
export function elo(theta: number, n: number, d: number, correct: boolean): number {
  const k = 1 / (1 + 0.05 * n);
  return theta + k * ((correct ? 1 : 0) - pCorrect(theta, d));
}

/** One playable step: a theme-world activity (one step each) or one of a skill game's 12 steps. */
export interface Game {
  activityId: string;
  kind: string;
  /** The theme world's number (opening worlds, FREE_LEVELS); 0 for skill games. */
  level: number;
  area: Area;
  tier: Tier;
  step: StepN;
  /** A step offered only once this tier of another area is open (games spec §6.3). */
  needs?: { area: Area; tier: number };
}
export type Slot = "easy_win" | "growth" | "choice";

/** The step where the child succeeds about `p` of the time: d = θ − ln(p / (1 − p)); a tie keeps the first. */
export const levelFor = (theta: number, p: number, games: Game[]) => {
  const want = theta - Math.log(p / (1 - p));
  const off = (g: Game) => Math.abs(difficulty(g.tier, g.step) - want);
  return games.reduce((best, g) => (off(g) < off(best) ? g : best));
};

/** A tier opens at this chance of success on the last step of the tier below (games spec §3.2) … */
export const TIER_P = 0.85;
/** … after this many clean tries in the area since that tier opened. */
export const TIER_TRIES = 20;
/** Seed is free in every area; Sprout, Tree and Summit are Pro (decision 8 Nov 2026). */
export const FREE_TIER = 1;

/**
 * Tiers open by success, never by age (games spec §3.2). `top`: the highest open tier of the area (1 = only Seed);
 * `cleanSince`: the area's clean tries since that tier opened. Gives the new top tier: one more when θ gives at least
 * 85% on the top tier's last step and there were 20 clean tries, else the same. It never goes down.
 */
export function openTiers(top: number, theta: number, cleanSince: number): number {
  return top < 4 && cleanSince >= TIER_TRIES && pCorrect(theta, difficulty(top, 3)) >= TIER_P ? top + 1 : top;
}

/** A step that needs another area's tier (Opposite Day's colour words need Language tier 3): is that tier open? */
export const needsMet = (needs: { area: Area; tier: number } | undefined, top: Partial<Record<Area, number>>) => !needs || (top[needs.area] ?? 1) >= needs.tier;

/** The skill-game steps the child may play: in an open tier of their area, and above Seed only with Pro. */
export function openSkillSteps<G extends { area: Area; tier: number; needs?: { area: Area; tier: number } }>(steps: G[], top: Partial<Record<Area, number>>, pro: boolean): G[] {
  return steps.filter((g) => g.tier <= (top[g.area] ?? 1) && (pro || g.tier <= FREE_TIER) && needsMet(g.needs, top));
}

// ---------------------------------------------------------------- Speed (games spec §7)

/** Speed is judged on this many of the child's latest tries (about 3 sessions) … */
export const SPEED_TRIES = 30;
/** … and opens only while access events are under this share of them. */
export const SPEED_ACCESS_SHARE = 0.1;

/**
 * Who gets Speed (§7.1): only a child who plays by touch, with no repeat guard, who may let go of a target, and whose
 * access events are under 10% of their latest 30 or more tries. `recent`: whether each of the latest tries was an
 * access event. No access settings yet (no play check) = no Speed. Closed again later: Speed hides, its θ is kept.
 */
export function speedOpen(access: { inputMode: string; repeatLock: boolean; releaseOk: boolean } | null | undefined, recent: boolean[]): boolean {
  if (!access || access.inputMode !== "touch" || access.repeatLock || !access.releaseOk) return false;
  return recent.length >= SPEED_TRIES && recent.filter(Boolean).length < SPEED_ACCESS_SHARE * recent.length;
}

/**
 * The time to answer one Speed item, in ms (§7.2): Seed 3000, Sprout 2000, Tree 1300, Summit 800 at each tier's first
 * step, the steps between spread evenly towards the next tier. Summit stays at 800: never faster.
 */
export const SPEED_WINDOW_MS = [
  [3000, 2667, 2333],
  [2000, 1767, 1533],
  [1300, 1133, 967],
  [800, 800, 800],
] as const;
export const speedWindow = (tier: number, step: number) => SPEED_WINDOW_MS[tier - 1][step - 1];

/** A Speed try counts as correct only when the answer is right and came within its step's window (§7.2). */
export const speedCorrect = (correct: boolean, responseMs: number | null | undefined, tier: number | null | undefined, step: number | null | undefined) =>
  correct && (!tier || !step || (responseMs != null && responseMs <= speedWindow(tier, step)));

/** Speed closed: its games are in no slot and not in the Skill games tab (§7.1). */
export const withSpeed = <G extends { area: Area }>(games: G[], open: boolean) => (open ? games : games.filter((g) => g.area !== "speed"));

// ---------------------------------------------------------------- Progress panel (games spec §8)

/** The level parents and therapists see (rule 1): θ −3 … 4.5 becomes 1 … 100. The plan reads the same θ. */
export const skillLevel = (theta: number) => Math.min(100, Math.max(1, Math.round(((theta + 3) / 7.5) * 99) + 1));
/** Under this many clean tries an area says "Not enough games yet" instead of a level (§8.1). */
export const LEVEL_TRIES = 10;
export const shownLevel = (theta: number, n: number) => (n >= LEVEL_TRIES ? skillLevel(theta) : null);
/** Weeks in the history line, and how far back "4 weeks ago" is. */
export const HISTORY_WEEKS = 8;
export const BEFORE_WEEKS = 4;
/** "Can do now" (§8.2): the hardest step with at least 3 right clean tries in the last 14 days. */
export const CAN_DO_DAYS = 14;
export const CAN_DO_RIGHT = 3;

const DAY_MS = 86_400_000;
const TASHKENT_MS = 5 * 3_600_000; // UTC+5 all year

/** Monday (YYYY-MM-DD) of the week this moment falls in, Tashkent time. */
export function weekStart(ts: string): string {
  const t = new Date(Date.parse(ts) + TASHKENT_MS);
  return new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
}
const addDays = (day: string, n: number) => new Date(Date.parse(day) + n * DAY_MS).toISOString().slice(0, 10);

export interface StepRef {
  activityId: string;
  tier: number;
  step: number;
}
export interface Snapshot {
  weekStart: string;
  theta: number;
  n: number;
  top: StepRef | null;
}

/**
 * The hardest step with at least 3 right tries (§8.2). `tries`: the area's clean skill-game tries of the last 14 days,
 * `correct` already judged (Speed by its window). Same tier and step: more right tries first, then the activity id.
 */
export function topStep(tries: { activityId: string; tier: number; step: number; correct: boolean }[]): StepRef | null {
  const right = new Map<string, StepRef & { n: number }>();
  for (const t of tries) {
    if (!t.correct) continue;
    const key = `${t.activityId}@${t.tier}.${t.step}`;
    const row = right.get(key) ?? { activityId: t.activityId, tier: t.tier, step: t.step, n: 0 };
    row.n += 1;
    right.set(key, row);
  }
  const best = [...right.values()]
    .filter((r) => r.n >= CAN_DO_RIGHT)
    .sort((a, b) => b.tier - a.tier || b.step - a.step || b.n - a.n || (a.activityId < b.activityId ? -1 : a.activityId > b.activityId ? 1 : 0))[0];
  return best ? { activityId: best.activityId, tier: best.tier, step: best.step } : null;
}

/** The area's snapshot in force in this week: its own, or the latest before it (θ moves only with tries). */
export const snapshotAt = (snaps: Snapshot[], week: string) => snaps.filter((s) => s.weekStart <= week).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0] ?? null;

/**
 * The history line (§8.2): the 8 weeks up to this one, oldest first, each with its level; null before the first
 * snapshot or while there were under 10 clean tries. `before`: what the child could do 4 weeks ago.
 */
export function history(snaps: Snapshot[], thisWeek: string): { weeks: { weekStart: string; level: number | null }[]; before: StepRef | null } {
  const weeks = Array.from({ length: HISTORY_WEEKS }, (_, k) => {
    const week = addDays(thisWeek, (k - HISTORY_WEEKS + 1) * 7);
    const s = snapshotAt(snaps, week);
    return { weekStart: week, level: s ? shownLevel(s.theta, s.n) : null };
  });
  return { weeks, before: snapshotAt(snaps, addDays(thisWeek, -BEFORE_WEEKS * 7))?.top ?? null };
}

/**
 * One card of the progress panel (§8), as GET /children/{id}/progress gives it: the level now (null = "Not enough
 * games yet"), the highest ever, the last 8 weeks, what the child can do now and 4 weeks ago, the open tier; for a
 * therapist also the tries and access events of the last 4 weeks.
 */
export interface AreaProgress {
  area: Area;
  level: number | null;
  best: number | null;
  weeks: { weekStart: string; level: number | null }[];
  now: StepRef | null;
  before: StepRef | null;
  topTier: number;
  tries?: number;
  accessEvents?: number;
}

/** The highest level an area ever showed (the child's tree grows from it and never shrinks, §8.5). */
export const bestLevel = (snaps: Snapshot[], now: number | null) =>
  snaps.reduce<number | null>((best, s) => {
    const l = shownLevel(s.theta, s.n);
    return l !== null && (best === null || l > best) ? l : best;
  }, now);

/**
 * At most one new kind of game a week; a game already played is never taken away. `firstPlayed`: the date
 * (YYYY-MM-DD) each kind was first played. A new tier of a kind already played is not a new kind.
 */
export function weeklyNew<G extends { kind: string }>(unlocked: G[], firstPlayed: Map<string, string>, today: string): G[] {
  const weekAgo = new Date(Date.parse(today) - 7 * 86_400_000).toISOString().slice(0, 10);
  const newThisWeek = [...firstPlayed.values()].some((d) => d > weekAgo);
  const fresh = unlocked.find((g) => !firstPlayed.has(g.kind));
  return unlocked.filter((g) => firstPlayed.has(g.kind) || (!newThisWeek && g.kind === fresh?.kind));
}

/**
 * Three game slots for a session: an easy win from the strongest area (about 85% success), growth from the weakest
 * area that has a game (about 75%), and the child's own choice of any unlocked game.
 */
export function chooseGames(theta: Record<Area, number>, unlocked: Game[]): { slot: Slot; area?: Area; games: Game[] }[] {
  const withGames = AREAS.filter((a) => unlocked.some((g) => g.area === a));
  if (!withGames.length) return [];
  const byTheta = [...withGames].sort((a, b) => theta[b] - theta[a]);
  const pick = (area: Area, p: number) => levelFor(theta[area], p, unlocked.filter((g) => g.area === area));
  const strongest = byTheta[0];
  const weakest = byTheta[byTheta.length - 1];
  return [
    { slot: "easy_win", area: strongest, games: [pick(strongest, 0.85)] },
    { slot: "growth", area: weakest, games: [pick(weakest, 0.75)] },
    { slot: "choice", games: unlocked },
  ];
}
