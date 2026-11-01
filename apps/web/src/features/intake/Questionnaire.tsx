"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FileUp, ShieldCheck, Trash2 } from "lucide-react";
import { Button, Card, Field, Input, Textarea, useAction } from "@/components/ui";
import { ageInMonths, inLang, ladderTicks, ladderToggle, ladderValue, offersNotSure, Q_BY_ID, QUESTIONNAIRE, shownOptions, typedProblem, upgrade, visible, type QAnswer, type QAnswers, type QQuestion } from "@/content/questionnaire";
import { pView } from "@/content/questionnaireBridge";
import { FormError } from "@/features/auth/parts";
import { api, sel, useDb } from "@/lib/api";
import { useT, useLang } from "@/lib/i18n";
import type { IntakeValue, Roadmap } from "@/lib/types";
import { chip, Choice, DateInput } from "./Fields";
import { Ready } from "./Wizard";

// IQ4: the CEO's parent questionnaire (content/questionnaire.json), one screen per section, saved as the parent goes.
// Which questions show is the data's rules (visible, shownOptions), the same as the server's. Section K (baseline
// videos) waits for IQ8 and section L is the therapist's (IQ6). Text comes from the data in the parent's language.

const TEXT_MAX = 200;
const LONGTEXT_MAX = 1000;
const FILES_MAX = 5;
const PARENT_STEPS = QUESTIONNAIRE.steps.filter((s) => s !== "K" && s !== "L");
const today = () => new Date().toISOString().slice(0, 10);
const unanswered = (v: QAnswer) => v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
/** `C2_note` and the like: the "own words" box of a step-by-step question, shown in that question's card (B68). */
const isOwnWords = (q: QQuestion) => q.id.endsWith("_note") && !!Q_BY_ID[q.id.slice(0, -"_note".length)]?.ladder;

