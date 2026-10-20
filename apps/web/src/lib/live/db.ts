"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { ApiError, type ChildAuth, type DB } from "@/lib/api/schema";
import { sessionStore } from "@/lib/session";
import { useStore } from "@/lib/store";
import { http } from "./http";
import type { ChatOut, ChatSummary, MessageOut, AuditOut, FlagOut, Overview, KitOrderOut, BookingOut, ClinicBooking, ClinicSlot, FreeSlot, MyPlace, PlaceView, CardOut, ChildOut, ClipOut, Helpers, InviteForMe, Consents, DailyOut, FormOut, InUse, InviteOut, PlanOut, PlanStatus, ProfileOut, ReviewItem, RoundOut, RoundSummary, ShareOut, SharedChild } from "@/lib/server/types";
import {
  kitOrderFrom, bookingFrom, clinicBookingFrom, myPlaceFrom, placeFrom, slotFrom,
  answersFrom, chatFrom, clipsFrom, dailyFrom, doneFrom, familyChildFrom, familyConsentsFrom, familyPlanFrom, inUseFrom, pausedFrom, planFrom, planVideosFrom, reviewVideosFrom, shareFrom, sharedChildFrom, voiceCardFrom,
  aacCardFrom, auditFrom, childFrom, notificationFrom, levelsFrom, profileFrom,
  taskFrom, userFrom,
  type BAacCard, type BNotification, type BChild, type BLevel,
  type BProfile, type BTask, type BUser,
} from "./map";
import { liveChild } from "./state";

// Live-mode useDb(): the connected server data, fetched with TanStack Query and shaped like the mock DB, so
// pages and the sel.* rules work unchanged. Each role loads only what its pages read:
// child mode (parent's device or a class device) → the child's own endpoints; parent → their children;
// therapist → one view per linked child.

/** A fresh, empty DB each time — never share arrays between snapshots (they get pushed into below). */
const empty = (): DB => ({
  v: 1, auth: { userId: null, child: null }, users: [], familyMembers: [], children: [], consents: [], profiles: [], changes: [], sessions: [],
  events: [], mastery: [], progress: [], wallets: [], assignments: [], careLinks: [], notes: [],
  goals: [], aacEvents: [], aacCards: [], notifications: [], audit: [], flags: [], aiMessages: [], familyPlans: [], places: [], placeReports: [], slots: [], bookings: [], kitOrders: [],
  otp: [], intakeAnswers: [], intakeRounds: [], videos: [], roadmaps: [], tasksDone: [], pausedDays: [], dailyAnswers: [], tries: [], accessProfiles: [], skills: [], playTime: [], therapistProfiles: [], therapistAnswers: [], clipReplies: [], helperInvites: [], feedbackClips: [],
});

/** A family child's data on the new server (apps/api); each round's answers are loaded after the round list. */
const PER_CHILD = ["consents", "rounds", "plan", "daily", "cards", "shares", "inUse", "clips", "bookings", "chat", "chats"] as const;
const REVIEW_STATUSES = ["waiting_review", "changes_requested", "rejected", "approved"] as const;
type PerChild = (typeof PER_CHILD)[number];
const path = (kind: PerChild, id: string) =>
  ({
    consents: `/children/${id}/consents`, rounds: `/children/${id}/intake`, plan: `/children/${id}/plan`, daily: `/children/${id}/daily`,
    cards: `/children/${id}/voice-cards`, shares: `/children/${id}/therapists`, inUse: `/children/${id}/answers-in-use`, clips: `/children/${id}/clips`, bookings: `/children/${id}/bookings`,
    chat: `/children/${id}/assistant/messages`, chats: `/children/${id}/chats`,
  })[kind];
/** "No plan yet" and "no daily question list loaded" are answers, not errors to retry. */
const MAY_BE_MISSING: PerChild[] = ["plan", "daily"];

