// Hjälten och alla föremålstyper. Varje föremålstyp är EN ritfunktion som tar ett material (färgramp).
// Ny föremålstyp = ny funktion här + en rad i catalog.js, och den finns direkt i alla material.
import { ramp as R } from './pixel.js';

export const W = 80, H = 72;
const C = {
  leather: R('#8a5a34'), bone: R('#ece4cf'), dark: R('#2b2740'), white: R('#ffffff'), gold: R('#f2b632'),
  red: R('#d8433b'), wood: R('#9a6b3f'), steel: R('#aab6c4'), fire: R('#ff7a1f'), fire2: R('#ffd84a'),
  pants: R('#4a4e6a'), rag: R('#a08a64'), rag2: R('#7a6248'), rag3: R('#8a9a6a'), rope: R('#d8c08a'), blush: R('#ee8f8f'), shadow: R('#1d1b2e'), ice: R('#bff0ff'), purple: R('#9a6bff'),
};
const rnd = (n) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };
const acc = (it) => (it.mat === 'guld' ? C.red : C.gold);

// ---------- Vapen: ritas med greppet i origo och spetsen uppåt (negativt y) ----------
const shaft = (g, len, rp = C.wood) => g.poly([[-1.5, 5], [1.5, 5], [1.5, -len], [-1.5, -len]], rp, 3);
const WEAPON = {
  dagger(g, m) { g.poly([[-2, -3], [2, -3], [2, -10], [0, -14], [-2, -10]], m, 4); g.rect(-4, -4, 8, 2, C.gold, 3); g.rect(-1.5, -2, 3, 5, C.leather, 3); return 14; },
  club(g, m) { g.poly([[-1.5, 5], [1.5, 5], [4, -14], [3, -20], [-3, -20], [-4, -14]], C.wood, 3); for (const [x, y] of [[-4, -17], [4, -16], [-3, -12], [3, -11], [0, -21]]) g.rect(x - 1, y - 1, 2, 2, m, 5); return 20; },
  sword(g, m) { g.poly([[-2.5, -3], [2.5, -3], [2.5, -20], [0, -25], [-2.5, -20]], m, 4); g.poly([[-0.5, -5], [0.5, -5], [0.5, -20], [-0.5, -20]], m, 2); g.poly([[-6, -5], [6, -5], [6, -2.5], [-6, -2.5]], C.gold, 3); g.rect(-1.5, -2.5, 3, 6, C.leather, 3); g.ell(0, 4.5, 2, 2, C.gold); return 25; },
  axe(g, m) { shaft(g, 23); g.poly([[1, -23], [8, -27], [12, -20], [9, -12], [1, -15]], m, 4); g.poly([[-1, -22], [-5, -20], [-1, -17]], m, 3); g.rect(-2, -17, 4, 2, C.gold, 3); return 26; },
  spear(g, m) { shaft(g, 26); g.poly([[0, -36], [3.5, -28], [0, -24], [-3.5, -28]], m, 4); g.rect(-2, -25, 4, 2, C.gold, 3); return 36; },
  hammer(g, m) { shaft(g, 22); g.poly([[-8, -28], [8, -28], [8, -19], [-8, -19]], m, 3); g.rect(-8, -28, 3, 9, m, 5); g.rect(5, -28, 3, 9, m, 2); g.rect(-2, -19, 4, 2, C.gold, 3); return 28; },
  staff(g, m) { shaft(g, 24); g.poly([[-4, -24], [-1.5, -24], [-3, -29], [-5, -30]], C.wood, 3); g.poly([[4, -24], [1.5, -24], [3, -29], [5, -30]], C.wood, 3); g.ell(0, -29, 4, 4, m); g.dot(-2, -31, C.white, 5); return 31; },
  great(g, m) { g.poly([[-4, -4], [4, -4], [4.5, -27], [0, -34], [-4.5, -27]], m, 4); g.poly([[-1, -6], [1, -6], [1, -27], [-1, -27]], m, 2); g.poly([[-8, -6], [8, -6], [9, -3], [-9, -3]], C.gold, 3); g.rect(-1.5, -3, 3, 8, C.leather, 3); g.ell(0, 6, 2.4, 2.4, m); return 34; },
  bow(g, m) { g.thick(-1, -14, 4, -7, 2.2, m, 3); g.thick(4, -7, 5.5, 0, 2.2, m, 4); g.thick(5.5, 0, 4, 7, 2.2, m, 3); g.thick(4, 7, -1, 14, 2.2, m, 2); g.line(-1, -14, -1, 14, C.white, 4); g.rect(3, -2, 3, 4, C.leather, 3); return 14; },
  orb(g, m) { g.ell(0, -6, 3.2, 3.2, m); g.dot(-2, -8, C.white, 5); return 9; },
};
// Hur vapnet hålls i vila (vinkel i radianer, 0 = rakt upp, positivt = lutar framåt). Storsvärdet släpas i marken bakom hjälten.
export const HOLD = { dagger: 0.9, club: 0.55, sword: 0.42, axe: 0.35, spear: 0.2, hammer: 0.3, staff: 0.12, great: -2.08, bow: 0, orb: 0 };
export function drawWeapon(g, it) { const len = WEAPON[it.type](g, R(it.hex), it); g.anchor.tip = g.pt(0, -len + 3); }

