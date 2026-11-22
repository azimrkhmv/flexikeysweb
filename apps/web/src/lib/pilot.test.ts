import { describe, expect, it } from "vitest";
import { fullWeeks, isQuiet, isRetained, lastActive, pilotFromDb, tashkentDay, toCsv } from "./pilot";
import { seed } from "./api/seed";

// Same cases as apps/api tests/test_pilot.py (B113), with fixed dates.
const TODAY = "2026-11-26"; // a Thursday
const run = (start: string, n: number) => Array.from({ length: n }, (_, i) => new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10));

describe("pilot rules (B113)", () => {
  it("counts the four full weeks before this one", () => {
    expect(fullWeeks(TODAY)).toEqual(["2026-11-16", "2026-11-09", "2026-11-02", "2026-10-26"]);
    expect(fullWeeks("2026-11-23")).toEqual(fullWeeks(TODAY));
  });

  it("retained: 3 active days in 3 of the last 4 weeks", () => {
    const three = [...run("2026-11-16", 3), ...run("2026-11-09", 3), ...run("2026-11-02", 3)];
    expect(isRetained(three, TODAY)).toBe(true);
    expect(isRetained([...run("2026-11-16", 7), ...run("2026-11-09", 7), ...run("2026-11-02", 2)], TODAY)).toBe(false);
    expect(isRetained([...run("2026-11-23", 4), ...run("2026-11-16", 3), ...run("2026-11-09", 3)], TODAY)).toBe(false);
    expect(isRetained([...run("2026-11-09", 3), ...run("2026-11-02", 3), ...run("2026-10-19", 7)], TODAY)).toBe(false);
    expect(isRetained([], TODAY)).toBe(false);
  });

  it("quiet: nothing finished today or the two days before", () => {
    expect(isQuiet([], TODAY)).toBe(true);
    expect(isQuiet(["2026-11-23"], TODAY)).toBe(true);
    expect(isQuiet(["2026-11-24"], TODAY)).toBe(false);
    expect(lastActive(["2026-11-02", "2026-11-23"], TODAY)).toBe("2026-11-23");
    expect(lastActive([], TODAY)).toBeNull();
  });

  it("uses the Tashkent day", () => {
    expect(tashkentDay("2026-11-25T19:30:00Z")).toBe("2026-11-26");
    expect(tashkentDay("2026-11-25T18:59:00Z")).toBe("2026-11-25");
  });

  it("works out the demo's numbers from saved records", () => {
    const db = seed();
    const n = pilotFromDb(db);
    expect(n.signedUp).toBe(db.users.filter((u) => u.role === "parent" && u.consentVersion).length);
    expect(n.signupsByDay.reduce((s, d) => s + d.count, 0)).toBe(n.signedUp);
    expect(n.byCenter.find((c) => c.code === null)?.count).toBe(n.signedUp); // the demo parents came without a link
  });

  it("writes a CSV Excel can open", () => {
    expect(toCsv(["a", "b"], [["x, y", 2], [null, 'say "hi"']])).toBe('﻿a,b\n"x, y",2\n,"say ""hi"""');
  });
});
