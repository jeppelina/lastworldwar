// Nya fiender för kommande världar (prototyp). Samma kontrakt som game/enemies.js:
// draw(g, t, pose): motorn har redan gjort g.push(x, y) så att (0, 0) är marken mitt under varelsen.
// Varelsen tittar åt VÄNSTER, uppåt är negativt y. pose = { attack: 0..1, hurt: 0..1 }.
// ROSTER_NEW längst ner har samma postformat som ROSTER i spelet, plus några textfält för granskningsarket.
import { ramp as R } from './pixel.js';

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), bone: R('#ece4cf'), gold: R('#f2b632'), red: R('#d8433b'),
  wood: R('#9a6b3f'), leather: R('#8a5a34'), steel: R('#aab6c4'), fire: R('#ff7a1f'), fire2: R('#ffd84a'),
  ice: R('#bff0ff'), purple: R('#9a6bff'), pink: R('#ee8fa8'), leaf: R('#58b04a'), orange: R('#f08a2a'),
  rust: R('#b5632a'), snow: R('#eef4fb'), navy: R('#39446e'), moss: R('#6fa544'), smoke: R('#8d8aa0'),
  ink: R('#3a3f8a'),
  // Kejsarens armé: samma färger som kejsaren själv i game/intro.js
  eArm: R('#4a3f78'), eDark: R('#2f2752'), eCape: R('#a8243f'), eTrim: R('#e0aa3c'), eEye: R('#ffc23a'),
};
const { sin, cos, PI, abs, max, min, floor, ceil, sqrt } = Math;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
const P = (pose) => ({ a: clamp((pose && pose.attack) || 0), hu: clamp((pose && pose.hurt) || 0) });
const bump = (a) => sin(clamp(a) * PI);                       // 0 → 1 → 0
// Attackkurva (samma som i spelet): laddar bakåt (ner till -0,6), slår fram till 1 och går tillbaka till 0.
const strike = (a) => (a <= 0 ? 0 : a < 0.35 ? -0.6 * sin((a / 0.35) * PI / 2) : a < 0.6 ? -0.6 + 1.6 * ((a - 0.35) / 0.25) : 1 - (a - 0.6) / 0.4);
const blinkAt = (t, seed = 0) => ((t + seed * 1.37) % 3.4) < 0.14;
const step = (t, sp = 2.6, ph = 0) => (sin(t * sp + ph) > 0.3 ? 1 : 0);   // andning i hela pixlar, som hjälten
const ease = (p) => { p = clamp(p); return p * p * (3 - 2 * p); };
const seg = (a, x0, x1) => clamp((a - x0) / (x1 - x0));
const mix = (p, q, u) => p + (q - p) * u;
const fract = (v) => v - floor(v);
// Efterdallring när slaget har landat: dämpad svängning som dör ut mot a = 1.
const settle = (a, amp = 1, f = 20) => (a > 0.6 ? sin((a - 0.6) * f) * (1 - a) * 2.5 * amp : 0);
// Träff: först hoptryckt (positivt), sedan en liten sträckning på väg tillbaka (negativt).
const squash = (hu) => hu * hu - bump(hu) * 0.3;
// Vana som kommer ibland: 0 utanför fönstret, annars 0..1 genom det.
const habit = (t, per, dur, off = 0) => { const u = (((t + off) % per) + per) % per; return u < dur ? max(0.001, u / dur) : 0; };
// Mjuk andning 0..1: snabbare in, långsammare ut.
const breath = (t, sp = 2) => { const u = fract((t * sp) / (2 * PI)); return u < 0.4 ? ease(u / 0.4) : 1 - ease((u - 0.4) / 0.6); };

// Öga: vit glob med mörk pupill. Samma som i game/enemies.js.
function eye(g, x, y, w, h, o = {}) {
  if (o.shut) { g.rect(x, y + floor(h / 2), w, 1, C.dark, 0); return; }
  g.rect(x, y, w, h, o.col ?? C.white, 5);
  const pw = o.pw ?? max(1, ceil(w / 2)), ph = o.ph ?? max(1, ceil(h * 0.6));
  g.rect(x + (o.dx ?? 0), y + (o.dy ?? h - ph), pw, ph, C.dark, 0);
  if (o.mood === 'arg') g.poly(o.inner > 0 ? [[x - 1, y - 1], [x + w + 1, y - 1], [x + w + 1, y + h * 0.6]] : [[x - 1, y - 1], [x + w + 1, y - 1], [x - 1, y + h * 0.6]], o.lid ?? C.dark, o.lid != null ? 1 : 0);
  if (o.mood === 'somnig') g.rect(x, y, w, ceil(h / 2), o.lid ?? C.dark, 2);
  if (o.mood === 'lomsk') g.rect(x, y, w, max(1, floor(h / 3)), o.lid ?? C.dark, 1);
}
const peep = (g, x, y, shut, h = 3) => { if (shut) g.rect(x, y + 1, 2, 1, C.dark, 0); else { g.rect(x, y, 2, h, C.dark, 0); g.dot(x, y, C.white, 5); } };
// Kedja av kulor längs en kvadratisk bezier (halsar, snablar, tentakler).
function tube(g, p0, p1, p2, r0, r1, rp, n = 8, shade = true, lv = 3) {
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u, r = r0 + (r1 - r0) * u;
    g.ell(v * v * p0[0] + 2 * u * v * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * p1[1] + u * u * p2[1], r, r, rp, shade, null, lv);
  }
}
// Tecken ur ett litet pixelraster ('#' = fylld ruta, c = rutans storlek).
function glyph(g, x, y, rows, rp, lv = 5, c = 2) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.rect(x + i * c, y + j * c, c, c, rp, lv); }); }
const LA = ['.#.', '#.#', '###', '#.#', '#.#'], LB = ['##.', '#.#', '##.', '#.#', '##.'], LC = ['.##', '#..', '#..', '#..', '.##'];
const FIVE = ['###', '#..', '##.', '..#', '##.'], ZED = ['####', '..#.', '.#..', '####'];

// ====================================================================================================
// SVAMPTRÄSKET
// ====================================================================================================

// ---------- Snorkel: gömmer sig under ett näckrosblad, bara ögonen och vasstrået syns ----------
function snorkel(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#6f9a62'), pad = R('#4f9f4a'), wat = R('#3d7a86');
  const s = strike(a), dip = bump(habit(t, 7.3, 1.8));                 // dyker ibland och kikar upp igen
  const rise = a > 0 ? (s < 0 ? s * 8 : s * 13) + settle(a, 1.2) : -dip * 5 + sin(t * 2.1) * 0.7;
  const hy = -2 - rise + squash(hu) * 4, shut = hu > 0.3 || blinkAt(t, 3), look = sin(t * 0.8) > 0.2 ? 0 : 2;
  const clip = (cy, ry) => (dx, dy) => cy + dy * ry < -1.5;            // allt under vattenytan klipps bort
  g.push(hu * 2, 0, 0, o.k || 1);
  g.begin();                                             // vattenpöl
  g.ell(0, -1.5, 17, 3.4, wat, false, null, 2); g.rect(-11, -3, 5, 1, wat, 4); g.rect(7, -1, 4, 1, wat, 4);
  g.end();
  g.begin();                                             // vasstrå, kropp, huvud
  g.thick(6, min(-2, hy - 1), 8, hy - 15, 2.2, C.bone, 3); g.thick(8, hy - 15, 4, hy - 18, 2.2, C.bone, 4); g.rect(6, hy - 11, 3, 2, C.red, 3);
  for (let i = 0; i < 2; i++) { const ph = (t * 0.6 + i * 0.5) % 1; g.rect(2 - i, hy - 21 - ph * 7, ph < 0.6 ? 2 : 1, ph < 0.6 ? 2 : 1, C.ice, 5); }
  if (rise > 3) {
    const up = clamp((rise - 3) / 8);
    g.ell(0, hy + 9, 6.5, 9, m, true, clip(hy + 9, 9)); g.ell(-1, hy + 9, 4, 6, R('#cfe0a0'), false, clip(hy + 9, 6), 4);
    g.thick(-6, hy + 6, -11, hy + 6 - up * 6, 2, m, 4); g.thick(6, hy + 6, 11, hy + 5 - up * 5, 2, m, 2);
  }
  g.ell(0, hy, 9.5, 7.5, m, true, clip(hy, 7.5));
  g.end();
  g.begin();                                             // näckrosblad som hatt (flyger upp vid träff)
  g.push(3, hy - 8.5 - hu * 5, -hu * 0.7 + settle(a, 0.05));
  g.ell(0, 0, 8, 2.6, pad, false, null, 3); g.line(-7, 0, -3, 0, pad, 1); g.ell(4, -2, 2.2, 1.6, C.pink); g.dot(4, -3, C.fire2, 5);
  g.pop();
  g.end();
  if (hy < 2.5) {
    g.begin();                                           // ögon uppe på huvudet
    g.ell(-4.5, hy - 5.5, 3, 3, m, false, null, 4); g.ell(1.5, hy - 5.5, 3, 3, m, false, null, 4);
    eye(g, -6, hy - 8, 3, 3, { shut, pw: 1, ph: 2, dx: look, mood: 'lomsk', lid: m }); eye(g, 0, hy - 8, 3, 3, { shut, pw: 1, ph: 2, dx: look, mood: 'lomsk', lid: m });
    if (rise > 5) { if (a > 0.42 && a < 0.9) g.ell(-6, hy + 2, 2, 2, C.dark, false, null, 0); else g.rect(-7, hy + 2, 5, 1, C.dark, 0); }
    g.end();
  }
  if (a > 0.45) {                                        // vattenstråle
    g.begin(); for (let i = 0; i < 5; i++) { const u = seg(a, 0.45, 0.92) - i * 0.09; if (u > 0) g.rect(-9 - u * 30, hy + 1 + u * u * 12, 3 - (i > 2), 2, C.ice, 5); } g.end();
  }
  g.begin(); g.rect(-11, -2, 22, 1, wat, 5); g.rect(-14, 0, 6, 1, wat, 4); g.rect(4, 0, 8, 1, wat, 4); g.end({ outline: false, edge: false });   // ytan framför
  g.pop();
}

// ---------- Mygga (pytteliten, i svärm): lång snabel, dinglande ben ----------
function mozzie(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#5f6f92'), s = strike(a);
  const hov = 13 + sin(t * 3.4) * 1.5, dx = sin(t * 1.7) * 2.5, fl = sin(t * 38) > 0 ? 1 : 0;
  g.push(dx + hu * 3 - s * 3, -hov - max(0, -s) * 2, hu * 1.4 - s * 0.2, o.k || 1);
  g.begin();                                             // vingar
  g.poly([[0, -2], [3, -8 - fl * 2], [7, -6 - fl], [4, -2]], C.ice, 5); g.poly([[1, -2], [7, -5 + fl * 3], [9, -2 + fl * 2], [4, -1]], C.ice, 4);
  g.end();
  g.begin();
  for (let i = 0; i < 3; i++) { const lag = sin(t * 3.4 - 0.9 - i * 0.4) * 1.2; g.line(i * 2, 1, -1 + i * 2.5 + lag, 5, m, 1); }   // benen dinglar efter
  g.ell(2.5, 0, 4, 2.6, m); g.rect(2, -2, 1, 4, C.fire2, 4); g.rect(5, -1, 1, 3, C.fire2, 4);
  g.ell(-3, -1, 2.8, 2.8, m);
  // snabel: hänger i vila, rak som en nål i stöten, sicksack efter en smäll
  if (hu > 0.3) { g.line(-5, 0, -7, 2, C.dark, 0); g.line(-7, 2, -9, 0, C.dark, 0); g.line(-9, 0, -10, 2, C.dark, 0); }
  else g.line(-5, 0, -11 - max(0, s) * 3, a > 0.05 ? 0 : 2, C.dark, 0);
  if (hu > 0.3) g.rect(-5, -2, 2, 1, C.dark, 0); else { g.rect(-5, -3, 2, 2, C.white, 5); g.dot(-5, -2, C.dark, 0); }
  g.end();
  g.pop();
}

