"use client";

import { notify } from "@/components/Toasts";
import { useState, type FormEvent } from "react";
import { Banknote } from "lucide-react";
import { Button, Card, Chip, Empty, Field, Input, PageHeader } from "@/components/ui";
import { Modal } from "@/components/overlays";
import { fmtUzs, freeEndsAt, OFFER } from "@/content/offer";
import { FormError } from "@/features/auth/parts";
import { useBilling, type FamilyBilling } from "@/features/pro/billingData";
import { SectionTitle, Table, td, th } from "@/features/pro/shared";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";

// B55: every family's Free or Pro (spec §14). B114 (Update 4 spec 5.2): the team marks a family paid by hand (no
// payment provider yet): amount, method, paid until and a note; each family keeps its list of payments.

const today = () => new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10); // Tashkent
const inMonths = (n: number) => {
  const d = new Date(`${today()}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

function PaymentsDialog({ family, onClose }: { family: FamilyBilling; onClose: () => void }) {
  const t = useT();
  const [lang] = useLang();
  const [amount, setAmount] = useState(String(OFFER.priceUzs));
  const [method, setMethod] = useState("");
  const [until, setUntil] = useState(inMonths(OFFER.periodMonths));
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      await api.recordPayment(family.familyId, { amountUzs: Number(amount.replace(/\s/g, "")), method, paidUntil: until, note });
      notify.ok(t("pay.saved"));
      setMethod("");
      setNote("");
    } catch (err) {
      setError(t(`err.${(err as { code?: string }).code ?? "generic"}`));
    } finally {
      setPending(false);
    }
  };
  return (
    <Modal open onClose={onClose} title={t("pay.dialog.title", { who: family.ownerName || family.ownerPhone })}>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label={t("pay.amount")}>
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} required pattern="[0-9 ]{1,13}" />
        </Field>
        <Field label={t("pay.method")} hint={t("pay.method.hint")}>
          <Input value={method} onChange={(e) => setMethod(e.target.value)} required maxLength={40} list="pay-methods" />
        </Field>
        <datalist id="pay-methods">
          {["Payme", "Click", "card", "cash"].map((m) => (
            <option key={m} value={t(`pay.method.${m}`)} />
          ))}
        </datalist>
        <Field label={t("pay.until")}>
          <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} required />
        </Field>
        <Field label={t("pay.note")}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
        </Field>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Button type="submit" pending={pending}>{t("pay.save")}</Button>
        </div>
        <div className="sm:col-span-2"><FormError>{error}</FormError></div>
      </form>
      <h3 className="mt-6 font-extrabold text-ink">{t("pay.list")}</h3>
      {family.payments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{t("pay.none")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-line">
          {family.payments.map((p) => (
            <li key={p.id} className="py-2 text-sm">
              <span className="font-bold text-ink">{fmtUzs(p.amountUzs)} {t("pay.uzs")}</span> · {p.method} ·{" "}
              {t("plans.paidUntil", { date: fmtDate(p.paidUntil, lang) })}
              <span className="block text-xs text-muted">
                {fmtDate(p.createdAt, lang)}
                {p.note ? ` · ${p.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

export default function AdminBilling() {
  const t = useT();
  const [lang] = useLang();
  const families = useBilling();
  const [open, setOpen] = useState<string | null>(null);
  const current = families.find((f) => f.familyId === open);

  return (
    <>
      <PageHeader title={t("admin.billing.title")} subtitle={t("admin.billing.subtitle")} />
      <Card>
        <SectionTitle>{t("admin.billing.families")}</SectionTitle>
        <p className="mb-3 text-sm text-muted">{t("pay.offer", { days: OFFER.freeDays, price: fmtUzs(OFFER.priceUzs), months: OFFER.periodMonths })}</p>
        {families.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.users.user")}</th>
                <th className={th}>{t("admin.billing.plan")}</th>
                <th className={th}>{t("pay.freeEnds")}</th>
                <th className={th}>{t("admin.billing.until")}</th>
                <th className={th}>{t("pay.list")}</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => {
                const total = f.payments.reduce((s, p) => s + p.amountUzs, 0);
                return (
                  <tr key={f.familyId}>
                    <td className={td}>
                      <span className="block font-semibold text-ink">{f.ownerName || "—"}</span>
                      <span className="block whitespace-nowrap text-xs text-muted">{f.ownerPhone}</span>
                    </td>
                    <td className={td}>
                      <Chip tone={f.plan.plan === "pro" ? "leaf" : "gray"}>{t(f.plan.trial ? "admin.plan.trial" : `plans.col.${f.plan.plan}`)}</Chip>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(freeEndsAt(f.signedUpAt ?? undefined) ?? undefined, lang, "dayMonth")}</td>
                    <td className={`${td} whitespace-nowrap`}>{fmtDate(f.plan.trial ? (f.plan.trialEndsAt ?? undefined) : f.plan.plan === "pro" ? (f.plan.paidUntil ?? undefined) : undefined, lang, "dayMonth")}</td>
                    <td className={td}>
                      <Button variant="outline" size="sm" onClick={() => setOpen(f.familyId)} aria-label={`${t("pay.record")}: ${f.ownerName || f.ownerPhone}`}>
                        <Banknote className="size-4" aria-hidden /> {f.payments.length ? `${fmtUzs(total)} ${t("pay.uzs")}` : t("pay.record")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {current && <PaymentsDialog family={current} onClose={() => setOpen(null)} />}
    </>
  );
}
