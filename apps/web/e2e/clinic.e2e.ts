import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B36 (spec §11): the clinic sees only its own bookings, confirms an online one with its link, and publishes a free
// time. The family then sees the visit confirmed, with the link.

test("a clinic sees only its own bookings, confirms one with a link, publishes a time", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/help/pl_clinic_speech");
  await page.locator("input[name=slot]").nth(1).check(); // a time offered in person or online
  await page.getByLabel("Online").check();
  await page.getByRole("button", { name: "Book this time" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Booked." })).toBeVisible();

  await loginAs(page, "Clinic");
  await expect(page.getByRole("heading", { level: 1, name: "«Soʻz» logopediya markazi" })).toBeVisible();
  const bookings = page.getByRole("listitem").filter({ hasText: /years/ });
  await expect(bookings).toHaveCount(2); // Ali's new one and Jasur's; never the other clinic's booking
  const ali = bookings.filter({ hasText: "Ali" });
  await expect(ali).toContainText("+998900000001"); // the parent's phone, given by booking
  await ali.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Add the link for the online session." })).toBeVisible();
  await ali.getByLabel("Online session link").fill("https://meet.example/aziz");
  await ali.getByRole("button", { name: "Confirm" }).click();
  await expect(ali).toContainText("Confirmed");

  const date = new Date(Date.parse("2026-09-29T10:00:00+05:00") + 10 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel("Date").fill(date);
  await page.getByLabel("Time (Tashkent)").fill("16:00");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("button", { name: /Remove the time .*Oct 9.*04:00/ })).toBeVisible();

  await loginAs(page, "Parent");
  await page.goto("/parent/help");
  const visit = page.getByRole("listitem").filter({ hasText: "Ali · Online" });
  await expect(visit).toContainText("Confirmed");
  await expect(visit.getByRole("link", { name: "Join online" })).toHaveAttribute("href", "https://meet.example/aziz");
});
