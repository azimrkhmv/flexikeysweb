import { describe, expect, it } from "vitest";
import { toCyrillic } from "./cyrillic";

describe("toCyrillic", () => {
  it("transliterates Uzbek Latin", () => {
    expect(toCyrillic("Oʻzbekcha")).toBe("Ўзбекча");
    expect(toCyrillic("Shahar va tuman")).toBe("Шаҳар ва туман");
    expect(toCyrillic("bogʻcha")).toBe("боғча");
    expect(toCyrillic("yangi yoʻl")).toBe("янги йўл");
    expect(toCyrillic("ertalab")).toBe("эрталаб");
    expect(toCyrillic("sanʼat")).toBe("санъат");
    expect(toCyrillic("Choy")).toBe("Чой");
  });
  it("keeps placeholders, acronyms and brand names", () => {
    expect(toCyrillic("Salom, {name}!")).toBe("Салом, {name}!");
    expect(toCyrillic("FlexiKeys GMFCS SMS")).toBe("FlexiKeys GMFCS SMS");
  });
});
