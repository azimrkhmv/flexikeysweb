"use client";

// Parent intake (spec §5), roadmap (spec §8/§13) and the physio review queue (spec §8).

import type { Answers } from "@/content/intake";
import { baseLang, type Lang, type UiLang } from "../i18n";
import { buildRoadmap } from "../roadmap";
import { read, write, net } from "./db";
import { audit, requireChildAccess, requireUser } from "./guards";
import { ApiError, CONSENT_VERSION, id, iso } from "./schema";
import { sel } from "./selectors";
import type { Child, IntakeValue, Respondent, VideoStatus } from "../types";

const today = () => iso().slice(0, 10);

export const intakeApi = {
  /** POST /children — from intake step 1 (P1–P5, P8). Basic consent was given at sign-up. */
  async createChildFromIntake(answers: Answers, uiLang: UiLang) {
    const u = requireUser(["parent"]);
    if (!u.consentVersion && !u.emailVerified) throw new ApiError("consent_required");
    const name = String(answers.P1 ?? "").trim();
    const birthDate = String(answers.P2 ?? "");
    if (!name) throw new ApiError("name_required");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || birthDate > today()) throw new ApiError("invalid_date");
    const lang = baseLang(uiLang);
    const child: Child = {
      id: id(), parentId: u.id, name, birthYear: Number(birthDate.slice(0, 4)), birthDate, learningLang: lang, uiLang: lang, avatar: "☁️", access: "touch",
      equipped: typeof answers.P8 === "string" ? { color: answers.P8 } : {},
      sex: answers.P3 === "boy" || answers.P3 === "girl" ? answers.P3 : undefined,
      relationship: (["mother", "father", "grandparent", "carer"] as const).find((r) => r === answers.P4),
      createdAt: iso(),
    };
    write((db) => {
      db.children.push(child);
      db.consents.push({ id: id(), childId: child.id, scope: "core", version: CONSENT_VERSION, grantedBy: u.id, grantedAt: iso() });
      db.wallets.push({ childId: child.id, coins: 0, stars: 0, owned: [] });
      db.intakeRounds.push({ childId: child.id, round: 1, startedAt: iso() });
    });
    await intakeApi.saveAnswers(child.id, 1, answers, answers.P5 === "therapist" || answers.P5 === "together" ? answers.P5 : "parent");
    return child;
  },

  /** PUT /children/{id}/intake/{round} — saves as the parent goes, so they can finish later. */
  async saveAnswers(childId: string, round: number, answers: Answers, respondent: Respondent = "parent") {
    requireChildAccess(childId, ["owner"]);
    const health = sel.hasConsent(read(), childId, "health");
    write((db) => {
      for (const [questionId, value] of Object.entries(answers)) {
        if (value === undefined) continue;
        // Section B (P9–P17) is health data: never stored without the health consent (spec §4).
        if (!health && /^P(9|1[0-7])(_|$)/.test(questionId)) continue;
        const v: IntakeValue = typeof value === "string" && value.length > 1000 ? value.slice(0, 1000) : value;
        db.intakeAnswers = db.intakeAnswers.filter((a) => !(a.childId === childId && a.round === round && a.questionId === questionId));
        db.intakeAnswers.push({ childId, round, questionId, value: v, answeredAt: iso(), respondent });
      }
    });
    return net(true, 0);
  },

  /** POST /children/{id}/intake/{round}/complete — builds the 4-week roadmap from the answers. */
  async finishIntake(childId: string, round: number) {
    const { user } = requireChildAccess(childId, ["owner"]);
    const db = read();
    const child = sel.child(db, childId)!;
    const input = {
      childId, round, birthDate: child.birthDate ?? `${child.birthYear}-01-01`, startDate: today(), lang: child.learningLang,
      answers: sel.intakeAnswers(db, childId, round), healthConsent: sel.hasConsent(db, childId, "health"),
    };
    const plan = { ...buildRoadmap(input, db.videos), id: id(), createdAt: iso() };
    write((d) => {
      d.roadmaps.push(plan);
      const r = d.intakeRounds.find((x) => x.childId === childId && x.round === round);
      if (r) r.completedAt = iso();
      audit(d, user.id, "roadmap.build", childId, `round ${round}`);
    });
    return net(plan);
  },

  /** POST /children/{id}/intake — the 3-month re-intake: a new round, pre-filled from the last one. */
  async startReintake(childId: string) {
    requireChildAccess(childId, ["owner"]);
    const last = sel.intakeRound(read(), childId);
    const round = (last?.round ?? 0) + 1;
    const prev = last ? sel.intakeAnswers(read(), childId, last.round) : {};
    write((db) => {
      db.intakeRounds.push({ childId, round, startedAt: iso() });
    });
    await intakeApi.saveAnswers(childId, round, prev);
    return round;
  },

  // ------------------------------------------------------------ video library (physio review)
  /** POST /videos/{id}/versions/{lang}/review — approve / reject / request changes (with a note). */
  async reviewVideo(videoId: string, lang: Lang, status: Exclude<VideoStatus, "generated">, note: string) {
    const u = requireUser(["physio", "admin"]);
    if (status !== "approved" && !note.trim()) throw new ApiError("note_required");
    if (!read().videos.find((v) => v.id === videoId)?.versions[lang]) throw new ApiError("not_found");
    write((db) => {
      const ver = db.videos.find((v) => v.id === videoId)!.versions[lang]!;
      ver.status = status;
      if (note.trim()) ver.notes.push({ by: u.id, text: note.trim(), at: iso() });
      if (status === "approved") Object.assign(ver, { approvedBy: u.id, approvedAt: iso() });
      else Object.assign(ver, { approvedBy: undefined, approvedAt: undefined });
      audit(db, u.id, `video.${status}`, `${videoId}/${lang}`, note.trim() || undefined);
    });
    return net(true);
  },
  /** POST /admin/videos/{id}/versions/{lang} — a newly generated file; it waits for physio review again. */
  async registerVideo(videoId: string, lang: Lang, url: string, durationS: number) {
    const u = requireUser(["admin"]);
    if (!/^(https:\/\/|\/)/.test(url)) throw new ApiError("invalid_url");
    write((db) => {
      const v = db.videos.find((x) => x.id === videoId);
      if (!v) throw new ApiError("not_found");
      v.versions[lang] = { url, durationS, status: "generated", notes: v.versions[lang]?.notes ?? [] };
      audit(db, u.id, "video.register", `${videoId}/${lang}`);
    });
    return net(true);
  },
};
