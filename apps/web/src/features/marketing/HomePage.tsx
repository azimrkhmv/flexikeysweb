"use client";

// Client-side registration of the marketing strings (a server-side import never reaches the browser).
import "@/messages/public";
import {
  Check, ChevronRight, CirclePlay, CircleX, Cloud, Download, EyeOff, Gamepad2, Hand, House, MapPin, Pointer, Power, School,
  ShieldCheck, Sparkles, Sprout, Stethoscope, Target, Timer, type LucideIcon,
} from "lucide-react";
import { Mascot } from "@/components/Mascot";
import { Chip, LinkButton, type Tone } from "@/components/ui";
import { Archetypes } from "@/features/marketing/archetypes";
import { SectionTitle } from "@/features/marketing/chrome";
import { useT } from "@/lib/i18n";
import type { MascotMood } from "@/lib/types";

const TONE_BG: Record<Tone, string> = {
  sky: "bg-sky-soft text-[#2f5d93]",
  leaf: "bg-leaf-soft text-[#2f6a37]",
  sun: "bg-sun-soft text-[#7a5a0c]",
  lavender: "bg-lavender-soft text-[#4f43a0]",
  teal: "bg-teal-soft text-[#1f6b63]",
  peach: "bg-peach-soft text-[#8f3a2c]",
  gray: "bg-surface-2 text-ink-2",
};

const section = "mx-auto max-w-6xl px-4 py-16 sm:py-20";

export function HomePage() {
  return (
    <>
      <Hero />
      <OurHero />
      <Principles />
      <HowItWorks />
      <section className={section} aria-labelledby="arch-title">
        <ArchetypesTitle />
        <Archetypes />
      </section>
      <Games />
      <Audiences />
      <Trust />
      <Closing />
    </>
  );
}