export function QuestionnaireWizard({ childId: initialChild, version }: { childId?: string; version: string }) {
  const t = useT();
  const router = useRouter();
  const [uiLang] = useLang();
  const db = useDb();
  const [childId, setChildId] = useState<string | null>(initialChild ?? null);
  const child = childId ? sel.child(db, childId) : null;
  const round = childId ? sel.intakeRound(db, childId)?.round ?? 1 : 1;
  const [answers, setAnswers] = useState<QAnswers>(() => (childId ? upgrade(sel.intakeAnswers(db, childId, round)) : {}));
  const health = childId ? sel.hasConsent(db, childId, "health") : false;
  const [plan, setPlan] = useState<Roadmap | null>(null);
  const [markedStep, setMarkedStep] = useState<string | null>(null);
  const act = useAction(async (fn: () => Promise<unknown>) => fn());

  // Questions this parent is asked now; health questions only with the health consent. The consent is required
  // (TASKS.md section 3, 1 Nov 2026; B67): there is no "Not now", so its step stays until the parent agrees.
  const all = visible(answers, today()).map((id) => Q_BY_ID[id]);
  const shown = all.filter((q) => !q.health || health);
  const inStep = (s: string) => shown.filter((q) => q.step === s);
  const steps = ["A", ...(health ? [] : ["health_consent"]), ...PARENT_STEPS.filter((s) => s !== "A" && inStep(s).length)];
  // "Section 3 of 9": the sections this parent will see once they agree (the consent step is not one).
  const sections = PARENT_STEPS.filter((s) => s === "A" || all.some((q) => q.step === s));
  const [i, setI] = useState(() => {
    // Resume at the first step with a required question open; the health consent until it is decided.
    const k = childId ? steps.findIndex((s) => s === "health_consent" || inStep(s).some((q) => q.required && unanswered(answers[q.id]))) : 0;
    return k === -1 ? steps.length - 1 : k;
  });
  const step = steps[Math.min(i, steps.length - 1)];
  const questions = inStep(step);
  // Open: a required question without an answer, or an answer the server would refuse (its message shows under it).
  const open = new Set(questions.filter((q) => (q.required && unanswered(answers[q.id])) || typedProblem(q, answers[q.id], answers, today())).map((q) => q.id));
  const set = (id: string, v: QAnswer) => setAnswers((a) => ({ ...a, [id]: v }));

  const showFirstOpen = () => {
    setMarkedStep(step);
    const card = document.getElementById(`q-${questions.find((q) => open.has(q.id))?.id}`);
    card?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    card?.querySelector<HTMLElement>("input, textarea")?.focus({ preventScroll: true });
  };

  const save = async () => {
    // ponytail: a cleared answer ("" or no option ticked) is not sent, so the server keeps the last one; add a
    // "clear" call when parents need it.
    const mine = Object.fromEntries(
      Object.entries(answers).filter(([k, v]) => Q_BY_ID[k]?.step === step && !unanswered(v) && !typedProblem(Q_BY_ID[k], v, answers, today())),
    ) as Record<string, IntakeValue>;
    if (!childId) {
      const c = await api.createChildFromIntake(mine, uiLang, version);
      setChildId(c.id);
      router.replace(`/parent/children/new?child=${c.id}`);
      return c.id;
    }
    await api.saveAnswers(childId, round, mine);
    return childId;
  };

  const next = () =>
    act.run(async () => {
      const id = await save();
      if (i + 1 < steps.length) return setI(i + 1);
      setPlan(await api.finishIntake(id, round));
    });

  if (plan && child) {
    const p34 = pView(answers, today()).P34;
    return <Ready name={child.name} plan={plan} minutes={p34 === "30" ? 30 : p34 === "20" ? 20 : 10} childId={child.id} />;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
      </div>
      {step === "health_consent" ? (
        <SectionBanner title={t("intake.step.health_consent")} />
      ) : (
        <SectionBanner
          number={t("intake.section", { n: sections.indexOf(step) + 1, total: sections.length })}
          title={inLang(QUESTIONNAIRE.step_text, uiLang, step)}
          intro={inLang(QUESTIONNAIRE.step_intro, uiLang, step)}
        />
      )}
      {step === "A" && <p className="mt-3 text-ink-2">{t("auth.details.ages")}</p>}

      {step === "health_consent" ? (
        <Card className="mt-6 space-y-4 p-5">
          <ShieldCheck className="size-8 text-teal" aria-hidden />
          <p className="text-ink">{t("intake.health.lead")}</p>
          <p className="text-sm text-ink-2">{t("intake.health.points")}</p>
          <FormError>{act.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" onClick={() => setI(i - 1)}>{t("intake.back")}</Button>
            <Button size="lg" pending={act.pending} onClick={() => act.run(async () => { await api.setConsent(childId!, "health", true); })}>
              {t("intake.health.yes")}
            </Button>
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
          {questions.map((q) => {
            if (isOwnWords(q)) return null; // shown inside its question's card
            const mark = markedStep === step && open.has(q.id);
            const note = q.ladder ? questions.find((n) => n.id === `${q.id}_note`) : undefined;
            return (
              <div key={q.id} id={`q-${q.id}`} className="scroll-mt-24">
                <Card className={`p-5 ${mark ? "ring-4 ring-sun" : ""}`}>
                  <Question q={q} answers={answers} set={set} childId={childId} />
                  {note && <OwnWords q={note} answers={answers} set={set} />}
                  {q.id === "A1" && <p className="mt-2 text-xs text-muted">{t("intake.A1.nickname")}</p>}
                  {mark && <p className="mt-3 text-sm font-bold text-ink">{t("intake.answerThis")}</p>}
                </Card>
              </div>
            );
          })}
          <FormError>{act.error}</FormError>
          <div className="flex flex-wrap items-center gap-3">
            {i > 0 && <Button variant="ghost" onClick={() => setI(i - 1)}>{t("intake.back")}</Button>}
            <Button type="submit" size="lg" pending={act.pending} variant={open.size ? "soft" : "primary"}>
              {i + 1 < steps.length ? t("intake.next") : t("intake.finish")}
            </Button>
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

/** The start of each section (B67): "Section 3 of 9", the title in large bold type (about twice the question text)
 * and one line on what the section asks about, on a soft brand colour (text ≥ 4.5:1, lib/contrast.test.ts). */
function SectionBanner({ number, title, intro }: { number?: string; title: string; intro?: string }) {
  return (
    <header className="rounded-fk-lg bg-teal-soft px-5 py-5 sm:px-7">
      {number && <p className="text-sm font-bold text-ink-2">{number}</p>}
      <h1 className="mt-1 text-3xl font-extrabold leading-tight text-ink sm:text-4xl">{title}</h1>
      {intro && <p className="mt-2 text-base text-ink-2">{intro}</p>}
    </header>
  );
}

type SetAnswer = (id: string, v: QAnswer) => void;

/** One question of any kind. "Not sure" is stored as null (spec §5); an optional question has none unless it says
 * `not_sure` (B63). A chosen answer to an optional question is cleared by choosing it again (B63). */
export function Question({ q, answers, set, childId }: { q: QQuestion; answers: QAnswers; set: SetAnswer; childId: string | null }) {
  const t = useT();
  const [uiLang] = useLang();
  const v = answers[q.id];
  const text = inLang(q.text, uiLang);
  const label = text + (q.unit ? ` (${t(`intake.unit.${q.unit}`)})` : "") + (q.required ? "" : ` · ${t("intake.optional")}`);
  const hint = q.hint && <span className="mb-2 block text-xs text-muted">{inLang(q.hint, uiLang)}</span>;
  const problem = typedProblem(q, v, answers, today());
  const own = `intake.problem.${q.id}.${problem}`; // a question's own message, else the general one
  const error = problem && (t(own) !== own ? t(own) : t(`intake.problem.${problem}`, { min: q.range?.[0] ?? "", max: q.range?.[1] ?? "", n: ageInMonths(answers.A2, today()) ?? "" }));
  const alert = error && <p role="alert" className="mt-2 text-sm font-semibold text-[#8f3a2c]">{error}</p>;
  const options = shownOptions(q.id, answers, today()) ?? [];
  const opt = (o: string) => (q.option_text ? inLang(q.option_text, uiLang, o) : o);
  const clear = q.required ? undefined : () => set(q.id, undefined); // undefined: not answered, unlike null ("Not sure")
  const notSure = offersNotSure(q) && (
    <Choice name={q.id} type="radio" checked={v === null} onChange={() => set(q.id, null)} onClear={clear} label={t("intake.notSure")} />
  );
  // A typed answer: the input in its label, and "Not sure" next to it (a label can't hold another label).
  const typed = (input: ReactNode) => (
    <div className="space-y-2">
      <Field label={label} error={error}>{hint}{input}</Field>
      {notSure && <div className="flex">{notSure}</div>}
    </div>
  );
  const number = (s: string) => (s === "" ? undefined : Number(s));
  const str = typeof v === "string" ? v : "";

  switch (q.kind) {
    case "text":
      return typed(<Input value={str} maxLength={TEXT_MAX} onChange={(e) => set(q.id, e.target.value)} />);
    case "longtext":
      return typed(<Textarea rows={4} maxLength={LONGTEXT_MAX} value={str} onChange={(e) => set(q.id, e.target.value)} />);
    case "date": // three boxes are not one input, so a legend, not a label
      return (
        <fieldset>
          <legend className="mb-2 font-bold text-ink">{label}</legend>
          {hint}
          <DateInput value={str} onChange={(d) => set(q.id, d)} />
          {alert}
          {notSure && <div className="mt-2 flex">{notSure}</div>}
        </fieldset>
      );
    case "time":
      return typed(<Input type="time" value={str} onChange={(e) => set(q.id, e.target.value || undefined)} />);
    case "number":
      return typed(
        <Input type="number" inputMode="decimal" min={q.range?.[0]} max={q.range?.[1]} value={typeof v === "number" ? v : ""} onChange={(e) => set(q.id, number(e.target.value))} />,
      );
    case "months":
      return (
        <fieldset>
          <legend className="mb-2 font-bold text-ink">{label}</legend>
          {hint}
          {/* The unit right after the number; "Not yet" and "Not sure" on their own line (B61). */}
          <div className="grid grid-cols-[7rem_auto] items-center justify-start gap-2">
            <Input
              type="number" inputMode="numeric" min={0} max={240} step={1} aria-label={`${text} (${t("intake.months")})`}
              value={typeof v === "number" ? v : ""} onChange={(e) => set(q.id, number(e.target.value))}
            />
            <span className="text-sm font-semibold text-ink-2">{t("intake.months")}</span>
          </div>
          {alert}
          <div className="mt-2 flex flex-wrap gap-2">
            <Choice name={q.id} type="radio" checked={v === "not_yet"} onChange={() => set(q.id, "not_yet")} onClear={clear} label={t("intake.ability.0")} />
            {notSure}
          </div>
        </fieldset>
      );
    case "scale":
      return (
        <fieldset>
          <legend className="mb-2 font-bold text-ink">{label}</legend>
          {hint}
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((n) => <Choice key={n} name={q.id} type="radio" checked={v === n} onChange={() => set(q.id, n)} onClear={clear} label={String(n)} />)}
            {notSure}
          </div>
        </fieldset>
      );
    case "file":
      return <Files q={q} label={label} answers={answers} set={set} childId={childId} />;
    case "single":
      if (q.ladder) return <Ladder q={q} v={v} options={options} set={set} label={label} hint={hint} opt={opt} notSure={notSure} />;
      return (
        <fieldset>
          <legend className="mb-2 font-bold text-ink">{label}</legend>
          {hint}
          <div className="flex flex-wrap gap-2">
            {options.map((o) => <Choice key={o} name={q.id} type="radio" checked={v === o} onChange={() => set(q.id, o)} onClear={clear} label={opt(o)} />)}
            {notSure}
          </div>
        </fieldset>
      );
  }
  // multi
  const picked = Array.isArray(v) ? v : [];
  const toggle = (o: string) => {
    if (o === q.exclusive) return set(q.id, picked.includes(o) ? [] : [o]);
    const next = picked.includes(o) ? picked.filter((x) => x !== o) : [...picked.filter((x) => x !== q.exclusive), o];
    if (q.max && next.length > q.max) return;
    set(q.id, next);
  };
  return (
    <fieldset>
      <legend className="mb-2 font-bold text-ink">
        {label}
        {q.max && <span className="ml-2 text-xs font-semibold text-muted">{t("intake.pickUpTo", { n: q.max })}</span>}
      </legend>
      {hint}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Choice key={o} name={q.id} type="checkbox" checked={picked.includes(o)} onChange={() => toggle(o)} label={opt(o)} />)}
        {notSure}
      </div>
    </fieldset>
  );
}

/** A step-by-step skill question (B68): tick everything the child can do; the answer saved is the hardest one ticked
 * (content/questionnaire.ts ladderValue), so rules and old answers are unchanged. The ticks live here; a saved
 * answer (or "Not sure") ticks the saved option and every one before it. */
function Ladder({ q, v, options, set, label, hint, opt, notSure }: {
  q: QQuestion; v: QAnswer; options: string[]; set: SetAnswer; label: string; hint: ReactNode; opt: (o: string) => string; notSure: ReactNode;
}) {
  const [mine, setMine] = useState(() => ladderTicks(options, v));
  // Answer changed elsewhere ("Not sure" chosen, a round loaded): the boxes follow the saved answer.
  const ticked = ladderValue(options, mine) === (v ?? undefined) ? mine : ladderTicks(options, v);
  const toggle = (o: string) => {
    const next = ladderToggle(options, ticked, o);
    setMine(next);
    set(q.id, ladderValue(options, next));
  };
  return (
    <fieldset>
      <legend className="mb-2 font-bold text-ink">{label}</legend>
      {hint}
      <div className="flex flex-wrap gap-2">
        {options.map((o) => <Choice key={o} name={q.id} type="checkbox" checked={ticked.includes(o)} onChange={() => toggle(o)} label={opt(o)} />)}
        {notSure}
      </div>
    </fieldset>
  );
}

/** "Write in your own words" under a step-by-step question (B68): a small link that opens the `<id>_note` box (open
 * from the start when it has text). Stored with the answers; no rule reads it. */
function OwnWords({ q, answers, set }: { q: QQuestion; answers: QAnswers; set: SetAnswer }) {
  const t = useT();
  const [uiLang] = useLang();
  const v = answers[q.id];
  const [open, setOpen] = useState(typeof v === "string" && v !== "");
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 text-sm font-bold text-primary underline underline-offset-4">
        {t("intake.ownWords")}
      </button>
    );
  }
  return (
    <div className="mt-4">
      <Field label={`${inLang(q.text, uiLang)} · ${t("intake.optional")}`}>
        <Input autoFocus={!v} value={typeof v === "string" ? v : ""} maxLength={TEXT_MAX} onChange={(e) => set(q.id, e.target.value)} />
      </Field>
    </div>
  );
}

