import { expect, type Page } from "@playwright/test";

/** Fixed clock + English UI so seeded demo data and copy are the same on every run. */
export async function setup(page: Page, lang: "en" | "uz" | "ru" = "en") {
  await page.clock.setFixedTime(new Date("2026-09-29T10:00:00+05:00"));
  await page.addInitScript((l) => {
    if (!localStorage.getItem("fk_lang")) localStorage.setItem("fk_lang", JSON.stringify(l));
  }, lang);
}

/** Signs in with one of the seeded demo accounts via the login page's demo buttons. */
export async function loginAs(page: Page, role: "Parent" | "Teacher" | "Therapist" | "Admin") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Log in: ${role}` }).click();
  await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}`));
}

// Parent gate labels + number words per child UI language (the question is written in words for pre-readers).
const GATE = {
  en: { pause: "Pause", exit: "For grown-ups", hold: "Press and hold for 2 seconds", q: /^How much is (\S+) plus (\S+)\?/, nums: { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 } as Record<string, number> },
  uz: { pause: "Pauza", exit: "Kattalar uchun", hold: "2 soniya bosib turing", q: /^(\S+) qoʻshuv (\S+) necha/, nums: { uch: 3, "toʻrt": 4, besh: 5, olti: 6, yetti: 7, sakkiz: 8, "toʻqqiz": 9 } as Record<string, number> },
};

/** Leaves child mode the only allowed way: Pause → For grown-ups → hold 2 s → answer the sum. */
export async function exitThroughGate(page: Page, lang: "en" | "uz") {
  const g = GATE[lang];
  await page.getByRole("button", { name: g.pause }).press("Enter");
  await page.getByRole("button", { name: g.exit }).press("Enter");
  await page.getByRole("button", { name: g.hold }).focus();
  await page.keyboard.down("Enter");
  await page.waitForTimeout(2200);
  await page.keyboard.up("Enter");
  const question = page.getByRole("dialog").locator("p").first();
  const [, a, b] = (await question.innerText()).match(g.q)!;
  await page.getByRole("button", { name: String(g.nums[a] + g.nums[b]), exact: true }).click();
}
