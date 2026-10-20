import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import mine from "./backend/emergency.json";
import { isEmergency } from "./emergency";

it("the website's emergency words are the server's", () => {
  const server = JSON.parse(readFileSync(new URL("../../../api/app/content/emergency.json", import.meta.url), "utf8"));
  expect(mine).toEqual(server);
});

it("finds emergencies in all 4 languages, and nothing in calm questions", () => {
  for (const text of ["He had a seizure", "У ребёнка судороги", "Bolada tutqanoq boʻldi", "Болада тутқаноқ бўлди", "she fell and hit her head", "nafas ololmayapti"])
    expect(isEmergency(text), text).toBe(true);
  for (const text of ["How long should we play?", "Приступайте к упражнению", "Qachon mashq qilamiz?"]) expect(isEmergency(text), text).toBe(false);
});
