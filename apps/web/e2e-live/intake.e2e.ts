import { expect, test, type Page } from "@playwright/test";

// B4: the parent questions against the real server: answer half, stop, come back later, finish, get a plan.

const pick = (page: Page, question: string | RegExp, option: string) => page.getByRole("group", { name: question }).getByText(option, { exact: true }).click();
const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
const skip = (page: Page) => page.getByRole("button", { name: "Skip for now" }).click();

async function signUp(page: Page) {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await page.goto("/login");
  const english = page.getByRole("button", { name: "English" });
  if (await english.isVisible()) await english.click();
  await page.getByLabel("Phone number").fill(`95${String(Date.now()).slice(-7)}`);
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("District").selectOption({ index: 1 });
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
}

async function abilities(page: Page, step: string) {
  await expect(page.getByRole("heading", { level: 1, name: `Everyday abilities: ${step}` })).toBeVisible();
  for (const group of await page.getByRole("group").all()) {
    const yes = group.getByText("Yes", { exact: true });
    await ((await yes.count()) ? yes : group.getByText(/^(Words|Letters)$/)).click();
  }
  await next(page);
}

test("a parent answers half the questions, stops, continues later and gets a plan", async ({ page }) => {
  await signUp(page);
  await page.getByLabel("Child's first name").fill("Aziz");
  await page.getByLabel("Date of birth").fill("2019-05-01");
  await pick(page, "Boy or girl", "Boy");
  await pick(page, "You are the child's…", "Mother");
  await pick(page, "Who is filling this in?", "Parent");
  await next(page);
  await expect(page).toHaveURL(/child=/);
  const childId = new URL(page.url()).searchParams.get("child")!;

  await page.getByRole("button", { name: "I agree — continue" }).click();
  await page.getByRole("group", { name: "What has a doctor said?" }).getByText("Speech delay").click();
  await pick(page, "How does your child usually move?", "Walks alone");
  await next(page);
  await pick(page, /seizures/, "Never");
  await pick(page, /must not do/, "No jumping");
  await pick(page, /Surgery, cast or Botox/, "No");
  await next(page);
  await abilities(page, "talking");

  // Stop halfway: a new page load knows nothing but what the server saved.
  await page.goto(`/parent/child/${childId}#plan`);
  await page.reload();
  await page.getByRole("link", { name: "Continue the questions" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Everyday abilities: hands and moving" })).toBeVisible();

  await abilities(page, "hands and moving");
  await abilities(page, "seeing, hearing, daily life");
  await page.getByRole("group", { name: /do better in the next 3 months/ }).getByText("Walk more steadily").click();
  await pick(page, /How much time/, "20 minutes");
  await next(page);
  await skip(page); // routine
  await skip(page); // own words
  await skip(page); // videos
  await page.getByRole("button", { name: "Make the plan" }).click();
  await expect(page.getByRole("heading", { name: "Aziz's plan is ready" })).toBeVisible();

  const plan = await page.evaluate(
    (id) => fetch(`/api/v1/children/${id}/plan`, { headers: { "X-Auth-Transport": "cookie" } }).then((r) => r.json()),
    childId,
  );
  expect(plan.days).toHaveLength(28);
});
