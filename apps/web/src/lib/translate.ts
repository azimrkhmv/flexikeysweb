// Translation core without React or a "use client" boundary, so server code (metadata, sitemap) can use it too.
// Catalogs are registered per area: public marketing pages load only `common` + `marketing`, while child and
// adult areas register their own sets (messages/child.ts, messages/adult.ts). Keeps unused strings out of bundles.

import { common } from "@/messages/common";
import { toCyrillic } from "./cyrillic";

/** Content languages: catalogs, curriculum and voices exist in these three. */
export type Lang = "uz" | "ru" | "en";
export const LANGS: Lang[] = ["uz", "ru", "en"];
/** App languages (spec §4): Uzbek Cyrillic is derived from the Uzbek Latin catalog. */
export type UiLang = Lang | "uz_cyrl";
export const UI_LANGS: UiLang[] = ["uz", "uz_cyrl", "ru", "en"];
export const LANG_NAMES: Record<UiLang, string> = { uz: "Oʻzbekcha (Lotin)", uz_cyrl: "Ўзбекча (Кирилл)", ru: "Русский", en: "English" };
export const isLang = (x: unknown): x is Lang => LANGS.includes(x as Lang);
export const isUiLang = (x: unknown): x is UiLang => UI_LANGS.includes(x as UiLang);
export const baseLang = (l: UiLang): Lang => (l === "uz_cyrl" ? "uz" : l);

export type Vars = Record<string, string | number>;
type Area = Record<Lang, Record<string, string>>;

const dict: Record<Lang, Record<string, string>> = { uz: {}, ru: {}, en: {} };
const registered = new Set<Area>();

export function registerMessages(...areas: Area[]) {
  for (const a of areas) {
    if (registered.has(a)) continue;
    registered.add(a);
    for (const l of LANGS) Object.assign(dict[l], a[l]);
  }
}
registerMessages(common);

const cyrl = new Map<string, string>();
export function translate(lang: UiLang, key: string, vars?: Vars): string {
  let s = dict[baseLang(lang)][key] ?? dict.en[key] ?? key;
  if (lang === "uz_cyrl" && key in dict.uz) {
    const c = cyrl.get(s) ?? toCyrillic(s);
    cyrl.set(s, c);
    s = c;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}
