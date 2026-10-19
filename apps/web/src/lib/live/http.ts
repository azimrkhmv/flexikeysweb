"use client";

import { ApiError } from "@/lib/api/schema";

// Same-origin JSON client for the FastAPI backend (PRD §38). Auth is httpOnly cookies set by the API
// (X-Auth-Transport: cookie); writes echo the fk_csrf cookie in X-CSRF-Token (double submit).
const BASE = "/api/v1";

const csrf = () => (typeof document === "undefined" ? "" : document.cookie.split("; ").find((c) => c.startsWith("fk_csrf="))?.slice(8) ?? "");

const BY_TITLE: Record<string, string> = {
    "Email already registered": "email_taken",
    "Core consent is required": "consent_required",
    "School sharing consent required": "consent_required",
    "Core consent can't be withdrawn — delete the profile": "core_consent_required_use_delete",
    level_locked: "level_locked",
    plan_required: "level_locked", // same gentle "not open yet" as the mastery gate (sel.lockReason)
    not_owned: "not_owned",
    already_owned: "already_owned",
    // The new server (apps/api): its codes are the web's own error codes.
    csrf_failed: "unauthorized",
    token_reused: "unauthorized",
    invalid_phone: "invalid_phone",
    // the admins' second sign-in step (A13.1)
    second_step_not_set: "second_step_not_set",
    second_step_required: "second_step_required",
    // helpers (apps/api accounts/helpers.py)
    owner_only: "owner_only",
    too_many_helpers: "too_many_helpers",
    already_member: "already_member",
    not_a_parent: "not_a_parent",
    // therapist shares (apps/api therapists/)
    no_profile: "no_profile",
    profile_needed: "profile_needed",
    invite_not_found: "invite_invalid",
    already_invited: "already_invited",
    already_shared: "already_invited",
    not_a_therapist: "not_a_therapist",
    too_many_shares: "too_many_shares",
    code_too_soon: "code_too_soon",
    too_many_codes: "too_many_codes",
    invalid_code: "invalid_code",
    code_expired: "code_expired",
    too_many_tries: "too_many_tries",
    invalid_district: "invalid_district",
    invalid_token: "invalid_token",
    token_used: "token_used",
    token_expired: "token_expired",
    account_disabled: "account_disabled",
    account_pending: "account_pending",
    confirmation_mismatch: "confirmation_mismatch",
    email_not_verified_by_provider: "email_not_verified_by_provider",
    quota_exceeded: "quota_exceeded",
    file_too_large: "file_too_large",
    unsupported_file: "unsupported_file",
    consent_required: "consent_required", // the basic consent at sign-up
    child_consent_required: "consent_missing", // a child's health or video consent is missing
    ai_consent_required: "ai_consent_required",
    no_task_today: "no_task_today", // Today (A5.3–A5.5)
    not_yet: "not_yet",
    not_todays_question: "not_todays_question",
    invalid_answer: "invalid_answer",
    pro_only: "pro_only", // what Free does not include (A7.2)
    trial_used: "trial_used",
    no_family: "no_family",
    payments_not_available: "payments_not_available",
    slot_taken: "slot_taken", // booking (A10.4)
    slot_gone: "slot_gone",
    mode_not_offered: "mode_not_offered",
    slot_in_past: "slot_in_past", // the clinic dashboard (A10.3, A10.4)
    slot_too_far: "slot_too_far",
    slot_overlaps: "slot_overlaps",
    slot_booked: "slot_booked",
    online_link_needed: "online_link_needed",
    booking_cancelled: "booking_cancelled",
};

/** Every code errorCode() can return — each has an err.* message (checked by lib/i18n.test.ts). */
export const LIVE_ERROR_CODES = [
  ...new Set([...Object.values(BY_TITLE), "invalid_credentials", "unauthorized", "insufficient_coins", "not_found", "rate_limited", "forbidden", "generic"]),
];

/** Backend problem+json (status, title) → the web's localized error codes (messages/common.ts err.*). */
export function errorCode(status: number, title: string, path: string): string {
  if (BY_TITLE[title]) return BY_TITLE[title]; // a known code wins (e.g. 429 code_too_soon is not "rate_limited")
  if (status === 401) return path === "/auth/login" ? "invalid_credentials" : "unauthorized";
  if (status === 402) return "insufficient_coins";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return status === 403 ? "forbidden" : "generic";
}

async function send(method: string, path: string, body: unknown): Promise<Response> {
  const headers: Record<string, string> = { "X-Auth-Transport": "cookie" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrf();
  return fetch(BASE + path, { method, headers, credentials: "same-origin", body: body === undefined ? undefined : JSON.stringify(body) });
}

let refreshing: Promise<boolean> | null = null;
/** One refresh at a time; concurrent 401s wait for it (refresh tokens rotate — reuse revokes the family). */
function refresh() {
  refreshing ??= send("POST", "/auth/refresh", {})
    .then((r) => r.ok)
    .finally(() => (refreshing = null));
  return refreshing;
}

export async function http<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T> {
  let res = await send(method, path, body);
  if (res.status === 401 && !path.startsWith("/auth/") && (await refresh())) res = await send(method, path, body);
  if (!res.ok) {
    let title = "";
    try {
      title = String((await res.json()).title ?? "");
    } catch {
      /* not JSON */
    }
    throw new ApiError(errorCode(res.status, title, path));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Multipart upload of one file (cookie auth + CSRF, like every write). */
export async function upload<T>(method: "PUT" | "POST", path: string, file: Blob, name = "file"): Promise<T> {
  const form = new FormData();
  form.append("file", file, name);
  const res = await fetch(BASE + path, {
    method,
    headers: { "X-Auth-Transport": "cookie", "X-CSRF-Token": csrf() },
    credentials: "same-origin",
    body: form,
  });
  if (!res.ok) {
    const title = await res.json().then((j: { title?: string }) => String(j.title ?? "")).catch(() => "");
    throw new ApiError(errorCode(res.status, title, path));
  }
  return (await res.json()) as T;
}

