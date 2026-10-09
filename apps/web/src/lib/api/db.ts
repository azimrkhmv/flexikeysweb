"use client";

// The persisted mock database and its read/write primitives. `write` = one transaction.

import { sessionStore } from "../session";
import { persisted, useStore } from "../store";
import { ApiError, DB_VERSION, type DB } from "./schema";
import { seed } from "./seed";

export const dbStore = persisted<DB>("fk_db_v1", seed(), { accept: (d) => d?.v === DB_VERSION });
export const useDb = () => useStore(dbStore);

export const read = () => dbStore.get();
export const write = (fn: (db: DB) => void) => {
  try {
    dbStore.set((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") throw new ApiError("storage_full");
    throw e;
  }
  syncSession();
};

/** Mirrors "who is signed in" into the small session store that public pages read. */
export function syncSession() {
  const db = read();
  const role = db.users.find((u) => u.id === db.auth.userId)?.role ?? null;
  if (sessionStore.get().role !== role) sessionStore.set({ role });
}
/** Simulated network latency so loading states are exercised. */
export const net = <T>(value: T, ms = 120) => new Promise<T>((res) => setTimeout(() => res(value), ms));

// Browsers signed in before the session store existed get it filled on first load.
if (typeof window !== "undefined") syncSession();
