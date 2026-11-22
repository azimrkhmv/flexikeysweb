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
  /** POST /admin/center-links (B113): a partner centre's sign-up link, https://flexikeys.org/?ref=<code>. */
  async createCenterLink(name: string, rawCode: string) {
    const u = requireUser(["admin"]);
    const code = rawCode.trim().toLowerCase();
    if (!name.trim() || !/^[a-z0-9][a-z0-9-]{1,31}$/.test(code)) throw new ApiError("invalid_ref_code");
    if (read().centerLinks?.some((l) => l.code === code)) throw new ApiError("code_taken");
    write((db) => {
      const link = { id: crypto.randomUUID(), name: name.trim().slice(0, 80), code, at: new Date().toISOString() };
      (db.centerLinks ??= []).push(link);
      audit(db, u.id, "center_link.created", link.id, code);
    });
    return net(true);
  },
  /** POST /admin/families/{id}/payments (B114): a payment taken by hand; the family is paid (Pro) until the end of
   * `paidUntil` (YYYY-MM-DD, Tashkent), or longer if it already was. */
  async recordPayment(familyId: string, p: { amountUzs: number; method: string; paidUntil: string; note: string }) {
    const u = requireUser(["admin"]);
    if (!(p.amountUzs >= 1) || !p.method.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(p.paidUntil)) throw new ApiError("generic");
    if (!read().familyMembers.some((m) => m.familyId === familyId && m.role === "owner")) throw new ApiError("no_family");
    write((db) => {
      const id = crypto.randomUUID();
      (db.manualPayments ??= []).push({ id, familyId, amountUzs: Math.round(p.amountUzs), method: p.method.trim().slice(0, 40), paidUntil: p.paidUntil, note: p.note.trim().slice(0, 300), at: new Date().toISOString() });
      const end = new Date(Date.parse(`${p.paidUntil}T00:00:00+05:00`) + 86_400_000).toISOString();
      const row = db.familyPlans.find((r) => r.familyId === familyId);
      if (!row) db.familyPlans.push({ familyId, paidUntil: end });
      else if (!row.paidUntil || row.paidUntil < end) row.paidUntil = end;
      audit(db, u.id, "payment.recorded", familyId, String(p.amountUzs));
    });
    return net(true);
  },
  /** Resets the whole demo database to the seed (keeps you logged out). */
  resetDemo() {
    dbStore.set(seed());
    syncSession();
  },
};
