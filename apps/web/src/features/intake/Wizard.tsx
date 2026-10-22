"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Card, LinkButton, useAction } from "@/components/ui";
import { openQuestions, STEPS, stepComplete, visibleQuestions, type Answers, type Step } from "@/content/intake";
import { FormError, FormNote } from "@/features/auth/parts";
import { api, ApiError, sel, useDb } from "@/lib/api";
import { useT, useLang } from "@/lib/i18n";
import type { IntakeValue, Roadmap } from "@/lib/types";
import { QuestionField } from "./Fields";

// Parent intake (spec §3 steps 4–15): one screen per step, saved as the parent goes, finish later any time.
// `childId` continues an intake; a later round is the 3-month re-intake, shown with last time's answers.

export function IntakeWizard({ childId: initialChild }: { childId?: string }) {
  const t = useT();
  const router = useRouter();
  const [uiLang] = useLang();
  const db = useDb();
  const [childId, setChildId] = useState<string | null>(initialChild ?? null);
  const child = childId ? sel.child(db, childId) : null;
  const round = childId ? sel.intakeRound(db, childId)?.round ?? 1 : 1;
  const [answers, setAnswers] = useState<Answers>(() => (childId ? sel.intakeAnswers(db, childId, round) : {}));
  const previous = childId && round > 1 ? sel.intakeAnswers(db, childId, round - 1) : {};
  const health = childId ? sel.hasConsent(db, childId, "health") : false;
  const [declined, setDeclined] = useState(false);
  const [i, setI] = useState(() => (childId ? firstOpenStep(answers, health) : 0));
  const [plan, setPlan] = useState<Roadmap | null>(null);
  // "Next" looks grey while a required question is open; pressing it shows which one (B1).
  const [markedStep, setMarkedStep] = useState<string | null>(null);
  const act = useAction(async (fn: () => Promise<unknown>) => fn());

  // Steps that apply: section B only with health consent; the consent screen only until it's decided.
  const steps = STEPS.filter((s) => (s.id === "health_consent" ? !health && !declined : !s.health || health));
  const step = steps[Math.min(i, steps.length - 1)];
  const set = (id: string, v: IntakeValue | undefined) => setAnswers((a) => ({ ...a, [id]: v }));
  const open = new Set(openQuestions(step, answers).map((q) => q.id));
  const marked = markedStep === step.id;

  const showFirstOpen = () => {
    setMarkedStep(step.id);
    const first = visibleQuestions(step, answers).find((q) => open.has(q.id));
    const card = first && document.getElementById(`q-${first.id}`);
    if (!card) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    card.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
    card.querySelector<HTMLElement>("input, textarea, select")?.focus({ preventScroll: true });
  };
  const stepAnswers = (s: Step): Answers => {
    const ids = new Set(s.questions.flatMap((q) => [q.id, `${q.id}_hints`, `${q.id}_voice`, `${q.id}_consent`]));
    return Object.fromEntries(Object.entries(answers).filter(([k]) => ids.has(k)));
  };

  const save = async () => {
    if (!childId) {
      const c = await api.createChildFromIntake(answers, uiLang);
      setChildId(c.id);
      router.replace(`/parent/children/new?child=${c.id}`);
      return c.id;
    }
    await api.saveAnswers(childId, round, stepAnswers(step));
    if (step.id === "videos" && answers.P40_consent === "yes") await api.setConsent(childId, "movement_videos", true);
    return childId;
  };

  const next = () =>
    act.run(async () => {
      const id = await save();
      if (i + 1 < steps.length) return setI(i + 1);
      if (typeof answers.P41 === "string" && answers.P41.trim() && answers.P41_consent === "yes") {
        await api.setConsent(id, "therapist_sharing", true);
        // ponytail: the server has no therapist invites until A8.1; the consent is saved, the invite waits.
        await api.inviteCare(id, answers.P41).catch((e) => {
          if (!(e instanceof ApiError && e.code === "not_available")) throw e;
        });
      }
      setPlan(await api.finishIntake(id, round));
    });

  if (plan && child) return <Ready name={child.name} plan={plan} minutes={answers.P34 === "30" ? 30 : answers.P34 === "20" ? 20 : 10} childId={child.id} />;

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-1 text-sm font-bold text-muted">{t("intake.progress", { n: i + 1, total: steps.length })}</p>
      <div className="mb-6 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>
      <h1 className="text-2xl font-extrabold text-ink sm:text-3xl">{t(`intake.step.${step.id}`)}</h1>
      {(step.id === "safety" || step.id === "talk") && <p className="mt-2 text-ink-2">{t(`intake.step.${step.id}.d`)}</p>}

      {step.id === "health_consent" ? (
        <Card className="mt-6 space-y-4 p-5">
          <ShieldCheck className="size-8 text-teal" aria-hidden />
          <p className="text-ink">{t("intake.health.lead")}</p>
          <p className="text-sm text-ink-2">{t("intake.health.points")}</p>
          <FormError>{act.error}</FormError>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" pending={act.pending} onClick={() => act.run(async () => { await api.setConsent(childId!, "health", true); })}>
              {t("intake.health.yes")}
            </Button>
            <Button size="lg" variant="outline" onClick={() => setDeclined(true)}>{t("intake.health.no")}</Button>
          </div>
        </Card>
      ) : (
        <form
          className="mt-6 space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (open.size) showFirstOpen();
            else next();
          }}
        >
          {declined && step.id === "talk" && <FormNote>{t("intake.health.declined")}</FormNote>}
          {visibleQuestions(step, answers).map((q) => {
            const mark = marked && open.has(q.id);
            return (
              <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
                <Card className={`p-5 ${mark ? "ring-4 ring-sun" : ""}`}>
                  <QuestionField q={q} answers={answers} set={set} childId={childId} previous={previous[q.id]} />
                  {mark && <p className="mt-3 text-sm font-bold text-ink">{t("intake.answerThis")}</p>}
                </Card>
              </div>
            );
          })}
          <FormError>{act.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            {i > 0 && <Button variant="ghost" onClick={() => setI(i - 1)}>{t("intake.back")}</Button>}
            {/* Not `disabled`: a quiet button that still answers the press, by pointing at the open question.
                The quiet look is the soft variant, not opacity, so the text keeps enough contrast. */}
            <Button type="submit" size="lg" pending={act.pending} variant={open.size ? "soft" : "primary"}>
              {i + 1 < steps.length ? t("intake.next") : t("intake.finish")}
            </Button>
            {step.optional && i + 1 < steps.length && <Button variant="outline" onClick={() => setI(i + 1)}>{t("intake.skip")}</Button>}
            {childId && (
              <Button variant="ghost" onClick={() => act.run(async () => { await save(); router.push("/parent"); })}>
                {t("intake.later")}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

/** Resume at the first step that still has a required question open. */
function firstOpenStep(a: Answers, health: boolean) {
  const steps = STEPS.filter((s) => (s.id === "health_consent" ? !health : !s.health || health));
  const k = steps.findIndex((s) => s.id !== "health_consent" && !stepComplete(s, a));
  return k === -1 ? steps.length - 1 : steps[k - 1]?.id === "health_consent" ? k - 1 : k;
}

/** Spec step 19 — "The plan is ready". No scores, no percentages. */
export function Ready({ name, plan, minutes, childId }: { name: string; plan: Roadmap; minutes: number; childId: string }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h1 className="text-3xl font-extrabold text-ink">{t("intake.ready.title", { name })}</h1>
      <p className="mt-3 text-lg text-ink-2">{plan.exercisesAllowed ? t("intake.ready.lead", { min: minutes }) : t("intake.ready.gamesOnly")}</p>
      <p className="mt-4 rounded-2xl bg-sky-soft px-4 py-3 text-sm font-semibold text-ink">{t("intake.ready.playcheck")}</p>
      <div className="mt-6 flex justify-center gap-3">
        <LinkButton href={`/parent/child/${childId}`} size="lg">{t("intake.ready.open")}</LinkButton>
      </div>
    </div>
  );
}
