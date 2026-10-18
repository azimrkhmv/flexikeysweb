"use client";

import { Card, Chip } from "@/components/ui";
import { sel, useDb } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useLang, useT } from "@/lib/i18n";
import type { Child } from "@/lib/types";

// B24: what the child's therapist changed (their answers win, spec §6) and their messages. Nothing when no
// therapist has answered.

const ORDER = ["P12", "P10", "P11", "P14", "P33"];

export function TherapistUpdates({ child }: { child: Child }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const { updated, messages, mustNotText } = sel.therapistUpdates(db, child.id);
  const questions = ORDER.filter((q) => updated[q]);
  if (!questions.length && !messages.length) return null;
  const by = (name: string, profession?: string) => (profession ? `${name}, ${t(`tform.profession.${profession}`)}` : name);
  const words = (q: string, v: string | string[]) => (Array.isArray(v) ? v : [v]).map((o) => t(`intake.${q}.${o}`)).join(", ");

  return (
    <Card className="space-y-4 p-5">
      <h2 className="text-lg font-extrabold text-ink">{t("parent.therapist.title", { name: child.name })}</h2>
      {questions.length > 0 && (
        <ul className="space-y-3">
          {questions.map((q) => (
            <li key={q} className="rounded-2xl bg-surface-2 p-3">
              <div className="text-sm text-muted">{t(`intake.${q}`)}</div>
              <div className="font-bold text-ink">
                {words(q, updated[q].value)}
                {q === "P14" && mustNotText.length > 0 && `: ${mustNotText.join("; ")}`}
              </div>
              <Chip tone="teal" className="mt-2">
                {t("parent.therapist.updatedBy", { name: by(updated[q].name, updated[q].profession) })}
              </Chip>
            </li>
          ))}
        </ul>
      )}
      {messages.map((m) => (
        <blockquote key={m.at} className="rounded-2xl bg-teal-soft/50 p-3">
          <p className="whitespace-pre-line text-ink">{m.text}</p>
          <footer className="mt-1 text-xs text-muted">
            {by(m.name, m.profession)} · {fmtDate(m.at, lang, "date")}
          </footer>
        </blockquote>
      ))}
    </Card>
  );
}
