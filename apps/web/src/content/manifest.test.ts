import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FREE_LEVELS, LEVELS, requiredActivities } from "./levels";

// The backend grants rewards and enforces the mastery gate and the plan gate from this manifest
// (level → activity ids, in order; `required` = the ones that finish the level; `free` = playable without a plan;
// `title` = what the assistant and reports call the level). It must always match the content the app plays. Regenerate with UPDATE_MANIFEST=1 npm test,
// then copy it to flexikeys/backend/src/flexikeys/content/levels.manifest.json.
const PATH = new URL("./levels.manifest.json", import.meta.url);
const manifest = {
  version: 4,
  levels: LEVELS.map((l) => ({
    slug: l.id, n: l.n, title: l.title, free: l.n <= FREE_LEVELS, activities: l.activities.map((a) => a.id), required: requiredActivities(l),
  })),
};

describe("levels manifest", () => {
  it("matches content/levels.ts", () => {
    const json = `${JSON.stringify(manifest, null, 2)}\n`;
    if (process.env.UPDATE_MANIFEST) writeFileSync(PATH, json);
    expect(readFileSync(PATH, "utf8")).toBe(json);
  });
});
