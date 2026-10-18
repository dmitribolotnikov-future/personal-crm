// Fills the database with realistic test contacts and notes: pnpm db:seed
// People are generated from a fixed seed, so every run produces the same set;
// a repeat run finds them already in the database and adds nothing.
// Texts are in Russian because the app shows them to the user as is.

// @next/env is CommonJS: an ES module (.mts) gets its exports as the default one
import nextEnv from "@next/env";
import { and, count, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Explicit .ts extensions let the app image run this file with plain node
import { getConnectionConfig } from "../src/db/connection.ts";
import { contacts, notes } from "../src/db/schema.ts";

const CONTACT_COUNT = 1000;
const RANDOM_SEED = 20261010;
const DAY_MS = 24 * 60 * 60 * 1000;

// --- Deterministic randomness (mulberry32) ---

let state = RANDOM_SEED;
function random(): number {
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function int(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)];
}

function chance(probability: number): boolean {
  return random() < probability;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// --- Names ---

type Gender = "m" | "f";
// [male form, female form]
type Pair = readonly [string, string];

function byGender(gender: Gender, [male, female]: Pair): string {
  return gender === "m" ? male : female;
}

// [full name, short form people use in their phone book]
const maleFirstNames: Pair[] = [
  ["Александр", "Саша"], ["Алексей", "Лёша"], ["Андрей", "Андрей"],
  ["Антон", "Антон"], ["Артём", "Тёма"], ["Борис", "Боря"], ["Вадим", "Вадим"],
  ["Василий", "Вася"], ["Виктор", "Витя"], ["Владимир", "Володя"],
  ["Глеб", "Глеб"], ["Григорий", "Гриша"], ["Даниил", "Даня"],
  ["Денис", "Денис"], ["Дмитрий", "Дима"], ["Евгений", "Женя"],
  ["Егор", "Егор"], ["Иван", "Ваня"], ["Игорь", "Игорь"], ["Илья", "Илья"],
  ["Кирилл", "Кирилл"], ["Константин", "Костя"], ["Лев", "Лёва"],
  ["Леонид", "Лёня"], ["Максим", "Макс"], ["Марк", "Марк"],
  ["Матвей", "Матвей"], ["Михаил", "Миша"], ["Никита", "Никита"],
  ["Николай", "Коля"], ["Олег", "Олег"], ["Павел", "Паша"], ["Пётр", "Петя"],
  ["Роман", "Рома"], ["Руслан", "Руслан"], ["Семён", "Сёма"],
  ["Сергей", "Серёжа"], ["Станислав", "Стас"], ["Тимур", "Тимур"],
  ["Фёдор", "Федя"], ["Юрий", "Юра"], ["Ярослав", "Ярик"],
];

const femaleFirstNames: Pair[] = [
  ["Александра", "Саша"], ["Алина", "Алина"], ["Алёна", "Алёна"],
  ["Анастасия", "Настя"], ["Анна", "Аня"], ["Валерия", "Лера"], ["Вера", "Вера"],
  ["Вероника", "Ника"], ["Виктория", "Вика"], ["Галина", "Галя"],
  ["Дарья", "Даша"], ["Евгения", "Женя"], ["Екатерина", "Катя"],
  ["Елена", "Лена"], ["Елизавета", "Лиза"], ["Жанна", "Жанна"], ["Зоя", "Зоя"],
  ["Ирина", "Ира"], ["Карина", "Карина"], ["Кира", "Кира"],
  ["Ксения", "Ксюша"], ["Лариса", "Лариса"], ["Любовь", "Люба"],
  ["Людмила", "Люда"], ["Маргарита", "Рита"], ["Марина", "Марина"],
  ["Мария", "Маша"], ["Наталья", "Наташа"], ["Надежда", "Надя"],
  ["Нина", "Нина"], ["Ольга", "Оля"], ["Полина", "Полина"],
  ["Светлана", "Света"], ["София", "Соня"], ["Татьяна", "Таня"],
  ["Ульяна", "Уля"], ["Юлия", "Юля"], ["Яна", "Яна"],
];

// Male forms; female forms are derived by femaleSurname()
const surnames = [
  "Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов",
  "Михайлов", "Новиков", "Фёдоров", "Морозов", "Волков", "Алексеев", "Лебедев",
  "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев", "Орлов",
  "Андреев", "Макаров", "Никитин", "Захаров", "Зайцев", "Соловьёв", "Борисов",
  "Яковлев", "Григорьев", "Романов", "Воробьёв", "Сергеев", "Кузьмин", "Фролов",
  "Александров", "Дмитриев", "Королёв", "Гусев", "Киселёв", "Ильин", "Максимов",
  "Поляков", "Сорокин", "Виноградов", "Ковалёв", "Белов", "Медведев", "Антонов",
  "Тарасов", "Жуков", "Баранов", "Филиппов", "Комаров", "Давыдов", "Беляев",
  "Герасимов", "Богданов", "Осипов", "Сидоров", "Матвеев", "Титов", "Марков",
  "Миронов", "Крылов", "Куликов", "Карпов", "Власов", "Мельников", "Денисов",
  "Гаврилов", "Тихонов", "Казаков", "Афанасьев", "Данилов", "Савельев",
  "Тимофеев", "Фомин", "Чернов", "Абрамов", "Мартынов", "Ефимов", "Федотов",
  "Щербаков", "Назаров", "Калинин", "Исаев", "Чернышёв", "Быков", "Маслов",
  "Родионов", "Коновалов", "Лазарев", "Воронин", "Климов", "Филатов",
  "Пономарёв", "Голубев", "Кудрявцев", "Прохоров", "Наумов", "Потапов",
  "Журавлёв", "Овчинников", "Трофимов", "Леонов", "Соболев", "Ермаков",
  "Колесников", "Гончаров", "Емельянов", "Никифоров", "Грачёв", "Котов",
  "Гришин", "Ефремов", "Архипов", "Громов", "Кириллов", "Малышев", "Панов",
  "Моисеев", "Румянцев", "Акимов", "Кондратьев", "Бирюков", "Горбунов",
  "Ерёмин", "Галкин", "Лукьянов", "Скворцов", "Юдин", "Белоусов", "Нестеров",
  "Симонов", "Харитонов", "Князев", "Цветков", "Левин", "Аксёнов", "Мальцев",
  "Логинов", "Горшков", "Краснов", "Демидов", "Рыбаков", "Плотников",
  "Хохлов", "Литвинов", "Ершов", "Ушаков", "Рябов", "Мухин", "Бородин",
  "Некрасов", "Жданов", "Дроздов", "Лавров", "Зуев", "Шишкин", "Воронцов",
  "Зверев", "Селезнёв", "Нечаев", "Широков", "Суворов", "Булгаков",
  "Вишневский", "Ковальский", "Покровский", "Островский", "Яблонский",
  "Троицкий", "Белецкий", "Донской", "Толстой",
  "Шевченко", "Бондаренко", "Коваленко", "Лысенко", "Ким", "Цой", "Черных",
  "Седых",
];

function femaleSurname(male: string): string {
  if (/(ий|ой)$/.test(male)) return male.slice(0, -2) + "ая";
  if (/(ов|ев|ёв|ин|ын)$/.test(male)) return male + "а";
  return male;
}

const patronymics: Pair[] = [
  ["Александрович", "Александровна"], ["Алексеевич", "Алексеевна"],
  ["Андреевич", "Андреевна"], ["Викторович", "Викторовна"],
  ["Владимирович", "Владимировна"], ["Дмитриевич", "Дмитриевна"],
  ["Евгеньевич", "Евгеньевна"], ["Иванович", "Ивановна"],
  ["Игоревич", "Игоревна"], ["Михайлович", "Михайловна"],
  ["Николаевич", "Николаевна"], ["Олегович", "Олеговна"],
  ["Павлович", "Павловна"], ["Петрович", "Петровна"],
  ["Сергеевич", "Сергеевна"], ["Юрьевич", "Юрьевна"],
];

// --- "How we met" ---

function year(min: number, max: number): number {
  return int(min, max);
}

const companies = [
  "в digital-агентстве", "в банке", "в стартапе по доставке еды",
  "в IT-интеграторе", "в консалтинговой компании", "в издательстве",
  "в архитектурном бюро", "в маркетплейсе", "в рекламном агентстве",
  "на заводе", "в школе", "в турагентстве", "в телеком-компании",
  "в медиахолдинге", "в финтех-стартапе", "в сети кофеен",
];
const universities = [
  "МГУ", "ВШЭ", "МГТУ им. Баумана", "СПбГУ", "МФТИ", "УрФУ", "НГУ", "КФУ",
  "МИСиС", "ИТМО", "РЭУ им. Плеханова", "МГИМО",
];
const conferenceTopics = [
  "продуктовому дизайну", "фронтенд-разработке", "маркетингу",
  "аналитике данных", "управлению проектами", "HR и найму",
  "кибербезопасности", "мобильной разработке",
];
// Prepositional case: "в Казани"
const citiesIn = [
  "Москве", "Санкт-Петербурге", "Казани", "Екатеринбурге", "Новосибирске",
  "Сочи", "Нижнем Новгороде", "Калининграде", "Ереване",
];
const cities = [
  "Москва", "Санкт-Петербург", "Казань", "Сочи", "Екатеринбург",
  "Новосибирск", "Калининград", "Владивосток", "Стамбул", "Ереван", "Тбилиси",
];
const hikingRegions = [
  "Алтаю", "Карелии", "Кавказу", "Байкалу", "Камчатке", "Хибинам", "Уралу",
];
const courses = [
  "английского", "испанского", "программирования на Python", "фотографии",
  "гончарного дела", "актёрского мастерства", "UX-дизайна",
  "итальянской кухни", "ораторского мастерства",
];
const projects = [
  "запуск мобильного приложения", "ребрендинг сети кофеен", "ремонт офиса",
  "организация фестиваля", "переезд склада", "редизайн сайта",
  "внедрение CRM",
];

const metAtWork = () => {
  const from = year(2008, 2022);
  return `Работали вместе ${pick(companies)} в ${from}–${from + int(1, 4)}`;
};
const metAtUniversity = () =>
  pick([
    `Учились вместе в ${pick(universities)}, выпуск ${year(2005, 2020)}`,
    `Учились в одной группе в ${pick(universities)}`,
    "Жили в одном общежитии на первом курсе",
  ]);
const metAtSchool = () =>
  pick([
    `Учились в одном классе, школа № ${int(1, 1500)}`,
    `Сидели за одной партой в ${int(5, 11)} классе`,
  ]);
const metAtConference = () =>
  `Познакомились на конференции по ${pick(conferenceTopics)} в ${pick(citiesIn)} в ${year(2015, 2026)}`;
const metThroughFriends = () =>
  pick([
    "Познакомились через общих друзей на дне рождения",
    `Познакомились на свадьбе друзей в ${year(2012, 2026)}`,
    "Познакомились на новогодней вечеринке у друзей",
    "Познакомил брат, они вместе работают",
  ]);
const metTravelling = () =>
  pick([
    `Сидели рядом в самолёте ${pick(cities)} — ${pick(cities)}`,
    `Познакомились в походе по ${pick(hikingRegions)} в ${year(2010, 2026)}`,
    `Жили в одном хостеле в ${pick(citiesIn)}`,
  ]);
const metAtCourses = () =>
  `Вместе ходили на курсы ${pick(courses)} в ${year(2014, 2026)}`;
const metInSport = () =>
  pick([
    "Тренируемся в одном зале",
    "Играем в теннис по выходным",
    `Бежали вместе полумарафон в ${year(2016, 2026)}`,
    "Ходим на йогу к одному тренеру",
    "Играем в футбол по средам",
  ]);
const metOnProject = () =>
  `Работали над общим проектом: ${pick(projects)}, ${year(2016, 2026)}`;
const metAsNeighbours = () =>
  pick([
    "Живём в одном подъезде, познакомились на собрании жильцов",
    "Познакомились в чате дома",
    "Гуляем с собаками в одном дворе",
  ]);
const metInFamily = () =>
  pick([
    "Родственники по маминой линии",
    "Родственники по папиной линии",
    "Видимся на семейных праздниках",
  ]);
const metVolunteering = () =>
  pick([
    `Вместе волонтёрили на городском марафоне в ${year(2015, 2026)}`,
    "Вместе помогаем приюту для собак",
    `Познакомились на субботнике в парке в ${year(2015, 2026)}`,
  ]);

const anyMeeting = [
  metAtWork, metAtUniversity, metAtConference, metThroughFriends,
  metTravelling, metAtCourses, metInSport, metOnProject, metVolunteering,
];

const meetingFollowUps = [
  ". Потом пересекались на конференциях",
  ". С тех пор видимся пару раз в год",
  ". Потом долго не общались, недавно снова списались",
  ". Дружим семьями",
];

// --- "Who is this" ---

const relations: { forms: Pair; meet: () => string }[] = [
  { forms: ["Бывший коллега", "Бывшая коллега"], meet: metAtWork },
  { forms: ["Бывший начальник", "Бывшая начальница"], meet: metAtWork },
  {
    forms: ["Коллега", "Коллега"],
    meet: () => `Работаем вместе ${pick(companies)} с ${year(2016, 2025)} года`,
  },
  { forms: ["Однокурсник", "Однокурсница"], meet: metAtUniversity },
  { forms: ["Одноклассник", "Одноклассница"], meet: metAtSchool },
  {
    forms: ["Друг детства", "Подруга детства"],
    meet: () =>
      pick([
        "Росли в одном дворе",
        "Знакомы с детства, родители дружат",
        `Вместе ездили в летний лагерь в ${year(1998, 2010)}`,
      ]),
  },
  { forms: ["Сосед по дому", "Соседка по дому"], meet: metAsNeighbours },
  {
    forms: ["Сосед по даче", "Соседка по даче"],
    meet: () => `Участки рядом, познакомились на субботнике в ${year(2012, 2026)}`,
  },
  { forms: ["Знакомый по спортзалу", "Знакомая по спортзалу"], meet: metInSport },
  {
    forms: ["Партнёр по теннису", "Партнёрша по теннису"],
    meet: () => "Играем в теннис по выходным",
  },
  {
    forms: ["Знакомый по конференциям", "Знакомая по конференциям"],
    meet: metAtConference,
  },
  { forms: ["Друг друзей", "Подруга друзей"], meet: metThroughFriends },
  { forms: ["Приятель", "Приятельница"], meet: () => pick(anyMeeting)() },
  {
    forms: ["Наставник", "Наставница"],
    meet: () => `Познакомились на стажировке в ${year(2010, 2024)}`,
  },
  { forms: ["Клиент", "Клиентка"], meet: metOnProject },
  { forms: ["Партнёр по проекту", "Партнёр по проекту"], meet: metOnProject },
  { forms: ["Попутчик", "Попутчица"], meet: metTravelling },
  { forms: ["Знакомый по курсам", "Знакомая по курсам"], meet: metAtCourses },
  {
    forms: ["Папа одноклассника сына", "Мама одноклассника сына"],
    meet: () =>
      pick([
        "Познакомились на родительском собрании",
        "Дети дружат, по очереди водим их на секцию",
      ]),
  },
  {
    forms: ["Папа подружки дочки", "Мама подружки дочки"],
    meet: () => "Дети ходят в один садик",
  },
  { forms: ["Двоюродный брат", "Двоюродная сестра"], meet: metInFamily },
  { forms: ["Дядя", "Тётя"], meet: metInFamily },
  {
    forms: ["Муж подруги", "Жена друга"],
    meet: () => `Познакомились на их свадьбе в ${year(2010, 2026)}`,
  },
  {
    forms: ["Знакомый по волонтёрству", "Знакомая по волонтёрству"],
    meet: metVolunteering,
  },
];

const professions = [
  "дизайнер", "продуктовый дизайнер", "фронтенд-разработчик",
  "бэкенд-разработчик", "аналитик данных", "юрист", "бухгалтер", "маркетолог",
  "продакт-менеджер", "фотограф", "архитектор", "инженер-строитель",
  "врач-терапевт", "психолог", "преподаватель английского", "переводчик",
  "журналист", "рекрутер", "финансовый консультант", "предприниматель",
  "владелец кофейни", "тренер по плаванию", "музыкант", "звукорежиссёр",
  "видеограф", "SMM-специалист", "тестировщик", "DevOps-инженер",
  "CTO стартапа", "иллюстратор", "риелтор", "стоматолог", "ветеринар",
  "повар", "пилот", "инженер-энергетик", "биолог", "PR-менеджер",
  "event-менеджер", "логист", "флорист", "копирайтер", "редактор",
  "режиссёр монтажа",
];

// People saved formally, with a patronymic
const formalRoles: { about: string; meet: () => string }[] = [
  { about: "Стоматолог", meet: () => "Контакт дали знакомые, когда искали хорошего стоматолога" },
  { about: "Семейный врач", meet: () => "Наблюдаемся у этого врача всей семьёй" },
  { about: "Научный руководитель", meet: () => `Диплом в ${pick(universities)}, ${year(2008, 2022)}` },
  { about: "Нотариус", meet: () => `Оформляли сделку по квартире в ${year(2015, 2026)}` },
  { about: "Классный руководитель сына", meet: () => "Познакомились на первом родительском собрании" },
  { about: "Учитель математики дочки", meet: () => "Познакомились на дне открытых дверей в школе" },
  { about: "Юрист по недвижимости", meet: () => `Помогали со сделкой по квартире в ${year(2015, 2026)}` },
  { about: "Педиатр", meet: () => "Ведёт детей с рождения" },
  { about: "Преподаватель вокала", meet: () => `Занятия по субботам с ${year(2018, 2026)} года` },
  { about: "Директор школы", meet: () => "Познакомились, когда переводили сына в эту школу" },
  { about: "Психолог", meet: () => `Посоветовали друзья в ${year(2018, 2026)}` },
  { about: "Ветеринар", meet: () => `Лечит нашу кошку с ${year(2015, 2026)} года` },
  { about: "Тренер по плаванию у сына", meet: () => "Сын занимается в этой группе в бассейне" },
];

// People saved by name and trade: "Саша сантехник"
const services: { label: string; about: Pair; gender?: Gender }[] = [
  { label: "сантехник", about: ["Сантехник, менял трубы в ванной", ""], gender: "m" },
  { label: "электрик", about: ["Электрик, делал проводку на кухне", ""], gender: "m" },
  { label: "маникюр", about: ["", "Мастер маникюра, салон у метро"], gender: "f" },
  { label: "парикмахер", about: ["Парикмахер", "Парикмахер"] },
  { label: "репетитор", about: ["Репетитор по английскому для детей", "Репетитор по английскому для детей"] },
  { label: "массаж", about: ["Массажист", "Массажистка"] },
  { label: "ремонт", about: ["Прораб, делал ремонт в ванной", ""], gender: "m" },
  { label: "автосервис", about: ["Автомеханик, сервис на Варшавке", ""], gender: "m" },
  { label: "няня", about: ["", "Няня, выручает по вечерам"], gender: "f" },
  { label: "фитнес", about: ["Персональный тренер", "Персональный тренер"] },
  { label: "торты", about: ["", "Печёт торты на заказ"], gender: "f" },
  { label: "переезд", about: ["Грузоперевозки, помогал с переездом", ""], gender: "m" },
  { label: "мебель", about: ["Делает мебель на заказ", "Делает мебель на заказ"] },
  { label: "фотограф", about: ["Фотограф, снимал свадьбу друзей", "Фотограф, снимала свадьбу друзей"] },
];

const serviceMeetings = [
  "Контакт дали соседи",
  "Посоветовали друзья",
  "Нашли по отзывам в интернете",
  "Контакт из чата дома",
];

// --- Notes ---

const months = [
  "января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
  "сентября", "октября", "ноября", "декабря",
];
const callTopics = [
  "новую работу", "идею совместного проекта", "поездку летом",
  "ремонт квартиры", "учёбу детей", "рынок недвижимости",
  "переход в продуктовый менеджмент", "встречу выпускников",
  "планы на отпуск", "совместную поездку на Байкал",
  "запуск нового продукта", "как найти хорошего юриста",
];
const later = [
  "через месяц", "после праздников", "на следующей неделе", "в сентябре",
  "после отпуска", "в начале весны", "ближе к лету",
];
const documents = [
  "презентацию проекта", "контакты юриста", "список книг",
  "фотографии с поездки", "смету на ремонт", "ссылку на курс",
  "резюме знакомого разработчика", "черновик договора",
  "рецепт того самого пирога",
];
const deadlines = [
  "пятницы", "конца месяца", "понедельника", "конца недели", "15 числа",
  "праздников",
];
const helpWith = [
  "переездом в субботу", "резюме", "выбором ноутбука", "поиском юриста",
  "подготовкой к собеседованию", "сайтом для студии",
];
const advice = [
  "книгу «Атомные привычки»", "сериал «Тьма»",
  "хорошего стоматолога на Таганке", "курс по Python на Stepik",
  "грузинский ресторан у Чистых прудов", "приложение для учёта финансов",
  "съездить осенью в Калининград",
];
const recommendations = [
  "хорошего юриста", "риелтора", "детского врача", "мастера по ремонту",
  "школу английского", "бухгалтера для ИП", "фотографа на свадьбу",
];
const likes = [
  "красное вино", "хороший кофе", "настольные игры", "джаз", "футбол",
  "книги по истории", "горные лыжи", "рыбалку", "чай пуэр", "театр",
  "фильмы Тарковского", "сапборд", "итальянскую кухню",
];
const kids = [
  "двое детей: сын и дочка", "сын-школьник", "дочка ходит в садик",
  "детей пока нет", "трое детей", "взрослая дочь, учится в Питере",
];
const weekdays = [
  "понедельник", "вторник", "среду", "четверг", "пятницу", "субботу",
  "воскресенье",
];
const places = [
  "в аэропорту", "в торговом центре", "в парке", "в метро", "в театре",
  "на выставке", "в очереди в МФЦ",
];
const activities = [
  "в баню", "на футбол", "в кино", "на выставку",
  "покататься на велосипедах", "в поход", "на концерт",
];
const gifts = [
  "книга", "хороший чай", "сертификат в книжный", "бутылка вина",
  "настольная игра", "цветы",
];
const books = [
  "Мастер и Маргарита", "Атомные привычки", "Sapiens", "Война и мир",
  "Чистый код", "Шантарам",
];
const lookingFor = [
  "дизайнера в команду", "новую работу в продукте",
  "репетитора по английскому для дочки", "квартиру в аренду",
  "бухгалтера для ИП", "сооснователя для стартапа",
  "хорошего тренера по теннису",
];
const movedTo = [
  "Казань", "Санкт-Петербург", "Екатеринбург", "Новосибирск", "Калининград",
  "Сочи", "Ереван", "Тбилиси",
];
const dinnerTalks = [
  "много говорили о работе и выгорании", "обсуждали, куда поехать летом",
  "вспоминали студенческие годы", "спорили о школах для детей",
];

type NoteTemplate = (gender: Gender) => string;

const news: NoteTemplate[] = [
  () => "переходит в новую компанию",
  () => "собирается в отпуск в Грузию",
  () => "открывает своё дело — небольшую пекарню",
  (g) => `${byGender(g, ["получил", "получила"])} повышение`,
  () => `переезжает в ${pick(movedTo)}`,
  (g) => `${byGender(g, ["начал", "начала"])} учить испанский`,
  () => "ищет квартиру побольше",
  (g) => `${byGender(g, ["пробежал", "пробежала"])} первый марафон`,
  (g) => `у ${byGender(g, ["него", "неё"])} родилась дочка`,
  (g) => `у ${byGender(g, ["него", "неё"])} родился сын`,
  (g) => `${byGender(g, ["защитил", "защитила"])} диссертацию`,
  () => "уходит во фриланс",
  (g) => `${byGender(g, ["завёл", "завела"])} собаку`,
];

const he = (g: Gender) => byGender(g, ["он", "она"]);
const He = (g: Gender) => capitalize(he(g));

const noteTemplates: NoteTemplate[] = [
  () => `Созвонились, обсудили ${pick(callTopics)}. Договорились созвониться ${pick(later)}.`,
  (g) => `Встретились на кофе. ${He(g)} ${byGender(g, ["рассказал", "рассказала"])}, что ${pick(news)(g)}.`,
  () => `День рождения — ${int(1, 28)} ${pick(months)}. Любит ${pick(likes)}.`,
  (g) => `${He(g)} ${byGender(g, ["попросил", "попросила"])} порекомендовать ${pick(recommendations)}. Контакты отправлены в Telegram.`,
  (g) => `Договорились: ${he(g)} пришлёт ${pick(documents)} до ${pick(deadlines)}.`,
  () => `Договорились, что помогаю с ${pick(helpWith)}.`,
  (g) => `${He(g)} ${byGender(g, ["посоветовал", "посоветовала"])} ${pick(advice)}.`,
  (g) =>
    g === "m"
      ? `Жена — ${pick(femaleFirstNames)[0]}, ${pick(kids)}.`
      : `Муж — ${pick(maleFirstNames)[0]}, ${pick(kids)}.`,
  (g) =>
    [
      "Встреча в кафе:",
      `— обсудили ${pick(callTopics)}`,
      `— ${he(g)} ${byGender(g, ["обещал", "обещала"])} прислать ${pick(documents)}`,
      `— следующая встреча ${pick(later)}`,
    ].join("\n"),
  (g) => `Не дозвонились днём, ${he(g)} ${byGender(g, ["перезвонил", "перезвонила"])} вечером. Всё в силе на ${pick(weekdays)}.`,
  () => `Случайно встретились ${pick(places)}. Договорились как-нибудь сходить ${pick(activities)}.`,
  (g) =>
    `Отправлен подарок к ${pick(["Новому году", "дню рождения", byGender(g, ["23 Февраля", "8 Марта"])])}: ${pick(gifts)}.`,
  (g) => `${He(g)} ${byGender(g, ["вернул", "вернула"])} книгу «${pick(books)}».`,
  (g) => `Переписывались в Telegram: ${he(g)} ищет ${pick(lookingFor)}. Можно познакомить с кем-то из бывших коллег.`,
  () => `Аллергия на ${pick(["орехи", "цитрусы", "кошек", "мёд"])} — учесть при встрече.`,
  () => `Болеет за «${pick(["Спартак", "Зенит", "ЦСКА", "Локомотив", "Динамо", "Рубин"])}». На матчи ходит с ${pick(["сыном", "дочкой", "друзьями"])}.`,
  () => `Отправлено поздравление с ${pick(["повышением", "новосельем", "рождением ребёнка", "свадьбой", "защитой диссертации"])}.`,
  (g) => `Обсудили ${pick(callTopics)}. Идея интересная, ${he(g)} ${byGender(g, ["готов", "готова"])} участвовать.`,
  () => `Собака — ${pick(["корги", "лабрадор", "такса", "хаски", "дворняга из приюта"])} по кличке ${pick(["Бублик", "Ричи", "Марс", "Луна", "Тоша", "Кекс"])}.`,
  (g) => `${He(g)} ${byGender(g, ["переехал", "переехала"])} в ${pick(movedTo)}. Новый адрес — в Telegram.`,
  (g) => `Короткий созвон: ${he(g)} ${byGender(g, ["занят", "занята"])} до конца месяца, вернёмся к разговору ${pick(later)}.`,
  (g) => `Нужно отправить ${byGender(g, ["ему", "ей"])} ${pick(documents)} до ${pick(deadlines)}.`,
  () => `Ужинали вместе, ${pick(dinnerTalks)}.`,
];

// --- Contacts ---

const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh",
  щ: "shch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translit(text: string): string {
  return [...text.toLowerCase()].map((char) => transliteration[char] ?? char).join("");
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function makePhone(): string {
  const code = int(900, 999);
  const rest = `${int(100, 999)}-${pad2(int(0, 99))}-${pad2(int(0, 99))}`;
  return chance(0.9) ? `+7 (${code}) ${rest}` : `8 ${code} ${rest}`;
}

// Only reserved example domains, so no address can belong to a real person
const emailDomains = ["example.com", "example.org", "example.net"];
const usedEmails = new Set<string>();

function makeEmail(firstName: string, lastName: string): string {
  const first = translit(firstName);
  const last = translit(lastName);
  const local = pick([
    `${first}.${last}`,
    `${first[0]}.${last}`,
    `${last}.${first}`,
    `${first}${last}${int(70, 99)}`,
    `${first}_${last}`,
  ]);
  let email = `${local}@${pick(emailDomains)}`;
  while (usedEmails.has(email)) {
    email = `${local}${int(1, 999)}@${pick(emailDomains)}`;
  }
  usedEmails.add(email);
  return email;
}

// Random moment between two dates, during waking hours, never in the future
function momentBetween(from: Date, to: Date): Date {
  const date = new Date(from.getTime() + random() * (to.getTime() - from.getTime()));
  date.setHours(int(8, 22), int(0, 59), int(0, 59));
  return date > to ? to : date;
}

type NewContact = typeof contacts.$inferInsert;
type NewNote = Omit<typeof notes.$inferInsert, "contactId">;
type SeedContact = { contact: NewContact; notes: NewNote[] };

function makeNotes(gender: Gender, contactCreatedAt: Date, now: Date): NewNote[] {
  const noteCount = pick([0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 6, 8]);
  const result: NewNote[] = [];
  for (let i = 0; i < noteCount; i++) {
    const createdAt = momentBetween(contactCreatedAt, now);
    // A few notes were edited later, so the "изменено" mark shows up too
    const updatedAt = chance(0.05)
      ? new Date(Math.min(createdAt.getTime() + int(1, 48) * 60 * 60 * 1000, now.getTime()))
      : createdAt;
    result.push({ body: pick(noteTemplates)(gender), createdAt, updatedAt });
  }
  return result;
}

function makeContact(usedNames: Set<string>, now: Date): SeedContact {
  const gender: Gender = chance(0.5) ? "m" : "f";
  const roll = random();

  let name: string;
  let gendered: Gender = gender;
  let firstName: string;
  let lastName: string;
  let about: string | null;
  let howWeMet: string | null;
  let hasPhone: boolean;
  let hasEmail: boolean;

  if (roll < 0.04) {
    const service = pick(services);
    gendered = service.gender ?? gender;
    const [full, short] = pick(gendered === "m" ? maleFirstNames : femaleFirstNames);
    firstName = full;
    lastName = byGender(gendered, [pick(surnames), femaleSurname(pick(surnames))]);
    name = `${short} ${service.label}`;
    about = byGender(gendered, service.about);
    howWeMet = chance(0.7) ? pick(serviceMeetings) : null;
    hasPhone = true;
    hasEmail = chance(0.15);
  } else {
    const [full, short] = pick(gender === "m" ? maleFirstNames : femaleFirstNames);
    const surname = pick(surnames);
    firstName = full;
    lastName = gender === "m" ? surname : femaleSurname(surname);

    if (roll < 0.11) {
      const role = pick(formalRoles);
      name = `${full} ${byGender(gender, pick(patronymics))} ${lastName}`;
      about = role.about;
      howWeMet = chance(0.85) ? role.meet() : null;
      hasPhone = chance(0.95);
      hasEmail = chance(0.4);
    } else {
      const relation = pick(relations);
      name = `${chance(0.2) ? short : full} ${lastName}`;
      const relationText = byGender(gender, relation.forms);
      const shape = random();
      about =
        shape < 0.06
          ? null
          : shape < 0.6
            ? `${relationText}, ${pick(professions)}`
            : shape < 0.85
              ? relationText
              : capitalize(pick(professions));
      const meet = about === null || shape >= 0.85 ? pick(anyMeeting) : relation.meet;
      howWeMet = chance(0.82)
        ? meet() + (chance(0.15) ? pick(meetingFollowUps) : "")
        : null;
      hasPhone = chance(0.88);
      hasEmail = chance(0.72);
    }
  }

  if (usedNames.has(name)) return makeContact(usedNames, now);
  usedNames.add(name);

  const createdAt = momentBetween(new Date(now.getTime() - int(0, 3 * 365) * DAY_MS), now);
  return {
    contact: {
      name,
      about,
      howWeMet,
      phone: hasPhone ? makePhone() : null,
      email: hasEmail ? makeEmail(firstName, lastName) : null,
      createdAt,
      updatedAt: createdAt,
    },
    notes: makeNotes(gendered, createdAt, now),
  };
}

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

async function main() {
  // Runs outside Next.js, so load .env the same way Next.js does
  nextEnv.loadEnvConfig(process.cwd());

  const now = new Date();
  const usedNames = new Set<string>();
  const people = Array.from({ length: CONTACT_COUNT }, () => makeContact(usedNames, now));

  const pool = new Pool(getConnectionConfig());
  const db = drizzle(pool);
  try {
    // Names and phones repeat from run to run (dates do not), so one person is enough to tell
    const marker = people.find((person) => person.contact.phone)!.contact;
    const [{ value: markerCount }] = await db
      .select({ value: count() })
      .from(contacts)
      .where(and(eq(contacts.name, marker.name), eq(contacts.phone, marker.phone!)));
    if (markerCount > 0) {
      console.log(`Test contacts are already in the database (found "${marker.name}"), nothing to add.`);
      return;
    }

    let noteCount = 0;
    await db.transaction(async (tx) => {
      for (const batch of chunks(people, 250)) {
        const inserted = await tx
          .insert(contacts)
          .values(batch.map((person) => person.contact))
          .returning({ id: contacts.id, name: contacts.name });
        // Names are unique within the generated set, so they map rows back to people
        const idByName = new Map(inserted.map((row) => [row.name, row.id]));
        const noteRows = batch.flatMap((person) =>
          person.notes.map((note) => ({ ...note, contactId: idByName.get(person.contact.name)! })),
        );
        if (noteRows.length > 0) await tx.insert(notes).values(noteRows);
        noteCount += noteRows.length;
      }
    });

    const [{ value: total }] = await db.select({ value: count() }).from(contacts);
    console.log(`Added ${people.length} contacts and ${noteCount} notes. Contacts in the database: ${total}.`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
