"use client";

// /admin/* — every mutation is audit-logged (FR-ADM-1).

import { dbStore, write, net } from "./db";
import { requireUser, audit, notify } from "./guards";
import { DAY, iso } from "./schema";
import { seed } from "./seed";
import type { UserStatus } from "../types";

export const adminApi = {
  // ------------------------------------------------------------ admin (/admin/*) — every mutation audited (FR-ADM-1)
  async setUserStatus(userId: string, status: UserStatus) {
    const u = requireUser(["admin"]);
    write((db) => {
      const target = db.users.find((x) => x.id === userId);
      if (!target) return;
      audit(db, u.id, "user.status", target.email, `${target.status} → ${status}`);
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
  async grantComp(userId: string, days: number) {
    const u = requireUser(["admin"]);
    write((db) => {
      db.subscriptions = db.subscriptions.filter((s) => s.userId !== userId);
      db.subscriptions.push({ userId, plan: "monthly", status: "active", until: iso(Date.now() + days * DAY) });
      audit(db, u.id, "subscription.comp", userId, `${days} days`);
    });
    return net(true);
  },
  /** Resets the whole demo database to the seed (keeps you logged out). */
  resetDemo() {
    dbStore.set(seed());
  },
};
