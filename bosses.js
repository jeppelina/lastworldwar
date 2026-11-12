// Bossar, omritade med högre ribba än vanliga fiender. Prototyp: inget här används av spelet än.
// Samma kontrakt som game/enemies.js: draw(g, t, pose), motorn har gjort g.push(x, y) så att (0, 0) är marken
// mitt under bossen. Bossen tittar åt VÄNSTER, uppåt är negativt y.
//
// pose = { attack: 0..1, hurt: 0..1 } som förut, plus VALFRIA fält (utelämnade fält ger det gamla beteendet):
//   attackKind: 0 | 1     vilken av bossens två attacker som spelas (0 om fältet saknas)
//   phase:      1 | 2     2 = bossens andra skepnad (argare, sprucken, glödande)
//   defeated:   0..1      1 = besegrad och glad (bossen är hjälpt, inte skadad)
//   talk:       0..1      munnen rör sig (repliker)
import { ramp as R } from './pixel.js';

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), bone: R('#ece4cf'), gold: R('#f2b632'), red: R('#d8433b'),
  wood: R('#9a6b3f'), leather: R('#8a5a34'), steel: R('#aab6c4'), fire: R('#ff7a1f'), fire2: R('#ffd84a'),
  ice: R('#bff0ff'), purple: R('#9a6bff'), pink: R('#ee8fa8'), leaf: R('#58b04a'), orange: R('#f08a2a'),
  snow: R('#eef4fb'), navy: R('#39446e'), smoke: R('#8d8aa0'), stone: R('#b9a88a'), cyan: R('#3fe0ff'), ink: R('#3a2a48'),
};
const { sin, cos, PI, abs, max, min, floor, ceil, atan2, hypot } = Math;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
// Läser posen. kind = attackens nummer, p2 = andra skepnaden, de = besegrad, talk = pratar.
const PP = (p) => ({ a: clamp((p && p.attack) || 0), hu: clamp((p && p.hurt) || 0), kind: (p && p.attackKind) ? 1 : 0, p2: !!(p && p.phase === 2), de: clamp((p && p.defeated) || 0), talk: clamp((p && p.talk) || 0) });
const bump = (a) => sin(clamp(a) * PI);                       // 0 → 1 → 0
// Attackkurva: laddar bakåt (ner till -0,6), slår fram till 1 och går tillbaka till 0.
const strike = (a) => (a <= 0 ? 0 : a < 0.35 ? -0.6 * sin((a / 0.35) * PI / 2) : a < 0.6 ? -0.6 + 1.6 * ((a - 0.35) / 0.25) : 1 - (a - 0.6) / 0.4);
const blinkAt = (t, seed = 0) => ((t + seed * 1.37) % 3.4) < 0.14;
const step = (t, sp = 2.6, ph = 0) => (sin(t * sp + ph) > 0.3 ? 1 : 0);
const mix = (p, q, u) => [p[0] + (q[0] - p[0]) * u, p[1] + (q[1] - p[1]) * u];
const bez = (p0, p1, p2, u) => { const v = 1 - u; return [v * v * p0[0] + 2 * u * v * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * p1[1] + u * u * p2[1], 2 * v * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]), 2 * v * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1])]; };

// Öga: vit glob med mörk pupill. o: { shut, col, pw, ph, dx, dy, mood: 'arg' | 'somnig' | 'lomsk' | 'orolig', inner, lid }
function eye(g, x, y, w, h, o = {}) {
  if (o.shut) { g.rect(x, y + floor(h / 2), w, 1, C.dark, 0); return; }
  g.rect(x, y, w, h, o.col ?? C.white, 5);
  const pw = o.pw ?? max(1, ceil(w / 2)), ph = o.ph ?? max(1, ceil(h * 0.6));
  g.rect(x + (o.dx ?? 0), y + (o.dy ?? h - ph), pw, ph, C.dark, 0);
  const lid = o.lid ?? C.dark, ll = o.lid != null ? 1 : 0;
  if (o.mood === 'arg') g.poly(o.inner > 0 ? [[x - 1, y - 1], [x + w + 1, y - 1], [x + w + 1, y + h * 0.6]] : [[x - 1, y - 1], [x + w + 1, y - 1], [x - 1, y + h * 0.6]], lid, ll);
  if (o.mood === 'orolig') g.poly(o.inner > 0 ? [[x - 1, y - 1], [x + w + 1, y - 1], [x - 1, y + h * 0.5]] : [[x - 1, y - 1], [x + w + 1, y - 1], [x + w + 1, y + h * 0.5]], lid, ll);
  if (o.mood === 'somnig') g.rect(x, y, w, ceil(h / 2), lid, 2);
  if (o.mood === 'lomsk') g.rect(x, y, w, max(1, floor(h / 3)), lid, ll);
}
// Glatt, stängt öga: en liten båge.
function happyEye(g, x, y, w) { g.rect(x, y + 1, 1, 2, C.dark, 0); g.rect(x + 1, y, w - 2, 1, C.dark, 0); g.rect(x + w - 1, y + 1, 1, 2, C.dark, 0); }
// Kedja av kulor längs en kvadratisk bezier (armar, halsar, svansar).
function tube(g, p0, p1, p2, r0, r1, rp, n = 8, shade = true, lv = 3) {
  for (let i = 0; i <= n; i++) {
    const u = i / n, v = 1 - u, r = r0 + (r1 - r0) * u;
    g.ell(v * v * p0[0] + 2 * u * v * p1[0] + u * u * p2[0], v * v * p0[1] + 2 * u * v * p1[1] + u * u * p2[1], r, r, rp, shade, null, lv);
  }
}
// Litet pixeltecken ur en mall, cell för cell.
function glyph(g, x, y, rows, rp, lv = 5, c = 2) { rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === '#') g.rect(x + i * c, y + j * c, c, c, rp, lv); }); }
const QMARK = ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'];
const EXCL = ['##', '##', '##', '##', '##', '..', '##'];
const CHECK = ['......#', '.....#.', '#...#..', '.#.#...', '..#....'];
const L_A = ['.#.', '#.#', '###', '#.#', '#.#'], L_B = ['##.', '#.#', '##.', '#.#', '##.'], L_C = ['.##', '#..', '#..', '#..', '.##'];
const SQUIG = ['.#...#', '#.#.#.', '...#..'];
const ZED = ['###', '..#', '.#.', '#..', '###'];
const HEART = ['.#.#.', '#####', '#####', '.###.', '..#..'];

