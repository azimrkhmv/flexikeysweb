"use client";

import { CONSENT_VERSION } from "@/lib/api/schema";
import { ApiError } from "@/lib/api/schema";
import { SHOP_BY_ID } from "@/content/shop";
import { sessionStore } from "@/lib/session";
import type { Lang } from "@/lib/translate";
import type { Child, ConsentScope, InputProfile, InteractionEvent, Role, User } from "@/lib/types";
import { queryClient } from "./client";
import { http } from "./http";
import { childFrom, childTo, eventTo, scopeTo, userFrom, type BChild, type BUser } from "./map";
import { liveChild } from "./state";
import type { childrenApi } from "@/lib/api/children";

type MockExport = Awaited<ReturnType<typeof childrenApi.exportChild>>;

// Live implementations of the connected api.* calls — same signatures and return shapes as the mock in
// lib/api/, so pages don't change. After a write, cached reads are refetched.

const CHILD_TOKEN_MS = 8 * 3600_000;
const refetch = () => queryClient.invalidateQueries();
const id = () => crypto.randomUUID();

async function signedIn(): Promise<User> {
  const me = userFrom(await http<BUser>("GET", "/me"));
  queryClient.setQueryData(["me"], null); // drop any cached "signed out"
  await refetch();
  sessionStore.set({ role: me.role });
  return me;
}

/** Wall-clock start of each session, for event timestamps (events carry ms since session start). */
const sessionStart = new Map<string, number>();

export const liveApi = {
  // ------------------------------------------------------------ auth
  async register(input: { email: string; password: string; name: string; role: Exclude<Role, "admin">; uiLang: Lang }) {
    if (input.role === "therapist") throw new ApiError("not_available"); // no therapist role on the server yet
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
    await http("POST", `/children/${childId}/session`); // sets the httpOnly fk_child cookie
    liveChild.set({ childId, grantedBy: "parent", exp: Date.now() + CHILD_TOKEN_MS });
    await refetch();
    return true;
  },
  async exitChildMode() {
    await http("DELETE", "/children/session").catch(() => {});
    liveChild.set(null);
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

  // ------------------------------------------------------------ AAC in child mode: speaks locally; the
  // server's AAC event/compose APIs aren't connected in this phase, so nothing is sent.
  async aacLog() {
    return true;
  },
  async aacCompose(labels: string[]) {
    return { sentence: labels.join(" "), ai: false };
  },
};
