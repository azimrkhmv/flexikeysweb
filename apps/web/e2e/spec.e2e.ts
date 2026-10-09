import { expect, test, type Page } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// Product spec 2026-10-06, build items #1–#4: phone sign-up → intake → roadmap; physio review gates videos.

const pick = (page: Page, question: string | RegExp, option: string) => page.getByRole("group", { name: question }).getByText(option, { exact: true }).click();
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const skip = (page: Page) => page.getByRole("button", { name: "Skip for now" }).click();

async function signUpByPhone(page: Page, phone: string) {
  await page.goto("/signup");
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  // Basic consent + district are required before anything else.
  await page.getByLabel("District").selectOption("Yunusobod");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please agree to continue")).toBeVisible();
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
}

async function childStep(page: Page, name: string) {
  await page.getByLabel("Child's first name").fill(name);
  await page.getByLabel("Date of birth").fill("2019-05-01");
  await pick(page, "Boy or girl", "Boy");
  await pick(page, "You are the child's…", "Mother");
  await pick(page, "Who is filling this in?", "Parent");
  await next(page);
}

async function abilities(page: Page, step: string) {
  await expect(page.getByRole("heading", { level: 1, name: `Everyday abilities: ${step}` })).toBeVisible();
  for (const group of await page.getByRole("group").all()) {
    const yes = group.getByText("Yes", { exact: true });
    await ((await yes.count()) ? yes : group.getByText(/^(Words|Letters)$/)).click();
  }
  await next(page);
}

test("phone sign-up → intake with a restriction → 4-week plan without that exercise", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one full journey is enough");
  await setup(page);
  await signUpByPhone(page, "+998 93 555 12 34");
  await childStep(page, "Aziz");

  await page.getByRole("button", { name: "I agree — continue" }).click();
  await page.getByRole("group", { name: "What has a doctor said?" }).getByText("Speech delay").click();
  await pick(page, "How does your child usually move?", "Walks alone");
  await next(page);
  await pick(page, /seizures/, "Never");
  await pick(page, /must not do/, "No jumping");
  await pick(page, /Surgery, cast or Botox/, "No");
  await next(page);
  await abilities(page, "talking");
  await abilities(page, "hands and moving");
  await abilities(page, "seeing, hearing, daily life");
  await page.getByRole("group", { name: /do better in the next 3 months/ }).getByText("Walk more steadily").click();
  await page.getByRole("group", { name: /do better in the next 3 months/ }).getByText("Use hands better").click();
  await pick(page, /How much time/, "20 minutes");
  await next(page);
  await skip(page); // routine
  await skip(page); // own words
  await skip(page); // videos
  await page.getByRole("button", { name: "Make the plan" }).click();

  await expect(page.getByRole("heading", { name: "Aziz's plan is ready" })).toBeVisible();
  await page.getByRole("link", { name: "See the plan" }).click();
  await expect(page.getByRole("heading", { name: "Why this plan" })).toBeVisible();
  for (let w = 1; w <= 4; w++) {
    await page.getByRole("button", { name: `Week ${w}` }).click();
    const days = page.locator("li").filter({ has: page.getByText("Exercises", { exact: true }) });
    await expect(days).toHaveCount(7);
    for (const d of await days.all()) {
      const n = await d.locator("ul").first().locator("li").count();
      expect(n).toBeGreaterThanOrEqual(2);
      expect(n).toBeLessThanOrEqual(3);
    }
    await expect(page.getByText("Bunny hops")).toHaveCount(0); // tagged "jumping"
  }
});

test("health consent declined → games only", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await signUpByPhone(page, "+998 93 555 98 76");
  await childStep(page, "Malika");
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page.getByText("the plan will have games and Find help only")).toBeVisible();
  await abilities(page, "talking");
  await abilities(page, "hands and moving");
  await abilities(page, "seeing, hearing, daily life");
  await page.getByRole("group", { name: /do better in the next 3 months/ }).getByText("Understand more").click();
  await pick(page, /How much time/, "10 minutes");
  await next(page);
  await skip(page);
  await skip(page);
  await page.getByRole("button", { name: "Make the plan" }).click();
  await expect(page.getByText("Four weeks of games.")).toBeVisible();
  await page.getByRole("link", { name: "See the plan" }).click();
  await expect(page.getByText("Exercises", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Games", { exact: true }).first()).toBeVisible();
});

test("physio approves a queued video; the decision is recorded", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Video reviewer");
  await expect(page.getByRole("heading", { name: "Exercise video review" })).toBeVisible();
  const item = page.locator("li").filter({ hasText: "Sort by colour with tongs" }).filter({ hasText: "English" });
  await item.getByRole("button", { name: "Request changes" }).click();
  await expect(item.getByText("Please add a short note")).toBeVisible();
  await item.getByRole("button", { name: "Approve" }).click();
  await expect(page.locator("li").filter({ hasText: "Sort by colour with tongs" }).filter({ hasText: "English" })).toHaveCount(0);
  await page.getByLabel("Show").selectOption("approved");
  await expect(page.locator("li").filter({ hasText: "Sort by colour with tongs" }).filter({ hasText: "English" })).toContainText("Approved by Rustam Yusupov");
});

test("Uzbek Cyrillic is a full app language", async ({ page }) => {
  await setup(page);
  await page.goto("/signup");
  await page.evaluate(() => localStorage.setItem("fk_lang", "null")); // nobody chose a language on this device yet
  await page.reload();
  await page.getByRole("button", { name: "Ўзбекча (Кирилл)" }).click();
  await expect(page.getByRole("heading", { name: "Телефон рақамингиз билан киринг" })).toBeVisible();
});
