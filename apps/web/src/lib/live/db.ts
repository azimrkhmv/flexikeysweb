"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ApiError, type ChildAuth, type DB } from "@/lib/api/schema";
import { sessionStore } from "@/lib/session";
import { useStore } from "@/lib/store";
import { http } from "./http";
import {
  aacCardFrom, aacEventFrom, careLinkFrom, changeFrom, childFrom, notificationFrom, classFrom, consentsFrom, goalFrom, levelsFrom, masteryFrom, noteFrom, profileFrom, rosterChildFrom,
  sessionsFrom, taskFrom, userFrom,
  type BAacCard, type BAacSentence, type BCareLink, type BChange, type BNotification, type BChild, type BChildOverview, type BClass, type BConsent, type BGoal, type BLevel, type BNote,
  type BPoint, type BProfile, type BSkill, type BSummary, type BTask, type BUser,
} from "./map";
import { liveChild } from "./state";

// Live-mode useDb(): the connected server data, fetched with TanStack Query and shaped like the mock DB, so
// pages and the sel.* rules work unchanged. Each role loads only what its pages read:
// child mode (parent's device or a class device) → the child's own endpoints; parent → their children;
// teacher → one overview per class; therapist → one view per linked child.

/** A fresh, empty DB each time — never share arrays between snapshots (they get pushed into below). */
const empty = (): DB => ({
  v: 1, auth: { userId: null, child: null }, users: [], children: [], consents: [], profiles: [], changes: [], sessions: [],
  events: [], mastery: [], progress: [], wallets: [], classes: [], enrollments: [], assignments: [], careLinks: [], notes: [],
  goals: [], aacEvents: [], aacCards: [], notifications: [], subscriptions: [], orders: [], audit: [], flags: [], aiMessages: [],
});

const PER_CHILD = ["levels", "summary", "changes", "consents", "minutes", "skills", "profile", "tasks", "careLinks", "classes", "notes", "goals", "aacCards", "aacSentences", "aiMessages"] as const;
type PerChild = (typeof PER_CHILD)[number];
const path = (kind: PerChild, id: string) =>
  ({
    levels: `/activities/progress/${id}`,
    summary: `/parent/children/${id}/summary`,
    changes: `/progress/adaptations?child_id=${id}&limit=50`,
    consents: `/children/${id}/consents`,
    minutes: `/progress/timeseries?child_id=${id}&metric=time&range_days=60`,
    skills: `/progress/skills?child_id=${id}`,
    profile: `/adaptive/profile/${id}`,
    tasks: `/activities/tasks/${id}`,
    careLinks: `/children/${id}/care-links`,
    classes: `/children/${id}/classes`,
    notes: `/children/${id}/notes`,
    goals: `/children/${id}/goals`,
    aacCards: `/children/${id}/aac/cards`,
    aacSentences: `/children/${id}/aac/sentences?days=7`,
    aiMessages: `/ai-assistant/children/${id}/messages`,
  })[kind];

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
  const kids = useQuery({ queryKey: ["children"], enabled: role === "parent", queryFn: () => http<BChild[]>("GET", "/children") });
  const ids = role === "parent" && !child ? (kids.data ?? []).map((c) => c.id) : [];
  const per = useQueries({
    queries: ids.flatMap((id) => PER_CHILD.map((kind) => ({ queryKey: [kind, id], queryFn: () => http<unknown>("GET", path(kind, id)) }))),
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

  const all = [me, kids, classes, linked, invites, notifications, flags, ...own, ...per, ...overviews, ...views];
  const stamp = all.map((q) => q.dataUpdatedAt).join();
  const loading =
    me.isPending ||
    (!!child && !!own[0]?.isPending) ||
    (role === "parent" && kids.isPending) ||
    (role === "teacher" && (classes.isPending || overviews.some((q) => q.isPending))) ||
    (role === "therapist" && (linked.isPending || views.some((q) => q.isPending)));

  return useMemo(() => {
    const db: DB = { ...empty(), loading, auth: { userId: user?.id ?? null, child } };
    if (user) {
      db.users = [user];
      db.notifications = (notifications.data ?? []).map((n) => notificationFrom(n, user.id));
      db.flags = Object.entries(flags.data ?? {}).map(([key, enabled]) => ({ key, enabled, description: "" }));
      db.subscriptions = [{ userId: user.id, plan: "free", status: "active" }]; // billing isn't connected yet
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
      db.aacCards.push(...((at("aacCards") as BAacCard[] | undefined) ?? []).map(aacCardFrom));
      // The server already filtered these for this child; seen as the child's own tasks.
      for (const t of (at("tasks") as BTask[] | undefined) ?? []) {
        const a = taskFrom({ ...t, class_id: null, kind: "teacher" }, c.id);
        if (a) db.assignments.push(a);
      }
    }

    if (role === "parent") {
      for (const k of kids.data ?? []) if (!db.children.some((c) => c.id === k.id)) db.children.push(childFrom(k));
      ids.forEach((id, i) => {
        const at = (kind: PerChild) => per[i * PER_CHILD.length + PER_CHILD.indexOf(kind)]?.data;
        const levels = at("levels") as BLevel[] | undefined;
        const summary = at("summary") as BSummary | undefined;
        const changes = at("changes") as BChange[] | undefined;
        const consents = at("consents") as BConsent[] | undefined;
        const minutes = at("minutes") as BPoint[] | undefined;
        const skills = at("skills") as BSkill[] | undefined;
        const profile = at("profile") as BProfile | undefined;
        if (levels) db.progress.push(...levelsFrom(id, levels));
        if (consents) db.consents.push(...consentsFrom(consents));
        if (changes) db.changes.push(...changes.map((c) => changeFrom(id, c)).filter((c) => c !== null));
        if (minutes) db.sessions.push(...sessionsFrom(id, minutes));
        if (skills) db.mastery.push(...masteryFrom(id, skills));
        if (profile)
          db.profiles.push({ childId: id, input: "touch", params: profileFrom(profile.profile.params), version: profile.profile.version, lastDir: {}, updatedAt: profile.profile.updated_at });
        db.wallets.push({ childId: id, coins: summary?.coins ?? 0, stars: summary?.stars ?? 0, owned: [] });
        for (const k of (at("classes") as BClass[] | undefined) ?? []) {
          if (!db.classes.some((x) => x.id === k.id)) db.classes.push(classFrom({ ...k, join_code: "", created_at: "" }, ""));
          db.enrollments.push({ classId: k.id, childId: id });
        }
        db.careLinks.push(...((at("careLinks") as BCareLink[] | undefined) ?? []).map(careLinkFrom));
        db.notes.push(...((at("notes") as BNote[] | undefined) ?? []).map(noteFrom));
        db.goals.push(...((at("goals") as BGoal[] | undefined) ?? []).map(goalFrom));
        db.aacCards.push(...((at("aacCards") as BAacCard[] | undefined) ?? []).map(aacCardFrom));
        db.aacEvents.push(...((at("aacSentences") as BAacSentence[] | undefined) ?? []).map((s, k) => aacEventFrom(id, s, k)));
        for (const m of (at("aiMessages") as { id: string; role: string; content: string; created_at: string }[] | undefined) ?? [])
          db.aiMessages.push({ id: m.id, userId: user!.id, childId: id, role: m.role === "user" ? "user" : "assistant", text: m.content, at: m.created_at });
        for (const t of (at("tasks") as BTask[] | undefined) ?? []) {
          const a = taskFrom(t, id);
          if (a && !db.assignments.some((x) => x.id === a.id)) db.assignments.push(a);
        }
      });
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
