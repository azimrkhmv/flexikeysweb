"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ApiError, type ChildAuth, type DB } from "@/lib/api/schema";
import { sessionStore } from "@/lib/session";
import { useStore } from "@/lib/store";
import { http } from "./http";
import type { ChildOut, Consents, DailyOut, PlanOut, ReviewItem, RoundOut, RoundSummary } from "@/lib/server/types";
import {
  answersFrom, dailyFrom, doneFrom, familyChildFrom, familyConsentsFrom, pausedFrom, planFrom, planVideosFrom, reviewVideosFrom,
  aacCardFrom, auditFrom, careLinkFrom, orderFrom, subscriptionFrom, changeFrom, childFrom, notificationFrom, classFrom, goalFrom, levelsFrom, masteryFrom, noteFrom, profileFrom, rosterChildFrom,
  sessionsFrom, taskFrom, userFrom,
  type BAacCard, type BAdminSub, type BAudit, type BOrder, type BOverview, type BCareLink, type BNotification, type BChild, type BChildOverview, type BClass, type BGoal, type BLevel, type BNote,
  type BProfile, type BTask, type BUser,
} from "./map";
import { liveChild } from "./state";

// Live-mode useDb(): the connected server data, fetched with TanStack Query and shaped like the mock DB, so
// pages and the sel.* rules work unchanged. Each role loads only what its pages read:
// child mode (parent's device or a class device) → the child's own endpoints; parent → their children;
// teacher → one overview per class; therapist → one view per linked child.

/** A fresh, empty DB each time — never share arrays between snapshots (they get pushed into below). */
const empty = (): DB => ({
  v: 1, auth: { userId: null, child: null }, users: [], familyMembers: [], children: [], consents: [], profiles: [], changes: [], sessions: [],
  events: [], mastery: [], progress: [], wallets: [], classes: [], enrollments: [], assignments: [], careLinks: [], notes: [],
  goals: [], aacEvents: [], aacCards: [], notifications: [], subscriptions: [], orders: [], audit: [], flags: [], aiMessages: [],
  otp: [], intakeAnswers: [], intakeRounds: [], videos: [], roadmaps: [], tasksDone: [], pausedDays: [], dailyAnswers: [], tries: [], accessProfiles: [], skills: [], playTime: [],
});

/** A family child's data on the new server (apps/api); each round's answers are loaded after the round list. */
const PER_CHILD = ["consents", "rounds", "plan", "daily"] as const;
const REVIEW_STATUSES = ["waiting_review", "changes_requested", "rejected", "approved"] as const;
type PerChild = (typeof PER_CHILD)[number];
const path = (kind: PerChild, id: string) =>
  ({ consents: `/children/${id}/consents`, rounds: `/children/${id}/intake`, plan: `/children/${id}/plan`, daily: `/children/${id}/daily` })[kind];
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

interface BTherapistChild { overview: BChildOverview; notes: BNote[]; goals: BGoal[]; recommendations: BTask[] }
interface BClassOverview { klass: BClass; children: BChildOverview[]; assignments: BTask[] }
interface BLinked { id: string }

/** The child-mode marker while it's valid (the server's child token lasts 8 h). */
const activeChild = (c: ChildAuth | null) => (c && c.exp > Date.now() ? c : null);

/** Progress, skills, minutes and adaptations of one child, as a professional sees them. */
function addOverview(db: DB, o: BChildOverview) {
  const id = o.child.id;
  if (!db.children.some((c) => c.id === id)) db.children.push(rosterChildFrom(o.child));
  db.progress.push(...levelsFrom(id, o.levels));
  db.mastery.push(...masteryFrom(id, o.skills));
  db.sessions.push(...sessionsFrom(id, o.minutes));
  db.changes.push(...o.changes.map((c) => changeFrom(id, c)).filter((c) => c !== null));
}