/** Child mode reads only the child's own endpoints (child token = the httpOnly fk_child cookie). */
const OWN = ["me", "levels", "wallet", "profile", "tasks", "catalog", "aacCards"] as const;
const OWN_PATH: Record<(typeof OWN)[number], string> = {
  me: "/children/session",
  levels: "/activities/progress",
  wallet: "/rewards/wallet",
  profile: "/adaptive/profile",
  tasks: "/activities/tasks",
  catalog: "/rewards/catalog",
  aacCards: "/aac/cards",
};

/** The child-mode marker while it's valid (the server's child token lasts 8 h). */
const activeChild = (c: ChildAuth | null) => (c && c.exp > Date.now() ? c : null);

export function useLiveDb(): DB {
  const child = activeChild(useStore(liveChild));
  const pathname = usePathname();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      http<BUser>("GET", "/me").catch((e) => {
        if (e instanceof ApiError && e.code === "unauthorized") return null; // signed out (e.g. a class device)
        throw e;
      }),
  });
  const user = me.data ? userFrom(me.data) : null;
  const role = user?.role;

  // ---- child mode
  const own = useQueries({
    queries: child ? OWN.map((kind) => ({ queryKey: ["own", kind, child.childId], queryFn: () => http<unknown>("GET", OWN_PATH[kind]) })) : [],
  });
  const ownMeError = own[0]?.error;
  useEffect(() => {
    // The child token expired or the profile was deleted: leave child mode.
    if (ownMeError instanceof ApiError && ownMeError.code === "unauthorized") liveChild.set(null);
  }, [ownMeError]);

  // ---- parent (paused while a child plays: the dashboards aren't on screen)
  const kids = useQuery({ queryKey: ["children"], enabled: role === "parent", queryFn: () => http<ChildOut[]>("GET", "/children") });
  const ids = role === "parent" && !child ? (kids.data ?? []).map((c) => c.id) : [];
  const per = useQueries({
    queries: ids.flatMap((id) =>
      PER_CHILD.map((kind) => ({
        queryKey: [kind, id], // "chat" is refetched by its key after a question (live/api.ts)
        queryFn: () =>
          http<unknown>("GET", path(kind, id)).catch((e) => (MAY_BE_MISSING.includes(kind) && e instanceof ApiError && e.code === "not_found" ? null : Promise.reject(e))),
      })),
    ),
  });
  const perChild = (i: number, kind: PerChild) => per[i * PER_CHILD.length + PER_CHILD.indexOf(kind)]?.data;
  const roundsOf = ids.flatMap((id, i) => ((perChild(i, "rounds") as RoundSummary[] | undefined) ?? []).map((r) => ({ id, n: r.number })));
  const answers = useQueries({
    queries: roundsOf.map(({ id, n }) => ({ queryKey: ["answers", id, n], queryFn: () => http<RoundOut>("GET", `/children/${id}/intake/${n}`) })),
  });

  // ---- helpers (A8.4): the family this person owns, its helpers and invites; and invites to help another family
  const family = useQuery({ queryKey: ["family-helpers"], enabled: role === "parent", queryFn: () => http<Helpers>("GET", "/family/helpers") });
  // Free or Pro (A7.1): the family this parent owns or helps; none yet before the first child.
  const familyPlan = useQuery({
    queryKey: ["family-plan"],
    enabled: role === "parent",
    queryFn: () => http<PlanStatus>("GET", "/family/plan").catch((e) => (e instanceof ApiError && e.code === "no_family" ? null : Promise.reject(e))),
  });
  const helpInvites = useQuery({ queryKey: ["helper-invites"], enabled: role === "parent", queryFn: () => http<InviteForMe[]>("GET", "/me/helper-invites") });

  // ---- Find help (A10.2, A10.4): the places and their free times, only on the Find help pages
  const onHelp = role === "parent" && !child && !!pathname?.includes("/parent/help");
  const onKit = role === "parent" && !child && !!pathname?.includes("/parent/kit"); // pickup centres
  const places = useQuery({ queryKey: ["places"], enabled: onHelp || onKit, queryFn: () => http<PlaceView[]>("GET", "/places") });
  // ponytail: one request per place (about 40 at launch); one "free times of these places" address when hundreds.
  const freeTimes = useQueries({
    queries: (onHelp ? (places.data ?? []) : []).map((p) => ({ queryKey: ["slots", p.id], queryFn: () => http<FreeSlot[]>("GET", `/places/${p.id}/slots`) })),
  });

  // ---- Home Kit (A11.1): the family's orders; every member sees them
  const kitOrders = useQuery({
    queryKey: ["kit-orders"],
    enabled: role === "parent",
    queryFn: () => http<KitOrderOut[]>("GET", "/family/kit-orders").catch((e) => (e instanceof ApiError && e.code === "no_family" ? [] : Promise.reject(e))),
  });

  // ---- clinic (A10.3): its own places, their times and bookings
  const clinicPlaces = useQuery({ queryKey: ["clinic-places"], enabled: role === "clinic", queryFn: () => http<MyPlace[]>("GET", "/clinic/places") });
  const clinicViews = useQueries({
    queries: (role === "clinic" ? (clinicPlaces.data ?? []) : []).flatMap((p) => [
      { queryKey: ["clinic-slots", p.id], queryFn: () => http<unknown>("GET", `/clinic/places/${p.id}/slots`) },
      { queryKey: ["clinic-bookings", p.id], queryFn: () => http<unknown>("GET", `/clinic/places/${p.id}/bookings`) },
    ]),
  });


  // ---- physiotherapist: the review queue, every status (the page counts each)
  const review = useQueries({
    queries: (role === "physio" ? REVIEW_STATUSES : []).map((st) => ({
      queryKey: ["review", st],
      queryFn: () => http<ReviewItem[]>("GET", `/review/videos?status=${st}`),
    })),
  });

  // ---- admin console
  const ADMIN = ["users", "audit", "flagList", "overview", "kitOrders"] as const;
  const adminPath: Record<(typeof ADMIN)[number], string> = {
    users: "/admin/users?limit=500",
    audit: "/admin/audit-logs?limit=200",
    flagList: "/admin/feature-flags",
    overview: "/admin/overview",
    kitOrders: "/admin/kit-orders",
  };
  const admin = useQueries({
    queries: role === "admin" ? ADMIN.map((k) => ({ queryKey: ["admin", k], queryFn: () => http<unknown>("GET", adminPath[k]) })) : [],
  });

  // ---- therapist (apps/api therapists/): shared children, invites, the profile, and per child the form and clips
  const linked = useQuery({ queryKey: ["therapist-children"], enabled: role === "therapist", queryFn: () => http<SharedChild[]>("GET", "/therapist/children") });
  const invites = useQuery({ queryKey: ["therapist-invites"], enabled: role === "therapist", queryFn: () => http<InviteOut[]>("GET", "/therapist/invites") });
  const tprofile = useQuery({
    queryKey: ["therapist-profile"],
    enabled: role === "therapist",
    queryFn: () => http<ProfileOut>("GET", "/therapist/profile").catch((e) => (e instanceof ApiError && e.code === "no_profile" ? null : Promise.reject(e))),
  });
  const shared = role === "therapist" ? (linked.data ?? []) : [];
  const VIEWS = 4; // queries per shared child, in this order: form, clips, chat, chat summary
  const views = useQueries({
    queries: shared.flatMap((c) => [
      { queryKey: ["therapist-form", c.id], enabled: !!tprofile.data, queryFn: () => http<unknown>("GET", `/therapist/children/${c.id}/form`) },
      {
        queryKey: ["therapist-clips", c.id],
        queryFn: () => http<unknown>("GET", `/therapist/children/${c.id}/clips`).catch((e) => (e instanceof ApiError && e.code === "not_found" ? [] : Promise.reject(e))),
      },
      // B31, B33: the therapist's own assistant chat, and the family's chats as topics and warnings only.
      { queryKey: ["chat", c.id], queryFn: () => http<unknown>("GET", `/children/${c.id}/assistant/messages`) },
      { queryKey: ["chat-summary", c.id], queryFn: () => http<unknown>("GET", `/therapist/children/${c.id}/assistant-summary`) },
    ]),
  });

  // ---- every adult: feature flags and the notification bell
  const flags = useQuery({ queryKey: ["flags"], enabled: !!user, queryFn: () => http<Record<string, boolean>>("GET", "/flags") });
  const notifications = useQuery({
    queryKey: ["notifications"],
    enabled: !!user,
    queryFn: () => http<BNotification[]>("GET", "/notifications?all=true&limit=30"),
  });

  // Public pages read who is signed in from the small session store.
  const signedIn = me.isPending ? undefined : (role ?? null);
  useEffect(() => {
    if (signedIn !== undefined && sessionStore.get().role !== signedIn) sessionStore.set({ role: signedIn });
  }, [signedIn]);

  const all = [me, kids, linked, invites, tprofile, family, familyPlan, helpInvites, places, kitOrders, clinicPlaces, notifications, flags, ...own, ...per, ...answers, ...review, ...views, ...admin, ...freeTimes, ...clinicViews];
  const stamp = all.map((q) => q.dataUpdatedAt).join();
  const loading =
    me.isPending ||
    (!!child && !!own[0]?.isPending) ||
    // The questions screen starts from the saved answers, so wait for them.
    (role === "parent" && (kids.isPending || per.some((q) => q.isPending) || answers.some((q) => q.isPending))) ||
    ((onHelp || onKit) && places.isPending) ||
    (onHelp && freeTimes.some((q) => q.isPending)) ||
    (role === "clinic" && (clinicPlaces.isPending || clinicViews.some((q) => q.isPending))) ||
    (role === "physio" && review.some((q) => q.isPending)) ||
    (role === "therapist" && (linked.isPending || tprofile.isPending || views.some((q) => q.isPending && q.fetchStatus !== "idle")));

  return useMemo(() => {
    const db: DB = { ...empty(), loading, auth: { userId: user?.id ?? null, child } };
    if (user) {
      db.users = [user];
      db.notifications = (notifications.data ?? []).map((n) => notificationFrom(n, user.id));
      db.flags = Object.entries(flags.data ?? {}).map(([key, enabled]) => ({ key, enabled, description: "" }));
    }

    // Child mode: the playing child's own data (works with or without an adult signed in).
    if (child && own[0]?.data) {
      const at = (kind: (typeof OWN)[number]) => own[OWN.indexOf(kind)]?.data;
      const c = childFrom(at("me") as BChild);
      db.children.push(c);
      const levels = at("levels") as BLevel[] | undefined;
      if (levels) db.progress.push(...levelsFrom(c.id, levels));
      const profile = at("profile") as BProfile | undefined;
      if (profile) db.profiles.push({ childId: c.id, input: "touch", params: profileFrom(profile.profile.params), version: profile.profile.version, lastDir: {}, updatedAt: profile.profile.updated_at });
      const wallet = at("wallet") as { coins: number; stars: number } | undefined;
      const owned = ((at("catalog") as { slug: string; owned: boolean }[] | undefined) ?? []).filter((x) => x.owned).map((x) => x.slug);
      db.wallets.push({ childId: c.id, coins: wallet?.coins ?? 0, stars: wallet?.stars ?? 0, owned });
      db.aacCards.push(...((at("aacCards") as BAacCard[] | undefined) ?? []).map((x) => aacCardFrom(x, true)));
      // The server already filtered these for this child; seen as the child's own tasks.
      for (const t of (at("tasks") as BTask[] | undefined) ?? []) {
        const a = taskFrom(t, c.id);
        if (a) db.assignments.push(a);
      }
    }

    if (role === "parent") {
      for (const k of kids.data ?? []) if (!db.children.some((c) => c.id === k.id)) db.children.push(familyChildFrom(k));
      // The owner of their own family (the server says which), a helper in any other family their children come from.
      const own = family.data?.familyId ?? null;
      if (own) db.familyMembers.push({ familyId: own, userId: user!.id, role: "owner" });
      const planFamily = own ?? kids.data?.[0]?.familyId;
      if (planFamily && familyPlan.data) db.familyPlans.push(familyPlanFrom(planFamily, familyPlan.data));
      if (planFamily) db.kitOrders.push(...(kitOrders.data ?? []).map((o) => kitOrderFrom(planFamily, o)));
      for (const familyId of new Set((kids.data ?? []).map((k) => k.familyId)))
        if (familyId !== own) db.familyMembers.push({ familyId, userId: user!.id, role: "helper" });
      for (const h of family.data?.helpers ?? []) {
        db.users.push({ ...user!, id: h.userId, name: h.name ?? "", phone: h.phone }); // only name and phone are shown
        if (own) db.familyMembers.push({ familyId: own, userId: h.userId, role: "helper" });
      }
      if (own) db.helperInvites.push(...(family.data?.invites ?? []).map((i) => ({ id: i.id, familyId: own, phone: i.phone, at: i.expiresAt })));
      db.helperInvites.push(...(helpInvites.data ?? []).map((i) => ({ id: i.id, familyId: `invite-${i.id}`, phone: user!.phone ?? "", at: i.expiresAt, ownerName: i.ownerName ?? "" })));
      ids.forEach((id, i) => {
        const consents = perChild(i, "consents") as Consents | undefined;
        const rounds = (perChild(i, "rounds") as RoundSummary[] | undefined) ?? [];
        const plan = perChild(i, "plan") as PlanOut | null | undefined;
        if (consents) db.consents.push(...familyConsentsFrom(id, consents));
        db.aacCards.push(...((perChild(i, "cards") as CardOut[] | undefined) ?? []).map((c) => voiceCardFrom(id, c)));
        db.careLinks.push(...((perChild(i, "shares") as ShareOut[] | undefined) ?? []).map((l) => shareFrom(id, l)));
        const inUse = perChild(i, "inUse") as InUse | undefined;
        if (inUse) (db.answersInUse ??= {})[id] = inUseFrom(inUse);
        const clips = clipsFrom(id, (perChild(i, "clips") as ClipOut[] | undefined) ?? []);
        (db.clips ??= []).push(...clips.clips);
        db.clipReplies.push(...clips.replies);
        for (const b of (perChild(i, "bookings") as BookingOut[] | undefined) ?? []) {
          const { booking, slot } = bookingFrom(id, user!.id, b);
          db.bookings.push(booking);
          if (!db.slots.some((s) => s.id === slot.id)) db.slots.push(slot);
        }
        db.aiMessages.push(...chatFrom(id, user!.id, (perChild(i, "chat") as MessageOut[] | undefined) ?? []));
        const chatList = perChild(i, "chats") as ChatOut[] | undefined;
        if (chatList) (db.chatList ??= {})[id] = chatList.map((c) => ({ userId: c.userId, name: c.name ?? "", messages: c.messages, at: c.lastAt }));
        const daily = perChild(i, "daily") as DailyOut | null | undefined;
        if (daily) db.dailyAnswers.push(...dailyFrom(id, daily));
        db.intakeRounds.push(...rounds.map((r) => ({ childId: id, round: r.number, startedAt: r.startedAt, completedAt: r.completedAt ?? undefined })));
        const finished = rounds.filter((r) => r.completedAt).at(-1);
        if (plan && finished) {
          db.roadmaps.push(planFrom(id, finished.number, plan));
          db.tasksDone.push(...doneFrom(id, plan));
          db.pausedDays.push(...pausedFrom(id, plan));
          for (const v of planVideosFrom(plan)) if (!db.videos.some((x) => x.id === v.id)) db.videos.push(v);
        }
      });
      for (const p of places.data ?? []) {
        db.places.push(placeFrom(p));
        if (p.reported) db.placeReports.push({ placeId: p.id, userId: user!.id, reason: "other", at: "" });
      }
      (places.data ?? []).forEach((p, k) => {
        // A time free again after a cancelled booking: its free version says which ways it can be booked.
        for (const s of freeTimes[k]?.data ?? []) db.slots = [...db.slots.filter((x) => x.id !== s.id), slotFrom(p.id, s)];
      });
      roundsOf.forEach(({ id }, k) => {
        const r = answers[k]?.data;
        if (r) db.intakeAnswers.push(...answersFrom(id, r));
      });
    }

    if (role === "clinic" && user) {
      (clinicPlaces.data ?? []).forEach((p, k) => {
        db.places.push(myPlaceFrom(p, user.id));
        db.slots.push(...((clinicViews[k * 2]?.data as ClinicSlot[] | undefined) ?? []).map((s) => slotFrom(p.id, s)));
        for (const b of (clinicViews[k * 2 + 1]?.data as ClinicBooking[] | undefined) ?? []) {
          const { booking, slot, child, parent } = clinicBookingFrom(b);
          db.bookings.push(booking);
          if (!db.slots.some((s) => s.id === slot.id)) db.slots.push(slot);
          db.children.push(child);
          db.users.push(parent);
        }
      });
    }

    if (role === "physio") db.videos = reviewVideosFrom(review.flatMap((q) => q.data ?? []));

    if (role === "admin" && user && admin.some((q) => q.data)) {
      const at = (k: (typeof ADMIN)[number]) => admin[ADMIN.indexOf(k)]?.data;
      db.users = ((at("users") as BUser[] | undefined) ?? []).map(userFrom);
      if (!db.users.some((u) => u.id === user.id)) db.users.push(user);
      db.audit = ((at("audit") as AuditOut[] | undefined) ?? []).map(auditFrom);
      db.flags = ((at("flagList") as FlagOut[] | undefined) ?? []).map((f) => ({ key: f.key, enabled: f.enabled, description: f.description }));
      db.kitOrders = ((at("kitOrders") as KitOrderOut[] | undefined) ?? []).map((o) => kitOrderFrom("", o));
      const ov = at("overview") as Overview | undefined;
      if (ov)
        db.adminStats = {
          users: ov.users, children: ov.children, paying: ov.paying, sessions: ov.sessionsWeek, aiByRole: ov.aiQuestionsByRole, aiByDay: ov.aiQuestionsByDay,
          health: { db: ov.health.database, redis: ov.health.redis },
        };
    }

    if (role === "therapist" && user) {
      for (const i of invites.data ?? [])
        db.careLinks.push({ id: i.id, childId: "", childName: i.childName, kind: "therapist", phone: user.phone, status: "invited", code: i.id, createdAt: i.expiresAt });
      if (tprofile.data) {
        db.therapistProfiles.push({ userId: user.id, profession: tprofile.data.profession, workplace: tprofile.data.workplace });
        user.name = tprofile.data.name;
      }
      db.clips = [];
      shared.forEach((c, k) => {
        db.children.push(sharedChildFrom(c));
        db.careLinks.push({ id: `link-${c.id}`, childId: c.id, kind: "therapist", professionalId: user.id, status: "active", code: "", createdAt: c.sharedSince });
        db.consents.push({ id: `therapist-${c.id}`, childId: c.id, scope: "therapist_sharing", version: "", grantedBy: "", grantedAt: "" });
        const form = views[k * VIEWS]?.data as FormOut | undefined;
        if (form) db.therapistAnswers.push({ childId: c.id, therapistId: user.id, answers: form.answers, at: "" });
        const clips = clipsFrom(c.id, (views[k * VIEWS + 1]?.data as ClipOut[] | undefined) ?? []);
        db.clips!.push(...clips.clips);
        db.clipReplies.push(...clips.replies);
        db.aiMessages.push(...chatFrom(c.id, user.id, (views[k * VIEWS + 2]?.data as MessageOut[] | undefined) ?? []));
        const summary = views[k * VIEWS + 3]?.data as ChatSummary | undefined;
        if (summary) (db.chatSummaries ??= {})[c.id] = summary;
        // The server lists clips only with the movement-videos consent.
        if (clips.clips.length) db.consents.push({ id: `videos-${c.id}`, childId: c.id, scope: "movement_videos", version: "", grantedBy: "", grantedAt: "" });
      });
    }
    return db;
    // `stamp` changes exactly when any query's data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, child, role, loading]);
}
