import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import mine from "./backend/topics.json";
import { topicsOf } from "./topics";

it("the website's topic words are the server's", () => {
  const server = JSON.parse(readFileSync(new URL("../../../api/app/content/topics.json", import.meta.url), "utf8"));
  expect(mine).toEqual(server);
});

it("finds topics in all 4 languages", () => {
  expect(topicsOf("How do we do the stretch?")).toEqual(["exercise"]);
  expect(topicsOf("Ребёнок устал и плачет")).toEqual(["refuses_or_tired"]);
  expect(topicsOf("Shifokorga yozilsak boʻladimi?")).toEqual(["booking", "medical"]);
  expect(topicsOf("Дори дозаси қанча?")).toEqual(["medical"]);
  expect(topicsOf("Hello")).toEqual(["other"]);
});
