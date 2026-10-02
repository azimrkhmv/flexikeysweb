import { describe, expect, it } from "vitest";
import coloring from "@/content/drawing/coloring.json";
import trace from "@/content/drawing/trace.json";
import { pathD, traceItems, type ColoringItem, type TraceItem } from "@/content/drawing";
import { LEVEL_BY_ID, LEVELS, levelComplete, requiredActivities } from "@/content/levels";
import { makeMaze, solve } from "./draw";

const T = trace as unknown as Record<"letters_latin" | "letters_cyrillic" | "numbers" | "objects", TraceItem[]>;
const C = coloring as unknown as Record<"fruits" | "animals" | "nature" | "transport", ColoringItem[]>;
const PICTURES = (["fruits", "animals", "nature", "transport"] as const).flatMap((s) => C[s]); // (the JSON's "_" is a note)

describe("drawing content imported from the Flutter app", () => {
  it("has every set, with usable strokes", () => {
    expect([T.letters_latin.length, T.letters_cyrillic.length, T.numbers.length, T.objects.length]).toEqual([26, 33, 10, 3]);
    for (const it of [...T.letters_latin, ...T.letters_cyrillic, ...T.numbers, ...T.objects]) {
      expect(it.dots.length).toBeGreaterThanOrEqual(2);
      expect(it.ghost.flat().every(([x, y]) => x >= 0 && x <= 1 && y >= 0 && y <= 1)).toBe(true);
    }
  });

  it("every picture and object has a name in all 3 languages", () => {
    for (const it of [...T.objects, ...PICTURES]) for (const l of ["en", "uz", "ru"] as const) expect(it.names?.[l]).toBeTruthy();
    expect(PICTURES).toHaveLength(13);
  });

  it("content picks exist: Cyrillic letters for Russian, Latin otherwise", () => {
    const data = T as Parameters<typeof traceItems>[0];
    expect(traceItems(data, "letters", "ru", ["А", "О"]).map((i) => i.label)).toEqual(["А", "О"]);
    expect(traceItems(data, "letters", "uz", ["A", "O"]).map((i) => i.label)).toEqual(["A", "O"]);
    for (const level of LEVELS)
      for (const a of level.activities) {
        if (a.kind === "trace") for (const lang of ["en", "uz", "ru"] as const) expect(traceItems(data, a.set, lang, a.items[lang])).toHaveLength(a.items[lang].length);
        if (a.kind === "dots") for (const id of a.items) expect(T.objects.some((o) => o.id === id)).toBe(true);
        if (a.kind === "color") expect(C[a.set].length).toBeGreaterThan(0);
      }
  });

  it("smooth paths match the Flutter Catmull-Rom curve", () => {
    expect(pathD([[0, 0], [10, 0]], false)).toBe("M0 0L10 0");
    expect(pathD([[0, 0], [6, 6], [12, 0]], false)).toBe("M0 0C1 1 4 6 6 6C8 6 11 1 12 0");
  });
});

describe("maze", () => {
  it("is a perfect maze: one way between any two cells, the goal is reachable", () => {
    for (const n of [3, 4, 5])
      for (let seed = 1; seed < 20; seed++) {
        const open = makeMaze(n, seed);
        expect(open.size).toBe(n * n - 1); // spanning tree
        const way = solve(n, open, 0);
        expect(way.at(-1)).toBe(n * n - 1);
      }
  });
  it("is the same for the same seed", () => {
    expect([...makeMaze(4, 7)]).toEqual([...makeMaze(4, 7)]);
  });
});

describe("optional activities never gate a level", () => {
  it("drawing activities are optional; required ones finish the level", () => {
    const letters = LEVEL_BY_ID.letters;
    const required = requiredActivities(letters);
    expect(letters.activities.filter((a) => ["trace", "dots", "color", "maze", "paint"].includes(a.kind)).every((a) => a.optional)).toBe(true);
    expect(levelComplete(letters, required)).toBe(true);
    expect(levelComplete(letters, ["letters-trace"])).toBe(false);
  });
});
