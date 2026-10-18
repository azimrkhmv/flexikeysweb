import { expect, test, type Page } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B15: the play check's first stage finds the child's five access settings in about 2 minutes, with no timer,
// no red and no failure sound.

const ball = (page: Page) => page.locator("[data-ball]");
async function center(page: Page) {
  const b = (await ball(page).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
async function tapBall(page: Page) {
  await page.waitForTimeout(400); // a child's pace: never a repeat
  const c = await center(page);
  await page.mouse.click(c.x, c.y);
}
async function holdBall(page: Page, ms: number) {
  await page.waitForTimeout(500);
  const c = await center(page);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}
const saved = (page: Page) =>
  page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("fk_db_v1")!);
    return { profile: db.accessProfiles.find((a: { childId: string }) => a.childId === "ch_ali"), access: db.children.find((c: { id: string }) => c.id === "ch_ali").access };
  });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one mouse is enough");
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/child/ch_ali");
  await page.getByRole("tab", { name: "Plan" }).click();
  await page.getByRole("link", { name: "Play check" }).click();
  await page.getByRole("button", { name: "Start" }).click();
});

test("a child who touches easily: touch, the smallest buttons, their own hold time", async ({ page }) => {
  const started = Date.now();
  for (let i = 0; i < 5; i++) await tapBall(page); // input mode
  for (let i = 0; i < 6; i++) await tapBall(page); // the balls shrink to 12 mm, every one reached
  await expect(page.getByText("Hold the ball, and let go when you like.")).toBeVisible();
  for (let i = 0; i < 3; i++) await holdBall(page, 1500);
  await expect(page.getByRole("heading", { name: "Done! Now the games fit Ali" })).toBeVisible();
  expect(Date.now() - started).toBeLessThan(120_000); // well within the spec's 2 minutes, at a child's pace
  await expect(page.getByText("Choosing with a normal touch.")).toBeVisible();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: "Back to Ali's page" })).toBeVisible();
  const { profile, access } = await saved(page);
  expect(profile).toMatchObject({ inputMode: "touch", minTargetMm: 12, dwellMs: 1200, repeatLock: false, releaseOk: true, helpedByAdult: false });
  expect(access).toBe("touch");
});

test("a child for whom touching and holding are hard gets switch scanning", async ({ page }) => {
  const area = (await page.getByTestId("check-area").boundingBox())!;
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(400);
    await page.mouse.click(area.x + 10, area.y + 10); // touches that don't reach the ball
  }
  await expect(page.getByText("Hold the ball until it turns green!")).toBeVisible(); // hold-to-choose offered
  for (let i = 0; i < 5; i++) await holdBall(page, 200); // let go long before it turns green
  await expect(page.getByText("Choosing with a switch: the buttons light up one by one.")).toBeVisible();
  await page.getByText("I helped during the check").click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: "Back to Ali's page" })).toBeVisible();
  const { profile, access } = await saved(page);
  expect(profile).toMatchObject({ inputMode: "switch", helpedByAdult: true });
  expect(access).toBe("scan"); // every game now scans
});
