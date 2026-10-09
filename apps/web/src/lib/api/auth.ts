"use client";

// /auth/*, /users/me, notifications.

import type { Lang, UiLang } from "../i18n";
import { read, write, net } from "./db";
import { requireUser, purgeChild } from "./guards";
import { ApiError, CONSENT_VERSION, DEMO_PHONES, id, iso, OTP_MAX_TRIES, OTP_RESEND_MS } from "./schema";
import type { Role, User } from "../types";

/** "+998 90 123-45-67", "90 123 45 67" → "+998901234567"; null when it isn't an Uzbek mobile number. */
export function normalizePhone(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  const local = d.length === 12 && d.startsWith("998") ? d.slice(3) : d;
  return /^\d{9}$/.test(local) ? `+998${local}` : null;
}
const OTP_TTL_MS = 5 * 60_000;

export const authApi = {
  /** POST /auth/phone/start — sends a 6-digit SMS code (spec §4). Mock: the code comes back so the demo can show it. */
  async requestCode(rawPhone: string) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new ApiError("invalid_phone");
    const prev = read().otp.find((o) => o.phone === phone);
    const demo = (Object.values(DEMO_PHONES) as string[]).includes(phone); // mock: demo buttons can sign in again at once
    if (prev && !demo && Date.now() - prev.sentAt < OTP_RESEND_MS) throw new ApiError("code_too_soon");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    write((db) => {
      db.otp = db.otp.filter((o) => o.phone !== phone).concat({ phone, code, sentAt: Date.now(), tries: 0 });
    });
    return net({ phone, resendAfterMs: OTP_RESEND_MS, demoCode: code }, 300);
  },
  /** POST /auth/phone/verify — signs in, or creates a parent account the first time this number is used. */
  async verifyCode(rawPhone: string, code: string, uiLang: UiLang) {
    const phone = normalizePhone(rawPhone);
    const otp = read().otp.find((o) => o.phone === phone);
    if (!phone || !otp) throw new ApiError("code_expired");
    if (Date.now() - otp.sentAt > OTP_TTL_MS) throw new ApiError("code_expired");
    if (otp.tries >= OTP_MAX_TRIES) throw new ApiError("too_many_tries");
    if (otp.code !== code.trim()) {
      write((db) => {
        db.otp.find((o) => o.phone === phone)!.tries++;
      });
      throw await net(new ApiError("invalid_code"), 300);
    }
    let user = read().users.find((u) => u.phone === phone);
    if (user?.status === "disabled") throw new ApiError("account_disabled");
    const isNew = !user;
    user ??= { id: id(), email: "", name: "", role: "parent", status: "active", password: id(), uiLang, emailVerified: false, phone, createdAt: iso() };
    const u = user;
    write((db) => {
      db.otp = db.otp.filter((o) => o.phone !== phone);
      if (isNew) {
        db.users.push(u);
        db.subscriptions.push({ userId: u.id, plan: "free", status: "active" });
      }
      db.auth.userId = u.id;
    });
    return net({ user: u, isNew });
  },
  /** PATCH /users/me/signup — basic consent, city and district (spec §4: required before anything else). */
  async completeSignup(input: { name: string; region: string; district: string; consent: boolean }) {
    const u = requireUser();
    if (!input.consent) throw new ApiError("consent_required");
    write((db) => {
      const me = db.users.find((x) => x.id === u.id)!;
      me.name = input.name.trim() || me.name;
      me.district = { region: input.region, district: input.district };
      me.consentVersion = CONSENT_VERSION;
    });
    return net(true);
  },
  /** POST /auth/register (legacy email sign-up) */
  async register(input: { email: string; password: string; name: string; role: Exclude<Role, "admin" | "physio">; uiLang: Lang }) {
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
  /** POST /me/logout-all — every device signs out (mock: this one). */
  async logoutAll() {
    return authApi.logout();
  },
  /** POST /auth/forgot-password — always succeeds (never reveals whether the email exists). */
  async forgotPassword(email: string) {
    void email;
    return net(true, 400);
  },
  /** POST /auth/password/reset — the single-use token from the emailed link (mock: any token works). */
  async resetPassword(token: string, password: string) {
    void token;
    if (password.length < 10) throw new ApiError("weak_password");
    return net(true);
  },
  /** POST /me/resend-verification */
  async resendVerification() {
    requireUser();
    return net(true, 300);
  },
  /** POST /auth/verify-email */
  async verifyEmail(token?: string) {
    void token; // mock: the demo button verifies directly (live: token from the emailed link)
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
  /** DELETE /me — `confirmEmail` is the address the parent typed (checked by the server too). */
  async deleteMe(confirmEmail?: string) {
    const u = requireUser();
    if (confirmEmail !== undefined && confirmEmail.trim().toLowerCase() !== u.email.toLowerCase()) throw new ApiError("confirmation_mismatch");
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
