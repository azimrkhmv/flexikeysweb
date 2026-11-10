import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRoadmap, type PlanInput } from "@/lib/roadmap";
import { AREA_OF, AREA_QUESTIONS, AREAS, chooseGames, corrected, difficulty, elo, levelDifficulty, levelFor, openSkillSteps, openTiers, pCorrect, START_FROM, startingTheta, weeklyNew, type Area, type Bucket, type Game } from "@/lib/skill";
import { LEVELS } from "./levels";
import { SKILL_GAMES } from "./skillGames";
import type { TherapistInput } from "@/lib/types";
import { intake as intakeText } from "@/messages/intake";
import { DAILY_QUESTIONS } from "./daily";
import { districtsWithoutLabel, REGIONS } from "./districts";
import { exerciseLibrary, KIT_TOOLS } from "./exercises";
import { STEPS, type Answers } from "./intake";

// Files for the Python backend (TASKS.md, tasks A1.6, A2.3, A3.3, A4.3, A5.5, A6.6), kept next to the code they come from, like
// levels.manifest.json: the backend validates intake answers with intake.json, seeds the exercise library from
// exercises.json, and its roadmap engine must produce exactly the plans in roadmap_cases.json — so the server
// and the app can never disagree. Regenerate with UPDATE_BACKEND=1 npm test, then copy them to the backend.
const BACKEND = new URL("./backend/", import.meta.url);

function check(path: string, value: unknown) {
  const url = new URL(path, BACKEND);
  const json = `${JSON.stringify(value, null, 1)}\n`;
  if (process.env.UPDATE_BACKEND) writeFileSync(url, json);
  expect(readFileSync(url, "utf8"), `${path} is stale — run UPDATE_BACKEND=1 npm test`).toBe(json);
}

const LIB = exerciseLibrary("seed", "2026-10-01T00:00:00Z");
/** Every playable step of the theme worlds: its activity id, kind, world level, area, tier and step. */
const WORLD_GAMES: Game[] = LEVELS.flatMap((l) => l.activities.flatMap((a) => a.steps.map((s) => ({ activityId: a.id, kind: a.kind, level: l.n, area: a.area, tier: s.tier, step: s.step }))));
/** ... and of the skill games (level 0, games spec §2.3), twelve steps each. */
const SKILL_STEPS: Game[] = SKILL_GAMES.flatMap((g) => g.steps.map((s) => ({ activityId: g.id, kind: g.kind, level: 0, area: g.area, tier: s.tier, step: s.step, ...(s.needs ? { needs: s.needs } : {}) })));
const GAMES: Game[] = [...WORLD_GAMES, ...SKILL_STEPS];
/** A step's name in the cases: activity id @ tier . step (a skill game's id is the same for its 12 steps). */
const stepKey = (g: Game) => `${g.activityId}@${g.tier}.${g.step}`;
const TIER_CASES: { top: Partial<Record<Area, number>>; pro: boolean }[] = [
  { top: {}, pro: false },
  { top: {}, pro: true },
  { top: { attention: 3, memory: 2 }, pro: false },
  { top: { attention: 3, memory: 2 }, pro: true },
  { top: { attention: 4, memory: 4, flexibility: 2, reasoning: 3, literacy: 2, numeracy: 4 }, pro: true },
  // B85: Opposite Day's Summit (colour words) needs Language tier 3 as well.
  { top: { flexibility: 4, literacy: 2 }, pro: true },
  { top: { flexibility: 4, literacy: 3 }, pro: true },
];

/** The roadmap in the backend's field names; key order is part of the contract (the hash covers it). */
const canon = (r: ReturnType<typeof buildRoadmap>) =>
  JSON.stringify({
    child_id: r.childId,
    round: r.round,
    start_date: r.startDate,
    days: r.days.map((d) => ({
      date: d.date,
      exercises: d.exercises.map((e) => ({ video_id: e.videoId, level: e.level })),
      games: d.games.map((g) => ({ kind: g.kind, minutes: g.minutes })),
    })),
    reasons: r.reasons.map((x) => ({ slot: x.slot, goal: x.goal, ref: x.ref, level: x.level })),
    exercises_allowed: r.exercisesAllowed,
  });

