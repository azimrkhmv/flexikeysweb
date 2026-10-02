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
    "CSRF check failed": "unauthorized",
    invalid_token: "invalid_token",
    token_used: "token_used",
    token_expired: "token_expired",
    account_disabled: "account_disabled",
    account_pending: "account_pending",
    confirmation_mismatch: "confirmation_mismatch",
    email_not_verified_by_provider: "email_not_verified_by_provider",
    consent_required: "consent_missing", // the server stores nothing for a child without core consent
    ai_consent_required: "ai_consent_required",
};

/** Every code errorCode() can return — each has an err.* message (checked by lib/i18n.test.ts). */
export const LIVE_ERROR_CODES = [
  ...new Set([...Object.values(BY_TITLE), "invalid_credentials", "unauthorized", "insufficient_coins", "not_found", "rate_limited", "forbidden", "generic"]),
];

/** Backend problem+json (status, title) → the web's localized error codes (messages/common.ts err.*). */
export function errorCode(status: number, title: string, path: string): string {
  if (status === 401) return path === "/auth/login" ? "invalid_credentials" : "unauthorized";
  if (status === 402) return "insufficient_coins";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  return BY_TITLE[title] ?? (status === 403 ? "forbidden" : "generic");
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
