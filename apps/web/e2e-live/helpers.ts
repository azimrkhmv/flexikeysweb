import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, type Page } from "@playwright/test";

// Shared steps of the live browser tests (the real server, apps/api; the SMS is simulated: the code is on screen).

export const pick = (page: Page, question: string | RegExp, option: string) => page.getByRole("group", { name: question }).getByText(option, { exact: true }).click();
export const next = (page: Page) => page.getByRole("button", { name: "Next", exact: true }).click();
export const skip = (page: Page) => page.getByRole("button", { name: "Skip for now" }).click();
export const newPhone = (prefix: string) => `${prefix}${String(Date.now()).slice(-7)}`;

/** Phone and code; a new number then gets the district and consent step. */
export async function signIn(page: Page, phone: string) {
  await page.addInitScript(() => localStorage.setItem("fk_lang", JSON.stringify("en")));
  await page.goto("/login");
  const english = page.getByRole("button", { name: "English" });
  if (await english.isVisible()) await english.click();
  await page.getByLabel("Phone number").fill(phone);
  await page.getByRole("button", { name: "Send the code" }).click();
  const code = (await page.getByText(/Your code is \d{6}/).innerText()).match(/\d{6}/)![0];
  await page.getByLabel("Code from the SMS").fill(code);
  await page.getByRole("button", { name: "Continue" }).click();
}

export async function signUp(page: Page, phone: string) {
  await signIn(page, phone);
  await page.getByLabel("District").selectOption({ index: 1 });
  await page.getByText("I agree to FlexiKeys storing").click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/parent\/children\/new/);
}

/** The first step; returns the new child's id. */
export async function childStep(page: Page, name: string) {
  await page.getByLabel("Child's first name").fill(name);
  await page.getByLabel("Date of birth").fill("2019-05-01");
  await pick(page, "Boy or girl", "Boy");
  await pick(page, "You are the child's…", "Mother");
  await pick(page, "Who is filling this in?", "Parent");
  await next(page);
  await expect(page).toHaveURL(/child=/);
  return new URL(page.url()).searchParams.get("child")!;
}

export async function healthAndSafety(page: Page) {
  await page.getByRole("button", { name: "I agree — continue" }).click();
  await page.getByRole("group", { name: "What has a doctor said?" }).getByText("Speech delay").click();
  await pick(page, "How does your child usually move?", "Walks alone");
  await next(page);
  await pick(page, /seizures/, "Never");
  await pick(page, /must not do/, "No jumping");
  await pick(page, /Surgery, cast or Botox/, "No");
  await next(page);
}

export async function abilities(page: Page, step: string) {
  await expect(page.getByRole("heading", { level: 1, name: `Everyday abilities: ${step}` })).toBeVisible();
  for (const group of await page.getByRole("group").all()) {
    const yes = group.getByText("Yes", { exact: true });
    await ((await yes.count()) ? yes : group.getByText(/^(Words|Letters)$/)).click();
  }
  await next(page);
}

export async function goals(page: Page) {
  await page.getByRole("group", { name: /do better in the next 3 months/ }).getByText("Walk more steadily").click();
  await pick(page, /How much time/, "20 minutes");
  await next(page);
}

/** Calls the server from the page, with the page's session cookies. */
export const fromServer = (page: Page, path: string) =>
  page.evaluate((p) => fetch(`/api/v1${p}`, { headers: { "X-Auth-Transport": "cookie" } }).then((r) => r.json()), path);

// ---------------------------------------------------------------- straight to the server (test setup)
export const API = process.env.FK_API_ORIGIN ?? "http://localhost:8000";
const SERVER_DIR = path.resolve(__dirname, "../../api");

/** Runs a server command (apps/api app/cli.py), e.g. create-admin; what an operator does on the server. */
export const serverCommand = (...args: string[]) => execFileSync("uv", ["run", "python", "-m", "app.cli", ...args], { cwd: SERVER_DIR, stdio: "pipe" }).toString();

/** Signs a staff number in through the server's own addresses (app-style Bearer token). */
export async function bearerFor(phone: string) {
  const call = (path: string, body: unknown, token?: string) =>
    fetch(`${API}/api/v1${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const { demoCode } = await call("/auth/phone/start", { phone });
  const { accessToken } = await call("/auth/phone/verify", { phone, code: demoCode });
  return { Authorization: `Bearer ${accessToken}` };
}

/** Test setup: a fresh admin and physiotherapist, an uploaded file for this exercise and language, approved. */
export async function approvedVideo(exerciseId: string, lang: "uz" | "ru" | "en") {
  const adminPhone = `+99890${String(Date.now()).slice(-7)}`;
  serverCommand("load-exercises");
  serverCommand("create-admin", adminPhone);
  const admin = { ...(await bearerFor(adminPhone)), "Content-Type": "application/json" };
  const physioPhone = `+99897${String(Date.now() + 1).slice(-7)}`;
  await fetch(`${API}/api/v1/admin/users`, { method: "POST", headers: admin, body: JSON.stringify({ phone: physioPhone, role: "physio" }) });
  const file = { exerciseId, lang };
  const link = await (await fetch(`${API}/api/v1/admin/videos/upload-link`, { method: "POST", headers: admin, body: JSON.stringify(file) })).json();
  await fetch(link.uploadUrl, { method: "PUT", body: new Uint8Array(1024), headers: { "Content-Type": "video/mp4" } });
  const video = await (await fetch(`${API}/api/v1/admin/videos`, { method: "POST", headers: admin, body: JSON.stringify({ ...file, storageKey: link.storageKey }) })).json();
  const physio = { ...(await bearerFor(physioPhone)), "Content-Type": "application/json" };
  const r = await fetch(`${API}/api/v1/review/videos/${video.id}`, { method: "POST", headers: physio, body: JSON.stringify({ decision: "approved" }) });
  if (!r.ok) throw new Error(`approve failed: ${r.status}`);
}
