import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// Public site: /uz /ru /en URLs, server-rendered language, hreflang, redirects, sitemap (PRD §9.19, §21).
test.describe("public site i18n + SEO", () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== "desktop", "HTTP-level checks"));

  test("old URLs redirect by saved choice, then Accept-Language, then Uzbek", async ({ request }) => {
    const go = (path: string, headers: Record<string, string>) => request.get(path, { headers, maxRedirects: 0 });
    expect((await go("/", { "accept-language": "ru-RU,ru;q=0.9" })).headers().location).toBe("/ru");
    expect((await go("/pricing", { "accept-language": "de-DE" })).headers().location).toBe("/uz/pricing");
    expect((await go("/terms", { "accept-language": "ru", cookie: "fk_lang=en" })).headers().location).toBe("/en/terms");
    expect((await go("/", {})).status()).toBe(307);
  });

  test("pages are server-rendered in the URL's language with hreflang alternates", async ({ request }) => {
    const html = await (await request.get("/ru/pricing")).text();
    expect(html).toContain("Простые и честные цены"); // in the HTML itself, before any JavaScript
    expect(html).toMatch(/<div lang="ru">/);
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+\/ru\/pricing"/);
    for (const l of ["uz", "en", "x-default"]) expect(html).toMatch(new RegExp(`<link rel="alternate" hrefLang="${l}" href="https://[^"]+/(uz|en)/pricing"`));
    expect(html).toMatch(/<title>Простые и честные цены · FlexiKeys<\/title>/);
    expect(html).toContain('property="og:locale" content="ru_RU"');
  });

  test("unknown language segments are 404", async ({ request }) => {
    expect((await request.get("/fr/pricing")).status()).toBe(404);
  });

  test("sitemap lists every page in every language; robots keeps app areas out", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml.match(/<url>/g)).toHaveLength(12);
    expect(xml).toContain("/ru/privacy</loc>");
    const robots = await (await request.get("/robots.txt")).text();
    for (const p of ["/parent", "/play", "/admin"]) expect(robots).toContain(`Disallow: ${p}`);
  });

  test("language switcher moves to the same page in the other language", async ({ page }) => {
    await setup(page);
    await page.goto("/en/pricing");
    await page.getByRole("banner").getByRole("combobox").first().selectOption("ru");
    await expect(page).toHaveURL(/\/ru\/pricing$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Простые и честные цены");
    await expect(page.getByRole("banner").getByRole("link", { name: "Цены" }).first()).toHaveAttribute("href", "/ru/pricing");
  });

  test("header knows you're signed in without loading the app", async ({ page }) => {
    await setup(page);
    await loginAs(page, "Parent");
    await page.goto("/en");
    await expect(page.getByRole("banner").getByRole("link", { name: "My dashboard" }).first()).toHaveAttribute("href", "/parent");
  });
});

test("public pages hydrate cleanly with translated text (no raw keys, no hydration errors)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  for (const path of ["/en", "/ru/pricing", "/uz/privacy", "/en/terms"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const text = await page.locator("body").innerText();
    expect(text.match(/\b(mkt|nav|brand|common)\.[a-z][\w.]*/g), path).toBeNull();
  }
  // Client-side navigation (no server render) must translate too.
  await page.getByRole("banner").getByRole("combobox").first().selectOption("ru");
  await expect(page).toHaveURL(/\/ru\/terms$/);
  expect((await page.locator("body").innerText()).match(/\bmkt\.[a-z][\w.]*/g)).toBeNull();
  expect(errors).toEqual([]);
});
