// Генератор data.js: мержит кеш l2api.dev (/tmp/l2data) с ручными метаданными.
// Запуск: node tools/gen-data.js  (из каталога frozen-labyrinth)
const fs = require('fs');
const path = require('path');
const { nearestLight } = require('./png-light.cjs');

const CACHE = process.env.L2_CACHE || path.join(process.env.tmpdir || '/tmp', 'l2data');
// В Git Bash /tmp реально указывает сюда; фиксируем явно для надёжности:
const CACHE_DIRS = [
  process.env.L2_CACHE,
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Temp', 'l2data'),
  '/tmp/l2data',
].filter(Boolean);

function findCache() {
  for (const d of CACHE_DIRS) {
    if (fs.existsSync(path.join(d, 'item_icons.json'))) return d;
  }
  throw new Error('l2data cache not found: ' + CACHE_DIRS.join(' | '));
}
const CACHE_DIR = findCache();
const readJson = f => JSON.parse(fs.readFileSync(path.join(CACHE_DIR, f), 'utf8'));

const itemIcons = readJson('item_icons.json');

// ---------- RU-переводы имён предметов ----------
const ITEM_RU = {
  'Adena': 'Адена', 'Coal': 'Уголь', 'Varnish': 'Лак', 'Suede': 'Замша', 'Thread': 'Нить',
  'Stem': 'Стебель', 'Charcoal': 'Древесный уголь', 'Iron Ore': 'Железная руда',
  'Silver Nugget': 'Серебряный самородок', 'Mithril Ore': 'Мифриловая руда',
  'Animal Bone': 'Кость животного', 'Animal Skin': 'Шкура животного',
  'Metallic Thread': 'Металлическая нить', 'Metallic Fiber': 'Металлическое волокно',
  'Compound Braid': 'Сложная тесьма', 'Cokes': 'Кокс', 'Stone of Purity': 'Камень чистоты',
  'Asofe': 'Асофе', 'Mold Glue': 'Клей для форм', 'Mold Hardener': 'Отвердитель для форм',
  'Mold Lubricant': 'Смазка для форм', 'Oriharukon Ore': 'Руда орихарукона',
  'Silver Arrow': 'Серебряная стрела',
  'Ring of Binding Gemstone': 'Самоцвет Кольца Подчинения',
  'Necklace of Binding Chain': 'Цепочка Ожерелья Подчинения',
  "Nassen's Earring Gemstone": "Самоцвет Серёг Насена",
  'Adamantite Earring Gemstone': 'Самоцвет Адамантитовых Серёг',
  'Adamantite Ring Wire': 'Проволока Адамантитового Кольца',
  'Earring of Black Ore Piece': 'Фрагмент Серёг Чёрной Руды',
  'Necklace of Black Ore Beads': 'Бусины Ожерелья Чёрной Руды',
  'Ring of Black Ore Gemstone': 'Самоцвет Кольца Чёрной Руды',
  'Eminence Bow Shaft': 'Древко Лука «Величие»',
  'Orcish Poleaxe Blade': 'Клинок Орочьей Алебарды',
  'Doom Shield Fragment': 'Осколок Щита Рока',
  'Zubei\u2019s Breastplate Part': 'Часть Кирасы Зубея',
  "Zubei's Breastplate Part": 'Часть Кирасы Зубея',
  "Zubei's Gaiter Material": 'Материал Поножей Зубея',
  'Avadon Gaiters Material': 'Материал Поножей Авадона',
  'Avadon Leather Armor Lining': 'Подкладка Кожаной Брони Авадона',
  'Theca Leather Boots Texture': 'Материал Кожаных Сапог Теки',
  'Theca Leather Gloves Texture': 'Материал Кожаных Перчаток Теки',
  'Drake Leather Boots Design': 'Модель Кожаных Сапог Дрейка',
  'Full Plate Helmet Design': 'Модель Полного Шлема',
  'Greater Dye of CON (Con+4 Str-4)': 'Большой Краситель CON (Con+4 Str-4)',
  'Greater Dye of STR (Str+4 Dex-4)': 'Большой Краситель STR (Str+4 Dex-4)',
  'Scroll: Enchant Weapon (Grade B)': 'Свиток Заточки Оружия (B)',
  'Scroll: Enchant Armor (Grade B)': 'Свиток Заточки Брони (B)',
  'Silver Hemocyte': 'Серебряная Гемоцита',
  'Silver Ice Crystal': 'Серебряный Ледяной Кристалл',
  'Black Ice Crystal': 'Чёрный Ледяной Кристалл',
};
const REC_RU = 'Рецепт: ';
const recipeRu = en => REC_RU + en.replace(/^Recipe:\s*/, '')
  .replace(/\s*\(60%\)\s*$/, ' (60%)').replace(/\s*\(100%\)\s*$/, ' (100%)');
