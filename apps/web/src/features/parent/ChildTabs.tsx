"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Clock, Coins, Copy, Download, Flame, Mic, Star, Trash } from "lucide-react";
import { Bars, Button, Card, Chip, Empty, Field, Input, Meter, Modal, Select, Stat, Toggle, useAction } from "@/components/ui";
import { AAC_CATEGORIES } from "@/content/aac";
import { LEVELS } from "@/content/levels";
import { api, sel, useDb } from "@/lib/api";
import { LANGS, useLang, useT, type Lang } from "@/lib/i18n";
import type { AccessMode, Child, ConsentScope } from "@/lib/types";
import { fmtDate } from "@/lib/format";
import { aacLabel, BIRTH_YEARS, download, profileLines } from "./lib";
import { AccessPicker, AvatarGrid } from "./pickers";

export const TABS = ["progress", "changes", "aac", "sharing", "settings", "privacy"] as const;
export type Tab = (typeof TABS)[number];

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="mb-3 text-lg font-extrabold">{children}</h2>;

// ---------------------------------------------------------------- progress
export function ProgressTab({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const days = sel.dailyMinutes(db, childId, 14);
  const week = days.slice(-7).reduce((a, d) => a + d.minutes, 0);
  const wallet = sel.wallet(db, childId);
  const mastery = sel.mastery(db, childId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("parent.progress.week")} value={t("common.minutes", { n: week })} icon={<Clock className="size-6" />} tone="sky" />
        <Stat label={t("parent.progress.streak")} value={t("common.days", { n: sel.streak(db, childId) })} icon={<Flame className="size-6" />} tone="sun" />
        <Stat label={t("parent.progress.stars")} value={wallet.stars} icon={<Star className="size-6" />} tone="lavender" />
        <Stat label={t("parent.progress.coins")} value={wallet.coins} icon={<Coins className="size-6" />} tone="leaf" />
      </div>

      <Card>
        <H2>{t("parent.progress.minutes14")}</H2>
        <Bars data={days.map((d) => ({ label: d.date.slice(8), value: d.minutes }))} unit=" min" />
        <p className="mt-3 text-sm text-muted">{t("parent.progress.sessions", { n: sel.sessions(db, childId).length })}</p>
      </Card>

      <Card>
        <H2>{t("parent.progress.levels")}</H2>
        <p className="mb-4 text-sm text-muted">{t("parent.progress.levelsHint")}</p>
        <ul className="grid gap-3 md:grid-cols-2">
          {LEVELS.map((l, i) => {
            const m = mastery[i];
            const state = sel.levelState(db, childId, i);
            const muted = m.attempts === 0 && state !== "open";
            return (
              <li key={l.id} className={`flex items-center gap-3 rounded-2xl p-3 ${muted ? "border border-dashed border-line" : "bg-surface-2"}`}>
                <span className="text-2xl" aria-hidden>
                  {l.emoji}
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">
                      {l.n}. {l.title[lang]}
                    </span>
                    <Chip tone={state === "done" ? "leaf" : state === "open" ? "sky" : "gray"}>{t(`parent.level.${state}`)}</Chip>
                  </div>
                  {m.attempts > 0 && (
                    <div className="flex items-center gap-2">
                      <Meter value={m.pKnown} label={l.title[lang]} />
                      <span className="w-10 text-right text-xs font-bold text-ink-2">{Math.round(m.pKnown * 100)}%</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- what changed and why
export function ChangesTab({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const changes = sel.changes(db, childId);
  const profiles = sel.profiles(db, childId);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <Card className="h-fit">
        <H2>{t("parent.changes.now")}</H2>
        <p className="mb-4 text-sm text-muted">{t("parent.changes.observe")}</p>
        {(profiles.length ? profiles : [{ input: "touch" as const, params: sel.profile(db, childId) }]).map((p) => (
          <div key={p.input} className="mb-4 last:mb-0">
            <Chip tone="teal" className="mb-2">
              {t(`parent.input.${p.input}`)}
            </Chip>
            <ul className="space-y-1.5 text-sm text-ink-2">
              {profileLines(p.params, t).map((line) => (
                <li key={line} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden /> {line}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>
      <Card>
        <H2>{t("parent.changes.title")}</H2>
        {changes.length === 0 ? (
          <Empty>{t("parent.changes.none")}</Empty>
        ) : (
          <ol className="relative space-y-5 border-l-2 border-line pl-5">
            {changes.map((c) => (
              <li key={c.id} className="relative">
                <span className="absolute -left-[27px] top-1 size-3 rounded-full bg-teal ring-4 ring-surface" aria-hidden />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{fmtDate(c.at, lang)}</span>
                  <Chip tone="gray">{t(`adapt.param.${c.param}`)}</Chip>
                  <Chip tone="sky">{t(`parent.input.${c.input}`)}</Chip>
                </div>
                <p className="mt-1 font-semibold text-ink">{t(c.reasonKey)}</p>
                <p className="text-xs text-muted">
                  {c.from} → {c.to}
                </p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- AAC
const CARD_EMOJI = ["🐈", "🐕", "🧸", "🍎", "🍪", "🚗", "🏠", "👵", "👴", "🎵", "⚽", "🎠", "📺", "🌙", "🧃", "🎨"];

export function AacTab({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const stats = sel.aacStats(db, childId);
  const cards = sel.aacCustomCards(db, childId);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState(CARD_EMOJI[0]);
  const [category, setCategory] = useState("people");
  const add = useAction(api.aacAddCard);
  const del = useAction(api.aacDeleteCard);
  const canRecord = sel.hasConsent(db, childId, "voice_recording");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          <Stat label={t("parent.aac.sentences")} value={stats.sentences} tone="teal" />
          <Stat label={t("parent.aac.avgLen")} value={stats.avgLen} tone="lavender" />
        </div>
        <Card>
          <H2>{t("parent.aac.top")}</H2>
          {stats.top.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {stats.top.map(([id, n]) => (
                <li key={id} className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
                  <span className="font-semibold">{aacLabel(cards, id, lang)}</span>
                  <Chip tone="teal">×{n}</Chip>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <H2>{t("parent.aac.recent")}</H2>
          {stats.recent.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2 text-sm">
              {stats.recent.map((e) => (
                <li key={e.id} className="flex justify-between gap-3">
                  <span className="font-semibold">“{e.cardIds.map((c) => aacLabel(cards, c, lang)).join(" ")}”</span>
                  <span className="shrink-0 text-muted">{fmtDate(e.at, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="h-fit">
        <H2>{t("parent.aac.custom")}</H2>
        <p className="mb-4 text-sm text-muted">{t("parent.aac.customHint")}</p>
        <ul className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {cards.map((c) => (
            <li key={c.id} className="flex items-center gap-2 rounded-2xl border border-line p-2">
              <span className="text-2xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{c.label}</span>
              <button type="button" onClick={() => del.run(c.id)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-peach-soft hover:text-[#8f3a2c]" aria-label={`${t("common.delete")} ${c.label}`}>
                <Trash className="size-4" />
              </button>
            </li>
          ))}
          {cards.length === 0 && <li className="col-span-full text-sm text-muted">{t("common.none")}</li>}
        </ul>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!label.trim()) return;
            if ((await add.run(childId, { category, emoji, label: label.trim() })) !== undefined) setLabel("");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("parent.aac.label")}>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={24} required />
            </Field>
            <Field label={t("parent.aac.category")}>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {AAC_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label[lang]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="mb-2 text-sm font-bold">{t("parent.aac.picture")}</legend>
            <div className="grid grid-cols-8 gap-2">
              {CARD_EMOJI.map((e) => (
                <button key={e} type="button" aria-pressed={emoji === e} aria-label={e} onClick={() => setEmoji(e)} className={`grid aspect-square place-items-center rounded-xl text-xl ${emoji === e ? "bg-teal-soft ring-2 ring-teal" : "bg-surface-2"}`}>
                  {e}
                </button>
              ))}
            </div>
          </fieldset>
          {(add.error || del.error) && (
            <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">
              {add.error ?? del.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" pending={add.pending}>
              {t("parent.aac.addCard")}
            </Button>
            {canRecord && (
              <Button variant="outline" disabled>
                <Mic className="size-4" aria-hidden /> {t("parent.aac.record")}
              </Button>
            )}
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- sharing
export function SharingTab({ childId, goTab }: { childId: string; goTab: (t: Tab) => void }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const links = sel.careLinks(db, childId);
  const classes = sel.classesOfChild(db, childId);
  const notes = sel.notes(db, childId, { visibleToParent: true });
  const goals = sel.goals(db, childId);
  const canTherapist = sel.hasConsent(db, childId, "therapist_sharing");
  const canSchool = sel.hasConsent(db, childId, "school_sharing");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const invite = useAction(api.inviteCare);
  const revoke = useAction(api.revokeCare);
  const join = useAction(api.joinClass);
  const leave = useAction(api.leaveClass);
  const user = (id: string) => sel.user(db, id)?.name ?? "";

  const consentHint = (
    <p className="rounded-2xl bg-sun-soft p-3 text-sm text-[#7a5a0c]">
      {t("parent.sharing.needConsent")}{" "}
      <button type="button" className="font-extrabold underline" onClick={() => goTab("privacy")}>
        {t("parent.tab.privacy")}
      </button>
    </p>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-fit space-y-4">
        <H2>{t("parent.sharing.specialists")}</H2>
        <p className="text-sm text-muted">{t("parent.sharing.specialistsHint")}</p>
        <ul className="space-y-2">
          {links.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{l.professionalId ? user(l.professionalId) : l.email}</p>
                <p className="text-xs text-muted">
                  {l.email} · {fmtDate(l.createdAt, lang)}
                  {l.status === "invited" && ` · ${t("parent.sharing.code")}: `}
                  {l.status === "invited" && <span className="font-mono font-bold text-ink">{l.code}</span>}
                </p>
              </div>
              <Chip tone={l.status === "active" ? "leaf" : "sun"}>{t(`parent.sharing.${l.status}`)}</Chip>
              <Button size="sm" variant="danger" onClick={() => setRevoking(l.id)}>
                {t("parent.sharing.revoke")}
              </Button>
            </li>
          ))}
          {links.length === 0 && <li className="text-sm text-muted">{t("common.none")}</li>}
        </ul>
        {!canTherapist ? (
          consentHint
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const link = await invite.run(childId, email, "therapist");
              if (link) {
                setNewCode(link.code);
                setEmail("");
              }
            }}
          >
            <div className="min-w-48 flex-1">
              <Field label={t("parent.sharing.email")}>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </Field>
            </div>
            <Button type="submit" pending={invite.pending}>
              {t("parent.sharing.invite")}
            </Button>
          </form>
        )}
        {invite.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{invite.error}</p>}
        {newCode && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-teal bg-teal-soft/60 p-4">
            <p className="flex-1 text-sm text-ink-2">{t("parent.sharing.codeHint")}</p>
            <span className="font-mono text-2xl font-extrabold tracking-widest">{newCode}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard?.writeText(newCode);
                setCopied(true);
              }}
            >
              <Copy className="size-4" aria-hidden /> {t(copied ? "common.copied" : "common.copy")}
            </Button>
          </div>
        )}
      </Card>

      <Card className="h-fit space-y-4">
        <H2>{t("parent.sharing.classes")}</H2>
        <ul className="space-y-2">
          {classes.map((k) => (
            <li key={k.id} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{k.name}</p>
                <p className="text-xs text-muted">
                  {k.grade} · {user(k.teacherId)}
                </p>
              </div>
              <Button size="sm" variant="danger" pending={leave.pending} onClick={() => leave.run(childId, k.id)}>
                {t("parent.sharing.leave")}
              </Button>
            </li>
          ))}
          {classes.length === 0 && <li className="text-sm text-muted">{t("common.none")}</li>}
        </ul>
        {!canSchool ? (
          consentHint
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if ((await join.run(childId, code)) !== undefined) setCode("");
            }}
          >
            <div className="min-w-40 flex-1">
              <Field label={t("parent.sharing.classCode")}>
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={8} className="font-mono uppercase tracking-widest" required />
              </Field>
            </div>
            <Button type="submit" pending={join.pending}>
              {t("parent.sharing.join")}
            </Button>
          </form>
        )}
        {(join.error || leave.error) && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{join.error ?? leave.error}</p>}
      </Card>

      <Card>
        <H2>{t("parent.sharing.notes")}</H2>
        {notes.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li key={n.id} className="rounded-2xl bg-lavender-soft/60 p-3">
                <p className="text-sm">{n.text}</p>
                <p className="mt-1 text-xs text-muted">
                  {user(n.authorId)} · {fmtDate(n.createdAt, lang)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <H2>{t("parent.sharing.goals")}</H2>
        {goals.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => (
              <li key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 text-sm">
                <span className={`grid size-6 shrink-0 place-items-center rounded-full ${g.done ? "bg-teal text-white" : "border-2 border-line"}`} aria-label={t(g.done ? "parent.sharing.goalDone" : "parent.sharing.goalOpen")}>
                  {g.done && <Check className="size-4" />}
                </span>
                <span className={g.done ? "text-muted" : "font-semibold"}>{g.text}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!revoking} onClose={() => setRevoking(null)} title={t("parent.sharing.revokeTitle")}>
        <p className="mb-5 text-ink-2">{t("parent.sharing.revokeText")}</p>
        {revoke.error && <p role="alert" className="mb-3 text-sm font-semibold text-[#8f3a2c]">{revoke.error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRevoking(null)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            pending={revoke.pending}
            onClick={async () => {
              if (revoking && (await revoke.run(revoking)) !== undefined) setRevoking(null);
            }}
          >
            {t("parent.sharing.revoke")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------------------------------------------------------------- settings
export function SettingsTab({ child }: { child: Child }) {
  const t = useT();
  const [name, setName] = useState(child.name);
  const [birthYear, setBirthYear] = useState(child.birthYear);
  const [learningLang, setLearningLang] = useState<Lang>(child.learningLang);
  const [uiLang, setUiLang] = useState<Lang>(child.uiLang);
  const [avatar, setAvatar] = useState(child.avatar);
  const [access, setAccess] = useState<AccessMode>(child.access);
  const [saved, setSaved] = useState(false);
  const save = useAction(api.updateChild);

  return (
    <Card className="max-w-2xl">
      <form
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaved(false);
          if ((await save.run(child.id, { name: name.trim(), birthYear, learningLang, uiLang, avatar, access })) !== undefined) setSaved(true);
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={t("parent.field.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={30} required />
          </Field>
          <Field label={t("parent.field.birthYear")}>
            <Select value={birthYear} onChange={(e) => setBirthYear(Number(e.target.value))}>
              {BIRTH_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("parent.field.learningLang")} hint={t("parent.field.learningLangHint")}>
            <Select value={learningLang} onChange={(e) => setLearningLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {t(`lang.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("parent.field.uiLang")} hint={t("parent.field.uiLangHint")}>
            <Select value={uiLang} onChange={(e) => setUiLang(e.target.value as Lang)}>
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {t(`lang.${l}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <AccessPicker value={access} onChange={setAccess} />
        <fieldset>
          <legend className="mb-3 text-sm font-bold">{t("parent.field.avatar")}</legend>
          <AvatarGrid value={avatar} onChange={setAvatar} />
        </fieldset>
        {save.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{save.error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" pending={save.pending}>
            {t("common.save")}
          </Button>
          {saved && (
            <span role="status" className="text-sm font-bold text-teal">
              {t("parent.saved")}
            </span>
          )}
        </div>
      </form>
    </Card>
  );
}

// ---------------------------------------------------------------- privacy
const OPTIONAL: ConsentScope[] = ["ai_processing", "voice_recording", "school_sharing", "therapist_sharing"];

export function PrivacyTab({ child }: { child: Child }) {
  const t = useT();
  const [lang] = useLang();
  const router = useRouter();
  const db = useDb();
  const consents = sel.consents(db, child.id);
  const [confirm, setConfirm] = useState(false);
  const [typed, setTyped] = useState("");
  const set = useAction(api.setConsent);
  const exp = useAction(api.exportChild);
  const del = useAction(api.deleteChild);
  const granted = (s: ConsentScope) => consents.find((c) => c.scope === s);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="h-fit space-y-4">
        <H2>{t("parent.privacy.consents")}</H2>
        <div className="rounded-2xl bg-surface-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">{t("consent.core")}</p>
            {granted("core") ? <Chip tone="leaf">{t("parent.privacy.on")}</Chip> : <Chip tone="sun">{t("parent.privacy.notGiven")}</Chip>}
          </div>
          {granted("core") ? (
            <p className="mt-2 text-xs text-muted">{t("parent.privacy.coreHint")}</p>
          ) : (
            // Never assumed: a profile without a consent record gets it only from this explicit step.
            <div className="mt-2 space-y-3">
              <p className="text-xs text-muted">{t("parent.privacy.coreMissing")}</p>
              <Button size="sm" pending={set.pending} onClick={() => set.run(child.id, "core", true)}>
                {t("parent.privacy.coreGive")}
              </Button>
            </div>
          )}
        </div>
        {OPTIONAL.map((s) => {
          const c = granted(s);
          return (
            <div key={s} className="flex items-start justify-between gap-3 rounded-2xl border border-line p-4">
              <div>
                <p className="text-sm font-semibold">{t(`consent.${s}`)}</p>
                {c && <p className="mt-1 text-xs text-muted">{t("parent.privacy.since", { date: fmtDate(c.grantedAt, lang), v: c.version })}</p>}
              </div>
              <Toggle checked={!!c} onChange={(v) => set.run(child.id, s, v)} label={t(`consent.${s}`)} />
            </div>
          );
        })}
        {set.error && <p role="alert" className="text-sm font-semibold text-[#8f3a2c]">{set.error}</p>}
        <p className="text-xs text-muted">{t("parent.privacy.withdrawHint")}</p>
      </Card>

      <div className="space-y-6">
        <Card className="space-y-3">
          <H2>{t("parent.privacy.export")}</H2>
          <p className="text-sm text-muted">{t("parent.privacy.exportHint")}</p>
          <Button
            variant="outline"
            pending={exp.pending}
            onClick={async () => {
              const data = await exp.run(child.id);
              if (data) download(`flexikeys-${child.name}.json`, data);
            }}
          >
            <Download className="size-4" aria-hidden /> {t("parent.privacy.download")}
          </Button>
        </Card>
        <Card className="space-y-3">
          <H2>{t("parent.privacy.delete")}</H2>
          <p className="text-sm text-muted">{t("parent.privacy.deleteHint")}</p>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            <Trash className="size-4" aria-hidden /> {t("parent.privacy.deleteBtn", { name: child.name })}
          </Button>
        </Card>
      </div>

      <Modal
        open={confirm}
        onClose={() => {
          setConfirm(false);
          setTyped("");
        }}
        title={t("parent.privacy.deleteTitle", { name: child.name })}
      >
        <p className="mb-4 text-ink-2">{t("parent.privacy.deleteConfirm", { name: child.name })}</p>
        <Field label={t("parent.privacy.typeName", { name: child.name })}>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus />
        </Field>
        {del.error && <p role="alert" className="mt-3 text-sm font-semibold text-[#8f3a2c]">{del.error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={typed.trim() !== child.name}
            pending={del.pending}
            onClick={async () => {
              if ((await del.run(child.id)) !== undefined) router.replace("/parent");
            }}
          >
            {t("common.delete")}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