// ---------- Grumpstump: sur gammal stubbe som går på rötterna ----------
function stump(g, t, pose, o) {
  const { a, hu } = P(pose), bk = R('#7d5c3e'), wd = R('#d6b684'), s = strike(a), b = breath(t, 1.6), q = squash(hu);
  const shut = hu > 0.3 || blinkAt(t, 5), hm = a > 0 ? 0 : bump(habit(t, 6.1, 1.1));     // fnyser ibland
  const top = -38 - b * 1.5 + q * 4;
  g.push(hu * 2, 0, hu * 0.08 - s * 0.07 + settle(a, 0.012), o.k || 1);
  if (a > 0.4) {                                         // rot som slår upp ur marken
    const u = bump(seg(a, 0.4, 0.95)); g.begin();
    g.poly([[-42, 0], [-38 - u * 4, -u * 18], [-35, -u * 8], [-32, 0]], bk, 3); g.poly([[-38 - u * 4, -u * 18], [-43 - u * 5, -u * 12], [-39, -u * 10]], bk, 4);
    g.end();
  }
  g.begin();                                             // bortre grenarm med ett ensamt löv som släpar efter
  const lag = sin(t * 1.6 - 1.2) * 2 + settle(a, 2);
  g.thick(13, -24, 23, -31 + lag * 0.3, 3, bk, 2); g.thick(23, -31 + lag * 0.3, 28, -37 + lag * 0.5, 2, bk, 2); g.line(23, -31, 27, -29, bk, 2);
  g.poly([[28, -37 + lag * 0.5], [33, -40 + lag], [34, -35 + lag], [30, -34 + lag * 0.5]], C.leaf, 4);
  g.end();
  g.begin();                                             // rötter och stam
  g.poly([[-13, -8], [-27, -1], [-28, 0], [-10, 0]], bk, 2); g.poly([[12, -8], [26, -2], [28, 0], [8, 0]], bk, 2); g.poly([[-4, -4], [-9, 0], [5, 0], [2, -4]], bk, 2);
  g.poly([[-15, 0], [-13, -28], [-15, top + 2], [14, top + 2], [14, -28], [17, 0]], bk, 3);
  for (const [x, y, hh] of [[-9, -6, 5], [8, -12, 12], [11, -30, 6], [5, -4, 4]]) g.rect(x, y - hh, 1, hh, bk, 1);    // barkfåror
  g.ell(-8, -4, 5, 2.5, C.moss, false, null, 3); g.ell(11, -8, 3, 2, C.moss, false, null, 3);
  const ey = -27 - b, br = a > 0.05 ? 2 : hm * 1.5;      // ansikte: tunga ögonbryn, små gula ögon, kvisthål till mun
  eye(g, -10, ey, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, dy: 1 }); eye(g, -3, ey, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, dy: 1 });
  g.poly([[-13, ey - 3 - br], [-6, ey - 1], [-6, ey - 3], [-13, ey - 5 - br]], bk, 1); g.poly([[2, ey - 3 - br], [-4, ey - 1], [-4, ey - 3], [2, ey - 5 - br]], bk, 1);
  g.poly([[-13, ey + 3], [-19, ey + 3], [-13, ey + 6]], bk, 4);
  g.ell(-5, -15, 4 + hm, 1.6 + (a > 0.05 ? 2 : hm * 1.6), C.dark, false, null, 0); g.dot(-10, -14, C.dark, 0); g.dot(0, -14, C.dark, 0);
  g.end();
  g.begin();                                             // snittyta med årsringar
  g.ell(-0.5, top + 2, 15.5, 4.5, wd, false, null, 4); g.ell(-0.5, top + 2, 10, 2.8, wd, false, (dx, dy, d2) => d2 > 0.6, 2); g.ell(-1, top + 2, 4, 1.2, wd, false, null, 2);
  g.end();
  g.begin();                                             // skott och svamp på toppen: studsar till efter resten
  const sp = sin(t * 1.6 - 0.8) * 1.5 + settle(a, 1.5) - q * 3;
  g.thick(5, top + 1, 6 + sp * 0.4, top - 6, 1.4, C.leaf, 2); g.poly([[6 + sp * 0.4, top - 6], [11 + sp, top - 10], [12 + sp, top - 5]], C.leaf, 4); g.poly([[6 + sp * 0.4, top - 6], [2 + sp, top - 10], [1 + sp, top - 6]], C.leaf, 3);
  g.rect(-10, top - 2, 2, 3, C.bone, 3); g.ell(-9, top - 2.5, 3.2, 2.2, C.red, true, (dx, dy) => dy < 0.4);
  g.end();
  g.begin();                                             // närmre grenarm: höjs i laddningen och slår ner
  const ax = -24 - max(0, s) * 4, ay = -24 + s * 12;
  g.thick(-13, -20, ax + 4, ay, 3.6, bk, 3); g.thick(ax + 4, ay, ax, ay - 3, 2.6, bk, 4);
  g.line(ax, ay - 3, ax - 4, ay - 6, bk, 3); g.line(ax, ay - 3, ax - 4, ay - 1, bk, 3); g.line(ax + 1, ay - 3, ax, ay - 8, bk, 3);
  g.end();
  if (hm > 0.2) { g.begin(); g.ell(-17 - hm * 5, -17 - hm * 3, 2 + hm * 1.5, 1.5 + hm, C.bone, false, null, 4); g.end(); }
  g.pop();
}

// ====================================================================================================
// FROSTBERGEN
// ====================================================================================================

// ---------- Scoop: blyg mullvad i en snöhög, gräver sig fram under snön ----------
function mole(g, t, pose, o) {
  const { a, hu } = P(pose), fur = R('#6f6078'), sn = C.snow, q = squash(hu);
  const peek = a > 0 ? 0 : bump(habit(t, 8.2, 2.2));
  // d = hur långt ner i hålet han är. Attack: dyker, gräver sig fram, poppar upp och hugger, dyker hem igen.
  const d = a > 0 ? (a < 0.22 ? ease(a / 0.22) * 15 : a < 0.4 ? 15 : a < 0.5 ? mix(15, -7, ease(seg(a, 0.4, 0.5))) : a < 0.66 ? -7 + sin((a - 0.5) * 40) * 1.5 * (0.66 - a) / 0.16 : a < 0.82 ? mix(-7, 15, ease(seg(a, 0.66, 0.82))) : mix(15, 0, ease(seg(a, 0.82, 1)))) : peek * 8 + q * 6;
  const by = -11 + d, shut = hu > 0.3 || blinkAt(t, 2), tw = !a && step(t, 7) ? 1 : 0, out = a > 0.4 && a < 0.66;
  g.push(hu * 2, 0, 0, o.k || 1);
  if (a > 0.12 && a < 0.92 && d > 8) {                   // snösprut när han gräver
    g.begin(); for (let i = 0; i < 4; i++) { const u = (t * 5 + i * 0.27) % 1; g.rect(7 + i * 3 + u * 6, -6 - bump(u) * 8, 2, 2, sn, 5); } g.end();
  }
  const under = (cy, ry) => (dx, dy) => cy + dy * ry < -1;      // inget av kroppen syns under marken
  g.begin();                                             // kropp i hålet
  g.ell(0, by, 7.5, 9, fur, true, under(by, 9)); g.ell(-1.5, by + 3, 4.5, 5, R('#b9a9b8'), false, under(by + 3, 5), 4);
  if (by < -5) {
    g.poly([[-5, by - 5], [-11, by - 4 + tw], [-5, by - 1]], fur, 4); g.ell(-11, by - 4 + tw, 2, 1.8, C.pink);
    g.line(-8, by - 2, -12, by - 1, C.bone, 5); g.line(-8, by - 1, -11, by + 1, C.bone, 5);
  }
  if (by < 3) {
    if (shut) g.rect(-5, by - 6, 3, 1, C.dark, 0); else { g.rect(-5, by - 7, 2, 2, C.dark, 0); g.dot(-5, by - 7, C.white, 5); }
    g.ell(0, by - 2, 8.2, 8.6, C.red, false, (dx, dy, d2) => d2 > 0.7 && dy < -0.3, 3);     // röda öronmuffar
    g.ell(3, by - 5 - hu * 5, 3, 3.6, C.red, true, under(by - 5 - hu * 5, 3.6));
  }
  g.end();
  g.begin();                                             // snöhögen framför kroppen
  g.ell(-13, 0, 5, 3.5, sn, true, (dx, dy) => dy < 0); g.ell(13, 0, 6, 4, sn, true, (dx, dy) => dy < 0);
  g.ell(0, 0, 15, 8, sn, true, (dx, dy) => dy < 0);
  g.end();
  if (d < 12) {                                          // grävklor: vilar på kanten, hugger när han poppar upp
    g.begin(); const sw = out ? ease(seg(a, 0.44, 0.52)) : 0;
    for (const [x, lv] of [[-8, 4], [6, 3]]) {
      const X = x - sw * 5, Y = min(by + 4, -7) - (out ? 7 - sw * 10 : 0);
      g.ell(X, Y, 3, 2.4, C.pink, false, null, lv); for (let i = 0; i < 3; i++) g.rect(X - 3 + i * 2, Y + 1, 1, 3, C.bone, 5);
    }
    g.end();
  }
  if (a > 0.48 && a < 0.9) { g.begin(); for (let i = 0; i < 3; i++) { const u = seg(a, 0.48, 0.88) - i * 0.1; if (u > 0) g.rect(-13 - u * 24, -13 - bump(u) * 8 + i * 3, 3, 3, sn, 5); } g.end(); }
  g.pop();
}

// ---------- Snowbie (liten, i svärm): fnittrig snöboll som rullar ----------
function snowbie(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), q = squash(hu), r = 6.5;
  const rock = sin(t * 1.8) * 0.45, ang = a > 0 ? (s < 0 ? -s * PI * 0.5 : -s * PI * 2) : rock;      // rullar utan att glida
  const shut = hu > 0.3 || blinkAt(t, 1);
  g.push((a > 0 ? max(0, -s) * 5 : rock * r) + hu * 2, -r * (1 - q * 0.35) - (a > 0 ? bump(seg(a, 0.35, 0.6)) * 3 : 0), 0, o.k || 1);
  if (a > 0.35 && a < 0.8) { g.begin(); for (let i = 0; i < 3; i++) { const u = (t * 6 + i * 0.33) % 1; g.rect(6 + u * 8, r - 2 - bump(u) * 4, 2, 2, C.snow, 4); } g.end(); }
  g.begin();
  g.ell(0, 0, r * (1 + q * 0.3), r * (1 - q * 0.35), C.snow);
  g.push(0, 0, ang);
  g.thick(0, -r + 1, 1, -r - 4, 1.4, C.wood, 3); g.line(1, -r - 3, 3, -r - 5, C.wood, 3);       // kvist som lugg
  if (shut) { g.rect(-4, -1, 2, 1, C.dark, 0); g.rect(0, -1, 2, 1, C.dark, 0); } else { g.rect(-4, -2, 2, 2, C.dark, 0); g.rect(0, -2, 2, 2, C.dark, 0); }
  g.poly([[-3, 0.5], [-8, 1.5], [-3, 2.5]], C.orange, 4);
  g.dot(-3, 4, C.dark, 0); g.dot(-1, 4, C.dark, 0); g.dot(1, 3, C.dark, 0);
  g.pop();
  g.end();
  g.pop();
}

// ---------- Sir Tusk: högfärdig valross med monokel, magplask ----------
function walrus(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#9a7466'), mz = R('#d9b9a0'), s = strike(a), b = breath(t, 1.5), q = squash(hu);
  const shut = hu > 0.3 || blinkAt(t, 6), hf = a > 0 ? 0 : bump(habit(t, 6.7, 1.4));       // harklar sig och pöser
  const rear = max(0, -s) / 0.6, dn = max(0, s);
  g.push(13 + hu * 2, 0, rear * 0.3 - dn * 0.05 + hu * 0.06 + settle(a, 0.012), o.k || 1);       // reser sig kring bakdelen
  g.begin();                                             // stjärtfenor: smäller i isen lite efter andningen
  const tf = sin(t * 1.5 - 1.4) * 2 + settle(a, 2);
  g.poly([[4, -8], [15, -10 - tf], [19, -5 - tf], [10, -2]], m, 2); g.poly([[4, -3], [17, -3], [19, 0], [5, 0]], m, 2);
  g.end();
  g.begin();                                             // kropp
  g.ell(-14, -13 - b + dn * 1.5, 25 + dn * 1.5, 13 + b - q * 2 - dn * 1.5, m);
  g.ell(-18, -7, 15, 6, mz, false, (dx, dy) => dy > -0.2, 4);
  for (const [x, y] of [[-2, -20], [4, -15], [-8, -23]]) g.rect(x, y - b, 3, 1, m, 2);
  g.end();
  g.begin(); g.poly([[-26, -9], [-20, -9], [-22, -1], [-34, 0], [-36, -2], [-29, -3]], m, 4); g.end();   // främre labb
  g.push(-36, -25 - b * 0.6 - hf * 2 + q * 3, hf * 0.15);
  g.begin();                                             // huvud
  g.ell(0, 0, 10.5, 10, m);
  g.poly([[-9, 4], [-6, 4], [-8, 16], [-10, 12]], C.bone, 5); g.poly([[-4, 5], [-1, 5], [-2, 17], [-4, 13]], C.bone, 4);   // betar
  g.ell(-8, 3, 5 + hf, 4 + hf, mz, 0.9); g.ell(-2, 4, 5 + hf, 4 + hf, mz, 0.9);                                          // nosdynor
  g.rect(-6, -1, 3, 2, C.dark, 0);
  for (const [x, y] of [[-10, 2], [-8, 4], [-11, 5], [-2, 3], [0, 5], [-4, 6]]) g.dot(x, y, C.dark, 0);
  eye(g, -8, -6, 3, 3, { shut, pw: 1, ph: 2, mood: 'somnig', lid: m }); eye(g, -1, -6, 3, 3, { shut, pw: 1, ph: 2, mood: 'somnig', lid: m });
  g.end();
  g.begin();                                             // monokel på kedja: hoppar ur vid träff
  const mx = hu * 5, my = -hu * 7, ch = sin(t * 1.5 - 1) * 1.2;
  g.ell(0.5 + mx, -4.5 + my, 3.8, 3.8, C.gold, false, (dx, dy, d2) => d2 > 0.5, 4); g.line(4 + mx, -3 + my, 6 + ch, 6, C.gold, 3);
  g.end();
  g.pop();
  if (a > 0.56) { g.begin(); for (let i = 0; i < 4; i++) { const u = seg(a, 0.56, 1); g.rect(-48 - u * 16 - i * 4, -2 - bump(u) * (5 + i * 3), 3, 3, C.snow, 5); } g.end(); }
  g.pop();
}

