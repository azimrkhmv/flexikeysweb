import { expect, test, type Page } from "@playwright/test";
import { birthDate, setup } from "./helpers";

// IQ4: the CEO's questionnaire (16 Oct 2026) on the website: section A makes the child, the health consent opens
// sections B, the modules and E, the diagnosis opens its module, and finishing builds the plan.

const pick = (page: Page, question: string | RegExp, option: string) => page.getByRole("group", { name: question }).getByText(option, { exact: true }).click();

/** Next (or "Make the plan"); every required question still open gets "Not sure", then again, until the step changes. */
async function notSureToTheRest(page: Page) {
  const h1 = page.locator("h1");
  const before = await h1.innerText();
  const go = page.getByRole("button", { name: /^(Next|Make the plan)$/ });
  await go.click();
  const marked = page.locator("[id^=q-]").filter({ hasText: "Please answer this question" });
  await expect(h1.filter({ hasNotText: before }).or(marked.first())).toBeVisible();
  if (await h1.filter({ hasNotText: before }).count()) return;
  // Answering a card removes its mark, so always take the first one still marked.
  const open = marked.filter({ hasText: "Not sure" });
  while (await open.count()) await open.first().getByText("Not sure", { exact: true }).first().click();
  await go.click();
  await expect(h1).not.toHaveText(before);
}

test("a parent answers the new questionnaire and gets a plan", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one full journey is enough");
  test.setTimeout(120_000);
  await setup(page);
  await page.goto("/signup");
  await page.getByLabel("Phone number").fill("+998 93 555 40 16");
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("District").selectOption("Yunusobod");
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
  await page.goto("/parent/children/new?q=2026-10-16");

  await expect(page.getByRole("heading", { level: 1, name: "About your child and family" })).toBeVisible();
  await expect(page.locator("#q-A2").getByText("Not sure")).toHaveCount(0); // name and birthday have no "Not sure"
  await page.getByLabel(/What is your child's name/).fill("Malika");
  await birthDate(page, "2019-05-01");
  await pick(page, "Boy or girl?", "Girl");
  await page.getByLabel(/^Height/).fill("110"); // B60: required, no "Not sure"
  await page.getByLabel(/^Weight/).fill("18");
  await pick(page, "Who is filling this in?", "Mother");
  await pick(page, "Language you speak with your child at home", "Uzbek");
  await pick(page, "How many adults can help with exercises at home?", "Only me");
  await notSureToTheRest(page);

  await page.getByRole("button", { name: "I agree — continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Diagnosis and medical history" })).toBeVisible();
  await pick(page, /given your child a diagnosis/, "Cerebral palsy");
  await pick(page, /Which parts of the body are affected/, "Left arm"); // B61: no "Not sure"
  await notSureToTheRest(page);
  await expect(page.getByRole("heading", { level: 1, name: "Cerebral palsy" })).toBeVisible(); // the CP module opened (R1)

  const ready = page.getByRole("heading", { name: "Malika's plan is ready" });
  for (let n = 0; n < 20 && !(await ready.isVisible()); n++) await notSureToTheRest(page);
  await expect(page.getByRole("heading", { name: "Malika's plan is ready" })).toBeVisible();

  const saved = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    const kid = db.children.find((c: { name: string }) => c.name === "Malika");
    const round = db.intakeRounds.find((r: { childId: string }) => r.childId === kid.id);
    const answers = Object.fromEntries(db.intakeAnswers.filter((a: { childId: string }) => a.childId === kid.id).map((a: { questionId: string; value: unknown }) => [a.questionId, a.value]));
    return { questionnaire: round.questionnaire, sex: kid.sex, B1: answers.B1, P: Object.keys(answers).filter((k) => /^P\d/.test(k)) };
  });
  expect(saved).toEqual({ questionnaire: "2026-10-16", sex: "girl", B1: ["cp"], P: [] });
});
