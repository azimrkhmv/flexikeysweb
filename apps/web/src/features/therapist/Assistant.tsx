"use client";

import { AssistantChat } from "@/features/assistant/Chat";
import { Card, Chip, Empty } from "@/components/ui";
import { SectionTitle, useMe } from "@/features/pro/shared";
import { sel } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";

// B31: the assistant in the therapist dashboard. The family's chats come only as topics and warnings, never the chat
// itself (spec §6, §12); the therapist also asks the assistant about the child in their own chat.

export function TherapistAssistant({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const { db } = useMe();
  const s = sel.chatSummary(db, childId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <SectionTitle>{t("tai.summary")}</SectionTitle>
        <p className="mb-3 text-sm text-muted">{t("tai.summaryNote")}</p>
        {s.questions === 0 ? (
          <Empty>{t("tai.none")}</Empty>
        ) : (
          <>
            <p className="mb-3 text-sm font-bold text-ink">{t("tai.questions", { n: s.questions })}</p>
            <ul className="mb-4 flex flex-wrap gap-2" aria-label={t("tai.summary")}>
              {s.topics.map((x) => (
                <li key={x.topic}>
                  <Chip tone="lavender">
                    {t(`tai.topic.${x.topic}`)} · {x.count}
                  </Chip>
                </li>
              ))}
            </ul>
            {s.warnings.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-bold text-ink">{t("tai.warnings")}</h3>
                <ul className="space-y-1 text-sm">
                  {s.warnings.map((w, i) => (
                    <li key={i} className="flex justify-between gap-2 rounded-2xl bg-peach-soft p-2">
                      <span className="text-ink">{t(`tai.${w.kind}`)}</span>
                      <span className="shrink-0 text-muted">{fmtDate(w.at, lang, "dayMonth")}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}
      </Card>
      <div className="space-y-2">
        <SectionTitle>{t("tai.ask")}</SectionTitle>
        <AssistantChat childId={childId} needConsent={t("tai.needConsent")} />
      </div>
    </div>
  );
}
