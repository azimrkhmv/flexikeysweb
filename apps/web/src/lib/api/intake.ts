"use client";

// Parent intake (spec §5), roadmap (spec §8/§13) and the physio review queue (spec §8).

import { dailyQuestionOn } from "@/content/daily";
import type { Answers } from "@/content/intake";
import { baseLang, type Lang, type UiLang } from "../i18n";
import { buildRoadmap } from "../roadmap";
import { deleteMedia, getMedia, putMedia } from "../media";
import { read, write, net } from "./db";
import { audit, familyForNewChild, requireChildAccess, requireUser, FAMILY } from "./guards";
import { ApiError, CONSENT_VERSION, id, iso, localDate, type DB } from "./schema";
import { sel } from "./selectors";
import type { Child, Feeling, IntakeValue, Respondent, TaskDone, VideoStatus } from "../types";

const today = () => localDate();

/** The plan engine's input for one round: the answers in use (therapists' answers win) and what the therapists set. */
export function planInput(db: DB, childId: string, round: number) {
  const child = sel.child(db, childId)!;
  return {
    childId, round, birthDate: child.birthDate ?? `${child.birthYear}-01-01`, startDate: today(), lang: child.learningLang,
    answers: sel.answersInUse(db, childId, sel.intakeAnswers(db, childId, round)),
    healthConsent: sel.hasConsent(db, childId, "health"),
    therapist: sel.therapistInput(db, childId),
  };
}

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
      id: id(), familyId: null, name, birthYear: Number(birthDate.slice(0, 4)), birthDate, learningLang: lang, uiLang: lang, avatar: "☁️", access: "touch",
      equipped: typeof answers.P8 === "string" ? { color: answers.P8 } : {},
      sex: answers.P3 === "boy" || answers.P3 === "girl" ? answers.P3 : undefined,
      relationship: (["mother", "father", "grandparent", "carer"] as const).find((r) => r === answers.P4),
      createdAt: iso(),
    };
    write((db) => {
      child.familyId = familyForNewChild(db, u.id);
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
    requireChildAccess(childId, FAMILY);
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

  /** POST /children/{id}/intake/voice-link + upload — the P39 voice note; the answer keeps only its key. */
  async saveVoiceNote(_childId: string, blob: Blob) {
    return putMedia(blob);
  },
  /** P40: a movement clip; the answer keeps its id (live: on the server, for the shared therapist). */
  async addMovementClip(_childId: string, file: Blob) {
    return putMedia(file);
  },
  async removeMovementClip(_childId: string, clipId: string) {
    await deleteMedia(clipId);
    return net(true);
  },
  /** POST /children/{id}/clips (kind feedback) — the child doing one exercise, for the therapist (spec §8). */
  async addFeedbackClip(childId: string, exerciseId: string, file: Blob) {
    requireChildAccess(childId, FAMILY);
    if (!sel.hasConsent(read(), childId, "movement_videos")) throw new ApiError("consent_required");
    const clipId = await putMedia(file);
    write((db) => {
      db.feedbackClips.push({ id: clipId, childId, exerciseId, at: iso() });
    });
    return net(clipId);
  },
  async removeFeedbackClip(childId: string, clipId: string) {
    requireChildAccess(childId, FAMILY);
    await deleteMedia(clipId);
    write((db) => {
      db.feedbackClips = db.feedbackClips.filter((c) => c.id !== clipId);
      db.clipReplies = db.clipReplies.filter((r) => r.clipId !== clipId);
    });
    return net(true);
  },
  /** DELETE /children/{id}/clips/{clip_id} from "Everything we store" (B40): the owner deletes any one video, a
   *  movement clip (P40) or a feedback clip, with the therapists' replies to it. */
  async deleteClip(childId: string, clipId: string) {
    const { user } = requireChildAccess(childId, ["owner"]);
    await deleteMedia(clipId);
    write((db) => {
      for (const a of db.intakeAnswers)
        if (a.childId === childId && a.questionId === "P40" && Array.isArray(a.value)) a.value = a.value.filter((x) => x !== clipId);
      db.feedbackClips = db.feedbackClips.filter((c) => c.id !== clipId);
      db.clipReplies = db.clipReplies.filter((r) => r.clipId !== clipId);
      audit(db, user.id, "clip.delete", childId);
    });
    return net(true);
  },
  /** GET /children/{id}/intake/{round}/voice — a link to listen to the voice note again. */
  async voiceNoteUrl(_childId: string, _round: number, key: string) {
    const blob = await getMedia(key);
    return blob ? URL.createObjectURL(blob) : null;
  },

  /** POST /children/{id}/intake/{round}/complete — builds the 4-week roadmap from the answers. */
  async finishIntake(childId: string, round: number) {
    const { user } = requireChildAccess(childId, FAMILY);
    const db = read();
    const plan = { ...buildRoadmap(planInput(db, childId, round), db.videos), id: id(), createdAt: iso() };
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
    requireChildAccess(childId, FAMILY);
    const last = sel.intakeRound(read(), childId);
    const round = (last?.round ?? 0) + 1;
    const prev = last ? sel.intakeAnswers(read(), childId, last.round) : {};
    write((db) => {
      db.intakeRounds.push({ childId, round, startedAt: iso() });
    });
    await intakeApi.saveAnswers(childId, round, prev);
    return round;
  },

  // ------------------------------------------------------------ Today (spec §10)
  /** POST /children/{id}/done {day, exerciseId} — one tap: this exercise of that plan day is done. Twice = once. */
  async markDone(childId: string, day: number, videoId: string) {
    requireChildAccess(childId, FAMILY);
    const plan = sel.roadmap(read(), childId);
    if (!plan?.days[day]?.exercises.some((e) => e.videoId === videoId)) throw new ApiError("not_found");
    const same = sel.tasksDone(read(), childId).find((t) => t.day === day && t.videoId === videoId);
    if (same) return net(same);
    const done: TaskDone = { id: id(), childId, roadmapId: plan.id, day, videoId, at: iso() };
    write((db) => {
      db.tasksDone.push(done);
    });
    return net(done);
  },
  /** PATCH /children/{id}/done/{doneId} {feeling} — the optional easy / OK / hard; can be changed. */
  async rateDone(childId: string, doneId: string, feeling: Feeling) {
    requireChildAccess(childId, FAMILY);
    if (!read().tasksDone.some((t) => t.id === doneId && t.childId === childId)) throw new ApiError("not_found");
    write((db) => {
      db.tasksDone.find((t) => t.id === doneId)!.feeling = feeling;
    });
    return net(undefined);
  },

  /** POST /children/{id}/pause — pause today: nothing to do, the plan moves forward one day. Twice = once. */
  async pauseToday(childId: string) {
    requireChildAccess(childId, FAMILY);
    const date = localDate();
    const on = sel.planDayOn(read(), childId, date);
    if (on === "paused") return net(undefined);
    if (on === null) throw new ApiError("no_task_today");
    const roadmapId = sel.roadmap(read(), childId)!.id;
    write((db) => {
      db.pausedDays.push({ childId, roadmapId, date });
    });
    return net(undefined);
  },
  /** DELETE /children/{id}/pause — undo today's pause. */
  async resumeToday(childId: string) {
    requireChildAccess(childId, FAMILY);
    const roadmapId = sel.roadmap(read(), childId)?.id;
    const date = localDate();
    write((db) => {
      db.pausedDays = db.pausedDays.filter((p) => !(p.roadmapId === roadmapId && p.date === date));
    });
    return net(undefined);
  },

  /** PUT /children/{id}/daily {questionId, value: 0|1|2} — the answer to today's question; can be changed today. */
  async answerDaily(childId: string, questionId: string, value: 0 | 1 | 2) {
    requireChildAccess(childId, FAMILY);
    const date = localDate();
    if (dailyQuestionOn(date).id !== questionId) throw new ApiError("not_todays_question");
    if (![0, 1, 2].includes(value)) throw new ApiError("invalid_answer");
    write((db) => {
      db.dailyAnswers = db.dailyAnswers.filter((a) => !(a.childId === childId && a.date === date));
      db.dailyAnswers.push({ childId, questionId, date, value, at: iso() });
    });
    return net(undefined);
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
  /** POST /admin/videos — a finished file for one exercise and language; it waits for physio review again.
   *  Demo: the file plays from this browser only, until the page is closed. */
  async uploadVideo(exerciseId: string, lang: Lang, file: Blob) {
    const u = requireUser(["admin"]);
    const url = URL.createObjectURL(file);
    write((db) => {
      const v = db.videos.find((x) => x.id === exerciseId);
      if (!v) throw new ApiError("not_found");
      v.versions[lang] = { url, durationS: 0, status: "generated", notes: v.versions[lang]?.notes ?? [] };
      audit(db, u.id, "video.register", `${exerciseId}/${lang}`);
    });
    return net(true);
  },
};
