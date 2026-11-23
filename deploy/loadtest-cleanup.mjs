#!/usr/bin/env node
// Deletes every load-test account (B120) and its data: each number loadtest.mjs saved in .loadtest-phones.json signs
// in with the test sign-in and deletes its own account (DELETE /me: the family, the children and everything about
// them at once; their files overnight). A number that never made an account is simply dropped from the list.
//
//   FK_LOADTEST_SECRET=... node loadtest-cleanup.mjs [--production] [--url https://...]

import { client, readPhones, signIn, target, writePhones } from "./loadtest.mjs";

const { api, secret } = target();
const timings = {};
const call = client(api, secret, timings);
const phones = readPhones();
if (!phones.length) {
  console.log("Nothing to clean up (.loadtest-phones.json is empty or missing).");
  process.exit(0);
}
console.log(`Deleting ${phones.length} load-test accounts on ${api} ...`);

let deleted = 0;
const left = [];
for (let i = 0; i < phones.length; i += 10) {
  await Promise.all(
    phones.slice(i, i + 10).map(async (phone) => {
      try {
        const token = await signIn(call, phone);
        await call("delete account", "DELETE", "/me", { token });
        deleted++;
      } catch (e) {
        console.log(`  ${phone}: ${e.message}`);
        left.push(phone);
      }
    }),
  );
}
writePhones(left);
console.log(`Deleted ${deleted}; ${left.length} left in .loadtest-phones.json${left.length ? " (run again)" : ""}.`);
process.exit(left.length ? 1 : 0);