function Hero() {
  const t = useT();
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-12 pt-10 sm:pt-16 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <Chip tone="teal" className="text-sm">{t("mkt.hero.eyebrow")}</Chip>
        <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-6xl">{t("mkt.hero.title")}</h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">{t("mkt.hero.lead")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <LinkButton href="/signup" size="lg">{t("nav.signup")}</LinkButton>
          <LinkButton href="/demo" variant="soft" size="lg">
            <CirclePlay className="size-5" aria-hidden /> {t("mkt.hero.demo")}
          </LinkButton>
          <LinkButton href="/class" variant="outline" size="lg">
            <School className="size-5" aria-hidden /> {t("nav.class")}
          </LinkButton>
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold text-ink-2">
          {["mkt.hero.note1", "mkt.hero.note2", "mkt.hero.note3"].map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <Check className="size-4 text-teal" aria-hidden /> {t(k)}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative mx-auto w-full max-w-[520px]">
        <div
          className="relative aspect-[5/4] overflow-hidden rounded-fk-lg border border-line shadow-lift"
          style={{ background: "linear-gradient(160deg,#fdf6e3 0%,#eaf3fb 48%,#e3f2df 100%)" }}
        >
          <div className="absolute -right-10 -top-10 size-44 rounded-full bg-sun/40 blur-2xl" />
          <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full" viewBox="0 0 500 140" preserveAspectRatio="none" aria-hidden>
            <path d="M0 90 Q120 40 250 80 T500 70 V140 H0Z" fill="#d8edd2" />
            <path d="M0 112 Q150 82 300 110 T500 100 V140 H0Z" fill="#c6e3be" />
          </svg>
          <span aria-hidden className="absolute bottom-6 left-6 text-3xl">🌿</span>
          <span aria-hidden className="absolute bottom-10 right-8 text-2xl">🌷</span>
          <span aria-hidden className="absolute bottom-4 right-24 text-xl">🌼</span>
          <div aria-hidden className="absolute inset-0 grid place-items-center pt-8">
            <div className="scale-[0.72] sm:scale-100">
              <Mascot mood="wave" size={250} />
            </div>
          </div>
          <p className="absolute left-4 top-5 max-w-[60%] rounded-2xl rounded-bl-sm bg-surface px-4 py-3 text-sm font-bold text-ink shadow-soft sm:left-6 sm:top-6">
            {t("mkt.hero.bubble")}
          </p>
        </div>
        <div className="absolute -bottom-5 left-3 flex items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 text-sm font-bold text-ink shadow-lift sm:left-6">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-sky-soft">⌨️</span>
          {t("mkt.hero.chip")}
        </div>
        <div className="absolute -right-2 top-[42%] hidden items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 text-sm font-bold text-ink shadow-lift sm:flex">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-sun-soft">⭐</span>
          {t("mkt.hero.stars")}
        </div>
      </div>
    </section>
  );
}

const MOODS: MascotMood[] = ["calm", "happy", "curious", "sleepy"];

function OurHero() {
  const t = useT();
  return (
    <section className={section} aria-labelledby="hero-title">
      <div className="grid gap-8 rounded-fk-lg border border-line bg-surface p-6 shadow-soft sm:p-10 lg:grid-cols-[1fr_1.5fr] lg:items-center">
        <div>
          <h2 id="hero-title" className="text-3xl font-extrabold text-ink sm:text-4xl">{t("mkt.mascot.title")}</h2>
          <p className="mt-3 text-lg leading-relaxed text-ink-2">{t("mkt.mascot.lead")}</p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MOODS.map((m) => (
            <li key={m} className="flex flex-col items-center rounded-fk bg-surface-2 px-2 pb-4 pt-3 text-center">
              <div aria-hidden>
                <Mascot mood={m} size={104} float={false} />
              </div>
              <span className="mt-1 font-extrabold text-ink">{t(`mkt.mood.${m}`)}</span>
              <span className="text-xs text-muted">{t(`mkt.mood.${m}_hint`)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const PRINCIPLES: [string, LucideIcon, Tone][] = [
  ["timers", Timer, "sky"],
  ["fail", CircleX, "lavender"],
  ["input", Pointer, "teal"],
  ["targets", Target, "leaf"],
  ["gestures", Hand, "sun"],
];

function Principles() {
  const t = useT();
  return (
    <section className={section} aria-labelledby="principles-title">
      <SectionTitle id="principles-title" title={t("mkt.principles.title")} lead={t("mkt.principles.lead")} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {PRINCIPLES.map(([key, Icon, tone]) => (
          <li key={key} className="rounded-fk border border-line bg-surface p-5 shadow-soft">
            <span className={`grid size-12 place-items-center rounded-full ${TONE_BG[tone]}`}>
              <Icon className="size-6" aria-hidden />
            </span>
            <h3 className="mt-4 font-extrabold text-ink">{t(`mkt.p.${key}.t`)}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{t(`mkt.p.${key}.d`)}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS: [LucideIcon, Tone][] = [
  [Power, "lavender"],
  [Gamepad2, "leaf"],
  [Sprout, "teal"],
  [Cloud, "sky"],
];

function HowItWorks() {
  const t = useT();
  return (
    <section className="border-y border-line bg-surface/60" aria-labelledby="how-title">
      <div className={section}>
        <SectionTitle id="how-title" title={t("mkt.how.title")} center />
        <ol className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {STEPS.map(([Icon, tone], i) => (
            <li key={i} className="relative flex flex-col items-center text-center">
              <span className={`grid size-20 place-items-center rounded-full ring-8 ring-surface ${TONE_BG[tone]}`}>
                <Icon className="size-8" aria-hidden />
              </span>
              {i < 3 && <ChevronRight aria-hidden className="absolute -right-5 top-7 hidden size-6 text-muted sm:block" />}
              <span className="mt-4 text-lg font-extrabold text-ink">{t(`mkt.how.s${i + 1}`)}</span>
              <span className="text-sm text-muted">{t(`mkt.how.s${i + 1}d`)}</span>
            </li>
          ))}
        </ol>
        <p className="mx-auto mt-10 flex max-w-xl items-center justify-center gap-2 text-center font-bold text-ink-2">
          <Sparkles className="size-5 shrink-0 text-teal" aria-hidden /> {t("mkt.how.adaptive")}
        </p>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-fk-lg border border-line bg-surface p-6 shadow-soft sm:p-8">
            <h3 className="text-2xl font-extrabold text-ink">{t("mkt.how.inv.title")}</h3>
            <p className="mt-3 leading-relaxed text-ink-2">{t("mkt.how.inv.lead")}</p>
            <ul className="mt-5 space-y-3">
              {["a1", "a2", "a3", "a4"].map((k) => (
                <li key={k} className="flex gap-3 font-semibold text-ink">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leaf-soft">
                    <Check className="size-4 text-[#2f6a37]" aria-hidden />
                  </span>
                  {t(`mkt.how.${k}`)}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted">{t("mkt.how.parents")}</p>
          </div>

          <div className="relative overflow-hidden rounded-fk-lg border border-line p-6 shadow-soft sm:p-8" style={{ background: "linear-gradient(160deg,#ffffff 0%,#eef4fb 100%)" }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xl font-extrabold text-ink">{t("mkt.how.feed")}</h3>
              <Chip tone="lavender">{t("mkt.how.feedFor")}</Chip>
            </div>
            <ul className="mt-5 space-y-3">
              {(
                [
                  ["keyScale", "adapt.keyScale.more", "sky"],
                  ["dwellMs", "adapt.dwellMs.more", "teal"],
                  ["hintLevel", "adapt.hintLevel.less", "leaf"],
                ] as const
              ).map(([param, key, tone]) => (
                <li key={key} className="rounded-2xl border border-line bg-surface p-4">
                  <Chip tone={tone}>{t(`adapt.param.${param}`)}</Chip>
                  <p className="mt-2 text-sm font-semibold text-ink">{t(key)}</p>
                </li>
              ))}
            </ul>
            <div aria-hidden className="pointer-events-none absolute -bottom-4 -right-4 opacity-90">
              <Mascot mood="calm" size={110} float={false} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ArchetypesTitle() {
  const t = useT();
  return (
    <SectionTitle id="arch-title" title={t("mkt.arch.title")} lead={t("mkt.arch.lead")} />
  );
}

const GAMES: { n: number; key: string; art: string; tone: Tone; skill: string; level: string; night?: boolean }[] = [
  { n: 1, key: "voice", art: "🗣️💬", tone: "sky", skill: "communication", level: "start" },
  { n: 7, key: "animals", art: "🐱🐶🐦", tone: "leaf", skill: "world", level: "basic" },
  { n: 11, key: "light", art: "✨⭐✨", tone: "lavender", skill: "memory", level: "basic", night: true },
  { n: 12, key: "missing", art: "🍎🧸❔", tone: "peach", skill: "memory", level: "medium" },
  { n: 15, key: "sort", art: "🍌🚗🍎", tone: "sun", skill: "flexibility", level: "medium" },
  { n: 18, key: "task", art: "📋☁️", tone: "teal", skill: "specialist", level: "individual" },
  { n: 3, key: "keys", art: "⌨️🔤", tone: "sky", skill: "typing", level: "basic" },
  { n: 5, key: "colors", art: "🟡🔵🟢", tone: "lavender", skill: "attention", level: "basic" },
];

function Games() {
  const t = useT();
  return (
    <section className={section} aria-labelledby="games-title">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <h2 id="games-title" className="text-3xl font-extrabold text-ink sm:text-4xl">{t("mkt.games.title")}</h2>
        <Chip tone="gray" className="text-sm">{t("mkt.games.count", { n: GAMES.length })}</Chip>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {GAMES.map((g) => (
          <li key={g.key} className="flex flex-col rounded-fk border border-line bg-surface p-4 shadow-soft">
            <h3 className="font-extrabold text-ink">
              <span className="text-muted">{g.n}.</span> {t(`mkt.g.${g.key}.t`)}
            </h3>
            <div
              aria-hidden
              className={`mt-3 grid h-24 place-items-center rounded-2xl text-4xl tracking-widest ${g.night ? "" : TONE_BG[g.tone]}`}
              style={g.night ? { background: "linear-gradient(135deg,#3b4a7c,#6070a8)" } : undefined}
            >
              <span className={g.night ? "fk-glow" : ""}>{g.art}</span>
            </div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">{t(`mkt.g.${g.key}.d`)}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip tone={g.tone}>{t(`mkt.chip.${g.skill}`)}</Chip>
              <Chip tone={g.level === "individual" ? "gray" : g.level === "start" ? "sun" : "peach"}>{t(`mkt.chip.${g.level}`)}</Chip>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const AUDIENCES: { id: string; icon: LucideIcon; tone: Tone }[] = [
  { id: "families", icon: House, tone: "peach" },
  { id: "schools", icon: School, tone: "sky" },
  { id: "therapists", icon: Stethoscope, tone: "lavender" },
];

function Audiences() {
  const t = useT();
  return (
    <section className={section} aria-labelledby="who-title">
      <SectionTitle id="who-title" title={t("mkt.who.title")} center />
      <div className="grid gap-6 lg:grid-cols-3">
        {AUDIENCES.map(({ id, icon: Icon, tone }) => (
          <article key={id} id={id} className="flex scroll-mt-24 flex-col rounded-fk-lg border border-line bg-surface p-6 shadow-soft sm:p-8">
            <span className={`grid size-14 place-items-center rounded-2xl ${TONE_BG[tone]}`}>
              <Icon className="size-7" aria-hidden />
            </span>
            <h3 className="mt-5 text-2xl font-extrabold text-ink">{t(`mkt.${id}.title`)}</h3>
            <p className="mt-2 text-ink-2">{t(`mkt.${id}.lead`)}</p>
            <ul className="mt-5 flex-1 space-y-3">
              {["b1", "b2", "b3", "b4"].map((b) => (
                <li key={b} className="flex gap-3 text-sm font-semibold text-ink">
                  <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                  {t(`mkt.${id}.${b}`)}
                </li>
              ))}
            </ul>
            <LinkButton href="/signup" variant="soft" className="mt-6 self-start">
              {t(`mkt.${id}.cta`)}
            </LinkButton>
          </article>
        ))}
      </div>
    </section>
  );
}

const TRUST: LucideIcon[] = [MapPin, EyeOff, ShieldCheck, Download];

function Trust() {
  const t = useT();
  return (
    <section className={section} aria-labelledby="trust-title">
      <div className="rounded-fk-lg bg-teal-soft/60 p-6 sm:p-10">
        <SectionTitle id="trust-title" title={t("mkt.trust.title")} lead={t("mkt.trust.lead")} />
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((Icon, i) => (
            <li key={i} className="rounded-fk bg-surface p-5 shadow-soft">
              <Icon className="size-6 text-teal" aria-hidden />
              <h3 className="mt-3 font-extrabold text-ink">{t(`mkt.trust.t${i + 1}`)}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{t(`mkt.trust.d${i + 1}`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Closing() {
  const t = useT();
  return (
    <section className="mx-auto grid max-w-6xl gap-6 px-4 pt-4 lg:grid-cols-2">
      <div className="flex flex-col rounded-fk-lg border border-line bg-sun-soft p-6 sm:p-10">
        <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">{t("mkt.teaser.title")}</h2>
        <p className="mt-3 flex-1 text-ink-2">{t("mkt.teaser.lead")}</p>
        <LinkButton href="/pricing" variant="outline" className="mt-6 self-start">
          {t("mkt.teaser.cta")}
        </LinkButton>
      </div>
      <div className="relative overflow-hidden rounded-fk-lg border border-line bg-lavender-soft p-6 sm:p-10">
        <div className="relative z-10 max-w-sm">
          <h2 className="text-2xl font-extrabold text-ink sm:text-3xl">{t("mkt.cta.title")}</h2>
          <p className="mt-3 text-ink-2">{t("mkt.cta.lead")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/signup">{t("nav.signup")}</LinkButton>
            <LinkButton href="/demo" variant="outline">{t("mkt.hero.demo")}</LinkButton>
          </div>
        </div>
        <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 opacity-60 sm:opacity-100">
          <Mascot mood="happy" size={170} />
        </div>
      </div>
    </section>
  );
}
