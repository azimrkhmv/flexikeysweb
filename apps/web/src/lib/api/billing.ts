"use client";

// /family/trial, /family/pay — Free and Pro per family (spec §14); payments simulated until after the pilot.

import { read, write, net } from "./db";
import { requireUser } from "./guards";
import { ApiError, DAY, iso, type DB } from "./schema";
import { sel } from "./selectors";

/** The family the signed-in adult belongs to and whether they own it (the server's family_of). */
function myFamily() {
  const u = requireUser(["parent"]);
  const db = read();
  const familyId = sel.familyOf(db, u.id);
  if (!familyId) throw new ApiError("no_family");
  return { user: u, familyId, owner: sel.ownFamily(db, u.id) === familyId };
}

/** Inside write(): Pro for `days` more, from today or from when Pro already ends (the server's extend). */
export function extendPro(db: DB, familyId: string, days: number) {
  const row = db.familyPlans.find((p) => p.familyId === familyId) ?? { familyId };
  const from = Math.max(Date.now(), row.paidUntil ? Date.parse(row.paidUntil) : 0);
  db.familyPlans = db.familyPlans.filter((p) => p.familyId !== familyId).concat({ ...row, paidUntil: iso(from + days * DAY) });
}

export const billingApi = {
  // ------------------------------------------------------------ Free and Pro (/family/*, spec §14)
  /** POST /family/trial — the owner tries Pro for 7 days, once per family. */
  async startTrial() {
    const { familyId, owner } = myFamily();
    if (!owner) throw new ApiError("owner_only");
    if (sel.familyPlan(read(), familyId).trialUsed) throw new ApiError("trial_used");
    write((db) => {
      db.familyPlans = db.familyPlans.filter((p) => p.familyId !== familyId).concat({ ...db.familyPlans.find((p) => p.familyId === familyId), familyId, trialStartedAt: iso() });
    });
    return net(sel.familyPlan(read(), familyId));
  },
  /** POST /family/pay — a simulated payment (Telegram later, Q8): Pro for 30 days per month, from when Pro ends. */
  async payPro(months: number) {
    const { familyId, owner } = myFamily();
    if (!owner) throw new ApiError("owner_only");
    write((db) => extendPro(db, familyId, months * 30));
    return net(sel.familyPlan(read(), familyId), 600);
  },
};
