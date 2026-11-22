"use client";

import { useId, type ReactNode } from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { Tooltip } from "@base-ui/react/tooltip";
import { setParentLook, setParentMode, STYLES, useParentLook } from "@/lib/appearance";
import { useT } from "@/lib/i18n";
import { SCHEMES, swatch, type Scheme } from "@/lib/theme";

/**
 * Account → Appearance (B110, Update 3 spec 4.1): the parent's colour, light or dark, and style on this device.
 * Changes apply at once with a 0.4 s fade (lib/appearance.ts). Night has no light version, yet Light is never
 * disabled: from Night it goes back to the last day colour, and says so on hover or focus.
 * B118 (Update 4 spec 8.2): the three choices are Base UI toggle groups and the hint a Base UI tooltip (Escape hides
 * it, it stays while the pointer is on it: WCAG 1.4.13); the look is unchanged.
 */
export function AppearanceSettings() {
  const t = useT();
  const look = useParentLook();
  const night = look.scheme === "night";
  const mode = night ? "dark" : look.mode;
  const tipId = useId();
  const tip = t("look.backTo", { scheme: t(`look.scheme.${look.lastDay}`) });
  return (
    <div className="space-y-5">
      <Group label={t("look.colour")}>
        <ToggleGroup
          value={[look.scheme]}
          onValueChange={(v) => v[0] && setParentLook({ scheme: v[0] as Scheme })}
          aria-label={t("look.colour")}
          className="flex flex-wrap gap-x-2 gap-y-3"
        >
          {SCHEMES.map((s) => (
            <Toggle
              key={s}
              value={s}
              className="flex w-[84px] flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 text-center text-xs font-bold leading-tight text-ink hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={`size-11 rounded-full border-2 border-surface ${look.scheme === s ? "shadow-[0_0_0_3px_var(--ink)]" : "shadow-[0_0_0_1.5px_var(--edge)]"}`}
                style={{ background: swatch(s) }}
              />
              {t(`look.scheme.${s}`)}
            </Toggle>
          ))}
        </ToggleGroup>
      </Group>
      <Group label={t("look.mode")}>
        <Segments value={mode} onChange={(m) => setParentMode(m as "light" | "dark")} label={t("look.mode")}>
          {night ? (
            <Tooltip.Provider delay={0}>
              <Tooltip.Root>
                <Tooltip.Trigger render={<Toggle value="light" aria-describedby={tipId} className={segment(false)} />}>{t("look.light")}</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner side="top" align="start" sideOffset={8} className="z-50">
                    <Tooltip.Popup className="block w-max max-w-60 rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-surface shadow-soft">{tip}</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
              <span id={tipId} className="sr-only">{tip}</span>
            </Tooltip.Provider>
          ) : (
            <Toggle value="light" className={segment(mode === "light")}>{t("look.light")}</Toggle>
          )}
          <Toggle value="dark" className={segment(mode === "dark")}>{t("look.dark")}</Toggle>
        </Segments>
      </Group>
      <Group label={t("look.style")}>
        <Segments value={look.style} onChange={(s) => setParentLook({ style: s as (typeof STYLES)[number] })} label={t("look.style")}>
          {STYLES.map((s) => (
            <Toggle key={s} value={s} className={segment(look.style === s)}>
              {t(`look.${s}`)}
            </Toggle>
          ))}
        </Segments>
      </Group>
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-bold text-ink">{label}</legend>
      {children}
    </fieldset>
  );
}

/** Two buttons in a pill, the chosen one raised (the demo's `.seg`). One is always chosen. */
function Segments({ value, onChange, label, children }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <ToggleGroup value={[value]} onValueChange={(v) => v[0] && onChange(v[0])} aria-label={label} className="inline-flex rounded-full bg-line p-[3px]">
      {children}
    </ToggleGroup>
  );
}

const segment = (pressed: boolean) => `min-h-10 rounded-full px-5 text-sm font-bold text-ink ${pressed ? "bg-surface shadow-soft" : "hover:bg-surface/50"}`;
