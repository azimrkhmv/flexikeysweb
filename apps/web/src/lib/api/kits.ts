"use client";

// /family/kit-orders — Home Kit (spec §9). Owner only; no money passes here yet (simulated until after the pilot).

import { KIT } from "@/content/kits";
import { normalizePhone } from "./auth";
import { read, write, net } from "./db";
import { audit, requireUser } from "./guards";
import { ApiError, id, iso } from "./schema";
import { sel } from "./selectors";
import type { KitDelivery, KitOrder, KitStatus } from "../types";

/** What an admin may move an order to next; a cancelled or delivered order stays as it is (the server's NEXT). */
export const KIT_NEXT: Partial<Record<KitStatus, KitStatus[]>> = { placed: ["confirmed", "cancelled"], confirmed: ["shipped", "cancelled"], shipped: ["delivered"] };

export interface KitOrderInput {
  childId: string;
  delivery: KitDelivery;
  region: string;
  district: string;
  address?: string;
  pickupPlaceId?: string;
  phone: string;
  allergy?: "yes" | "no";
  allergyWhich?: string;
}

/** The family the signed-in parent owns (403 owner_only for a helper). */
function ownerFamily() {
  const u = requireUser(["parent"]);
  const familyId = sel.ownFamily(read(), u.id);
  if (!familyId) throw new ApiError("owner_only");
  return { user: u, familyId };
}

export const kitsApi = {
  /** POST /family/kit-orders — 422 allergy_needed (P17a unanswered, or "yes" without which materials),
   *  address_needed, unknown_place, invalid_phone. */
  async orderKit(input: KitOrderInput) {
    const { user, familyId } = ownerFamily();
    const db = read();
    if (sel.child(db, input.childId)?.familyId !== familyId) throw new ApiError("not_found");
    const which = input.allergyWhich?.trim() || undefined;
    if (!input.allergy || (input.allergy === "yes" && !which)) throw new ApiError("allergy_needed");
    const address = input.address?.trim();
    if (input.delivery === "courier" && !address) throw new ApiError("address_needed");
    if (input.delivery === "pickup" && !sel.place(db, input.pickupPlaceId ?? "")) throw new ApiError("unknown_place");
    const phone = normalizePhone(input.phone);
    if (!phone) throw new ApiError("invalid_phone");
    const now = iso();
    const order: KitOrder = {
      id: id(), familyId, childId: input.childId, productSlug: KIT.slug, items: KIT.items, priceSom: KIT.priceSom, delivery: input.delivery,
      region: input.region, district: input.district, address: input.delivery === "courier" ? address : undefined,
      pickupPlaceId: input.delivery === "pickup" ? input.pickupPlaceId : undefined, phone, allergy: input.allergy,
      allergyWhich: input.allergy === "yes" ? which : undefined, status: "placed", statusAt: now, createdAt: now,
    };
    write((d) => {
      d.kitOrders.push(order);
      audit(d, user.id, "kit.ordered", input.childId, KIT.slug);
    });
    return net(order);
  },
  /** POST /family/kit-orders/{id}/cancel — while still placed (409 too_late after our team confirmed it). */
  async cancelKitOrder(orderId: string) {
    const { user, familyId } = ownerFamily();
    const order = read().kitOrders.find((o) => o.id === orderId && o.familyId === familyId);
    if (!order) throw new ApiError("not_found");
    if (order.status !== "placed") throw new ApiError("too_late");
    write((d) => {
      Object.assign(d.kitOrders.find((o) => o.id === orderId)!, { status: "cancelled", statusAt: iso() });
      audit(d, user.id, "kit.cancelled", order.childId);
    });
    return net(true);
  },

  // ------------------------------------------------------------ our team (/admin/kit-orders)
  /** PATCH /admin/kit-orders/{id} — 409 invalid_status_change; an order with material allergies is confirmed only
   *  once the box's materials were checked (409 allergy_not_checked). */
  async moveKitOrder(orderId: string, status: KitStatus, allergyChecked = false) {
    const u = requireUser(["admin"]);
    const order = read().kitOrders.find((o) => o.id === orderId);
    if (!order) throw new ApiError("not_found");
    if (!KIT_NEXT[order.status]?.includes(status)) throw new ApiError("invalid_status_change");
    if (status === "confirmed" && order.allergy === "yes" && !allergyChecked) throw new ApiError("allergy_not_checked");
    write((d) => {
      const o = d.kitOrders.find((x) => x.id === orderId)!;
      Object.assign(o, { status, statusAt: iso() }, status === "confirmed" && o.allergy === "yes" ? { allergyChecked: true } : {});
      audit(d, u.id, `kit.${status}`, o.childId);
    });
    return net(true);
  },
};
