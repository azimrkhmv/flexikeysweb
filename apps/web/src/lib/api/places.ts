"use client";

// /places/* — Find help (spec §11). The search itself is a read (sel.places).

import { read, write, net } from "./db";
import { audit, requireUser } from "./guards";
import { ApiError, iso } from "./schema";
import { sel } from "./selectors";
import type { ReportReason } from "../types";

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
};
