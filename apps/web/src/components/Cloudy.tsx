"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

/**
 * Cloudy (B101, spec 5.1): one shared drawing for the page mascot, the tour and both Cloudy games. Everything is
 * drawn here in code, as in the approved demo (docs/demo-2026-11-15, `Puff`); there are no image files.
 *
 * Body: 12 soft round puffs with a thick outline in --edge, a 5 px lower edge, a light top, a darker bottom, a shine
 * spot and two feet (they paddle with `walk`). Cloud, bunny, cat, fox and bear are the same 12 puffs moved to other
 * places (`FORMS`, the demo's numbers). The tiger is a full drawing: the puffs shrink into a small ball and the
 * tiger pops out. Other drawn forms go into `DRAWN` (a dragon later, Q16: add its drawing there and its name to
 * `DRAWN_FORMS`; nothing else changes).
 *
 * Colours follow the colour scheme (B107): each form's body and shade are scheme tokens (`--cl-<form>`, worked out in
 * lib/theme.ts `cloudyTones`), so a form repaints by itself when the scheme changes. His face is always --cloudyFace:
 * his body stays light in dark mode, so the scheme's light `ink` would vanish on it.
 */
export const CLOUDY_FORMS = ["cloud", "bunny", "cat", "fox", "bear", "tiger"] as const;
export type CloudyForm = (typeof CLOUDY_FORMS)[number];
export const CLOUDY_FACES = ["happy", "wow", "wink", "laugh"] as const;
export type CloudyFace = (typeof CLOUDY_FACES)[number];

type Blob = [x: number, y: number, rx: number, ry: number, turn?: number];
const BALL: Blob[] = Array.from({ length: 12 }, () => [70, 86, 26, 24]);
/** Where the face sits and where each of the 12 puffs goes (a 140 × 140 box). */
const FORMS: Record<CloudyForm, { face: [number, number]; blobs: Blob[] }> = {
  cloud: { face: [70, 88], blobs: [[74, 62, 28, 28], [44, 80, 22, 22], [102, 78, 24, 24], [70, 88, 40, 22], [56, 74, 22, 22], [90, 72, 22, 22], [70, 98, 46, 17], [32, 94, 16, 14], [110, 94, 17, 14], [74, 78, 30, 24], [52, 96, 26, 16], [92, 96, 26, 16]] },
  bunny: { face: [70, 92], blobs: [[70, 88, 34, 29], [54, 40, 10, 26, -8], [86, 40, 10, 26, 8], [56, 56, 10, 16, -8], [84, 56, 10, 16, 8], [70, 98, 36, 20], [50, 96, 20, 18], [90, 96, 20, 18], [70, 82, 30, 24], [70, 92, 34, 24], [60, 76, 14, 12], [80, 76, 14, 12]] },
  cat: { face: [70, 92], blobs: [[70, 88, 36, 29], [45, 56, 11, 19, -24], [95, 56, 11, 19, 24], [49, 66, 12, 14, -24], [91, 66, 12, 14, 24], [70, 98, 37, 20], [50, 96, 21, 18], [90, 96, 21, 18], [70, 82, 32, 24], [70, 92, 35, 25], [114, 102, 7, 16, 40], [106, 112, 10, 7]] },
  fox: { face: [70, 90], blobs: [[70, 86, 34, 27], [44, 52, 11, 22, -22], [96, 52, 11, 22, 22], [48, 64, 13, 15, -22], [92, 64, 13, 15, 22], [42, 96, 18, 13, 10], [98, 96, 18, 13, -10], [70, 99, 30, 18], [70, 80, 30, 22], [70, 92, 32, 22], [119, 98, 10, 20, 35], [125, 84, 8, 10, 35]] },
  bear: { face: [70, 88], blobs: [[70, 86, 38, 32], [40, 54, 15, 15], [100, 54, 15, 15], [70, 100, 38, 20], [48, 94, 22, 20], [92, 94, 22, 20], [42, 56, 12, 12], [98, 56, 12, 12], [70, 80, 34, 26], [70, 92, 36, 26], [70, 104, 28, 14], [70, 96, 36, 22]] },
  tiger: { face: [70, 62], blobs: BALL },
};
/** Forms that are a full drawing, not the 12 puffs. */
const DRAWN_FORMS: readonly CloudyForm[] = ["tiger"];

/** [body, shade] of each form: the scheme tokens of lib/theme.ts `cloudyTones`. */
const TONES = Object.fromEntries(CLOUDY_FORMS.map((f) => [f, [`var(--cl-${f})`, `var(--cl-${f}-s)`]])) as Record<CloudyForm, [string, string]>;
// The small details (inner ears, cheeks, nose, muzzle) also come from the scheme.
const BLUSH = "var(--cheek)";
const MUZZLE = "var(--cloudyBody)";
const SHINE = "rgb(var(--shine))";

