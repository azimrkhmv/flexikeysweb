import type { Lang } from "@/lib/translate";

// Spec §4/P7: city and district at sign-up (Find help, booking, Home Kit delivery). Tashkent first (rollout).
// The stored value is the Uzbek Latin name (the server's districts.json); Russian and English only change the label
// shown (B59, regionName / districtName).
// ponytail: district lists of the regions are the main districts only; complete before the regional rollout.

export interface Region {
  id: string;
  name: string;
  label: { ru: string; en: string };
  districts: string[];
}

export const REGIONS: Region[] = [
  {
    id: "tashkent_city",
    name: "Toshkent shahri",
    label: { ru: "г. Ташкент", en: "Tashkent city" },
    districts: ["Bektemir", "Chilonzor", "Mirobod", "Mirzo Ulugʻbek", "Olmazor", "Sergeli", "Shayxontohur", "Uchtepa", "Yakkasaroy", "Yangihayot", "Yashnobod", "Yunusobod"],
  },
  { id: "tashkent", name: "Toshkent viloyati", label: { ru: "Ташкентская область", en: "Tashkent region" }, districts: ["Angren", "Bekobod", "Chirchiq", "Olmaliq", "Nurafshon", "Zangiota", "Qibray", "Yangiyoʻl", "Boʻstonliq", "Parkent"] },
  { id: "andijan", name: "Andijon viloyati", label: { ru: "Андижанская область", en: "Andijan region" }, districts: ["Andijon shahri", "Asaka", "Xonobod", "Shahrixon", "Baliqchi", "Paxtaobod"] },
  { id: "fergana", name: "Fargʻona viloyati", label: { ru: "Ферганская область", en: "Fergana region" }, districts: ["Fargʻona shahri", "Margʻilon", "Qoʻqon", "Quvasoy", "Rishton", "Oltiariq"] },
  { id: "namangan", name: "Namangan viloyati", label: { ru: "Наманганская область", en: "Namangan region" }, districts: ["Namangan shahri", "Chust", "Kosonsoy", "Pop", "Uychi", "Toʻraqoʻrgʻon"] },
  { id: "samarkand", name: "Samarqand viloyati", label: { ru: "Самаркандская область", en: "Samarkand region" }, districts: ["Samarqand shahri", "Kattaqoʻrgʻon", "Urgut", "Jomboy", "Pastdargʻom", "Bulungʻur"] },
  { id: "bukhara", name: "Buxoro viloyati", label: { ru: "Бухарская область", en: "Bukhara region" }, districts: ["Buxoro shahri", "Kogon", "Gʻijduvon", "Vobkent", "Qorakoʻl", "Romitan"] },
  { id: "navoi", name: "Navoiy viloyati", label: { ru: "Навоийская область", en: "Navoi region" }, districts: ["Navoiy shahri", "Zarafshon", "Karmana", "Nurota", "Qiziltepa"] },
  { id: "kashkadarya", name: "Qashqadaryo viloyati", label: { ru: "Кашкадарьинская область", en: "Kashkadarya region" }, districts: ["Qarshi", "Shahrisabz", "Kitob", "Gʻuzor", "Koson", "Muborak"] },
  { id: "surkhandarya", name: "Surxondaryo viloyati", label: { ru: "Сурхандарьинская область", en: "Surkhandarya region" }, districts: ["Termiz", "Denov", "Sherobod", "Jarqoʻrgʻon", "Boysun", "Sariosiyo"] },
  { id: "jizzakh", name: "Jizzax viloyati", label: { ru: "Джизакская область", en: "Jizzakh region" }, districts: ["Jizzax shahri", "Zomin", "Gʻallaorol", "Paxtakor", "Doʻstlik"] },
  { id: "syrdarya", name: "Sirdaryo viloyati", label: { ru: "Сырдарьинская область", en: "Syrdarya region" }, districts: ["Guliston", "Yangiyer", "Shirin", "Boyovut", "Sirdaryo"] },
  { id: "khorezm", name: "Xorazm viloyati", label: { ru: "Хорезмская область", en: "Khorezm region" }, districts: ["Urganch", "Xiva", "Xonqa", "Hazorasp", "Shovot", "Gurlan"] },
  { id: "karakalpakstan", name: "Qoraqalpogʻiston Respublikasi", label: { ru: "Республика Каракалпакстан", en: "Republic of Karakalpakstan" }, districts: ["Nukus", "Xoʻjayli", "Toʻrtkoʻl", "Beruniy", "Qoʻngʻirot", "Chimboy"] },
];