// ---------- Sköldar ----------
const SHIELD = {
  round(g, it, m) { g.ell(0.5, 0.5, 7.5, 7.5, m, true); g.ell(0.5, 0.5, 7.5, 7.5, C.steel, false, (dx, dy, d2) => d2 > 0.66, 3); g.ell(0.5, 0.5, 2.3, 2.3, acc(it)); },
  kite(g, it, m) { g.poly([[-6, -8], [8, -8], [8, 1], [1, 10], [-6, 1]], m, 3); g.rect(0, -8, 2, 15, acc(it), 4); g.rect(-6, -4, 14, 2, acc(it), 4); },
  tower(g, it, m) { g.poly([[-6, -10], [8, -10], [8, 9], [1, 11], [-6, 9]], m, 3); g.rect(-6, -10, 14, 2, C.steel, 4); g.rect(-6, 5, 14, 2, C.steel, 2); g.ell(1, -1.5, 3, 3, acc(it)); },
};
export function drawShield(g, it, x, y) { g.begin(); g.push(x, y); SHIELD[it.type](g, it, R(it.hex)); g.pop(); g.end(); }

// ---------- Rygg: mantel, vingar, jetpack ----------
export const HOVER = { wings: 1, dragonwings: 1, jetpack: 1 };
const BACK = {
  cape(g, it, m, b, t) {
    const s = Math.round(Math.sin(t * 1.6) * 1.6);
    g.begin(); g.poly([[33, 37 + b], [43, 37 + b], [42, 55], [26 + s, 61], [21 + s, 53], [27, 43 + b]], m, 3);
    g.poly([[26 + s, 61], [21 + s, 53], [23 + s, 53], [28 + s, 59]], m, 5); g.rect(33, 36 + b, 10, 2, acc(it), 3); g.end();
  },
  wings(g, it, m, b, t) {
    g.begin(); g.push(34, 40 + b, Math.sin(t * 2.2) * 0.14);
    g.poly([[0, 2], [-5, -14], [-13, -22], [-24, -22], [-19, -15], [-25, -11], [-18, -7], [-22, -1], [-14, 0], [-15, 6], [-6, 6]], m, 4);
    g.poly([[-2, 1], [-6, -10], [-13, -16], [-12, -8], [-15, -3], [-9, -1], [-9, 3]], m, 2);
    g.pop(); g.end();
  },
  dragonwings(g, it, m, b, t) {
    g.begin(); g.push(34, 40 + b, Math.sin(t * 2.2) * 0.14);
    g.poly([[0, 2], [-4, -17], [-12, -23], [-25, -19], [-19, -12], [-25, -5], [-17, -4], [-19, 5], [-10, 2], [-6, 6]], m, 2);
    g.thick(0, 1, -4, -17, 2, m, 5); g.thick(-4, -17, -25, -19, 2, m, 5); g.thick(-4, -17, -24, -6, 1.4, m, 4); g.thick(-4, -17, -18, 4, 1.4, m, 4);
    g.poly([[-4, -17], [-3, -22], [-7, -19]], C.bone, 4);
    g.pop(); g.end();
  },
  jetpack(g, it, m, b, t) {
    g.begin();
    for (let i = 0; i < 9; i++) {        // lågor
      const ph = (t * 14 + i * 3.7) % 9, x = (i % 2 ? 25 : 29) + Math.round((rnd(i + Math.floor(t * 9)) - 0.5) * 2);
      g.rect(x, 53 + b + ph, ph < 3 ? 2 : 1, ph < 3 ? 2 : 1, ph < 3 ? C.fire2 : C.fire, ph < 5 ? 5 : 3);
    }
    g.end({ outline: false, edge: false });
    g.begin(); g.rect(23, 38 + b, 10, 13, m, 3); g.rect(24, 36 + b, 8, 2, m, 5); g.rect(25, 41 + b, 6, 3, C.dark, 1);
    g.dot(26, 42 + b, C.fire2, 5); g.dot(28, 42 + b, C.ice, 4); g.rect(24, 51 + b, 3, 2, C.steel, 2); g.rect(29, 51 + b, 3, 2, C.steel, 2); g.end();
  },
};
const BACK_CENTER = { cape: [32, 48], wings: [22, 36], dragonwings: [22, 34], jetpack: [28, 46] };

