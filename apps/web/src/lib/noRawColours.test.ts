import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// B107, Update 3 spec 2.2: no component or stylesheet in apps/web/src has a colour of its own. Every colour comes from
// the scheme tokens (lib/theme.ts) or is a task colour (content/taskColors.ts). Anything else must be in
// colourAllowList.txt with a reason. This is what stops "purple page, green trees".

const SRC = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const EXEMPT = ["lib/theme.ts", "content/taskColors.ts"];
const allow = readFileSync(join(SRC, "colourAllowList.txt"), "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"))
  .map((l) => {
    const [path, reason] = l.split(/\s+—\s+|\s+--\s+/);
    return { path: path.trim(), reason: reason?.trim() ?? "" };
  });

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === "server" && dir.endsWith(`${sep}lib`) ? [] : files(p); // lib/server: generated API types
    return /\.(tsx?|css)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

const NAMED = "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ");
const TW = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTIL = "bg|text|border(?:-[trblxyse])?|from|to|via|ring|ring-offset|fill|stroke|outline|shadow|divide|accent|caret|decoration|placeholder";

const RULES: [what: string, re: RegExp][] = [
  ["a hex colour", /(?<![\w&/$-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g],
  ["a colour function (rgba(var(--shadow), a) is the one allowed form)", /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*(?!var\()/g],
  ["a Tailwind palette colour", new RegExp(`(?<![\\w-])(?:${UTIL})-(?:white|black|(?:${TW})-\\d{2,3})(?![\\w-])`, "g")],
];
// A named colour as a value. In TypeScript `color: "yellow"` is usually a game's data (the name of a task colour in
// content/taskColors.ts), so there only the drawing and background props count; in CSS every colour property does.
const named = (props: string) => new RegExp(`(?:\\b(?:${props})\\s*[:=]\\s*\\{?\\s*["'\`]?[^"'\`;{}\\n]*?)(?<![\\w.$-])(${NAMED.join("|")})(?![\\w-])`, "g");
const NAMED_TS = named("fill|stroke|stopColor|floodColor|background|backgroundColor|borderColor|outlineColor|boxShadow|textShadow|WebkitTextStroke");
const NAMED_CSS = named("fill|stroke|stop-color|flood-color|color|background|background-color|border|border-color|outline|outline-color|box-shadow|text-shadow|-webkit-text-stroke|caret-color|accent-color");

/** Comments are not code: "#104" in a note or "white" in an explanation is fine. */
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

describe("no colour outside the tokens", () => {
  const all = files(SRC).map((p) => relative(SRC, p).split(sep).join("/"));
  it("finds the source files", () => expect(all.length).toBeGreaterThan(100));
  it("every allow-list line names a file that exists and gives a reason", () => {
    for (const a of allow) {
      expect(all, a.path).toContain(a.path);
      expect(a.reason.length, `${a.path} needs a reason`).toBeGreaterThan(10);
    }
  });
  it("the rules catch raw colours and let tokens through", () => {
    const hits = (line: string, css = false) => [...RULES, ["", css ? NAMED_CSS : NAMED_TS] as [string, RegExp]].some(([, re]) => [...line.matchAll(re)].length > 0);
    for (const bad of [`fill="#fff"`, `className="text-[#8f3a2c]"`, `background: "rgb(1 2 3)"`, `className="text-white"`, `className="bg-sky-200"`, `stroke="red"`, `color: hsl(1 2% 3%)`])
      expect(hits(bad), bad).toBe(true);
    expect(hits("a { color: white; }", true)).toBe(true);
    for (const ok of [`fill="var(--accent)"`, `boxShadow: "0 4px 8px rgba(var(--shadow), .1)"`, `href="#main"`, `color: "yellow"`, `fill={GOOGLE_LOGO.red}`, `id="fk-gate-title"`, `className="bg-surface text-ink"`])
      expect(hits(ok), ok).toBe(false);
  });
  const checked = all.filter((p) => !EXEMPT.includes(p) && !allow.some((a) => a.path === p));
  it("no component or stylesheet has a raw colour", () => {
    const found: string[] = [];
    for (const p of checked) {
      const lines = stripComments(readFileSync(join(SRC, p), "utf8")).split("\n");
      const rules: [string, RegExp][] = [...RULES, ["a named colour", p.endsWith(".css") ? NAMED_CSS : NAMED_TS]];
      lines.forEach((line, i) => {
        for (const [what, re] of rules) for (const m of line.matchAll(re)) found.push(`${p}:${i + 1}: ${what}: ${m[1] ?? m[0]}`);
      });
    }
    expect(found).toEqual([]);
  });
});
