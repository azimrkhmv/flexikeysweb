"use client";

// Server-side guards of the mock API: who is calling, may they touch this child, audit + notify, purge.

import { read } from "./db";
import { ApiError, MAX_CHILDREN, id, iso, type DB, type ChildAuth } from "./schema";
import { sel } from "./selectors";
import type { Notification, Role, User } from "../types";

// ---------------------------------------------------------------- guards
export function requireUser(roles?: Role[]): User {
  const db = read();
  const u = sel.me(db);
  if (!u || u.status === "disabled") throw new ApiError("unauthorized");
  if (roles && !roles.includes(u.role)) throw new ApiError("forbidden");
  return u;
}
/** Daily use (TASKS.md section 3): the owner and the helper. Everything else about a child is the owner's alone. */
export const FAMILY: ReturnType<typeof sel.access>[] = ["owner", "helper"];
export function requireChildAccess(childId: string, allow: ReturnType<typeof sel.access>[]) {
  const u = requireUser();
  const rel = sel.access(read(), u.id, childId);
  if (!rel || !allow.includes(rel)) throw new ApiError("not_found"); // 404, never 403 (PRD §15.4)
  return { user: u, rel };
}
/** Inside write(): the owner's family id, made on first use (the server makes it at sign-up); refuses a 4th child. */
export function familyForNewChild(db: DB, userId: string): string {
  let familyId = sel.ownFamily(db, userId);
  if (!familyId) {
    familyId = id();
    db.familyMembers.push({ familyId, userId, role: "owner" });
  }
  if (db.children.filter((c) => c.familyId === familyId).length >= MAX_CHILDREN) throw new ApiError("too_many_children");
  return familyId;
}
export function requireChildToken(): ChildAuth {
  const c = sel.childAuth(read());
  if (!c) throw new ApiError("child_session_expired");
  return c;
}
export function audit(db: DB, actorId: string, action: string, target: string, diff?: string) {
  db.audit.unshift({ id: id(), actorId, action, target, diff, at: iso() });
}
export function notify(db: DB, userId: string | null, titleKey: string, vars?: Notification["vars"]) {
  if (userId) db.notifications.unshift({ id: id(), userId, titleKey, vars, read: false, at: iso() });
}

export function purgeChild(db: DB, childId: string) {
  const keep = <T extends { childId?: string }>(xs: T[]) => xs.filter((x) => x.childId !== childId);
  const sessionIds = new Set(db.sessions.filter((s) => s.childId === childId).map((s) => s.id));
  db.children = db.children.filter((c) => c.id !== childId);
  db.consents = keep(db.consents);
  db.profiles = keep(db.profiles);
  db.changes = keep(db.changes);
  db.sessions = keep(db.sessions);
  db.events = db.events.filter((e) => !sessionIds.has(e.sessionId));
  db.mastery = keep(db.mastery);
  db.progress = keep(db.progress);
  db.wallets = keep(db.wallets);
  db.enrollments = keep(db.enrollments);
  db.assignments = db.assignments.filter((a) => a.childId !== childId);
  db.careLinks = keep(db.careLinks);
  db.notes = keep(db.notes);
  db.goals = keep(db.goals);
  db.aacEvents = keep(db.aacEvents);
  db.aacCards = keep(db.aacCards);
  db.aiMessages = keep(db.aiMessages);
  db.intakeAnswers = keep(db.intakeAnswers);
  db.intakeRounds = keep(db.intakeRounds);
  db.roadmaps = keep(db.roadmaps);
  if (db.auth.child?.childId === childId) db.auth.child = null;
}
