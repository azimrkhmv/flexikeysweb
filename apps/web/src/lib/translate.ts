// Translation core without React or a "use client" boundary, so server code (metadata, sitemap) can use it too.
// Catalogs are registered per area: public marketing pages load only `common` + `marketing`, while child and
// adult areas register their own sets (messages/child.ts, messages/adult.ts). Keeps unused strings out of bundles.

import { common } from "@/messages/common";

export type Lang = "uz" | "ru" | "en";
export const LANGS: Lang[] = ["uz", "ru", "en"];
export const LANG_NAMES: Record<Lang, string> = { uz: "Oʻzbekcha", ru: "Русский", en: "English" };
export const isLang = (x: unknown): x is Lang => LANGS.includes(x as Lang);

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

export function translate(lang: Lang, key: string, vars?: Vars): string {
  const s = dict[lang][key] ?? dict.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}
