"use client";

import { setParentLook, useParentLook } from "@/lib/appearance";
import { useT } from "@/lib/i18n";
import { SCHEMES, swatch } from "@/lib/theme";

/** Six round swatches (B107): the parent's colour scheme on this device. */
export function SchemePicker() {
  const t = useT();
  const { scheme } = useParentLook();
  return (
    <div role="group" aria-label={t("look.colour")} className="flex flex-wrap items-center gap-3">
      {SCHEMES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={scheme === s}
          aria-label={t(`look.scheme.${s}`)}
          title={t(`look.scheme.${s}`)}
          onClick={() => setParentLook({ scheme: s })}
          className={`size-11 rounded-full border-2 border-surface ${scheme === s ? "shadow-[0_0_0_3px_var(--ink)]" : "shadow-[0_0_0_1.5px_var(--edge)]"}`}
          style={{ background: swatch(s) }}
        />
      ))}
    </div>
  );
}
