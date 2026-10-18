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

test("grey Next points at the question still open", async ({ page }) => {
  await setup(page);
  await signUpByPhone(page, "+998 93 555 77 01");
  await page.getByLabel("Child's first name").fill("Lola");
  await pick(page, "Boy or girl", "Girl");
  await next(page); // date of birth, relationship and who fills it in are still open

  const card = page.locator("#q-P2");
  await expect(card.getByText("Please answer this question to continue.")).toBeVisible();
  await expect(card).toBeInViewport();
  await expect(page.getByLabel("Date of birth")).toBeFocused();
  await expect(page.locator("#q-P1").getByText("Please answer this question")).toHaveCount(0); // answered: not marked

  await page.getByLabel("Date of birth").fill("2019-05-01");
  await expect(card.getByText("Please answer this question")).toHaveCount(0); // the mark goes once answered
  await pick(page, "You are the child's…", "Mother");
  await pick(page, "Who is filling this in?", "Parent");
  await next(page);
  await expect(page.getByRole("button", { name: "I agree — continue" })).toBeVisible(); // moved on
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

test("Today is the first screen after sign-in: exercises with video and tool, and games", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  const today = page.getByRole("region", { name: "Today" });
  await expect(today).toBeVisible();
  const ali = today.getByRole("article").filter({ hasText: "Ali" });
  await expect(ali.getByText("Exercises", { exact: true })).toBeVisible();
  // each exercise plays its placeholder clip (C7) until the real video is approved
  const videos = ali.locator("video");
  expect(await videos.count()).toBeGreaterThan(0);
  for (const src of await videos.evaluateAll((v) => v.map((x) => (x as HTMLVideoElement).getAttribute("src")))) {
    expect(src).toMatch(/^\/placeholder-videos\/\w+\.en\.mp4$/);
    // the file is there (the test browser has no H.264 decoder; Chrome, Safari and phones play it)
    const file = await page.request.get(src!);
    expect([file.status(), file.headers()["content-type"]]).toEqual([200, "video/mp4"]);
  }
  await expect(ali.getByText("Games", { exact: true })).toBeVisible();
  // it comes before everything else on the page
  const top = await today.boundingBox();
  const kids = await page.getByRole("heading", { name: "Your children" }).boundingBox();
  expect(top!.y).toBeLessThan(kids!.y);
});

test("one tap marks an exercise done; two \"hard\" in a row make it easier next time", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  // today's first exercise, and the next day it comes back (the plan rotates exercises)
  const { title, next } = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    const plan = db.roadmaps.find((r: { childId: string }) => r.childId === "ch_ali");
    const today = plan.days.findIndex((d: { date: string }) => d.date === "2026-09-29");
    const videoId = plan.days[today].exercises[0].videoId;
    const later = plan.days.slice(today + 1).find((d: { exercises: { videoId: string }[] }) => d.exercises.some((e) => e.videoId === videoId));
    return { title: db.videos.find((v: { id: string }) => v.id === videoId).title.en as string, next: later.date as string };
  });
  const first = page.getByRole("region", { name: "Today" }).getByRole("listitem").filter({ hasText: title });
  await first.getByRole("button", { name: "Done" }).click();
  await expect(first.getByText("Done", { exact: true })).toBeVisible();
  await first.getByRole("button", { name: "Hard" }).click();
  await expect(first.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true");
  await expect(first.getByText("Next time: an easier version.")).toHaveCount(0); // one "hard" is not enough

  // the same exercise on a later day: the second "hard" in a row lowers its level
  await page.clock.setFixedTime(new Date(`${next}T10:00:00+05:00`));
  await page.reload();
  const again = page.getByRole("region", { name: "Today" }).getByRole("listitem").filter({ hasText: title });
  await again.getByRole("button", { name: "Done" }).click();
  await again.getByRole("button", { name: "Hard" }).click();
  await expect(again.getByText("Next time: an easier version.")).toBeVisible();
  await page.reload();
  await expect(again.getByRole("button", { name: "Hard" })).toHaveAttribute("aria-pressed", "true"); // saved
});

test("pause today: the day is not missed and the plan moves forward one day", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  const ali = page.getByRole("region", { name: "Today" }).getByRole("article").filter({ hasText: "Ali" });
  const todays = await ali.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Done" }) }).locator("p.font-extrabold").allInnerTexts();
  await ali.getByRole("button", { name: "Pause today" }).click();
  await expect(ali.getByText("Paused today. Rest well: the plan continues tomorrow.")).toBeVisible();
  const week = ali.getByRole("list", { name: "This week" });
  await expect(week.getByRole("listitem").filter({ hasText: "Paused" })).toHaveCount(1);
  await expect(week).not.toContainText(/missed/i);

  // tomorrow brings today's exercises
  await page.clock.setFixedTime(new Date("2026-09-30T10:00:00+05:00"));
  await page.reload();
  await expect(ali.getByRole("listitem").filter({ has: page.getByRole("button", { name: "Done" }) }).locator("p.font-extrabold")).toHaveText(todays);
  await expect(week.getByRole("listitem").filter({ hasText: "Paused" })).toHaveCount(1); // yesterday stays a pause
});

test("one daily question a day; the answer is saved", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  const ali = page.getByRole("region", { name: "Today" }).getByRole("article").filter({ hasText: "Ali" });
  const daily = ali.getByRole("group").filter({ hasText: "Question of the day" });
  await expect(daily).toHaveCount(1);
  const question = await daily.locator("p[id^=daily-]").innerText();
  await daily.getByRole("button", { name: "Sometimes or with help" }).click();
  await expect(daily.getByText("Thank you.", { exact: false })).toBeVisible();
  await page.reload();
  await expect(daily.getByRole("button", { name: "Sometimes or with help" })).toHaveAttribute("aria-pressed", "true");

  await page.clock.setFixedTime(new Date("2026-09-30T10:00:00+05:00"));
  await page.reload();
  await expect(daily.locator("p[id^=daily-]")).not.toHaveText(question); // a new question tomorrow
  await expect(daily.getByRole("button", { name: "Sometimes or with help" })).toHaveAttribute("aria-pressed", "false");
});

test("at 1 am Tashkent time the plan and the plan view use that day, like the Today screen", async ({ page }) => {
  await setup(page);
  await page.clock.setFixedTime(new Date("2026-09-29T01:00:00+05:00")); // still the 28th in UTC
  await loginAs(page, "Parent");
  const week = page.getByRole("region", { name: "Today" }).getByRole("list", { name: "This week" });
  await expect(week.getByRole("listitem").filter({ hasText: "Today" })).toContainText("29");
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("tab", { name: "Plan" }).click();
  await page.getByRole("button", { name: "Week 1" }).click(); // Ali's plan started 3 days ago, on the 26th
  const days = page.locator("li").filter({ has: page.getByText("Games", { exact: true }) });
  await expect(days.first()).toContainText("26");
  await expect(days.filter({ has: page.getByText("Today", { exact: true }) })).toContainText("29");
});

test("Uzbek Cyrillic is a full app language", async ({ page }) => {
  await setup(page);
  await page.goto("/signup");
  await page.evaluate(() => localStorage.setItem("fk_lang", "null")); // nobody chose a language on this device yet
  await page.reload();
  await page.getByRole("button", { name: "Ўзбекча (Кирилл)" }).click();
  await expect(page.getByRole("heading", { name: "Телефон рақамингиз билан киринг" })).toBeVisible();
});
