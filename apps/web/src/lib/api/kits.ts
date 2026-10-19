"use client";

// /family/kit-orders — Home Kit (spec §9). Owner only; no money passes here yet (simulated until after the pilot).

import { KIT } from "@/content/kits";
import { normalizePhone } from "./auth";
import { read, write, net } from "./db";
import { audit, requireUser } from "./guards";
import { ApiError, id, iso } from "./schema";
import { sel } from "./selectors";
import type { KitDelivery, KitOrder } from "../types";

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
};
