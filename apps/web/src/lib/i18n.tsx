"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { persisted, useMounted, useStore } from "./store";
import { isLang, translate, type Lang, type Vars } from "./translate";

export { LANG_NAMES, LANGS, translate, type Lang, type Vars } from "./translate";

// Uzbek Cyrillic was an app language until 2026-10-22: a device that chose it opens in Uzbek Latin.
try {
  if (typeof window !== "undefined" && localStorage.getItem("fk_lang") === '"uz_cyrl"') localStorage.setItem("fk_lang", '"uz"');
} catch {
  /* blocked storage: nothing saved to move */
}
const langStore = persisted<Lang | null>("fk_lang", null, { accept: (l) => l === null || isLang(l) });

/** Cookie copy of the choice so the server (proxy.ts) can send `/` to the right `/uz|/ru|/en` page. */
export const LANG_COOKIE = "fk_lang";
function chooseLang(l: Lang) {
  langStore.set(l);
  document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
}

function detect(): Lang {
  if (typeof navigator === "undefined") return "uz";
  const n = navigator.language.slice(0, 2);
  return n === "ru" || n === "en" ? n : "uz";
}

/** Public pages live under /uz, /ru, /en: the URL decides their language, on the server and in the browser. */
const RouteLang = createContext<Lang | null>(null);
export function RouteLangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  return <RouteLang.Provider value={lang}>{children}</RouteLang.Provider>;
}
export const useRouteLang = () => useContext(RouteLang);

/**
 * UI language precedence: the URL on public pages; elsewhere a choice made on this device (saved to the
 * account by the dashboard shell) > the account's saved language (applied at login) > the browser language.
 */
export function applyAccountLang(accountLang: Lang) {
  if (langStore.get() === null) langStore.set(accountLang);
}

/** False until someone picks a language on this device (sign-up starts with that choice, spec §4). */
export const useLangChosen = () => useStore(langStore) !== null;

/** The app language: text, curriculum, voices and formatting. */
export function useLang(): [Lang, (l: Lang) => void] {
  const route = useRouteLang();
  const stored = useStore(langStore);
  const mounted = useMounted();
  const lang: Lang = route ?? stored ?? (mounted ? detect() : "uz");
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return [lang, chooseLang];
}

/** `t("area.key", {name})`. Pass `lang` to force a language (e.g. the child's UI language). */
export function useT(forceLang?: Lang) {
  const [uiLang] = useLang();
  const lang = forceLang ?? uiLang;
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}
