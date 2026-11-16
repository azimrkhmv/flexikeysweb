import { expect, test } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B106 (Warm Hills spec §7): the Exercises page. The new slots wait for the physiotherapist and cannot be played;
// the child's plan comes first; an admin uploads a video, the physiotherapist approves it (product rule 3), and then
// the parent can play it.

const NEW_SLOTS = ["Reach for a toy", "Open and close the hand", "Sitting balance", "Tummy time with a toy", "Animal walks", "Rolling to the side"];

test("the Exercises page: slots wait for the physio, the plan comes first, an approved video plays (B106)", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one journey is enough");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/exercises");
  const main = page.locator("main").last();
  await expect(main.getByRole("heading", { name: "Exercises", level: 1 })).toBeVisible();
  await expect(main.getByText("A video appears here only after our physiotherapist approves the exercise.")).toBeVisible();
  for (const name of NEW_SLOTS) {
    const card = main.locator("li").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await expect(card).toContainText("Waiting for physio check");
    await expect(card).toContainText("about 2 min");
    await expect(card.getByRole("button")).toHaveCount(0); // cannot be played
  }
  // The child's plan first: every "In the plan" card comes before the first card that is not in the plan.
  const tags = await main.locator("li").evaluateAll((cards) => cards.map((c) => c.textContent?.includes("In the plan") ?? false));
  expect(tags[0]).toBe(true);
  expect(tags.lastIndexOf(true)).toBeLessThan(tags.indexOf(false));
  // An approved video plays (the demo's placeholder clip).
  await main.locator("li").first().getByRole("button", { name: /^Play the video/ }).click();
  await expect(main.locator("li").first().locator("video")).toHaveAttribute("src", /\/placeholder-videos\/\w+\.en\.mp4$/);

  // An admin uploads a video for a slot; it waits for the physiotherapist.
  await loginAs(page, "Admin");
  await page.goto("/admin/content");
  await expect(page.getByRole("heading", { name: "Exercise videos" })).toBeVisible();
  const form = page.locator("section").filter({ hasText: "Add a generated video file" });
  await form.getByRole("combobox").nth(0).selectOption({ label: "Reach for a toy" });
  await form.getByRole("combobox").nth(1).selectOption("en");
  await form.getByLabel("Video file").setInputFiles({ name: "reach.mp4", mimeType: "video/mp4", buffer: Buffer.from("pretend video") });
  await form.getByRole("button", { name: "Send to review" }).click();
  await expect(form.getByText("Saved.")).toBeVisible();
  const row = page.locator("tr").filter({ hasText: "Reach for a toy" });
  await expect(row.locator("td").nth(3)).toHaveText("Waiting for physio check"); // en is the third language column

  // The physiotherapist approves it; then the parent can play it.
  await loginAs(page, "Video reviewer");
  const item = page.locator("li").filter({ hasText: "Reach for a toy" }).filter({ hasText: "English" });
  await item.getByRole("button", { name: "Approve" }).click();
  await expect(item).toHaveCount(0);
  await loginAs(page, "Parent");
  await page.goto("/parent/exercises");
  const reach = page.locator("main").last().locator("li").filter({ has: page.getByRole("heading", { name: "Reach for a toy", exact: true }) });
  await expect(reach).not.toContainText("Waiting for physio check");
  await reach.getByRole("button", { name: /^Play the video/ }).click();
  await expect(reach.locator("video")).toHaveAttribute("src", /^blob:/);
});