// ---------- Big Wool: jättelik mammut med snö på ryggen ----------
function mammoth(g, t, pose, o) {
  const { a, hu } = P(pose), fur = R('#96684a'), fur2 = R('#7a5038'), s = strike(a), b = breath(t, 1.2), q = squash(hu);
  const shut = hu > 0.3 || blinkAt(t, 9), ear = a > 0 ? 0 : bump(habit(t, 5.3, 0.9)), up = max(0, -s) / 0.6, dn = max(0, s);
  g.push(hu * 3, 0, hu * 0.04 + up * 0.03, o.k || 1);
  g.begin();                                             // bortre ben och svans
  g.thick(-26, -34, -27, -2, 15, fur2, 1); g.thick(36, -34, 37, -2, 15, fur2, 1);
  const tl = sin(t * 1.2 - 1.5) * 3; g.thick(61, -62, 66 + tl, -44, 3, fur2, 2); g.ell(66 + tl, -42, 3, 4, fur2);
  g.end();
  g.begin();                                             // kropp med pälsfrans under buken
  g.ell(18, -58 - b, 46, 32 + b - q * 3, fur);
  const fr = []; for (let i = 10; i >= 0; i--) fr.push([-24 + i * 8.4, -30 + (i % 2 ? 8 : 2) + sin(t * 1.2 - i * 0.5)]);
  g.poly([[-24, -42], [60, -42], ...fr], fur, 2);
  for (const [x, y] of [[-2, -66], [10, -54], [24, -70], [34, -52], [46, -64], [20, -42], [2, -44], [52, -46]]) { g.line(x, y - b, x + 3, y + 5 - b, fur, 2); g.line(x + 3, y + 5 - b, x + 6, y - b, fur, 2); }     // raggig päls
  g.end();
  g.begin();                                             // närmre ben; framfoten lyfts och stampar
  const st = up * 10;
  g.thick(-8, -36, -9, -6 - st, 17, fur, 3); g.rect(-18, -7 - st, 18, 7, fur, 2); for (const x of [-17, -11, -5]) g.rect(x, -3 - st, 4, 3, C.bone, 4);
  g.thick(52, -36, 53, -6, 17, fur, 3); g.rect(44, -7, 18, 7, fur, 2); for (const x of [45, 51, 57]) g.rect(x, -3, 4, 3, C.bone, 4);
  g.end();
  g.begin(); g.ell(20, -84 - b, 32, 8, C.snow, true, (dx, dy) => dy < 0.1); g.end();           // snö på ryggen
  const hx = -36, hy = -74 - b * 0.7 + q * 4 - up * 5 + dn * 4;
  g.begin(); tube(g, [hx, hy + 14], [hx - 26, hy + 40 - up * 6], [hx - 38, hy + 10 - up * 8 + dn * 6], 4, 1.5, C.bone, 26, false, 2); g.end();   // bortre bete
  g.begin();                                             // huvud och öra
  g.ell(hx, hy, 25, 26, fur); g.ell(hx + 4, hy - 22, 10, 6, fur);
  for (const [x, y] of [[4, 8], [-4, 16], [8, 18], [-14, -14], [-6, -20]]) { g.line(hx + x, hy + y, hx + x + 3, hy + y + 5, fur, 2); g.line(hx + x + 3, hy + y + 5, hx + x + 6, hy + y, fur, 2); }
  g.poly([[hx - 2, hy + 18], [hx + 3, hy + 30], [hx + 8, hy + 21], [hx + 13, hy + 31], [hx + 18, hy + 16]], fur, 2);     // kindskägg
  g.end();
  g.begin();
  g.ell(hx + 15, hy - 4, 6.5 - ear * 3 - clamp(hu * 2) * 2, 9, fur2); g.ell(hx + 14.5, hy - 3.5, 3.4 - ear * 1.5, 5.5, R('#b98a6a'), false, null, 3);
  g.end();
  g.begin(); tube(g, [hx - 8, hy + 16], [hx - 36, hy + 46 - up * 6], [hx - 46, hy + 12 - up * 8 + dn * 6], 4.5, 1.6, C.bone, 28); g.end();     // närmre bete
  g.begin();                                             // snabel: gungar i vila, lyfts högt i laddningen, sveper ner i slaget
  const sw = sin(t * 1.2 - 0.6) * 3;
  const cx = hx - 30 + sw + up * -6 + dn * -10, cy = hy + 30 + up * -36 + dn * -10, tx = hx - 22 + sw * 2 + dn * -30, ty = hy + 52 + up * -82 + dn * -2;
  tube(g, [hx - 18, hy + 6], [cx, cy], [tx, ty], 8, 4.5, fur, 13);
  g.ell(tx - 1, ty + (up > 0.3 ? -2 : 2), 4, 3, R('#b98a6a'), false, null, 4);
  g.end();
  g.begin();                                             // öga, snömössa och hårtofs
  eye(g, hx - 15, hy - 5, 4, 4, { shut, pw: 2, ph: 3, mood: a > 0.05 ? 'arg' : 'somnig', inner: 1, lid: fur });
  g.line(hx - 17, hy - 8, hx - 10, hy - 9, fur, 1);
  g.end();
  g.begin();
  g.ell(hx + 2, hy - 23, 14, 6, C.snow, true, (dx, dy) => dy < 0.3);
  const tu = sin(t * 1.2 - 1) * 2 + settle(a, 2);
  for (const [x, hh] of [[-3, 8], [2, 11], [7, 7]]) g.poly([[hx + x - 2, hy - 27], [hx + x + tu, hy - 27 - hh], [hx + x + 2, hy - 27]], fur2, 3);
  g.end();
  if (a > 0.58) { g.begin(); for (let i = 0; i < 5; i++) { const u = seg(a, 0.58, 1); g.rect(-22 - i * 7 - u * 12, -2 - bump(u) * (4 + i * 2), 3, 3, C.snow, 5); g.rect(-4 + i * 12, -88 + u * 30 + i * 3, 2, 2, C.snow, 5); } g.end(); }
  g.pop();
}

// ====================================================================================================
// MENINGSVULKANEN
// ====================================================================================================

// ---------- Coal Crew (små, i svärm): kolbitar som blåser upp sig och glöder ----------
function coal(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), hot = a > 0 ? clamp(max(0, s) * 1.4) : 0, m = hot > 0.5 ? C.fire : R('#453c50');
  const hu2 = (t * 1.4) % 1, hop = hu2 < 0.35 ? bump(hu2 / 0.35) : 0, land = hu2 >= 0.35 && hu2 < 0.5 ? 1 : 0;     // litet skutt, sedan vila
  const lift = a > 0 ? max(0, s) * 3 : hop * 3, cr = a > 0 ? max(0, -s) * 2.5 : land;
  g.push(hu * 2, -lift, hu * 0.9, (o.k || 1) * (1 + hot * 0.3));
  g.begin();
  if (hot > 0.3) { const f = sin(t * 30) * 1.5; g.poly([[-4, -9], [-3, -15 - f], [0, -11], [2, -17 + f], [5, -9]], C.fire2, 5); }
  else { const f = step(t, 12); g.rect(1, -12 - f + cr, 1, 2 + f, C.fire, 5); g.dot(2, -13 - f * 2 + cr, C.fire2, 5); }     // glödgnista som hår
  g.rect(-4, -2, 3, 2, m, 1); g.rect(2, -2, 3, 2, m, 1);
  g.poly([[-6, -3], [-7, -7 + cr], [-3, -11 + cr], [3, -10 + cr], [7, -6 + cr], [6, -2], [0, -1]], m, 3);
  g.poly([[-3, -11 + cr], [3, -10 + cr], [1, -8 + cr], [-4, -8 + cr]], m, 5);
  if (hot <= 0.5) { g.line(3, -7 + cr, 5, -4, C.fire, 5); g.line(5, -4, 4, -3, C.fire, 5); }
  if (hu > 0.3) { g.rect(-5, -6 + cr, 2, 1, C.fire, 3); g.rect(-1, -6 + cr, 2, 1, C.fire, 3); }
  else { g.rect(-5, -7 + cr, 2, 2, hot > 0.5 ? C.white : C.fire2, 5); g.rect(-1, -7 + cr, 2, 2, hot > 0.5 ? C.white : C.fire2, 5); }
  g.end();
  if (a > 0.75) { g.begin(); const u = seg(a, 0.75, 1); g.ell(1, -13 - u * 6, 2 + u * 2, 1.5 + u * 1.5, C.smoke, false, null, 4); g.end(); }
  g.pop();
}

// ---------- Old Whistler: vresig kittel som kokar över ----------
function kettle(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#5c6178'), s = strike(a), q = squash(hu);
  // trycket byggs upp långsamt, släpps med en puff och börjar om
  const pu = (t / 3.6) % 1, pr = a > 0 ? clamp(a / 0.35) * (a < 0.6 ? 1 : 0) : pu < 0.85 ? pu / 0.85 : 0, puff = a > 0 ? 0 : pu >= 0.85 ? (pu - 0.85) / 0.15 : 0;
  const rat = pr > 0.4 ? (sin(t * 34) > 0 ? 1 : 0) * (pr > 0.75 ? 2 : 1) : 0;         // locket skramlar
  const tilt = -max(0, s) * 0.38 + max(0, -s) * 0.2 + settle(a, 0.12);
  const shut = hu > 0.3 || blinkAt(t, 4), sw = max(0, -s) * 1.5 + pr * 0.6;
  g.push(hu * 2, 0, tilt + hu * 0.12, o.k || 1);
  g.begin();                                             // glöd under
  const f = sin(t * 11); g.poly([[-5, 0], [-3, -3 - f], [-1, -1], [1, -4 + f], [3, -1], [5, -3 - f], [6, 0]], C.fire, 4);
  g.end();
  g.begin(); g.rect(-9, -3, 4, 3, m, 1); g.rect(6, -3, 4, 3, m, 1); g.end();
  g.begin(); g.ell(1, -22, 9, 7.5, m, false, (dx, dy, d2) => d2 > 0.55 && dy < 0.3, 2); g.end();     // handtag
  g.begin();                                             // pip och kropp
  g.poly([[-9, -9], [-19, -19], [-17, -22], [-13, -20], [-7, -15]], m, 4);
  g.ell(1, -12 + q * 2, 12.5 + sw + q * 2, 10.5 - q * 2 + sw * 0.5, m);
  const ey = -15 + q * 2;
  eye(g, -8, ey, 3, 3, { shut, pw: 1, ph: 2, mood: 'arg', inner: 1, lid: m }); eye(g, -2, ey, 3, 3, { shut, pw: 1, ph: 2, mood: 'arg', inner: -1, lid: m });
  if (pr > 0.55) { g.rect(-10, ey + 4, 3, 2, C.red, 4); g.rect(1, ey + 4, 3, 2, C.red, 4); }      // rodnar av tryck
  if (a > 0.4 && a < 0.9) g.ell(-4, ey + 7, 2, 2, C.dark, false, null, 0); else { g.rect(-6, ey + 6, 5, 1, C.dark, 0); g.dot(-7, ey + 7, C.dark, 0); g.dot(-1, ey + 7, C.dark, 0); }
  g.rect(6, -19 + q * 2, 2, 1, C.white, 5); g.dot(5, -18 + q * 2, C.white, 5);
  g.end();
  g.begin();                                             // lock med knopp: flyger upp vid träff
  g.push(1, -22 - rat - hu * 7 + q * 2, hu * 0.8 + (rat ? 0.08 : 0)); g.ell(0, 0, 7, 2.6, m, false, null, 4); g.rect(-1, -4, 3, 3, C.gold, 3); g.pop();
  g.end();
  if (puff > 0) { g.begin(); g.ell(-21 - puff * 5, -24 - puff * 5, 2 + puff * 2, 2 + puff * 2, C.white, false, null, 4); g.end({ edge: false }); }
  if (a > 0.45) { g.begin(); for (let i = 0; i < 4; i++) { const u = seg(a, 0.45, 0.95) - i * 0.12; if (u > 0) g.ell(-20 - u * 30, -22 + u * 4 + sin(i * 2 + a * 9) * 2, 2 + u * 3.5, 2 + u * 3, C.white, false, null, i % 2 ? 4 : 5); } g.end({ edge: false }); }
  g.pop();
}

// ---------- Cinder Shell: sömnig sköldpadda med glödande basaltskal, drar in allt vid träff ----------
function tortoise(g, t, pose, o) {
  const { a, hu } = P(pose), sh = R('#5e4c56'), sk = R('#8f8a52'), s = strike(a), b = breath(t, 1.1);
  const tuck = clamp(hu * 1.7), n = a > 0 ? 0 : habit(t, 9, 3.4), droop = n < 0.85 ? ease(n / 0.85) : 1 - ease((n - 0.85) / 0.15);   // nickar till och rycker upp
  const shut = hu > 0.3 || blinkAt(t, 7) || droop > 0.5;
  const ext = a > 0 ? (s < 0 ? (s / 0.6) * 0.9 : s * 1.5) + settle(a, 0.12) : 0;      // -0,9 = indragen, 1,5 = utskjuten
  const reach = 1 + ext - tuck * 1.2, sy = tuck * 5, gl = a > 0.05 || hu > 0.05 ? 5 : 4;
  g.push(hu * 2, 0, 0, o.k || 1);
  if (tuck < 0.6) {                                      // bortre ben och svans
    g.begin(); g.rect(-15, -9 + sy, 7, 9 - sy, sk, 1); g.rect(16, -9 + sy, 7, 9 - sy, sk, 1);
    g.poly([[28, -9 + sy], [36, -5 + sy + sin(t * 2)], [28, -4 + sy]], sk, 2); g.end();
  }
  if (reach > 0.15) {                                    // hals och huvud
    const hx = -18 - reach * 13, hy = -15 + sy + droop * 6 - b + max(0, ext) * 2;
    g.begin(); tube(g, [-14, -11 + sy], [(-14 + hx) / 2, hy + 5], [hx + 3, hy + 1], 4.5, 4, sk, 7, false, 3);
    g.ell(hx, hy, 7, 6, sk); g.poly([[hx - 5, hy], [hx - 9, hy + 2], [hx - 5, hy + 4]], sk, 4);
    eye(g, hx - 4, hy - 3, 3, 3, { shut, pw: 1, ph: 2, mood: 'somnig', lid: sk }); g.rect(hx - 7, hy + 3, 6, 1, C.dark, 0); g.line(hx + 3, hy - 2, hx + 4, hy + 2, sk, 1);
    if (droop > 0.5) for (let i = 0; i < 2; i++) { const u = (t * 0.5 + i * 0.5) % 1; glyph(g, hx - 8 - u * 6, hy - 8 - u * 10, ZED, C.white, 5, 1); }
    g.end();
  }
  g.begin();                                             // skal med glödande fogar
  const Y = sy - b * 0.5;
  g.ell(6, -12 + Y, 27, 21 + b * 0.5, sh, true, (dx, dy) => dy < 0.42);
  g.poly([[-21, -4 + sy], [33, -4 + sy], [31, -1 + sy], [-19, -1 + sy]], R('#8a7468'), 4);
  for (const [x0, y0, x1, y1] of [[-4, -26, 14, -27], [14, -27, 20, -18], [20, -18, 13, -10], [13, -10, -3, -9], [-3, -9, -9, -17], [-9, -17, -4, -26], [-9, -17, -17, -13], [20, -18, 29, -14], [-3, -9, -5, -5], [13, -10, 15, -5], [-4, -26, -7, -30], [14, -27, 17, -31]]) g.line(x0, y0 + Y, x1, y1 + Y, C.fire, gl);
  g.end();
  if (tuck < 0.6) { g.begin(); for (const x of [-9, 22]) { g.rect(x, -8 + sy, 8, 8 - sy, sk, 3); g.dot(x, -1, C.bone, 5); g.dot(x + 3, -1, C.bone, 5); } g.end(); }
  g.pop();
}

