"use client";

// ponytail: in-browser mock of the FastAPI backend (PRD §14), split by domain. Every mutation is shaped like its
// endpoint (comment above each) so swapping a body for `fetch("/api/v1/...")` stays inside lib/api/.
// Reads go through `useDb()` + the pure selectors; pages use the hooks in lib/queries.ts.
// All authorization lives here (never in components), mirroring `can_access_child` (PRD §15.4).

import { AAC_CARDS } from "@/content/aac";
import { adminApi } from "./admin";
import { aiApi } from "./ai";
import { authApi } from "./auth";
import { billingApi } from "./billing";
import { careApi } from "./care";
import { childrenApi } from "./children";
import { playApi } from "./play";
import { teacherApi } from "./teacher";

export { ApiError, CONSENT_VERSION, DB_VERSION, DEMO_PASSWORD, makeCode, PRICES, type ChildAuth, type DB } from "./schema";
export { seed } from "./seed";
export { dbStore, useDb } from "./db";
export { sel } from "./selectors";

export const api = { ...authApi, ...childrenApi, ...playApi, ...careApi, ...teacherApi, ...aiApi, ...billingApi, ...adminApi };

export const AAC_CORE = AAC_CARDS.filter((c) => c.core);
