"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Video } from "lucide-react";
import { Button, Checkbox, Field, Input, Select, Textarea, useAction } from "@/components/ui";
import { allowsNotSure, P39_MAX, P40_MAX_CLIPS, type Answers, type Question } from "@/content/intake";
import { api, sel, useDb } from "@/lib/api";
import { putMedia } from "@/lib/media";
import { useLang, useT, type Lang } from "@/lib/i18n";
import type { IntakeValue } from "@/lib/types";

// One renderer per question kind (content/intake.ts). "Not sure" is stored as null (spec §5).

type Set = (id: string, v: IntakeValue | undefined) => void;

export const chip =
  "inline-flex min-h-12 cursor-pointer items-center rounded-2xl border border-line px-4 py-2 text-sm font-bold text-ink transition hover:bg-surface-2 has-checked:border-teal has-checked:bg-teal-soft has-focus-visible:ring-4 has-focus-visible:ring-primary-soft";

/** A chip with a radio or checkbox inside. `onClear`: a radio already chosen is cleared by choosing it again (a click,
 * or Space on the keyboard; B63). */
export function Choice({ name, type, checked, onChange, label, onClear }: { name: string; type: "radio" | "checkbox"; checked: boolean; onChange: () => void; label: string; onClear?: () => void }) {
  return (
    <label className={chip}>
      <input type={type} name={name} checked={checked} onChange={onChange} onClick={checked ? onClear : undefined} className="sr-only" />
      {label}
    </label>
  );
}

const MONTHS: Record<Lang, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  ru: ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"],
  uz: ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"],
};

/** Day · month · year in one row, the same whatever the browser's language (B60); the value stays "YYYY-MM-DD".
 * Until the year has 4 digits the answer stays empty, so typing "2018" never shows a wrong age on the way. */
export function DateInput({ value, onChange }: { value: string; onChange: (v: string | undefined) => void }) {
  const t = useT();
  const [lang] = useLang();
  const [y, m, d] = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.split("-") : ["", "", ""];
  const [parts, setParts] = useState({ d: d && String(Number(d)), m: m && String(Number(m)), y });
  const change = (p: Partial<typeof parts>) => {
    const n = { ...parts, ...p };
    setParts(n);
    onChange(n.d && n.m && /^\d{4}$/.test(n.y) ? `${n.y}-${n.m.padStart(2, "0")}-${n.d.padStart(2, "0")}` : undefined);
  };
  return (
    <div className="grid grid-cols-[4.5rem_minmax(0,1fr)_5.5rem] gap-2">
      <Input
        type="number" inputMode="numeric" min={1} max={31} placeholder={t("intake.date.day")} aria-label={t("intake.date.day")}
        value={parts.d} onChange={(e) => change({ d: e.target.value.slice(0, 2) })}
      />
      <Select aria-label={t("intake.date.month")} value={parts.m} onChange={(e) => change({ m: e.target.value })}>
        <option value="" disabled>{t("intake.date.month")}</option>
        {MONTHS[lang].map((name, i) => <option key={name} value={String(i + 1)}>{name}</option>)}
      </Select>
      <Input
        type="number" inputMode="numeric" min={1} placeholder={t("intake.date.year")} aria-label={t("intake.date.year")}
        value={parts.y} onChange={(e) => change({ y: e.target.value.slice(0, 4) })}
      />
    </div>
  );
}