const itemRu = en => {
  if (ITEM_RU[en]) return ITEM_RU[en];
  if (en.startsWith('Recipe:')) return recipeRu(en);
  return en;
};

// ---------- Скиллы: слабости и резисты ----------
const SKILL_RU = {
  'Sword Weak Point': { name: 'Слабость к мечам', icon: 'skill4273.png' },
  'Dagger Weak Point': { name: 'Слабость к кинжалам', icon: 'skill4461.png' },
  'Blunt Attack Weak Point': { name: 'Слабость к дробящему оружию', icon: 'skill4444.png' },
  'Bow Attack Weak Point': { name: 'Слабость к лукам', icon: 'skill4274.png' },
  'Fire Attack Weak Point': { name: 'Слабость к атакам огнём', icon: 'skill4279.png' },
  'Resist Dagger': { name: 'Сопротивление кинжалам', icon: 'skill4291.png' },
  'Greater Resist Bleeding': { name: 'Повышенное сопр. кровотечению', icon: 'skill4292.png' },
  'Higher Resist Bow Weapons': { name: 'Повышенное сопротивление лукам', icon: 'skill4293.png' },
};

// ---------- Метаданные сущностей: RU-имя, координаты, советы, картинка ----------
// Координаты [y, x] — номиналы по фактическим светлым коридорам карты (вход юг).
// При генерации каждый снапится к ближайшей светлой ячейке (png-light.cjs).
const META = {
  22079: { ru: 'Потерянный бандерснач', img: 'bandersnatch', coords: [700, 540],
    tips: { ru: 'Кусок «волчьей» пачки в конце 2-го коридора. Пассивен, бьётся любым классом 55+.', en: 'Part of the "wolf" pack at the end of corridor 2. Passive, any class 55+ can farm it.' } },
  22080: { ru: 'Громадный бандерснач', img: 'bandersnatch', coords: [730, 640],
    tips: { ru: 'Старший в пачке бандерсначей. В списке охоты квеста 648 с самого начала коридора.', en: 'Elder of the bandersnatch pack. On quest 648 hunt list from the start of the corridor.' } },
  22081: { ru: 'Заблудший наблюдатель', img: 'watcher', coords: [230, 160],
    tips: { ru: 'Летающие «глаза», слабость к мечам. Мелочь для заточки прохода 1-го коридора.', en: 'Floating "eyes", weak to swords. Trash mobs on the corridor 1 route.' } },
  22082: { ru: 'Старший заблудший наблюдатель', img: 'watcher', coords: [255, 200],
    tips: { ru: 'Со старшего наблюдателя спойлится Animal Bone 85% и Theca-текстуры — годно для ремесленников.', en: 'Elder watchers spoil Animal Bone 85% and Theca textures — good for crafters.' } },
  22083: { ru: 'Детёныш пантеры', img: 'panthera', coords: [465, 185],
    tips: { ru: 'Мелкий спутник пантер. Не агрессивен, добивается по пути.', en: 'Small panther companion. Non-aggro, kill on the way.' } },
  22084: { ru: 'Пантера', img: 'panthera', coords: [440, 150],
    tips: { ru: 'Агрессивна (радиус 500)! Спойл: Adamantite Earring Gemstone 6.4%. Держи дистанцию, если ты спойлер без пати.', en: 'Aggressive (range 500)! Spoil: Adamantite Earring Gemstone 6.4%. Keep distance if you are a solo spoiler.' } },
  22085: { ru: 'Потерянная гаргулья', img: 'gargoyle', coords: [130, 210],
    tips: { ru: 'ЛУЧШИЙ спойл-моб локации: Nassen’s Gemstone ~20%, Asofe ~12%, Oriharukon ~11%. Слабость к кинжалам — рай для кинжальщиков.', en: 'BEST spoil mob here: Nassen’s Gemstone ~20%, Asofe ~12%, Oriharukon ~11%. Weak to daggers.' } },
  22086: { ru: 'Детёныш потерянной гаргульи', img: 'gargoyle', coords: [150, 250],
    tips: { ru: 'Агрессивен (радиус 500). Спойл: Adamantite Earring Gemstone 8.6%, рецепты Black Ore.', en: 'Aggressive (range 500). Spoil: Adamantite Earring Gemstone 8.6%, Black Ore recipes.' } },
  22087: { ru: 'Дух вилорога', img: 'pronghorn', coords: [620, 130],
    tips: { ru: 'Призрачная антилопа с большой поляны. Слабость к огню — магам с фаер-нюками самое то. Спойл: Varnish 77%.', en: 'Ghost antelope on the big clearing. Weak to fire — perfect for fire mages. Spoil: Varnish 77%.' } },
  22088: { ru: 'Вилорог', img: 'pronghorn', coords: [650, 165],
    tips: { ru: 'Мирные антилопы большой поляны 1-го коридора. Спокойный фарм без агро.', en: 'Peaceful antelopes on the corridor 1 clearing. Calm farming, no aggro.' } },
  22089: { ru: 'Ледяной тарантул', img: 'tarantula', coords: [70, 700],
    tips: { ru: 'Пауки начала 2-го коридора. Слабость к мечам. Спойл: части Zubei и рецепты Doom Shield.', en: 'Spiders at corridor 2 start. Weak to swords. Spoil: Zubei parts, Doom Shield recipe.' } },
  22090: { ru: 'Морозный тарантул', img: 'tarantula', coords: [100, 740],
    tips: { ru: 'Старший паук. Спойл: Suede 79%, материал поножей Зубея 6.4%.', en: 'Elder spider. Spoil: Suede 79%, Zubei gaiter material 6.4%.' } },
  22091: { ru: 'Потерянный железный голем', img: 'golem', coords: [230, 700],
    tips: { ru: 'Слабость к дубинам, резисты к кинжалам/лукам/кровотечению. Спойл: Iron Ore 53%, красители STR.', en: 'Weak to blunts, resists daggers/bows/bleed. Spoil: Iron Ore 53%, STR dyes.' } },
  22092: { ru: 'Морозный железный голем', img: 'golem', coords: [260, 740],
    tips: { ru: 'Агрессивен (радиус 500)! Кинжальщикам и лучникам плохо (резисты), воинам с дубиной — норм. Спойл: материал Авадона, рецепты BW/Doom.', en: 'Aggressive (range 500)! Bad for daggers/bows (resists), fine for blunt warriors. Spoil: Avadon material, BW/Doom recipes.' } },
  22093: { ru: 'Потерянный буйвол', img: 'buffalo', coords: [370, 720],
    tips: { ru: 'Буйволы у замёрзшего озера. Спойл: красители CON (Con+4 Str-4) 0.6% — дорого на рынке.', en: 'Buffalo near the frozen lake. Spoil: CON dye (Con+4 Str-4) 0.6% — sells well.' } },
  22094: { ru: 'Морозный буйвол', img: 'buffalo', coords: [400, 750],
    tips: { ru: 'Агрессивен (радиус 500)! На озере аккуратно: пачка морозных буйволов может слить соло-фармера.', en: 'Aggressive (range 500)! Careful at the lake: a pack can kill a solo farmer.' } },
  22095: { ru: 'Медвежонок урсус', img: 'ursus', coords: [570, 660],
    tips: { ru: 'Мелочь при медведях. Спойл: подкладка Авадона, рецепты кожаной брони BW/Doom.', en: 'Cub among the bears. Spoil: Avadon lining, BW/Doom leather recipes.' } },
  22096: { ru: 'Урсус', img: 'ursus', coords: [600, 700],
    tips: { ru: 'Ледяные медведи у поворота. Спойл: Stone of Purity 14%, куски Black Ore 9%, отвердитель 4%.', en: 'Ice bears at the turn. Spoil: Stone of Purity 14%, Black Ore pieces 9%, hardener 4%.' } },
  22097: { ru: 'Потерянный йети', img: 'yeti', coords: [280, 820],
    tips: { ru: 'Слабость к кинжалам. Спойл: Ring of Black Ore Gemstone 31% — топ-спойл для ювелирки.', en: 'Weak to daggers. Spoil: Ring of Black Ore Gemstone 31% — top jewelry spoil.' } },
  22098: { ru: 'Морозный йети', img: 'yeti', coords: [310, 780],
    tips: { ru: 'Самый жирный моб локации (63 лвл, 2090 HP). Слабость к кинжалам. Спойл: Doom Shield Fragment 10%, клей для форм 6%.', en: 'Toughest mob here (lvl 63, 2090 HP). Weak to daggers. Spoil: Doom Shield Fragment 10%, mold glue 6%.' } },
  32018: { ru: 'Миса', img: 'misa', coords: [350, 770], npc: true,
    tips: { ru: 'NPC у замёрзшего озера (Frost Lake), фигурирует в цепочке ледяных квестов Шутгарта.', en: 'NPC near Frost Lake, part of the Schuttgart ice quest chain.' } },
  32020: { ru: 'Раффорти', img: 'rafforty', coords: [45, 470], npc: true, questGiver: true,
    tips: { ru: 'Главный NPC локации у точки телепорта. Выдаёт квест 648 «Мечта ледяного торговца».', en: 'Main NPC at the teleport point. Gives quest 648 "An Ice Merchant’s Dream".' } },
  32022: { ru: 'Кир', img: 'kier', coords: [890, 280], npc: true,
    tips: { ru: 'NPC у моста к замку Ледяной Королевы (мост перекрыт льдом до выполнения условий).', en: 'NPC at the bridge to the Ice Queen’s castle (bridge is ice-blocked until conditions are met).' } },
  29056: { ru: 'Ледяная фея Сирра', img: 'sirra', coords: [915, 420], boss: true,
    tips: { ru: 'РЕЙД-БОСС 60 лвл, ~79k HP, со свитой (Sirra’s Page, Sirra’s Beholder). Мост к замку открывается через квест 648. Нужна пати с хилом.', en: 'RAID BOSS lvl 60, ~79k HP, with minions (Sirra’s Page, Sirra’s Beholder). Bridge opens via quest 648. Bring a party with a healer.' } },
  32029: { ru: 'Слуга Фреи', img: 'steward', coords: [900, 360], npc: true,
    tips: { ru: 'NPC у входа в замок, связан с лором Фреи.', en: 'NPC at the castle entrance, tied to Freya lore.' } },
  32023: { ru: 'Ледяной шельф', img: null, npc: true, questGiver: true,
    coords: [45, 560],
    tips: { ru: 'Квестовый объект Раффорти: принесённые Серебряные Ледяные Кристаллы обмениваются здесь на Чёрные.', en: 'Rafforty’s quest object: exchange brought Silver Ice Crystals for Black ones here.' } },
};


