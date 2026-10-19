"use client";

import { useState } from "react";
import { Check, Minus, Sparkles } from "lucide-react";
import { Button, Card, Chip, PageHeader, useAction } from "@/components/ui";
import { PLAN_ROWS, PRO_PRICE_SOM } from "@/content/plans";
import { fmtDate, fmtSum } from "@/lib/format";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

// B21 (spec §14): Free and Pro belong to the family. The owner tries Pro for 7 days once, or pays (simulated until
// after the pilot); a helper sees the plan but never the buttons. Prices in so'm only; placeholders until G3.

const Cell = ({ v }: { v: string }) => {
  const t = useT();
  if (v === "yes") return <Check className="mx-auto size-5 text-teal" aria-label={t("plans.yes")} />;
  if (v === "no") return <Minus className="mx-auto size-5 text-muted" aria-label={t("plans.no")} />;
  return <span className="text-sm">{t(v)}</span>;
};

export default function Billing() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const me = sel.me(db);
  const trial = useAction(api.startTrial);
  const pay = useAction(api.payPro);
  const [paid, setPaid] = useState(false);
  if (!me) return null;
  const familyId = sel.familyOf(db, me.id);
  const owner = !!familyId && sel.ownFamily(db, me.id) === familyId;
  const plan = sel.familyPlan(db, familyId);
  const error = trial.error ?? pay.error;
  const buy = async (months: number) => {
    setPaid(false);
    if ((await pay.run(months)) !== undefined) setPaid(true);
  };

  return (
    <>
      <PageHeader title={t("plans.title")} subtitle={t("plans.subtitle")} />

      <Card className="mb-6 flex flex-wrap items-center gap-4">
        <span className="grid size-12 place-items-center rounded-2xl bg-lavender-soft text-[#4f43a0]">
          <Sparkles className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold">
            {plan.trial
              ? t("plans.current.trial", { date: fmtDate(plan.trialEndsAt, lang) })
              : t(plan.plan === "pro" ? "plans.current.pro" : "plans.current.free")}
          </p>
          {plan.plan === "pro" && !plan.trial && plan.paidUntil && <p className="text-sm text-ink-2">{t("plans.paidUntil", { date: fmtDate(plan.paidUntil, lang) })}</p>}
        </div>
        <Chip tone={plan.plan === "pro" ? "leaf" : "gray"}>{t(plan.plan === "pro" ? "plans.col.pro" : "plans.col.free")}</Chip>
      </Card>

      <Card className="mb-6 overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="py-3 pr-3" />
              <th scope="col" className="w-36 py-3 text-center">
                <span className="block text-lg font-extrabold">{t("plans.col.free")}</span>
                <span className="block text-sm font-semibold text-muted">{t("plans.price.free")}</span>
              </th>
              <th scope="col" className="w-36 py-3 text-center">
                <span className="block text-lg font-extrabold text-primary">{t("plans.col.pro")}</span>
                <span className="block text-sm font-semibold text-muted">{t("plans.price.pro", { amount: fmtSum(PRO_PRICE_SOM * 100) })}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {PLAN_ROWS.map(([key, free, pro]) => (
              <tr key={key} className="border-b border-line last:border-0">
                <th scope="row" className="py-3 pr-3 text-sm font-semibold text-ink">
                  {t(`plans.row.${key}`)}
                </th>
                <td className="py-3 text-center text-ink-2">
                  <Cell v={free} />
                </td>
                <td className="py-3 text-center text-ink">
                  <Cell v={pro} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted">{t("plans.price.placeholder")}</p>
      </Card>

      <Card className="space-y-4">
        {!owner ? (
          <p className="text-ink-2">{t("plans.ownerOnly")}</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-3">
              {plan.plan === "free" && !plan.trialUsed && (
                <Button pending={trial.pending} onClick={() => trial.run()}>
                  <Sparkles className="size-4" aria-hidden /> {t("plans.trial")}
                </Button>
              )}
              <Button variant={plan.plan === "free" && !plan.trialUsed ? "outline" : "primary"} pending={pay.pending} onClick={() => buy(1)}>
                {t("plans.pay")}
              </Button>
              <Button variant="outline" pending={pay.pending} onClick={() => buy(12)}>
                {t("plans.pay12")}
              </Button>
            </div>
            <p className="text-xs text-muted">{t("plans.payNote")}</p>
            {paid && (
              <p role="status" className="font-bold text-teal">
                {t("plans.paid")}
              </p>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
            {error}
          </p>
        )}
      </Card>
    </>
  );
}
