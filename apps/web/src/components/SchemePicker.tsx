"use client";

import { useT } from "@/lib/i18n";
import { SCHEMES, setScheme, SWATCH, useScheme } from "@/lib/scheme";

/** Four round swatches (B99): the colour scheme of this device. */
export function SchemePicker() {
  const t = useT();
  const scheme = useScheme();
  return (
    <div role="group" aria-label={t("scheme.title")} className="flex flex-wrap items-center gap-3">
      {SCHEMES.map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={scheme === s}
          aria-label={t(`scheme.${s}`)}
          title={t(`scheme.${s}`)}
          onClick={() => setScheme(s)}
          className={`size-11 rounded-full border-2 border-white ${scheme === s ? "shadow-[0_0_0_3px_var(--ink)]" : "shadow-[0_0_0_1.5px_var(--edge)]"}`}
          style={{ background: `linear-gradient(135deg, ${SWATCH[s][0]} 50%, ${SWATCH[s][1]} 50%)` }}
        />
      ))}
    </div>
  );
}
