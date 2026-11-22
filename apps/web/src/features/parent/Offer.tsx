"use client";

import Link from "next/link";
import { useState } from "react";
import { Gift, LifeBuoy } from "lucide-react";
import { Card } from "@/components/ui";
import { fmtUzs, freeEndsAt, needsPayReminder, OFFER } from "@/content/offer";
import { sel, useDb } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import { SUPPORT_URL } from "@/lib/site";

// B114 (Update 4 spec 5.1): the offer, and a gentle reminder for the parent when the free month is over and the family
// is not marked paid. Parent pages only; nothing is ever locked because of it (TASKS.md Q19).

const offerVars = () => ({ days: OFFER.freeDays, price: fmtUzs(OFFER.priceUzs), months: OFFER.periodMonths });

/** The one-line offer (landing page, Account → Plan). */
export function OfferLine({ className = "" }: { className?: string }) {
  const t = useT();
  return <p className={`text-sm font-semibold text-muted ${className}`}>{t("offer.line", offerVars())}</p>;
}

function usePayState() {
  const db = useDb();
  const me = sel.me(db);
  const plan = sel.familyPlan(db, me ? sel.familyOf(db, me.id) : null);
  const [now] = useState(Date.now);
  const ends = freeEndsAt(me?.signedUpAt);
  return { me, ends, now, remind: !!me && me.role === "parent" && needsPayReminder(me.signedUpAt, plan.paidUntil ?? undefined, now) };
}

/** Account → Plan: the offer and when this family's free month ends. */
export function OfferCard() {
  const t = useT();
  const [lang] = useLang();
  const { ends, now, remind } = usePayState();
  return (
    <Card className="mb-6 space-y-2">
      <div className="flex items-center gap-2">
        <Gift className="size-5 text-primary" aria-hidden />
        <h2 className="text-lg font-extrabold text-ink">{t("offer.title")}</h2>
      </div>
      <OfferLine />
      {ends && <p className="text-sm text-ink">{t(Date.parse(ends) > now ? "offer.freeEnds" : "offer.freeEnded", { date: fmtDate(ends, lang) })}</p>}
      {remind && <PayReminderText />}
    </Card>
  );
}

function PayReminderText() {
  const t = useT();
  return (
    <p className="text-sm text-ink">
      {t("offer.reminder", offerVars())}{" "}
      {SUPPORT_URL && (
        <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer" className="font-extrabold text-primary underline">
          {t("offer.howToPay")}
        </a>
      )}
    </p>
  );
}

/** Overview: the same reminder, only when the free month is over and the family is not paid. */
export function PayReminder() {
  const t = useT();
  const { remind } = usePayState();
  if (!remind) return null;
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-hill2 bg-tint-2/60 p-4">
      <PayReminderText />
      <Link href="/parent/billing" className="text-sm font-extrabold text-ink underline">
        {t("plans.lock.see")}
      </Link>
    </div>
  );
}

/** The parent header's Help button: the team's Telegram in a new tab; hidden when NEXT_PUBLIC_SUPPORT_URL is empty. */
export function HelpButton() {
  const t = useT();
  if (!SUPPORT_URL) return null;
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      aria-label={`${t("help.button")} (${t("help.newTab")})`}
    >
      <LifeBuoy className="size-5" aria-hidden />
      <span className="hidden sm:inline">{t("help.button")}</span>
    </a>
  );
}