// ====================================================================================================
// 1. THE FORGETFUL TROLL (Word Forest): snäll jätte som tappar bort sina ord
//    attack 0 = klubbdunk (han tvekar mitt i svingen), attack 1 = hopp och stamp med stenskred
// ====================================================================================================
function clubShape(g) {
  g.begin();
  g.poly([[-4, 12], [4, 12], [9, -50], [7, -66], [-7, -66], [-10, -50]], C.wood, 3);
  g.poly([[-8, -50], [-5, -64], [-1, -64], [-3, -50], [-2, 8], [-3, 8]], C.wood, 4);
  g.ell(3, -38, 3, 2.4, C.wood, false, null, 1); g.ell(-2, -18, 2.4, 2, C.wood, false, null, 1); g.ell(0, -66, 7, 2.6, C.wood, false, null, 5); g.ell(0, -66, 4, 1.4, C.wood, false, null, 3);
  g.poly([[8, -44], [17, -53], [16, -46], [9, -37]], C.wood, 2); g.poly([[15, -52], [22, -58], [22, -50]], C.leaf, 4); g.poly([[15, -52], [13, -60], [19, -57]], C.leaf, 3);
  g.rect(-6, -8, 12, 3, C.red, 3);                                                    // snöre runt skaftet: "kom ihåg klubban"
  g.end();
}
function troll(g, t, pose) {
  const { a, hu, kind, p2, de, talk } = PP(pose);
  const sk = R('#7da35c'), bel = R('#b9cc8a'), moss = R('#3f7d3a'), sackc = R('#b58a5a'), birdc = R('#4aa3d8');
  const s = kind === 0 ? strike(a) : -0.45 * bump(a), a1 = kind === 1 ? a : 0;
  const br = sin(t * 1.5), lag = sin(t * 1.5 - 0.9), lag2 = sin(t * 1.5 - 1.8), b = br > 0.2 ? 1 : 0;
  const hop = a1 > 0 && a1 < 0.5 ? sin((a1 / 0.5) * PI) * 18 : 0, land = a1 >= 0.5 ? 1 - (a1 - 0.5) / 0.5 : 0;
  const happy = de > 0.5, Y = de * 30 + land * land * 6, hy = -124 + b;
  const shut = hu > 0.3 || (t % 4.2) < 0.25;
  g.push(hu * 2, -hop, hu * 0.06);
  // Bortre arm med klubba: lyfts över huvudet och dunkas ner framåt. Som besegrad ligger klubban på marken.
  if (!happy) {
    const A = 0.15 + (s < 0 ? -s * 2 : s * 0.75), TH = -0.3 + (s < 0 ? -s * 1.5 : -s * 1.9);
    g.push(-30, -100 + b + Y, A);
    g.begin(); tube(g, [0, 0], [-4, 20], [-6, 40], 11, 9, sk, 6); g.end();
    g.push(-6, 42, TH - A); clubShape(g);
    g.begin(); g.ell(0, 0, 9.5, 8.5, sk); for (const y of [-5, -1, 3]) g.rect(-9, y, 7, 3, sk, 4); g.end();
    g.pop(); g.pop();
  } else { g.push(40, -8, 1.45); clubShape(g); g.pop(); }
  // Ben: stående, eller utsträckta framåt när han sitter.
  if (!happy) {
    g.begin();
    g.poly([[-32, -40], [-10, -40], [-8, -6], [-34, -6]], sk, 2); g.poly([[8, -40], [32, -40], [34, -6], [10, -6]], sk, 3);
    g.poly([[-42, 0], [-40, -9], [-6, -10], [-5, 0]], sk, 3); g.poly([[2, 0], [4, -9], [36, -10], [38, 0]], sk, 3);
    for (const x of [-38, -31, -24, 6, 13, 20]) { g.ell(x, -3.5, 4, 3.6, sk); g.rect(x - 3, -2, 3, 2, C.bone, 4); }
    g.end();
  } else {
    g.begin(); tube(g, [-14, -14], [-40, -16], [-62, -11], 11, 9, sk, 8, true, 2); g.ell(-68, -17, 7, 12, sk); g.ell(-69, -15, 4.5, 8, bel, 0.9); for (let i = 0; i < 3; i++) g.ell(-72 + i * 4, -29 - (i === 1), 2.6, 3, sk); g.end();
    g.begin(); tube(g, [10, -12], [-18, -13], [-40, -10], 12, 10, sk, 8); g.ell(-47, -16, 8, 13, sk); g.ell(-48, -14, 5, 9, bel, 0.9); for (let i = 0; i < 3; i++) g.ell(-52 + i * 5, -29 - (i === 1) + step(t, 3, i), 3, 3.2, sk); g.end();
  }
  g.push(0, Y);
  g.begin();                                             // mossig puckel med svampar som gungar efter
  g.ell(24, -100 + b, 30, 21, moss);
  for (const [x, y] of [[8, -119], [20, -122], [34, -118], [46, -108]]) g.poly([[x - 4, y + 4], [x, y - 4], [x + 4, y + 4]], moss, 5);
  g.rect(24, -121 + b + lag, 2, 5, C.bone, 3); g.ell(25, -123 + b + lag, 5, 3, C.red, true, (dx, dy) => dy < 0.4); g.dot(23, -125 + b + lag, C.white, 5);
  g.rect(36, -116 + b + lag2, 2, 4, C.bone, 3); g.ell(37, -118 + b + lag2, 3.6, 2.4, C.red, true, (dx, dy) => dy < 0.4);
  g.end();
  g.begin();                                             // mage och bröst
  g.ell(2, -68 - br * 0.6, 42, 36 + br * 0.6, sk); g.ell(0, -100 + b, 36, 22, sk);
  g.ell(-8, -64 - br * 0.6, 27, 25, bel, 0.8);
  g.rect(-14, -54, 3, 3, bel, 1); g.rect(-13, -53, 2, 2, bel, 2);
  for (const [x, y] of [[20, -84], [26, -72], [16, -96], [-30, -92]]) g.ell(x, y, 2.4, 1.8, sk, false, null, 2);
  g.end();
  g.begin();                                             // höftskynke med lappar
  g.poly([[-39, -44], [42, -44], [38, -30], [22, -23], [8, -30], [-8, -21], [-22, -30], [-37, -25]], C.leather, 3);
  g.rect(-40, -47, 83, 4, C.wood, 2); g.rect(-26, -41, 7, 7, sackc, 4); g.line(-27, -42, -19, -42, C.dark, 1); g.line(-27, -34, -19, -34, C.dark, 1); g.rect(-4, -46, 6, 6, C.gold, 4);
  g.end();
  // Ordsäcken: hänger i bältet och gungar efter. Gnistorna (orden) rinner ut ur ett hål.
  g.push(26, -45, lag * 0.07);
  g.begin();
  g.poly([[-9, 0], [9, 0], [13, 16], [8, 25], [-8, 25], [-13, 16]], sackc, 3); g.rect(-6, -2, 12, 3, C.red, 3);
  g.rect(-9, 6, 6, 6, C.leather, 4); g.dot(-10, 5, C.dark, 0); g.dot(-3, 12, C.dark, 0); g.ell(4, 20, 3, 2.4, C.dark, false, null, 0);
  g.end();
  if (!happy) { g.begin(); for (let i = 0; i < 3; i++) { const ph = (t * 0.55 + i / 3) % 1; g.rect(3 + sin(i * 4 + t) * 2, 22 + ph * 16, 2, 2, C.fire2, ph < 0.6 ? 5 : 3); } g.end({ outline: false, edge: false }); }
  g.pop();
  g.begin();                                             // huvud med öra som viftar
  g.poly([[8, hy - 4], [24, hy - 14 + step(t, 1.1) * 2], [22, hy + 4], [9, hy + 7]], sk, 2); g.poly([[11, hy - 2], [20, hy - 9], [19, hy + 2]], bel, 2);
  g.ell(18, hy + 7, 2.4, 2.4, C.gold, false, (dx, dy, d2) => d2 > 0.4, 4);
  g.ell(-8, hy, 20, 18, sk); g.ell(-12, hy + 10, 17, 10, sk);
  if (p2) { g.ell(-14, hy + 5, 5, 3, C.red, false, null, 4); g.ell(2, hy + 6, 4, 3, C.red, false, null, 4); }
  g.end();
  g.begin();                                             // ansikte: ögonen tittar åt var sitt håll
  const nose = [-27, hy + 2];
  g.ell(nose[0], nose[1], 9, 8, bel, 0.9); g.rect(-34, hy + 4, 2, 2, sk, 1); g.rect(-28, hy + 6, 2, 2, sk, 1);
  if (happy) { happyEye(g, -24, hy - 8, 7); happyEye(g, -12, hy - 7, 7); }
  else {
    eye(g, -24, hy - 10, 7, 7, { shut, pw: 3, ph: 3, dx: 0, dy: p2 ? 3 : 0, mood: p2 ? 'arg' : null, inner: 1, lid: sk });
    eye(g, -12, hy - 9, 7, 7, { shut, pw: 3, ph: 3, dx: 4, dy: p2 ? 3 : 4, mood: p2 ? 'arg' : null, inner: -1, lid: sk });
  }
  if (p2 && !happy) g.poly([[-27, hy - 10], [-15, hy - 15], [-3, hy - 10], [-3, hy - 13], [-15, hy - 18], [-27, hy - 13]], sk, 1);
  else g.thick(-26, hy - 12 - (happy ? 2 : 0), -3, hy - 14 - (happy ? 2 : 0), 2.6, sk, 1);
  const mo = happy ? 5 : (a > 0.05 ? 2 + bump(a) * 5 : 0) + talk * abs(sin(t * 9)) * 4;
  if (happy) g.poly([[-27, hy + 12], [-4, hy + 12], [-8, hy + 19], [-22, hy + 19]], C.dark, 0); else g.rect(-26, hy + 13, 21, 2 + mo, C.dark, 0);
  if (mo > 3) g.rect(-21, hy + 15 + mo * 0.5, 10, 2, C.pink, 3);
  g.poly([[-25, hy + 14], [-23, hy + 6], [-20, hy + 14]], C.bone, 5); g.poly([[-11, hy + 14], [-9, hy + 5], [-6, hy + 14]], C.bone, 4);
  g.end();
  if (p2 && !happy) { g.begin(); for (let i = 0; i < 3; i++) { const ph = (t * 0.8 + i / 3) % 1; g.ell(22 + ph * 8, hy - 12 - ph * 16, 2 + ph * 3, 2 + ph * 2.4, C.white, false, null, 5 - floor(ph * 2)); } g.end({ outline: false, edge: false }); }   // ånga ur örat
  // Fågelboet på hjässan. Fågeln guppar efter andningen, flyger upp vid träff och landar på näsan vid seger.
  g.begin();
  g.ell(-6, hy - 17, 12, 4.5, C.wood); for (const [x, d] of [[-16, -3], [-9, -5], [0, -4], [6, -2]]) g.line(x, hy - 18, x + d, hy - 22, C.wood, 2);
  g.ell(-9, hy - 19, 2, 1.6, C.bone, false, null, 5); g.ell(-4, hy - 19, 2, 1.6, C.ice, false, null, 5);
  g.end();
  const bp = happy ? [nose[0] - 4, nose[1] - 12 + step(t, 4)] : [0, hy - 24 + lag * 1.5 - hu * 14], flap = hu > 0.05 || (happy && step(t, 7));
  g.begin();
  if (flap) { g.poly([[bp[0] + 1, bp[1] - 1], [bp[0] + 7, bp[1] - 8], [bp[0] + 5, bp[1]]], birdc, 4); g.poly([[bp[0] - 2, bp[1] - 1], [bp[0] - 6, bp[1] - 8], [bp[0] - 4, bp[1]]], birdc, 2); }
  g.ell(bp[0], bp[1], 4.5, 4, birdc); g.poly([[bp[0] + 3, bp[1]], [bp[0] + 9, bp[1] - 2], [bp[0] + 7, bp[1] + 2]], birdc, 2);
  g.poly([[bp[0] - 4, bp[1] - 1], [bp[0] - 8, bp[1]], [bp[0] - 4, bp[1] + 1]], C.orange, 4); g.rect(bp[0] - 3, bp[1] - 2, 1, 2, C.dark, 0); g.ell(bp[0], bp[1] + 2, 2.4, 1.6, C.bone, false, null, 5);
  g.end();
  // Närmre arm: kliar sig i huvudet (snöre runt fingret som påminnelse), knyts under attack, vilar på magen vid seger.
  const sc = happy ? 0 : 1 - clamp(a * 6), wig = sin(t * 7) * 1.5 * sc, rest = happy ? [-24, -56] : [46, -58];
  const hand = mix(rest, [18, hy - 15 + wig], sc), ctl = mix(happy ? [34, -52] : [52, -82], [56, -112], sc);
  g.begin(); tube(g, [30, -98 + b], ctl, hand, 11, 8.5, sk, 8); g.ell(hand[0], hand[1], 9, 8, sk); g.rect(hand[0] - 9, hand[1] - 2, 4, 4, C.red, 4); g.dot(hand[0] - 10, hand[1] - 3, C.red, 5); g.dot(hand[0] - 10, hand[1] + 2, C.red, 5); g.end();
  // Frågetecken (ett i lugn skepnad, tre i arg), utropstecken och fria gnistor vid seger.
  g.begin();
  if (happy) { glyph(g, -48, hy - 46 + Math.round(sin(t * 3) * 2), EXCL, C.fire2, 5, 3); for (let i = 0; i < 7; i++) { const ph = (t * 0.4 + i / 7) % 1, an = i * 2.4; g.rect(10 + cos(an) * (20 + ph * 60), -70 + sin(an) * 20 - ph * 60, 2, 2, C.fire2, 5); } }
  else if (hu < 0.02 && ((a < 0.02 && sin(t * 0.9) > -0.2) || (kind === 0 && a > 0.26 && a < 0.44) || p2)) {
    glyph(g, -46, hy - 44 + Math.round(sin(t * 2.5) * 2), QMARK, p2 ? C.fire2 : C.white);
    if (p2) { glyph(g, -22, hy - 58 + Math.round(sin(t * 2.5 + 2) * 2), QMARK, C.fire2, 5, 1.5); glyph(g, 30, hy - 50 + Math.round(sin(t * 2.5 + 4) * 2), QMARK, C.fire2, 5, 1.5); }
  }
  g.end();
  g.pop();
  // Stampet: stenar och damm rullar mot hjälten.
  if (a1 >= 0.5) {
    const u = (a1 - 0.5) / 0.5;
    g.begin();
    for (let i = 0; i < 5; i++) { const x = -52 - u * 84 - i * 9, y = -sin(min(1, u * 1.3 + i * 0.08) * PI) * (9 + i * 4); g.poly([[x - 4, y], [x - 1, y - 5 - (i % 2) * 2], [x + 4, y - 2], [x + 3, y + 2]], C.smoke, 3 + (i % 2)); }
    g.end();
    g.begin(); for (let i = 0; i < 8; i++) g.rect(-46 - u * 100 + i * 9, -2 - (i % 3), 3, 2, C.stone, 4); g.end({ outline: false, edge: false });
  }
  g.pop();
}

