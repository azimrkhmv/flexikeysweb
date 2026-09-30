"use client";

// ponytail: in-browser mock of the FastAPI backend (PRD §14), split by domain. Every mutation is shaped like its
// endpoint (comment above each) so swapping a body for `fetch("/api/v1/...")` stays inside lib/api/.
// Reads go through `useDb()` + the pure selectors in selectors.ts.
// NEXT_PUBLIC_API_MODE=live swaps in the real backend for the connected areas (lib/live/); every other
// call then fails with "not_available" instead of quietly writing to the mock.
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
import { liveApi } from "../live/api";
import { useLiveDb } from "../live/db";
import { useDb as useMockDb } from "./db";
import { LIVE } from "./mode";
import { ApiError } from "./schema";

export { ApiError, CONSENT_VERSION, DB_VERSION, DEMO_PASSWORD, makeCode, PRICES, type ChildAuth, type DB } from "./schema";
export { seed } from "./seed";
export { dbStore } from "./db";
export { LIVE } from "./mode";
export { sel } from "./selectors";

const mockApi = { ...authApi, ...childrenApi, ...playApi, ...careApi, ...teacherApi, ...aiApi, ...billingApi, ...adminApi };

const notConnected = Object.fromEntries(
  Object.keys(mockApi).map((k) => [k, async () => Promise.reject(new ApiError("not_available"))]),
) as unknown as typeof mockApi;

export const api: typeof mockApi = LIVE ? { ...notConnected, resetDemo: () => {}, ...liveApi } : mockApi;
export const useDb = LIVE ? useLiveDb : useMockDb;

export const AAC_CORE = AAC_CARDS.filter((c) => c.core);
