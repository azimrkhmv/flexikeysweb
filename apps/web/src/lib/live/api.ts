"use client";

import { CONSENT_VERSION } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/schema";
import { AAC_BY_ID, CUSTOM_PREFIX } from "@/content/aac";
import { SHOP_BY_ID } from "@/content/shop";
import { sessionStore } from "@/lib/session";
import type { Lang } from "@/lib/translate";
import type { AacCustomCard, Child, ClassRoom, ConsentScope, InputProfile, InteractionEvent, Role, User } from "@/lib/types";
import { queryClient } from "./client";
import { http } from "./http";
import {
  careLinkFrom, childFrom, childTo, classFrom, eventTo, rosterChildFrom, scopeTo, userFrom,
  type BCareLink, type BChild, type BClass, type BConsent, type BGoal, type BRosterChild, type BUser,
} from "./map";
import { liveChild } from "./state";
import type { childrenApi } from "@/lib/api/children";

type MockExport = Awaited<ReturnType<typeof childrenApi.exportChild>>;

// Live implementations of the connected api.* calls — same signatures and return shapes as the mock in
// lib/api/, so pages don't change. After a write, cached reads are refetched.

const CHILD_TOKEN_MS = 8 * 3600_000;
/** The class code this device signed in with (class login asks for it again with the child). */
let classCode = "";
const liveUserId = () => queryClient.getQueryData<BUser | null>(["me"])?.id ?? "";
const refetch = () => queryClient.invalidateQueries();
const id = () => crypto.randomUUID();

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
  // ------------------------------------------------------------ auth
  async register(input: { email: string; password: string; name: string; role: Exclude<Role, "admin">; uiLang: Lang }) {
    if (input.password.length < 10) throw new ApiError("weak_password"); // PRD SEC-4 (server minimum is lower)
    await http("POST", "/auth/register", {
      email: input.email.trim().toLowerCase(),
      password: input.password,
      role: input.role,
      locale: input.uiLang,
      display_name: input.name.trim(),
    });
    return signedIn();
  },
  async login(email: string, password: string) {
    await http("POST", "/auth/login", { email: email.trim().toLowerCase(), password });
    return signedIn();
  },
  async loginWithGoogle(): Promise<User> {
    throw new ApiError("not_available"); // Google Identity Services not configured yet
  },
  async logout() {
    await http("POST", "/auth/logout", {}).catch(() => {});
    liveChild.set(null);
    sessionStore.set({ role: null });
    queryClient.clear();
    return true;
  },
  async logoutAll() {
    await http("POST", "/me/logout-all", {}).catch(() => {});
    return liveApi.logout();
  },
  async forgotPassword(email: string) {
    await http("POST", "/auth/password/forgot", { email: email.trim().toLowerCase() });
    return true;
  },
  /** The single-use token from the emailed link (FR-AUTH-3); a second use fails with token_used. */
  async resetPassword(token: string, password: string) {
    if (password.length < 10) throw new ApiError("weak_password");
    await http("POST", "/auth/password/reset", { token, new_password: password });
    return true;
  },
  async resendVerification() {
    await http("POST", "/me/resend-verification", {});
    return true;
  },
  async deleteMe(confirmEmail?: string) {
    await http("DELETE", "/me", { email: confirmEmail ?? "" });
    liveChild.set(null);
    sessionStore.set({ role: null });
    queryClient.clear();
    return true;
  },
  /** With the token from the emailed link (/verify-email?token=…); without it, the email is the way. */
  async verifyEmail(token?: string): Promise<boolean> {
    if (!token) throw new ApiError("verify_by_email");
    await http("POST", "/auth/verify-email", { token });
    await refetch();
    return true;
  },
  async updateMe(patch: Partial<Pick<User, "name" | "uiLang">>) {
    await http("PATCH", "/me", { display_name: patch.name, locale: patch.uiLang });
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ children & consent
  async createChild(input: Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access">, scopes: ConsentScope[]) {
    if (!scopes.includes("core")) throw new ApiError("consent_required");
    const created = await http<BChild>("POST", "/children", {
      ...childTo(input),
      consents: scopes.map(scopeTo),
      consent_version: CONSENT_VERSION,
    });
    await refetch();
    return childFrom(created);
  },
  async updateChild(childId: string, patch: Partial<Pick<Child, "name" | "birthYear" | "learningLang" | "uiLang" | "avatar" | "access">>) {
    await http("PATCH", `/children/${childId}`, childTo(patch));
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
  async setConsent(childId: string, scope: ConsentScope, granted: boolean) {
    if (scope === "core" && !granted) throw new ApiError("core_consent_required_use_delete");
    if (granted) await http("POST", `/children/${childId}/consent`, { consent_type: scopeTo(scope) });
    else await http("DELETE", `/children/${childId}/consent/${scopeTo(scope)}`);
    await refetch();
    return true;
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
    // A class device has no adult signed in: it only drops the child cookie and goes back to the roster.
    const fromClass = liveChild.get()?.grantedBy === "class";
    await http("DELETE", fromClass ? "/class-login/session" : "/children/session").catch(() => {});
    liveChild.set(null);
    queryClient.removeQueries({ queryKey: ["own"] });
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ class login (shared classroom device)
  /** The class code (remembered on the device) → class + roster (nicknames and avatars only). */
  async classLoginStart(code: string) {
    const r = await http<{ class_id: string; class_name: string; roster: { id: string; display_name: string; avatar_id: string | null }[] }>(
      "POST",
      "/class-login/start",
      { code: code.trim().toUpperCase() },
    );
    classCode = code.trim().toUpperCase();
    return { classId: r.class_id, className: r.class_name, roster: r.roster.map((c) => ({ id: c.id, name: c.display_name, avatar: c.avatar_id ?? "🦊" })) };
  },
  async classLoginChild(classId: string, childId: string) {
    void classId; // the server checks the code again together with the child
    await http("POST", "/class-login/child", { code: classCode, child_id: childId });
    liveChild.set({ childId, grantedBy: "class", exp: Date.now() + CHILD_TOKEN_MS });
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
  async postEvents(sessionId: string, events: Omit<InteractionEvent, "sessionId">[]) {
    const start = sessionStart.get(sessionId) ?? Date.now();
    const mapped = events.map((e) => eventTo(e, start)).filter((e) => e !== null);
    if (mapped.length) await http("POST", `/sessions/${sessionId}/events`, { batch_id: id(), events: mapped });
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

  // ------------------------------------------------------------ teacher (/teacher/*)
  async createClass(input: Pick<ClassRoom, "name" | "grade" | "learningLang">) {
    const k = await http<BClass>("POST", "/teacher/classes", { name: input.name, grade: input.grade, learning_language: input.learningLang });
    await refetch();
    return classFrom(k, liveUserId());
  },
  /** A school-managed profile; the school attests it holds the parental consent form. */
  async addSchoolChild(classId: string, input: { name: string; avatar: string; attested: boolean }) {
    if (!input.attested) throw new ApiError("consent_required");
    const c = await http<BRosterChild>("POST", `/teacher/classes/${classId}/children`, { display_name: input.name.trim(), avatar_id: input.avatar, attested: true });
    await refetch();
    return rosterChildFrom(c);
  },
  async removeFromClass(classId: string, childId: string) {
    await http("DELETE", `/teacher/classes/${classId}/children/${childId}`);
    await refetch();
    return true;
  },
  async assign(input: { classId: string; levelId: string; note: string; due?: string }) {
    await http("POST", `/teacher/classes/${input.classId}/assignments`, {
      level_slug: input.levelId,
      instructions: input.note.trim() || null,
      due_at: input.due ? new Date(input.due).toISOString() : null,
    });
    await refetch();
    return true;
  },
  async deleteAssignment(assignmentId: string) {
    await http("DELETE", `/teacher/assignments/${assignmentId}`);
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ sharing (parent side)
  async inviteCare(childId: string, email: string) {
    const l = await http<BCareLink>("POST", `/children/${childId}/care-links`, { email: email.trim().toLowerCase() });
    await refetch();
    return careLinkFrom(l);
  },
  async revokeCare(linkId: string) {
    await http("DELETE", `/care-links/${linkId}`);
    await refetch();
    return true;
  },
  async joinClass(childId: string, code: string) {
    const r = await http<{ class_id: string; class_name: string }>("POST", "/teacher/classes/join", { join_code: code.trim().toUpperCase(), child_id: childId });
    await refetch();
    return { id: r.class_id, teacherId: "", name: r.class_name, grade: "", learningLang: "uz" as const, code: "", createdAt: "" };
  },
  async leaveClass(childId: string, classId: string) {
    await http("DELETE", `/children/${childId}/classes/${classId}`);
    await refetch();
    return true;
  },

  // ------------------------------------------------------------ therapist (/therapist/*)
  async acceptInvite(code: string) {
    await http("POST", "/therapist/invites/accept", { code: code.trim().toUpperCase() });
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
  async teacherAiSummary(classId: string, lang: Lang) {
    const r = await http<{ text: string }>("POST", `/teacher/classes/${classId}/ai-summary`, { language: lang });
    return r.text;
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
  /** Parent only; the card then shows on every device the child uses (FR-AAC-2). */
  async aacAddCard(childId: string, card: Pick<AacCustomCard, "category" | "emoji" | "label">) {
    await http("POST", `/children/${childId}/aac/cards`, { category: card.category, label: card.label.trim(), emoji: card.emoji });
    await refetch();
    return true;
  },
  async aacDeleteCard(cardId: string) {
    await http("DELETE", `/aac/cards/${cardId}`);
    await refetch();
    return true;
  },
};
