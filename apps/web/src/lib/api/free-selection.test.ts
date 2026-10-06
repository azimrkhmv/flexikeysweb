import { beforeEach, describe, expect, it } from "vitest";
import { LEVEL_BY_ID, LEVELS, requiredActivities } from "@/content/levels";
import { api, DEMO_PASSWORD, dbStore, sel } from "./index";
import { seed } from "./seed";

// Free level selection: any level the child has access to can be played in any order. Progress is the set of
// activities actually completed — never "everything below the highest level reached".

const state = (childId: string, levelId: string) => sel.levelState(dbStore.get(), childId, LEVEL_BY_ID[levelId].n - 1);

/** A new school-managed child (full access, no progress) playing on the class device. */
async function freshChild() {
  api.resetDemo();
  await api.login("teacher@demo.uz", DEMO_PASSWORD);
  const child = await api.addSchoolChild("cl_sun", { name: "Nova", avatar: "🐻", attested: true });
  await api.logout();
  await api.classLoginChild("cl_sun", child.id);
  return { childId: child.id, session: await api.startSession("touch") };
}

async function finishLevel(session: string, levelId: string) {
  for (const a of requiredActivities(LEVEL_BY_ID[levelId])) await api.completeActivity(session, levelId, a);
}

describe("free level selection", () => {
  let childId = "";
  let session = "";
  beforeEach(async () => {
    ({ childId, session } = await freshChild());
  });

  it("every level with access is playable from the start", () => {
    for (const l of LEVELS) expect(sel.lockReason(dbStore.get(), childId, l.id), l.id).toBeNull();
    expect(LEVELS.map((l) => state(childId, l.id)).every((s) => s === "open")).toBe(true);
  });

  it("a child can play level 5 without levels 1–4", async () => {
    const r = await api.completeActivity(session, "family", LEVEL_BY_ID.family.activities[0].id);
    expect(r).toMatchObject({ first: true, stars: 3, coins: 5 });
    expect(state(childId, "family")).toBe("started");
    expect(state(childId, "letters")).toBe("open");
  });

  it("finishing level 7 before level 2 saves level 7 as done and opens nothing else", async () => {
    await finishLevel(session, "fruits");
    expect(state(childId, "fruits")).toBe("done");
    expect(state(childId, "numbers")).toBe("open");
    expect(state(childId, "vegetables")).toBe("open"); // level 8 isn't touched either
    expect(sel.levelProgress(dbStore.get(), childId, "numbers").completed).toEqual([]);
  });

  it("completions in random order (1, 3, 5 done; 2, 4 not) are each kept", async () => {
    for (const id of ["stories", "letters", "family", "shapes"]) await finishLevel(session, id);
    const s = LEVELS.slice(0, 5).map((l) => state(childId, l.id));
    expect(s).toEqual(["done", "open", "done", "open", "done"]);
    expect(state(childId, "stories")).toBe("done");
  });

  it("a finished level stays finished and can be replayed (repeat reward, no second level bonus)", async () => {
    await finishLevel(session, "toys");
    const again = await api.completeActivity(session, "toys", LEVEL_BY_ID.toys.activities[0].id);
    expect(again).toEqual({ first: false, stars: 1, coins: 2, levelDone: false });
    expect(state(childId, "toys")).toBe("done");
  });

  it("the level bonus is paid once, when the last required activity is done, in any order", async () => {
    const [a, b, c] = requiredActivities(LEVEL_BY_ID.letters);
    expect((await api.completeActivity(session, "letters", c)).levelDone).toBe(false);
    expect((await api.completeActivity(session, "letters", a)).levelDone).toBe(false);
    expect(await api.completeActivity(session, "letters", b)).toMatchObject({ levelDone: true, coins: 5 + 10 });
  });

  it("an unfinished level is 'started' and keeps its activities until the child comes back", async () => {
    const first = LEVEL_BY_ID.animals.activities[0].id;
    await api.completeActivity(session, "animals", first);
    await api.exitChildMode();
    await api.classLoginChild("cl_sun", childId); // later, e.g. after a refresh or on another day
    expect(state(childId, "animals")).toBe("started");
    expect(sel.levelProgress(dbStore.get(), childId, "animals").completed).toEqual([first]);
  });

  it("overall progress = finished levels ÷ playable levels", async () => {
    for (const id of ["letters", "colors", "fruits", "body"]) await finishLevel(session, id);
    expect(sel.levelsProgress(dbStore.get(), childId)).toEqual({ done: 4, total: 16, pct: 25 });
  });
});

describe("access is still enforced", () => {
  it("a child on the free plan can't play paid levels, but every free level is open in any order", async () => {
    api.resetDemo();
    await api.login("family@demo.uz", DEMO_PASSWORD); // Jasur: free plan, no school or therapist link
    await api.startChildMode("ch_other");
    const session = await api.startSession("touch");
    expect(sel.lockReason(dbStore.get(), "ch_other", "family")).toEqual({ kind: "plan" });
    await expect(api.completeActivity(session, "family", LEVEL_BY_ID.family.activities[0].id)).rejects.toMatchObject({ code: "level_locked" });
    await api.completeActivity(session, "colors", LEVEL_BY_ID.colors.activities[0].id); // level 4 before 1–3
    expect(state("ch_other", "colors")).toBe("started");
    expect(sel.levelsProgress(dbStore.get(), "ch_other")).toEqual({ done: 0, total: 4, pct: 0 });
  });
});

describe("existing progress is preserved", () => {
  it("seeded (sequential) histories read the same: finished levels done, the last one started", () => {
    const db = seed();
    const s = (childId: string) => LEVELS.slice(0, 7).map((_, i) => sel.levelState(db, childId, i));
    // Ali played letters → animals in order; animals has only its first activity.
    expect(s("ch_ali")).toEqual(["done", "done", "done", "done", "done", "started", "open"]);
    expect(sel.levelsProgress(db, "ch_ali")).toEqual({ done: 5, total: 16, pct: 31 });
    expect(sel.levelState(db, "ch_s3", 0)).toBe("done"); // another child keeps their own state
    expect(sel.levelState(db, "ch_s3", 1)).toBe("started");
  });

  it("different children have independent completion states", async () => {
    const { childId, session } = await freshChild();
    await finishLevel(session, "nature");
    expect(state(childId, "nature")).toBe("done");
    expect(state("ch_ali", "nature")).toBe("open");
  });
});
