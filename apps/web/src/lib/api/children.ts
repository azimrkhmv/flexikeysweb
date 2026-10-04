"use client";

// /children/* — consent-first creation, edit, export, delete, consent changes.

import { read, write, net } from "./db";
import { requireUser, requireChildAccess, audit, purgeChild } from "./guards";
import { ApiError, CONSENT_VERSION, id, iso } from "./schema";
import { sel } from "./selectors";
import type { Child, ChildSupport, ConsentScope } from "../types";

export const childrenApi = {
  // ------------------------------------------------------------ children (/children/*)
  /** POST /children — consent + child in one transaction; core consent is mandatory (FR-CHILD-1). */
  async createChild(input: Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access" | "support">, scopes: ConsentScope[]) {
    const u = requireUser(["parent"]);
    if (!u.emailVerified) throw new ApiError("email_not_verified");
    if (!scopes.includes("core")) throw new ApiError("consent_required");
    if (!input.name.trim()) throw new ApiError("name_required");
    const child: Child = { ...input, name: input.name.trim(), id: id(), parentId: u.id, equipped: {}, createdAt: iso() };
    write((db) => {
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
      if (!granted && scope === "school_sharing") db.enrollments = db.enrollments.filter((e) => e.childId !== childId);
      if (!granted && scope === "therapist_sharing")
        db.careLinks.forEach((l) => {
          if (l.childId === childId && l.kind === "therapist" && l.status !== "revoked") Object.assign(l, { status: "revoked", revokedAt: iso() });
        });
    });
    return net(true);
  },
};