// ---------- Перевод скиллов сущности в weak/resist ----------
function skillInfo(npc) {
  const weak = [], res = [];
  (npc.skills || []).forEach(s => {
    const ru = SKILL_RU[s.name];
    if (!ru) return;
    if (/Weak Point/i.test(s.name)) weak.push({ ru: ru.name, en: s.name, icon: ru.icon });
    else if (/Resist/i.test(s.name)) res.push({ ru: ru.name, en: s.name, icon: ru.icon });
  });
  return { weak, res };
}

// ---------- Формирование дропа/спойла ----------
function dropInfo(drops) {
  const list = drops || [];
  const spoil = list.filter(d => d.type === 'spoil').slice(0, 3);
  const reg = list.filter(d => d.type === 'regular').slice(0, 4);
  const fmt = d => ({
    en: `${d.itemName} (${d.chanceDisplay})`, ru: `${itemRu(d.itemName)} (${d.chanceDisplay})`,
    icon: (itemIcons[d.itemId] && itemIcons[d.itemId].icon) || null,
  });
  return { drop: reg.map(fmt), spoil: spoil.map(fmt) };
}

// ---------- Сборка сущностей ----------
const RACE_RU = {
  'Magic Creature': 'Магическое создание', 'Beast': 'Зверь', 'Construct': 'Конструкт',
  'Humanoid': 'Гуманоид', 'Animal': 'Животное', 'Undead': 'Нежить', 'Plant': 'Растение',
  'Dragon': 'Дракон', 'Giant': 'Гигант', 'Bug': 'Насекомое', 'Fairy': 'Фея',
};

