// Fiender och bossar. Varje grundform är EN ritfunktion med varianter (form och tillbehör, inte bara färg).
// draw(g, t, pose): motorn har redan gjort g.push(x, y) så att (0, 0) är marken mitt under varelsen.
// Varelsen tittar åt VÄNSTER, uppåt är negativt y. pose = { attack: 0..1, hurt: 0..1 }.
import { ramp as R } from './pixel.js';

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), bone: R('#ece4cf'), gold: R('#f2b632'), red: R('#d8433b'),
  wood: R('#9a6b3f'), leather: R('#8a5a34'), steel: R('#aab6c4'), fire: R('#ff7a1f'), fire2: R('#ffd84a'),
  ice: R('#bff0ff'), purple: R('#9a6bff'), pink: R('#ee8fa8'), leaf: R('#58b04a'), orange: R('#f08a2a'),
  rust: R('#b5632a'), snow: R('#eef4fb'), navy: R('#39446e'), moss: R('#6fa544'), smoke: R('#8d8aa0'),
};
const { sin, cos, PI, abs, max, min, floor, ceil } = Math;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
const P = (pose) => ({ a: clamp((pose && pose.attack) || 0), hu: clamp((pose && pose.hurt) || 0) });
const bump = (a) => sin(clamp(a) * PI);                       // 0 → 1 → 0
// Attackkurva: laddar bakåt (ner till -0,6), slår fram till 1 och går tillbaka till 0.
const strike = (a) => (a <= 0 ? 0 : a < 0.35 ? -0.6 * sin((a / 0.35) * PI / 2) : a < 0.6 ? -0.6 + 1.6 * ((a - 0.35) / 0.25) : 1 - (a - 0.6) / 0.4);
const blinkAt = (t, seed = 0) => ((t + seed * 1.37) % 3.4) < 0.14;
const step = (t, sp = 2.6, ph = 0) => (sin(t * sp + ph) > 0.3 ? 1 : 0);   // andning i hela pixlar, som hjälten
// Gemensam transform: skala och bakåtlutning vid träff. Stängs med g.pop().
const enter = (g, hu, k = 1, lean = 0.14, y = 0) => g.push(hu * 2, y, hu * lean, k);

// Öga: vit glob med mörk pupill (tittar åt vänster och lite nedåt om inget annat anges).
// o: { shut, col, pw, ph, dx, dy, mood: 'arg' | 'somnig' | 'lomsk', inner: 1 | -1 (åt vilket håll näsroten ligger), lid: ramp }
function eye(g, x, y, w, h, o = {}) {
  if (o.shut) { g.rect(x, y + floor(h / 2), w, 1, C.dark, 0); return; }
  g.rect(x, y, w, h, o.col ?? C.white, 5);
  const pw = o.pw ?? max(1, ceil(w / 2)), ph = o.ph ?? max(1, ceil(h * 0.6));
  g.rect(x + (o.dx ?? 0), y + (o.dy ?? h - ph), pw, ph, C.dark, 0);
  if (o.mood === 'arg') g.poly(o.inner > 0 ? [[x - 1, y - 1], [x + w + 1, y - 1], [x + w + 1, y + h * 0.6]] : [[x - 1, y - 1], [x + w + 1, y - 1], [x - 1, y + h * 0.6]], o.lid ?? C.dark, o.lid != null ? 1 : 0);
  if (o.mood === 'somnig') g.rect(x, y, w, ceil(h / 2), o.lid ?? C.dark, 2);
  if (o.mood === 'lomsk') g.rect(x, y, w, max(1, floor(h / 3)), o.lid ?? C.dark, 1);
}
// Litet öga i hjältens stil: mörk pinne med vit glimt.
const peep = (g, x, y, shut, h = 3) => { if (shut) g.rect(x, y + 1, 2, 1, C.dark, 0); else { g.rect(x, y, 2, h, C.dark, 0); g.dot(x, y, C.white, 5); } };
// Kedja av kulor längs en kvadratisk bezier (halsar, svansar, stjälkar).
function tube(g, p0, p1, p2, r0, r1, rp, n = 8, shade = true, lv = 3) {
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u, r = r0 + (r1 - r0) * u;
    g.ell(v * v * p0[0] + 2 * u * v * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * p1[1] + u * u * p2[1], r, r, rp, shade, null, lv);
  }
}
// Klo (krabba, skorpion): handflata och två fingrar som öppnas med op. dir -1 pekar åt vänster.
function claw(g, x, y, dir, op, m, r, lv = 3) {
  g.poly([[x, y - r * 0.8], [x + dir * r * 2.1, y - r * 0.7 - op], [x + dir * r * 1.9, y - r * 0.1 - op], [x + dir * r * 0.5, y - 0.3]], m, lv + 1);
  g.poly([[x, y + r * 0.8], [x + dir * r * 1.8, y + r * 0.5 + op * 0.6], [x + dir * r * 1.6, y + op * 0.6], [x + dir * r * 0.5, y + 0.3]], m, lv - 1);
  g.ell(x, y, r, r * 0.85, m);
}

// ====================================================================================================
// GRUNDFORMER
// ====================================================================================================

// ---------- Slime: leaf (skott på huvudet), ice (iskub med istappar), lava (låga och droppar), swamp (ögon på skaft) ----------
function slime(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), k = o.k || 1;
  const s = sin(t * 3.2) + bump(a) * 3.5 - hu * 2.5, rx = 10 - s * 0.6, ry = 7.5 + s, top = -ry * 1.7;
  const shut = hu > 0.3 || blinkAt(t, k), ey = -ry * 0.95;
  enter(g, hu, k, 0);
  g.begin();
  if (o.kind === 'leaf') { g.thick(1, top + 2, 2, top - 4, 1.6, C.leaf, 2); g.poly([[2, top - 4], [8, top - 8], [9, top - 3], [4, top - 2]], C.leaf, 4); g.poly([[2, top - 4], [-3, top - 8], [-5, top - 4], [-1, top - 2]], C.leaf, 3); }
  if (o.kind === 'lava') { const f = sin(t * 9) * 1.5; g.poly([[-5, top + 3], [-4, top - 3 - f], [-1, top], [1, top - 7 + f], [4, top - 1], [6, top - 4 - f], [6, top + 3]], C.fire2, 4); }
  if (o.kind === 'swamp') for (const [x, dx] of [[-6, -2], [1, 1]]) g.thick(x, top + 4, x + dx, top - 3, 1.8, m, 2);
  if (o.kind === 'ice') {
    for (const [x, hh] of [[-7, 5], [-1, 8], [5, 5]]) g.poly([[x - 2, top + 3], [x + 0.5, top - hh], [x + 3, top + 3]], C.ice, 5);
    g.poly([[-rx, 0], [-rx - 1, top + 5], [-rx + 3, top + 1], [rx - 3, top + 1], [rx + 1, top + 5], [rx, 0]], m, 3);
    g.poly([[-rx + 1, top + 5], [-rx + 4, top + 2], [rx - 6, top + 2], [rx - 9, top + 5]], m, 5);
    g.rect(-rx + 2, -2, rx * 2 - 4, 2, m, 2);
  } else {
    g.ell(0, -2.2, rx + 1.5, 3.2, m, false, (dx, dy) => dy < 0.68, 2);
    g.ell(0, -ry * 0.7, rx, ry, m, true, (dx, dy) => dy < 0.7);
    g.rect(-rx * 0.55, top + 3, 2, 1, C.white, 5); g.dot(-rx * 0.55 - 1, top + 4, C.white, 5);
  }
  if (o.kind === 'lava') {
    g.ell(4, -ry * 0.9, 2.4, 1.8, C.fire2, false, null, 4); g.ell(-1, -3, 2, 1.4, C.fire2, false, null, 4); g.ell(6, -3.5, 1.5, 1.2, C.fire2, false, null, 5);
    for (let i = 0; i < 2; i++) { const ph = (t * 1.3 + i * 0.5) % 1; g.rect(i ? rx + 1 : -rx - 2, -5 + ph * 4, 2, 2, C.fire2, 5); }
  }
  if (o.kind === 'swamp') {
    for (const [x, px, py] of [[-8, -2, 0], [2, 0, -2]]) { g.ell(x, top - 4.5, 3, 3, C.white, false, null, 5); if (shut) g.rect(x - 2, top - 5, 4, 1, C.dark, 0); else g.rect(x + px, top - 5 + py, 2, 2, C.dark, 0); }
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.37) % 1; g.rect(-rx - 3 + i * (rx + 1), top + 2 - ph * 9, ph < 0.5 ? 2 : 1, ph < 0.5 ? 2 : 1, m, 5); }
  } else { peep(g, -7, ey, shut); peep(g, -2, ey, shut); }
  if (o.kind === 'lava' || o.kind === 'ice') { g.line(-8, ey - 2, -6, ey - 1, m, 1); g.line(-1, ey - 1, 1, ey - 2, m, 1); }
  if (a > 0.05) { g.rect(-7, ey + 4, 7, 1 + bump(a) * 3, C.dark, 0); g.rect(-5, ey + 4 + bump(a) * 2, 3, 1, C.pink, 3); }
  else g.rect(-6, ey + 5, o.kind === 'swamp' ? 6 : 3, 1, m, 1);
  if (o.kind === 'swamp') g.rect(-2, ey + 6, 1, 2 + step(t, 2), C.ice, 5);
  g.end();
  g.pop();
}

// ---------- Goblin: klubba (liten, i gäng) eller turban och kroksabel (ökengoblin) ----------
function goblin(g, t, pose, o) {
  const { a, hu } = P(pose), skin = R(o.skin || '#7cba4a'), cloth = R(o.cloth || '#8a5a34'), k = o.k || 1;
  const b = step(t, 2.6, o.ph || 0), s = strike(a), shut = hu > 0.3 || blinkAt(t, o.ph || 0), Y = -16 + b;
  enter(g, hu, k);
  g.begin();                                             // vapenarm (bortre, framåt)
  g.thick(-4, -10 + b, -9, -8 + b - s * 2, 2.6, skin, 2);
  g.push(-9, -8 + b - s * 2, -0.35 - s * 1.25);
  if (o.turban) { g.poly([[-1, -2], [1.5, -2], [3.5, -8], [2.5, -13], [-2.5, -17], [-1, -12], [-1.5, -7]], C.steel, 4); g.rect(-3, -3, 6, 1.6, C.gold, 3); g.rect(-1, -1.5, 2, 4.5, C.leather, 3); }
  else { g.poly([[-1.2, 3], [1.2, 3], [3, -9], [2, -13], [-2, -13], [-3, -9]], C.wood, 3); g.rect(-4, -11, 2, 2, C.bone, 5); g.rect(2, -8, 2, 2, C.bone, 5); g.rect(-1, -14, 2, 2, C.bone, 5); }
  g.pop(); g.end();
  g.begin();                                             // ben och kropp
  g.rect(-4, -4, 3, 4, skin, 2); g.rect(1, -4, 3, 4, skin, 3); g.rect(-6, -1, 5, 1, skin, 2); g.rect(0, -1, 5, 1, skin, 3);
  g.rect(-5, -11 + b, 10, 8 - b, cloth, 3); g.rect(-5, -6, 10, 1, C.dark, 1);
  if (o.turban) { g.rect(-5, -11 + b, 3, 5, C.gold, 3); g.rect(2, -11 + b, 3, 5, C.gold, 2); } else g.poly([[-5, -3], [-3, -1], [-1, -3], [1, -1], [3, -3], [5, -1], [5, -3]], cloth, 2);
  g.end();
  g.begin();                                             // huvud
  g.poly([[-5, Y - 2], [-11, Y - 8], [-7, Y + 1]], skin, 2);
  g.poly([[4, Y - 2], [12, Y - 7 + step(t, 1.3)], [6, Y + 3]], skin, 4);
  g.ell(-0.5, Y, 7, 6, skin, 0.9);
  if (o.turban) { g.ell(-0.5, Y - 5.5, 7.4, 3, C.bone, 1.1); g.ell(1, Y - 8, 4.6, 2.4, C.bone, 1.1); g.line(-6, Y - 5, 5, Y - 6, C.bone, 1); g.rect(-5, Y - 7, 2, 2, C.red, 4); g.poly([[-4, Y - 8], [-5, Y - 13], [-2, Y - 9]], C.purple, 4); }
  const ec = o.turban ? C.white : C.fire2; eye(g, -6, Y - 2, 2, 2, { shut, col: ec, ph: 1, pw: 1, dy: 1 }); eye(g, -2, Y - 2, 2, 2, { shut, col: ec, ph: 1, pw: 1, dy: 1 });
  if (!o.turban) { g.line(-7, Y - 4, -5, Y - 3, skin, 1); g.line(-2, Y - 3, 0, Y - 4, skin, 1); }
  g.poly([[-7, Y], [-11, Y + 2], [-7, Y + 3]], skin, 4);
  g.rect(-6, Y + 4, 6, a > 0.05 ? 2 : 1, C.dark, 0); g.dot(-2, Y + 3, C.white, 5); if (o.turban) g.dot(-5, Y + 3, C.white, 5);
  g.end();
  g.pop();
}

// ---------- Fladdermus: stora öron (skog) eller låga på huvudet och glödsvans (vulkan) ----------
function bat(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), k = o.k || 1, hov = (o.hov || 16) + sin(t * 2.4 + (o.ph || 0)) * 2;
  const f = a > 0 ? -5 + bump(a) * 3 : sin(t * 11 + (o.ph || 0)) * 5, shut = hu > 0.3 || blinkAt(t, 2);
  g.push(hu * 2, -hov, hu * 0.3, k);
  g.begin();
  for (const sx of [-1, 1]) {
    g.poly([[sx * 3, -1], [sx * 13, -8 + f], [sx * 17, -2 + f], [sx * 13, 0 + f * 0.6], [sx * 11, 5 - f * 0.4], [sx * 8, 2], [sx * 4, 4]], m, sx < 0 ? 2 : 1);
    g.thick(sx * 3, -1, sx * 13, -8 + f, 1.4, m, 4);
  }
  if (o.fire) { const w = sin(t * 12) * 1.5; g.poly([[3, 3], [9, 5 + w], [14, 3 - w], [10, 8 + w], [4, 7]], C.fire2, 4); }
  g.end();
  g.begin();
  if (o.fire) { const w = sin(t * 10) * 1.2; g.poly([[-4, -4], [-3, -10 - w], [-1, -7], [1, -12 + w], [3, -7], [5, -9 - w], [4, -3]], C.fire2, 4); }
  else { g.poly([[-5, -3], [-7, -11], [-1, -5]], m, 4); g.poly([[5, -3], [7, -11], [1, -5]], m, 2); }
  g.ell(0, 0, 5.5, 6, m);
  eye(g, -5, -3, 3, 3, { shut, pw: 1, ph: 2, col: o.fire ? C.fire2 : C.white }); eye(g, -1, -3, 3, 3, { shut, pw: 1, ph: 2, col: o.fire ? C.fire2 : C.white });
  if (a > 0.05) { g.rect(-4, 2, 5, 3, C.dark, 0); g.dot(-4, 2, C.white, 5); g.dot(0, 2, C.white, 5); }
  else { g.rect(-4, 2, 5, 1, C.dark, 0); g.dot(-3, 3, C.white, 5); g.dot(-1, 3, C.white, 5); }
  g.end();
  if (a > 0.1 && !o.fire) {                              // ultraljud
    g.begin(); for (let i = 0; i < 3; i++) { const r = 6 + i * 5 + a * 6; g.ell(-6, 1, r, r, C.white, false, (dx, dy, d2) => d2 > 0.72 && dx < -0.62, 5); } g.end({ edge: false });
  }
  if (a > 0.1 && o.fire) { g.begin(); g.ell(-8 - a * 14, 2 + a * 5, 2.6, 2.6, C.fire2); g.end(); }
  g.pop();
}

