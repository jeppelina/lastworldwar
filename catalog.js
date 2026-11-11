// Föremålskatalogen genereras: varje föremålstyp finns i varje material.
// Ny rad i MATS = ett nytt föremål per typ. Ny rad i TYPES (plus ritfunktion i hero.js) = tio nya föremål.

// Balansens siffror för föremål, hjälte och nivåer, samlade på ett ställe. Stridens siffror står i rules.js.
// Värdena är satta med simulatorn i sim/ (se docs/research/balans.md). Simulatorn byter ut hela TUNE
// när den prövar andra värden, så håll raden som en ren lista med tal.
// Ändrat 2026-11-11: powerBase 3 -> 4 (de första föremålen märks mer), priceBase 120 -> 300 (första köpet
// kommer senare), priceGrowth 1,45 -> 1,22 (de finaste materialen blir inte ouppnåeliga när starten är dyrare).
export const TUNE = {
  powerBase: 4, powerPerTier: 1.8,     // föremålets styrka = (powerBase + materialnivå * powerPerTier) * typens faktor * platsens faktor
  hpPower: 1.6,                        // ett föremål som ger liv ger så här många gånger mer än ett som ger attack
  priceBase: 300, priceGrowth: 1.22,   // pris = priceBase * priceGrowth^materialnivå * typens faktor * platsens faktor
  pricePet: 1.6, priceBack: 1.3,       // prisfaktor för följeslagare och ryggsaker (övriga platser använder sin styrkefaktor)
  levelPerTier: 4,                     // nivåkrav = 1 + materialnivå * levelPerTier + typens extra krav
  heroAtk: 10, heroAtkPerLevel: 1,     // hjältens attack utan utrustning
  heroHp: 24, heroHpPerLevel: 3,       // hjältens liv utan utrustning
  xpBase: 20, xpPerLevel: 12,          // xp till nästa nivå = xpBase + nivå * xpPerLevel
};

export const MATS = [
  { id: 'tra', pre: 'Wooden', hex: '#a9743f' },
  { id: 'jarn', pre: 'Iron', hex: '#8793a3' },
  { id: 'stal', pre: 'Steel', hex: '#c3d0de' },
  { id: 'guld', pre: 'Golden', hex: '#f2b632' },
  { id: 'smaragd', pre: 'Emerald', hex: '#2fbf71' },
  { id: 'is', pre: 'Ice', hex: '#74d3f7', fx: 'ice' },
  { id: 'eld', pre: 'Fire', hex: '#ee5a2a', fx: 'fire' },
  { id: 'skugg', pre: 'Shadow', hex: '#6a48b0', fx: 'shadow' },
  { id: 'kristall', pre: 'Crystal', hex: '#ee7fd8', fx: 'spark' },
  { id: 'stjarn', pre: 'Star', hex: '#fff0a0', fx: 'spark' },
];
export const RARITY = [
  { name: 'Common', color: '#9aa3b5' }, { name: 'Uncommon', color: '#5fd08a' }, { name: 'Rare', color: '#5aa8ff' },
  { name: 'Epic', color: '#b77bff' }, { name: 'Legendary', color: '#ffb23e' },
];
// stat: vad platsen ger. Vapen och följeslagare ger attack, resten ger liv. mult skalar värdet.
export const SLOTS = [
  { id: 'weapon', name: 'Weapon', stat: 'atk', mult: 1 }, { id: 'helmet', name: 'Head', stat: 'hp', mult: 0.7 }, { id: 'armor', name: 'Armor', stat: 'hp', mult: 1.1 },
  { id: 'shield', name: 'Shield', stat: 'hp', mult: 0.8 }, { id: 'back', name: 'Back', stat: 'hp', mult: 0.6 }, { id: 'pet', name: 'Pet', stat: 'atk', mult: 0.5 },
];
// p = styrke- och prisfaktor, lv = extra nivåkrav
const TYPES = {
  weapon: [['dagger', 'Dagger', 0.7, 0], ['club', 'Club', 0.8, 0], ['sword', 'Sword', 1, 1], ['axe', 'Axe', 1.1, 2], ['spear', 'Spear', 1.15, 2], ['hammer', 'Hammer', 1.25, 3], ['bow', 'Bow', 1.2, 2], ['staff', 'Staff', 1.35, 3], ['orb', 'Magic Orb', 1.5, 4], ['great', 'Greatsword', 1.6, 4]],
  helmet: [['cap', 'Cap', 0.6, 0], ['hood', 'Hood', 0.8, 1], ['helm', 'Helmet', 1, 1], ['phones', 'Headphones', 1.05, 2], ['horned', 'Horned Helmet', 1.2, 2], ['wizard', 'Wizard Hat', 1.3, 3], ['great', 'Knight Helmet', 1.45, 3], ['crown', 'Crown', 1.7, 4]],
  armor: [['tunic', 'Tunic', 0.7, 0], ['chain', 'Chainmail', 1, 1], ['robe', 'Robe', 1.2, 2], ['plate', 'Armor', 1.5, 3]],
  shield: [['round', 'Round Shield', 0.8, 0], ['kite', 'Kite Shield', 1.1, 2], ['tower', 'Tower Shield', 1.4, 3]],
  back: [['cape', 'Cape', 0.8, 1], ['wings', 'Wings', 1.3, 3], ['dragonwings', 'Dragon Wings', 1.5, 4], ['jetpack', 'Jetpack', 1.7, 4]],
  pet: [['slime', 'Slime', 0.8, 2], ['bat', 'Bat', 1, 2], ['ghost', 'Ghost', 1.2, 3], ['drone', 'Drone', 1.4, 4], ['dragon', 'Baby Dragon', 1.7, 4]],
};