const pct = (line: number, y: number, ry: number) => Math.round(((line - (y - ry)) / (2 * ry)) * 100);
/** The outline of a drawn form: Cloudy's outline colour (--cl, globals.css), not his face colour. */
const ST = { stroke: "var(--cl)", strokeWidth: 2.6, strokeLinejoin: "round", strokeLinecap: "round" } as const;

function Deco() {
  return (
    <g className="fk-puff-deco">
      <ellipse cx="50" cy="66" rx="9" ry="5" fill={SHINE} opacity=".6" transform="rotate(-28 50 66)" />
      <g className="d d-bunny">
        <ellipse cx="54" cy="40" rx="4.5" ry="17" fill={BLUSH} transform="rotate(-8 54 40)" />
        <ellipse cx="86" cy="40" rx="4.5" ry="17" fill={BLUSH} transform="rotate(8 86 40)" />
      </g>
      <g className="d d-cat">
        <path d="M40 64l3-21 12 15zM100 64l-3-21-12 15z" fill={BLUSH} />
        <path d="M34 96h-15M34 102l-14 4M106 96h15M106 102l14 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="d d-fox">
        <ellipse cx="44" cy="52" rx="4.5" ry="13" fill="currentColor" opacity=".6" transform="rotate(-22 44 52)" />
        <ellipse cx="96" cy="52" rx="4.5" ry="13" fill="currentColor" opacity=".6" transform="rotate(22 96 52)" />
        <ellipse cx="70" cy="101" rx="20" ry="12" fill={MUZZLE} />
        <ellipse cx="125" cy="84" rx="5.5" ry="7.5" fill={MUZZLE} transform="rotate(35 125 84)" />
      </g>
      <g className="d d-bear">
        <circle cx="40" cy="54" r="7.5" fill="currentColor" opacity=".45" />
        <circle cx="100" cy="54" r="7.5" fill="currentColor" opacity=".45" />
        <ellipse cx="70" cy="100" rx="17" ry="11" fill={MUZZLE} />
      </g>
    </g>
  );
}

/** Full drawings. `--b` is the body colour, `--s` its shade (set on the root from `TONES`). */
const DRAWN: Partial<Record<CloudyForm, ReactNode>> = {
  tiger: (
    <g className="fk-puff-art art-tiger">
      <path d="M94 104C118 108 127 92 121 78C118 71 109 74 112 81C115 90 106 96 95 94Z" fill="var(--b)" {...ST} />
      <path d="M113 80l8-3M114 90l9-1M106 98l4 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="70" cy="100" rx="27" ry="20" fill="var(--b)" {...ST} />
      <ellipse cx="70" cy="105" rx="15" ry="13" fill={MUZZLE} />
      <path d="M45 96l8 2M44 104l8 1M95 96l-8 2M96 104l-8 1" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="58" cy="117" rx="10" ry="6.5" fill="var(--b)" {...ST} />
      <ellipse cx="82" cy="117" rx="10" ry="6.5" fill="var(--b)" {...ST} />
      <circle cx="42" cy="36" r="12" fill="var(--b)" {...ST} />
      <circle cx="98" cy="36" r="12" fill="var(--b)" {...ST} />
      <circle cx="42" cy="37" r="6" fill={BLUSH} />
      <circle cx="98" cy="37" r="6" fill={BLUSH} />
      <path d="M35 60L22 66L34 76ZM105 60L118 66L106 76Z" fill="var(--b)" {...ST} />
      <ellipse cx="70" cy="60" rx="37" ry="31" fill="var(--b)" {...ST} />
      <path d="M36 70C44 94 96 94 104 70C92 86 48 86 36 70Z" fill="var(--s)" opacity=".5" />
      <ellipse cx="70" cy="74" rx="17" ry="12" fill={MUZZLE} />
      <path d="M70 31v11M60 33l2 9M80 33l-2 9M35 54l10 3M34 63l10 1M105 54l-10 3M106 63l-10 1" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M66 67h8l-4 5z" fill="var(--accent)" {...ST} />
      <ellipse cx="50" cy="40" rx="9" ry="5" fill={SHINE} opacity=".6" transform="rotate(-28 50 40)" />
    </g>
  ),
};

