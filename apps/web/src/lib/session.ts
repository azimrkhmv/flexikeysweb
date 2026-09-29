"use client";

import { persisted, useMounted, useStore } from "./store";
import type { Role } from "./types";

// Who is signed in, in its smallest form, for public pages (header "My dashboard" button, pricing CTA).
// Kept apart from the mock DB so marketing bundles don't pull in lib/api. With the real backend this becomes
// a non-sensitive "signed in as <role>" cookie next to the httpOnly session cookie.
export const sessionStore = persisted<{ role: Role | null }>("fk_session", { role: null });

/** Signed-in role, only after hydration (null on the server and for visitors). */
export function useSessionRole(): Role | null {
  const mounted = useMounted();
  const s = useStore(sessionStore);
  return mounted ? s.role : null;
}
