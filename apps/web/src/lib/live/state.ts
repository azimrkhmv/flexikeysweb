"use client";

import type { ChildAuth } from "@/lib/api/schema";
import { persisted } from "@/lib/store";

/**
 * Which child is playing on this device. Only a marker: the real credential is the httpOnly fk_child
 * cookie the API sets, which JavaScript can't read. Holds a pseudonymous id, no personal data.
 */
export const liveChild = persisted<ChildAuth | null>("fk_live_child", null);
