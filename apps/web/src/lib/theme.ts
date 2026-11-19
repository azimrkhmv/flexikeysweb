/**
 * The colour tokens (B107, Update 3 spec 2, 19 Nov 2026). The only file in `src` that defines colours of the look;
 * everything else uses these tokens through CSS variables (`var(--paperSolid)`) or the Tailwind colours mapped onto
 * them in globals.css (`bg-surface`, `text-ink`…). `noRawColours.test.ts` keeps it that way.
 *
 * Six schemes: Warm Hills (default), Sky, Mint, Lilac, Peach (each light and dark) and Night (dark only): 11 sets.
 * The values in `P` are copied exactly from the approved demo (docs/demo-2026-11-19, between PALETTES-START and
 * PALETTES-END), and `cloudyFace` from the lines after it. Do not change one without the contrast test
 * (`theme.test.ts`) passing.
 *
 * `THEME_CSS` turns every set into CSS variables on `[data-scheme][data-mode]` (lib/appearance.ts sets the
 * attributes on <html>; the Cloudy test page sets them on sections).
 */
import { TASK_COLOURS, VISION_COLOURS } from "@/content/taskColors";

export const SCHEMES = ["warm", "sky", "mint", "lilac", "peach", "night"] as const;
export type Scheme = (typeof SCHEMES)[number];
export const MODES = ["light", "dark"] as const;
export type Mode = (typeof MODES)[number];
/** Schemes with a light version (Night is dark only). */
export const DAY_SCHEMES: readonly Scheme[] = ["warm", "sky", "mint", "lilac", "peach"];

/** The tokens of one set (spec 2.1). */
export const TOKEN_NAMES = [
  "sky1", "sky2", "paper", "paperSolid", "ink", "muted", "accent", "accentText", "btnA", "btnB", "btnText", "line", "edge",
  "sun", "sunGlow", "hillFar", "hill1", "hill2", "tree1", "tree2", "trunk", "cloud",
  "cloudyBody", "cloudyShade", "cloudyLine", "cloudyFace", "cheek", "gameCloud", "gameEdge", "shadow",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];
export type Tokens = Record<TokenName, string>;

