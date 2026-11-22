"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Card, useAction } from "@/components/ui";
import { Q_BY_ID, quickCheckDefaults, quickVisible, typedProblem, upgrade, type QAnswer, type QAnswers } from "@/content/questionnaire";
import { pView } from "@/content/questionnaireBridge";
import { FormError } from "@/features/auth/parts";
import { api, sel, useDb } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";
import type { IntakeValue, Roadmap } from "@/lib/types";
import { Question, QuickCheck } from "./Questionnaire";
import { Ready } from "./Wizard";
import { PrivacyLink } from "@/components/PrivacyLink";

// Quick start (B103, spec 4): "Start, 2 minutes" asks the quick questions (questionnaire.ts quickVisible) one per
// screen, the six Quick check rows as one screen, with short dashes for progress and Back and Next. After the last
// one the first plan is built from these answers and marked quick; the round stays open for the full questionnaire.

const today = () => new Date().toISOString().slice(0, 10);
const unanswered = (v: QAnswer) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const CONSENT = "health_consent";

export function QuickStart({ childId: initialChild, version }: { childId?: string; version: string }) {
  const t = useT();
  const router = useRouter();
  const [uiLang] = useLang();
  const db = useDb();
  const [childId, setChildId] = useState<string | null>(initialChild ?? null);
  const child = childId ? sel.child(db, childId) : null;
  const round = childId ? sel.intakeRound(db, childId)?.round ?? 1 : 1;
  const [typed, setAnswers] = useState<QAnswers>(() => (childId ? upgrade(sel.intakeAnswers(db, childId, round)) : {}));
  const answers = quickCheckDefaults(typed);
  const health = childId ? sel.hasConsent(db, childId, "health") : false;
  const [plan, setPlan] = useState<Roadmap | null>(null);
  const [marked, setMarked] = useState(false);
  const act = useAction(async (fn: () => Promise<unknown>) => fn());

  // The screens: one per question, the Quick check as one, and the health consent before the first health question
  // (it is required, so nothing after it opens before the parent agrees; the count stays the same).
  const ids = quickVisible(answers, today());
  const screens: string[][] = [];
  for (const id of ids) {
    if (Q_BY_ID[id].controls) {
      const qc = screens.find((s) => Q_BY_ID[s[0]]?.controls);
      if (qc) qc.push(id);
      else screens.push([id]);
    } else screens.push([id]);
  }
  if (!health) screens.splice(screens.findIndex((s) => Q_BY_ID[s[0]].health), 0, [CONSENT]);
  const key = (s: string[]) => s[0];
  const firstOpen = () => screens.find((s) => s[0] === CONSENT || s.some((id) => unanswered(answers[id]))) ?? screens.at(-1)!;
  // The screen shown: the first one still open when the page opens (to come back where the parent stopped), then
  // only Next and Back move it, never an answer typed on it.
  const [at, setAt] = useState(() => key(firstOpen()));
  const screen = screens.find((s) => key(s) === at) ?? firstOpen();
  const pos = screens.indexOf(screen);
  const last = pos === screens.length - 1;

  // A new screen takes the focus, so a screen reader reads the next question.
  const top = useRef<HTMLHeadingElement>(null);
  const opened = useRef(false);
  const shownNow = key(screen);
  useEffect(() => {
    if (!opened.current) return void (opened.current = true);
    window.scrollTo({ top: 0 });
    top.current?.focus({ preventScroll: true });
  }, [shownNow]);

  const set = (id: string, v: QAnswer) => setAnswers((a) => ({ ...a, [id]: v }));
  const open = screen.filter((id) => id !== CONSENT && ((Q_BY_ID[id].required && unanswered(answers[id])) || typedProblem(Q_BY_ID[id], answers[id], answers, today())));
  const valid = (ids: string[]) =>
    Object.fromEntries(ids.filter((id) => !unanswered(answers[id]) && !typedProblem(Q_BY_ID[id], answers[id], answers, today())).map((id) => [id, answers[id]])) as Record<string, IntakeValue>;

  const next = () =>
    act.run(async () => {
      const to = screens[pos + 1];
      let id = childId;
      if (!id) {
        // The child is added once the basics are in (name and date of birth are on the first screens).
        if (to && Q_BY_ID[to[0]]?.step === "A") return go(to);
        const c = await api.createChildFromIntake(valid(screens.filter((s) => Q_BY_ID[s[0]]?.step === "A").flat()), uiLang, version);
        id = c.id;
        setChildId(c.id);
        router.replace(`/parent/children/new?child=${c.id}&quick=1`);
      } else await api.saveAnswers(id, round, valid(screen));
      if (to) return go(to);
      setPlan(await api.finishIntake(id, round, true));
    });
  const go = (to: string[]) => {
    setMarked(false);
    setAt(key(to));
  };
  const agree = async () => {
    await api.setConsent(childId!, "health", true);
    go(screens[pos + 1]); // the first health question
  };

  if (plan && child) {
    const p34 = pView(answers, today()).P34;
    return (
      <div>
        <Ready name={child.name} plan={plan} minutes={p34 === "30" ? 30 : p34 === "20" ? 20 : 10} childId={child.id} />
        <p className="mx-auto mt-4 max-w-2xl text-center text-sm text-muted">{t("quick.ready")}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 ref={top} tabIndex={-1} className="font-display text-3xl font-bold text-ink outline-none">
        {t("quick.title")}
      </h1>
      <p className="mt-1 text-muted">{t("quick.lead")}</p>
      <div className="mt-4 flex gap-1" aria-hidden>
        {screens.map((s, i) => (
          <span key={key(s)} className={`h-1.5 flex-1 rounded-full ${i <= pos ? "bg-primary" : "bg-line"}`} />
        ))}
      </div>
      <p className="mt-2 text-sm font-bold text-muted">{t("quick.step", { n: pos + 1, total: screens.length })}</p>

      {screen[0] === CONSENT ? (
        <Card className="fk-slide mt-4 space-y-4 p-5" key={CONSENT}>
          <ShieldCheck className="size-8 text-primary" aria-hidden />
          <p className="text-ink">{t("intake.health.lead")}</p>
          <p className="text-sm text-muted">{t("intake.health.points")}</p>
          <PrivacyLink />
          <FormError>{act.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => go(screens[pos - 1])}>{t("intake.back")}</Button>
            <Button size="lg" pending={act.pending} onClick={() => act.run(agree)}>
              {t("intake.health.yes")}
            </Button>
          </div>
        </Card>
      ) : (
        <form
          key={key(screen)}
          className="fk-slide mt-4 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (open.length) setMarked(true);
            else next();
          }}
        >
          {Q_BY_ID[screen[0]].controls ? (
            <QuickCheck questions={screen.map((id) => Q_BY_ID[id])} answers={answers} set={set} marked={marked ? new Set(open) : new Set()} />
          ) : (
            <Card className={`p-5 ${marked && open.length ? "ring-4 ring-sun" : ""}`}>
              <Question q={Q_BY_ID[screen[0]]} answers={answers} set={set} childId={childId} />
              {screen[0] === "A1" && <p className="mt-2 text-xs text-muted">{t("intake.A1.nickname")}</p>}
              {marked && open.length > 0 && <p className="mt-3 text-sm font-bold text-ink">{t("intake.answerThis")}</p>}
            </Card>
          )}
          <FormError>{act.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            {pos > 0 && (
              <Button variant="ghost" onClick={() => go(screens[pos - 1])}>
                {t("intake.back")}
              </Button>
            )}
            <Button type="submit" size="lg" pending={act.pending} variant={open.length ? "soft" : "primary"}>
              {last ? t("quick.finish") : t("intake.next")}
            </Button>
            {childId && (
              <Button variant="ghost" onClick={() => act.run(async () => { await api.saveAnswers(childId, round, valid(screen)); router.push("/parent"); })}>
                {t("intake.later")}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