// ====================================================================================================
// MOLNSLOTTET
// ====================================================================================================

// ---------- Fluff: sömnigt molnfår som snarkar fram små blixtar ----------
function cloudsheep(g, t, pose, o) {
  const { a, hu } = P(pose), face = R('#4a4e78'), s = strike(a), q = squash(hu), b = breath(t, 1.3);
  const hov = 9 + sin(t * 1.4) * 2, awake = a > 0.05 || hu > 0.05, pk = 1 + max(0, -s) * 0.25 + b * 0.04;
  const wool = a > 0.1 && a < 0.8 ? R('#a4a9c8') : C.snow, sq = 1 - q * 0.3;
  g.push(hu * 2, -hov, hu * 0.15, o.k || 1);
  g.begin();                                             // ben som dinglar efter kroppen, och lite duggregn när den sover
  for (const [x, i] of [[-6, 0], [-1, 1], [6, 2], [11, 3]]) { const lag = sin(t * 1.4 - 0.9 - i * 0.35) * 1.4; g.line(x, -6, x + lag, 0, face, 2); g.rect(x + lag - 1, 0, 2, 2, face, 1); }
  if (!awake) for (let i = 0; i < 3; i++) { const u = (t * 0.9 + i * 0.33) % 1; g.rect(-3 + i * 6, -3 + u * 10, 1, 2, C.ice, 5); }
  g.end();
  g.begin();                                             // ullmoln
  for (const [x, y, rx, ry] of [[2, 0, 12, 8], [-7, 1, 6, 6], [12, 2, 6, 6], [-4, -6, 6.5, 5.5], [4, -8, 7.5, 6.5], [11, -5, 6, 5.5]]) g.ell(x * pk, -12 + y * pk * sq, rx * pk, ry * pk * sq, wool);
  g.end();
  g.begin();                                             // huvud
  const hx = -13, hy = -11 + (awake ? -1 : 1 + b);
  g.poly([[hx + 2, hy - 3], [hx + 7, hy - 6], [hx + 5, hy - 1]], face, 2); g.poly([[hx - 2, hy - 3], [hx - 7, hy - 5], [hx - 5, hy - 1]], face, 4);
  g.ell(hx, hy, 5, 5.8, face, 0.9);
  if (awake && hu < 0.3) { eye(g, hx - 4, hy - 2, 3, 3, { pw: 1, ph: 1, dy: 1 }); eye(g, hx, hy - 2, 3, 3, { pw: 1, ph: 1, dy: 1 }); }
  else { g.rect(hx - 4, hy - 1, 3, 1, C.white, 5); g.rect(hx, hy - 1, 3, 1, C.white, 5); }       // sover: ljusa streck
  g.rect(hx - 3, hy + 3, 2, 1, C.pink, 3);
  g.end();
  g.begin(); g.ell(hx + 1, hy - 5.5, 4, 2.6, C.snow); g.end();     // ullkalufs
  if (!awake) { g.begin(); for (let i = 0; i < 2; i++) { const u = (t * 0.45 + i * 0.5) % 1; glyph(g, hx - 7 - u * 7, hy - 10 - u * 12, ZED, C.white, 5, 1); } g.end(); }
  if (a > 0.45 && a < 0.8) {                             // blixt
    g.begin(); const k = 0.7 + seg(a, 0.45, 0.6) * 0.5;
    const zz = [[-10, -5], [-10 - 9 * k, 0], [-10 - 5 * k, 2], [-10 - 16 * k, 9]];
    for (let i = 0; i < 3; i++) g.thick(zz[i][0], zz[i][1], zz[i + 1][0], zz[i + 1][1], 2.6, C.fire2, 5);
    g.end();
  }
  g.pop();
}

// ---------- Sir Gust: högfärdig vindflöjel i mässing ----------
function weathercock(g, t, pose, o) {
  const { a, hu } = P(pose), br = R('#d8a23a'), vg = R('#5fae98'), s = strike(a);
  const hov = 6 + sin(t * 1.9) * 1.5, crow = a > 0 ? 0 : bump(habit(t, 6.4, 1.3)), up = max(0, -s) / 0.6;
  const lean = a > 0 ? up * 0.22 - max(0, s) * 0.3 + settle(a, 0.1) : sin(t * 1.1) * 0.06 + hu * sin(hu * 9) * 0.5;
  const shut = hu > 0.3 || blinkAt(t, 2), pf = up * 3 + crow * 2;
  g.push(hu * 2, -hov, 0, o.k || 0.85);
  g.begin();                                             // litet moln som bär honom
  g.ell(-4, 0, 6, 3.5, C.snow); g.ell(4, -1, 7, 4, C.snow); g.ell(0, -3, 5, 3, C.snow);
  g.end();
  g.push(0, -3, lean);
  g.begin();                                             // stång, kula och pil
  g.rect(-1, -14, 2, 13, br, 2); g.ell(0, -8, 2.5, 2.5, br);
  g.poly([[-12, -16], [14, -16], [14, -14], [-12, -14]], br, 3); g.poly([[-12, -19], [-19, -15], [-12, -11]], br, 4);
  g.poly([[12, -19], [18, -19], [15, -15], [18, -11], [12, -11]], br, 2);
  g.end();
  g.begin();                                             // stjärtfjädrar: följer efter med fördröjning
  g.push(6, -24, a > 0 ? -lean * 1.5 : sin(t * 1.1 - 1.3) * 0.12 + crow * 0.15);
  g.poly([[0, 0], [4, -12], [10, -17], [15, -15], [10, -11], [16, -9], [11, -5], [15, -1], [6, 2]], br, 2);
  g.poly([[1, -1], [5, -10], [9, -13], [7, -7]], br, 4);
  g.pop();
  g.end();
  g.begin();                                             // ben och kropp med bröst som pöser
  g.rect(-3, -19, 1, 4, br, 1); g.rect(2, -19, 1, 4, br, 1);
  g.ell(1, -24, 7.5, 6, br); g.ell(-3, -25, 5 + pf * 0.5, 5.5 + pf * 0.4, br);
  g.poly([[0, -25], [7, -27], [6, -21]], br, 2);
  g.rect(3, -22, 2, 2, vg, 3); g.dot(-2, -20, vg, 3); g.rect(8, -28, 2, 1, vg, 3);      // ärg
  g.end();
  g.push(-5, -34 - crow * 2 - pf * 0.4, crow * 0.5 + up * 0.3, 1.25);
  g.begin();                                             // hals och huvud
  g.thick(1, 8, 0, 2, 5, br, 3);
  g.poly([[-2, -4], [-1, -9], [1, -6], [3, -10], [4, -6], [6, -8], [5, -2]], C.red, 4);
  g.ell(0, 0, 4.5, 4.5, br);
  const op = crow > 0.3 || (a > 0.35 && a < 0.8) ? 2 : 0;
  g.poly([[-3, -2], [-9, -1 - op * 0.5], [-3, 1]], C.orange, 4); if (op) g.poly([[-3, 1], [-8, 2 + op], [-3, 3]], C.orange, 3);
  g.poly([[-2, 3], [-3, 7], [0, 5]], C.red, 3);
  eye(g, -3, -3, 2, 2, { shut, pw: 1, ph: 1, dy: 0 });
  g.end();
  g.pop();
  if (a > 0.42) {                                        // vindpust
    g.begin(); const u = seg(a, 0.42, 0.95);
    for (let i = 0; i < 3; i++) { const x = -20 - u * 30 - i * 6, y = -36 + i * 5; g.rect(x, y, 8 - i, 1, C.white, 5); g.dot(x - 1, y + 1, C.white, 5); g.dot(x + 8 - i, y - 1, C.white, 5); }
    g.end({ outline: false, edge: false });
  }
  g.pop(); g.pop();
}

// ---------- Grand Tock: jättelikt golvur som tycker att alla är sena. Göken på fjäder är hans slag ----------
function clock(g, t, pose, o) {
  const { a, hu } = P(pose), wd = R('#8a5236'), wd2 = R('#63392a'), s = strike(a), q = squash(hu);
  const tick = (t % 1) < 0.1 ? 1 : 0, sw = hu > 0.05 ? 0.2 : sin(t * PI) * 0.22;       // pendeln: en sväng i sekunden, fastnar vid träff
  const tap = a > 0 ? 0 : habit(t, 5.5, 1.6), tp = tap ? (sin(tap * PI * 6) > 0 ? 2 : 0) : 0;     // otålig fot
  const lean = max(0, -s) * 0.09 - max(0, s) * 0.07 + settle(a, 0.02) + hu * 0.06;
  const shut = hu > 0.3 || blinkAt(t, 3);
  g.push(hu * 2, 0, lean, o.k || 1);
  g.begin(); g.rect(-17, -5 - tp, 13, 5, wd2, 2); g.rect(5, -5, 13, 5, wd2, 2); g.end();       // fötter
  g.push(0, -4 - tick + q * 3);                          // hela skåpet rycker till vid varje tick
  g.begin();                                             // sockel, midja, huv och krön
  g.rect(-20, -20, 40, 20, wd, 3); g.rect(-22, -22, 44, 3, wd2, 3); g.rect(-20, -3, 40, 3, wd2, 2);
  g.rect(-14, -68, 28, 46, wd, 3); g.rect(-22, -72, 44, 4, wd2, 3);
  g.rect(-20, -108, 40, 36, wd, 3);
  g.poly([[-24, -108], [24, -108], [14, -118], [0, -114], [-14, -118]], wd2, 3); g.ell(0, -119, 3, 3, C.gold);
  g.rect(-15, -17, 30, 11, wd, 2);
  g.end();
  g.begin();                                             // glasdörr med pendel
  g.rect(-10, -64, 20, 38, R('#2f2a48'), 2);
  g.push(0, -64, sw); g.rect(-0.5, 0, 1.5, 25, C.gold, 3); g.ell(0, 27, 4, 4, C.gold); g.pop();
  g.end({ outline: false });
  g.begin();                                             // urtavla med ansikte
  g.ell(0, -90, 16, 16, C.gold); g.ell(0, -90, 14, 14, C.bone, false, null, 4);
  for (let i = 0; i < 12; i++) { const an = i * PI / 6; g.dot(sin(an) * 12 - 0.5, -90 - cos(an) * 12 - 0.5, C.dark, 0); }
  eye(g, -8, -92, 4, 4, { shut, pw: 2, ph: 2, dx: 0, dy: 2 }); eye(g, 1, -92, 4, 4, { shut, pw: 2, ph: 2, dx: 0, dy: 2 });
  // visarna är ögonbryn: tio över tio i vila, brant V i attack, slokar vid träff
  const br = hu > 0.05 ? 2.1 : a > 0.05 ? 0.55 : 1.05 + tick * 0.06;
  g.thick(-1.5, -95, -1.5 - sin(br) * 9, -95 - cos(br) * 9, 1.8, C.dark, 0); g.thick(-1.5, -95, -1.5 + sin(br) * 7, -95 - cos(br) * 7, 1.8, C.dark, 0);
  g.ell(-1.5, -95, 1.6, 1.6, C.gold);
  if (a > 0.3 && a < 0.9) g.ell(-1.5, -82, 2.5, 3, C.dark, false, null, 0); else { g.ell(-1.5, -83, 1.6, 1.6, C.dark, false, null, 0); g.rect(-2, -83, 1, 4, C.dark, 0); }     // nyckelhål till mun
  g.end();
  const ext = a > 0.35 ? (a < 0.55 ? ease(seg(a, 0.35, 0.55)) : 1 - ease(seg(a, 0.62, 0.95))) + settle(a, 0.03, 30) : 0;
  g.begin();                                             // gökluckan i krönet
  if (ext > 0.02) g.rect(-12, -115, 8, 6, C.dark, 1); else { g.rect(-12, -115, 8, 6, wd, 4); g.dot(-6, -112, C.gold, 4); }
  g.end();
  if (ext > 0.02) {                                      // göken skjuts ut på en fjäder
    const ex = -10 - ext * 50, ey = -112 + ext * 60, n = 9; let px = -8, py = -112;
    g.begin();
    for (let i = 1; i <= n; i++) { const u = i / n, z = i < n ? (i % 2 ? 2.5 : -2.5) : 0, x = mix(-8, ex, u) + z, y = mix(-112, ey, u) + z; g.line(px, py, x, y, C.steel, 4); px = x; py = y; }
    g.end();
    g.begin();
    g.poly([[ex + 2, ey - 1], [ex + 8, ey - 4], [ex + 6, ey + 2]], C.orange, 3);
    g.ell(ex, ey, 4.5, 4, C.fire2); g.poly([[ex - 3, ey - 1], [ex - 8, ey + 1], [ex - 3, ey + 2]], C.red, 4); g.rect(ex - 2, ey - 2, 1, 2, C.dark, 0);
    g.end();
  }
  g.pop(); g.pop();
}

