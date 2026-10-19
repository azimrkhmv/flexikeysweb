import { expect, test } from "@playwright/test";
import { adminBearerFor, API, childStep, createAdmin, newPhone, signIn, signUp } from "./helpers";

// B37: a clinic publishes a free time, a parent books it in the browser, the clinic confirms it (the real server).

test("a parent books a real free time and the clinic confirms it", async ({ page, browser }) => {
  test.setTimeout(120_000);
  // Setup the way our team does it: an admin makes the clinic account and links the clinic's place to it.
  const adminPhone = `+99890${String(Date.now()).slice(-7)}`;
  const admin = { ...(await adminBearerFor(adminPhone, createAdmin(adminPhone))), "Content-Type": "application/json" };
  const clinicPhone = newPhone("99");
  const made = await fetch(`${API}/api/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ phone: clinicPhone, role: "clinic" }) });
  expect(made.status).toBe(201);
  const name = `Test centre ${Date.now()}`;
  const place = await fetch(`${API}/api/v1/admin/places`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({
      name, kind: "private_clinic", region: "tashkent_city", district: "Chilonzor", languages: ["uz"], needs: ["speech"],
      ageMin: 0, ageMax: 18, worksWithCp: true, checkedAt: new Date().toISOString().slice(0, 10), clinicId: (await made.json()).id,
    }),
  });
  expect(place.status).toBe(201);
  const placeId = (await place.json()).id;

  // The clinic publishes a time for tomorrow.
  await signIn(page, clinicPhone);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByLabel("Date").fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  await page.getByLabel("Time (Tashkent)").fill("10:00");
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByRole("button", { name: /Remove the time/ })).toHaveCount(1);

  // A parent finds the place and books that time.
  const parent = await (await browser.newContext()).newPage();
  await signUp(parent, newPhone("93"));
  await childStep(parent, "Aziz");
  await parent.goto("/parent/help");
  await parent.getByRole("button", { name: "Speech and talking" }).click();
  await parent.getByRole("listitem").filter({ hasText: name }).getByRole("link", { name: "Book a time" }).click();
  await expect(parent).toHaveURL(new RegExp(`/parent/help/${placeId}`));
  await parent.locator("input[name=slot]").first().check();
  await parent.getByRole("button", { name: "Book this time" }).click();
  await expect(parent.getByRole("status").filter({ hasText: "Booked. The clinic will confirm it." })).toBeVisible();
  await parent.reload();
  await expect(parent.getByText("No free times right now", { exact: false })).toBeVisible(); // taken: not offered again

  // The clinic sees the booking (the child's first name, the parent's phone) and confirms it.
  await page.reload();
  const booking = page.getByRole("listitem").filter({ hasText: "Aziz" });
  await expect(booking).toContainText("New");
  await booking.getByRole("button", { name: "Confirm" }).click();
  await expect(booking).toContainText("Confirmed");

  await parent.goto("/parent/help");
  await expect(parent.getByRole("listitem").filter({ hasText: "Aziz · In person" })).toContainText("Confirmed");
});
