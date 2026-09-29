"use client";

import type { ReactNode } from "react";
import { Pause } from "lucide-react";
import { ItemArt } from "@/components/ItemArt";
import { Mascot } from "@/components/Mascot";
import { useT } from "@/lib/i18n";

// Illustrated mini-screens for the five activity archetypes (design board row 2). Decorative only:
// the card heading carries the meaning, the mock screen is aria-hidden.

function Screen({ task, button, step, children }: { task: string; button: string; step: number; children: ReactNode }) {
  return (
    <div aria-hidden className="mt-4 flex flex-1 flex-col rounded-fk border border-line bg-surface-2/70 p-3">
      <div className="flex items-center justify-between">
        <span className="size-3 rounded-full bg-leaf" />
        <span className="flex gap-1">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} className={`size-1.5 rounded-full ${i < step ? "bg-teal" : "bg-line"}`} />
          ))}
        </span>
        <span className="grid size-6 place-items-center rounded-full bg-surface text-ink-2">
          <Pause className="size-3" />
        </span>
      </div>
      <p className="mt-3 text-center text-sm font-extrabold text-ink">{task}</p>
      <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2">{children}</div>
      <div className="mt-3 flex items-end justify-between">
        <Mascot size={52} float={false} />
        <span className="rounded-full bg-sky-soft px-4 py-1.5 text-xs font-bold text-[#2f5d93]">{button}</span>
      </div>
    </div>
  );
}

const tile = "grid place-items-center rounded-2xl bg-surface shadow-soft";
const COLORS = ["#f5d272", "#a9c8ec", "#8cc98f", "#b3a8e8"];

export function Archetypes() {
  const t = useT();
  const cards: { x: string; key: string; button: string; step: number; art: ReactNode }[] = [
    {
      x: "A", key: "a", button: "mkt.arch.next", step: 2,
      art: (
        <>
          <span className={`${tile} size-16`}><ItemArt id="apple" size={42} /></span>
          <span className="grid grid-cols-2 gap-2">
            {["apple", "banana", "teddy", "car"].map((id, i) => (
              <span key={id} className={`${tile} size-14 ${i === 0 ? "ring-3 ring-teal" : ""}`}><ItemArt id={id} size={32} /></span>
            ))}
          </span>
        </>
      ),
    },
    {
      x: "B", key: "b", button: "mkt.arch.done", step: 3,
      art: (
        <>
          <span className="flex gap-1.5 rounded-2xl bg-surface p-2 shadow-soft">
            {COLORS.map((c) => <span key={c} className="size-8 rounded-lg" style={{ background: c }} />)}
          </span>
          <span className="text-[11px] font-bold text-muted">{t("mkt.arch.b.task2")}</span>
          <span className="flex gap-1.5">
            {COLORS.map((c, i) => (
              <span key={c} className={`${tile} size-10 ${i === 0 ? "ring-3 ring-teal" : ""}`}>
                <span className="size-6 rounded-md" style={{ background: c }} />
              </span>
            ))}
          </span>
        </>
      ),
    },
    {
      x: "C", key: "c", button: "mkt.arch.next", step: 3,
      art: (
        <svg viewBox="0 0 160 120" className="w-full rounded-2xl bg-leaf-soft">
          <path d="M22 96 C52 96 38 30 80 40 S122 102 140 30" fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" />
          <path d="M22 96 C52 96 38 30 80 40 S122 102 140 30" fill="none" stroke="#8ea3c7" strokeWidth="3" strokeDasharray="6 7" strokeLinecap="round" />
          <circle cx="22" cy="96" r="8" fill="#7fbf85" stroke="#fff" strokeWidth="3" />
          <circle cx="140" cy="30" r="8" fill="#f5d272" stroke="#fff" strokeWidth="3" />
          <text x="98" y="114" fontSize="14">🌼</text>
          <text x="6" y="24" fontSize="14">🌿</text>
          <text x="128" y="112" fontSize="12">🌸</text>
        </svg>
      ),
    },
    {
      x: "D", key: "d", button: "mkt.arch.next", step: 4,
      art: (
        <>
          <span className="grid h-20 w-full place-items-center rounded-2xl bg-sky-soft text-4xl">🌱💧</span>
          <span className="grid w-full grid-cols-2 gap-2">
            <span className={`${tile} gap-0.5 py-2 ring-3 ring-teal`}>
              <span className="text-2xl">☀️</span>
              <span className="text-[11px] font-bold text-ink">{t("mkt.arch.sun")}</span>
            </span>
            <span className={`${tile} gap-0.5 py-2`}>
              <span className="text-2xl">🌧️</span>
              <span className="text-[11px] font-bold text-ink">{t("mkt.arch.rain")}</span>
            </span>
          </span>
        </>
      ),
    },
    {
      x: "E", key: "e", button: "mkt.arch.done", step: 5,
      art: (
        <span className="flex items-center gap-2">
          <span className="grid grid-cols-2 gap-0.5 rounded-xl bg-surface p-1 shadow-soft">
            {[0, 1, 2, 3].map((i) => (
              <Piece key={i} i={i} empty={i === 3} />
            ))}
          </span>
          <span className="rounded-xl bg-surface p-1 ring-3 ring-teal">
            <Piece i={3} />
          </span>
        </span>
      ),
    },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <li key={c.x} className="flex flex-col rounded-fk-lg border border-line bg-surface p-4 shadow-soft">
          <h3 className="text-[15px] font-extrabold leading-snug text-ink">
            {t("mkt.arch.label", { x: c.x })} — {t(`mkt.arch.${c.key}.name`)}
          </h3>
          <p className="mt-1 text-sm text-muted">{t("mkt.arch.example", { name: t(`mkt.arch.${c.key}.ex`) })}</p>
          <Screen task={t(`mkt.arch.${c.key}.task`)} button={t(c.button)} step={c.step}>
            {c.art}
          </Screen>
        </li>
      ))}
    </ul>
  );
}

/** One quarter of a 96px emoji picture, clipped into a 48px cell. */
function Piece({ i, empty }: { i: number; empty?: boolean }) {
  return (
    <span className={`relative block size-12 overflow-hidden rounded-md ${empty ? "border-2 border-dashed border-line bg-surface-2" : "bg-peach-soft"}`}>
      {!empty && (
        <span className="absolute grid size-24 place-items-center text-[80px] leading-none" style={{ left: -(i % 2) * 48, top: -Math.floor(i / 2) * 48 }}>
          🐶
        </span>
      )}
    </span>
  );
}