// ---------- Följeslagare ----------
const eye = (g, x, y) => { g.rect(x, y, 2, 2, C.dark, 0); g.dot(x, y, C.white, 5); };
const PET = {
  slime(g, m, t) { const q = Math.round(Math.abs(Math.sin(t * 3)) * 2); g.ell(0, 3 - q / 2, 7 + q / 2, 6 - q / 2, m); eye(g, -1, 1); eye(g, 3, 1); g.dot(-4, -1 - q / 2, C.white, 5); },
  bat(g, m, t) { const f = Math.sin(t * 9) * 4; g.poly([[-2, 0], [-11, -5 + f], [-9, 1], [-11, 4 - f / 2], [-3, 3]], m, 2); g.poly([[2, 0], [11, -5 + f], [9, 1], [11, 4 - f / 2], [3, 3]], m, 2); g.ell(0, 1, 4, 4.4, m); g.poly([[-3, -2], [-3, -6], [-1, -3]], m, 3); g.poly([[3, -2], [3, -6], [1, -3]], m, 3); eye(g, -2, 0); eye(g, 1, 0); },
  dragon(g, m, t) { const f = Math.sin(t * 7) * 3; g.poly([[-2, -1], [-8, -8 + f], [-10, -2 + f], [-4, 2]], m, 2); g.poly([[-5, 3], [-11, 6], [-6, 6]], m, 3); g.ell(0, 2, 5.5, 4.5, m); g.ell(5, -3, 4, 3.6, m); g.poly([[3, -6], [3, -10], [5, -6]], C.bone, 4); g.poly([[8, -1], [11, 0], [8, 1]], m, 4); eye(g, 5, -4); g.rect(-2, 4, 5, 2, C.fire2, 4); },
  drone(g, m, t) { const p = Math.floor(t * 12) % 2; g.rect(p ? -8 : -5, -6, p ? 6 : 3, 1, C.steel, 5); g.rect(p ? 3 : 3, -6, p ? 6 : 3, 1, C.steel, 5); g.rect(-1, -6, 2, 3, C.steel, 2); g.ell(0, 1, 7, 4.2, C.steel); g.ell(1.5, 1, 3, 2.6, m); g.dot(1, 0, C.white, 5); g.rect(-5, 5, 2, 2, C.dark, 1); g.rect(4, 5, 2, 2, C.dark, 1); },
  ghost(g, m, t) { g.ell(0, 0, 6, 7, m); g.poly([[-6, 0], [6, 0], [6, 8], [4, 6], [2, 8], [0, 6], [-2, 8], [-4, 6], [-6, 8]], m, 3); eye(g, -3, -2); eye(g, 2, -2); g.rect(-1, 2, 3, 2, C.dark, 0); },
};
const PET_GROUND = { slime: 1 };
export function drawPet(g, it, x, y, t) { g.begin(); g.push(x, y); PET[it.type](g, R(it.hex), t); g.pop(); g.end(); }

