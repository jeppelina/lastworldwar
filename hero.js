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
  const [cx, cy] = SH_C[type], hw = type === 'round' ? 7 : 6;
  if (i === 0) {
    const inside = type === 'round' ? (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 < 52 : () => true;
    for (const x of [-3, 3]) for (let y = -8; y <= 9; y++) if (inside(x, y) && !(type === 'kite' && Math.abs(y - 2) < 4) && !(type === 'tower' && (x === 0 || (y >= -4 && y <= -3)))) g.dot(x, y, m, 1);   // fogar mellan plankorna
    g.rect(cx - hw + 0.5, cy + (type === 'round' ? 3 : 5), hw * 2 - 1, 1, C.red, 3);                                          // målad rand
    return;
  }
  if (i >= 3) {                                                                                                                  // fler nitar längs kanten
    const n = 4 + (i - 3) * 2, rx = type === 'round' ? 7.4 : 6.6, ry = type === 'round' ? 7.4 : 9;
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
const backCenter = (type) => ({ cape: [30, SH + 13], leafcloak: [30, SH + 13], wings: [21, SH - 3], dragonwings: [20, SH - 4], jetpack: [23.5, SH + 12] }[type]);

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
function drawTorso(g, armor, ar, b, t, bd = 0) {
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
  const bare = type === 'rags', up = bare ? skin : ar, low = bare || type === 'tunic' || type === 'shirt' ? skin : ar;
  const [, uw, lw] = BUILD[bd] || BUILD[0];                            // build: överarmen växer mest
  if (type === 'robe') { g.thick(sx, sy, ex, ey, 4.8 + uw, ar, lv); g.poly([[ex - 2.6, ey - 1], [ex + 2.4, ey - 1.6], [hx + 3.2, hy - 0.5], [hx - 3.4, hy + 1]], ar, lv); g.thick(hx - 3, hy, hx + 3, hy - 1, 1.6, s.trim, 4); return; }   // vid ärm
  g.thick(sx, sy, ex, ey, 4.6 + uw, up, lv); g.thick(ex, ey, hx, hy, 4.2 + lw, low, lv);
  if (bd > 0) { g.ell(sx - (lv > 2 ? 0.5 : -0.5), sy - 0.5, 2.6 + uw * 0.7, 2.5 + uw * 0.5, up, false, null, lv); g.dot((sx + ex) / 2 - 1.5, (sy + ey) / 2 - 1.5, up, 5); if (bd > 1) g.dot((sx + ex) / 2 - 0.5, (sy + ey) / 2 - 2.5, up, 5); }   // rundad axel och en ljus prick på överarmen
  const cx = ex + (hx - ex) * 0.42, cy = ey + (hy - ey) * 0.42, dx = hx - (hx - ex) * 0.12, dy = hy - (hy - ey) * 0.12;
  if (hands && HANDS[hands.type]) { if (bare) g.rect(sx - 2.5 - uw / 2, sy - 2, 5 + uw, 2.5, C.rag, 2); g.end(); handPiece(g, hands, cx, cy, dx, dy, lw, lv); return; }
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
function handPiece(g, it, cx, cy, dx, dy, lw, lv) { const H = HANDS[it.type]; piece(g, it, (q, m, s, ti, k) => H.draw(q, m, s, cx, cy, dx, dy, lw, lv, ti, k)); }
const fistOf = (it) => { const H = it && HANDS[it.type]; return H && H.fist ? (H.fist === 'm' ? R(it.hex) : C[H.fist]) : null; };

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
export const heldShield = (gear) => (gear && gear.shield && !ON_BACK[gear.shield.type] && SHIELD[gear.shield.type] ? gear.shield : null);
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
const capeOver = (extra) => (g, it, m, b, t, s) => { BACK.cape(g, it, m, b, t, s); const y = SH + 1 + b, k = gr(GRAND.cape, it), wv = (i) => rd(Math.sin(t * 1.7 - i * 0.9) * (0.5 + i * 0.55) * gr(GRAND.flutter, it)); g.begin(); extra(capeMap(g, 44, y, 0.55 + 0.45 * k, k), it, m, s, y, wv, t, b); g.end(); };
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

// ---------- Setets utseende (bara utseende, ingen styrka) ----------
// Tre delar av samma bygge (vilket material som helst, catalog.js BUILDS): en ring på marken i byggets färg. Sex delar:
// byggets egen lilla effekt runt hjälten. Ritas inte i kartmarkören (för liten) och effekten inte med a.noFx.
const SETFX = {
  ranger(g, t) { for (let i = 0; i < 3; i++) { const u = (t * 0.25 + i * 0.33) % 1, x = rd(76 - u * 70), y = rd(10 + i * 14 + Math.sin(u * 9 + i) * 4); g.set(x, y, C.leaf, 4); g.set(x + 1, y + 1, C.leaf, 2); g.set(x + 1, y, C.leaf, 5); } },
  knight(g, t) { const k = Math.floor(t * 2) % 4, p = [[44, 40], [36, 56], [48, 22], [30, 46]][k]; if ((t * 2) % 1 < 0.55) for (let j = -2; j <= 2; j++) { g.set(p[0] + j, p[1], C.white, 5); g.set(p[0], p[1] + j, C.white, 5); } },
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
  const bd = a.build || 0, Y = SH - 10 + b - hover, hd = a.hand || [0, 0], visor = !!(gear.helmet && gear.helmet.type === 'great');
  const hs = heldShield(gear), gd = a.guard || [0, 0], fx = (hs ? 29.5 : 30.5) + gd[0], fy = (hs ? HIP - 3 : HIP - 1.5) + b - hover + gd[1];   // a.guard: parera (striden), närmaste handen och skölden flyttas [dx, dy]
  return {
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
  const t = a.t || 0, P = heroPose(gear, t, a), { b, hover, build: bd } = P; T = t;
  const small = g.t.k < 0.75;                                                       // kartmarkören: hoppa över det som ändå inte syns
  FXOK = !small && !a.noFx;                                                          // auran (v3) bara där effekterna syns
  const sw = [(Math.sin(t * 2.6 - 1.1) > 0.3 ? 1 : 0) - b, rd(Math.sin(t * 1.3) * 1)];   // hår, plym och hattopp släpar efter andningen
  const skin = R(look.skin), ar = gear.armor ? R(gear.armor.hex) : skin, type = gear.armor ? gear.armor.type : 'rags';
  const as = gear.armor ? mat(gear.armor) : PLAIN, hr = 2.6 + (bd > 1 ? 0.4 : 0);
  const fist = fistOf(gear.hands) || (type === 'plate' ? ar : skin), held = heldShield(gear), sl = small ? null : setLook(gear);   // v4: handdelens näve, skölden i handen, setets utseende
  if (!a.noShadow) { g.begin(); g.ell(39.5, 62.5, 15 - hover, 2.6, C.shadow, false, null, 1); g.end({ outline: false, edge: false }); }   // markskugga
  if (sl) { g.begin(); g.ell(39.5, 62.5, 18, 3.4, sl.rp, false, (dx, dy, d2) => d2 > 0.55, sl.n >= 6 ? 4 : 3); g.end({ outline: false, edge: false }); }   // setets ring på marken
  if (gear.pet && !a.noPet && PET[gear.pet.type]) drawPet(g, gear.pet, P.pet[0], P.pet[1], t);
  T = t;
  g.push(0, -hover);          // allt nedan ritas i svävade koordinater, därför läggs hover tillbaka på lägena ur P
  if (gear.back && BACK[gear.back.type]) BACK[gear.back.type](g, gear.back, R(gear.back.hex), b, t, mat(gear.back));   // en sort utan ritfunktion ritas inte
  if (gear.shield && gear.shield.type === 'quiver') drawQuiver(g, gear.shield, b, t);                                                      // kogret på ryggen (v4)
  // bortre armen håller vapnet (a.hand flyttar handen under attacker)
  const [[bsx, bsy], [hx0, hyA]] = P.armBack, [hx, hy0] = a.handB || [hx0, hyA], hy = hy0 + hover;
  g.begin(); arm(g, type, ar, skin, as, bsx, bsy + hover, hx, hy, a.bendB || [-1.5, 1.5], 2, bd, gear.hands); g.end();
  g.anchor.hand = g.pt(hx + 0.5, hy + 0.5);
  if (gear.weapon && WEAPON[gear.weapon.type]) {
    const idle = a.wAng === undefined ? Math.sin(t * 2.6 - 0.6) * 0.035 : 0;         // vapnet väger lite i handen
    let ang = a.wAng !== undefined ? a.wAng : HOLD[gear.weapon.type] + (a.swing || 0) + idle;
    if (a.wAng === undefined && !a.swing) { const ty = gear.weapon.type, L = weaponLen(gear.weapon) * (LEN[ty] + (TOPX[ty] || 0)) / (LEN[ty] - 3), top = hy + 0.5 - hover - 3; if (L * Math.cos(ang) > top) ang = Math.acos(Math.min(1, top / L)); }   // långa vapen lutas framåt i vila så att spetsen ryms i rutan
    const wi = tierG(gear.weapon);
    g.begin(); g.push(hx + 0.5, hy + 0.5, ang); drawWeapon(g, gear.weapon); g.pop(); auraEnd(g, R(gear.weapon.hex), wi < 0 || !FXOK ? 0 : AURA[wi]);
  }
  g.begin(); g.ell(hx + 0.5, hy + 0.5, hr, hr, fist, 0.75); g.end();
  if (a.legs) poseLegs(g, a.legs, type === 'rags' ? C.rag2 : type === 'plate' || type === 'chain' ? ar : C.pants, type === 'plate' ? ar : C.leather, gear, type); else drawLegs(g, gear.armor, ar, skin, gear);
  drawTorso(g, gear.armor, ar, b, t, bd);
  if (gear.belt && BELT[gear.belt.type]) { const bt = gear.belt; piece(g, bt, (q, m, s, ti, k) => BELT[bt.type](q, bt, m, s, HIP - 3, t, ti, k)); }   // bältet (v4)
  if (gear.charm && CHARM[gear.charm.type] && !small) drawCharm(g, gear.charm, t);                      // berlocken hänger i bältet
  if (type !== 'robe' && type !== 'plate' && !a.noScarf) drawScarf(g, look.scarf ? R(look.scarf) : gear.armor ? as.cloth : C.red, b, t);
  const hm = gear.helmet ? HELM[gear.helmet.type] : null;
  drawHead(g, look, b, a.blink, hm && hm.hideHair, !!hm, sw, small);
  if (hm) { g.begin(); hm.draw(g, gear.helmet, R(gear.helmet.hex), SH - 10 + b, mat(gear.helmet), sw); g.end(); }
  // närmaste armen: bakom skölden, eller knuten näve vid höften
  g.begin();
  const [[fsx, fsy], [nxA, nyA]] = P.armFront, [nx, ny0] = a.handF || [nxA, nyA], ny = ny0 + hover, px = 31.5 - bw(bd) * 0.5, pw = bw(bd) * 0.4;
  arm(g, type, ar, skin, as, fsx, fsy + hover, nx, ny, a.bendF || [-2.2, 0.5], 3, bd, gear.hands);
  g.ell(nx, ny + 0.5, hr, hr, fist, 0.75);
  if (type === 'plate') { g.ell(px, SH + 2 + b, 5.4 + pw, 4.3 + pw * 0.7, ar); g.ell(px, SH + 2 + b, 5.4 + pw, 4.3 + pw * 0.7, as.trim, false, (dx, dy, d2) => d2 > 0.6 && dy > 0.1, 3); flair(g, as, ar, px - 1.5, SH + b); }   // stort axelskydd
  else if (type === 'chain') { g.ell(px + 0.5, SH + 2 + b, 4.2 + pw, 3.2 + pw * 0.6, C.leather); g.dot(px - 0.5, SH + 2 + b, C.steel, 5); }
  else if (type === 'robe') g.poly([[28 - bw(bd), SH + b], [35, SH + b - 0.5], [35.5, SH + 4 + b], [29 - bw(bd), SH + 5.5 + b]], ar, 5);
  g.end();
  if (held) { const gd = a.guard || [0, 0]; drawShield(g, held, 26.5 + gd[0], HIP - 2 + b + gd[1]); g.anchor.shield = g.pt(27 + gd[0], HIP - 1.5 + b + gd[1]); }
  if (sl && sl.n >= 6 && !a.noFx && SETFX[sl.id]) { g.begin(); SETFX[sl.id](g, t); g.end({ outline: false, edge: false }); }   // setets egen effekt från sex delar
  const w = gear.weapon;
  if (w && w.fx && !a.noFx && !small) weaponFx(g, w, t);
  g.pop(); FXOK = true;
}

// ---------- Ikon (32x32) för ett föremål, ritad med samma funktioner som på gubben ----------
// Ritbar = platsen och sorten har en ritfunktion här (rustningens okända sorter ritas som tunika).
const iconOk = (it) => { const D = { weapon: WEAPON, shield: { ...SHIELD, ...ON_BACK }, pet: PET, back: BACK, helmet: HELM, hands: HANDS, legs: LEGS, feet: FEET, belt: BELT, charm: CHARM }[it.slot]; return it.slot === 'armor' || !!(D && D[it.type]); };
const GREY = R('#7c82a0');                // provdockans ben och arm i ikonerna för de nya platserna
const ICON_K = { dagger: 1.3, club: 0.95, sword: 0.94, axe: 0.82, spear: 0.84, hammer: 0.78, staff: 0.86, great: 0.82, knives: 1.35 };
// Ikonerna visar storleken efter material mildare än gubben (roten ur skalan), så att också Star ryms i rutan och trä syns.
export function drawIcon(g, it, t = 0) {
  setBody(); T = t; FXOK = true;
  if (!it || !iconOk(it)) return;                                                     // okänd sort (nyare klient): tom ikon
  const s = mat(it), m = R(it.hex), ti = tierG(it), soft = (tbl) => 1 / Math.sqrt(gr(tbl, it));     // soft: ta bort halva skalan som ritfunktionen lägger på
  if (it.slot === 'weapon') {
    g.begin();
    const q = Math.sqrt(wsize(it));
    if (it.type === 'orb') { g.push(7.5, 34, 0, 1); drawWeapon(g, it, 1.75 * Math.min(1, q)); g.pop(); }
    else if (it.type === 'bow') { g.push(14.5, 16, 0, 1); drawWeapon(g, it, 0.88 * Math.min(1, q)); g.pop(); }
    else { const k = ICON_K[it.type] * Math.min(1.03, q), mid = (LEN[it.type] - 6) / 2 * k, an = 0.78; g.push(15.5 - Math.sin(an) * mid, 16.5 + Math.cos(an) * mid, an, 1); drawWeapon(g, it, k); g.pop(); }
    auraEnd(g, m, ti < 0 ? 0 : AURA[ti]);
  }
  if (it.slot === 'shield' && it.type === 'quiver') { g.push(14, 17, 0, 1.15); g.push(-29, -(SH + 7)); drawQuiver(g, it, 0, t); g.pop(); g.pop(); return; }
  // Nya platser (v4): delen på en grå provdocka (ben, fot eller underarm), eller bältet och berlocken för sig.
  if (it.slot === 'legs' || it.slot === 'feet') {
    const legs = it.slot === 'legs'; g.push(legs ? 16 : 15, legs ? 15 : 13, 0, legs ? 1.45 : 1.75); g.push(-39.5, legs ? -51.5 : -56.5);
    g.begin(); g.poly([[39, HIP - 1], [45, HIP - 1], [48, 56], [42.5, 56]], GREY, 2); g.poly([[32, HIP - 1], [38.5, HIP - 1], [35.5, 56], [30, 56]], GREY, 3);
    if (legs) { g.poly([[42, 55], [48, 55], [51, 58.5], [51, 61], [42, 61]], C.leather, 2); g.poly([[29, 55], [35.5, 55], [38, 58.5], [38, 61], [29, 61]], C.leather, 3); }
    g.end(); legPieces(g, { [it.slot]: it }, null, 'tunic'); g.pop(); g.pop(); return;
  }
  if (it.slot === 'hands') { g.begin(); g.thick(4, 2, 11, 10, 5, GREY, 3); g.end(); handPiece(g, it, 11, 10, 22.5, 23.5, 1.2, 3); g.begin(); g.ell(24.5, 25.5, 3.6, 3.6, fistOf(it) || GREY, 0.75); g.end(); return; }
  if (it.slot === 'belt') { g.push(15.5, 13, 0, 1.75); g.push(-38.5, -(HIP - 1.5)); piece(g, it, (q, m2, s2, ti2, k) => BELT[it.type](q, it, m2, s2, HIP - 3, t, ti2, k)); g.pop(); g.pop(); return; }
  if (it.slot === 'charm') { g.push(16, 6, 0, 2.6); drawCharm(g, it, t, [0, 0]); g.pop(); return; }
  if (it.slot === 'shield') { g.push(15, 15.5, 0, (it.type === 'round' ? 1.45 : 1.18) * soft(GRAND.shield) * (it.type === 'tower' ? 0.94 : 1)); drawShield(g, it, 0, 0); g.pop(); }
  if (it.slot === 'pet') { g.push(16, it.type === 'slime' ? 14 : 17, 0, (it.type === 'dragon' ? 1.05 : 1.25) * soft(GRAND.pet)); drawPet(g, it, 0, 0, 0.4); g.pop(); }
  if (it.slot === 'back') { const [cx, cy] = backCenter(it.type), cape = it.type === 'cape' || it.type === 'leafcloak'; g.push(16, 16, 0, (it.type === 'jetpack' ? 1.1 : cape ? 0.95 : 0.88) * soft(it.type === 'jetpack' ? GRAND.jet : cape ? GRAND.cape : GRAND.wings)); g.push(-cx, -cy); BACK[it.type](g, it, m, 0, 0.3, s); g.pop(); g.pop(); }
  if (it.slot === 'armor') {
    g.push(16, 16, 0, 1); g.push(-40, -(SH + 61) / 2);
    g.begin(); arm(g, it.type, m, m, s, 45, SH + 3, 49, SH + 11, [1, 0], 2); g.end();
    drawLegs(g, it, m, m); drawTorso(g, it, m, 0, 0.3);
    g.begin(); arm(g, it.type, m, m, s, 32.5, SH + 3, 30.5, HIP - 1.5, [-2.2, 0.5], 3);
    if (it.type === 'plate') { g.ell(31.5, SH + 2, 5.4, 4.3, m); g.ell(31.5, SH + 2, 5.4, 4.3, s.trim, false, (dx, dy, d2) => d2 > 0.6 && dy > 0.1, 3); flair(g, s, m, 30, SH); }
    g.end(); g.pop(); g.pop();
  }
  if (it.slot === 'helmet') {
    const tall = { wizard: 1, horned: 1, great: 1, crown: 1 }[it.type];
    g.push(tall ? 17 : 16, tall ? 21 : 17, 0, tall ? 0.8 : 1); g.push(-39.5, -26.5);
    g.begin(); g.ell(HX, 26.5, 11, 10, R('#565a78'), true); g.end();
    g.begin(); HELM[it.type].draw(g, it, m, 26, s, [0, 0]); g.end(); g.pop(); g.pop();
  }
}
