// Hjälten och alla föremålstyper, version 2 (prototyp). Samma exporter och anrop som game/hero.js,
// så filen kan kopieras över den (byt då importen nedan till './pixel.js').
// Varje föremålstyp är EN ritfunktion som tar ett material. Nytt i v2: materialet styr mer än färgen
// (se MAT: beslag, ädelsten, tyg och ett särdrag som trä-lindning, stålglans, isflisor, glöd, rök, fasetter).
import { ramp as R } from './pixel.js';
import { setCounts, BUILDS } from './catalog.js';

export const W = 80, H = 72;
// Val som föräldern kan pröva i arket. tall = längre kropp, brow = bestämd blick, wscale = vapnens storlek.
// grand = storlek och prakt efter material (v3), aura = auran från Steel och uppåt (v3). false = som före v3.
export const OPT = { tall: true, brow: true, wscale: 1.15, grand: true, aura: true };
const C = {
  leather: R('#8a5a34'), bone: R('#ece4cf'), dark: R('#2b2740'), white: R('#ffffff'), gold: R('#f2b632'),
  red: R('#d8433b'), wood: R('#9a6b3f'), steel: R('#aab6c4'), fire: R('#ff7a1f'), fire2: R('#ffd84a'),
  pants: R('#4a4e6a'), rag: R('#5b8c8a'), rag2: R('#5d5a6e'), rag3: R('#c9b07a'), rope: R('#d8c08a'), blush: R('#ee8f8f'),
  shadow: R('#1d1b2e'), ice: R('#bff0ff'), purple: R('#9a6bff'), iron: R('#6b7384'), blue: R('#3f74e0'),
  night: R('#3b3f9c'), wine: R('#8a2f45'), silver: R('#e4ecf4'), soot: R('#5b4a5e'), lilac: R('#a79fd0'), magenta: R('#c2409a'),
};
const rnd = (n) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };
const rd = Math.round;

// Materialens särdrag. trim = beslag, gem = ädelsten och emblem, cloth = tyg (halsduk, plym, vimpel).
const MAT = {
  tra: { trim: C.leather, gem: C.bone, cloth: C.red, grip: C.rope, rough: 1 },
  jarn: { trim: C.iron, gem: C.steel, cloth: C.red },
  stal: { trim: C.gold, gem: C.blue, cloth: C.blue, shine: 1 },
  guld: { trim: C.bone, gem: C.red, cloth: C.red, grip: C.wine, ornate: 1 },
  smaragd: { trim: C.gold, gem: C.white, cloth: C.bone, gems: 1 },
  is: { trim: C.silver, gem: C.white, cloth: C.ice, grip: C.blue, jag: 1 },
  eld: { trim: C.soot, gem: C.fire2, cloth: C.fire2, pole: C.dark, ember: 1 },
  skugg: { trim: C.lilac, gem: C.purple, cloth: C.magenta, pole: C.dark, grip: C.purple, smoke: 1 },
  kristall: { trim: C.silver, gem: C.ice, cloth: C.white, facet: 1 },
  stjarn: { trim: C.gold, gem: C.white, cloth: C.night, radiant: 1 },
};
const PLAIN = { trim: C.gold, gem: C.red, cloth: C.red };
const mat = (it) => MAT[it.mat] || PLAIN;

// ---------- Storlek och prakt efter material (utrustning v3, 2026-11-16) ----------
// Storleken och prakten hör till FÖREMÅLET, efter dess material, aldrig till världen eller hjältens nivå: ett ägt föremål
// ser alltid likadant ut. Trä är minst och enklast (men handgjort: målade ränder, en knuten fjäder), varje material ett
// steg större och praktfullare, Star störst. 1 = storleken före v3. OPT.grand = false ritar allt som före v3 (granskningssidan).
const TIER = { tra: 0, jarn: 1, stal: 2, guld: 3, smaragd: 4, is: 5, eld: 6, skugg: 7, kristall: 8, stjarn: 9 };
export const tierOf = (it) => (it && TIER[it.mat] != null ? TIER[it.mat] : 4);
export const GRAND = {
  weapon: [0.74, 0.8, 0.86, 0.91, 0.96, 1, 1.04, 1.07, 1.1, 1.13],      // vapnets längd (hela vapnet skalas)
  guard: [0.9, 0.95, 1, 1.06, 1.12, 1.18, 1.24, 1.3, 1.36, 1.42],       // parerstångens bredd, utöver skalan
  shield: [0.76, 0.82, 0.88, 0.93, 0.98, 1.02, 1.06, 1.09, 1.12, 1.15],
  crest: [0.55, 0.65, 0.75, 0.85, 0.95, 1.03, 1.1, 1.16, 1.22, 1.28],   // plym, kam, horn och kronans spetsar
  wings: [0.6, 0.66, 0.72, 0.78, 0.84, 0.89, 0.94, 0.98, 1.02, 1.06],   // vingar och drakvingar (spann)
  cape: [0.66, 0.72, 0.78, 0.83, 0.88, 0.92, 0.95, 0.98, 1, 1.02],      // mantelns längd och bredd
  flutter: [0.35, 0.5, 0.65, 0.8, 0.95, 1.1, 1.25, 1.4, 1.5, 1.65],     // hur mycket manteln fladdrar
  jet: [0.82, 0.86, 0.9, 0.93, 0.96, 0.99, 1.01, 1.03, 1.05, 1.07],     // jetpackens tankar
  flame: [0.45, 0.58, 0.7, 0.82, 0.92, 1, 1.08, 1.16, 1.24, 1.32],       // jetpackens lågor
  pet: [0.8, 0.83, 0.86, 0.89, 0.92, 0.95, 0.98, 1.01, 1.04, 1.07],
};
// Auran från Steel och uppåt: glimtar i materialets färg två pixlar utanför konturen, tätare för varje steg (0 = ingen).
// Vapnen får hela värdet, sköldar, ryggsaker och följeslagare en antydan (HINT).
export const AURA = [0, 0, 1, 2, 3, 4, 4, 5, 6, 7];
const HINT = [0, 0, 1, 1, 2, 2, 2, 3, 3, 4];
const gr = (tbl, it) => (OPT.grand === false ? 1 : tbl[tierOf(it)]);
const tierG = (it) => (OPT.grand === false ? -1 : tierOf(it));          // -1 = inga v3-detaljer
// Skalar kring punkten (cx, cy) i nuvarande koordinater.
const pushAt = (g, cx, cy, k) => g.push(cx * (1 - k), cy * (1 - k), 0, k);

let AU = 0;                // aurans styrka för delen som ritas just nu (sätts av drawHero, drawShield, drawPet, drawIcon)
const HB = [];             // aurans pixlar, återanvänds
// Avslutar en del som g.end() och tänder sedan auran: pixlar två steg ut (konturen ligger ett steg ut) i ett mönster som
// vandrar med tiden. Ritas bara där bilden är tom, så allt som ritas senare (kropp, huvud) hamnar ovanpå.
function auraEnd(g, rp, n, o) {
  if (!n || OPT.aura === false || g.bx1 < 0) return g.end(o);
  const { w, h, r } = g, x0 = Math.max(0, g.bx0 - 2), x1 = Math.min(w - 1, g.bx1 + 2), y0 = Math.max(0, g.by0 - 2), y1 = Math.min(h - 1, g.by1 + 2);
  const f = (x, y) => x >= 0 && y >= 0 && x < w && y < h && r[y * w + x] >= 0, ph = Math.floor(T * 9);
  HB.length = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (r[y * w + x] >= 0 || f(x - 1, y) || f(x + 1, y) || f(x, y - 1) || f(x, y + 1)) continue;           // delen själv och konturen
    if (!(f(x - 2, y) || f(x + 2, y) || f(x, y - 2) || f(x, y + 2) || f(x - 1, y - 1) || f(x + 1, y - 1) || f(x - 1, y + 1) || f(x + 1, y + 1))) continue;
    const q = (x * 2 + y * 3 + ph) % 14, s = (x + y + ph) % 4;
    const lv = n === 1 ? (q === 0 ? 4 : 0) : n === 2 ? (q % 7 === 0 ? 5 : 0) : n === 3 ? (q % 5 === 0 ? 5 : q % 5 === 2 ? 3 : 0)
      : n === 4 ? (s === 0 ? 5 : s === 2 ? 3 : 0) : n === 5 ? (s === 3 ? 0 : s === 0 ? 5 : 3) : n === 6 ? (s === 0 ? 5 : s === 2 ? 4 : 3) : (s % 2 ? 5 : 4);
    if (lv) HB.push(y * w + x, lv);
  }
  g.end(o);
  for (let j = 0; j < HB.length; j += 2) if (g.R[HB[j]] < 0) { g.R[HB[j]] = rp; g.L[HB[j]] = HB[j + 1]; }
}

let T = 0;                 // aktuell tid, sätts av drawHero, drawPet och drawIcon så att delar kan röra sig
let SH = 33, HIP = 47;     // axelhöjd och höft (ändras av OPT.tall)
// a.build -1, 0, 1, 2: [axelbredd per sida, överarmens extra tjocklek, underarmens extra tjocklek]. 0 = som utan build.
const BUILD = { '-1': [-1.5, -1, -0.6], 0: [0, 0, 0], 1: [1.5, 1.4, 0.6], 2: [3, 2.6, 1.2] };
const bw = (bd) => (BUILD[bd] || BUILD[0])[0];
const setBody = () => { SH = OPT.tall ? 33 : 36; HIP = OPT.tall ? 47 : 49; };

// Litet materialmärke (ungefär 5 pixlar) som sätts på hjälmar, sköldar, rustning och vapenhuvuden.
function flair(g, s, m, x, y) {
  if (s.rough) { g.rect(x - 2, y - 1, 4, 3, C.bone, 3); g.dot(x - 1, y - 1, C.dark, 1); g.dot(x + 1, y + 1, C.dark, 1); }        // lapp med stygn
  else if (s.shine) { g.rect(x - 1, y - 2, 1, 4, m, 5); g.dot(x - 1, y - 2, C.white, 5); g.dot(x + 1, y, m, 5); }                 // blänk
  else if (s.ornate) { g.ell(x + 0.5, y + 0.5, 1.7, 1.7, C.red); g.dot(x - 2, y, s.trim, 5); g.dot(x + 2, y, s.trim, 5); g.dot(x, y - 2, s.trim, 5); g.dot(x, y + 2, s.trim, 5); }
  else if (s.gems) { g.poly([[x + 0.5, y - 2.5], [x + 3, y + 0.5], [x + 0.5, y + 3.5], [x - 2, y + 0.5]], m, 5); g.dot(x, y, C.white, 5); }
  else if (s.jag) { g.poly([[x - 2, y + 1], [x - 0.5, y - 4], [x + 1, y + 1]], C.ice, 5); g.poly([[x + 1, y + 1], [x + 2.5, y - 2], [x + 4, y + 1]], C.ice, 4); }
  else if (s.ember) { const k = Math.floor(T * 7) % 2; g.poly([[x - 2, y + 2], [x - 1 + k, y - 3], [x + 0.5, y], [x + 2 - k, y - 2], [x + 3, y + 2]], C.fire, 4); g.rect(x, y, 1, 2, C.fire2, 5); }
  else if (s.smoke) { g.ell(x + 0.5, y + 0.5, 2, 2, C.dark, false, null, 1); g.dot(x, y, C.purple, 5); }                          // ett lila öga
  else if (s.facet) { g.poly([[x + 0.5, y - 3], [x - 1.5, y + 0.5], [x + 0.5, y + 4]], C.white, 5); g.poly([[x + 0.5, y - 3], [x + 2.5, y + 0.5], [x + 0.5, y + 4]], m, 4); }
  else if (s.radiant) { const k = Math.floor(T * 3) % 2 ? 2 : 1; g.rect(x - k, y, k * 2 + 1, 1, C.white, 5); g.rect(x, y - k, 1, k * 2 + 1, C.white, 5); }
  else { g.dot(x, y, m, 5); g.dot(x + 1, y + 1, m, 1); }                                                                          // nit
}

// ---------- Vapen: ritas med greppet i origo och spetsen uppåt (negativt y) ----------
// Tvåtonad klinga: ljus halva åt vänster, mörk åt höger (ljuset kommer uppifrån vänster).
const half = (g, m, hw, y0, yS, yT, l = 4, d = 2) => {
  g.poly([[-hw, y0], [0, y0], [0, yT], [-hw, yS]], m, l);
  g.poly([[0, y0], [hw, y0], [hw, yS], [0, yT]], m, d);
};
// Det som skiljer materialen åt på en klinga.
function bladeFx(g, s, m, hw, y0, yS, yT) {
  const n = y0 - yS;
  if (s.rough) { g.rect(-hw, y0 - n * 0.5, hw * 2, 2, C.bone, 4); g.dot(-hw, y0 - n * 0.78, m, 1); g.dot(hw - 1, y0 - n * 0.25, m, 1); for (let y = y0 - 3; y > yS; y -= 4) g.dot(-1, y, m, 2); }
  else if (s.shine) { g.rect(-hw + 1, yS + 1, 1, n * 0.55, m, 5); g.rect(1, y0 - n * 0.5, 1, n * 0.3, m, 4); g.dot(-1, yT + 3, C.white, 5); g.dot(-hw + 1, yS + 1, C.white, 5); }
  else if (s.ornate) { g.rect(-0.5, yS + 1, 1, n - 5, m, 1); for (let y = y0 - 7; y > yS; y -= 4) g.dot(-0.5, y, m, 5); g.ell(0, y0 - 3, 1.7, 1.7, C.red); }
  else if (s.gems) for (const k of [0.25, 0.62]) { const y = y0 - n * k; g.poly([[0, y - 3], [2.2, y], [0, y + 3], [-2.2, y]], m, 5); g.dot(-0.5, y - 0.5, C.white, 5); }
  else if (s.jag) {
    for (let y = y0 - 3; y > yS + 2; y -= 6) { g.poly([[hw - 0.5, y], [hw + 2.6, y - 3], [hw - 0.5, y - 4]], m, 4); g.poly([[-hw + 0.5, y - 3], [-hw - 2.6, y - 6], [-hw + 0.5, y - 7]], m, 5); }
    g.dot(-0.5, yT + 1, C.white, 5); g.dot(-hw + 1, y0 - n * 0.4, C.white, 5); g.dot(-1, y0 - n * 0.75, C.white, 5);
  } else if (s.ember) {
    g.poly([[-hw + 0.8, y0], [hw - 0.8, y0], [hw - 1.2, y0 - n * 0.3], [0, y0 - n * 0.62], [-hw + 1.2, y0 - n * 0.3]], C.fire2, 4);
    g.rect(-0.5, y0 - n * 0.34, 1, n * 0.3, C.white, 5);
    const k = Math.floor(T * 6) % 3; g.dot(-1 + k, y0 - n * 0.66 - k * 2, C.fire2, 5);
  } else if (s.smoke) { g.poly([[-hw * 0.4, y0], [hw * 0.4, y0], [hw * 0.4, yS + 2], [0, yT + 5], [-hw * 0.4, yS + 2]], C.dark, 1); g.dot(-0.5, y0 - n * 0.5, C.purple, 5); }
  else if (s.facet) for (let y = y0 - 1, i = 0; y > yS + 2; y -= 4, i++) g.poly(i % 2 ? [[0, y], [hw, y - 2], [0, y - 4]] : [[0, y], [-hw, y - 2], [0, y - 4]], m, i % 2 ? 4 : 5);
  else if (s.radiant) { g.rect(-0.5, yS - 1, 1, n, C.white, 5); g.dot(-0.5, yT + 2, C.white, 5); }
}
// Parerstång, lindat grepp och knopp.
let GWK = 1, WT = -1;      // parerstångens bredd och materialsteget för vapnet som ritas just nu (drawWeapon)
function hilt(g, s, gw0, gy = -5, grip = 7) {
  const gw = gw0 * GWK;
  if (WT >= 6 && !s.rough) {                                                                                                    // små uppåtsvepta vingar på parerstången
    g.poly([[-gw + 1, gy], [-gw - 2.5, gy - 4.5], [-gw - 0.5, gy - 0.5]], s.trim, 5); g.poly([[gw - 1, gy], [gw + 2.5, gy - 4.5], [gw + 0.5, gy - 0.5]], s.trim, 3);
  }
  if (s.rough) { g.rect(-gw + 1.5, gy, gw * 2 - 3, 2.5, C.wood, 2); g.rect(-1.5, gy - 0.5, 3, 3.5, C.rope, 4); }
  else {
    g.rect(-gw, gy, gw * 2, 2.5, s.trim, 3);
    if (s.ornate || s.radiant || s.gems || s.facet) { g.poly([[-gw + 2.5, gy], [-gw - 1.5, gy - 2.5], [-gw, gy + 2.5]], s.trim, 4); g.poly([[gw - 2.5, gy], [gw + 1.5, gy - 2.5], [gw, gy + 2.5]], s.trim, 2); }      // uppsvängda ändar
    else if (s.jag || s.ember || s.smoke) { g.poly([[-gw, gy], [-gw - 2, gy + 5], [-gw + 3, gy + 2.5]], s.trim, 4); g.poly([[gw, gy], [gw + 2, gy + 5], [gw - 3, gy + 2.5]], s.trim, 2); }                              // nedsvepta ändar
    else { g.rect(-gw - 1, gy - 0.5, 2, 3.5, s.trim, 4); g.rect(gw - 1, gy - 0.5, 2, 3.5, s.trim, 2); }
    g.ell(0, gy + 1.25, 1.7, 1.7, s.gem);
  }
  const gr = s.grip || C.leather;
  g.rect(-1.5, gy + 2.5, 3, grip, gr, 3);
  for (let y = gy + 3.5; y < gy + 2.5 + grip; y += 2) g.rect(-1.5, y, 3, 1, gr, 1);       // lindning
  if (!s.rough) g.ell(0, gy + 3.2 + grip, 2.3, 2.3, s.trim);
}
// Skaft med lindat grepp och doppsko.
const pole = (g, s, len) => {
  const p = s.pole || C.wood;
  g.poly([[-1.5, 6], [1.5, 6], [1.5, -len], [-1.5, -len]], p, 3);
  g.rect(-2, -8, 4, 4, s.grip || C.leather, 3); g.rect(-2, -6, 4, 1, s.grip || C.leather, 1);
  g.rect(-2, 5, 4, 2, s.rough ? C.rope : s.trim, 3);
};
const LEN = { dagger: 17, club: 26, sword: 29, axe: 31, spear: 35, hammer: 31, staff: 32, great: 33, bow: 16, orb: 13 };
const WEAPON = {
  dagger(g, m, s) {
    g.poly([[-2.6, -4], [0, -4], [0.6, -17], [-2.6, -11]], m, 4); g.poly([[0, -4], [2.6, -4], [3.2, -10], [0.6, -17]], m, 2);   // lätt krökt blad
    if (s.shine || s.radiant || s.jag) g.dot(-1, -14, C.white, 5); if (s.rough) g.rect(-2.6, -8, 5.5, 1.5, C.bone, 4);
    if (s.ember) g.poly([[-1.6, -4], [1.6, -4], [0.3, -10]], C.fire2, 5); if (s.smoke) g.rect(-0.5, -12, 1, 8, C.dark, 1);
    if (s.gems || s.ornate) g.dot(-0.5, -8, s.ornate ? C.red : C.white, 5); if (s.facet) g.poly([[0, -5], [-2.6, -8], [0, -11]], m, 5);
    hilt(g, s, 4, -4.5, 5);
  },
  club(g, m, s) {
    g.poly([[-1.5, 6], [1.5, 6], [2.2, -8], [-2.2, -8]], s.pole || C.wood, 3);
    for (let y = 2; y > -7; y -= 3) g.rect(-1.8, y, 3.6, 1, C.leather, 2);
    g.poly([[-2.5, -8], [2.5, -8], [5.2, -15], [4.6, -21], [2, -23.5], [-2, -23.5], [-4.6, -21], [-5.2, -15]], m, 2);              // klubbhuvud
    g.poly([[-2.5, -8], [0.5, -8], [0.5, -23.5], [-2, -23.5], [-4.6, -21], [-5.2, -15]], m, 4);
    const band = s.rough ? C.rope : s.trim, spike = s.rough ? C.steel : m;
    g.rect(-3.6, -12, 7.4, 1.5, band, 3); g.rect(-5, -19.5, 10, 1.5, band, 3);
    for (const [x, y, d] of [[-5, -16, -1], [5, -16, 1], [-4.2, -22, -1], [4.2, -22, 1]]) g.poly([[x, y - 1.6], [x + d * 3.6, y], [x, y + 1.6]], spike, d < 0 ? 5 : 3);
    g.poly([[-1.6, -23.5], [0, -27], [1.6, -23.5]], spike, 5);
    flair(g, s, m, -1, -16);
  },
  sword(g, m, s) {
    half(g, m, 2.9, -5, -24, -29); bladeFx(g, s, m, 2.9, -5, -24, -29);
    hilt(g, s, 6.5);
  },
  axe(g, m, s) {
    pole(g, s, 26);
    g.poly([[1.5, -27], [7, -31.5], [12.5, -27], [14, -20], [11.5, -13], [6.5, -10.5], [1.5, -15]], m, 3);                         // bladet
    g.poly([[7, -31.5], [12.5, -27], [14, -20], [11.5, -13], [6.5, -10.5], [9.6, -15.5], [10.8, -20.5], [9.6, -26]], m, 5);       // slipad egg
    g.poly([[-1.5, -26], [-7, -23.5], [-4, -21.5], [-1.5, -18]], m, 2);                                                           // bakpigg
    g.rect(-2, -28, 4, 2, s.trim, 4); g.rect(-2, -16.5, 4, 2, s.trim, 3);
    g.poly([[-1.6, -28], [0, -32], [1.6, -28]], s.trim, 4);
    flair(g, s, m, 5, -21);
  },
  spear(g, m, s) {
    pole(g, s, 23);
    g.poly([[0, -36], [-4.6, -27], [-1.5, -22.5], [0, -22.5]], m, 4); g.poly([[0, -36], [4.6, -27], [1.5, -22.5], [0, -22.5]], m, 2);   // bladformad spets
    g.poly([[-1.5, -23], [-6, -24.5], [-1.5, -20.5]], s.trim, 4); g.poly([[1.5, -23], [6, -24.5], [1.5, -20.5]], s.trim, 2);          // vingar
    g.rect(-2, -21.5, 4, 2, s.trim, 3);
    const f = rd(Math.sin(T * 3) * 1.2);                                                                                              // tofs som hänger framåt
    g.poly([[1.5, -19.5], [5.5, -18], [5 + f, -11], [3 + f, -9.5], [2, -13]], s.cloth, 3); g.dot(4, -17, s.cloth, 5);
    if (s.shine || s.radiant || s.jag) { g.dot(-2, -29, C.white, 5); g.rect(-2, -28, 1, 3, m, 5); } if (s.ember) g.poly([[-1.6, -23], [1.6, -23], [0, -30]], C.fire2, 5);
    if (s.smoke) g.rect(-0.5, -32, 1, 9, C.dark, 1); if (s.gems || s.ornate) g.ell(0, -27.5, 1.5, 1.5, s.ornate ? C.red : C.white); if (s.facet) g.poly([[0, -24], [-3.5, -28], [0, -32]], m, 5);
    if (s.jag) { g.poly([[3.6, -27], [7, -30.5], [3, -31]], m, 4); g.poly([[-3.6, -27], [-7, -30.5], [-3, -31]], m, 5); }
    if (s.rough) g.rect(-2, -24.5, 4, 1.5, C.rope, 4);
  },
  hammer(g, m, s) {
    pole(g, s, 22);
    g.poly([[-10, -31], [-7.5, -29.5], [7.5, -29.5], [10, -31], [10, -19], [7.5, -20.5], [-7.5, -20.5], [-10, -19]], m, 3);          // huvud med utsvängda slagytor
    g.poly([[-10, -31], [-7.5, -29.5], [-7.5, -20.5], [-10, -19]], m, 5); g.poly([[10, -31], [7.5, -29.5], [7.5, -20.5], [10, -19]], m, 1);
    g.rect(-2.5, -30.5, 5, 11, s.trim, 3); g.ell(0, -25, 1.8, 1.8, s.gem);
    g.poly([[-1.6, -30.5], [0, -33.5], [1.6, -30.5]], s.trim, 4);
    flair(g, s, m, -5.5, -25); g.rect(3.5, -28, 3, 1, m, 4);
  },
  staff(g, m, s) {
    pole(g, s, 21);
    const hd = s.rough ? C.wood : s.trim;
    g.poly([[-1.5, -20], [-6.5, -23], [-8, -29], [-5, -35], [-5.3, -29], [-3.2, -25], [1.5, -22.5]], hd, 4);   // månskära som håller kulan
    g.poly([[1.5, -21], [6, -23], [7.5, -27], [4.8, -25]], hd, 2);
    g.ell(1.2, -29, 4.8, 4.8, m); g.dot(-1, -32, C.white, 5); g.dot(-2, -31, C.white, 5); g.dot(0, -32, m, 5);
    const f = rd(Math.sin(T * 2.5));
    g.line(-6, -23, -7 + f, -19, C.rope, 3); g.rect(-8 + f, -18, 2, 2, s.gem, 5);                              // berlock
    if (s.radiant || s.facet || s.shine) g.dot(3, -28, C.white, 5); if (s.ember) g.ell(1.5, -28.5, 2.2, 2.2, C.fire2, false, null, 5); if (s.smoke) g.ell(1.8, -28.5, 2, 2, C.dark, false, null, 1);
    if (s.jag) { g.poly([[4, -32], [7.5, -36], [5.5, -31]], m, 5); g.poly([[-1, -33.5], [0, -38], [2, -33.5]], m, 5); }
    if (s.gems) g.poly([[1.2, -31.5], [3.4, -29], [1.2, -26.5], [-1, -29]], m, 5);
  },
  great(g, m, s) {
    half(g, m, 3.2, -6, -9, -9); half(g, m, 5.2, -9, -27, -33.5); bladeFx(g, s, m, 5.2, -9, -27, -33.5);
    g.poly([[-5.2, -9], [-3.2, -9], [-3.2, -7]], m, 5); g.poly([[5.2, -9], [3.2, -9], [3.2, -7]], m, 2);
    if (!s.rough && !s.smoke && !s.radiant) for (let y = -13; y > -26; y -= 4) g.dot(-0.5, y, s.gem, 5);                            // runor längs mitten
    hilt(g, s, 9, -6.5, 9);
  },
  bow(g, m, s) {
    const L = [[-3, -16], [1.5, -13], [5, -7], [6.2, 0], [5, 7], [1.5, 13], [-3, 16]], lv = [5, 4, 4, 3, 2, 2];
    for (let i = 0; i < 6; i++) g.thick(L[i][0], L[i][1], L[i + 1][0], L[i + 1][1], 3.5, m, lv[i]);
    g.poly([[-3, -16.5], [-6, -18], [-4.2, -14]], s.trim, 4); g.poly([[-3, 16.5], [-6, 18], [-4.2, 14]], s.trim, 2);                 // svängda horn
    g.line(-4, -15, -4, 15, C.white, 4);
    g.rect(3.6, -3.5, 3.6, 7, s.grip || C.leather, 3); g.rect(3.6, -1, 3.6, 1, s.grip || C.leather, 1); g.rect(3.6, 1, 3.6, 1, s.grip || C.leather, 1);
    g.dot(4, -8, s.gem, 5); g.dot(4, 7, s.gem, 4);
    if (s.jag) { g.poly([[5, -8], [8.5, -11], [5.5, -11.5]], m, 5); g.poly([[5, 8], [8.5, 11], [5.5, 11.5]], m, 3); }
    if (s.ember) { g.dot(2, -12, C.fire2, 5); g.dot(2, 11, C.fire2, 5); }
  },
  orb(g, m, s) {         // svävar framför och ovanför handen
    const f = rd(Math.sin(T * 2.4) * 1.3), x = 5, y = -10 + f;
    g.ell(x, y, 5.4, 5.4, m);
    g.ell(x + 0.4, y + 0.4, 3.4, 3.4, s.smoke ? C.dark : s.ember ? C.fire2 : m, false, (dx, dy) => dx * 0.7 + dy > 0.1, s.smoke ? 1 : 5);    // inre virvel
    g.dot(x - 3, y - 3, C.white, 5); g.dot(x - 2, y - 4, C.white, 5); g.dot(x - 4, y - 2, m, 5);
    const ns = 3 + Math.max(0, WT - 4);                                                                                              // fler gnistor för varje steg från Ice (v3)
    for (let i = 0; i < ns; i++) { const a = T * 3 + i * 6.283 / ns; g.dot(x + Math.cos(a) * 8.5, y + Math.sin(a) * 2.8 - 0.5, s.gem, 5); }      // gnistor i omlopp
    flair(g, s, m, x + 1, y + 1);
  },
};
// Hur vapnet hålls i vila (vinkel i radianer, 0 = rakt upp, positivt = lutar framåt). Storsvärdet hålls upprätt i vila så att det syns
// (i v1 släpades det bakom benen); striden släpar det fortfarande i marken under attacken.
export const HOLD = { dagger: 0.9, club: 0.55, sword: 0.42, axe: 0.35, spear: 0.2, hammer: 0.3, staff: 0.12, great: 0.3, bow: 0, orb: 0 };
// k = skala. Storsvärdet växer lite mindre så att spetsen hamnar vid marken när striden släpar det (vinkel -2.08).
const wk = (it) => (it.type === 'great' ? Math.min(OPT.wscale, 1.1) : it.type === 'orb' ? 1 : WK[it.type] || OPT.wscale);   // WK: nya vapen (v4)
// Det som växer med materialet på vapnet utöver storleken (v3). Trä: en fjäder knuten under handen och målade röda ränder.
// Emerald och uppåt: skaftvapnen får ett band med en vimpel som blir längre för varje steg. Fire och uppåt: vingar på
// parerstången (i hilt). Star: en stjärna i spetsen (weaponFx).
const POLE = { axe: 1, spear: 1, hammer: 1, staff: 1 };
function grandW(g, type, s, m, i) {
  if (i === 0) {
    const f = rd(Math.sin(T * 2.3) * 0.8);
    if (type === 'bow') { g.line(5, 3, 7, 6, C.rope, 3); g.poly([[6.5, 5.5], [8.5, 5.5], [9.5 + f, 11], [7.5 + f, 10.5]], C.white, 4); g.dot(8 + f, 10, C.red, 4); g.rect(4.5, -9, 2, 1, C.red, 4); g.rect(4.5, 8, 2, 1, C.red, 3); return; }
    if (type !== 'orb') { g.line(1, 1, 3, 4, C.rope, 3); g.poly([[2.5, 3.5], [4.5, 3.5], [5.5 + f, 9], [3.5 + f, 8.5]], C.white, 4); g.dot(4 + f, 8, C.red, 4); }
    if (POLE[type]) for (const y of [-11, -14, -17]) g.rect(-1.5, y, 3, 1, C.red, 3);                                           // målade ränder på skaftet
    else if (type === 'club') for (const x of [-3, 0, 3]) g.dot(x, -15, C.red, 4);
    else if (type === 'sword' || type === 'great') { g.rect(-2, -16, 4, 1, C.red, 3); g.rect(-2, -18, 4, 1, C.red, 3); }
    else if (type === 'dagger') g.rect(-2, -10, 3, 1, C.red, 3);
    return;
  }
  // Magikerns vapen (v21, så att de passar Mage-bygget): runor inristade i staven från Iron, som lyser från Steel, och en
  // rune som vrider sig inne i kulan från Steel.
  if (type === 'staff') { const on = i >= 2 && Math.floor(T * 2.5) % 2 ? 5 : 4; for (const y of [-11, -14]) { g.dot(-0.5, y, i >= 2 ? s.gem : C.dark, i >= 2 ? on : 1); g.dot(0.5, y + 1, i >= 2 ? s.gem : C.dark, i >= 2 ? on - 1 : 1); } }
  if (type === 'orb' && i >= 2) { const f = rd(Math.sin(T * 2.4) * 1.3), a = T * 1.2; g.push(5.4, -9.6 + f, a); g.dot(-1, 0, C.white, 5); g.dot(0, -1, C.white, 5); g.dot(1, 0, C.white, 4); g.dot(0, 1, C.white, 4); g.pop(); }
  if (i >= 4 && POLE[type] && type !== 'spear') {                                                                                  // band och vimpel under huvudet
    const y = type === 'staff' ? -17 : -12.5, n = 3 + (i - 4) * 1.3, f = rd(Math.sin(T * 3 - 0.5) * (1 + (i - 4) * 0.25));
    g.rect(-2, y, 4, 1.5, s.trim, 4);
    g.poly([[-1.5, y + 1], [-3.5, y + 1.5], [-4.5 + f, y + 1.5 + n], [-2.5 + f, y + 1 + n * 0.8]], s.cloth, 3);
  }
}
// Yxans blad sticker ut åt sidan: över storlek 1 växer den bara med 60 procent av stegen, så att Star-yxan ryms i rutan.
const KCAP = { axe: 0.6 };
const TOPX = { staff: 3, spear: 1 };   // så mycket vapnets översta del når ovanför LEN (isflisor, slagytor), för lutningen i vila
const wsize = (it) => { const k = gr(GRAND.weapon, it); return k > 1 && KCAP[it.type] ? 1 + (k - 1) * KCAP[it.type] : k; };
export function drawWeapon(g, it, k = wk(it) * wsize(it)) {
  const s = mat(it), i = tierG(it); GWK = i < 0 ? 1 : GRAND.guard[i]; WT = i;
  g.push(0, 0, 0, k); WEAPON[it.type](g, R(it.hex), s); if (i >= 0) grandW(g, it.type, s, R(it.hex), i); g.anchor.tip = g.pt(it.type === 'orb' ? 5 : 0, -LEN[it.type] + 3); g.pop();
  GWK = 1; WT = -1;
}
// Vapnets längd från handen till spetsen i hjältens pixlar, så som det ritas (striden: storsvärdets släp mot marken).
export const weaponLen = (it) => (LEN[it.type] - 3) * wk(it) * wsize(it);