const MOB_IDS = [22079,22080,22081,22082,22083,22084,22085,22086,22087,22088,
  22089,22090,22091,22092,22093,22094,22095,22096,22097,22098];

const entities = [];
for (const id of MOB_IDS) {
  const npc = readJson(`npc_${id}.json`).data;
  const drops = readJson(`drops_${id}.json`).data.drops;
  const meta = META[id];
  const { weak, res } = skillInfo(npc);
  const { drop, spoil } = dropInfo(drops);
  entities.push({
    id: npc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    npcId: id, type: 'mob', isAggro: !!npc.isAggressive, level: npc.level,
    hp: npc.stats.hp, exp: npc.stats.exp, sp: npc.stats.sp,
    race: { ru: RACE_RU[npc.race] || npc.race, en: npc.race, icon: npc.raceIconFile },
    name: { ru: meta.ru, en: npc.name },
    weakness: weak, resist: res, drop, spoil,
    coords: meta.coords, img: fs.existsSync(path.join(__dirname, '..', 'img', 'mobs', id + '.png'))
      ? `img/mobs/${id}.png`
      : (meta.img ? `img/mobs/${meta.img}.webp` : null),
    questMob: true, tips: meta.tips,
  });
}
for (const id of [32018, 32020, 32022, 32029, 32023]) {
  const npc = readJson(`npc_${id}.json`).data;
  const meta = META[id];
  entities.push({
    id: npc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    npcId: id, type: 'npc', isAggro: false, level: npc.level,
    hp: npc.stats.hp, exp: 0, sp: 0, race: null,
    name: { ru: meta.ru, en: npc.name },
    weakness: [], resist: [], drop: [], spoil: [],
    coords: meta.coords, img: meta.img ? `img/mobs/${meta.img}.webp` : null,
    questMob: false, questGiver: !!meta.questGiver, tips: meta.tips,
  });
}
{
  const meta = META[29056];
  entities.push({
    id: 'ice-fairy-sirra', npcId: 29056, type: 'boss', isAggro: false, level: 60,
    hp: 79150, exp: 0, sp: 0, race: null,
    name: { ru: meta.ru, en: 'Ice Fairy Sirra' },
    weakness: [], resist: [], drop: [], spoil: [],
    coords: meta.coords,
    img: fs.existsSync(path.join(__dirname, '..', 'img', 'mobs', '29056.png'))
      ? 'img/mobs/29056.png' : `img/mobs/${meta.img}.webp`,
    questMob: false, tips: meta.tips,
  });
}

