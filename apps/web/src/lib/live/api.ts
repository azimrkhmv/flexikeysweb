"use client";

import { ApiError } from "@/lib/api/schema";
import { AAC_BY_ID, CUSTOM_PREFIX } from "@/content/aac";
import { SHOP_BY_ID } from "@/content/shop";
import { sessionStore } from "@/lib/session";
import { STEPS, type Answers } from "@/content/intake";
import type { CardOut, ChildOut, ClipOut, ClipUpload, Consents, DoneOut, FormOut, PhoneStarted, PlanOut, ReviewItem, RoundOut, ShareOut } from "@/lib/server/types";
import type { Profession, TherapistAnswers } from "@/content/therapist";
import type { Lang, UiLang } from "@/lib/translate";
import type { AacCustomCard, Child, ChildSupport, ConsentScope, Feeling, InputProfile, InteractionEvent, Order, Roadmap, TaskDone, User, UserStatus, VideoStatus } from "@/lib/types";
import { queryClient } from "./client";
import { http } from "./http";
import {
  CONSENT_KIND, familyChildFrom, planFrom, shareFrom,
  childFrom, childTo, eventTo, scopeTo, userFrom,
  type BChild, type BConsent, type BGoal, type BUser,
} from "./map";
import { liveChild } from "./state";
import type { childrenApi } from "@/lib/api/children";

type MockExport = Awaited<ReturnType<typeof childrenApi.exportChild>>;

// Live implementations of the connected api.* calls — same signatures and return shapes as the mock in
// lib/api/, so pages don't change. After a write, cached reads are refetched.

const CHILD_TOKEN_MS = 8 * 3600_000;
const refreshBilling = () =>
  Promise.all([queryClient.invalidateQueries({ queryKey: ["subscription"] }), queryClient.invalidateQueries({ queryKey: ["orders"] })]);
const refetch = () => queryClient.invalidateQueries();
const id = () => crypto.randomUUID();
/** Answers the server stores: every question, plus the P39 voice note and kept hints (apps/api intake/rules.py). */
const QUESTION_IDS = new Set([...STEPS.flatMap((s) => s.questions.map((q) => q.id)), "P39_voice", "P39_hints"]);
/** Section B (P9–P17) is health data (same rule as the mock and the server's intake.json). */
const HEALTH_QUESTION = /^P(9|1[0-7])(_|$)/;

async function signedIn(): Promise<User> {
  const raw = await http<BUser>("GET", "/me");
  const me = userFrom(raw);
  // Seed the cache with who is signed in: a cached `null` ("signed out") would otherwise survive
  // until some page refetches it, and the next page would bounce back to /login.
  queryClient.setQueryData(["me"], raw);
  await refetch();
  sessionStore.set({ role: me.role });
  return me;
}

/** Wall-clock start of each session, for event timestamps (events carry ms since session start). */
const sessionStart = new Map<string, number>();

