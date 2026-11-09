import { beforeEach, describe, expect, it } from "vitest";
import { LEVEL_BY_ID } from "@/content/levels";
import { createTryLog } from "../tries";
import { api, DEMO_PHONES, dbStore, sel } from "./index";

async function asParent() {
  const { demoCode } = await api.requestCode(DEMO_PHONES.parent);
  await api.verifyCode(DEMO_PHONES.parent, demoCode, "en");
}
/** Ali in child mode on the parent's device. */
async function asAli() {
  await asParent();
  await api.startChildMode("ch_ali");
}

// The mock server enforces the level gate itself — a client (or an assignment) can't play a sleeping level.
describe("api.completeActivity", () => {
  beforeEach(async () => {
    api.resetDemo();
    await asAli();
  });

  it("rejects activities of a level the child hasn't unlocked, even when it is assigned", async () => {
    const session = await api.startSession("touch");
    await expect(api.completeActivity(session, "body", LEVEL_BY_ID.body.activities[0].id)).rejects.toMatchObject({ code: "level_locked" });
  });

  it("still rewards activities of an open level", async () => {
    const session = await api.startSession("touch");
    const r = await api.completeActivity(session, "animals", LEVEL_BY_ID.animals.activities[1].id);
    expect(r.stars).toBeGreaterThan(0);
  });
});

// No consent recorded = no consent (never assumed): child mode waits until the parent gives it.
describe("api.startChildMode without a core consent record", () => {
  beforeEach(async () => {
    api.resetDemo();
    await asParent();
    dbStore.set((db) => ({ ...db, consents: db.consents.filter((c) => c.childId !== "ch_ali") })); // e.g. a mobile-app profile
  });

  it("refuses and explains, then works once the parent consents", async () => {
    await expect(api.startChildMode("ch_ali")).rejects.toMatchObject({ code: "consent_missing" });
    expect(sel.childAuth(dbStore.get())).toBeNull();
    await api.setConsent("ch_ali", "core", true);
    await expect(api.startChildMode("ch_ali")).resolves.toBe(true);
  });
});

// B14: tries come in batches through the offline queue; a batch sent again (a retry) is stored once.
describe("api.saveTries", () => {
  beforeEach(async () => {
    api.resetDemo();
    await asAli();
  });

  it("stores each try once, access events included as access events", async () => {
    const add = createTryLog({ childId: "ch_ali", sessionId: "s1", startedAt: Date.now(), access: "touch" });
    const at = { levelId: "animals", activityId: LEVEL_BY_ID.animals.activities[0].id };
    const batch = [add({ ...at, t: 1, type: "accidental_tap" })!, add({ ...at, t: 2, type: "select", correct: true })!];
    await api.saveTries("ch_ali", batch);
    await api.saveTries("ch_ali", batch); // the retry
    const saved = dbStore.get().tries;
    expect(saved).toHaveLength(2);
    expect(saved.map((x) => [x.accessEvent, x.outcome])).toEqual([[true, "skipped"], [false, "correct"]]);
    await expect(api.saveTries("ch_madina", batch)).rejects.toMatchObject({ code: "not_found" }); // only the playing child
  });
});

// B17: clean tries move the skill level of their area; access events never do (product rule 5).
describe("skill levels from tries", () => {
  beforeEach(async () => {
    api.resetDemo();
    await asAli();
  });

  it("a right answer raises θ, an access event changes nothing", async () => {
    const add = createTryLog({ childId: "ch_ali", sessionId: "s1", startedAt: Date.now(), access: "touch" });
    const findSame = LEVEL_BY_ID.fruits.activities.find((a) => a.kind === "find_same")!;
    const at = { levelId: "fruits", activityId: findSame.id };
    const before = sel.skills(dbStore.get(), "ch_ali").attention;
    await api.saveTries("ch_ali", [add({ ...at, t: 1, type: "accidental_tap" })!, add({ ...at, t: 2, type: "debounced" })!]);
    expect(sel.skills(dbStore.get(), "ch_ali").attention).toEqual(before);
    await api.saveTries("ch_ali", [add({ ...at, t: 3, type: "select", correct: true })!]);
    const after = sel.skills(dbStore.get(), "ch_ali").attention;
    expect(after.n).toBe(1);
    expect(after.theta).toBeGreaterThan(before.theta);
  });

  // B83 (games spec §3.2): Sprout opens after 20 clean tries with 85% success on Seed's last step; never closes.
  it("opens the next tier by success, as the server does", async () => {
    const add = createTryLog({ childId: "ch_ali", sessionId: "s1", startedAt: Date.now(), access: "touch" });
    const at = { activityId: "find_same-skill", tier: 4, step: 3 };
    expect(sel.tiers(dbStore.get(), "ch_ali").attention).toBe(1);
    await api.saveTries("ch_ali", [add({ ...at, t: 0, type: "accidental_tap" })!, ...Array.from({ length: 19 }, (_, i) => add({ ...at, t: i + 1, type: "select", correct: true })!)]);
    expect(sel.tiers(dbStore.get(), "ch_ali").attention).toBe(1);
    await api.saveTries("ch_ali", [add({ ...at, t: 30, type: "select", correct: true })!]);
    expect(sel.tiers(dbStore.get(), "ch_ali")).toMatchObject({ attention: 2, memory: 1 });
    await api.saveTries("ch_ali", Array.from({ length: 30 }, (_, i) => add({ ...at, tier: 1, step: 1, t: 40 + i, type: "select", correct: false })!));
    expect(sel.tiers(dbStore.get(), "ch_ali").attention).toBe(2);
  });
});
