import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";

// The backend grants rewards and enforces the mastery gate from this manifest (level → activity ids,
// in order). It must always match the content the app plays. Regenerate with UPDATE_MANIFEST=1 npm test,
// then copy it to flexikeys/backend/src/flexikeys/content/levels.manifest.json.
const PATH = new URL("./levels.manifest.json", import.meta.url);
const manifest = { version: 1, levels: LEVELS.map((l) => ({ slug: l.id, n: l.n, activities: l.activities.map((a) => a.id) })) };

describe("levels manifest", () => {
  it("matches content/levels.ts", () => {
    const json = `${JSON.stringify(manifest, null, 2)}\n`;
    if (process.env.UPDATE_MANIFEST) writeFileSync(PATH, json);
    expect(readFileSync(PATH, "utf8")).toBe(json);
  });
});
