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
