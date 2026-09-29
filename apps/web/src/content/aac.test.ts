import { describe, expect, it } from "vitest";
import { aacCard, CUSTOM_PREFIX } from "./aac";

describe("aacCard", () => {
  const custom = [{ id: "k1", emoji: "🐈", label: "Mosh" }];

  it("labels built-in cards in the requested language", () => {
    expect(aacCard("want", "uz", custom)?.label).toBe("xohlayman");
  });

  it("resolves custom cards as logged by the sentence strip (prefixed) and bare", () => {
    expect(aacCard(`${CUSTOM_PREFIX}k1`, "en", custom)).toEqual({ emoji: "🐈", label: "Mosh" });
    expect(aacCard("k1", "en", custom)?.label).toBe("Mosh");
  });

  it("returns null for unknown ids", () => {
    expect(aacCard(`${CUSTOM_PREFIX}gone`, "en", custom)).toBeNull();
  });
});