// ---------- Svamp: rund prickig hatt (sur skogssvamp) eller hög fot med toppig hatt som hänger (giftsvamp) ----------
function mushroom(g, t, pose, o) {
  const { a, hu } = P(pose), cap = R(o.hex), k = o.k || 1, H = o.tall ? 17 : 9, b = step(t, 2.4), s = strike(a);
  const shut = hu > 0.3 || blinkAt(t, H), fy = -H + 1;
  g.push(hu * 2, 0, hu * 0.14 - s * 0.2, k);
  g.begin();                                             // fot med ansikte
  g.rect(-6, -2, 5, 2, C.leather, 2); g.rect(1, -2, 5, 2, C.leather, 3);
  g.ell(0, -(H + 4) / 2 - 1, o.tall ? 5.5 : 6.5, (H + 4) / 2, C.bone, 0.9);
  g.thick(-5, fy + 5, -9, fy + 7 - max(0, s) * 4, 2, C.bone, 2); g.thick(5, fy + 5, 8, fy + 8, 2, C.bone, 2);
  peep(g, -5, fy, shut); peep(g, -1, fy, shut);
  g.line(-6, fy - 2, -4, fy - 1, C.bone, 1); g.line(-1, fy - 1, 1, fy - 2, C.bone, 1);       // sura ögonbryn
  if (a > 0.05) g.rect(-4, fy + 4, 3, 2, C.dark, 0); else { g.rect(-4, fy + 4, 3, 1, C.dark, 0); g.dot(-5, fy + 5, C.dark, 0); g.dot(-1, fy + 5, C.dark, 0); }
  g.end();
  g.begin();                                             // hatt
  const hy = -H - 3 + b;
  if (o.tall) {
    const d = sin(t * 1.7) * 1.5;
    g.poly([[-12, hy + 3], [12, hy + 3], [9, hy - 4], [3, hy - 12], [-4 + d, hy - 17], [-9 + d, hy - 14], [-4, hy - 9], [-9, hy - 3]], cap, 3);
    g.rect(-11, hy + 3, 22, 1, C.bone, 2);
    for (const [x, y, r] of [[-5, -1, 2], [3, -4, 2.4], [7, 0, 1.6], [-2, -9, 1.6]]) g.ell(x, hy + y, r, r * 0.8, C.fire2, false, null, 5);
    g.rect(8, hy + 4, 1, 2 + step(t, 1.9), cap, 5);
  } else {
    g.ell(0, hy, 13, 9, cap, true, (dx, dy) => dy < 0.35);
    g.rect(-11, hy + 3, 22, 1, C.bone, 2);
    for (const [x, y, r] of [[-6, -5, 2.6], [3, -6.5, 3], [9, -1.5, 2], [-1, -1, 1.6]]) g.ell(x, hy + y, r, r * 0.75, C.white, false, null, 5);
  }
  g.end();
  if (a > 0.15) {                                        // sporer
    g.begin(); for (let i = 0; i < 6; i++) { const u = a * 1.2 - i * 0.07; if (u > 0) g.rect(-10 - u * 22 - i * 2, hy + 2 + sin(i * 2.3 + a * 7) * 6, 2, 2, o.tall ? C.fire2 : cap, 5); } g.end();
  }
  g.pop();
}

// ---------- Spindel: stor med långa ben och mönster, eller småkryp i svärm med stora ögon ----------
function spider(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), k = o.k || 1, s = bump(a), L = o.long || 1;
  const by = -7 + sin(t * 3 + (o.ph || 0)) * 0.8 - s * 2, shut = hu > 0.3 || blinkAt(t, 5);
  enter(g, hu, k, 0.1);
  g.begin();
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const w = sin(t * 5 + i * 1.7 + sd) * 1.1, lift = sd < 0 && i >= 2 ? s * (8 + i * 2) : 0;
    const kx = sd * (5 + i * 2.6 * L) + w, ky = by - 8 + i * 1.6 - lift * 0.5, fx = sd * (7 + i * 3.6 * L) + w - (lift ? 3 : 0), fy = -lift;
    if (o.thick) { g.thick(sd * 3, by, kx, ky, 1.7, m, 2); g.thick(kx, ky, fx, fy, 1.5, m, 2); } else { g.line(sd * 3, by, kx, ky, m, 2); g.line(kx, ky, fx, fy - 1, m, 2); }
  }
  g.end();
  g.begin();
  g.ell(5, by - 2, 7, 6.5, m); g.ell(-4, by, 4.8, 4.2, m);
  if (o.mark) { g.rect(4, by - 7, 2, 2, C.fire2, 4); g.rect(6, by - 5, 2, 2, C.fire2, 4); g.rect(4, by - 3, 2, 2, C.fire2, 4); g.rect(8, by - 2, 2, 2, C.fire2, 3); }
  if (o.cute) { eye(g, -8, by - 3, 3, 4, { shut, pw: 2, ph: 2 }); eye(g, -4, by - 3, 3, 4, { shut, pw: 2, ph: 2 }); }
  else {
    eye(g, -9, by - 3, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, mood: 'arg', inner: 1, lid: m }); eye(g, -5, by - 3, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, mood: 'arg', inner: -1, lid: m });
    g.dot(-2, by - 4, C.fire2, 5); g.dot(-1, by - 2, C.fire2, 4);
    g.rect(-8, by + 2, 1, 2 + (a > 0.05 ? 2 : 0), C.bone, 4); g.rect(-5, by + 2, 1, 2 + (a > 0.05 ? 2 : 0), C.bone, 4);
  }
  g.end();
  g.pop();
}

// ---------- Varg: grå skogsvarg, isvarg med kristaller på ryggen, glödhund med eldman ----------
function wolf(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), k = o.k || 1, s = strike(a), br = sin(t * 2.4) * 0.6, tw = sin(t * 3) * 3;
  const shut = hu > 0.3 || blinkAt(t, 7), fl = (i) => sin(t * 10 + i * 2.1) * 1.6;
  enter(g, hu, k, 0.08);
  g.begin();                                             // bortre ben och svans
  g.thick(-7, -12, -10, -1, 3.4, m, 1); g.thick(14, -12, 17, -1, 3.4, m, 1);
  if (o.kind === 'fire') g.poly([[15, -15], [21, -20 + tw], [24, -28 + tw + fl(0)], [26, -21 + tw], [31, -25 + tw + fl(1)], [28, -15 + tw], [22, -12], [16, -11]], C.fire, 4);
  else { g.poly([[15, -17], [22, -22 + tw], [29, -26 + tw], [28, -19 + tw], [22, -14 + tw * 0.5], [16, -11]], m, 3); g.poly([[25, -24 + tw], [29, -26 + tw], [28, -20 + tw]], o.kind === 'ice' ? C.ice : C.bone, 5); }
  g.end();
  g.begin();                                             // kropp och närmre ben
  if (o.kind === 'ice') for (const [x, hh] of [[-3, 7], [3, 9], [9, 7], [14, 5]]) g.poly([[x - 2.5, -19], [x + 1, -20 - hh], [x + 3, -19]], C.ice, 5);
  if (o.kind === 'fire') g.poly([[-9, -20], [-7, -28 + fl(0)], [-3, -23], [0, -31 + fl(1)], [4, -23], [8, -28 + fl(2)], [11, -21], [15, -24 + fl(3)], [16, -17]], C.fire, 4);
  g.ell(4, -14 + br * 0.3, 13, 6.5 + br * 0.3, m); g.ell(-6, -15, 8, 7.6, m);
  if (o.kind === 'fire') { g.line(-2, -15, 3, -12, C.fire2, 5); g.line(3, -12, 7, -14, C.fire2, 5); g.line(9, -16, 12, -12, C.fire2, 4); } else g.ell(-8, -11, 4.5, 3, m, false, null, 5);
  g.thick(-3, -10, -5, -2, 3.6, m, 3); g.rect(-8, -2, 5, 2, m, 4);
  g.thick(10, -12, 9, -6, 5, m, 3); g.thick(9, -6, 12, -2, 3, m, 3); g.rect(9, -2, 5, 2, m, 4);
  g.end();
  g.push(-13 - s * 3, -21 - max(0, -s) * 2, -max(0, -s) * 0.3);
  g.begin();                                             // huvud
  g.poly([[1, -4], [4, -12], [7, -3]], m, 2); g.poly([[-3, -4], [-2, -12], [2, -4]], m, 4);
  const op = max(0, s) * 5 + (a > 0.05 ? 1.5 : 0);
  g.poly([[-1, 2], [-11, 3 + op], [-10, 5.5 + op], [1, 6]], m, 2);
  if (op > 1) { g.poly([[-1, 2], [-11, 2], [-10, 3 + op], [-1, 4]], C.red, 1); g.rect(-9, 2 + op, 1, 2, C.white, 5); g.rect(-6, 2 + op * 0.7, 1, 2, C.white, 5); }
  g.ell(0, 0, 6.5, 5.5, m);
  g.poly([[-3, -3.5], [-12, -1], [-13, 2.5], [-4, 3.5]], m, 4);
  g.rect(-14, -1, 2, 2, C.dark, 0);
  g.rect(-11, 2, 1, 2, C.white, 5); g.rect(-8, 2, 1, 2, C.white, 5);
  g.poly([[2, 2], [7, 5], [2, 6]], m, 3);
  eye(g, -5, -3, 3, 2, { shut, col: o.kind === 'ice' ? C.ice : C.fire2, pw: 1, ph: 2, dy: 0 }); g.line(-6, -4, -2, -5, m, 1);
  g.end();
  g.pop();
  if (o.kind === 'ice' && a > 0.4) { g.begin(); for (let i = 0; i < 4; i++) { const u = (a - 0.4) / 0.6; g.rect(-30 - u * 14 - i * 4, -22 + sin(i * 2 + a * 8) * 3 + i, 2, 2, C.ice, 5); } g.end(); }
  if (o.kind === 'fire' && a > 0.4) { g.begin(); const u = (a - 0.4) / 0.6; g.poly([[-27, -20], [-32 - u * 12, -24], [-30 - u * 10, -20], [-34 - u * 12, -17], [-27, -17]], C.fire2, 4); g.end(); }
  g.pop();
}

// ---------- Kaktus ----------
function cactus(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#5fae4e'), s = bump(a), up = s * 4, shut = hu > 0.3 || blinkAt(t, 3);
  g.push(hu * 2, 0, hu * 0.14 + sin(t * 1.8) * 0.04, o.k || 1);
  g.begin();                                             // armar
  g.thick(-5, -13, -11, -13, 4.6, m, 3); g.thick(-10.5, -14, -10.5, -21 - up, 4.6, m, 3);
  g.thick(5, -9, 11, -9, 4.6, m, 2); g.thick(10.5, -10, 10.5, -17 - up, 4.6, m, 2);
  g.dot(-14, -16 - up * 0.5, C.bone, 5); g.dot(-11, -25 - up, C.bone, 5); g.dot(13, -13, C.bone, 5); g.dot(10, -20 - up, C.bone, 5);
  g.end();
  g.begin();                                             // stam
  g.poly([[-6, 0], [6, 0], [6, -25], [3, -29], [-3, -29], [-6, -25]], m, 3);
  g.rect(-2, -28, 1, 27, m, 2); g.rect(2, -28, 1, 27, m, 2);
  for (let y = -4; y > -26; y -= 6) { g.dot(-7, y, C.bone, 5); g.dot(6, y - 3, C.bone, 5); }
  peep(g, -5, -22, shut); peep(g, 0, -22, shut);
  g.rect(-6, -24, 3, 1, m, 1); g.rect(-1, -24, 4, 1, m, 1);                                   // raka, buttra ögonbryn
  if (a > 0.05) g.ell(-2, -15.5, 2, 2, C.dark, false, null, 0); else g.rect(-4, -16, 4, 1, C.dark, 0);
  g.end();
  g.begin(); g.ell(-1, -30.5, 3.4, 2.4, C.pink); g.dot(-2, -31, C.fire2, 5); g.dot(-1, -31, C.fire2, 5); g.end();
  if (a > 0.3) { g.begin(); for (let i = 0; i < 4; i++) { const u = (a - 0.3) / 0.7; g.rect(-12 - u * 30 - i * 3, -24 + i * 5, 3, 1, C.bone, 5); } g.end(); }
  g.pop();
}

// ---------- Skorpion ----------
function scorpion(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex || '#d08a3c'), s = strike(a), sn = sin(t * 4) > 0.5 ? 1.5 : 0, shut = hu > 0.3 || blinkAt(t, 4);
  enter(g, hu, o.k || 1, 0.1);
  g.begin();                                             // ben
  for (let i = 0; i < 4; i++) { const hx = -4 + i * 3.6, w = sin(t * 6 + i * 2) * 0.8; g.line(hx, -5, hx + 2 + w, -10, m, 2); g.line(hx + 2 + w, -10, hx + 5 + w, -1, m, 2); }
  g.end();
  g.begin(); g.thick(-7, -7, -12, -12, 2.2, m, 2); claw(g, -14, -14, -1, sn, m, 3, 2); g.end();   // bortre klo
  g.begin();                                             // kropp och svans
  g.ell(11, -6, 3.6, 3.2, m); g.ell(6, -5.5, 4.6, 4, m); g.ell(0, -5.5, 5, 4.5, m); g.ell(-6, -5, 4.6, 4, m);
  let x = 13, y = -8, ang = -PI / 2 + 0.55; const L = 4.3 + s * 1.8, turn = 0.6 + max(0, s) * 0.12;
  for (let i = 0; i < 6; i++) { g.ell(x, y, 2.9 - i * 0.15, 2.9 - i * 0.15, m); x += cos(ang) * L; y += sin(ang) * L; ang -= turn; }
  const nx = -sin(ang), ny = cos(ang);
  g.ell(x, y, 3, 3, C.red);
  g.poly([[x + nx * 2, y + ny * 2], [x - nx * 2, y - ny * 2], [x + cos(ang) * 7, y + sin(ang) * 7]], C.red, 5);
  eye(g, -9, -8, 2, 2, { shut, pw: 1, ph: 1, dy: 1 }); eye(g, -6, -9, 2, 2, { shut, pw: 1, ph: 1, dy: 1 });
  g.line(-10, -10, -8, -9, m, 1); g.line(-5, -10, -4, -11, m, 1);
  g.end();
  g.begin(); g.thick(-8, -4, -13 - max(0, s) * 3, -6, 2.4, m, 3); claw(g, -16 - max(0, s) * 4, -6.5, -1, a > 0.05 ? (s > 0.5 ? 0 : 3) : sn, m, 3.6); g.end();   // närmre klo
  g.pop();
}

// ---------- Kobra ----------
function snake(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), bel = R(o.belly), s = strike(a), sw = sin(t * 2) * 2, shut = hu > 0.3 || blinkAt(t, 6);
  enter(g, hu, o.k || 1, 0.12);
  g.begin();                                             // hoprullad kropp
  g.poly([[9, -4], [19, -6 + sin(t * 4) * 1.5], [21, -4 + sin(t * 4) * 1.5], [10, 0]], m, 2);
  g.ell(1, -4, 12, 4.2, m); g.ell(0, -9.5, 9, 3.8, m);
  for (const x of [-7, -1, 5]) { g.rect(x, -3, 2, 2, m, 1); g.rect(x + 2, -10, 2, 2, m, 1); }
  g.end();
  const hx = -3 + sw - s * 10, hy = -28 + abs(sw) * 0.3 + max(0, s) * 9;
  g.begin();                                             // hals och huva
  for (let i = 0; i <= 7; i++) { const u = i / 7, x = 1 + (hx + 3 - 1) * u + sin(u * PI) * 4, y = -11 + (hy + 5 + 11) * u; g.ell(x, y, 3.7, 3.7, m, false, null, 3); g.ell(x - 1.6, y, 1.8, 2.6, bel, false, null, 4); }
  g.ell(hx + 3, hy + 3, 8.5, 8, m, false, null, 2); g.ell(hx + 1, hy + 5, 5, 6, bel, false, null, 4);
  g.rect(hx + 7, hy - 1, 2, 2, m, 1); g.rect(hx + 8, hy + 4, 2, 2, m, 1); for (const y of [3, 6, 9]) g.rect(hx - 2, hy + y, 5, 1, bel, 2);
  g.end();
  g.begin();                                             // huvud
  if (a > 0.3) { g.poly([[hx - 2, hy + 1], [hx - 9, hy + 1], [hx - 7, hy + 6], [hx - 1, hy + 5]], C.red, 1); g.rect(hx - 8, hy + 2, 1, 3, C.white, 5); g.rect(hx - 5, hy + 2, 1, 2, C.white, 5); }
  g.ell(hx - 1, hy - 1, 5.6, 4.2, m); g.poly([[hx - 4, hy - 4], [hx - 10, hy], [hx - 4, hy + 2]], m, 4);
  eye(g, hx - 6, hy - 3, 3, 3, { shut, pw: 1, ph: 2, mood: 'arg', inner: -1, lid: m });
  if (a < 0.3 && (t * 2.5) % 1 < 0.5) { g.rect(hx - 13, hy + 1, 4, 1, C.red, 3); g.dot(hx - 14, hy, C.red, 3); g.dot(hx - 14, hy + 2, C.red, 3); }
  g.end();
  g.pop();
}

