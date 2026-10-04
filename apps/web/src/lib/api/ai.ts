"use client";

// /ai-assistant/*, /teacher/ai/summary — rule-based stand-ins for the LlmProvider (PRD §16).

import { LEVEL_BY_ID } from "@/content/levels";
import { translate, type Lang } from "../i18n";
import { read, write, net } from "./db";
import { requireUser, requireChildAccess } from "./guards";
import { ApiError, AI_DAILY_QUOTA, id, iso, type DB } from "./schema";
import { sel } from "./selectors";

export const aiApi = {
  // ------------------------------------------------------------ AI (/ai-assistant/*, /teacher/ai/summary)
  /** POST /ai-assistant/chat — pseudonymized context, consent-gated, quota-limited (PRD §16). */
  async askAssistant(childId: string, text: string, lang: Lang) {
    const { user } = requireChildAccess(childId, ["owner"]);
    const db = read();
    if (!sel.hasConsent(db, childId, "ai_processing")) throw new ApiError("consent_required");
    const today = iso().slice(0, 10);
    if (db.aiMessages.filter((m) => m.userId === user.id && m.role === "user" && m.at.startsWith(today)).length >= AI_DAILY_QUOTA) throw new ApiError("quota_exceeded");
    const answer = stubAssistant(db, childId, text, lang);
    write((d) => {
      d.aiMessages.push({ id: id(), userId: user.id, childId, role: "user", text, at: iso() });
      d.aiMessages.push({ id: id(), userId: user.id, childId, role: "assistant", text: answer, at: iso() });
    });
    return net(answer, 700);
  },
  async clearAssistant(childId: string) {
    const { user } = requireChildAccess(childId, ["owner"]);
    write((db) => {
      db.aiMessages = db.aiMessages.filter((m) => !(m.userId === user.id && m.childId === childId));
    });
    return net(true, 0);
  },
  async teacherAiSummary(classId: string, lang: Lang) {
    const u = requireUser(["teacher"]);
    const db = read();
    const k = db.classes.find((c) => c.id === classId && c.teacherId === u.id);
    if (!k) throw new ApiError("not_found");
    // FR-AI-4: only children whose parent gave ai_processing consent (school-managed profiles have none).
    const kids = sel.classChildren(db, classId).filter((c) => sel.hasConsent(db, c.id, "ai_processing"));
    const avg = (childId: string) => {
      const m = sel.mastery(db, childId).filter((x) => x.attempts > 0);
      return m.length ? m.reduce((a, x) => a + x.pKnown, 0) / m.length : 0;
    };
    const sorted = [...kids].sort((a, b) => avg(b.id) - avg(a.id));
    const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
    const lines = [
      t("ai.teacher.summary", { n: kids.length }),
      t("ai.teacher.groups", { a: sorted.slice(0, Math.ceil(sorted.length / 2)).map((c) => c.name).join(", "), b: sorted.slice(Math.ceil(sorted.length / 2)).map((c) => c.name).join(", ") || "—" }),
      t("ai.teacher.suggest"),
      t("ai.disclaimer"),
    ];
    return net(lines.join("\n\n"), 800);
  },
};

const MEDICAL = /(cerebral|palsy|diagnos|therapy|medic|doctor|autism|церебр|диагноз|врач|лечени|аутизм|shifokor|tashxis|kasal|autizm|davolash)/i;

// ponytail: rule-based stand-in for the Anthropic LlmProvider. Uses only aggregated, name-free stats.
function stubAssistant(db: DB, childId: string, text: string, lang: Lang): string {
  const t = (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars);
  const mastery = sel.mastery(db, childId).filter((m) => m.attempts > 0).sort((a, b) => b.pKnown - a.pKnown);
  const strong = mastery[0] ? LEVEL_BY_ID[mastery[0].skill].title[lang] : "—";
  const weak = mastery.length ? LEVEL_BY_ID[mastery[mastery.length - 1].skill].title[lang] : "—";
  const minutes = sel.dailyMinutes(db, childId, 7).reduce((a, d) => a + d.minutes, 0);
  const change = sel.changes(db, childId)[0];
  const parts = [
    t("ai.parent.intro", { minutes }),
    t("ai.parent.strong", { skill: strong }),
    t("ai.parent.practice", { skill: weak }),
    change ? t("ai.parent.adapt", { change: t(change.reasonKey) }) : "",
    t("ai.parent.tip"),
  ];
  if (MEDICAL.test(text)) parts.push(t("ai.disclaimer"));
  return parts.filter(Boolean).join("\n\n");
}
