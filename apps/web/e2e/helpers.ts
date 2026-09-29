import { expect, type Page } from "@playwright/test";

/** Fixed clock + English UI so seeded demo data and copy are the same on every run. */
export async function setup(page: Page, lang: "en" | "uz" | "ru" = "en") {
  await page.clock.setFixedTime(new Date("2026-09-29T10:00:00+05:00"));
  await page.addInitScript((l) => {
    if (!localStorage.getItem("fk_lang")) localStorage.setItem("fk_lang", JSON.stringify(l));
  }, lang);
}

/** Signs in with one of the seeded demo accounts via the login page's demo buttons. */
export async function loginAs(page: Page, role: "Parent" | "Teacher" | "Therapist" | "Admin") {
  await page.goto("/login");
  await page.getByRole("button", { name: `Log in: ${role}` }).click();
  await expect(page).toHaveURL(new RegExp(`/${role.toLowerCase()}`));
}
