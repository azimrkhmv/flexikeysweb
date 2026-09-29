"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny localStorage-backed store usable from React via useSyncExternalStore.
 * Other tabs' writes are picked up through the `storage` event, so two tabs never overwrite each other with
 * stale copies. `accept` rejects stored data of an old shape (the initial value is used instead).
 */
export function persisted<T>(key: string, initial: T, opts: { accept?: (stored: T) => boolean } = {}) {
  let value: T = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const parse = (raw: string | null): T | undefined => {
    if (!raw) return undefined;
    try {
      const v = JSON.parse(raw) as T;
      return !opts.accept || opts.accept(v) ? v : undefined;
    } catch {
      return undefined;
    }
  };

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      value = parse(localStorage.getItem(key)) ?? value;
    } catch {
      /* private mode / blocked storage: keep defaults */
    }
  };

  const onStorage = (e: StorageEvent) => {
    if (e.key !== key && e.key !== null) return; // null = another tab cleared all storage
    loaded = true;
    value = parse(e.newValue ?? null) ?? initial;
    listeners.forEach((l) => l());
  };

  return {
    get(): T {
      load();
      return value;
    },
    set(next: T | ((prev: T) => T)) {
      load();
      value = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch {
        /* ignore quota / blocked storage */
      }
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      if (!listeners.size && typeof window !== "undefined") window.addEventListener("storage", onStorage);
      listeners.add(l);
      return () => {
        listeners.delete(l);
        if (!listeners.size && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
      };
    },
    serverValue: initial,
  };
}

export type Persisted<T> = ReturnType<typeof persisted<T>>;

export function useStore<T>(store: Persisted<T>): T {
  return useSyncExternalStore(store.subscribe, store.get, () => store.serverValue);
}

/** True after hydration; use to avoid rendering localStorage-dependent UI on the server. */
export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