function Face({ at }: { at: [number, number] }) {
  const line = { fill: "none", stroke: "currentColor", strokeLinecap: "round" } as const;
  return (
    <g className="fk-puff-face" style={{ transform: `translate(${at[0]}px, ${at[1]}px)` }}>
      <ellipse cx="-20" cy="7" rx="6.5" ry="4.2" fill={BLUSH} />
      <ellipse cx="20" cy="7" rx="6.5" ry="4.2" fill={BLUSH} />
      <g className="fc f-happy">
        <path d="M-16 1q5-8 10 0M6 1q5-8 10 0" {...line} strokeWidth="3" />
        <path d="M-4 5q4 5.5 8 0" {...line} strokeWidth="2.6" />
      </g>
      <g className="fc f-wow">
        <circle cx="-11" cy="-2" r="5" fill="currentColor" />
        <circle cx="11" cy="-2" r="5" fill="currentColor" />
        <circle cx="-12.5" cy="-3.5" r="1.7" fill={SHINE} />
        <circle cx="9.5" cy="-3.5" r="1.7" fill={SHINE} />
        <ellipse cx="0" cy="8" rx="3.2" ry="4.2" fill="currentColor" />
      </g>
      <g className="fc f-wink">
        <path d="M-16 1q5-8 10 0" {...line} strokeWidth="3" />
        <circle cx="11" cy="-2" r="5" fill="currentColor" />
        <circle cx="9.5" cy="-3.5" r="1.7" fill={SHINE} />
        <path d="M-5 5q5 6 10 0" {...line} strokeWidth="2.6" />
      </g>
      <g className="fc f-laugh">
        <path d="M-16 1q5-8 10 0M6 1q5-8 10 0" {...line} strokeWidth="3" />
        <path d="M-7 4h14q-7 13-14 0z" fill="currentColor" />
        <path d="M-3 10q3-3 6 0q-3 3-6 0z" fill={BLUSH} />
      </g>
    </g>
  );
}

/**
 * Cloudy in one form with one face. A change of `form` takes about 0.9 s and throws a small burst of sparkles in
 * --sun (not on the first draw). Decoration: `aria-hidden` unless a `label` is given.
 */
export function Cloudy({
  size,
  form = "cloud",
  face = "happy",
  walk,
  label,
  className = "",
  style,
}: {
  size: number;
  form?: CloudyForm;
  face?: CloudyFace;
  /** The feet paddle (Cloudy is moving fast). */
  walk?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [burst, setBurst] = useState({ form, n: 0 });
  if (burst.form !== form) setBurst({ form, n: burst.n + 1 });
  const { face: at, blobs } = FORMS[form];
  const [base, shade] = TONES[form];
  const light = `color-mix(in srgb, ${SHINE} 55%, ${base})`;
  const vars = { "--z": size / 140, "--h": light, "--b": base, "--s": shade, "--foot": shade } as CSSProperties;

  return (
    <span
      className={`fk-puff ${walk ? "walk" : ""} ${DRAWN_FORMS.includes(form) ? "drawn" : ""} ${className}`}
      data-form={form}
      data-face={face}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ ...vars, ...style }}
    >
      <span className="pz">
        <svg className="fk-puff-feet" viewBox="0 0 140 140">
          <ellipse className="ft l" cx="54" cy="125" rx="12" ry="8" />
          <ellipse className="ft r" cx="86" cy="125" rx="12" ry="8" />
        </svg>
        <span className="pb">
          {blobs.map(([x, y, rx, ry, turn = 0], i) => {
            const low = pct(103, y, ry);
            return (
              <i
                key={i}
                style={{
                  transform: `translate(${x - 70}px, ${y - 70}px) rotate(${turn}deg) scale(${rx / 50}, ${ry / 50})`,
                  background: `linear-gradient(var(--h) ${pct(56, y, ry)}%, var(--b) ${pct(80, y, ry)}%, var(--b) ${low - 9}%, var(--s) ${low + 9}%)`,
                }}
              />
            );
          })}
        </span>
        <svg className="fk-puff-arts" viewBox="0 0 140 140">
          {DRAWN_FORMS.map((k) => (
            <g key={k} data-art={k}>
              {DRAWN[k]}
            </g>
          ))}
        </svg>
        <svg viewBox="0 0 140 140">
          <Deco />
          <Face at={at} />
        </svg>
      </span>
      {burst.n > 0 &&
        Array.from({ length: 9 }, (_, i) => {
          const a = (i * 40 * Math.PI) / 180;
          return <span key={`${burst.n}-${i}`} className="fk-spark" style={{ "--tx": `${Math.cos(a) * size * 0.7}px`, "--ty": `${Math.sin(a) * size * 0.7}px` } as CSSProperties} />;
        })}
    </span>
  );
}

/**
 * An outlined cloud: the drifting page clouds (--cloud) and, with `game`, the clouds of Find Cloudy (spec 6: targets
 * use --gameCloud with a --gameEdge outline, which stands out 3:1 from the sky in every set).
 */
export function CloudShape({ className = "", game }: { className?: string; game?: boolean }) {
  return (
    <svg viewBox="-4 0 128 72" aria-hidden className={className} style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}>
      <path d="M26 64C8 64 2 50 10 40C7 25 22 16 34 23C40 6 65 5 73 21C87 13 106 24 101 40C116 43 115 64 98 64Z" fill={game ? "var(--gameCloud)" : "var(--cloud)"} stroke={game ? "var(--gameEdge)" : "var(--edge)"} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M22 55C44 61 80 61 102 54" fill="none" stroke={game ? "var(--cloudyShade)" : "var(--line)"} strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}