// ---------- Квест 648 ----------
const quest = {
  id: 'q648',
  name: { ru: 'Мечта ледяного торговца', en: "An Ice Merchant's Dream" },
  giver: { ru: 'Раффорти / Ледяной шельф', en: 'Rafforty / Ice Shelf' },
  minLevel: 53, repeatable: true,
  items: [
    { icon: 'etc_lesser_potion_clear_i00.png', name: { ru: 'Серебряная Гемоцита', en: 'Silver Hemocyte' } },
    { icon: 'etc_broken_crystal_silver_i00.png', name: { ru: 'Серебряный Ледяной Кристалл', en: 'Silver Ice Crystal' } },
    { icon: 'etc_gem_black_i00.png', name: { ru: 'Чёрный Ледяной Кристалл', en: 'Black Ice Crystal' } },
  ],
  steps: [
    {
      title: { ru: 'Просьба Раффорти', en: "Rafforty's Request" },
      desc: {
        ru: 'Раффорти просит найти Серебряный Ледяной Кристалл. Их охраняют обитатели Замёрзшего Лабиринта. Охотьтесь на любых мобов локации (все 20 видов в списке охоты).',
        en: 'Rafforty asks you to find a Silver Ice Crystal. They are guarded by the creatures of the Frozen Labyrinth. Hunt any mobs of the location (all 20 species are on the hunt list).',
      },
    },
    {
      title: { ru: 'Берегите Серебряные Гемоциты', en: 'Save the Silver Hemocytes' },
      desc: {
        ru: 'Раффорти благодарит и просит беречь Серебряные Гемоциты на будущее (пригодятся в цепочке квеста 115). Серебряные кристаллы пока не сдавайте: их можно улучшить.',
        en: 'Rafforty thanks you and asks to save Silver Hemocytes for the future (needed for quest 115 chain). Do not hand in Silver Crystals yet: they can be upgraded.',
      },
    },
    {
      title: { ru: 'Обмен у Ледяного шельфа', en: 'Exchange at the Ice Shelf' },
      desc: {
        ru: 'Ледяной шельф на входе пытается переделать Серебряный Ледяной Кристалл в Чёрный. Попытка не всегда удачна — кристалл может разбиться.',
        en: 'The Ice Shelf at the entrance attempts to convert a Silver Ice Crystal into a Black one. The attempt may fail — the crystal can shatter.',
      },
    },
  ],
  reward: {
    ru: 'Награда у Раффорти: Серебряный Ледяной Кристалл — 300 адены за штуку, Чёрный Ледяной Кристалл — 1 200 адены за штуку. Сдавать можно в любом количестве, квест повторяемый.',
    en: 'Reward from Rafforty: Silver Ice Crystal — 300 adena each, Black Ice Crystal — 1,200 adena each. Hand in any amount, the quest is repeatable.',
  },
  huntMobIds: MOB_IDS,
};

