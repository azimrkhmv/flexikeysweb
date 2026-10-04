"use client";

import { useState } from "react";
import { Button, Card, Checkbox, Field, Select, useAction } from "@/components/ui";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { Child, ChildSupport, FnLevel } from "@/lib/types";

// How a child moves, sees and communicates (parent-reported MACS / CFCS / VFCS levels) and the access settings
// adults choose. Levels only set the starting profile; the floors are minimums the adaptive engine never goes below.

const LEVELS: FnLevel[] = [1, 2, 3, 4, 5];
const SCALES = ["macs", "cfcs", "vfcs"] as const;

/** Level questions + calm screen. Used in the new-child wizard and in settings. */
export function LevelFields({ value, onChange }: { value: ChildSupport; onChange: (v: ChildSupport) => void }) {
  const t = useT();
  return (
    <fieldset className="space-y-4">
      <legend className="mb-1 text-sm font-bold">{t("support.title")}</legend>
      <p className="text-sm text-muted">{t("support.hint")}</p>
      {SCALES.map((k) => (
        <Field key={k} label={t(`support.${k}`)}>
          <Select value={value[k] ?? ""} onChange={(e) => onChange({ ...value, [k]: e.target.value ? (Number(e.target.value) as FnLevel) : undefined })}>
            <option value="">{t("support.unsure")}</option>
            {LEVELS.map((n) => (
              <option key={n} value={n}>
                {t(`support.${k}.${n}`)}
              </option>
            ))}
          </Select>
        </Field>
      ))}
      <Checkbox checked={!!value.calm} onChange={(calm) => onChange({ ...value, calm })} label={t("support.calm")} description={t("support.calmHint")} />
    </fieldset>
  );
}

const ms = (n: number) => `${(n / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} s`;

/** Levels + minimums + switch scanning + hover time, saved on its own. Parent settings and the linked therapist. */
export function SupportCard({ child }: { child: Child }) {
  const t = useT();
  const [s, setS] = useState<ChildSupport>(child.support ?? {});
  const [saved, setSaved] = useState(false);
  const save = useAction(api.updateSupport);
  const floors = s.floors ?? {};
  const scan = s.scan ?? { stepMs: 2000, mode: "auto" as const, speak: false };
  const set = (next: ChildSupport) => {
    setSaved(false);
    setS(next);
  };
  const setFloor = (patch: ChildSupport["floors"]) => set({ ...s, floors: { ...floors, ...patch } });
  const num = (v: string) => (v ? Number(v) : undefined);

  return (
    <Card className="max-w-2xl">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if ((await save.run(child.id, s)) !== undefined) setSaved(true);
        }}
      >
        <LevelFields value={s} onChange={set} />

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-bold">{t("support.access")}</legend>
          <p className="text-sm text-muted">{t("support.accessHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("support.minHold")} hint={t("support.minHoldHint")}>
              <Select value={floors.dwellMs ?? ""} onChange={(e) => setFloor({ dwellMs: num(e.target.value) })}>
                <option value="">{t("support.auto")}</option>
                {[150, 300, 450, 600].map((v) => (
                  <option key={v} value={v}>
                    {ms(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("support.minRepeat")} hint={t("support.minRepeatHint")}>
              <Select value={floors.debounceMs ?? ""} onChange={(e) => setFloor({ debounceMs: num(e.target.value) })}>
                <option value="">{t("support.auto")}</option>
                {[300, 450, 600].map((v) => (
                  <option key={v} value={v}>
                    {ms(v)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("support.minSize")}>
              <Select value={floors.targetScale ?? ""} onChange={(e) => setFloor({ targetScale: num(e.target.value), keyScale: num(e.target.value) })}>
                <option value="">{t("support.auto")}</option>
                {[1.1, 1.2, 1.3, 1.4].map((v) => (
                  <option key={v} value={v}>
                    +{Math.round((v - 1) * 100)}%
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("support.hover")} hint={t("support.hoverHint")}>
              <Select value={s.hoverMs ?? 1100} onChange={(e) => set({ ...s, hoverMs: Number(e.target.value) })}>
                {[600, 1100, 1500, 2000, 3000].map((v) => (
                  <option key={v} value={v}>
                    {ms(v)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </fieldset>

        {child.access === "scan" && (
          <fieldset className="space-y-4">
            <legend className="mb-1 text-sm font-bold">{t("support.scan")}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("support.scanSpeed")} hint={t("support.scanSpeedHint")}>
                <Select value={scan.stepMs} onChange={(e) => set({ ...s, scan: { ...scan, stepMs: Number(e.target.value) } })}>
                  {[1000, 1500, 2000, 3000, 4000, 5000].map((v) => (
                    <option key={v} value={v}>
                      {ms(v)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("support.scanMode")}>
                <Select value={scan.mode} onChange={(e) => set({ ...s, scan: { ...scan, mode: e.target.value as "auto" | "step" } })}>
                  <option value="auto">{t("support.scanAuto")}</option>
                  <option value="step">{t("support.scanStep")}</option>
                </Select>
              </Field>
            </div>
            <Checkbox checked={scan.speak} onChange={(speak) => set({ ...s, scan: { ...scan, speak } })} label={t("support.scanSpeak")} description={t("support.scanSpeakHint")} />
          </fieldset>
        )}

        {save.error && (
          <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
            {save.error}
          </p>
        )}
        <div className="flex items-center justify-end gap-3">
          {saved && (
            <span role="status" className="text-sm font-semibold text-teal">
              {t("parent.saved")}
            </span>
          )}
          <Button type="submit" pending={save.pending}>
            {t("common.save")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
