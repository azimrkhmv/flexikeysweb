"use client";

import { useId, useState, type ReactNode } from "react";
import { setParentLook, setParentMode, STYLES, useParentLook } from "@/lib/appearance";
import { useT } from "@/lib/i18n";
import { SCHEMES, swatch } from "@/lib/theme";

/**
 * Account → Appearance (B110, Update 3 spec 4.1): the parent's colour, light or dark, and style on this device.
 * Changes apply at once with a 0.4 s fade (lib/appearance.ts). Night has no light version, yet Light is never
 * disabled: from Night it goes back to the last day colour, and says so on hover or focus.
 */
export function AppearanceSettings() {
  const t = useT();
  const look = useParentLook();
  const night = look.scheme === "night";
  const mode = night ? "dark" : look.mode;
  return (
    <div className="space-y-5">
      <Group label={t("look.colour")}>
        <div className="flex flex-wrap gap-x-2 gap-y-3">
          {SCHEMES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={look.scheme === s}
              onClick={() => setParentLook({ scheme: s })}
              className="flex w-[84px] flex-col items-center gap-1.5 rounded-2xl px-1 py-1.5 text-center text-xs font-bold leading-tight text-ink hover:bg-surface-2"
            >
              <span
                aria-hidden
                className={`size-11 rounded-full border-2 border-surface ${look.scheme === s ? "shadow-[0_0_0_3px_var(--ink)]" : "shadow-[0_0_0_1.5px_var(--edge)]"}`}
                style={{ background: swatch(s) }}
              />
              {t(`look.scheme.${s}`)}
            </button>
          ))}
        </div>
      </Group>
      <Group label={t("look.mode")}>
        <Segments>
          <BackToDay show={night} tip={t("look.backTo", { scheme: t(`look.scheme.${look.lastDay}`) })}>
            {(describedBy) => (
              <Segment pressed={mode === "light"} onClick={() => setParentMode("light")} describedBy={describedBy}>
                {t("look.light")}
              </Segment>
            )}
          </BackToDay>
          <Segment pressed={mode === "dark"} onClick={() => setParentMode("dark")}>
            {t("look.dark")}
          </Segment>
        </Segments>
      </Group>
      <Group label={t("look.style")}>
        <Segments>
          {STYLES.map((s) => (
            <Segment key={s} pressed={look.style === s} onClick={() => setParentLook({ style: s })}>
              {t(`look.${s}`)}
            </Segment>
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

/** Two buttons in a pill, the chosen one raised (the demo's `.seg`). */
function Segments({ children }: { children: ReactNode }) {
  return <div className="inline-flex rounded-full bg-line p-[3px]">{children}</div>;
}

function Segment({ pressed, onClick, describedBy, children }: { pressed: boolean; onClick: () => void; describedBy?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-describedby={describedBy}
      onClick={onClick}
      className={`min-h-10 rounded-full px-5 text-sm font-bold text-ink ${pressed ? "bg-surface shadow-soft" : "hover:bg-surface/50"}`}
    >
      {children}
    </button>
  );
}

/**
 * While Night is chosen, Light shows "Back to {scheme}, light" on hover or focus (a tooltip that stays while the
 * pointer is on it, and Escape hides it: WCAG 1.4.13).
 */
function BackToDay({ show, tip, children }: { show: boolean; tip: string; children: (describedBy?: string) => ReactNode }) {
  const id = useId();
  const [hidden, setHidden] = useState(false);
  if (!show) return <>{children()}</>;
  return (
    <span
      className="group relative inline-flex"
      onKeyDown={(e) => {
        if (e.key === "Escape" && !hidden) {
          e.stopPropagation();
          setHidden(true);
        }
      }}
      onMouseLeave={() => setHidden(false)}
      onBlur={() => setHidden(false)}
    >
      {children(id)}
      {/* The transparent pb-2 joins the tip to the button, so the pointer can move onto the tip. */}
      <span className={`absolute bottom-full left-0 z-20 pb-2 ${hidden ? "hidden" : "hidden group-focus-within:block group-hover:block"}`}>
        <span id={id} role="tooltip" className="block w-max max-w-60 rounded-xl bg-ink px-3 py-1.5 text-xs font-bold text-surface shadow-soft">
          {tip}
        </span>
      </span>
    </span>
  );
}
