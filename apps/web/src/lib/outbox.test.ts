import { describe, expect, it } from "vitest";
import { createOutbox, type OutboxItem } from "./outbox";
import { ApiError } from "./api/schema";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) } as unknown as Storage;
};

describe("outbox", () => {
  it("keeps items while offline and sends them in order, with the same batch id, when back online", async () => {
    let online = false;
    const sent: OutboxItem[] = [];
    const box = createOutbox(async (i) => {
      if (!online) throw new TypeError("Failed to fetch");
      sent.push(i);
    }, mem());
    await box.add({ kind: "events", sessionId: "s", startedAt: 0, events: [] });
    await box.add({ kind: "complete", sessionId: "s", levelId: "l1", activityId: "a1" });
    expect(box.size).toBe(2);
    online = true;
    await box.drain();
    expect(sent.map((i) => i.kind)).toEqual(["events", "complete"]);
    expect(box.size).toBe(0);
  });

  it("drops an item the server refuses so it can't block the queue", async () => {
    const box = createOutbox(async (i) => {
      if (i.kind === "complete") throw new ApiError("level_locked");
    }, mem());
    await box.add({ kind: "complete", sessionId: "s", levelId: "l9", activityId: "a" });
    await box.add({ kind: "end", sessionId: "s" });
    expect(box.size).toBe(0);
  });
});