export const ITEMS = [];
for (const slot of SLOTS) for (const [type, name, p, lv] of TYPES[slot.id]) MATS.forEach((m, tier) => {
  ITEMS.push({
    id: `${slot.id}.${type}.${m.id}`, slot: slot.id, type, mat: m.id, hex: m.hex, fx: m.fx, tier,
    name: m.pre + ' ' + name, rarity: Math.floor(tier / 2), stat: slot.stat,
    power: Math.max(1, Math.round((TUNE.powerBase + tier * TUNE.powerPerTier) * p * slot.mult * (slot.stat === 'hp' ? TUNE.hpPower : 1))),
    price: Math.round((TUNE.priceBase * Math.pow(TUNE.priceGrowth, tier) * p * (slot.id === 'pet' ? TUNE.pricePet : slot.id === 'back' ? TUNE.priceBack : slot.mult)) / 5) * 5,
    level: 1 + tier * TUNE.levelPerTier + lv,
  });
});
export const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ---------- Dagens butik: bara några få val per dag, och ingen katalog att bläddra i ----------
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const SHOP_SIZE = 4;
// Samma dag och samma barn ger samma hylla. Tre föremål som nivån räcker till (olika platser på kroppen om det går)
// och ett "drömföremål" som är lite för dyrt eller kräver lite högre nivå, så att det finns något att spara mot.
export function dailyShop(profile, day) {
  const r = rng(hash(profile.name + '|' + day)), owned = new Set(profile.owned);
  const pool = ITEMS.filter((i) => !owned.has(i.id) && i.level <= profile.level).sort((a, b) => b.level - a.level || b.price - a.price);
  const picks = [], slots = new Set();
  const recent = pool.slice(0, Math.max(12, Math.ceil(pool.length * 0.35)));       // det nyaste nivån har låst upp
  for (let tries = 0; tries < 200 && picks.length < SHOP_SIZE - 1 && recent.length; tries++) {
    const it = recent[Math.floor(r() * recent.length)];
    if (picks.includes(it) || (slots.has(it.slot) && tries < 120)) continue;
    picks.push(it); slots.add(it.slot);
  }
  const dream = ITEMS.filter((i) => !owned.has(i.id) && i.level > profile.level && i.level <= profile.level + 6 && !picks.includes(i)).sort((a, b) => b.price - a.price);
  if (dream.length) picks.push(dream[Math.floor(r() * Math.ceil(dream.length / 3))]);   // bland den dyraste tredjedelen
  return picks.map((i) => i.id);
}

// ---------- Nivåer och hjältens värden (siffrorna står i TUNE överst) ----------
export const xpToLevel = (level) => TUNE.xpBase + level * TUNE.xpPerLevel;
// Hjältens värden: det mesta kommer från nivån (alltså från att spela), utrustningen lägger till en mindre del.
export function heroStats(profile) {
  const pw = (slot) => (profile.eq[slot] ? BY_ID[profile.eq[slot]].power : 0);
  const baseAtk = TUNE.heroAtk + profile.level * TUNE.heroAtkPerLevel, baseHp = TUNE.heroHp + profile.level * TUNE.heroHpPerLevel;
  const gearAtk = pw('weapon') + pw('pet'), gearHp = pw('armor') + pw('helmet') + pw('shield') + pw('back');
  return { atk: baseAtk + gearAtk, maxHp: baseHp + gearHp, baseAtk, baseHp, gearAtk, gearHp };
}
