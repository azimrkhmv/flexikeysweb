"use client";

import { useRef, useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui";
import { useT, type Lang } from "@/lib/i18n";
import { useFocusTrap } from "@/lib/useFocusTrap";

const HOLD_MS = 2000;

function makeQuestion() {
  const a = 3 + Math.floor(Math.random() * 7);
  const b = 3 + Math.floor(Math.random() * 7);
  const answer = a + b;
  const options = new Set([answer]);
  while (options.size < 4) options.add(answer + Math.floor(Math.random() * 9) - 4);
  return { a, b, answer, options: [...options].sort(() => Math.random() - 0.5) };
}

/**
 * Parent gate (FR-PLAY-3): hold 2 s, then an addition question written in words with 4 answers.
 * A miss sends you back to the hold step, so random tapping by a pre-reader rarely gets through.
 */
export function ParentGate({ lang, onPass, onCancel }: { lang: Lang; onPass: () => void; onCancel: () => void }) {
  const t = useT(lang);
  const [q, setQ] = useState<ReturnType<typeof makeQuestion> | null>(null);
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const box = useRef<HTMLDivElement>(null);
  useFocusTrap(box, q ? "question" : "hold", onCancel); // Escape = back to playing

  const start = () => {
    setHolding(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setHolding(false);
      setQ(makeQuestion());
    }, HOLD_MS);
  };
  const cancel = () => {
    clearTimeout(timer.current);
    setHolding(false);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#27406b]/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="fk-gate-title">
      <div ref={box} className="w-full max-w-md rounded-fk-lg bg-surface p-6 text-center shadow-lift">
        <h2 id="fk-gate-title" className="mb-4 flex items-center justify-center gap-2 text-xl font-extrabold text-ink">
          <Lock className="size-5" aria-hidden /> {t("play.gate.title")}
        </h2>
        {!q ? (
          <button
            type="button"
            className="relative h-16 w-full overflow-hidden rounded-full bg-primary-soft font-bold text-primary select-none"
            style={{ touchAction: "none" }}
            onPointerDown={start}
            onPointerUp={cancel}
            onPointerLeave={cancel}
            onPointerCancel={cancel}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !e.repeat && start()}
            onKeyUp={cancel}
            onContextMenu={(e) => e.preventDefault()}
          >
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-primary/25"
              style={{ width: holding ? "100%" : "0%", transition: holding ? `width ${HOLD_MS}ms linear` : "none" }}
            />
            <span className="relative">{t("play.gate.hold")}</span>
          </button>
        ) : (
          <div>
            <p className="mb-4 text-lg font-bold text-ink">{t("play.gate.question", { a: t(`play.num.${q.a}`), b: t(`play.num.${q.b}`) })}</p>
            <div className="grid grid-cols-2 gap-3">
              {q.options.map((n) => (
                <Button key={n} variant="outline" size="lg" onClick={() => (n === q.answer ? onPass() : setQ(null))}>
                  {n}
                </Button>
              ))}
            </div>
          </div>
        )}
        <Button variant="ghost" className="mt-5" onClick={onCancel}>
          {t("play.gate.cancel")}
        </Button>
      </div>
    </div>
  );
}