// ---------- Sköldar: varje typ har sitt eget emblem ----------
const SHIELD = {
  round(g, m, s) {
    g.ell(0.5, 0.5, 8.6, 8.6, m, true);
    g.ell(0.5, 0.5, 8.6, 8.6, m, false, (dx, dy, d2) => d2 <= 0.68 && d2 > 0.1 && dx * dy < 0, 2);                    // målad i fält
    g.ell(0.5, 0.5, 8.6, 8.6, s.rough ? C.iron : s.trim, false, (dx, dy, d2) => d2 > 0.68, 3);
    for (const [x, y] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) g.dot(x, y, s.rough ? C.iron : s.trim, 5);
    g.ell(0.5, 0.5, 2.7, 2.7, s.gem); g.dot(-1, -1, C.white, 5);
    flair(g, s, m, -3, -3);
  },
  kite(g, m, s) {
    g.poly([[-8, -10], [0.5, -11.5], [9, -10], [9, 1.5], [0.5, 13], [-8, 1.5]], s.trim, 3);
    g.poly([[-6.4, -8.6], [0.5, -9.8], [7.4, -8.6], [7.4, 0.8], [0.5, 10.6], [-6.4, 0.8]], m, 3);
    g.poly([[-6.4, -8.6], [-2, -9.4], [-6.4, -3]], m, 5);                                                             // ljusreflex
    g.poly([[-6.4, -2.5], [0.5, 3], [7.4, -2.5], [7.4, 0.8], [0.5, 6.2], [-6.4, 0.8]], s.gem, 4);                     // sparre
    flair(g, s, m, 0, -5);
  },
  tower(g, m, s) {
    g.poly([[-8, -12], [9, -12], [9, 10], [0.5, 13], [-8, 10]], s.trim, 3);
    g.poly([[-6.4, -10.4], [7.4, -10.4], [7.4, 9], [0.5, 11.2], [-6.4, 9]], m, 3);
    g.poly([[-6.4, -10.4], [-1.5, -10.4], [-6.4, -4]], m, 5);
    g.rect(-0.5, -8.5, 2, 17, s.gem, 4); g.rect(-4.5, -4, 10, 2, s.gem, 4);                                           // kors
    for (const [x, y] of [[-6, -10], [6, -10], [-6, 8], [6, 8]]) g.dot(x, y, s.trim, 5);
    flair(g, s, m, 0, -3);
  },
};
// Sköldens prakt efter material (v3). Trä: plankor med fogar och en målad rand. Golden och uppåt: fler nitar och en inre
// kant. Ice och uppåt: ett stjärnemblem runt mitten. Crystal och Star: strålar som pulserar från mitten.
const SH_C = { round: [0.5, 0.5], kite: [0.5, -2], tower: [0.5, -1] };
function grandS(g, type, s, m, i) {
  const [cx, cy] = SH_C[type], rnd0 = type === 'round' || type === 'cog' || type === 'sunshield', hw = rnd0 ? 7 : 6;   // runda sköldar (v22, v23: kugghjul och sol)
  if (i === 0) {
    const inside = rnd0 ? (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 < 52 : () => true;
    for (const x of [-3, 3]) for (let y = -8; y <= 9; y++) if (inside(x, y) && !(type === 'kite' && Math.abs(y - 2) < 4) && !(type === 'tower' && (x === 0 || (y >= -4 && y <= -3)))) g.dot(x, y, m, 1);   // fogar mellan plankorna
    g.rect(cx - hw + 0.5, cy + (rnd0 ? 3 : 5), hw * 2 - 1, 1, C.red, 3);                                          // målad rand
    return;
  }
  if (i >= 3) {                                                                                                                  // fler nitar längs kanten
    const n = 4 + (i - 3) * 2, rx = rnd0 ? 7.4 : 6.6, ry = rnd0 ? 7.4 : 9;
    for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * 6.283; g.dot(cx + Math.cos(a) * rx - 0.5, cy + Math.sin(a) * ry - 0.5, s.trim, 5); }
  }
  if (i >= 5) {                                                                                                                  // stjärnemblem
    const L = 3 + (i - 5) * 0.7;
    g.thick(cx - L - 1.5, cy, cx + L + 1.5, cy, 1, s.gem, 4); g.thick(cx, cy - L - 2, cx, cy + L + 2, 1, s.gem, 4);
    g.ell(cx, cy, 1.6, 1.6, s.gem, false, null, 5);
  }
  if (i >= 8) {                                                                                                                  // strålar som pulserar
    const k = Math.floor(T * 4) % 3;
    for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) g.line(cx + dx * 2, cy + dy * 2, cx + dx * (3 + k), cy + dy * (3 + k), C.white, 5);
  }
}
export function drawShield(g, it, x, y) {
  const k = gr(GRAND.shield, it), i = tierG(it), m = R(it.hex), s = mat(it);
  g.begin(); g.push(x, y, 0, k); SHIELD[it.type](g, m, s); if (i >= 0) grandS(g, it.type, s, m, i); g.pop(); auraEnd(g, m, i < 0 || !FXOK ? 0 : HINT[i]);
}
let FXOK = true;           // false: ingen aura (kartmarkören, stillbilder med noFx)

// ---------- Rygg: mantel, vingar, jetpack ----------
export const HOVER = { wings: 1, dragonwings: 1, jetpack: 1 };
const BACK = {
  cape(g, it, m, b, t, s) {
    const fl = gr(GRAND.flutter, it), ti = tierG(it);
    const y = SH + 1 + b, wv = (i) => rd(Math.sin(t * 1.7 - i * 0.9) * (0.5 + i * 0.55) * fl);      // vågen går nedåt genom tyget
    const a = [30 + wv(1), 60], c = [22 + wv(2), 61], d = [16 + wv(3), 56 + wv(2)];
    const k = gr(GRAND.cape, it), g0 = g; g = capeMap(g0, 44, y, 0.55 + 0.45 * k, k);                     // kortare och lite smalare mantel för enklare material
    g0.begin();
    if (ti >= 4) g.poly([[29, y + 3], [25 + wv(1), 42 + b], [20 + wv(2), 49], d, [18 + wv(3), 57 + wv(2)], [15 + wv(3), 54 + wv(2)], [19 + wv(2), 47], [24 + wv(1), 40 + b]], s.cloth, 2);   // fodret syns i kanten
    g.poly([[33, y], [44, y], [43, HIP + 6], [38, 58], a, c, d, [20 + wv(2), 49], [25 + wv(1), 42 + b], [29, y + 3]], m, 3);
    g.poly([[29, y + 3], [25 + wv(1), 42 + b], [20 + wv(2), 49], d, [19 + wv(3), 55], [23 + wv(2), 49], [28 + wv(1), 43 + b], [31, y + 4]], m, 5);   // ljus kant
    g.poly([[36, y + 6], [38, y + 6], [35 + wv(1), 55], [33 + wv(1), 55]], m, 2);                                                             // veck
    const hem = s.rough ? m : s.ember ? C.fire2 : s.jag ? C.white : s.trim;
    g.thick(38, 58, a[0], a[1], 1.5, hem, s.rough ? 1 : 4); g.thick(a[0], a[1], c[0], c[1], 1.5, hem, s.rough ? 1 : 4); g.thick(c[0], c[1], d[0], d[1], 1.5, hem, s.rough ? 1 : 4);
    if (s.radiant || s.facet) for (let i = 0; i < 4; i++) if ((Math.floor(t * 2) + i) % 3) g.dot(24 + i * 4 + wv(2), 54 - i * 3, C.white, 5);          // stjärnor i tyget
    if (s.smoke) { g.dot(27 + wv(2), 52, C.purple, 5); g.dot(33, 47, C.purple, 4); }
    if (ti === 0) for (let q = 0; q < 3; q++) g.rect(21 + q * 3 + wv(2), 53 - q * 2, 2, 1, C.bone, 4);   // trä: tre målade streck
    g.rect(32, y - 1, 12, 2.5, s.rough ? C.rope : s.trim, 3); g.dot(43, y, s.gem, 5);
    if (ti >= 6) g0.ell(43.5, y + 0.5, 2.2, 2.2, s.gem);                                               // stort spänne
    auraEnd(g0, m, hintOf(it));
  },
  wings(g, it, m, b, t, s) {
    const ti = tierG(it);
    g.begin(); g.push(34, SH + 4 + b, Math.sin(t * 2.2) * 0.14, gr(GRAND.wings, it));
    if (ti >= 5) g.poly([[-13, -23], [-29, -26], [-25, -17]], m, 3);                                                          // fler och längre handpennor (v3)
    if (ti >= 7) g.poly([[-21, -9], [-30, -10], [-25, -3]], m, 3);
    g.poly([[0, 2], [-5, -14], [-13, -23], [-26, -24], [-21, -17], [-27, -13], [-21, -9], [-25, -3], [-17, -2], [-19, 5], [-11, 4], [-10, 9], [-4, 6]], m, 2);   // handpennor
    g.poly([[0, 1], [-5, -13], [-12, -20], [-21, -20], [-16, -14], [-20, -9], [-14, -6], [-16, -1], [-8, 0], [-8, 4]], m, 3);                                    // armpennor
    if (ti !== 0 && ti !== 1) g.poly([[-1, 0], [-5, -11], [-11, -16], [-15, -14], [-11, -9], [-13, -5], [-7, -3], [-6, 1]], m, 5);   // täckfjädrar (inte på trä och järn)
    else for (const [x, y] of [[-9, -12], [-12, -7], [-8, -4]]) g.line(x, y, x + 4, y - 1, m, 1);                                     // enkla fjäderstreck
    g.thick(0, 1, -5, -13, 1.6, ti === 0 ? C.rope : s.trim, 4);
    if (ti !== 0 && ti !== 1) for (const [x, y] of [[-25, -23], [-26, -13], [-24, -3], [-18, 4]]) g.dot(x, y, s.gem, 5);
    g.pop(); auraEnd(g, m, hintOf(it));
  },
  dragonwings(g, it, m, b, t, s) {
    g.begin(); g.push(34, SH + 4 + b, Math.sin(t * 2.2) * 0.14, gr(GRAND.wings, it));
    g.poly([[0, 2], [-4, -17], [-13, -24], [-27, -20], [-22, -15], [-26, -6], [-20, -7], [-20, 5], [-14, 1], [-10, 7], [-6, 3]], m, 2);       // hinna med bågar i kanten
    g.poly([[-4, -15], [-12, -20], [-22, -17], [-19, -13], [-21, -8], [-15, -8], [-16, -1], [-9, -2], [-7, 2]], m, 1);
    g.thick(0, 1, -4, -17, 2.2, m, 5); g.thick(-4, -17, -27, -20, 2, m, 5); g.thick(-4, -17, -26, -6, 1.5, m, 4); g.thick(-4, -17, -20, 5, 1.5, m, 4); g.thick(-4, -17, -10, 7, 1.3, m, 4);
    g.poly([[-4, -17], [-2.5, -23], [-7.5, -19.5]], C.bone, 4); g.poly([[-27, -20], [-30, -22], [-27, -17.5]], C.bone, 4); g.dot(-26, -5, C.bone, 5); g.dot(-20, 6, C.bone, 5);
    if (s.ember) for (const [x, y] of [[-12, -12], [-17, -5], [-9, -5]]) g.dot(x, y, C.fire2, 5);
    if (tierG(it) >= 6) { g.poly([[-13, -24], [-12, -29], [-15.5, -24.5]], C.bone, 4); g.poly([[-20, -7], [-23, -10], [-21, -5]], C.bone, 4); }   // fler klor (v3)
    g.pop(); auraEnd(g, m, hintOf(it));
  },
  jetpack(g, it, m, b, t, s) {
    const y = SH + 2 + b, fl = Math.floor(t * 12) % 3, F = gr(GRAND.flame, it), ti = tierG(it), jk = gr(GRAND.jet, it);
    pushAt(g, 23.5, y + 7, jk);
    g.begin();          // lågor i tre lager, utan kontur. Längden växer med materialet (v3), från Crystal med vit kärna.
    for (const x of [20.5, 26.5]) {
      g.poly([[x - 2.2, y + 16], [x + 2.2, y + 16], [x + 1.4, y + 16 + (6 + fl) * F], [x, y + 16 + (10 + fl * 2) * F], [x - 1.4, y + 16 + (6 + fl) * F]], C.fire, 3);
      g.poly([[x - 1.4, y + 16], [x + 1.4, y + 16], [x, y + 16 + (6 + fl) * F]], C.fire2, 4); g.rect(x - 0.5, y + 16, 1, ti >= 8 ? 2 + 3 * F : 2, C.white, 5);
    }
    for (let i = 0; i < 5; i++) { const ph = (t * 11 + i * 2.3) % 7; g.dot((i % 2 ? 20 : 26) + rd((rnd(i + Math.floor(t * 9)) - 0.5) * 3), y + 16 + (9 + ph) * F, ph < 3 ? C.fire2 : C.fire, ph < 4 ? 5 : 3); }
    g.end({ outline: false, edge: false });
    g.begin();
    g.rect(18, y + 1, 5, 13, m, 4); g.rect(24, y + 1, 5, 13, m, 3); g.ell(20.5, y + 1, 2.5, 2, m); g.ell(26.5, y + 1, 2.5, 2, m);            // två tankar
    g.rect(19, y + 3, 1, 9, m, 5); g.rect(18, y + 6, 11, 1.5, s.trim, 3); g.rect(18, y + 10.5, 11, 1.5, s.trim, 3); g.rect(29, y + 3, 4, 2, C.leather, 2);
    g.rect(22, y + 2, 3, 3, C.dark, 1); g.dot(23, y + 3, Math.floor(t * 3) % 2 ? C.fire2 : C.red, 5);                                         // blinkande lampa
    g.poly([[18.5, y + 14], [22.5, y + 14], [23.2, y + 16.5], [17.8, y + 16.5]], C.steel, 2); g.poly([[24.5, y + 14], [28.5, y + 14], [29.2, y + 16.5], [23.8, y + 16.5]], C.steel, 2);
    g.line(18, y, 17, y - 3, C.steel, 3); g.dot(17, y - 4, s.gem, 5);                                                                         // antenn
    if (ti === 0) { g.rect(18, y + 8, 5, 1, C.red, 4); g.rect(24, y + 8, 5, 1, C.red, 3); }                                                    // trä: målade ränder
    if (ti >= 5) { g.poly([[18, y + 9], [14.5, y + 12], [14.5, y + 14], [18, y + 13]], m, 3); g.poly([[29, y + 9], [32.5, y + 12], [32.5, y + 14], [29, y + 13]], m, 2); }   // fenor
    g.pop(); auraEnd(g, m, hintOf(it));
  },
};
const hintOf = (it) => { const i = tierG(it); return i < 0 || !FXOK ? 0 : HINT[i]; };
// Manteln skalas olika på bredden och längden kring axeln (cx, cy): ett litet ombud för de ritfunktioner manteln använder.
const capeMap = (g, cx, cy, kx, ky) => {
  const P = (p) => [cx + (p[0] - cx) * kx, cy + (p[1] - cy) * ky];
  return {
    poly: (pts, rp, lv) => g.poly(pts.map(P), rp, lv),
    rect: (x, y, w, h, rp, lv) => g.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(P), rp, lv),
    thick: (x0, y0, x1, y1, w, rp, lv) => { const [a, b] = P([x0, y0]), [c, d] = P([x1, y1]); g.thick(a, b, c, d, w, rp, lv); },
    dot: (x, y, rp, lv) => { const [a, b] = P([x, y]); g.dot(Math.round(a), Math.round(b), rp, lv); },
  };
};
const CAPES = { cape: 1, leafcloak: 1, tattered: 1, mantle: 1, furcloak: 1 };
const ICON_BACK_K = { halo: 0.82, banner: 1.15 };      // ryggsaker som behöver en egen skala i ikonen (v23)      // mantlar: ikonen skalas som manteln
const backCenter = (type) => ({ cape: [30, SH + 13], leafcloak: [30, SH + 13], tattered: [30, SH + 14], mantle: [30, SH + 13], furcloak: [30, SH + 13], banner: [25, SH - 5], halo: [36, SH - 11], wings: [21, SH - 3], dragonwings: [20, SH - 4], jetpack: [23.5, SH + 12] }[type] || [30, SH + 13]);

// ---------- Följeslagare ----------
const eye = (g, x, y, shut) => { if (shut) g.rect(x, y + 1, 2, 1, C.dark, 0); else { g.rect(x, y, 2, 2, C.dark, 0); g.dot(x, y, C.white, 5); } };
const PET = {
  slime(g, m, t, bl) {
    const q = rd(Math.abs(Math.sin(t * 3)) * 2);
    g.ell(0, 3 - q / 2, 7.6 + q / 2, 6.6 - q / 2, m); g.rect(-6 - q / 2, 6, 12 + q, 3, m, 2);
    g.ell(-7, 8, 2, 1.6, m); g.ell(6.5, 8.5, 1.6, 1.2, m);                                         // pölar
    g.poly([[-1, -3 - q / 2 + 1], [0, -7 + q / 2], [2, -3 - q / 2 + 1]], m, 5);                    // tofs
    eye(g, -2, 1, bl); eye(g, 3, 1, bl); g.dot(0, 5, C.dark, 0); g.dot(1, 6, C.dark, 0); g.dot(2, 5, C.dark, 0);
    g.dot(-5, -1 - q / 2, C.white, 5); g.dot(-4, -2 - q / 2, C.white, 5); g.dot(4, 6, m, 5);
  },
  bat(g, m, t, bl) {
    const f = Math.sin(t * 9) * 4;
    for (const d of [-1, 1]) {
      g.poly([[d * 2, 0], [d * 8, -7 + f], [d * 13, -4 + f], [d * 11, 0], [d * 12, 4 - f / 2], [d * 8, 2], [d * 6, 5 - f / 2], [d * 3, 3]], m, 2);
      g.thick(d * 2, 0, d * 8, -7 + f, 1.2, m, 4); g.thick(d * 8, -7 + f, d * 12, 4 - f / 2, 1, m, 3);
    }
    g.ell(0, 1, 4.4, 4.8, m);
    g.poly([[-4, -2], [-4.5, -8], [-1, -3]], m, 3); g.poly([[4, -2], [4.5, -8], [1, -3]], m, 3); g.dot(-4, -5, C.blush, 3); g.dot(3, -5, C.blush, 3);
    eye(g, -3, -1, bl); eye(g, 1, -1, bl); g.dot(-1, 3, C.white, 5); g.dot(1, 3, C.white, 5);     // huggtänder
  },
  dragon(g, m, t, bl) {
    const f = Math.sin(t * 7) * 3;
    g.poly([[-2, -1], [-7, -10 + f], [-12, -7 + f], [-10, -2 + f], [-5, 1]], m, 2); g.thick(-2, -1, -7, -10 + f, 1.3, m, 5);      // vinge
    g.poly([[-4, 3], [-9, 5], [-12, 3], [-13, 6], [-9, 8], [-4, 6]], m, 3); g.poly([[-12, 3], [-15, 2], [-13, 6]], C.fire2, 4);   // svans med spets
    g.ell(0, 2.5, 5.6, 4.8, m); g.ell(0.5, 4, 3.2, 2.6, C.fire2, false, null, 4); g.rect(-2, 3, 5, 1, C.fire2, 3);                // ljus mage
    g.ell(5.5, -3.5, 4.4, 4, m); g.poly([[8, -3], [12.5, -2], [12, 0.5], [8, 0.5]], m, 4);                                        // huvud och nos
    g.poly([[3, -6], [2, -11], [5.5, -7]], C.bone, 4); g.poly([[6, -7], [7, -10], [8, -6]], C.bone, 3);
    eye(g, 6, -5, bl); g.dot(11, -2, C.dark, 0);
    if (t % 2.6 < 0.35) { g.poly([[13, -2], [17, -3], [16, 0], [13, 0]], C.fire, 4); g.dot(14, -1, C.fire2, 5); }                 // en liten eldpuff
    g.rect(-3, 6, 2, 2, m, 2); g.rect(2, 6, 2, 2, m, 2);
  },
  drone(g, m, t) {
    const p = Math.floor(t * 12) % 2;
    g.rect(p ? -9 : -6, -7, p ? 7 : 3, 1, C.steel, 5); g.rect(3, -7, p ? 7 : 3, 1, C.steel, 5);
    g.rect(-5, -6, 1, 3, C.steel, 2); g.rect(4, -6, 1, 3, C.steel, 2);
    g.ell(0, 1, 7.6, 4.6, C.steel); g.rect(-7, 1, 14, 1, C.steel, 1);
    g.ell(1.5, 0.5, 3.4, 3, C.dark, false, null, 1); g.ell(1.5, 0.5, 2.3, 2, m); g.dot(1, -1, C.white, 5);                        // lins
    g.line(-4, -3, -5, -9, C.steel, 3); g.dot(-5, -10, Math.floor(t * 2.5) % 2 ? C.red : C.fire2, 5);                              // antenn med lampa
    g.rect(-6, 5, 2, 3, C.dark, 1); g.rect(5, 5, 2, 3, C.dark, 1); g.dot(-1, 6, C.ice, 5); g.dot(0, 6 + p, C.ice, 4);
  },
  ghost(g, m, t, bl) {
    const k = Math.floor(t * 4) % 2;
    g.ell(0, 0, 6.6, 7.4, m);
    g.poly([[-6.6, 0], [6.6, 0], [6.6, 8 + k], [4.4, 6], [2.2, 9 - k], [0, 6], [-2.2, 9 - k], [-4.4, 6], [-6.6, 8 + k]], m, 3);
    g.poly([[-6, 1], [-10, 3 - k], [-6, 5]], m, 4); g.poly([[6, 1], [10, 3 + k], [6, 5]], m, 2);                                    // små armar
    eye(g, -3, -3, bl); eye(g, 2, -3, bl); g.rect(-1, 1, 3, 3, C.dark, 0); g.dot(0, 3, C.red, 3);
    g.dot(-5, 0, C.blush, 4); g.dot(5, 0, C.blush, 4); g.dot(-4, -5, C.white, 5);
  },
};
const PET_GROUND = { slime: 1 };
// Följeslagaren växer lite med materialet och får auran som antydan (v3). Den som står på marken skalas kring fötterna.
export function drawPet(g, it, x, y, t) {
  T = t; const k = gr(GRAND.pet, it), m = R(it.hex);
  g.begin(); g.push(x, y); if (PET_GROUND[it.type]) pushAt(g, 0, 9, k); else g.push(0, 0, 0, k);
  PET[it.type](g, m, t, t % 3.1 < 0.14); g.pop(); g.pop(); auraEnd(g, m, hintOf(it));
}

