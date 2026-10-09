"use client";

import { createContext, useCallback, useContext, useEffect, type ReactNode } from "react";
import { persisted, useMounted, useStore } from "./store";
import { baseLang, isUiLang, translate, type Lang, type UiLang, type Vars } from "./translate";

export { baseLang, LANG_NAMES, LANGS, UI_LANGS, translate, type Lang, type UiLang, type Vars } from "./translate";

const langStore = persisted<UiLang | null>("fk_lang", null, { accept: (l) => l === null || isUiLang(l) });

/** Cookie copy of the choice so the server (proxy.ts) can send `/` to the right `/uz|/ru|/en` page. */
export const LANG_COOKIE = "fk_lang";
function chooseLang(l: UiLang) {
  langStore.set(l);
  document.cookie = `${LANG_COOKIE}=${baseLang(l)}; path=/; max-age=31536000; samesite=lax`;
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
export function applyAccountLang(accountLang: UiLang) {
  if (langStore.get() === null) langStore.set(accountLang);
}

/** False until someone picks a language on this device (sign-up starts with that choice, spec §4). */
export const useLangChosen = () => useStore(langStore) !== null;

/** The app language including Uzbek Cyrillic (for text). */
export function useUiLang(): [UiLang, (l: UiLang) => void] {
  const route = useRouteLang();
  const stored = useStore(langStore);
  const mounted = useMounted();
  const lang: UiLang = route ?? stored ?? (mounted ? detect() : "uz");
  useEffect(() => {
    document.documentElement.lang = lang === "uz_cyrl" ? "uz-Cyrl" : lang;
  }, [lang]);
  return [lang, chooseLang];
}

/** The content language (Uzbek Cyrillic reads Uzbek content). Use for curriculum, voices and formatting. */
export function useLang(): [Lang, (l: UiLang) => void] {
  const [lang, set] = useUiLang();
  return [baseLang(lang), set];
}

/** `t("area.key", {name})`. Pass `lang` to force a language (e.g. the child's UI language). */
export function useT(forceLang?: UiLang) {
  const [uiLang] = useUiLang();
  const lang = forceLang ?? uiLang;
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}