// ---------- Skelett: rostigt svärd och bandana (öken) eller hornhjälm, yxa och istappsskägg (frusen viking) ----------
function skeleton(g, t, pose, o) {
  const { a, hu } = P(pose), bn = R(o.hex || '#ece4cf'), s = strike(a), b = step(t, 2.6), jo = sin(t * 9) > 0.6 || a > 0.05 ? 1 : 0;
  const Y = -36 + b - hu * 5, hx = -12, hy = -22 + b - s * 3;
  enter(g, hu, o.k || 1);
  g.begin();                                             // vapenarm
  g.thick(-6, -29 + b, -10, -24 + b, 2, bn, 2); g.thick(-10, -24 + b, hx, hy, 2, bn, 2);
  g.push(hx, hy, -0.45 - s * 1.3);
  if (o.viking) { g.poly([[-1, 4], [1, 4], [1, -17], [-1, -17]], C.wood, 3); g.poly([[-1, -17], [-8, -20], [-10, -14], [-7, -8], [-1, -10]], C.steel, 4); g.rect(-1.5, -11, 3, 2, C.gold, 3); }
  else { g.poly([[-1.5, -3], [1.5, -3], [1.5, -16], [0, -20], [-1.5, -16]], C.steel, 4); g.rect(0, -12, 2, 2, C.rust, 3); g.rect(-1, -7, 2, 2, C.rust, 3); g.rect(-4, -4, 8, 1.6, C.rust, 3); g.rect(-1, -2.5, 2, 5, C.leather, 3); }
  g.pop(); g.end();
  g.begin();                                             // ben, bäcken, revben
  g.thick(-3, -14, -4.5, -7, 2, bn, 2); g.thick(-4.5, -7, -3, -1, 2, bn, 2); g.rect(-6, -2, 5, 2, bn, 3);
  g.thick(3, -14, 3.5, -7, 2, bn, 3); g.thick(3.5, -7, 3, -1, 2, bn, 3); g.rect(1, -2, 5, 2, bn, 3);
  g.rect(-5, -17, 10, 4, bn, 3); g.rect(-1, -18, 2, 1, bn, 2);
  g.ell(0, -24 + b, 6.5, 6, bn); g.rect(-1, -18, 2, 2, bn, 2);
  for (const y of [-26, -23, -20]) g.rect(-5, y + b, 10, 1, C.dark, 1);
  g.rect(-1, -28 + b, 2, 9, bn, 4); g.rect(-7, -31 + b, 14, 2, bn, 4);
  g.end();
  g.begin();                                             // skalle
  if (o.viking) { g.poly([[-6, Y - 3], [-10, Y - 5], [-12, Y - 12], [-8, Y - 8], [-4, Y - 6]], C.bone, 3); g.poly([[5, Y - 3], [9, Y - 5], [11, Y - 12], [7, Y - 8], [3, Y - 6]], C.bone, 2); }
  g.rect(-5, Y + 3, 9, 3 + jo, bn, 3);
  g.ell(-0.5, Y, 6.6, 6, bn);
  g.rect(-5, Y - 1, 3, 3, C.dark, 0); g.rect(0, Y - 1, 3, 3, C.dark, 0);
  if (hu < 0.3) { g.dot(-5, Y, o.viking ? C.ice : C.fire2, 5); g.dot(0, Y, o.viking ? C.ice : C.fire2, 5); }
  g.dot(-2, Y + 3, C.dark, 0);
  for (let x = -4; x <= 2; x += 2) g.dot(x, Y + 5 + jo, C.dark, 0);
  if (o.viking) {
    g.ell(-0.5, Y, 7.2, 6.6, C.steel, true, (dx, dy) => dy < -0.3); g.rect(-7, Y - 3, 14, 1, C.steel, 2); g.rect(-2, Y - 2, 2, 3, C.steel, 4);
    for (const [x, hh] of [[-4, 4], [-1, 6], [2, 4]]) g.poly([[x - 1, Y + 6 + jo], [x + 0.5, Y + 6 + jo + hh], [x + 2, Y + 6 + jo]], C.ice, 5);
  } else {
    const f = sin(t * 5) * 1.5; g.rect(-7, Y - 4, 13, 2, C.red, 3); g.poly([[5, Y - 4], [11, Y - 5 + f], [13, Y - 2 + f], [10, Y - 1 + f], [5, Y - 2]], C.red, 2);
  }
  g.end();
  g.begin();                                             // sköldarm
  g.thick(6, -29 + b, 8, -22 + b, 2, bn, 3);
  if (o.viking) { g.ell(8.5, -19.5 + b, 6.5, 6.5, R('#4f7fb5')); g.ell(8.5, -19.5 + b, 6.5, 6.5, C.steel, false, (dx, dy, d2) => d2 > 0.62, 3); g.ell(8.5, -19.5 + b, 2, 2, C.steel); }
  else { g.ell(8.5, -19.5 + b, 6, 6, C.wood); g.ell(8.5, -19.5 + b, 2, 2, C.steel); g.line(5, -23 + b, 8, -20 + b, C.wood, 1); g.line(8, -20 + b, 7, -16 + b, C.wood, 1); }
  g.end();
  g.pop();
}

// ---------- Mumie ----------
function mummy(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#d9cfae'), s = strike(a), f = sin(t * 4) * 1.5, shut = hu > 0.3;
  const ay = -26 + s * 8, ax = -15 - max(0, s) * 3;
  g.push(hu * 2, 0, hu * 0.2 - 0.08 + sin(t * 1.5) * 0.05, o.k || 1);
  g.begin(); g.thick(-4, -28, ax, ay - 1, 4, m, 2); g.rect(ax - 3, ay - 3, 4, 5, m, 2); g.end();   // bortre arm
  g.begin();                                             // ben och kropp
  g.rect(-6, -13, 5, 13, m, 2); g.rect(1, -13, 5, 13, m, 3); g.rect(-8, -2, 7, 2, m, 2); g.rect(0, -2, 7, 2, m, 3);
  g.poly([[-7, -32], [7, -32], [6, -12], [-6, -12]], m, 3);
  for (let y = -29; y < -13; y += 4) g.rect(-7, y, 14, 1, m, 2);
  for (const y of [-9, -5]) { g.rect(-6, y, 5, 1, m, 1); g.rect(1, y + 1, 5, 1, m, 2); }
  g.thick(-6, -30, 5, -19, 1, m, 1);
  g.poly([[5, -19], [11, -17 + f], [16, -20 + f], [16, -17 + f], [11, -14 + f], [5, -15]], m, 4);
  g.end();
  g.begin();                                             // huvud
  g.poly([[3, -43], [9, -46 - f], [12, -43 - f], [8, -42], [5, -40]], m, 4);
  g.ell(-1, -38, 7, 7, m);
  g.rect(-7, -42, 12, 1, m, 2); g.rect(-6, -34, 11, 1, m, 2);
  g.rect(-8, -40, 9, 3, C.dark, 0);
  if (!shut) { g.rect(-6, -40, 2, 2, C.fire2, 5); g.rect(-2, -39, 1, 1, C.fire2, 4); }
  g.end();
  g.begin();                                             // närmre arm
  g.thick(4, -28, ax + 5, ay + 1, 4.2, m, 3); g.rect(ax + 2, ay - 1, 4, 5, m, 4);
  g.line(-1, -28, -1, -25, m, 1); g.line(-5, -27, -5, -24, m, 1);
  g.poly([[ax + 4, ay + 3], [ax + 3, ay + 9 + f], [ax + 5, ay + 9 + f], [ax + 6, ay + 3]], m, 4);
  g.end();
  if (a > 0.45) { g.begin(); const u = (a - 0.45) / 0.55; g.thick(ax - 2, ay, ax - 6 - sin(u * PI) * 24, ay + 2 + sin(u * 9) * 3, 2, m, 4); g.end(); }   // bindelpiska
  g.pop();
}

// ---------- Skarabé (pytteliten, i svärm) ----------
function beetle(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex || '#2f9fb0'), s = bump(a), dk = R('#4a4266'), w = step(t, 9, o.ph || 0);
  enter(g, hu, o.k || 1, 0.3);
  g.begin();
  g.line(-3, -2, -5 + w, 0, dk, 2); g.line(1, -2, 1 - w, 0, dk, 2); g.line(4, -2, 6 + w, 0, dk, 2);
  if (s > 0.1) { const fl = step(t, 40) * 2; g.poly([[1, -6], [5, -12 - fl], [9, -8 - fl]], C.ice, 5); g.poly([[2, -6], [9, -10 + fl], [10, -5]], C.ice, 4); }
  g.ell(1.5, -4.5, 5, 3.8, m); g.line(1, -8, 4, -2, m, 1); g.dot(-1, -7, C.white, 5);
  g.ell(-4.5, -3.5, 2.5, 2.5, dk); g.line(-6, -6, -8, -8, dk, 3); g.dot(-6, -4, C.white, 5);
  g.end();
  g.pop();
}

// ---------- Groda ----------
function frog(g, t, pose, o) {
  const { a, hu } = P(pose), m = R('#6bbf59'), bel = R('#dbe8a2'), s = bump(a), cro = max(0, sin(t * 2.2)) * 2, shut = hu > 0.3 || blinkAt(t, 8);
  enter(g, hu, o.k || 1, 0.12);
  g.begin();
  g.ell(7, -5, 6, 5, m); g.poly([[3, -2], [13, -2], [15, 0], [2, 0]], m, 2);
  g.ell(0, -8, 10, 7.5, m); g.ell(-3, -5, 6.5, 4, bel, false, null, 4); g.ell(-6, -4.5, 3 + cro, 2.5 + cro, bel, false, null, 5);
  g.ell(5, -11, 2, 1.5, m, false, null, 2); g.ell(1, -13, 1.5, 1, m, false, null, 2);
  g.thick(-3, -5, -5, -1, 2.6, m, 3); g.rect(-9, -1, 6, 1, m, 3);
  g.ell(-5.5, -14.5, 3.6, 3.6, m); g.ell(2, -15, 3.6, 3.6, m);
  eye(g, -8, -17, 4, 4, { shut, pw: 2, ph: 2, dx: 0, dy: 2 }); eye(g, 0, -17.5, 4, 4, { shut, pw: 2, ph: 2, dx: 2, dy: 0 });   // dum: tittar åt två håll
  if (a > 0.05) g.poly([[-10, -10], [-2, -10], [-3, -6], [-9, -7]], C.dark, 0); else g.rect(-10, -9, 9, 1, m, 1);
  g.end();
  if (a > 0.05) { g.begin(); const L = s * 28; g.thick(-8, -8, -8 - L, -9 - s * 3, 2, C.pink, 3); g.ell(-9 - L, -9 - s * 3, 2.6, 2.6, C.pink); g.end(); }
  g.pop();
}

// ---------- Köttätande växt ----------
function plant(g, t, pose, o) {
  const { a, hu } = P(pose), st = R('#4f9a3e'), hd = R(o.hex || '#d8433b'), s = strike(a), sw = sin(t * 1.6), shut = hu > 0.3 || blinkAt(t, 9);
  const hx = -6 + sw * 2 - s * 8, hy = -31 + abs(sw) + max(0, s) * 5;
  const op = a > 0.02 ? clamp(-s * 1.6 + 0.1, 0.02, 1) : 0.22 + sin(t * 2.5) * 0.08;
  enter(g, hu, o.k || 1, 0.12);
  g.begin();                                             // blad och stjälk
  g.poly([[0, -2], [-12, -10], [-17, -5], [-8, 0]], C.leaf, 4); g.poly([[0, -2], [12, -11], [18, -6], [8, 0]], C.leaf, 2);
  tube(g, [0, -1], [9, -16], [hx + 8, hy + 3], 2.6, 2.4, st, 10, false, 3);
  g.poly([[5, -10], [9, -9], [6, -7]], st, 5); g.poly([[6, -20], [10, -22], [8, -18]], st, 5);
  g.end();
  g.push(hx + 8, hy + 2);
  g.begin();                                             // gap och underkäke
  g.poly([[0, 0], [-22 * cos(op), -22 * sin(op)], [-22 * cos(op), 22 * sin(op)]], C.red, 1);
  g.push(0, 0, -op); g.poly([[1, 0], [-22, 0], [-21, 4], [-15, 8], [-5, 8], [1, 4]], hd, 2);
  for (let x = -20; x < -3; x += 4) g.poly([[x, 0], [x + 1.5, -3], [x + 3, 0]], C.white, 5);
  g.pop(); g.end();
  g.begin();                                             // överkäke
  g.push(0, 0, op); g.poly([[1, 0], [-22, 0], [-22, -4], [-17, -9], [-6, -11], [1, -6]], hd, 3);
  for (let x = -22; x < -5; x += 4) g.poly([[x, 0], [x + 1.5, 3], [x + 3, 0]], C.white, 5);
  for (const [x, y, r] of [[-6, -7, 2], [-14, -6, 1.6], [-2, -3, 1.4]]) g.ell(x, y, r, r * 0.8, C.white, false, null, 5);
  eye(g, -12, -4, 3, 3, { shut, mood: 'arg', inner: -1, col: C.fire2 });
  g.pop(); g.end();
  g.begin(); g.ell(1, 0, 3, 3.4, C.leaf); g.end();
  g.pop();
  g.pop();
}

// ---------- Spöke: irrbloss (lågtopp och lykta) eller slottsspöke (krona, räcker ut tungan) ----------
function ghost(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), s = bump(a), hov = (o.hov || 8) + sin(t * 2) * 2, wv = t * 4, shut = hu > 0.3 || blinkAt(t, 1);
  g.push(hu * 2, -hov, hu * 0.2, (o.k || 1) * (1 + s * 0.12));
  g.begin();
  if (o.kind === 'wisp') { const f = sin(t * 9) * 1.5; g.poly([[-5, -19], [-3, -25 + f], [0, -22], [2, -29 - f], [5, -19]], m, 5); }
  g.poly([[-6, -11], [-13, -13 - s * 7], [-12, -9 - s * 6], [-6, -6]], m, 4); g.poly([[6, -11], [12, -13 - s * 7], [13, -9 - s * 6], [6, -6]], m, 2);
  const hem = [[-8, -13], [8, -13]];
  for (let i = 0; i <= 4; i++) hem.push([8 - i * 4 + (i === 0 ? 3 : 0), (i % 2 ? -2 : 2) + sin(wv + i * 1.3) * 1.2]);
  g.ell(0, -13, 8, 8, m); g.poly(hem, m, 3); g.rect(-8, -13, 3, 9, m, 4); g.rect(5, -13, 3, 10, m, 2);
  if (shut) { g.rect(-6, -14, 3, 1, C.dark, 0); g.rect(-1, -14, 3, 1, C.dark, 0); }
  else { g.ell(-4.5, -14, 1.7, 2.5, C.dark, false, null, 0); g.ell(0.5, -14, 1.7, 2.5, C.dark, false, null, 0); g.dot(-5, -16, C.white, 5); g.dot(0, -16, C.white, 5); }
  g.ell(-2.5, -8.5, 1.6 + s * 1.5, 1.4 + s * 2.4, C.dark, false, null, 0);
  if (o.kind === 'castle') { g.rect(-4, -8, 3, 3 + step(t, 3), C.pink, 3); }
  g.end();
  if (o.kind === 'castle') { g.begin(); g.push(1, -20, 0.2); g.rect(-5, -3, 10, 3, C.gold, 3); for (const x of [-5, -1.5, 2]) g.poly([[x, -3], [x + 1.5, -7], [x + 3, -3]], C.gold, 4); g.dot(0, -2, C.red, 4); g.pop(); g.end(); }
  if (o.kind === 'wisp') { g.begin(); g.rect(-15, -9 - s * 6, 5, 6, C.gold, 3); g.rect(-14, -8 - s * 6, 3, 4, C.fire2, 5); g.rect(-14, -11 - s * 6, 3, 2, C.gold, 2); g.end(); }
  g.pop();
}