// ====================================================================================================
// 2. THE RIDDLE SPHINX (Sun Desert): självgod gåtmakare med en stentavla. Näsan sitter löst.
//    attack 0 = tasshugg med sandmoln, attack 1 = gåtblicken (ögonen lyser, frågetecken skjuts fram)
// ====================================================================================================
function sphinx(g, t, pose) {
  const { a, hu, kind, p2, de, talk } = PP(pose);
  const m = R('#dcae62'), dk = R('#c08a44'), blue = R('#3f6fd0'), skin = R('#d99a5c'), teal = R('#2fa6a0');
  const s = kind === 0 ? strike(a) : 0, a1 = kind === 1 ? a : 0, gl = a1 > 0.3 ? sin(((a1 - 0.3) / 0.7) * PI) : 0;
  const happy = de > 0.5, br = sin(t * 1.5), tsp = p2 && !happy ? 4.2 : 1.8, tw = sin(t * tsp), tw2 = sin(t * tsp - 1.0);
  const shut = hu > 0.3 || (t % 5) < 0.3, hy = -70 + (br > 0.3 ? 1 : 0) - max(0, -s) * 3 + (happy ? 3 : 0) - gl * 2;
  g.push(hu * 2, 0, hu * 0.05, 1.15);
  g.begin(); tube(g, [60, -22], [86, -30], [78 + tw * 2, -58 + tw * 3], 4, 3.4, m, 12, false, 3); g.ell(78 + tw2 * 4, -63 + tw2 * 3, 5.5, 6.5, dk); g.end();   // svans, tofsen släpar efter
  // Vinge i tre fjäderlager som rör sig efter varandra. Fälls upp i arg skepnad och vid gåtblicken.
  const wa = -0.05 + sin(t * 1.2) * 0.04 - max(0, -s) * 0.35 - (p2 && !happy ? 0.55 : 0) - gl * 0.4 + (happy ? 0.28 : 0);
  const fr = (i) => sin(t * 1.2 - i * 0.7) * 1.5;
  g.begin();
  g.push(14, -42, wa);
  g.poly([[0, 2], [8, -30], [28, -48 + fr(0)], [54, -50 + fr(0)], [45, -38], [58, -33 + fr(1)], [47, -23], [56, -16 + fr(2)], [43, -8], [48, 0 + fr(3)], [20, 6]], C.gold, 3);
  g.poly([[4, 0], [12, -25], [28, -38 + fr(1)], [42, -38 + fr(1)], [35, -28], [43, -23 + fr(2)], [35, -15], [39, -8 + fr(3)], [20, 1]], teal, 3);
  g.poly([[7, -2], [14, -19], [25, -27 + fr(2)], [22, -15], [27, -10 + fr(3)], [17, -2]], C.red, 3);
  for (const [x, y] of [[20, -40], [33, -43], [44, -44]]) g.line(x, y, x + 5, y + 8, C.gold, 1);
  g.pop(); g.end();
  g.begin();                                             // bakkropp
  g.ell(24, -26 - br * 0.4, 40, 20 + br * 0.4, m, 1.2); g.ell(46, -22, 20, 21, m, 1.2); g.ell(46, -22, 20, 21, m, false, (dx, dy, d2) => d2 > 0.8 && dx < -0.2 && dy < 0.5, 2);
  g.poly([[24, 0], [27, -10], [60, -10], [65, 0]], m, 3); for (const x of [30, 36]) g.rect(x, -5, 1, 5, m, 1);
  g.rect(8, -44, 30, 3, blue, 3); for (let x = 10; x < 38; x += 6) g.rect(x, -44, 3, 3, C.gold, 4);       // ryggband
  g.end();
  g.begin(); g.poly([[-18, -17], [-52, -14], [-61, -9], [-62, 0], [-18, 0]], m, 2); for (const x of [-57, -52]) g.rect(x, -6, 1, 6, m, 1); g.end();   // bortre framtass
  // Stentavlan med dagens gåta: frågetecken, lyser vid blicken, bock när gåtan är löst.
  g.push(-64, -2, -0.08 + (happy ? 0 : sin(t * 1.5 - 0.6) * 0.015));
  g.begin();
  g.poly([[-11, 0], [11, 0], [12, -30], [8, -35], [-8, -35], [-12, -30]], C.stone, gl > 0.3 ? 5 : 3); g.line(7, -33, 10, -26, C.stone, 1); g.line(-10, -6, -6, -2, C.stone, 1);
  if (happy) glyph(g, -7, -24, CHECK, C.leaf, 3, 2); else glyph(g, -5, -27, QMARK, gl > 0.3 ? C.cyan : p2 ? C.red : C.ink, gl > 0.3 ? 5 : 2, 2);
  g.end();
  g.pop();
  g.begin();                                             // bröst med halskrage
  g.ell(-12, -36, 17, 24, m, 1.2);
  g.ell(-13, -50, 15, 9, blue, false, (dx, dy) => dy > -0.1, 3); g.ell(-13, -50, 15, 9, C.gold, false, (dx, dy, d2) => dy > -0.1 && d2 > 0.35 && d2 < 0.68, 4);
  g.ell(-14, -43, 2.6, 2.6, C.red, false, null, 4);
  g.end();
  // Huvudet är förstorat kring halsen, så att ansiktet går att läsa på håll.
  g.push(-12, -50, happy ? 0.06 : 0, 1.35); g.push(12, 50);
  g.begin();                                             // huvudduk, bakre delen i ränder
  const XR = [-2, 3, 6, 7, 8, 8, 9, 9, 9, 9, 8];
  for (let i = 0; i < 10; i++) { const y0 = hy - 17 + i * 4, xl = i < 6 ? -28 : -7; g.poly([[xl, y0], [XR[i], y0], [XR[i + 1], y0 + 4], [xl, y0 + 4]], i % 2 ? blue : C.gold, 3); }
  g.end();
  g.begin();                                             // ansikte
  g.ell(-16, hy, 12, 13, skin, 0.9);
  g.ell(-16, hy - 2, 13.4, 13.6, C.gold, true, (dx, dy) => dy < -0.5); g.ell(-16, hy - 2, 13.4, 13.6, blue, false, (dx, dy) => dy < -0.66 && dy > -0.8, 3);
  if (gl > 0.2 && !shut) { g.rect(-27, hy - 4, 6, 4, C.cyan, 5); g.rect(-18, hy - 4, 6, 4, C.cyan, 5); }
  else if (happy) { happyEye(g, -27, hy - 2, 6); happyEye(g, -18, hy - 2, 6); }
  else if (p2) { eye(g, -27, hy - 5, 6, 6, { shut, mood: 'arg', inner: 1, lid: skin, pw: 2, ph: 3, dx: 1, dy: 2 }); eye(g, -18, hy - 5, 6, 6, { shut, mood: 'arg', inner: -1, lid: skin, pw: 2, ph: 3, dx: 1, dy: 2 }); }
  else { eye(g, -27, hy - 4, 6, 5, { shut, mood: 'lomsk', lid: skin, pw: 2, ph: 3, dx: 1 }); eye(g, -18, hy - 4, 6, 5, { shut, mood: 'lomsk', lid: skin, pw: 2, ph: 3, dx: 1 }); }
  if (!happy) { g.rect(-28, hy - 6 - (p2 ? 0 : 2), 7, 1, C.dark, 0); g.rect(-19, hy - 6, 7, 1, C.dark, 0); g.rect(-27, hy + 1, 6, 1, teal, 3); g.rect(-18, hy + 1, 6, 1, teal, 3); }    // ett höjt ögonbryn, grön ögonskugga
  g.rect(-12, hy - 2, 4, 1, C.dark, 0);
  if (p2) { g.line(-8, hy + 2, -11, hy + 6, C.dark, 0); g.line(-11, hy + 6, -9, hy + 9, C.dark, 0); }              // spricka i kinden
  const mo = talk * abs(sin(t * 9)) * 3 + (a > 0.05 ? 2 : 0);
  if (happy) { g.poly([[-27, hy + 7], [-18, hy + 7], [-20, hy + 11], [-25, hy + 11]], C.dark, 0); g.rect(-25, hy + 7, 5, 1, C.white, 5); }
  else if (mo > 0.5) g.rect(-26, hy + 8, 6, 1 + mo, C.dark, 0);
  else if (p2) { g.rect(-25, hy + 8, 5, 1, C.dark, 0); g.dot(-26, hy + 9, C.dark, 0); g.dot(-20, hy + 9, C.dark, 0); }
  else { g.rect(-25, hy + 8, 6, 1, C.dark, 0); g.dot(-19, hy + 7, C.dark, 0); }                                     // snett självbelåtet leende
  g.poly([[-23, hy + 12], [-18, hy + 12], [-19, hy + 22], [-22, hy + 22]], blue, 3); for (const y of [14, 17, 20]) g.rect(-23, hy + y, 5, 1, C.gold, 3);
  for (let i = 0; i < 6; i++) g.rect(-34, hy + 2 + i * 4, 7, 4, i % 2 ? C.gold : blue, 3);
  g.end();
  // Näsan: sitter löst, flyger av vid träff och är borta (plåster) i arg skepnad.
  g.begin();
  if (p2 && !happy) { g.rect(-31, hy + 3, 4, 1, C.white, 5); g.rect(-30, hy + 2, 2, 3, C.white, 5); }
  else { const nx = -27 - hu * 12, ny = hy + 1 - sin(hu * PI) * 9; g.poly([[nx + 2, ny - 2], [nx - 4, ny + 4], [nx + 2, ny + 5]], skin, 4); if (happy) { g.rect(-27, hy, 1, 5, C.white, 5); } }
  g.end();
  // Kobran i pannan: en egen liten varelse som svajar efter och väser vid attack.
  const ux = -31 + sin(t * 2 - 0.8) * 1.5 - (a > 0.05 ? 2 : 0), uy = hy - 20 + (happy ? 3 : 0);
  g.begin(); tube(g, [-25, hy - 11], [-23, hy - 17], [ux + 2, uy + 1], 1.5, 1.5, C.gold, 6, false, 4);
  g.ell(ux + 1.5, uy + 1, 2.6, 3, teal, false, null, 3); g.ell(ux, uy, 2.4, 1.8, C.gold, false, null, 5);
  if (happy) g.rect(ux - 1, uy - 1, 2, 1, C.dark, 0); else g.dot(ux - 1, uy - 1, C.red, 3);
  if (a > 0.05) g.rect(ux - 5, uy, 3, 1, C.red, 3);
  g.end();
  g.pop(); g.pop();
  // Närmre framtass: lyfts högt och slår ner med klorna ute.
  g.begin();
  g.push(-8, -10, max(0, -s) * 1.1 - max(0, s) * 0.08);
  g.poly([[8, -7], [-40, -5], [-50, -1], [-52, 6], [-48, 10], [8, 10]], m, 3); for (const x of [-47, -42, -37]) g.rect(x, 3, 1, 7, m, 1);
  if (kind === 0 && a > 0.05) for (const y of [0, 4, 8]) g.poly([[-51, y - 1], [-58, y + 1], [-51, y + 2]], C.white, 5);
  g.pop(); g.end();
  if (kind === 0 && a > 0.58) {                          // sandmoln efter hugget
    const u = (a - 0.58) / 0.42;
    g.begin(); for (let i = 0; i < 7; i++) { const an = PI + (i - 3) * 0.22, r = 10 + u * 34; g.ell(-58 + cos(an) * r, -2 + sin(an) * r * 0.6 - u * 6, 4 - u * 2.5, 3 - u * 2, C.stone, false, null, 5 - (i % 2)); } g.end({ outline: false, edge: false });
  }
  if (gl > 0.02) {                                       // gåtblicken
    const L = gl * 48;
    const ey = -50 + (hy + 50) * 1.35;
    g.begin(); g.thick(-33, ey - 1, -33 - L, ey + 4 + L * 0.8, 3, C.cyan, 5); g.thick(-21, ey - 1, -33 - L, ey + 8 + L * 0.8, 2, C.cyan, 4); g.end({ edge: false });
    g.begin(); glyph(g, -42 - L, ey - 2 + L * 0.8, QMARK, C.fire2, 5, 1.5 + gl); g.end();
  }
  if (happy) { g.begin(); glyph(g, -56, hy - 40 + Math.round(sin(t * 2.4) * 2), HEART, C.red, 4, 1.5); g.end(); }
  if (p2 && !happy) { g.begin(); for (let i = 0; i < 10; i++) { const an = t * 2.6 + i * 0.63, r = 62 + (i % 3) * 14; g.rect(8 + cos(an) * r, -5 - (i % 4) * 5 + sin(an) * 4, 2 + (i % 2), 2, C.stone, 5 - (i % 2)); } g.end({ outline: false, edge: false }); }   // sanden virvlar runt henne
  g.pop();
}