// ====================================================================================================
// MATH MOUNTAINS
// ====================================================================================================

// ---------- The Diceys (i svärm): tärningar som skuttar och visar en ny sida varje gång ----------
const PIP = { 2: [], 3: [[-1, 1]], 4: [[-5, 3], [2, 3]], 5: [[-5, 3], [2, 3], [-1, 0]], 6: [[-5, -1], [2, -1], [-5, 3], [2, 3]] };
function dice(g, t, pose, o) {
  const { a, hu } = P(pose), m = C.bone;
  const cyc = t / 2.7, n = floor(cyc), u = cyc - n, hopU = u < 0.22 ? max(0.001, u / 0.22) : 0;       // ett skutt per varv, ny sida efter halva
  const rv = (k) => 2 + floor(fract(sin(k * 91.7 + 3.1) * 4375.85) * 5);
  const r = a > 0.35 && a < 0.6 ? seg(a, 0.35, 0.6) * 2 : 0, rq = a > 0 ? r % 1 : hopU;                // attack: två kvartsvarv framåt
  const v = hu > 0.25 ? 1 : a > 0.48 ? 6 : a > 0 ? rv(n) : hopU && hopU <= 0.5 ? rv(n - 1) : rv(n);
  // Vrids 45 grader åt ena hållet, byter sida i luften och landar från andra hållet: ser ut som ett kvartsvarv.
  const rot = rq === 0 ? 0 : rq < 0.5 ? -ease(rq * 2) * PI / 4 : (1 - ease(rq * 2 - 1)) * PI / 4;
  const jit = a > 0 && a < 0.35 ? (sin(t * 50) > 0 ? 1 : -1) : 0, shut = blinkAt(t, n);
  g.push(hu * 2 + jit, -bump(rq) * (a > 0 ? 4 : 6) - 8.5 + (a > 0 && a < 0.35 ? 1 : 0), rot + hu * 0.5, o.k || 1);     // origo i tärningens mitt
  g.begin();
  if (rq === 0) { g.rect(-5, 6.5, 3, 2, C.dark, 1); g.rect(2, 6.5, 3, 2, C.dark, 1); }
  g.poly([[-7, -6.5], [-4, -9.5], [9, -9.5], [6, -6.5]], m, 5); g.poly([[6, -6.5], [9, -9.5], [9, 3.5], [6, 6.5]], m, 2);
  g.rect(-7, -6.5, 13, 13, m, 4);
  g.rect(-1, -9, 2, 1, C.dark, 0); g.rect(4, -9, 2, 1, C.dark, 0); g.rect(7, -4, 1, 2, C.dark, 0); g.rect(7, 1, 1, 2, C.dark, 0);
  if (v === 1) g.ell(-0.5, 0, 2.6, 2.6, C.red, false, null, 3);
  else { peep(g, -5, -5, shut, 2); peep(g, 2, -5, shut, 2); for (const [x, y] of PIP[v]) g.rect(x, y, 2, 2, C.dark, 0); }
  g.end();
  g.pop();
}

// ---------- Abby: kulramslarv som räknar sina egna pärlor ----------
function abacus(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), cols = [R('#e2574c'), R('#f08a2a'), R('#f2c53a'), R('#58b04a'), R('#4a9fe0')];
  const cn = a > 0 ? 0 : habit(t, 6.8, 2.4), comp = max(0, -s) / 0.6, ext = max(0, s);
  const shut = hu > 0.3 || blinkAt(t, 4), xs = [], ys = [];
  for (let i = 0; i < 5; i++) {                          // i = 0 är huvudet; svansen står still
    const gap = 7.5 * (1 - comp * 0.45) + ext * 3.5 + settle(a, 0.5);
    xs.push(14 - (4 - i) * gap + (cn ? sin(clamp(cn * 2 - i * 0.2) * PI) * 2.5 : 0));     // räknevanan: pärlorna klickar åt sidan en i taget
    ys.push(-6 - max(0, sin(t * 2.2 - i * 0.8)) * 2 - comp * sin((i / 4) * PI) * 5 - hu * (i % 2 ? 6 : 2));
  }
  g.push(hu * 2, 0, 0, o.k || 1);
  g.begin();                                             // stången genom pärlorna
  for (let i = 0; i < 4; i++) g.line(xs[i], ys[i], xs[i + 1], ys[i + 1], C.wood, 2);
  g.line(xs[4], ys[4], xs[4] + 6, ys[4] + 1, C.wood, 2); g.ell(xs[4] + 7, ys[4] + 1, 1.8, 1.8, C.wood);
  g.end();
  for (let i = 4; i >= 1; i--) { g.begin(); g.rect(xs[i] - 2, -2, 1, 2, C.dark, 1); g.rect(xs[i] + 1, -2, 1, 2, C.dark, 1); g.ell(xs[i], ys[i], 4.6, 5.2, cols[i]); g.end(); }
  const hx = xs[0], hy = ys[0] - 1, an = sin(t * 2.2 - 1) * 1.5;
  g.begin();                                             // huvud med antenner
  g.line(hx - 2, hy - 5, hx - 5 + an, hy - 11, C.dark, 1); g.line(hx + 2, hy - 5, hx + 3 + an, hy - 11, C.dark, 1);
  g.rect(hx - 6 + an, hy - 13, 2, 2, cols[2], 4); g.rect(hx + 2 + an, hy - 13, 2, 2, cols[4], 4);
  g.ell(hx, hy, 5.6, 5.8, cols[0]);
  eye(g, hx - 5, hy - 3, 3, 3, { shut, pw: 1, ph: 2 }); eye(g, hx - 1, hy - 3, 3, 3, { shut, pw: 1, ph: 2 });
  g.rect(hx - 4, hy + 2, 3, cn || a > 0.05 ? 2 : 1, C.dark, 0);
  g.end();
  g.pop();
}

// ---------- Addy: glatt plustecken som blir ett argt gångertecken, och ett minus när hon får en smäll ----------
function plus(g, t, pose, o) {
  const { a, hu } = P(pose), cross = a > 0.3 && a < 0.85, m = cross ? C.red : R('#f2b02a');
  const hov = 17 + sin(t * 2.1) * 2, fl = sin(t * 16) * 3, shut = hu > 0.3 || blinkAt(t, 2);
  const rot = a > 0 ? (a < 0.3 ? -ease(a / 0.3) * 0.3 : a < 0.6 ? -0.3 + ease(seg(a, 0.3, 0.42)) * (PI / 4 + 0.3) + seg(a, 0.42, 0.6) * PI * 2 : (PI / 4) * (1 - ease(seg(a, 0.6, 0.9))) + settle(a, 0.06)) : sin(t * 1.3) * 0.1;
  const Lv = max(3, 10 * (1 - clamp(hu * 1.4)));
  g.push(hu * 2, -hov, 0, o.k || 1);
  g.begin();                                             // små vingar
  for (const sx of [-1, 1]) g.poly([[sx * 3, -4], [sx * 9, -11 + fl], [sx * 13, -6 + fl * 0.6], [sx * 6, -2]], C.white, sx < 0 ? 5 : 4);
  g.end();
  g.begin();
  g.push(0, 0, rot); g.rect(-10, -3, 20, 6, m, 3); g.rect(-3, -Lv, 6, Lv * 2, m, 3); g.pop();
  peep(g, -3, -2, shut, 2); peep(g, 1, -2, shut, 2);     // ansiktet i mitten står alltid rätt
  if (cross) { g.line(-4, -4, -2, -3, C.dark, 0); g.line(1, -3, 3, -4, C.dark, 0); }
  g.rect(-1, 1, 2, 1, C.dark, 0);
  g.end();
  g.pop();
}

// ---------- Twirl: passare som dansar i cirklar och blir yr ----------
function compass(g, t, pose, o) {
  const { a, hu } = P(pose), st = C.steel, L = 33;
  const spin = a > 0.35 && a < 0.8 ? ease(seg(a, 0.35, 0.8)) * PI * 4 : 0, dizzy = a > 0.8 ? (1 - a) / 0.2 : 0;     // två varv
  const open = a > 0 ? (a < 0.35 ? 1 - ease(a / 0.35) * 0.65 : a < 0.8 ? 0.35 + 0.75 * ease(seg(a, 0.35, 0.5)) : 1.1 - 0.1 * (1 - dizzy)) : 1 + sin(t * 1.3) * 0.08;
  const tapH = a > 0 ? 0 : habit(t, 4.6, 1.2), tap = tapH ? abs(sin(tapH * PI * 3)) * 3 : 0;
  const c = cos(spin), k = open * c * (1 + hu * 1.3), dxL = -9 * k, dxR = 10 * k, H = sqrt(max(64, L * L - dxR * dxR));
  const shut = hu > 0.3 || blinkAt(t, 6) || dizzy > 0;
  g.push(hu * 2, 0, sin(t * 1.3 - 0.5) * 0.04 + dizzy * sin(t * 14) * 0.1, o.k || 1);
  if (spin) { g.begin(); g.ell(0, -1, 16, 3, C.white, false, (dx, dy, d2) => d2 > 0.6, 5); g.end({ outline: false, edge: false }); }
  else { g.begin(); for (let i = 0; i < 4; i++) g.dot(dxR - 2 - i * 3, i < 2 ? 0 : 1, C.smoke, 2); g.end({ outline: false, edge: false }); }     // bågen han ritar
  const leg = (dx, lift, pen, lv) => {
    const p = (u) => [dx * u, -H + (H - lift) * u];
    const [x1, y1] = p(pen ? 0.62 : 0.86), [x2, y2] = p(0.93), [x3, y3] = p(1);
    g.thick(0, -H, x1, y1, 3, st, lv);
    if (pen) { g.thick(x1, y1, x2, y2, 3.6, C.fire2, 3); g.thick(x2, y2, x3, y3, 2, C.bone, 3); g.dot(x3, y3 - 1, C.dark, 0); g.rect(x1 - 2, y1 - 1, 4, 2, C.pink, 3); }
    else g.line(x1, y1, x3, y3, C.dark, 0);
  };
  g.begin(); leg(dxR, tap, true, 2); g.end();            // bortre ben med blyerts
  g.begin(); leg(dxL, 0, false, 3); g.end();             // närmre ben med nål
  g.begin();                                             // gångjärn med ansikte och vred
  g.rect(-1.5, -H - 10, 3, 5, st, 2); g.rect(-2.5, -H - 11, 5, 2, st, 4);
  g.ell(0, -H, 5.5, 5.5, st);
  if (c > 0) { eye(g, -5, -H - 2, 3, 3, { shut, pw: 1, ph: 2 }); eye(g, -1, -H - 2, 3, 3, { shut, pw: 1, ph: 2 }); g.rect(-3, -H + 3, 3, 1, C.dark, 0); }
  else g.ell(0, -H, 1.5, 1.5, C.gold);
  g.end();
  if (dizzy > 0) { g.begin(); for (let i = 0; i < 2; i++) { const an = t * 9 + i * PI; g.rect(cos(an) * 7 - 1, -H - 12 + sin(an) * 2, 2, 2, C.fire2, 5); } g.end(); }
  g.pop();
}

// ---------- Judge Wobble: högfärdig balansvåg med peruk, dunkar ner den tunga skålen ----------
function scales(g, t, pose, o) {
  const { a, hu } = P(pose), br = R('#c9973a'), s = strike(a);
  const th = a > 0 ? max(0, -s) * 0.75 - max(0, s) * 0.55 + settle(a, 0.08, 26) : hu > 0 ? sin(hu * 14) * 0.45 * hu : sin(t * 0.9) * 0.13;
  const lag = a > 0 ? -settle(a, 1.2, 26) : sin(t * 0.9 - 1.2) * 2;                 // skålarna pendlar efter balken
  const shut = hu > 0.3 || blinkAt(t, 6), look = sin(t * 0.9) > 0 ? 0 : 2, CH = 18;
  const Lx = -27 * cos(th), Ly = -46 - 27 * sin(th), Rx = 27 * cos(th), Ry = -46 + 27 * sin(th);
  const pan = (x, y) => { g.line(x - lag, y, x - 8, y + CH, br, 2); g.line(x - lag, y, x + 8, y + CH, br, 2); g.ell(x, y + CH, 9.5, 5, br, true, (dx, dy) => dy > 0); g.rect(x - 9, y + CH, 19, 1, br, 5); };
  g.push(hu * 2, 0, hu * 0.05, o.k || 1);
  g.begin();                                             // fot och pelare
  g.rect(-13, -3, 8, 3, br, 1); g.rect(6, -3, 8, 3, br, 1);
  g.poly([[-15, -3], [15, -3], [9, -9], [-9, -9]], br, 3); g.rect(-3.5, -40, 7, 31, br, 3); g.rect(-5, -14, 10, 2, br, 4); g.rect(-5, -30, 10, 2, br, 4);
  g.end();
  g.begin();                                             // bortre skålen med en fjäder
  g.poly([[Rx + lag - 2, Ry + CH], [Rx + lag + 4, Ry + CH - 9], [Rx + lag + 7, Ry + CH - 7], [Rx + lag + 2, Ry + CH + 1]], C.white, 4);
  pan(Rx + lag, Ry);
  g.end();
  g.begin(); g.thick(Lx, Ly, Rx, Ry, 3, br, 4); g.ell(Lx, Ly, 2.2, 2.2, br); g.ell(Rx, Ry, 2.2, 2.2, br); g.end();    // balken
  g.begin();                                             // huvud med domarperuk
  for (const [x, y] of [[-7, -50], [7, -50], [-8, -44], [8, -44], [-4, -54], [4, -54], [0, -55]]) g.ell(x + hu * 2, y - hu * 3, 3.4, 3.2, C.white);
  g.ell(0, -47, 6.5, 6.5, br, 0.9);
  eye(g, -5, -49, 3, 3, { shut, pw: 1, ph: 2, dx: look, mood: 'somnig', lid: br }); eye(g, 0, -49, 3, 3, { shut, pw: 1, ph: 2, dx: look, mood: 'somnig', lid: br });
  g.rect(-4, -44, 5, 1, C.dark, 0); g.dot(-5, -43, C.dark, 0);
  g.end();
  g.begin();                                             // närmre skålen med en vikt som studsar i smällen
  const wy = a > 0.6 ? -bump(seg(a, 0.6, 0.85)) * 8 : hu * -5;
  g.rect(Lx + lag - 5, Ly + CH - 9 + wy, 10, 9, C.purple, 3); g.rect(Lx + lag - 2, Ly + CH - 11 + wy, 4, 2, C.purple, 4);
  glyph(g, Lx + lag - 2, Ly + CH - 7 + wy, FIVE, C.white, 5, 1);
  pan(Lx + lag, Ly);
  g.end();
  if (a > 0.56 && a < 0.8) { g.begin(); for (const sx of [-1, 1]) g.rect(Lx + sx * 13 - 1, Ly + CH + 3 - seg(a, 0.56, 0.8) * 4, 3, 1, C.white, 5); g.end({ outline: false, edge: false }); }
  g.pop();
}

