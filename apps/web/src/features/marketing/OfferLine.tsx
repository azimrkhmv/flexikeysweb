"use client";

import { fmtUzs, OFFER } from "@/content/offer";
import { useT } from "@/lib/i18n";

// B120: the one-line offer on its own, so the landing page does not load the account and payment code (and with it the
// demo database) from features/parent/Offer.tsx (Lighthouse on a slow phone, Update 4 spec 9).

export const offerVars = () => ({ days: OFFER.freeDays, price: fmtUzs(OFFER.priceUzs), months: OFFER.periodMonths });

/** The one-line offer (landing page, Account → Plan). */
export function OfferLine({ className = "" }: { className?: string }) {
  const t = useT();
  return <p className={`text-sm font-semibold text-muted ${className}`}>{t("offer.line", offerVars())}</p>;
}
