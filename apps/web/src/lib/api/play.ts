"use client";

// Child-token endpoints: child mode entry, sessions & events, rewards, AAC.

import { AREA_OF, AREAS, difficulty, elo } from "../skill";
import type { TryRecord } from "../tries";
import { LEVEL_BY_ID, levelComplete } from "@/content/levels";
import { SHOP_BY_ID } from "@/content/shop";
import { applyPolicy, bkt, startingProfile } from "../adaptive";
import type { Lang } from "../i18n";
import { read, write, net } from "./db";
import { requireChildAccess, requireChildToken, notify, FAMILY } from "./guards";
import { ApiError, CHILD_TOKEN_MS, id, iso, localDate } from "./schema";
import { sel } from "./selectors";
import type { AacCustomCard, ActivityKind, AdaptationChange, InputProfile, InteractionEvent, LearningSession } from "../types";

export const playApi = {
  // ------------------------------------------------------------ child mode (/children/{id}/session)
  /** POST /children/{id}/session — parent path. */
  async startChildMode(childId: string) {
    requireChildAccess(childId, FAMILY);
    // Same rule as the server: no core consent recorded = nothing may be stored for this child.
    if (!sel.hasConsent(read(), childId, "core")) throw await net(new ApiError("consent_missing"), 403);
    write((db) => {
      db.auth.child = { childId, grantedBy: "parent", exp: Date.now() + CHILD_TOKEN_MS };
    });
    return net(true, 60);
  },
  async exitChildMode() {
    write((db) => {
      db.auth.child = null;
    });
    return net(true, 0);
  },

  // ------------------------------------------------------------ sessions & events
  /** POST /sessions */
  async startSession(input: InputProfile) {
    const c = requireChildToken();
    const s: LearningSession = { id: id(), childId: c.childId, input, platform: "web", startedAt: iso(), activities: 0 };
    write((db) => {
      db.sessions.push(s);
    });
    return net(s.id, 0);
  },
  /** POST /sessions/{id}/events — session must belong to the child token (fixes B2). */
  async postEvents(sessionId: string, events: Omit<InteractionEvent, "sessionId">[], batchId?: string, startedAt?: number) {
    void [batchId, startedAt]; // the mock stores events synchronously, so there are no retries to de-duplicate
    const c = requireChildToken();
    const s = read().sessions.find((x) => x.id === sessionId);
    if (!s || s.childId !== c.childId) throw new ApiError("not_found");
    write((db) => {
      db.events.push(...events.map((e) => ({ ...e, sessionId })));
      if (db.events.length > 4000) db.events = db.events.slice(-4000); // ponytail: retention cap for localStorage
    });
    return net(true, 0);
  },
  /** PATCH /game-sessions/{id} {secondsPlayed} — game time of today, for the 20-minute daily limit (spec §13). */
  async addPlayTime(childId: string, seconds: number) {
    const c = requireChildToken();
    if (c.childId !== childId || seconds <= 0 || seconds > 60) throw new ApiError("not_found");
    const date = localDate();
    write((db) => {
      const row = db.playTime.find((p) => p.childId === childId && p.date === date);
      if (row) row.seconds += seconds;
      else db.playTime = [...db.playTime.filter((p) => p.childId !== childId), { childId, date, seconds }]; // only today is kept
    });
    return net(true, 0);
  },
  /** POST /children/{id}/tries — a batch of try records (spec §7). A try already stored (same id) is kept once. */
  async saveTries(childId: string, tries: TryRecord[]) {
    const c = requireChildToken();
    if (c.childId !== childId) throw new ApiError("not_found");
    write((db) => {
      const seen = new Set(db.tries.map((x) => x.id));
      const fresh = tries.filter((x) => x.childId === childId && !seen.has(x.id));
      db.tries.push(...fresh);
      // Every clean try moves θ of its area (spec §13). Access events never do (product rule 5).
      const skills = sel.skills(db, childId);
      for (const t of fresh) {
        const area = AREA_OF[t.game as ActivityKind];
        if (t.accessEvent || t.outcome === "skipped" || !area) continue;
        const s = skills[area];
        s.theta = elo(s.theta, s.n, difficulty(t.level), t.outcome === "correct");
        s.n += 1;
      }
      db.skills = [...db.skills.filter((s) => s.childId !== childId), ...AREAS.filter((a) => skills[a].n > 0).map((area) => ({ childId, area, ...skills[area] }))];
      if (db.tries.length > 4000) db.tries = db.tries.slice(-4000); // ponytail: localStorage cap; the server keeps 90 days
    });
    return net(true, 0);
  },
  /** Server-side reward rule on item/activity completion — the client never sends amounts (fixes B3). */
  async completeActivity(sessionId: string, levelId: string, activityId: string) {
    const c = requireChildToken();
    const level = LEVEL_BY_ID[levelId];
    if (!level || !level.activities.some((a) => a.id === activityId)) throw new ApiError("not_found");
    // Server-side gate: a locked level can't be played, whatever the client (or an assignment) says (FR-CUR-4).
    if (sel.lockReason(read(), c.childId, levelId)) throw new ApiError("level_locked");
    let result = { coins: 0, stars: 0, levelDone: false, first: false };
    write((db) => {
      const s = db.sessions.find((x) => x.id === sessionId && x.childId === c.childId);
      if (s) s.activities += 1;
      let p = db.progress.find((x) => x.childId === c.childId && x.levelId === levelId);
      if (!p) db.progress.push((p = { childId: c.childId, levelId, completed: [], stars: 0 }));
      const first = !p.completed.includes(activityId);
      const wasDone = levelComplete(level, p.completed);
      if (first) p.completed.push(activityId);
      const levelDone = !wasDone && levelComplete(level, p.completed);
      const stars = first ? 3 : 1;
      const coins = (first ? 5 : 2) + (levelDone ? 10 : 0);
      p.stars += stars;
      let w = db.wallets.find((x) => x.childId === c.childId);
      if (!w) db.wallets.push((w = { childId: c.childId, coins: 0, stars: 0, owned: [] }));
      w.coins += coins;
      w.stars += stars;
      result = { coins, stars, levelDone, first };
    });
    return net(result, 80);
  },
  /** PATCH /sessions/{id} (end) → worker job: metrics → BKT → bounded policy → audit log. */
  async endSession(sessionId: string) {
    const c = requireChildToken();
    let changed: AdaptationChange[] = [];
    write((db) => {
      const s = db.sessions.find((x) => x.id === sessionId && x.childId === c.childId);
      if (!s || s.endedAt) return;
      s.endedAt = iso();
      s.minutes = Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60_000));
      const events = db.events.filter((e) => e.sessionId === sessionId);
      const child = db.children.find((x) => x.id === c.childId);

      for (const e of events) {
        if (!e.levelId || e.correct === undefined) continue;
        let m = db.mastery.find((x) => x.childId === c.childId && x.skill === e.levelId);
        if (!m) db.mastery.push((m = { childId: c.childId, skill: e.levelId, pKnown: 0.2, attempts: 0, updatedAt: iso() }));
        m.pKnown = Math.round(bkt(m.pKnown, e.correct) * 100) / 100;
        m.attempts += 1;
        m.updatedAt = iso();
      }

      let rec = db.profiles.find((p) => p.childId === c.childId && p.input === s.input);
      if (!rec) {
        rec = { childId: c.childId, input: s.input, params: startingProfile(child?.support), version: 1, lastDir: {}, updatedAt: iso() };
        db.profiles.push(rec);
      }
      const { record, changes } = applyPolicy(rec, events, child?.support?.floors);
      Object.assign(rec, record);
      changed = changes.map((x) => ({ ...x, id: id(), childId: c.childId, input: s.input, at: iso() }));
      db.changes.push(...changed);
      if (changed.length && child?.familyId) notify(db, sel.familyOwner(db, child.familyId), "notif.adaptation", { name: child.name });
    });
    return net(changed, 0);
  },

  // ------------------------------------------------------------ rewards
  /** POST /rewards/{id}/redeem */
  async redeem(itemId: string) {
    const c = requireChildToken();
    const item = SHOP_BY_ID[itemId];
    if (!item) throw new ApiError("not_found");
    const w = sel.wallet(read(), c.childId);
    if (w.owned.includes(itemId)) return net(true);
    if (w.coins < item.price) throw new ApiError("insufficient_coins");
    write((db) => {
      const wallet = db.wallets.find((x) => x.childId === c.childId)!;
      wallet.coins -= item.price;
      wallet.owned.push(itemId);
    });
    return net(true);
  },
  /** PUT /rewards/equip */
  async equip(slot: "hat" | "color" | "bg", itemId: string | null) {
    const c = requireChildToken();
    if (itemId && !sel.wallet(read(), c.childId).owned.includes(itemId)) throw new ApiError("not_owned");
    write((db) => {
      const child = db.children.find((x) => x.id === c.childId)!;
      child.equipped = { ...child.equipped, [slot]: itemId ?? undefined };
    });
    return net(true, 0);
  },

  // ------------------------------------------------------------ AAC (/aac/*)
  /** POST /aac/events */
  async aacLog(cardIds: string[], sentence: string, lang: Lang) {
    const c = requireChildToken();
    write((db) => {
      db.aacEvents.push({ id: id(), childId: c.childId, cardIds, sentence, lang, at: iso() });
    });
    return net(true, 0);
  },
  /** POST /aac/compose — AI only with `ai_processing` consent (FR-AAC-3); otherwise plain join. */
  async aacCompose(labels: string[], lang: Lang) {
    const c = requireChildToken();
    const plain = labels.join(" ");
    if (!sel.hasConsent(read(), c.childId, "ai_processing")) return net({ sentence: plain, ai: false }, 0);
    // ponytail: stub composer — the real one calls LlmProvider with the ordered labels only.
    const s = plain.charAt(0).toUpperCase() + plain.slice(1) + (lang === "en" ? "." : ".");
    return net({ sentence: s, ai: true }, 350);
  },
  /** POST /aac/cards (parent only) — with the parent's own photo / voice (voice: voice-recording consent). */
  async aacAddCard(childId: string, card: Pick<AacCustomCard, "category" | "emoji" | "label">, media: { photo?: Blob | null; voice?: Blob | null } = {}) {
    requireChildAccess(childId, FAMILY);
    if (media.voice && !sel.hasConsent(read(), childId, "voice_recording")) throw new ApiError("consent_required");
    if (media.photo && media.photo.size > 1024 * 1024) throw new ApiError("file_too_large"); // demo: stored in this browser
    const photo = media.photo ? await dataUrl(media.photo) : undefined;
    // ponytail: the demo keeps a recorded voice for this browser session only (live: stored by the server).
    const audio = media.voice ? URL.createObjectURL(media.voice) : undefined;
    write((db) => {
      db.aacCards.push({ ...card, photo, audio, id: id(), childId, createdAt: iso() });
    });
    return net(true);
  },
  /** DELETE /aac/cards/{id} */
  async aacDeleteCard(cardId: string) {
    const card = read().aacCards.find((x) => x.id === cardId);
    if (!card) throw new ApiError("not_found");
    requireChildAccess(card.childId, FAMILY);
    write((db) => {
      db.aacCards = db.aacCards.filter((x) => x.id !== cardId);
    });
    return net(true);
  },
};

const dataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new ApiError("unsupported_file"));
    r.readAsDataURL(b);
  });