// ====================================================================================================
// READING LAND
// ====================================================================================================

// ---------- Paper Darts (i svärm): pappersflygplan som gör loopar och knycklas ihop vid träff ----------
function paperdart(g, t, pose, o) {
  const { a, hu } = P(pose), pp = C.white, ln = R('#8fb4e8');
  const hov = 14 + sin(t * 1.6) * 2.5, bank = cos(t * 1.6) * 0.22;                  // nosen följer banan
  const loop = ease(seg(a, 0.2, 0.75)), rot = a > 0 ? (a < 0.2 ? ease(a / 0.2) * 0.5 : 0.5 + loop * (PI * 2 - 0.5)) : bank + hu * 1.5;
  g.push(hu * 2 + (a > 0 ? sin(rot) * 5 : 0), -hov - (a > 0 ? (1 - cos(rot)) * 6 : 0), rot, o.k || 1);
  g.begin();
  if (hu > 0.35) {                                       // hopknycklad
    g.ell(0, 0, 5, 4.6, pp); g.line(-3, -1, 0, 1, ln, 2); g.line(0, 1, 3, -2, ln, 2); g.line(-1, 3, 2, 2, ln, 2);
    g.rect(-3, -2, 2, 1, C.dark, 0); g.rect(0, -2, 2, 1, C.dark, 0);
  } else {
    g.poly([[-10, 1], [8, -5], [10, -2]], pp, 2);        // bortre vingen
    g.poly([[-10, 1], [8, -5], [7, -1]], pp, 5);         // närmre vingen
    g.poly([[-10, 1], [7, -1], [2, 5]], pp, 3);          // kölen
    g.line(-3, -1, 5, -3, ln, 3); g.dot(6, -2, C.red, 4);
    g.rect(-5, 1, 1, 2, C.dark, 0); g.rect(-2, 1, 1, 2, C.dark, 0); g.line(-6, -1, -4, 0, C.dark, 0);
  }
  g.end();
  g.pop();
}

// ---------- Wobble Blocks: tre bokstavsklossar staplade i fel ordning, den översta flyger iväg ----------
function blocks(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), cols = [R('#4a9fe0'), R('#f2c53a'), R('#e2574c')], L = [LC, LA, LB];
  const shut = hu > 0.3 || blinkAt(t, 5), fly = a > 0.4 && a < 0.9 ? seg(a, 0.4, 0.9) : 0;
  const land = a > 0.9 ? (1 - a) / 0.1 : 0;              // stapeln trycks ihop när klossen landar
  g.push(hu * 2, 0, 0, o.k || 1);
  for (let i = 0; i < 3; i++) {
    const w = sin(t * 1.5 - i * 0.7);                    // toppen svajar efter botten
    let x = w * i * 1.3 - (a > 0 ? s * i * 3 : 0) + hu * (i - 1) * 4, y = -i * 12 - hu * i * 5 + land * i, rot = w * 0.03 * i - (a > 0 ? s * 0.08 * i : 0) + hu * (i - 1) * 0.4;
    if (i === 2 && fly) { x -= bump(fly) * 24; y -= sin(fly * PI * 2) * 5; rot += fly * PI * 2; }
    g.push(x, y, rot);
    g.begin();
    g.poly([[-8, -12], [-5, -15], [10, -15], [7, -12]], cols[i], 5); g.poly([[7, -12], [10, -15], [10, -3], [7, 0]], cols[i], 1);
    g.rect(-8, -12, 15, 12, cols[i], 3);
    glyph(g, -3, -11, L[i], C.white, 5, 2);
    if (i === 2) { eye(g, -7, -9, 3, 3, { shut, pw: 1, ph: 2 }); eye(g, 4, -9, 3, 3, { shut, pw: 1, ph: 2 }); }      // bokstaven blir näsa
    g.end();
    g.pop();
  }
  g.pop();
}

// ---------- Scribble: skrytsam gåspenna som skriver i luften ----------
function quill(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), tl = R('#3fb0a0'), up = max(0, -s) / 0.6, dn = max(0, s);
  const wx = (tt) => sin(tt * 3) * 3 + sin(tt * 0.7) * 2, wy = (tt) => -6 + sin(tt * 6) * 1.5;      // skrivrörelsen
  const nx = a > 0 ? -dn * 9 + up * 3 : wx(t), ny = a > 0 ? -6 - up * 13 + dn * 2 : wy(t);
  const th = a > 0 ? 0.45 - up * 0.4 + dn * 0.8 + settle(a, 0.1) : 0.45 + cos(t * 3 - 0.6) * 0.14 + hu * sin(hu * 10) * 0.5;   // fjädern släpar efter stiftet
  const shut = hu > 0.3 || blinkAt(t, 1);
  g.push(hu * 2, 0, 0, o.k || 1);
  if (!a) { g.begin(); for (let i = 1; i <= 6; i++) { const tt = t - i * 0.06; g.dot(wx(tt) + i * 1.6, wy(tt) + 1, C.ink, i < 3 ? 3 : 2); } g.end({ outline: false, edge: false }); }
  g.push(nx, ny, th);
  g.begin();                                             // fjäder
  g.poly([[0, -8], [-5, -13], [-7, -24], [-5, -34], [0, -41], [4, -35], [6, -25], [5, -14]], C.white, 4);
  g.poly([[-5, -34], [0, -41], [4, -35], [3, -30], [0, -33], [-3, -30]], tl, 3);
  g.rect(-0.5, -38, 1, 28, R('#c9c2b0'), 2);
  for (const [x, y, d] of [[-6, -20, 1], [5, -22, -1], [-6, -28, 1]]) g.line(x, y, x + d * (hu > 0.2 ? 4 : 2), y + 2, R('#c9c2b0'), 1);
  eye(g, -4, -20, 3, 3, { shut, pw: 1, ph: 2, mood: 'lomsk', lid: tl }); eye(g, 1, -20, 3, 3, { shut, pw: 1, ph: 2, mood: 'lomsk', lid: tl });
  g.rect(-2, -15, 3, 1, C.dark, 0);
  g.end();
  g.begin();                                             // hylsa och stift
  g.rect(-2.5, -11, 5, 3, C.gold, 2); g.poly([[-2.5, -8], [2.5, -8], [0, 0]], C.gold, 4); g.line(0, -6, 0, -2, C.dark, 0);
  g.end();
  g.pop();
  if (a > 0.55) { const u = seg(a, 0.55, 1); g.begin(); g.ell(nx - 6 - u * 24, ny - 2 + u * u * 6, 2.6 - u, 2.6 - u, C.ink); g.end(); }      // bläckplump
  g.pop();
}

// ---------- Wriggle: blyg bokmask med glasögon som bor i en sagobok ----------
function bookworm(g, t, pose, o) {
  const { a, hu } = P(pose), wm = R('#a9d46a'), s = strike(a), dn = max(0, s);
  const hide = a > 0 ? 0 : bump(habit(t, 9.1, 2.6));
  const out = a > 0 ? (a < 0.3 ? 1 - ease(a / 0.3) * 0.85 : a < 0.4 ? 0.15 + ease(seg(a, 0.3, 0.4)) * 0.85 : 1) : clamp(1 - hide * 0.8 - hu * 1.6);   // 1 = uppe och läser
  const sw = sin(t * 1.3) * 2, scan = sin(t * 2.6) > 0 ? 0 : 1, shut = hu > 0.3 || blinkAt(t, 8);
  const flap = clamp(hu * 2) * 0.5 + (a > 0 ? bump(seg(a, 0.28, 0.5)) * 0.3 : 0);        // pärmen slår upp
  g.push(hu * 2, 0, 0, o.k || 1);
  g.begin();                                             // undre boken
  g.rect(-17, -8, 34, 8, C.red, 3); g.rect(-17, -7, 29, 6, C.bone, 4); g.rect(-17, -5, 29, 1, C.bone, 2); g.rect(-17, -3, 29, 1, C.bone, 2); g.dot(14, -4, C.gold, 4);
  g.end();
  if (out > 0.05) {                                      // masken
    const hx = -5 + sw * out - dn * 24 + settle(a, 1.5), hy = -15 - 17 * out + dn * 13;
    g.begin();
    tube(g, [2, -11], [9 - dn * 6, (-13 + hy) / 2 - 3], [hx + 1, hy + 2], 3.6, 3.3, wm, 8);
    g.line(hx + 1, hy - 4, hx + 3 - sw * 0.5, hy - 8, wm, 2);
    g.ell(hx, hy, 5, 4.6, wm);
    for (const cx of [hx - 3.5, hx + 1.5]) { g.ell(cx, hy - 1, 2.7, 2.7, C.gold, false, null, 3); g.ell(cx, hy - 1, 1.8, 1.8, C.white, false, null, 5); if (shut) g.rect(cx - 1, hy - 1, 2, 1, C.dark, 0); else g.dot(cx - 1 + scan, hy - 1, C.dark, 0); }
    g.rect(hx - 3, hy + 3, 3, 1, C.dark, 0);
    g.end();
  }
  g.begin();                                             // övre boken framför masken
  g.rect(-14, -15, 30, 7, C.leaf, 3); g.rect(-14, -14, 25, 5, C.bone, 4); g.rect(-14, -12, 25, 1, C.bone, 2); g.dot(13, -11, C.gold, 4);
  g.thick(15, -15, 15 - cos(flap) * 29, -15 - sin(flap) * 29, 1.8, C.leaf, 4);
  g.end();
  g.pop();
}

// ---------- Blot: vresig bläckfisk i ett bläckhorn, gömmer sig under korken ----------
function inkpot(g, t, pose, o) {
  const { a, hu } = P(pose), gl = R('#3f4f9a'), oc = R('#8a5fc8'), s = strike(a), b = breath(t, 1.5);
  const duck = clamp(hu * 1.5), up = max(0, -s) / 0.6, dn = max(0, s);
  const hy = -42 - b * 1.5 + duck * 12 + up * 6 - dn * 3, shut = hu > 0.3 || blinkAt(t, 8);
  g.push(hu * 2, 0, 0, o.k || 1);
  g.begin();                                             // tentakler som hänger över flaskans sidor
  tube(g, [10, -30], [26, -30], [24 + sin(t * 1.4 - 1) * 2, -5], 3.5, 2, oc, 9, false, 2);
  tube(g, [-10, -30], [-26, -28], [-23 + sin(t * 1.4 - 2) * 2, -4], 3.5, 2, oc, 9, false, 2);
  g.end();
  g.begin();                                             // huvud (bakom flaskhalsen)
  g.ell(0, hy, 14 + up * 2, 12 + b - up, oc);
  g.ell(7, hy - 6, 2, 1.5, R('#b08ae8'), false, null, 5); g.ell(10, hy - 1, 1.5, 1.2, R('#b08ae8'), false, null, 5);
  eye(g, -9, hy - 3, 4, 4, { shut, pw: 2, ph: 2, dy: 2, mood: 'arg', inner: 1, lid: oc }); eye(g, -2, hy - 3, 4, 4, { shut, pw: 2, ph: 2, dy: 2, mood: 'arg', inner: -1, lid: oc });
  if (a > 0.4 && a < 0.9) g.ell(-5, hy + 6, 2.2, 2.2, C.dark, false, null, 0); else { g.rect(-7, hy + 5, 5, 1, C.dark, 0); g.dot(-8, hy + 6, C.dark, 0); g.dot(-2, hy + 6, C.dark, 0); }
  g.end();
  g.begin();                                             // bläckflaska med etikett
  g.poly([[-16, 0], [-19, -5], [-19, -21], [-12, -28], [12, -28], [19, -21], [19, -5], [16, 0]], gl, 3);
  g.rect(-11, -33, 22, 5, C.steel, 3);
  g.poly([[-16, -19], [-12, -25], [-9, -25], [-14, -18]], gl, 5);
  g.rect(-8, -18, 17, 12, C.bone, 4); g.rect(-5, -15, 11, 1, C.ink, 2); g.rect(-5, -12, 7, 1, C.ink, 2); g.rect(-5, -9, 9, 1, C.ink, 2);
  g.rect(13, -33, 2, 6 + step(t, 1.7), C.ink, 3);        // bläck som rinner
  g.end();
  g.begin();                                             // korktentakel: håller korken som lock över huvudet vid träff
  const kx = mix(22, 0, duck), ky = mix(-44 + sin(t * 1.5 - 1) * 1.5, hy - 12, duck);
  tube(g, [12, -31], [22, -36], [kx + 3, ky + 3], 3, 2.2, oc, 7, false, 3);
  g.poly([[kx - 6, ky - 3], [kx + 6, ky - 3], [kx + 5, ky + 3], [kx - 5, ky + 3]], C.wood, 3); g.rect(kx - 6, ky - 4, 12, 2, C.wood, 5);
  g.end();
  g.begin();                                             // penntentakel: höjs i laddningen och hugger
  const px = -27 - dn * 8 + up * 4, py = -37 + sin(t * 1.5) * 1.5 - up * 10 + dn * 12;
  tube(g, [-12, -31], [-22, -30 - up * 6], [px, py], 3, 2.2, oc, 7, false, 3);
  g.push(px, py, -0.5 + up * 0.8 - dn * 1.3 + settle(a, 0.1));
  g.rect(-1, -9, 2, 14, C.wood, 3); g.rect(-1.5, -11, 3, 2, C.gold, 3); g.poly([[-1.5, -11], [1.5, -11], [0, -16]], C.steel, 5);
  g.pop();
  g.end();
  if (a > 0.5) {                                         // bläckplump i båge
    const u = seg(a, 0.5, 1); g.begin(); g.ell(-10 - u * 36, hy + 5 - bump(u) * 12 + u * 30, 3.2 - u, 3.2 - u, C.ink);
    g.rect(-6 - u * 26, hy + 8 - bump(u) * 8 + u * 28, 2, 2, C.ink, 4); g.end();
  }
  g.pop();
}