// ---------- Hjälmar och hattar (huvudets mitt: 39.5, Y+0.5) ----------
const HX = 39.5;
const dome = (g, Y, m, pred) => g.ell(HX, Y + 0.5, 11.9, 10.9, m, true, pred);
const horns = (g, Y) => { g.poly([[31, Y - 6], [25, Y - 8], [23, Y - 16], [27, Y - 11], [33, Y - 9]], C.bone, 3); g.poly([[47, Y - 7], [53, Y - 9], [55, Y - 17], [51, Y - 12], [45, Y - 9]], C.bone, 3); };
const HELM = {
  cap: { draw(g, it, m, Y) { dome(g, Y, m, (dx, dy) => dy < -0.32); g.rect(40, Y - 4, 13, 2, m, 2); g.rect(38, Y - 12, 3, 2, m, 5); } },
  helm: { draw(g, it, m, Y) { dome(g, Y, m, (dx, dy) => dy < -0.08 || (dx < -0.3 && dy < 0.72)); g.rect(45, Y - 2, 2, 6, m, 5); g.rect(29, Y - 2, 22, 1, m, 1); g.rect(38, Y - 13, 3, 3, acc(it), 4); } },
  horned: { draw(g, it, m, Y) { horns(g, Y); dome(g, Y, m, (dx, dy) => dy < -0.08 || (dx < -0.3 && dy < 0.72)); g.rect(45, Y - 2, 2, 6, m, 5); g.rect(29, Y - 2, 22, 1, m, 1); } },
  great: { hideHair: 1, draw(g, it, m, Y) {
    g.poly([[37, Y - 9], [33, Y - 19], [25, Y - 17], [22, Y - 9], [27, Y - 12], [33, Y - 10]], acc(it), 3);
    dome(g, Y, m, null); g.rect(39, Y, 12, 2, C.dark, 0); g.dot(42, Y, it.fx ? R(it.hex) : C.fire2, 5); g.dot(47, Y, it.fx ? R(it.hex) : C.fire2, 5);
    for (let x = 42; x <= 48; x += 2) g.dot(x, Y + 5, m, 1); g.rect(44, Y - 9, 2, 9, m, 5); } },
  wizard: { draw(g, it, m, Y) {
    g.poly([[30, Y - 5], [49, Y - 5], [45, Y - 13], [40, Y - 21], [33, Y - 25], [35, Y - 15]], m, 3);
    g.ell(HX, Y - 4.5, 15.5, 3.4, m, false, null, 2); g.rect(31, Y - 9, 17, 2, acc(it), 4);
    g.dot(41, Y - 14, C.fire2, 5); g.dot(40, Y - 15, C.fire2, 5); g.dot(42, Y - 15, C.fire2, 5); g.dot(41, Y - 16, C.fire2, 5); g.dot(41, Y - 15, C.white, 5); } },
  crown: { draw(g, it, m, Y) {
    g.rect(31, Y - 12, 18, 4, m, 3);
    for (const x of [31, 38, 45]) g.poly([[x, Y - 12], [x + 2, Y - 17], [x + 4, Y - 12]], m, 4);
    g.dot(33, Y - 10, C.red, 4); g.dot(40, Y - 10, C.ice, 4); g.dot(47, Y - 10, C.red, 4); g.dot(40, Y - 18, C.white, 5); } },
  hood: { hideHair: 1, draw(g, it, m, Y) { g.poly([[30, Y - 6], [24, Y - 3], [27, Y + 6]], m, 2); g.ell(HX, Y + 0.5, 12.6, 11.6, m, true, (dx, dy) => !(dx > -0.12 && dy > -0.42 && dy < 0.78)); } },
  phones: { draw(g, it, m, Y) { g.ell(HX, Y + 0.5, 12.6, 11.6, m, false, (dx, dy, d2) => d2 > 0.78 && dy < -0.25 && dx < 0.55, 4); g.ell(31.5, Y + 2, 3.6, 4.8, m); g.ell(31.5, Y + 2, 1.6, 2.6, C.dark, false, null, 1); } },
};

