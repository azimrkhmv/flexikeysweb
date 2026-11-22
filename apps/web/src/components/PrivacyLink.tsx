"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

/** "Privacy policy", opening /privacy in a new tab (B112): on sign-up and on every consent screen. */
export function PrivacyLink({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <Link href="/privacy" target="_blank" className={`text-sm font-bold text-primary underline-offset-2 hover:underline ${className}`}>
      {t("privacy.link")}
    </Link>
  );
}