// ---------- Krabba: mossig med svamp på skalet (träsk) eller magmakrabba med vulkan på ryggen ----------
function crab(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), s = strike(a), sn = sin(t * 5) > 0.4 ? 1.5 : 0, shut = hu > 0.3 || blinkAt(t, 2);
  g.push(hu * 2 + sin(t * 3) * 1.5, 0, hu * 0.1, o.k || 1);
  g.begin();                                             // ben
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const w = sin(t * 8 + i * 2 + sd) * 0.8; g.thick(sd * (6 + i * 2), -6, sd * (12 + i * 2) + w, -9 + i * 1.5, 1.6, m, 2); g.thick(sd * (12 + i * 2) + w, -9 + i * 1.5, sd * (14 + i * 2.5) + w, 0, 1.6, m, 2); }
  g.end();
  g.begin(); g.thick(9, -9, 15, -14, 2.4, m, 2); claw(g, 17, -17, -1, sn, m, 4, 2); g.end();     // bortre klo
  g.begin();                                             // skal
  if (o.kind === 'magma') { const f = sin(t * 8) * 1.5; g.poly([[6, -21], [7, -26 + f], [9, -23], [11, -28 - f], [13, -21]], C.fire2, 4); g.poly([[3, -12], [6, -21], [13, -21], [16, -11]], R('#5a4a52'), 3); g.rect(7, -21, 5, 1, C.fire, 5); }
  g.thick(-5, -13, -6, -18, 1.6, m, 3); g.thick(1, -13, 2, -18, 1.6, m, 3);
  g.ell(0, -8, 12, 7, m); g.ell(0, -5.5, 10, 3.5, R(o.belly || '#ecd9b0'), false, (dx, dy) => dy > 0.1, 4);
  if (o.kind === 'magma') { g.line(-8, -11, -5, -9, C.fire2, 5); g.line(-5, -9, -6, -7, C.fire2, 5); g.line(8, -10, 6, -8, C.fire2, 5); }
  if (o.kind === 'moss') { g.ell(5, -13, 6, 3, C.moss, false, null, 3); g.rect(6, -18, 2, 4, C.bone, 3); g.ell(7, -18.5, 3.6, 2.4, C.red, true, (dx, dy) => dy < 0.4); g.dot(6, -20, C.white, 5); }
  eye(g, -8, -21, 3, 3, { shut, pw: 1, ph: 2 }); eye(g, 0, -21, 3, 3, { shut, pw: 1, ph: 2 });
  g.rect(-7, -7, 6, 1, C.dark, 0); g.dot(-8, -8, C.dark, 0); g.dot(-1, -8, C.dark, 0);
  g.end();
  g.begin();                                             // närmre klo: nyper
  const cx = -18 - max(0, s) * 7, cy = -13 - max(0, -s) * 5;
  g.thick(-10, -8, cx + 3, cy + 2, 2.6, m, 3); claw(g, cx, cy, -1, a > 0.05 ? (s > 0.6 ? 0 : 4) : sn, m, 5);
  g.end();
  g.pop();
}

// ---------- Pingvinkrigare ----------
function penguin(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), shut = hu > 0.3 || blinkAt(t, o.ph || 0);
  g.push(hu * 2, 0, hu * 0.15 + sin(t * 4 + (o.ph || 0)) * 0.07, o.k || 1);
  g.begin();                                             // spjut
  g.push(-8 - max(0, s) * 6, -8, -0.22 - max(0, s) * 1.25 + max(0, -s) * 0.5);
  g.poly([[-0.8, 6], [0.8, 6], [0.8, -15], [-0.8, -15]], C.wood, 3); g.poly([[0, -22], [2.6, -15], [-2.6, -15]], C.ice, 5);
  g.pop(); g.end();
  g.begin();
  g.rect(-5, -2, 4, 2, C.orange, 3); g.rect(1, -2, 4, 2, C.orange, 3);
  g.ell(0, -10, 7, 9.5, C.navy); g.ell(-2, -8, 4.6, 6.8, C.snow, false, null, 5);
  g.poly([[5, -13], [9, -6], [6, -5]], C.navy, 2); g.poly([[-5, -11], [-9, -8], [-6, -7]], C.navy, 4);
  g.poly([[-6, -14.5], [-10, -13], [-6, -11.5]], C.orange, 4);
  if (shut) { g.rect(-5, -16, 2, 1, C.white, 5); g.rect(-1, -16, 2, 1, C.white, 5); }
  else { g.rect(-5, -17, 2, 2, C.white, 5); g.dot(-5, -16, C.dark, 0); g.rect(-1, -17, 2, 2, C.white, 5); g.dot(-1, -16, C.dark, 0); }
  g.ell(0, -17.5, 6.4, 4.6, C.steel, true, (dx, dy) => dy < 0.1); g.rect(-6, -18, 13, 1, C.steel, 2); g.poly([[-1, -21], [0.5, -25], [2, -21]], C.steel, 5);
  g.end();
  g.pop();
}

// ---------- Snögubbe ----------
function snowman(g, t, pose, o) {
  const { a, hu } = P(pose), s = strike(a), f = sin(t * 4) * 1.5, shut = hu > 0.3;
  const ax = -14 - max(0, s) * 2, ay = -25 + s * 7;
  enter(g, hu, o.k || 1, 0.12);
  g.begin();                                             // pinnarmar
  g.thick(-6, -22, ax, ay, 1.6, C.wood, 3); g.line(ax, ay, ax - 3, ay - 2, C.wood, 3); g.line(ax, ay, ax - 2, ay + 2, C.wood, 3);
  g.thick(6, -21, 15, -26 + f * 0.5, 1.6, C.wood, 2); g.line(15, -26 + f * 0.5, 18, -29 + f * 0.5, C.wood, 2); g.line(15, -26 + f * 0.5, 18, -25 + f * 0.5, C.wood, 2);
  g.end();
  g.begin(); g.ell(0, -9, 11, 9.5, C.snow); g.end();
  g.begin(); g.ell(0, -22, 8, 7, C.snow); g.rect(-5, -24, 2, 2, C.dark, 0); g.rect(-6, -19, 2, 2, C.dark, 0); g.end();
  g.begin();                                             // huvud, halsduk, hatt
  g.ell(-0.5, -32, 6, 5.6, C.snow);
  g.rect(-6, -28, 12, 2, C.red, 3); g.poly([[4, -28], [10, -27 + f], [12, -22 + f], [8, -22 + f], [6, -26]], C.red, 2);
  g.rect(-7, -38, 13, 2, C.dark, 2); g.rect(-4, -44, 8, 6, C.dark, 3); g.rect(-4, -40, 8, 1, C.red, 3);
  g.poly([[-5, -33], [-12, -31.5], [-5, -30.5]], C.orange, 4);
  if (shut) { g.rect(-4, -35, 2, 1, C.dark, 0); g.rect(0, -35, 2, 1, C.dark, 0); } else { g.rect(-4, -36, 2, 2, C.dark, 0); g.rect(0, -36, 2, 2, C.dark, 0); g.line(-5, -38, -3, -37, C.snow, 1); g.line(0, -37, 2, -38, C.snow, 1); }
  g.dot(-4, -29, C.dark, 0); g.dot(-2, -30, C.dark, 0); g.dot(0, -29, C.dark, 0);
  g.end();
  g.begin();                                             // snöboll
  if (a > 0.35) { const u = (a - 0.35) / 0.65; g.ell(ax - 3 - u * 42, ay - 2 - sin(u * PI) * 10 + u * 8, 3.2, 3.2, C.snow); } else g.ell(ax - 2, ay - 2, 3.2, 3.2, C.snow);
  g.end();
  g.pop();
}

// ---------- Yeti ----------
function yeti(g, t, pose, o) {
  const { a, hu } = P(pose), fur = C.snow, skin = R('#7fb2d9'), s = strike(a), br = sin(t * 1.8), shut = hu > 0.3 || blinkAt(t, 4);
  const arm = (x, y, ang, lv) => {
    g.push(x, y, ang); tube(g, [0, 0], [-1, 16], [-3, 31], 6.5, 5.5, fur, 5);
    for (const yy of [8, 20]) g.poly([[3, yy], [9, yy + 4], [3, yy + 6]], fur, lv);
    g.ell(-3, 35, 6.5, 5, skin); g.pop();
  };
  enter(g, hu, o.k || 1, 0.1);
  g.begin(); arm(-15, -41, 0.25 + s * 1.5, 2); g.end();
  g.begin();                                             // ben
  g.rect(-15, -15, 12, 12, fur, 2); g.rect(4, -15, 12, 12, fur, 3);
  g.poly([[-20, 0], [-19, -5], [-4, -5], [-3, 0]], skin, 3); g.poly([[1, 0], [2, -5], [18, -5], [19, 0]], skin, 3);
  g.end();
  g.begin();                                             // kropp och huvud i ett
  for (const [x, y, dx, dy] of [[-19, -24, -5, 4], [-18, -34, -6, 3], [20, -22, 5, 5], [20, -34, 6, 3], [14, -46, 6, -2], [-2, -11, -2, 6], [8, -11, 2, 6]]) g.poly([[x, y - 3], [x + dx, y + dy], [x, y + 4]], fur, 3);
  g.ell(1, -30 - br * 0.5, 20, 21 + br * 0.5, fur);
  g.poly([[-12, -58], [-15, -65], [-7, -60]], skin, 2); g.poly([[1, -59], [6, -66], [7, -58]], skin, 2);
  g.ell(-5, -50 - br * 0.5, 12.5, 11, fur);
  g.poly([[-2, -60], [1, -65], [3, -60]], fur, 5); g.poly([[-7, -60], [-6, -64], [-3, -60]], fur, 5);
  for (const [x, y] of [[-6, -26], [2, -20], [-10, -17], [8, -30], [-1, -33]]) { g.line(x, y, x + 2, y + 2, fur, 2); g.line(x + 2, y + 2, x + 4, y, fur, 2); }
  g.end();
  g.begin();                                             // ansikte: sömnig, en tand sticker upp
  const fy = -48 - br * 0.5;
  g.ell(-9, fy, 8.5, 7.5, skin, 0.75);
  eye(g, -15, fy - 4, 4, 4, { shut, mood: 'somnig', lid: skin, pw: 2, ph: 2 }); eye(g, -8, fy - 4, 4, 4, { shut, mood: 'somnig', lid: skin, pw: 2, ph: 2 });
  g.rect(-13, fy + 1, 3, 2, skin, 1);
  const mo = a > 0.05 ? 1 + bump(a) * 3 : 0;
  g.rect(-15, fy + 4, 10, 1 + mo, C.dark, 0); g.rect(-13, fy + 2 + mo, 2, 3, C.white, 5); g.rect(-8, fy + 3 + mo, 2, 2, C.white, 5);
  g.end();
  g.begin(); arm(19, -40, -0.12 + s * 1.2, 3); g.end();
  g.pop();
}

// ---------- Imp: busimp med treudd, eller gargoyle i sten med stora vingar och klor ----------
function imp(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), s = strike(a), b = step(t, 2.8), f = sin(t * 8) * 3, shut = hu > 0.3 || blinkAt(t, 3);
  const hov = o.fly ? 12 + sin(t * 2.5) * 2 : 0, Y = -17 + b;
  g.push(hu * 2, -hov, hu * 0.15, o.k || 1);
  g.begin();                                             // vingar och svans
  if (o.fly) {
    g.poly([[3, -13], [8, -26 + f], [15, -32 + f], [24, -28 + f], [20, -24 + f], [26, -18 + f], [19, -17 + f * 0.5], [21, -10], [14, -13], [10, -8]], m, 1); g.thick(3, -13, 8, -26 + f, 1.6, m, 3); g.thick(8, -26 + f, 24, -28 + f, 1.4, m, 3); g.thick(8, -26 + f, 26, -18 + f, 1.2, m, 3);
    g.poly([[-3, -13], [-8, -25 + f], [-14, -31 + f], [-22, -27 + f], [-18, -23 + f], [-23, -18 + f], [-17, -17 + f * 0.5], [-19, -11], [-12, -13], [-9, -9]], m, 2); g.thick(-3, -13, -8, -25 + f, 1.6, m, 4); g.thick(-8, -25 + f, -22, -27 + f, 1.4, m, 4);
  } else g.poly([[3, -13], [10, -22 + f], [17, -17 + f], [13, -13 + f * 0.5], [15, -8], [5, -9]], m, 1);
  const tw = sin(t * 3) * 2;
  g.thick(3, -5, 9, -3, 1.6, m, 2); g.thick(9, -3, 13, -8 + tw, 1.6, m, 2); g.poly([[11, -9 + tw], [14, -13 + tw], [16, -8 + tw]], m, 4);
  g.end();
  g.begin();                                             // arm och treudd, eller klor
  if (o.fly) { g.thick(-3, -11, -9 - max(0, s) * 4, -10 + s * 3, 2.4, m, 3); for (const d of [-2, 0, 2]) g.line(-9 - max(0, s) * 4, -10 + s * 3 + d * 0.6, -12 - max(0, s) * 4, -10 + s * 3 + d, C.bone, 5); }
  else {
    g.thick(-3, -11, -8, -9 - s, 2.2, m, 2);
    g.push(-8, -9 - s, -0.25 - max(0, s) * 1.2 + max(0, -s) * 0.6);
    g.poly([[-0.8, 5], [0.8, 5], [0.8, -15], [-0.8, -15]], C.dark, 2); g.rect(-3.5, -16, 7, 1.4, C.steel, 4);
    for (const x of [-3.5, -0.7, 2.1]) g.poly([[x, -16], [x + 0.7, -21 - (x === -0.7 ? 2 : 0)], [x + 1.4, -16]], C.steel, 5);
    g.pop();
  }
  g.end();
  g.begin();                                             // kropp
  g.rect(-4, -4, 3, 4, m, 2); g.rect(1, -4, 3, 4, m, 3); g.rect(-5, -1, 4, 1, C.dark, 1); g.rect(1, -1, 4, 1, C.dark, 1);
  g.ell(0, -8.5, 4.6, 5.5, m); g.ell(-1, -7.5, 2.6, 3.4, o.fly ? m : C.orange, false, null, o.fly ? 4 : 3);
  g.end();
  g.begin();                                             // huvud
  g.poly([[-5, Y - 3], [-8, Y - 10], [-2, Y - 5]], C.bone, 4); g.poly([[3, Y - 4], [7, Y - 10], [6, Y - 2]], C.bone, 2);
  g.poly([[5, Y - 1], [11, Y - 4], [6, Y + 2]], m, 2);
  g.ell(-0.5, Y, 7, 6, m);
  if (o.fly) { eye(g, -6, Y - 2, 3, 3, { shut, col: C.ice, mood: 'arg', inner: 1, pw: 1, ph: 2 }); eye(g, -1, Y - 2, 3, 3, { shut, col: C.ice, mood: 'arg', inner: -1, pw: 1, ph: 2 }); g.rect(-6, Y + 3, 6, 1, C.dark, 0); g.dot(-5, Y + 2, C.white, 5); g.dot(-2, Y + 2, C.white, 5); }
  else {
    eye(g, -6, Y - 2, 3, 3, { shut, col: C.fire2, mood: 'lomsk', lid: m, pw: 1, ph: 2 }); eye(g, -1, Y - 2, 3, 3, { shut, col: C.fire2, mood: 'lomsk', lid: m, pw: 1, ph: 2 });
    g.rect(-6, Y + 2, 7, 2, C.white, 5); for (const x of [-4, -2, 0]) g.dot(x, Y + 3, C.dark, 0); g.dot(-7, Y + 1, C.dark, 0); g.dot(1, Y + 1, C.dark, 0);
  }
  g.end();
  g.pop();
}

// ---------- Eldande ----------
function flame(g, t, pose, o) {
  const { a, hu } = P(pose), s = bump(a), fl = (i) => sin(t * 9 + i * 2.1) * 1.6, shut = hu > 0.3 || blinkAt(t, 5);
  g.push(hu * 2, -(o.hov || 4) - sin(t * 3), hu * 0.2, (o.k || 1) * (1 + s * 0.18));
  g.begin();
  g.poly([[-8, -8], [-14, -13 + fl(4) - s * 4], [-11, -6]], C.fire, 4); g.poly([[8, -8], [13, -12 + fl(5) - s * 4], [10, -5]], C.fire, 2);
  g.poly([[-8, -4], [-9, -11], [-6, -15 + fl(0)], [-7, -21 + fl(1)], [-3, -18], [-1, -27 + fl(2)], [3, -19], [6, -23 + fl(3)], [7, -14], [9, -9], [7, -3], [3, 0], [-4, 0]], C.fire, 3);
  g.end();
  g.begin();
  g.poly([[-5, -3], [-6, -9], [-4, -13 + fl(1)], [-1, -18 + fl(2)], [2, -13], [5, -9], [4, -3], [0, -1]], C.fire2, 4);
  peep(g, -4, -10, shut); peep(g, 0, -10, shut);
  if (a > 0.05) g.ell(-1.5, -4.5, 2, 1.6 + s, C.dark, false, null, 0); else { g.rect(-3, -5, 4, 1, C.dark, 0); g.dot(-4, -6, C.dark, 0); g.dot(1, -6, C.dark, 0); }
  g.end({ outline: false });
  if (a > 0.3) { g.begin(); const u = (a - 0.3) / 0.7, x = -12 - u * 30; g.poly([[x + 2, -9], [x + 9, -7], [x + 2, -4]], C.fire, 4); g.ell(x, -6.5, 3.2, 3.2, C.fire2); g.end(); }
  g.pop();
}

