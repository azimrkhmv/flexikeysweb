"use client";

// Client-side registration of the marketing strings (a server-side import never reaches the browser).
import "@/messages/public";
import { Check, Heart, Minus, Package, Sparkles } from "lucide-react";
import { LinkButton } from "@/components/ui";
import { KIT } from "@/content/kits";
import { PLAN_ROWS, PRO_PRICE_SOM } from "@/content/plans";
import { useT } from "@/lib/i18n";
import { fmtSum } from "@/lib/format";
import { useSessionRole } from "@/lib/session";

// B43 (spec §14): Free and Pro per family, the same table as the parent's billing page, and the Home Kit (§9).
// Placeholder prices until G3.

const Cell = ({ v }: { v: string }) => {
  const t = useT();
  if (v === "yes") return <Check className="mx-auto size-5 text-teal" aria-label={t("plans.yes")} />;
  if (v === "no") return <Minus className="mx-auto size-5 text-muted" aria-label={t("plans.no")} />;
  return <span className="text-sm">{t(v)}</span>;
};

export function PricingPage() {
  const t = useT();
  const parent = useSessionRole() === "parent";
  const card = "flex flex-col rounded-fk-lg border bg-surface p-6 shadow-soft sm:p-8";
  const price = (amount: string, per: string) => (
    <p className="mt-5 flex flex-wrap items-baseline gap-x-2">
      <span className="text-4xl font-extrabold text-ink">{amount}</span>
      <span className="font-bold text-ink-2">{t("mkt.currency")}</span>
      <span className="text-sm text-muted">{per}</span>
    </p>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">{t("mkt.pricing.title")}</h1>
        <p className="mt-4 text-lg text-ink-2">{t("mkt.pricing.lead")}</p>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <section className={`${card} border-line`} aria-labelledby="plan-free">
          <h2 id="plan-free" className="text-xl font-extrabold text-ink">{t("plans.col.free")}</h2>
          <p className="mt-1 text-sm text-muted">{t("mkt.pricing.free.d")}</p>
          {price("0", t("mkt.pricing.perMonth"))}
          <LinkButton href="/signup" variant="outline" className="mt-8 self-start">{t("mkt.pricing.free.cta")}</LinkButton>
        </section>
        <section className={`${card} border-primary ring-2 ring-primary`} aria-labelledby="plan-pro">
          <h2 id="plan-pro" className="flex items-center gap-2 text-xl font-extrabold text-ink">
            <Sparkles className="size-5 text-primary" aria-hidden /> {t("mkt.pricing.pro.name")}
          </h2>
          <p className="mt-1 text-sm text-muted">{t("mkt.pricing.pro.d")}</p>
          {price(fmtSum(PRO_PRICE_SOM * 100), t("mkt.pricing.perMonth"))}
          <p className="mt-2 text-sm font-bold text-teal">{t("mkt.pricing.pro.trial")}</p>
          <LinkButton href={parent ? "/parent/billing" : "/signup"} className="mt-8 self-start">{t("mkt.pricing.pro.cta")}</LinkButton>
        </section>
      </div>

      <section className={`${card} mt-6 overflow-x-auto border-line`} aria-labelledby="compare">
        <h2 id="compare" className="text-xl font-extrabold text-ink">{t("mkt.pricing.compare")}</h2>
        <table className="mt-4 w-full min-w-[28rem] text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-3" />
              <th scope="col" className="w-36 py-3 text-center text-lg font-extrabold">{t("plans.col.free")}</th>
              <th scope="col" className="w-36 py-3 text-center text-lg font-extrabold text-primary">{t("plans.col.pro")}</th>
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map(([key, free, pro]) => (
              <tr key={key} className="border-b border-line last:border-0">
                <th scope="row" className="py-3 pr-3 text-sm font-semibold text-ink">{t(`plans.row.${key}`)}</th>
                <td className="py-3 text-center text-ink-2"><Cell v={free} /></td>
                <td className="py-3 text-center text-ink"><Cell v={pro} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">{t("plans.price.placeholder")} {t("mkt.pricing.pay")}</p>
      </section>

      <section className={`${card} mt-6 border-line sm:flex-row sm:items-start sm:gap-6`} aria-labelledby="kit">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-sun-soft text-[#7a5a00]">
          <Package className="size-7" aria-hidden />
        </span>
        <div className="mt-4 flex-1 sm:mt-0">
          <h2 id="kit" className="text-xl font-extrabold text-ink">{t("mkt.pricing.kit.name")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{t("mkt.pricing.kit.d")}</p>
          {price(fmtSum(KIT.priceSom * 100), t("mkt.pricing.kit.per"))}
          <LinkButton href={parent ? "/parent/kit" : "/signup"} variant="soft" className="mt-6">{t("mkt.pricing.kit.cta")}</LinkButton>
        </div>
      </section>

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
