"use client";

import { useCallback, useEffect } from "react";
import { messages } from "@/messages";
import { persisted, useMounted, useStore } from "./store";

export type Lang = "uz" | "ru" | "en";
export const LANGS: Lang[] = ["uz", "ru", "en"];
export const LANG_NAMES: Record<Lang, string> = { uz: "Oʻzbekcha", ru: "Русский", en: "English" };

const langStore = persisted<Lang | null>("fk_lang", null);

function detect(): Lang {
  if (typeof navigator === "undefined") return "uz";
  const n = navigator.language.slice(0, 2);
  return n === "ru" || n === "en" ? n : "uz";
}

/**
 * UI language precedence: a choice made on this device (saved to the account by the dashboard shell) >
 * the account's saved language (applied at login, see `applyAccountLang`) > the browser language.
 */
export function applyAccountLang(accountLang: Lang) {
  if (langStore.get() === null) langStore.set(accountLang);
}

export function useLang(): [Lang, (l: Lang) => void] {
  const stored = useStore(langStore);
  const mounted = useMounted();
  const lang = stored ?? (mounted ? detect() : "uz");
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return [lang, langStore.set];
}

export type Vars = Record<string, string | number>;

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const s = messages[lang][key] ?? messages.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}

/** `t("area.key", {name})`. Pass `lang` to force a language (e.g. the child's UI language). */
export function useT(forceLang?: Lang) {
  const [uiLang] = useLang();
  const lang = forceLang ?? uiLang;
  return useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
}