// ---------- Golem ----------
function golem(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex), glow = R(o.glow), s = strike(a), br = step(t, 1.6), shut = hu > 0.3 || blinkAt(t, 6);
  const arm = (x, y, ang, lv) => {
    g.push(x, y, ang); g.poly([[-6, 2], [6, 2], [7, 24], [-7, 24]], m, lv - 1); g.poly([[-9, 22], [8, 20], [10, 42], [-4, 45], [-11, 38]], m, lv);
    g.rect(-8, 30, 17, 1, m, lv - 2); g.ell(0, 0, 9.5, 8.5, m); if (o.moss) g.ell(0, -4, 8, 4, C.moss, false, (dx, dy) => dy < 0.3, 3); g.pop();
  };
  enter(g, hu, o.k || 1, 0.08);
  g.begin(); arm(-21, -47 + br, 0.12 + s * 1.5, 3); g.end();
  g.begin(); g.poly([[-16, -18], [-3, -18], [-2, 0], [-18, 0]], m, 2); g.poly([[4, -18], [17, -18], [19, 0], [3, 0]], m, 3); g.rect(-18, -4, 16, 1, m, 1); g.rect(3, -4, 16, 1, m, 1); g.end();
  g.begin();                                             // bål
  g.poly([[-22, -55 + br], [-8, -61 + br], [14, -59 + br], [24, -49 + br], [22, -28], [14, -16], [-14, -16], [-22, -28]], m, 3);
  g.poly([[-20, -54 + br], [-8, -59 + br], [12, -57 + br], [7, -49], [-13, -47]], m, 4);
  g.poly([[-19, -27], [19, -27], [13, -17], [-13, -17]], m, 2);
  g.line(-6, -44, -2, -38, glow, 5); g.line(-2, -38, -7, -32, glow, 5); g.line(-7, -32, -4, -27, glow, 5); g.line(8, -42, 11, -36, glow, 4); g.line(11, -36, 8, -31, glow, 4);
  if (o.moss) { g.ell(10, -57 + br, 9, 4, C.moss, false, (dx, dy) => dy < 0.4, 3); g.ell(-14, -30, 5, 3, C.moss, false, null, 3); g.ell(12, -22, 4, 2.4, C.moss, false, null, 2); }
  g.end();
  g.begin();                                             // huvud
  const hy = br;
  if (o.moss) { g.thick(-4, -69 + hy, -3, -74 + hy, 1.4, C.leaf, 2); g.poly([[-3, -74 + hy], [2, -77 + hy], [2, -73 + hy]], C.leaf, 4); g.poly([[-3, -74 + hy], [-8, -76 + hy], [-7, -72 + hy]], C.leaf, 3); }
  g.poly([[-17, -57 + hy], [-13, -68 + hy], [-2, -70 + hy], [5, -64 + hy], [4, -55 + hy], [-12, -53 + hy]], m, 3);
  g.poly([[-13, -67 + hy], [-2, -69 + hy], [3, -64 + hy], [-10, -64 + hy]], m, 4);
  g.rect(-15, -63 + hy, 13, 4, C.dark, 0);
  if (!shut) { g.rect(-14, -62 + hy, 3, 2, glow, 5); g.rect(-8, -62 + hy, 3, 2, glow, 5); if (o.moss) { g.rect(-14, -63 + hy, 3, 1, m, 2); g.rect(-8, -63 + hy, 3, 1, m, 2); } }
  g.rect(-13, -57 + hy, 9, 1, m, 1); if (a > 0.05) g.rect(-13, -57 + hy, 9, 2, glow, 4);
  g.end();
  g.begin(); arm(22, -47 + br, -0.1 + s * 0.9, 4); g.end();
  g.pop();
}

// ---------- Moln med ansikte ----------
function cloud(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex || '#9aa3c0'), s = bump(a), hov = (o.hov || 18) + sin(t * 1.7) * 2, shut = hu > 0.3 || blinkAt(t, 2);
  g.push(hu * 2, -hov, hu * 0.15, o.k || 1);
  if (a > 0.2) { g.begin(); const d = s * 5; g.poly([[-4, 2], [1, 2], [-4, 8 + d * 0.3], [-1, 8 + d * 0.3], [-9, 17 + d], [-6, 10 + d * 0.3], [-9, 10 + d * 0.3]], C.fire2, 4); g.end(); }
  else { g.begin(); for (let i = 0; i < 4; i++) { const ph = (t * 1.6 + i * 0.29) % 1; g.rect(-9 + i * 6, 4 + ph * 9, 1, 2, C.ice, 4); } g.end({ outline: false, edge: false }); }
  g.begin();
  g.ell(9, -4, 9, 6.5, m); g.ell(1, -9.5, 9, 8, m); g.ell(-9, -5, 8.5, 6.5, m); g.ell(-1, -2, 13, 5.5, m);
  eye(g, -10, -9, 3, 3, { shut, mood: 'arg', inner: 1, pw: 2, ph: 2 }); eye(g, -4, -9, 3, 3, { shut, mood: 'arg', inner: -1, pw: 2, ph: 2 });
  if (a > 0.05) g.ell(-5.5, -2.5, 2 + s, 1.5 + s, C.dark, false, null, 0); else { g.rect(-8, -3, 5, 1, C.dark, 0); g.dot(-9, -2, C.dark, 0); g.dot(-3, -2, C.dark, 0); }
  g.end();
  g.pop();
}

// ---------- Flygande öga ----------
function eyeball(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex || '#8a5ab8'), iris = R(o.iris || '#2fbf71'), s = bump(a), f = sin(t * 9) * 4;
  const hov = (o.hov || 15) + sin(t * 2.2) * 2.5, shut = hu > 0.3 || blinkAt(t, 1), lid = shut ? 0.75 : a > 0.05 ? -0.7 : -0.38;
  g.push(hu * 2, -hov, hu * 0.2, o.k || 1);
  g.begin();
  for (const sx of [-1, 1]) { g.poly([[sx * 6, -3], [sx * 15, -11 + f], [sx * 19, -4 + f], [sx * 14, -2 + f * 0.5], [sx * 12, 3], [sx * 8, 2]], m, sx < 0 ? 2 : 1); g.thick(sx * 6, -3, sx * 15, -11 + f, 1.4, m, 4); }
  g.thick(2, 8, 4, 12, 1.8, C.red, 2); g.thick(4, 12, 3 + sin(t * 3) * 2, 16, 1.6, C.red, 2);
  g.end();
  g.begin();
  g.ell(0, 0, 9.5, 9.5, C.bone);
  g.ell(-3.5, 0.5, 5, 5.4, iris); g.ell(-4.5, 0.8, 1.7, 3.2 + s, C.dark, false, null, 0); g.rect(-7, -2, 2, 2, C.white, 5);
  g.line(5, 3, 8, 2, C.red, 3); g.line(4, 6, 6, 6, C.red, 3);
  g.ell(0, 0, 9.5, 9.5, m, true, (dx, dy) => dy < lid); g.ell(0, 0, 9.5, 9.5, m, false, (dx, dy) => dy > 0.86, 2);
  g.end();
  if (a > 0.3) { g.begin(); const u = (a - 0.3) / 0.7, L = sin(u * PI) * 34; g.rect(-9 - L, -1, L, 3, iris, 5); g.rect(-9 - L, 0, L, 1, C.white, 5); g.end({ edge: false }); }
  g.pop();
}

// ---------- Riddare (tom, rostig rustning) ----------
function knight(g, t, pose, o) {
  const { a, hu } = P(pose), m = R(o.hex || '#8793a3'), s = strike(a), b = step(t, 2.2), glow = C.ice, shut = hu > 0.3 || blinkAt(t, 8);
  const hx = -13, hy = -21 + b - s * 4;
  enter(g, hu, o.k || 1, 0.12);
  g.begin();                                             // svärdsarm
  g.thick(-8, -28 + b, hx, hy, 5, m, 2);
  g.push(hx, hy, -0.5 - s * 1.3);
  g.poly([[-2.5, -4], [2.5, -4], [3, -24], [0, -30], [-3, -24]], C.steel, 4); g.poly([[-0.5, -6], [0.5, -6], [0.5, -24], [-0.5, -24]], C.steel, 2);
  g.rect(1, -17, 2, 3, C.rust, 3); g.rect(-2, -10, 2, 2, C.rust, 3);
  g.poly([[-6, -6], [6, -6], [6, -3.5], [-6, -3.5]], C.gold, 3); g.rect(-1.5, -3.5, 3, 7, C.leather, 3);
  g.pop(); g.end();
  g.begin();                                             // ben
  g.rect(-8, -14, 6, 10, m, 2); g.rect(2, -14, 6, 10, m, 3); g.rect(-10, -5, 9, 5, m, 2); g.rect(1, -5, 9, 5, m, 3); g.rect(-8, -10, 6, 2, m, 5); g.rect(2, -10, 6, 2, m, 5);
  g.end();
  g.begin();                                             // bål
  g.ell(0, -23 + b, 10, 9, m); g.rect(-9, -16, 18, 3, m, 2); g.rect(-9, -16, 18, 1, C.leather, 2);
  g.ell(-9.5, -29 + b, 5.4, 4.2, m); g.ell(9.5, -29 + b, 5.4, 4.2, m);
  g.rect(-3, -25 + b, 3, 3, C.red, 4); g.rect(3, -20 + b, 3, 2, C.rust, 3); g.rect(-7, -22 + b, 2, 2, C.rust, 3); g.dot(5, -27 + b, C.rust, 3);
  g.end();
  g.begin();                                             // hjälm
  const Y = -38 + b, pf = sin(t * 3) * 1.5;
  g.poly([[-1, Y - 7], [4, Y - 14 + pf], [11, Y - 12 + pf], [13, Y - 5 + pf], [9, Y - 1], [6, Y - 5]], C.red, 3);
  g.ell(-0.5, Y, 9, 8.5, m);
  g.rect(-10, Y - 2, 12, 4, C.dark, 0); if (!shut) { g.rect(-8, Y - 1, 2, 2, glow, 5); g.rect(-3, Y - 1, 2, 2, glow, 5); }
  g.rect(-6, Y - 8, 2, 6, m, 5); for (const x of [-8, -6, -4]) g.dot(x, Y + 4, m, 1);
  g.rect(3, Y + 2, 3, 2, C.rust, 3);
  g.end();
  g.begin();                                             // sköldarm
  g.thick(9, -28 + b, 11, -20 + b, 5, m, 3);
  g.poly([[5, -27 + b], [19, -27 + b], [19, -16 + b], [12, -7 + b], [5, -16 + b]], R('#4f6fb0'), 3); g.rect(11, -27 + b, 2, 16, C.gold, 4); g.rect(5, -22 + b, 14, 2, C.gold, 4); g.rect(15, -18 + b, 2, 2, C.rust, 3);
  g.end();
  g.pop();
}

// ---------- Stjärnskott (pyttesmå, i svärm) ----------
function star(g, t, pose, o) {
  const { a, hu } = P(pose), ph = o.ph || 0, hov = (o.hov || 12) + sin(t * 3 + ph) * 3, shut = hu > 0.3 || blinkAt(t, ph);
  g.begin(); for (let i = 0; i < 3; i++) { const u = (t * 2 + i * 0.33) % 1; g.rect(6 + u * 9, -hov - 4 - u * 5 + i * 2, u < 0.5 ? 2 : 1, u < 0.5 ? 2 : 1, C.fire2, 5); } g.end({ outline: false, edge: false });
  g.push(hu * 2, -hov, sin(t * 2 + ph) * 0.2 + a * PI * 2 + hu * 0.5, o.k || 1);
  g.begin();
  const pts = []; for (let i = 0; i < 10; i++) { const an = -PI / 2 + i * PI / 5, r = i % 2 ? 3.2 : 7; pts.push([cos(an) * r, sin(an) * r]); }
  g.poly(pts, C.fire2, 4);
  if (shut) { g.rect(-3, 0, 2, 1, C.dark, 0); g.rect(0, 0, 2, 1, C.dark, 0); } else { g.rect(-3, -1, 1, 2, C.dark, 0); g.rect(0, -1, 1, 2, C.dark, 0); }
  g.rect(-2, 2, 2, 1, C.dark, 0);
  g.end();
  g.pop();
}

// ====================================================================================================
// BOSSAR
// ====================================================================================================
const lerp = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
const bez = (p0, p1, p2, u) => { const v = 1 - u; return [v * v * p0[0] + 2 * u * v * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * p1[1] + u * u * p2[1], 2 * v * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]), 2 * v * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1])]; };
// Litet pixeltecken (frågetecken, bokstäver) ur en mall, cell för cell.
function glyph(g, x, y, rows, rp, lv = 5, c = 2) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.rect(x + i * c, y + j * c, c, c, rp, lv); }); }
const QMARK = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
const LETTER_A = ['.#.', '#.#', '###', '#.#', '#.#'], LETTER_Z = ['###', '..#', '.#.', '#..', '###'];

// ---------- Trollet Glömsk (Ordskogen): jätte som kliar sig i huvudet och har glömt vad han skulle ----------
function troll(g, t, pose) {
  const { a, hu } = P(pose), sk = R('#7da35c'), bel = R('#b3c884'), s = strike(a), br = sin(t * 1.5), b = br > 0.2 ? 1 : 0;
  const shut = hu > 0.3 || (t % 4.2) < 0.25, hy = -124 + b;
  enter(g, hu, 1, 0.06);
  // Bortre arm med klubba: lyfts över huvudet och dunkas ner framåt.
  const A = 0.15 + (s < 0 ? -s * 2 : s * 0.75), TH = -0.3 + (s < 0 ? -s * 1.5 : -s * 1.9);
  g.push(-30, -100 + b, A);
  g.begin(); tube(g, [0, 0], [-4, 20], [-6, 40], 11, 9, sk, 6); g.end();
  g.push(-6, 42, TH - A);
  g.begin();
  g.poly([[-4, 12], [4, 12], [9, -50], [7, -66], [-7, -66], [-10, -50]], C.wood, 3);
  g.poly([[-8, -50], [-5, -64], [-1, -64], [-3, -50], [-2, 8], [-3, 8]], C.wood, 4);
  g.ell(3, -38, 3, 2.4, C.wood, false, null, 1); g.ell(-2, -18, 2.4, 2, C.wood, false, null, 1); g.ell(0, -66, 7, 2.6, C.wood, false, null, 5); g.ell(0, -66, 4, 1.4, C.wood, false, null, 3);
  g.poly([[8, -44], [17, -53], [16, -46], [9, -37]], C.wood, 2); g.poly([[15, -52], [22, -58], [22, -50]], C.leaf, 4); g.poly([[15, -52], [13, -60], [19, -57]], C.leaf, 3);
  g.end();
  g.begin(); g.ell(0, 0, 9.5, 8.5, sk); for (const y of [-5, -1, 3]) g.rect(-9, y, 7, 3, sk, 4); g.end();
  g.pop(); g.pop();
  g.begin();                                             // ben och fötter
  g.poly([[-32, -40], [-10, -40], [-8, -6], [-34, -6]], sk, 2); g.poly([[8, -40], [32, -40], [34, -6], [10, -6]], sk, 3);
  g.poly([[-42, 0], [-40, -9], [-6, -10], [-5, 0]], sk, 3); g.poly([[2, 0], [4, -9], [36, -10], [38, 0]], sk, 3);
  for (const x of [-38, -31, -24, 6, 13, 20]) { g.ell(x, -3.5, 4, 3.6, sk); g.rect(x - 3, -2, 3, 2, C.bone, 4); }
  g.end();
  g.begin();                                             // mage och bröst
  g.ell(2, -68 - br * 0.6, 42, 36 + br * 0.6, sk); g.ell(0, -100 + b, 36, 22, sk);
  g.ell(-8, -64 - br * 0.6, 27, 25, bel, 0.8);
  g.rect(-14, -54, 3, 3, bel, 1); g.rect(-13, -53, 2, 2, bel, 2);
  for (const [x, y] of [[20, -84], [26, -72], [16, -96]]) g.ell(x, y, 2.4, 1.8, sk, false, null, 2);     // vårtor
  g.rect(24, -121 + b, 2, 4, C.bone, 3); g.ell(25, -122 + b, 4, 2.6, C.red, true, (dx, dy) => dy < 0.4); g.rect(30, -118 + b, 2, 3, C.bone, 3); g.ell(31, -119 + b, 3, 2, C.red, true, (dx, dy) => dy < 0.4);
  g.end();
  g.begin();                                             // höftskynke
  g.poly([[-39, -44], [42, -44], [38, -30], [22, -23], [8, -30], [-8, -21], [-22, -30], [-37, -25]], C.leather, 3);
  g.rect(-40, -47, 83, 4, C.wood, 2); g.rect(12, -40, 7, 7, R('#b58a5a'), 4); g.line(11, -41, 19, -41, C.dark, 1); g.line(11, -33, 19, -33, C.dark, 1);
  g.end();
  g.begin();                                             // huvud
  g.poly([[8, hy - 4], [23, hy - 13 + step(t, 1.1) * 2], [21, hy + 4], [9, hy + 7]], sk, 2); g.poly([[11, hy - 2], [19, hy - 8], [18, hy + 2]], bel, 2);
  for (const [x, d] of [[-12, -3], [-6, 0], [0, 3]]) g.thick(x, hy - 16, x + d, hy - 26, 1.8, C.wood, 2);
  g.ell(-8, hy, 20, 18, sk); g.ell(-12, hy + 10, 17, 10, sk);
  g.end();
  g.begin();                                             // ansikte: ögonen tittar åt var sitt håll
  g.ell(-25, hy + 2, 8, 7, bel, 0.9); g.rect(-31, hy + 4, 2, 2, sk, 1); g.rect(-26, hy + 6, 2, 2, sk, 1);
  eye(g, -24, hy - 10, 7, 7, { shut, pw: 3, ph: 3, dx: 0, dy: 0 }); eye(g, -12, hy - 9, 7, 7, { shut, pw: 3, ph: 3, dx: 4, dy: 4 });
  g.thick(-26, hy - 11, -3, hy - 13, 2.6, sk, 1);
  const mo = a > 0.05 ? 2 + bump(a) * 5 : 0;
  g.rect(-26, hy + 13, 21, 2 + mo, C.dark, 0); g.poly([[-25, hy + 14], [-23, hy + 6], [-20, hy + 14]], C.bone, 5); g.poly([[-11, hy + 14], [-9, hy + 5], [-6, hy + 14]], C.bone, 4);
  g.end();
  // Närmre arm: kliar sig i huvudet, sänks till en knuten näve under attacken.
  const sc = 1 - clamp(a * 6), wig = sin(t * 7) * 1.5 * sc, hand = lerp([46, -58], [16, hy - 17 + wig], sc), ctl = lerp([52, -82], [56, -112], sc);
  g.begin(); tube(g, [30, -98 + b], ctl, hand, 11, 8.5, sk, 8); g.ell(hand[0], hand[1], 9, 8, sk); g.rect(hand[0] - 9, hand[1] - 2, 4, 4, C.red, 4); g.dot(hand[0] - 10, hand[1] - 3, C.red, 5); g.dot(hand[0] - 10, hand[1] + 2, C.red, 5); g.end();
  if (a < 0.02 && hu < 0.02 && sin(t * 0.9) > -0.2) { g.begin(); glyph(g, -46, hy - 44 + Math.round(sin(t * 2.5) * 2), QMARK, C.white); g.end(); }
  g.pop();
}