// ---------- Rustning: överkropp och ben ----------
function drawLegs(g, armor, ar, skin) {
  const type = armor ? armor.type : 'rags';
  if (type === 'robe') return;
  g.begin();
  if (type === 'rags') {      // trasiga byxor och bara fötter: så börjar alla
    g.rect(33, 49, 5, 6, C.rag2, 2); g.rect(40, 49, 5, 5, C.rag2, 3); g.rect(33, 55, 2, 2, C.rag2, 2); g.rect(36, 55, 1, 1, C.rag2, 2); g.rect(41, 54, 2, 2, C.rag2, 3); g.rect(44, 54, 1, 1, C.rag2, 3);
    g.rect(34, 55, 3, 4, skin, 2); g.rect(41, 54, 3, 5, skin, 3); g.rect(33, 58, 6, 3, skin, 2); g.rect(40, 58, 7, 3, skin, 3);
    g.end(); return;
  }
  const metal = type === 'plate' || type === 'chain', pants = metal ? ar : C.pants, boot = type === 'plate' ? ar : C.leather;
  g.rect(33, 49, 5, 8, pants, 2); g.rect(40, 49, 5, 8, pants, 3);
  g.rect(32, 56, 7, 5, boot, 2); g.rect(39, 56, 8, 5, boot, 3);
  if (type === 'plate') { g.rect(33, 52, 5, 2, ar, 5); g.rect(40, 52, 5, 2, ar, 5); }
  g.end();
}
function drawTorso(g, armor, ar, b) {
  const y = 36 + b, type = armor ? armor.type : 'rags', a = armor ? acc(armor) : C.gold;
  g.begin();
  if (type === 'rags') {      // säckväv med lappar, rep om magen och fransig nederkant
    g.rect(32, y, 13, 12 - b, C.rag, 3); for (let x = 32; x < 45; x += 2) g.rect(x, 48, 1, 2 + (x % 4 === 0 ? 1 : 0), C.rag, 2);
    g.rect(34, y + 3, 4, 4, C.rag2, 2); g.dot(34, y + 3, C.rag, 5); g.dot(37, y + 6, C.rag, 5); g.rect(41, y + 7, 3, 3, C.rag3, 3);
    g.rect(32, 45, 13, 1, C.rope, 4); g.rect(39, 46, 1, 3, C.rope, 4);
    g.end(); return;
  }
  if (type === 'robe') {
    g.poly([[31, y], [46, y], [50, 61], [28, 61]], ar, 3); g.rect(37, y, 3, 25 - b, a, 4); g.rect(28, 59, 22, 2, a, 3);
    g.rect(31, 46, 15, 2, C.leather, 2);
  } else {
    g.rect(31, y, 15, 14 - b, ar, 3);
    if (type === 'shirt' || type === 'tunic') { g.rect(36, y, 5, 2, ar, 5); g.rect(31, 46, 15, 2, C.leather, 3); g.rect(38, 46, 2, 2, C.gold, 4); if (type === 'tunic') g.rect(31, 48, 15, 2, ar, 2); }
    if (type === 'chain') { for (let yy = y; yy < 47; yy++) for (let xx = 31; xx < 46; xx++) if ((xx + yy) % 2) g.dot(xx, yy, ar, 1); g.rect(31, 46, 15, 2, C.leather, 3); g.rect(31, y, 15, 2, ar, 5); }
    if (type === 'plate') {
      g.ell(38.5, y + 6, 8, 7.5, ar, true); g.rect(31, 47, 15, 3, ar, 2); g.rect(31, 47, 15, 1, ar, 1);
      g.ell(31.5, y + 1.5, 4.4, 3.4, ar); g.ell(45.5, y + 1.5, 4.4, 3.4, ar); g.rect(37, y + 4, 3, 3, a, 4); g.dot(37, y + 4, C.white, 5);
    }
  }
  g.end();
}

