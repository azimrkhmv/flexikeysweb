import { describe, expect, it } from "vitest";
import { exerciseLibrary } from "@/content/exercises";
import type { Answers } from "@/content/intake";
import { buildRoadmap, ROADMAP_DAYS, type PlanInput } from "./roadmap";
import type { ExerciseVideo, Restriction, TherapistInput } from "./types";

// Spec §16 build #4: "nothing that conflicts with P13–P15 or restrictions can ever be selected (covered by
// tests); same inputs give the same roadmap".

const LIB = exerciseLibrary("u_physio", "2026-10-01T00:00:00Z");
const BY_ID = new Map(LIB.map((v) => [v.id, v]));

const base: Answers = {
  P9: ["speech_delay"], P12: "walks", P13: "never", P14: ["nothing"], P15: "no", P17: "no",
  P20: 1, P21: 1, P23: 2, P24: 2, P26: 2, P33: ["walk", "hands", "communicate"], P34: "20",
};
const input = (answers: Answers, extra: Partial<PlanInput> = {}): PlanInput => ({
  childId: "c1", round: 1, birthDate: "2019-05-01", startDate: "2026-10-12", lang: "uz", answers, healthConsent: true, ...extra,
});
const chosen = (r: ReturnType<typeof buildRoadmap>) => [...new Set(r.days.flatMap((d) => d.exercises.map((e) => e.videoId)))].map((id) => BY_ID.get(id)!);

describe("roadmap engine", () => {
  it("is deterministic", () => {
    expect(buildRoadmap(input(base), LIB)).toEqual(buildRoadmap(input(base), LIB));
  });

  it("has 4 weeks and follows the daily time (P34)", () => {
    const want = { "10": [1, 2], "20": [2, 3], "30": [4, 5] } as const;
    for (const p34 of ["10", "20", "30"] as const) {
      const r = buildRoadmap(input({ ...base, P34: p34 }), LIB);
      expect(r.days).toHaveLength(ROADMAP_DAYS);
      for (const d of r.days) {
        expect(d.exercises.length).toBeGreaterThanOrEqual(want[p34][0]);
        expect(d.exercises.length).toBeLessThanOrEqual(want[p34][1]);
        expect(d.games.reduce((s, g) => s + g.minutes, 0)).toBeLessThanOrEqual(20);
      }
    }
  });

  it("does not work the same body area two days running when the library allows it", () => {
    const r = buildRoadmap(input({ ...base, P34: "20" }), LIB);
    for (let i = 1; i < r.days.length; i++) {
      const before = new Set(r.days[i - 1].exercises.map((e) => BY_ID.get(e.videoId)!.bodyArea));
      for (const e of r.days[i].exercises) expect(before.has(BY_ID.get(e.videoId)!.bodyArea), r.days[i].date).toBe(false);
    }
  });

  it("never selects a conflicting video — every safety combination", () => {
    const p12 = ["walks", "walks_help", "walker", "wheelchair", "needs_help_sit", null];
    const p13 = ["last_year", "earlier", "never", null];
    const p14: (string[] | null)[] = [["nothing"], ["jumping"], ["prone", "neck_flexion"], ["single_leg_weight"], null];
    const p15 = [["no"], ["yes", ["legs"]], ["yes", ["hands", "trunk"]], [null]] as const;
    const p9 = [["cp"], ["autism"]];
    const therapists: (TherapistInput | undefined)[] = [
      undefined,
      { restrictions: ["jumping", "standing"], goals: ["sit"], assign: ["bunny_hops", "sit_to_stand"], exclude: ["putty_squeeze"], legBalanceApproved: true, gmfcs: 2 },
    ];
    let cases = 0;
    for (const a12 of p12) for (const a13 of p13) for (const a14 of p14) for (const [a15, part] of p15) for (const a9 of p9) for (const th of therapists) {
      const answers: Answers = { ...base, P9: a9, P12: a12, P13: a13, P14: a14, P15: a15, P15_part: part ? [...part] : undefined, P34: "30" };
      const r = buildRoadmap(input(answers, { therapist: th }), LIB);
      const gmfcs = th?.gmfcs ?? (a12 ? ({ walks: 1, walks_help: 2, walker: 3, wheelchair: 4, needs_help_sit: 5 } as Record<string, 1 | 2 | 3 | 4 | 5>)[a12] : null);
      for (const v of chosen(r)) {
        const banned: Restriction[] = [...(th?.restrictions ?? [])];
        if (a14 === null) banned.push("jumping", "prone", "neck_flexion", "single_leg_weight");
        else banned.push(...(a14.filter((x) => x !== "nothing") as Restriction[]));
        if (a13 === "last_year" || a13 === null) banned.push("high_intensity");
        if (gmfcs === null || gmfcs >= 4) banned.push("standing", "walking");
        if (a9.includes("cp") && !th?.legBalanceApproved) banned.push("leg_balance");
        const ctx = JSON.stringify({ a9, a12, a13, a14, a15, part, th: !!th, v: v.id });
        expect(v.conflicts.filter((c) => banned.includes(c)), ctx).toEqual([]);
        if (a15 === "yes") expect(part).not.toContain(v.bodyArea);
        expect(v.gmfcs, ctx).toContain(gmfcs ?? 5);
        expect(th?.exclude ?? []).not.toContain(v.id);
      }
      cases++;
    }
    expect(cases).toBe(6 * 4 * 5 * 4 * 2 * 2);
  });

  it("uses only approved videos in the child's language", () => {
    const lib: ExerciseVideo[] = LIB.map((v) => (v.id === "putty_squeeze" ? { ...v, versions: { ...v.versions, uz: { ...v.versions.uz!, status: "generated" } } } : v));
    const ids = chosen(buildRoadmap(input(base), lib)).map((v) => v.id);
    expect(ids).not.toContain("putty_squeeze");
    for (const id of ["tongs_sort", "pegboard_pattern", "funny_faces", "catch_soft_ball"]) expect(ids).not.toContain(id); // seeded as waiting for review
  });

  it("has no exercises without health consent, games only", () => {
    const r = buildRoadmap(input({ P33: ["hands"], P34: "20" }, { healthConsent: false }), LIB);
    expect(r.exercisesAllowed).toBe(false);
    expect(r.days.every((d) => d.exercises.length === 0 && d.games.length > 0)).toBe(true);
  });

  it("therapist goals override the parent's (T7 over P33)", () => {
    const r = buildRoadmap(input(base, { therapist: { restrictions: [], goals: ["sit"], assign: [], exclude: [], legBalanceApproved: false } }), LIB);
    expect(r.reasons.filter((x) => x.slot === "exercise").every((x) => x.goal === "sit")).toBe(true);
  });
});
