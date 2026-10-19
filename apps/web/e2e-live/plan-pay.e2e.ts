import { expect, test } from "@playwright/test";
import { childStep, fromServer, newPhone, signUp } from "./helpers";

// B22: Free and Pro against the server. A new family is on Free; the owner tries Pro once, then a simulated
// payment keeps the family on Pro.

test("the owner tries Pro, then a simulated payment upgrades the family", async ({ page }) => {
  test.setTimeout(120_000);
  await signUp(page, newPhone("93"));
  await childStep(page, "Aziz");
  await page.goto("/parent/billing");
  await expect(page.getByText("Your family is on Free", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Try Pro free for 7 days" }).click();
  await expect(page.getByText(/Your family is trying Pro until/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Try Pro free for 7 days" })).toHaveCount(0); // once per family

  await page.getByRole("button", { name: "Pay for 1 month" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Thank you. Your family has Pro." })).toBeVisible();
  await expect(page.getByText(/^Paid until/)).toBeVisible();
  const plan = await fromServer(page, "/family/plan");
  expect([plan.plan, plan.trial, !!plan.paidUntil]).toEqual(["pro", false, true]);
});
