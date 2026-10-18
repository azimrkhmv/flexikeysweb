import { describe, expect, it } from "vitest";
import { AREA_OF, AREAS, chooseGames, corrected, difficulty, elo, pCorrect, startingTheta, STEP, weeklyNew, type Area, type Game } from "./skill";

describe("skill levels (spec §13)", () => {
  it("P(correct) = 1 / (1 + e^−(θ − d))", () => {
    expect(pCorrect(0, 0)).toBe(0.5);
    expect(pCorrect(1, 0)).toBeCloseTo(1 / (1 + Math.exp(-1)), 12);
    expect(pCorrect(-2, 1)).toBeCloseTo(1 / (1 + Math.exp(3)), 12);
  });

  it("θnew = θ + K × (correct − P), K = 1 / (1 + 0.05 n)", () => {
    expect(elo(0, 0, 0, true)).toBeCloseTo(0.5, 12); // K = 1, 1 − 0.5
    expect(elo(0, 0, 0, false)).toBeCloseTo(-0.5, 12);
    const k20 = 1 / (1 + 0.05 * 20); // = 0.5
    expect(elo(1, 20, 0, false)).toBeCloseTo(1 + k20 * (0 - pCorrect(1, 0)), 12);
    expect(Math.abs(elo(0, 100, 0, true))).toBeLessThan(Math.abs(elo(0, 0, 0, true))); // evidence builds, K shrinks
  });

  it("starts from the intake; a therapist's answers weigh more", () => {
    expect(startingTheta("access", { P23: 2, P24: 2, P26: 2 })).toBe(STEP);
    expect(startingTheta("access", { P23: 0, P24: 0, P26: 0 })).toBe(-STEP);
    expect(startingTheta("memory", { P19: 0 }, { P19: 2 })).toBeCloseTo((4 / 3) * STEP - STEP, 12); // (0·1 + 2·2) / 3
    expect(startingTheta("numeracy", {})).toBe(0);
  });

  it("the play check wins over the intake by one step at most", () => {
    expect(corrected(-STEP, "yes")).toBe(0); // two steps apart: moves one
    expect(corrected(0, "yes")).toBe(STEP);
    expect(corrected(STEP, "not_yet")).toBe(0);
  });

  it("three slots: easy win from the strongest area, growth from the weakest that has a game, the child's choice", () => {
    const games: Game[] = [
      { activityId: "a1", kind: "find_same", level: 1 },
      { activityId: "a9", kind: "find_same", level: 9 },
      { activityId: "m3", kind: "missing", level: 3 },
      { activityId: "l5", kind: "listen_pick", level: 5 },
    ];
    const theta = Object.fromEntries(AREAS.map((a) => [a, 0])) as Record<Area, number>;
    theta.attention = 1;
    theta.memory = -1;
    theta.numeracy = -3; // no unlocked game: never the growth slot
    const [easy, growth, choice] = chooseGames(theta, games);
    expect([easy.slot, easy.area, growth.slot, growth.area, choice.slot]).toEqual(["easy_win", "attention", "growth", "memory", "choice"]);
    // easy win: the level closest to θ − ln(0.85 / 0.15) ≈ −0.73: level 1 (d = −1.5) beats level 9 (d = 0.9)
    expect(easy.games[0].activityId).toBe("a1");
    expect(choice.games).toHaveLength(4);
    expect(pCorrect(theta.attention, difficulty(1))).toBeGreaterThan(0.85);
  });

  it("every game kind trains one area", () => {
    for (const area of Object.values(AREA_OF)) expect(AREAS).toContain(area);
  });
});

describe("at most one new game a week (spec §13)", () => {
  const g = (activityId: string, kind: Game["kind"]): Game => ({ activityId, kind, level: 1 });
  const unlocked = [g("f", "find_same"), g("m", "missing"), g("s", "sort"), g("s2", "sort")];
  it("offers one new kind when none was new this week, and keeps every kind already played", () => {
    const played = new Map<Game["kind"], string>([["find_same", "2026-09-01"]]);
    expect(weeklyNew(unlocked, played, "2026-10-01").map((x) => x.activityId)).toEqual(["f", "m"]);
  });
  it("offers none while this week's new game is still new; the played ones stay", () => {
    const played = new Map<Game["kind"], string>([["find_same", "2026-09-01"], ["missing", "2026-09-28"]]);
    expect(weeklyNew(unlocked, played, "2026-10-01").map((x) => x.activityId)).toEqual(["f", "m"]);
    expect(weeklyNew(unlocked, played, "2026-10-06").map((x) => x.activityId)).toEqual(["f", "m", "s", "s2"]); // a week later
  });
});
