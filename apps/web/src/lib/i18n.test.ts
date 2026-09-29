import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { areaMessages } from "@/messages";
import { LEVELS } from "@/content/levels";
import { AAC_CARDS } from "@/content/aac";

// FR-L10N-1: every key exists in every language. FR-MAS-2: no failure words in child/adult copy.
describe("i18n catalogs", () => {
  for (const [area, m] of Object.entries(areaMessages)) {
    it(`${area}: same keys in en/uz/ru, no empty strings`, () => {
      const en = Object.keys(m.en).sort();
      expect(Object.keys(m.uz).sort()).toEqual(en);
      expect(Object.keys(m.ru).sort()).toEqual(en);
      for (const lang of ["en", "uz", "ru"] as const) for (const [k, v] of Object.entries(m[lang] as Record<string, string>)) expect(v.trim(), `${lang}:${k}`).not.toBe("");
    });
  }

  it("child-facing copy never uses failure words", () => {
    const banned = /\b(wrong|fail|failed|incorrect|bad|perfect!!)\b|неправильно|ошибка|xato|notoʻgʻri/i;
    for (const area of ["play", "activities", "aac"] as const)
      for (const lang of ["en", "uz", "ru"] as const)
        for (const [k, v] of Object.entries(areaMessages[area][lang] as Record<string, string>)) expect(banned.test(v), `${area}.${lang}.${k}: ${v}`).toBe(false);
  });

  it("every ApiError code thrown by the API has an err.* message in all languages", () => {
    const src = readFileSync(new URL("./api.ts", import.meta.url), "utf8");
    const codes = [...new Set([...src.matchAll(/new ApiError\("([a-z_]+)"\)/g)].map((m) => m[1]))];
    expect(codes.length).toBeGreaterThan(10);
    for (const lang of ["en", "uz", "ru"] as const)
      for (const code of codes) expect(areaMessages.common[lang] as Record<string, string>, `${lang}: err.${code}`).toHaveProperty([`err.${code}`]);
  });

  it("content is localized in all learning languages (FR-CUR-1)", () => {
    for (const l of LEVELS) for (const lang of ["en", "uz", "ru"] as const) expect(l.title[lang]).toBeTruthy();
    for (const c of AAC_CARDS) for (const lang of ["en", "uz", "ru"] as const) expect(c.label[lang]).toBeTruthy();
  });
});
