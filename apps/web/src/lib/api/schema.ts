"use client";

// Shape of the mock database, shared constants and id/time helpers.

import type { AacCustomCard, AacEvent, AdaptationChange, AiMessage, Assignment, AuditLog, CareLink, Child, ClassRoom, Consent, Enrollment, ExerciseVideo, FeatureFlag, IntakeAnswer, IntakeRound, Goal, InteractionEvent, LearningSession, LevelProgress, Note, Notification, Order, Plan, ProfileRecord, Roadmap, SkillMastery, Subscription, User, Wallet } from "../types";

export interface ChildAuth {
  childId: string;
  grantedBy: "parent" | "class";
  exp: number;
}

export interface DB {
  v: number;
  /** Live mode: server data still loading (pages show a spinner instead of "signed out"). */
  loading?: boolean;
  /** Live mode, admin: platform numbers computed by the server (the arrays hold no other families). */
  adminStats?: { users: number; children: number; paying: number; sessions: number; aiByRole: Record<string, number>; aiByDay: Record<string, number>; health: Record<string, boolean> };
  auth: { userId: string | null; child: ChildAuth | null };
  users: User[];
  children: Child[];
  consents: Consent[];
  profiles: ProfileRecord[];
  changes: AdaptationChange[];
  sessions: LearningSession[];
  events: InteractionEvent[];
  mastery: SkillMastery[];
  progress: LevelProgress[];
  wallets: Wallet[];
  classes: ClassRoom[];
  enrollments: Enrollment[];
  assignments: Assignment[];
  careLinks: CareLink[];
  notes: Note[];
  goals: Goal[];
  aacEvents: AacEvent[];
  aacCards: AacCustomCard[];
  notifications: Notification[];
  subscriptions: Subscription[];
  orders: Order[];
  audit: AuditLog[];
  flags: FeatureFlag[];
  aiMessages: AiMessage[];
  /** Spec 2026-10-06. MOCK ONLY: the last SMS code per phone (the server never returns it). */
  otp: { phone: string; code: string; sentAt: number; tries: number }[];
  intakeAnswers: IntakeAnswer[];
  intakeRounds: IntakeRound[];
  videos: ExerciseVideo[];
  roadmaps: Roadmap[];
}

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

export const CONSENT_VERSION = "2026-09-v1";
export const DEMO_PASSWORD = "demo12345";
/** Demo sign-in numbers (mock: the SMS code is shown on screen). */
export const DEMO_PHONES = { parent: "+998900000001", therapist: "+998900000002", physio: "+998900000003", admin: "+998900000004" } as const;
export const PRICES: Record<Exclude<Plan, "free">, number> = { monthly: 49_000_00, yearly: 390_000_00 }; // tiyin
export const AI_DAILY_QUOTA = 30;
export const OTP_RESEND_MS = 60_000;
export const OTP_MAX_TRIES = 5;
export const CHILD_TOKEN_MS = 8 * 3600_000;
export const DAY = 86_400_000;

export const id = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));
export const iso = (t = Date.now()) => new Date(t).toISOString();
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L (SEC-5)
export const makeCode = (n = 6) => Array.from({ length: n }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join("");

/** Bump when the DB shape changes: browsers holding an older shape are reseeded instead of crashing. */
export const DB_VERSION = 2;