// ---------- Hjälmar och hattar (huvudets mitt: 39.5, Y+0.5) ----------
// s = materialets särdrag, sw = [lodrät eftersläpning, vind] i hela pixlar
const HX = 39.5;
const dome = (g, Y, m, pred) => g.ell(HX, Y + 0.5, 11.9, 10.9, m, true, pred);
const helmS = (dx, dy) => dy < -0.08 || (dx < -0.3 && dy < 0.72);
const horns = (g, Y, only) => {          // only: 0 = bara bortre hornet, 1 = bara främre, annars båda
  if (only !== 1) { g.poly([[31, Y - 6], [25, Y - 8], [21, Y - 14], [22, Y - 19], [25, Y - 13], [28, Y - 11], [33, Y - 9]], C.bone, 3); g.rect(26, Y - 10, 2, 2, C.bone, 1); }
  if (only !== 0) { g.poly([[47, Y - 7], [53, Y - 9], [57, Y - 15], [56, Y - 20], [53, Y - 14], [50, Y - 12], [45, Y - 9]], C.bone, 3); g.rect(51, Y - 11, 2, 2, C.bone, 1); }
};
const HELM = {
  cap: { draw(g, it, m, Y, s) {           // keps med skärmen framåt
    const ti = tierG(it);
    if (ti >= 0) { pushAt(g, 33, Y - 8, GRAND.crest[ti]); g.poly([[33, Y - 8], [30, Y - 15], [28, Y - 17], [29, Y - 12], [31, Y - 7]], ti < 2 ? C.white : s.cloth, 4); g.dot(28, Y - 16, ti < 2 ? C.red : s.gem, 5); g.pop(); }   // fjäder (v3): knuten på trä, en plym högre upp
    dome(g, Y, m, (dx, dy) => dy < -0.3 - dx * 0.1); g.poly([[45, Y - 5.5], [55, Y - 4.5], [57, Y - 2], [46, Y - 2.5]], m, 2);
    g.rect(39, Y - 12, 2, 1.5, s.trim, 5); g.ell(HX, Y + 0.5, 11.9, 10.9, m, false, (dx, dy) => dy < -0.3 - dx * 0.1 && dy > -0.42 - dx * 0.1, 1);
    flair(g, s, m, 45, Y - 8);
  } },
  helm: { draw(g, it, m, Y, s) {          // öppen hjälm med nässkydd och kam
    pushAt(g, 40, Y - 9, gr(GRAND.crest, it)); g.poly([[31, Y - 9], [34, Y - 15], [42, Y - 16], [48, Y - 12], [43, Y - 10.5], [35, Y - 10]], s.cloth, 3); g.pop();   // kammen växer med materialet
    dome(g, Y, m, helmS); g.rect(45, Y - 2, 2, 7, m, 5); g.rect(29, Y - 3.5, 22, 1.5, s.trim, 3); g.rect(31, Y + 3, 1, 4, m, 1); g.dot(33, Y + 5, m, 5);
    flair(g, s, m, 36, Y - 6);
  } },
  horned: { draw(g, it, m, Y, s) {
    const hk = Math.min(1.1, gr(GRAND.crest, it));                                                    // hornen växer, högst 1,1 så att de ryms
    g.push(31 * (1 - hk), (Y - 6) * (1 - hk), 0, hk); horns(g, Y, 0); g.pop(); g.push(47 * (1 - hk), (Y - 7) * (1 - hk), 0, hk); horns(g, Y, 1); g.pop();
    dome(g, Y, m, helmS); g.rect(45, Y - 2, 2, 7, m, 5); g.rect(29, Y - 3.5, 22, 1.5, s.trim, 3);
    for (const x of [31, 36, 41, 48]) g.dot(x, Y - 3, s.gem, 5);
    flair(g, s, m, 37, Y - 7);
  } },
  great: { hideHair: 1, draw(g, it, m, Y, s, sw) {      // riddarhjälm med plym som släpar efter
    pushAt(g, 37, Y - 10, gr(GRAND.crest, it));                                                       // plymen växer med materialet
    g.poly([[38, Y - 10], [36, Y - 16], [28, Y - 18 + sw[0]], [21 + sw[1], Y - 14 + sw[0]], [18 + sw[1], Y - 6 + sw[0]], [23 + sw[1], Y - 10 + sw[0]], [30, Y - 12], [34, Y - 9]], s.cloth, 3);
    g.poly([[36, Y - 16], [28, Y - 18 + sw[0]], [21 + sw[1], Y - 14 + sw[0]], [27, Y - 15.5 + sw[0]], [35, Y - 14]], s.cloth, 5);
    g.pop();
    dome(g, Y, m, null); g.rect(38, Y - 1, 13, 3, C.dark, 0);
    const ec = it.fx ? R(it.hex) : C.fire2; g.dot(42, Y, ec, 5); g.dot(47, Y, ec, 5);
    for (let x = 42; x <= 48; x += 2) { g.dot(x, Y + 5, m, 1); g.dot(x - 1, Y + 7, m, 1); }
    g.rect(44, Y - 10, 2, 9, m, 5); g.rect(29, Y + 8, 20, 1.5, s.trim, 3); g.rect(38, Y - 2.5, 13, 1.5, s.trim, 4);
    flair(g, s, m, 34, Y - 4);
  } },
  wizard: { draw(g, it, m, Y, s, sw) {    // stor hatt med knäckt topp som vajar
    g.poly([[30, Y - 5], [49, Y - 5], [45, Y - 12], [40, Y - 17], [34, Y - 20], [26 + sw[1], Y - 19 + sw[0]], [23 + sw[1], Y - 15 + sw[0]], [30, Y - 16], [33, Y - 11]], m, 3);
    g.poly([[40, Y - 17], [34, Y - 20], [26 + sw[1], Y - 19 + sw[0]], [32, Y - 17.5]], m, 5);
    g.ell(HX, Y - 4.5, 16.5, 3.7, m, false, null, 2); g.ell(HX, Y - 5, 16.5, 3.2, m, false, (dx, dy) => dy < -0.2, 4);
    g.rect(31, Y - 9.5, 17, 2.5, s.trim, 3); g.rect(40, Y - 10, 3, 3.5, s.gem, 5);
    g.rect(36, Y - 15, 3, 1, C.fire2, 5); g.rect(37, Y - 16, 1, 3, C.fire2, 5);
    const ti = tierG(it);                                                                             // fler stjärnor på hatten för varje steg från Emerald (v3)
    if (ti === 0) for (const x of [33, 37, 41, 45]) g.dot(x, Y - 7, C.red, 4);
    if (ti >= 4) { g.dot(42, Y - 13, C.fire2, 5); } if (ti >= 6) { g.rect(32, Y - 13, 2, 1, C.white, 5); g.rect(32.5, Y - 13.5, 1, 2, C.white, 5); }
    if (ti >= 8 && Math.floor(T * 3) % 3 !== 1) { g.rect(28, Y - 18, 3, 1, C.white, 5); g.rect(29, Y - 19, 1, 3, C.white, 5); }
    flair(g, s, m, 46, Y - 8);
  } },
  crown: { draw(g, it, m, Y, s) {
    g.rect(31, Y - 13, 17, 3, C.wine, 2);                                                         // sammet innanför
    g.rect(30, Y - 12, 19, 4.5, m, 3);
    const ck = Math.min(1, gr(GRAND.crest, it));                                                      // spetsarna växer upp till storleken före v3 (högre ryms inte)
    for (const [x, h0] of [[30, 4], [34.5, 6], [39.5, 8.5], [44.5, 6], [49, 4]]) { const h = h0 * ck; g.poly([[x - 2, Y - 12], [x, Y - 12 - h], [x + 2, Y - 12]], m, 4); g.dot(x - 0.5, Y - 13 - h, s.ornate ? C.red : s.gem, 5); }
    g.rect(30, Y - 9, 19, 1, m, 1);
    g.dot(33, Y - 11, C.red, 4); g.rect(39, Y - 11, 2, 2, C.ice, 5); g.dot(46, Y - 11, C.red, 4);
    if (Math.floor(T * 2) % 3 === 0) { g.rect(43, Y - 21, 3, 1, C.white, 5); g.rect(44, Y - 22, 1, 3, C.white, 5); }
  } },
  hood: { hideHair: 1, draw(g, it, m, Y, s, sw) {     // spetsig huva som hänger bakåt
    g.poly([[31, Y - 8], [25, Y - 12], [20 + sw[1], Y - 8 + sw[0]], [22 + sw[1], Y - 2 + sw[0]], [27, Y + 6], [29, Y - 2]], m, 2);
    g.ell(HX, Y + 0.5, 12.8, 11.8, m, true, (dx, dy) => !(dx > -0.12 && dy > -0.42 && dy < 0.78));
    g.ell(HX, Y + 0.5, 12.8, 11.8, m, false, (dx, dy) => dx > -0.3 && dx <= -0.12 && dy > -0.42 && dy < 0.78, 1);       // skugga i öppningen
    g.ell(HX, Y + 0.5, 12.8, 11.8, s.rough ? m : s.trim, false, (dx, dy, d2) => dx > -0.12 && dy <= -0.42 && dy > -0.56 && d2 < 0.9, 4);   // kantband
    g.rect(40, Y + 9, 3, 2, s.gem, 5);
    const ti = tierG(it);
    if (ti === 0) { g.rect(26, Y - 4, 3, 3, C.rag3, 3); g.dot(26, Y - 4, C.dark, 1); g.dot(28, Y - 2, C.dark, 1); }        // trä: en lapp med stygn
    if (ti >= 5) g.ell(41.5, Y + 10, 2, 2, s.gem, false, null, Math.floor(T * 3) % 2 ? 5 : 4);                       // spänne som lyser
  } },
  phones: { draw(g, it, m, Y, s) {        // hörlurar med mikrofon och ring som lyser
    g.ell(HX, Y + 0.5, 13, 12, m, false, (dx, dy, d2) => d2 > 0.72 && dy < -0.25 && dx < 0.55, 4);
    g.ell(31.5, Y + 2, 4.4, 5.6, m); g.ell(31.5, Y + 2, 2.6, 3.6, C.dark, false, null, 1);
    g.ell(31.5, Y + 2, 1.4, 2, s.gem, false, null, Math.floor(T * 4) % 2 ? 5 : 4);
    g.line(33, Y + 7, 41, Y + 9, C.dark, 2); g.rect(41, Y + 8, 2, 2, s.gem, 5);
  } },
};

// ---------- Rustning: ben, överkropp, armar ----------
// Ben i valfri ställning (ordbilderna): lår och smalben som tjocka linjer, stöveln vriden efter fotvinkeln.
// gear (v4): en buren ben- eller fotdel ritas på samma benmodell som i stridsställningen (legPieces).
function poseLegs(g, L, pants, boot, gear = {}, type = 'rags') {
  const noB = !!(gear.feet && FEET[gear.feet.type]);
  g.begin();
  for (const [k, hip, lv] of [['b', 35.5, 3], ['f', 42, 2]]) {
    const p = L[k]; if (!p) continue; const [kx, ky, fx, fy, fa = 0] = p;
    g.thick(hip, HIP, kx, ky, 6, pants, lv); g.thick(kx, ky, fx, fy, 5.4, pants, lv);
    if (!noB) { g.push(fx, fy, fa); g.poly([[-3.2, -2], [2.6, -2], [5.6, 1.8], [5.6, 4.6], [-3.2, 4.6]], boot, lv); g.pop(); }
  }
  g.end();
  legPieces(g, gear, L, type);
}
// Bredbent stridsställning: bakre benet (vänster i bild) rakt, främre benet framåt.
// gear (v4): en buren ben- eller fotdel ersätter rustningens byxor eller stövlar. Utan dem ritas allt exakt som förut.
function drawLegs(g, armor, ar, skin, gear = {}) {
  const type = armor ? armor.type : 'rags', s = armor ? mat(armor) : PLAIN;
  const metal = type === 'plate' || type === 'chain';
  const pants = type === 'rags' ? C.rag2 : metal ? ar : C.pants, boot = type === 'plate' ? ar : C.leather;
  const noP = !!(gear.legs && LEGS[gear.legs.type]) && type !== 'robe', noB = !!(gear.feet && FEET[gear.feet.type]);
  g.begin();
  if (type !== 'robe' && !noP) {
    g.poly([[39, HIP - 1], [45, HIP - 1], [48, 56], [42.5, 56]], pants, 2);          // främre benet
    g.poly([[32, HIP - 1], [38.5, HIP - 1], [35.5, 56], [30, 56]], pants, 3);        // bakre benet
  }
  if (!noB) {
    g.poly([[42, 55], [48, 55], [51, 58.5], [51, 61], [42, 61]], boot, 2);
    g.poly([[29, 55], [35.5, 55], [38, 58.5], [38, 61], [29, 61]], boot, 3);
  }
  if (type === 'rags') {          // lindade smalben och en lapp på knät
    if (!noP) {
      g.rect(30, 53, 6, 2, C.bone, 3); g.rect(42.5, 53, 6, 2, C.bone, 2); g.rect(30, 54, 6, 1, C.bone, 1); g.rect(42.5, 54, 6, 1, C.bone, 1);
      g.rect(41, HIP + 2, 3, 3, C.rag3, 3); g.dot(41, HIP + 2, C.dark, 1); g.dot(43, HIP + 4, C.dark, 1);
    }
  } else if (type === 'plate') {  // knäskydd och kantlist
    if (!noP) { g.ell(33.5, HIP + 4.5, 3, 2.6, ar); g.ell(44.5, HIP + 4.5, 3, 2.6, ar); }
    if (!noB) { g.rect(29, 55, 7, 1, s.trim, 4); g.rect(42, 55, 6.5, 1, s.trim, 3); g.rect(35, 60, 3, 1, s.trim, 4); g.rect(48, 60, 3, 1, s.trim, 4); }
  } else if (!noB) {              // tunika, ringbrynja, kåpa och nya kroppar: uppvikt stövelkant
    g.rect(29, 55, 7, 1.5, boot, 5); g.rect(42, 55, 6.5, 1.5, boot, 5);
    if (type === 'chain') { g.rect(35, 60, 3, 1, C.steel, 4); g.rect(48, 60, 3, 1, C.steel, 4); }
  }
  if (type === 'chain' && !noP) for (let y = HIP; y < 55; y += 2) { g.dot(33 - (y - HIP) / 4, y, ar, 1); g.dot(36 - (y - HIP) / 4, y + 1, ar, 1); g.dot(42 + (y - HIP) / 4, y, ar, 1); g.dot(45 + (y - HIP) / 4, y + 1, ar, 1); }
  g.end();
  legPieces(g, gear, null, type);
}
// Rustningens prakt efter material (v3), ovanpå delen innan den avslutas. Trä: målade ränder och stygn. Golden och uppåt:
// kantband vid halsen. Ice och uppåt: en fena på bortre axeln. Shadow och uppåt: en ädelsten på bröstet som pulserar.
// Star: glimtar som vandrar över rustningen.
function armorG(g, type, s, ar, i, y, t) {
  if (i < 0) return;
  if (i === 0) {
    if (type === 'robe') { for (let x = 31; x < 48; x += 3) g.rect(x, 54, 2, 1, C.red, 3); return; }
    for (let x = 33; x < 45; x += 3) g.rect(x, y + 9, 2, 1, C.red, 3);                                               // målad rand över magen
    g.dot(34, y + 3, C.dark, 1); g.dot(35, y + 4, C.dark, 1); g.dot(36, y + 3, C.dark, 1);                           // stygn
    return;
  }
  if (i >= 3) g.rect(33.5, y - 0.5, 10, 1, s.trim, 5);
  if (i >= 5) g.poly([[44, y], [47.5, y - 4.5 - (i - 5) * 0.6], [47, y + 2]], s.trim, 4);
  if (i >= 7) g.ell(38.5, y + 6.5, 1.8, 1.8, s.gem, false, null, Math.floor(t * 3) % 2 ? 5 : 4);
  if (i >= 9) for (let k = 0; k < 2; k++) { const q = (t * 0.7 + k * 0.5) % 1; g.dot(32 + rd(q * 13), y + 3 + rd(Math.sin(q * 6 + k) * 3 + 4), C.white, 5); }
}
function drawTorso(g, armor, ar, b, t, bd = 0, legs = null) {
  const y = SH + b, type = armor ? armor.type : 'rags', s = armor ? mat(armor) : PLAIN, body = type === 'rags' ? C.rag : ar;
  const w = rd(Math.sin(t * 1.9) * 1);
  g.begin();
  if (type === 'robe') {          // lång kåpa som rör sig i nederkanten
    g.poly([[31 - bw(bd), y], [46 + bw(bd), y], [48, HIP], [52 + w, 59.5], [27 + w, 59.5], [30, HIP]], ar, 3);
    g.poly([[36.5, y], [40.5, y], [41.5, 59.5], [37.5, 59.5]], s.trim, 4);
    g.poly([[27 + w, 57], [52 + w, 57], [52 + w, 59.5], [27 + w, 59.5]], s.trim, 3);
    for (let x = 29; x < 51; x += 4) g.dot(x + w, 58, s.gem, 5);
    g.poly([[30.5, HIP - 2], [47.5, HIP - 2], [48, HIP + 0.5], [30, HIP + 0.5]], s.cloth, 3);                        // skärp med knut
    g.poly([[33, HIP], [35.5, HIP], [34.5 + w, HIP + 7], [32 + w, HIP + 6]], s.cloth, 2);
    g.poly([[30 - bw(bd), y - 0.5], [47 + bw(bd), y - 0.5], [45, y + 4], [38.5, y + 6], [32, y + 4]], ar, 5);                          // bred krage
    flair(g, s, ar, 43, y + 9); armorG(g, type, s, ar, armor ? tierG(armor) : -1, y, t);
    if (legs && LEGS[legs.type]) { const lc = R(legs.hex); g.poly([[42, HIP + 4], [45.5 + w, 59.5], [40 + w, 59.5]], lc, 2); g.dot(42.5 + w, 56, lc, 5); }   // v21: byxorna syns i en slits fram
    g.end(); return;
  }
  if (BODY[type]) { BODY[type](g, armor, ar, s, y, t, bd, w); armorG(g, type, s, ar, tierG(armor), y, t); g.end(); return; }   // nya kroppar (v4)
  g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [45.5, HIP + 1], [31.5, HIP + 1]], body, 3);     // build breddar axellinjen, midjan är densamma
  if (type === 'rags') {          // sliten äventyrarskjorta: axelrem, bälte med väska, lapp och fransig nederkant
    g.poly([[31.5, HIP + 1], [45.5, HIP + 1], [46, HIP + 4], [43, HIP + 2.5], [41, HIP + 4.5], [38.5, HIP + 2.5], [36, HIP + 4.5], [34, HIP + 2.5], [31, HIP + 4]], C.rag, 2);      // trasig nederkant
    g.poly([[36, y], [41, y], [38.5, y + 4]], C.rag, 1);
    g.thick(32, y + 1, 44, HIP - 3, 2, C.leather, 3);
    g.rect(31.5, HIP - 3, 14, 2, C.leather, 2); g.rect(38, HIP - 3, 2, 2, C.gold, 4);
    g.rect(41, HIP - 2, 4, 4, C.leather, 3); g.dot(42, HIP - 1, C.gold, 5);
  } else if (type === 'plate') {
    g.ell(38.5, y + 6, 8.4 + bw(bd) * 0.5, 7.4, ar, true);                                                                          // bröstplåt
    g.rect(34, y + 10, 9, 1, ar, 1); g.rect(38, y + 2, 1, 8, ar, 2);
    g.rect(33.5, y - 1, 11, 2.5, ar, 5);                                                                             // halskrage
    g.ell(46 + bw(bd) * 0.6, y + 1.5, 4.4 + bw(bd) * 0.35, 3.6 + bw(bd) * 0.25, ar); g.rect(43 + bw(bd) * 0.6, y + 4, 6, 1, s.trim, 3);                                            // bortre axelskydd
    g.rect(31, HIP - 2.5, 15, 2.5, s.trim, 3); g.rect(38, HIP - 3, 2, 3.5, s.gem, 5);
    g.poly([[31, HIP], [37, HIP], [36.5, HIP + 5], [31.5, HIP + 4]], ar, 4); g.poly([[40, HIP], [46, HIP], [45.5, HIP + 4], [40.5, HIP + 5]], ar, 2);   // höftplåtar
    g.poly([[37, HIP], [40, HIP], [40 + w, HIP + 7], [38.5 + w, HIP + 8.5], [37 + w, HIP + 7]], s.cloth, 3);          // tygflik som rör sig
    flair(g, s, ar, 38, y + 5);
  } else {
    if (type === 'chain') {
      for (let yy = y + 1; yy < HIP - 2; yy++) for (let xx = 31; xx < 46; xx++) if ((xx + yy) % 2) g.dot(xx, yy, ar, 1);
      g.rect(33, y, 11, 1.5, ar, 5);
      g.poly([[36, y + 1.5], [42, y + 1.5], [42, HIP + 5], [39, HIP + 7], [36, HIP + 5]], s.cloth, 3);                // vapenrock
      for (let x = 31; x < 46; x += 2) g.rect(x, HIP + 1, 1, 2, ar, 2);
      flair(g, s, ar, 38, y + 5);
    } else {                      // tunika: krage, axelrem, kjol under bältet
      g.poly([[35.5, y], [41.5, y], [38.5, y + 4]], ar, 5);
      g.thick(32, y + 1, 44, HIP - 3, 2, C.leather, 3);
      g.poly([[31, HIP], [46, HIP], [47, HIP + 4.5], [42, HIP + 3.5], [38.5, HIP + 5], [35, HIP + 3.5], [30, HIP + 4.5]], ar, 2);
      g.rect(30.5, HIP + 2.5, 16, 1, s.trim, 4);
      flair(g, s, ar, 41, y + 5);
    }
    g.rect(31, HIP - 2.5, 15, 2.5, C.leather, 2); g.rect(37.5, HIP - 3, 3, 3.5, s.rough ? C.rope : C.gold, 4);
  }
  if (armor) armorG(g, type, s, ar, tierG(armor), y, t);
  g.end();
}
// Halsduk som fladdrar bakåt. Röd i startklädseln, annars rustningens tygfärg.
function drawScarf(g, col, b, t) {
  const y = SH + b, w1 = rd(Math.sin(t * 3.1) * 1.2), w2 = rd(Math.sin(t * 3.1 - 1.2) * 1.7);
  g.begin();
  g.poly([[34, y - 0.5], [34, y + 4], [28, y + 5.5 + w1], [22, y + 5 + w2], [17.5, y + 8.5 + w2], [21.5, y + 2 + w2], [28, y + 0.5 + w1]], col, 2);
  g.poly([[21.5, y + 2 + w2], [28, y + 0.5 + w1], [34, y - 0.5], [29, y + 2.5 + w1], [23, y + 3.5 + w2]], col, 4);
  g.poly([[32.5, y - 2], [46.5, y - 2], [46, y + 2], [40, y + 4], [33, y + 2.5]], col, 3);
  g.dot(36, y + 1, col, 1); g.dot(42, y + 1, col, 1);
  g.end();
}
// Arm i två delar med armbåge. bend = hur långt armbågen skjuts ut (x, y).
// hands (v4): en buren handdel ritas som en egen del (med materialets aura) i stället för ärmslutet.
const ARM_AS = { vest: 'tunic' };                                     // nya kroppar ärmas som en äldre typ
function arm(g, type, ar, skin, s, sx, sy, hx, hy, bend, lv, bd = 0, hands = null) {
  type = ARM_AS[type] || type;
  const ex = (sx + hx) / 2 + bend[0], ey = (sy + hy) / 2 + bend[1];
  const bare = type === 'rags' || type === 'skin', up = bare ? skin : ar, low = bare || type === 'tunic' || type === 'shirt' ? skin : ar;
  const [, uw, lw] = BUILD[bd] || BUILD[0];                            // build: överarmen växer mest
  if (type === 'robe') { g.thick(sx, sy, ex, ey, 4.8 + uw, ar, lv); g.poly([[ex - 2.6, ey - 1], [ex + 2.4, ey - 1.6], [hx + 3.2, hy - 0.5], [hx - 3.4, hy + 1]], ar, lv); g.thick(hx - 3, hy, hx + 3, hy - 1, 1.6, s.trim, 4); return; }   // vid ärm
  g.thick(sx, sy, ex, ey, 4.6 + uw, up, lv); g.thick(ex, ey, hx, hy, 4.2 + lw, low, lv);
  if (bd > 0) { g.ell(sx - (lv > 2 ? 0.5 : -0.5), sy - 0.5, 2.6 + uw * 0.7, 2.5 + uw * 0.5, up, false, null, lv); g.dot((sx + ex) / 2 - 1.5, (sy + ey) / 2 - 1.5, up, 5); if (bd > 1) g.dot((sx + ex) / 2 - 0.5, (sy + ey) / 2 - 2.5, up, 5); }   // rundad axel och en ljus prick på överarmen
  const cx = ex + (hx - ex) * 0.42, cy = ey + (hy - ey) * 0.42, dx = hx - (hx - ex) * 0.12, dy = hy - (hy - ey) * 0.12;
  if (hands && HANDS[hands.type]) { if (type === 'rags') g.rect(sx - 2.5 - uw / 2, sy - 2, 5 + uw, 2.5, C.rag, 2); g.end(); handPiece(g, hands, cx, cy, dx, dy, lw, lv); return; }
  if (type === 'skin') return;                                         // bara armar (pälsvästen, v22)
  if (bare) { g.thick(cx, cy, dx, dy, 4.8 + lw, C.rag2, 3); g.rect(sx - 2.5 - uw / 2, sy - 2, 5 + uw, 2.5, C.rag, 2); }      // lindad underarm, avriven ärm
  else if (type === 'plate') { g.thick(cx, cy, dx, dy, 5 + lw, ar, 5); g.ell(ex, ey, 2.4 + lw / 2, 2.4 + lw / 2, ar); }
  else g.thick(cx, cy, dx, dy, 4.8 + lw, C.leather, 3);
}

