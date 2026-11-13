import { describe, expect, it } from "vitest";
import { planGames } from "./games";

const day = (...kinds: string[]) => ({ games: kinds.map((kind) => ({ kind, minutes: 5 })) });
const plan = { days: [day("sort", "count"), day("count", "card_pairs"), day("maze"), day("sort")] } as unknown as Parameters<typeof planGames>[0];

describe("the games of a child's plan (B96)", () => {
  it("today's games come first, then the rest, each kind once", () => {
    expect(planGames(plan, 1, null)).toEqual([
      { kind: "count", minutes: 5, today: true },
      { kind: "card_pairs", minutes: 5, today: true },
      { kind: "sort", minutes: 5, today: false },
      { kind: "maze", minutes: 5, today: false },
    ]);
  });

  it("a rest day or a day outside the plan: plan order, nothing marked today", () => {
    expect(planGames(plan, null, null).map((g) => [g.kind, g.today])).toEqual([["sort", false], ["count", false], ["card_pairs", false], ["maze", false]]);
    expect(planGames(plan, 9, null).every((g) => !g.today)).toBe(true);
  });

  it("Free shows only the days Free includes", () => {
    expect(planGames(plan, 0, 2).map((g) => g.kind)).toEqual(["sort", "count", "card_pairs"]);
    expect(planGames(plan, 2, 2).map((g) => [g.kind, g.today])).toEqual([["sort", false], ["count", false], ["card_pairs", false]]); // today is past Free's days
  });
});
