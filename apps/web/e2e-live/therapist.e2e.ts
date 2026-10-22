import { expect, test } from "@playwright/test";
import { abilities, childStep, goals, healthAndSafety, newPhone, signIn, signUp, skip, startTrial } from "./helpers";

// B26: the parent invites a therapist by phone; the therapist signs in with that number, accepts, and changes a
// restriction and the goals; the parent's plan changes, and the parent sees who changed it.

test("a therapist's change in the browser changes the parent's plan", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const therapistPhone = `+99893${String(Date.now()).slice(-7)}`;

  await signUp(page, newPhone("98"));
  await startTrial(page); // sharing is Pro (A7.2)
  const child = await childStep(page, "Aziz");
  await healthAndSafety(page);
  for (const step of ["talking", "hands and moving", "seeing, hearing, daily life"]) await abilities(page, step);
  await goals(page); // "Walk more steadily"
  for (let i = 0; i < 3; i++) await skip(page); // routine, own words, videos
  await page.getByLabel("Invite your child's therapist").fill(therapistPhone);
  await page.getByText("I agree to share my child's plan and progress with this therapist").click();
  await page.getByRole("button", { name: "Make the plan" }).click();
  await page.getByRole("link", { name: "See the plan" }).click();
  await expect(page.getByText("It works on what you chose: walk more steadily.")).toBeVisible();

  // The therapist, on another device: the invited number becomes a therapist account.
  const other = await browser.newContext();
  const th = await other.newPage();
  await signIn(th, therapistPhone);
  await expect(th).toHaveURL(/\/therapist/);
  await th.getByRole("listitem").filter({ hasText: "Aziz" }).getByRole("button", { name: "Accept" }).click();
  await expect(th.getByRole("link", { name: /Aziz/ })).toBeVisible();
  await th.getByLabel("Your name").fill("Dilnoza Karimova");
  await th.getByLabel("Profession").selectOption("physio");
  await th.getByLabel("Workplace").fill("Clinic 1");
  await th.getByRole("button", { name: "Save" }).click();
  await expect(th.getByText("Physiotherapist / LFK specialist · Clinic 1")).toBeVisible();

  await th.goto(`/therapist/child/${child}`);
  await expect(th.getByRole("heading", { name: "Why this plan" })).toBeVisible(); // B58, from the server
  await expect(th.getByText("The fixed rules chose these items")).toBeVisible();
  await th.getByLabel("Gross motor level (GMFCS)").selectOption("1");
  await th.getByLabel("Hand use level (MACS)").selectOption("2");
  await th.getByRole("checkbox", { name: "No lying on the stomach" }).check();
  await th.getByRole("checkbox", { name: "Use hands better" }).check();
  await th.locator("form:has([data-question])").getByRole("button", { name: "Save" }).click();
  await expect(th.getByText("Saved. The plan was updated.")).toBeVisible();
  await other.close();

  await page.reload();
  await expect(page.getByText("It works on what you chose: use hands better.")).toBeVisible();
  const card = page.getByRole("heading", { name: "From Aziz's therapist" }).locator("..");
  await expect(card.getByText("No lying on the stomach")).toBeVisible();
  await expect(card.getByText("Updated by Dilnoza Karimova, Physiotherapist / LFK specialist").first()).toBeVisible();
});

// B30: the parent's invite link; a new number opens it, signs in, and lands on the shared child.
test("a therapist link signs a new number straight into the share", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signUp(page, newPhone("98"));
  await startTrial(page); // sharing is Pro (A7.2)
  const child = await childStep(page, "Lola");
  await page.goto(`/parent/child/${child}#privacy`);
  await page.reload();
  await page.getByRole("switch", { name: "Specialists: allow sharing with a therapist that I invite" }).click();
  await page.getByRole("tab", { name: "Sharing" }).click();
  await page.getByRole("button", { name: "Invite" }).click();
  const code = (await page.getByRole("status").locator(".font-mono").innerText()).trim();

  const other = await browser.newContext();
  const th = await other.newPage();
  await th.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await th.goto(`/login?invite=${encodeURIComponent(code)}`);
  const english = th.getByRole("button", { name: "English" });
  if (await english.isVisible()) await english.click();
  await th.getByLabel("Phone number").fill(`+99893${String(Date.now()).slice(-7)}`);
  await th.getByRole("button", { name: "Send the code" }).click();
  const sms = (await th.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await th.getByLabel("Code from the SMS").fill(sms);
  await th.getByRole("button", { name: "Continue" }).click();
  await expect(th).toHaveURL(/\/therapist/);
  await expect(th.getByRole("link", { name: /Lola/ })).toBeVisible();
  await other.close();
});