// ---------- Huvud och frisyrer ----------
// Huvudet: mitt i (39.5, Y+0.5), 11 brett och 10 högt, ansiktet åt höger. En frisyr har en del bakom huvudet (back)
// och en del ovanpå (front). tall = sticker upp ovanför huvudet, och byts mot en enkel kalufs under hjälm.
// s = lodrät eftersläpning (-1, 0, 1), w = vind (-1, 0, 1): toppar och svansar rör sig lite efter huvudet.
const capS = (dx, dy) => dy < -0.42 - dx * 0.12 || (dx < -0.52 && dy < 0.32);
const cap = (g, Y, h, pred = capS) => g.ell(HX, Y + 0.5, 11.9, 10.9, h, true, pred);
const stubble = (g, Y, h) => g.ell(HX, Y + 0.5, 11.3, 10.4, h, false, (dx, dy) => dy < -0.5 - dx * 0.1 || (dx < -0.62 && dy < 0.12), 2);
const shine = (g, Y, h) => g.ell(HX, Y + 0.5, 11.9, 10.9, h, false, (dx, dy, d2) => d2 > 0.46 && d2 < 0.7 && dy < -0.5 && dx > -0.5 && dx < 0.15, 5);   // glansband
export const HAIR_STYLES = {
  short: { name: 'Short', front(g, Y, h, s) { cap(g, Y, h); shine(g, Y, h); g.poly([[39, Y - 9], [50, Y - 8], [52.5, Y - 4], [49.5, Y - 5.5], [47.5, Y - 3.5], [45.5, Y - 6], [43, Y - 4.5], [41, Y - 7]], h, 4); g.poly([[32, Y - 8], [30, Y - 13 + s], [36, Y - 10]], h, 4); } },
  quiff: { name: 'Quiff', tall: 1, front(g, Y, h, s) { cap(g, Y, h); g.poly([[35, Y - 9], [38, Y - 15], [45, Y - 18 + s], [53, Y - 15 + s], [54.5, Y - 9], [51.5, Y - 5], [48, Y - 8], [41, Y - 8]], h, 4); g.poly([[41, Y - 14], [47, Y - 16.5 + s], [52, Y - 13 + s], [47, Y - 13]], h, 5); g.poly([[30, Y - 6], [33, Y - 11], [36, Y - 9]], h, 2); } },
  sidepart: { name: 'Side part', front(g, Y, h, s) { cap(g, Y, h, (dx, dy) => dy < -0.36 || (dx < -0.5 && dy < 0.35)); shine(g, Y, h); g.poly([[34, Y - 10], [46, Y - 12], [52, Y - 7], [53.5, Y - 1], [52, Y + 2 + s], [51, Y - 3], [45, Y - 5.5], [36, Y - 7]], h, 4); g.rect(35, Y - 10, 1, 4, h, 1); } },
  buzz: { name: 'Buzz cut', front(g, Y, h, s, w, skin) { stubble(g, Y, h); g.line(30, Y - 1, 34, Y - 4, skin, 2); } },      // en rakad rand i sidan
  undercut: { name: 'Undercut', tall: 1, front(g, Y, h, s) { stubble(g, Y, h); g.poly([[31, Y - 8], [35, Y - 13], [45, Y - 16], [53, Y - 12], [54.5, Y - 5 + s], [52, Y - 2 + s], [50.5, Y - 6], [45, Y - 9], [33, Y - 7]], h, 4); g.poly([[39, Y - 13.5], [46, Y - 15], [51, Y - 11.5], [45, Y - 11.5]], h, 5); } },
  mullet: { name: 'Mullet', back(g, Y, h, s, w) { g.poly([[29, Y - 2], [36, Y - 2], [36, Y + 10], [33, Y + 14], [30 + w, Y + 17 + s], [25 + w, Y + 18 + s], [22 + w, Y + 15 + s], [25, Y + 11], [25, Y + 4]], h, 2); g.thick(29, Y + 4, 26 + w, Y + 15 + s, 1.4, h, 4); },
    front(g, Y, h) { cap(g, Y, h); shine(g, Y, h); for (const [x, tx, ty] of [[36, 37, 13], [40, 44, 13], [44, 49, 12], [47, 53.5, 10]]) g.poly([[x, Y - 8], [tx, Y - ty], [x + 4.5, Y - 7]], h, 4); } },
  manbun: { name: 'Man bun', tall: 1, back(g, Y, h, s) { g.ell(30, Y - 12 + s * 0.5, 4.8, 4.6, h, true); g.poly([[27, Y - 9], [24, Y - 5 + s], [28, Y - 7]], h, 3); },
    front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.46 - dx * 0.1 || (dx < -0.5 && dy < 0.42)); shine(g, Y, h); g.rect(31, Y - 9, 3.5, 1.5, C.red, 3); } },
  ponytail: { name: 'Ponytail', back(g, Y, h, s, w) { g.poly([[30, Y - 6], [25, Y - 9], [19 + w, Y - 5 + s], [16 + w, Y + 5 + s], [19 + w, Y + 14 + s], [23 + w, Y + 8 + s], [25, Y + 1], [28, Y - 1]], h, 3); g.thick(24, Y - 7, 18 + w, Y + 4 + s, 1.4, h, 5); },
    front(g, Y, h) { cap(g, Y, h); shine(g, Y, h); g.poly([[40, Y - 9], [50, Y - 8.5], [52.5, Y - 3], [49, Y - 5], [46.5, Y - 3], [44, Y - 6.5]], h, 4); g.rect(27, Y - 6, 2.5, 3.5, C.red, 3); } },
  long: { name: 'Long', back(g, Y, h, s, w) { g.poly([[27, Y - 2], [35, Y - 2], [37, Y + 13], [34, Y + 18 + s], [29 + w, Y + 20 + s], [24 + w, Y + 18 + s], [23, Y + 9]], h, 2); g.thick(28, Y + 6, 27 + w, Y + 17 + s, 1.4, h, 4); },
    front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.4 - dx * 0.1 || (dx < -0.4 && dy < 0.9)); shine(g, Y, h); g.poly([[39, Y - 9], [49, Y - 9], [52.5, Y - 4], [49.5, Y - 5.5], [47, Y - 3.5], [45, Y - 6.5]], h, 4); } },
  bob: { name: 'Bob', back(g, Y, h) { g.poly([[27, Y - 2], [36, Y - 2], [36, Y + 10], [27, Y + 11]], h, 2); },
    front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.34 || (dx < -0.36 && dy < 0.86)); shine(g, Y, h); g.rect(37, Y - 6, 14.5, 3, h, 3); g.rect(37, Y - 6, 14.5, 1, h, 4); g.poly([[33, Y + 6], [38.5, Y + 8], [35, Y + 11.5], [30, Y + 10]], h, 3); } },
  curly: { name: 'Curly', tall: 1, back(g, Y, h) { for (const a of [140, 162, 184]) g.ell(HX + Math.cos(a * Math.PI / 180) * 10.8, Y + Math.sin(a * Math.PI / 180) * 9.8, 4.2, 4.2, h, true); },
    front(g, Y, h, s) { g.ell(HX - 1, Y - 5, 9.8, 6.2, h, true); for (let a = 195; a <= 345; a += 25) g.ell(HX + Math.cos(a * Math.PI / 180) * 10.8, Y - 1 + Math.sin(a * Math.PI / 180) * 9.8 + (a > 250 && a < 300 ? s * 0.5 : 0), 4.6, 4.6, h, true); } },
  mohawk: { name: 'Mohawk', tall: 1, front(g, Y, h, s) { stubble(g, Y, h); g.poly([[30, Y - 8], [28, Y - 14], [33, Y - 12], [34, Y - 19 + s], [38, Y - 14], [41, Y - 21 + s], [44, Y - 15], [48, Y - 19 + s], [49.5, Y - 13], [53.5, Y - 14], [51, Y - 7], [44, Y - 9], [36, Y - 9]], h, 4); g.poly([[30, Y - 8], [51, Y - 7], [50, Y - 10.5], [31, Y - 11]], h, 2); } },
  spiky: { name: 'Spiky', tall: 1, front(g, Y, h, s) { cap(g, Y, h); for (const [x, tx, ty] of [[27, 21.5, -9], [31, 27, -16], [36, 37, -19], [42, 47.5, -17], [46, 55, -11]]) g.poly([[x - 1, Y - 5], [tx, Y + ty + (ty < -12 ? s : 0)], [x + 6.5, Y - 7.5]], h, 4); g.poly([[43, Y - 8.5], [51, Y - 8], [52.5, Y - 4], [48.5, Y - 6]], h, 4); } },
  braid: { name: 'Braid', back(g, Y, h, s, w) { g.ell(27, Y + 3, 3.4, 3.4, h); g.ell(25.5 + w * 0.5, Y + 8 + s * 0.5, 3, 3, h); g.ell(24.5 + w, Y + 13 + s, 2.6, 2.6, h); g.ell(24 + w, Y + 17.5 + s, 2.2, 2.2, h); g.rect(22.5 + w, Y + 19.5 + s, 3, 2, C.red, 3); },
    front(g, Y, h) { cap(g, Y, h); shine(g, Y, h); g.poly([[40, Y - 9], [50, Y - 8.5], [52.5, Y - 3], [49, Y - 5], [46.5, Y - 3], [44, Y - 6.5]], h, 4); } },
  bowl: { name: 'Bowl', front(g, Y, h) { cap(g, Y, h, (dx, dy) => dy < -0.12 || (dx < -0.42 && dy < 0.5)); shine(g, Y, h); g.ell(HX, Y + 0.5, 11.9, 10.9, h, false, (dx, dy) => dy < -0.12 && dy > -0.26 && dx > -0.42, 2); } },
};
function drawHead(g, look, b, blink, hideHair, helmet, sw, small) {
  const skin = R(look.skin), hair = R(look.hair), Y = SH - 10 + b, st = HAIR_STYLES[look.style] || HAIR_STYLES.short;
  g.begin();
  if (!hideHair && st.back) st.back(g, Y, hair, sw[0], sw[1], skin);
  g.ell(HX, Y + 0.5, 11, 10, skin, 0.75);
  const brow = OPT.brow && !small;
  if (brow) { g.rect(41, Y - 2, 2, 1, hair, 1); g.dot(43, Y - 1, hair, 1); g.rect(48, Y - 2, 2, 1, hair, 1); g.dot(47, Y - 1, hair, 1); }   // före håret: luggen ska ligga ovanpå ögonbrynen
  if (!hideHair) { if (helmet && st.tall) cap(g, Y, hair); else st.front(g, Y, hair, sw[0], sw[1], skin); }
  if (blink) { g.rect(42, Y + 1, 2, 1, skin, 1); g.rect(47, Y + 1, 2, 1, skin, 1); }
  else { g.rect(42, Y, 2, 3, C.dark, 0); g.rect(47, Y, 2, 3, C.dark, 0); g.dot(42, Y, C.white, 5); g.dot(47, Y, C.white, 5); }
  if (brow) {                    // bestämd blick: ögonbryn som lutar in mot näsan (ritade ovan), och ett litet snett leende
    g.rect(45, Y + 6, 2, 1, skin, 1); g.dot(47, Y + 5, skin, 1);
    g.dot(40, Y + 4, C.blush, 3); g.dot(41, Y + 4, C.blush, 3);
  } else {
    g.rect(44, Y + 5, 3, 1, skin, 1); g.dot(47, Y + 4, skin, 1);
    g.dot(40, Y + 4, C.blush, 3); g.dot(41, Y + 4, C.blush, 3); g.dot(49, Y + 4, C.blush, 3);
  }
  g.end();
}

// Effekter runt vapnet för magiska material. Punkterna läggs längs klingan mellan handen och spetsen.
function weaponFx(g, w, t) {
  const tip = g.anchor.tip, hand = g.anchor.hand; if (!tip || !hand) return;
  const dx = tip[0] - hand[0], dy = tip[1] - hand[1];
  g.begin();
  if (w.fx === 'fire') for (let i = 0; i < 8; i++) {            // glöd som stiger
    const c = t * 1.5 + i * 0.37, life = c % 1, sd = i * 31 + Math.floor(c), u = 0.35 + rnd(sd) * 0.75;
    const x = rd(hand[0] + dx * u + (rnd(sd + 3) - 0.5) * 5 + Math.sin(life * 6 + i) * 1.3), y = rd(hand[1] + dy * u - life * 10);
    g.set(x, y, life < 0.4 ? C.fire2 : C.fire, life < 0.4 ? 5 : life < 0.75 ? 4 : 2);
    if (life < 0.25) { g.set(x, y + 1, C.fire2, 5); g.set(x + 1, y, C.fire, 4); }
  } else if (w.fx === 'ice') {                                   // snö som faller och en glimt i spetsen
    for (let i = 0; i < 6; i++) {
      const c = t * 0.9 + i * 0.41, life = c % 1, sd = i * 29 + Math.floor(c), u = 0.3 + rnd(sd) * 0.8;
      g.set(rd(hand[0] + dx * u + (rnd(sd + 3) - 0.5) * 8 - life * 2), rd(hand[1] + dy * u + life * 8 - 2), i % 2 ? C.white : C.ice, life < 0.6 ? 5 : 4);
    }
    if (t % 1.8 < 0.3) { const x = rd(tip[0]), y = rd(tip[1]); for (let k = -2; k <= 2; k++) { g.set(x + k, y, C.white, 5); g.set(x, y + k, C.white, 5); } }
  } else if (w.fx === 'shadow') for (let i = 0; i < 9; i++) {    // rök som ringlar bakåt
    const c = t * 1.1 + i * 0.31, life = c % 1, sd = i * 23 + Math.floor(c), u = 0.3 + rnd(sd) * 0.8;
    const x = rd(hand[0] + dx * u - life * 6 + Math.sin(life * 5 + i) * 2), y = rd(hand[1] + dy * u - life * 7);
    g.set(x, y, C.purple, life < 0.5 ? 4 : 2); if (life < 0.5) g.set(x - 1, y, C.purple, 2); if (life < 0.2) g.set(x, y - 1, C.purple, 5);
  } else {
    if (OPT.grand !== false && (w.mat === 'stjarn' || w.mat === 'kristall')) {
      const x = rd(tip[0]), y = rd(tip[1]);
      if (w.mat === 'stjarn') { const k = 2 + Math.floor(t * 5) % 3; for (let j = 1; j <= k; j++) { const c = j < 2 ? C.white : C.fire2; g.set(x + j, y, c, 5); g.set(x - j, y, c, 5); g.set(x, y + j, c, 5); g.set(x, y - j, c, 5); } g.set(x, y, C.white, 5); }   // stjärna i spetsen (v3)
      else { const an = t * 2.6, sx = rd(x + Math.cos(an) * 5), sy = rd(y + Math.sin(an) * 3); g.set(sx, sy - 1, C.white, 5); g.set(sx, sy, R(w.hex), 4); g.set(sx, sy + 1, R(w.hex), 3); g.set(sx + 1, sy, C.white, 4); }   // en skärva i omlopp kring spetsen (v3)
    }
    for (let i = 0; i < 3; i++) {                           // stjärnglimtar som tänds och slocknar
      const c = t * 1.3 + i * 0.33, life = c % 1, sd = i * 19 + Math.floor(c), u = 0.25 + rnd(sd) * 0.85;
      const x = rd(hand[0] + dx * u + (rnd(sd + 3) - 0.5) * 9), y = rd(hand[1] + dy * u + (rnd(sd + 7) - 0.5) * 9), k = life > 0.3 && life < 0.6 ? 2 : life > 0.15 && life < 0.8 ? 1 : 0;
      g.set(x, y, C.white, 5); for (let j = 1; j <= k; j++) { g.set(x + j, y, j === 1 ? C.white : C.fire2, 5); g.set(x - j, y, j === 1 ? C.white : C.fire2, 5); g.set(x, y + j, j === 1 ? C.white : C.fire2, 5); g.set(x, y - j, j === 1 ? C.white : C.fire2, 5); }
    }
  }
  g.end({ outline: false, edge: false });
}

// =====================================================================================================================
// ---------- UTRUSTNING V4 (balans v20): händer, ben, fötter, bälte, berlock, nya sorter och byggen ----------
// Koordinaterna är hjältens egna (80x72, fötterna på y 61). Varje ny del ritas som en egen del med materialets aura (HINT),
// och prakten växer med materialet som på de andra platserna: trä är minst och enklast men handgjort (målad rand, stygn,
// en knuten snodd), Iron enkelt, Steel blänk, Golden kantband, Emerald ädelsten, Ice och uppåt materialets särdrag (flair).
// GRAND.trim skalar det som får växa på en kropp som inte växer: knäskydd, stövelkragar, armskyddens kanter, spännen.
// =====================================================================================================================
C.leaf = R('#5aa646'); C.fur = R('#e8dcc4');
GRAND.trim = [0.75, 0.82, 0.9, 0.97, 1.03, 1.09, 1.15, 1.2, 1.25, 1.3];
const pieceK = (it) => gr(GRAND.trim, it);
// En ny del: egen begin, ritfunktionen, sedan auran. fn(g, m, s, ti, k) där ti = materialsteget (-1 = inga v3-detaljer).
function piece(g, it, fn) { const m = R(it.hex); g.begin(); fn(g, m, mat(it), tierG(it), pieceK(it)); auraEnd(g, m, hintOf(it)); }

// ---------- Benmodellen (gemensam för stridsställningen och ordbildernas ställningar) ----------
// Ett ben = höft, knä, fotled och fotvinkel. Stridsställningen motsvarar benens polygoner i drawLegs (raka ben), ordbilderna
// skickar egna lägen i a.legs. Ben- och fotdelarna ritas bara på modellen, så de sitter rätt var hjälten än står.
const STANCE = { b: [34, 51.5, 32.75, 56, 0], f: [43.6, 51.5, 45.25, 56, 0] };
function legModel(L) {
  const P = L || STANCE, out = [];
  for (const [k, hx, lv] of [['b', L ? 35.5 : 35.25, 3], ['f', 42, 2]]) { const p = P[k]; if (!p) continue; const [kx, ky, ax, ay, fa = 0] = p; out.push({ k, lv, hip: [hx, HIP - 1], knee: [kx, ky], ankle: [ax, ay], fa }); }
  return out;
}
const lerp2 = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
// Ett avsmalnande stycke från a till b, w0 brett vid a och w1 vid b.
function limb(g, a, b, w0, w1, rp, lv) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = -dy / d / 2, ny = dx / d / 2;
  g.poly([[a[0] + nx * w0, a[1] + ny * w0], [b[0] + nx * w1, b[1] + ny * w1], [b[0] - nx * w1, b[1] - ny * w1], [a[0] - nx * w0, a[1] - ny * w0]], rp, lv);
}
// Foten i fotledens koordinater (tån framåt, sulan på y +5).
const FOOT = [[-3.5, -1], [2.75, -1], [5.5, 2.5], [5.5, 5], [-3.5, 5]];
const atFoot = (g, L, fn) => { g.push(L.ankle[0], L.ankle[1], L.fa); fn(); g.pop(); };
function legPieces(g, gear, L, type) {
  const f = gear.feet, l = gear.legs, FD = f && FEET[f.type], LD = l && LEGS[l.type]; if (!FD && !LD) return;
  const legs = legModel(L);
  if (FD && !FD.over) piece(g, f, (q, m, s, ti, k) => FD.draw(q, f, m, s, legs, ti, k));
  if (LD && type !== 'robe') piece(g, l, (q, m, s, ti, k) => LD.draw(q, l, m, s, legs, ti, k));
  if (FD && FD.over) piece(g, f, (q, m, s, ti, k) => FD.draw(q, f, m, s, legs, ti, k));
}

// ---------- Ben (byxor och benskydd) ----------
export const LEGS = {
  trousers: { draw(g, it, m, s, legs, ti, k) {          // jägarbyxor med knäskydd i läder
    for (const L of legs) { limb(g, L.hip, L.knee, 6.6, 6, m, L.lv); limb(g, L.knee, L.ankle, 6, 5.6, m, L.lv); }
    for (const L of legs) {
      const [x, y] = L.knee, pad = ti >= 2 ? s.trim : C.leather;
      g.ell(x, y, 2.4 * k, 2 * k, pad); g.dot(x - 1, y - 1, pad, 5);
      if (ti >= 4) g.dot(x, y, s.gem, 5); else if (ti === 1) g.dot(x, y, C.iron, 4);
      if (ti >= 3) limb(g, lerp2(L.knee, L.ankle, 0.82), L.ankle, 5.8, 5.6, s.trim, L.lv + 1);                     // kantband nertill
    }
    const F = legs.find((L) => L.k === 'f');
    if (F) g.line(F.hip[0] - 0.5, F.hip[1] + 2, F.ankle[0] - 1, F.ankle[1] - 1, m, 1);                                     // söm
    const B = legs.find((L) => L.k === 'b');
    if (ti === 0 && B) { const [x, y] = lerp2(B.knee, B.ankle, 0.35); g.rect(x - 2, y, 3, 2, C.rag3, 3); g.dot(x - 2, y, C.dark, 1); g.dot(x, y + 1, C.dark, 1); }   // trä: en lapp med stygn
    if (ti >= 5 && F) flair(g, s, m, Math.round(F.knee[0]), Math.round(F.knee[1] - 4));
  } },
  greaves: { draw(g, it, m, s, legs, ti, k) {           // benskenor: brynja på låren, skenor på smalbenen och knäkopp
    const chain = ti === 0 ? C.leather : C.iron;
    for (const L of legs) { limb(g, L.hip, L.knee, 6.6, 6, chain, L.lv - 1); limb(g, L.knee, L.ankle, 6, 5.6, chain, L.lv - 1); }
    for (const L of legs) for (let u = 0.15; u < 0.95; u += 0.28) { const [x, y] = lerp2(L.hip, L.knee, u); g.dot(Math.round(x - 1.5), Math.round(y), ti === 0 ? C.rope : C.steel, 3); g.dot(Math.round(x + 1.5), Math.round(y + 1), ti === 0 ? C.rope : C.steel, 3); }
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, 0.08);
      limb(g, top, L.ankle, 6.6, 6, m, L.lv + 1);                                                                        // skenan
      if (ti === 0) { for (const u of [0.3, 0.7]) { const [x, y] = lerp2(top, L.ankle, u); g.rect(x - 3, y, 6, 1, C.rope, 3); } g.rect(top[0] - 3, top[1] + 2, 6, 1, C.red, 3); }   // trä: snören och en målad rand
      else { g.rect(top[0] - 3.2, top[1], 6.4, 1, s.trim, 4); if (ti >= 3) { const [x, y] = lerp2(top, L.ankle, 0.5); g.line(x, y - 1.5, x, y + 1.5, m, 5); } }
      g.ell(L.knee[0], L.knee[1] - 0.5, 2.8 * k, 2.4 * k, m); g.dot(L.knee[0] - 1, L.knee[1] - 1.5, C.white, ti >= 2 ? 5 : 4);   // knäkopp
      if (ti >= 4) g.dot(L.knee[0], L.knee[1] - 0.5, s.gem, 5);
      if (ti >= 5) g.poly([[L.knee[0] + 1.5, L.knee[1] - 1.5], [L.knee[0] + 3.5 * k, L.knee[1] - 4 * k], [L.knee[0] + 2.8, L.knee[1] + 0.5]], s.trim, 4);   // en kam på knät
    }
    const F = legs.find((L) => L.k === 'f'); if (ti >= 6 && F) { const [x, y] = lerp2(F.knee, F.ankle, 0.5); flair(g, s, m, Math.round(x), Math.round(y)); }
  } },
};

// ---------- Fötter (over = ritas ovanpå byxorna, annars under) ----------
export const FEET = {
  tallboots: { over: 1, draw(g, it, m, s, legs, ti, k) {     // höga stövlar med uppvikt krage
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, -0.08);
      limb(g, top, L.ankle, 6.4, 6, m, L.lv); atFoot(g, L, () => { g.poly(FOOT, m, L.lv); g.rect(-3.5, 4, 9, 1, C.dark, 1); });
      const ch = 1.5 + k;                                                                                                // kragen blir högre för varje material
      limb(g, top, lerp2(top, L.ankle, ch / 5), 7.2 * Math.min(1.15, k + 0.2), 7, ti >= 3 ? s.trim : m, L.lv + 2);
      if (ti === 0) { const [x, y] = lerp2(top, L.ankle, 0.45); g.line(x - 2, y, x + 2, y + 1, C.rope, 4); g.dot(x + 2, y + 2, C.red, 4); }   // trä: en knuten snodd med röd tofs
      else if (ti >= 2) { const [x, y] = lerp2(top, L.ankle, 0.62); g.rect(x - 3, y, 6, 1.2, C.dark, 2); g.rect(x + 0.5, y - 0.4, 2, 2, s.trim, 5); }   // rem med spänne
      if (ti >= 4) { const [x, y] = lerp2(top, L.ankle, 0.12); g.dot(x, y, s.gem, 5); }
    }
    const F = legs.find((L) => L.k === 'f'); if (ti >= 5 && F) { const [x, y] = lerp2(F.knee, F.ankle, 0.35); flair(g, s, m, Math.round(x), Math.round(y)); }
  } },
  sabatons: { over: 1, draw(g, it, m, s, legs, ti, k) {      // riddarens stövlar: lameller över foten, spetsig tå och skena till halva smalbenet
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, 0.42);
      limb(g, top, L.ankle, 6.2, 6, m, L.lv + 1);
      atFoot(g, L, () => {
        g.poly([[-3.5, -1.5], [3, -1.5], [4.5, 1], [7.5 + (k - 1) * 3, 3.6], [7.5 + (k - 1) * 3, 5], [-3.5, 5]], m, L.lv + 1);
        for (const y of [1, 3]) g.rect(-3.5, y, 8, 1, m, 1);
        g.dot(-1.5, -0.5, C.white, ti >= 2 ? 5 : 4);
        if (ti === 0) g.rect(-3.5, 2, 7, 1, C.red, 3);                                                                       // trä: målad rand
      });
      g.rect(top[0] - 3.2, top[1], 6.4, 1.2, ti === 0 ? C.rope : s.trim, 4);
      if (ti >= 3) { const [x, y] = lerp2(top, L.ankle, 0.5); g.dot(x, y, ti >= 4 ? s.gem : s.trim, 5); }
    }
    const F = legs.find((L) => L.k === 'f'); if (ti >= 5 && F) { const [x, y] = lerp2(F.knee, F.ankle, 0.6); flair(g, s, m, Math.round(x), Math.round(y)); }
  } },
};

