import { beforeEach, describe, expect, it } from "vitest";
import { LEVEL_BY_ID } from "@/content/levels";
import { api } from "./index";

// The mock server enforces the level gate itself — a client (or an assignment) can't play a sleeping level.
describe("api.completeActivity", () => {
  beforeEach(async () => {
    api.resetDemo();
    await api.classLoginChild("cl_sun", "ch_ali"); // child token for Ali (class path)
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
