"use client";

import { Card, Empty, PageHeader } from "@/components/ui";
import { Table, td, th, useMe } from "@/features/pro/shared";
import { fmtDate } from "@/lib/format";
import { sel } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

/** What testers and parents sent from the "Send feedback" box (the pilot), newest first. */
export default function AdminFeedback() {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const rows = sel.admin.feedback(db);
  const who = (f: (typeof rows)[number]) => f.name || f.phone || (f.userId && sel.user(db, f.userId)?.phone) || "—";

  return (
    <>
      <PageHeader title={t("admin.feedback.title")} subtitle={t("admin.feedback.subtitle")} />
      <Card>
        {rows.length === 0 ? (
          <Empty />
        ) : (
          <Table>
            <thead>
              <tr>
                <th className={th}>{t("admin.audit.time")}</th>
                <th className={th}>{t("admin.feedback.from")}</th>
                <th className={th}>{t("admin.feedback.page")}</th>
                <th className={th}>{t("admin.feedback.title")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f) => (
                <tr key={f.id}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(f.at, lang, "dateTime")}</td>
                  <td className={td}>{who(f)}</td>
                  <td className={`${td} font-mono text-xs`}>{f.page}</td>
                  <td className={`${td} whitespace-pre-wrap`}>{f.text}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
