import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B38 (spec §9): the owner orders the Home Kit. The order button stays off until the material allergy question is
// answered; "yes" needs the materials named. Courier needs an address, pickup a centre.

test("the order waits for the allergy answer; order by courier, then cancel", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/kit");
  await page.getByLabel("For which child?").selectOption({ label: "Ali" });
  await page.getByLabel("District").selectOption("Chilonzor");
  await page.getByLabel("Street, house, flat").fill("Bunyodkor 12, flat 5");
  const order = page.getByRole("button", { name: "Order the Home Kit" });
  await expect(order).toBeDisabled(); // the allergy question is not answered yet
  await expect(page.getByText("Please answer the allergy question first.")).toBeVisible();

  await page.getByLabel("Yes", { exact: true }).check();
  await expect(order).toBeDisabled(); // "yes" needs the materials
  await page.getByLabel("Which materials?").fill("Latex");
  await expect(order).toBeEnabled();
  await page.getByLabel("No", { exact: true }).check();
  await expect(order).toBeEnabled();

  await order.click();
  await expect(page.getByRole("status").filter({ hasText: "Our team will call you" })).toBeVisible();
  const placed = page.getByRole("listitem").filter({ hasText: "Ali" }).filter({ hasText: "Bunyodkor 12" });
  await expect(placed).toContainText("Ordered");
  await placed.getByRole("button", { name: "Cancel order" }).click();
  await expect(placed).toContainText("Cancelled");
});

test("pickup at a centre needs a centre", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/kit");
  await page.getByLabel("No", { exact: true }).check();
  await page.getByLabel("Pick up at a centre").check();
  await page.getByLabel("District").selectOption("Chilonzor");
  const order = page.getByRole("button", { name: "Order the Home Kit" });
  await expect(order).toBeDisabled();
  await page.getByRole("combobox", { name: "Centre" }).selectOption({ index: 1 });
  await order.click();
  await expect(page.getByRole("listitem").filter({ hasText: "Pick up at a centre" })).toContainText("Ordered");
});
