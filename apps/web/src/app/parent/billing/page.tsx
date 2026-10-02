"use client";

import { useEffect, useState } from "react";
import { Check, CreditCard } from "lucide-react";
import { Button, Card, Chip, PageHeader, useAction } from "@/components/ui";
import { fmtDate, fmtSum } from "@/lib/format";
import { LIVE, api, PRICES, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

type Period = "monthly" | "yearly";
type Provider = "payme" | "click";
const PROVIDERS: Record<Provider, string> = { payme: "Payme", click: "Click" };

function Billing() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const [period, setPeriod] = useState<Period>("yearly");
  const [provider, setProvider] = useState<Provider>("payme");
  const [paid, setPaid] = useState(false);
  const pay = useAction(api.checkout);
  const cancel = useAction(api.cancelSubscription);
  if (!me) return null;
  const sub = sel.subscription(db, me.id);
  const orders = sel.ordersOf(db, me.id);
  const kids = sel.childrenOf(db, me.id);
  const paidPlan = sub.plan !== "free" && sub.status !== "expired";
  // Live: back from Payme/Click with ?order=… — the server's word on that order.
  const returned = LIVE && typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("order") : null;
  const back = returned ? orders.find((o) => o.id === returned) : undefined;
  const price = (tiyin: number) => t("parent.billing.sum", { amount: fmtSum(tiyin) });

  return (
    <>
      <PageHeader title={t("parent.billing.title")} subtitle={t("parent.billing.subtitle")} />

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-lavender-soft text-[#4f43a0]">
          <CreditCard className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">{t("parent.billing.current")}</p>
          <p className="text-xl font-extrabold">
            {t(`parent.billing.plan.${sub.plan}`)} <Chip tone={sub.status === "active" ? "leaf" : "sun"}>{t(`parent.billing.status.${sub.status}`)}</Chip>
          </p>
          {sub.until && <p className="text-sm text-ink-2">{t(sub.status === "canceled" ? "parent.billing.accessUntil" : "parent.billing.renews", { date: fmtDate(sub.until, lang) })}</p>}
        </div>
        {paidPlan && sub.status === "active" && (
          <Button variant="outline" pending={cancel.pending} onClick={() => cancel.run()}>
            {t("parent.billing.cancel")}
          </Button>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h2 className="text-lg font-extrabold">{t("parent.billing.plan.free")}</h2>
          <p className="text-3xl font-extrabold">{price(0)}</p>
          <ul className="space-y-2 text-ink-2">
            {["parent.billing.free1", "parent.billing.free2", "parent.billing.free3"].map((k) => (
              <li key={k} className="flex gap-2">
                <Check className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden /> {t(k)}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="space-y-4 ring-2 ring-primary">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">{t("parent.billing.family")}</h2>
            <div role="radiogroup" aria-label={t("parent.billing.period")} className="flex rounded-full bg-surface-2 p-1">
              {(["monthly", "yearly"] as Period[]).map((p) => (
                <button key={p} type="button" role="radio" aria-checked={period === p} onClick={() => setPeriod(p)} className={`h-9 rounded-full px-4 text-sm font-bold ${period === p ? "bg-surface text-primary shadow-soft" : "text-ink-2"}`}>
                  {t(`parent.billing.plan.${p}`)}
                </button>
              ))}
            </div>
          </div>
          <p className="text-3xl font-extrabold">
            {price(PRICES[period])} <span className="text-base font-bold text-muted">/ {t(`parent.billing.per.${period}`)}</span>
          </p>
          {period === "yearly" && <Chip tone="leaf">{t("parent.billing.save", { pct: Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100) })}</Chip>}
          <ul className="space-y-2 text-ink-2">
            {["parent.billing.paid1", "parent.billing.paid2", "parent.billing.paid3", "parent.billing.paid4"].map((k) => (
              <li key={k} className="flex gap-2">
                <Check className="mt-0.5 size-5 shrink-0 text-teal" aria-hidden /> {t(k)}
              </li>
            ))}
          </ul>

          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("parent.billing.provider")}</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
                <label key={p} className={`flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border text-lg font-extrabold ${provider === p ? "border-primary bg-primary-soft text-primary" : "border-line"}`}>
                  <input type="radio" name="provider" className="sr-only" checked={provider === p} onChange={() => setProvider(p)} />
                  {PROVIDERS[p]}
                </label>
              ))}
            </div>
          </fieldset>

          {back && (
            <p role="status" className={`rounded-2xl p-3 text-sm font-semibold ${back.state === "paid" ? "bg-leaf-soft text-[#2f6a37]" : "bg-sky-soft text-[#2f5d93]"}`}>
              {t(back.state === "paid" ? "notif.payment_ok" : back.state === "canceled" ? "parent.billing.failed" : "parent.billing.waiting", { provider: PROVIDERS[back.provider] })}
            </p>
          )}
          {back?.state === "created" && <Recheck />}
          {pay.pending && (
            <p role="status" className="rounded-2xl bg-sky-soft p-3 text-sm font-semibold text-[#2f5d93]">
              {t("parent.billing.redirecting", { provider: PROVIDERS[provider] })}
            </p>
          )}
          {paid && !pay.pending && (
            <p role="status" className="rounded-2xl bg-leaf-soft p-3 text-sm font-semibold text-[#2f6a37]">
              {t("notif.payment_ok")}
            </p>
          )}
          {pay.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{pay.error}</p>}
          <Button
            size="lg"
            className="w-full"
            pending={pay.pending}
            onClick={async () => {
              setPaid(false);
              if (await pay.run(period, provider)) setPaid(true);
            }}
          >
            {t(paidPlan ? "parent.billing.extend" : "parent.billing.pay", { provider: PROVIDERS[provider] })}
          </Button>
          {!LIVE && <p className="text-xs text-muted">{t("parent.billing.sandbox")}</p>}
        </Card>
      </div>

      <Card className="mt-6 space-y-2 bg-teal-soft/40">
        <p className="font-bold">{t("parent.billing.rule")}</p>
        <p className="text-sm text-ink-2">{t("parent.billing.pilot")}</p>
        {kids.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {kids.map((c) => (
              <li key={c.id}>
                <Chip tone={sel.entitled(db, c.id) ? "leaf" : "gray"}>
                  {c.avatar} {c.name}: {t(sel.entitled(db, c.id) ? "parent.billing.full" : "parent.billing.limited")}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold">{t("parent.billing.history")}</h2>
        {orders.length === 0 ? (
          <p className="text-sm text-muted">{t("common.none")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-4 font-bold">{t("parent.billing.date")}</th>
                  <th className="py-2 pr-4 font-bold">{t("parent.billing.planCol")}</th>
                  <th className="py-2 pr-4 font-bold">{t("parent.billing.amount")}</th>
                  <th className="py-2 pr-4 font-bold">{t("parent.billing.provider")}</th>
                  <th className="py-2 font-bold">{t("parent.billing.state")}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-line">
                    <td className="py-2 pr-4">{fmtDate(o.createdAt, lang)}</td>
                    <td className="py-2 pr-4">{t(`parent.billing.plan.${o.plan}`)}</td>
                    <td className="py-2 pr-4">{price(o.amountTiyin)}</td>
                    <td className="py-2 pr-4">{PROVIDERS[o.provider]}</td>
                    <td className="py-2">
                      <Chip tone={o.state === "paid" ? "leaf" : o.state === "created" ? "sun" : "gray"}>{t(`parent.billing.order.${o.state}`)}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

// Live mode: not connected to the server yet (PRD Phase 5/6).
export default function Page() {
  return <Billing />;
}

/** While the provider hasn't confirmed yet, look again every few seconds (FR-BILL-3: ≤ 10 s). */
function Recheck() {
  useEffect(() => {
    const id = setInterval(() => void api.refreshBilling(), 3000);
    return () => clearInterval(id);
  }, []);
  return null;
}

