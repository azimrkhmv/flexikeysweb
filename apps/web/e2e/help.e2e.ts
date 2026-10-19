import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B34 (spec §11): pick a need; free state centres first; old prices say so; "I'm not sure" never guesses; a parent
// reports wrong information. Sample places (G2) in the demo.

test("find help: needs, free centres first, I'm not sure, and a report", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.getByRole("link", { name: "Find help" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Find help" })).toBeVisible();
  await expect(page.getByRole("note").filter({ hasText: "sample places" })).toBeVisible();

  await page.getByRole("button", { name: "I'm not sure" }).click();
  await expect(page.getByText(/We don't guess\. Ask your child's doctor first/)).toBeVisible();
  const cards = page.getByRole("listitem").filter({ has: page.getByRole("heading", { level: 2 }) });
  await expect(cards.filter({ hasText: "Private clinic" })).toHaveCount(0); // only free state centres
  await expect(cards.filter({ hasText: "Free state centre" })).toHaveCount(2);

  await page.getByRole("button", { name: "Speech and talking" }).click();
  await expect(cards.first()).toContainText("Free state centre"); // free first
  await expect(cards.nth(1)).toContainText("«Soʻz» logopediya markazi");

  await page.getByRole("button", { name: "Movement and hands" }).click();
  await expect(cards.filter({ hasText: "Harakat terapiyasi klinikasi" })).toContainText("Price not recently checked");

  const soz = () => cards.filter({ hasText: "«Soʻz»" });
  await page.getByRole("button", { name: "Speech and talking" }).click();
  await soz().getByRole("button", { name: "Report wrong information" }).click();
  await soz().getByLabel("Closed").check();
  await soz().getByRole("button", { name: "Send" }).click();
  await expect(soz().getByText("Thank you. Our team will check it within 24 hours.")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Speech and talking" }).click();
  await expect(soz().getByText("Thank you. Our team will check it within 24 hours.")).toBeVisible(); // once per person
});
