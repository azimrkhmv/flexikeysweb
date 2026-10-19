"use client";

// /places/* — Find help (spec §11). The search itself is a read (sel.places).

import { read, write, net } from "./db";
import { audit, requireChildAccess, requireUser, FAMILY } from "./guards";
import { ApiError, id, iso } from "./schema";
import { sel } from "./selectors";
import type { Booking, BookingMode, ReportReason } from "../types";

export const placesApi = {
  /** POST /places/{id}/reports — a wrong price or a closed place: our team checks it within 24 hours. A second report
   *  by the same person changes nothing. */
  async reportPlace(placeId: string, reason: ReportReason, note?: string) {
    const u = requireUser();
    if (!read().places.some((p) => p.id === placeId)) throw new ApiError("not_found");
    if (sel.placeReported(read(), placeId, u.id)) return net(true);
    write((db) => {
      db.placeReports.push({ placeId, userId: u.id, reason, note: note?.trim() || undefined, at: iso() });
      audit(db, u.id, "place.reported", placeId, reason);
    });
    return net(true);
  },
  /** POST /children/{id}/bookings — 409 slot_taken when someone booked it first; 422 slot_gone, mode_not_offered. */
  async book(childId: string, slotId: string, mode: BookingMode) {
    const { user } = requireChildAccess(childId, FAMILY);
    const db = read();
    const slot = db.slots.find((s) => s.id === slotId);
    if (!slot || Date.parse(slot.startsAt) <= Date.now()) throw new ApiError("slot_gone");
    if (!(mode === "online" ? slot.online : slot.inPerson)) throw new ApiError("mode_not_offered");
    if (!sel.freeSlots(db, slot.placeId).some((s) => s.id === slotId)) throw new ApiError("slot_taken");
    const booking: Booking = { id: id(), slotId, childId, bookedBy: user.id, mode, status: "booked", at: iso() };
    write((d) => {
      d.bookings.push(booking);
      audit(d, user.id, "booking.made", childId);
    });
    return net(booking);
  },
  /** POST /children/{id}/bookings/{id}/cancel — the time is free again for others. */
  async cancelBooking(childId: string, bookingId: string) {
    const { user } = requireChildAccess(childId, FAMILY);
    if (!read().bookings.some((b) => b.id === bookingId && b.childId === childId)) throw new ApiError("not_found");
    write((d) => {
      const b = d.bookings.find((x) => x.id === bookingId)!;
      if (b.status !== "cancelled") Object.assign(b, { status: "cancelled", cancelledBy: "family" });
      audit(d, user.id, "booking.cancelled", childId);
    });
    return net(true);
  },
};