// ====================================================================================================
// KEJSARENS ARMÉ (kan dyka upp var som helst när berättelsen går framåt)
// ====================================================================================================

// ---------- Star Snatchers (i svärm): små huvklädda hantlangare som jagar stjärngnistor med håv ----------
function snatcher(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a);
  const cu = (t * 0.9) % 1, hop = a > 0 ? 0 : cu < 0.5 ? abs(sin(cu * PI * 4)) * 2 : 0;         // två snabba skutt på tå, sedan vila
  const tip = a > 0 ? s * 3 : cu < 0.6 ? sin((cu - 0.08) * PI * 4) * 1.5 : 0;                // huvspetsen släpar efter
  const shut = hu > 0.3 || blinkAt(t, 2), th = -0.5 - s * 1.4 + settle(a, 0.1);
  const hx = -6 + sin(th) * 18, hy = -8 - cos(th) * 18, lag = a > 0 ? s * 3 : sin(t * 0.9 * PI * 4 - 1) * (cu < 0.6 ? 1.5 : 0.3);
  g.push(hu * 2, -hop, hu * 0.25, o.k || 1);
  g.begin();                                             // håv: skaft, ring och påse som svänger efter
  g.thick(-6, -8, hx, hy, 1.4, C.wood, 3);
  g.poly([[hx - 4, hy], [hx + 4, hy], [hx + 1 + lag, hy + 8]], C.bone, 2);
  g.ell(hx, hy, 4.6, 2.2, C.eTrim, false, (dx, dy, d2) => d2 > 0.45, 4);
  if (sin(t * 5) > 0) g.dot(hx + lag * 0.5, hy + 3, C.fire2, 5);          // en fångad gnista blinkar
  g.end();
  g.begin();                                             // fötter, kåpa, arm
  g.rect(-4, -2, 3, 2, C.eDark, 1); g.rect(1, -2, 3, 2, C.eDark, 1);
  g.poly([[-5, -3], [5, -3], [4, -11], [-4, -11]], C.eArm, 3); g.rect(-5, -7, 10, 1, C.eTrim, 3);
  g.thick(-3, -10, -6, -8, 2, C.eArm, 4);
  g.end();
  g.begin();                                             // huva med ansikte i skugga
  g.poly([[1, -18], [7, -22 + tip], [10, -18 + tip], [5, -14]], C.eCape, 2);
  g.ell(0, -14, 5.6, 5, C.eCape);
  if (hu > 0.3) g.rect(-5, -15, 7, 2, C.eCape, 2);       // huvan åker ner över ögonen
  else { g.ell(-1.5, -13.5, 3.6, 3, C.eDark, false, null, 1); if (shut) g.rect(-4, -13, 5, 1, C.eEye, 2); else { g.rect(-4, -14, 2, 2, C.eEye, 5); g.rect(-1, -14, 2, 2, C.eEye, 5); } }
  g.end();
  g.pop();
}

// ---------- Sergeant Clunk: envis sköldbärare, ingen har sett mer än ögonen ----------
function shieldbearer(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), b = step(t, 2.2), hide = a > 0 ? 0 : bump(habit(t, 7.7, 2));
  const sx = a > 0 ? max(0, -s) * 4 - max(0, s) * 9 + settle(a, 1) : 0, rat = hu > 0.05 ? sin(hu * 40) * 0.12 * hu : 0;
  const hy = -38 + b + hide * 7 + clamp(hu * 2) * 7, f = sin(t * 2.4) * 1.5, pl = sin(t * 2.2 - 1) * 1.5 + settle(a, 1.5);
  g.push(hu * 2 - 2, 0, hu * 0.06, o.k || 0.95);
  g.begin();                                             // mantel, ben och bål
  g.poly([[3, -30 + b], [10, -30 + b], [15 + f, -8], [11 + f, -4], [6, -10]], C.eCape, 2);
  g.rect(-1, -8, 5, 6, C.eArm, 2); g.rect(4, -8, 5, 6, C.eArm, 3); g.rect(-3, -2, 7, 2, C.eDark, 2); g.rect(4, -2, 7, 2, C.eDark, 3);
  g.poly([[-3, -32 + b], [9, -32 + b], [10, -8], [-3, -8]], C.eArm, 3); g.rect(-3, -12, 13, 2, C.eTrim, 3);
  g.end();
  g.begin();                                             // hjälm med plym som släpar efter
  g.poly([[2, hy - 6], [5, hy - 13], [11 + pl, hy - 12], [13 + pl, hy - 6], [8, hy - 4]], C.eCape, 3);
  g.ell(2, hy, 7.5, 7, C.eArm);
  g.rect(-5, hy - 1, 10, 3, C.dark, 0);
  if (!(hu > 0.3 || blinkAt(t, 6))) { const lk = sin(t * 0.7) > 0.4 ? 1 : 0; g.rect(-4 + lk, hy - 1, 2, 2, C.eEye, 5); g.rect(lk, hy - 1, 2, 2, C.eEye, 5); }
  g.rect(-5, hy - 4, 14, 1, C.eTrim, 3);
  g.end();
  g.begin();                                             // tornsköld med kejsarens stjärnskärva
  g.push(-4 + sx, 0, -max(0, s) * 0.12 + max(0, -s) * 0.1 + rat, 1.12);
  g.poly([[-7, -3], [-8, -28], [-4, -33], [4, -33], [8, -28], [7, -3], [0, 0]], C.eTrim, 3);
  g.poly([[-5, -5], [-6, -27], [-3, -31], [3, -31], [6, -27], [5, -5], [0, -2]], C.eArm, 3);
  g.poly([[0, -26], [2, -20], [6, -18], [2, -15], [1, -8], [-2, -15], [-5, -17], [-2, -20]], C.eTrim, 4); g.rect(-1, -19, 2, 2, C.red, 4);
  g.rect(3, -9, 2, 1, C.eDark, 2); g.dot(-4, -23, C.eDark, 2);
  g.pop();
  g.end();
  if (a > 0.48 && a < 0.66) { g.begin(); const x = -15 + sx; for (const [dx, dy] of [[-3, -22], [-5, -16], [-3, -10]]) g.rect(x + dx - seg(a, 0.48, 0.66) * 4, dy, 3, 1, C.white, 5); g.end({ outline: false, edge: false }); }
  g.pop();
}

// ---------- Peeper: nyfiken spanare i lappad ballong, släpper en sandsäck ----------
function balloon(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), q = squash(hu), b = breath(t, 1.2);
  const hov = 9 + sin(t * 1.1) * 2.5 + (a > 0 ? max(0, -s) * 5 + (a > 0.5 ? bump(seg(a, 0.5, 1)) * 5 : 0) : 0);   // lättar när säcken har släppts
  const sw = a > 0 ? max(0, -s) * 0.12 - max(0, s) * 0.1 + settle(a, 0.05) : sin(t * 1.1 - 0.8) * 0.06 + hu * sin(hu * 12) * 0.25;   // korgen pendlar efter
  const scope = a > 0 ? 0 : bump(habit(t, 6, 2.4)), shut = hu > 0.3 || blinkAt(t, 3), k = o.k || 0.88;
  g.push(hu * 2, -hov * k, 0, k);
  g.begin();                                             // ballongen med guldvåder och en lapp
  g.ell(0, -30, 12.5 + q * 2 + b * 0.5, 13 - q * 3, C.eCape);
  for (const x of [-6, 0, 6]) g.ell(x * 0.9, -30, 2.2 - abs(x) * 0.12, 12.6 - q * 3, C.eTrim, false, null, x < 0 ? 4 : 3);
  g.rect(3, -37, 4, 4, C.bone, 4); g.dot(4, -36, C.dark, 1); g.dot(5, -35, C.dark, 1);
  g.poly([[-5, -18], [5, -18], [3, -15], [-3, -15]], C.eCape, 2);
  g.end();
  g.push(0, -17, sw);
  g.begin(); g.line(-4, 1, -6, 8, C.bone, 2); g.line(4, 1, 6, 8, C.bone, 2); g.end({ outline: false });      // rep
  g.begin();                                             // spanaren med kikare
  g.poly([[2, -1], [8, -3], [5, 3]], C.eArm, 2); g.ell(0, 3, 5, 4.6, C.eArm); g.ell(-1.2, 3.5, 3.4, 2.8, C.dark, false, null, 0);
  if (!shut) { g.rect(-3, 3, 2, 2, C.eEye, 5); g.rect(0, 3, 2, 2, C.eEye, 5); }
  g.push(-3, 6.5, -0.15 + sin(t * 0.7) * 0.2 + hu * 0.8);
  const tl = 7 + scope * 5; g.rect(-tl, -1.5, tl, 3, C.eTrim, 3); g.rect(-tl - 2, -2.5, 3, 5, C.eTrim, 4); g.rect(-tl - 2, -1.5, 1, 3, C.ice, 5);
  g.pop();
  g.end();
  g.begin();                                             // korg
  g.poly([[-7, 8], [7, 8], [6, 15], [-6, 15]], C.wood, 3); g.rect(-8, 7, 16, 2, C.wood, 4); for (const x of [-4, 0, 4]) g.rect(x, 10, 1, 4, C.wood, 2);
  g.end();
  g.begin();                                             // sandsäckar: den främre släpps i attacken
  const lag = sin(t * 1.1 - 1.8) * 1.5, gy = 17 + hov - 3;
  g.line(7, 9, 8 + lag, 13, C.bone, 2); g.ell(8 + lag, 15, 2.4, 2.8, C.bone);
  if (a > 0.42 && a < 0.95) { const u = seg(a, 0.42, 0.58); g.ell(-8, mix(15, gy, u * u), 2.6 + (u >= 1 ? 1 : 0), 2.8 - (u >= 1 ? 1 : 0), C.bone); }
  else { g.line(-7, 9, -8 + lag, 13, C.bone, 2); g.ell(-8 + lag, 15, 2.4, 2.8, C.bone); }
  g.end();
  g.pop(); g.pop();
}

