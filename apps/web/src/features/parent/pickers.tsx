"use client";

import { useT } from "@/lib/i18n";
import type { AccessMode } from "@/lib/types";
import { AVATARS } from "./lib";

const ACCESS: AccessMode[] = ["touch", "dwell", "scan"];

export function AccessPicker({ value, onChange }: { value: AccessMode; onChange: (v: AccessMode) => void }) {
  const t = useT();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-bold">{t("parent.field.access")}</legend>
      {ACCESS.map((a) => (
        <label key={a} className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${value === a ? "border-teal bg-teal-soft/50" : "border-line hover:bg-surface-2"}`}>
          <input type="radio" name="access" className="mt-1 size-4 accent-teal" checked={value === a} onChange={() => onChange(a)} />
          <span>
            <span className="block font-bold">{t(`parent.access.${a}`)}</span>
            <span className="block text-sm text-muted">{t(`parent.access.${a}Hint`)}</span>
          </span>
        </label>
      ))}
      <p className="text-xs text-muted">{t("parent.access.keyboard")}</p>
    </fieldset>
  );
}

export function AvatarGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
      {AVATARS.map((a) => (
        <button
          key={a}
          type="button"
          aria-pressed={value === a}
          aria-label={a}
          onClick={() => onChange(a)}
          className={`grid aspect-square place-items-center rounded-2xl text-3xl transition ${value === a ? "bg-lavender-soft ring-4 ring-teal" : "bg-surface-2 hover:bg-lavender-soft"}`}
        >
          {a}
        </button>
      ))}
    </div>
  );
}
