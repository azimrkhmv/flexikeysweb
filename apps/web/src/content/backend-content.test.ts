import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildRoadmap, type PlanInput } from "@/lib/roadmap";
import type { TherapistInput } from "@/lib/types";
import { exerciseLibrary, KIT_TOOLS } from "./exercises";
import { STEPS, type Answers } from "./intake";

// Files for the Python backend (TASKS.md, tasks A2.3, A3.3, A4.3), kept next to the code they come from, like
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

  it("roadmap parity cases", () => {
    check("roadmap_cases.json", { library: LIB, cases: roadmapCases() });
  });
});
