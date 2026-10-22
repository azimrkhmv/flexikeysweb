import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// The pilot: a parent sends feedback from any page; an admin reads it.
test("a parent's feedback reaches the admin", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.getByRole("button", { name: "Send feedback" }).click();
  await page.getByLabel("What should we improve?").fill("The movement questions were long but clear.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Thank you! Your message reached the team.")).toBeVisible();

  await loginAs(page, "Admin");
  await page.getByRole("link", { name: "Feedback" }).click();
  await expect(page.getByText("The movement questions were long but clear.")).toBeVisible();
  await expect(page.getByText("/parent", { exact: true })).toBeVisible();
});
