"use client";

// /billing/* — simulated Payme/Click checkout; entitlements never affect rewards.

import { write, net } from "./db";
import { requireUser, notify } from "./guards";
import { PRICES, DAY, id, iso } from "./schema";
import { sel } from "./selectors";
import type { Order, Plan } from "../types";

export const billingApi = {
  // ------------------------------------------------------------ billing (/billing/*)
  /** POST /billing/checkout → provider page → merchant callback (simulated) → entitlement. */
  async checkout(plan: Exclude<Plan, "free">, provider: "payme" | "click") {
    const u = requireUser(["parent"]);
    const order: Order = { id: id(), userId: u.id, plan, amountTiyin: PRICES[plan], provider, state: "created", createdAt: iso() };
    write((db) => {
      db.orders.unshift(order);
    });
    await net(true, 900); // redirect to provider sandbox + PerformTransaction / Complete callback
    write((db) => {
      const o = db.orders.find((x) => x.id === order.id)!;
      if (o.state !== "created") return; // idempotent: duplicate callbacks never double-credit (FR-BILL-1)
      o.state = "paid";
      const cur = sel.subscription(db, u.id);
      const base = cur.plan !== "free" && cur.until && cur.until > iso() ? Date.parse(cur.until) : Date.now();
      const until = iso(base + (plan === "monthly" ? 30 : 365) * DAY);
      db.subscriptions = db.subscriptions.filter((s) => s.userId !== u.id);
      db.subscriptions.push({ userId: u.id, plan, status: "active", until });
      notify(db, u.id, "notif.payment_ok");
    });
    return order;
  },
  /** Live: re-read the subscription and orders (after returning from the provider). Mock: nothing to do. */
  async refreshBilling() {
    return true;
  },
  /** POST /billing/cancel — keeps access until the paid period ends. */
  async cancelSubscription() {
    const u = requireUser(["parent"]);
    write((db) => {
      const s = db.subscriptions.find((x) => x.userId === u.id);
      if (s && s.plan !== "free") s.status = "canceled";
    });
    return net(true);
  },
};
