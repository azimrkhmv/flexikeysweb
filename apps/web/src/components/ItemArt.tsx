import { VOCAB } from "@/content/vocab";

/** Renders one content item: emoji picture, color swatch, shape or big glyph. */
export function ItemArt({ id, size = 72 }: { id: string; size?: number }) {
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
  if (item.glyph)
    return (
      <span aria-hidden className="block text-center font-extrabold leading-none text-ink" style={{ fontSize: size * 0.9, width: size }}>
        {item.glyph}
      </span>
    );
  return (
    <span aria-hidden className="block text-center leading-none" style={{ fontSize: size * 0.82, width: size }}>
      {item.emoji}
    </span>
  );
}

const SHAPE_PATHS: Record<string, string> = {
  square: "M14 14h72v72H14z",
  rectangle: "M6 26h88v48H6z",
  triangle: "M50 10 92 86H8z",
  star: "M50 6l12.6 27.4 29.9 3.4-22.3 20.3 6.1 29.5L50 71.7 23.7 86.6l6.1-29.5L7.5 36.8l29.9-3.4z",
  heart: "M50 86 14 52C2 40 6 18 24 14c11-2 20 4 26 14 6-10 15-16 26-14 18 4 22 26 10 38z",
};

function Shape({ shape, size }: { shape: string; size: number }) {
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
