// Föremålskatalogen genereras: varje föremålstyp finns i varje material.
// Ny rad i MATS = ett nytt föremål per typ. Ny rad i TYPES (plus ritfunktion i hero.js) = tio nya föremål.

// Här står bara formler. Talen för föremål, hjälte och nivåer ligger i balance.js (TUNE), stridens tal i K.
// Simulatorn bygger en egen katalog med andra tal genom makeCatalog(TUNE, shopRules).
import { TUNE as BT, K as BK, history } from './balance.js';
export const TUNE = BT;

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

export const SHOP_SIZE = 6;     // fem som nivån räcker till och ett drömföremål (var 4 till 2026-11-12)
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Bygger katalogen ur en uppsättning tal. T = TUNE, shopRules = K.shop. Spelet använder den som byggs ur balance.js (nedan).
export function makeCatalog(T = TUNE, shopRules = BK.shop) {
  const ITEMS = [];
  for (const slot of SLOTS) for (const [type, name, p, lv] of TYPES[slot.id]) MATS.forEach((m, tier) => {
    ITEMS.push({
      id: `${slot.id}.${type}.${m.id}`, slot: slot.id, type, mat: m.id, hex: m.hex, fx: m.fx, tier,
      name: m.pre + ' ' + name, rarity: Math.floor(tier / 2), stat: slot.stat,
      power: Math.max(1, Math.round((T.powerBase * Math.pow(T.powerGrowth, tier)) * p * slot.mult * (slot.stat === 'hp' ? T.hpPower : 1))),
      price: Math.round((T.priceBase * Math.pow(T.priceGrowth, tier) * p * (slot.id === 'pet' ? T.pricePet : slot.id === 'back' ? T.priceBack : slot.mult)) / 5) * 5,
      level: 1 + tier * T.levelPerTier + lv,
    });
  });
  const BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

  // ---------- Dagens butik: bara några få val per dag, och ingen katalog att bläddra i ----------
  // Samma dag och samma barn ger samma hylla. Fem föremål som nivån räcker till (olika platser på kroppen om det går)
  // och ett "drömföremål" som är lite för dyrt eller kräver lite högre nivå, så att det finns något att spara mot.
  function baseShop(profile, day) {
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
  // Så länge hjälten inte äger något vapen finns alltid ett vapen på hyllan: saknas ett som nivån räcker till
  // byter hyllans första föremål plats med ett av de två billigaste vapnen.
  function dailyShop(profile, day) {
    const ids = baseShop(profile, day), isW = (id) => BY_ID[id].slot === 'weapon';
    if (!(shopRules && shopRules.weaponFirst) || profile.owned.some(isW) || ids.some((id) => isW(id) && BY_ID[id].level <= profile.level)) return ids;
    const ws = ITEMS.filter((it) => it.slot === 'weapon' && it.level <= profile.level).sort((a, b) => a.price - b.price);
    if (ws.length) ids[0] = ws[String(day).charCodeAt(String(day).length - 1) % Math.min(2, ws.length)].id;
    return ids;
  }

  // ---------- Nivåer och hjältens värden ----------
  const xpToLevel = (level) => Math.round(T.xpBase * Math.min(level, T.xpRamp) / T.xpRamp * Math.pow(T.xpGrowth, level - 1));
  // Hjältens värden: det mesta kommer från nivån (alltså från att spela), utrustningen lägger till en mindre del.
  function heroStats(profile) {
    const pw = (slot) => (profile.eq[slot] ? BY_ID[profile.eq[slot]].power : 0);
    const baseAtk = Math.round(T.heroAtk * Math.pow(T.heroGrowth, profile.level - 1)), baseHp = Math.round(T.heroHp * Math.pow(T.heroGrowth, profile.level - 1));
    const gearAtk = pw('weapon') + pw('pet'), gearHp = pw('armor') + pw('helmet') + pw('shield') + pw('back');
    return { atk: baseAtk + gearAtk, maxHp: baseHp + gearHp, baseAtk, baseHp, gearAtk, gearHp };
  }
  return { TUNE: T, MATS, RARITY, SLOTS, SHOP_SIZE, ITEMS, BY_ID, dailyShop, xpToLevel, heroStats };
}

const C = makeCatalog();
export const ITEMS = C.ITEMS, BY_ID = C.BY_ID, dailyShop = C.dailyShop, xpToLevel = C.xpToLevel, heroStats = C.heroStats;

// ---------- Nivåskydd vid kurvbyte (balans version 2) ----------
// Nivån räknas alltid fram ur summan av xp. När kurvan byttes hade en del nivåer kunnat sjunka ett steg. Den här
// funktionen ger gåvan som hindrar det: skillnaden mellan vad barnets nivå kostar med nya och gamla kurvan, och
// för nivån efter (ifall en annan enhet hunnit en nivå längre), aldrig mindre än noll. oldXp = xp tjänad före bytet.
export function levelKeepGrant(oldXp, newCurve = xpToLevel, old = history.v1) {
  const was = (l) => old.xpBase + l * old.xpPerLevel;
  let level = 1, x = oldXp; while (x >= was(level)) { x -= was(level); level++; }
  const cum = (f, n) => { let t = 0; for (let l = 1; l < n; l++) t += f(l); return t; }, diff = (n) => cum(newCurve, n) - cum(was, n);
  return { level, xp: Math.max(0, diff(level), diff(level + 1)) };
}