// ====================================================================================================
// 3. THE MUMBLING WITCH (Mushroom Swamp): har munnen full av bokstavssoppa, så ingen hör vad hon säger
//    attack 0 = slevkast (en klick soppa i båge), attack 1 = mummelbubblor (bubblor med bokstäver)
// ====================================================================================================
function witch(g, t, pose) {
  const { a, hu, kind, p2, de, talk } = PP(pose);
  const robe = R('#5b3f86'), hat = R('#3a2d5c'), skin = R('#a9cf6a'), iron = R('#4b4763'), soup = R(p2 ? '#c874ff' : '#7fe05a'), hair = R('#cfd6b8'), toad = R('#6bbf59'), band = R('#b46bff');
  const s = kind === 0 ? strike(a) : 0, a1 = kind === 1 ? a : 0, wind = s < 0 ? -s / 0.6 : 0, lean = bump(a1) * 0.16;
  const happy = de > 0.5, br = sin(t * 1.8), b = br > 0.3 ? 1 : 0, tipL = sin(t * 1.8 - 1.1), tipL2 = sin(t * 1.8 - 2.0);
  const shut = hu > 0.3 || blinkAt(t, 2), cx = -30, st = t * (p2 ? 3.6 : 2), WX = 20, WK = 1.22;
  // Häxan står bakom grytan
  g.push(WX, 0, hu * 0.12 - lean, WK);
  g.begin();                                             // kåpa med lappar och puckel
  g.ell(8, -56, 16, 14, robe);
  g.poly([[-22, 0], [-17, -3], [-12, 0], [-6, -3], [0, 0], [6, -3], [12, 0], [18, -3], [24, 0], [22, -38], [14, -64], [-10, -64], [-16, -38]], robe, 3);
  g.rect(8, -30, 7, 7, band, 4); g.dot(7, -31, C.white, 5); g.dot(15, -23, C.white, 5); g.rect(-8, -16, 6, 6, R('#4f9a8a'), 4);
  for (const [x, y] of [[2, -44], [14, -46], [-6, -30]]) { g.dot(x, y, C.fire2, 5); g.dot(x + 1, y + 1, C.fire2, 4); }
  g.end();
  g.begin();                                             // hår: hänger, eller står rakt upp i arg skepnad
  if (p2 && !happy) for (let i = 0; i < 4; i++) g.poly([[0 + i * 3, -80], [8 + i * 5 + sin(t * 12 + i) * 1.5, -96 + i * 6], [6 + i * 3, -76 + i * 3]], hair, 4);
  else { g.poly([[-2, -88], [7, -84], [13 + tipL, -60], [7 + tipL, -55], [1, -70]], hair, 3); g.poly([[-2, -72], [3 + tipL * 0.5, -58], [-4, -62]], hair, 4); }
  g.end();
  g.begin();                                             // huvud: stor krokig näsa, kinderna fulla
  const ch = happy ? 0 : sin(t * 9) * 0.8;
  g.ell(-10, -79 + b, 13, 13, skin, 0.9);
  if (!happy) g.ell(-18, -72 + b, 6.5 + ch, 5.5 - ch * 0.5, skin, 0.9);
  g.poly([[-16, -69 + b], [-22, -61 + b], [-8, -66 + b]], skin, 2);
  g.poly([[-20, -84 + b], [-37, -77 + b], [-34, -73 + b], [-22, -75 + b]], skin, 4); g.rect(-31, -80 + b, 2, 2, C.red, 3);
  g.ell(1, -76 + b, 2.6, 3.4, skin, false, null, 2); g.ell(2, -70 + b, 2, 2, C.gold, false, (dx, dy, d2) => d2 > 0.3, 4);
  if (happy) happyEye(g, -21, -86 + b, 6);
  else eye(g, -21, -88 + b, 6, 6, { shut, pw: 2, ph: 3, dx: 0, mood: p2 ? 'arg' : 'lomsk', inner: 1, lid: skin });
  g.thick(-22, -90 + b - (p2 ? 0 : 1), -13, -91 + b - (p2 ? 3 : 0), 1.6, hair, 4);
  if (happy) { g.poly([[-26, -72], [-12, -73], [-15, -66], [-23, -66]], C.dark, 0); g.rect(-21, -72, 3, 3, C.white, 5); }
  else if (a1 > 0.1 || talk > 0) { const o = a1 > 0.1 ? 2.5 + bump(a1) * 2 : 1 + abs(sin(t * 10)) * 2.5 * talk; g.ell(-22, -69 + b, 3.4, o, C.dark, false, null, 0); }
  else { const f = floor(t * 7) % 2; g.rect(-25, -70 + b + f, 3, 1, C.dark, 0); g.rect(-22, -69 + b - f, 3, 1, C.dark, 0); g.rect(-19, -70 + b + f, 2, 1, C.dark, 0); }   // mumlar
  g.end();
  g.begin();                                             // hatt: toppen släpar efter, och hänger ner vid seger
  const tip = happy ? [24, -98] : [20 + tipL * 4 + wind * 6, -128 + tipL2 * 3 + b], ctl = happy ? [12, -128] : [-4 + tipL * 2, -124 + b];
  tube(g, [-8, -100 + b], ctl, tip, 14, 2, hat, 12);
  g.ell(-8, -96 + b, 27, 5, hat, 1.2);
  g.ell(-8, -101 + b, 14, 4, band, false, (dx, dy) => dy > -0.2, 3); g.rect(-13, -102 + b, 6, 5, C.gold, 4); g.rect(-11, -100 + b, 2, 2, hat, 1);
  g.rect(-2, -110 + b, 5, 5, R('#7a5ab0'), 4); g.dot(-3, -111 + b, C.white, 5); g.dot(3, -105 + b, C.white, 5);
  g.ell(tip[0], tip[1], 3, 3, C.fire2);                                                // stjärnbjällra i toppen
  g.rect(12, -102 + b, 2, 4, C.bone, 3); g.ell(13, -104 + b, 4.5, 2.8, C.red, true, (dx, dy) => dy < 0.4); g.dot(11, -105 + b, C.white, 5);   // svamp på brättet
  g.end();
  // Paddan på brättet: kväker, och hoppar till vid träff.
  const ty = -103 + b - hu * 10 - (step(t, 1.3) && !happy ? 1 : 0), cro = max(0, sin(t * 2.6)) * 1.5;
  g.begin(); g.ell(-27, ty, 5.5, 3.6, toad); g.ell(-30, ty + 1, 2 + cro, 1.6 + cro, R('#dbe8a2'), false, null, 5);
  g.ell(-30, ty - 3, 2, 2, toad); g.ell(-25, ty - 3.4, 2, 2, toad); g.dot(-31, ty - 4, C.dark, 0); g.dot(-26, ty - 4, C.dark, 0);
  g.end();
  g.pop();
  // Grytan
  g.begin();
  g.poly([[cx - 26, 0], [cx - 22, -10], [cx - 16, -10], [cx - 18, 0]], iron, 2); g.poly([[cx + 16, 0], [cx + 14, -10], [cx + 21, -10], [cx + 24, 0]], iron, 2);
  g.ell(cx, -27, 30, 25, iron);
  g.ell(cx - 30, -40, 4, 5, iron, false, (dx, dy, d2) => d2 > 0.35, 4); g.ell(cx + 30, -40, 4, 5, iron, false, (dx, dy, d2) => d2 > 0.35, 2);
  for (let i = 0; i < 6; i++) g.dot(cx - 22 + i * 9, -38 + abs(i - 2.5) * 1.2, iron, 5);
  g.end();
  // Eld under grytan, lågorna slickar botten
  g.begin();
  g.thick(cx - 26, -2, cx + 22, -4, 5, C.wood, 2); g.thick(cx - 20, -5, cx + 28, -2, 5, C.wood, 3);
  for (let i = 0; i < 4; i++) { const x = cx - 20 + i * 13, h = (p2 ? 20 : 12) + sin(t * 9 + i * 2) * 3; g.poly([[x - 5, -3], [x - 3, -h * 0.7], [x - 1, -h * 0.5], [x + 1, -h], [x + 4, -h * 0.6], [x + 6, -3]], C.fire, 4); g.poly([[x - 2, -3], [x, -h * 0.55], [x + 3, -3]], C.fire2, 5); }
  g.end();
  g.begin();
  g.ell(cx, -49, 32, 6.5, iron, false, null, 4); g.ell(cx, -49, 27, 4.2, soup, false, null, 3);
  for (let i = 0; i < 4; i++) { const ph = (st * 0.35 + i * 0.27) % 1; if (ph < 0.85) g.ell(cx - 18 + i * 12, -50 - ph * 2, 1.5 + ph * 3, 1.2 + ph * 2.4, soup, false, null, 5); }
  g.end();
  g.begin(); glyph(g, cx - 15 + sin(st) * 3, -55 + step(t, 3), L_A, C.white, 5, 1); glyph(g, cx + 6 - sin(st) * 2, -54 + step(t, 3, 2), L_B, C.white, 5, 1); glyph(g, cx - 4, -53 + step(t, 2.2, 1), L_C, C.fire2, 5, 1); g.end({ outline: false, edge: false });
  if (p2 && !happy) {                                    // soppan kokar över
    g.begin();
    for (let i = 0; i < 8; i++) g.ell(cx - 29 + i * 8.3, -49 + sin(st + i * 1.3) * 1.6, 5.5, 4.5, soup, false, null, 5);
    g.rect(cx - 25, -47, 5, 12 + sin(st) * 4, soup, 4); g.rect(cx + 14, -47, 4, 18 + sin(st + 2) * 5, soup, 4); g.rect(cx - 6, -45, 4, 8 + sin(st + 4) * 3, soup, 5);
    g.end();
  }
  g.begin(); for (let i = 0; i < 3; i++) { const ph = (t * 0.4 + i / 3) % 1; g.ell(cx - 10 + i * 10 + sin(ph * 6 + i) * 3, -58 - ph * 26, 2 + ph * 3, 2 + ph * 2, happy ? C.pink : C.white, false, null, 5 - floor(ph * 2)); } g.end({ outline: false, edge: false });   // ånga
  // Arm och slev (framför grytan). Rör runt i vila, öser och slungar vid attack 0, håller sleven som stav vid seger.
  g.push(WX, 0, hu * 0.12 - lean, WK);
  const H = happy ? [-30, -40] : [-26 + cos(st) * 7 + wind * 16, -66 + sin(st) * 2 - wind * 18];
  const bowl = [(cx - WX + cos(st) * 10) / WK, -47 / WK], LL = 30;
  const ang = happy ? PI - 0.6 : atan2(-(bowl[0] - H[0]), bowl[1] - H[1]) * (1 - wind) + wind * 3.8;
  g.begin(); g.push(H[0], H[1], ang); g.thick(0, -5, 0, LL, 2.4, C.wood, 3); g.ell(0, LL + 2, 5.5, 4.5, iron); if (wind > 0.25 || happy) g.ell(0, LL + 1, 3.6, 2.4, soup, false, null, 5); g.pop(); g.end();
  g.begin(); g.thick(-6, -60, H[0] + 2, H[1] + 1, 6.5, robe, 4); g.ell(H[0], H[1], 3.6, 3.4, skin); g.end();
  g.pop();
  if (kind === 0 && a > 0.44) {                          // soppklicken flyger i båge, med en bokstav i
    const u = (a - 0.44) / 0.56, x = -52 - u * 100, y = -104 - sin(u * PI) * 16 + u * 62;
    g.begin(); g.ell(x, y, 7, 6, soup); g.ell(x + 8, y - 2 - u * 4, 3, 2.6, soup); g.ell(x + 14, y - 3 - u * 6, 1.8, 1.6, soup); g.end();
    g.begin(); glyph(g, x - 2, y - 3, L_A, C.white, 5, 1); g.end({ outline: false, edge: false });
  }
  if (a1 > 0.12) {                                       // mummelbubblor: orden kommer ut som bubblor ingen förstår
    g.begin();
    for (let i = 0; i < 7; i++) { const u = a1 * 1.5 - 0.15 - i * 0.11; if (u <= 0 || u > 1) continue; const x = -12 - u * 104, y = -85 + sin(u * 7 + i * 1.7) * 9 - u * 6 + u * u * 44, r = 3 + u * 5; g.ell(x, y, r, r, i % 2 ? soup : C.ice, false, (dx, dy, d2) => d2 > 0.5, 5); g.dot(x - r * 0.4, y - r * 0.4, C.white, 5); if (r > 5) glyph(g, x - 1, y - 2, [L_A, L_B, L_C][i % 3], C.white, 5, 1); }
    g.end({ edge: false });
  }
  if (happy) {                                           // nu hörs hon: en tydlig pratbubbla
    g.begin(); g.ell(-46, -124, 22, 12, C.white, false, null, 5); g.poly([[-34, -115], [-16, -100], [-40, -113]], C.white, 5); g.end();
    g.begin(); glyph(g, -62, -129, L_A, C.ink, 2, 2); glyph(g, -50, -129, L_B, C.ink, 2, 2); glyph(g, -38, -129, L_C, C.ink, 2, 2); g.end({ outline: false, edge: false });
  }
}

