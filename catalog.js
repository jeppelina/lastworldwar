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
// stat: vad platsen ger. Vapen och följeslagare ger attack, resten ger liv, berlocken inget. mult skalar värdet.
// Nya platser läggs sist (utrustning v4, balans v20): händer, ben, fötter, bälte och berlocken som hänger i bältet.
// Platsernas id står i loggen och får aldrig bytas: shield heter Off-hand på skärmen och armor heter Body.
export const SLOTS = [
  { id: 'weapon', name: 'Weapon', stat: 'atk', mult: 1 }, { id: 'helmet', name: 'Head', stat: 'hp', mult: 0.7 }, { id: 'armor', name: 'Body', stat: 'hp', mult: 1.1 },
  { id: 'shield', name: 'Off-hand', stat: 'hp', mult: 0.8 }, { id: 'back', name: 'Back', stat: 'hp', mult: 0.6 }, { id: 'pet', name: 'Pet', stat: 'atk', mult: 0.5 },
  { id: 'hands', name: 'Hands', stat: 'hp', mult: 0.2 }, { id: 'legs', name: 'Legs', stat: 'hp', mult: 0.25 }, { id: 'feet', name: 'Feet', stat: 'hp', mult: 0.2 },
  { id: 'belt', name: 'Belt', stat: 'hp', mult: 0.1 }, { id: 'charm', name: 'Charm', stat: 'none', mult: 0 },
];
// p = styrke- och prisfaktor, lv = extra nivåkrav. Nya sorter läggs sist i sin plats (ordningen bestämmer bara listans ordning).
// Berlockerna har ett femte fält: sitt enda material (ingen materialstege), och fast pris TUNE.charmPrice * p.
const TYPES = {
  weapon: [['dagger', 'Dagger', 0.7, 0], ['club', 'Club', 0.8, 0], ['sword', 'Sword', 1, 1], ['axe', 'Axe', 1.1, 2], ['spear', 'Spear', 1.15, 2], ['hammer', 'Hammer', 1.25, 3], ['bow', 'Bow', 1.2, 2], ['staff', 'Staff', 1.35, 3], ['orb', 'Magic Orb', 1.5, 4], ['great', 'Greatsword', 1.6, 4],
    ['knives', 'Throwing Knives', 1, 1], ['stars', 'Throwing Stars', 1.1, 2],
    ['katana', 'Katana', 1.5, 3], ['greataxe', 'Great Axe', 1.6, 3], ['javelin', 'Throwing Spear', 1.3, 2], ['crossbow', 'Crossbow', 1.4, 3], ['bomb', 'Bomb', 1.45, 3], ['halberd', 'Halberd', 1.5, 3],
    ['giantblade', 'Giant Blade', 1.7, 4], ['gianthammer', 'Giant Hammer', 1.75, 4]],
  helmet: [['cap', 'Cap', 0.6, 0], ['hood', 'Hood', 0.8, 1], ['helm', 'Helmet', 1, 1], ['phones', 'Headphones', 1.05, 2], ['horned', 'Horned Helmet', 1.2, 2], ['wizard', 'Wizard Hat', 1.3, 3], ['great', 'Knight Helmet', 1.45, 3], ['crown', 'Crown', 1.7, 4], ['bandana', 'Bandana', 0.75, 1], ['kabuto', 'Samurai Helmet', 1.3, 2], ['goggles', 'Goggle Cap', 0.9, 1], ['circlet', 'Winged Circlet', 1.6, 4]],
  armor: [['tunic', 'Tunic', 0.7, 0], ['chain', 'Chainmail', 1, 1], ['robe', 'Robe', 1.2, 2], ['plate', 'Armor', 1.5, 3], ['vest', 'Ranger Vest', 0.85, 0], ['coat', 'Long Coat', 1.05, 1], ['furvest', 'Fur Vest', 1, 1], ['lamellar', 'Lamellar Armor', 1.3, 2], ['overalls', 'Overalls', 1, 1], ['skyplate', 'Sky Plate', 1.5, 4]],
  shield: [['round', 'Round Shield', 0.8, 0], ['kite', 'Kite Shield', 1.1, 2], ['tower', 'Tower Shield', 1.4, 3], ['quiver', 'Quiver', 0.9, 0], ['parry', 'Parrying Dagger', 0.95, 1], ['book', 'Spell Book', 1.15, 2], ['fan', 'War Fan', 1, 1], ['cog', 'Cog Shield', 1.2, 2], ['sunshield', 'Sun Shield', 1.4, 4]],
  back: [['cape', 'Cape', 0.8, 1], ['wings', 'Wings', 1.3, 3], ['dragonwings', 'Dragon Wings', 1.5, 4], ['jetpack', 'Jetpack', 1.7, 4], ['leafcloak', 'Leaf Cloak', 0.9, 1], ['tattered', 'Tattered Cloak', 0.95, 1], ['mantle', 'Star Mantle', 1.2, 2], ['furcloak', 'Fur Cloak', 1, 1], ['banner', 'Back Banner', 1.2, 2], ['halo', 'Star Halo', 1.6, 4]],
  pet: [['slime', 'Slime', 0.8, 2], ['bat', 'Bat', 1, 2], ['ghost', 'Ghost', 1.2, 3], ['drone', 'Drone', 1.4, 4], ['dragon', 'Baby Dragon', 1.7, 4]],
  hands: [['bracers', 'Archer Bracers', 1, 0], ['gauntlets', 'Gauntlets', 1.2, 1], ['fingerless', 'Fingerless Gloves', 1, 0], ['runebracers', 'Rune Bracers', 1.1, 1], ['furcuffs', 'Fur Cuffs', 1, 0], ['kote', 'Armored Sleeves', 1.15, 1], ['workgloves', 'Work Gloves', 1.05, 0], ['skygloves', 'Sky Gauntlets', 1.2, 4]],
  legs: [['trousers', 'Ranger Trousers', 1, 0], ['greaves', 'Greaves', 1.2, 1], ['strapped', 'Strapped Trousers', 1, 0], ['leggings', 'Star Leggings', 1.1, 1], ['wrapped', 'Wrapped Trousers', 1, 0], ['hakama', 'Hakama', 1.1, 1], ['cargo', 'Cargo Pants', 1.05, 0], ['skygreaves', 'Cloud Greaves', 1.2, 4]],
  feet: [['tallboots', 'Tall Boots', 1, 0], ['sabatons', 'Knight Boots', 1.2, 1], ['softboots', 'Soft Boots', 1, 0], ['curled', 'Curled Shoes', 1.1, 1], ['furboots', 'Fur Boots', 1.05, 0], ['sandals', 'Straw Sandals', 0.95, 0], ['workboots', 'Work Boots', 1.1, 1], ['skyboots', 'Winged Boots', 1.2, 4]],
  belt: [['pouchbelt', 'Pouch Belt', 1, 0], ['swordbelt', 'Sword Belt', 1.2, 1], ['bandolier', 'Knife Bandolier', 1, 0], ['ropebelt', 'Rope Belt', 1.1, 1], ['hornbelt', 'Horn Belt', 1.05, 0], ['obi', 'Sash', 1.1, 1], ['toolbelt', 'Tool Belt', 1.1, 1], ['skysash', 'Sky Sash', 1.2, 4]],
  charm: [['pouch', 'Pouch', 0.8, 0, 'tra'], ['keys', 'Keys', 0.9, 0, 'guld'], ['horn', 'Horn', 1, 0, 'jarn'], ['potion', 'Potion', 1, 0, 'is'], ['scroll', 'Scroll', 1.1, 0, 'guld'], ['lantern', 'Lantern', 1.2, 0, 'eld'], ['owl', 'Owl', 1.2, 0, 'stal']],
};
// Byggena (utrustning v4): en sort per plats på kroppen, och byggets vapen (räknas inte i setet). Setbonusen är bara utseende:
// tre delar av samma bygge i vilket material som helst ger en ring på marken i byggets färg, sex delar byggets egen effekt
// (hero.js). home = världen där bygget hör hemma (hyllans byggplats väljer världens bygge när barnet inte har börjat på något).
// Steg 3 (balans v21): Rogue och Mage (Svampträsket). Steg 4 (balans v22): Viking och Samurai (Frostbergen), Engineer (Meningsvulkanen).
// Steg 5 (balans v23): Celestial, Molnslottets eget toppbygge, säljs bara där (Fire till Star).
export const SET_SLOTS = ['helmet', 'armor', 'hands', 'legs', 'feet', 'belt', 'shield', 'back'];
export const BUILDS = {
  ranger: { name: 'Ranger', hex: '#5aa646', weapon: 'bow', home: 0, pieces: { helmet: 'cap', armor: 'vest', hands: 'bracers', legs: 'trousers', feet: 'tallboots', belt: 'pouchbelt', shield: 'quiver', back: 'leafcloak' } },
  knight: { name: 'Knight', hex: '#c3d0de', weapon: 'sword', home: 1, pieces: { helmet: 'great', armor: 'plate', hands: 'gauntlets', legs: 'greaves', feet: 'sabatons', belt: 'swordbelt', shield: 'kite', back: 'cape' } },
  rogue: { name: 'Rogue', hex: '#9a6bff', weapon: 'knives', home: 2, pieces: { helmet: 'bandana', armor: 'coat', hands: 'fingerless', legs: 'strapped', feet: 'softboots', belt: 'bandolier', shield: 'parry', back: 'tattered' } },
  mage: { name: 'Mage', hex: '#5a8cff', weapon: 'staff', home: 2, pieces: { helmet: 'wizard', armor: 'robe', hands: 'runebracers', legs: 'leggings', feet: 'curled', belt: 'ropebelt', shield: 'book', back: 'mantle' } },
  viking: { name: 'Viking', hex: '#d9cbb0', weapon: 'greataxe', home: 3, pieces: { helmet: 'horned', armor: 'furvest', hands: 'furcuffs', legs: 'wrapped', feet: 'furboots', belt: 'hornbelt', shield: 'round', back: 'furcloak' } },
  samurai: { name: 'Samurai', hex: '#f5a3c7', weapon: 'katana', home: 3, pieces: { helmet: 'kabuto', armor: 'lamellar', hands: 'kote', legs: 'hakama', feet: 'sandals', belt: 'obi', shield: 'fan', back: 'banner' } },
  engineer: { name: 'Engineer', hex: '#ff9a3c', weapon: 'crossbow', home: 4, pieces: { helmet: 'goggles', armor: 'overalls', hands: 'workgloves', legs: 'cargo', feet: 'workboots', belt: 'toolbelt', shield: 'cog', back: 'jetpack' } },
  celestial: { name: 'Celestial', hex: '#ffe27a', weapon: 'giantblade', home: 5, pieces: { helmet: 'circlet', armor: 'skyplate', hands: 'skygloves', legs: 'skygreaves', feet: 'skyboots', belt: 'skysash', shield: 'sunshield', back: 'halo' } },
};
// Bygget som en sort hör till (null = inget). it = { slot, type }.
export const buildOf = (it) => { if (!it || !SET_SLOTS.includes(it.slot)) return null; for (const id in BUILDS) if (BUILDS[id].pieces[it.slot] === it.type) return id; return null; };
// Delar per bygge bland föremålen (en lista eller ett objekt plats -> föremål). Varje plats räknas en gång per bygge.
export function setCounts(items) {
  const c = {}, seen = new Set();
  for (const it of Array.isArray(items) ? items : Object.values(items || {})) { const b = it && buildOf(it); if (!b || seen.has(b + it.slot)) continue; seen.add(b + it.slot); c[b] = (c[b] || 0) + 1; }
  return c;
}

