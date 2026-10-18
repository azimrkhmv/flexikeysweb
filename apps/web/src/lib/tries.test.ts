import { describe, expect, it } from "vitest";
import { LEVEL_BY_ID } from "@/content/levels";
import { createTryLog } from "./tries";

const activity = LEVEL_BY_ID.animals.activities[0];
const at = { levelId: "animals", activityId: activity.id };
const log = () => createTryLog({ childId: "c1", sessionId: "s1", startedAt: Date.parse("2026-10-06T10:12:00Z"), access: "dwell" });

describe("try records (spec §7)", () => {
  it("a missed tap, a double tap or an early release is an access event, never a wrong answer", () => {
    const add = log();
    for (const type of ["accidental_tap", "debounced"] as const) {
      const r = add({ ...at, t: 100, type, target: "cat", pointerType: "touch" })!;
      expect([r.accessEvent, r.outcome]).toEqual([true, "skipped"]);
    }
    const answer = add({ ...at, t: 900, type: "select", target: "cat", actual: "cat", correct: true, latencyMs: 8400, pointerType: "touch" })!;
    expect(answer).toMatchObject({ accessEvent: false, outcome: "correct", attempts: 1, responseMs: 8400, inputMode: "dwell" });
  });

  it("counts attempts on an item and remembers the hint until the right answer", () => {
    const add = log();
    expect(add({ ...at, t: 1, type: "select", correct: false })!.attempts).toBe(1);
    expect(add({ ...at, t: 2, type: "hint_shown" })).toBeNull();
    const second = add({ ...at, t: 3, type: "select", correct: true, pointerType: "switch" })!;
    expect(second).toMatchObject({ attempts: 2, hintShown: "shimmer", inputMode: "switch", outcome: "correct" });
    expect(add({ ...at, t: 4, type: "select", correct: true })!).toMatchObject({ attempts: 1, hintShown: "none" });
  });

  it("has the spec's fields", () => {
    const r = log()({ ...at, t: 3000, type: "select", target: "item", correct: true })!;
    expect(r).toMatchObject({ childId: "c1", sessionId: "s1", game: activity.kind, level: LEVEL_BY_ID.animals.n, itemId: "item", helpedByAdult: false, ts: "2026-10-06T10:12:03.000Z" });
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
