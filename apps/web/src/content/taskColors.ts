/**
 * Colours that are part of a task (Update 3 spec 5, 19 Nov 2026). They stay the same in every colour scheme: when a
 * colour is the rule or the answer, a scheme must never change it, or the child learns the wrong thing or a game
 * breaks. The only other place in `src` with colours is lib/theme.ts (the scheme tokens) and the files in
 * `colourAllowList.txt` (pictures of real things).
 *
 * Contrast: each colour must stand out at least 3:1 from the surface it sits on (`paperSolid`, `gameCloud`) in all 11
 * sets, or it is drawn with a 2 px ring (`--ring-<name>`, worked out in lib/theme.ts; `taskColors.test.ts`).
 */

/** Sorting shapes (sort, switch_sort, secret_rule, which_way, fast_sort, odd_one_out…): [fill, outline]. */
export const GLYPH_HEX = {
  red: ["#e8837a", "#b9544b"],
  blue: ["#7fa9e0", "#4c78b8"],
  green: ["#8cc98f", "#4f9a55"],
  yellow: ["#f5d272", "#c49a2c"],
  purple: ["#b3a8e8", "#7d6fcf"],
  orange: ["#f4b183", "#c97a43"],
  pink: ["#f3b6c8", "#c87892"],
  /** Shadow Match and "sort by shape": a dark shape with no colour to sort by. */
  shadow: ["#3b4560", "#27304a"],
} as const satisfies Record<string, readonly [string, string]>;

/** Colour words and swatches (colour games, the ink of `opposite`). */
export const WORD_COLOURS = {
  c_red: "#e8837a",
  c_blue: "#7fa9e0",
  c_green: "#8cc98f",
  c_yellow: "#f5d272",
  c_purple: "#b3a8e8",
  c_orange: "#f4b183",
  c_pink: "#f3b6c8",
  c_white: "#fbfbf8",
} as const;

/** The pens of the drawing games, named by the colour words. */
export const PEN_COLOURS = {
  c_red: "#ef6f6c",
  c_orange: "#f59e5b",
  c_yellow: "#f7cf4a",
  c_green: "#6cc082",
  c_blue: "#5b9be0",
  c_purple: "#a08be0",
  c_pink: "#f29bbd",
} as const;

/** switch_sort: the thick yellow frame that means "sort by colour". */
export const SORT_BY_COLOUR_FRAME = "#f5c400";

/** The bazaar (skill Math): one colour per banknote, as on the real notes; `coin` for coins. */
export const NOTE_COLOURS: Record<number, string> & { coin: string } = {
  500: "#e6d29a",
  1000: "#bfe3c0",
  2000: "#bcd6f2",
  5000: "#f3c6d3",
  10000: "#d4ccf2",
  20000: "#f6cfa9",
  50000: "#a9dcd5",
  100000: "#9fc0ea",
  coin: "#e9eef6",
};

/** Counting in groups (skill Math): one dot colour per group size, so a group of 5 always looks like a group of 5. */
export const GROUP_DOT_COLOURS: Record<number, string> & { other: string } = { 2: "#f4b183", 5: "#8cc98f", 10: "#7fa9e0", other: "#b3a8e8" };

/** Wet or dry (skill Reasoning, pipes): water is blue, a dry pipe grey. */
export const WATER_COLOURS = { wet: "#5b9be0", dry: "#9aa6b8" } as const;

/**
 * Vision mode (CVI, set by an adult per child): one strong colour the child sees best around every target, on a
 * dark screen. The colour is the child's own, so it never follows the scheme.
 */
export const VISION_COLOURS = { yellow: "#ffd400", red: "#e53935", green: "#2e9e44", blue: "#1e66f5", screen: "#111827" } as const;

/** Every task colour with a name, for the contrast test and the `--ring-*` variables. */
export const TASK_COLOURS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(GLYPH_HEX).map(([k, [fill]]) => [`glyph-${k}`, fill])),
  ...Object.fromEntries(Object.entries(WORD_COLOURS).map(([k, v]) => [`word-${k.slice(2)}`, v])),
  ...Object.fromEntries(Object.entries(PEN_COLOURS).map(([k, v]) => [`pen-${k.slice(2)}`, v])),
  "frame-colour": SORT_BY_COLOUR_FRAME,
  ...Object.fromEntries(Object.entries(NOTE_COLOURS).map(([k, v]) => [`note-${k}`, v])),
  ...Object.fromEntries(Object.entries(GROUP_DOT_COLOURS).map(([k, v]) => [`dot-${k}`, v])),
  "water-wet": WATER_COLOURS.wet,
  "water-dry": WATER_COLOURS.dry,
};