// ---------- Draken Punktum (Meningsvulkanen): gigantisk, sprutar eld ----------
function dragon(g, t, pose) {
  const { a, hu } = P(pose), m = R('#d8433b'), dk = R('#a8303f'), bel = R('#f2c35a'), wg = R('#93304e'), s = strike(a), br = sin(t * 1.6);
  const fw = sin(t * 2.2) * 0.09 + max(0, -s) * 0.3, shut = hu > 0.3 || blinkAt(t, 3), tw = sin(t * 1.9) * 5;
  const wing = (lv) => {
    g.poly([[0, 0], [22, -58], [48, -74], [72, -70], [62, -52], [86, -36], [70, -26], [78, -2], [58, -6], [40, 8], [14, 4]], wg, lv);
    g.thick(0, 0, 22, -58, 5, m, 3); g.thick(22, -58, 72, -70, 3, m, 3); g.thick(22, -58, 86, -36, 3, m, 3); g.thick(22, -58, 78, -2, 3, m, 3);
    g.poly([[19, -58], [17, -69], [26, -62]], C.bone, 4);
  };
  enter(g, hu, 1, 0.05);
  g.begin(); g.push(-4, -82, -0.5 - fw * 0.7, 0.8); wing(1); g.pop(); g.end();
  g.begin(); g.push(22, -78, -fw); wing(2); g.pop(); g.end();
  g.begin();                                             // svans
  const T0 = [40, -22], T1 = [96, 6], T2 = [104, -36 + tw];
  for (const u of [0.25, 0.45, 0.65, 0.82]) { const [x, y, tx, ty] = bez(T0, T1, T2, u), d = Math.hypot(tx, ty), nx = ty / d, ny = -tx / d, r = 13 - 9 * u; g.poly([[x + tx / d * 3 + nx * r * 0.6, y + ty / d * 3 + ny * r * 0.6], [x + nx * (r + 6), y + ny * (r + 6)], [x - tx / d * 3 + nx * r * 0.6, y - ty / d * 3 + ny * r * 0.6]], C.bone, 3); }
  tube(g, T0, T1, T2, 13, 4, m, 14);
  g.poly([[T2[0] - 8, T2[1] - 2], [T2[0], T2[1] - 18], [T2[0] + 9, T2[1] - 2], [T2[0], T2[1] - 6]], dk, 3);
  g.end();
  g.begin();                                             // kropp med bukplåtar
  for (const [x, y] of [[36, -78], [46, -66], [52, -52]]) g.poly([[x - 5, y + 3], [x + 6, y - 7], [x + 4, y + 6]], C.bone, 3);
  g.ell(12, -46 - br * 0.5, 40, 40 + br * 0.5, m);
  g.ell(-4, -42, 25, 33, bel, 0.9, (dx) => dx < 0.45);
  g.ell(-4, -42, 25, 33, bel, false, (dx, dy) => dx < 0.45 && ((Math.round(dy * 33) % 8) + 8) % 8 === 0, 2);
  g.end();
  g.begin();                                             // bakben
  g.ell(34, -25, 20, 21, m); g.poly([[10, 0], [13, -11], [44, -11], [48, 0]], m, 3);
  for (const x of [10, 19, 28]) g.poly([[x + 2, 0], [x - 4, -1], [x + 2, -6]], C.bone, 4);
  g.end();
  // Hals och huvud: huvudet dras bakåt och kastas fram.
  const H = [-52 + max(0, -s) * 14 - max(0, s) * 18, -128 + br - max(0, -s) * 10 + max(0, s) * 16], N0 = [-6, -74], N1 = [-8, -122];
  g.begin();
  for (const u of [0.15, 0.35, 0.55, 0.75]) { const [x, y, tx, ty] = bez(N0, N1, [H[0] + 12, H[1] + 4], u), d = Math.hypot(tx, ty), nx = -ty / d, ny = tx / d, r = 17 - 6 * u; g.poly([[x + tx / d * 4 + nx * r * 0.6, y + ty / d * 4 + ny * r * 0.6], [x + nx * (r + 7), y + ny * (r + 7)], [x - tx / d * 4 + nx * r * 0.6, y - ty / d * 4 + ny * r * 0.6]], C.bone, 3); }
  tube(g, N0, N1, [H[0] + 12, H[1] + 4], 17, 11, m, 14);
  g.end();
  g.begin();                                             // framben
  tube(g, [-12, -52], [-28, -36], [-22, -9], 8.5, 6.5, m, 7); g.ell(-25, -5, 10, 5.4, m);
  for (const x of [-35, -29, -23]) g.poly([[x + 3, 0], [x - 3, -1], [x + 3, -6]], C.bone, 4);
  g.end();
  g.push(H[0], H[1], -s * 0.25, 1.25);
  const op = max(0, s) * 0.55 + (a > 0.05 ? 0.12 : 0.03);
  g.begin();                                             // horn, gap, underkäke
  g.poly([[4, -8], [22, -20], [31, -35], [20, -27], [8, -14]], C.bone, 3); g.poly([[10, -2], [28, -9], [39, -21], [26, -15], [12, -6]], C.bone, 2);
  g.poly([[2, 3], [-31, 1], [-31 * cos(op) + 2, 4 + 33 * sin(op)], [2, 9]], R('#7a1f2a'), 2);
  g.push(2, 6, -op); g.poly([[2, -2], [-30, 0], [-34, 4], [-30, 8], [-4, 10], [4, 6]], dk, 3);
  for (let x = -30; x < -8; x += 5) g.poly([[x, 0], [x + 1.5, -4], [x + 3, 0]], C.white, 5);
  g.pop(); g.end();
  g.begin();                                             // skalle och nos
  g.poly([[8, 4], [19, 10], [10, 13], [2, 10]], dk, 2); g.poly([[10, -3], [21, 2], [12, 6]], dk, 2);
  g.ell(0, 0, 14, 12, m);
  g.poly([[-6, -10], [-24, -8], [-34, -5], [-37, 1], [-33, 6], [-6, 8]], m, 3); g.ell(-31, -4, 5.5, 4.6, m); g.rect(-35, -5, 2, 2, C.dark, 0);
  for (let x = -32; x < -10; x += 5) g.poly([[x, 6], [x + 1.5, 10], [x + 3, 6]], C.white, 5);
  g.poly([[-17, -9], [-2, -14], [5, -8], [-4, -5]], dk, 2);
  eye(g, -14, -7, 7, 5, { shut, col: C.fire2, pw: 2, ph: 5, dx: 1, dy: 0, mood: 'arg', inner: -1, lid: dk });
  g.end();
  if (a > 0.5) {                                         // eldkvast
    const u = sin(((a - 0.5) / 0.5) * PI), L = u * 46, f = (i) => sin(t * 14 + i * 2.3) * 3;
    g.begin();
    g.poly([[-30, 3], [-52 - L, -12 + f(0)], [-46 - L, -2], [-62 - L, 5 + f(1)], [-46 - L, 11], [-54 - L, 24 + f(2)], [-30, 11]], C.fire, 4);
    g.poly([[-31, 5], [-44 - L * 0.7, -3 + f(1)], [-42 - L * 0.7, 4], [-52 - L * 0.7, 7 + f(2)], [-42 - L * 0.7, 10], [-44 - L * 0.7, 15 + f(0)], [-31, 9]], C.fire2, 5);
    g.end();
  } else if (a < 0.02) {                                 // rök ur näsborren
    g.begin(); for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.33) % 1; g.ell(-37 - ph * 5, -9 - ph * 16, 2 + ph * 2.5, 2 + ph * 2, C.smoke, false, null, 4 - Math.round(ph * 2)); } g.end({ outline: false, edge: false });
  }
  g.pop();
  g.pop();
}

// ---------- Sfinxen Gåtfull (Solöknen): överlägsen, halvslutna ögon, tasshugg och blick som lyser ----------
function sphinx(g, t, pose) {
  const { a, hu } = P(pose), m = R('#dcae62'), dk = R('#c08a44'), blue = R('#3f6fd0'), skin = R('#d99a5c'), s = strike(a), br = sin(t * 1.5), tw = sin(t * 1.8);
  const shut = hu > 0.3 || (t % 5) < 0.3, hy = -70 + (br > 0.3 ? 1 : 0) - max(0, -s) * 3;
  enter(g, hu, 1, 0.05);
  g.begin(); tube(g, [60, -22], [86, -30], [78 + tw * 2, -58 + tw * 3], 4, 3.4, m, 12, false, 3); g.ell(78 + tw * 3, -63 + tw * 3, 5.5, 6.5, dk); g.end();   // svans
  g.begin();                                             // vinge
  g.push(14, -42, -0.05 + sin(t * 1.2) * 0.04 - max(0, -s) * 0.35);
  g.poly([[0, 2], [8, -30], [28, -48], [54, -50], [45, -38], [58, -33], [47, -23], [56, -16], [43, -8], [48, 0], [20, 6]], C.gold, 3);
  g.poly([[4, 0], [12, -25], [28, -38], [42, -38], [35, -28], [43, -23], [35, -15], [39, -8], [20, 1]], R('#2fa6a0'), 3);
  g.poly([[7, -2], [14, -19], [25, -27], [22, -15], [27, -10], [17, -2]], C.red, 3);
  g.pop(); g.end();
  g.begin();                                             // bakkropp
  g.ell(24, -26 - br * 0.4, 40, 20 + br * 0.4, m, 1.2); g.ell(46, -22, 20, 21, m, 1.2); g.ell(46, -22, 20, 21, m, false, (dx, dy, d2) => d2 > 0.8 && dx < -0.2 && dy < 0.5, 2);
  g.poly([[24, 0], [27, -10], [60, -10], [65, 0]], m, 3); for (const x of [30, 36]) g.rect(x, -5, 1, 5, m, 1);
  g.end();
  g.begin(); g.poly([[-18, -17], [-52, -14], [-61, -9], [-62, 0], [-18, 0]], m, 2); for (const x of [-57, -52]) g.rect(x, -6, 1, 6, m, 1); g.end();   // bortre framtass
  g.begin();                                             // bröst med halskrage
  g.ell(-12, -36, 17, 24, m, 1.2);
  g.ell(-13, -50, 15, 9, blue, false, (dx, dy) => dy > -0.1, 3); g.ell(-13, -50, 15, 9, C.gold, false, (dx, dy, d2) => dy > -0.1 && d2 > 0.35 && d2 < 0.68, 4);
  g.end();
  g.begin();                                             // huvudduk, bakre delen i ränder
  const XR = [-2, 3, 6, 7, 8, 8, 9, 9, 9, 9, 8];
  for (let i = 0; i < 10; i++) { const y0 = hy - 17 + i * 4, xl = i < 6 ? -28 : -7; g.poly([[xl, y0], [XR[i], y0], [XR[i + 1], y0 + 4], [xl, y0 + 4]], i % 2 ? blue : C.gold, 3); }
  g.end();
  g.begin();                                             // ansikte
  g.ell(-16, hy, 12, 13, skin, 0.9);
  g.ell(-16, hy - 2, 13.4, 13.6, C.gold, true, (dx, dy) => dy < -0.5); g.ell(-16, hy - 2, 13.4, 13.6, blue, false, (dx, dy) => dy < -0.66 && dy > -0.8, 3);
  g.poly([[-27, hy - 8], [-31, hy - 16], [-26, hy - 14], [-24, hy - 8]], C.gold, 5); g.dot(-29, hy - 14, C.red, 4);
  if (a > 0.05 && !shut) { g.rect(-26, hy - 3, 5, 3, C.ice, 5); g.rect(-17, hy - 3, 5, 3, C.ice, 5); }
  else { eye(g, -26, hy - 3, 5, 4, { shut, mood: 'lomsk', lid: skin, pw: 2, ph: 3 }); eye(g, -17, hy - 3, 5, 4, { shut, mood: 'lomsk', lid: skin, pw: 2, ph: 3 }); }
  g.rect(-27, hy - 4, 7, 1, C.dark, 0); g.rect(-18, hy - 4, 7, 1, C.dark, 0); g.rect(-12, hy - 2, 3, 1, C.dark, 0);
  g.rect(-24, hy + 3, 2, 3, skin, 2); g.rect(-25, hy + 8, 6, 1, C.dark, 0); g.dot(-19, hy + 7, C.dark, 0);
  g.poly([[-23, hy + 12], [-18, hy + 12], [-19, hy + 22], [-22, hy + 22]], blue, 3); for (const y of [14, 17, 20]) g.rect(-23, hy + y, 5, 1, C.gold, 3);
  for (let i = 0; i < 6; i++) g.rect(-34, hy + 2 + i * 4, 7, 4, i % 2 ? C.gold : blue, 3);
  g.end();
  g.begin();                                             // närmre framtass: lyfts och slår
  g.push(-8, -10, max(0, -s) * 0.5 - max(0, s) * 0.05);
  g.poly([[8, -7], [-40, -5], [-50, -1], [-52, 6], [-48, 10], [8, 10]], m, 3); for (const x of [-47, -42, -37]) g.rect(x, 3, 1, 7, m, 1);
  g.pop(); g.end();
  if (a > 0.45) {                                        // blicken
    const u = sin(((a - 0.45) / 0.55) * PI), L = u * 44;
    g.begin(); g.thick(-27, hy - 1, -27 - L, hy + 4 + L * 0.3, 3, C.ice, 5); g.thick(-18, hy - 1, -27 - L, hy + 8 + L * 0.3, 2, C.ice, 4); g.end({ edge: false });
  }
  g.pop();
}

