import { expect, test, type Page } from "@playwright/test";
import { fromServer, newPhone, pick, signUp } from "./helpers";

// IQ4: the CEO's questionnaire against the real server, with a doctor's document uploaded to storage. Runs only
// when the server hands it out: start it with INTAKE_QUESTIONNAIRE=2026-10-16 (the other live tests need p41).

/** Next (or "Make the plan"); every required question still open gets "Not sure", then again, until the step changes. */
async function notSureToTheRest(page: Page) {
  const h1 = page.locator("h1");
  const before = await h1.innerText();
  const go = page.getByRole("button", { name: /^(Next|Make the plan)$/ });
  await go.click();
  const marked = page.locator("[id^=q-]").filter({ hasText: "Please answer this question" });
  await expect(h1.filter({ hasNotText: before }).or(marked.first())).toBeVisible();
  if (await h1.filter({ hasNotText: before }).count()) return;
  const open = marked.filter({ hasText: "Not sure" });
  while (await open.count()) await open.first().getByText("Not sure", { exact: true }).first().click();
  await go.click();
  await expect(h1).not.toHaveText(before);
}

test("a parent answers the new questionnaire on the server and gets a plan", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, newPhone("97"));
  const { active } = await fromServer(page, "/intake/questionnaire");
  test.skip(active === "p41", "the server asks P1-P41: start it with INTAKE_QUESTIONNAIRE=2026-10-16");

  await page.goto("/parent/children/new");
  await expect(page.getByRole("heading", { level: 1, name: "About your child and family" })).toBeVisible();
  await page.getByLabel(/What is your child's name/).fill("Malika");
  await page.getByLabel("Date of birth").fill("2019-05-01");
  await pick(page, "Boy or girl?", "Girl");
  await notSureToTheRest(page);
  const childId = new URL(page.url()).searchParams.get("child")!;

  await page.getByRole("button", { name: "I agree — continue" }).click();
  await pick(page, /given your child a diagnosis/, "Cerebral palsy");
  await page.locator("#q-B13 input[type=file]").setInputFiles({ name: "letter.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n") });
  await expect(page.locator("#q-B13 li")).toHaveCount(1);
  await notSureToTheRest(page);

  const ready = page.getByRole("heading", { name: "Malika's plan is ready" });
  for (let n = 0; n < 20 && !(await ready.isVisible()); n++) await notSureToTheRest(page);
  await expect(ready).toBeVisible();

  const round = await fromServer(page, `/children/${childId}/intake/1`);
  expect(round.questionnaire).toBe(active);
  expect(round.answers.B1).toEqual(["cp"]);
  expect(round.answers.B13[0]).toMatch(new RegExp(`^children/${childId}/intake/`));
  expect(round.completedAt).not.toBeNull();
  expect((await fromServer(page, `/children/${childId}/plan`)).days.length).toBeGreaterThan(0);
});
