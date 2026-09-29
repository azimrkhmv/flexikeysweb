"use client";

// /teacher/* — classes, school-managed children, assignments.

import { read, write, net } from "./db";
import { requireUser, audit } from "./guards";
import { ApiError, id, iso, makeCode } from "./schema";
import type { Child, ClassRoom } from "../types";

export const teacherApi = {
  // ------------------------------------------------------------ teacher (/teacher/*)
  async createClass(input: Pick<ClassRoom, "name" | "grade" | "learningLang">) {
    const u = requireUser(["teacher"]);
    if (u.status !== "active") throw new ApiError("pending_verification");
    const k: ClassRoom = { ...input, id: id(), teacherId: u.id, code: makeCode(), createdAt: iso() };
    write((db) => {
      db.classes.push(k);
    });
    return net(k);
  },
  /** POST /teacher/classes/{id}/children — school-managed profile; school attests it holds parental consent. */
  async addSchoolChild(classId: string, input: { name: string; avatar: string; attested: boolean }) {
    const u = requireUser(["teacher"]);
    const k = read().classes.find((c) => c.id === classId && c.teacherId === u.id);
    if (!k) throw new ApiError("not_found");
    if (!input.attested) throw new ApiError("consent_required");
    const child: Child = {
      id: id(), parentId: null, name: input.name.trim(), birthYear: new Date().getFullYear() - 6, avatar: input.avatar,
      learningLang: k.learningLang, uiLang: k.learningLang, access: "touch", equipped: {}, createdAt: iso(),
    };
    write((db) => {
      db.children.push(child);
      db.enrollments.push({ classId, childId: child.id });
      db.wallets.push({ childId: child.id, coins: 0, stars: 0, owned: [] });
      audit(db, u.id, "school_child.create", child.id, "school consent attested");
    });
    return net(child);
  },
  /** Removing a child revokes teacher access immediately (FR-TCH-3). */
  async removeFromClass(classId: string, childId: string) {
    const u = requireUser(["teacher"]);
    if (!read().classes.some((c) => c.id === classId && c.teacherId === u.id)) throw new ApiError("not_found");
    write((db) => {
      db.enrollments = db.enrollments.filter((e) => !(e.classId === classId && e.childId === childId));
    });
    return net(true);
  },
  async assign(input: { classId: string; levelId: string; note: string; due?: string }) {
    const u = requireUser(["teacher"]);
    if (!read().classes.some((c) => c.id === input.classId && c.teacherId === u.id)) throw new ApiError("not_found");
    write((db) => {
      db.assignments.push({ ...input, id: id(), kind: "teacher", byUserId: u.id, createdAt: iso() });
    });
    return net(true);
  },
  async deleteAssignment(assignmentId: string) {
    const u = requireUser(["teacher", "therapist"]);
    write((db) => {
      db.assignments = db.assignments.filter((a) => !(a.id === assignmentId && a.byUserId === u.id));
    });
    return net(true, 0);
  },
};