// ---------- Гайд по локации ----------
const guide = [
  { title: { ru: 'Общее', en: 'Overview' }, text: {
    ru: 'Локация 53–63 лвл к северо-западу от Шутгарта (ТП «Хижина Ледяного Торговца»). Четыре коридора-луча от входа; мобы живут «пачками» на полянах. Соло/дуо 56+.',
    en: 'Level 53–63 zone NW of Schuttgart (teleport: Ice Merchant Cabin). Four corridor-arms from the entrance; mobs live in packs on clearings. Solo/duo 56+.' } },
  { title: { ru: '1-й коридор (лёгкий вход)', en: 'Corridor 1 (easy entry)' }, text: {
    ru: 'Горгульи → наблюдатели → пантеры → большая поляна с вилорогами. Пантеры (56) и детёныши гаргулий (56) агрессивны, остальное пассивно. Лучший маршрут для старта.',
    en: 'Gargoyles \u2192 watchers \u2192 panthers \u2192 big pronghorn clearing. Panthers (56) and gargoyle younglings (56) are aggressive, the rest is passive. Best starting route.' } },
  { title: { ru: '2-й коридор (самый жирный)', en: 'Corridor 2 (richest)' }, text: {
    ru: 'Тарантулы → големы (агро!) → йети → озеро с буйволами (морозные — агро!) → урсусы → бандерсначи. Здесь топ-спойл локации: горгульи в начале, йети и урсусы в глубине.',
    en: 'Tarantulas \u2192 golems (aggro!) \u2192 yetis \u2192 buffalo lake (frost ones aggro!) \u2192 ursus \u2192 bandersnatches. Top spoils of the zone: gargoyles at the start, yetis and ursus deeper.' } },
  { title: { ru: '3-й и 4-й коридоры', en: 'Corridors 3 and 4' }, text: {
    ru: 'В 3-м почти только наблюдатели, ведёт к Лаборатории (Руины Павла). 4-й почти пуст — длинный проход к Долине Святых и Монастырю Молчания.',
    en: 'Corridor 3 has mostly watchers, leads to the Archaic Laboratory (Pavel Ruins). Corridor 4 is almost empty \u2014 a long passage to the Valley of Saints and Monastery of Silence.' } },
  { title: { ru: 'Мост и рейд-босс', en: 'Bridge and the raid boss' }, text: {
    ru: 'Мост к замку Ледяной Королевы перекрыт льдом — открывается через квест 648. В замке Сирра (рейд 60, ~79k HP) со свитой. Нужна пати.',
    en: 'The bridge to the Ice Queen\u2019s castle is ice-blocked \u2014 opens via quest 648. Inside: Sirra (raid 60, ~79k HP) with minions. Bring a party.' } },
  { title: { ru: 'Подбор оружия', en: 'Weapon matching' }, text: {
    ru: 'Горгульи и йети — слабость к кинжалам. Наблюдатели и тарантулы — к мечам. Големы — к дубинам (у них резист к кинжалам и лукам). Духи вилорогов — к огню.',
    en: 'Gargoyles and yetis \u2014 dagger weak point. Watchers and tarantulas \u2014 swords. Golems \u2014 blunts (they resist daggers and bows). Pronghorn Spirits \u2014 fire.' } },
];

