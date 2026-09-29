"use client";

// /auth/*, /users/me, notifications.

import type { Lang } from "../i18n";
import { read, write, net } from "./db";
import { requireUser, purgeChild } from "./guards";
import { ApiError, id, iso } from "./schema";
import type { Role, User } from "../types";

export const authApi = {
  /** POST /auth/register */
  async register(input: { email: string; password: string; name: string; role: Exclude<Role, "admin">; uiLang: Lang }) {
    const email = input.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError("invalid_email");
    if (input.password.length < 10) throw new ApiError("weak_password");
    if (read().users.some((u) => u.email === email)) throw new ApiError("email_taken");
    const autoApprove = read().flags.find((f) => f.key === "auto_approve_professionals")?.enabled;
    const user: User = {
      id: id(), email, name: input.name.trim(), role: input.role, password: input.password, uiLang: input.uiLang,
      status: input.role === "parent" || autoApprove ? "active" : "pending_verification", emailVerified: false, createdAt: iso(),
    };
    write((db) => {
      db.users.push(user);
      db.auth.userId = user.id;
      if (user.role === "parent") db.subscriptions.push({ userId: user.id, plan: "free", status: "active" });
    });
    return net(user);
  },
  /** POST /auth/login */
  async login(email: string, password: string) {
    const u = read().users.find((x) => x.email === email.trim().toLowerCase());
    if (!u || u.password !== password) throw await net(new ApiError("invalid_credentials"), 300);
    if (u.status === "disabled") throw new ApiError("account_disabled");
    write((db) => {
      db.auth.userId = u.id;
    });
    return net(u);
  },
  /** POST /auth/google — demo: signs in (or creates) a Google-linked parent. */
  async loginWithGoogle() {
    const email = "google.parent@demo.uz";
    let u = read().users.find((x) => x.email === email);
    if (!u) {
      u = { id: id(), email, name: "Google Parent", role: "parent", status: "active", password: id(), uiLang: "uz", emailVerified: true, createdAt: iso() };
      const nu = u;
      write((db) => {
        db.users.push(nu);
        db.subscriptions.push({ userId: nu.id, plan: "free", status: "active" });
      });
    }
    const uid = u.id;
    write((db) => {
      db.auth.userId = uid;
    });
    return net(u);
  },
  /** POST /auth/logout */
  async logout() {
    write((db) => {
      db.auth = { userId: null, child: null };
    });
    return net(true);
  },
  /** POST /auth/forgot-password — always succeeds (never reveals whether the email exists). */
  async forgotPassword(email: string) {
    void email;
    return net(true, 400);
  },
  /** POST /auth/verify-email */
  async verifyEmail() {
    const u = requireUser();
    write((db) => {
      db.users.find((x) => x.id === u.id)!.emailVerified = true;
    });
    return net(true);
  },
  /** PATCH /users/me */
  async updateMe(patch: Partial<Pick<User, "name" | "uiLang">>) {
    const u = requireUser();
    write((db) => Object.assign(db.users.find((x) => x.id === u.id)!, patch));
    return net(true);
  },
  /** DELETE /users/me — deletes the account and every owned child (PRD §20). */
  async deleteMe() {
    const u = requireUser();
    write((db) => {
      const kids = db.children.filter((c) => c.parentId === u.id).map((c) => c.id);
      kids.forEach((k) => purgeChild(db, k));
      db.users = db.users.filter((x) => x.id !== u.id);
      db.auth = { userId: null, child: null };
    });
    return net(true);
  },

  // ------------------------------------------------------------ notifications
  async markRead(notificationId?: string) {
    const u = requireUser();
    write((db) => db.notifications.forEach((n) => {
      if (n.userId === u.id && (!notificationId || n.id === notificationId)) n.read = true;
    }));
    return net(true, 0);
  },
};