// ---------- Händer och underarmar. c..d = underarmens sträcka (42 till 88 procent armbåge-hand). fist = nävens färg ----------
// ('m' = materialet, annars ett namn i C, saknas = hud eller rustningens hand)
export const HANDS = {
  bracers: { draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k) {             // bågskyttens armskydd i läder med snörning
    g.thick(cx, cy, dx, dy, 5.2 + lw, m, 3);
    for (const u of [0.25, 0.55, 0.85]) g.dot(cx + (dx - cx) * u, cy + (dy - cy) * u, ti === 0 ? C.rope : C.bone, 5);
    if (ti === 0) g.dot(cx + (dx - cx) * 0.4 + 1, cy + (dy - cy) * 0.4, C.red, 4);                                       // trä: en röd knut
    if (ti >= 2) { g.thick(cx, cy, cx + (dx - cx) * 0.18, cy + (dy - cy) * 0.18, (5.6 + lw) * Math.min(1.15, k), s.trim, 4); g.thick(dx - (dx - cx) * 0.12, dy - (dy - cy) * 0.12, dx, dy, 5.4 + lw, s.trim, 3); }
    if (ti >= 4) g.ell((cx + dx) / 2, (cy + dy) / 2, 1.2, 1.2, s.gem, false, null, Math.floor(T * 3) % 2 ? 5 : 4);
  } },
  gauntlets: { fist: 'm', draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k) {   // järnhandskar med vid manschett
    g.thick(cx, cy, dx, dy, 5.6 + lw, m, 4);
    g.ell(cx, cy, (3.2 + lw / 2) * k, (3 + lw / 2) * k, m); g.dot(cx - 1, cy - 1, C.white, ti >= 2 ? 5 : 4);
    if (ti === 0) g.dot(cx + 1, cy + 1, C.red, 4); else g.dot((cx + dx) / 2, (cy + dy) / 2, s.trim, 5);
    if (ti >= 3) g.ell(cx, cy, (3.2 + lw / 2) * k, (3 + lw / 2) * k, s.trim, false, (ex, ey, d2) => d2 > 0.62, 4);
    if (ti >= 4) g.dot(cx, cy, s.gem, 5);
    if (ti >= 5) g.poly([[cx - 1, cy - 2.5], [cx - 2.5 * k, cy - 5 * k], [cx + 1, cy - 2.5]], s.trim, 4);               // en pigg på manschetten
  } },
};
function handPiece(g, it, cx, cy, dx, dy, lw, lv) { const H = HANDS[it.type]; piece(g, it, (q, m, s, ti, k) => H.draw(q, m, s, cx, cy, dx, dy, lw, lv, ti, k, it)); }
const fistOf = (it) => { const H = it && HANDS[it.type]; return H && H.fist ? (typeof H.fist === 'function' ? H.fist(it) : H.fist === 'm' ? R(it.hex) : C[H.fist]) : null; };
// Fingerlösa handskar (v21): fingrarna syns framtill på näven.
function knuckles(g, it, x, y, skin) { const H = it && HANDS[it.type]; if (!H || !H.knuckle) return; g.dot(rd(x + 1.2), rd(y - 1.4), skin, 4); g.dot(rd(x + 1.6), rd(y), skin, 3); }
// Kroppar och bälten som ersätter halsduken (plåtens krage, kåpans krage, remmen över bröstet).
const NOSCARF = { robe: 1, plate: 1, bandolier: 1 };

// ---------- Bälten. y = bältets översta rad (HIP-3), tre rader högt, x 30,5 till 46,5 ----------
export const BELT = {
  pouchbelt(g, it, m, s, y, t, ti, k) {               // jägarens bälte med pung
    g.rect(30.5, y, 16, 3, ti === 0 ? C.rope : C.leather, 2);
    if (ti === 0) { g.rect(37.5, y, 2, 3, C.wood, 4); g.dot(38, y + 1, C.dark, 1); }                                     // trä: knebel av trä
    else { g.rect(37.5, y - 0.5, 3 * k, 4, ti >= 3 ? s.trim : m, 4); g.dot(38.5, y + 1, C.dark, 1); }
    g.rect(41.5, y + 2.5, 5 * k, 4.5 * k, m, 3); g.rect(41.5, y + 2.5, 5 * k, 1.6, m, 5);
    g.dot(43.5, y + 4, ti === 0 ? C.red : ti >= 4 ? s.gem : C.gold, 5);
    if (ti >= 6) flair(g, s, m, 44, y + 6);
  },
  swordbelt(g, it, m, s, y, t, ti, k) {               // riddarens bälte med stort spänne, nitar och en hängare
    g.rect(30.5, y, 16, 3, C.dark, 2);
    for (const x of [32, 35, 43, 45]) g.dot(x, y + 1, ti === 0 ? C.wood : m, 5);
    g.ell(39, y + 1.5, 3 * k, 2.6 * k, m); g.dot(38, y + 0.5, C.white, ti >= 2 ? 5 : 4);
    if (ti === 0) g.rect(37.5, y + 1, 3, 1, C.red, 3);
    if (ti >= 3) g.ell(39, y + 1.5, 3 * k, 2.6 * k, s.trim, false, (ex, ey, d2) => d2 > 0.6, 4);
    if (ti >= 4) g.dot(39, y + 1, s.gem, 5);
    g.rect(43.5, y + 3, 2, 3, C.dark, 2); g.dot(44, y + 5, m, 4);
    if (ti >= 6) flair(g, s, m, 34, y + 4);
  },
};
// ---------- Berlocker: småsaker som hänger i bältet, bara utseende. [x, y] = upphängningen (vänster om spännet) ----------
export const CHARM = {
  pouch(g, [x, y], t, it) { g.line(x, y, x, y + 2, C.rope, 3); g.ell(x, y + 4.5, 2.4, 2.4, R(it.hex)); g.rect(x - 1.5, y + 2.2, 3, 1, C.rope, 4); g.dot(x, y + 4, C.red, 4); },
  potion(g, [x, y], t, it) { const m = R(it.hex); g.rect(x - 0.6, y, 1.2, 2, C.wood, 3); g.ell(x, y + 4.5, 2.2, 2.6, m); g.ell(x, y + 5, 1.4, 1.4, m, false, null, Math.floor(t * 2) % 2 ? 5 : 4); g.dot(x - 1, y + 3.5, C.white, 5); },
  scroll(g, [x, y], t, it) { g.rect(x - 1.2, y, 2.6, 6.5, C.bone, 4); g.rect(x - 1.6, y + 2.5, 3.4, 1, R(it.hex), 3); },
  horn(g, [x, y], t, it) { g.poly([[x - 1, y], [x + 2, y + 1], [x + 1.5, y + 4], [x - 1, y + 7.5], [x - 0.5, y + 3]], C.bone, 4); g.rect(x - 1, y + 1, 3, 1, R(it.hex), 3); },
  keys(g, [x, y], t, it) { g.ell(x, y + 2, 1.8, 1.8, C.gold, false, (dx, dy, d2) => d2 > 0.35, 4); g.rect(x - 1.5, y + 3.5, 1, 4, C.gold, 4); g.rect(x - 1.5, y + 6.5, 2, 1, C.gold, 4); g.rect(x + 0.8, y + 3.5, 1, 3, C.iron, 4); },
  lantern(g, [x, y], t, it) { const on = Math.floor(t * 3) % 3 ? 5 : 4; g.line(x, y, x, y + 1.5, C.iron, 3); g.rect(x - 2, y + 1.5, 4, 5.5, C.iron, 2); g.rect(x - 1.2, y + 2.5, 2.4, 3.5, C.fire2, on); g.dot(x, y + 3.5, C.white, 5); },
  owl(g, [x, y], t, it) { const bl = t % 3.3 < 0.15, m = R(it.hex); g.ell(x, y + 3, 2.8, 3.2, m); g.dot(x - 1.5, y + 0.5, m, 4); g.dot(x + 1.5, y + 0.5, m, 4); if (!bl) { g.dot(x - 1, y + 2, C.white, 5); g.dot(x + 1, y + 2, C.white, 5); } g.dot(x, y + 3.2, C.fire2, 4); },
};
const CHARM_AT = [34.5, 47];
function drawCharm(g, it, t, at = CHARM_AT) { const sw = rd(Math.sin(t * 2.1) * 0.6); g.begin(); g.push(at[0] + sw, at[1], sw * 0.08); CHARM[it.type](g, [0, 0], t, it); g.pop(); g.end(); }

// ---------- Nya kroppar (rustningsplatsen) ----------
export const BODY = {
  vest(g, it, ar, s, y, t, bd, w) {         // jägarväst med flikig kjol och en rem för kogret
    const ti = tierG(it);
    g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [45.5, HIP + 1], [31.5, HIP + 1]], ar, 3);
    g.poly([[31, HIP], [46, HIP], [46.5, HIP + 5], [44, HIP + 3], [41.5, HIP + 5.5], [39, HIP + 3], [36.5, HIP + 5.5], [34, HIP + 3], [31, HIP + 5]], ar, 2);
    g.poly([[35, y], [42, y], [38.5, y + 5]], C.leather, 3); g.dot(37.5, y + 2, C.bone, 4); g.dot(39.5, y + 2, C.bone, 4);
    g.thick(44.5, y + 1, 33, HIP - 3, 1.6, C.leather, 2);
    g.rect(31, HIP - 2.5, 15, 2.5, C.leather, 2); g.rect(37.5, HIP - 3, 3, 3.5, ti === 0 ? C.rope : C.gold, 4);
    if (ti >= 4) for (const x of [32, 36.5, 41, 45]) g.dot(x, HIP + 3, s.gem, 5);                                       // en sten i varje flik
  },
};

// ---------- Kogret (sköldplatsen, "off-hand") bärs på ryggen och ger sitt liv som en sköld ----------
// Pilarnas fjädrar visar vilka pilar bågen skjuter: arrowLook (samma regel i striden, battle.js).
export const ON_BACK = { quiver: 1 };
// Skölden i närmaste handen (null om off-hand-saken bärs på ryggen). Paraden, handens läge och skillträdet läser den här.
// Med ett tvåhandsvapen (steg 4, TWO) hänger skölden på ryggen och räknas inte som en sköld i handen.
export const heldShield = (gear) => (gear && gear.shield && !ON_BACK[gear.shield.type] && SHIELD[gear.shield.type] && !twoHanded(gear) ? gear.shield : null);
// Pilarna (bara utseende): materialet från bågen eller kogret, det som har högst material (kogret vid lika). t = materialsteget.
// fletch = fjädrarnas färg: Wooden vita, Iron röda, sedan materialets färg.
export function arrowLook(bow, quiver) {
  const q = quiver && quiver.type === 'quiver' ? quiver : null, src = q && (!bow || tierOf(q) >= tierOf(bow)) ? q : bow;
  if (!src) return null; const t = tierOf(src);
  return { t, mat: src.mat, hex: src.hex, fletch: t === 0 ? '#ffffff' : t === 1 ? '#d8433b' : src.hex };
}
function drawQuiver(g, it, b, t) {
  const m = R(it.hex), s = mat(it), ti = tierG(it), al = arrowLook(null, it), fl = R(al.fletch), n = 3 + Math.min(3, Math.max(0, ti) >> 1);
  g.begin(); g.push(29, SH + 9 + b, -0.5, gr(GRAND.shield, it) * 1.1);
  for (let i = 0; i < n; i++) { const x = -2.6 + i * 5.2 / (n - 1), h = 4 + (i % 2) * 1.5; g.line(x, -10, x, -10 - h, C.wood, 3); g.poly([[x - 1, -10 - h + 0.5], [x, -10 - h - 2.5], [x + 1, -10 - h + 0.5]], i % 2 && ti >= 1 ? C.white : fl, 4); }
  g.rect(-3.5, -10, 7, 18, m, 3); g.rect(-3.5, -10, 2, 18, m, 4);
  g.rect(-4, -10.5, 8, 2, ti === 0 ? C.rope : s.trim, 4); g.rect(-4, 5, 8, 2, ti === 0 ? C.rope : s.trim, 3);
  if (ti === 0) { g.rect(-3.5, -3, 7, 1, C.red, 3); g.rect(-3.5, 0, 7, 1, C.red, 3); } else flair(g, s, m, 0.5, -2);
  if (ti >= 6) { const k = Math.floor(t * 6) % 2; g.dot(-1 + k, -17 - k, C.white, 5); }                                // glimt i spetsarna
  g.pop(); auraEnd(g, m, hintOf(it));
}

// ---------- Nya ryggsaker ----------
const capeOver = (extra, col) => (g, it, m, b, t, s) => { if (col) m = col(it); BACK.cape(g, it, m, b, t, s); const y = SH + 1 + b, k = gr(GRAND.cape, it), wv = (i) => rd(Math.sin(t * 1.7 - i * 0.9) * (0.5 + i * 0.55) * gr(GRAND.flutter, it)); g.begin(); extra(capeMap(g, 44, y, 0.55 + 0.45 * k, k), it, m, s, y, wv, t, b); g.end(); };
Object.assign(BACK, {
  leafcloak: capeOver((q, it, m, s, y, wv, t) => {       // jägarens mantel med löv, fler löv för varje material
    const ti = tierG(it), L = [[28, y + 6, 1], [25, y + 12, 1], [22, 49, 2], [18, 54, 3], [24, 58, 2], [31, 59, 1], [20, 45, 2], [27, 52, 2], [33, 55, 1]];
    const n = Math.min(L.length, 4 + Math.max(0, ti) * 0.6);
    for (let j = 0; j < n; j++) { const [x, yy, i] = L[j], X = x + wv(i); q.poly([[X - 2, yy], [X, yy - 2.5], [X + 2, yy], [X, yy + 2.5]], ti >= 3 && j % 3 === 0 ? s.trim : C.leaf, 4); q.dot(X, yy, C.leaf, 2); }
    if (ti >= 7 && Math.floor(t * 2) % 2) q.dot(23 + wv(2), 50, C.white, 5);
  }),
});

// ---------- Nya vapen (greppet i origo, spetsen uppåt) ----------
Object.assign(WEAPON, {
  knives(g, m, s) {                         // tre kastknivar i en solfjäder
    for (const [a, lv] of [[-0.42, 3], [0.42, 2], [0, 4]]) {
      g.push(0, -1, a); g.poly([[-1.3, -3], [1.3, -3], [0.7, -11.5], [0, -13.5], [-0.7, -11.5]], m, lv + 1);
      if (s.shine || s.radiant || s.facet || s.jag) g.dot(-0.5, -10, C.white, 5); if (s.ember) g.dot(0, -8, C.fire2, 5); if (s.smoke) g.dot(0, -8, C.purple, 5);
      g.rect(-1.2, -3, 2.4, 4.5, s.grip || C.leather, 2); g.rect(-1.6, -3.6, 3.2, 1, s.rough ? C.red : s.trim, 4); g.pop();
    }
  },
});
Object.assign(LEN, { knives: 15 });
Object.assign(HOLD, { knives: 0.3 });
const WK = { knives: 1.05 };

// =====================================================================================================================
// ---------- Steg 3 (balans v21): Rogue och Mage, kaststjärnor och det som hålls i närmaste handen (HELD) ----------
// Samma regler som ovan: varje del är en egen del med aura från Steel, trä är handgjort (stygn, målad rand, knuten snodd),
// Iron enkelt, Steel blänk, Golden kantband, Emerald ädelsten, Ice och uppåt materialets särdrag (flair).
// =====================================================================================================================
const fdot = (g, x, y, rp, lv) => g.dot(rd(x), rd(y), rp, lv);
// Byggets egen tygfärg blandad med materialets (v21): ett mörkt Rogue-tyg i Wooden är brunsvart, i Golden mörkt med en gyllene
// ton. Så har bygget sin siluett och materialet syns ändå. f = materialets andel. Ramperna sparas.
const MIX = {};
function mix(base, it, f) {
  const key = base + it.hex + f; if (MIX[key]) return MIX[key];
  const h = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16)), a = h(base), b = h(it.hex);
  return (MIX[key] = R('#' + a.map((v, i) => Math.round(v * (1 - f) + b[i] * f).toString(16).padStart(2, '0')).join('')));
}
const ROGUE = '#2f2b45';
const dk = (it, f = 0.38) => mix(ROGUE, it, f);
Object.assign(LEGS, {
  strapped: { draw(g, it, m, s, legs, ti, k) {          // mörka smala byxor med remmar runt smalbenen och en kniv på låret (Rogue)
    m = dk(it);
    for (const L of legs) { limb(g, L.hip, L.knee, 6.2, 5.6, m, L.lv - 1); limb(g, L.knee, L.ankle, 5.6, 5.2, m, L.lv - 1); }
    const strap = ti === 0 ? C.rope : C.leather, n = ti >= 3 ? 3 : 2, stud = ti === 0 ? C.red : ti >= 2 ? s.trim : C.iron;
    for (const L of legs) for (let j = 0; j < n; j++) {
      const [x, y] = lerp2(L.knee, L.ankle, 0.15 + j * 0.6 / (n - 1));
      g.line(x - 3, y - 0.5, x + 3, y + 0.5, strap, L.lv + 1); fdot(g, x + 1.5, y, stud, 5);
    }
    const F = legs.find((L) => L.k === 'f'), B = legs.find((L) => L.k === 'b');
    if (F) {
      const [x, y] = lerp2(F.hip, F.knee, 0.45);
      g.line(x - 3.2, y, x + 3.2, y + 0.5, strap, 3);                                                                       // rem runt låret
      if (ti >= 1) { g.rect(x + 0.5, y - 1.5, 1.6, 5, C.dark, 2); g.rect(x + 0.2, y - 2.5, 2.2, 1, ti >= 3 ? s.trim : C.iron, 4); }   // en liten kniv i baljan
      if (ti >= 4) fdot(g, x + 1.2, y + 2.5, s.gem, 5);
      if (ti >= 5) flair(g, s, m, rd(F.knee[0]), rd(F.knee[1] - 1));
    }
    if (ti === 0 && B) { const [x, y] = lerp2(B.hip, B.knee, 0.5); g.rect(x - 1.5, y, 3, 2, C.rag3, 3); fdot(g, x - 1.5, y, C.dark, 1); }   // trä: en lapp
  } },
  leggings: { draw(g, it, m, s, legs, ti, k) {          // smala byxor med broderade stjärnor (Mage). Under kåpan syns de i slitsen.
    for (const L of legs) { limb(g, L.hip, L.knee, 6, 5.4, m, L.lv); limb(g, L.knee, L.ankle, 5.4, 5, m, L.lv); }
    const n = Math.min(4, 2 + (Math.max(0, ti) >> 1)), st = ti === 0 ? C.red : ti < 3 ? C.bone : s.gem;
    for (const L of legs) for (let j = 0; j < n; j++) {
      const [x, y] = j % 2 ? lerp2(L.knee, L.ankle, 0.25 + j * 0.15) : lerp2(L.hip, L.knee, 0.3 + j * 0.15);
      fdot(g, x + (j % 2 ? 1 : -0.5), y, st, 5);
      if (ti >= 5 && (Math.floor(T * 3) + j) % 3 === 0) { fdot(g, x + (j % 2 ? 2 : 0.5), y, C.white, 5); fdot(g, x + (j % 2 ? 1 : -0.5), y - 1, C.white, 4); }   // stjärnorna blinkar
    }
    if (ti >= 3) for (const L of legs) limb(g, lerp2(L.knee, L.ankle, 0.85), L.ankle, 5.2, 5, s.trim, L.lv + 1);       // kantband nertill
    const F = legs.find((L) => L.k === 'f'); if (ti >= 6 && F) flair(g, s, m, rd(F.knee[0]), rd(F.knee[1] - 3));
  } },
});
Object.assign(FEET, {
  softboots: { over: 1, draw(g, it, m, s, legs, ti, k) {   // mjuka låga stövlar med snörning och nedvikt kant (Rogue)
    m = dk(it, 0.5);
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, 0.45);
      limb(g, top, L.ankle, 6, 5.8, m, L.lv);
      atFoot(g, L, () => { g.poly([[-3.5, -1], [2.5, -1], [5, 2.2], [5.4, 5], [-3.5, 5]], m, L.lv); g.rect(-3.5, 4.2, 8.9, 0.8, C.dark, 1); });
      limb(g, top, lerp2(top, L.ankle, 0.18 + 0.1 * k), 6.8, 6.6, ti >= 3 ? s.trim : m, L.lv + 2);                         // nedvikt kant
      for (const u of [0.45, 0.72]) { const [x, y] = lerp2(top, L.ankle, u); fdot(g, x - 1, y, ti === 0 ? C.rope : C.bone, 4); fdot(g, x + 1, y + 0.5, ti === 0 ? C.rope : C.bone, 4); }
      if (ti === 0) { const [x, y] = lerp2(top, L.ankle, 0.3); fdot(g, x + 2.5, y, C.red, 4); }                               // trä: en röd tofs
      if (ti >= 4) atFoot(g, L, () => g.dot(2, 1, s.gem, 5));
    }
    const F = legs.find((L) => L.k === 'f'); if (ti >= 5 && F) { const [x, y] = lerp2(F.knee, F.ankle, 0.7); flair(g, s, m, rd(x), rd(y)); }
  } },
  curled: { draw(g, it, m, s, legs, ti, k) {             // spetsiga skor med uppsvängd tå som blir högre för varje material (Mage)
    const c = Math.max(0, k - 0.75) * 2;
    for (const L of legs) atFoot(g, L, () => {
      g.poly([[-3.5, 0.5], [2, 0.5], [5, 2.6], [7.5, 2 - c * 0.4], [9, -0.5 - c], [9.6, 1.5 - c * 0.5], [8, 4.2], [5.5, 5], [-3.5, 5]], m, L.lv);
      g.rect(-3.5, 4.3, 9, 0.7, C.dark, 1);
      if (ti >= 3) g.rect(0.5, 1, 1.5, 4, s.trim, 4);                                                                     // kantband över vristen
      g.dot(9, -1.5 - c, ti === 0 ? C.red : s.gem, 5);                                                                   // tofs eller sten i spetsen
      if (ti >= 6 && Math.floor(T * 3 + L.lv) % 2) g.dot(9, -2.5 - c, C.white, 5);
    });
  } },
});
Object.assign(HANDS, {
  fingerless: { fist: (it) => dk(it, 0.45), knuckle: 1, draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k, it) {   // fingerlösa handskar med manschett (Rogue)
    m = dk(it, 0.45); g.thick(cx, cy, dx, dy, 4.9 + lw, m, 2);
    g.thick(cx, cy, cx + (dx - cx) * 0.22, cy + (dy - cy) * 0.22, (5.6 + lw) * Math.min(1.15, k), ti === 0 ? C.rope : ti >= 3 ? s.trim : C.leather, 3);
    for (const u of [0.45, 0.7]) fdot(g, cx + (dx - cx) * u, cy + (dy - cy) * u, ti === 0 ? C.red : ti >= 2 ? s.trim : C.iron, 5);   // nitar
    if (ti >= 4) g.ell((cx + dx) / 2, (cy + dy) / 2 + 0.5, 1, 1, s.gem, false, null, 5);
    if (ti >= 5) g.poly([[cx - 1, cy - 2], [cx - 2.5 * k, cy - 4.5 * k], [cx + 1, cy - 2]], s.trim, 4);
  } },
  runebracers: { draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k) {   // armskydd med en rune som lyser (Mage)
    g.thick(cx, cy, dx, dy, 5 + lw, m, 3);
    if (ti === 0) for (const u of [0.15, 0.85]) fdot(g, cx + (dx - cx) * u, cy + (dy - cy) * u, C.rope, 5);
    else if (ti >= 2) { g.thick(cx, cy, cx + (dx - cx) * 0.15, cy + (dy - cy) * 0.15, (5.5 + lw) * Math.min(1.15, k), s.trim, 4); g.thick(dx - (dx - cx) * 0.12, dy - (dy - cy) * 0.12, dx, dy, 5.3 + lw, s.trim, 3); }
    const mx = (cx + dx) / 2, my = (cy + dy) / 2, rp = ti === 0 ? C.red : ti < 2 ? C.bone : s.gem, on = ti >= 2 && Math.floor(T * 3) % 2 ? 5 : 4;
    fdot(g, mx, my - 1, rp, on); fdot(g, mx, my, rp, on); fdot(g, mx + 1, my - 1, rp, on); fdot(g, mx - 1, my + 1, rp, on);   // runan
    if (ti >= 5) fdot(g, mx + 1, my + 1, C.white, 5);
  } },
});
Object.assign(BELT, {
  bandolier(g, it, m, s, y, t, ti, k, b = 0) {           // bälte och en rem över bröstet med kastknivar (Rogue). Ersätter halsduken.
    g.rect(30.5, y, 16, 3, C.leather, 2);
    const y0 = SH + 1 + b, n = ti >= 3 ? 4 : 3;
    g.thick(33.5, y0, 45.5, y + 1, 2.4, ti === 0 ? C.rope : C.leather, 3);
    for (let j = 0; j < n; j++) { const u = (j + 1) / (n + 1), x = 33.5 + 12 * u, yy = y0 + (y + 1 - y0) * u; g.rect(x - 0.8, yy - 3.5, 1.6, 2.6, ti === 0 ? C.wood : m, 5); g.rect(x - 0.8, yy - 1, 1.6, 2, C.dark, 3); }
    g.ell(38.5, y + 1.5, 1.8 * k, 1.8 * k, ti === 0 ? C.wood : ti >= 3 ? s.trim : m);
    if (ti === 0) g.dot(38, y + 1, C.red, 4); else if (ti >= 4) g.dot(38, y + 1, s.gem, 5);
    if (ti >= 6) flair(g, s, m, 44, y + 2);
  },
  ropebelt(g, it, m, s, y, t, ti, k) {                   // rep med en skriftrulle och en flaska (Mage)
    g.rect(30.5, y + 0.5, 16, 2, C.rope, 3); for (let x = 31; x < 46; x += 2) g.dot(x, y + 1, C.rope, 1);           // tvinnat rep
    g.ell(40, y + 1.5, 1.6 * k, 1.6 * k, ti >= 3 ? s.trim : C.rope); g.line(39.5, y + 2.5, 39, y + 6, C.rope, 3);
    g.rect(41.6, y + 3, 2.6, 6.5, C.bone, 4); g.rect(41.2, y + 5.5, 3.4, 1, ti === 0 ? C.red : m, 3);               // skriftrullen
    g.rect(45.2, y + 2.5, 1.5, 1.5, C.wood, 3); g.ell(46, y + 6, 2.2 * k, 2.4 * k, m);                               // flaskan
    g.dot(45, y + 5, C.white, 5);
    if (ti >= 5) g.ell(46, y + 6.5, 1.2, 1.2, s.gem, false, null, Math.floor(t * 2) % 2 ? 5 : 4);                    // drycken lyser
  },
});
Object.assign(BODY, {
  coat(g, it, ar, s, y, t, bd, w) {                      // lång rock med skört bakåt och hög krage (Rogue)
    const ti = tierG(it);
    g.poly([[30.5, HIP - 1], [36, HIP - 1], [32.5 + w * 0.5, 58], [27 + w, 57]], ar, 2);                             // skörtet
    g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [46, HIP + 4], [31, HIP + 4]], ar, 3);
    g.poly([[32.5, y - 2.5], [37, y - 1], [36, y + 4], [32, y + 3]], ar, 4);                                       // hög krage
    g.line(40.5, y + 2, 41.5, HIP + 4, ar, 1);
    for (const yy of [y + 4, y + 7, y + 10]) g.dot(42.5, yy, ti === 0 ? C.wood : ti >= 3 ? s.trim : C.iron, 5);
    g.rect(31, HIP - 2.5, 15, 2, C.dark, 2); g.rect(37.5, HIP - 3, 2.5, 3, ti === 0 ? C.rope : s.trim, 4);
    if (ti >= 3) { g.rect(31, HIP + 3, 15, 1, s.trim, 4); g.line(32.5, y - 2.5, 36, y + 4, s.trim, 4); }              // kantband
    if (ti >= 4) g.ell(34.5, y + 1, 1.2, 1.2, s.gem, false, null, 5);
  },
});
ARM_AS.coat = 'chain';
// Kroppar vars tyg har byggets färg (v21): rockens färg är Rogue-tyget blandat med materialet (ärmar och kropp lika).
const BODYCOL = { coat: (it) => dk(it, 0.4) };
const bodyCol = (it) => (BODYCOL[it.type] ? BODYCOL[it.type](it) : R(it.hex));                                   // rockens ärmar som ringbrynjans (tyg ända ner, läder vid handleden)
Object.assign(HELM, {
  bandana: { draw(g, it, m, Y, s, sw) {                  // tygluva med knut bakåt och en duk för munnen (Rogue)
    const ti = tierG(it), L = ti >= 3 ? 2 : 0; m = dk(it, 0.45);
    g.poly([[29, Y - 6], [24 - L + sw[1], Y - 5 + sw[0]], [21 - L + sw[1], Y + sw[0]], [26, Y - 2], [23 - L + sw[1], Y + 4 + L + sw[0]], [30, Y - 2]], m, 2);   // knutens flikar
    g.ell(HX, Y + 0.5, 12, 11, m, true, (dx, dy) => dy < -0.38 - dx * 0.08 || (dx < -0.5 && dy < 0.2));
    g.poly([[40.5, Y + 3.5], [51.6, Y + 2.5], [51.6, Y + 8], [45, Y + 9.5], [40.5, Y + 7.5]], m, 3); g.line(42, Y + 6, 50, Y + 5, m, 1);   // duken
    if (ti === 0) for (const x of [43, 46, 49]) g.dot(x, Y + 3.5, C.red, 4);                                          // trä: stygn
    if (ti >= 2) for (const x of [33, 38, 43]) g.dot(x, Y - 4.5, ti >= 3 ? s.trim : C.steel, 5);
    if (ti >= 3) g.rect(29, Y - 4, 21, 1, s.trim, 4);
    if (ti >= 4) g.dot(45, Y - 8, s.gem, 5);
    if (ti >= 5) flair(g, s, m, 36, Y - 7);
  } },
});
// ---------- Det som hålls i närmaste handen (off-hand utan sköld). Origo i handen. Syns inte med tvåhandsvapen. ----------
export const HELD = {
  book: { draw(g, it, m, s, t, ti) {                     // en uppslagen bok som svävar vid handen (Mage)
    const f = rd(Math.sin(t * 2.2) * 1), k = gr(GRAND.shield, it) * 1.08;
    g.push(-1, -8 + f, -0.15, k);
    g.poly([[-6.5, -3], [0, -1.5], [6.5, -3], [6.5, 4.5], [0, 6], [-6.5, 4.5]], m, 3);
    g.poly([[-5.5, -2.4], [0, -1], [0, 4.8], [-5.5, 3.6]], C.bone, 5); g.poly([[0, -1], [5.5, -2.4], [5.5, 3.6], [0, 4.8]], C.bone, 4);
    for (const yy of [0.5, 2.2]) { g.line(-4.5, yy - 0.5, -1, yy + 0.3, C.bone, 2); g.line(1, yy + 0.3, 4.5, yy - 0.5, C.bone, 1); }
    if (Math.floor(t * 0.8) % 3 === 0) g.poly([[0, -1], [3.5, -4.5], [4.5, 2], [0, 4.8]], C.bone, 5);                // en sida vänds
    if (ti === 0) { for (const yy of [-0.5, 1.5, 3.5]) g.dot(0, yy, C.red, 3); g.rect(2, 4.5, 1, 3, C.red, 4); }      // trä: sydd rygg och ett bokmärke
    if (ti >= 2) for (const [x, y] of [[-6.5, -3], [6, -3], [-6.5, 4], [6, 4]]) g.dot(x, y, s.trim, 5);               // hörnbeslag
    if (ti >= 3) g.line(-6.5, 4.5, 0, 6, s.trim, 4);
    if (ti >= 4) g.dot(0, 5.5, s.gem, Math.floor(t * 3) % 2 ? 5 : 4);
    if (ti >= 5) { const q = Math.floor(t * 4) % 2; g.dot(2.5, -5 - q, s.gem, 5); g.dot(2, -6 - q, s.gem, 4); g.dot(3, -6 - q, C.white, 5); }   // en rune som stiger ur boken
    if (ti >= 8) for (const [x, y] of [[-3, -6], [4.5, -7.5]]) if ((Math.floor(t * 3) + x) % 2) g.dot(x, y, C.white, 5);
    g.pop();
  } },
  parry: { draw(g, it, m, s, t, ti, ang = 1.1) {           // parerdolk med en sidogren på parerstången (Rogue)
    const d = { ...it, type: 'dagger' }, sv = g.anchor.tip, k = wk(d) * wsize(d);
    g.push(0, 0, ang); drawWeapon(g, d); g.pop(); g.anchor.tip = sv;                                                 // huvudvapnets spets står kvar för striden
    g.push(0, 0, ang, k); g.poly([[1.5, -4.2], [5.5, -8.5], [6, -7], [2.8, -3.5]], s.rough ? C.wood : s.trim, 4); g.thick(-2.8, -4, -3.4, 1.5, 1, s.rough ? C.rope : s.trim, 3); g.pop();
  } },
};

