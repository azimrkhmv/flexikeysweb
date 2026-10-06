import { describe, expect, it } from "vitest";
import { seed } from "./seed";
import { sel } from "./selectors";

describe("sel.assignmentsFor", () => {
  it("drops a therapist's recommendations once the parent revokes the link", () => {
    const db = seed();
    const fromTherapist = () => sel.assignmentsFor(db, "ch_ali").filter((a) => a.kind === "therapist");
    expect(fromTherapist()).toHaveLength(1);
    db.careLinks.find((l) => l.id === "cl_link1")!.status = "revoked";
    expect(fromTherapist()).toHaveLength(0);
    expect(sel.assignmentsFor(db, "ch_ali").some((a) => a.kind === "teacher")).toBe(true); // class tasks unaffected
  });
});

describe("sel.access", () => {
  it("is the single authorization rule: owner, linked therapist, class teacher, nobody else", () => {
    const db = seed();
    expect(sel.access(db, "u_parent", "ch_ali")).toBe("owner");
    expect(sel.access(db, "u_therapist", "ch_ali")).toBe("therapist");
    expect(sel.access(db, "u_teacher", "ch_ali")).toBe("teacher");
    expect(sel.access(db, "u_parent2", "ch_ali")).toBeNull();
    expect(sel.access(db, "u_therapist", "ch_madina")).toBeNull(); // invited, not accepted
  });
});

describe("assignments never bypass the plan gate", () => {
  it("only access locks a level, and an assignment doesn't change it", () => {
    const db = seed();
    expect(sel.lockReason(db, "ch_ali", "animals")).toBeNull(); // open
    expect(sel.lockReason(db, "ch_ali", "body")).toBeNull(); // level 11, Ali is on level 6: open anyway (free choice)
    expect(sel.assignmentsFor(db, "ch_ali").some((a) => a.levelId === "body")).toBe(true);
    // Jasur: free plan, no school or therapist link → level 5 needs the plan, even when assigned.
    expect(sel.lockReason(db, "ch_other", "family")).toEqual({ kind: "plan" });
    db.assignments.push({ id: "x", kind: "therapist", byUserId: "u_therapist", childId: "ch_other", levelId: "family", note: "", createdAt: "" });
    expect(sel.lockReason(db, "ch_other", "family")).toEqual({ kind: "plan" });
  });
});
