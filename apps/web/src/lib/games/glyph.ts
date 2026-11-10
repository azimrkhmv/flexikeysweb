// Simple drawn shapes ("glyphs") for the skill games: a shape, a colour, a turn, a mirror, a shade and a size, all in
// one item id ("g:star:red:30:0:1:1"), so every engine can show them with ItemArt and every generator can compare them.

export const GLYPH_SHAPES = ["circle", "square", "triangle", "star", "heart", "rectangle", "arrow", "flag", "drop", "corner", "moon", "house"] as const;
/** Two more shapes for Shadow Match (B85), kept out of GLYPH_SHAPES so the older games draw from the same list. */
export const EXTRA_SHAPES = ["zigzag", "boot"] as const;
export type GlyphShape = (typeof GLYPH_SHAPES)[number] | (typeof EXTRA_SHAPES)[number];
/** Shapes whose turn is easy to see (no turn of them looks the same before 360°). */
export const TURNABLE: GlyphShape[] = ["arrow", "flag", "drop", "corner", "moon", "house"];
/**
 * Shapes whose mirror image looks different from every turn of them (Shadow Match: mirror images are the wrong
 * options). The moon is not one: it is the same upside down, so its mirror image is a turn of it.
 */
export const CHIRAL: GlyphShape[] = ["flag", "corner", "zigzag", "boot"];
export const GLYPH_COLORS = ["red", "blue", "green", "yellow", "purple", "orange", "pink"] as const;
export type GlyphColor = (typeof GLYPH_COLORS)[number];

export interface Glyph {
  shape: GlyphShape;
  color: GlyphColor | "shadow";
  /** Degrees clockwise. */
  rot: number;
  flip: boolean;
  /** 0 the colour itself, 1 lighter, 2 darker. */
  shade: 0 | 1 | 2;
  /** 0 small, 1 middle, 2 big. */
  size: 0 | 1 | 2;
  /** Only to tell apart two equal-looking items of one round (ignored when drawing). */
  tag?: string | number;
}

export const glyph = (g: Partial<Glyph> & Pick<Glyph, "shape">): Glyph => ({ color: "blue", rot: 0, flip: false, shade: 0, size: 1, ...g });
export const glyphId = (g: Glyph) => `g:${g.shape}:${g.color}:${((g.rot % 360) + 360) % 360}:${g.flip ? 1 : 0}:${g.shade}:${g.size}${g.tag !== undefined ? `#${g.tag}` : ""}`;
export const isGlyph = (id: string) => id.startsWith("g:");

export function parseGlyph(id: string): Glyph {
  const [body, tag] = id.split("#");
  const [, shape, color, rot, flip, shade, size] = body.split(":");
  return { shape: shape as GlyphShape, color: color as Glyph["color"], rot: Number(rot), flip: flip === "1", shade: Number(shade) as Glyph["shade"], size: Number(size) as Glyph["size"], tag };
}

/** The look of a glyph without its tag: two items look the same exactly when these are equal. */
export const looks = (id: string) => (isGlyph(id) ? id.split("#")[0] : id);

export const COLOR_HEX: Record<GlyphColor | "shadow", [fill: string, stroke: string]> = {
  red: ["#e8837a", "#b9544b"],
  blue: ["#7fa9e0", "#4c78b8"],
  green: ["#8cc98f", "#4f9a55"],
  yellow: ["#f5d272", "#c49a2c"],
  purple: ["#b3a8e8", "#7d6fcf"],
  orange: ["#f4b183", "#c97a43"],
  pink: ["#f3b6c8", "#c87892"],
  shadow: ["#3b4560", "#27304a"],
};