export function useLiveDb(): DB {
  const child = activeChild(useStore(liveChild));

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
        queryKey: [kind, id],
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

  const subscription = useQuery({
    queryKey: ["subscription"],
    enabled: role === "parent",
    queryFn: () => http<{ plan: string; status: string; paid_until: string | null }>("GET", "/billing/subscription"),
  });
  const orders = useQuery({
    queryKey: ["orders"],
    enabled: role === "parent" && !child,
    queryFn: () => http<BOrder[]>("GET", "/billing/orders"),
  });

  // ---- physiotherapist: the review queue, every status (the page counts each)
  const review = useQueries({
    queries: (role === "physio" ? REVIEW_STATUSES : []).map((st) => ({
      queryKey: ["review", st],
      queryFn: () => http<ReviewItem[]>("GET", `/review/videos?status=${st}`),
    })),
  });

  // ---- admin console
  const ADMIN = ["users", "audit", "flagList", "subscriptions", "orders", "overview"] as const;
  const adminPath: Record<(typeof ADMIN)[number], string> = {
    users: "/admin/users?limit=500",
    audit: "/admin/audit-logs?limit=200",
    flagList: "/admin/feature-flags",
    subscriptions: "/admin/subscriptions",
    orders: "/admin/orders",
    overview: "/admin/overview",
  };
  const admin = useQueries({
    queries: role === "admin" ? ADMIN.map((k) => ({ queryKey: ["admin", k], queryFn: () => http<unknown>("GET", adminPath[k]) })) : [],
  });

  // ---- teacher
  const classes = useQuery({ queryKey: ["teacher-classes"], enabled: role === "teacher", queryFn: () => http<BClass[]>("GET", "/teacher/classes") });
  const overviews = useQueries({
    queries: (role === "teacher" ? (classes.data ?? []) : []).map((k) => ({
      queryKey: ["class-overview", k.id],
      queryFn: () => http<BClassOverview>("GET", `/teacher/classes/${k.id}/overview`),
    })),
  });

  // ---- therapist
  const linked = useQuery({ queryKey: ["therapist-children"], enabled: role === "therapist", queryFn: () => http<BLinked[]>("GET", "/therapist/children") });
  const invites = useQuery({ queryKey: ["therapist-invites"], enabled: role === "therapist", queryFn: () => http<BCareLink[]>("GET", "/therapist/invites") });
  const views = useQueries({
    queries: (role === "therapist" ? (linked.data ?? []) : []).map((c) => ({
      queryKey: ["therapist-child", c.id],
      queryFn: () => http<BTherapistChild>("GET", `/therapist/children/${c.id}`),
    })),
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

  const all = [me, kids, classes, linked, invites, notifications, flags, subscription, orders, ...own, ...per, ...answers, ...review, ...overviews, ...views, ...admin];
  const stamp = all.map((q) => q.dataUpdatedAt).join();
  const loading =
    me.isPending ||
    (!!child && !!own[0]?.isPending) ||
    // The questions screen starts from the saved answers, so wait for them.
    (role === "parent" && (kids.isPending || per.some((q) => q.isPending) || answers.some((q) => q.isPending))) ||
    (role === "physio" && review.some((q) => q.isPending)) ||
    (role === "teacher" && (classes.isPending || overviews.some((q) => q.isPending))) ||
    (role === "therapist" && (linked.isPending || views.some((q) => q.isPending)));

  return useMemo(() => {
    const db: DB = { ...empty(), loading, auth: { userId: user?.id ?? null, child } };
    if (user) {
      db.users = [user];
      db.notifications = (notifications.data ?? []).map((n) => notificationFrom(n, user.id));
      db.flags = Object.entries(flags.data ?? {}).map(([key, enabled]) => ({ key, enabled, description: "" }));
      db.subscriptions = [subscriptionFrom(user.id, subscription.data)];
      db.orders = (orders.data ?? []).map((o) => orderFrom(user.id, o));
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
        const a = taskFrom({ ...t, class_id: null, kind: "teacher" }, c.id);
        if (a) db.assignments.push(a);
      }
    }

    if (role === "parent") {
      for (const k of kids.data ?? []) if (!db.children.some((c) => c.id === k.id)) db.children.push(familyChildFrom(k));
      // ponytail: shown as the owner of every family the server returns children for; a helper is told apart in B27
      // (the server already refuses a helper what only the owner may do).
      for (const familyId of new Set((kids.data ?? []).map((k) => k.familyId))) db.familyMembers.push({ familyId, userId: user!.id, role: "owner" });
      ids.forEach((id, i) => {
        const consents = perChild(i, "consents") as Consents | undefined;
        const rounds = (perChild(i, "rounds") as RoundSummary[] | undefined) ?? [];
        const plan = perChild(i, "plan") as PlanOut | null | undefined;
        if (consents) db.consents.push(...familyConsentsFrom(id, consents));
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
      roundsOf.forEach(({ id }, k) => {
        const r = answers[k]?.data;
        if (r) db.intakeAnswers.push(...answersFrom(id, r));
      });
    }

    if (role === "physio") db.videos = reviewVideosFrom(review.flatMap((q) => q.data ?? []));

    if (role === "admin" && user && admin[0]?.data) {
      const at = (k: (typeof ADMIN)[number]) => admin[ADMIN.indexOf(k)]?.data;
      db.users = ((at("users") as BUser[] | undefined) ?? []).map(userFrom);
      if (!db.users.some((u) => u.id === user.id)) db.users.push(user);
      db.audit = ((at("audit") as BAudit[] | undefined) ?? []).map(auditFrom);
      db.flags = ((at("flagList") as { key: string; enabled: boolean; description: string | null }[] | undefined) ?? []).map((f) => ({ key: f.key, enabled: f.enabled, description: f.description ?? "" }));
      db.subscriptions = ((at("subscriptions") as BAdminSub[] | undefined) ?? []).map((s) => subscriptionFrom(s.user_id, s));
      db.orders = ((at("orders") as (BOrder & { user_id: string })[] | undefined) ?? []).map((o) => orderFrom(o.user_id, o));
      const ov = at("overview") as BOverview | undefined;
      if (ov)
        db.adminStats = {
          users: ov.users, children: ov.children, paying: ov.paying, sessions: ov.sessions_7d, aiByRole: ov.ai_questions_by_role, aiByDay: ov.ai_questions_by_day,
          health: { db: ov.health.database, redis: ov.health.redis },
        };
    }

    if (role === "teacher" && user) {
      for (const q of overviews) {
        const o = q.data;
        if (!o) continue;
        db.classes.push(classFrom(o.klass, user.id));
        for (const ch of o.children) {
          addOverview(db, ch);
          db.enrollments.push({ classId: o.klass.id, childId: ch.child.id });
          // The server only returns children shared with the school.
          if (!ch.child.school_managed) db.consents.push({ id: `school-${ch.child.id}`, childId: ch.child.id, scope: "school_sharing", version: "", grantedBy: "", grantedAt: "" });
        }
        for (const t of o.assignments) {
          const a = taskFrom(t);
          if (a) db.assignments.push({ ...a, byUserId: a.byUserId || user.id });
        }
      }
    }

    if (role === "therapist" && user) {
      db.careLinks.push(...(invites.data ?? []).map(careLinkFrom));
      for (const q of views) {
        const v = q.data;
        if (!v) continue;
        const id = v.overview.child.id;
        addOverview(db, v.overview);
        db.careLinks.push({ id: `link-${id}`, childId: id, kind: "therapist", email: user.email, professionalId: user.id, status: "active", code: "", createdAt: "" });
        db.consents.push({ id: `therapist-${id}`, childId: id, scope: "therapist_sharing", version: "", grantedBy: "", grantedAt: "" });
        db.notes.push(...v.notes.map(noteFrom));
        db.goals.push(...v.goals.map(goalFrom));
        for (const t of v.recommendations) {
          const a = taskFrom(t, id);
          if (a) db.assignments.push(a);
        }
      }
    }
    return db;
    // `stamp` changes exactly when any query's data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, child, role, loading]);
}
