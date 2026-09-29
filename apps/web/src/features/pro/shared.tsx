"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { LEVEL_BY_ID, LEVELS } from "@/content/levels";
import { Bars, Card, Empty, Meter } from "@/components/ui";
import { sel, useDb, type DB } from "@/lib/api";
import { useLang, useT } from "@/lib/i18n";

// Shared read-only building blocks for teacher / therapist / admin views.

/** Signed-in professional. Pages render inside RequireRole, so `me` is always present. */
export function useMe() {
  const db = useDb();
  return { db, me: sel.me(db)! };
}

/** Render-safe "now" (captured once per mount; React 19 forbids Date.now() during render). */
export function useNow() {
  const [now] = useState(() => Date.now());
  return now;
}

export function avgMastery(db: DB, childId: string) {
  const m = sel.mastery(db, childId).filter((x) => x.attempts > 0);
  return m.length ? m.reduce((a, x) => a + x.pKnown, 0) / m.length : 0;
}

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export function fmtDate(iso: string | undefined, lang: string, time = false) {
  if (!iso) return "—";
  const d = new Date(iso);
  return time ? d.toLocaleString(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(lang, { day: "numeric", month: "short" });
}

/** Pastel mastery scale — no red anywhere. */
export const HEAT: { min: number; bg: string; key: string }[] = [
  { min: 0.8, bg: "var(--fk-leaf)", key: "pro.heat.strong" },
  { min: 0.6, bg: "var(--fk-leaf-soft)", key: "pro.heat.confident" },
  { min: 0.4, bg: "var(--fk-sky-soft)", key: "pro.heat.growing" },
  { min: 0, bg: "var(--fk-sun-soft)", key: "pro.heat.starting" },
];
export const heatBg = (p: number, attempts: number) => (attempts ? HEAT.find((h) => p >= h.min)!.bg : "var(--fk-surface-2)");

export function HeatLegend() {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-3 text-xs text-ink-2">
      {[...HEAT].reverse().map((h) => (
        <span key={h.key} className="inline-flex items-center gap-1.5">
          <span className="size-3.5 rounded" style={{ background: h.bg }} />
          {t(h.key)}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-3.5 rounded border border-line" style={{ background: "var(--fk-surface-2)" }} />
        {t("pro.heat.none")}
      </span>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-lg font-extrabold text-ink">{children}</h2>;
}

export function MasteryList({ childId }: { childId: string }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const rows = sel.mastery(db, childId).filter((m) => m.attempts > 0);
  return (
    <Card>
      <SectionTitle>{t("pro.progress")}</SectionTitle>
      {rows.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-3">
          {rows.map((m) => {
            const level = LEVEL_BY_ID[m.skill];
            return (
              <li key={m.skill}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="font-semibold text-ink">
                    {level.emoji} {level.title[lang]}
                  </span>
                  <span className="text-muted">{pct(m.pKnown)}</span>
                </div>
                <Meter value={m.pKnown} label={level.title[lang]} />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function MinutesChart({ childId, days = 14 }: { childId: string; days?: number }) {
  const t = useT();
  const db = useDb();
  const data = sel.dailyMinutes(db, childId, days);
  return (
    <Card>
      <SectionTitle>{t("pro.minutes", { n: days })}</SectionTitle>
      <Bars data={data.map((d) => ({ label: d.date.slice(8), value: d.minutes }))} unit=" min" />
      <p className="mt-2 text-sm text-muted">{t("pro.minutesTotal", { n: data.reduce((a, d) => a + d.minutes, 0) })}</p>
    </Card>
  );
}

export function AdaptationLog({ childId, limit = 8 }: { childId: string; limit?: number }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const list = sel.changes(db, childId).slice(0, limit);
  return (
    <Card>
      <SectionTitle>{t("pro.adaptations")}</SectionTitle>
      <p className="mb-3 text-sm text-muted">{t("pro.adaptationsNote")}</p>
      {list.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((c) => (
            <li key={c.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-bold text-ink">{t(`adapt.param.${c.param}`)}</span>
                <span className="text-xs text-muted">
                  {c.from} → {c.to} · {fmtDate(c.at, lang)}
                </span>
              </div>
              <p className="text-sm text-ink-2">{t(c.reasonKey)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function SessionsList({ childId, limit = 8 }: { childId: string; limit?: number }) {
  const t = useT();
  const [lang] = useLang();
  const db = useDb();
  const list = sel.sessions(db, childId).slice(0, limit);
  return (
    <Card>
      <SectionTitle>{t("pro.sessions")}</SectionTitle>
      {list.length === 0 ? (
        <Empty />
      ) : (
        <ul className="divide-y divide-line text-sm">
          {list.map((s) => (
            <li key={s.id} className="flex justify-between gap-2 py-2.5">
              <span className="text-ink">{fmtDate(s.startedAt, lang, true)}</span>
              <span className="text-muted">
                {s.minutes ? t("common.minutes", { n: s.minutes }) : "…"} · {t("pro.activitiesN", { n: s.activities })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function LevelLabel({ levelId }: { levelId: string }) {
  const [lang] = useLang();
  const l = LEVEL_BY_ID[levelId];
  return l ? (
    <span>
      {l.emoji} {l.n}. {l.title[lang]}
    </span>
  ) : null;
}

export function LevelOptions() {
  const [lang] = useLang();
  return (
    <>
      {LEVELS.map((l) => (
        <option key={l.id} value={l.id}>
          {l.n}. {l.title[lang]}
        </option>
      ))}
    </>
  );
}

export function NotFound({ back }: { back: string }) {
  const t = useT();
  return (
    <Card className="mx-auto max-w-md text-center">
      <p className="mb-4 text-ink-2">{t("err.not_found")}</p>
      <Link href={back} className="font-bold text-primary">
        {t("common.back")}
      </Link>
    </Card>
  );
}

export function QrCode({ text, label, className = "" }: { text: string; label: string; className?: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(text, { width: 600, margin: 1, color: { dark: "#27406b", light: "#ffffff" } }).then((s) => live && setSrc(s));
    return () => {
      live = false;
    };
  }, [text]);
  // eslint-disable-next-line @next/next/no-img-element -- local data URL, no optimization needed
  return src ? <img src={src} alt={label} className={`h-auto w-full ${className}`} /> : <div className={`aspect-square w-full ${className}`} />;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "border-b border-line px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-muted";
export const td = "border-b border-line px-3 py-3 align-middle text-ink";
