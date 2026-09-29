"use client";

import { Card, Empty, PageHeader } from "@/components/ui";
import { Table, td, th, useMe } from "@/features/pro/shared";
import { fmtDate } from "@/lib/format";
import { sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

export default function AdminAudit() {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const email = (id: string) => sel.user(db, id)?.email ?? id;
  const audit = sel.admin.audit(db);

  return (
    <>
      <PageHeader title={t("admin.audit.title")} subtitle={t("admin.audit.subtitle")} />
      <Card>
        {audit.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.audit.time")}</th>
                <th className={th}>{t("admin.audit.actor")}</th>
                <th className={th}>{t("admin.audit.action")}</th>
                <th className={th}>{t("admin.audit.target")}</th>
                <th className={th}>{t("admin.audit.diff")}</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(a.at, lang, "dateTime")}</td>
                  <td className={td}>{email(a.actorId)}</td>
                  <td className={`${td} font-mono text-xs`}>{a.action}</td>
                  <td className={`${td} font-mono text-xs`}>{a.target}</td>
                  <td className={`${td} text-xs text-muted`}>{a.diff ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
