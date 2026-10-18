"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import { LIVE, sel, useDb } from "@/lib/api";
import { useMounted } from "@/lib/store";

/**
 * Pre-spec features (teacher/class, email sign-in) are hidden by the product spec of 2026-10-06. The `legacy`
 * flag (Admin → flags) brings them back in demo mode. The new server (live mode) has none of them (Q7: deleted).
 */
export function useLegacy() {
  const db = useDb();
  return !LIVE && sel.flag(db, "legacy");
}

/** [email sign-in, legacy on]. Email sign-in: /login?email=1 with the `legacy` flag (demo mode only). */
export function useEmailMode(): [boolean, boolean] {
  const mounted = useMounted();
  const legacy = useLegacy();
  const asked = mounted && new URLSearchParams(window.location.search).has("email");
  return [legacy && asked, legacy];
}

/** Renders a legacy area only while legacy features are on; otherwise goes home. */
export function LegacyOnly({ children }: { children: ReactNode }) {
  const mounted = useMounted();
  const legacy = useLegacy();
  const router = useRouter();
  useEffect(() => {
    if (mounted && !legacy) router.replace("/");
  }, [mounted, legacy, router]);
  return mounted && legacy ? <>{children}</> : <Spinner />;
}
