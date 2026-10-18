import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B23: the therapist form T1–T11. The required answers follow the therapist's profession (spec §6).
test("the required answers follow the profession", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Therapist");
  await page.goto("/therapist/child/ch_ali");
  await expect(page.getByText("Fill in your profile first")).toBeVisible();

  await page.goto("/therapist");
  await page.getByLabel("Your name").fill("Dilnoza Karimova");
  await page.getByLabel("Profession").selectOption("physio");
  await page.getByLabel("Workplace").fill("Clinic 1");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Physiotherapist / LFK specialist · Clinic 1")).toBeVisible();

  await page.goto("/therapist/child/ch_ali");
  const form = page.locator("form:has([data-question])");
  const required = (id: string) => page.locator(`[data-question="${id}"]`).getByText("Required", { exact: true });
  await expect(required("T3")).toBeVisible();
  await expect(required("T4")).toHaveCount(0);
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Some required answers are still empty.")).toBeVisible();
  await expect(page.locator('[data-question="T3"]').getByRole("alert")).toBeVisible();

  await page.getByLabel("Gross motor level (GMFCS)").selectOption("3");
  await page.getByLabel("Hand use level (MACS)").selectOption("2");
  await page.getByRole("checkbox", { name: "No jumping" }).check();
  await page.getByRole("checkbox", { name: "Sit better" }).check();
  await page.getByLabel("Message to the parent").fill("Keep going!");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Message to the parent")).toHaveValue("Keep going!");

  // A speech therapist must give the communication level instead of the hand level.
  await page.goto("/therapist");
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByLabel("Profession").selectOption("speech");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/therapist/child/ch_ali");
  await expect(required("T4")).toBeVisible();
  await expect(required("T3")).toHaveCount(0);
});

// B24: the parent sees whose answer is in use, and the therapist's message.
test("the parent sees the therapist's updates and message", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Therapist");
  await page.goto("/therapist");
  await page.getByLabel("Your name").fill("Dilnoza Karimova");
  await page.getByLabel("Profession").selectOption("neurologist");
  await page.getByLabel("Workplace").fill("Clinic 1");
  await page.getByRole("button", { name: "Save" }).click();
  await page.goto("/therapist/child/ch_ali");
  const form = page.locator("form:has([data-question])");
  await page.getByLabel("Gross motor level (GMFCS)").selectOption("3");
  await page.getByRole("checkbox", { name: "No jumping" }).check();
  await page.getByRole("checkbox", { name: "Sit better" }).check();
  await page.getByLabel("Message to the parent").fill("Ali did well this week.");
  await form.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  const card = page.locator("section, div").filter({ has: page.getByRole("heading", { name: "From Ali's therapist" }) }).last();
  await expect(card.getByRole("heading", { name: "From Ali's therapist" })).toBeVisible();
  await expect(card.getByText("Updated by Dilnoza Karimova, Neurologist").first()).toBeVisible();
  await expect(card.getByText("Walks with a walker or with hands held")).toBeVisible();
  await expect(card.getByText("Ali did well this week.")).toBeVisible();
});
