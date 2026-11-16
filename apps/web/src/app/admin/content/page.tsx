"use client";

import { AAC_CARDS } from "@/content/aac";
import { LEVELS } from "@/content/levels";
import { VOCAB } from "@/content/vocab";
import { Card, Chip, LinkButton, Meter, PageHeader, Toggle, useAction } from "@/components/ui";
import { VideoRegister } from "@/features/pro/VideoRegister";
import { SectionTitle, Table, td, th, useMe } from "@/features/pro/shared";
import { api, sel, useDb } from "@/lib/api";
import { LANGS, useLang, useT } from "@/lib/i18n";
import type { ExerciseVideo, L10n } from "@/lib/types";

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

        <ExerciseVideos />

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

/**
 * B106 (Warm Hills spec §7): the library's exercises and the state of each language's video. An admin uploads a file
 * here (the same form as on the Video reviewer page); the physiotherapist approves it there. The spec asked for an
 * "approved" tick by the admin with the physio's name; product rule 3 and the server let only a physiotherapist's own
 * account approve a video, so this page links to that review instead.
 */
function ExerciseVideos() {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const state = (v: ExerciseVideo, l: (typeof LANGS)[number]) => {
    const s = v.versions[l]?.status;
    return s === "approved" ? (["teal", t("admin.videos.approved")] as const) : s ? (["sun", t("admin.videos.waiting")] as const) : (["gray", t("admin.videos.none")] as const);
  };
  return (
    <Card className="lg:col-span-2">
      <SectionTitle>{t("admin.videos.title")}</SectionTitle>
      <p className="mb-3 max-w-[70ch] text-sm text-muted">{t("admin.videos.lead")}</p>
      <LinkButton href="/physio" variant="soft" size="sm" className="mb-4">
        {t("admin.videos.review")}
      </LinkButton>
      <Table>
        <thead>
          <tr>
            <th className={th}>{t("admin.videos.exercise")}</th>
            {LANGS.map((l) => (
              <th key={l} className={th}>
                {t(`lang.${l}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sel.videos(db).map((v) => (
            <tr key={v.id}>
              <td className={`${td} font-bold`}>
                {v.title[lang]} <span className="font-normal text-muted">· {t(`area.${v.bodyArea}`)}</span>
              </td>
              {LANGS.map((l) => {
                const [tone, label] = state(v, l);
                return (
                  <td key={l} className={td}>
                    <Chip tone={tone}>{label}</Chip>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      <VideoRegister />
    </Card>
  );
}
