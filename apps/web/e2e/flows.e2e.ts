import { expect, test, type Page } from "@playwright/test";
import { exitThroughGate, loginAs, setup } from "./helpers";

// PRD §28 core E2E flows, run through the real UI (child input goes through <Target> and the physical keyboard).

/** Plays the first typing activity ("find this letter") with the physical keyboard until the celebration. */
async function playLetterActivity(page: Page) {
  await expect(page.getByRole("heading", { name: "Find this letter on the keyboard" })).toBeVisible({ timeout: 5000 });
  for (let round = 0; round < 10; round++) {
    const letter = (await page.locator("span.text-8xl").innerText()).trim();
    await page.waitForTimeout(300); // stay outside the 250 ms repeat-tap filter (debounce)
    await page.keyboard.press(letter);
    const next = page.locator("[data-fk-target][aria-label='Next'], [data-fk-target][aria-label='Done']");
    await expect(next).toBeVisible();
    const done = (await next.getAttribute("aria-label")) === "Done";
    await next.press("Enter");
    if (done) return;
  }
  throw new Error("activity did not finish");
}

test("new parent: sign up → consent → add child → play → progress is visible", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one full journey is enough");
  await setup(page);
  await page.goto("/signup");
  await page.getByLabel("Your name").fill("Nodira");
  await page.getByLabel("Email").fill(`nodira.${Date.now()}@example.uz`);
  await page.getByLabel("Password").fill("long-enough-password");
  await page.getByText("I agree to the Terms of use and the Privacy policy").click();
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("button", { name: "Verify now (demo)" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new$/);

  // FR-CHILD-1: consent comes first; nothing is created without core consent.
  const agree = page.getByRole("button", { name: "I agree, continue" });
  await expect(agree).toBeDisabled();
  await page.getByText("Core: store my child's nickname").click();
  await agree.click();
  await page.getByLabel("Nickname").fill("Lola");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Create profile" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Lola" })).toBeVisible();

  // FR-PLAY-1: from the child's page, Start leads straight into the first game.
  await page.getByRole("button", { name: "Play now" }).click();
  await page.getByRole("button", { name: "Start" }).press("Enter");
  await playLetterActivity(page);
  await expect(page.getByRole("heading", { name: "You did it! Great effort." })).toBeVisible();
  await expect(page.getByText("⭐ +3")).toBeVisible(); // rewards are granted by the (mock) server rule

  await exitThroughGate(page, "en");
  await expect(page).toHaveURL(/\/parent$/);
  await page.getByRole("link", { name: /Lola/ }).click();
  const stars = page.getByText("Stars earned", { exact: true }).locator(".."); // the Stat: value + label
  await expect(stars).toHaveText(/^\s*3\s*Stars earned\s*$/);
});

test("school: class code on a shared device → roster → child mode, code remembered", async ({ page }) => {
  await setup(page);
  await page.goto("/class");
  await page.getByLabel("Class code").fill("kq7m4p");
  await page.getByRole("button", { name: "Go" }).click();
  await expect(page.getByRole("heading", { name: "Quyoshcha" })).toBeVisible();
  await page.getByRole("button", { name: "Bekzod" }).press("Enter");
  await expect(page).toHaveURL(/\/play$/);
  await expect(page.getByRole("button", { name: "Boshlash" })).toBeVisible(); // Bekzod's UI language is Uzbek
  await exitThroughGate(page, "uz");
  await expect(page).toHaveURL(/\/class$/);
  await expect(page.getByRole("heading", { name: "Quyoshcha" })).toBeVisible(); // next child can pick straight away (FR-TCH-2)
});

test("therapist link: parent invites → therapist accepts → parent revokes → access stops", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_madina#privacy");
  await page.reload();
  await page.getByRole("switch", { name: "Specialists: allow sharing with a therapist that I invite" }).click();
  await page.getByRole("tab", { name: "Sharing" }).click();
  await page.getByLabel("Specialist's email").fill("therapist@demo.uz");
  await page.getByRole("button", { name: "Invite" }).click();
  const code = (await page.getByRole("status").locator(".font-mono").innerText()).trim();
  expect(code).toMatch(/^[A-Z2-9]{6}$/);

  await loginAs(page, "Therapist");
  await page.getByLabel("Invite code from a parent").fill(code);
  await page.getByRole("button", { name: "Accept" }).last().click();
  await expect(page.getByRole("link", { name: /Madina/ })).toBeVisible();
  await page.goto("/therapist/child/ch_madina");
  await expect(page.getByRole("heading", { level: 1, name: "Madina" })).toBeVisible();

  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_madina#sharing");
  await page.reload();
  await page.getByRole("listitem").filter({ hasText: "Has access" }).getByRole("button", { name: "Stop access" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Stop access" }).click();
  await expect(page.getByText("Has access")).toHaveCount(0);

  await loginAs(page, "Therapist"); // FR-PAR-2: access stops immediately
  await page.goto("/therapist/child/ch_madina");
  await expect(page.getByText("Not found.")).toBeVisible();
});