// ====================================================================================================
// 4. THE SHIVERING GIANT (Frost Mountains, kartans "The Ice Giant"): frusen och blyg, fryser fast orden
//    för att de ska stå still. attack 0 = nysning (snöstorm), attack 1 = rullar en växande snöboll
// ====================================================================================================
function giant(g, t, pose) {
  const { a, hu, kind, p2, de, talk } = PP(pose);
  const happy = de > 0.5, ice = R(happy ? '#bfe0ee' : '#9fd0ee'), dkice = R('#78b0d8'), hatc = R('#2f8f9a'), mit = R('#d8433b'), mug = R('#b5632a');
  const s = kind === 0 ? strike(a) : 0, a1 = kind === 1 ? a : 0, roll = a1 > 0 ? (a1 < 0.5 ? a1 / 0.5 : 1 - (a1 - 0.5) / 0.5) : 0;
  const br = sin(t * 1.4), b = br > 0.2 ? 1 : 0, shv = !happy && a === 0 && hu === 0 && sin(t * 2.3) > 0 ? (floor(t * 22) % 2 ? 1 : -1) : 0;
  const pp = sin(t * 2.2 - 1.2) * 3 + shv * 2, shut = hu > 0.3 || blinkAt(t, 4), lean = roll * 0.3;
  const sneezeBack = s < 0 ? -s / 0.6 : 0, hr = sneezeBack * 0.28 - max(0, s) * 0.22;
  g.push(hu * 2, 0, hu * 0.05);
  if (happy) { g.begin(); g.ell(0, 0, 50, 3.5, C.ice, false, null, 4); g.ell(-20, 0, 12, 1.5, C.white, false, null, 5); g.end({ outline: false, edge: false }); }   // smältvatten
  // Halsdukens långa ände: fladdrar bakåt med fördröjning, led för led
  g.begin();
  const sc = (i) => [18 + i * 9, -102 + i * 6 + sin(t * 2.4 - i * 0.8) * (2 + i * 0.7) - max(0, s) * i * 3 + (happy ? i * 3 : 0)];
  for (let i = 0; i < 6; i++) { const p = sc(i), q = sc(i + 1); g.poly([[p[0], p[1] - 5], [q[0], q[1] - 5], [q[0], q[1] + 5], [p[0], p[1] + 5]], i % 2 ? C.white : mit, 3); }
  const e = sc(6); for (let j = -4; j <= 4; j += 4) g.rect(e[0], e[1] + j - 1, 4, 2, mit, 4);
  g.end();
  g.begin();                                             // ben och stövlar med pälskant
  g.poly([[-34, -42], [-6, -42], [-6, -8], [-36, -8]], dkice, 2); g.poly([[4, -42], [32, -42], [34, -8], [6, -8]], ice, 3);
  g.poly([[-46, 0], [-44, -10], [-38, -16], [-4, -16], [-3, 0]], C.navy, 3); g.poly([[-1, 0], [1, -10], [5, -16], [36, -16], [38, 0]], C.navy, 3);
  g.rect(-39, -19, 35, 6, C.snow, 4); g.rect(4, -19, 33, 6, C.snow, 4);
  g.end();
  g.push(shv, 0, -lean);
  g.begin();                                             // kropp: isblå, med frostpäls runt midjan
  g.ell(0, -75 - br * 0.5, 43, 41 + br * 0.5, ice);
  g.ell(-9, -70, 26, 26, C.snow, 0.8);
  g.rect(-39, -47, 78, 5, C.leather, 3); g.rect(-6, -49, 9, 9, C.gold, 4); g.rect(-4, -47, 5, 5, C.leather, 2);                 // bälte
  for (const [x, y] of [[-20, -84], [-4, -62], [14, -72]]) { g.rect(x, y, 3, 1, ice, 4); g.rect(x + 1, y - 1, 1, 3, ice, 4); }
  if (p2 && !happy) for (const [x, y] of [[-34, -104], [-26, -112], [26, -110], [34, -102]]) g.poly([[x - 4, y + 8], [x - (x < 0 ? 4 : -4), y - 10], [x + 4, y + 8]], C.ice, 5);   // istaggar på axlarna
  g.end();
  if (p2 && !happy) {                                    // sprickor som lyser
    g.begin(); const fl = step(t, 9) ? 5 : 4;
    for (const pts of [[[-30, -92], [-22, -80], [-28, -70], [-18, -60]], [[14, -96], [8, -84], [18, -74], [12, -62], [20, -54]], [[-6, -100], [-2, -92]]]) for (let i = 0; i + 1 < pts.length; i++) { g.line(pts[i][0] + 1, pts[i][1], pts[i + 1][0] + 1, pts[i + 1][1], C.navy, 2); g.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], C.cyan, fl); }
    g.end({ outline: false, edge: false });
  }
  // Huvud (lutas bakåt inför nysningen och kastas fram)
  g.push(-4, -119, hr);
  g.begin();
  g.ell(-2, -16 + b, 26, 22, ice);
  g.ell(21, -14 + b, 5, 8, hatc); g.ell(21, -14 + b, 3, 6, C.snow, false, null, 4);                        // öronmuff
  g.end();
  g.begin();                                             // mössa: toppen och bollen dinglar efter
  g.ell(-2, -27 + b, 27, 16, hatc, true, (dx, dy) => dy < 0.1);
  g.poly([[4, -41 + b], [18, -49 + b], [31, -45 + b + pp * 0.5], [38, -35 + b + pp], [31, -37 + b + pp], [22, -39 + b], [12, -35 + b]], hatc, 3);
  g.rect(-29, -29 + b, 54, 6, hatc, 5); for (let x = -26; x < 22; x += 6) g.rect(x, -27 + b, 3, 2, mit, 3);
  g.ell(38, -29 + b + pp * 1.4, 6.5, 6.5, C.snow);
  if (p2 && !happy) for (const x of [-18, -6, 6]) g.poly([[x - 3, -41 + b], [x, -51 + b], [x + 3, -41 + b]], C.ice, 5);
  g.end();
  g.begin();                                             // ansikte
  const sq = sneezeBack > 0.3 || s > 0.3;
  if (happy) { happyEye(g, -22, -17 + b, 7); happyEye(g, -9, -17 + b, 7); g.ell(-17, -6 + b, 4.5, 3, C.pink, false, null, 4); g.ell(6, -6 + b, 4.5, 3, C.pink, false, null, 4); }
  else { const md = p2 ? 'arg' : 'orolig'; const ec = p2 ? C.cyan : C.white; eye(g, -22, -19 + b, 7, 7, { shut: shut || sq, col: ec, pw: 3, ph: 3, dy: 4, mood: md, inner: 1, lid: ice }); eye(g, -9, -19 + b, 7, 7, { shut: shut || sq, col: ec, pw: 3, ph: 3, dy: 4, mood: md, inner: -1, lid: ice }); }
  g.thick(-24, -22 + b - (p2 ? -1 : 2), -15, -21 + b - (p2 ? 2 : 0), 2.6, C.snow, 5); g.thick(-10, -21 + b - (p2 ? 2 : 0), -1, -22 + b - (p2 ? -1 : 2), 2.6, C.snow, 5);       // frostiga ögonbryn
  g.ell(-27, -8 + b, 8, 7, mit); g.dot(-30, -11 + b, C.white, 5); g.dot(-29, -11 + b, C.white, 5);          // stor röd näsa
  if (!happy) { g.rect(-29, -1 + b, 2, 3 + step(t, 2), C.ice, 5); const ph = (t * 0.5) % 1; if (ph < 0.5) g.dot(-29, 4 + b + ph * 16, C.ice, 5); }   // droppe
  const mo = s > 0.2 ? 5 : talk * abs(sin(t * 9)) * 3;
  if (happy) { g.poly([[-21, -1 + b], [-3, -1 + b], [-6, 5 + b], [-18, 5 + b]], C.dark, 0); g.rect(-18, -1 + b, 12, 1, C.white, 5); }
  else if (mo > 1) g.ell(-13, 1 + b, 6, 2 + mo * 0.6, C.dark, false, null, 0);
  else { const ct = shv ? 1 : 0; g.rect(-20, -1 + b, 15, 3 + ct, C.white, 5); for (let x = -18; x < -6; x += 3) g.rect(x, -1 + b, 1, 3 + ct, C.dark, 1); g.rect(-20, 0 + b + ct, 15, 1, C.dark, 0); }   // tänderna skallrar
  for (const [x, hh] of [[-24, 6], [-18, 11], [-11, 14], [-4, 10], [3, 7], [10, 5]]) { const L = happy ? 2 + step(t, 2, x) : hh; g.poly([[x - 3, 5 + b], [x, 5 + b + L], [x + 3, 5 + b]], C.ice, 5); }   // istappsskägg (smälter vid seger)
  g.end();
  g.pop();
  g.begin();                                             // halsduk runt halsen, randig, med knut
  g.ell(-4, -105 + b, 27, 8, mit, 1.2); for (const x of [-22, -8, 6, 18]) g.rect(x, -111 + b + abs(x + 2) * 0.12, 5, 12 - abs(x + 2) * 0.2, C.white, 4);
  g.poly([[-26, -105 + b], [-34, -87 + b + pp * 0.4], [-25, -85 + b + pp * 0.4], [-20, -101 + b]], mit, 4); g.rect(-33, -91 + b + pp * 0.4, 9, 3, C.white, 4);
  g.end();
  // Armar: kramar om sig själv och gnuggar, rullar snöbollen vid attack 1, håller en varm kopp vid seger.
  const rub = shv ? sin(t * 14) : 0;
  if (happy) {
    g.begin(); tube(g, [-22, -98], [-34, -80], [-30, -62], 9, 8, ice, 7, true, 2); g.ell(-30, -60, 8, 7, mit); g.end();
    g.begin(); g.poly([[-40, -86], [-24, -86], [-25, -70], [-39, -70]], mug, 3); g.rect(-40, -87, 16, 3, C.white, 5); g.ell(-22, -78, 4, 5, mug, false, (dx, dy, d2) => d2 > 0.3, 3); g.end();
    g.begin(); for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i / 3) % 1; g.ell(-32 + sin(ph * 7 + i) * 3, -92 - ph * 20, 2 + ph * 2, 2 + ph * 1.5, C.white, false, null, 5); } g.end({ outline: false, edge: false });
    g.begin(); tube(g, [24, -98], [34, -78], [18, -66], 10, 8.5, ice, 7); g.ell(-28, -76, 8, 7, mit); g.end();
  } else if (a1 > 0) {
    g.begin(); tube(g, [-22, -98], [-40, -78], [-50, -52], 9, 8, ice, 7, true, 2); g.ell(-52, -48, 8, 7, mit); g.end();
    g.begin(); tube(g, [22, -100], [-6, -70], [-40, -44], 10, 8.5, ice, 8); g.ell(-44, -41, 9, 8, mit); g.end();
  } else {
    g.begin(); tube(g, [-24, -96], [-8, -72], [16 + rub, -80], 9, 8, ice, 8, true, 2); g.ell(19 + rub, -81, 8, 7, mit); g.end();
    g.begin(); tube(g, [24, -100], [10, -68], [-24 - rub, -86], 10, 8.5, ice, 8); g.ell(-27 - rub, -87, 9, 8, mit); g.rect(-34 - rub, -88, 3, 5, mit, 2); g.end();
  }
  g.pop();
  if (!happy && a === 0 && sin(t * 2.3) > 0.5) { g.begin(); for (let i = 0; i < 3; i++) g.ell(-34 - i * 7 - sin(t * 2.3) * 3, -127 - i * 2, 3 + i, 2.4 + i * 0.6, C.white, false, null, 5); g.end({ outline: false, edge: false }); }   // andedräkt
  if (kind === 0 && a > 0.5) {                           // nysningen: snö, isskärvor och vindstreck
    const u = (a - 0.5) / 0.5;
    g.begin();
    for (let i = 0; i < 18; i++) { const x = -34 - u * (44 + i * 5), y = -130 + (i - 8.5) * u * 5 + sin(i * 2.1) * 5 + u * 40; if (i % 3 === 0) g.poly([[x - 4, y], [x, y - 3], [x + 4, y], [x, y + 3]], C.ice, 5); else { g.rect(x, y - 1, 1, 3, C.white, 5); g.rect(x - 1, y, 3, 1, C.white, 5); } }
    g.end();
    g.begin(); for (let i = 0; i < 6; i++) { const x = -40 - u * 60 - (i % 3) * 14, y = -140 + i * 7 + u * 34; g.thick(x, y, x - 20, y + 6, 2, C.white, 5); } g.end({ outline: false, edge: false });
  }
  if (a1 > 0.05) {                                       // snöbollen växer medan den rullar
    const u = a1 < 0.5 ? 0 : (a1 - 0.5) / 0.5, r = 5 + min(1, a1 / 0.5) * 12 + u * 6, x = -58 - u * 86, rot = a1 * 14;
    g.begin(); g.ell(x, -r, r, r, C.snow); for (let i = 0; i < 3; i++) g.ell(x + cos(rot + i * 2.1) * r * 0.55, -r + sin(rot + i * 2.1) * r * 0.55, 2, 1.6, C.ice, false, null, 2); g.end();
    if (u > 0) { g.begin(); for (let i = 0; i < 4; i++) g.rect(x + r + 2 + i * 6, -2 - (i % 2) * 2, 3, 2, C.white, 5); g.end({ outline: false, edge: false }); }
  }
  g.pop();
}