// ---------- Huvud och frisyrer ----------
// Huvudet: mitt i (39.5, Y+0.5), 11 brett och 10 högt, ansiktet åt höger. En frisyr har en del bakom huvudet (back)
// och en del ovanpå (front). tall = sticker upp ovanför huvudet, och byts mot en enkel kalufs under hjälm.
const capS = (dx, dy) => dy < -0.42 - dx * 0.12 || (dx < -0.52 && dy < 0.32);
const cap = (g, Y, h, pred = capS) => g.ell(HX, Y + 0.5, 11.9, 10.9, h, true, pred);
const stubble = (g, Y, h) => g.ell(HX, Y + 0.5, 11.3, 10.4, h, false, (dx, dy) => dy < -0.5 - dx * 0.1 || (dx < -0.62 && dy < 0.12), 2);
export const HAIR_STYLES = {
  short: { name: 'Short', front(g, Y, h) { cap(g, Y, h); g.poly([[40, Y - 9], [48, Y - 9], [52, Y - 4], [48, Y - 5], [44, Y - 6]], h, 4); } },
  quiff: { name: 'Quiff', tall: 1, front(g, Y, h) { cap(g, Y, h); g.poly([[36, Y - 9], [40, Y - 15], [47, Y - 17], [53, Y - 13], [52, Y - 6], [47, Y - 8], [41, Y - 8]], h, 4); g.poly([[42, Y - 13], [48, Y - 15], [51, Y - 12], [46, Y - 12]], h, 5); } },
  sidepart: { name: 'Side part', front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.36 || (dx < -0.5 && dy < 0.35)); g.poly([[35, Y - 10], [47, Y - 11], [52, Y - 5], [52, Y - 1], [48, Y - 3], [43, Y - 6], [36, Y - 7]], h, 4); g.rect(35, Y - 10, 1, 4, h, 1); } },
  buzz: { name: 'Buzz cut', front(g, Y, h) { stubble(g, Y, h); } },
  undercut: { name: 'Undercut', tall: 1, front(g, Y, h) { stubble(g, Y, h); g.poly([[32, Y - 9], [36, Y - 13], [46, Y - 15], [52, Y - 12], [52, Y - 6], [46, Y - 9], [34, Y - 7]], h, 4); g.poly([[40, Y - 13], [47, Y - 14], [50, Y - 11], [44, Y - 11]], h, 5); } },
  mullet: { name: 'Mullet', back(g, Y, h) { g.poly([[28, Y - 1], [35, Y - 1], [36, Y + 11], [32, Y + 14], [27, Y + 16], [23, Y + 15], [26, Y + 11], [25, Y + 5]], h, 2); },
    front(g, Y, h) { cap(g, Y, h); for (const [x, tx] of [[40, 43], [44, 48], [47, 52]]) g.poly([[x, Y - 8], [tx, Y - 12], [x + 4, Y - 7]], h, 4); } },
  manbun: { name: 'Man bun', tall: 1, back(g, Y, h) { g.ell(31, Y - 11, 4.4, 4.2, h, true); },
    front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.46 - dx * 0.1 || (dx < -0.5 && dy < 0.42)); g.rect(32, Y - 8, 3, 1, C.dark, 1); } },
  ponytail: { name: 'Ponytail', back(g, Y, h) { g.poly([[30, Y - 5], [25, Y - 7], [20, Y - 2], [18, Y + 7], [21, Y + 13], [24, Y + 6], [27, Y + 1]], h, 3); },
    front(g, Y, h) { cap(g, Y, h); g.poly([[41, Y - 9], [49, Y - 9], [52, Y - 4], [47, Y - 6]], h, 4); g.rect(27, Y - 5, 2, 3, C.red, 3); } },
  long: { name: 'Long', back(g, Y, h) { g.poly([[27, Y - 2], [35, Y - 2], [36, Y + 14], [31, Y + 16], [26, Y + 15], [25, Y + 8]], h, 2); },
    front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.4 - dx * 0.1 || (dx < -0.4 && dy < 0.9)); g.poly([[39, Y - 9], [48, Y - 9], [52, Y - 2], [49, Y - 3], [45, Y - 6]], h, 4); } },
  bob: { name: 'Bob', back(g, Y, h) { g.poly([[27, Y - 2], [36, Y - 2], [36, Y + 9], [28, Y + 10]], h, 2); },
    front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.34 || (dx < -0.36 && dy < 0.86)); g.rect(37, Y - 5, 14, 2, h, 3); g.rect(37, Y - 6, 14, 1, h, 4); } },
  curly: { name: 'Curly', tall: 1, back(g, Y, h) { for (const a of [150, 172]) g.ell(HX + Math.cos(a * Math.PI / 180) * 10.5, Y + Math.sin(a * Math.PI / 180) * 9.5, 4, 4, h, true); },
    front(g, Y, h) { g.ell(HX - 1, Y - 5, 9.5, 6, h, true); for (let a = 195; a <= 345; a += 25) g.ell(HX + Math.cos(a * Math.PI / 180) * 10.5, Y - 1 + Math.sin(a * Math.PI / 180) * 9.5, 4.3, 4.3, h, true); } },
  mohawk: { name: 'Mohawk', tall: 1, front(g, Y, h) { stubble(g, Y, h); g.poly([[31, Y - 8], [30, Y - 13], [34, Y - 11], [35, Y - 17], [39, Y - 13], [41, Y - 20], [44, Y - 14], [47, Y - 18], [49, Y - 12], [52, Y - 13], [50, Y - 7], [44, Y - 9], [36, Y - 9]], h, 3); } },
  spiky: { name: 'Spiky', tall: 1, front(g, Y, h) { cap(g, Y, h); for (const [x, tx, ty] of [[31, 29, 9], [36, 37, 8], [41, 44, 8], [45, 50, 11]]) g.poly([[x, Y - 8], [tx, Y - 6 - ty], [x + 5, Y - 8]], h, 4); } },
  braid: { name: 'Braid', back(g, Y, h) { g.ell(27, Y + 3, 3.2, 3.2, h); g.ell(25.5, Y + 8, 2.8, 2.8, h); g.ell(24.5, Y + 13, 2.4, 2.4, h); g.rect(23, Y + 15, 3, 2, C.red, 3); },
    front(g, Y, h) { cap(g, Y, h); g.poly([[40, Y - 9], [49, Y - 9], [52, Y - 3], [48, Y - 5]], h, 4); } },
  bowl: { name: 'Bowl', front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.12 || (dx < -0.42 && dy < 0.5)); } },
};
function drawHead(g, look, b, blink, hideHair, helmet) {
  const skin = R(look.skin), hair = R(look.hair), Y = 26 + b, st = HAIR_STYLES[look.style] || HAIR_STYLES.short;
  g.begin();
  if (!hideHair && st.back) st.back(g, Y, hair);
  g.ell(HX, Y + 0.5, 11, 10, skin, 0.75);
  if (!hideHair) { if (helmet && st.tall) cap(g, Y, hair); else st.front(g, Y, hair); }
  if (blink) { g.rect(42, Y + 1, 2, 1, skin, 1); g.rect(47, Y + 1, 2, 1, skin, 1); }
  else { g.rect(42, Y, 2, 3, C.dark, 0); g.rect(47, Y, 2, 3, C.dark, 0); g.dot(42, Y, C.white, 5); g.dot(47, Y, C.white, 5); }
  g.rect(44, Y + 5, 3, 1, skin, 1); g.dot(47, Y + 4, skin, 1);
  g.dot(40, Y + 4, C.blush, 3); g.dot(41, Y + 4, C.blush, 3); g.dot(49, Y + 4, C.blush, 3);
  g.end();
}