/* PALETTES-START (copied from docs/demo-2026-11-19/index.html) */
const P = {
  warm:{
    light:{sky1:"#FFF6E8",sky2:"#FFE6C6",paper:"rgba(255,251,243,.86)",paperSolid:"#FFFBF3",ink:"#4A3220",muted:"#75604B",accent:"#E8975A",accentText:"#A4521C",btnA:"#FFD3A6",btnB:"#F7B67F",btnText:"#45291A",line:"#F1DFC4",edge:"#6B4426",sun:"#FFE3A3",sunGlow:"#FFD27F",hillFar:"#FBDDB3",hill1:"#F6C994",hill2:"#EDB37A",tree1:"#D99B60",tree2:"#C7864C",trunk:"#9A6B47",cloud:"#FFFFFF",cloudyBody:"#FFFFFF",cloudyShade:"#F6DDBF",cloudyLine:"#C59A74",cheek:"#F7B9A2",gameCloud:"#FFFFFF",gameEdge:"#A06A40",shadow:"150,90,40"},
    dark:{sky1:"#241A13",sky2:"#34261B",paper:"rgba(52,39,29,.86)",paperSolid:"#33261C",ink:"#FBEBD9",muted:"#CDB59C",accent:"#F0A766",accentText:"#FFC791",btnA:"#6E4C30",btnB:"#5D3F27",btnText:"#FFF1E2",line:"#4A3828",edge:"#F0A766",sun:"#F7E3C0",sunGlow:"#CDB48C",hillFar:"#4A3526",hill1:"#3F2D20",hill2:"#35251A",tree1:"#6B4B2F",tree2:"#5C3F27",trunk:"#2F2116",cloud:"#4A3828",cloudyBody:"#FFF3E6",cloudyShade:"#E9D3BC",cloudyLine:"#A88466",cheek:"#E2A58F",gameCloud:"#B08E6E",gameEdge:"#E9C9A6",shadow:"0,0,0"}},
  sky:{
    light:{sky1:"#F0F6FE",sky2:"#DCEAFB",paper:"rgba(255,255,255,.86)",paperSolid:"#FFFFFF",ink:"#1F2A4F",muted:"#56627F",accent:"#6F8EDB",accentText:"#3A55AF",btnA:"#CFDDF9",btnB:"#AFC6F3",btnText:"#1B2858",line:"#DCE6F5",edge:"#34447F",sun:"#FFF7DE",sunGlow:"#FFF0BF",hillFar:"#DCE8F9",hill1:"#C5D9F5",hill2:"#A9C5EF",tree1:"#8DAEE4",tree2:"#7497D8",trunk:"#6F82AA",cloud:"#FFFFFF",cloudyBody:"#FFFFFF",cloudyShade:"#D9E5F7",cloudyLine:"#8FA4CF",cheek:"#F4C6D3",gameCloud:"#FFFFFF",gameEdge:"#5F77B0",shadow:"50,80,150"},
    dark:{sky1:"#141B2F",sky2:"#1F2A47",paper:"rgba(31,41,68,.86)",paperSolid:"#1F2944",ink:"#E8EEFC",muted:"#AAB6D3",accent:"#8EA9F0",accentText:"#B7C9FF",btnA:"#3D5189",btnB:"#32457C",btnText:"#EEF3FF",line:"#2C3A60",edge:"#8EA9F0",sun:"#EDEFD8",sunGlow:"#BFC4B0",hillFar:"#2B3A64",hill1:"#233158",hill2:"#1C284B",tree1:"#34477A",tree2:"#2C3D6C",trunk:"#1A2340",cloud:"#2C3A63",cloudyBody:"#EEF3FF",cloudyShade:"#C9D6F2",cloudyLine:"#8496C4",cheek:"#D8AFC4",gameCloud:"#8A9DCB",gameEdge:"#C9D6F2",shadow:"0,0,0"}},
  mint:{
    light:{sky1:"#EEF9F3",sky2:"#D8F0E3",paper:"rgba(255,255,255,.86)",paperSolid:"#FFFFFF",ink:"#1E3A35",muted:"#536D66",accent:"#4FAE8C",accentText:"#1C7560",btnA:"#CBEEDC",btnB:"#A9E0C5",btnText:"#15392F",line:"#D5ECDF",edge:"#2C5A4E",sun:"#FFF5CF",sunGlow:"#FFEDB0",hillFar:"#D9F1E4",hill1:"#BFE5CF",hill2:"#A0D7B9",tree1:"#72C09B",tree2:"#5AAA86",trunk:"#7D8F72",cloud:"#FFFFFF",cloudyBody:"#FFFFFF",cloudyShade:"#D3ECDF",cloudyLine:"#84B39D",cheek:"#F5C7C0",gameCloud:"#FFFFFF",gameEdge:"#4A8569",shadow:"40,110,80"},
    dark:{sky1:"#10221B",sky2:"#183127",paper:"rgba(26,48,41,.86)",paperSolid:"#1A3029",ink:"#E3F5EC",muted:"#A3C4B6",accent:"#6CCAA5",accentText:"#A0E6C9",btnA:"#2E614D",btnB:"#255342",btnText:"#EAFBF3",line:"#284A3D",edge:"#6CCAA5",sun:"#EFF2D6",sunGlow:"#C2C8A8",hillFar:"#264E3E",hill1:"#1F4235",hill2:"#19382C",tree1:"#2E6650",tree2:"#275944",trunk:"#15291F",cloud:"#24473A",cloudyBody:"#EFFBF5",cloudyShade:"#C8E8D8",cloudyLine:"#7FB59D",cheek:"#D9AFA8",gameCloud:"#7FB49D",gameEdge:"#C8E8D8",shadow:"0,0,0"}},
  lilac:{
    light:{sky1:"#F7F3FD",sky2:"#E9E0F9",paper:"rgba(255,255,255,.86)",paperSolid:"#FFFFFF",ink:"#2B2550",muted:"#625B7E",accent:"#9278D9",accentText:"#6245B5",btnA:"#E2D8F8",btnB:"#CDBDF2",btnText:"#2A2055",line:"#E6DEF6",edge:"#4A3F7A",sun:"#FCF1F8",sunGlow:"#F6E1F1",hillFar:"#ECE5FA",hill1:"#DCD0F5",hill2:"#C8B8EE",tree1:"#AC96DF",tree2:"#957CD2",trunk:"#7D6C9F",cloud:"#FFFFFF",cloudyBody:"#FFFFFF",cloudyShade:"#E3D8F6",cloudyLine:"#A493CF",cheek:"#F2C3DD",gameCloud:"#FFFFFF",gameEdge:"#7862B8",shadow:"90,60,150"},
    dark:{sky1:"#1B1630",sky2:"#292246",paper:"rgba(40,33,66,.86)",paperSolid:"#282142",ink:"#F0EBFF",muted:"#BDB3DD",accent:"#B59CF0",accentText:"#D3C3FF",btnA:"#503F89",btnB:"#44357C",btnText:"#F6F2FF",line:"#3A3066",edge:"#B59CF0",sun:"#F4EEF8",sunGlow:"#C9C0D6",hillFar:"#3A3068",hill1:"#31285A",hill2:"#29214E",tree1:"#4A3C7E",tree2:"#403472",trunk:"#221B3D",cloud:"#3A3066",cloudyBody:"#F6F2FF",cloudyShade:"#D8CDF3",cloudyLine:"#9D8CCF",cheek:"#D9AED0",gameCloud:"#A391D1",gameEdge:"#D8CDF3",shadow:"0,0,0"}},
  peach:{
    light:{sky1:"#FFF4F0",sky2:"#FFE1D8",paper:"rgba(255,252,250,.88)",paperSolid:"#FFFCFA",ink:"#4A2A28",muted:"#7A5C58",accent:"#EC8E7D",accentText:"#AA4A3C",btnA:"#FFD8CD",btnB:"#FABCAC",btnText:"#47231F",line:"#F7E0D9",edge:"#7A3E34",sun:"#FFEBC2",sunGlow:"#FFDDA3",hillFar:"#FFE6DE",hill1:"#FDD2C5",hill2:"#F6B9A8",tree1:"#E99D8C",tree2:"#D98371",trunk:"#9F6D62",cloud:"#FFFFFF",cloudyBody:"#FFFFFF",cloudyShade:"#F8DBD2",cloudyLine:"#CF968B",cheek:"#F6B0A6",gameCloud:"#FFFFFF",gameEdge:"#A5615A",shadow:"160,80,60"},
    dark:{sky1:"#27191A",sky2:"#382324",paper:"rgba(53,34,34,.86)",paperSolid:"#352222",ink:"#FCEAE6",muted:"#D2B0AA",accent:"#F4A493",accentText:"#FFC6B8",btnA:"#713F38",btnB:"#62352F",btnText:"#FFF0EC",line:"#4A302D",edge:"#F4A493",sun:"#F8E6CF",sunGlow:"#CDB79E",hillFar:"#553534",hill1:"#4A2D2B",hill2:"#3F2624",tree1:"#6B3E38",tree2:"#5D342F",trunk:"#2F1C1B",cloud:"#4A302D",cloudyBody:"#FFF2EE",cloudyShade:"#F0D2CA",cloudyLine:"#C08E85",cheek:"#E7A79C",gameCloud:"#C69488",gameEdge:"#F0D2CA",shadow:"0,0,0"}},
  night:{
    dark:{sky1:"#171C38",sky2:"#262D5C",paper:"rgba(38,45,82,.86)",paperSolid:"#262D52",ink:"#EEF0FF",muted:"#B3B9DA",accent:"#9FB2FF",accentText:"#C3CEFF",btnA:"#4C5799",btnB:"#3E4886",btnText:"#F3F5FF",line:"#353E70",edge:"#9FB2FF",sun:"#F3EED5",sunGlow:"#CFCBB0",hillFar:"#343D72",hill1:"#2B3366",hill2:"#232A57",tree1:"#3C4C84",tree2:"#334177",trunk:"#252C55",cloud:"#3B447A",cloudyBody:"#EDF0FF",cloudyShade:"#C8CEF2",cloudyLine:"#8F9AD3",cheek:"#C9A9D9",gameCloud:"#8C95CF",gameEdge:"#DDE1FF",shadow:"5,8,25"}}
};
/* PALETTES-END */