/** Russian and English names of each district or town, by its stored Uzbek name. */
const DISTRICT_LABEL: Record<string, { ru: string; en: string }> = {
  Bektemir: { ru: "Бектемирский район", en: "Bektemir" },
  Chilonzor: { ru: "Чиланзарский район", en: "Chilanzar" },
  Mirobod: { ru: "Мирабадский район", en: "Mirabad" },
  "Mirzo Ulugʻbek": { ru: "Мирзо-Улугбекский район", en: "Mirzo Ulugbek" },
  Olmazor: { ru: "Алмазарский район", en: "Almazar" },
  Sergeli: { ru: "Сергелийский район", en: "Sergeli" },
  Shayxontohur: { ru: "Шайхантахурский район", en: "Shaykhantakhur" },
  Uchtepa: { ru: "Учтепинский район", en: "Uchtepa" },
  Yakkasaroy: { ru: "Яккасарайский район", en: "Yakkasaray" },
  Yangihayot: { ru: "Янгихаётский район", en: "Yangikhayot" },
  Yashnobod: { ru: "Яшнабадский район", en: "Yashnabad" },
  Yunusobod: { ru: "Юнусабадский район", en: "Yunusabad" },
  Angren: { ru: "Ангрен", en: "Angren" },
  Bekobod: { ru: "Бекабад", en: "Bekabad" },
  Chirchiq: { ru: "Чирчик", en: "Chirchik" },
  Olmaliq: { ru: "Алмалык", en: "Almalyk" },
  Nurafshon: { ru: "Нурафшан", en: "Nurafshan" },
  Zangiota: { ru: "Зангиатинский район", en: "Zangiata" },
  Qibray: { ru: "Кибрайский район", en: "Kibray" },
  "Yangiyoʻl": { ru: "Янгиюль", en: "Yangiyul" },
  "Boʻstonliq": { ru: "Бостанлыкский район", en: "Bostanlyk" },
  Parkent: { ru: "Паркентский район", en: "Parkent" },
  "Andijon shahri": { ru: "г. Андижан", en: "Andijan city" },
  Asaka: { ru: "Асака", en: "Asaka" },
  Xonobod: { ru: "Ханабад", en: "Khanabad" },
  Shahrixon: { ru: "Шахрихан", en: "Shakhrikhan" },
  Baliqchi: { ru: "Балыкчинский район", en: "Balikchi" },
  Paxtaobod: { ru: "Пахтаабад", en: "Pakhtaabad" },
  "Fargʻona shahri": { ru: "г. Фергана", en: "Fergana city" },
  "Margʻilon": { ru: "Маргилан", en: "Margilan" },
  "Qoʻqon": { ru: "Коканд", en: "Kokand" },
  Quvasoy: { ru: "Кувасай", en: "Kuvasay" },
  Rishton: { ru: "Риштан", en: "Rishtan" },
  Oltiariq: { ru: "Алтыарык", en: "Altyaryk" },
  "Namangan shahri": { ru: "г. Наманган", en: "Namangan city" },
  Chust: { ru: "Чуст", en: "Chust" },
  Kosonsoy: { ru: "Касансай", en: "Kasansay" },
  Pop: { ru: "Пап", en: "Pap" },
  Uychi: { ru: "Уйчи", en: "Uychi" },
  "Toʻraqoʻrgʻon": { ru: "Туракурган", en: "Turakurgan" },
  "Samarqand shahri": { ru: "г. Самарканд", en: "Samarkand city" },
  "Kattaqoʻrgʻon": { ru: "Каттакурган", en: "Kattakurgan" },
  Urgut: { ru: "Ургут", en: "Urgut" },
  Jomboy: { ru: "Джамбай", en: "Jambay" },
  "Pastdargʻom": { ru: "Пастдаргомский район", en: "Pastdargom" },
  "Bulungʻur": { ru: "Булунгур", en: "Bulungur" },
  "Buxoro shahri": { ru: "г. Бухара", en: "Bukhara city" },
  Kogon: { ru: "Каган", en: "Kagan" },
  "Gʻijduvon": { ru: "Гиждуван", en: "Gijduvan" },
  Vobkent: { ru: "Вабкент", en: "Vabkent" },
  "Qorakoʻl": { ru: "Каракуль", en: "Karakul" },
  Romitan: { ru: "Ромитан", en: "Romitan" },
  "Navoiy shahri": { ru: "г. Навои", en: "Navoi city" },
  Zarafshon: { ru: "Зарафшан", en: "Zarafshan" },
  Karmana: { ru: "Кармана", en: "Karmana" },
  Nurota: { ru: "Нурата", en: "Nurata" },
  Qiziltepa: { ru: "Кызылтепа", en: "Kyzyltepa" },
  Qarshi: { ru: "Карши", en: "Karshi" },
  Shahrisabz: { ru: "Шахрисабз", en: "Shakhrisabz" },
  Kitob: { ru: "Китаб", en: "Kitab" },
  "Gʻuzor": { ru: "Гузар", en: "Guzar" },
  Koson: { ru: "Касан", en: "Kasan" },
  Muborak: { ru: "Мубарек", en: "Mubarek" },
  Termiz: { ru: "Термез", en: "Termez" },
  Denov: { ru: "Денау", en: "Denau" },
  Sherobod: { ru: "Шерабад", en: "Sherabad" },
  "Jarqoʻrgʻon": { ru: "Джаркурган", en: "Jarkurgan" },
  Boysun: { ru: "Байсун", en: "Baysun" },
  Sariosiyo: { ru: "Сариасия", en: "Sariasiya" },
  "Jizzax shahri": { ru: "г. Джизак", en: "Jizzakh city" },
  Zomin: { ru: "Зааминский район", en: "Zaamin" },
  "Gʻallaorol": { ru: "Галляарал", en: "Gallaaral" },
  Paxtakor: { ru: "Пахтакор", en: "Pakhtakor" },
  "Doʻstlik": { ru: "Дустлик", en: "Dustlik" },
  Guliston: { ru: "Гулистан", en: "Gulistan" },
  Yangiyer: { ru: "Янгиер", en: "Yangiyer" },
  Shirin: { ru: "Ширин", en: "Shirin" },
  Boyovut: { ru: "Баяут", en: "Bayaut" },
  Sirdaryo: { ru: "Сырдарья", en: "Syrdarya" },
  Urganch: { ru: "Ургенч", en: "Urgench" },
  Xiva: { ru: "Хива", en: "Khiva" },
  Xonqa: { ru: "Ханка", en: "Khanka" },
  Hazorasp: { ru: "Хазарасп", en: "Khazarasp" },
  Shovot: { ru: "Шават", en: "Shavat" },
  Gurlan: { ru: "Гурлен", en: "Gurlen" },
  Nukus: { ru: "Нукус", en: "Nukus" },
  "Xoʻjayli": { ru: "Ходжейли", en: "Khojeyli" },
  "Toʻrtkoʻl": { ru: "Турткуль", en: "Turtkul" },
  Beruniy: { ru: "Беруни", en: "Beruniy" },
  "Qoʻngʻirot": { ru: "Кунград", en: "Kungrad" },
  Chimboy: { ru: "Чимбай", en: "Chimbay" },
};

export const regionById = (id: string) => REGIONS.find((r) => r.id === id);
/** A region's name in the app language; the stored id never changes. */
export const regionName = (id: string, lang: Lang) => {
  const r = regionById(id);
  return r && (lang === "uz" ? r.name : r.label[lang]);
};
/** A district's name in the app language; the stored value stays the Uzbek name. */
export const districtName = (d: string, lang: Lang) => (lang === "uz" ? d : DISTRICT_LABEL[d]?.[lang] ?? d);
/** Every district has its Russian and English name (backend-content.test.ts). */
export const districtsWithoutLabel = () => REGIONS.flatMap((r) => r.districts).filter((d) => !DISTRICT_LABEL[d]);