// ---------- Hela hjälten ----------
// gear: { weapon, helmet, armor, shield, back, pet } där varje är ett föremål ur katalogen (eller saknas)
// a: { t: sekunder, blink: bool, swing: radianer }
export function drawHero(g, look, gear, a = {}) {
  const t = a.t || 0, b = Math.sin(t * 2.6) > 0.3 ? 1 : 0;
  const hover = gear.back && HOVER[gear.back.type] ? 4 + Math.round(Math.sin(t * 2.2) * 1.5) : 0;
  const ar = gear.armor ? R(gear.armor.hex) : R(look.skin);   // utan rustning: bara armar
  if (!a.noShadow) { g.begin(); g.ell(38.5, 62.5, 13 - hover, 2.6, C.shadow, false, null, 1); g.end({ outline: false, edge: false }); }   // markskugga
  if (gear.pet && !a.noPet) drawPet(g, gear.pet, 11, PET_GROUND[gear.pet.type] ? 55 : 24 + Math.round(Math.sin(t * 2) * 2), t);
  g.push(0, -hover);
  if (gear.back) BACK[gear.back.type](g, gear.back, R(gear.back.hex), b, t);
  const hd = a.hand || [0, 0], hx = 50 + hd[0], hy = 45 + b + hd[1];   // bortre handen håller vapnet (a.hand flyttar den under attacker)
  g.begin(); g.thick(44, 39 + b, hx, hy, 4.4, ar, 2); g.end();
  g.anchor.hand = g.pt(hx + 0.5, hy + 0.5);
  if (gear.weapon) { g.begin(); g.push(hx + 0.5, hy + 0.5, a.wAng !== undefined ? a.wAng : HOLD[gear.weapon.type] + (a.swing || 0)); drawWeapon(g, gear.weapon); g.pop(); g.end(); }
  g.begin(); g.ell(hx + 0.5, hy + 0.5, 2.4, 2.4, R(look.skin), 0.75); g.end();
  drawLegs(g, gear.armor, ar, R(look.skin));
  drawTorso(g, gear.armor, ar, b);
  const hm = gear.helmet ? HELM[gear.helmet.type] : null;
  drawHead(g, look, b, a.blink, hm && hm.hideHair, !!hm);
  if (hm) { g.begin(); hm.draw(g, gear.helmet, R(gear.helmet.hex), 26 + b); g.end(); }
  g.begin(); g.thick(32.5, 39 + b, 30.5, 46 + b, 4.4, ar, 3); g.ell(30.5, 47.5 + b, 2.4, 2.4, R(look.skin), 0.75); g.end();   // närmaste armen
  if (gear.shield) drawShield(g, gear.shield, 27, 45 + b);
  // Gnistor från magiska material
  const w = gear.weapon;
  if (w && w.fx && g.anchor.tip && !a.noFx) {
    const [tx, ty] = g.anchor.tip, col = { fire: [C.fire2, C.fire], ice: [C.white, C.ice], shadow: [C.purple, C.dark], spark: [C.white, C.fire2] }[w.fx];
    g.begin();
    for (let i = 0; i < 6; i++) {
      const seed = i * 17 + Math.floor(t * 5 + i * 0.37), life = (t * 5 + i * 0.37) % 1;
      const x = Math.round(tx + (rnd(seed) - 0.5) * 12), y = Math.round(ty + (rnd(seed + 5) - 0.5) * 12 - life * (w.fx === 'fire' ? 7 : 2));
      g.set(x, y, col[i % 2], life < 0.5 ? 5 : 3); if (life < 0.3) { g.set(x + 1, y, col[i % 2], 4); g.set(x, y + 1, col[i % 2], 4); g.set(x - 1, y, col[i % 2], 4); g.set(x, y - 1, col[i % 2], 4); }
    }
    g.end({ outline: false, edge: false });
  }
  g.pop();
}

