// Spec §4/P7: city and district at sign-up (Find help, booking, Home Kit delivery). Tashkent first (rollout).
// Names are proper nouns in Uzbek Latin; the Cyrillic app language transliterates them. Russian/English show the same.
// ponytail: district lists of the regions are the main districts only; complete before the regional rollout.

export interface Region {
  id: string;
  name: string;
  districts: string[];
}

export const REGIONS: Region[] = [
  {
    id: "tashkent_city",
    name: "Toshkent shahri",
    districts: ["Bektemir", "Chilonzor", "Mirobod", "Mirzo Ulugʻbek", "Olmazor", "Sergeli", "Shayxontohur", "Uchtepa", "Yakkasaroy", "Yangihayot", "Yashnobod", "Yunusobod"],
  },
  { id: "tashkent", name: "Toshkent viloyati", districts: ["Angren", "Bekobod", "Chirchiq", "Olmaliq", "Nurafshon", "Zangiota", "Qibray", "Yangiyoʻl", "Boʻstonliq", "Parkent"] },
  { id: "andijan", name: "Andijon viloyati", districts: ["Andijon shahri", "Asaka", "Xonobod", "Shahrixon", "Baliqchi", "Paxtaobod"] },
  { id: "fergana", name: "Fargʻona viloyati", districts: ["Fargʻona shahri", "Margʻilon", "Qoʻqon", "Quvasoy", "Rishton", "Oltiariq"] },
  { id: "namangan", name: "Namangan viloyati", districts: ["Namangan shahri", "Chust", "Kosonsoy", "Pop", "Uychi", "Toʻraqoʻrgʻon"] },
  { id: "samarkand", name: "Samarqand viloyati", districts: ["Samarqand shahri", "Kattaqoʻrgʻon", "Urgut", "Jomboy", "Pastdargʻom", "Bulungʻur"] },
  { id: "bukhara", name: "Buxoro viloyati", districts: ["Buxoro shahri", "Kogon", "Gʻijduvon", "Vobkent", "Qorakoʻl", "Romitan"] },
  { id: "navoi", name: "Navoiy viloyati", districts: ["Navoiy shahri", "Zarafshon", "Karmana", "Nurota", "Qiziltepa"] },
  { id: "kashkadarya", name: "Qashqadaryo viloyati", districts: ["Qarshi", "Shahrisabz", "Kitob", "Gʻuzor", "Koson", "Muborak"] },
  { id: "surkhandarya", name: "Surxondaryo viloyati", districts: ["Termiz", "Denov", "Sherobod", "Jarqoʻrgʻon", "Boysun", "Sariosiyo"] },
  { id: "jizzakh", name: "Jizzax viloyati", districts: ["Jizzax shahri", "Zomin", "Gʻallaorol", "Paxtakor", "Doʻstlik"] },
  { id: "syrdarya", name: "Sirdaryo viloyati", districts: ["Guliston", "Yangiyer", "Shirin", "Boyovut", "Sirdaryo"] },
  { id: "khorezm", name: "Xorazm viloyati", districts: ["Urganch", "Xiva", "Xonqa", "Hazorasp", "Shovot", "Gurlan"] },
  { id: "karakalpakstan", name: "Qoraqalpogʻiston Respublikasi", districts: ["Nukus", "Xoʻjayli", "Toʻrtkoʻl", "Beruniy", "Qoʻngʻirot", "Chimboy"] },
];

export const regionById = (id: string) => REGIONS.find((r) => r.id === id);
