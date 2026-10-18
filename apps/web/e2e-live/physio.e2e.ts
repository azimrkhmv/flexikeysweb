import { expect, test } from "@playwright/test";
import { API, bearerFor, newPhone, serverCommand, signIn } from "./helpers";

// B5: a physiotherapist reviews a real video file in the browser (product rule 3: nothing reaches families before).

test("a physiotherapist watches a real video file and approves it", async ({ page }) => {
  // Setup the way the team does it: the first admin on the server, the library, a physiotherapist account, a file.
  const adminPhone = `+99890${String(Date.now()).slice(-7)}`;
  serverCommand("load-exercises");
  serverCommand("create-admin", adminPhone);
  const admin = await bearerFor(adminPhone);
  const physioPhone = newPhone("97");
  const json = { ...admin, "Content-Type": "application/json" };
  expect((await fetch(`${API}/api/v1/admin/users`, { method: "POST", headers: json, body: JSON.stringify({ phone: physioPhone, role: "physio" }) })).status).toBe(201);
  const file = { exerciseId: "finger_walk", lang: "en" };
  const link = await (await fetch(`${API}/api/v1/admin/videos/upload-link`, { method: "POST", headers: json, body: JSON.stringify(file) })).json();
  expect((await fetch(link.uploadUrl, { method: "PUT", body: new Uint8Array(4096).fill(7), headers: { "Content-Type": "video/mp4" } })).status).toBe(200);
  const registered = await fetch(`${API}/api/v1/admin/videos`, { method: "POST", headers: json, body: JSON.stringify({ ...file, storageKey: link.storageKey, durationS: 30 }) });
  expect(registered.status).toBe(201);
  const families = () => fetch(`${API}/api/v1/videos/finger_walk?lang=en`, { headers: admin }).then((r) => r.status);
  expect(await families()).toBe(404); // waiting for review: no family can get it

  // The physiotherapist signs in (staff give the basic consent once too) and reviews in the browser.
  await signIn(page, physioPhone);
  await page.getByLabel("District").selectOption({ index: 1 });
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.goto("/physio");
  const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Finger walk" }) }).filter({ hasText: "English" });
  const video = card.locator("video");
  await expect(video).toHaveAttribute("src", /^https?:\/\/.+finger_walk/);
  expect(await page.evaluate((src) => fetch(src).then((r) => r.arrayBuffer()).then((b) => b.byteLength), (await video.getAttribute("src"))!)).toBe(4096);

  await card.getByRole("button", { name: "Approve" }).click();
  await expect(card).toHaveCount(0); // gone from "Waiting for review"
  await page.getByLabel("Show").selectOption("approved");
  await expect(page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "Finger walk" }) }).filter({ hasText: "English" }).getByText(/Approved by/)).toBeVisible();
  expect(await families()).toBe(200); // now families can watch it
});