function roadmapCases() {
  const base: Answers = {
    P9: ["speech_delay"], P12: "walks", P13: "never", P14: ["nothing"], P15: "no", P17: "no",
    P20: 1, P21: 1, P23: 2, P24: 2, P26: 2, P33: ["walk", "hands", "communicate"], P34: "20",
  };
  const input = (answers: Answers, extra: Partial<PlanInput> = {}): PlanInput => ({
    childId: "c1", round: 1, birthDate: "2019-05-01", startDate: "2026-10-12", lang: "uz", answers, healthConsent: true, ...extra,
  });
  const th: TherapistInput = { restrictions: ["jumping", "standing"], goals: ["sit"], assign: ["bunny_hops", "sit_to_stand"], exclude: ["putty_squeeze"], legBalanceApproved: true, gmfcs: 2 };

  const inputs: PlanInput[] = [
    input(base),
    input({ ...base, P34: "10" }),
    input({ ...base, P34: "30" }),
    input({ P33: ["hands"], P34: "20" }, { healthConsent: false }),
    input(base, { lang: "ru", birthDate: "2023-01-15" }),
    input(base, { lang: "en", birthDate: "2012-03-31", round: 2 }),
    input({ ...base, P33: null, P34: null, P23: 0, P24: 0, P26: null }, { tools: ["putty", "cards"] }),
    input({ ...base, P17: "sometimes", P33: ["communicate", "eat", "school"] }, { birthDate: "2008-10-12" }),
    input(base, { therapist: { restrictions: [], goals: ["sit"], assign: [], exclude: [], legBalanceApproved: false } }),
    input({ ...base, P33: ["memory", "attention", "literacy"], P34: "30" }), // B75
    input({ ...base, P33: ["numeracy"] }),
  ];
  // Every 7th of the safety combinations in lib/roadmap.test.ts.
  const p12 = ["walks", "walks_help", "walker", "wheelchair", "needs_help_sit", null];
  const p13 = ["last_year", "earlier", "never", null];
  const p14: (string[] | null)[] = [["nothing"], ["jumping"], ["prone", "neck_flexion"], ["single_leg_weight"], null];
  const p15 = [["no"], ["yes", ["legs"]], ["yes", ["hands", "trunk"]], [null]] as const;
  let n = 0;
  for (const a12 of p12) for (const a13 of p13) for (const a14 of p14) for (const [a15, part] of p15) for (const a9 of [["cp"], ["autism"]]) for (const therapist of [undefined, th]) {
    if (n++ % 7) continue;
    inputs.push(input({ ...base, P9: a9, P12: a12, P13: a13, P14: a14, P15: a15, P15_part: part ? [...part] : undefined, P34: "30" }, { therapist }));
  }
  return inputs.map((i, k) => {
    const out = canon(buildRoadmap(i, LIB));
    // The first few keep the whole plan so a mismatch is readable; the rest only a hash.
    return { input: i, sha256: createHash("sha256").update(out).digest("hex"), ...(k < 3 ? { expected: JSON.parse(out) } : {}) };
  });
}

