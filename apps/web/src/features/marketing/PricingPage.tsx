"use client";

// Client-side registration of the marketing strings (a server-side import never reaches the browser).
import "@/messages/public";
import { useState } from "react";
import { Check, Heart } from "lucide-react";
import { Chip, LinkButton } from "@/components/ui";
import { PRICES } from "@/lib/api/schema";
import { useT } from "@/lib/i18n";
import { fmtSum } from "@/lib/format";
import { useSessionRole } from "@/lib/session";


export function PricingPage() {
  const t = useT();
  const role = useSessionRole();
  const [yearly, setYearly] = useState(false);
  const save = Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100);
  const familyHref = role === "parent" ? "/parent/billing" : "/signup";

  const features = (prefix: string, n: number) => (
    <ul className="mt-6 flex-1 space-y-3">
      {Array.from({ length: n }, (_, i) => (
        <li key={i} className="flex gap-3 text-sm font-semibold text-ink">
          <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
          {t(`${prefix}.f${i + 1}`)}
        </li>
      ))}
    </ul>
  );

  const price = (amount: string, per?: string) => (
    <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
      <span className="text-4xl font-extrabold text-ink">{amount}</span>
      <span className="font-bold text-ink-2">{t("mkt.currency")}</span>
      {per && <span className="text-sm text-muted">{per}</span>}
    </p>
  );

  const card = "flex flex-col rounded-fk-lg border bg-surface p-6 shadow-soft sm:p-8";

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">{t("mkt.pricing.title")}</h1>
        <p className="mt-4 text-lg text-ink-2">{t("mkt.pricing.lead")}</p>
        <div role="group" aria-label={t("mkt.pricing.family.name")} className="mt-8 inline-flex rounded-full border border-line bg-surface p-1 shadow-soft">
          {[false, true].map((y) => (
            <button
              key={String(y)}
              type="button"
              aria-pressed={yearly === y}
              onClick={() => setYearly(y)}
              className={`h-10 rounded-full px-5 text-sm font-bold transition ${yearly === y ? "bg-primary text-white" : "text-ink-2 hover:bg-surface-2"}`}
            >
              {t(y ? "mkt.pricing.yearly" : "mkt.pricing.monthly")}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm font-bold text-teal">{t("mkt.pricing.save", { n: save })}</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        <section className={`${card} border-line`} aria-labelledby="plan-free">
          <h2 id="plan-free" className="text-xl font-extrabold text-ink">{t("mkt.pricing.free.name")}</h2>
          <p className="mt-1 text-sm text-muted">{t("mkt.pricing.free.d")}</p>
          {price(t("mkt.pricing.free.price"))}
          {features("mkt.pricing.free", 4)}
          <LinkButton href="/signup" variant="outline" className="mt-8">{t("mkt.pricing.free.cta")}</LinkButton>
        </section>

        <section className={`${card} relative border-primary ring-2 ring-primary lg:-my-3`} aria-labelledby="plan-family">
          <Chip tone="lavender" className="absolute -top-3 left-6">{t("mkt.pricing.popular")}</Chip>
          <h2 id="plan-family" className="text-xl font-extrabold text-ink">{t("mkt.pricing.family.name")}</h2>
          <p className="mt-1 text-sm text-muted">{t("mkt.pricing.family.d")}</p>
          {price(fmtSum(yearly ? PRICES.yearly : PRICES.monthly), t(yearly ? "mkt.pricing.perYear" : "mkt.pricing.perMonth"))}
          {features("mkt.pricing.family", 5)}
          <LinkButton href={familyHref} className="mt-8">{t("mkt.pricing.family.cta")}</LinkButton>
        </section>

        <section className={`${card} border-line`} aria-labelledby="plan-pro">
          <h2 id="plan-pro" className="text-xl font-extrabold text-ink">{t("mkt.pricing.pro.name")}</h2>
          <p className="mt-1 text-sm text-muted">{t("mkt.pricing.pro.d")}</p>
          <p className="mt-5 text-2xl font-extrabold text-teal">{t("mkt.pricing.pro.price")}</p>
          {features("mkt.pricing.pro", 3)}
          <LinkButton href="/signup" variant="soft" className="mt-8">{t("mkt.pricing.pro.cta")}</LinkButton>
        </section>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm font-bold text-ink-2">
        {t("mkt.pricing.pay")}
        <span className="rounded-xl border border-line bg-surface px-4 py-2 text-[#0b7285]">Payme</span>
        <span className="rounded-xl border border-line bg-surface px-4 py-2 text-[#2c63d6]">Click</span>
      </div>

      <div className="mx-auto mt-12 flex max-w-3xl gap-4 rounded-fk-lg bg-leaf-soft/70 p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface">
          <Heart className="size-6 text-[#2f6a37]" aria-hidden />
        </span>
        <div>
          <h2 className="font-extrabold text-ink">{t("mkt.pricing.rule.t")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{t("mkt.pricing.rule.d")}</p>
        </div>
      </div>

      <section className="mx-auto mt-16 max-w-3xl" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-2xl font-extrabold text-ink sm:text-3xl">{t("mkt.faq.title")}</h2>
        <div className="mt-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <details key={i} className="group rounded-fk border border-line bg-surface p-5 shadow-soft">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-ink [&::-webkit-details-marker]:hidden">
                {t(`mkt.faq.q${i}`)}
                <span aria-hidden className="text-xl text-muted transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-2">{t(`mkt.faq.a${i}`)}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
