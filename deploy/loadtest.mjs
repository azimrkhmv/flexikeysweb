#!/usr/bin/env node
// Load test (B120, Update 4 spec 9): 50 parents at the same time each sign up, answer the quick start, open the plan
// and save one game record. Prints errors and p50/p95 per step. Pass: 0 errors and p95 under 2 s for every call.
//
//   FK_LOADTEST_SECRET=... node loadtest.mjs                 against https://localhost (the local production stack)
//   FK_LOADTEST_SECRET=... node loadtest.mjs --production    against https://flexikeys.org
//   options: --parents 50   --url https://...   (a flexikeys.org address still needs --production)
//
// Sign-up uses the test numbers +998 00 ... with the server's FK_LOADTEST_SECRET (deploy/README.md: unset it after).
// Every number used is added to .loadtest-phones.json; loadtest-cleanup.mjs deletes those accounts and their data.
// Node's own fetch only, no packages.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PHONES_FILE = join(HERE, ".loadtest-phones.json");
const P95_LIMIT_MS = 2000;

export function target(argv = process.argv.slice(2)) {
  const arg = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const production = argv.includes("--production");
  const url = new URL(arg("--url") ?? (production ? "https://flexikeys.org" : "https://localhost"));
  if (/(^|\.)flexikeys\.org$/i.test(url.hostname) && !production) {
    console.error(`Refusing to run against ${url.origin} without --production.`);
    process.exit(2);
  }
  // The local stack's Caddy signs localhost with its own certificate.
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost")) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const secret = process.env.FK_LOADTEST_SECRET;
  if (!secret) {
    console.error("Set FK_LOADTEST_SECRET to the value in the server's deploy/.env.");
    process.exit(2);
  }
  return { api: `${url.origin}/api/v1`, secret, parents: Number(arg("--parents") ?? 50) };
}

export function readPhones() {
  return existsSync(PHONES_FILE) ? JSON.parse(readFileSync(PHONES_FILE, "utf8")) : [];
}
export function writePhones(list) {
  writeFileSync(PHONES_FILE, JSON.stringify([...new Set(list)], null, 2));
}

/** One call, timed per step. Throws on a non-2xx answer. */
export function client(api, secret, timings) {
  return async function call(step, method, path, { body, token } = {}) {
    const headers = { "content-type": "application/json", "x-fk-loadtest": secret };
    if (token) headers.authorization = `Bearer ${token}`;
    const t0 = performance.now();
    const r = await fetch(api + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await r.text();
    (timings[step] ??= []).push(performance.now() - t0);
    if (!r.ok) throw new Error(`${step}: ${r.status} ${text.slice(0, 160)}`);
    return text ? JSON.parse(text) : null;
  };
}

/** Signs a test number in (an account is made the first time) and returns the access token. */
export async function signIn(call, phone) {
  const { demoCode } = await call("sign-in code", "POST", "/auth/phone/start", { body: { phone } });
  if (!demoCode) throw new Error("sign-in code: no code came back (is FK_LOADTEST_SECRET the same on the server?)");
  const r = await call("sign-in", "POST", "/auth/phone/verify", { body: { phone, code: demoCode, lang: "uz" } });
  return r.accessToken;
}

// The required quick-start answers of the CEO's questionnaire (made with apps/api tests/test_intake_quick.py
// quick_answers(SEED), 23 Nov 2026): a 7-year-old with cerebral palsy, one side, who sits only with help.
const QUICK = {
  A1: "Test", A2: "2019-05-01", A3: "boy", A7_langs: ["uzbek"], B1: ["cp"], B3_parts: ["left_arm"], B6: "no", B8: "no",
  C3: "cant_sit", C6: "alone_7m", C10: "i", C12: "no", CP1_types: ["spastic"], CP2: "one_side", CP3: "no", D7: "accurately",
  E3: "never", E7: "no", E13: "no", J9: ["hold"],
};

async function parent(call, phone) {
  const token = await signIn(call, phone);
  const as = { token };
  await call("sign-up step", "PATCH", "/me/signup", { ...as, body: { region: "tashkent_city", district: "Chilonzor", consent: true } });
  const child = await call("add child", "POST", "/children", { ...as, body: { name: "Test", birthDate: "2019-05-01", sex: "boy", color: "sky" } });
  await call("health consent", "PUT", `/children/${child.id}/consents/health`, { ...as, body: { granted: true } });
  await call("save answers", "PUT", `/children/${child.id}/intake/1`, { ...as, body: { answers: QUICK } });
  await call("quick plan", "POST", `/children/${child.id}/intake/1/finish?quick=true`, { ...as, body: {} });
  const plan = await call("open plan", "GET", `/children/${child.id}/plan`, as);
  if (!plan?.days?.length) throw new Error("open plan: the plan has no days");
  const session = await call("start game", "POST", `/children/${child.id}/game-sessions`, { ...as, body: {} });
  const game = {
    id: crypto.randomUUID(), ts: new Date().toISOString(), sessionId: session.id, game: "find_same", level: 1, tier: 1, step: 1,
    itemId: "apple", inputMode: "touch", outcome: "correct", attempts: 1, hintShown: "none", accessEvent: false, helpedByAdult: false, responseMs: 1800,
  };
  const saved = await call("game record", "POST", `/children/${child.id}/tries`, { ...as, body: [game] });
  if (saved.stored !== 1) throw new Error(`game record: stored ${saved.stored}, expected 1`);
}

const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};

async function main() {
  const { api, secret, parents } = target();
  const run = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  const phones = Array.from({ length: parents }, (_, i) => `+99800${run}${String(i).padStart(4, "0")}`);
  writePhones([...readPhones(), ...phones]); // before the test, so a crash halfway still gets cleaned up
  const timings = {};
  const call = client(api, secret, timings);
  console.log(`${parents} parents at once against ${api} (numbers +99800${run}xxxx)`);
  const t0 = performance.now();
  const results = await Promise.allSettled(phones.map((p) => parent(call, p)));
  const errors = results.flatMap((r, i) => (r.status === "rejected" ? [`${phones[i]}: ${r.reason?.message ?? r.reason}`] : []));
  console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s\n`);
  console.log("step               calls    p50 ms   p95 ms   max ms");
  let slow = false;
  for (const [step, t] of Object.entries(timings)) {
    const p95 = pct(t, 95);
    slow ||= p95 >= P95_LIMIT_MS;
    console.log(`${step.padEnd(18)} ${String(t.length).padStart(5)} ${pct(t, 50).toFixed(0).padStart(9)} ${p95.toFixed(0).padStart(8)} ${Math.max(...t).toFixed(0).padStart(8)}${p95 >= P95_LIMIT_MS ? "  SLOW" : ""}`);
  }
  console.log(`\nerrors: ${errors.length}`);
  errors.slice(0, 20).forEach((e) => console.log("  " + e));
  const pass = errors.length === 0 && !slow;
  console.log(pass ? "PASS: 0 errors, every p95 under 2 s" : "FAIL");
  console.log("Next: node loadtest-cleanup.mjs" + (process.argv.includes("--production") ? " --production" : "") + ", then empty FK_LOADTEST_SECRET on the server.");
  process.exit(pass ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main();