// ---------- i18n ----------
const i18n = {
  title: { ru: 'Frozen Labyrinth — интерактивная карта', en: 'Frozen Labyrinth — Interactive Map' },
  subtitle: { ru: 'Lineage 2: Interlude', en: 'Lineage 2: Interlude' },
  filterAll: { ru: 'Все', en: 'Show All' },
  filterNpc: { ru: 'NPC', en: 'NPCs Only' },
  filterAggro: { ru: 'Агрессивные', en: 'Aggressive' },
  filterPassive: { ru: 'Пассивные', en: 'Passive' },
  questBtn: { ru: 'Квест 648', en: 'Quest 648' },
  guideBtn: { ru: 'Гайд', en: 'Guide' },
  spawnsBtn: { ru: 'Точки спавна', en: 'Spawn points' },
  mobListTitle: { ru: 'Мобы локации', en: 'Location mobs' },
  showSpawnsBtn: { ru: 'Подсветить спавны', en: 'Highlight spawns' },
  questTitle: { ru: 'Мечта ледяного торговца', en: "An Ice Merchant's Dream" },
  questGiver: { ru: 'Выдаёт', en: 'Giver' },
  questMinLevel: { ru: 'Мин. уровень', en: 'Min. level' },
  questRepeatable: { ru: 'Повторяемый', en: 'Repeatable' },
  questItems: { ru: 'Квест-предметы', en: 'Quest items' },
  questStep: { ru: 'Шаг', en: 'Step' },
  questShowMobs: { ru: 'Показать мобов квеста', en: 'Show quest mobs' },
  questHideMobs: { ru: 'Скрыть подсветку', en: 'Hide highlight' },
  questBadge: { ru: 'Квест 648', en: 'Quest 648' },
  guideTitle: { ru: 'Гайд по фарму', en: 'Farming Guide' },
  level: { ru: 'Уровень', en: 'Level' },
  aggro: { ru: 'Агрессивный', en: 'Aggressive' },
  passive: { ru: 'Пассивный', en: 'Passive' },
  raidBoss: { ru: 'Рейд-босс', en: 'Raid Boss' },
  weakness: { ru: 'Слабости', en: 'Weakness' },
  resist: { ru: 'Сопротивления', en: 'Resistances' },
  drop: { ru: 'Дроп', en: 'Drop' },
  spoil: { ru: 'Спойл', en: 'Spoil' },
  tips: { ru: 'Совет по фарму', en: 'Farming tip' },
  hp: { ru: 'HP', en: 'HP' },
  exp: { ru: 'EXP', en: 'EXP' },
  sp: { ru: 'SP', en: 'SP' },
  markersVisible: { ru: 'маркеров', en: 'markers' },
  musicBtn: { ru: 'Музыка', en: 'Music' },
  musicHint: { ru: 'Фоновая музыка: OST Lineage 2 — Snowfield Dawn (вкл/выкл)', en: 'Background music: L2 OST — Snowfield Dawn (toggle)' },
  coordsHint: { ru: 'Клик по карте — координаты [y, x] в консоль', en: 'Click the map — [y, x] coordinates in console' },
  close: { ru: 'Закрыть', en: 'Close' },
  none: { ru: '—', en: '—' },
};