// ---------- Lugg: kejsarens stjärnbärare, enorm och sömnig, med en säck full av stjärnbitar ----------
function porter(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), b = breath(t, 1), q = squash(hu), up = max(0, -s) / 0.6, dn = max(0, s), sack = R('#b89a6a');
  const nH = a > 0 ? 0 : habit(t, 8.5, 3), nod = nH < 0.8 ? ease(nH / 0.8) : 1 - ease((nH - 0.8) / 0.2);     // nickar till
  const shut = hu > 0.3 || blinkAt(t, 5) || nod > 0.6;
  const sl = a > 0 ? -settle(a, 2) - (a > 0.6 ? bump(seg(a, 0.62, 0.9)) * 6 : 0) : sin(t - 1.4) * 1.5;        // säcken guppar efter kroppen
  g.push(hu * 3 - 8, 0, hu * 0.05 + up * 0.06 - dn * 0.05, o.k || 1);
  g.begin();                                             // säck på ryggen
  g.ell(34, -62 + sl, 26, 30 - q * 3, sack);
  g.poly([[18, -88 + sl], [30, -96 + sl], [44, -90 + sl], [36, -84 + sl]], sack, 2);
  g.rect(40, -60 + sl, 8, 7, R('#8a6f4a'), 3); g.rect(27, -44 + sl, 6, 6, C.eCape, 3); g.dot(39, -61 + sl, C.dark, 1); g.dot(48, -53 + sl, C.dark, 1);
  g.end();
  g.begin();                                             // stjärnbitar som sticker upp ur säcken
  const tw = step(t, 5);
  g.poly([[24, -92 + sl], [27, -102 + sl - tw], [31, -93 + sl]], C.fire2, 5); g.poly([[33, -94 + sl], [38, -103 + sl + tw], [40, -92 + sl]], C.fire2, 4);
  if (a > 0.6) { const u = seg(a, 0.6, 0.95), x = 30 - u * 4, y = -100 + sl - bump(u) * 18; g.poly([[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]], C.fire2, 5); }
  g.end();
  g.begin();                                             // ben och stövlar
  g.rect(-22, -22, 17, 22, C.eDark, 2); g.rect(6, -22, 17, 22, C.eDark, 3); g.rect(-26, -6, 22, 6, C.eArm, 3); g.rect(4, -6, 22, 6, C.eArm, 3);
  g.rect(-26, -8, 22, 2, C.eTrim, 3); g.rect(4, -8, 22, 2, C.eTrim, 3);
  g.end();
  g.begin();                                             // päronformad rustning
  g.ell(0, -48 - b, 34, 30 + b - q * 3, C.eArm);
  g.ell(-6, -42 - b, 20, 17, C.eArm, false, null, 4);
  g.thick(-26, -64 - b, 26, -36 - b, 5, C.eCape, 3);     // rem till säcken
  g.poly([[-10, -52 - b], [-7, -44 - b], [-2, -42 - b], [-7, -38 - b], [-9, -28 - b], [-12, -38 - b], [-17, -41 - b], [-12, -44 - b]], C.eTrim, 4); g.rect(-11, -43 - b, 3, 3, C.red, 4);
  g.rect(-27, -26, 54, 3, C.eTrim, 3);
  g.end();
  const hy = -80 - b + nod * 5 + q * 4;
  g.begin();                                             // liten hjälm nedsjunken mellan axlarna
  g.poly([[2, hy - 8], [6, hy - 18], [14, hy - 16 + sl * 0.5], [14, hy - 8]], C.eCape, 3);
  g.ell(0, hy, 10, 9.5, C.eArm);
  g.rect(-9, hy - 1, 14, 4, C.dark, 0);
  if (shut) { g.rect(-7, hy + 1, 3, 1, C.eEye, 2); g.rect(-1, hy + 1, 3, 1, C.eEye, 2); } else { g.rect(-7, hy, 3, 2, C.eEye, 5); g.rect(-1, hy, 3, 2, C.eEye, 5); }
  g.rect(-10, hy - 5, 20, 2, C.eTrim, 3);
  g.end();
  g.begin();                                             // axlar
  g.ell(22, -72 - b, 12, 10, C.eArm); g.ell(-24, -70 - b, 13, 11, C.eArm); g.ell(-24, -70 - b, 13, 11, C.eTrim, false, (dx, dy, d2) => d2 > 0.7 && dy > 0.2, 3);
  g.end();
  g.begin();                                             // närmre arm och näve: lyfts långsamt och dunkar i marken
  const fx = mix(mix(-38, -42, up), -54, dn), fy = mix(mix(-30 + sin(t - 0.7) * 1.5, -104, up), -9, dn);
  const ex = (-26 + fx) / 2 - 8 + up * 4, ey = (-66 + fy) / 2;
  g.thick(-26, -66 - b, ex, ey, 13, C.eArm, 3); g.thick(ex, ey, fx, fy, 12, C.eArm, 3);
  g.ell(fx, fy, 10, 9, C.eDark); g.ell(fx, fy, 10, 9, C.eTrim, false, (dx, dy) => dy < -0.55, 3);
  g.end();
  if (a > 0.58) { g.begin(); for (let i = 0; i < 5; i++) { const u = seg(a, 0.58, 1); g.rect(fx - 10 - i * 5 - u * 14, -2 - bump(u) * (5 + i * 2), 3, 3, C.smoke, 4); } g.end(); }
  g.pop();
}

// ====================================================================================================
// ROSTER_NEW
// ====================================================================================================
// Samma fält som ROSTER i game/enemies.js: id, name, world, tier, h, w, count, fly, draw.
// world: 2 träsk, 3 is, 4 vulkan, 5 molnslott, 6 Math Mountains, 7 Reading Land, -1 kejsarens armé (var som helst).
// Extra fält som spelet inte läser: line (personlighet), move (attackidé), size (normal | big | giant).
const E = (id, name, world, tier, h, w, draw, extra = {}) => ({ id, name, world, tier, h, w, count: 1, fly: false, draw, size: h > 100 ? 'giant' : h > 52 ? 'big' : 'normal', ...extra });

export const WORLDS_NEW = {
  2: { name: 'Mushroom Swamp', biome: 'swamp', sky: ['#294c50', '#5f8862'], ground: '#3d5a40' },
  3: { name: 'Frost Mountains', biome: 'ice', sky: ['#4c7ec8', '#b8dcf4'], ground: '#dfeaf6' },
  4: { name: 'Sentence Volcano', biome: 'volcano', sky: ['#33202e', '#bc5a2e'], ground: '#4a3440' },
  5: { name: 'Cloud Castle', biome: 'cloud', sky: ['#96a2ea', '#ffd6cc'], ground: '#f1ecff' },
  6: { name: 'Math Mountains (coming continent)', biome: 'math', sky: ['#3a3a6a', '#8f8cc8'], ground: '#5f6f84' },
  7: { name: 'Reading Land (coming continent)', biome: 'reading', sky: ['#e2cfa0', '#f8efd4'], ground: '#c2a070' },
  '-1': { name: "The Emperor's army (anywhere, as the story advances)", biome: 'any', sky: ['#2a2040', '#6a3050'], ground: '#3a3048' },
};

export const ROSTER_NEW = [
  // ----- 2 Svampträsket -----
  E('snorkel', 'Snorkel', 2, 1, 28, 36, (g, t, p) => snorkel(g, t, p, {}), { line: 'Sneaky. Hides under a lily pad and thinks nobody can see the snorkel.', move: 'Sinks out of sight, pops up tall and squirts a jet of pond water.' }),
  E('mozzies', 'The Mozzies', 2, 1, 24, 22, (g, t, p) => mozzie(g, t, p, {}), { count: 5, fly: true, line: 'Nosy. Five whiny mosquitoes that poke their noses into everything.', move: 'Pull back, then jab with noses straight as needles. A hit bends the nose into a zigzag.' }),
  E('grumpstump', 'Grumpstump', 2, 3, 50, 64, (g, t, p) => stump(g, t, p, {}), { line: 'Grumpy. An old stump who was having a nap and would like you to leave.', move: 'Raises a branch, thumps it down, and a root whips up out of the ground in front.' }),
  // ----- 3 Frostbergen -----
  E('snowbies', 'The Snowbies', 3, 1, 19, 20, (g, t, p) => snowbie(g, t, p, {}), { count: 4, line: 'Giggly. Snowballs that cannot stop rolling.', move: 'Roll back for a run-up, then tumble forward a full turn and bowl you over.' }),
  E('scoop', 'Scoop', 3, 2, 23, 39, (g, t, p) => mole(g, t, p, {}), { line: 'Shy. A mole in red earmuffs who would rather stay in the snow.', move: 'Dives, tunnels under the snow to you, pops up and swats with both digging claws.' }),
  E('sirtusk', 'Sir Tusk', 3, 3, 38, 71, (g, t, p) => walrus(g, t, p, {}), { line: 'Pompous. A walrus with a monocle who thinks the ice is his stage.', move: 'Rears up on his tail and belly-flops. The monocle pops out when he is hit.' }),
  E('bigwool', 'Big Wool', 3, 3, 112, 158, (g, t, p) => mammoth(g, t, p, {}), { line: 'Sleepy giant. A mammoth with snow on his back who hates being woken.', move: 'Lifts trunk and front foot high, then stomps and sweeps the trunk down. Snow shakes off his back.' }),
  // ----- 4 Meningsvulkanen -----
  E('coalcrew', 'Coal Crew', 4, 1, 16, 18, (g, t, p) => coal(g, t, p, {}), { count: 5, line: 'Show-offs. Little lumps of coal that puff themselves up to look hot.', move: 'Crouch, then flare up orange and twice the size. A puff of smoke when it is over.' }),
  E('whistler', 'Old Whistler', 4, 2, 30, 35, (g, t, p) => kettle(g, t, p, {}), { line: 'Grumpy. A kettle that boils over at the smallest thing.', move: 'Swells and turns red, tips forward and whistles a jet of steam. The lid flies off when hit.' }),
  E('cindershell', 'Cinder Shell', 4, 3, 38, 88, (g, t, p) => tortoise(g, t, p, { k: 1.1 }), { line: 'Sleepy. A tortoise with a glowing rock shell who keeps nodding off.', move: 'Pulls the head in, then shoots it out on a long neck for a headbutt. Tucks everything into the shell when hit.' }),
  // ----- 5 Molnslottet -----
  E('fluff', 'Fluff', 5, 1, 42, 46, (g, t, p) => cloudsheep(g, t, p, {}), { fly: true, line: 'Sleepy. A cloud sheep that drizzles while it naps.', move: 'Wakes with a start, turns storm grey and puffs up, then snaps out a small lightning bolt.' }),
  E('sirgust', 'Sir Gust', 5, 2, 50, 36, (g, t, p) => weathercock(g, t, p, {}), { fly: true, line: 'Pompous. A brass weathercock who always knows which way to blow.', move: 'Puffs his chest, leans back on his pole and blows a gust. Rocks like a spring afterwards.' }),
  E('grandtock', 'Grand Tock', 5, 3, 127, 49, (g, t, p) => clock(g, t, p, {}), { line: 'Impatient giant. A grandfather clock who thinks everyone is late.', move: 'Leans back, the hatch on top opens and a cuckoo on a spring shoots out and bonks you.' }),
  // ----- 6 Math Mountains -----
  E('diceys', 'The Diceys', 6, 1, 19, 20, (g, t, p) => dice(g, t, p, {}), { count: 3, line: 'Cheeky. Three dice who hop about and show a new number every time.', move: 'Rattle, tumble forward two quarter turns and always land on six. A hit turns them to a one.' }),
  E('abby', 'Abby', 6, 1, 22, 48, (g, t, p) => abacus(g, t, p, {}), { line: 'Fussy. A bead caterpillar who counts herself all day and loses count.', move: 'Bunches all her beads together, then springs out long and bonks with her head.' }),
  E('addy', 'Addy', 6, 2, 32, 28, (g, t, p) => plus(g, t, p, {}), { fly: true, line: 'Cheerful. A plus sign who wants to add herself to everything.', move: 'Turns red, tilts into a times sign and spins like a wheel. A hit squashes her into a minus.' }),
  E('twirl', 'Twirl', 6, 2, 44, 24, (g, t, p) => compass(g, t, p, {}), { line: 'Dizzy dancer. A drawing compass who taps out perfect circles.', move: 'Snaps the legs shut, spins two full turns drawing a ring, and ends up dizzy. Does the splits when hit.' }),
  E('judgewobble', 'Judge Wobble', 6, 3, 59, 76, (g, t, p) => scales(g, t, p, {}), { line: 'Pompous. A set of scales in a wig who is never, ever fair.', move: 'Lifts the heavy pan high and slams it down. The beam keeps wobbling and the weight bounces.' }),
  // ----- 7 Reading Land -----
  E('paperdarts', 'Paper Darts', 7, 1, 23, 21, (g, t, p) => paperdart(g, t, p, {}), { count: 4, fly: true, line: 'Show-offs. Paper planes that zoom about doing tricks.', move: 'Pull the nose up and fly a full loop into you. A hit crumples them into paper balls.' }),
  E('wobbleblocks', 'Wobble Blocks', 7, 1, 40, 22, (g, t, p) => blocks(g, t, p, {}), { line: 'Proud. Three letter blocks stacked in the wrong order: C, A, B.', move: 'The stack leans back, whips forward and the top block flies off spinning, then lands again.' }),
  E('scribble', 'Scribble', 7, 2, 45, 26, (g, t, p) => quill(g, t, p, {}), { fly: true, line: 'Show-off. A quill who signs its name on everything.', move: 'Rears up straight, lunges like a fencer and flicks an ink blot.' }),
  E('wriggle', 'Wriggle', 7, 2, 40, 36, (g, t, p) => bookworm(g, t, p, {}), { line: 'Shy. A bookworm in glasses who hates being interrupted.', move: 'Ducks into the book, the cover flaps, and it shoots out long to bonk you. Hides in the book when hit.' }),
  E('blot', 'Blot', 7, 3, 57, 65, (g, t, p) => inkpot(g, t, p, {}), { line: 'Grumpy. An octopus in an ink pot who blots anything it dislikes.', move: 'Sinks and swells, then slashes with the pen and spits an ink blob in an arc. Pulls the cork over its head when hit.' }),
  // ----- -1 Kejsarens armé -----
  E('snatchers', 'Star Snatchers', -1, 1, 29, 31, (g, t, p) => snatcher(g, t, p, {}), { count: 4, line: 'Mischievous. Hooded helpers who chase star sparks with nets and mostly catch each other.', move: 'Swing the net back over the head and swoosh it down. The hood drops over the eyes when hit.' }),
  E('clunk', 'Sergeant Clunk', -1, 2, 49, 30, (g, t, p) => shieldbearer(g, t, p, {}), { line: 'Stubborn. Nobody has ever seen more than his eyes over the shield.', move: 'Pulls the tower shield back and rams it forward with a clang. Ducks behind it when hit.' }),
  E('peeper', 'Peeper', -1, 2, 49, 28, (g, t, p) => balloon(g, t, p, {}), { fly: true, line: 'Nosy. A scout in a patched balloon who writes down everything you do, wrongly.', move: 'Floats up, drops a sandbag on you and bobs higher without the weight.' }),
  E('lugg', 'Lugg', -1, 3, 104, 110, (g, t, p) => porter(g, t, p, {}), { line: 'Sleepy giant. Carries the Emperor\'s sack of star pieces and keeps nodding off.', move: 'Slowly lifts one huge fist and pounds the ground. The sack bounces and a star piece hops out.' }),
];
export const BY_ID_NEW = Object.fromEntries(ROSTER_NEW.map((e) => [e.id, e]));