export function QuestionField({ q, answers, set, childId, previous }: { q: Question; answers: Answers; set: Set; childId: string | null; previous?: IntakeValue }) {
  const t = useT();
  const v = answers[q.id];
  const label = t(`intake.${q.id}`) + (q.required ? "" : ` · ${t("intake.optional")}`);
  const opt = (o: string) => t(`intake.${q.id}.${o}`);
  const notSure = allowsNotSure(q) && <Choice name={q.id} type="radio" checked={v === null} onChange={() => set(q.id, null)} label={t("intake.notSure")} />;
  const last = previous !== undefined && <p className="mt-1 text-xs text-muted">{t("intake.lastTime", { value: show(previous, q, opt, t) })}</p>;

  if (q.kind === "text") return <Field label={label}><Input value={String(v ?? "")} maxLength={200} onChange={(e) => set(q.id, e.target.value)} /></Field>;
  if (q.kind === "date")
    return (
      <fieldset>
        <legend className="mb-2 text-sm font-bold text-ink">{label}</legend>
        <DateInput value={String(v ?? "")} onChange={(d) => set(q.id, d)} />
      </fieldset>
    );
  if (q.kind === "longtext") return <OwnWords q={q} label={label} answers={answers} set={set} childId={childId} />;
  if (q.kind === "media") return <Clips q={q} answers={answers} set={set} childId={childId} />;
  if (q.kind === "phone") return <Invite q={q} answers={answers} set={set} childId={childId} />;

  if (q.kind === "ability")
    return (
      <fieldset>
        <legend className="mb-2 font-bold text-ink">{label}</legend>
        <div className="flex flex-wrap gap-2">
          {[2, 1, 0].map((n) => <Choice key={n} name={q.id} type="radio" checked={v === n} onChange={() => set(q.id, n)} label={t(`intake.ability.${n}`)} />)}
          <Choice name={q.id} type="radio" checked={v === null} onChange={() => set(q.id, null)} label={t("intake.notSure")} />
        </div>
        {last}
      </fieldset>
    );

  if (q.kind === "single")
    return (
      <fieldset>
        <legend className="mb-2 font-bold text-ink">{label}</legend>
        <div className="flex flex-wrap gap-2">
          {q.options!.map((o) => <Choice key={o} name={q.id} type="radio" checked={v === o} onChange={() => set(q.id, o)} label={opt(o)} />)}
          {notSure}
        </div>
        {last}
      </fieldset>
    );

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
      <div className="flex flex-wrap gap-2">
        {q.options!.map((o) => <Choice key={o} name={q.id} type="checkbox" checked={picked.includes(o)} onChange={() => toggle(o)} label={opt(o)} />)}
        {notSure}
      </div>
      {last}
    </fieldset>
  );
}

function show(v: IntakeValue, q: Question, opt: (o: string) => string, t: (k: string) => string): string {
  if (v === null) return t("intake.notSure");
  if (q.kind === "ability") return t(`intake.ability.${v}`);
  if (Array.isArray(v)) return v.map(opt).join(", ");
  return q.options ? opt(String(v)) : String(v);
}

/** The round being answered (1 for a new child). */
function useRound(childId: string | null) {
  const db = useDb();
  return (childId && sel.intakeRound(db, childId)?.round) || 1;
}

