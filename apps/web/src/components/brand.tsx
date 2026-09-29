"use client";

import Link from "next/link";
import { Globe } from "lucide-react";
import { LANG_NAMES, LANGS, useLang, useT } from "@/lib/i18n";
import type { Role } from "@/lib/types";

export function Logo({ href = "/", small }: { href?: string; small?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-xl" aria-label="FlexiKeys">
      <svg viewBox="0 0 48 36" width={small ? 32 : 40} height={small ? 24 : 30} aria-hidden>
        <path
          d="M13 32h24a9 9 0 0 0 1.5-17.9A12 12 0 0 0 15.3 11 10.5 10.5 0 0 0 13 32Z"
          fill="#e9f5f3"
          stroke="#3fa79c"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="22" r="1.8" fill="#27406b" />
        <circle cx="30" cy="22" r="1.8" fill="#27406b" />
        <path d="M22.5 26q2.5 2 5 0" stroke="#27406b" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`font-extrabold tracking-tight text-ink ${small ? "text-lg" : "text-xl"}`}>FlexiKeys</span>
    </Link>
  );
}

export function LangSwitch({ compact }: { compact?: boolean }) {
  const [lang, setLang] = useLang();
  const t = useT();
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 h-10 text-sm font-bold text-ink-2">
      <Globe className="size-4" aria-hidden />
      <span className="sr-only">{t("nav.language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as typeof lang)} className="bg-transparent font-bold text-ink outline-none">
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {compact ? l.toUpperCase() : LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

export const homeFor = (role: Role) => `/${role}`;