// ---------- Nya ryggsaker: trasig kappa och stjärnmantel ----------
Object.assign(BACK, {
  tattered: capeOver((q, it, m, s, y, wv, t) => {        // mörk kappa med trasig nederkant, fler flikar för varje material (Rogue)
    m = dk(it); const ti = tierG(it), L = [[36, 58, 1], [30, 60, 1], [24, 61, 2], [18, 57, 3], [33, 59.5, 1], [27, 61, 2], [21, 59.5, 3]];
    for (let j = 0; j < Math.min(L.length, 4 + Math.max(0, ti) * 0.4); j++) { const [x, yy, i] = L[j], X = x + wv(i); q.poly([[X - 2.5, yy - 1], [X + 2.5, yy - 1], [X + 0.5, yy + 3.5]], m, 2); }
    if (ti === 0) { q.dot(28 + wv(2), 50, C.dark, 1); q.dot(31 + wv(1), 46, C.dark, 1); }                        // trä: hål i tyget
    if (ti >= 3) q.thick(29, y + 3, 25 + wv(1), 42, 1.2, s.trim, 4);
    if (ti >= 7) for (let i = 0; i < 3; i++) { const u = (t * 0.6 + i / 3) % 1; q.dot(22 + i * 5 + wv(2), 60 - u * 8, C.purple, u < 0.5 ? 3 : 2); }   // rök ur flikarna
  }, (it) => dk(it)),
  mantle: capeOver((q, it, m, s, y, wv, t) => {          // stjärnmantel med kantband och stjärnor, fler för varje material (Mage)
    const ti = tierG(it), sc = ti === 0 ? C.red : ti < 3 ? C.bone : C.white;
    q.thick(29, y + 3, 25 + wv(1), 42, 1.4, ti === 0 ? C.rope : s.trim, 4); q.thick(25 + wv(1), 42, 16 + wv(3), 56, 1.4, ti === 0 ? C.rope : s.trim, 4);
    const n = 3 + Math.max(0, ti) * 0.6;
    for (let i = 0; i < n; i++) { const x = 24 + (i * 7) % 15 + wv(2), yy = 52 - (i * 5) % 14; if (ti < 5 || (Math.floor(t * 2) + i) % 4) { q.dot(x, yy, sc, 5); if (ti >= 4 && i % 2 === 0) { q.dot(x - 1, yy, sc, 4); q.dot(x + 1, yy, sc, 4); q.dot(x, yy - 1, sc, 4); q.dot(x, yy + 1, sc, 4); } } }
  }),
});

// ---------- Kaststjärnor (greppet i origo) ----------
Object.assign(WEAPON, {
  stars(g, m, s) {                                       // en kaststjärna som snurrar sakta i handen, en till bakom. Sex uddar från Golden.
    const pts = WT >= 3 ? 6 : 4, star = (lv0) => { for (let i = 0; i < pts; i++) { g.push(0, 0, i * 6.283 / pts); g.poly([[-2, 0], [0, -7], [2, 0]], m, i % 2 ? lv0 - 2 : lv0); if (s.jag && i % 2 === 0) g.poly([[0.6, -3], [3, -5], [1.2, -2]], m, 5); if (s.ember) g.dot(0, -5, C.fire2, 5); g.pop(); } };
    g.push(-2, -2.5, 0.4, 0.7); star(4); g.pop();
    g.push(1.5, -5, T * 1.4); star(5);
    g.ell(0, 0, 1.7, 1.7, s.rough ? C.red : s.trim); g.dot(0, 0, s.smoke ? C.purple : C.dark, 1);
    if (s.rough) for (let i = 0; i < 4; i++) { g.push(0, 0, i * 1.571); g.dot(0, -3, C.rope, 3); g.pop(); }          // trä: lindad med snöre
    if (s.shine || s.radiant || s.facet) g.dot(-1, -4, C.white, 5);
    if (s.gems || s.ornate) g.dot(0, -1, s.ornate ? C.red : C.white, 5);
    g.pop();
  },
});
Object.assign(LEN, { stars: 12 });
Object.assign(HOLD, { stars: 0 });
Object.assign(WK, { stars: 1.45 });

// =====================================================================================================================
// ---------- Steg 4 (balans v22): tvåhandsgreppet, Viking, Samurai och Engineer, sex nya vapen ----------
// =====================================================================================================================
C.pink = R('#f5a3c7'); C.straw = R('#d9b968');
// Vapen som hålls med två händer. Talet = var närmaste handen griper, i vapnets pixlar under bortre handen (längs skaftet).
// En sköld i off-hand hänger då på ryggen och ger sitt liv som förut; boken, solfjädern och parerdolken syns inte.
export const TWO = { katana: 7, greataxe: 6, halberd: 9, crossbow: 4.5 };
// Vapnets egen vila (inte under attacker eller ordbildernas ställningar): bortre handens läge, vinkeln, armbågen och late =
// vapnet ritas framför kroppen (efter huvudet) så att båda händerna syns på greppet.
export const CARRY = {
  katana: { hand: [44, 43.5], ang: 0.62, late: true, bend: [-1, 2] },
  crossbow: { hand: [45.5, 47], ang: 1.52, late: true, bend: [-1, 1] },
};
// Vilan gäller bara när ingen attack, parad eller ordbild styr handen och vapnet.
const carryOf = (gear, a = {}) => { const w = gear && gear.weapon, c = w && CARRY[w.type]; return c && a.wAng === undefined && !a.handB && !a.hand && !a.swing ? c : null; };
export const twoHanded = (gear) => !!(gear && gear.weapon && TWO[gear.weapon.type] != null);
const OFF_HIDE = (gear) => twoHanded(gear);                                  // det som hålls i närmaste handen syns inte

Object.assign(LEGS, {
  wrapped: { draw(g, it, m, s, legs, ti, k) {           // byxor med lindor i kors över smalbenen (Viking)
    for (const L of legs) { limb(g, L.hip, L.knee, 6.8, 6.2, m, L.lv); limb(g, L.knee, L.ankle, 6.2, 5.8, m, L.lv); }
    const w = ti === 0 ? C.rope : ti >= 3 ? s.trim : C.leather;
    for (const L of legs) for (let u = 0.1; u < 0.95; u += 0.2) { const [x, y] = lerp2(L.knee, L.ankle, u); g.line(x - 3, y + 1, x + 3, y - 0.5, w, L.lv + 1); }
    if (ti >= 4) for (const L of legs) fdot(g, L.knee[0], L.knee[1], s.gem, 5);
    const F = legs.find((L) => L.k === 'f'); if (ti >= 5 && F) flair(g, s, m, rd(F.hip[0] + 1), rd(F.hip[1] + 4));
  } },
  hakama: { draw(g, it, m, s, legs, ti, k) {            // vida veckade byxor som slutar vid fotleden (Samurai)
    for (const L of legs) {
      const a = L.hip, f = [L.ankle[0], L.ankle[1] + 3], d = 3.6, e = 5.4;
      g.poly([[a[0] - d, a[1]], [a[0] + d, a[1]], [f[0] + e + 0.5, f[1]], [f[0] - e, f[1]]], m, L.lv);
      for (const u of [-0.45, 0.1, 0.6]) g.line(a[0] + u * d, a[1] + 1, f[0] + u * e, f[1] - 0.5, m, 1);              // veck
      g.rect(f[0] - e, f[1] - 1, e * 2 + 0.5, 1, ti === 0 ? C.red : ti >= 3 ? s.trim : m, ti === 0 ? 3 : 4);
    }
    if (ti >= 4) { const F = legs.find((L) => L.k === 'f'); if (F) fdot(g, F.knee[0] + 1, F.knee[1], s.gem, 5); }
  } },
  cargo: { draw(g, it, m, s, legs, ti, k) {             // arbetsbyxor med fickor på låren (Engineer)
    for (const L of legs) { limb(g, L.hip, L.knee, 6.8, 6.2, m, L.lv); limb(g, L.knee, L.ankle, 6.2, 5.8, m, L.lv); }
    for (const L of legs) {
      const [x, y] = lerp2(L.hip, L.knee, 0.45);
      g.rect(x - 2, y - 1.5, 4 * k, 4, m, L.lv + 2); g.rect(x - 2, y - 1.5, 4 * k, 1.2, m, 5);                            // ficka med lock
      fdot(g, x, y - 1, ti === 0 ? C.wood : ti >= 3 ? s.trim : C.steel, 5);
      const [x2, y2] = lerp2(L.knee, L.ankle, 0.85); g.line(x2 - 3, y2, x2 + 3, y2, m, 1);                               // uppvikt kant
    }
    const B = legs.find((L) => L.k === 'b'); if (ti === 0 && B) { const [x, y] = lerp2(B.knee, B.ankle, 0.4); g.rect(x - 1.5, y, 3, 2, C.rag3, 3); }
    if (ti >= 5) { const F = legs.find((L) => L.k === 'f'); if (F) flair(g, s, m, rd(F.knee[0]), rd(F.knee[1] + 2)); }
  } },
});
Object.assign(FEET, {
  furboots: { over: 1, draw(g, it, m, s, legs, ti, k) {  // pälsstövlar med en tjock pälskant (Viking)
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, 0.25);
      limb(g, top, L.ankle, 6.6, 6.2, m, L.lv); atFoot(g, L, () => { g.poly([[-3.8, -1], [3, -1], [5.6, 2.2], [5.6, 5], [-3.8, 5]], m, L.lv); g.rect(-3.8, 4.2, 9.4, 0.8, C.dark, 1); });
      g.ell(top[0], top[1] + 0.5, 4.2 * Math.min(1.2, k + 0.1), 2.2, C.fur, true);                                        // pälskanten
      for (const dx of [-2.5, 0, 2.5]) fdot(g, top[0] + dx, top[1] + 2.2, C.fur, 3);
      if (ti >= 3) { const [x, y] = lerp2(top, L.ankle, 0.6); g.rect(x - 3.2, y, 6.4, 1, s.trim, 4); }
      if (ti === 0) { const [x, y] = lerp2(top, L.ankle, 0.6); g.line(x - 3, y, x + 3, y + 1, C.rope, 4); }
      if (ti >= 4) { const [x, y] = lerp2(top, L.ankle, 0.6); fdot(g, x, y, s.gem, 5); }
    }
  } },
  sandals: { draw(g, it, m, s, legs, ti, k) {           // vita strumpor, halmsula och en rem i materialet (Samurai)
    for (const L of legs) atFoot(g, L, () => {
      g.poly([[-3.2, -1], [2.2, -1], [5, 2.4], [5, 4], [-3.2, 4]], C.bone, L.lv + 1);
      g.rect(-3.8, 4, 9.4, 1.6, C.straw, L.lv); g.line(-3.6, 4.6, 5.4, 4.6, C.straw, 1);
      g.line(1.5, 2, 4.5, 3.6, m, 4); g.line(1.5, 2, -1, 3.6, m, 4);
      if (ti >= 3) g.dot(1.5, 2, s.trim, 5); if (ti >= 4) g.dot(1.5, 1.5, s.gem, 5);
    });
  } },
  workboots: { over: 1, draw(g, it, m, s, legs, ti, k) { // grova kängor med tjock sula och tåhätta (Engineer)
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, 0.55);
      limb(g, top, L.ankle, 6.4, 6.4, m, L.lv);
      atFoot(g, L, () => { g.poly([[-3.8, -1], [3, -1], [5.8, 2], [6, 4.4], [-3.8, 4.4]], m, L.lv); g.rect(-4, 4, 10.2, 1.8, C.dark, 2); g.ell(4.2, 2.6, 2.2 * Math.min(1.2, k), 1.7, ti === 0 ? C.wood : ti >= 3 ? s.trim : C.steel); });
      for (const u of [0.25, 0.6]) { const [x, y] = lerp2(top, L.ankle, u); g.line(x - 1.5, y, x + 1.5, y, ti === 0 ? C.rope : C.bone, 4); }
      if (ti >= 4) atFoot(g, L, () => g.dot(4, 2, s.gem, 5));
    }
  } },
});
Object.assign(HANDS, {
  furcuffs: { draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k) {     // läderlindor med pälskant vid armbågen (Viking)
    g.thick(cx, cy, dx, dy, 4.8 + lw, C.leather, 3);
    g.thick(dx - (dx - cx) * 0.25, dy - (dy - cy) * 0.25, dx, dy, 5.2 + lw, m, 3);                                      // band i materialet vid handleden
    g.ell(cx, cy, 3.2 * Math.min(1.2, k), 2.8, C.fur, true);
    if (ti === 0) fdot(g, (cx + dx) / 2, (cy + dy) / 2, C.red, 4); else if (ti >= 3) fdot(g, dx - (dx - cx) * 0.12, dy - (dy - cy) * 0.12, s.trim, 5);
    if (ti >= 4) fdot(g, (cx + dx) / 2, (cy + dy) / 2, s.gem, 5);
  } },
  kote: { fist: 'dark', draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k) {   // pansrade ärmar med plattor på mörkt tyg (Samurai)
    g.thick(cx, cy, dx, dy, 5 + lw, C.dark, 2);
    for (const u of [0.15, 0.45, 0.75]) { const x = cx + (dx - cx) * u, y = cy + (dy - cy) * u; g.ell(x, y, 2.2 * Math.min(1.2, k), 1.6, m, true); }
    if (ti >= 3) fdot(g, cx + (dx - cx) * 0.45, cy + (dy - cy) * 0.45, s.trim, 5);
    if (ti >= 4) fdot(g, cx + (dx - cx) * 0.75, cy + (dy - cy) * 0.75, s.gem, 5);
    if (ti === 0) fdot(g, cx, cy, C.pink, 4);
  } },
  workgloves: { fist: 'm', draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k) {   // grova arbetshandskar med vid manschett (Engineer)
    g.thick(cx + (dx - cx) * 0.5, cy + (dy - cy) * 0.5, dx, dy, 5.8 + lw, m, 3);
    g.ell(cx + (dx - cx) * 0.5, cy + (dy - cy) * 0.5, 3.4 * Math.min(1.2, k), 3.1, m, true);
    fdot(g, cx + (dx - cx) * 0.5, cy + (dy - cy) * 0.5 - 1, ti === 0 ? C.rope : ti >= 3 ? s.trim : C.steel, 5);
    if (ti >= 4) fdot(g, dx, dy - 1, s.gem, 5);
  } },
});
Object.assign(BELT, {
  hornbelt(g, it, m, s, y, t, ti, k) {                   // brett bälte, runt spänne och ett dryckeshorn (Viking)
    g.rect(30.5, y - 0.5, 16, 4, C.leather, 2);
    g.ell(38.5, y + 1.5, 2.8 * k, 2.8 * k, ti === 0 ? C.wood : m); g.ell(38.5, y + 1.5, 1.2, 1.2, C.leather, false, null, 2);
    g.poly([[43, y + 3], [47.5, y + 3.5], [48, y + 6], [46, y + 10.5], [45.5, y + 7], [43, y + 5]], C.bone, 4); g.rect(43, y + 3, 4.5, 1, ti === 0 ? C.rope : m, 3); g.dot(46, y + 10, C.dark, 2);
    if (ti >= 3) g.rect(44, y + 6, 3, 1, s.trim, 4); if (ti >= 4) g.dot(38, y + 1, s.gem, 5); if (ti >= 6) flair(g, s, m, 33, y + 2);
  },
  obi(g, it, m, s, y, t, ti, k) {                        // brett skärp med knut och en balja som sticker ut bakåt (Samurai)
    g.thick(35, y + 2.5, 22.5 - k * 1.5, y + 8.5, 2.6, C.dark, 2); g.thick(24.5 - k, y + 7.5, 22.5 - k * 1.5, y + 8.5, 2.8, ti === 0 ? C.wood : s.trim, 4);   // baljan
    g.rect(30.5, y - 1, 16, 4.6, m, 3); g.rect(30.5, y + 1, 16, 1, ti === 0 ? C.red : s.trim, 4);
    g.ell(32, y + 1.5, 2.4, 2.2, m); g.poly([[31, y + 3], [33, y + 3], [32.5, y + 9], [30.5, y + 8.5]], m, 2);              // knuten
    if (ti >= 4) g.dot(39, y + 1, s.gem, 5); if (ti >= 6) flair(g, s, m, 42, y + 1);
  },
  toolbelt(g, it, m, s, y, t, ti, k) {                   // verktygsbälte med skiftnyckel och en liten bomb med gnistrande stubin (Engineer)
    g.rect(30.5, y, 16, 3, C.leather, 2); g.rect(37.5, y - 0.5, 3 * k, 4, ti === 0 ? C.wood : m, 4);
    g.thick(45, y + 2.5, 46.5, y + 9.5, 1.4, ti >= 3 ? s.trim : C.steel, 4); g.poly([[45.5, y + 9], [48, y + 9], [48, y + 11], [47, y + 10.5], [45.5, y + 11]], ti >= 3 ? s.trim : C.steel, 4);   // skiftnyckeln
    g.ell(41.5, y + 5.5, 2.3, 2.3, C.dark); g.dot(41, y + 4.5, m, 5); g.line(42.5, y + 3.5, 43.5, y + 2.5, C.rope, 3); g.dot(44, y + 2, Math.floor(t * 8) % 2 ? C.fire2 : C.fire, 5);   // bomben
    if (ti >= 4) g.dot(38.5, y + 1, s.gem, 5);
  },
});
Object.assign(BODY, {
  furvest(g, it, ar, s, y, t, bd, w) {                   // pälsväst över bar överkropp, pälskrage (Viking)
    const ti = tierG(it);
    g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [45.5, HIP + 1], [31.5, HIP + 1]], ar, 3);
    g.poly([[37, y + 2], [40.5, y + 2], [41, HIP], [36.5, HIP]], C.fur, 3);                                         // pälskant fram
    g.ell(38.5, y + 1, 8.5 + bw(bd) * 0.5, 3, C.fur, true, null, 4); for (const x of [32, 36, 41, 45]) g.dot(x, y + 3.5, C.fur, 3);
    g.rect(30.5, HIP - 3, 16, 3.5, C.leather, 2); g.ell(38.5, HIP - 1.2, 2, 2, ti === 0 ? C.wood : s.trim);
    if (ti >= 4) g.dot(38, HIP - 2, s.gem, 5);
  },
  lamellar(g, it, ar, s, y, t, bd, w) {                  // rader av små plåtar med snörning, höftplåtar (Samurai)
    const ti = tierG(it), lace = ti === 0 ? C.red : ti < 3 ? C.pink : s.cloth;
    g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [45.5, HIP + 1], [31.5, HIP + 1]], ar, 3);
    for (let yy = y + 3; yy < HIP - 2; yy += 2.6) { g.rect(31, yy, 15, 1, ar, 1); for (let x = 32; x < 46; x += 3) g.dot(x, yy - 1, lace, 4); }
    g.rect(32, y, 13, 2.2, ar, 5);
    g.poly([[43 + bw(bd) * 0.6, y - 1], [49.5 + bw(bd), y], [49 + bw(bd), y + 7], [43.5, y + 6.5]], ar, 2); g.rect(43.5, y - 1, 6, 1.2, ti === 0 ? C.wood : s.trim, 4);   // bortre axelplåten
    g.rect(30.5, HIP - 2.5, 16, 2.5, lace, 3);
    for (const [x, lv] of [[30.5, 2], [35.8, 3], [41.1, 2]]) { g.rect(x, HIP, 5, 6, ar, lv); g.rect(x, HIP + 2.5, 5, 1, ar, 1); g.dot(x + 2, HIP + 1, lace, 4); }
  },
  overalls(g, it, ar, s, y, t, bd, w) {                  // hängselbyxor över en skjorta (Engineer)
    const ti = tierG(it);
    g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [45.5, HIP + 1], [31.5, HIP + 1]], ti === 0 ? C.rag : s.cloth, 3);
    g.poly([[33.5, y + 5], [43.5, y + 5], [44.5, HIP + 1], [32.5, HIP + 1]], ar, 3);
    g.thick(33.5, y + 5, 32.5, y, 2, ar, 4); g.thick(43.5, y + 5, 44.5, y, 2, ar, 4);
    const btn = ti === 0 ? C.wood : ti >= 3 ? s.trim : C.steel; g.dot(33.5, y + 5, btn, 5); g.dot(43.5, y + 5, btn, 5);
    g.rect(36.5, y + 7, 4, 3, ar, 4); g.rect(36.5, y + 7, 4, 1, ar, 5);                                          // bröstficka
    if (ti === 0) { g.rect(41, y + 10, 2, 2, C.rag3, 3); g.dot(41, y + 10, C.dark, 1); }
    if (ti >= 4) g.dot(38.5, y + 8.5, s.gem, 5);
  },
});
Object.assign(ARM_AS, { furvest: 'skin', lamellar: 'chain', overalls: 'tunic' });
NOSCARF.lamellar = 1; NOSCARF.furvest = 1;
Object.assign(HELM, {
  kabuto: { draw(g, it, m, Y, s) {                       // hjälm med nackskydd i lameller, sidoflikar och en V-formad kam (Samurai)
    const ti = tierG(it);
    g.poly([[28.5, Y - 3], [34, Y - 3], [34, Y + 7], [25, Y + 9], [26, Y + 3]], m, 2); for (const yy of [Y, Y + 3, Y + 6]) g.line(26, yy, 33.5, yy, m, 1);
    dome(g, Y, m, helmS); g.rect(28.5, Y - 3.5, 23, 1.6, ti === 0 ? C.red : s.trim, 3);
    g.poly([[29, Y - 4], [26.5, Y - 8], [31.5, Y - 6]], m, 4); g.poly([[50, Y - 4], [53, Y - 8], [48, Y - 6]], m, 3);
    pushAt(g, 44, Y - 9, gr(GRAND.crest, it)); g.thick(44, Y - 9, 37.5, Y - 19, 1.6, ti === 0 ? C.wood : s.trim, 5); g.thick(44, Y - 9, 50.5, Y - 19, 1.6, ti === 0 ? C.wood : s.trim, 4); g.ell(44, Y - 9, 1.6, 1.6, s.gem); g.pop();
    for (let x = 31; x < 49; x += 3) g.line(x, Y - 11, x, Y - 5, m, 2);
    if (ti >= 5) flair(g, s, m, 36, Y - 6);
  } },
  goggles: { draw(g, it, m, Y, s) {                      // läderluva med öronlappar och skyddsglasögon i pannan (Engineer)
    const ti = tierG(it);
    g.ell(HX, Y + 0.5, 11.9, 10.9, C.leather, true, (dx, dy) => dy < -0.3 - dx * 0.1 || (dx < -0.45 && dy < 0.7));
    g.poly([[29, Y], [34, Y - 1], [34.5, Y + 6], [31, Y + 8]], C.leather, 3); g.dot(31.5, Y + 3, C.bone, 4);
    g.rect(29, Y - 6.5, 23, 1.6, ti === 0 ? C.rope : C.dark, 2);
    for (const [x, r] of [[43, 2.8], [48.5, 2.6]]) { g.ell(x, Y - 6, r + 0.8, r + 0.6, ti === 0 ? C.wood : ti >= 3 ? s.trim : C.steel); g.ell(x, Y - 6, r - 0.6, r - 0.8, m, false, null, 4); g.dot(x - 1, Y - 7, C.white, 5); }
    if (ti >= 5 && Math.floor(T * 2) % 3 === 0) g.dot(48, Y - 6, C.white, 5);
  } },
});
Object.assign(SHIELD, {
  cog(g, m, s) {                                         // kugghjulssköld (Engineer)
    for (let i = 0; i < 8; i++) { g.push(0.5, 0.5, i * Math.PI / 4); g.rect(-1.9, -10.2, 3.8, 3.2, m, i % 2 ? 2 : 4); g.pop(); }
    g.ell(0.5, 0.5, 8, 8, m, true); g.ell(0.5, 0.5, 8, 8, s.rough ? C.iron : s.trim, false, (dx, dy, d2) => d2 > 0.72, 3);
    g.ell(0.5, 0.5, 3, 3, s.gem); g.dot(-0.5, -0.5, C.white, 5); for (const [x, y] of [[-4, 0], [5, 0], [0.5, -4.5], [0.5, 4.5]]) g.dot(x, y, s.rough ? C.iron : s.trim, 5);
  },
});
SH_C.cog = [0.5, 0.5];
HELD.fan = { draw(g, it, m, s, t, ti) {                  // stridssolfjäder, öppnas lite och stängs (Samurai)
  const k = gr(GRAND.shield, it) * 1.1, o = 0.32 + Math.sin(t * 1.6) * 0.03;
  g.push(0, 0, -0.2, k);
  g.rect(-1, -1, 2, 5, C.dark, 2);
  for (let i = 0; i < 6; i++) { const a0 = -2.5 + i * o, a1 = a0 + o; g.poly([[0, 0], [Math.cos(a0) * 10, Math.sin(a0) * 10], [Math.cos(a1) * 10, Math.sin(a1) * 10]], i % 2 ? m : C.bone, i % 2 ? 3 : 4); }
  g.ell(-3.5, -6, 1.8, 1.8, ti >= 4 ? s.gem : C.red, false, null, 4);                                            // solen på solfjädern
  if (ti >= 3) for (let i = 0; i <= 6; i++) { const a = -2.5 + i * o; g.dot(rd(Math.cos(a) * 9.5), rd(Math.sin(a) * 9.5), s.trim, 5); }
  if (ti >= 6) { const a = -2.5 + (Math.floor(t * 4) % 6) * o; g.dot(rd(Math.cos(a) * 7), rd(Math.sin(a) * 7), C.white, 5); }
  g.pop();
} };
Object.assign(BACK, {
  furcloak: capeOver((q, it, m, s, y, wv, t) => {        // mantel med pälskrage, längre päls för varje material (Viking)
    const ti = tierG(it);
    q.poly([[25, y + 1], [34, y - 1], [34, y + 5], [27, y + 7]], C.fur, 4); for (const [x, yy] of [[26, y + 7], [29, y + 7.5], [32, y + 6]]) q.dot(x, yy, C.fur, 3);
    if (ti >= 3) q.thick(38, 58, 30 + wv(1), 60, 1.6, C.fur, 4);
    if (ti >= 4) q.dot(33, y + 2, s.gem, 5);
  }),
  banner(g, it, m, b, t, s) {                            // en liten fana på ryggen, vimpeln längre för varje material (Samurai)
    const y = SH + b, f = rd(Math.sin(t * 3) * 1.3), k = gr(GRAND.crest, it), ti = tierG(it);
    g.begin(); g.push(30, y + 10, 0, 0.75 + 0.25 * k);
    g.thick(0, 2, 0, -33, 1.4, s.pole || C.wood, 3); g.dot(0, -34, ti === 0 ? C.red : s.trim, 5);
    g.poly([[0, -32], [-11 + f, -31 + f * 0.5], [-12 + f, -17 + f], [0, -18]], m, 3); g.poly([[0, -32], [-11 + f, -31 + f * 0.5], [-11 + f, -29], [0, -30]], m, 5);
    g.ell(-5.5 + f * 0.5, -24.5, 2.6, 2.6, ti === 0 ? C.red : s.gem);
    if (ti >= 3) g.line(-12 + f, -17 + f, 0, -18, s.trim, 4);
    if (ti >= 6) { const q = Math.floor(t * 3) % 2; g.dot(-8 + f, -21 - q, C.white, 5); }
    g.pop(); auraEnd(g, m, hintOf(it));
  },
});

