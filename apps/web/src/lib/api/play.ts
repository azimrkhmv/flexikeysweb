"use client";

// Child-token endpoints: child mode entry, sessions & events, rewards, AAC.

import { LEVEL_BY_ID, levelComplete } from "@/content/levels";
import { SHOP_BY_ID } from "@/content/shop";
import { applyPolicy, bkt, DEFAULT_PROFILE } from "../adaptive";
import type { Lang } from "../i18n";
import { read, write, net } from "./db";
import { requireChildAccess, requireChildToken, notify } from "./guards";
import { ApiError, CHILD_TOKEN_MS, id, iso } from "./schema";
import { sel } from "./selectors";
import type { AacCustomCard, AdaptationChange, InputProfile, InteractionEvent, LearningSession } from "../types";

export const playApi = {
  // ------------------------------------------------------------ child mode (/children/{id}/session, /class-login/*)
  /** POST /children/{id}/session — parent path. */
  async startChildMode(childId: string) {
    requireChildAccess(childId, ["owner"]);
    // Same rule as the server: no core consent recorded = nothing may be stored for this child.
    if (!sel.hasConsent(read(), childId, "core")) throw await net(new ApiError("consent_missing"), 403);
    write((db) => {
      db.auth.child = { childId, grantedBy: "parent", exp: Date.now() + CHILD_TOKEN_MS };
    });
    return net(true, 60);
  },
  /** POST /class-login/start — class code → roster (nickname + avatar only). */
  async classLoginStart(code: string) {
    const k = read().classes.find((c) => c.code === code.trim().toUpperCase());
    if (!k) throw await net(new ApiError("class_code_invalid"), 400);
    const roster = sel.classChildren(read(), k.id).map(({ id, name, avatar }) => ({ id, name, avatar }));
    return net({ classId: k.id, className: k.name, roster });
  },
  /** POST /class-login/child */
  async classLoginChild(classId: string, childId: string) {
    if (!read().enrollments.some((e) => e.classId === classId && e.childId === childId)) throw new ApiError("not_found");
    write((db) => {
      db.auth.child = { childId, grantedBy: "class", exp: Date.now() + CHILD_TOKEN_MS };
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
  async postEvents(sessionId: string, events: Omit<InteractionEvent, "sessionId">[]) {
    const c = requireChildToken();
    const s = read().sessions.find((x) => x.id === sessionId);
    if (!s || s.childId !== c.childId) throw new ApiError("not_found");
    write((db) => {
      db.events.push(...events.map((e) => ({ ...e, sessionId })));
      if (db.events.length > 4000) db.events = db.events.slice(-4000); // ponytail: retention cap for localStorage
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
        rec = { childId: c.childId, input: s.input, params: { ...DEFAULT_PROFILE }, version: 1, lastDir: {}, updatedAt: iso() };
        db.profiles.push(rec);
      }
      const { record, changes } = applyPolicy(rec, events);
      Object.assign(rec, record);
      changed = changes.map((x) => ({ ...x, id: id(), childId: c.childId, input: s.input, at: iso() }));
      db.changes.push(...changed);
      const child = db.children.find((x) => x.id === c.childId);
      if (changed.length && child?.parentId) notify(db, child.parentId, "notif.adaptation", { name: child.name });
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
  /** POST /aac/cards (parent only) */
  async aacAddCard(childId: string, card: Pick<AacCustomCard, "category" | "emoji" | "label">) {
    requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.aacCards.push({ ...card, id: id(), childId, createdAt: iso() });
    });
    return net(true);
  },
  /** DELETE /aac/cards/{id} */
  async aacDeleteCard(cardId: string) {
    const card = read().aacCards.find((x) => x.id === cardId);
    if (!card) throw new ApiError("not_found");
    requireChildAccess(card.childId, ["owner"]);
    write((db) => {
      db.aacCards = db.aacCards.filter((x) => x.id !== cardId);
    });
    return net(true);
  },
};
