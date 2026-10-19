import { describe, expect, it } from "vitest";
import { seed } from "./seed";
import { familyForNewChild } from "./guards";
import { sel } from "./selectors";

describe("sel.assignmentsFor", () => {
  it("drops a therapist's recommendations once the parent revokes the link", () => {
    const db = seed();
    const fromTherapist = () => sel.assignmentsFor(db, "ch_ali").filter((a) => a.kind === "therapist");
    expect(fromTherapist()).toHaveLength(1);
    db.careLinks.find((l) => l.id === "cl_link1")!.status = "revoked";
    expect(fromTherapist()).toHaveLength(0);
  });
});

describe("sel.access", () => {
  it("is the single authorization rule: owner, linked therapist, nobody else", () => {
    const db = seed();
    expect(sel.access(db, "u_parent", "ch_ali")).toBe("owner");
    expect(sel.access(db, "u_therapist", "ch_ali")).toBe("therapist");
    expect(sel.access(db, "u_parent2", "ch_ali")).toBeNull();
    expect(sel.access(db, "u_therapist", "ch_madina")).toBeNull(); // invited, not accepted
  });
});

describe("assignments never bypass the gates (FR-CUR-4)", () => {
  it("explains mastery and plan locks, and an assignment changes neither", () => {
    const db = seed();
    expect(sel.lockReason(db, "ch_ali", "animals")).toBeNull(); // open
    expect(sel.lockReason(db, "ch_ali", "body")).toEqual({ kind: "mastery", after: "transport" }); // seeded therapist task
    expect(sel.assignmentsFor(db, "ch_ali").some((a) => a.levelId === "body")).toBe(true);
    // Jasur: free plan, no school or therapist link → level 5 needs the plan, even when assigned.
    expect(sel.lockReason(db, "ch_other", "family")).toEqual({ kind: "plan" });
    db.assignments.push({ id: "x", kind: "therapist", byUserId: "u_therapist", childId: "ch_other", levelId: "family", note: "", createdAt: "" });
    expect(sel.lockReason(db, "ch_other", "family")).toEqual({ kind: "plan" });
  });
});

describe("families (B2)", () => {
  it("a child belongs to a family: every member sees it, only the owner may change it, at most 3 children", () => {
    const db = seed();
    db.familyMembers.push({ familyId: "fam_1", userId: "u_parent2", role: "helper" });
    expect(sel.childrenOf(db, "u_parent2").map((c) => c.id).sort()).toEqual(["ch_ali", "ch_madina", "ch_other"]);
    expect(sel.access(db, "u_parent2", "ch_ali")).toBe("helper"); // daily use only, never the owner (B27)
    expect(sel.familyOwner(db, "fam_1")).toBe("u_parent");

    expect(familyForNewChild(db, "u_parent")).toBe("fam_1"); // 2 children: a 3rd is fine
    db.children.push({ ...db.children[0], id: "ch_third" });
    expect(() => familyForNewChild(db, "u_parent")).toThrow("too_many_children");
    expect(familyForNewChild(db, "u_therapist")).not.toBe("fam_1"); // no family yet: one is made
  });
});

describe("sel.planDayOn", () => {
  it("a paused day is not missed: the plan moves forward one day", () => {
    const db = seed();
    const plan = sel.roadmap(db, "ch_ali")!;
    const start = Date.parse(plan.startDate);
    const date = (n: number) => new Date(start + n * 86_400_000).toISOString().slice(0, 10);
    expect(sel.planDayOn(db, "ch_ali", date(2))).toBe(2);
    db.pausedDays.push({ childId: "ch_ali", roadmapId: plan.id, date: date(2) });
    expect(sel.planDayOn(db, "ch_ali", date(1))).toBe(1);
    expect(sel.planDayOn(db, "ch_ali", date(2))).toBe("paused");
    expect(sel.planDayOn(db, "ch_ali", date(3))).toBe(2); // yesterday's plan day comes today
    expect(sel.planDayOn(db, "ch_ali", date(28))).toBe(27); // the plan ends one day later
    expect(sel.planDayOn(db, "ch_ali", date(29))).toBeNull();
    expect(sel.planDayOn(db, "ch_ali", date(-1))).toBeNull();
  });
});