/** Documents or photos (B10, B13, CP21, DD3, I4): up to 5, uploaded once the child exists (after section A). */
function Files({ q, label, answers, set, childId }: { q: QQuestion; label: string; answers: QAnswers; set: SetAnswer; childId: string | null }) {
  const t = useT();
  const add = useAction(api.uploadIntakeFile);
  const keys = Array.isArray(answers[q.id]) ? (answers[q.id] as string[]) : [];
  return (
    <div className="space-y-3">
      <p className="font-bold text-ink">{label}</p>
      <ul className="space-y-2">
        {keys.map((k, n) => (
          <li key={k} className="flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-sm font-bold text-ink">
            <span className="inline-flex items-center gap-2"><FileUp className="size-4" aria-hidden /> {n + 1}</span>
            <Button size="sm" variant="ghost" onClick={() => set(q.id, keys.filter((x) => x !== k))}>
              <Trash2 className="size-4" aria-hidden /> {t("intake.P40.remove")}
            </Button>
          </li>
        ))}
      </ul>
      {childId && keys.length < FILES_MAX && (
        <label className={chip}>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              const key = f ? await add.run(childId, f) : undefined;
              if (key) set(q.id, [...keys, key]);
            }}
          />
          <FileUp className="mr-2 size-4" aria-hidden /> {t("intake.files.add")}
        </label>
      )}
      {add.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{add.error}</p>}
    </div>
  );
}
