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
  const open = marked.filter({ hasText: /Not sure|Don't know/ }); // CP1_types, DS1 and E1 have their own "Don't know"
  while (await open.count()) await open.first().getByText(/^(Not sure|Don't know)$/).first().click();
  await go.click();
  await expect(h1).not.toHaveText(before);
}

test("a section opens with its big title on open and going forward, never going back (B73, B79)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one journey is enough");
  await setup(page);
  await page.goto("/signup");
  await page.getByLabel("Phone number").fill("+998 93 555 40 17");
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("District").selectOption("Yunusobod");
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
  await page.goto("/parent/children/new?q=2026-10-16");

  const intro = page.locator("[data-to=section-title]");
  await expect(intro).toHaveText("About your child and family"); // B79: Section 1 has one too
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "About your child and family" })).toBeFocused();
  await page.getByLabel(/What is your child's name/).fill("Malika");
  await birthDate(page, "2019-05-01");
  await pick(page, "Boy or girl?", "Girl");
  await page.getByLabel("Height (cm)").fill("110");
  await page.getByLabel("Weight (kg)").fill("18");
  await pick(page, "Who is filling this in?", "Mother");
  await pick(page, /^Languages you speak with your child at home/, "Uzbek");
  await pick(page, "How many adults can help with exercises at home?", "Only me");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "I agree — continue" }).click();

  await expect(intro).toHaveText("Diagnosis and medical history");
  await expect(intro).toHaveCount(0); // gone by itself, in under 2 seconds
  await expect(page.getByRole("heading", { level: 1, name: "Diagnosis and medical history" })).toBeFocused(); // read once
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "About your child and family" })).toBeVisible();
  await expect(intro).toHaveCount(0);
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Diagnosis and medical history" })).toBeVisible();
  await expect(intro).toHaveCount(0); // already seen in this visit

  // B79: "Save and finish later", then back another day: the intro of the section the parent stopped at plays again.
  const again = page.url();
  await page.getByRole("button", { name: "Save and finish later" }).click();
  await expect(page).toHaveURL(/\/parent$/);
  await page.goto(again);
  await expect(intro).toHaveText("Diagnosis and medical history");
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Diagnosis and medical history" })).toBeFocused();
});

test("No difficulty skips a section; the Quick check starts filled in; details wait behind a link (B76)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one journey is enough");
  test.setTimeout(120_000);
  await setup(page);
  await page.goto("/signup");
  await page.getByLabel("Phone number").fill("+998 93 555 40 18");
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("District").selectOption("Yunusobod");
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
  await page.goto("/parent/children/new?q=2026-10-16");

  await expect(page.locator("#q-A10")).toHaveCount(0); // behind the link
  await page.getByRole("button", { name: "Add more details (optional)" }).click();
  await expect(page.locator("#q-A10")).toBeVisible();
  await page.getByLabel(/What is your child's name/).fill("Nigora");
  await birthDate(page, "2016-05-01");
  await pick(page, "Boy or girl?", "Girl");
  await page.getByLabel("Height (cm)").fill("140");
  await page.getByLabel("Weight (kg)").fill("32");
  await pick(page, "Who is filling this in?", "Mother");
  await pick(page, /^Languages you speak with your child at home/, "Uzbek");
  await pick(page, "How many adults can help with exercises at home?", "Only me");
  await notSureToTheRest(page);
  await page.getByRole("button", { name: "I agree — continue" }).click();

  await pick(page, /given your child a diagnosis/, "Developmental delay");
  await pick(page, /Which parts of the body are affected/, "Face and mouth (eating, talking)");
  await notSureToTheRest(page);

  await expect(page.getByRole("heading", { level: 1, name: "Quick check" })).toBeVisible();
  await expect(page.getByRole("group", { name: /^Moving/ }).getByRole("radio", { name: "No difficulty" })).toBeChecked(); // B3_parts: face and mouth only
  await expect(page.locator("#q-QC_move").getByText("Not sure")).toHaveCount(0);
  await pick(page, /^Using the hands/, "No difficulty");
  await pick(page, /^Body/, "A little");
  await pick(page, /^Seeing/, "No difficulty");
  await pick(page, /^Talking/, "A little");
  await pick(page, /^Everyday care/, "No difficulty");
  await page.getByRole("button", { name: "Next" }).click();

  const ready = page.getByRole("heading", { name: "Nigora's plan is ready" });
  const seen: string[] = [];
  for (let n = 0; n < 12 && !(await ready.isVisible()); n++) {
    seen.push(await page.locator("h1").innerText());
    await notSureToTheRest(page);
  }
  await expect(ready).toBeVisible();
  expect(seen).not.toContain("Hands"); // "No difficulty", nothing left to ask
  expect(seen).toContain("Everyday life"); // H5_calm and H5_active are always asked
  const saved = await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    const kid = db.children.find((c: { name: string }) => c.name === "Nigora");
    return Object.fromEntries(db.intakeAnswers.filter((a: { childId: string }) => a.childId === kid.id).map((a: { questionId: string; value: unknown }) => [a.questionId, a.value]));
  });
  expect(Object.keys(saved)).toContain("QC_move");
  expect(saved.QC_move).toBe("none");
  expect(saved.C6).toBeUndefined(); // worked out on read, never saved
});

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
  await page.getByLabel("Height (cm)").fill("110"); // B60: required, no "Not sure"
  await page.getByLabel("Weight (kg)").fill("18");
  await pick(page, "Who is filling this in?", "Mother");
  await pick(page, /^Languages you speak with your child at home/, "Uzbek");
  await pick(page, "How many adults can help with exercises at home?", "Only me");
  await notSureToTheRest(page);

  await page.getByRole("button", { name: "I agree — continue" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Diagnosis and medical history" })).toBeVisible();
  await pick(page, /given your child a diagnosis/, "Cerebral palsy");
  await pick(page, /Which parts of the body are affected/, "Left arm"); // B61: no "Not sure"
  await notSureToTheRest(page);

  // B76: the Quick check comes next; "A lot" in every row keeps the whole questionnaire.
  await expect(page.getByRole("heading", { level: 1, name: "Quick check" })).toBeVisible();
  for (const row of [/^Moving/, /^Using the hands/, /^Body/, /^Seeing/, /^Talking/, /^Everyday care/]) await pick(page, row, "A lot");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Cerebral palsy" })).toBeVisible(); // the CP module opened (R1)

  const ready = page.getByRole("heading", { name: "Malika's plan is ready" });
  let cleared = false;
  for (let n = 0; n < 20 && !(await ready.isVisible()); n++) {
    const c14 = page.locator("#q-C14");
    if (!cleared && (await c14.count())) {
      // B63: an optional step question offers "Not sure", and choosing an answer again clears it.
      await expect(c14.getByText("Not sure", { exact: true })).toBeVisible();
      const lifts = c14.getByRole("checkbox", { name: "Lifts the head for a moment" }); // a step-by-step question (B68)
      await c14.getByText("Lifts the head for a moment").click();
      await expect(lifts).toBeChecked();
      await c14.getByText("Lifts the head for a moment").click();
      await expect(lifts).not.toBeChecked();
      cleared = true;
    }
    await notSureToTheRest(page);
  }
  expect(cleared).toBe(true);
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