/**
 * Cloudy's body is always light, so his face always uses the scheme's dark text colour, also in dark mode (spec 2.1:
 * never `ink`, which is light in dark mode). Night's is its own (the demo's line after PALETTES-END).
 */
const NIGHT_FACE = "#2A2F5C";
const faceOf = (s: Scheme) => (s === "night" ? NIGHT_FACE : P[s as Exclude<Scheme, "night">].light.ink);

/** Every set: `PALETTES[scheme][mode]`. Night's light set is its dark set (Night has no light version). */
export const PALETTES = Object.fromEntries(
  SCHEMES.map((s) => {
    const src = P[s] as { light?: Omit<Tokens, "cloudyFace">; dark: Omit<Tokens, "cloudyFace"> };
    const dark: Tokens = { ...src.dark, cloudyFace: faceOf(s) };
    const light: Tokens = src.light ? { ...src.light, cloudyFace: faceOf(s) } : dark;
    return [s, { light, dark }];
  }),
) as Record<Scheme, Record<Mode, Tokens>>;

/** The 11 sets (spec 2.1): every scheme in each mode it has. */
export const SETS: [Scheme, Mode][] = SCHEMES.flatMap((s) => (s === "night" ? [[s, "dark"] as [Scheme, Mode]] : MODES.map((m) => [s, m] as [Scheme, Mode])));

