"use client";

import { Card, Chip, Empty, PageHeader, type Tone } from "@/components/ui";
import { fmtDate, SectionTitle, Table, td, th, useMe } from "@/features/pro/shared";
import { sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

const SUB_TONE: Record<string, Tone> = { active: "leaf", canceled: "sun", expired: "gray" };
const ORDER_TONE: Record<string, Tone> = { paid: "leaf", created: "sky", canceled: "gray" };

export default function AdminBilling() {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const email = (userId: string) => db.users.find((u) => u.id === userId)?.email ?? userId;
  const money = (tiyin: number) => `${new Intl.NumberFormat(lang).format(tiyin / 100)} ${t("pro.sum")}`;

  return (
    <>
      <PageHeader title={t("admin.billing.title")} subtitle={t("admin.billing.subtitle")} />
      <div className="space-y-6">
        <Card>
          <SectionTitle>{t("admin.billing.subs")}</SectionTitle>
          {db.subscriptions.length === 0 ? (
            <Empty />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>{t("admin.users.user")}</th>
                  <th className={th}>{t("admin.billing.plan")}</th>
                  <th className={th}>{t("admin.users.status")}</th>
                  <th className={th}>{t("admin.billing.until")}</th>
                </tr>
              </thead>
              <tbody>
                {db.subscriptions.map((s) => {
                  const live = sel.subscription(db, s.userId);
                  return (
                    <tr key={s.userId}>
                      <td className={td}>{email(s.userId)}</td>
                      <td className={td}>{t(`admin.plan.${s.plan}`)}</td>
                      <td className={td}>
                        <Chip tone={SUB_TONE[live.status]}>{t(`admin.subStatus.${live.status}`)}</Chip>
                      </td>
                      <td className={td}>{fmtDate(s.until, lang)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <SectionTitle>{t("admin.billing.orders")}</SectionTitle>
          {db.orders.length === 0 ? (
            <Empty />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>{t("admin.billing.date")}</th>
                  <th className={th}>{t("admin.users.user")}</th>
                  <th className={th}>{t("admin.billing.plan")}</th>
                  <th className={th}>{t("admin.billing.amount")}</th>
                  <th className={th}>{t("admin.billing.provider")}</th>
                  <th className={th}>{t("admin.users.status")}</th>
                </tr>
              </thead>
              <tbody>
                {db.orders.map((o) => (
                  <tr key={o.id}>
                    <td className={td}>{fmtDate(o.createdAt, lang, true)}</td>
                    <td className={td}>{email(o.userId)}</td>
                    <td className={td}>{t(`admin.plan.${o.plan}`)}</td>
                    <td className={`${td} whitespace-nowrap`}>{money(o.amountTiyin)}</td>
                    <td className={td}>{o.provider === "payme" ? "Payme" : "Click"}</td>
                    <td className={td}>
                      <Chip tone={ORDER_TONE[o.state]}>{t(`admin.order.${o.state}`)}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <p className="mt-3 text-xs text-muted">{t("admin.billing.note")}</p>
        </Card>
      </div>
    </>
  );
}
