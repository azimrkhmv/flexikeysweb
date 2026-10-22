"use client";

// /admin/* — every mutation is audit-logged (FR-ADM-1).

import { extendPro } from "./billing";
import { dbStore, net, read, syncSession, write } from "./db";
import { requireUser, audit, notify } from "./guards";
import { ApiError } from "./schema";
import { sel } from "./selectors";
import { seed } from "./seed";
import type { UserStatus } from "../types";

export const adminApi = {
  /** POST /feedback — the pilot's "Send feedback" box, anyone signed in. */
  async sendFeedback(text: string, page: string) {
    const u = requireUser();
    if (!text.trim()) throw new ApiError("invalid_answer");
    write((db) => {
      (db.feedback ??= []).unshift({ id: crypto.randomUUID(), userId: u.id, page, text: text.trim().slice(0, 2000), at: new Date().toISOString() });
    });
    return net(true);
  },
  // ------------------------------------------------------------ admin (/admin/*) — every mutation audited (FR-ADM-1)
  async setUserStatus(userId: string, status: UserStatus) {
    const u = requireUser(["admin"]);
    write((db) => {
      const target = db.users.find((x) => x.id === userId);
      if (!target) return;
      audit(db, u.id, "user.status", target.id, `${target.status} → ${status}`);
      target.status = status;
      if (status === "active") notify(db, target.id, "notif.account_approved");
    });
    return net(true);
  },
  async setFlag(key: string, enabled: boolean) {
    const u = requireUser(["admin"]);
    write((db) => {
      const f = db.flags.find((x) => x.key === key);
      if (!f) return;
      audit(db, u.id, "flag.set", key, `${f.enabled} → ${enabled}`);
      f.enabled = enabled;
    });
    return net(true, 0);
  },
  /** POST /admin/users/{id}/pro — the family this parent owns gets Pro for some days (e.g. after paying by hand). */
  async grantComp(userId: string, days: number) {
    const u = requireUser(["admin"]);
    const familyId = sel.ownFamily(read(), userId);
    if (!familyId) throw new ApiError("no_family");
    write((db) => {
      extendPro(db, familyId, days);
      audit(db, u.id, "plan.upgraded", familyId, `${days} days`);
    });
    return net(true);
  },
  /** Resets the whole demo database to the seed (keeps you logged out). */
  resetDemo() {
    dbStore.set(seed());
    syncSession();
  },
};