// ---------- Координаты: спавны из датапаков L2J Interlude ----------
// tools/spawns-map.json — { centers: {npcId:[y,x]}, points: {npcId:[[y,x],...]} }
// Источники: spawnlist.sql (Hl4p3x/L2JServer_C6_Interlude) + l2api.dev spawns API.
const spawnsMap = JSON.parse(fs.readFileSync(path.join(__dirname, 'spawns-map.json'), 'utf8'));
// 22091/22095 — миньоны (спавнятся при хозяевах, своих точек нет): рядом со старшими
const SIBLING = { 22091: [580, 810], 22095: [860, 745] };
let fromDatapack = 0, spawnPointsTotal = 0;
for (const e of entities) {
  if (e.type === 'portal') continue;
  const id = e.npcId;
  if (spawnsMap.centers[id]) { e.coords = spawnsMap.centers[id]; fromDatapack++; }
  else if (SIBLING[id]) e.coords = SIBLING[id];
  if (spawnsMap.points[id]) { e.spawnPoints = spawnsMap.points[id]; spawnPointsTotal += e.spawnPoints.length; }
}

// ---------- Снап координат к светлым (проходимым) ячейкам ----------
const taken = new Set();
let snapped = 0;
for (const e of entities) {
  let [y, x] = nearestLight(e.coords[0], e.coords[1]);
  // разcollide: не давать двум сущностям одну ячейку
  let guard = 0;
  while (taken.has(y + ':' + x) && guard++ < 40) {
    const jitter = 20 * Math.ceil((guard + 1) / 4);
    const cand = nearestLight(
      Math.max(0, Math.min(1000, y + (guard % 2 ? jitter : -jitter))),
      Math.max(0, Math.min(1000, x + (guard % 3 ? jitter : -jitter)))
    );
    y = cand[0]; x = cand[1];
  }
  if (y !== e.coords[0] || x !== e.coords[1]) snapped++;
  taken.add(y + ':' + x);
  e.coords = [y, x];
}

// ---------- Запуск ----------
const out = `// frozen-labyrinth/data.js — сгенерировано tools/gen-data.js
// Источники: l2api.dev (Interlude), l2vika.ru (топология), неофициальные RU-переводы.
const APP = ${JSON.stringify({ entities, quest, guide, i18n }, null, 2)};
`;
fs.writeFileSync(path.join(__dirname, '..', 'data.js'), out);
console.log('OK: data.js —', entities.length, 'entities | from datapack:', fromDatapack, '| snapped:', snapped);
