"use client";

import type { ReactNode, RefObject } from "react";
import { Drawer } from "vaul";
import { Paintbrush } from "lucide-react";
import { setChildLook, STYLES, useChildLook } from "@/lib/appearance";
import { useT } from "@/lib/i18n";
import { useIsPhone } from "@/lib/useMedia";
import { accentOf, SCHEMES } from "@/lib/theme";
import type { Child } from "@/lib/types";
import { Target } from "./Target";

const CLOUD = "M26 64C8 64 2 50 10 40C7 25 22 16 34 23C40 6 65 5 73 21C87 13 106 24 101 40C116 43 115 64 98 64Z";

/** The round brush button on the play home (world map, Skill games), never during a game round (B110, spec 4.2). */
export function MyColoursButton({ child, onOpen }: { child: Child; onOpen: () => void }) {
  const t = useT(child.uiLang);
  return (
    <Target label={t("look.mine")} onSelect={onOpen} className="grid place-items-center rounded-full bg-surface/90 text-ink shadow-soft">
      <Paintbrush className="size-8" aria-hidden />
    </Target>
  );
}

/**
 * My colours: six colour clouds (each in its scheme's accent), Soft and Sharp with a round and a square picture, and
 * Done. Kept per child on this device (lib/appearance.ts); light or dark follows the parent (Night is always dark).
 * Every button is a child-mode Target: touch, hold-to-choose, switch scanning and keyboard, at the child's target size.
 */
export function MyColoursSheet({ child, onDone, sheetRef }: { child: Child; onDone: () => void; sheetRef: RefObject<HTMLDivElement | null> }) {
  const t = useT(child.uiLang);
  const look = useChildLook(child.id);
  return (
    <ChildSheet title={t("look.mine")} sheetRef={sheetRef}>
        <div role="group" aria-label={t("look.mine.colour")} className="flex flex-wrap justify-center gap-3">
          {SCHEMES.map((s) => (
            <Target
              key={s}
              label={t(`look.scheme.${s}`)}
              selected={look.scheme === s}
              onSelect={() => setChildLook(child.id, { scheme: s })}
              className={`grid place-items-center rounded-3xl p-2 ${look.scheme === s ? "bg-primary-soft ring-4 ring-ink" : "bg-surface-2"}`}
            >
              <svg viewBox="0 0 120 70" className="w-20" aria-hidden>
                <path d={CLOUD} fill={accentOf(s)} stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
              </svg>
            </Target>
          ))}
        </div>
        <div role="group" aria-label={t("look.mine.style")} className="flex flex-wrap justify-center gap-3">
          {STYLES.map((st) => (
            <Target
              key={st}
              label={t(`look.${st}`)}
              selected={look.style === st}
              onSelect={() => setChildLook(child.id, { style: st })}
              className={`flex items-center gap-3 rounded-full px-6 text-xl font-extrabold text-ink ${look.style === st ? "bg-primary-soft ring-4 ring-ink" : "bg-surface-2"}`}
            >
              <span aria-hidden className={`inline-block size-8 bg-accent ${st === "soft" ? "rounded-full" : "rounded-md border-2 border-ink"}`} />
              {t(`look.${st}`)}
            </Target>
          ))}
        </div>
        <Target label={t("look.done")} onSelect={onDone} className="rounded-full bg-btn px-10 text-2xl font-extrabold text-btn-text shadow-soft">
          {t("look.done")}
        </Target>
    </ChildSheet>
  );
}

/**
 * B118 (Update 4 spec 8.2): on phones (under 768 px) a child's panel is a Vaul bottom sheet that cannot be dragged or
 * closed by a tap outside or Escape (`dismissible={false}`, no handle): children with motor difficulties drag by
 * accident, so it closes only with its big Done button. On larger screens it stays the centred box. Either way the
 * buttons stay child-mode Targets inside `sheetRef`, which switch scanning and the child's focus trap use.
 */
function ChildSheet({ title, sheetRef, children }: { title: string; sheetRef: RefObject<HTMLDivElement | null>; children: ReactNode }) {
  const phone = useIsPhone();
  const titleId = "fk-mine-title";
  const heading = "text-3xl font-extrabold text-ink";
  const body = (
    <div ref={sheetRef} className={`flex w-full flex-col items-center gap-5 bg-surface p-6 ${phone ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]" : "fk-card max-w-xl"}`}>
      {phone ? (
        <Drawer.Title id={titleId} className={heading}>{title}</Drawer.Title>
      ) : (
        <h2 id={titleId} className={heading}>{title}</h2>
      )}
      {children}
    </div>
  );
  if (phone)
    return (
      <Drawer.Root open dismissible={false} handleOnly>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
          <Drawer.Content aria-labelledby={titleId} aria-describedby={undefined} className="fixed inset-x-0 bottom-0 z-40 max-h-[94dvh] overflow-y-auto rounded-t-fk-lg bg-surface shadow-lift outline-none">
            {body}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  return (
    <div className="fixed inset-0 z-40 grid place-items-center overflow-y-auto bg-ink/40 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {body}
    </div>
  );
}
