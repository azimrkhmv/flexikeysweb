import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/adaptive";
import { errorCode } from "./http";
import { changeFrom, childFrom, consentsFrom, eventTo, profileFrom, scopeFrom, scopeTo, sessionsFrom } from "./map";

describe("live ↔ web mappings", () => {
  it("consent scopes: web core = backend data_processing", () => {
    expect(scopeTo("core")).toBe("data_processing");
    expect(scopeTo("ai_processing")).toBe("ai_processing");
    expect(scopeFrom("data_processing")).toBe("core");
    expect(scopeFrom("coppa_parent_consent")).toBeNull();
    expect(consentsFrom([{ id: "1", child_id: "c", consent_type: "coppa_parent_consent", granted_at: "", version: null }])).toEqual([]);
  });

  it("children keep their settings and equipped items", () => {
    const c = childFrom({
      id: "c", parent_id: "p", display_name: "Lola", learning_language: "ru", ui_language: "en", birth_year: 2020,
      avatar_id: "🐰", access_mode: "scan", equipped: { hat: "hat_crown" }, created_at: "2026-09-01T00:00:00Z",
    });
    expect(c).toMatchObject({ name: "Lola", learningLang: "ru", uiLang: "en", access: "scan", avatar: "🐰" });
    expect(c.equipped.hat).toBe("hat_crown");
  });

  it("profile: backend params (and old profiles missing fields) → web profile", () => {
    expect(profileFrom({})).toEqual(DEFAULT_PROFILE);
    const p = profileFrom({ key_scale: 1.2, key_spacing: 1.5, dwell_time_ms: 40, debounce_ms: 50, hint_level: { a: 1, b: 3 }, option_count: 2 });
    expect(p).toMatchObject({ keyScale: 1.2, spacing: 12, dwellMs: 40, debounceMs: 150, hintLevel: 3, optionCount: 2 });
  });

  it("changes: direction of help decides the parent sentence", () => {
    const at = "2026-09-30T00:00:00Z";
    expect(changeFrom("c", { id: "1", changed_at: at, param: "dwell_time_ms", old_value: "0", new_value: "20", reason_code: "", sentence: "" })?.reasonKey).toBe("adapt.dwellMs.more");
    expect(changeFrom("c", { id: "2", changed_at: at, param: "option_count", old_value: "3", new_value: "2", reason_code: "", sentence: "" })?.reasonKey).toBe("adapt.optionCount.more");
    expect(changeFrom("c", { id: "3", changed_at: at, param: "key_spacing", old_value: "1.0", new_value: "1.05", reason_code: "", sentence: "" })).toMatchObject({ param: "spacing", from: 8, to: 8 });
    expect(changeFrom("c", { id: "4", changed_at: at, param: "session_pacing.suggest_break", old_value: "False", new_value: "True", reason_code: "", sentence: "" })).toBeNull();
  });

  it("events: answers and rejected taps become keystrokes; geometry only from touch/pen", () => {
    const start = Date.parse("2026-09-30T10:00:00Z");
    const touch = eventTo({ t: 1500, type: "select", levelId: "animals", target: "cat", actual: "dog", correct: false, latencyMs: 900, offsetRatio: 0.4, pointerType: "touch" }, start);
    expect(touch).toMatchObject({ occurred_at: "2026-09-30T10:00:01.500Z", skill_key: "animals", payload: { event_type: "keystroke", correct: false, offset_ratio: 0.4 } });
    const mouse = eventTo({ t: 0, type: "key", target: "a", actual: "a", correct: true, offsetRatio: 0.4, pointerType: "mouse" }, start);
    expect((mouse?.payload as { offset_ratio?: unknown }).offset_ratio).toBeNull();
    expect(eventTo({ t: 0, type: "accidental_tap", target: "a", pointerType: "touch" }, start)?.payload).toMatchObject({ accidental_tap: true });
    expect(eventTo({ t: 0, type: "trace_point", offsetRatio: 0.1 }, start)).toBeNull();
  });

  it("daily minutes → one pseudo-session per active day", () => {
    expect(sessionsFrom("c", [{ date: "2026-09-29", value: 0 }, { date: "2026-09-30", value: 6.4 }])).toMatchObject([{ minutes: 6, startedAt: "2026-09-30T12:00:00.000Z" }]);
  });

  it("server errors → explained codes (consent gate, AI consent, locked level)", () => {
    expect(errorCode(403, "consent_required", "/sessions")).toBe("consent_missing");
    expect(errorCode(403, "ai_consent_required", "/aac/compose-sentence")).toBe("ai_consent_required");
    expect(errorCode(422, "Core consent is required", "/children")).toBe("consent_required");
    expect(errorCode(403, "level_locked", "/activities/complete")).toBe("level_locked");
  });
});