// ---------- Nya vapen (greppet i origo, spetsen uppåt) ----------
Object.assign(WEAPON, {
  katana(g, m, s) {                                      // lätt böjd klinga, rund parerplatta och långt lindat grepp
    g.poly([[-1.4, -6], [0.2, -6], [1.2, -20], [1.6, -30], [1, -36], [-0.2, -30], [-0.8, -20]], m, 5);
    g.poly([[0.2, -6], [1.6, -6], [2.6, -20], [2.8, -29], [1, -36], [1.6, -30], [1.2, -20]], m, 3);
    if (WT >= 5) for (let y = -9; y > -30; y -= 3) g.dot(y % 2 ? 1.6 : 2, y, C.white, 4);                           // härdlinjen
    if (s.shine || s.radiant || s.jag || s.facet) g.dot(1, -31, C.white, 5); if (s.ember) g.poly([[-0.6, -7], [1.6, -7], [1.2, -18]], C.fire2, 5); if (s.smoke) g.line(0.6, -8, 1.6, -28, C.dark, 1);
    if (s.rough) { g.rect(-1.4, -14, 4, 1.5, C.bone, 4); g.rect(-1.4, -20, 4.4, 1, C.red, 3); }
    g.rect(-1, -7.5, 2.6, 1.6, s.trim, 5); g.ell(0.3, -5.2, 3.2 * GWK, 1.6, s.rough ? C.wood : s.trim);
    if (s.gems || s.ornate) g.dot(0, -5.5, s.gem, 5);
    g.rect(-1.4, -3.8, 3, 11.5, C.dark, 2); for (let y = -3, i = 0; y < 7; y += 2, i++) g.dot(i % 2 ? 0.5 : -0.5, y, s.rough ? C.red : s.cloth, 4);
    g.rect(-1.6, 7.5, 3.4, 1.5, s.trim, 3);
  },
  greataxe(g, m, s) {                                    // stridsyxa med dubbla blad på långt skaft
    pole(g, s, 34);
    g.poly([[1.5, -34], [6, -39], [12.5, -37], [15.5, -30], [14.5, -22], [9, -19], [1.5, -24]], m, 3);
    g.poly([[6, -39], [12.5, -37], [15.5, -30], [14.5, -22], [9, -19], [11.5, -24], [12.5, -30], [10.5, -35]], m, 5);
    g.poly([[-1.5, -33.5], [-6, -37], [-11.5, -34.5], [-13, -29], [-12, -23.5], [-7, -21], [-1.5, -25]], m, 2);
    g.poly([[-6, -37], [-11.5, -34.5], [-13, -29], [-12, -23.5], [-10, -26], [-10.5, -31]], m, 4);
    g.rect(-2.5, -36, 5, 13, s.rough ? C.rope : s.trim, 3); g.ell(0, -29.5, 1.6, 1.6, s.gem); g.poly([[-1.6, -36], [0, -41], [1.6, -36]], s.rough ? C.wood : s.trim, 4);
    if (s.jag) { g.poly([[14.5, -30], [18, -32], [15, -27]], m, 5); g.poly([[-12.5, -29], [-16, -31], [-13, -26]], m, 4); }
    if (s.ember) g.poly([[3, -26], [11, -24], [12, -32], [7, -36]], C.fire2, 4);
    flair(g, s, m, 9, -29);
  },
  halberd(g, m, s) {                                     // hillebard: skaft ned till marken, yxblad, hake och spets
    const p = s.pole || C.wood; g.poly([[-1.3, 15], [1.3, 15], [1.3, -36], [-1.3, -36]], p, 3);
    g.rect(-1.8, -6, 3.6, 4, s.grip || C.leather, 3); g.rect(-1.8, 13, 3.6, 2, s.rough ? C.rope : s.trim, 3);
    g.poly([[1.3, -33], [5, -37], [10, -34.5], [11, -28], [8.5, -23], [1.3, -26]], m, 3); g.poly([[5, -37], [10, -34.5], [11, -28], [8.5, -23], [8, -26.5], [8.6, -31]], m, 5);
    g.poly([[-1.3, -32], [-6, -34.5], [-8, -38], [-4.6, -30.5], [-1.3, -28.5]], m, 2);
    g.poly([[-1.8, -36], [0, -46], [1.8, -36]], m, 4); g.poly([[0, -36], [0, -46], [1.8, -36]], m, 2);
    g.rect(-2, -37.5, 4, 2.5, s.rough ? C.rope : s.trim, 4); g.rect(-2, -25.5, 4, 2, s.rough ? C.rope : s.trim, 3);
    const f = rd(Math.sin(T * 3) * 1.2); g.poly([[-1.3, -25], [-4.5, -24], [-4.5 + f, -17], [-2.5 + f, -16.5]], s.cloth, 3);
    if (s.shine || s.radiant || s.facet) g.dot(-0.5, -42, C.white, 5);
    flair(g, s, m, 5.5, -30);
  },
  crossbow(g, m, s) {                                    // armborst: stocken längs vapnets axel, bågen tvärs över framtill
    const st = s.pole || C.wood;
    g.poly([[-2, 7], [2, 7], [1.6, -16], [-1.6, -16]], st, 3); g.rect(-2.4, 3, 4.8, 4.5, st, 2); g.rect(-0.6, -15, 1.2, 11, C.dark, 1);
    g.thick(-11, -9, -5, -13.5, 2.2, m, 4); g.thick(-5, -13.5, 0, -14.5, 2.2, m, 4); g.thick(0, -14.5, 5, -13.5, 2.2, m, 3); g.thick(5, -13.5, 11, -9, 2.2, m, 3);
    g.line(-11, -9, 0, -5, C.white, 4); g.line(11, -9, 0, -5, C.white, 4);
    g.rect(-0.7, -19, 1.4, 14, C.wood, 4); g.poly([[-1.6, -19], [0, -22.5], [1.6, -19]], WT >= 2 ? m : C.steel, 5); g.poly([[-1.8, -5], [0, -7.5], [1.8, -5]], WT >= 2 ? m : C.red, 4);   // bulten
    g.rect(-2.4, -14.5, 4.8, 2, s.rough ? C.rope : s.trim, 4); g.rect(-0.5, 1, 1, 2.5, C.dark, 1); flair(g, s, m, 0, -9);
    if (s.rough) g.rect(-2, -1, 4, 1, C.red, 3);
  },
  bomb(g, m, s) {                                        // rund bomb med band i materialet och en gnistrande stubin
    const k = Math.floor(T * 10) % 2;
    g.ell(2.5, -5, 4.8, 4.8, s.rough ? C.wood : C.dark); g.ell(2.5, -5, 4.8, 4.8, m, false, (dx, dy) => Math.abs(dy) < 0.24, 4);
    g.dot(0.5, -7.5, C.white, 5); g.dot(1, -8, C.white, 4); g.rect(3.5, -11.5, 2.4, 2, s.rough ? C.rope : C.iron, 3);
    g.line(4.7, -11.5, 6.5, -14.5, C.rope, 4); g.dot(6.5 + k, -15.5, C.fire2, 5); g.dot(7 - k, -15, C.fire, 5); g.dot(6 + k * 2, -16.5, C.white, 5);
    if (s.gems || s.ornate || s.facet) g.dot(2.5, -5, s.gem, 5); if (s.jag) g.poly([[-1.5, -4], [-4, -6], [-1.5, -7]], m, 5);
  },
  javelin(g, m, s) {                                     // kastspjut: smalt skaft, liten bladspets, fjädrar längst bak
    const p = s.pole || C.wood; g.poly([[-1.1, 9], [1.1, 9], [1.1, -30], [-1.1, -30]], p, 3);
    g.rect(-1.6, -4, 3.2, 6, s.grip || C.leather, 3); g.rect(-1.6, -2, 3.2, 1, s.grip || C.leather, 1);
    g.poly([[0, -39], [-2.8, -32], [0, -29], [0, -39]], m, 5); g.poly([[0, -39], [2.8, -32], [0, -29]], m, 3); g.rect(-1.5, -30, 3, 1.5, s.rough ? C.rope : s.trim, 4);
    g.poly([[-1, 6], [-3.5, 8], [-3.5, 11], [-1, 9.5]], s.cloth, 4); g.poly([[1, 6], [3.5, 8], [3.5, 11], [1, 9.5]], s.cloth, 3);
    if (s.shine || s.radiant || s.jag) g.dot(-1, -35, C.white, 5); if (s.ember) g.poly([[-1, -30], [1, -30], [0, -36]], C.fire2, 5);
  },
});
Object.assign(LEN, { katana: 36, greataxe: 41, halberd: 46, crossbow: 22, bomb: 16, javelin: 39 });
Object.assign(HOLD, { katana: 0.62, greataxe: 0.25, halberd: 0.08, crossbow: 1.52, bomb: 0, javelin: 0.18 });
Object.assign(POLE, { greataxe: 1, halberd: 1, javelin: 1 });
Object.assign(KCAP, { greataxe: 0.4, halberd: 0.5 });      // breda vapen växer mindre över storlek 1 så att Star ryms i rutan
Object.assign(WK, { halberd: 0.95, greataxe: 1.0, crossbow: 1.05, bomb: 1.15, katana: 1.05, javelin: 1.05 });

// =====================================================================================================================
// ---------- Steg 5 (balans v23): Molnslottets eget toppbygge (Celestial), jättesvärdet och jättehammaren ----------
// Celestial är belöningen i slutet: ljust tyg och plåt som tar materialets ton (Fire blekt orange, Star vitt och guld), små vingar
// vid tinningarna och anklarna, en sol på bröstet och skölden, en ring av stjärnor bakom ryggen. Säljs bara i Molnslottet.
// =====================================================================================================================
C.sun = R('#ffe27a');
const SKY = '#fbf7ff';
const sky = (it, f = 0.5) => mix(SKY, it, f);
// En liten vinge (tre fjädrar) med roten i (x, y), d = riktning (-1 bakåt), k = storlek. Används av hjälmen, stövlarna och handskarna.
function wingLet(g, x, y, d, k, rp, lv = 4, f = 0) {
  g.poly([[x, y], [x + d * 6 * k, y - 4 * k - f], [x + d * 5 * k, y - 1.5 * k - f], [x + d * 7 * k, y - 0.5 * k - f], [x + d * 4.5 * k, y + 1 * k], [x + d * 5.5 * k, y + 2.2 * k], [x, y + 1.5]], rp, lv);
  g.line(x, y, x + d * 5 * k, y - 2.5 * k - f, rp, lv - 2);
}
Object.assign(HELM, {
  circlet: { draw(g, it, m, Y, s) {                      // ett diadem med små vingar vid tinningen och en stjärna som svävar över pannan
    const ti = tierG(it), c = sky(it, 0.6), k = gr(GRAND.crest, it), f = rd(Math.sin(T * 2.4) * 1);
    for (const [x, h] of [[37, 2.5], [42, 3.5], [46.5, 5 * Math.min(1.1, k)], [50.5, 2.5]]) g.poly([[x - 2, Y - 5], [x, Y - 5 - h], [x + 2, Y - 5]], C.sun, 4);   // uddar som på en krona
    g.rect(29, Y - 6, 22.5, 2.5, C.sun, 3); g.rect(29, Y - 6, 22.5, 1, c, 5);
    wingLet(g, 30, Y - 5, -1, k, C.white, 5, rd(Math.sin(T * 3) * 0.6)); wingLet(g, 49.5, Y - 5.5, 1, k * 0.8, C.white, 4);
    g.ell(46.5, Y - 5, 1.6, 1.6, s.gem); g.dot(41.5, Y - 5, s.gem, 5);
    const sy = Y - 12 - f;                                                                                       // stjärnan över pannan
    for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]]) g.dot(45 + dx, sy + dy, Math.abs(dx) + Math.abs(dy) > 1 ? C.sun : C.white, 5);
    if (ti >= 8 && Math.floor(T * 3) % 2) { g.dot(42, sy - 2, C.white, 5); g.dot(48, sy + 1, C.white, 5); }
  } },
});
Object.assign(BODY, {
  skyplate(g, it, ar, s, y, t, bd, w) {                  // ljus bröstplåt med en sol, fjäderplåtar på axeln och ett kort skört
    const ti = tierG(it);
    g.poly([[30.5 - bw(bd), y], [46.5 + bw(bd), y], [45.5, HIP + 1], [31.5, HIP + 1]], ar, 3);
    g.ell(38.5, y + 6, 8.2 + bw(bd) * 0.5, 7.2, ar, true);
    for (let i = 0; i < 8; i++) { const a = i * 0.785 + t * 0.4; g.line(38.5, y + 6, rd(38.5 + Math.cos(a) * 4.5), rd(y + 6 + Math.sin(a) * 4), C.sun, 4); }   // solen på bröstet, strålarna vrider sig
    g.ell(38.5, y + 6, 1.8, 1.8, C.white, false, null, 5);
    g.rect(33.5, y - 1, 11, 2.5, ar, 5); g.rect(33.5, y - 1, 11, 1, C.sun, 4);
    for (const [x, yy] of [[44, y - 1], [46, y + 2], [47.5, y + 5]]) g.poly([[x, yy], [x + 4.5, yy + 1], [x + 3.5, yy + 4], [x, yy + 2.5]], C.white, 4);   // fjäderplåtar på bortre axeln
    g.rect(31, HIP - 2.5, 15, 2.5, C.sun, 3); g.ell(38.5, HIP - 1.2, 1.6, 1.6, s.gem);
    g.poly([[31, HIP], [46, HIP], [46.5, HIP + 5], [42, HIP + 3.5], [38.5, HIP + 6], [35, HIP + 3.5], [30.5, HIP + 5]], ar, 2);
    if (ti >= 9) g.dot(rd(33 + ((t * 9) % 12)), y + 3, C.white, 5);
  },
});
Object.assign(BODYCOL, { skyplate: (it) => sky(it, 0.45) });
ARM_AS.skyplate = 'plate'; NOSCARF.skyplate = 1;
Object.assign(HANDS, {
  skygloves: { fist: (it) => sky(it, 0.5), draw(g, m, s, cx, cy, dx, dy, lw, lv, ti, k, it) {   // ljusa handskar med en liten vinge vid manschetten
    const c = sky(it, 0.5);
    g.thick(cx, cy, dx, dy, 5.6 + lw, c, 4);
    g.ell(cx, cy, 3.3 * Math.min(1.2, k), 3, c, true); g.dot(cx - 1, cy - 1, C.white, 5);
    fdot(g, (cx + dx) / 2, (cy + dy) / 2, C.sun, 5);
    if (lv === 3) wingLet(g, cx - 1, cy - 1, -1, 0.55 * k, C.white, 4);
  } },
});
Object.assign(LEGS, {
  skygreaves: { draw(g, it, m, s, legs, ti, k) {         // ljusa benskenor med en knäkopp som ett litet moln
    const c = sky(it, 0.45);
    for (const L of legs) { limb(g, L.hip, L.knee, 6.4, 5.8, c, L.lv - 1); limb(g, L.knee, L.ankle, 6.2, 5.8, c, L.lv); }
    for (const L of legs) {
      const [x, y] = L.knee; for (const [dx, r] of [[-1.6, 1.6], [0.4, 2], [2.2, 1.5]]) g.ell(x + dx, y - 0.5, r * k, r * k, C.white, true);   // molnet på knät
      const [x2, y2] = lerp2(L.knee, L.ankle, 0.55); g.rect(x2 - 3.2, y2, 6.4, 1, C.sun, 4);
    }
  } },
});
Object.assign(FEET, {
  skyboots: { over: 1, draw(g, it, m, s, legs, ti, k) {  // höga ljusa stövlar med små vingar vid anklarna som slår sakta
    const c = sky(it, 0.5), fl = rd(Math.sin(T * 4) * 0.8);
    for (const L of legs) {
      const top = lerp2(L.knee, L.ankle, 0.05);
      limb(g, top, L.ankle, 6.4, 6, c, L.lv); atFoot(g, L, () => { g.poly(FOOT, c, L.lv); g.rect(-3.5, 4, 9, 1, C.sun, 3); });
      limb(g, top, lerp2(top, L.ankle, 0.25), 7, 6.8, C.sun, L.lv + 1);
      wingLet(g, L.ankle[0] - 3, L.ankle[1] - 1, -1, 0.75 * k, C.white, L.lv + 2, fl);
    }
  } },
});
Object.assign(BELT, {
  skysash(g, it, m, s, y, t, ti, k) {                    // skärp med en stjärna som spänne och två band som svävar uppåt
    const c = sky(it, 0.55), f = rd(Math.sin(t * 2.2) * 1.2);
    g.thick(42, y + 2, 47 + f, y - 4, 1.6, c, 3); g.thick(41, y + 2, 45 - f, y - 6, 1.6, c, 4);                     // banden svävar uppåt
    g.rect(30.5, y - 0.5, 16, 3.5, c, 3); g.rect(30.5, y + 1, 16, 1, C.sun, 4);
    for (const [dx, dy] of [[0, -2], [0, 2], [-2, 0], [2, 0], [0, -1], [0, 1], [-1, 0], [1, 0], [0, 0]]) g.dot(38.5 + dx, y + 1.5 + dy, Math.abs(dx) + Math.abs(dy) > 1 ? C.sun : C.white, 5);
  },
});
Object.assign(SHIELD, {
  sunshield(g, m, s) {                                   // rund sköld med en sol vars strålar vrider sig
    const c = R('#fff6d8');
    g.ell(0.5, 0.5, 8.8, 8.8, m, true); g.ell(0.5, 0.5, 8.8, 8.8, C.sun, false, (dx, dy, d2) => d2 > 0.72, 4);
    g.ell(0.5, 0.5, 6.4, 6.4, c, true);
    for (let i = 0; i < 8; i++) { g.push(0.5, 0.5, i * 0.785 + T * 0.6); g.poly([[-1, -3], [0, -6], [1, -3]], C.sun, 5); g.pop(); }
    g.ell(0.5, 0.5, 2.6, 2.6, C.sun, true); g.dot(-0.5, -0.5, C.white, 5);
  },
});
SH_C.sunshield = [0.5, 0.5];
Object.assign(BACK, {
  halo(g, it, m, b, t, s) {                              // en stor ring av ljus bakom axlarna med stjärnor i omlopp
    const y = SH - 11 + b, k = gr(GRAND.wings, it), r = 15.5 * k, ti = tierG(it), c = sky(it, 0.55), cx = 36;          // ringen sitter bakom huvudet
    g.begin(); g.ell(cx, y, r, r, c, false, (dx, dy, d2) => d2 > 0.78, 4); g.ell(cx, y, r, r, C.sun, false, (dx, dy, d2) => d2 > 0.78 && d2 < 0.86, 5);
    for (let i = 0; i < 12; i++) { const a = i * 0.524; g.dot(rd(cx + Math.cos(a) * (r + 1.5)), rd(y + Math.sin(a) * (r + 1.5)), C.sun, i % 2 ? 3 : 5); }   // små strålar utanpå ringen
    const n = 3 + Math.max(0, ti - 5);
    for (let i = 0; i < n; i++) { const a = t * 0.8 + i * 6.283 / n, x = rd(cx + Math.cos(a) * r), yy = rd(y + Math.sin(a) * r); g.dot(x, yy, C.white, 5); g.dot(x - 1, yy, C.sun, 4); g.dot(x + 1, yy, C.sun, 4); g.dot(x, yy - 1, C.sun, 4); g.dot(x, yy + 1, C.sun, 4); }
    auraEnd(g, c, hintOf(it));
  },
});

// ---------- Jättevapnen (bärs på axeln i vila, hålls med båda händerna) ----------
Object.assign(WEAPON, {
  giantblade(g, m, s) {                                  // jättesvärd: bred klinga med hack, stor parerstång och långt grepp
    half(g, m, 6, -7, -41, -49); bladeFx(g, s, m, 6, -7, -41, -49);
    g.rect(-1, -38, 2, 28, m, 1); if (!s.rough) for (let y = -14; y > -38; y -= 6) g.dot(-0.5, y, s.gem, 5);
    g.poly([[6, -18], [3.6, -20], [6, -22]], m, 1); g.poly([[-6, -30], [-3.8, -32], [-6, -34]], m, 1);              // hack i eggen
    g.rect(-6, -40, 1, 32, m, 5);
    g.poly([[-11.5 * GWK, -7.5], [11.5 * GWK, -7.5], [13 * GWK, -4], [-13 * GWK, -4]], s.rough ? C.wood : s.trim, 3); g.ell(0, -5.8, 2.6, 2.6, s.gem);
    g.rect(-1.8, -4, 3.6, 12, s.grip || C.leather, 3); for (let y = -3; y < 7; y += 2) g.rect(-1.8, y, 3.6, 1, s.grip || C.leather, 1);
    g.ell(0, 9, 2.8, 2.8, s.rough ? C.wood : s.trim);
  },
  gianthammer(g, m, s) {                                 // jättehammare: ett huvud stort som hjältens bröst på ett tjockt skaft
    const p = s.pole || C.wood; g.poly([[-1.8, 9], [1.8, 9], [1.8, -30], [-1.8, -30]], p, 3);
    g.rect(-2.2, -4, 4.4, 6, s.grip || C.leather, 3); g.rect(-2.2, -2, 4.4, 1, s.grip || C.leather, 1); g.rect(-2.2, 8, 4.4, 2.5, s.rough ? C.rope : s.trim, 3);
    g.poly([[-13, -42], [-10, -44], [10, -44], [13, -42], [13, -28], [10, -26], [-10, -26], [-13, -28]], m, 3);
    g.poly([[-13, -42], [-10, -44], [-10, -26], [-13, -28]], m, 5); g.poly([[13, -42], [10, -44], [10, -26], [13, -28]], m, 1);
    g.rect(-3.5, -44, 7, 18, s.rough ? C.rope : s.trim, 3); g.ell(0, -35, 2.4, 2.4, s.gem);
    for (const x of [-7, 6]) { g.rect(x, -41, 1.5, 12, m, 4); }
    flair(g, s, m, -7, -35);
  },
});
Object.assign(LEN, { giantblade: 49, gianthammer: 44 });
Object.assign(HOLD, { giantblade: -1.0, gianthammer: -0.9 });
Object.assign(TWO, { giantblade: 8, gianthammer: 7 });
Object.assign(CARRY, { giantblade: { hand: [47, 37.5], ang: -1.0, bend: [2.5, -0.5] }, gianthammer: { hand: [47, 38], ang: -0.9, bend: [2.5, -0.5] } });
Object.assign(WK, { giantblade: 0.95, gianthammer: 0.95 });
Object.assign(KCAP, { gianthammer: 0.5 });

