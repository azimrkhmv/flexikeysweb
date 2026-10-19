"use client";

import { Card, Chip, Empty, PageHeader } from "@/components/ui";
import { SectionTitle, Table, td, th, useMe } from "@/features/pro/shared";
import { fmtDate } from "@/lib/format";
import { sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

// B55: every family's Free or Pro (spec §14). Pro for some days by hand is on the Users page (POST /admin/users/{id}/pro).

export default function AdminBilling() {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const families = sel.admin.familyPlans(db);

  return (
    <>
      <PageHeader title={t("admin.billing.title")} subtitle={t("admin.billing.subtitle")} />
      <Card>
        <SectionTitle>{t("admin.billing.families")}</SectionTitle>
        {families.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.users.user")}</th>
                <th className={th}>{t("admin.billing.plan")}</th>
                <th className={th}>{t("admin.billing.until")}</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.familyId}>
                  <td className={td}>{sel.user(db, f.ownerId)?.phone ?? f.ownerId}</td>
                  <td className={td}>
                    <Chip tone={f.plan === "pro" ? "leaf" : "gray"}>{t(f.trial ? "admin.plan.trial" : `plans.col.${f.plan}`)}</Chip>
                  </td>
                  <td className={td}>{fmtDate(f.trial ? f.trialEndsAt : f.plan === "pro" ? f.paidUntil : undefined, lang, "dayMonth")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
