"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { LANG_NAMES, LANGS, useRouteLang, useT, useLang, type Lang } from "@/lib/i18n";
import type { Role } from "@/lib/types";

/** `compact`: the cloud only on screens under 400 px (the signed-in header; it has no room for the word at 360 px). */
export function Logo({ href = "/", small, compact }: { href?: string; small?: boolean; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-xl" aria-label="FlexiKeys">
      <svg viewBox="0 0 48 36" width={small ? 32 : 40} height={small ? 24 : 30} aria-hidden>
        <path
          d="M13 32h24a9 9 0 0 0 1.5-17.9A12 12 0 0 0 15.3 11 10.5 10.5 0 0 0 13 32Z"
          fill="var(--cloudyBody)"
          stroke="var(--edge)"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="22" r="1.8" fill="var(--edge)" />
        <circle cx="30" cy="22" r="1.8" fill="var(--edge)" />
        <path d="M22.5 26q2.5 2 5 0" stroke="var(--edge)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </svg>
      <span className={`font-[family-name:var(--font-display)] font-semibold tracking-tight text-ink ${small ? "text-lg" : "text-xl"} ${compact ? "max-[399px]:sr-only" : ""}`}>
        Flexi<span className="text-primary">Keys</span>
      </span>
    </Link>
  );
}

export function LangSwitch({ compact }: { compact?: boolean }) {
  const [lang, setLang] = useLang();
  const routeLang = useRouteLang();
  const path = usePathname();
  const router = useRouter();
  const t = useT();
  // On public pages the language is part of the URL (/uz/pricing → /ru/pricing); elsewhere it's a preference.
  const choose = (l: Lang) => {
    setLang(l);
    if (routeLang) router.push(path.replace(/^\/(uz|ru|en)(?=\/|$)/, `/${l}`) + window.location.hash);
  };
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 h-10 text-sm font-bold text-muted">
      <Globe className="size-4" aria-hidden />
      <span className="sr-only">{t("nav.language")}</span>
      <select value={lang} onChange={(e) => choose(e.target.value as Lang)} className="bg-transparent font-bold text-ink outline-none">
        {(routeLang ? LANGS : LANGS).map((l) => (
          <option key={l} value={l}>
            {compact ? l.toUpperCase() : LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

export const homeFor = (role: Role) => `/${role}`;
