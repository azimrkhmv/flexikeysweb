import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import mine from "./backend/languages.json";
import { answerLang } from "./answerLang";

it("the website's language words are the server's", () => {
  const server = JSON.parse(readFileSync(new URL("../../../api/app/content/languages.json", import.meta.url), "utf8"));
  expect(mine).toEqual(server);
});

// The same cases as the server's test_the_language_of_the_question.
it("the answer follows the language of the question, not the screen (B93)", () => {
  expect(answerLang("Что делаем сегодня?", "uz")).toBe("ru");
  expect(answerLang("Bugun nima qilamiz?", "ru")).toBe("uz");
  expect(answerLang("Болам бугун машқ қилмади", "ru")).toBe("uz"); // Uzbek in Cyrillic letters
  expect(answerLang("Bolam bugun mashq qilmadi, устал", "ru")).toBe("uz"); // mixed: most of it is Uzbek
  expect(answerLang("Rebenok segodnya ustal, chto delat?", "uz")).toBe("ru"); // Russian in Latin letters
  expect(answerLang("What do we do today?", "uz")).toBe("en");
  expect(answerLang("Ogiloy", "uz")).toBe("uz"); // no word tells: the screen's language
  expect(answerLang("ok 👍", "ru")).toBe("ru");
  expect(answerLang("Bugun игра", "uz")).toBe("uz"); // a tie: the screen's language
  expect(answerLang("Bugun игра", "ru")).toBe("ru");
});

it("the three suggested questions are answered in their own language", () => {
  expect(answerLang("Vazifalarni kunimizga qanday sigʻdirsak boʻladi?", "en")).toBe("uz");
  expect(answerLang("Как вписать задания в наш день?", "en")).toBe("ru");
  expect(answerLang("How do I fit the tasks into our day?", "uz")).toBe("en");
});
