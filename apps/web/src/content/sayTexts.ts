import type { Lang } from "@/lib/i18n";
import type { L10n } from "@/lib/types";
import { VOCAB } from "./vocab";

// Do What I Say (games spec 8 Nov 2026, §6.6): what the child hears or reads, then picks.
// Seed: "Show me the cat" (any picture of the pools) · Sprout: a colour and a shape, then also a size (built from the
// words below, so every language says it its own way) · Tree: 20 texts of two sentences · Summit: 20 texts of three or
// four sentences. Each text has a question and four pictures (vocab ids); the text names the answer or lets the child
// work it out, and never fits another option.
// uz text drafted 8 Nov 2026 — native-speaker check (B44).

/** Seed: "Show me the {word}". Russian asks "Где …?" so the word keeps its dictionary form. */
export const showMe = (word: string, lang: Lang) => ({ en: `Show me the ${word}.`, ru: `Где ${word}?`, uz: `${word.charAt(0).toUpperCase()}${word.slice(1)}ni koʻrsat.` })[lang];

/** Sprout: the shapes and colours asked about, with Russian gender (m, f, n) for the adjectives. */
export const SAY_SHAPES = { circle: "m", square: "m", triangle: "m", star: "f", heart: "n" } as const;
export const SAY_COLORS = ["red", "blue", "green", "yellow", "purple"] as const;
const SHAPE_WORD: Record<keyof typeof SAY_SHAPES, L10n> = {
  circle: { en: "circle", ru: "круг", uz: "doira" },
  square: { en: "square", ru: "квадрат", uz: "kvadrat" },
  triangle: { en: "triangle", ru: "треугольник", uz: "uchburchak" },
  star: { en: "star", ru: "звезда", uz: "yulduz" },
  heart: { en: "heart", ru: "сердце", uz: "yurak" },
};
const ADJ: Record<string, { en: string; uz: string; ru: [string, string, string] }> = {
  red: { en: "red", uz: "qizil", ru: ["красный", "красная", "красное"] },
  blue: { en: "blue", uz: "koʻk", ru: ["синий", "синяя", "синее"] },
  green: { en: "green", uz: "yashil", ru: ["зелёный", "зелёная", "зелёное"] },
  yellow: { en: "yellow", uz: "sariq", ru: ["жёлтый", "жёлтая", "жёлтое"] },
  purple: { en: "purple", uz: "binafsha", ru: ["фиолетовый", "фиолетовая", "фиолетовое"] },
  big: { en: "big", uz: "katta", ru: ["большой", "большая", "большое"] },
  small: { en: "small", uz: "kichik", ru: ["маленький", "маленькая", "маленькое"] },
};
/** "Show me the big red circle." / «Где большой красный круг?» / «Katta qizil doirani koʻrsat.» */
export function showShape(shape: keyof typeof SAY_SHAPES, color: string, size: "big" | "small" | null, lang: Lang): string {
  const words = [size, color].filter((x): x is string => !!x).map((a) => ADJ[a]);
  const g = { m: 0, f: 1, n: 2 }[SAY_SHAPES[shape]];
  if (lang === "ru") return `Где ${[...words.map((a) => a.ru[g]), SHAPE_WORD[shape].ru].join(" ")}?`;
  return showMe([...words.map((a) => a[lang]), SHAPE_WORD[shape][lang]].join(" "), lang);
}

export interface SayText {
  id: string;
  tier: 3 | 4;
  text: L10n;
  question: L10n;
  answer: string;
  options: string[];
}
const s = (id: string, tier: 3 | 4, en: [string, string], ru: [string, string], uz: [string, string], answer: string, options: string[]): SayText => ({
  id,
  tier,
  text: { en: en[0], ru: ru[0], uz: uz[0] },
  question: { en: en[1], ru: ru[1], uz: uz[1] },
  answer,
  options,
});

