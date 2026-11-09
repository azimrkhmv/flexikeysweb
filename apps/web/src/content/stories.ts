import type { L10n } from "@/lib/types";

// Picture stories of the story skill game (games spec 8 Nov 2026, §5): 4 stories per tier, written by hand in each
// language. Seed stories have 3 pages, Sprout 4, Tree 5 and Summit 6. A question asks about a detail (its options are
// vocab ids) or about the order ("What happened first?", its options are pages, the answer is worked out).
// uz text drafted 8 Nov 2026 — native-speaker check (B44).

export type StoryQuestion = { prompt: L10n; answer: string; options: string[] } | { prompt: L10n; ask: "first" | "last" };
export interface SkillStory {
  id: string;
  tier: 1 | 2 | 3 | 4;
  pages: { scene: string; text: L10n }[];
  questions: StoryQuestion[];
}

const p = (scene: string, en: string, uz: string, ru: string) => ({ scene, text: { en, uz, ru } });
const q = (en: string, uz: string, ru: string, answer: string, options: string[]): StoryQuestion => ({ prompt: { en, uz, ru }, answer, options });
const FIRST: StoryQuestion = { prompt: { en: "What happened first?", uz: "Avval nima boʻldi?", ru: "Что было сначала?" }, ask: "first" };
const LAST: StoryQuestion = { prompt: { en: "What happened at the end?", uz: "Oxirida nima boʻldi?", ru: "Чем всё закончилось?" }, ask: "last" };