// ====================================================================================================
// 5. THE WORD DRAGON (Sentence Volcano): petig ordningsman med läsglasögon. Svansen slutar i en punkt.
//    attack 0 = eldkvast, attack 1 = spottar en stor "punkt" (glödande klot i båge)
// ====================================================================================================
function dragon(g, t, pose) {
  const { a, hu, kind, p2, de, talk } = PP(pose);
  const happy = de > 0.5, hot = p2 && !happy;
  const m = R('#d8433b'), dk = R('#a8303f'), bel = R(hot ? '#ffb02e' : '#f2c35a'), wg = R('#93304e'), spine = hot ? C.fire : C.bone;
  const s = strike(a), br = sin(t * 1.6), k1 = kind === 1;
  const fw = (happy ? 0.55 : sin(t * 2.2) * 0.09 + max(0, -s) * 0.3) + (hot ? -0.12 : 0), shut = hu > 0.3 || blinkAt(t, 3), tw = sin(t * 1.9) * 5, tw2 = sin(t * 1.9 - 0.9) * 6;
  const wing = (lv) => {
    g.poly([[0, 0], [22, -58], [48, -74], [72, -70], [62, -52], [86, -36], [70, -26], [78, -2], [58, -6], [40, 8], [14, 4]], wg, lv);
    g.thick(0, 0, 22, -58, 5, m, 3); g.thick(22, -58, 72, -70, 3, m, 3); g.thick(22, -58, 86, -36, 3, m, 3); g.thick(22, -58, 78, -2, 3, m, 3);
    g.poly([[19, -58], [17, -69], [26, -62]], C.bone, 4); g.rect(52, -40, 7, 7, R('#b0506a'), 4); g.dot(51, -41, C.bone, 5); g.dot(59, -33, C.bone, 5);        // lagad vinge
  };
  g.push(hu * 2, 0, hu * 0.05, 0.94);
  g.begin(); g.push(-4, -82, -0.5 - fw * 0.7 + (happy ? 1.1 : 0), 0.8); wing(1); g.pop(); g.end();
  g.begin(); g.push(22, -78, -fw + (happy ? 0.9 : 0)); wing(2); g.pop(); g.end();
  g.begin();                                             // svans som slutar i en stor punkt
  const T0 = [40, -22], T1 = [96, 6], T2 = [104, -36 + tw];
  for (const u of [0.25, 0.45, 0.65, 0.82]) { const [x, y, tx, ty] = bez(T0, T1, T2, u), d = hypot(tx, ty), nx = ty / d, ny = -tx / d, r = 13 - 9 * u; g.poly([[x + tx / d * 3 + nx * r * 0.6, y + ty / d * 3 + ny * r * 0.6], [x + nx * (r + 6), y + ny * (r + 6)], [x - tx / d * 3 + nx * r * 0.6, y - ty / d * 3 + ny * r * 0.6]], spine, 3); }
  tube(g, T0, T1, T2, 13, 4, m, 14);
  g.end();
  g.begin(); g.ell(T2[0] + (tw2 - tw) * 0.4, T2[1] - 7 + (tw2 - tw), 8.5, 8.5, C.ink); g.end();
  g.begin();                                             // kropp med bukplåtar
  for (const [x, y] of [[36, -78], [46, -66], [52, -52]]) g.poly([[x - 5, y + 3], [x + 6, y - 7], [x + 4, y + 6]], spine, 3);
  g.ell(12, -46 - br * 0.5, 40, 40 + br * 0.5, m);
  g.ell(-4, -42, 25, 33, bel, 0.9, (dx) => dx < 0.45);
  g.ell(-4, -42, 25, 33, bel, false, (dx, dy) => dx < 0.45 && ((Math.round(dy * 33) % 8) + 8) % 8 === 0, hot ? 5 : 2);
  g.end();
  g.begin();                                             // bakben
  g.ell(34, -25, 20, 21, m); g.poly([[10, 0], [13, -11], [44, -11], [48, 0]], m, 3);
  for (const x of [10, 19, 28]) g.poly([[x + 2, 0], [x - 4, -1], [x + 2, -6]], C.bone, 4);
  g.end();
  // Hals och huvud: huvudet dras bakåt och kastas fram. Vid seger vilar hakan på marken.
  const up = k1 ? max(0, -s) * 12 : 0;
  const H = happy ? [-70, -20 + br * 0.5] : [-52 + max(0, -s) * 14 - max(0, s) * 18, -128 + br - max(0, -s) * 10 - up + max(0, s) * (k1 ? 6 : 16)];
  const N0 = [-6, -74], N1 = happy ? [-34, -84] : [-8, -122];
  g.begin();
  for (const u of [0.15, 0.35, 0.55, 0.75]) { const [x, y, tx, ty] = bez(N0, N1, [H[0] + 12, H[1] + 4], u), d = hypot(tx, ty), nx = -ty / d, ny = tx / d, r = 17 - 6 * u; g.poly([[x + tx / d * 4 + nx * r * 0.6, y + ty / d * 4 + ny * r * 0.6], [x + nx * (r + 7), y + ny * (r + 7)], [x - tx / d * 4 + nx * r * 0.6, y - ty / d * 4 + ny * r * 0.6]], spine, 3); }
  tube(g, N0, N1, [H[0] + 12, H[1] + 4], 17, 11, m, 14);
  g.end();
  g.begin();                                             // framben, med en hoprullad skrift i klon
  tube(g, [-12, -52], [-28, -36], [-22, -9], 8.5, 6.5, m, 7); g.ell(-25, -5, 10, 5.4, m);
  for (const x of [-35, -29, -23]) g.poly([[x + 3, 0], [x - 3, -1], [x + 3, -6]], C.bone, 4);
  g.end();
  g.begin(); g.thick(-34, -16, -14, -10, 6, C.bone, 4); g.ell(-34, -16, 3, 3.4, C.bone, false, null, 2); g.rect(-26, -16, 2, 6, C.red, 3); g.end();
  g.push(H[0], H[1], happy ? 0.12 : -s * 0.25 - (k1 ? max(0, -s) * 0.5 : 0), 1.25);
  const op = max(0, s) * (k1 ? 0.4 : 0.55) + (a > 0.05 ? 0.12 : 0.03) + talk * abs(sin(t * 9)) * 0.25 + (k1 && s < 0 ? 0 : 0);
  g.begin();                                             // horn, fjäderpenna bakom hornet, gap, underkäke
  g.poly([[4, -8], [22, -20], [31, -35], [20, -27], [8, -14]], C.bone, 3); g.poly([[10, -2], [28, -9], [39, -21], [26, -15], [12, -6]], C.bone, 2);
  g.poly([[12, -12], [34, -34 + sin(t * 2 - 1) * 1.5], [38, -28 + sin(t * 2 - 1) * 1.5], [18, -10]], C.white, 5); g.line(13, -12, 35, -31, C.steel, 2);
  g.poly([[2, 3], [-31, 1], [-31 * cos(op) + 2, 4 + 33 * sin(op)], [2, 9]], R('#7a1f2a'), 2);
  g.push(2, 6, -op); g.poly([[2, -2], [-30, 0], [-34, 4], [-30, 8], [-4, 10], [4, 6]], dk, 3);
  for (let x = -30; x < -8; x += 5) g.poly([[x, 0], [x + 1.5, -4], [x + 3, 0]], C.white, 5);
  g.pop(); g.end();
  g.begin();                                             // skalle och nos
  g.poly([[8, 4], [19, 10], [10, 13], [2, 10]], dk, 2); g.poly([[10, -3], [21, 2], [12, 6]], dk, 2);
  g.ell(0, 0, 14, 12, m);
  if (k1 && s < -0.1) g.ell(-6, 6, 9, 7, m);                                           // kinden sväller inför spottet
  g.poly([[-6, -10], [-24, -8], [-34, -5], [-37, 1], [-33, 6], [-6, 8]], m, 3); g.ell(-31, -4, 5.5, 4.6, m); g.rect(-35, -5, 2, 2, C.dark, 0);
  for (let x = -32; x < -10; x += 5) g.poly([[x, 6], [x + 1.5, 10], [x + 3, 6]], C.white, 5);
  g.poly([[-17, -9], [-2, -14], [5, -8], [-4, -5]], dk, 2);
  if (happy) happyEye(g, -14, -6, 7);
  else eye(g, -14, -7, 7, 5, { shut, col: C.fire2, pw: 2, ph: 5, dx: 1, dy: 0, mood: hot ? 'arg' : 'lomsk', inner: -1, lid: dk });
  g.end();
  // Läsglasögon långt ner på nosen: spricker i arg skepnad, hamnar på sned vid seger.
  g.push(-11, -4, happy ? 0.45 : 0);
  g.begin();
  g.ell(0, 0, 7, 6, C.gold, false, (dx, dy, d2) => d2 > 0.62, 4); g.ell(-12, 1, 5, 5, C.gold, false, (dx, dy, d2) => d2 > 0.55, 4); g.rect(-8, -1, 2, 1, C.gold, 4); g.rect(6, -1, 9, 1, C.gold, 3);
  g.dot(-3, -4, C.white, 5); g.dot(-14, -2, C.white, 5);
  if (hot) { g.line(-13, -2, -11, 1, C.dark, 0); g.line(-11, 1, -12, 4, C.dark, 0); g.line(-11, 1, -9, 2, C.dark, 0); }
  g.end({ outline: false });
  g.pop();
  if (!k1 && a > 0.5) {                                  // eldkvast
    const u = sin(((a - 0.5) / 0.5) * PI), L = u * 46, f = (i) => sin(t * 14 + i * 2.3) * 3;
    g.begin();
    g.poly([[-30, 3], [-52 - L, -12 + f(0)], [-46 - L, -2], [-62 - L, 5 + f(1)], [-46 - L, 11], [-54 - L, 24 + f(2)], [-30, 11]], C.fire, 4);
    g.poly([[-31, 5], [-44 - L * 0.7, -3 + f(1)], [-42 - L * 0.7, 4], [-52 - L * 0.7, 7 + f(2)], [-42 - L * 0.7, 10], [-44 - L * 0.7, 15 + f(0)], [-31, 9]], C.fire2, 5);
    g.end();
  } else if (happy) {                                    // en liten rökring, och en punkt: klart slut
    g.begin(); for (let i = 0; i < 2; i++) { const ph = (t * 0.4 + i * 0.5) % 1; g.ell(-40 - ph * 8, -8 - ph * 22, 4 + ph * 3, 3 + ph * 2, C.white, false, (dx, dy, d2) => d2 > 0.45, 5 - floor(ph * 2)); } g.end({ outline: false, edge: false });
  } else if (a < 0.02) {                                 // rök ur näsborren, lågor i arg skepnad
    g.begin(); for (let i = 0; i < 3; i++) { const ph = (t * 0.5 + i * 0.33) % 1; if (hot) g.poly([[-37, -7], [-40 - ph * 3, -12 - ph * 6 + sin(t * 12 + i) * 1.5], [-35, -9]], i % 2 ? C.fire : C.fire2, 5); else g.ell(-37 - ph * 5, -9 - ph * 16, 2 + ph * 2.5, 2 + ph * 2, C.smoke, false, null, 4 - Math.round(ph * 2)); } g.end({ outline: false, edge: false });
  }
  g.pop();
  if (k1 && a > 0.55) {                                  // punkten: ett glödande klot som landar framför hjälten
    const u = (a - 0.55) / 0.45, x = H[0] - 44 - u * 96, y = H[1] + 4 - sin(u * PI) * 14 + u * u * 96;
    g.begin(); g.ell(x, y, 12, 12, C.fire); g.end();
    g.begin(); g.ell(x, y, 8.5, 8.5, C.ink); g.dot(x - 3, y - 4, C.white, 5); g.end();
    g.begin(); for (let i = 0; i < 5; i++) g.rect(x + 12 + i * 6, y - 6 - i * 3 + sin(i * 3 + t * 20) * 2, 2, 2, i % 2 ? C.fire : C.fire2, 5); g.end({ outline: false, edge: false });
  }
  g.pop();
}

