"use client";

// Care links (therapists), class membership from the parent side, therapist notes/goals/recommendations.

import { read, write, net } from "./db";
import { requireUser, requireChildAccess, audit, notify } from "./guards";
import { ApiError, id, iso, makeCode } from "./schema";
import { sel } from "./selectors";
import type { CareLink } from "../types";

export const careApi = {
  // ------------------------------------------------------------ care links & classes (parent side)
  /** POST /parent/children/{id}/care-links */
  async inviteCare(childId: string, email: string, kind: "therapist" | "teacher" = "therapist") {
    const { user } = requireChildAccess(childId, ["owner"]);
    if (!sel.hasConsent(read(), childId, "therapist_sharing")) throw new ApiError("consent_required");
    const link: CareLink = { id: id(), childId, kind, email: email.trim().toLowerCase(), status: "invited", code: makeCode(), createdAt: iso() };
    write((db) => {
      db.careLinks.push(link);
      const pro = db.users.find((u) => u.email === link.email);
      notify(db, pro?.id ?? null, "notif.care_invite", { name: sel.child(db, childId)?.name ?? "" });
      audit(db, user.id, "care_link.invite", childId);
    });
    return net(link);
  },
  /** DELETE /parent/care-links/{id} — access stops immediately (FR-PAR-2). */
  async revokeCare(linkId: string) {
    const link = read().careLinks.find((l) => l.id === linkId);
    if (!link) throw new ApiError("not_found");
    const { user } = requireChildAccess(link.childId, ["owner"]);
    write((db) => {
      Object.assign(db.careLinks.find((l) => l.id === linkId)!, { status: "revoked", revokedAt: iso() });
      audit(db, user.id, "care_link.revoke", link.childId);
    });
    return net(true);
  },
  /** POST /teacher/classes/join — parent links own child with a class code; needs school_sharing (fixes B4). */
  async joinClass(childId: string, code: string) {
    requireChildAccess(childId, ["owner"]);
    if (!sel.hasConsent(read(), childId, "school_sharing")) throw new ApiError("consent_required");
    const k = read().classes.find((c) => c.code === code.trim().toUpperCase());
    if (!k) throw new ApiError("class_code_invalid");
    write((db) => {
      if (!db.enrollments.some((e) => e.classId === k.id && e.childId === childId)) db.enrollments.push({ classId: k.id, childId });
      notify(db, k.teacherId, "notif.class_joined", { name: sel.child(db, childId)?.name ?? "" });
    });
    return net(k);
  },
  /** DELETE enrollment by parent. */
  async leaveClass(childId: string, classId: string) {
    requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.enrollments = db.enrollments.filter((e) => !(e.childId === childId && e.classId === classId));
    });
    return net(true);
  },

  // ------------------------------------------------------------ therapist (/therapist/*)
  /** POST /therapist/care-links/{id}/accept (by code) */
  async acceptInvite(code: string) {
    const u = requireUser(["therapist"]);
    if (u.status !== "active") throw new ApiError("pending_verification");
    const link = read().careLinks.find((l) => l.code === code.trim().toUpperCase() && l.status === "invited");
    if (!link) throw new ApiError("invite_invalid");
    write((db) => {
      Object.assign(db.careLinks.find((l) => l.id === link.id)!, { status: "active", professionalId: u.id });
      const child = sel.child(db, link.childId);
      notify(db, child?.parentId ?? null, "notif.care_accepted", { name: child?.name ?? "" });
    });
    return net(true);
  },
  /** Every therapist read is audit-logged (FR-THR-2). */
  async logChildRead(childId: string) {
    const { user, rel } = requireChildAccess(childId, ["therapist", "teacher", "admin", "owner"]);
    if (rel === "therapist" || rel === "admin")
      write((db) => audit(db, user.id, "child.read", childId));
    return net(true, 0);
  },
  async addNote(childId: string, text: string, visibleToParent: boolean) {
    const { user } = requireChildAccess(childId, ["therapist"]);
    write((db) => {
      db.notes.unshift({ id: id(), childId, authorId: user.id, text: text.trim(), visibleToParent, createdAt: iso() });
      if (visibleToParent) notify(db, sel.child(db, childId)?.parentId ?? null, "notif.therapist_note", { name: sel.child(db, childId)?.name ?? "" });
    });
    return net(true);
  },
  async addGoal(childId: string, text: string) {
    const { user } = requireChildAccess(childId, ["therapist"]);
    write((db) => {
      db.goals.push({ id: id(), childId, authorId: user.id, text: text.trim(), done: false, createdAt: iso() });
    });
    return net(true);
  },
  async toggleGoal(goalId: string) {
    const g = read().goals.find((x) => x.id === goalId);
    if (!g) throw new ApiError("not_found");
    requireChildAccess(g.childId, ["therapist"]);
    write((db) => {
      const goal = db.goals.find((x) => x.id === goalId)!;
      goal.done = !goal.done;
    });
    return net(true, 0);
  },
  /** Therapist recommendation → appears as a suggestion for the child and parent. */
  async recommend(childId: string, levelId: string, note: string) {
    const { user } = requireChildAccess(childId, ["therapist"]);
    write((db) => {
      db.assignments.push({ id: id(), kind: "therapist", byUserId: user.id, childId, levelId, note: note.trim(), createdAt: iso() });
    });
    return net(true);
  },
};