export const STORIES: SkillStory[] = [
  // ---------------------------------------------------------------- Seed: 3 pages
  {
    id: "ball", tier: 1,
    pages: [
      p("🧒⚽", "Ali has a red ball.", "Alining qizil koptogi bor.", "У Али есть красный мяч."),
      p("⚽🐶", "He throws the ball to the dog.", "U koptokni itga otadi.", "Он бросает мяч собаке."),
      p("🐶⚽😊", "The dog brings the ball back.", "It koptokni qaytarib olib keladi.", "Собака приносит мяч обратно."),
    ],
    questions: [
      q("Who brings the ball back?", "Koptokni kim qaytarib olib keladi?", "Кто приносит мяч обратно?", "dog", ["dog", "cat", "cow", "bird"]),
      q("What does Ali have?", "Alida nima bor?", "Что есть у Али?", "ball", ["ball", "kite", "drum", "car"]),
    ],
  },
  {
    id: "apple", tier: 1,
    pages: [
      p("👧🌳", "Malika goes to the garden.", "Malika bogʻga boradi.", "Малика идёт в сад."),
      p("🌳🍎", "She sees an apple on the tree.", "U daraxtda olmani koʻradi.", "Она видит яблоко на дереве."),
      p("👧🍎😋", "Malika eats the sweet apple.", "Malika shirin olmani yeydi.", "Малика ест сладкое яблоко."),
    ],
    questions: [
      q("What does Malika eat?", "Malika nima yeydi?", "Что ест Малика?", "apple", ["apple", "banana", "pear", "carrot"]),
      q("Where is the apple?", "Olma qayerda?", "Где висит яблоко?", "tree", ["tree", "house", "bed", "car"]),
    ],
  },
  {
    id: "umbrella", tier: 1,
    pages: [
      p("☁️🌧️", "It is raining.", "Yomgʻir yogʻyapti.", "Идёт дождь."),
      p("👦☂️", "Aziz takes his umbrella.", "Aziz soyabonini oladi.", "Азиз берёт зонт."),
      p("👦☂️🏠", "He walks home and stays dry.", "U uyga quruq yetib boradi.", "Он идёт домой и не мокнет."),
    ],
    questions: [
      q("What does Aziz take?", "Aziz nima oladi?", "Что берёт Азиз?", "umbrella", ["umbrella", "ball", "book", "cap"]),
      q("What is falling from the sky?", "Osmondan nima yogʻyapti?", "Что падает с неба?", "rain", ["rain", "snow", "sun", "leaf"]),
    ],
  },
  {
    id: "cat", tier: 1,
    pages: [
      p("🐱🥛", "A cat drinks milk.", "Mushuk sut ichadi.", "Кошка пьёт молоко."),
      p("🐱⚽", "Then she plays with a ball.", "Keyin u koptok bilan oʻynaydi.", "Потом она играет с мячиком."),
      p("🐱🛏️💤", "Now the cat sleeps on the bed.", "Endi mushuk karavotda uxlaydi.", "Теперь кошка спит на кровати."),
    ],
    questions: [
      q("What does the cat drink?", "Mushuk nima ichadi?", "Что пьёт кошка?", "milk", ["milk", "water", "soup", "bread"]),
      q("Where does the cat sleep?", "Mushuk qayerda uxlaydi?", "Где спит кошка?", "bed", ["bed", "tree", "boat", "car"]),
    ],
  },
  // ---------------------------------------------------------------- Sprout: 4 pages
  {
    id: "bazaar", tier: 2,
    pages: [
      p("👵🚏", "Grandma waits for the bus.", "Buvi avtobusni kutyapti.", "Бабушка ждёт автобус."),
      p("🚌", "The yellow bus comes.", "Sariq avtobus keladi.", "Приезжает жёлтый автобус."),
      p("🚌🏪", "Grandma goes to the market.", "Buvi bozorga boradi.", "Бабушка едет на базар."),
      p("👵🍉", "She buys a big watermelon.", "U katta tarvuz sotib oladi.", "Она покупает большой арбуз."),
    ],
    questions: [
      q("What does Grandma buy?", "Buvi nima sotib oladi?", "Что покупает бабушка?", "watermelon", ["watermelon", "apple", "lemon", "grapes"]),
      q("How does Grandma go to the market?", "Buvi bozorga nima bilan boradi?", "На чём бабушка едет на базар?", "bus", ["bus", "bike", "boat", "plane"]),
    ],
  },
  {
    id: "snow", tier: 2,
    pages: [
      p("❄️🏠", "Snow falls on the house.", "Uyning ustiga qor yogʻadi.", "На дом падает снег."),
      p("👦🧣", "Aziz puts on his scarf.", "Aziz sharfini taqadi.", "Азиз надевает шарф."),
      p("👦🧤", "Then he puts on his gloves.", "Keyin u qoʻlqopini kiyadi.", "Потом он надевает перчатки."),
      p("⛄😊", "He makes a snowman.", "U qordan odam yasaydi.", "Он лепит снеговика."),
    ],
    questions: [
      q("What does Aziz put on first?", "Aziz avval nimani taqadi?", "Что Азиз надевает сначала?", "scarf", ["scarf", "gloves", "cap", "socks"]),
      q("What falls on the house?", "Uyning ustiga nima yogʻadi?", "Что падает на дом?", "snow", ["snow", "rain", "leaf", "star"]),
    ],
  },
  {
    id: "bird", tier: 2,
    pages: [
      p("🐦🌳", "A little bird sits in a tree.", "Kichkina qush daraxtda oʻtiribdi.", "Маленькая птичка сидит на дереве."),
      p("🐦🌧️", "Rain begins.", "Yomgʻir boshlanadi.", "Начинается дождь."),
      p("🐦🏠", "The bird flies to a house.", "Qush uyga uchib boradi.", "Птичка летит к дому."),
      p("🐦☀️🎵", "The sun comes out and the bird sings.", "Quyosh chiqadi va qush sayraydi.", "Выходит солнце, и птичка поёт."),
    ],
    questions: [
      q("Where does the bird fly when it rains?", "Yomgʻir yoqqanda qush qayerga uchadi?", "Куда летит птичка, когда идёт дождь?", "house", ["house", "tree", "boat", "flower"]),
      q("What comes out at the end?", "Oxirida nima chiqadi?", "Что выходит в конце?", "sun", ["sun", "moon", "star", "cloud"]),
    ],
  },
  {
    id: "soup", tier: 2,
    pages: [
      p("👩🥕🥔", "Mother has a carrot and a potato.", "Onada sabzi va kartoshka bor.", "У мамы есть морковь и картошка."),
      p("👩🍲", "She cooks soup.", "U shoʻrva pishiradi.", "Она варит суп."),
      p("👨👧🏠", "Father and sister come home.", "Ota va opa uyga keladi.", "Папа и сестра приходят домой."),
      p("🍲🍞😋", "They eat soup with bread.", "Ular shoʻrvani non bilan yeydi.", "Они едят суп с хлебом."),
    ],
    questions: [
      q("What does Mother cook?", "Ona nima pishiradi?", "Что варит мама?", "soup", ["soup", "bread", "milk", "cherry"]),
      q("What do they eat with the soup?", "Ular shoʻrvani nima bilan yeydi?", "С чем они едят суп?", "bread", ["bread", "banana", "lemon", "cherry"]),
    ],
  },
  // ---------------------------------------------------------------- Tree: 5 pages
  {
    id: "kite", tier: 3,
    pages: [
      p("👦🪁", "Aziz has a new kite.", "Azizning yangi varragi bor.", "У Азиза новый воздушный змей."),
      p("👦👧🌳", "He goes to the park with his sister.", "U opasi bilan bogʻga boradi.", "Он идёт в парк с сестрой."),
      p("🪁🌬️", "The wind lifts the kite up high.", "Shamol varrakni baland koʻtaradi.", "Ветер поднимает змея высоко."),
      p("🪁🌳", "The kite gets stuck in a tree.", "Varrak daraxtga ilinib qoladi.", "Змей застревает на дереве."),
      p("👧🪁😊", "His sister helps to get it down.", "Opasi uni tushirishga yordam beradi.", "Сестра помогает его снять."),
    ],
    questions: [
      q("Where does the kite get stuck?", "Varrak qayerga ilinib qoladi?", "Где застревает змей?", "tree", ["tree", "house", "car", "boat"]),
      q("Who helps Aziz?", "Azizga kim yordam beradi?", "Кто помогает Азизу?", "sister", ["sister", "grandpa", "mother", "baby"]),
      FIRST,
    ],
  },
  {
    id: "sunflower", tier: 3,
    pages: [
      p("👧🌱", "Laylo plants a seed.", "Laylo urugʻ ekadi.", "Лайло сажает семечко."),
      p("💧🌱", "Every day she gives it water.", "U har kuni unga suv quyadi.", "Каждый день она его поливает."),
      p("☀️🌱", "The sun warms the little sprout.", "Quyosh kichkina niholni isitadi.", "Солнце греет маленький росток."),
      p("🌿🐛", "A caterpillar sits on a leaf.", "Bargda qurt oʻtiribdi.", "На листочке сидит гусеница."),
      p("🌻😊", "A big sunflower grows!", "Katta kungaboqar oʻsib chiqadi!", "Вырастает большой подсолнух!"),
    ],
    questions: [
      q("What does Laylo give the sprout every day?", "Laylo niholga har kuni nima beradi?", "Что Лайло даёт ростку каждый день?", "water", ["water", "milk", "soup", "snow"]),
      q("What warms the sprout?", "Niholni nima isitadi?", "Что греет росток?", "sun", ["sun", "moon", "cloud", "rain"]),
      LAST,
    ],
  },
  {
    id: "train", tier: 3,
    pages: [
      p("👴🧒🚂", "Grandpa and Ali take the train.", "Bobo va Ali poyezdga chiqadi.", "Дедушка и Али едут на поезде."),
      p("🚂🌄", "The train goes past the mountains.", "Poyezd togʻlar yonidan oʻtadi.", "Поезд едет мимо гор."),
      p("🐄🌾", "Ali sees cows in a field.", "Ali dalada sigirlarni koʻradi.", "Али видит коров в поле."),
      p("🍞🥛", "They eat bread and drink milk.", "Ular non yeydi va sut ichadi.", "Они едят хлеб и пьют молоко."),
      p("🏙️👵", "In the city, Grandma meets them.", "Shaharda ularni buvi kutib oladi.", "В городе их встречает бабушка."),
    ],
    questions: [
      q("What does Ali see in the field?", "Ali dalada nimani koʻradi?", "Кого Али видит в поле?", "cow", ["cow", "horse", "sheep", "lion"]),
      q("Who meets them in the city?", "Shaharda ularni kim kutib oladi?", "Кто встречает их в городе?", "grandma", ["grandma", "mother", "sister", "baby"]),
      FIRST,
    ],
  },
  {
    id: "lake", tier: 3,
    pages: [
      p("👨🎣", "Father goes fishing at the lake.", "Ota koʻlga baliq ovlashga boradi.", "Папа идёт на озеро рыбачить."),
      p("👦⛵", "Ali sits with him in the boat.", "Ali u bilan qayiqda oʻtiradi.", "Али сидит с ним в лодке."),
      p("🐟💦", "A fish jumps out of the water.", "Suvdan baliq sakrab chiqadi.", "Из воды выпрыгивает рыба."),
      p("🐸🍃", "A frog sits on a leaf.", "Bargda qurbaqa oʻtiribdi.", "На листе сидит лягушка."),
      p("🐟🌊", "They let the little fish swim away.", "Ular kichkina baliqni qoʻyib yuborishadi.", "Они отпускают маленькую рыбку."),
    ],
    questions: [
      q("Where does Ali sit?", "Ali qayerda oʻtiradi?", "Где сидит Али?", "boat", ["boat", "bus", "bike", "train"]),
      q("Who sits on a leaf?", "Bargda kim oʻtiribdi?", "Кто сидит на листе?", "frog", ["frog", "fish", "bird", "rabbit"]),
      LAST,
    ],
  },
  // ---------------------------------------------------------------- Summit: 6 pages
  {
    id: "birthday", tier: 4,
    pages: [
      p("👧🎂", "Today is Malika's birthday.", "Bugun Malikaning tugʻilgan kuni.", "Сегодня у Малики день рождения."),
      p("👵🎁", "Grandma brings a big present.", "Buvi katta sovgʻa olib keladi.", "Бабушка приносит большой подарок."),
      p("🎁🧸", "Inside the box is a teddy bear.", "Qutining ichida ayiqcha bor.", "В коробке плюшевый мишка."),
      p("👦🎈", "Her brother brings balloons.", "Akasi sharlar olib keladi.", "Брат приносит шарики."),
      p("🎈☁️", "One balloon flies away to the clouds.", "Bitta shar bulutlarga uchib ketadi.", "Один шарик улетает к облакам."),
      p("🎂🍰😊", "Then everyone eats cake.", "Keyin hamma tort yeydi.", "Потом все едят торт."),
    ],
    questions: [
      q("What is inside the box?", "Qutining ichida nima bor?", "Что лежит в коробке?", "teddy", ["teddy", "ball", "book", "drum"]),
      FIRST,
      q("Who brings the balloons?", "Sharlarni kim olib keladi?", "Кто приносит шарики?", "brother", ["brother", "grandma", "father", "baby"]),
    ],
  },
  {
    id: "cap", tier: 4,
    pages: [
      p("👦🧢", "Aziz has a blue cap.", "Azizning koʻk kepkasi bor.", "У Азиза синяя кепка."),
      p("🌬️🧢", "The wind blows the cap away.", "Shamol kepkani uchirib ketadi.", "Ветер уносит кепку."),
      p("🧢🌳", "The cap lands near a tree.", "Kepka daraxt yoniga tushadi.", "Кепка падает у дерева."),
      p("🐶🧢", "A dog finds the cap.", "Kepkani it topib oladi.", "Собака находит кепку."),
      p("🐶💨👦", "The dog runs to Aziz.", "It Aziz tomon yuguradi.", "Собака бежит к Азизу."),
      p("👦🐶😊", "Aziz says thank you and pats the dog.", "Aziz rahmat aytib, itni silaydi.", "Азиз говорит спасибо и гладит собаку."),
    ],
    questions: [
      q("What colour is the cap?", "Kepka qanday rangda?", "Какого цвета кепка?", "c_blue", ["c_blue", "c_red", "c_green", "c_yellow"]),
      LAST,
      q("Who finds the cap?", "Kepkani kim topadi?", "Кто находит кепку?", "dog", ["dog", "cat", "bird", "horse"]),
    ],
  },
  {
    id: "picnic", tier: 4,
    pages: [
      p("👩👧👦", "The family goes on a picnic.", "Oila sayrga chiqadi.", "Семья едет на пикник."),
      p("🚗🌳", "They drive to the forest by car.", "Ular mashinada oʻrmonga boradi.", "Они едут в лес на машине."),
      p("🧺🍇🍉", "They take grapes and a watermelon.", "Ular uzum va tarvuz olishadi.", "Они берут виноград и арбуз."),
      p("🐰🌿", "A rabbit looks at them from the grass.", "Oʻt orasidan ularga quyon qaraydi.", "Из травы на них смотрит зайчик."),
      p("🌧️☂️", "Then rain starts, so they open umbrellas.", "Keyin yomgʻir yogʻadi, ular soyabon ochishadi.", "Потом идёт дождь, и они открывают зонты."),
      p("🌈", "After the rain they see a rainbow.", "Yomgʻirdan keyin ular kamalakni koʻrishadi.", "После дождя они видят радугу."),
    ],
    questions: [
      q("How do they get to the forest?", "Ular oʻrmonga nima bilan boradi?", "На чём они едут в лес?", "car", ["car", "bus", "train", "plane"]),
      FIRST,
      q("Who looks at them from the grass?", "Oʻt orasidan ularga kim qaraydi?", "Кто смотрит на них из травы?", "rabbit", ["rabbit", "cat", "frog", "chicken"]),
    ],
  },
  {
    id: "rocket", tier: 4,
    pages: [
      p("👦📖🚀", "Ali reads a book about rockets.", "Ali raketalar haqida kitob oʻqiydi.", "Али читает книгу о ракетах."),
      p("👦🧱", "He builds a rocket from blocks.", "U kubiklardan raketa yasaydi.", "Он строит ракету из кубиков."),
      p("🚀🌙", "In his dream the rocket flies to the moon.", "Tushida raketa oyga uchadi.", "Во сне ракета летит на Луну."),
      p("🌙⭐✨", "He sees many stars.", "U koʻp yulduzlarni koʻradi.", "Он видит много звёзд."),
      p("🌍", "He looks back at the Earth.", "U orqasiga, Yerga qaraydi.", "Он смотрит назад, на Землю."),
      p("🛏️☀️", "In the morning he wakes up in his bed.", "Ertalab u oʻz karavotida uygʻonadi.", "Утром он просыпается в своей кровати."),
    ],
    questions: [
      q("What does Ali build the rocket from?", "Ali raketani nimadan yasaydi?", "Из чего Али строит ракету?", "blocks", ["blocks", "puzzle", "ball", "drum"]),
      LAST,
      q("Where does the rocket fly in the dream?", "Tushida raketa qayerga uchadi?", "Куда летит ракета во сне?", "moon", ["moon", "sun", "cloud", "tree"]),
    ],
  },
];
