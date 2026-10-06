import { beforeEach, describe, expect, it } from "vitest";
import { LEVEL_BY_ID } from "@/content/levels";
import { api, DEMO_PASSWORD, dbStore, sel } from "./index";

// The mock server checks access itself: levels are played in any order, only the plan can close one.
describe("api.completeActivity", () => {
  beforeEach(async () => {
    api.resetDemo();
    await api.classLoginChild("cl_sun", "ch_ali"); // child token for Ali (class path)
  });

  it("accepts a level far beyond the ones the child has finished (no sequential gate)", async () => {
    const session = await api.startSession("touch");
    const r = await api.completeActivity(session, "body", LEVEL_BY_ID.body.activities[0].id); // level 11, Ali is on 6
    expect(r).toMatchObject({ stars: 3, coins: 5, first: true });
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
    await api.login("parent@demo.uz", DEMO_PASSWORD);
    dbStore.set((db) => ({ ...db, consents: db.consents.filter((c) => c.childId !== "ch_ali") })); // e.g. a mobile-app profile
  });

  it("refuses and explains, then works once the parent consents", async () => {
    await expect(api.startChildMode("ch_ali")).rejects.toMatchObject({ code: "consent_missing" });
    expect(sel.childAuth(dbStore.get())).toBeNull();
    await api.setConsent("ch_ali", "core", true);
    await expect(api.startChildMode("ch_ali")).resolves.toBe(true);
  });
});
