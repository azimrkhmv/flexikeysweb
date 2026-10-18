// Skill levels and game choice (spec §13). A fixed model, not an AI guess, so every choice can be explained, tested
// and repeated. One number, θ (theta), per area. Never shown to parents as a score (product rule 1).
//
// θ and a game level's difficulty d share one scale: a child with θ = d gets that level right half the time.

import type { Answers } from "@/content/intake";
import type { ActivityKind } from "./types";

export const AREAS = ["access", "attention", "memory", "flexibility", "literacy", "numeracy"] as const;
export type Area = (typeof AREAS)[number];

/** What each kind of game trains (the four placement games: attention, memory, literacy, flexibility). */
export const AREA_OF: Record<ActivityKind, Area> = {
  find_same: "attention", scene: "attention", story: "attention",
  sequence: "memory", missing: "memory", light_path: "memory",
  sort: "flexibility", puzzle: "flexibility", maze: "flexibility",
  listen_pick: "literacy", type: "literacy", sentence: "literacy",
  count: "numeracy",
  path: "access", trace: "access", dots: "access", color: "access", paint: "access",
}; // prettier-ignore

/**
 * The intake's ability answers (0–2 each) that tell about each area. ponytail: a first mapping, to be checked with
 * the physiotherapist; numeracy has no question yet, so it starts in the middle.
 */
export const AREA_QUESTIONS: Record<Area, string[]> = {
  access: ["P23", "P24", "P26"],
  attention: ["P30"],
  memory: ["P19"],
  flexibility: ["P32"],
  literacy: ["P18", "P20", "P21"],
  numeracy: [],
};

/** One bucket step (not yet → with help → yes) on the θ scale. */
export const STEP = 1.5;

/** Difficulty of a world level (1, 2, 3, …): ponytail: evenly spaced; tune once tries show real success rates. */
export const difficulty = (level: number) => (level - 1) * 0.3 - STEP;

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

export interface Game {
  activityId: string;
  kind: ActivityKind;
  level: number;
}
export type Slot = "easy_win" | "growth" | "choice";

/** The level where the child succeeds about `p` of the time: d = θ − ln(p / (1 − p)). */
const levelFor = (theta: number, p: number, games: Game[]) => {
  const want = theta - Math.log(p / (1 - p));
  return games.reduce((best, g) => (Math.abs(difficulty(g.level) - want) < Math.abs(difficulty(best.level) - want) ? g : best));
};

/**
 * At most one new kind of game a week; a game already played is never taken away. `firstPlayed`: the date
 * (YYYY-MM-DD) each kind was first played.
 */
export function weeklyNew(unlocked: Game[], firstPlayed: Map<ActivityKind, string>, today: string): Game[] {
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
  const withGames = AREAS.filter((a) => unlocked.some((g) => AREA_OF[g.kind] === a));
  if (!withGames.length) return [];
  const byTheta = [...withGames].sort((a, b) => theta[b] - theta[a]);
  const pick = (area: Area, p: number) => levelFor(theta[area], p, unlocked.filter((g) => AREA_OF[g.kind] === area));
  const strongest = byTheta[0];
  const weakest = byTheta[byTheta.length - 1];
  return [
    { slot: "easy_win", area: strongest, games: [pick(strongest, 0.85)] },
    { slot: "growth", area: weakest, games: [pick(weakest, 0.75)] },
    { slot: "choice", games: unlocked },
  ];
}