/** P39: text or a voice note (≤ 2 min); keyword hints the parent confirms with one tap. */
function OwnWords({ q, label, answers, set, childId }: { q: Question; label: string; answers: Answers; set: Set; childId: string | null }) {
  const t = useT();
  const text = String(answers[q.id] ?? "");
  const [hints, setHints] = useState<string[]>([]);
  const kept = (answers.P39_hints as string[] | undefined) ?? [];
  const rec = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const voice = typeof answers.P39_voice === "string" ? answers.P39_voice : null;
  const round = useRound(childId);
  // A link to play the note again (a 15-minute link in live mode), kept with the note it belongs to.
  const [link, setLink] = useState<{ key: string; url: string | null } | null>(null);
  const listen = voice && link?.key === voice ? link.url : null;
  useEffect(() => {
    if (!voice || !childId) return;
    let live = true;
    api.voiceNoteUrl(childId, round, voice).then((url) => live && setLink({ key: voice, url })).catch(() => {});
    return () => {
      live = false;
    };
  }, [voice, childId, round]);

  useEffect(() => {
    const id = setTimeout(() => {
      if (text.trim().length > 10) api.ownWordsHints(text).then(setHints).catch(() => {});
    }, 600);
    return () => clearTimeout(id);
  }, [text]);

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
    if (!stream) return;
    const r = new MediaRecorder(stream);
    const parts: Blob[] = [];
    const began = Date.now();
    r.ondataavailable = (e) => parts.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((x) => x.stop());
      setSeconds(Math.round((Date.now() - began) / 1000));
      const blob = new Blob(parts, { type: r.mimeType });
      set("P39_voice", childId ? await api.saveVoiceNote(childId, blob) : await putMedia(blob));
      setRecording(false);
    };
    r.start();
    rec.current = r;
    setRecording(true);
    setTimeout(() => r.state === "recording" && r.stop(), 120_000);
  };

  return (
    <div className="space-y-3">
      <Field label={label} hint={t("intake.P39.d")}>
        <Textarea rows={5} maxLength={P39_MAX} value={text} onChange={(e) => set(q.id, e.target.value)} />
      </Field>
      {typeof MediaRecorder !== "undefined" && (
        <div className="flex flex-wrap items-center gap-3">
          {recording ? (
            <Button variant="outline" onClick={() => rec.current?.stop()}><Square className="size-4" aria-hidden /> {t("intake.P39.stop")}</Button>
          ) : (
            <Button variant="outline" onClick={start}><Mic className="size-4" aria-hidden /> {t("intake.P39.record")}</Button>
          )}
          {voice && !recording && seconds > 0 && <span role="status" className="text-sm font-semibold text-ink-2">{t("intake.P39.recorded", { s: seconds })}</span>}
          {listen && !recording && <audio controls src={listen} aria-label={t("intake.P39.listen")} className="h-10 max-w-full" />}
        </div>
      )}
      {hints.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-bold text-ink">{t("intake.P39.hints")}</p>
          <div className="flex flex-wrap gap-2">
            {hints.map((h) => (
              <Choice key={h} name="P39_hints" type="checkbox" checked={kept.includes(h)} onChange={() => set("P39_hints", kept.includes(h) ? kept.filter((x) => x !== h) : [...kept, h])} label={t(`intake.hint.${h}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** P40: up to 3 short clips; needs the movement-video consent. Never analysed by AI. */
function Clips({ q, answers, set, childId }: { q: Question; answers: Answers; set: Set; childId: string | null }) {
  const t = useT();
  const add = useAction(api.addMovementClip);
  const ids = (answers[q.id] as string[] | undefined) ?? [];
  const consent = answers.P40_consent === "yes";
  return (
    <div className="space-y-3">
      <p className="font-bold text-ink">{t("intake.P40")}</p>
      <p className="text-sm text-ink-2">{t("intake.P40.d")}</p>
      <Checkbox
        checked={consent}
        onChange={(on) => {
          set("P40_consent", on ? "yes" : undefined);
          // Given when ticked: the clips go to the server for the shared therapist (movement-videos consent).
          if (on && childId) api.setConsent(childId, "movement_videos", true).catch(() => {});
        }}
        label={t("intake.P40.consent")}
      />
      {consent && (
        <>
          <ul className="space-y-2">
            {ids.map((id, i) => (
              <li key={id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-3 py-2 text-sm font-bold text-ink">
                <span className="inline-flex items-center gap-2"><Video className="size-4" aria-hidden /> {i + 1}</span>
                <Button size="sm" variant="ghost" onClick={async () => { if (childId) await api.removeMovementClip(childId, id).catch(() => {}); set(q.id, ids.filter((x) => x !== id)); }}>
                  <Trash2 className="size-4" aria-hidden /> {t("intake.P40.remove")}
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("intake.P40.count", { n: ids.length })}</p>
          {ids.length < P40_MAX_CLIPS && (
            <label className={chip}>
              <input
                type="file"
                accept="video/*"
                capture="environment"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  const clip = f && childId ? await add.run(childId, f) : undefined;
                  if (clip) set(q.id, [...ids, clip]);
                }}
              />
              <Video className="mr-2 size-4" aria-hidden /> {t("intake.P40.add")}
            </label>
          )}
          {add.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{add.error}</p>}
        </>
      )}
    </div>
  );
}

/** P41: the therapist's phone; the share consent is asked right here, each time (spec §4). */
function Invite({ q, answers, set }: { q: Question; answers: Answers; set: Set; childId: string | null }) {
  const t = useT();
  return (
    <div className="space-y-3">
      <Field label={t("intake.P41")} hint={t("intake.P41.d")}>
        <Input type="tel" inputMode="tel" placeholder="+998" value={String(answers[q.id] ?? "")} onChange={(e) => set(q.id, e.target.value)} />
      </Field>
      {String(answers[q.id] ?? "").replace(/\D/g, "").length >= 9 && (
        <Checkbox checked={answers.P41_consent === "yes"} onChange={(on) => set("P41_consent", on ? "yes" : undefined)} label={t("intake.P41.consent")} />
      )}
    </div>
  );
}
