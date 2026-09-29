"use client";

import { useState, type ComponentType, type ReactNode } from "react";
import { Heart } from "lucide-react";
import { LangSwitch, Logo } from "@/components/brand";
import { ItemArt } from "@/components/ItemArt";
import { Mascot } from "@/components/Mascot";
import { Bars, Button, Card, Checkbox, Chip, Field, Input, Meter, Stat, Toggle, type Tone } from "@/components/ui";
import { LEVELS } from "@/content/levels";
import { AdaptiveKeyboard, tokenize } from "@/features/activities/keyboard";
import { ENGINES, type EngineProps } from "@/features/activities/registry";
import { DEMO_PLAY, PlayContext, type PlayCtx } from "@/features/play/context";
import { DEFAULT_PROFILE } from "@/lib/adaptive";
import { useLang } from "@/lib/i18n";
import type { Activity, AdaptiveProfile, MascotMood } from "@/lib/types";

// Coded design gallery (PRD §11.4 deliverable). Labels are English on purpose — it is a dev page.

const TOKENS = ["bg", "surface", "surface-2", "line", "ink", "ink-2", "muted", "primary", "primary-soft", "sky", "sky-soft", "leaf", "leaf-soft", "sun", "sun-soft", "lavender", "lavender-soft", "teal", "teal-soft", "peach", "peach-soft"];
const MOODS: MascotMood[] = ["calm", "happy", "curious", "sleepy", "wave", "thinking", "celebrate"];
const TONES: Tone[] = ["sky", "leaf", "sun", "lavender", "teal", "peach", "gray"];
const PRESETS: [string, Partial<AdaptiveProfile>][] = [
  ["Default profile", {}],
  ["Bigger keys · spacing 16 · hold 300 ms", { keyScale: 1.4, spacing: 16, dwellMs: 300 }],
  ["Reduced set (hint level 2)", { hintLevel: 2 }],
];

const quiet: PlayCtx = { ...DEMO_PLAY, say: () => {}, react: () => {} };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-extrabold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignPage() {
  const [lang] = useLang();
  const [check, setCheck] = useState(true);
  const [on, setOn] = useState(true);
  const ctx = { ...quiet, learnLang: lang, uiLang: lang };
  const firstOfKind = new Map<string, Activity>();
  LEVELS.forEach((l) => l.activities.forEach((a) => !firstOfKind.has(a.kind) && firstOfKind.set(a.kind, a)));

  return (
    <div className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <LangSwitch compact />
      </header>
      <main className="mx-auto max-w-6xl space-y-12 px-4 pb-20">
        <h1 className="text-3xl font-extrabold text-ink">Design system</h1>

        <Section title="Color tokens (globals.css)">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {TOKENS.map((k) => (
              <div key={k} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="h-14" style={{ background: `var(--fk-${k})` }} />
                <div className="px-2 py-1.5 text-xs font-bold text-ink-2">--fk-{k}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted">Calm, warm, friendly. No harsh colors, no red, no black.</p>
        </Section>

        <Section title="Typography — Nunito">
          <div className="space-y-2">
            <p className="text-4xl font-extrabold">Heading 36 / 800</p>
            <p className="text-2xl font-extrabold">Heading 24 / 800</p>
            <p className="text-lg font-bold">Subtitle 18 / 700</p>
            <p className="text-base">Body 16 / 400 — Oʻzbekcha · Русский · English</p>
            <p className="text-sm text-muted">Caption 14 / muted</p>
          </div>
        </Section>

        <Section title="Atoms">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="soft">Soft</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button pending>Pending</Button>
            <Button size="lg">Large</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <Chip key={tone} tone={tone}>
                {tone}
              </Chip>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-4">
              <Field label="Email" hint="We never share it">
                <Input placeholder="parent@example.uz" />
              </Field>
              <Field label="Class code" error="We couldn't find this class code.">
                <Input defaultValue="ABC123" />
              </Field>
              <Checkbox checked={check} onChange={setCheck} label="Core consent" description="Stored on servers in Uzbekistan" />
              <div className="flex items-center gap-3">
                <Toggle checked={on} onChange={setOn} label="Toggle" /> Toggle
              </div>
            </Card>
            <div className="space-y-4">
              <Stat label="Minutes this week" value="74" icon={<Heart className="size-6" />} tone="peach" />
              <Card>
                <Bars data={["M", "T", "W", "T", "F", "S", "S"].map((label, i) => ({ label, value: [8, 12, 0, 15, 9, 18, 6][i] }))} unit=" min" />
              </Card>
              <Card className="space-y-2">
                <Meter value={0.72} />
                <Meter value={0.35} tone="var(--fk-sky)" />
              </Card>
            </div>
          </div>
        </Section>

        <Section title="Mascot moods">
          <div className="flex flex-wrap gap-6">
            {MOODS.map((m) => (
              <figure key={m} className="flex flex-col items-center gap-1">
                <Mascot mood={m} size={130} float={false} />
                <figcaption className="text-sm font-bold text-ink-2">{m}</figcaption>
              </figure>
            ))}
            <figure className="flex flex-col items-center gap-1">
              <Mascot mood="happy" size={130} hat="👑" tint="#dcf3e6" float={false} />
              <figcaption className="text-sm font-bold text-ink-2">shop: hat + tint</figcaption>
            </figure>
          </div>
        </Section>

        <Section title="Content art (ItemArt)">
          <div className="flex flex-wrap items-center gap-4">
            {["apple", "cat", "bus", "c_blue", "c_yellow", "s_star", "s_heart", "s_triangle", "n_3", "n_7"].map((id) => (
              <Card key={id} className="grid size-28 place-items-center p-2">
                <ItemArt id={id} size={72} />
              </Card>
            ))}
          </div>
        </Section>

        <Section title="Adaptive keyboard presets">
          {PRESETS.map(([label, p]) => (
            <div key={label} className="space-y-2">
              <p className="font-bold text-ink-2">{label}</p>
              <PlayContext.Provider value={{ ...ctx, profile: { ...DEFAULT_PROFILE, ...p } }}>
                <AdaptiveKeyboard lang={lang} needed={tokenize(lang === "ru" ? "кот" : lang === "uz" ? "koʻz" : "cat", lang)} hint={p.hintLevel ? tokenize(lang === "ru" ? "к" : "k", lang)[0] : null} onKey={() => {}} />
              </PlayContext.Provider>
            </div>
          ))}
        </Section>

        <Section title="Activity engines (archetypes A–E)">
          <div className="grid gap-8 lg:grid-cols-2">
            {[...firstOfKind.entries()].map(([kind, activity]) => {
              const Engine = ENGINES[activity.kind] as ComponentType<EngineProps>;
              return (
                <div key={kind} className="space-y-2">
                  <p className="font-bold text-ink-2">
                    {kind} <span className="text-muted">· {activity.id}</span>
                  </p>
                  <PlayContext.Provider value={ctx}>
                    <Engine key={lang} activity={activity} onDone={() => {}} />
                  </PlayContext.Provider>
                </div>
              );
            })}
          </div>
        </Section>
      </main>
    </div>
  );
}
