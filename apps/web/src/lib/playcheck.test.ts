import { describe, expect, it } from "vitest";
import { holdTime, releaseOk, repeatLock, sizeStep, SIZES_MM, struggles, type Touch } from "./playcheck";

const taps = (...hits: (boolean | [boolean, number])[]): Touch[] => {
  let at = 0;
  return hits.map((h) => {
    const [hit, gap] = Array.isArray(h) ? h : [h, 1500];
    at += gap;
    return { hit, at };
  });
};

describe("play check, stage 1 (spec §7)", () => {
  it("touch works unless 3 of 5 taps miss or repeat", () => {
    expect(struggles(taps(true, true, true, true, true))).toBe(false);
    expect(struggles(taps(true, false, true, false, true))).toBe(false);
    expect(struggles(taps(true, false, false, false, true))).toBe(true);
    expect(struggles(taps(true, [true, 100], true, [true, 120], false))).toBe(true); // 2 repeats + 1 miss
  });

  it("buttons shrink until 2 misses in a row, then step back one size, never below 12 mm", () => {
    let s: ReturnType<typeof sizeStep> = { i: 0, missed: 0 };
    for (const hit of [true, true, true, false, false]) s = sizeStep(s, hit); // 40, 32, 26 hit; 20 missed twice
    expect(s.done).toBe(26);
    s = { i: 0, missed: 0 };
    for (let k = 0; k < SIZES_MM.length; k++) s = sizeStep(s, true);
    expect(s.done).toBe(12);
    expect(sizeStep({ i: 0, missed: 1 }, false).done).toBe(40); // even the biggest is the floor
    expect(sizeStep({ i: 2, missed: 1 }, true)).toEqual({ i: 3, missed: 0 }); // a hit forgives one miss
  });

  it("the hold time is a little under the usual hold, within 500–3000 ms", () => {
    expect(holdTime([1000, 1500, 2000])).toBe(1200);
    expect(holdTime([200, 300, 250])).toBe(500);
    expect(holdTime([6000, 5000, 7000])).toBe(3000);
  });

  it("repeat lock and clean release", () => {
    expect(repeatLock(taps(true, [true, 100], true))).toBe(false); // once can happen to anyone
    expect(repeatLock(taps(true, [true, 100], true, [true, 90]))).toBe(true);
    expect(releaseOk([false, false, true])).toBe(true);
    expect(releaseOk([true, true, false])).toBe(false);
  });
});
