import type { InteractionEvent } from "./types";

// Child telemetry and activity completions survive a dropped connection: each one is queued (in memory and in
// localStorage), sent in order, and retried until the server answers. Every item keeps one id, so a retry of a
// batch the server already stored is ignored there (idempotent batch_id, PRD §14).

export type OutboxItem =
  | { kind: "events"; id: string; sessionId: string; startedAt: number; events: Omit<InteractionEvent, "sessionId">[] }
  | { kind: "complete"; id: string; sessionId: string; levelId: string; activityId: string }
  | { kind: "end"; id: string; sessionId: string };

type Dist<T> = T extends unknown ? Omit<T, "id"> : never;

const KEY = "fk_outbox_v1";
const MAX = 500; // ponytail: oldest items are dropped beyond this; enough for days of offline play

/**
 * True when retrying can help (no network, server error, throttled). False when the server refused the item —
 * including a lost login (a stale child token must not block the queue for the next session).
 */
export const retryable = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  return code === undefined || code === "generic" || code === "rate_limited";
};

function load(storage: Storage): OutboxItem[] {
  try {
    return JSON.parse(storage.getItem(KEY) ?? "[]") as OutboxItem[];
  } catch {
    return [];
  }
}

export function createOutbox(send: (item: OutboxItem) => Promise<unknown>, storage = typeof localStorage === "undefined" ? null : localStorage) {
  let items: OutboxItem[] = storage ? load(storage) : [];
  let running: Promise<void> | null = null;
  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(items));
    } catch {
      /* storage full: the queue still lives in memory for this visit */
    }
  };

  const drain = (): Promise<void> =>
    (running ??= (async () => {
      while (items.length) {
        try {
          await send(items[0]);
        } catch (e) {
          if (retryable(e)) break; // keep it, try again later
        }
        items = items.slice(1); // sent, or refused by the server (retrying can't help)
        save();
      }
    })().finally(() => (running = null)));

  return {
    add(item: Dist<OutboxItem>) {
      items = [...items, { ...item, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}` } as OutboxItem].slice(-MAX);
      save();
      return drain();
    },
    drain,
    get size() {
      return items.length;
    },
  };
}