// ====================================================================================================
// 6. THE BABBLING CLOUD KING (Cloud Castle): pratar oavbrutet, lyssnar aldrig. Svävar.
//    attack 0 = blixt ur spiran, attack 1 = pladderstorm (en ström av pratbubblor)
// ====================================================================================================
function cloudking(g, t, pose) {
  const { a, hu, kind, p2, de, talk } = PP(pose);
  const happy = de > 0.5, storm = p2 && !happy;
  const cl = R(storm ? '#7c84a6' : happy ? '#ffffff' : '#e9eeff'), base = R(storm ? '#525a7a' : '#c5cdea'), cape = R('#8a3fb0'), nose = R(storm ? '#b06a8a' : '#f0a0b4');
  const s = kind === 0 ? strike(a) : 0, a1 = kind === 1 ? a : 0, wind = s < 0 ? -s / 0.6 : 0;
  const hov = 16 + sin(t * 1.4) * 3, lag = sin(t * 1.4 - 0.9), lag2 = sin(t * 1.4 - 1.8), shut = hu > 0.3 || blinkAt(t, 5);
  const jaw = happy ? 0 : a1 > 0.05 ? 3 + bump(a1) * 4 : (0.6 + talk) * (1 + abs(sin(t * 10)) * 2.6) * (a > 0 ? 0.3 : 1);   // pratar jämt
  g.push(hu * 2, -hov, hu * 0.08, happy ? 0.86 : 1);
  if (happy) {                                           // regnbåge bakom den lilla, tysta kungen
    g.begin(); [C.red, C.orange, C.fire2, C.leaf, R('#4aa3d8'), C.purple].forEach((c, i) => { const r0 = 70 - i * 4; g.ell(0, -20, r0, r0, c, false, (dx, dy, d2) => dy < 0 && d2 > ((r0 - 4) / r0) ** 2, 4); }); g.end({ outline: false, edge: false });
  }
  g.begin();                                             // mantel med hermelinkant, fladdrar efter
  const f1 = lag * 3, f2 = lag2 * 5;
  g.poly([[0, -72], [30, -70], [44 + f1, -44], [56 + f2, -14], [40 + f2, -8], [24 + f1, -12], [10, -18]], cape, 2);
  g.poly([[56 + f2, -14], [58 + f2, -6], [40 + f2, 0], [22 + f1, -4], [24 + f1, -12], [40 + f2, -8]], C.white, 5); for (const u of [0.2, 0.5, 0.8]) g.dot(26 + f1 + u * 28, -6 - u * 2, C.dark, 0);
  g.end();
  if (storm) { g.begin(); for (let i = 0; i < 9; i++) { const ph = (t * 1.6 + i * 0.37) % 1; g.rect(-40 + i * 10 - ph * 4, 2 + ph * (hov + 4), 1, 4, C.ice, 5); } g.end({ outline: false, edge: false }); }   // regn
  g.begin();                                             // molntronen han svävar på, med en svans som släpar
  g.ell(54 + lag2 * 3, -1 + lag2 * 2, 7, 4.5, base); g.ell(42 + lag * 2, -4 + lag, 11, 7, base);
  g.ell(-30, -8, 22, 10, base); g.ell(26, -9, 24, 11, base); g.ell(-2, -5, 30, 12, base); g.ell(-12, -14, 20, 10, base);
  g.end();
  if (storm && step(t, 11)) { g.begin(); g.poly([[-8, -8], [-2, -8], [-6, -2], [0, -2], [-10, 8], [-7, 0], [-12, 0]], C.fire2, 5); g.end(); }
  g.begin();                                             // bortre arm: viftar med när han pratar, hyssjar vid seger
  const fh = happy ? [-25, -70] : [-44, -70 + sin(t * 5) * 4 - wind * 6];
  tube(g, [-14, -56], [-34, -52], fh, 7, 5, cl, 6, true, 2); g.ell(fh[0], fh[1], 5.5, 5, cl); if (happy) g.rect(fh[0] - 1, fh[1] - 9, 3, 7, cl, 4); else g.rect(fh[0] - 3, fh[1] - 9, 3, 6, cl, 4);
  g.end();
  g.begin();                                             // kropp: runda moln, guldskärp med ädelsten
  g.ell(16, -34, 22, 19, cl); g.ell(-14, -32, 21, 17, cl); g.ell(0, -42, 30, 26, cl);
  g.poly([[-27, -30], [29, -32], [30, -25], [-27, -23]], C.gold, 3); g.ell(-8, -27, 4, 4, C.red); g.dot(-10, -29, C.white, 5);
  g.end();
  g.begin();                                             // huvud med molnlockar
  g.ell(-2, -80, 24, 20, cl); g.ell(-17, -94 + lag * 0.6, 9, 8, cl); g.ell(14, -93 + lag * 0.6, 10, 8, cl); g.ell(22, -80, 8, 9, cl);
  g.end();
  // Krona: guppar efter, glider på sned i stormskepnad och ramlar ner över örat vid seger.
  g.push(happy ? 14 : -1, (happy ? -96 : -100) + lag * 1.5, happy ? 0.6 : storm ? 0.32 : 0.1 + lag * 0.03);
  g.begin();
  g.rect(-12, -6, 24, 7, C.gold, 3); for (const x of [-12, -4, 4]) g.poly([[x, -6], [x + 4, -15], [x + 8, -6]], C.gold, 4);
  g.ell(0, -2, 2.4, 2.4, C.red, false, null, 4); g.ell(-8, -2, 1.6, 1.6, C.cyan, false, null, 4); g.ell(8, -2, 1.6, 1.6, C.cyan, false, null, 4);
  for (const x of [-8, 0, 8]) g.ell(x, -16, 1.8, 1.8, C.white, false, null, 5);
  g.end();
  g.pop();
  g.begin();                                             // ansikte
  if (happy) { happyEye(g, -20, -86, 6); happyEye(g, -8, -85, 6); }
  else { const col = storm ? C.fire2 : C.white, md = storm ? 'arg' : null; eye(g, -20, -88, 6, 7, { shut, col, pw: 2, ph: 3, dy: 2, mood: md, inner: 1, lid: cl }); eye(g, -8, -87, 6, 7, { shut, col, pw: 2, ph: 3, dy: 2, mood: md, inner: -1, lid: cl }); }
  g.ell(-21, -92 - (storm ? 0 : 2), 5, 2.6, base, false, null, 4); g.ell(-6, -91 - (storm ? 0 : 2), 5, 2.6, base, false, null, 4);       // buskiga molnögonbryn
  g.ell(-20, -78, 5, 4, nose);
  if (happy) g.rect(-22, -68, 8, 1, C.dark, 0); else g.ell(-19, -66 + jaw * 0.5, 6, 1.5 + jaw, C.dark, false, null, 0);
  if (jaw > 3) g.rect(-22, -64 + jaw, 6, 2, C.pink, 3);
  g.end();
  g.begin();                                             // mustasch och skägg: skägget följer käken, mustaschen studsar efter
  g.ell(-18, -56 + jaw * 0.9, 13, 9, cl); g.ell(-5, -54 + jaw * 0.7, 11, 9, cl); g.ell(-12, -47 + jaw * 0.8 + lag, 8, 7, cl);
  g.end();
  g.begin();
  g.ell(-30, -72 + lag2 * 1.2, 9, 5, cl); g.ell(-38, -75 + lag2 * 2, 4, 4, cl); g.ell(-9, -71 + lag * 1.2, 9, 5, cl); g.ell(0, -74 + lag * 2, 4, 4, cl);
  g.end();
  // Närmre arm med spira (åskledare med stjärna). Höjs och pekas fram när blixten slår.
  const nh = happy ? [-44, -32] : [-34 + wind * 8 - max(0, s) * 8, -46 - wind * 26 - max(0, s) * 12];
  const ang = happy ? -0.5 : -0.25 + wind * 0.8 - max(0, s) * 1.05, sn = sin(ang), cs = cos(ang), tipP = [nh[0] + 46 * sn, nh[1] - 46 * cs];
  g.begin(); g.push(nh[0], nh[1], ang); g.thick(0, 16, 0, -38, 2.6, C.gold, 3); g.ell(0, -38, 3.4, 3.4, C.gold);
  g.poly([[0, -52], [2.5, -45], [9, -44], [3.5, -40], [5, -33], [0, -37], [-5, -33], [-3.5, -40], [-9, -44], [-2.5, -45]], storm || a > 0.3 ? C.fire2 : C.gold, 5);
  g.pop(); g.end();
  g.begin(); tube(g, [16, -56], [4, -34], [nh[0] + 2, nh[1] + 2], 7.5, 6, cl, 7); g.ell(nh[0], nh[1], 6.5, 6, cl); g.end();
  // Pratbubblor: stiger i vila (han pladdrar jämt), forsar fram i pladderstormen. Tyst vid seger: bara ett litet z.
  g.begin();
  if (happy) { glyph(g, -40, -96 + Math.round(sin(t * 2) * 2), ZED, C.white, 5, 1.5); glyph(g, -50, -108 + Math.round(sin(t * 2 + 1) * 2), ZED, C.white, 5, 1); }
  else if (a1 > 0.1) for (let i = 0; i < 8; i++) { const u = a1 * 1.5 - 0.15 - i * 0.1; if (u <= 0 || u > 1) continue; const x = -30 - u * 104, y = -66 + sin(i * 1.9 + u * 5) * 9 + u * u * 40, r = 5 + u * 6; g.ell(x, y, r * 1.25, r, C.white, false, null, 5); glyph(g, x - 4, y - 2, i % 3 === 0 ? ['#', '#', '.', '#'] : SQUIG, storm ? C.red : C.ink, 2, r > 8 ? 1.5 : 1); }
  else if (a === 0) for (let i = 0; i < 3; i++) { const ph = (t * 0.45 + i / 3) % 1, x = -34 - ph * 30 + sin(ph * 6 + i * 2) * 3, y = -70 - ph * 40, r = 4 + ph * 4; g.ell(x, y, r * 1.3, r, C.white, false, null, 5); glyph(g, x - 3, y - 1, SQUIG, storm ? C.red : C.ink, 2, 1); }
  g.end();
  if (kind === 0 && a > 0.52) {                          // blixten: från spirans topp ner mot hjälten
    const u = (a - 0.52) / 0.48, x0 = tipP[0], y0 = tipP[1], x1 = x0 - 74, y1 = hov - 4, n = 6, on = u < 0.7 || step(t, 40);
    if (on) {
      const pts = [], back = [];
      for (let i = 0; i <= n; i++) { const q = i / n, x = x0 + (x1 - x0) * q + (i % 2 ? 7 : -5) * (i > 0 && i < n), y = y0 + (y1 - y0) * q; pts.push([x, y - 3 + q * 2]); back.unshift([x + 4 - q * 3, y + 3 - q * 2]); }
      g.begin(); g.poly(pts.concat(back), C.fire2, 5); g.end();
      g.begin(); for (let i = 0; i < 6; i++) { const an = i * 1.05 + t * 9; g.rect(x1 + cos(an) * (6 + u * 10), y1 + sin(an) * (4 + u * 6), 2, 2, C.white, 5); } g.end({ outline: false, edge: false });
    }
  }
  g.pop();
}

