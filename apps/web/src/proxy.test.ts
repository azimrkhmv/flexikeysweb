import { describe, expect, it } from "vitest";
import { pickLang } from "./proxy";

describe("pickLang", () => {
  it("prefers the saved choice", () => expect(pickLang("en", "ru-RU,ru;q=0.9")).toBe("en"));
  it("uses Accept-Language by quality", () => expect(pickLang(undefined, "de-DE,de;q=0.9,ru;q=0.8,en;q=0.7")).toBe("ru"));
  it("defaults to Uzbek", () => expect(pickLang(undefined, "de-DE")).toBe("uz"));
  it("ignores an invalid cookie", () => expect(pickLang("xx", "en-US")).toBe("en"));
});
