"use client";

import { Card } from "@/components/ui";
import { SectionTitle } from "@/features/pro/shared";
import { sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

// B58: why each exercise and game is in the child's plan, with the research behind the AI's picks (A4.6). The
// therapist changes the plan with the form's restrictions (T6) and exercise list (T8), rule 4.

export function PlanReasons({ childId }: { childId: string }) {
  const t = useT();
  const db = useDb();
  const [lang] = useLang();
  const why = sel.planReasons(db, childId);
  return (
    <Card>
      <SectionTitle>{t("tplan.title")}</SectionTitle>
      {!why ? (
        <p className="text-sm text-muted">{t("tplan.none")}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-2">{t(why.byAi ? "tplan.ai" : "tplan.rulesOnly")}</p>
          {!why.exercisesAllowed && <p className="mb-3 text-sm font-semibold text-ink">{t("tplan.gamesOnly")}</p>}
          <ul className="divide-y divide-line">
            {why.reasons.map((r) => (
              <li key={`${r.slot}-${r.ref}`} className="py-2">
                <p className="text-sm font-bold text-ink">
                  {r.slot === "exercise" ? (sel.video(db, r.ref)?.title[lang] ?? r.ref) : t(`game.${r.ref}`)}
                  {" "}
                  <span className="font-semibold text-muted">· {t(`intake.P33.${r.goal}`)}</span>
                </p>
                {/* Only an AI plan mixes the AI's picks with the rules' own (a therapist's assigned exercise). */}
                {why.byAi && <p className="text-xs text-muted">{r.source ? t("tplan.source", { source: r.source }) : t("tplan.rules")}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">{t("tplan.change")}</p>
        </>
      )}
    </Card>
  );
}