// ---------- Slemkungen Blubb (Svampträsket): har svalt bokstäver, slår med slemnäve ----------
function slimeking(g, t, pose) {
  const { a, hu } = P(pose), m = R('#57c26a'), s = strike(a), j = sin(t * 2.6);
  const ry = 34 + j * 1.5 + s * 8 - hu * 4, rx = 46 - j - s * 5 + hu * 3, top = -ry * 1.72, shut = hu > 0.3 || blinkAt(t, 4), ey = -ry * 1.05;
  enter(g, hu, 1, 0.03);
  g.begin();                                             // krona (sjunker ner i slemmet)
  g.push(6, top + 3, 0.16 + j * 0.03);
  g.rect(-14, -8, 28, 9, C.gold, 3); for (const x of [-14, -4, 6]) g.poly([[x, -8], [x + 4, -18], [x + 8, -8]], C.gold, 4);
  g.rect(-11, -5, 3, 3, C.red, 4); g.rect(-1, -5, 3, 3, C.ice, 4); g.rect(9, -5, 3, 3, C.red, 4); for (const x of [-10, 0, 10]) g.dot(x, -19, C.white, 5);
  g.pop(); g.end();
  // Slemarm: vilar som en liten knöl, lyfts högt och smäller ner.
  const idle = [-rx - 5, -22 + j * 2], fist = s < 0 ? lerp(idle, [-rx - 6, -70], -s / 0.6) : lerp(idle, [-rx - 30, -9], s);
  g.begin(); tube(g, [-rx + 10, -16], [(-rx + 10 + fist[0]) / 2 - 8, min(-16, fist[1]) - 12], fist, 9, 7.5, m, 9); g.ell(fist[0], fist[1], 9.5, 8.5, m); g.ell(rx - 3, -20 - j, 8, 7, m); g.end();
  g.begin();                                             // kropp
  for (const x of [-rx - 1, -20, 14, rx - 2]) g.ell(x, -4.5, 8, 5, m, false, (dx, dy) => dy < 0.85, 2);
  g.ell(0, -8, rx + 4, 10, m, false, (dx, dy) => dy < 0.78, 2);
  g.ell(0, -ry * 0.72, rx, ry, m, true, (dx, dy) => dy < 0.72);
  g.ell(-rx * 0.52, top + ry * 0.36, 7, 4, C.white, false, null, 5); g.rect(-rx * 0.52 + 9, top + ry * 0.3, 3, 2, C.white, 5);
  g.end();
  g.begin();                                             // det han har svalt: ben och bokstäver, anade genom slemmet
  const d = sin(t * 1.3) * 2;
  g.push(22, -24 + d, 0.6 + sin(t * 0.7) * 0.3); g.rect(-7, -1.5, 14, 3, m, 5); for (const [x, y] of [[-7, -2], [-7, 2], [7, -2], [7, 2]]) g.ell(x, y, 2.4, 2.4, m, false, null, 5); g.pop();
  glyph(g, 4, -20 - d, LETTER_A, m, 5, 2); glyph(g, 27, -44 + d, LETTER_Z, m, 5, 2);
  for (let i = 0; i < 4; i++) { const ph = (t * 0.4 + i * 0.27) % 1; g.ell(-12 + i * 13, -10 - ph * 34, 2.2, 2.2, m, false, (dx, dy, d2) => d2 > 0.35, 5); }
  g.end({ outline: false, edge: false });
  g.begin();                                             // ansikte: glad och lite korkad
  eye(g, -34, ey, 10, 10, { shut, pw: 4, ph: 4, dx: 1, dy: 5 }); eye(g, -17, ey + 1, 10, 10, { shut, pw: 4, ph: 4, dx: 0, dy: 3 });
  const my = ey + 15, mo = 5 + (a > 0.05 ? 3 + bump(a) * 5 : j);
  g.poly([[-36, my], [-6, my], [-10, my + mo], [-32, my + mo]], C.dark, 0);
  g.ell(-20, my + mo - 1, 7, 2.5, C.pink, false, (dx, dy) => dy < 0.3, 3); g.rect(-30, my, 4, 3, C.white, 5); g.rect(-17, my, 4, 3, C.white, 5);
  g.end();
  g.pop();
}

// ---------- Isdrottningen Frostina (Frostbergen): högdragen, kastar isskärvor ----------
function icequeen(g, t, pose) {
  const { a, hu } = P(pose), dress = R('#6fb8ee'), dk = R('#3f6fb8'), skin = R('#d6e8f6'), hair = R('#f2f7ff'), s = strike(a), b = step(t, 2), f = sin(t * 2.2);
  const shut = hu > 0.3 || blinkAt(t, 2), Y = -70 + b;
  enter(g, hu, 1, 0.08);
  g.begin();                                             // mantel och hår bakom
  g.poly([[4, -62 + b], [14, -58], [25 + f * 2, -22], [32 + f * 3, -2], [19, -5], [10, -2]], dk, 2);
  g.poly([[25 + f * 2, -22], [32 + f * 3, -2], [19, -5], [22 + f, -10]], C.snow, 3);
  g.poly([[2, Y - 9], [10, Y - 5], [16 + f, Y + 14], [21 + f * 2, Y + 30], [14 + f * 2, Y + 36], [12 + f, Y + 24], [6, Y + 18], [4, Y + 6]], hair, 3);
  g.end();
  g.begin();                                             // iskrage: solfjäder av istappar
  for (let i = 0; i < 6; i++) { if (i === 2 || i === 3) continue; const an = -PI + 0.35 + i * 0.49, L = i === 0 || i === 5 ? 15 : 21, c = cos(an), sn = sin(an); g.poly([[-sn * 3.2, -61 + b + c * 3.2], [c * L, -61 + b + sn * L], [sn * 3.2, -61 + b - c * 3.2]], C.ice, i < 3 ? 5 : 4); }
  g.end();
  g.begin();                                             // klänning
  g.poly([[-6, -46], [7, -46], [13, -30], [21, -2], [20, 0], [-19, 0], [-20, -2], [-12, -30]], dress, 3);
  g.poly([[-2, -44], [0, -44], [-4, -3], [-9, -3]], dress, 2); g.poly([[5, -44], [7, -44], [15, -3], [10, -3]], dress, 2);
  g.rect(-20, -3, 41, 3, C.snow, 4);
  for (const [x, y] of [[-9, -20], [3, -13], [11, -23], [-3, -32], [-13, -10], [16, -9]]) { g.dot(x, y, C.white, 5); g.dot(x - 1, y, C.ice, 5); g.dot(x + 1, y, C.ice, 5); g.dot(x, y - 1, C.ice, 5); g.dot(x, y + 1, C.ice, 5); }
  g.end();
  g.begin();                                             // liv och armen på höften
  g.thick(8, -60 + b, 14, -51, 3.4, dress, 2); g.thick(14, -51, 8, -46, 3, dress, 2);
  g.poly([[-8, -62 + b], [8, -62 + b], [6, -46], [-5, -46]], dk, 3); g.rect(-6, -48, 12, 2, C.steel, 4); g.rect(-2, -58 + b, 3, 3, C.ice, 5);
  g.ell(-8, -61 + b, 4, 3.4, C.snow); g.ell(8, -61 + b, 4, 3.4, C.snow);
  g.end();
  const hx = -17 - max(0, s) * 5, hyy = -52 + b + min(0, s) * 12;
  g.begin();                                             // stav
  g.push(hx, hyy, -0.08 - max(0, s) * 0.75 + max(0, -s) * 0.25);
  g.poly([[-1, 48], [1, 48], [1, -30], [-1, -30]], C.steel, 3);
  g.poly([[-1, -28], [-6, -36], [-4, -30]], C.steel, 4); g.poly([[1, -28], [6, -36], [4, -30]], C.steel, 2);
  g.poly([[0, -46], [5, -37], [0, -29], [-5, -37]], C.ice, 5); g.poly([[0, -46], [5, -37], [0, -37]], C.ice, 3); g.dot(-2, -39, C.white, 5);
  g.pop(); g.end();
  g.begin(); g.thick(-7, -59 + b, hx, hyy, 3.4, dress, 3); g.ell(hx, hyy, 2.6, 2.6, skin, 0.75); g.end();
  g.begin();                                             // huvud
  g.ell(-1, Y, 7, 7.5, skin, 0.75);
  g.ell(-1, Y, 7.9, 8.4, hair, true, (dx, dy) => dy < -0.45 || (dx > 0.3 && dy < 0.85));
  eye(g, -6, Y - 1, 3, 3, { shut, mood: 'lomsk', lid: dress, pw: 1, ph: 2 }); eye(g, -1, Y - 1, 3, 3, { shut, mood: 'lomsk', lid: dress, pw: 1, ph: 2 });
  g.line(-7, Y - 3, -4, Y - 3, skin, 1); g.line(-2, Y - 3, 1, Y - 3, skin, 1);
  g.rect(-4, Y + 4, 3, 1, dk, 2); g.dot(4, Y + 3, C.ice, 5);
  g.end();
  g.begin();                                             // iskrona
  g.rect(-7, Y - 9, 13, 2, C.ice, 3); for (const [x, hh] of [[-7, 5], [-4, 8], [-1, 13], [2, 8], [5, 5]]) g.poly([[x - 1, Y - 8], [x + 0.5, Y - 8 - hh], [x + 2, Y - 8]], C.ice, 5);
  g.end();
  if (a > 0.45) {                                        // isskärvor ur kristallen
    const u = (a - 0.45) / 0.55, rot = -0.08 - max(0, s) * 0.75, gx = hx + 38 * sin(rot), gy = hyy - 38 * cos(rot);
    g.begin(); for (let i = 0; i < 3; i++) { const x = gx - 6 - u * 56 - i * 7, y = gy + (i - 1) * 15 * u + u * 12; g.poly([[x, y], [x + 11, y - 3.5], [x + 20, y], [x + 11, y + 3.5]], C.ice, 5); g.poly([[x + 3, y], [x + 11, y - 1], [x + 17, y]], C.white, 5); } g.end();
  } else if (a < 0.02) {                                 // snöglitter runt staven
    g.begin(); for (let i = 0; i < 5; i++) { const ph = (t * 0.6 + i * 0.21) % 1; g.rect(-30 + i * 6 + sin(t * 2 + i) * 3, -96 + ph * 30, 1, 1, C.white, 5); } g.end({ outline: false, edge: false });
  }
  g.pop();
}

// ---------- Lavagolemen Magmus (Meningsvulkanen): höjer båda nävarna och dunkar ----------
function lavagolem(g, t, pose) {
  const { a, hu } = P(pose), m = R('#574a5c'), lava = C.fire, hot = C.fire2, s = strike(a), br = step(t, 1.4), pulse = sin(t * 3) > 0 ? 5 : 4, fl = (i) => sin(t * 10 + i * 2.1) * 2.5;
  const shut = hu > 0.3;
  const arm = (lv, i) => {
    g.poly([[-6, -8], [-4, -18 + fl(i)], [0, -12], [3, -21 + fl(i + 1)], [7, -9]], lava, 4);
    g.poly([[-9, 4], [9, 2], [11, 30], [-10, 30]], m, lv - 1); g.rect(-9, 28, 20, 3, hot, pulse);
    g.poly([[-14, 31], [13, 31], [17, 50], [10, 62], [-10, 63], [-18, 52]], m, lv);
    g.line(-9, 42, -3, 49, hot, 5); g.line(-3, 49, 4, 45, hot, 5); g.line(4, 45, 9, 52, hot, 4); g.rect(-15, 54, 28, 1, m, lv - 2);
    g.ell(0, 0, 14, 12, m);
  };
  g.push(hu * 2, 0, hu * 0.06 - max(0, s) * 0.06, 1);
  g.begin(); g.push(-36, -72 + br, 0.1 + (s < 0 ? -s * 4 : s * 0.4)); arm(3, 0); g.pop(); g.end();
  g.begin();                                             // ben och höft
  g.poly([[-26, -20], [-6, -20], [-3, 0], [-30, 0]], m, 2); g.poly([[6, -20], [27, -20], [31, 0], [3, 0]], m, 3);
  g.poly([[-24, -32], [26, -34], [22, -18], [-20, -18]], m, 2);
  g.rect(-28, -8, 24, 2, hot, pulse); g.rect(4, -8, 26, 2, lava, pulse);
  g.end();
  g.begin();                                             // bål med glödande kärna
  g.poly([[-32, -80 + br], [-6, -90 + br], [24, -86 + br], [40, -62], [32, -30], [-24, -28], [-38, -54]], m, 3);
  g.poly([[-30, -79 + br], [-6, -88 + br], [22, -84 + br], [14, -72], [-18, -68]], m, 4);
  g.poly([[-35, -50], [-24, -30], [30, -32], [35, -46], [0, -40]], m, 2);
  g.ell(-4, -56, 11, 10, lava); g.ell(-5, -57, 6, 5.5, hot, false, null, pulse);
  for (const [x0, y0, x1, y1] of [[-14, -62, -24, -70], [6, -52, 16, -46], [16, -46, 23, -51], [-8, -46, -13, -36], [5, -64, 13, -72], [13, -72, 12, -78]]) g.line(x0, y0, x1, y1, hot, 5);
  g.end();
  g.begin();                                             // huvud
  const hy = br;
  g.poly([[-14, -100 + hy], [-12, -108 + hy + fl(2)], [-8, -103 + hy], [-4, -112 + hy + fl(3)], [0, -103 + hy], [3, -107 + hy + fl(4)], [5, -98 + hy]], lava, 4);
  g.poly([[-24, -86 + hy], [-20, -100 + hy], [-4, -104 + hy], [8, -96 + hy], [8, -82 + hy], [-6, -76 + hy], [-20, -78 + hy]], m, 3);
  g.poly([[-19, -99 + hy], [-4, -102 + hy], [5, -96 + hy], [-12, -94 + hy]], m, 4);
  if (shut) { g.rect(-21, -90 + hy, 8, 1, C.dark, 0); g.rect(-9, -90 + hy, 8, 1, C.dark, 0); }
  else { g.poly([[-22, -94 + hy], [-13, -91 + hy], [-13, -87 + hy], [-22, -88 + hy]], hot, 5); g.poly([[-9, -91 + hy], [0, -94 + hy], [0, -88 + hy], [-9, -87 + hy]], hot, 5); }
  const mo = a > 0.05 ? 2 + bump(a) * 3 : 0;
  g.poly([[-20, -84 + hy], [-17, -82 + hy], [-14, -85 + hy], [-11, -82 + hy], [-8, -85 + hy], [-5, -82 + hy], [-2, -85 + hy], [-2, -80 + hy + mo], [-20, -80 + hy + mo]], lava, pulse);
  g.end();
  g.begin(); g.push(36, -72 + br, -0.1 + (s < 0 ? s * 2.4 : s * 0.3)); arm(4, 2); g.pop(); g.end();
  g.pop();
  if (a > 0.6) {                                         // stötvåg av lava längs marken
    const u = (a - 0.6) / 0.4, x = -62 - u * 40, hgt = sin(u * PI) * 16;
    g.begin(); g.poly([[x + 16, 0], [x + 10, -hgt * 0.5], [x + 5, -2], [x, -hgt], [x - 5, -3], [x - 10, -hgt * 0.6], [x - 16, 0]], lava, 4); g.poly([[x + 6, 0], [x, -hgt * 0.6], [x - 6, 0]], hot, 5); g.end();
  }
}

