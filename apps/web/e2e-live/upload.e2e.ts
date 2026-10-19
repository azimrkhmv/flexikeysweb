import { expect, test } from "@playwright/test";
import { API, bearerFor, createAdmin, serverCommand, signIn, totpCode } from "./helpers";

// B48: an admin uploads a finished video file in the browser; it waits in the physiotherapist's queue.

test("an admin uploads a video file and it waits for the physiotherapist", async ({ page }) => {
  const adminPhone = `+99890${String(Date.now()).slice(-7)}`;
  serverCommand("load-exercises");
  const key = createAdmin(adminPhone);
  const physioPhone = `+99897${String(Date.now() + 1).slice(-7)}`;

  await signIn(page, adminPhone);
  // A13.1: the SMS code alone is not enough for an admin; the authenticator code comes next.
  await page.getByLabel("Code from the authenticator app").fill(totpCode(key));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/admin/); // signed in: the session cookies are set
  const made = await page.evaluate(async (phone) => {
    const csrf = document.cookie.split("; ").find((c) => c.startsWith("fk_csrf="))?.slice(8) ?? "";
    const headers = { "Content-Type": "application/json", "X-Auth-Transport": "cookie", "X-CSRF-Token": csrf };
    return (await fetch("/api/v1/admin/users", { method: "POST", headers, body: JSON.stringify({ phone, role: "physio" }) })).status;
  }, physioPhone);
  expect(made).toBe(201);
  await page.goto("/physio");
  const form = page.locator("section").filter({ has: page.getByRole("heading", { name: "Add a generated video file" }) });
  await form.getByLabel("Exercise").selectOption({ label: "Bean bag to the target" });
  await form.getByLabel("Language").selectOption("ru");
  await form.getByLabel("Video file").setInputFiles({ name: "bean_bag_target_ru.mp4", mimeType: "video/mp4", buffer: Buffer.alloc(2048, 1) });
  await form.getByRole("button", { name: "Send to review" }).click();
  await expect(form.getByText("Saved.")).toBeVisible();

  const physio = await bearerFor(physioPhone);
  const queue = await (await fetch(`${API}/api/v1/review/videos`, { headers: physio })).json();
  const item = queue.find((v: { exerciseId: string; lang: string }) => v.exerciseId === "bean_bag_target" && v.lang === "ru");
  expect(item?.status).toBe("waiting_review");
  expect((await fetch(item.watchUrl)).headers.get("content-length")).toBe("2048");
});