// ---------- Setets utseende (bara utseende, ingen styrka) ----------
// Tre delar av samma bygge (vilket material som helst, catalog.js BUILDS): en ring på marken i byggets färg. Sex delar:
// byggets egen lilla effekt runt hjälten. Ritas inte i kartmarkören (för liten) och effekten inte med a.noFx.
export const SETFX = {
  ranger(g, t) { for (let i = 0; i < 3; i++) { const u = (t * 0.25 + i * 0.33) % 1, x = rd(76 - u * 70), y = rd(10 + i * 14 + Math.sin(u * 9 + i) * 4); g.set(x, y, C.leaf, 4); g.set(x + 1, y + 1, C.leaf, 2); g.set(x + 1, y, C.leaf, 5); } },
  knight(g, t) { const k = Math.floor(t * 2) % 4, p = [[44, 40], [36, 56], [48, 22], [30, 46]][k]; if ((t * 2) % 1 < 0.55) for (let j = -2; j <= 2; j++) { g.set(p[0] + j, p[1], C.white, 5); g.set(p[0], p[1] + j, C.white, 5); } },
  // Rogue (v21): rök som ringlar upp kring fötterna
  rogue(g, t) { for (let i = 0; i < 7; i++) { const u = (t * 0.45 + i / 7) % 1, x = rd(24 + i * 5 + Math.sin(u * 5 + i) * 2), y = rd(62 - u * 10); if (u > 0.85) continue; const c = u < 0.4 ? C.purple : C.soot, lv = u < 0.4 ? 3 : 2; g.set(x, y, c, lv); g.set(x + 1, y, c, lv - 1); if (u < 0.6) { g.set(x, y - 1, c, lv - 1); g.set(x + 1, y - 1, c, lv); } } },
  // Mage (v21): tre runor i omlopp runt hjälten, de bakre ritas inte
  // Viking (v22): frostig andedräkt ur munnen, en pust ungefär varannan sekund
  viking(g, t) { const u = (t * 0.55) % 1; if (u > 0.6) return; for (let i = 0; i < 5; i++) { const q = u / 0.6, x = rd(51 + q * 9 + i * 1.3), y = rd(29 - q * 4 + Math.sin(i * 2 + t * 3) * 1.2); g.set(x, y, i % 2 ? C.white : C.ice, q < 0.5 ? 4 : 3); } },
  // Samurai (v22): rosa kronblad som driver förbi
  samurai(g, t) { for (let i = 0; i < 4; i++) { const u = (t * 0.2 + i * 0.25) % 1, x = rd(78 - u * 74), y = rd(8 + i * 12 + u * 14 + Math.sin(u * 8 + i) * 3); g.set(x, y, C.pink, 5); g.set(x + 1, y, C.pink, 3); if ((i + Math.floor(t * 4)) % 2) g.set(x, y + 1, C.pink, 4); } },
  // Engineer (v22): ånga som pyser ur bältet
  engineer(g, t) { for (let i = 0; i < 4; i++) { const u = (t * 0.7 + i / 4) % 1, x = rd(44 + u * 5 + Math.sin(u * 6 + i) * 1.5), y = rd(44 - u * 14); if (u > 0.8) continue; g.set(x, y, C.bone, u < 0.4 ? 4 : 3); g.set(x + 1, y, C.bone, 3); if (u > 0.3) g.set(x, y - 1, C.bone, 2); } },
  // Celestial (v23): ljusprickar som stiger runt hjälten och en glimt som vandrar runt setets ring
  celestial(g, t) {
    for (let i = 0; i < 6; i++) { const u = (t * 0.35 + i / 6) % 1, x = rd(22 + i * 7 + Math.sin(u * 6 + i) * 2), y = rd(60 - u * 52); const lv = u < 0.7 ? 5 : 4; g.set(x, y, u < 0.5 ? C.white : C.sun, lv); if (u < 0.35) { g.set(x + 1, y, C.sun, 4); g.set(x, y - 1, C.sun, 4); } }
    const a = t * 1.3; g.set(rd(39.5 + Math.cos(a) * 18), rd(62.5 + Math.sin(a) * 3.4), C.white, 5);
  },
  mage(g, t) { for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.094, x = rd(39.5 + Math.cos(a) * 21), y = rd(44 + Math.sin(a) * 6); if (Math.sin(a) < -0.35) continue; const lv = Math.sin(a) > 0.3 ? 5 : 4; for (const [dx, dy] of [[0, -1], [0, 0], [0, 1], [1, -1], [-1, 1]]) g.set(x + dx, y + dy, C.blue, lv); g.set(x, y, C.white, 5); } },
};
export function setLook(gear) {
  const c = setCounts(gear); let id = null, n = 0;
  for (const b in c) if (c[b] > n) { id = b; n = c[b]; }
  return n >= 3 && BUILDS[id] ? { id, n, rp: R(BUILDS[id].hex) } : null;
}

// ---------- Hela hjälten ----------
// Hjältens hållning och fästpunkter utan att något ritas (för färdighetsträdets effekter). Koordinaterna är hjältens egna
// (80x72-rutan) med svävningen avdragen. belt = bältets översta rad (tre rader högt, x 32 till 45). drawHero läser sina lägen härifrån, så de två kan inte glida isär.
// build: -1 smal, 0 vanlig, 1 kraftig, 2 jätte (se a.build i drawHero).
export function heroPose(gear = {}, t = 0, a = {}) {
  setBody();
  const b = Math.sin(t * 2.6) > 0.3 ? 1 : 0, hover = gear.back && HOVER[gear.back.type] ? 4 + rd(Math.sin(t * 2.2) * 1.5) : 0;
  const cw = carryOf(gear, a), bd = a.build || 0, Y = SH - 10 + b - hover, hd = cw ? [cw.hand[0] - 50.5, cw.hand[1] - 45.5] : a.hand || [0, 0], visor = !!(gear.helmet && gear.helmet.type === 'great');
  const hs = heldShield(gear), gd = a.guard || [0, 0];
  let fx = (hs ? 29.5 : 30.5) + gd[0], fy = (hs ? HIP - 3 : HIP - 1.5) + b - hover + gd[1];   // a.guard: parera (striden), närmaste handen och skölden flyttas [dx, dy]
  // Vapnets vinkel (v22, räknas här så att drawHero och skillträdet är överens): a.wAng, annars vilan (CARRY eller HOLD) med
  // en liten gungning, och långa vapen lutas framåt i vila så att spetsen ryms i rutan. hb = bortre handen som den ritas.
  const w = gear.weapon, hb = a.handB || [50 + hd[0], 45 + b + hd[1] - hover];
  let wAng = null;
  if (w && WEAPON[w.type]) {
    const idle = a.wAng === undefined ? Math.sin(t * 2.6 - 0.6) * 0.035 : 0;
    wAng = a.wAng !== undefined ? a.wAng : (cw ? cw.ang : HOLD[w.type]) + (a.swing || 0) + idle;
    if (a.wAng === undefined && !a.swing && !cw) { const ty = w.type, L = weaponLen(w) * (LEN[ty] + (TOPX[ty] || 0)) / (LEN[ty] - 3), top = hb[1] + 0.5 - 3; if (L * Math.cos(wAng) > top) wAng = Math.acos(Math.min(1, top / L)); }
    // Tvåhandsvapen: närmaste handen på greppet, TWO pixlar längs skaftet under bortre handen.
    if (TWO[w.type] != null && !a.handF) { const k = wk(w) * wsize(w), f = TWO[w.type]; fx = hb[0] + 0.5 - f * k * Math.sin(wAng); fy = hb[1] + f * k * Math.cos(wAng); }
  }
  return {
    wAng,
    b, hover, build: bd, eyes: [[42, Y], [47, Y]], eyeH: visor ? 1 : 3, head: [39.5, Y + 0.5], top: Y - 10,
    neck: [38, SH + b - hover], chest: [38.5, SH + 6 + b - hover], belt: HIP - 3 - hover,
    handBack: [50.5 + hd[0], 45.5 + b + hd[1] - hover], handFront: [fx, fy + 0.5],
    armBack: [[45 + bw(bd) * 0.6, SH + 3 + b - hover], [50 + hd[0], 45 + b + hd[1] - hover]],
    armFront: [[32.5 - bw(bd) * 0.6, SH + 3 + b - hover], [fx, fy]],
    feet: [39.5, 61], pet: gear.pet ? [11, PET_GROUND[gear.pet.type] ? 53 : 24 + rd(Math.sin(t * 2) * 2)] : null,
    helmet: !!gear.helmet, visor,
  };
}
// gear: { weapon, helmet, armor, shield, back, pet } där varje är ett föremål ur katalogen (eller saknas)
// a: { t: sekunder, blink: bool, swing: radianer, wAng, hand: [dx, dy], noShadow, noPet, noFx, noScarf, build: -1 | 0 | 1 | 2 }
// Ställningar för ordbilderna (wordart.js), utan dem ritas hjälten som förut: handB/handF = bortre/närmaste handens läge [x, y],
// bendB/bendF = armbågens utskjut [x, y], legs = { b: [knäX, knäY, fotledX, fotledY, fotvinkel], f: [...] } för bakre/främre benet.
// noScarf: hjältens egen halsduk ritas inte (för färdighetsträdets längre halsduk, som annars hamnar ovanpå den).
export function drawHero(g, look, gear, a = {}) {
  const t = a.t || 0, P = heroPose(gear, t, a), { b, hover, build: bd } = P, cw = carryOf(gear, a), two = twoHanded(gear); T = t;
  const small = g.t.k < 0.75;                                                       // kartmarkören: hoppa över det som ändå inte syns
  FXOK = !small && !a.noFx;                                                          // auran (v3) bara där effekterna syns
  const sw = [(Math.sin(t * 2.6 - 1.1) > 0.3 ? 1 : 0) - b, rd(Math.sin(t * 1.3) * 1)];   // hår, plym och hattopp släpar efter andningen
  const skin = R(look.skin), ar = gear.armor ? bodyCol(gear.armor) : skin, type = gear.armor ? gear.armor.type : 'rags';
  const as = gear.armor ? mat(gear.armor) : PLAIN, hr = 2.6 + (bd > 1 ? 0.4 : 0);
  const fist = fistOf(gear.hands) || (type === 'plate' ? ar : skin), held = heldShield(gear), sl = small ? null : setLook(gear);   // v4: handdelens näve, skölden i handen, setets utseende
  if (!a.noShadow) { g.begin(); g.ell(39.5, 62.5, 15 - hover, 2.6, C.shadow, false, null, 1); g.end({ outline: false, edge: false }); }   // markskugga
  if (sl) { g.begin(); g.ell(39.5, 62.5, 18, 3.4, sl.rp, false, (dx, dy, d2) => d2 > 0.55, sl.n >= 6 ? 4 : 3); g.end({ outline: false, edge: false }); }   // setets ring på marken
  if (gear.pet && !a.noPet && PET[gear.pet.type]) drawPet(g, gear.pet, P.pet[0], P.pet[1], t);
  T = t;
  g.push(0, -hover);          // allt nedan ritas i svävade koordinater, därför läggs hover tillbaka på lägena ur P
  if (gear.back && BACK[gear.back.type]) BACK[gear.back.type](g, gear.back, R(gear.back.hex), b, t, mat(gear.back));   // en sort utan ritfunktion ritas inte
  if (gear.shield && gear.shield.type === 'quiver') drawQuiver(g, gear.shield, b, t);                                                      // kogret på ryggen (v4)
  if (two && gear.shield && SHIELD[gear.shield.type]) { g.push(26, SH + 10 + b, -0.35, 0.72); drawShield(g, gear.shield, 0, 0); g.pop(); }   // tvåhandsvapen: skölden hänger på ryggen (v22)
  // bortre armen håller vapnet (a.hand flyttar handen under attacker)
  const [[bsx, bsy], [hx0, hyA]] = P.armBack, [hx, hy0] = a.handB || [hx0, hyA], hy = hy0 + hover;
  g.begin(); arm(g, type, ar, skin, as, bsx, bsy + hover, hx, hy, a.bendB || (cw && cw.bend) || [-1.5, 1.5], 2, bd, gear.hands); g.end();
  g.anchor.hand = g.pt(hx + 0.5, hy + 0.5);
  let ang = P.wAng || 0, late = false;
  const wDraw = () => { const wi = tierG(gear.weapon); g.begin(); g.push(hx + 0.5, hy + 0.5, ang); drawWeapon(g, gear.weapon); g.pop(); auraEnd(g, R(gear.weapon.hex), wi < 0 || !FXOK ? 0 : AURA[wi]); };
  if (gear.weapon && WEAPON[gear.weapon.type]) {
    late = !!(cw && cw.late);                                                           // katana och armborst ritas framför kroppen i vila (v22)
    if (!late) wDraw();                                                                 // vinkeln (gungning, lutning i vila) räknas i heroPose
  }
  const backFist = () => { g.begin(); g.ell(hx + 0.5, hy + 0.5, hr, hr, fist, 0.75); knuckles(g, gear.hands, hx + 0.5, hy + 0.5, skin); g.end(); };
  if (!late) backFist();
  if (a.legs) poseLegs(g, a.legs, type === 'rags' ? C.rag2 : type === 'plate' || type === 'chain' ? ar : C.pants, type === 'plate' ? ar : C.leather, gear, type); else drawLegs(g, gear.armor, ar, skin, gear);
  drawTorso(g, gear.armor, ar, b, t, bd, gear.legs);
  if (gear.belt && BELT[gear.belt.type]) { const bt = gear.belt; piece(g, bt, (q, m, s, ti, k) => BELT[bt.type](q, bt, m, s, HIP - 3, t, ti, k, b)); }   // bältet (v4)
  if (gear.charm && CHARM[gear.charm.type] && !small) drawCharm(g, gear.charm, t);                      // berlocken hänger i bältet
  if (!NOSCARF[type] && !(gear.belt && NOSCARF[gear.belt.type]) && !a.noScarf) drawScarf(g, look.scarf ? R(look.scarf) : gear.armor ? as.cloth : C.red, b, t);
  const hm = gear.helmet ? HELM[gear.helmet.type] : null;
  drawHead(g, look, b, a.blink, hm && hm.hideHair, !!hm, sw, small);
  if (hm) { g.begin(); hm.draw(g, gear.helmet, R(gear.helmet.hex), SH - 10 + b, mat(gear.helmet), sw); g.end(); }
  if (late) { wDraw(); backFist(); }
  // närmaste armen: på tvåhandsvapnets grepp (v22), bakom skölden, eller knuten näve vid höften
  g.begin();
  const [[fsx, fsy], [nxA, nyA]] = P.armFront, px = 31.5 - bw(bd) * 0.5, pw = bw(bd) * 0.4;
  const [nx, ny0] = a.handF || [nxA, nyA], ny = ny0 + hover;                       // tvåhandsvapnets grepp räknas i heroPose (armFront)
  arm(g, type, ar, skin, as, fsx, fsy + hover, nx, ny, a.bendF || [-2.2, 0.5], 3, bd, gear.hands);
  g.ell(nx, ny + 0.5, hr, hr, fist, 0.75); knuckles(g, gear.hands, nx, ny + 0.5, skin);
  if (type === 'plate') { g.ell(px, SH + 2 + b, 5.4 + pw, 4.3 + pw * 0.7, ar); g.ell(px, SH + 2 + b, 5.4 + pw, 4.3 + pw * 0.7, as.trim, false, (dx, dy, d2) => d2 > 0.6 && dy > 0.1, 3); flair(g, as, ar, px - 1.5, SH + b); }   // stort axelskydd
  else if (type === 'chain') { g.ell(px + 0.5, SH + 2 + b, 4.2 + pw, 3.2 + pw * 0.6, C.leather); g.dot(px - 0.5, SH + 2 + b, C.steel, 5); }
  else if (type === 'robe') g.poly([[28 - bw(bd), SH + b], [35, SH + b - 0.5], [35.5, SH + 4 + b], [29 - bw(bd), SH + 5.5 + b]], ar, 5);
  else if (type === 'lamellar') { g.poly([[px - 6, SH - 1 + b], [px + 4, SH - 1 + b], [px + 3.5, SH + 8 + b], [px - 6.5, SH + 9 + b]], ar, 4); for (let y = SH + 1; y < SH + 9; y += 2) g.rect(px - 6, y + b, 9.5, 1, ar, 2); g.rect(px - 6, SH - 1 + b, 10, 1.5, tierG(gear.armor) === 0 ? C.wood : as.trim, 4); }   // stort fyrkantigt axelskydd (v22)
  else if (type === 'furvest') g.ell(px + 0.5, SH + 1.5 + b, 4.6 + pw, 3.2, C.fur, true, null, 4);                     // pälsen på axeln (v22)
  else if (type === 'coat') { g.ell(px + 0.5, SH + 2 + b, 4.2 + pw, 3.2 + pw * 0.6, ar); }
  g.end();
  if (held) { const gd = a.guard || [0, 0]; drawShield(g, held, 26.5 + gd[0], HIP - 2 + b + gd[1]); g.anchor.shield = g.pt(27 + gd[0], HIP - 1.5 + b + gd[1]); }
  else if (gear.shield && HELD[gear.shield.type] && !two) { const hi = gear.shield, gd = a.guard || [0, 0]; piece(g, hi, (q, m, s, ti) => { q.push(nx + gd[0], ny + 0.5 + gd[1]); HELD[hi.type].draw(q, hi, m, s, t, ti); q.pop(); }); }   // bok eller parerdolk i närmaste handen (v21)
  if (sl && sl.n >= 6 && !a.noFx && SETFX[sl.id]) { g.begin(); SETFX[sl.id](g, t); g.end({ outline: false, edge: false }); }   // setets egen effekt från sex delar
  const w = gear.weapon;
  if (w && w.fx && !a.noFx && !small) weaponFx(g, w, t);
  g.pop(); FXOK = true;
}

// ---------- Ikon (32x32) för ett föremål, ritad med samma funktioner som på gubben ----------
// Ritbar = platsen och sorten har en ritfunktion här (rustningens okända sorter ritas som tunika).
const iconOk = (it) => { const D = { weapon: WEAPON, shield: { ...SHIELD, ...ON_BACK, ...HELD }, pet: PET, back: BACK, helmet: HELM, hands: HANDS, legs: LEGS, feet: FEET, belt: BELT, charm: CHARM }[it.slot]; return it.slot === 'armor' || !!(D && D[it.type]); };
const GREY = R('#7c82a0');                // provdockans ben och arm i ikonerna för de nya platserna
const ICON_K = { dagger: 1.3, club: 0.95, sword: 0.94, axe: 0.82, spear: 0.84, hammer: 0.78, staff: 0.86, great: 0.82, knives: 1.35, katana: 0.8, greataxe: 0.68, javelin: 0.72 };
// Ikonerna visar storleken efter material mildare än gubben (roten ur skalan), så att också Star ryms i rutan och trä syns.
export function drawIcon(g, it, t = 0) {
  setBody(); T = t; FXOK = true;
  if (!it || !iconOk(it)) return;                                                     // okänd sort (nyare klient): tom ikon
  const s = mat(it), m = R(it.hex), ti = tierG(it), soft = (tbl) => 1 / Math.sqrt(gr(tbl, it));     // soft: ta bort halva skalan som ritfunktionen lägger på
  if (it.slot === 'weapon') {
    g.begin();
    const q = Math.sqrt(wsize(it));
    if (it.type === 'orb') { g.push(7.5, 34, 0, 1); drawWeapon(g, it, 1.75 * Math.min(1, q)); g.pop(); }
    else if (it.type === 'stars') { g.push(12.5, 25, 0, 1); drawWeapon(g, it, 1.85 * Math.min(1, q)); g.pop(); }
    else if (it.type === 'bomb') { g.push(11, 31, 0, 1); drawWeapon(g, it, 1.75 * Math.min(1, q)); g.pop(); }
    else if (it.type === 'crossbow') { g.push(17, 17, 0.785, 1); g.push(0, 6); drawWeapon(g, it, 1.02 * Math.min(1, q)); g.pop(); g.pop(); }
    else if (it.type === 'giantblade' || it.type === 'gianthammer') { const k = (it.type === 'giantblade' ? 0.6 : 0.62) * Math.min(1.03, q), an = 0.78; g.push(15.5 - Math.sin(an) * 18 * k, 16.5 + Math.cos(an) * 18 * k, an, 1); drawWeapon(g, it, k); g.pop(); }
    else if (it.type === 'halberd') { const k = 0.62 * Math.min(1.03, q), an = 0.78; g.push(15.5 - Math.sin(an) * 15 * k, 16.5 + Math.cos(an) * 15 * k, an, 1); drawWeapon(g, it, k); g.pop(); }
    else if (it.type === 'bow') { g.push(14.5, 16, 0, 1); drawWeapon(g, it, 0.88 * Math.min(1, q)); g.pop(); }
    else { const k = ICON_K[it.type] * Math.min(1.03, q), mid = (LEN[it.type] - 6) / 2 * k, an = 0.78; g.push(15.5 - Math.sin(an) * mid, 16.5 + Math.cos(an) * mid, an, 1); drawWeapon(g, it, k); g.pop(); }
    auraEnd(g, m, ti < 0 ? 0 : AURA[ti]);
  }
  if (it.slot === 'shield' && HELD[it.type]) {                                       // bok och parerdolk (v21)
    if (it.type === 'book') { g.push(17, 31, 0, 1.75); piece(g, it, (q, m2, s2, ti2) => HELD.book.draw(q, it, m2, s2, 0.4, ti2)); g.pop(); }
    else if (it.type === 'fan') { g.push(20, 23, 0, 1.55 / Math.sqrt(gr(GRAND.shield, it))); piece(g, it, (q, m2, s2, ti2) => HELD.fan.draw(q, it, m2, s2, 0.4, ti2)); g.pop(); }
    else { g.push(8, 25, 0, 1.2 * Math.min(1.03, Math.sqrt(wsize({ ...it, type: 'dagger' })))); piece(g, it, (q, m2, s2, ti2) => HELD.parry.draw(q, it, m2, s2, t, ti2, 0.78)); g.pop(); }
    return;
  }
  if (it.slot === 'shield' && it.type === 'quiver') { g.push(14, 17, 0, 1.15); g.push(-29, -(SH + 7)); drawQuiver(g, it, 0, t); g.pop(); g.pop(); return; }
  // Nya platser (v4): delen på en grå provdocka (ben, fot eller underarm), eller bältet och berlocken för sig.
  if (it.slot === 'legs' || it.slot === 'feet') {
    const legs = it.slot === 'legs'; g.push(legs ? 16 : 15, legs ? 15 : 13, 0, legs ? 1.45 : 1.75); g.push(-39.5, legs ? -51.5 : -56.5);
    g.begin(); g.poly([[39, HIP - 1], [45, HIP - 1], [48, 56], [42.5, 56]], GREY, 2); g.poly([[32, HIP - 1], [38.5, HIP - 1], [35.5, 56], [30, 56]], GREY, 3);
    if (legs) { g.poly([[42, 55], [48, 55], [51, 58.5], [51, 61], [42, 61]], C.leather, 2); g.poly([[29, 55], [35.5, 55], [38, 58.5], [38, 61], [29, 61]], C.leather, 3); }
    g.end(); legPieces(g, { [it.slot]: it }, null, 'tunic'); g.pop(); g.pop(); return;
  }
  // Händer (v23, ritas om: den gamla ikonen såg ut som en kniv): två underarmar på högkant med knutna nävar överst, ett par.
  if (it.slot === 'hands') {
    // En öppen hand (handflata, fyra fingrar och en tumme) ovanpå underarmen, två stycken: läses som ett par handskar.
    const fc = fistOf(it) || R('#f3c7a2'), H = HANDS[it.type];
    for (const [x, lv, up, d] of [[9.5, 2, 2, -1], [21, 3, 0, 1]]) {
      const cx = x, cy = 30 - up, dx = x, dy = 17 - up;
      g.begin(); g.thick(cx, 33, cx, cy, 4.6, GREY, lv); g.end();
      handPiece(g, it, cx, cy, dx, dy, 1.4, lv);
      g.begin();
      g.rect(dx - 3, dy - 5.5, 6.5, 5.5, fc, lv + 1);                                                                 // handflatan
      for (let f = 0; f < 4; f++) g.rect(dx - 3 + f * 1.65, dy - 9 - (f === 1 || f === 2 ? 1 : 0), 1.4, 4, H && H.knuckle ? R('#f3c7a2') : fc, lv + 1);   // fingrarna (bara hud för fingerlösa handskar)
      g.poly([[dx + d * 3.2, dy - 2], [dx + d * 5.6, dy - 5.5], [dx + d * 4.4, dy - 6.2], [dx + d * 2.8, dy - 4]], fc, lv + 1);   // tummen
      g.end();
    }
    return;
  }
  if (it.slot === 'belt') { g.push(15.5, 13, 0, 1.75); g.push(-38.5, -(HIP - 1.5)); piece(g, it, (q, m2, s2, ti2, k) => BELT[it.type](q, it, m2, s2, HIP - 3, t, ti2, k, 6)); g.pop(); g.pop(); return; }   // 6: remmen över bröstet blir kort i ikonen
  if (it.slot === 'charm') { g.push(16, 6, 0, 2.6); drawCharm(g, it, t, [0, 0]); g.pop(); return; }
  if (it.slot === 'shield') { g.push(15, 15.5, 0, (it.type === 'round' || it.type === 'sunshield' ? 1.45 : it.type === 'cog' ? 1.25 : 1.18) * soft(GRAND.shield) * (it.type === 'tower' ? 0.94 : 1)); drawShield(g, it, 0, 0); g.pop(); }
  if (it.slot === 'pet') { g.push(16, it.type === 'slime' ? 14 : 17, 0, (it.type === 'dragon' ? 1.05 : 1.25) * soft(GRAND.pet)); drawPet(g, it, 0, 0, 0.4); g.pop(); }
  if (it.slot === 'back') { const [cx, cy] = backCenter(it.type), cape = !!CAPES[it.type]; g.push(16, 16, 0, (ICON_BACK_K[it.type] || (it.type === 'jetpack' ? 1.1 : cape ? 0.95 : 0.88)) * soft(it.type === 'jetpack' ? GRAND.jet : cape ? GRAND.cape : GRAND.wings)); g.push(-cx, -cy); BACK[it.type](g, it, m, 0, 0.3, s); g.pop(); g.pop(); }
  if (it.slot === 'armor') {
    const m = bodyCol(it);
    g.push(16, 16, 0, 1); g.push(-40, -(SH + 61) / 2);
    g.begin(); arm(g, it.type, m, m, s, 45, SH + 3, 49, SH + 11, [1, 0], 2); g.end();
    drawLegs(g, it, m, m); drawTorso(g, it, m, 0, 0.3);
    g.begin(); arm(g, it.type, m, m, s, 32.5, SH + 3, 30.5, HIP - 1.5, [-2.2, 0.5], 3);
    if (it.type === 'plate') { g.ell(31.5, SH + 2, 5.4, 4.3, m); g.ell(31.5, SH + 2, 5.4, 4.3, s.trim, false, (dx, dy, d2) => d2 > 0.6 && dy > 0.1, 3); flair(g, s, m, 30, SH); }
    g.end(); g.pop(); g.pop();
  }
  if (it.slot === 'helmet') {
    const tall = { wizard: 1, horned: 1, great: 1, crown: 1, kabuto: 1, circlet: 1 }[it.type];
    g.push(tall ? 17 : 16, tall ? 21 : 17, 0, tall ? 0.8 : 1); g.push(-39.5, -26.5);
    g.begin(); g.ell(HX, 26.5, 11, 10, R('#565a78'), true); g.end();
    g.begin(); HELM[it.type].draw(g, it, m, 26, s, [0, 0]); g.end(); g.pop(); g.pop();
  }
}
