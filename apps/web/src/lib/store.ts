"use client";

import { useSyncExternalStore } from "react";

/** Tiny localStorage-backed store usable from React via useSyncExternalStore. */
export function persisted<T>(key: string, initial: T) {
  let value: T = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = localStorage.getItem(key);
      if (raw) value = JSON.parse(raw) as T;
    } catch {
      /* private mode / blocked storage: keep defaults */
    }
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
      listeners.add(l);
      return () => listeners.delete(l);
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
