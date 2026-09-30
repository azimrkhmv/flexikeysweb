"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { ApiError, type ChildAuth, type DB } from "@/lib/api/schema";
import { sessionStore } from "@/lib/session";
import { useStore } from "@/lib/store";
import { http } from "./http";
import {
  changeFrom, childFrom, consentsFrom, levelsFrom, masteryFrom, profileFrom, sessionsFrom, userFrom,
  type BChange, type BChild, type BConsent, type BLevel, type BPoint, type BProfile, type BSkill, type BSummary, type BUser,
} from "./map";
import { liveChild } from "./state";

// Live-mode useDb(): the connected server data, fetched with TanStack Query and shaped like the mock DB, so
// pages and the sel.* rules work unchanged. Areas not connected yet stay empty (their pages say so).

/** A fresh, empty DB each time — never share arrays between snapshots (they get pushed into below). */
const empty = (): DB => ({
  v: 1, auth: { userId: null, child: null }, users: [], children: [], consents: [], profiles: [], changes: [], sessions: [],
  events: [], mastery: [], progress: [], wallets: [], classes: [], enrollments: [], assignments: [], careLinks: [], notes: [],
  goals: [], aacEvents: [], aacCards: [], notifications: [], subscriptions: [], orders: [], audit: [], flags: [], aiMessages: [],
});

const PER_CHILD = ["levels", "summary", "changes", "consents", "minutes", "skills", "profile"] as const;
const path = (kind: (typeof PER_CHILD)[number], id: string) =>
  ({
    levels: `/activities/progress/${id}`,
    summary: `/parent/children/${id}/summary`,
    changes: `/progress/adaptations?child_id=${id}&limit=50`,
    consents: `/children/${id}/consents`,
    minutes: `/progress/timeseries?child_id=${id}&metric=time&range_days=60`,
    skills: `/progress/skills?child_id=${id}`,
    profile: `/adaptive/profile/${id}`,
  })[kind];

/** The child-mode marker while it's valid (the server's child token lasts 8 h). */
const activeChild = (c: ChildAuth | null) => (c && c.exp > Date.now() ? c : null);

export function useLiveDb(): DB {
  const child = activeChild(useStore(liveChild));

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      http<BUser>("GET", "/me").catch((e) => {
        if (e instanceof ApiError && e.code === "unauthorized") return null; // signed out
        throw e;
      }),
  });
  const user = me.data ? userFrom(me.data) : null;
  const parent = user?.role === "parent";

  const kids = useQuery({ queryKey: ["children"], enabled: parent, queryFn: () => http<BChild[]>("GET", "/children") });
  const ids = (kids.data ?? []).map((c) => c.id);
  const per = useQueries({
    queries: ids.flatMap((id) => PER_CHILD.map((kind) => ({ queryKey: [kind, id], queryFn: () => http<unknown>("GET", path(kind, id)) }))),
  });
  // Shop: which items this child owns (child token = the httpOnly fk_child cookie).
  const catalog = useQuery({
    queryKey: ["catalog", child?.childId],
    enabled: !!child,
    queryFn: () => http<{ slug: string; owned: boolean }[]>("GET", "/rewards/catalog"),
  });

  // Public pages read who is signed in from the small session store.
  const role = me.isPending ? undefined : (user?.role ?? null);
  useEffect(() => {
    if (role !== undefined && sessionStore.get().role !== role) sessionStore.set({ role });
  }, [role]);

  const stamp = [me.dataUpdatedAt, kids.dataUpdatedAt, catalog.dataUpdatedAt, ...per.map((q) => q.dataUpdatedAt)].join();
  return useMemo(() => {
    const db: DB = { ...empty(), loading: me.isPending || (parent && kids.isPending), auth: { userId: user?.id ?? null, child } };
    if (!user) return db;
    db.users = [user];
    db.subscriptions = [{ userId: user.id, plan: "free", status: "active" }]; // billing isn't connected yet
    db.children = (kids.data ?? []).map(childFrom);
    ids.forEach((id, i) => {
      const at = (kind: (typeof PER_CHILD)[number]) => per[i * PER_CHILD.length + PER_CHILD.indexOf(kind)]?.data;
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
      const owned = child?.childId === id ? (catalog.data ?? []).filter((c) => c.owned).map((c) => c.slug) : [];
      db.wallets.push({ childId: id, coins: summary?.coins ?? 0, stars: summary?.stars ?? 0, owned });
    });
    return db;
    // `stamp` changes exactly when any query's data changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stamp, child, parent, me.isPending, kids.isPending]);
}