// ---------- Ikon (32x32) för ett föremål, ritad med samma funktioner som på gubben ----------
export function drawIcon(g, it, t = 0) {
  if (it.slot === 'weapon') { const long = { great: 1, spear: 1, staff: 1, hammer: 1, axe: 1 }[it.type], mid = { bow: 1, orb: 1 }[it.type]; g.begin(); if (mid) g.push(14, it.type === 'orb' ? 24 : 16, 0, it.type === 'orb' ? 2.4 : 1.05); else g.push(8.5, 25.5, 0.78, long ? 0.74 : 1); drawWeapon(g, it); g.pop(); g.end(); }
  if (it.slot === 'shield') { g.push(15, 15, 0, 1.45); drawShield(g, it, 0, 0); g.pop(); }
  if (it.slot === 'pet') { g.push(16, 16, 0, 1.35); drawPet(g, it, 0, 0, 0.4); g.pop(); }
  if (it.slot === 'back') { const [cx, cy] = BACK_CENTER[it.type]; g.push(16, 16, 0, it.type === 'jetpack' ? 1.3 : 0.95); g.push(-cx, -cy); BACK[it.type](g, it, R(it.hex), 0, 0.3); g.pop(); g.pop(); }
  if (it.slot === 'armor') { g.push(16, 15, 0, 1); g.push(-38.5, -48); const ar = R(it.hex); g.begin(); g.thick(44, 39, 48, 46, 4.4, ar, 2); g.end(); drawLegs(g, it, ar, ar); drawTorso(g, it, ar, 0); g.begin(); g.thick(32.5, 39, 30, 46, 4.4, ar, 3); g.end(); g.pop(); g.pop(); }
  if (it.slot === 'helmet') {
    const tall = { wizard: 1, horned: 1, great: 1, crown: 1 }[it.type];
    g.push(16, tall ? 21 : 17, 0, tall ? 0.8 : 1); g.push(-39.5, -26.5);
    g.begin(); g.ell(HX, 26.5, 11, 10, R('#565a78'), true); g.end();
    g.begin(); HELM[it.type].draw(g, it, R(it.hex), 26); g.end(); g.pop(); g.pop();
  }
}