export const SAY_TEXTS: SayText[] = [
  // ---------------------------------------------------------------- Tree: two sentences
  s("ball", 3, ["Ali has a red ball. He plays with it in the garden.", "What does Ali play with?"], ["У Али красный мяч. Он играет с ним в саду.", "С чем играет Али?"], ["Alining qizil koptogi bor. U bogʻda u bilan oʻynaydi.", "Ali nima bilan oʻynaydi?"], "ball", ["ball", "kite", "drum", "car"]),
  s("milk", 3, ["The cat is hungry. Mother gives the cat some milk.", "What does the cat get?"], ["Кошка голодная. Мама даёт кошке молоко.", "Что получает кошка?"], ["Mushuk och. Ona mushukka sut beradi.", "Mushuk nima oladi?"], "milk", ["milk", "bread", "apple", "soup"]),
  s("rain", 3, ["It is raining. Malika takes her umbrella.", "What does Malika take?"], ["Идёт дождь. Малика берёт зонт.", "Что берёт Малика?"], ["Yomgʻir yogʻyapti. Malika soyabonini oladi.", "Malika nima oladi?"], "umbrella", ["umbrella", "cap", "ball", "book"]),
  s("bus", 3, ["Grandpa goes to the city. He goes by bus.", "How does Grandpa go?"], ["Дедушка едет в город. Он едет на автобусе.", "На чём едет дедушка?"], ["Bobo shaharga boradi. U avtobusda boradi.", "Bobo nimada boradi?"], "bus", ["bus", "bike", "boat", "plane"]),
  s("coat", 3, ["It is snowing outside. Aziz puts on his warm coat.", "What does Aziz put on?"], ["На улице идёт снег. Азиз надевает тёплое пальто.", "Что надевает Азиз?"], ["Tashqarida qor yogʻyapti. Aziz issiq paltosini kiyadi.", "Aziz nima kiyadi?"], "coat", ["coat", "tshirt", "dress", "cap"]),
  s("fish", 3, ["Father goes to the river. He catches a big fish.", "What does Father catch?"], ["Папа идёт к реке. Он ловит большую рыбу.", "Кого ловит папа?"], ["Ota daryoga boradi. U katta baliq tutadi.", "Ota nima tutadi?"], "fish", ["fish", "frog", "bird", "rabbit"]),
  s("bed", 3, ["The baby is tired. She sleeps in her bed.", "Where does the baby sleep?"], ["Малыш устал. Он спит в кроватке.", "Где спит малыш?"], ["Chaqaloq charchadi. U karavotda uxlaydi.", "Chaqaloq qayerda uxlaydi?"], "bed", ["bed", "car", "tree", "boat"]),
  s("carrot", 3, ["The rabbit is in the garden. It eats a carrot.", "What does the rabbit eat?"], ["Кролик в огороде. Он ест морковку.", "Что ест кролик?"], ["Quyon bogʻda. U sabzi yeydi.", "Quyon nima yeydi?"], "carrot", ["carrot", "banana", "corn", "cherry"]),
  s("kite", 3, ["It is windy today. Sara flies her kite.", "What does Sara fly?"], ["Сегодня ветрено. Сара запускает воздушного змея.", "Что запускает Сара?"], ["Bugun shamol esyapti. Sara varrak uchiradi.", "Sara nima uchiradi?"], "kite", ["kite", "balloon", "plane", "bird"]),
  s("teeth", 3, ["It is evening. Timur brushes his teeth with a toothbrush.", "What does Timur use?"], ["Наступил вечер. Тимур чистит зубы щёткой.", "Чем Тимур чистит зубы?"], ["Kech boʻldi. Temur tishlarini choʻtka bilan tozalaydi.", "Temur nima bilan tozalaydi?"], "toothbrush", ["toothbrush", "soap", "book", "cap"]),
  s("cow", 3, ["Grandma has a cow. The cow gives milk every day.", "Who gives milk?"], ["У бабушки есть корова. Корова каждый день даёт молоко.", "Кто даёт молоко?"], ["Buvining sigiri bor. Sigir har kuni sut beradi.", "Kim sut beradi?"], "cow", ["cow", "horse", "dog", "chicken"]),
  s("soap", 3, ["Before lunch, Lola washes her hands. She uses soap.", "What does Lola use?"], ["Перед обедом Лола моет руки. Она берёт мыло.", "Что берёт Лола?"], ["Tushlikdan oldin Lola qoʻlini yuvadi. U sovun ishlatadi.", "Lola nima ishlatadi?"], "soap", ["soap", "toothbrush", "gloves", "scarf"]),
  s("song", 3, ["A bird sits in the tree. It sings a song.", "Who sings?"], ["На дереве сидит птица. Она поёт песню.", "Кто поёт?"], ["Daraxtda qush oʻtiribdi. U qoʻshiq aytadi.", "Kim qoʻshiq aytadi?"], "bird", ["bird", "cat", "frog", "cow"]),
  s("cap", 3, ["The sun is hot today. Ravshan wears a cap.", "What does Ravshan wear?"], ["Сегодня жарко. Равшан надевает кепку.", "Что надевает Равшан?"], ["Bugun quyosh qattiq isitadi. Ravshan kepka kiyadi.", "Ravshan nima kiyadi?"], "cap", ["cap", "coat", "gloves", "scarf"]),
  s("drum", 3, ["Kamol likes music. He plays the drum.", "What does Kamol play?"], ["Камол любит музыку. Он играет на барабане.", "На чём играет Камол?"], ["Kamol musiqani yaxshi koʻradi. U baraban chaladi.", "Kamol nima chaladi?"], "drum", ["drum", "ball", "puzzle", "blocks"]),
  s("bread", 3, ["Mother goes to the shop. She buys bread.", "What does Mother buy?"], ["Мама идёт в магазин. Она покупает хлеб.", "Что покупает мама?"], ["Ona doʻkonga boradi. U non sotib oladi.", "Ona nima sotib oladi?"], "bread", ["bread", "milk", "apple", "soup"]),
  s("train", 3, ["Dilnoza goes to see Grandma. She goes by train.", "How does Dilnoza go?"], ["Дильноза едет к бабушке. Она едет на поезде.", "На чём едет Дильноза?"], ["Dilnoza buvisinikiga boradi. U poyezdda boradi.", "Dilnoza nimada boradi?"], "train", ["train", "car", "bike", "bus"]),
  s("horse", 3, ["The horse is in the field. It eats green grass.", "Who is in the field?"], ["Лошадь стоит в поле. Она ест зелёную траву.", "Кто стоит в поле?"], ["Ot dalada turibdi. U yashil oʻt yeydi.", "Dalada kim turibdi?"], "horse", ["horse", "fish", "bird", "lion"]),
  s("teddy", 3, ["Nodira has a soft teddy bear. She sleeps with it at night.", "What does Nodira sleep with?"], ["У Нодиры есть мягкий мишка. Она спит с ним ночью.", "С чем спит Нодира?"], ["Nodiraning yumshoq ayiqchasi bor. U kechasi u bilan uxlaydi.", "Nodira nima bilan uxlaydi?"], "teddy", ["teddy", "ball", "drum", "kite"]),
  s("melon", 3, ["In summer, the family eats a big watermelon. It is sweet and red inside.", "What does the family eat?"], ["Летом семья ест большой арбуз. Внутри он сладкий и красный.", "Что ест семья?"], ["Yozda oila katta tarvuz yeydi. Uning ichi shirin va qizil.", "Oila nima yeydi?"], "watermelon", ["watermelon", "lemon", "onion", "pepper"]),

  // ---------------------------------------------------------------- Summit: three or four sentences
  s("picnic", 4, ["On Sunday, the family goes to the park. Father brings bread and Mother brings apples. Ali brings his ball. They play and eat under a big tree.", "What does Mother bring?"], ["В воскресенье семья идёт в парк. Папа берёт хлеб, а мама — яблоки. Али берёт свой мяч. Они играют и едят под большим деревом.", "Что берёт мама?"], ["Yakshanba kuni oila bogʻga boradi. Ota non, ona esa olma oladi. Ali koptogini oladi. Ular katta daraxt ostida oʻynab, ovqatlanadi.", "Ona nima oladi?"], "apple", ["apple", "bread", "ball", "milk"]),
  s("lostcat", 4, ["Malika could not find her cat. She looked under the bed and in the garden. At last she found the cat on the roof of the house. The cat was sleeping in the sun.", "Where was the cat?"], ["Малика не могла найти кошку. Она искала под кроватью и в саду. Наконец она нашла кошку на крыше дома. Кошка спала на солнце.", "Где была кошка?"], ["Malika mushugini topa olmadi. U karavot ostidan va bogʻdan qidirdi. Nihoyat mushukni uyning tomidan topdi. Mushuk quyoshda uxlayotgan edi.", "Mushuk qayerda edi?"], "house", ["house", "bed", "tree", "car"]),
  s("soup", 4, ["Aziz wants to make soup. He buys potatoes, carrots and onions. He forgets the tomatoes, so he goes back to the shop.", "What did Aziz forget?"], ["Азиз хочет сварить суп. Он покупает картошку, морковь и лук. Он забыл помидоры и вернулся в магазин.", "Что забыл Азиз?"], ["Aziz shoʻrva pishirmoqchi. U kartoshka, sabzi va piyoz sotib oladi. U pomidorni unutib qoʻyadi va doʻkonga qaytadi.", "Aziz nimani unutdi?"], "tomato", ["tomato", "potato", "carrot", "onion"]),
  s("zoo", 4, ["The children go to the zoo. First they see a lion. Then they see a bear eating fish. Last of all they feed the rabbits.", "What did they see first?"], ["Дети идут в зоопарк. Сначала они видят льва. Потом они видят медведя, который ест рыбу. В конце они кормят кроликов.", "Кого дети увидели сначала?"], ["Bolalar hayvonot bogʻiga boradi. Avval ular sherni koʻradi. Keyin baliq yeyayotgan ayiqni koʻradi. Oxirida ular quyonlarni boqadi.", "Bolalar avval kimni koʻrdi?"], "lion", ["lion", "bear", "rabbit", "fish"]),
  s("weather", 4, ["In the morning the sun was shining. After lunch, dark clouds came. Then it began to snow, and the children made a snowman.", "What was there in the morning?"], ["Утром светило солнце. После обеда пришли тёмные тучи. Потом пошёл снег, и дети слепили снеговика.", "Что было утром?"], ["Ertalab quyosh charaqlab turdi. Tushdan keyin qora bulutlar keldi. Keyin qor yogʻdi va bolalar qorbobo yasadi.", "Ertalab nima bor edi?"], "sun", ["sun", "cloud", "snow", "rain"]),
  s("birthday", 4, ["Today is Sara's birthday. Her brother gives her a balloon. Her grandma gives her a book. Her friends bring a big cake.", "What does Grandma give?"], ["Сегодня у Сары день рождения. Брат дарит ей шарик. Бабушка дарит ей книгу. Друзья приносят большой торт.", "Что дарит бабушка?"], ["Bugun Saraning tugʻilgan kuni. Akasi unga shar sovgʻa qiladi. Buvisi unga kitob sovgʻa qiladi. Doʻstlari katta tort olib keladi.", "Buvisi nima sovgʻa qiladi?"], "book", ["book", "balloon", "teddy", "puzzle"]),
  s("farm", 4, ["On the farm, the chicken wakes up first. Then the cow goes out to the field. The dog runs after the sheep all day.", "Who wakes up first?"], ["На ферме первой просыпается курица. Потом корова выходит в поле. Собака весь день бегает за овцами.", "Кто просыпается первым?"], ["Fermada birinchi boʻlib tovuq uygʻonadi. Keyin sigir dalaga chiqadi. It kun boʻyi qoʻylar ortidan yuguradi.", "Kim birinchi uygʻonadi?"], "chicken", ["chicken", "cow", "dog", "sheep"]),
  s("umbrella", 4, ["Timur walks home from school. It starts to rain, but he has no umbrella. His sister sees him and runs out with an umbrella.", "Who brings the umbrella?"], ["Тимур идёт домой из школы. Начинается дождь, а зонта у него нет. Сестра видит его и выбегает с зонтом.", "Кто приносит зонт?"], ["Temur maktabdan uyga ketyapti. Yomgʻir yogʻa boshlaydi, lekin uning soyaboni yoʻq. Opasi uni koʻrib, soyabon bilan chiqadi.", "Soyabonni kim olib chiqadi?"], "sister", ["sister", "mother", "father", "grandpa"]),
  s("fruit", 4, ["Lola has three fruits: a banana, a pear and an orange. She eats the banana. She gives the pear to her brother.", "Which fruit is left?"], ["У Лолы три фрукта: банан, груша и апельсин. Она съедает банан. Грушу она даёт брату.", "Какой фрукт остался?"], ["Lolada uchta meva bor: banan, nok va apelsin. U bananni yeydi. Nokni ukasiga beradi.", "Qaysi meva qoldi?"], "orange", ["orange", "banana", "pear", "apple"]),
  s("trip", 4, ["The family goes to Samarkand. First they ride a bus to the station. Then they take a fast train.", "What do they ride last?"], ["Семья едет в Самарканд. Сначала они едут на автобусе до вокзала. Потом садятся на быстрый поезд.", "На чём они едут в конце?"], ["Oila Samarqandga boradi. Avval ular vokzalgacha avtobusda boradi. Keyin tez poyezdga chiqadi.", "Oxirida ular nimada boradi?"], "train", ["train", "bus", "plane", "car"]),
  s("wedding", 4, ["Nodira is going to a wedding. She puts on a pink dress. She wanted to wear her new shoes, but they were too small.", "What does Nodira put on?"], ["Нодира идёт на свадьбу. Она надевает розовое платье. Она хотела надеть новые кроссовки, но они оказались малы.", "Что надевает Нодира?"], ["Nodira toʻyga boryapti. U pushti koʻylak kiyadi. U yangi krossovkasini kiymoqchi edi, lekin ular kichik boʻlib qoldi.", "Nodira nima kiyadi?"], "dress", ["dress", "shoes", "coat", "tshirt"]),
  s("seedling", 4, ["Grandpa plants a little tree in spring. Every day Ravshan gives it water. In autumn the tree has its first apples.", "What does Ravshan give the tree?"], ["Весной дедушка сажает маленькое дерево. Каждый день Равшан поливает его водой. Осенью на дереве появляются первые яблоки.", "Чем Равшан поливает дерево?"], ["Bahorda bobo kichik daraxt ekadi. Ravshan har kuni unga suv quyadi. Kuzda daraxtda birinchi olmalar paydo boʻladi.", "Ravshan daraxtga nima quyadi?"], "water", ["water", "milk", "soup", "bread"]),
  s("night", 4, ["At night the sky is dark. Kamol looks out of the window. He sees the moon, but no stars.", "What does Kamol see?"], ["Ночью небо тёмное. Камол смотрит в окно. Он видит луну, но звёзд не видно.", "Что видит Камол?"], ["Kechasi osmon qorongʻi. Kamol derazadan qaraydi. U oyni koʻradi, lekin yulduzlar koʻrinmaydi.", "Kamol nimani koʻradi?"], "moon", ["moon", "star", "sun", "cloud"]),
  s("pet", 4, ["Dilnoza wants a pet. Her mother says a dog is too big for the flat. So they buy a small fish.", "Which pet do they buy?"], ["Дильноза хочет домашнего питомца. Мама говорит, что собака слишком большая для квартиры. Поэтому они покупают маленькую рыбку.", "Кого они покупают?"], ["Dilnoza uy hayvoni boqmoqchi. Onasi it kvartira uchun juda katta, deydi. Shuning uchun ular kichkina baliq sotib oladi.", "Ular kimni sotib oladi?"], "fish", ["fish", "dog", "cat", "bird"]),
  s("race", 4, ["The children have a race. Ali rides a bike and Sara runs. Aziz pushes his toy car. Sara wins the race.", "What does Ali ride?"], ["Дети устраивают гонки. Али едет на велосипеде, а Сара бежит. Азиз катит игрушечную машину. Побеждает Сара.", "На чём едет Али?"], ["Bolalar poyga oʻtkazadi. Ali velosiped haydaydi, Sara esa yuguradi. Aziz oʻyinchoq mashinasini itaradi. Poygada Sara yutadi.", "Ali nima haydaydi?"], "bike", ["bike", "car", "horse", "boat"]),
  s("breakfast", 4, ["Every morning Grandma makes breakfast. Today there is no bread, so she cooks soup. Everyone drinks warm milk too.", "What does Grandma cook today?"], ["Каждое утро бабушка готовит завтрак. Сегодня нет хлеба, поэтому она варит суп. Ещё все пьют тёплое молоко.", "Что бабушка варит сегодня?"], ["Har kuni ertalab buvi nonushta tayyorlaydi. Bugun non yoʻq, shuning uchun u shoʻrva pishiradi. Hamma iliq sut ham ichadi.", "Buvi bugun nima pishiradi?"], "soup", ["soup", "bread", "milk", "apple"]),
  s("frog", 4, ["A little frog lives by the lake. One day it jumps onto a boat. The boat takes the frog across the lake to a flower.", "Where does the frog jump?"], ["У озера живёт маленькая лягушка. Однажды она прыгает в лодку. Лодка везёт лягушку через озеро к цветку.", "Куда прыгает лягушка?"], ["Koʻl boʻyida kichkina qurbaqa yashaydi. Bir kuni u qayiqqa sakraydi. Qayiq qurbaqani koʻl orqali gulga olib boradi.", "Qurbaqa qayerga sakraydi?"], "boat", ["boat", "flower", "tree", "house"]),
  s("puzzle", 4, ["Kamol and his sister build a puzzle. It has a picture of a big lion. One piece is missing, so they look under the table. The cat is playing with it!", "Who has the missing piece?"], ["Камол и сестра собирают пазл. На нём нарисован большой лев. Одной детали не хватает, и они ищут её под столом. С ней играет кошка!", "У кого потерянная деталь?"], ["Kamol va opasi boshqotirma yigʻadi. Unda katta sher rasmi bor. Bitta boʻlak yetishmaydi, ular uni stol ostidan qidiradi. U bilan mushuk oʻynayapti!", "Yoʻqolgan boʻlak kimda?"], "cat", ["cat", "lion", "dog", "sister"]),
  s("snowday", 4, ["It snowed all night. In the morning Aziz puts on his gloves and scarf. He forgets his cap, and his ears get cold.", "What did Aziz forget?"], ["Всю ночь шёл снег. Утром Азиз надевает перчатки и шарф. Он забывает кепку, и у него мёрзнут уши.", "Что забыл Азиз?"], ["Tun boʻyi qor yogʻdi. Ertalab Aziz qoʻlqop va sharf kiyadi. U kepkasini unutadi va quloqlari muzlaydi.", "Aziz nimani unutdi?"], "cap", ["cap", "gloves", "scarf", "dress"]),
  s("nest", 4, ["A bird builds a nest in the tree near Lola's house. Soon there are three eggs in it. Lola watches from her window, but she never touches the nest.", "Where is the nest?"], ["Птица вьёт гнездо на дереве возле дома Лолы. Скоро в нём появляются три яйца. Лола смотрит из окна, но никогда не трогает гнездо.", "Где гнездо?"], ["Qush Lolaning uyi yonidagi daraxtga uya quradi. Tez orada unda uchta tuxum paydo boʻladi. Lola derazadan qaraydi, lekin uyaga hech qachon tegmaydi.", "Uya qayerda?"], "tree", ["tree", "house", "flower", "car"]),
];

/** A text's options are known pictures (games.test.ts checks this). */
export const sayKnown = (t: SayText) => t.options.every((o) => !!VOCAB[o]?.emoji);
