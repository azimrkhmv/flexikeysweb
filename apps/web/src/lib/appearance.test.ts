import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// B110, Update 3 spec 4: the parent's and the children's looks, stored on the device. No DOM library in this repo,
// so localStorage, <html> and matchMedia are small stand-ins.

let store: Map<string, string>;
let html: { dataset: Record<string, string>; classList: { add: () => void; remove: () => void } };

async function fresh() {
  vi.resetModules();
  return import("./appearance");
}

beforeEach(() => {
  store = new Map();
  html = { dataset: {}, classList: { add() {}, remove() {} } };
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
  vi.stubGlobal("document", { documentElement: html });
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
});

describe("the parent's look", () => {
  it("starts as Warm Hills, light, Soft", async () => {
    const a = await fresh();
    expect(a.readParent()).toEqual({ scheme: "warm", mode: "light", style: "soft", lastDay: "warm" });
  });

  it("applies at once to <html> and is kept on the device", async () => {
    const a = await fresh();
    a.setParentLook({ scheme: "mint", style: "sharp" });
    a.setParentMode("dark");
    expect(html.dataset).toEqual({ scheme: "mint", mode: "dark", style: "sharp" });
    expect(JSON.parse(store.get("fk-look")!)).toMatchObject({ scheme: "mint", mode: "dark", style: "sharp" });
    const b = await fresh(); // a new page
    expect(b.readParent()).toMatchObject({ scheme: "mint", mode: "dark", style: "sharp" });
  });

  it("Night is always dark; Light from Night goes back to the last day scheme, light", async () => {
    const a = await fresh();
    a.setParentLook({ scheme: "lilac" });
    a.setParentLook({ scheme: "night", mode: "light" });
    expect(html.dataset.mode).toBe("dark");
    a.setParentMode("light");
    expect(a.readParent()).toMatchObject({ scheme: "lilac", mode: "light" });
  });

  it("Light from Night with no day scheme used goes to Warm Hills", async () => {
    store.set("fk-look", JSON.stringify({ scheme: "night", mode: "dark" }));
    const a = await fresh();
    a.setParentMode("light");
    expect(a.readParent()).toMatchObject({ scheme: "warm", mode: "light" });
  });

  it("reads the 15 Nov choice once", async () => {
    store.set("fk-pal", "hills");
    expect((await fresh()).readParent().scheme).toBe("warm");
    store.set("fk-pal", "sky");
    expect((await fresh()).readParent().scheme).toBe("sky");
  });

  it("a broken or blocked store gives the default", async () => {
    store.set("fk-look", "{nope");
    expect((await fresh()).readParent().scheme).toBe("warm");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    const a = await fresh();
    expect(() => a.setParentLook({ scheme: "peach" })).not.toThrow();
    expect(html.dataset.scheme).toBe("peach");
  });
});

describe("a child's look", () => {
  it("a new child starts with the parent's scheme and Soft", async () => {
    const a = await fresh();
    a.setParentLook({ scheme: "sky", style: "sharp" });
    expect(a.readChild("ch-1")).toEqual({ scheme: "sky", style: "soft" });
  });

  it("is kept per child, so siblings on one tablet keep their own", async () => {
    const a = await fresh();
    a.setChildLook("ch-1", { scheme: "peach" });
    a.setChildLook("ch-2", { scheme: "mint", style: "sharp" });
    const b = await fresh();
    expect(b.readChild("ch-1")).toEqual({ scheme: "peach", style: "soft" });
    expect(b.readChild("ch-2")).toEqual({ scheme: "mint", style: "sharp" });
    expect(store.has("fk-look-child-ch-1") && store.has("fk-look-child-ch-2")).toBe(true);
  });

  it("changes only the child's pages and takes the parent's light or dark", async () => {
    const a = await fresh();
    a.setParentLook({ scheme: "lilac", mode: "dark" });
    a.setChildLook("ch-1", { scheme: "sky", style: "sharp" });
    expect(a.readParent().scheme).toBe("lilac");
    expect(html.dataset.scheme).toBe("lilac"); // no play page open: the parent's look
  });

  it("is dark while the parent is on Night (Night is always dark)", async () => {
    const a = await fresh();
    a.setParentLook({ scheme: "night" });
    expect(a.readParent().mode).toBe("dark");
  });
});

describe("the landing page (B116)", () => {
  const paint = async (pathname: string) => {
    const { APPEARANCE_SCRIPT } = await import("./appearanceScript");
    vi.stubGlobal("location", { pathname });
    new Function(APPEARANCE_SCRIPT)();
    return { ...html.dataset };
  };
  it("is always Warm Hills light, Soft, whatever was saved", async () => {
    store.set("fk-look", JSON.stringify({ scheme: "night", mode: "dark", style: "sharp" }));
    for (const p of ["/", "/uz", "/ru/", "/en"]) expect(await paint(p)).toEqual({ scheme: "warm", mode: "light", style: "soft" });
    expect(await paint("/parent")).toEqual({ scheme: "night", mode: "dark", style: "sharp" });
    expect(await paint("/en/privacy")).toEqual({ scheme: "night", mode: "dark", style: "sharp" });
  });
});

describe("where people choose", () => {
  // Spec 4.1, decision 0.1: look controls only in Account → Appearance and on the child's play home.
  const SRC = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.tsx?$/.test(n) && !/\.test\./.test(n) ? [join(d, n)] : []));
  it("no colour, style or light/dark control anywhere else", () => {
    const users = walk(SRC)
      .filter((p) => /\b(setParentLook|setParentMode|setChildLook|AppearanceSettings|MyColoursSheet|MyColoursButton)\b/.test(readFileSync(p, "utf8")))
      .map((p) => relative(SRC, p).split(sep).join("/"))
      .sort();
    expect(users).toEqual(["app/parent/account/page.tsx", "components/AppearanceSettings.tsx", "features/play/ChildMode.tsx", "features/play/MyColours.tsx", "lib/appearance.ts"]);
  });
  it("My colours is only on the world map and the Skill games tab", () => {
    const code = readFileSync(join(SRC, "features/play/ChildMode.tsx"), "utf8");
    expect(code).toMatch(/\(view\.v === "map" \|\| view\.v === "skills"\) && <MyColoursButton/);
  });
});