export const SHOP_SIZE = 9;     // åtta som nivån räcker till och ett drömföremål (4 först, 6 och sedan 9 den 2026-11-12)
const hash = (str) => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Bygger katalogen ur en uppsättning tal. T = TUNE, shopRules = K.shop. Spelet använder den som byggs ur balance.js (nedan).
export function makeCatalog(T = TUNE, shopRules = BK.shop) {
  const ITEMS = [];
  for (const slot of SLOTS) for (const [type, name, p, lv, only] of TYPES[slot.id]) MATS.forEach((m, tier) => {
    if (only) {                                                  // berlock: ett material, ingen styrka, fast pris, inget nivåkrav utöver lv
      if (m.id !== only) return;
      ITEMS.push({ id: `${slot.id}.${type}.${m.id}`, slot: slot.id, type, mat: m.id, hex: m.hex, fx: m.fx, tier, name, rarity: 1, stat: slot.stat, power: 0, price: Math.round(((T.charmPrice || 50) * p) / 5) * 5, level: 1 + lv });
      return;
    }
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
  // isW tål okända id (ett föremål från en nyare klient i owned): de räknas inte som vapen.
  const isW = (id) => { const it = BY_ID[id]; return !!it && it.slot === 'weapon'; };
  function dailyShop(profile, day) {
    const ids = baseShop(profile, day);
    if (!(shopRules && shopRules.weaponFirst) || profile.owned.some(isW) || ids.some((id) => isW(id) && BY_ID[id].level <= profile.level)) return ids;
    const ws = ITEMS.filter((it) => it.slot === 'weapon' && it.level <= profile.level).sort((a, b) => a.price - b.price);
    if (ws.length) ids[0] = ws[String(day).charCodeAt(String(day).length - 1) % Math.min(2, ws.length)].id;
    return ids;
  }

  // ---------- Världarnas butiker (balans v17): en butik per värld, var och en med sitt eget materialspann ----------
  // k = världens index i kartans ordning. Samma barn, värld och dag ger samma hylla. Åtta platser dras ur världens spann
  // (lo till hi i shopRules.worlds) bland det som nivån räcker till, det nyaste först som i baseShop. Varje plats har chansen
  // up1 att i stället bli ett fynd ett material över spannet och up2 två material över. Ett fynd får kräva högst `reach`
  // nivåer över hjältens (helst ett som nivån redan räcker till). Sist ett drömföremål ur spannet som kräver högre nivå,
  // högst sex nivåer över. Finns inget (hjälten har vuxit ifrån butiken) blir det en vanlig plats till.
  // Typerna: världens butik säljer bara de föremålstyper som har börjat säljas i den världen (shopRules.types), och ett
  // fynd får också vara en typ från nästa värld. Vapenregeln är densamma som i dailyShop (med världens typer i första hand).
  // Saknas världen i shopRules används den gamla hyllan (dailyShop).
  const shopRange = (k) => (shopRules && shopRules.worlds && shopRules.worlds[k]) || null;
  // Ett fynd: över världens spann. En berlock (fast material) är aldrig ett fynd.
  const isLucky = (k, it) => { const W = shopRange(k); return !!(W && it && it.slot !== 'charm' && it.tier > W.hi); };
  // Världen där en sort börjar säljas: K.shop.kinds och K.shop.fade (v20), eller K.shop.types (v17 till v19). 0 om den saknas.
  const kindOf = (slot, type) => { const KK = shopRules && shopRules.kinds; return KK && KK[slot] && KK[slot][type] != null ? KK[slot][type] : null; };
  const typeWorld = (it) => {
    if (shopRules && shopRules.kinds) { const v = kindOf(it.slot, it.type); return v == null ? 0 : typeof v === 'number' ? v : shopRules.fade[v][0]; }
    const TT = (shopRules && shopRules.types) || {}; return TT[it.slot] && TT[it.slot][it.type] != null ? TT[it.slot][it.type] : 0;
  };
  // Materialen som sorten säljs i, i värld k (v20): [lägst, högst] som index i MATS, 'fixed' för en berlock, null = säljs inte.
  // Taket = tak + steg * (k - första världen), avrundat nedåt, högst världens hi. Under världens lo säljs sorten bara i takets material.
  function kindSpan(slot, type, k) {
    const W = shopRange(k), v = kindOf(slot, type); if (!W || v == null) return null;
    if (typeof v === 'number') return v <= k ? 'fixed' : null;
    const f = shopRules.fade && shopRules.fade[v]; if (!f || k < f[0]) return null;
    const cap = Math.max(0, Math.min(W.hi, Math.floor(f[1] + f[2] * (k - f[0]))));
    return [Math.min(W.lo, cap), cap];
  }
  // Världen där en sort hör hemma (v21): fade-gruppens fjärde tal om det finns, annars första världen. Före den världen är sorten
  // en försmak (bara Wooden) och får vikten shopRules.preview på hyllan i stället för vikten för en ny sort.
  const homeOf = (it) => { const v = kindOf(it.slot, it.type); if (v == null || typeof v === 'number' || !shopRules.fade[v]) return typeWorld(it); const f = shopRules.fade[v]; return f[3] != null ? f[3] : f[0]; };
  const KIND = {};                                               // 'plats.sort' -> föremålen, lägsta materialet först
  for (const it of ITEMS) (KIND[it.slot + '.' + it.type] || (KIND[it.slot + '.' + it.type] = [])).push(it);
  function worldShop(profile, day, k) {
    const W = shopRange(k); if (!W) return dailyShop(profile, day);
    if (shopRules.kinds) return worldShopV20(profile, day, k, W);
    const r = rng(hash(profile.name + '|' + day + '|w' + k)), owned = new Set(profile.owned), L = profile.level;
    const up1 = shopRules.up1 || 0, up2 = shopRules.up2 || 0, reach = shopRules.reach == null ? 6 : shopRules.reach, top = MATS.length - 1;
    const TT = shopRules.types || {}, from = (i) => (TT[i.slot] && TT[i.slot][i.type] != null ? TT[i.slot][i.type] : 0);
    const inR = (i) => i.tier >= W.lo && i.tier <= W.hi && from(i) <= k;
    const pool = ITEMS.filter((i) => !owned.has(i.id) && inR(i) && i.level <= L).sort((a, b) => b.level - a.level || b.price - a.price);
    const recent = pool.slice(0, Math.max(12, Math.ceil(pool.length * 0.35)));
    const lucky = (step) => { const t = W.hi + step; if (t > top) return []; const a = ITEMS.filter((i) => !owned.has(i.id) && i.tier === t && from(i) <= k + 1 && i.level <= L + reach); const now = a.filter((i) => i.level <= L); return now.length ? now : a; };
    const picks = [], slots = new Set();
    const take = (src, spread) => {
      const left = src.filter((i) => !picks.includes(i)); if (!left.length) return false;
      let it = null; for (let tries = 0; tries < 40 && !it; tries++) { const c = left[Math.floor(r() * left.length)]; if (!spread || !slots.has(c.slot) || tries >= 25) it = c; }
      picks.push(it); slots.add(it.slot); return true;
    };
    for (let s = 0; s < SHOP_SIZE - 1; s++) {
      const u = r(), src = u < up2 ? lucky(2) : u < up1 + up2 ? lucky(1) : null;
      if (src && take(src, false)) continue;
      take(recent, true);
    }
    const dreamOf = (ok) => ITEMS.filter((i) => !owned.has(i.id) && ok(i) && i.level > L && i.level <= L + 6 && !picks.includes(i)).sort((a, b) => b.price - a.price);
    const dream = dreamOf(inR);
    if (dream.length) picks.push(dream[Math.floor(r() * Math.ceil(dream.length / 3))]);    // bland den dyraste tredjedelen
    else take(recent, true);
    const ids = picks.map((i) => i.id);
    if (!shopRules.weaponFirst || !ids.length || profile.owned.some(isW) || ids.some((id) => isW(id) && BY_ID[id].level <= L)) return ids;
    const ws = ITEMS.filter((it) => it.slot === 'weapon' && it.level <= L && !owned.has(it.id)).sort((a, b) => a.price - b.price), wr = ws.filter(inR), use = wr.length ? wr : ws;
    if (use.length) ids[0] = use[String(day).charCodeAt(String(day).length - 1) % Math.min(2, use.length)].id;
    return ids;
  }

  // ---------- Världarnas butiker, balans v20: sorternas intåg (K.shop.fade och K.shop.kinds) ----------
  // Hyllan har nio platser som förut: åtta som nivån räcker till och ett drömföremål. Det som är nytt:
  //   1. En sort i taget: hyllan drar sorter (inte föremål) med vikten K.shop.weight efter hur länge sorten har funnits, och
  //      visar sortens nyaste material som nivån räcker till (inom sortens spann i världen, se kindSpan).
  //   2. setSlot: en plats visar en del ur ett bygge som barnet saknar (bygget med flest ägda delar, annars det första),
  //      den billigaste först. Den hamnar näst först på hyllan.
  //   3. perSlot: högst så många per plats på kroppen (berlocken högst en). cheap: minst så många kostar högst en fjärdedel
  //      av det dyraste; saknas de byts de sista vanliga platserna mot de billigaste som finns.
  //   4. Fynden (up1, up2) och vapenregeln som förut. Ett fynd är en sort som har nått världens tak.
  function worldShopV20(profile, day, k, W) {
    const r = rng(hash(profile.name + '|' + day + '|w' + k)), owned = new Set(profile.owned), L = profile.level;
    const up1 = shopRules.up1 || 0, up2 = shopRules.up2 || 0, reach = shopRules.reach == null ? 6 : shopRules.reach, top = MATS.length - 1;
    const wt = shopRules.weight || [1, 1, 1], perSlot = shopRules.perSlot || 99;
    const inSpan = (i) => { const sp = kindSpan(i.slot, i.type, k); return sp === 'fixed' || (!!sp && i.tier >= sp[0] && i.tier <= sp[1]); };
    // Sorterna som säljs här, med de föremål som går att köpa (inte ägda, nivån räcker), nyaste materialet först.
    // firstWeapon (förslag v21, av som förval): så länge hjälten inte äger något vapen visar hyllan inget som är billigare än
    // det billigaste vapnet som nivån räcker till, så att ett barn som alltid köper det billigaste köper ett vapen först.
    const fw = shopRules.firstWeapon && shopRules.weaponFirst && !profile.owned.some(isW);
    const minP = fw ? Math.min(Infinity, ...ITEMS.filter((i) => i.slot === 'weapon' && i.level <= L && !owned.has(i.id) && inSpan(i)).map((i) => i.price)) : 0;
    const kinds = [];
    for (const key in KIND) {
      const its = KIND[key].filter((i) => !owned.has(i.id) && inSpan(i) && i.level <= L && (minP === Infinity || i.price >= minP)).reverse(); if (!its.length) continue;
      const sp0 = kindSpan(its[0].slot, its[0].type, k), capT = Array.isArray(sp0) ? sp0[1] : its[0].tier;
      const over = its[0].tier < capT ? [] : KIND[key].filter((i) => !owned.has(i.id) && i.tier > capT && i.tier <= W.hi && i.level <= L + reach);      // sällsynta slag över sortens tak (v25), inom världens spann (över det gäller fynden up1, up2)
      const age = k - homeOf(its[0]);
      kinds.push({ key, slot: its[0].slot, its, over, w: age < 0 ? (shopRules.preview != null ? shopRules.preview : wt[Math.min(1, wt.length - 1)]) : wt[Math.min(wt.length - 1, age)] });
    }
    const picks = [], used = new Set(), per = {};
    const room = (slot) => (per[slot] || 0) < (slot === 'charm' ? 1 : perSlot);
    const put = (it) => { picks.push(it); used.add(it.slot + '.' + it.type); per[it.slot] = (per[it.slot] || 0) + 1; };
    // 2. byggets plats
    let setPick = null;
    if (shopRules.setSlot) {
      const have = setCounts(profile.owned.map((id) => BY_ID[id]).filter(Boolean));
      // flest ägda delar först; vid lika världens eget bygge, sedan det som hör hemma närmast bakåt i kartan (v21)
      const near = (b) => { const h = BUILDS[b].home || 0; return h <= k ? k - h : 10 + h - k; };
      const order = Object.keys(BUILDS).sort((a, b) => (have[b] || 0) - (have[a] || 0) || near(a) - near(b));
      for (const b of order) {
        const ownKinds = new Set(profile.owned.map((id) => BY_ID[id]).filter(Boolean).map((i) => i.slot + '.' + i.type));
        const miss = SET_SLOTS.map((sl) => sl + '.' + BUILDS[b].pieces[sl]).filter((key) => !ownKinds.has(key));
        const c = kinds.filter((x) => miss.includes(x.key)).map((x) => x.its[x.its.length - 1]).sort((a, b2) => a.price - b2.price);
        if (c.length) { setPick = c[0]; put(setPick); break; }
      }
    }
    // 1. sorterna, viktade. Ett fynd ersätter en vanlig plats med chansen up1 och up2.
    const lucky = (step) => { const t = W.hi + step; if (t > top) return []; const a = ITEMS.filter((i) => !owned.has(i.id) && i.tier === t && i.slot !== 'charm' && !used.has(i.slot + '.' + i.type) && i.level <= L + reach && (() => { const sp = kindSpan(i.slot, i.type, k); return Array.isArray(sp) && sp[1] >= W.hi; })()); const now = a.filter((i) => i.level <= L); return now.length ? now : a; };
    const draw = (spread) => {
      const left = kinds.filter((x) => !used.has(x.key) && (spread ? room(x.slot) : x.slot !== 'charm' || room('charm'))); if (!left.length) return false;
      let sum = 0; for (const x of left) sum += x.w; let u = r() * sum, x = left[left.length - 1];
      for (const y of left) { u -= y.w; if (u <= 0) { x = y; break; } }
      put(rollMat(x)); return true;
    };
    // Materialet för sorten (v25): oftast taket eller strax under (roll.at), ibland ett eller två steg över (roll.up).
    function rollMat(x) {
      const R2 = shopRules.roll; if (!R2) return x.its[0];
      const u = r(), up = R2.up || [0, 0];
      if (x.over && x.over.length && u < up[0] + up[1]) { const step = u < up[1] ? 2 : 1, want = x.its[0].tier + step; const c = x.over.filter((i) => i.tier <= want).sort((a, b) => b.tier - a.tier)[0]; if (c) return c; }
      const at = R2.at || [1], ws = x.its.slice(0, at.length).map((_, j) => at[j]); let s2 = 0; for (const w of ws) s2 += w; let v2 = r() * s2;
      for (let j = 0; j < ws.length; j++) { v2 -= ws[j]; if (v2 <= 0) return x.its[j]; } return x.its[0];
    }
    const sc = (SHOP_SIZE - 1) / Math.max(1, SHOP_SIZE - 1 - picks.length);    // byggets plats drar inget fynd: samma väntade antal fynd per hylla som förut
    while (picks.length < SHOP_SIZE - 1) {
      const u = r(), src = u < up2 * sc ? lucky(2) : u < (up1 + up2) * sc ? lucky(1) : null;
      const ok = src ? src.filter((i) => room(i.slot)) : null;
      if (ok && ok.length) { put(ok[Math.floor(r() * ok.length)]); continue; }
      if (!draw(true) && !draw(false)) break;
    }
    // 3. billiga saker
    const cheapN = fw ? 0 : shopRules.cheap || 0;
    if (cheapN && picks.length) {
      const cheapOk = () => { const mx = Math.max(...picks.map((i) => i.price)); return picks.filter((i) => i.price <= mx / 4).length; };
      const pool = kinds.filter((x) => !used.has(x.key)).map((x) => x.its[x.its.length - 1]).sort((a, b) => a.price - b.price);
      for (let j = picks.length - 1; j >= 0 && cheapOk() < cheapN && pool.length; j--) {
        const it = picks[j]; if (it === setPick || isLucky(k, it)) continue;
        const mx = Math.max(...picks.map((i) => i.price)); if (it.price <= mx / 4) continue;
        per[it.slot]--; const ci = pool.findIndex((c) => room(c.slot)); if (ci < 0) { per[it.slot]++; break; }
        const c = pool.splice(ci, 1)[0]; used.delete(it.slot + '.' + it.type); picks.splice(j, 1, c); used.add(c.slot + '.' + c.type); per[c.slot] = (per[c.slot] || 0) + 1;
      }
    }
    // byggets del näst först
    if (setPick && picks.length > 1) { picks.splice(picks.indexOf(setPick), 1); picks.splice(1, 0, setPick); }
    // drömföremålet: ur världens sorter, nivån räcker inte än, bland den dyraste tredjedelen
    const dream = ITEMS.filter((i) => !owned.has(i.id) && i.slot !== 'charm' && inSpan(i) && i.level > L && i.level <= L + 6 && !picks.includes(i)).sort((a, b) => b.price - a.price);
    if (dream.length) picks.push(dream[Math.floor(r() * Math.ceil(dream.length / 3))]);
    else draw(false);
    const ids = picks.map((i) => i.id);
    if (!shopRules.weaponFirst || !ids.length || profile.owned.some(isW) || ids.some((id) => isW(id) && BY_ID[id].level <= L)) return ids;
    const ws = ITEMS.filter((it) => it.slot === 'weapon' && it.level <= L && !owned.has(it.id)).sort((a, b) => a.price - b.price), wr = ws.filter(inSpan), use = wr.length ? wr : ws;
    if (use.length) ids[0] = use[String(day).charCodeAt(String(day).length - 1) % Math.min(2, use.length)].id;
    return ids;
  }

  // ---------- Nivåer och hjältens värden ----------
  const xpToLevel = (level) => Math.round(T.xpBase * Math.min(level, T.xpRamp) / T.xpRamp * Math.pow(T.xpGrowth, level - 1));
  // Hjältens värden: det mesta kommer från nivån (alltså från att spela), utrustningen lägger till en mindre del.
  // Summerar över SLOTS: en plats som katalogen inte känner (från en nyare klient) läses aldrig, och ett id som katalogen
  // inte känner (en ny sort i en gammal plats) hoppas över. Så går en äldre klient aldrig sönder på en nyare logg.
  function heroStats(profile) {
    const eq = profile.eq || {};
    const baseAtk = Math.round(T.heroAtk * Math.pow(T.heroGrowth, profile.level - 1)), baseHp = Math.round(T.heroHp * Math.pow(T.heroGrowth, profile.level - 1));
    let gearAtk = 0, gearHp = 0;
    for (const s of SLOTS) { const it = eq[s.id] ? BY_ID[eq[s.id]] : null; if (!it) continue; if (s.stat === 'atk') gearAtk += it.power; else if (s.stat === 'hp') gearHp += it.power; }
    return { atk: baseAtk + gearAtk, maxHp: baseHp + gearHp, baseAtk, baseHp, gearAtk, gearHp };
  }
  return { TUNE: T, MATS, RARITY, SLOTS, SHOP_SIZE, ITEMS, BY_ID, dailyShop, worldShop, shopRange, isLucky, typeWorld, kindSpan, xpToLevel, heroStats };
}

const C = makeCatalog();
export const ITEMS = C.ITEMS, BY_ID = C.BY_ID, dailyShop = C.dailyShop, worldShop = C.worldShop, shopRange = C.shopRange, isLucky = C.isLucky, typeWorld = C.typeWorld, kindSpan = C.kindSpan, xpToLevel = C.xpToLevel, heroStats = C.heroStats;

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