// ====================================================================================================
// ROSTER: samma postformat och samma id som bossarna i game/enemies.js, så att de kan bytas in senare.
// Nya valfria fält: attacks (namn på attack 0 och 1), was (namnet i game/enemies.js), mapName (namnet i game/map/data.js).
// Kartans bossar är sex. De gamla extrabossarna magmus och skuggriddaren har ingen motsvarighet här.
// ====================================================================================================
const E = (id, name, world, h, w, draw, extra = {}) => ({ id, name, world, tier: 'boss', h, w, count: 1, fly: false, draw, ...extra });

export const ROSTER_BOSSES = [
  E('glomsk', 'The Forgetful Troll', 0, 166, 125, troll, { attacks: ['Club slam', 'Stomp'], was: 'Trollet Glömsk', mapName: 'The Forgetful Troll' }),
  E('gatfull', 'The Riddle Sphinx', 1, 122, 189, sphinx, { attacks: ['Paw swipe', 'Riddle glare'], was: 'Sfinxen Gåtfull', mapName: 'The Riddle Sphinx' }),
  E('blubb', 'The Mumbling Witch', 2, 163, 115, witch, { attacks: ['Ladle fling', 'Mumble bubbles'], was: 'Slemkungen Blubb', mapName: 'The Mumbling Witch' }),
  E('frostina', 'The Shivering Giant', 3, 168, 122, giant, { attacks: ['Sneeze', 'Snowball'], was: 'Isdrottningen Frostina', mapName: 'The Ice Giant' }),
  E('punktum', 'The Word Dragon', 4, 161, 207, dragon, { attacks: ['Fire breath', 'Full stop'], was: 'Draken Punktum', mapName: 'The Word Dragon' }),
  E('askar', 'The Babbling Cloud King', 5, 138, 128, cloudking, { attacks: ['Lightning', 'Babble storm'], was: 'Stormkungen Åskar', mapName: 'The Babbling Cloud King', fly: true }),
];
export const BOSS_BY_ID = Object.fromEntries(ROSTER_BOSSES.map((e) => [e.id, e]));
