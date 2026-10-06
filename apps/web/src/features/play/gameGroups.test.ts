import { describe, expect, it } from "vitest";
import { LEVELS } from "@/content/levels";
import { areaMessages } from "@/messages";
import { activityLabelKey, GROUPS, groupOf, tasksByGroup } from "./gameGroups";

describe("games sorted by type (beside the world map)", () => {
  const grouped = tasksByGroup();
  const all = LEVELS.flatMap((l) => l.activities);

  it("lists every game exactly once", () => {
    const ids = grouped.flatMap((g) => g.tasks.map((x) => x.activity.id));
    expect(ids.length).toBe(all.length);
    expect(new Set(ids).size).toBe(all.length);
  });

  it("puts every typing game in 'Letters and words', kept in level order", () => {
    const words = grouped.find((g) => g.id === "words")!.tasks;
    expect(all.filter((a) => a.kind === "type").every((a) => groupOf(a) === "words")).toBe(true);
    expect(words.map((x) => x.level.n)).toEqual([...words.map((x) => x.level.n)].sort((a, b) => a - b));
    expect(words.map((x) => x.activity.id)).toContain("words-type");
  });

  it("has every group and game name in all three languages", () => {
    const keys = [...GROUPS.map((g) => `play.group.${g}`), ...all.map(activityLabelKey), "play.groups.title", "play.groups.count"];
    for (const lang of ["en", "uz", "ru"] as const)
      for (const k of keys) expect(areaMessages.play[lang] as Record<string, string>, `${lang}: ${k}`).toHaveProperty([k]);
  });
});
