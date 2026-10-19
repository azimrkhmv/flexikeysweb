"use client";

// /children/* — consent-first creation, edit, export, delete, consent changes.

import { read, write, net } from "./db";
import { requireUser, requireChildAccess, audit, childRows, purgeChild, FAMILY } from "./guards";
import { ApiError, CONSENT_VERSION, DAY, id, iso, MAX_HELPERS } from "./schema";
import { normalizePhone } from "./auth";
import { sel } from "./selectors";
import { REPEAT_MS, type AccessSettings } from "../playcheck";
import type { Child, ChildSupport, ConsentScope, Note } from "../types";

/** The family this person owns; 403 owner_only for anyone else (a helper too). */
function ownFamilyOrThrow(userId: string) {
  const familyId = sel.ownFamily(read(), userId);
  if (!familyId) throw new ApiError("owner_only");
  return familyId;
}

export const childrenApi = {
  // ------------------------------------------------------------ helpers (A8.4): one second adult per family
  /** POST /family/helpers — the owner invites a second adult by phone. */
  async inviteHelper(contact: string) {
    const user = requireUser(["parent"]);
    const familyId = ownFamilyOrThrow(user.id);
    const phone = normalizePhone(contact);
    if (!phone) throw new ApiError("invalid_phone");
    const db = read();
    if (sel.helpers(db, familyId).helpers.length >= MAX_HELPERS) throw new ApiError("too_many_helpers");
    const person = db.users.find((u) => u.phone === phone);
    if (person && person.role !== "parent") throw new ApiError("not_a_parent");
    if (person && db.familyMembers.some((m) => m.familyId === familyId && m.userId === person.id)) throw new ApiError("already_member");
    if (sel.helpers(db, familyId).invites.some((i) => i.phone === phone)) throw new ApiError("already_invited");
    const invite = { id: id(), familyId, phone, at: iso(Date.now() + 7 * DAY) };
    write((d) => {
      d.helperInvites.push(invite);
      audit(d, user.id, "family.helper_invited", familyId);
    });
    return net(invite);
  },
  /** DELETE /family/helpers/{user_id} — access to the family's children ends at once. */
  async removeHelper(userId: string) {
    const user = requireUser(["parent"]);
    const familyId = ownFamilyOrThrow(user.id);
    write((d) => {
      d.familyMembers = d.familyMembers.filter((m) => !(m.familyId === familyId && m.userId === userId && m.role === "helper"));
      audit(d, user.id, "family.helper_removed", familyId);
    });
    return net(true);
  },
  async cancelHelperInvite(inviteId: string) {
    const user = requireUser(["parent"]);
    const familyId = ownFamilyOrThrow(user.id);
    write((d) => {
      d.helperInvites = d.helperInvites.filter((i) => !(i.id === inviteId && i.familyId === familyId));
    });
    return net(true);
  },
  /** POST /me/helper-invites/{id}/accept — join the family as its helper. */
  async acceptHelperInvite(inviteId: string) {
    const user = requireUser(["parent"]);
    const invite = read().helperInvites.find((i) => i.id === inviteId && i.phone === user.phone);
    if (!invite) throw new ApiError("invite_invalid");
    if (sel.helpers(read(), invite.familyId).helpers.length >= MAX_HELPERS) throw new ApiError("too_many_helpers");
    write((d) => {
      d.familyMembers.push({ familyId: invite.familyId, userId: user.id, role: "helper" });
      d.helperInvites = d.helperInvites.filter((i) => i.id !== inviteId);
      audit(d, user.id, "family.helper_joined", invite.familyId);
    });
    return net(true);
  },

  // ------------------------------------------------------------ children (/children/*)
  /** PATCH /children/{id} */
  async updateChild(childId: string, patch: Partial<Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access">>) {
    requireChildAccess(childId, ["owner", "admin"]);
    write((db) => Object.assign(db.children.find((c) => c.id === childId)!, patch));
    return net(true);
  },
  /** PATCH /children/{id} {support} — parent, or a linked therapist (access settings are clinical work). Audited. */
  async updateSupport(childId: string, support: ChildSupport) {
    const { user } = requireChildAccess(childId, ["owner", "therapist", "admin"]);
    write((db) => {
      db.children.find((c) => c.id === childId)!.support = support;
      audit(db, user.id, "child.support", childId, JSON.stringify(support));
    });
    return net(true);
  },
  /**
   * PUT /children/{id}/access {inputMode, minTargetMm, dwellMs, repeatLock, releaseOk, helpedByAdult} — the play
   * check's stage 1 (spec §7). Every game reads them: the access mode, and floors for hold time, repeat guard and
   * button size (adaptive.ts withFloors), so the games never go below what the check found.
   */
  async saveAccessSettings(childId: string, s: AccessSettings, helpedByAdult: boolean) {
    requireChildAccess(childId, FAMILY);
    if (s.minTargetMm < 12 || s.dwellMs < 500 || s.dwellMs > 3000) throw new ApiError("invalid_answer"); // spec ranges
    write((db) => {
      db.accessProfiles = [...db.accessProfiles.filter((a) => a.childId !== childId), { childId, ...s, helpedByAdult, at: iso() }];
      const child = db.children.find((c) => c.id === childId)!;
      const floors = { ...child.support?.floors };
      if (s.inputMode === "dwell") floors.dwellMs = s.dwellMs;
      if (s.repeatLock) floors.debounceMs = Math.max(floors.debounceMs ?? 0, REPEAT_MS);
      // ponytail: 20 mm is about the smallest button games draw (76 px); a bigger floor scales every button up.
      if (s.minTargetMm > 20) floors.targetScale = Math.round((s.minTargetMm / 20) * 100) / 100;
      child.access = s.inputMode === "dwell" ? "dwell" : s.inputMode === "switch" ? "scan" : "touch";
      child.support = { ...child.support, floors };
    });
    return net(true);
  },
  /** DELETE /children/{id} */
  async deleteChild(childId: string) {
    const { user } = requireChildAccess(childId, ["owner", "admin"]);
    write((db) => {
      purgeChild(db, childId);
      audit(db, user.id, "child.delete", childId);
    });
    return net(true);
  },
  /** GET /children/{id}/export — everything we hold about the child (FR-CHILD-3). */
  async exportChild(childId: string) {
    requireChildAccess(childId, ["owner", "admin"]);
    const db = read();
    const { notes, ...rows } = childRows(db, childId);
    const sessionIds = new Set(sel.sessions(db, childId).map((s) => s.id));
    return net({
      exportedAt: iso(),
      child: sel.child(db, childId),
      ...rows,
      events: db.events.filter((e) => sessionIds.has(e.sessionId)),
      notesVisibleToParent: ((notes ?? []) as Note[]).filter((n) => n.visibleToParent), // a therapist's own notes stay theirs
    });
  },
  /** POST /children/{id}/consent — grant or withdraw one scope. */
  async setConsent(childId: string, scope: ConsentScope, granted: boolean) {
    const { user } = requireChildAccess(childId, ["owner"]);
    if (scope === "core" && !granted) throw new ApiError("core_consent_required_use_delete");
    write((db) => {
      const cur = db.consents.find((c) => c.childId === childId && c.scope === scope && !c.withdrawnAt);
      if (granted && !cur) db.consents.push({ id: id(), childId, scope, version: CONSENT_VERSION, grantedBy: user.id, grantedAt: iso() });
      if (!granted && cur) cur.withdrawnAt = iso();
      // Health answers are deleted with the consent; without them exercises can't be kept safe (spec §4).
      if (!granted && scope === "health") {
        db.intakeAnswers = db.intakeAnswers.filter((a) => !(a.childId === childId && /^P(9|1[0-7])(_|$)/.test(a.questionId)));
        db.roadmaps.forEach((r) => {
          if (r.childId !== childId) return;
          r.exercisesAllowed = false;
          r.days.forEach((d) => (d.exercises = []));
        });
      }
      if (!granted && scope === "therapist_sharing")
        db.careLinks.forEach((l) => {
          if (l.childId === childId && l.kind === "therapist" && l.status !== "revoked") Object.assign(l, { status: "revoked", revokedAt: iso() });
        });
    });
    return net(true);
  },
};
