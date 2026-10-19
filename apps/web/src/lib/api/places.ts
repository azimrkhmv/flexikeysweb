"use client";

// /places/* — Find help (spec §11). The search itself is a read (sel.places).

import { read, write, net } from "./db";
import { audit, requireChildAccess, requireUser, FAMILY } from "./guards";
import { ApiError, DAY, id, iso } from "./schema";
import { sel } from "./selectors";
import type { Booking, BookingMode, ReportReason, Slot } from "../types";

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

  // ------------------------------------------------------------ the clinic (/clinic/*)
  /** POST /clinic/places/{id}/slots — 422 slot_in_past, slot_too_far (over 3 months ahead); 409 slot_overlaps. */
  async addSlot(placeId: string, input: Omit<Slot, "id" | "placeId">) {
    const u = myPlace(placeId);
    const start = Date.parse(input.startsAt);
    if (start <= Date.now()) throw new ApiError("slot_in_past");
    if (start > Date.now() + 90 * DAY) throw new ApiError("slot_too_far");
    if (!input.inPerson && !input.online) throw new ApiError("invalid_slot");
    const end = start + input.minutes * 60_000;
    const same = read().slots.filter((s) => s.placeId === placeId && (s.specialist ?? null) === (input.specialist || null));
    if (same.some((s) => Date.parse(s.startsAt) < end && Date.parse(s.startsAt) + s.minutes * 60_000 > start)) throw new ApiError("slot_overlaps");
    const slot: Slot = { ...input, specialist: input.specialist || undefined, id: id(), placeId };
    write((db) => {
      db.slots.push(slot);
      audit(db, u.id, "slot.added", placeId);
    });
    return net(slot);
  },
  /** DELETE /clinic/places/{id}/slots/{id} — 409 slot_booked: cancel the booking first, so the family is told. */
  async removeSlot(placeId: string, slotId: string) {
    myPlace(placeId);
    if (read().bookings.some((b) => b.slotId === slotId && b.status !== "cancelled")) throw new ApiError("slot_booked");
    write((db) => {
      db.slots = db.slots.filter((s) => !(s.id === slotId && s.placeId === placeId));
    });
    return net(true);
  },
  /** POST /clinic/bookings/{id}/confirm — an online session needs its link (422 online_link_needed). */
  async confirmBooking(bookingId: string, onlineLink?: string) {
    const { user, booking } = clinicBooking(bookingId);
    if (booking.status === "cancelled") throw new ApiError("booking_cancelled");
    const link = onlineLink?.trim() || booking.onlineLink;
    if (booking.mode === "online" && !link) throw new ApiError("online_link_needed");
    if (link && !/^https:\/\//.test(link)) throw new ApiError("invalid_link");
    write((db) => {
      Object.assign(db.bookings.find((b) => b.id === bookingId)!, { status: "confirmed", onlineLink: link });
      audit(db, user.id, "booking.confirmed", booking.childId);
    });
    return net(true);
  },
  /** POST /clinic/bookings/{id}/cancel */
  async clinicCancelBooking(bookingId: string) {
    const { user, booking } = clinicBooking(bookingId);
    write((db) => {
      const b = db.bookings.find((x) => x.id === bookingId)!;
      if (b.status !== "cancelled") Object.assign(b, { status: "cancelled", cancelledBy: "clinic" });
      audit(db, user.id, "booking.cancelled", booking.childId);
    });
    return net(true);
  },
};

/** The signed-in clinic, if this place is its own (another clinic's place does not exist for it: 404). */
function myPlace(placeId: string) {
  const u = requireUser(["clinic"]);
  if (sel.place(read(), placeId)?.clinicId !== u.id) throw new ApiError("not_found");
  return u;
}

function clinicBooking(bookingId: string) {
  const db = read();
  const booking = db.bookings.find((b) => b.id === bookingId);
  const slot = booking && db.slots.find((s) => s.id === booking.slotId);
  if (!booking || !slot) throw new ApiError("not_found");
  return { user: myPlace(slot.placeId), booking };
}
