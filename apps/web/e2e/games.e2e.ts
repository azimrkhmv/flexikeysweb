import { expect, test, type Page } from "@playwright/test";
import { loginAs, setup } from "./helpers";

// B96: a parent sees every skill game right away and tries one with nothing saved; "For your child" shows the games
// of the child's plan.
test("a parent sees all games, tries one, and sees the games of the child's plan", async ({ page }) => {
  await setup(page);
  await loginAs(page, "Parent");
  await page.goto("/parent/games");
  const main = page.locator("main").last();
  await expect(main.getByRole("heading", { name: "Games", level: 1 })).toBeVisible();
  await expect(main.getByRole("link", { name: /^Try/ })).toHaveCount(39); // B104, B105: the two Cloudy games
  for (const area of ["Attention", "Memory", "Flexibility", "Reasoning", "Language", "Math", "Speed"]) await expect(main.getByRole("heading", { name: area, level: 2 })).toBeVisible();
  // Rule 1: no percentage on a parent screen.
  expect(await main.innerText()).not.toMatch(/\d\s?%/);

  await main.getByRole("link", { name: /^Try.*Find the same one/ }).click();
  await expect(page).toHaveURL(/\/demo\/games\?game=find_same&from=parent/);
  await expect(page.getByRole("heading", { name: "All skill games" })).toBeAttached();
  await page.getByRole("link", { name: "Back to Games" }).click();
  await expect(page).toHaveURL(/\/parent\/games/);

  await page.locator("main").last().getByRole("button", { name: "For your child" }).click();
  await expect(page.getByRole("heading", { name: "Games in Ali's plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play with Ali" })).toBeVisible();
  await page.getByRole("radio", { name: "Madina" }).click();
  await expect(page.getByRole("heading", { name: "Games in Ali's plan" })).toHaveCount(0);
});

// B104: Find Cloudy plays with touch, hold-to-choose, switch scanning and the keyboard. The clouds cannot be chosen
// (nor scanned) while they move; the right one shows the animal and its sentence; nothing is red, no X.
const found = (page: Page) => page.getByRole("heading", { name: /^Cloudy is a (bunny|fox|cat) now/ });
const clouds = (page: Page) => page.getByRole("button", { name: /^Cloud \d+$/ });
/** Hold-to-choose: rest on the button longer than the hold time (a short tap is only an access event). */
async function hold(page: Page, target: ReturnType<Page["locator"]>) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700); // past the double-tap guard
}

for (const access of ["touch", "dwell", "scan", "keyboard"] as const)
  test(`Find Cloudy: three rounds with ${access} (B104)`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one pointer and one keyboard are enough");
    test.setTimeout(90_000);
    await setup(page);
    // Touch plays Summit 3 (one peek, six swaps and a jump); the others Seed 1 (Cloudy stays half out).
    const step = access === "touch" ? 12 : 1;
    await page.goto(`/demo/games?game=find_cloudy&step=${step}${access === "dwell" ? "&access=dwell" : access === "scan" ? "&access=scan" : ""}`);
    if (access === "touch") {
      await expect(page.getByRole("heading", { name: "Watch where Cloudy hides" })).toBeVisible();
      await expect(clouds(page).first()).toBeDisabled(); // still moving: nothing to choose yet
    }
    for (let round = 0; round < 3; round++) {
      await expect(page.getByRole("heading", { name: "Where is Cloudy? Tap his cloud" })).toBeVisible({ timeout: 20_000 });
      if (access === "touch") await expect(page.getByRole("button", { name: "Show again" })).toBeVisible();
      for (let k = 0; k < 8 && !(await found(page).count()); k++) {
        if (access === "scan") {
          await expect(page.locator("[data-scan-active]")).toHaveCount(1);
          if (k) await page.keyboard.press(" ");
          if (!/^Cloud \d+$/.test((await page.locator("[data-scan-active]").getAttribute("aria-label")) ?? "")) continue; // the speaker
          await page.keyboard.press("Enter");
        } else {
          const cloud = clouds(page).nth(k);
          if (await cloud.isDisabled()) continue;
          if (access === "keyboard") {
            await cloud.focus();
            await page.keyboard.press("Enter");
          } else if (access === "dwell") await hold(page, cloud);
          else await cloud.click();
        }
        await page.waitForTimeout(400);
      }
      await expect(found(page)).toBeVisible();
      expect(await page.locator("main").innerText()).not.toMatch(/wrong|✗|❌|\bX\b/i);
      const go = page.getByRole("button", { name: round < 2 ? "Next" : "Done" });
      if (access === "dwell") await hold(page, go);
      else await go.click();
    }
    await expect(page.getByRole("heading", { name: "Well done!" })).toBeVisible();
  });

// B105: Grow Cloudy plays with the same four ways; four stages end with the tiger and the rainbow.
const drops = (page: Page) => page.getByRole("button", { name: /^Raindrop \d+$/ });
const grew = (page: Page) => page.getByRole("heading", { name: /^Cloudy grew into a/ });

for (const access of ["touch", "dwell", "scan", "keyboard"] as const)
  test(`Grow Cloudy: four stages with ${access} (B105)`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "one pointer and one keyboard are enough");
    test.setTimeout(120_000);
    await setup(page);
    // Touch plays Summit 3 (numbers shown, then hidden, tapped in order); the others Seed 1 (any drop).
    const step = access === "touch" ? 12 : 1;
    await page.goto(`/demo/games?game=grow_cloudy&step=${step}${access === "dwell" ? "&access=dwell" : access === "scan" ? "&access=scan" : ""}`);
    if (access === "touch") {
      await expect(page.getByRole("heading", { name: "Look at the numbers on the raindrops" })).toBeVisible();
      await expect(drops(page).first()).toBeDisabled(); // the numbers show first: nothing to choose yet
    }
    for (let stage = 0; stage < 4; stage++) {
      await expect(page.getByRole("heading", { name: /^Tap the raindrops/ })).toBeVisible({ timeout: 15_000 });
      for (let k = 0; k < 40 && !(await grew(page).count()); k++) {
        if (access === "scan") {
          await expect(page.locator("[data-scan-active]")).toHaveCount(1);
          if (k) await page.keyboard.press(" ");
          if (!/^Raindrop \d+$/.test((await page.locator("[data-scan-active]").getAttribute("aria-label")) ?? "")) continue;
          await page.keyboard.press("Enter");
        } else {
          const open = drops(page).and(page.locator(":not([disabled])"));
          if (!(await open.count())) break;
          const drop = open.nth(k % (await open.count()));
          if (access === "keyboard") {
            await drop.focus();
            await page.keyboard.press("Enter");
          } else if (access === "dwell") await hold(page, drop);
          else await drop.click();
        }
        await page.waitForTimeout(300);
      }
      await expect(grew(page)).toBeVisible();
      const go = page.getByRole("button", { name: stage < 3 ? "Next" : "Done" });
      if (stage === 3) await expect(page.getByRole("heading", { name: "Cloudy grew into a tiger! Look, a rainbow!" })).toBeVisible();
      if (access === "dwell") await hold(page, go);
      else await go.click();
    }
    await expect(page.getByRole("heading", { name: "Well done!" })).toBeVisible();
  });
