import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B35 (spec §11): a clinic's free times; a taken time is never offered; book in person or online; cancel frees it.
// Sample times (G4): the «Soʻz» centre has 8 in the coming week, and another family already took one.

test("a taken time cannot be chosen; book, see it under Your visits, cancel", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/help");
  await page.getByRole("button", { name: "Speech and talking" }).click();
  await page.getByRole("listitem").filter({ hasText: "«Soʻz»" }).getByRole("link", { name: "Book a time" }).click();
  await expect(page.getByRole("heading", { name: /Book at «Soʻz»/ })).toBeVisible();
  const times = page.locator("input[name=slot]");
  await expect(times).toHaveCount(7); // 8 free times, minus the one another family booked

  await page.getByLabel("For which child?").selectOption({ label: "Ali" });
  await times.first().check();
  await expect(page.getByLabel("In person")).toBeChecked();
  await page.getByRole("button", { name: "Book this time" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Booked. The clinic will confirm it." })).toBeVisible();

  await page.reload(); // the same page again: the time Ali has now is not offered
  await expect(times).toHaveCount(6);
  await page.goto("/parent/help");
  const visit = page.getByRole("listitem").filter({ hasText: "Ali · In person" });
  await expect(visit).toContainText("Waiting for the clinic");
  await visit.getByRole("button", { name: "Cancel visit" }).click();
  await expect(visit).toContainText("Cancelled");
  await page.goto("/parent/help/pl_clinic_speech");
  await expect(times).toHaveCount(7); // free again for others
});
