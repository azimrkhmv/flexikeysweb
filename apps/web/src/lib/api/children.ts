"use client";

// /children/* — consent-first creation, edit, export, delete, consent changes.

import { read, write, net } from "./db";
import { requireUser, requireChildAccess, audit, purgeChild, familyForNewChild } from "./guards";
import { ApiError, CONSENT_VERSION, id, iso } from "./schema";
import { sel } from "./selectors";
import { REPEAT_MS, type AccessSettings } from "../playcheck";
import type { Child, ChildSupport, ConsentScope } from "../types";

export const childrenApi = {
  // ------------------------------------------------------------ children (/children/*)
  /** POST /children — consent + child in one transaction; core consent is mandatory (FR-CHILD-1). */
  async createChild(input: Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access" | "support">, scopes: ConsentScope[]) {
    const u = requireUser(["parent"]);
    if (!u.emailVerified && !u.consentVersion) throw new ApiError("email_not_verified"); // phone sign-up = verified
    if (!scopes.includes("core")) throw new ApiError("consent_required");
    if (!input.name.trim()) throw new ApiError("name_required");
    const child: Child = { ...input, name: input.name.trim(), id: id(), familyId: null, equipped: {}, createdAt: iso() };
    write((db) => {
      child.familyId = familyForNewChild(db, u.id);
      db.children.push(child);
      scopes.forEach((scope) => db.consents.push({ id: id(), childId: child.id, scope, version: CONSENT_VERSION, grantedBy: u.id, grantedAt: iso() }));
      db.wallets.push({ childId: child.id, coins: 0, stars: 0, owned: [] });
    });
    return net(child);
  },
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
    requireChildAccess(childId, ["owner"]);
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
    const by = <T extends { childId?: string }>(xs: T[]) => xs.filter((x) => x.childId === childId);
    return net({
      exportedAt: iso(),
      child: sel.child(db, childId),
      consents: by(db.consents),
      intakeAnswers: by(db.intakeAnswers),
      intakeRounds: by(db.intakeRounds),
      roadmaps: by(db.roadmaps),
      adaptiveProfiles: by(db.profiles),
      adaptationChanges: by(db.changes),
      sessions: by(db.sessions),
      mastery: by(db.mastery),
      progress: by(db.progress),
      wallet: sel.wallet(db, childId),
      aacEvents: by(db.aacEvents),
      aacCustomCards: by(db.aacCards),
      careLinks: by(db.careLinks),
      notesVisibleToParent: by(db.notes).filter((n) => n.visibleToParent),
      goals: by(db.goals),
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
      if (!granted && scope === "school_sharing") db.enrollments = db.enrollments.filter((e) => e.childId !== childId);
      if (!granted && scope === "therapist_sharing")
        db.careLinks.forEach((l) => {
          if (l.childId === childId && l.kind === "therapist" && l.status !== "revoked") Object.assign(l, { status: "revoked", revokedAt: iso() });
        });
    });
    return net(true);
  },
};
