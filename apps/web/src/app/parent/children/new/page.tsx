"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { QuestionnaireWizard } from "@/features/intake/Questionnaire";
import { QuickStart } from "@/features/intake/QuickStart";
import { IntakeWizard } from "@/features/intake/Wizard";
import { api, LIVE, sel, useDb } from "@/lib/api";

/** Adding a child is the parent intake (spec §5): P1–P41, or the CEO's questionnaire (IQ4) when the round asks it. */
export default function NewChild() {
  return (
    <Suspense>
      <WithChild />
    </Suspense>
  );
}

function WithChild() {
  const params = useSearchParams();
  const child = params.get("child") ?? undefined;
  const db = useDb();
  const round = child ? sel.intakeRound(db, child) : null;
  // A new child gets the set the server hands out; the demo can try the other one with ?q=2026-10-16.
  const [active, setActive] = useState<string | null>(LIVE ? null : params.get("q"));
  useEffect(() => {
    if (active === null) api.intakeQuestionnaire().then(setActive).catch(() => setActive("p41"));
  }, [active]);
  // "Start, 2 minutes" (B103): the quick start, unless the child has a plan already; decided on opening, so its
  // "plan ready" screen stays when the plan arrives. "Answer more" opens the full questionnaire (no ?quick).
  const [quick] = useState(() => params.get("quick") === "1" && !(child && sel.roadmap(db, child)));
  const set = round ? round.questionnaire ?? "p41" : active;
  if (set === null) return null;
  if (set === "p41") return <IntakeWizard childId={child} />;
  return quick ? <QuickStart childId={child} version={set} /> : <QuestionnaireWizard childId={child} version={set} />;
}
