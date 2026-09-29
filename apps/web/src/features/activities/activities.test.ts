import { describe, expect, it } from "vitest";
import { LAYOUTS, reducedKeys, tokenize } from "./keyboard";

describe("keyboard tokens & reduced set", () => {
  it("treats Uzbek oʻ/gʻ as single keys and normalizes apostrophes", () => {
    expect(tokenize("koʻz", "uz")).toEqual(["k", "oʻ", "z"]);
    expect(tokenize("Og'iz", "uz")).toEqual(["o", "gʻ", "i", "z"]);
    expect(tokenize("мяч", "ru")).toEqual(["м", "я", "ч"]);
  });

  it("keeps every needed key, adds stable distractors, preserves layout order", () => {
    const keys = reducedKeys("en", ["c", "a", "t"], 8);
    expect(keys).toHaveLength(8);
    for (const k of ["c", "a", "t"]) expect(keys).toContain(k);
    const order = LAYOUTS.en.flat();
    expect([...keys].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(keys);
    expect(reducedKeys("en", ["c", "a", "t"], 8)).toEqual(keys);
  });

  it("every uz content token exists on the uz layout", () => {
    for (const w of ["qayiq", "avtobus", "koʻz", "ogʻiz"]) for (const k of tokenize(w, "uz")) expect(LAYOUTS.uz.flat()).toContain(k);
  });
});

// Smoke: every content activity renders in its engine in every learning language (content ↔ engine contract).
import { createElement, type ComponentType } from "react";
import { renderToString } from "react-dom/server";
import { LEVELS } from "@/content/levels";
import { DEMO_PLAY, PlayContext } from "@/features/play/context";
import { ENGINES, type EngineProps } from "./registry";

describe("engines render all content", () => {
  for (const lang of ["uz", "ru", "en"] as const)
    it(`all activities (${lang})`, () => {
      for (const level of LEVELS)
        for (const activity of level.activities) {
          const Engine = ENGINES[activity.kind] as ComponentType<EngineProps>;
          const html = renderToString(
            createElement(PlayContext.Provider, { value: { ...DEMO_PLAY, learnLang: lang, uiLang: lang } }, createElement(Engine, { activity, onDone: () => {} })),
          );
          expect(html.length, activity.id).toBeGreaterThan(100);
        }
    });
});