// ---------- Stormkungen Åskar (Molnslottet): skäggig molnkung som kastar blixtar ----------
function stormking(g, t, pose) {
  const { a, hu } = P(pose), skin = R('#86a8dc'), cl = R('#7a84a8'), beard = C.snow, s = strike(a), br = sin(t * 1.7), hov = 5 + sin(t * 1.3) * 2;
  const shut = hu > 0.3 || blinkAt(t, 6), hy = -84 - br * 0.5, sway = sin(t * 2) * 1;
  const hand = s < 0 ? lerp([-38, -80], [-28, -100], -s / 0.6) : lerp([-38, -80], [-54, -58], s), thrown = a > 0.55;
  g.push(hu * 2, -hov, hu * 0.07, 1);
  if (!thrown) {                                         // blixten i handen
    g.begin(); g.push(hand[0], hand[1], -0.15 - s * 0.5);
    g.poly([[4, -34], [-9, -4], [-2, -4], [-7, 30], [12, -11], [4, -11], [13, -34]], C.fire2, step(t, 14) ? 5 : 4);
    g.pop(); g.end();
  }
  g.begin(); tube(g, [-22, -66], [-40, -58], hand, 8.5, 6.5, skin, 7); g.ell(hand[0], hand[1], 6.5, 6.5, skin); g.end();
  g.begin();                                             // molnbas
  [[-42, -17, 10, 8], [44, -19, 10, 8], [-28, -12, 17, 12], [28, -12, 18, 12], [14, -27, 17, 11], [-14, -26, 16, 11], [0, -10, 24, 13]].forEach(([x, y, rx, ry], i) => g.ell(x + sin(t * 1.2 + i * 1.9) * 1.5, y + cos(t * 1.5 + i) * 1.2, rx, ry, cl));
  g.end();
  g.begin();                                             // bål
  g.ell(0, -50 - br * 0.5, 25, 24, skin, 1.3);
  g.poly([[6, -74], [24, -66], [22, -40], [-6, -29], [-24, -38]], C.snow, 3); g.line(10, -66, -14, -38, C.snow, 1); g.line(18, -60, -4, -34, C.snow, 1);
  g.rect(-16, -56, 9, 1, skin, 2); g.rect(-13, -48, 7, 1, skin, 2);
  g.ell(-22, -66, 10, 9, skin); g.ell(22, -66, 10.5, 9.5, skin); g.rect(18, -70, 9, 2, C.gold, 4);
  g.end();
  g.begin(); tube(g, [25, -64], [42, -52], [29, -38], 8.5, 7, skin, 7); g.ell(28, -37, 7, 6.5, skin); g.rect(31, -47, 9, 3, C.gold, 3); g.end();   // näven i sidan
  g.begin();                                             // huvud
  g.ell(9, hy + 2, 8, 10, beard); g.ell(-3, hy, 13, 13, skin, 0.9);
  g.poly([[-13, hy - 1], [-19, hy + 3], [-12, hy + 5]], skin, 4);
  eye(g, -13, hy - 5, 4, 4, { shut, mood: 'arg', inner: 1, pw: 2, ph: 2, dy: 2 }); eye(g, -5, hy - 5, 4, 4, { shut, mood: 'arg', inner: -1, pw: 2, ph: 2, dy: 2 });
  g.thick(-15, hy - 9, -9, hy - 6, 3, beard, 4); g.thick(-6, hy - 6, 2, hy - 9, 3, beard, 3);
  g.end();
  g.begin();                                             // skägg och mustasch
  g.ell(-10, hy + 10, 9, 7, beard); g.ell(0, hy + 10, 9, 7, beard); g.ell(-6, hy + 17 + sway, 8, 7, beard); g.ell(-8, hy + 24 + sway, 5, 5, beard);
  if (a > 0.05) g.ell(-10, hy + 8, 3.5, 2 + bump(a) * 2, C.dark, false, null, 0);
  g.ell(-14, hy + 4.5, 5, 2.6, beard); g.ell(-5, hy + 5, 5.5, 2.6, beard);
  g.end();
  g.begin();                                             // krona
  g.rect(-14, hy - 16, 21, 5, C.gold, 3); for (const x of [-14, -8.5, -3, 2.5]) g.poly([[x, hy - 16], [x + 2.2, hy - 23], [x + 4.5, hy - 16]], C.gold, 4);
  g.rect(-11, hy - 14, 2, 2, C.ice, 5); g.rect(-5, hy - 14, 2, 2, C.red, 4); g.rect(1, hy - 14, 2, 2, C.ice, 5);
  g.end();
  if (thrown) {                                          // kastad blixt i sicksack
    const u = (a - 0.55) / 0.45, n = 2 + Math.floor(u * 6);
    const pts = [[hand[0] - 5, hand[1] + 4]];
    for (let i = 0; i < n; i++) { const p = pts[i]; pts.push([p[0] + (i % 2 ? 5 : -20), p[1] + (i % 2 ? 1 : 15)]); }
    g.begin();
    for (let i = 0; i < n; i++) g.thick(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 6 - i * 0.4, C.fire2, 4);
    for (let i = 0; i < n; i++) g.thick(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], 2, C.white, 5);
    g.end();
  }
  g.pop();
}

// ---------- Skuggriddaren (Molnslottet): hornhjälm, röda ögon, storsvärd med lila glöd ----------
function shadowknight(g, t, pose) {
  const { a, hu } = P(pose), m = R('#4f4488'), dk = R('#352f5e'), glow = R('#c66bff'), ec = R('#ff5a6a'), cape = R('#8a2342'), s = strike(a), b = step(t, 2), f = sin(t * 2.4);
  const shut = hu > 0.3, Y = -58 + b;
  const ang = -0.35 + (s < 0 ? -s * 1.9 : -s * 1.6), hand = s < 0 ? lerp([-20, -36 + b], [-15, -52], -s / 0.6) : lerp([-20, -36 + b], [-27, -34], s);
  enter(g, hu, 1, 0.1);
  g.begin(); for (let i = 0; i < 6; i++) { const ph = (t * 0.7 + i * 0.19) % 1; g.rect(-16 + i * 6 + sin(t * 2 + i) * 2, -1 - ph * 12, ph < 0.5 ? 2 : 1, ph < 0.5 ? 2 : 1, glow, ph < 0.5 ? 2 : 1); } g.end({ outline: false, edge: false });
  g.begin();                                             // mantel
  g.poly([[5, -52 + b], [14, -50 + b], [25 + f * 2, -30], [35 + f * 3, -10], [28 + f * 2, -13], [30 + f * 2, -2], [22 + f, -7], [19, 0], [12, -7], [8, -2], [4, -20]], cape, 2);
  g.end();
  g.begin(); g.thick(-10, -47 + b, hand[0], hand[1], 5.5, m, 2); g.end();   // svärdsarm
  g.begin();                                             // storsvärd
  g.push(hand[0], hand[1], ang);
  g.poly([[-3.5, -6], [3.5, -6], [4, -40], [0, -48], [-4, -40]], R('#7868b8'), 4); g.poly([[-0.8, -8], [0.8, -8], [0.8, -41], [-0.8, -41]], glow, 5);
  g.poly([[-10, -9], [-6, -6], [6, -6], [10, -9], [9, -4], [-9, -4]], m, 4); g.rect(-1.5, -4, 3, 9, C.dark, 2); g.ell(0, 6, 2.6, 2.6, glow);
  g.pop(); g.end();
  g.begin(); g.ell(hand[0], hand[1], 3.4, 3.4, dk); g.end();
  g.begin();                                             // ben
  g.rect(-10, -25, 8, 18, m, 2); g.rect(2, -25, 8, 18, m, 3);
  g.poly([[-13, 0], [-12, -9], [-2, -9], [-1, 0]], m, 2); g.poly([[1, 0], [2, -9], [12, -9], [14, 0]], m, 3);
  g.poly([[-10, -17], [-14, -22], [-6, -19]], m, 5); g.poly([[2, -17], [-1, -22], [6, -19]], m, 5);
  g.poly([[-11, -29], [11, -29], [12, -20], [5, -23], [0, -18], [-5, -23], [-12, -20]], dk, 3);
  g.end();
  g.begin();                                             // bål
  g.poly([[-12, -50 + b], [12, -50 + b], [10, -27], [-10, -27]], m, 3); g.ell(0, -41 + b, 11, 9, m);
  g.poly([[-3, -44 + b], [0, -49 + b], [3, -44 + b], [0, -36 + b]], glow, step(t, 3) ? 5 : 4); g.rect(-10, -29, 20, 2, C.dark, 1);
  g.poly([[-15, -53 + b], [-20, -60 + b], [-11, -55 + b]], m, 5); g.ell(-12, -49 + b, 6.5, 5.5, m);
  g.end();
  g.begin();                                             // hjälm
  g.poly([[-6, Y - 5], [-12, Y - 8], [-15, Y - 19], [-10, Y - 12], [-4, Y - 8]], C.bone, 3); g.poly([[5, Y - 5], [11, Y - 8], [14, Y - 19], [9, Y - 12], [3, Y - 8]], C.bone, 2);
  g.ell(-0.5, Y, 8, 8.5, m);
  g.poly([[-9, Y - 3], [2, Y - 3], [1, Y + 1], [-8, Y + 1]], C.dark, 0); g.rect(-5, Y + 1, 2, 5, C.dark, 0);
  if (!shut) { g.rect(-8, Y - 2, 2, 2, ec, 5); g.rect(-3, Y - 2, 2, 2, ec, 5); }
  g.rect(-1, Y - 11, 2, 5, m, 5);
  g.end();
  g.begin();                                             // närmre arm och axelskydd
  g.thick(12, -46 + b, 15, -35 + b, 5.5, m, 3); g.ell(15, -32 + b, 3.6, 3.6, dk);
  g.poly([[14, -53 + b], [21, -60 + b], [18, -50 + b]], m, 5); g.ell(12, -49 + b, 7, 6, m);
  g.end();
  if (s > 0.15) {                                        // svärdsbågen
    g.begin(); g.ell(-24, -38, 36, 40, glow, false, (dx, dy, d2) => d2 > 0.7 && dx < -0.25 && dy > -0.85 + (1 - s) * 0.8 && dy < 0.8, 4); g.ell(-24, -38, 36, 40, C.white, false, (dx, dy, d2) => d2 > 0.9 && dx < -0.4 && dy > -0.6 + (1 - s) * 0.8 && dy < 0.6, 5); g.end({ outline: false, edge: false });
  }
  g.pop();
}


// ====================================================================================================
// ROSTER
// ====================================================================================================
const E = (id, name, world, tier, h, w, draw, extra = {}) => ({ id, name, world, tier, h, w, count: 1, fly: false, draw, ...extra });

export const ROSTER = [
  // ----- 0 Ordskogen -----
  E('kladdis', 'Kladdis', 0, 1, 23, 26, (g, t, p) => slime(g, t, p, { hex: '#6fcf5a', kind: 'leaf' })),
  E('goblingang', 'Goblingänget', 0, 1, 19, 25, (g, t, p) => goblin(g, t, p, { k: 0.8 }), { count: 5 }),
  E('fladdris', 'Fladdermusen Flax', 0, 1, 36, 40, (g, t, p) => bat(g, t, p, { hex: '#7a5ab0', k: 1.15, hov: 18 }), { fly: true }),
  E('sursvamp', 'Sursvampen', 0, 2, 27, 34, (g, t, p) => mushroom(g, t, p, { hex: '#d8433b', k: 1.25 })),
  E('trassel', 'Spindeln Trassel', 0, 2, 20, 51, (g, t, p) => spider(g, t, p, { hex: '#5a4a78', k: 1.2, long: 1.15, thick: 1, mark: 1 })),
  E('morr', 'Gråvargen Morr', 0, 3, 36, 60, (g, t, p) => wolf(g, t, p, { hex: '#8f95a8', k: 1.05 })),
  E('mossis', 'Stengolemen Mossis', 0, 3, 78, 74, (g, t, p) => golem(g, t, p, { hex: '#8d8a80', glow: '#d6f25a', moss: 1 })),
  // ----- 1 Solöknen -----
  E('stick', 'Kaktusen Stick', 1, 1, 34, 31, (g, t, p) => cactus(g, t, p, {})),
  E('skarabeer', 'Skarabéligan', 1, 1, 9, 18, (g, t, p) => beetle(g, t, p, { hex: '#2f9fb0' }), { count: 6 }),
  E('nyp', 'Skorpionen Nyp', 1, 1, 26, 48, (g, t, p) => scorpion(g, t, p, { k: 1.1 })),
  E('turbangoblin', 'Turbangoblinen Sabel', 1, 2, 37, 40, (g, t, p) => goblin(g, t, p, { k: 1.3, turban: 1, skin: '#b9a24a', cloth: '#7a4fb0' })),
  E('vas', 'Kobran Väs', 1, 2, 37, 45, (g, t, p) => snake(g, t, p, { hex: '#c9a03a', belly: '#f2e2a0', k: 1.1 })),
  E('skramlis', 'Skramlis', 1, 2, 43, 38, (g, t, p) => skeleton(g, t, p, {})),
  E('snubbel', 'Mumien Snubbel', 1, 3, 51, 41, (g, t, p) => mummy(g, t, p, { k: 1.05 })),
  // ----- 2 Svampträsket -----
  E('geggis', 'Geggis', 2, 1, 27, 32, (g, t, p) => slime(g, t, p, { hex: '#9aa83a', kind: 'swamp', k: 1.2 })),
  E('plask', 'Paddan Plask', 2, 1, 21, 30, (g, t, p) => frog(g, t, p, { k: 1.1 })),
  E('smakryp', 'Småkrypen', 2, 1, 10, 22, (g, t, p) => spider(g, t, p, { hex: '#7a4a8a', k: 0.6, long: 0.75, cute: 1 }), { count: 6 }),
  E('klo', 'Dykrabban Klo', 2, 2, 24, 58, (g, t, p) => crab(g, t, p, { hex: '#5f9a8a', kind: 'moss', k: 1.1 })),
  E('fnys', 'Giftsvampen Fnys', 2, 2, 43, 30, (g, t, p) => mushroom(g, t, p, { hex: '#8a4fc0', tall: 1, k: 1.15 })),
  E('glufs', 'Glufsblomman', 2, 2, 47, 45, (g, t, p) => plant(g, t, p, { hex: '#d8433b', k: 1.1 })),
  E('irrbloss', 'Irrblosset', 2, 3, 42, 32, (g, t, p) => ghost(g, t, p, { hex: '#8fe8b0', kind: 'wisp', k: 1.1, hov: 9 }), { fly: true }),
  // ----- 3 Frostbergen -----
  E('isbiten', 'Isbiten', 3, 1, 25, 26, (g, t, p) => slime(g, t, p, { hex: '#74d3f7', kind: 'ice', k: 1.1 })),
  E('pingviner', 'Pingvinpatrullen', 3, 1, 31, 26, (g, t, p) => penguin(g, t, p, {}), { count: 3 }),
  E('morot', 'Snögubben Morot', 3, 2, 45, 40, (g, t, p) => snowman(g, t, p, {})),
  E('istand', 'Isvargen Tand', 3, 2, 40, 69, (g, t, p) => wolf(g, t, p, { hex: '#b8d4ee', kind: 'ice', k: 1.2 })),
  E('viking', 'Frusna Vikingen', 3, 3, 56, 51, (g, t, p) => skeleton(g, t, p, { hex: '#cfe3ee', viking: 1, k: 1.15 })),
  E('gasp', 'Yetin Gäsp', 3, 3, 66, 65, (g, t, p) => yeti(g, t, p, {})),
  // ----- 4 Meningsvulkanen -----
  E('lavaklick', 'Lavaklicken', 4, 1, 30, 36, (g, t, p) => slime(g, t, p, { hex: '#d8502a', kind: 'lava', k: 1.35 })),
  E('glodfladdror', 'Glödfladdrorna', 4, 1, 28, 30, (g, t, p) => bat(g, t, p, { hex: '#c0462a', fire: 1, k: 0.85, hov: 14 }), { count: 4, fly: true }),
  E('busimp', 'Busimpen', 4, 2, 37, 41, (g, t, p) => imp(g, t, p, { hex: '#d8433b', k: 1.2 })),
  E('magmakrabba', 'Magmakrabban', 4, 2, 40, 73, (g, t, p) => crab(g, t, p, { hex: '#7a5a62', kind: 'magma', belly: '#f08a2a', k: 1.4 })),
  E('fras', 'Eldanden Fräs', 4, 2, 41, 35, (g, t, p) => flame(g, t, p, { k: 1.25, hov: 5 }), { fly: true }),
  E('glodhund', 'Glödhunden', 4, 3, 44, 77, (g, t, p) => wolf(g, t, p, { hex: '#5f4650', kind: 'fire', k: 1.3 })),
  // ----- 5 Molnslottet -----
  E('stjarnskott', 'Stjärnskotten', 5, 1, 23, 23, (g, t, p) => star(g, t, p, {}), { count: 5, fly: true }),
  E('surmoln', 'Surmolnet', 5, 1, 40, 41, (g, t, p) => cloud(g, t, p, { k: 1.1 }), { fly: true }),
  E('kikaroga', 'Kikarögat', 5, 2, 31, 40, (g, t, p) => eyeball(g, t, p, {}), { fly: true }),
  E('bu', 'Slottsspöket Bu', 5, 2, 47, 36, (g, t, p) => ghost(g, t, p, { hex: '#e4ecff', kind: 'castle', k: 1.3, hov: 9 }), { fly: true }),
  E('grus', 'Gargoylen Grus', 5, 2, 63, 71, (g, t, p) => imp(g, t, p, { hex: '#8a8fa0', fly: 1, k: 1.4 }), { fly: true }),
  E('rostis', 'Rostiga Riddaren', 5, 3, 59, 53, (g, t, p) => knight(g, t, p, { k: 1.1 })),
  // ----- Bossar -----
  E('glomsk', 'Trollet Glömsk', 0, 'boss', 171, 121, troll),
  E('gatfull', 'Sfinxen Gåtfull', 1, 'boss', 96, 150, sphinx),
  E('blubb', 'Slemkungen Blubb', 2, 'boss', 79, 116, slimeking),
  E('frostina', 'Isdrottningen Frostina', 3, 'boss', 99, 67, icequeen),
  E('magmus', 'Lavagolemen Magmus', 4, 'boss', 113, 119, lavagolem),
  E('punktum', 'Draken Punktum', 4, 'boss', 174, 223, dragon),
  E('askar', 'Stormkungen Åskar', 5, 'boss', 123, 109, stormking, { fly: true }),
  E('skuggriddaren', 'Skuggriddaren', 5, 'boss', 82, 76, shadowknight),
];
export const BY_ID = Object.fromEntries(ROSTER.map((e) => [e.id, e]));