/** The mode a scheme is shown in (Night is always dark). */
export const modeFor = (scheme: Scheme, mode: Mode): Mode => (scheme === "night" ? "dark" : mode);

// ---------------------------------------------------------------- derived surfaces
// A few pale tints of the scheme for chips, badges and soft panels. Each is a mix of a scheme token into
// `paperSolid`, worked out here so the contrast test can measure the text on it.

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c: number[]) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
/** `share` of colour `a` mixed into colour `b` (both "#RRGGBB"). */
export const mix = (a: string, b: string, share: number) => {
  const [x, y] = [hex(a), hex(b)];
  return toHex(x.map((v, i) => v * share + y[i] * (1 - share)));
};

/** WCAG relative luminance and contrast ratio of "#RRGGBB" colours (the contrast tests use these too). */
export const lum = (h: string) => {
  const [r, g, b] = hex(h).map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export const DERIVED_NAMES = ["tint", "tint2", "accentSoft", "sunSoft"] as const;
export type DerivedName = (typeof DERIVED_NAMES)[number];
export function derived(t: Tokens): Record<DerivedName, string> {
  const dark = lum(t.paperSolid) < 0.2;
  return {
    /** A pale wash of the near hill: soft chips, hover of a second button. */
    tint: mix(t.hill1, t.paperSolid, 0.4),
    /** A pale wash of the far hill: a second chip tone. */
    tint2: mix(t.hill2, t.paperSolid, 0.32),
    /** A pale wash of the accent, behind accent text (menu, soft buttons, chosen rows). */
    accentSoft: mix(t.accent, t.paperSolid, 0.2),
    /** A pale wash of the sun: notes, highlights. */
    sunSoft: mix(t.sunGlow, t.paperSolid, dark ? 0.14 : 0.35),
  };
}

/**
 * Cloudy's forms (spec 2.1, the 15 Nov `tones()`): [body, shade]. Cloud = cloudyBody with cloudyShade; bunny =
 * cloudyBody with an accent shade; cat = hill1; fox = accent; tiger = accentText; bear = hill2. The animal colours are
 * mixed into his light body, so his face (`cloudyFace`, dark) stays clear on every form (contrast test).
 */
export const CLOUDY_TONE_FORMS = ["cloud", "bunny", "cat", "fox", "tiger", "bear"] as const;
export function cloudyTones(t: Tokens): Record<string, string> {
  const into = (c: string, s: number) => mix(c, t.cloudyBody, s);
  const tones: Record<(typeof CLOUDY_TONE_FORMS)[number], [string, string]> = {
    cloud: [t.cloudyBody, t.cloudyShade],
    bunny: [t.cloudyBody, into(t.accent, 0.35)],
    cat: [into(t.hill1, 0.45), into(t.hill1, 0.75)],
    fox: [into(t.accent, 0.5), into(t.accent, 0.85)],
    tiger: [into(t.accentText, 0.3), into(t.accentText, 0.62)],
    bear: [into(t.hill2, 0.4), into(t.hill2, 0.72)],
  };
  return Object.fromEntries(Object.entries(tones).flatMap(([f, [b, s]]) => [[`cl-${f}`, b], [`cl-${f}-s`, s]]));
}

/** Every token of one set, with the derived ones. */
export const tokensOf = (scheme: Scheme, mode: Mode) => {
  const t = PALETTES[scheme][modeFor(scheme, mode)];
  return { ...t, ...derived(t), ...cloudyTones(t) };
};

/** The surfaces game items sit on: cards and targets (`paperSolid`) and the `surface-2` wells (`sky1`). */
export const TASK_SURFACES = ["paperSolid", "sky1"] as const;
/** Does a task colour need its 2 px ring in this set? Yes when one of its looks is below 3:1 on a game surface. */
export const taskRingOn = (name: string, scheme: Scheme, mode: Mode) => {
  const t = tokensOf(scheme, mode);
  return TASK_COLOURS[name].some((look) => TASK_SURFACES.some((s) => Math.max(...look.map((c) => contrast(c, t[s]))) < 3));
};
/** `--ring-<name>` of every task colour in one set: the set's `ink` where a ring is needed, else transparent. */
export const ringsOf = (scheme: Scheme, mode: Mode) =>
  Object.fromEntries(Object.keys(TASK_COLOURS).map((n) => [`ring-${n}`, taskRingOn(n, scheme, mode) ? tokensOf(scheme, mode).ink : "transparent"]));

/** The light shine on Cloudy, buttons and drops. Not a scheme colour: a highlight, the same in every set. */
const SHINE = "255,255,255";

const block = (sel: string, vars: Record<string, string>) => `${sel}{${Object.entries(vars).map(([k, v]) => `--${k}:${v};`).join("")}}`;

/** The CSS of every set, for one `<style>` in the root layout. The first block is also `:root` (Warm Hills, light). */
export const THEME_CSS = [
  block(":root", { shine: SHINE, "cvi-screen": VISION_COLOURS.screen }),
  ...SCHEMES.flatMap((s) =>
    MODES.map((m) => block(`${s === "warm" && m === "light" ? ":root," : ""}[data-scheme="${s}"][data-mode="${m}"]`, { ...tokensOf(s, m), ...ringsOf(s, m), stars: modeFor(s, m) === "dark" ? "1" : "0" })),
  ),
  // Vision mode (CVI): the child's one strong colour around every target (globals.css `[data-cvi]`).
  ...(["yellow", "red", "green", "blue"] as const).map((c) => block(`[data-cvi${c === "yellow" ? "" : `="${c}"`}]`, { "fk-cvi": VISION_COLOURS[c] })),
].join("\n");

/** The browser bar colour (layout.tsx `themeColor`): Warm Hills' page colour. */
export const THEME_COLOR = PALETTES.warm.light.sky1;

/** The round swatch of a scheme in the settings: its near hill into its accent (demo `swatchBg`). */
export const swatch = (s: Scheme) => {
  const t = PALETTES[s][s === "night" ? "dark" : "light"];
  return `linear-gradient(135deg, ${t.hill1} 0%, ${t.accent} 100%)`;
};
/** The accent of a scheme (the child's colour clouds are drawn in it). */
export const accentOf = (s: Scheme) => PALETTES[s][s === "night" ? "dark" : "light"].accent;
