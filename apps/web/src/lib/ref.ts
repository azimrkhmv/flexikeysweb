"use client";

import { useEffect } from "react";

// Centre links (B113): https://flexikeys.org/?ref=<code>. Any page opened with ?ref= keeps the code on this device for
// 30 days; sign-up sends it, and the server keeps it on the account the first time a known code arrives.
// Kept even if the visitor already has a code: the server decides (first code wins on the account).

const KEY = "fk_ref";
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;
const CODE = /^[a-z0-9][a-z0-9-]{1,31}$/;

export const cleanRef = (raw: string | null | undefined) => {
  const code = (raw ?? "").trim().toLowerCase();
  return CODE.test(code) ? code : null;
};

export function saveRef(raw: string | null, now = Date.now(), storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage) {
  const code = cleanRef(raw);
  if (!code || !storage) return;
  try {
    storage.setItem(KEY, JSON.stringify({ code, at: now }));
  } catch {
    /* blocked or full storage: no centre link, nothing else breaks */
  }
}

/** The kept code, if it is younger than 30 days. */
export function readRef(now = Date.now(), storage: Storage | null = typeof localStorage === "undefined" ? null : localStorage): string | null {
  try {
    const v = JSON.parse(storage?.getItem(KEY) ?? "null") as { code?: string; at?: number } | null;
    return v && typeof v.at === "number" && now - v.at < KEEP_MS ? cleanRef(v.code) : null;
  } catch {
    return null;
  }
}

/** Mounted once in the root layout: keeps ?ref= from whatever page the visitor lands on. */
export function RefCatcher() {
  useEffect(() => {
    saveRef(new URLSearchParams(window.location.search).get("ref"));
  }, []);
  return null;
}
