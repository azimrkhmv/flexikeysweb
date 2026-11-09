import { VOCAB } from "@/content/vocab";
import { COLOR_HEX, isGlyph, parseGlyph, type Glyph } from "@/lib/games/glyph";
import { numOf, wordEmoji } from "@/lib/games/pools";
import type { Lang } from "@/lib/i18n";

/**
 * Renders one content item: emoji picture, color swatch, shape or big glyph. Skill games add drawn shapes
 * ("g:star:red:30:0:1:1", lib/games/glyph.ts), numbers ("num:42") and sound-alike words with a picture ("w:en:bus").
 */
/** A size in px, or a CSS length (skill games' boards shrink with the screen: "min(70px, calc(…))"). */
export type Size = number | string;
const css = (s: Size) => (typeof s === "number" ? `${s}px` : s);
/** `size` × `f`, as a CSS length. */
export const times = (s: Size, f: number): Size => (typeof s === "number" ? Math.round(s * f) : `calc(${s} * ${f})`);

export function ItemArt({ id, size = 72 }: { id: string; size?: Size }) {
  if (isGlyph(id)) return <GlyphArt g={parseGlyph(id)} size={size} />;
  if (id.startsWith("num:")) return <Big text={String(numOf(id))} size={size} />;
  if (id.startsWith("w:")) return <Emoji emoji={wordEmoji(id) ?? "❔"} size={size} />;
  const item = VOCAB[id];
  if (!item) return null;
  if (item.color)
    return (
      <span
        aria-hidden
        className="block rounded-[30%] shadow-inner"
        style={{ width: size, height: size, background: item.color, border: "3px solid rgb(39 64 107 / 0.08)" }}
      />
    );
  if (item.shape) return <Shape shape={item.shape} size={size} />;
  if (item.art === "toothbrush") return <Toothbrush size={size} />;
  if (item.glyph) return <Big text={item.glyph} size={size} />;
  return <Emoji emoji={item.emoji ?? ""} size={size} />;
}

const Emoji = ({ emoji, size }: { emoji: string; size: Size }) => (
  <span aria-hidden className="block text-center leading-none" style={{ fontSize: `calc(${css(size)} * 0.82)`, width: size }}>
    {emoji}
  </span>
);
const Big = ({ text, size }: { text: string; size: Size }) => (
  <span aria-hidden className="block text-center font-extrabold leading-none text-ink" style={{ fontSize: `calc(${css(size)} * ${text.length > 2 ? 0.55 : text.length > 1 ? 0.7 : 0.9})`, width: size }}>
    {text}
  </span>
);

/** The words a screen reader and auditory scanning say for an item (`t` is the screen's translator). */
export function itemLabel(id: string, lang: Lang, t: (k: string, v?: Record<string, string | number>) => string): string {
  if (isGlyph(id)) {
    const g = parseGlyph(id);
    return t("skill.glyph", { color: t(`skill.color.${g.color}`), shape: t(`skill.shape.${g.shape}`) });
  }
  if (id.startsWith("num:")) return String(numOf(id));
  if (id.startsWith("w:")) return id.split(":")[2];
  return VOCAB[id]?.word[lang] ?? id;
}

const SHAPE_PATHS: Record<string, string> = {
  square: "M14 14h72v72H14z",
  rectangle: "M6 26h88v48H6z",
  triangle: "M50 10 92 86H8z",
  star: "M50 6l12.6 27.4 29.9 3.4-22.3 20.3 6.1 29.5L50 71.7 23.7 86.6l6.1-29.5L7.5 36.8l29.9-3.4z",
  heart: "M50 86 14 52C2 40 6 18 24 14c11-2 20 4 26 14 6-10 15-16 26-14 18 4 22 26 10 38z",
  // Skill-game shapes that look different after every turn (lib/games/glyph.ts TURNABLE).
  arrow: "M50 6 86 44H62v50H38V44H14z",
  flag: "M20 6h9v88h-9zM29 9l52 17-52 17z",
  drop: "M50 6C66 30 80 46 80 64a30 30 0 0 1-60 0c0-18 14-34 30-58z",
  corner: "M18 6h22v64h44v22H18z",
  moon: "M64 8a42 42 0 1 0 0 84 33 33 0 1 1 0-84z",
  house: "M50 6 92 44H80v50H58V68H42v26H20V44H8z",
};

function Shape({ shape, size }: { shape: string; size: Size }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      {shape === "circle" ? (
        <circle cx="50" cy="50" r="40" fill="#a9c8ec" stroke="#5b86c4" strokeWidth="4" />
      ) : (
        <path d={SHAPE_PATHS[shape]} fill="#b3a8e8" stroke="#7d6fcf" strokeWidth="4" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** Mixes a hex colour with white (amount > 0) or black (amount < 0). */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(amount > 0 ? c + (255 - c) * amount : c * (1 + amount)));
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function GlyphArt({ g, size }: { g: Glyph; size: Size }) {
  const [fill, stroke] = COLOR_HEX[g.color];
  const shade = g.shade === 1 ? 0.45 : g.shade === 2 ? -0.3 : 0;
  const scale = [0.62, 0.82, 1][g.size];
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g transform={`rotate(${g.rot} 50 50) translate(50 50) scale(${g.flip ? -scale : scale} ${scale}) translate(-50 -50)`}>
        {g.shape === "circle" ? (
          <circle cx="50" cy="50" r="40" fill={tint(fill, shade)} stroke={tint(stroke, shade)} strokeWidth="5" />
        ) : (
          <path d={SHAPE_PATHS[g.shape]} fill={tint(fill, shade)} stroke={tint(stroke, shade)} strokeWidth="5" strokeLinejoin="round" />
        )}
      </g>
    </svg>
  );
}

function Toothbrush({ size }: { size: Size }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <g transform="rotate(-25 50 50)">
        <rect x="6" y="54" width="64" height="12" rx="6" fill="#a9c8ec" stroke="#5b86c4" strokeWidth="3" />
        <rect x="64" y="50" width="28" height="18" rx="6" fill="#dfe8f8" stroke="#5b86c4" strokeWidth="3" />
        {[68, 75, 82, 89].map((x) => (
          <rect key={x} x={x - 2} y="32" width="5" height="18" rx="2" fill="#ffffff" stroke="#7fbf85" strokeWidth="2.5" />
        ))}
      </g>
    </svg>
  );
}