export const liveApi = {
  // ------------------------------------------------------------ auth (phone + SMS code, spec §4)
  /** POST /auth/phone/start — while SMS is simulated the server returns the code (shown on screen). */
  async requestCode(rawPhone: string) {
    const r = await http<PhoneStarted>("POST", "/auth/phone/start", { phone: rawPhone });
    return { phone: r.phone, resendAfterMs: r.resendAfterMs, demoCode: r.demoCode ?? "" };
  },
  /** POST /auth/phone/verify — sets the session cookies; a new number becomes a parent with a new family. */
  async verifyCode(rawPhone: string, code: string, uiLang: UiLang, invite?: string) {
    const r = await http<{ isNew: boolean }>("POST", "/auth/phone/verify", { phone: rawPhone, code: code.trim(), lang: uiLang, inviteCode: invite || null });
    return { user: await signedIn(), isNew: r.isNew };
  },
  /** POST /auth/second-step — an admin's code from the authenticator app (A13.1). */
  async verifySecondStep(code: string) {
    await http("POST", "/auth/second-step", { code: code.trim() });
    return signedIn();
  },
  /** PATCH /me/signup — basic consent, city and district: required before anything else. */
  async completeSignup(input: { name: string; region: string; district: string; consent: boolean }) {
    await http("PATCH", "/me/signup", input);
    await signedIn();
    return true;
  },
  async logout() {
    await http("POST", "/auth/logout", {}).catch(() => {});
    liveChild.set(null);
    sessionStore.set({ role: null });
    queryClient.clear();
    return true;
  },
  async logoutAll() {
    await http("POST", "/auth/logout-all", {}).catch(() => {});
    return liveApi.logout();
  },
  async deleteMe() {
    await http("DELETE", "/me");
    liveChild.set(null);
    sessionStore.set({ role: null });
    queryClient.clear();
    return true;
  },
  async updateMe(patch: Partial<Pick<User, "name" | "uiLang">>) {
    await http("PATCH", "/me", { name: patch.name, lang: patch.uiLang });
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ children & consent
  async updateChild(childId: string, patch: Partial<Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access">>) {
    await http("PATCH", `/children/${childId}`, childTo(patch));
    await refetch();
    return true;
  },
  /** Parent or linked therapist; the server must allow PATCH of `support` for an active care link. */
  async updateSupport(childId: string, support: ChildSupport) {
    await http("PATCH", `/children/${childId}`, { support });
    await refetch();
    return true;
  },
  async deleteChild(childId: string) {
    await http("DELETE", `/parent/children/${childId}`);
    queryClient.removeQueries({ predicate: (q) => q.queryKey.includes(childId) });
    await refetch();
    return true;
  },
  /** The server's export (PRD FR-CHILD-3) has its own format; the page only saves it as a JSON file. */
  async exportChild(childId: string): Promise<MockExport> {
    return http<MockExport>("GET", `/parent/children/${childId}/export`);
  },
  // ------------------------------------------------------------ video files (admin) and their review (spec §8, rule 3)
  /** POST /admin/videos/upload-link, the file straight to storage, then POST /admin/videos: it waits for review. */
  async uploadVideo(exerciseId: string, lang: Lang, file: Blob) {
    const which = { exerciseId, lang };
    const link = await http<{ storageKey: string; uploadUrl: string }>("POST", "/admin/videos/upload-link", which);
    const put = await fetch(link.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
    if (!put.ok) throw new ApiError("generic");
    await http("POST", "/admin/videos", { ...which, storageKey: link.storageKey });
    await queryClient.invalidateQueries({ queryKey: ["review"] });
    return true;
  },
  /** POST /review/videos/{id} — the server's id of this language file comes from the review queue. */
  async reviewVideo(exerciseId: string, lang: Lang, status: Exclude<VideoStatus, "generated">, note: string) {
    const items = queryClient.getQueriesData<ReviewItem[]>({ queryKey: ["review"] }).flatMap(([, d]) => d ?? []);
    const file = items.find((v) => v.exerciseId === exerciseId && v.lang === lang);
    if (!file) throw new ApiError("not_found");
    await http("POST", `/review/videos/${file.id}`, { decision: status, note: note.trim() || null });
    await queryClient.invalidateQueries({ queryKey: ["review"] });
    return true;
  },

  // ------------------------------------------------------------ Today (spec §8, §10; A5.3–A5.5)
  /** POST /children/{id}/done — one tap; twice = once. */
  async markDone(childId: string, day: number, videoId: string): Promise<TaskDone> {
    const d = await http<DoneOut>("POST", `/children/${childId}/done`, { day, exerciseId: videoId });
    await queryClient.invalidateQueries({ queryKey: ["plan", childId] });
    const roadmapId = queryClient.getQueryData<PlanOut>(["plan", childId])?.id ?? "";
    return { id: d.id, childId, roadmapId, day: d.day, videoId: d.exerciseId, feeling: d.feeling ?? undefined, at: d.doneOn };
  },
  /** PATCH /children/{id}/done/{doneId} — the optional easy / OK / hard. */
  async rateDone(childId: string, doneId: string, feeling: Feeling) {
    await http("PATCH", `/children/${childId}/done/${doneId}`, { feeling });
    await queryClient.invalidateQueries({ queryKey: ["plan", childId] });
    return undefined;
  },
  /** POST /children/{id}/pause — the plan moves forward one day. */
  async pauseToday(childId: string) {
    await http("POST", `/children/${childId}/pause`);
    await queryClient.invalidateQueries({ queryKey: ["plan", childId] });
    return undefined;
  },
  /** DELETE /children/{id}/pause — undo today's pause. */
  async resumeToday(childId: string) {
    await http("DELETE", `/children/${childId}/pause`);
    await queryClient.invalidateQueries({ queryKey: ["plan", childId] });
    return undefined;
  },
  /** PUT /children/{id}/daily — today's question; can be changed today. */
  async answerDaily(childId: string, questionId: string, value: 0 | 1 | 2) {
    await http("PUT", `/children/${childId}/daily`, { questionId, value });
    await queryClient.invalidateQueries({ queryKey: ["daily", childId] });
    return undefined;
  },

  /** PUT /children/{id}/consents/{kind} — owner only. "core" is the basic consent every family gave at sign-up. */
  async setConsent(childId: string, scope: ConsentScope, granted: boolean) {
    if (scope === "core") {
      if (!granted) throw new ApiError("core_consent_required_use_delete");
      return true;
    }
    const kind = CONSENT_KIND[scope];
    if (!kind) throw new ApiError("not_available");
    await http("PUT", `/children/${childId}/consents/${kind}`, { granted });
    await refetch(); // a withdrawn health consent also changes the saved answers and the plan
    return true;
  },

  // ------------------------------------------------------------ parent questions (spec §5)
  /** POST /children from the first question step (P1–P3, P8), then its answers. */
  async createChildFromIntake(answers: Answers, uiLang: UiLang) {
    const name = String(answers.P1 ?? "").trim();
    const birthDate = String(answers.P2 ?? "");
    if (!name) throw new ApiError("name_required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > new Date().toISOString().slice(0, 10)) throw new ApiError("invalid_date");
    const c = await http<ChildOut>("POST", "/children", { name, birthDate, sex: answers.P3, color: typeof answers.P8 === "string" ? answers.P8 : null, lang: uiLang });
    await liveApi.saveAnswers(c.id, 1, answers);
    return familyChildFrom(c);
  },
  /** PUT /children/{id}/intake/{round} — saves as the parent goes. Only real questions go to the server; health
   *  questions only with the health consent (the server refuses them otherwise). */
  async saveAnswers(childId: string, round: number, answers: Answers) {
    const health = queryClient.getQueryData<Consents>(["consents", childId])?.health ?? false;
    const keep = Object.entries(answers).filter(([q, v]) => v !== undefined && QUESTION_IDS.has(q) && (health || !HEALTH_QUESTION.test(q)));
    if (keep.length) {
      const body = Object.fromEntries(keep.map(([q, v]) => [q, typeof v === "string" ? v.slice(0, 1000) : v]));
      await http("PUT", `/children/${childId}/intake/${round}`, { answers: body });
    }
    await refetch();
    return true;
  },
  /** The P39 voice note goes straight to storage; the answer keeps only its key (POST .../intake/voice-link). */
  async saveVoiceNote(childId: string, blob: Blob) {
    const link = await http<{ storageKey: string; uploadUrl: string }>("POST", `/children/${childId}/intake/voice-link`, {});
    const put = await fetch(link.uploadUrl, { method: "PUT", body: blob, headers: { "Content-Type": blob.type || "audio/webm" } });
    if (!put.ok) throw new ApiError("generic");
    return link.storageKey;
  },
  /** GET /children/{id}/intake/{round}/voice — a 15-minute link to listen again, on any device of the family. */
  async voiceNoteUrl(childId: string, round: number, _key: string) {
    return (await http<{ url: string }>("GET", `/children/${childId}/intake/${round}/voice`)).url;
  },
  /** POST /children/{id}/intake/{round}/finish — the server closes the round and builds the plan. */
  async finishIntake(childId: string, round: number): Promise<Roadmap> {
    await http("POST", `/children/${childId}/intake/${round}/finish`, {});
    const plan = await http<PlanOut>("GET", `/children/${childId}/plan`);
    await refetch();
    return planFrom(childId, round, plan);
  },
  /** POST /children/{id}/intake — the 3-month repeat, filled in with last time's answers. */
  async startReintake(childId: string) {
    const r = await http<RoundOut>("POST", `/children/${childId}/intake`, {});
    await refetch();
    return r.number;
  },

  // ------------------------------------------------------------ child mode
  async startChildMode(childId: string) {
    // No core consent recorded (e.g. a profile mirrored from the mobile app) → the server would store
    // nothing, so don't start a session the child can't keep; the page explains and links to Privacy.
    const consents = await http<BConsent[]>("GET", `/children/${childId}/consents`);
    if (!consents.some((c) => c.consent_type === scopeTo("core"))) throw new ApiError("consent_missing");
    await http("POST", `/children/${childId}/session`); // sets the httpOnly fk_child cookie
    liveChild.set({ childId, grantedBy: "parent", exp: Date.now() + CHILD_TOKEN_MS });
    await refetch();
    return true;
  },
  async exitChildMode() {
    await http("DELETE", "/children/session").catch(() => {});
    liveChild.set(null);
    queryClient.removeQueries({ queryKey: ["own"] });
    await refetch();
    return true;
  },

  async startSession(input: InputProfile) {
    void input; // input profiles are per device on the server (PRD §9.5.2) — not split yet
    const childId = liveChild.get()?.childId;
    const kids = (queryClient.getQueryData<BChild[]>(["children"]) ?? []).map(childFrom);
    const learning = kids.find((c) => c.id === childId)?.learningLang ?? "en";
    const s = await http<{ id: string }>("POST", "/sessions", { language: learning, client_version: "web" });
    sessionStart.set(s.id, Date.now());
    return s.id;
  },
  /** `batchId` stays the same on retries (the server ignores a batch it already has); `startedAt` = session start, wall clock. */
  async postEvents(sessionId: string, events: Omit<InteractionEvent, "sessionId">[], batchId?: string, startedAt?: number) {
    const start = startedAt ?? sessionStart.get(sessionId) ?? Date.now();
    const mapped = events.map((e) => eventTo(e, start)).filter((e) => e !== null);
    if (mapped.length) await http("POST", `/sessions/${sessionId}/events`, { batch_id: batchId ?? id(), events: mapped });
    return true;
  },
  async completeActivity(sessionId: string, levelId: string, activityId: string) {
    const r = await http<{ coins: number; stars: number; level_done: boolean; first: boolean }>("POST", "/activities/complete", {
      session_id: sessionId,
      level_slug: levelId,
      activity_id: activityId,
    });
    await refetch();
    return { coins: r.coins, stars: r.stars, levelDone: r.level_done, first: r.first };
  },
  async endSession(sessionId: string) {
    await http("PATCH", `/sessions/${sessionId}`, {}); // the server adapts the profile once, in the background
    sessionStart.delete(sessionId);
    setTimeout(() => void refetch(), 1500);
    return [];
  },

  // ------------------------------------------------------------ helpers (apps/api accounts/helpers.py)
  async inviteHelper(phone: string) {
    const i = await http<{ id: string; phone: string; expiresAt: string }>("POST", "/family/helpers", { phone: phone.trim() });
    await refetch();
    return { id: i.id, familyId: "", phone: i.phone, at: i.expiresAt };
  },
  async removeHelper(userId: string) {
    await http("DELETE", `/family/helpers/${userId}`);
    await refetch();
    return true;
  },
  async cancelHelperInvite(inviteId: string) {
    await http("DELETE", `/family/helper-invites/${inviteId}`);
    await refetch();
    return true;
  },
  async acceptHelperInvite(inviteId: string) {
    await http("POST", `/me/helper-invites/${inviteId}/accept`, {});
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ sharing (parent side, apps/api therapists/)
  /** POST /children/{id}/therapists — by phone, or a one-time link when no phone is given (its code comes once). */
  async inviteCare(childId: string, contact: string) {
    const phone = contact.trim();
    const l = await http<ShareOut>("POST", `/children/${childId}/therapists`, phone ? { phone } : {});
    await refetch();
    return shareFrom(childId, l);
  },
  async revokeCare(linkId: string) {
    const shares = queryClient.getQueriesData<ShareOut[]>({ queryKey: ["shares"] });
    const childId = shares.find(([, list]) => list?.some((l) => l.id === linkId))?.[0][1] as string | undefined;
    if (!childId) throw new ApiError("not_found");
    await http("DELETE", `/children/${childId}/therapists/${linkId}`);
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ therapist (/therapist/*)
  /** A phone invite is accepted by its id (the therapist's invite list), a link by its code. */
  async acceptInvite(code: string) {
    const c = code.trim();
    if (/^[0-9a-f-]{36}$/.test(c)) await http("POST", `/therapist/invites/${c}/accept`, {});
    else await http("POST", "/therapist/invites/accept", { code: c });
    await refetch();
    return true;
  },
  async saveTherapistProfile(name: string, profession: Profession, workplace: string) {
    await http("PUT", "/therapist/profile", { name: name.trim(), profession, workplace: workplace.trim() });
    await refetch();
    return true;
  },
  /** PUT /therapist/children/{id}/form — only the changed answers; an emptied one is sent as null (removed). */
  async saveTherapistForm(childId: string, answers: TherapistAnswers) {
    const body = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v ?? null]));
    const r = await http<FormOut>("PUT", `/therapist/children/${childId}/form`, { answers: body });
    await refetch();
    return { planRebuilt: !!r.planRebuilt };
  },
  async replyToClip(childId: string, clipId: string, text: string) {
    await http("POST", `/therapist/children/${childId}/clips/${clipId}/replies`, { text: text.trim() });
    await refetch();
    return true;
  },
  /** P40: straight to storage, then added as the child's movement clip (needs the movement-videos consent). */
  async addMovementClip(childId: string, file: Blob) {
    const link = await http<ClipUpload>("POST", `/children/${childId}/clips/upload-link`, {});
    const put = await fetch(link.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
    if (!put.ok) throw new ApiError("generic");
    const clip = await http<ClipOut>("POST", `/children/${childId}/clips`, { kind: "movement", storageKey: link.storageKey });
    await refetch();
    return clip.id;
  },
  async addFeedbackClip(childId: string, exerciseId: string, file: Blob) {
    const link = await http<ClipUpload>("POST", `/children/${childId}/clips/upload-link`, {});
    const put = await fetch(link.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "video/mp4" } });
    if (!put.ok) throw new ApiError("generic");
    const clip = await http<ClipOut>("POST", `/children/${childId}/clips`, { kind: "feedback", storageKey: link.storageKey, exerciseId });
    await refetch();
    return clip.id;
  },
  async removeFeedbackClip(childId: string, clipId: string) {
    await http("DELETE", `/children/${childId}/clips/${clipId}`);
    await refetch();
    return true;
  },
  async deleteClip(childId: string, clipId: string) {
    await http("DELETE", `/children/${childId}/clips/${clipId}`);
    await refetch();
    return true;
  },
  async removeMovementClip(childId: string, clipId: string) {
    await http("DELETE", `/children/${childId}/clips/${clipId}`);
    await refetch();
    return true;
  },
  /** Every therapist read is audit-logged by the server itself (FR-THR-2). */
  async logChildRead() {
    return true;
  },
  async addNote(childId: string, text: string, visibleToParent: boolean) {
    await http("POST", `/therapist/children/${childId}/notes`, { text: text.trim(), visible_to_parent: visibleToParent });
    await refetch();
    return true;
  },
  async addGoal(childId: string, text: string) {
    await http("POST", `/therapist/children/${childId}/goals`, { text: text.trim() });
    await refetch();
    return true;
  },
  async toggleGoal(goalId: string) {
    const goals = queryClient.getQueriesData<{ goals: BGoal[] }>({ queryKey: ["therapist-child"] }).flatMap(([, d]) => d?.goals ?? []);
    const g = goals.find((x) => x.id === goalId);
    await http("PATCH", `/therapist/goals/${goalId}`, { done: !g?.done });
    await refetch();
    return true;
  },
  async recommend(childId: string, levelId: string, note: string) {
    await http("POST", `/therapist/children/${childId}/recommendations`, { level_slug: levelId, note: note.trim() });
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ AI assistant & helper (PRD §16)
  /** Needs the AI consent; daily quota on the server. Without an AI provider it answers with the
   *  built-in summary of the child's own data. */
  async askAssistant(childId: string, text: string, lang: Lang) {
    const r = await http<{ message: { content: string } }>("POST", "/ai-assistant/chat", { child_id: childId, message: text, ui_language: lang });
    await queryClient.invalidateQueries({ queryKey: ["aiMessages", childId] });
    return r.message.content;
  },
  async clearAssistant(childId: string) {
    await http("DELETE", `/ai-assistant/children/${childId}/messages`);
    await queryClient.invalidateQueries({ queryKey: ["aiMessages", childId] });
    return true;
  },

  // ------------------------------------------------------------ billing (PRD §9.18)
  /** Creates the order and opens the provider's payment page; the provider confirms server-to-server
   *  and the page shows the result on return (/parent/billing?order=…). */
  async checkout(plan: "monthly" | "yearly", provider: "payme" | "click") {
    const r = await http<{ order_id: string; redirect_url: string }>("POST", "/billing/checkout", { plan, provider });
    window.location.assign(r.redirect_url);
    return new Promise<Order>(() => {}); // the page is leaving for the provider ("Opening Payme…" stays)
  },
  async cancelSubscription() {
    await http("POST", "/billing/cancel", {});
    await refreshBilling();
    return true;
  },
  async refreshBilling() {
    await refreshBilling();
    return true;
  },

  // ------------------------------------------------------------ admin console (re-auth prompt + audit on the server)
  async setUserStatus(userId: string, status: UserStatus) {
    await http("PATCH", `/admin/users/${userId}`, { status: status === "disabled" ? "disabled" : "active" });
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    return true;
  },
  async setFlag(key: string, enabled: boolean) {
    await http("PUT", "/admin/feature-flags", { key, enabled });
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    await queryClient.invalidateQueries({ queryKey: ["flags"] });
    return true;
  },
  async grantComp(userId: string, days: number) {
    await http("POST", `/admin/users/${userId}/comp`, { days });
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    return true;
  },

  // ------------------------------------------------------------ notifications (the bell)
  async markRead(notificationId?: string) {
    await http("POST", "/notifications/read", { id: notificationId ?? null });
    await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    return true;
  },

  // ------------------------------------------------------------ cloud shop (coins only from playing)
  async redeem(itemId: string) {
    if (!SHOP_BY_ID[itemId]) throw new ApiError("not_found");
    const catalog = await http<{ id: string; slug: string; owned: boolean }[]>("GET", "/rewards/catalog");
    const item = catalog.find((c) => c.slug === itemId);
    if (!item) throw new ApiError("not_found");
    if (!item.owned) await http("POST", `/rewards/${item.id}/redeem`, {});
    await refetch();
    return true;
  },
  async equip(slot: "hat" | "color" | "bg", itemId: string | null) {
    await http("PUT", "/rewards/equip", { slot, slug: itemId });
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ AAC "My Voice"
  /** One spoken sentence = one event batch (the dashboard groups them back into sentences). */
  async aacLog(cardIds: string[], sentence: string, lang: Lang) {
    const at = new Date().toISOString();
    const events = cardIds.map((cardId) => {
      const bare = cardId.startsWith(CUSTOM_PREFIX) ? cardId.slice(CUSTOM_PREFIX.length) : cardId;
      return { card_id: bare.slice(0, 64), category: (AAC_BY_ID[cardId]?.category ?? "custom").slice(0, 32), sentence_spoken: sentence.slice(0, 500), language: lang, tapped_at: at };
    });
    if (events.length) await http("POST", "/aac/events", { batch_id: id(), events });
    return true;
  },
  /** AI sentence help only with the parent's AI consent (FR-AAC-3); otherwise the plain words. */
  async aacCompose(labels: string[], lang: Lang) {
    const plain = labels.join(" ");
    try {
      const r = await http<{ sentence: string; source: string }>("POST", "/aac/compose-sentence", { words: labels, language: lang });
      return { sentence: r.sentence || plain, ai: r.source === "ai" };
    } catch {
      return { sentence: plain, ai: false };
    }
  },
  /** POST /children/{id}/voice-cards — the files go straight to storage first; the card then shows on every
   *  device of the family (A6.8). */
  async aacAddCard(childId: string, card: Pick<AacCustomCard, "category" | "emoji" | "label">, media: { photo?: Blob | null; voice?: Blob | null } = {}) {
    const put = async (kind: "photo" | "audio", file: Blob) => {
      const link = await http<{ storageKey: string; uploadUrl: string }>("POST", `/children/${childId}/voice-cards/upload-link`, { kind });
      const r = await fetch(link.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type || "application/octet-stream" } });
      if (!r.ok) throw new ApiError("generic");
      return link.storageKey;
    };
    const photoKey = media.photo ? await put("photo", media.photo) : undefined;
    const audioKey = media.voice ? await put("audio", media.voice) : undefined;
    await http("POST", `/children/${childId}/voice-cards`, { category: card.category, label: card.label.trim(), emoji: card.emoji, photoKey, audioKey });
    await queryClient.invalidateQueries({ queryKey: ["cards", childId] });
    return true;
  },
  /** DELETE /children/{id}/voice-cards/{cardId} — its files too. */
  async aacDeleteCard(cardId: string) {
    const owner = queryClient.getQueriesData<CardOut[]>({ queryKey: ["cards"] }).find(([, cards]) => cards?.some((c) => c.id === cardId));
    if (!owner) throw new ApiError("not_found");
    const childId = owner[0][1] as string;
    await http("DELETE", `/children/${childId}/voice-cards/${cardId}`);
    await queryClient.invalidateQueries({ queryKey: ["cards", childId] });
    return true;
  },
};
