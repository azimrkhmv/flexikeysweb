"use client";

import { AAC_CARDS } from "@/content/aac";
import { LEVELS } from "@/content/levels";
import { VOCAB } from "@/content/vocab";
import { Card, Chip, Meter, PageHeader, Toggle, useAction } from "@/components/ui";
import { SectionTitle, Table, td, th, useMe } from "@/features/pro/shared";
import { api, sel } from "@/lib/api";
import { LANGS, useLang, useT } from "@/lib/i18n";
import type { L10n } from "@/lib/types";

// Every spoken string needs audio in every language (FR-AUD-2). Here: text presence per language.
const SPOKEN: L10n[] = [...Object.values(VOCAB).map((v) => v.word), ...LEVELS.map((l) => l.title), ...AAC_CARDS.map((c) => c.label)];

export default function AdminContent() {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const flag = useAction(api.setFlag);

  return (
    <>
      <PageHeader title={t("admin.content.title")} subtitle={t("admin.content.subtitle")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionTitle>{t("admin.content.version")}</SectionTitle>
          <div className="mb-3 flex items-center gap-2">
            <Chip tone="gray">{t("admin.content.demo")}</Chip>
          </div>
          <p className="text-sm text-muted">{t("admin.content.publishNote")}</p>
        </Card>

        <Card>
          <SectionTitle>{t("admin.content.audio")}</SectionTitle>
          <ul className="space-y-3">
            {LANGS.map((l) => {
              const missing = SPOKEN.filter((s) => !s[l]?.trim()).length;
              const ratio = (SPOKEN.length - missing) / SPOKEN.length;
              return (
                <li key={l}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-semibold text-ink">{t(`lang.${l}`)}</span>
                    <span className="text-muted">
                      {Math.round(ratio * 100)}% · {t("admin.content.missing", { n: missing })}
                    </span>
                  </div>
                  <Meter value={ratio} label={t(`lang.${l}`)} />
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">{t("admin.content.audioNote", { n: SPOKEN.length })}</p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>{t("admin.content.levels")}</SectionTitle>
          <Table>
            <thead>
              <tr>
                <th className={th}>#</th>
                <th className={th}>{t("admin.content.level")}</th>
                <th className={th}>{t("admin.content.activities")}</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((l) => (
                <tr key={l.id}>
                  <td className={td}>{l.n}</td>
                  <td className={`${td} font-bold`}>
                    {l.emoji} {l.title[lang]}
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {l.activities.map((a) => (
                        <Chip key={a.id} tone="gray">
                          {a.kind}
                        </Chip>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-3 text-sm text-muted">{t("admin.content.aac", { n: AAC_CARDS.length })}</p>
        </Card>

        <Card className="lg:col-span-2">
          <SectionTitle>{t("admin.flags.title")}</SectionTitle>
          <p className="mb-3 text-sm text-muted">{t("admin.audited")}</p>
          {flag.error && <p className="mb-3 text-sm font-semibold text-[#8f3a2c]">{flag.error}</p>}
          <ul className="divide-y divide-line">
            {sel.admin.flags(db).map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold text-ink">{f.key}</div>
                  <div className="text-sm text-muted">{f.description}</div>
                </div>
                <Toggle checked={f.enabled} onChange={(v) => flag.run(f.key, v)} label={f.key} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
