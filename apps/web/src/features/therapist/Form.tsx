"use client";

import { useState, type ReactNode } from "react";
import { Button, Card, Checkbox, Chip, Field, Input, Select, Textarea, useAction } from "@/components/ui";
import { SectionTitle, useMe } from "@/features/pro/shared";
import {
  CP_PARTS, CP_TYPES, FORM_IDS, GOALS, LEVELS, MAX_GOALS, MUST_NOT, PROFESSIONS, UPDATES,
  missing, requiredFor, type FormId, type Level, type Profession, type TherapistAnswers,
} from "@/content/therapist";
import { api, sel } from "@/lib/api";
import { baseLang, useLang, useT } from "@/lib/i18n";

// The therapist form (spec §6, B23, B25). T1 is the therapist's profile; T2–T11 are about one child, and which ones
// are required follows the profession. T9 (notes on clips) are the replies in Clips.tsx.

const ROMAN = ["I", "II", "III", "IV", "V"];

/** T1: name, profession, workplace. Shown open until it is filled in. */
export function ProfileCard() {
  const t = useT();
  const { db, me } = useMe();
  const saved = sel.therapistProfile(db, me.id);
  const [open, setOpen] = useState(!saved);
  const [name, setName] = useState(me.name);
  const [profession, setProfession] = useState<Profession | "">(saved?.profession ?? "");
  const [workplace, setWorkplace] = useState(saved?.workplace ?? "");
  const save = useAction(api.saveTherapistProfile);

  if (saved && !open)
    return (
      <Card>
        <SectionTitle>{t("tform.profile.title")}</SectionTitle>
        <p className="font-bold text-ink">{me.name}</p>
        <p className="mb-3 text-sm text-muted">
          {t(`tform.profession.${saved.profession}`)} · {saved.workplace}
        </p>
        <Button size="sm" variant="soft" onClick={() => setOpen(true)}>
          {t("tform.profile.edit")}
        </Button>
      </Card>
    );

  return (
    <Card>
      <SectionTitle>{t("tform.profile.title")}</SectionTitle>
      <p className="mb-4 text-sm text-muted">{t("tform.profile.hint")}</p>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (profession && (await save.run(name, profession, workplace))) setOpen(false);
        }}
      >
        <Field label={t("tform.profile.name")}>
          <Input required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("tform.profile.profession")}>
          <Select required value={profession} onChange={(e) => setProfession(e.target.value as Profession)}>
            <option value="" disabled>
              {t("tform.choose")}
            </option>
            {PROFESSIONS.map((p) => (
              <option key={p} value={p}>
                {t(`tform.profession.${p}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("tform.profile.workplace")}>
          <Input required maxLength={120} value={workplace} onChange={(e) => setWorkplace(e.target.value)} />
        </Field>
        <Button type="submit" size="sm" pending={save.pending}>
          {t("common.save")}
        </Button>
        {save.error && <p className="text-sm font-semibold text-[#8f3a2c]">{save.error}</p>}
      </form>
    </Card>
  );
}

/** One question of the form, with its "required" mark and the message when it is still missing. */
function Q({ id, required, missing: miss, children }: { id: FormId; required: boolean; missing: boolean; children: ReactNode }) {
  const t = useT();
  return (
    <fieldset className="space-y-2 border-t border-line pt-4 first:border-0 first:pt-0" data-question={id}>
      <legend className="mb-2 flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
        {t(`tform.${id}`)}
        {required && <Chip tone="sun">{t("tform.required")}</Chip>}
      </legend>
      {children}
      {miss && (
        <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
          {t("tform.missing")}
        </p>
      )}
    </fieldset>
  );
}

function LevelSelect({ id, value, onChange }: { id: "T2" | "T3" | "T4"; value?: Level; onChange: (v?: Level) => void }) {
  const t = useT();
  return (
    <Select aria-label={t(`tform.${id}`)} value={value ?? ""} onChange={(e) => onChange(e.target.value ? (Number(e.target.value) as Level) : undefined)}>
      <option value="">{t("tform.notGiven")}</option>
      {LEVELS.map((l) => (
        <option key={l} value={l}>
          {ROMAN[l - 1]}
        </option>
      ))}
    </Select>
  );
}

/** T2–T7, T10, T11 for one child. Saving needs every answer the therapist's profession requires. */
export function TherapistForm({ childId }: { childId: string }) {
  const t = useT();
  const { db, me } = useMe();
  const [lang] = useLang();
  const profile = sel.therapistProfile(db, me.id);
  const [a, setA] = useState<TherapistAnswers>(() => sel.therapistAnswers(db, childId, me.id));
  const [sent, setSent] = useState<TherapistAnswers>(a); // what the server has, so a save sends only the changes
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState<null | { planRebuilt: boolean }>(null);
  const library = sel.usableVideos(db, baseLang(lang));
  const save = useAction(api.saveTherapistForm);
  const set = (patch: TherapistAnswers) => {
    setA((x) => ({ ...x, ...patch }));
    setSaved(null);
  };

  if (!profile)
    return (
      <Card>
        <SectionTitle>{t("tform.title")}</SectionTitle>
        <p className="text-sm text-muted">{t("tform.profileFirst")}</p>
      </Card>
    );

  const required = requiredFor(profile.profession);
  const open = missing(a, profile.profession);
  const q = (id: FormId) => ({ id, required: required.includes(id), missing: tried && open.includes(id) });
  const t6 = a.T6 ?? { items: [], text: "" };
  const t7 = a.T7 ?? { goals: [], own: [] };
  const t8 = a.T8 ?? { assign: [], exclude: [] };
  const choice = (ex: string) => (t8.assign.includes(ex) ? "assign" : t8.exclude.includes(ex) ? "exclude" : "");
  const goalCount = t7.goals.length + t7.own.filter((g) => g.trim()).length;
  const toggle = (list: string[], v: string, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v));

  return (
    <Card>
      <SectionTitle>{t("tform.title")}</SectionTitle>
      <p className="mb-4 text-sm text-muted">{t("tform.hint")}</p>
      <form
        noValidate
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setTried(true);
          if (open.length) return;
          const clean: TherapistAnswers = { ...a, T7: a.T7 && { ...a.T7, own: a.T7.own.map((g) => g.trim()).filter(Boolean) } };
          const changes = Object.fromEntries(FORM_IDS.filter((k) => JSON.stringify(clean[k]) !== JSON.stringify(sent[k])).map((k) => [k, clean[k]]));
          const done = await save.run(childId, changes);
          if (done !== undefined) {
            setSent(clean);
            setSaved(done);
          }
        }}
      >
        <Q {...q("T2")}>
          <LevelSelect id="T2" value={a.T2} onChange={(T2) => set({ T2 })} />
        </Q>
        <Q {...q("T3")}>
          <LevelSelect id="T3" value={a.T3} onChange={(T3) => set({ T3 })} />
        </Q>
        <Q {...q("T4")}>
          <LevelSelect id="T4" value={a.T4} onChange={(T4) => set({ T4 })} />
        </Q>
        <Q {...q("T5")}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("intake.P10")}>
              <Select value={a.T5?.type ?? ""} onChange={(e) => set({ T5: { type: e.target.value || null, parts: a.T5?.parts ?? null } })}>
                <option value="">{t("tform.notGiven")}</option>
                {CP_TYPES.map((o) => (
                  <option key={o} value={o}>
                    {t(`intake.P10.${o}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("intake.P11")}>
              <Select value={a.T5?.parts ?? ""} onChange={(e) => set({ T5: { type: a.T5?.type ?? null, parts: e.target.value || null } })}>
                <option value="">{t("tform.notGiven")}</option>
                {CP_PARTS.map((o) => (
                  <option key={o} value={o}>
                    {t(`intake.P11.${o}`)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Q>
        <Q {...q("T6")}>
          <div className="grid gap-2 sm:grid-cols-2">
            {MUST_NOT.filter((o) => o !== "other").map((o) => (
              <Checkbox
                key={o}
                label={t(`intake.P14.${o}`)}
                checked={t6.items.includes(o)}
                onChange={(on) => set({ T6: { text: o === "nothing" && on ? "" : t6.text, items: o === "nothing" ? (on ? ["nothing"] : []) : toggle(t6.items.filter((x) => x !== "nothing"), o, on) } })}
              />
            ))}
          </div>
          <Field label={t("tform.T6.text")}>
            <Textarea maxLength={1000} disabled={t6.items.includes("nothing")} value={t6.text} onChange={(e) => set({ T6: { ...t6, text: e.target.value } })} />
          </Field>
        </Q>
        <Q {...q("T7")}>
          <p className="text-xs text-muted">{t("tform.T7.hint", { n: MAX_GOALS })}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {GOALS.map((g) => (
              <Checkbox
                key={g}
                label={t(`intake.P33.${g}`)}
                checked={t7.goals.includes(g)}
                disabled={!t7.goals.includes(g) && goalCount >= MAX_GOALS}
                onChange={(on) => set({ T7: { ...t7, goals: toggle(t7.goals, g, on) } })}
              />
            ))}
          </div>
          {Array.from({ length: MAX_GOALS }, (_, i) => (
            <Input
              key={i}
              aria-label={t("tform.T7.own", { n: i + 1 })}
              placeholder={t("tform.T7.own", { n: i + 1 })}
              maxLength={200}
              value={t7.own[i] ?? ""}
              disabled={!(t7.own[i] ?? "").trim() && goalCount >= MAX_GOALS}
              onChange={(e) => {
                const own = [...t7.own];
                own[i] = e.target.value;
                set({ T7: { ...t7, own } });
              }}
            />
          ))}
        </Q>
        <Q {...q("T8")}>
          <p className="text-xs text-muted">{t("tform.T8.hint")}</p>
          <ul className="divide-y divide-line">
            {library.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm font-semibold text-ink">{v.title[baseLang(lang)]}</span>
                <Select
                  aria-label={v.title[baseLang(lang)]}
                  className="h-10 w-auto"
                  value={choice(v.id)}
                  onChange={(e) => {
                    const assign = t8.assign.filter((x) => x !== v.id);
                    const exclude = t8.exclude.filter((x) => x !== v.id);
                    if (e.target.value === "assign") assign.push(v.id);
                    if (e.target.value === "exclude") exclude.push(v.id);
                    set({ T8: assign.length || exclude.length ? { assign, exclude } : undefined });
                  }}
                >
                  <option value="">{t("tform.T8.plan")}</option>
                  <option value="assign">{t("tform.T8.assign")}</option>
                  <option value="exclude">{t("tform.T8.exclude")}</option>
                </Select>
              </li>
            ))}
          </ul>
        </Q>
        <Q {...q("T10")}>
          <Select aria-label={t("tform.T10")} value={a.T10 ?? ""} onChange={(e) => set({ T10: (e.target.value || undefined) as TherapistAnswers["T10"] })}>
            <option value="">{t("tform.notGiven")}</option>
            {UPDATES.map((u) => (
              <option key={u} value={u}>
                {t(`tform.T10.${u}`)}
              </option>
            ))}
          </Select>
        </Q>
        <Q {...q("T11")}>
          <Textarea aria-label={t("tform.T11")} maxLength={1000} value={a.T11 ?? ""} onChange={(e) => set({ T11: e.target.value || undefined })} />
        </Q>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" pending={save.pending}>
            {t("common.save")}
          </Button>
          {saved && <span className="text-sm font-semibold text-teal">{t(saved.planRebuilt ? "tform.rebuilt" : "tform.saved")}</span>}
          {tried && open.length > 0 && <span className="text-sm font-semibold text-[#8f3a2c]">{t("tform.fillRequired")}</span>}
        </div>
        {save.error && <p className="text-sm font-semibold text-[#8f3a2c]">{save.error}</p>}
      </form>
    </Card>
  );
}
