import { expect, test } from "@playwright/test";
import { childPress, loginAs, setup } from "./helpers";

// B18: 20 minutes of games a day, then the sleeping cloud; it still holds after the website is closed and reopened.

test("after 20 minutes of games the games sleep until tomorrow, also after reopening", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one is enough");
  test.setTimeout(60_000);
  await setup(page);
  await loginAs(page, "Parent");
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    db.playTime = [{ childId: "ch_ali", date: new Date().toLocaleDateString("en-CA"), seconds: 20 * 60 - 5 }]; // 5 s left
    localStorage.setItem("fk_db_v1", JSON.stringify(db));
  });
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("button", { name: "Play now" }).click();
  await childPress(page.getByRole("button", { name: "Boshlash" })); // Ali plays in Uzbek
  const rest = page.getByRole("dialog", { name: "Oʻyinlar endi uxlayapti" });
  await page.waitForTimeout(6_000); // the open game is never cut short
  await expect(rest).toHaveCount(0);
  await childPress(page.getByRole("button", { name: "Orqaga" })); // leaving the game
  await expect(rest).toBeVisible();
  await expect(rest.getByRole("button", { name: /Mening ovozim|My Voice/ })).toBeVisible(); // My Voice stays

  await page.reload(); // closed and opened again
  await expect(rest).toBeVisible();
});