describe("backend content", () => {
  it("exercise library tags", () => {
    check("exercises.json", {
      kit_tools: KIT_TOOLS,
      exercises: LIB.map(({ id, title, bodyArea, goals, gmfcs, ages, tool, difficulty, conflicts }) => ({ id, title, body_area: bodyArea, goals, gmfcs, ages, tool, difficulty, conflicts })),
    });
  });

  it("intake questions", () => {
    check(
      "intake.json",
      STEPS.flatMap((s) =>
        s.questions.map((q) => ({
          id: q.id, kind: q.kind, options: q.options ?? null, required: q.required, max: q.max ?? null, exclusive: q.exclusive ?? null,
          show_if: q.showIf?.dep ?? null,
          step: s.id,
          // Steps the wizard hides without the health consent; `health` = section B answers (stored encrypted).
          health_step: !!s.health,
          health: /^P(9|1[0-7])(_|$)/.test(q.id),
        })),
      ),
    );
  });

  it("daily questions", () => {
    const text = (key: string) => ({ uz: intakeText.uz[key as keyof typeof intakeText.uz], ru: intakeText.ru[key as keyof typeof intakeText.ru], en: intakeText.en[key as keyof typeof intakeText.en] });
    const options = [2, 1, 0].map((value) => ({ value, label: text(`intake.ability.${value}`) }));
    check("daily.json", DAILY_QUESTIONS.map((q) => ({ id: q.id, updates: q.updates, text: text(`daily.${q.id}`), options })));
  });

  it("skill model parity cases", () => {
    const answers = [{}, { P23: 2, P24: 1, P26: 0, P19: 2, P30: 0, P32: 1, P18: 2, P20: 1, P21: 0 }, { P23: 0, P19: 1, P20: 2 }];
    const therapist = [{}, { P19: 0, P23: 2 }];
    const buckets: Bucket[] = ["not_yet", "with_help", "yes"];
    check("skill_cases.json", {
      area_of: AREA_OF,
      area_questions: AREA_QUESTIONS,
      start_from: START_FROM,
      // Games spec §3.1: difficulty from tier and step; old tries keep the world-level formula (`elo` below).
      difficulty: [1, 2, 3, 4].flatMap((tier) => [1, 2, 3].map((step) => ({ tier, step, d: difficulty(tier, step) }))),
      level_for: [-2.5, -1, 0, 0.4, 1.3, 2.2, 4].flatMap((theta) => [0.85, 0.75].map((p) => ({ theta, p, out: levelFor(theta, p, WORLD_GAMES.filter((g) => g.area === "attention")).activityId }))),
      elo_step: [-1, 0.8].flatMap((theta) => [[1, 1], [2, 3], [4, 3]].flatMap(([tier, step]) => [true, false].map((correct) => ({ theta, n: 3, tier, step, correct, out: elo(theta, 3, difficulty(tier, step), correct) })))),
      starting: answers.flatMap((parent) => therapist.flatMap((th) => AREAS.map((area) => ({ area, parent, therapist: th, theta: startingTheta(area, parent, th) })))),
      corrected: [-2, -1.5, -0.4, 0, 0.7, 1.5, 3].flatMap((theta) => buckets.map((bucket) => ({ theta, bucket, out: corrected(theta, bucket) }))),
      choose: [
        { theta: { access: 1, attention: -0.5, memory: 0.2, flexibility: -1, reasoning: -1, literacy: 0, numeracy: -3, speed: -0.5 }, upTo: 6 },
        { theta: { access: -1, attention: 2, memory: 0, flexibility: 0, reasoning: 0.5, literacy: 1.2, numeracy: 0, speed: 2 }, upTo: 20 },
      ].map(({ theta, upTo }) => {
        const unlocked = WORLD_GAMES.filter((g) => g.level <= upTo);
        return { theta, unlocked: unlocked.map((g) => g.activityId), out: chooseGames(theta as Record<Area, number>, unlocked).map((s) => ({ slot: s.slot, area: s.area ?? null, games: s.games.map((g) => g.activityId) })) };
      }),
      weekly: [
        { played: { find_same: "2026-09-01" }, today: "2026-10-01" },
        { played: { find_same: "2026-09-01", missing: "2026-09-28" }, today: "2026-10-01" },
        { played: { find_same: "2026-09-01", missing: "2026-09-28" }, today: "2026-10-06" },
      ].map(({ played, today }) => ({
        played, today,
        out: weeklyNew(WORLD_GAMES.filter((g) => g.level <= 4), new Map(Object.entries(played)) as Map<Game["kind"], string>, today).map((g) => g.activityId),
      })),
      // Games spec §3.2-3.3 (B83): tiers open by success, Seed is free, today's choice takes the open skill steps.
      open_tiers: [1, 2, 3, 4].flatMap((top) => [-1, 1, 1.1, 2.3, 3.5, 6].flatMap((theta) => [19, 20].map((clean) => ({ top, theta, clean, out: openTiers(top, theta, clean) })))),
      open_steps: TIER_CASES.map(({ top, pro }) => ({ top, pro, out: openSkillSteps(SKILL_STEPS, top, pro).map(stepKey) })),
      choose_skill: TIER_CASES.map(({ top, pro }, k) => {
        const theta = k % 2 ? { access: 0, attention: 2.5, memory: -1, flexibility: 0.3, reasoning: 1, literacy: 0, numeracy: 1.8, speed: 0 } : { access: 1, attention: -0.5, memory: 0.2, flexibility: -1, reasoning: -1, literacy: 0, numeracy: -3, speed: -0.5 };
        const unlocked = [...WORLD_GAMES.filter((g) => g.level <= 6), ...openSkillSteps(SKILL_STEPS, top, pro)];
        return { theta, top, pro, up_to: 6, out: chooseGames(theta as Record<Area, number>, unlocked).map((s) => ({ slot: s.slot, area: s.area ?? null, games: s.games.map(stepKey) })) };
      }),
      elo: [-1, 0, 0.8].flatMap((theta) => [0, 7, 40].flatMap((n) => [1, 6, 15].flatMap((level) => [true, false].map((correct) => ({ theta, n, level, correct, d: levelDifficulty(level), p: pCorrect(theta, levelDifficulty(level)), out: elo(theta, n, levelDifficulty(level), correct) }))))),
    });
  });

  it("games", () => {
    // One row per step (games spec §2.3).
    check("games.json", GAMES.map((g) => ({ activity_id: g.activityId, kind: g.kind, level: g.level, area: g.area, tier: g.tier, step: g.step, ...(g.needs ? { needs_area: g.needs.area, needs_tier: g.needs.tier } : {}) })));
  });

  it("regions and districts", () => {
    check("districts.json", REGIONS.map((r) => ({ id: r.id, districts: r.districts })));
    expect(districtsWithoutLabel()).toEqual([]); // Russian and English names for every district (B59)
  });
  it("roadmap parity cases", () => {
    check("roadmap_cases.json", { library: LIB, cases: roadmapCases() });
  });
});
