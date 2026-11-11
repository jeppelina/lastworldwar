// Titelskärm och introfilm för The Last World War, plus kejsaren som återanvändbar figur.
// Allt ritas med pixelmotorn (G) på en canvas i låg upplösning som skalas upp i hela pixlar.
// Scenernas höjd är ungefär 128 logiska pixlar och bredden följer elementets proportioner,
// så samma scen fyller både en bred mobil (cirka 282x130) och en iPad (cirka 171x128).
// Därför är varje scen komponerad kring mitten (cx) och kanterna är utfyllnad.
import { G, ramp as R } from './pixel.js';
import { drawHero } from './hero.js';
import { drawBackdrop, drawAmbient } from './backdrops.js';

// Replikerna. Ljudet genereras ur just den här listan av prototypes/audio/gen_intro.py
// (game/audio/intro/<id>.mp3), så ändra texten här och kör skriptet igen.
// dur = hur länge scenen visas i sekunder om ingen trycker.
export const LINES = [
  { id: 'book', en: 'Long ago, all words lived in one big book.', sv: 'För länge sedan bodde alla ord i en stor bok.', dur: 6 },
  { id: 'emperor', en: 'The Emperor wanted their power.', sv: 'Kejsaren ville ha deras kraft.', dur: 6 },
  { id: 'broke', en: 'The book broke! The words flew away.', sv: 'Boken sprack! Orden flög iväg.', dur: 6.5 },
  { id: 'star', en: 'He has one star. He wants three.', sv: 'Han har en stjärna. Han vill ha tre.', dur: 6.5 },
  { id: 'page', en: 'You found a little book.', sv: 'Du hittade en liten bok.', dur: 6 },
  { id: 'find', en: 'Find the words!', sv: 'Hitta orden!', dur: 5 },
];

// ---------- Småverktyg ----------
const { sin, cos, PI, abs, max, min, floor, ceil, round, sqrt, hypot, atan2 } = Math;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const fract = (v) => v - floor(v);
const mod = (a, b) => ((a % b) + b) % b;
const hash = (i, s = 0) => fract(sin(i * 127.1 + s * 311.7 + 1.3) * 43758.5453);
const vn = (x, s) => { const i = floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; };
const fbm = (x, s, oct = 3) => { let a = 0, w = 0, amp = 1; for (let o = 0; o < oct; o++) { a += vn(x * (1 << o), s + o * 17) * amp; w += amp; amp *= 0.5; } return a / w; };
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;      // ordnat raster 4x4
const MIX = new Map();
function mix(a, b, t) {
  const key = a + b + t.toFixed(3); let v = MIX.get(key);
  if (!v) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = (sh) => round(((A >> sh) & 255) + ((((B >> sh) & 255) - ((A >> sh) & 255)) * t));
    v = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1); MIX.set(key, v);
  }
  return v;
}

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), gold: R('#f2b632'), spark: R('#ffd84a'), star: R('#ffe98a'), red: R('#d8433b'),
  fire: R('#ff7a1f'), rag: R('#a08a64'), rag2: R('#7a6248'), rag3: R('#8a9a6a'), rope: R('#d8c08a'),
  cream: R('#f6ecd2'), ink: R('#b89a5a'), leather: R('#8a3b2e'), teal: R('#2f8fa8'), stone: R('#9a96b0'), pink: R('#ee8fa8'),
};
const LOOKS = [
  { skin: '#f3c7a2', hair: '#6b4426', style: 'spiky' },
  { skin: '#f0bd93', hair: '#e9c463', style: 'short' },
  { skin: '#e9b48c', hair: '#b5532a', style: 'bowl' },
];

// ---------- Råmålning (exakta hexfärger, används inom en del utan kontur och kantljus) ----------
function sky(g, W, y0, y1, stops, N = 10) {
  const cols = [];
  for (let i = 0; i < N; i++) { const f = (i / (N - 1)) * (stops.length - 1), j = min(floor(f), stops.length - 2); cols.push(R(mix(stops[j], stops[j + 1], f - j))); }
  for (let y = y0; y < y1; y++) {
    const f = max(0, ((y - y0) / (y1 - y0)) * N - 0.5), i = floor(f), t = (f - i - 0.2) / 0.6;
    for (let x = 0; x < W; x++) g.set(x, y, cols[min(N - 1, t > bay(x, y) ? i + 1 : i)], 3);
  }
}
function ridge(W, base, amp, wl, seed, oct = 3, ridged = false) {
  const top = new Float32Array(W);
  for (let x = 0; x < W; x++) { let v = fbm((x + 1000) / wl, seed, oct); if (ridged) v = 1 - abs(v * 2 - 1); top[x] = base - amp * v; }
  return top;
}
// Fyller från profilen ner till yb. rim: överkantsrad. lit/shade: sluttningsljus. haze: rastreras mot disfärg nertill.
function fill(g, W, top, yb, hex, o = {}) {
  const c = R(hex), rim = o.rim ? R(o.rim) : -1, lit = o.lit ? R(o.lit) : -1, sh = o.shade ? R(o.shade) : -1, hz = o.haze ? R(o.haze) : -1, hh = o.hazeH || 1, sd = o.sd || 4;
  for (let x = 0; x < W; x++) {
    const y0 = round(top[x]), sl = top[min(W - 1, x + 1)] - top[max(0, x - 1)];
    for (let y = max(0, y0); y < yb; y++) {
      const d = y - y0; let cc = c;
      if (d < sd * (0.45 + 0.6 * bay(x, y))) { if (sl > 0.35 && sh >= 0) cc = sh; else if (sl < -0.35 && lit >= 0) cc = lit; }
      if (d === 0 && rim >= 0) cc = rim;
      if (hz >= 0 && yb - y <= hh && bay(x, y) > (yb - y) / hh) cc = hz;
      g.set(x, y, cc, 3);
    }
  }
}
function disc(g, cx, cy, rx, ry, hex, dither = 1) {
  const c = R(hex);
  for (let y = floor(cy - ry); y <= ceil(cy + ry); y++) for (let x = floor(cx - rx); x <= ceil(cx + rx); x++) {
    const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
    if (dx * dx + dy * dy <= 1 && (dither >= 1 || bay(x, y) < dither)) g.set(x, y, c, 3);
  }
}
// Mjuk rastrerad gloria: tätast i mitten.
function halo(g, cx, cy, r, hex, dens = 1) {
  const c = R(hex);
  for (let y = floor(cy - r); y <= ceil(cy + r); y++) for (let x = floor(cx - r); x <= ceil(cx + r); x++) {
    const d = hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d <= 1 && bay(x, y) < (1 - d) * dens) g.set(x, y, c, 3);
  }
}
function box(g, x, y, w, h, hex) { const c = R(hex); for (let yy = round(y); yy < round(y) + h; yy++) for (let xx = round(x); xx < round(x) + w; xx++) g.set(xx, yy, c, 3); }
// Stackmoln med platt botten: överkant, kropp och underkant i var sin ton.
function cloud(g, cx, by, w, h, cols, seed) {
  const top = R(cols[0]), body = R(cols[1]), sh = R(cols[2]), nC = max(3, round(w / 7)), cs = [];
  for (let i = 0; i < nC; i++) { const u = i / (nC - 1); cs.push([cx - w / 2 + u * w, h * (0.34 + 0.66 * sin(u * PI)) * (0.75 + 0.35 * hash(i, seed + 40))]); }
  for (let x = floor(cx - w / 2 - h); x <= ceil(cx + w / 2 + h); x++) {
    let t = Infinity;
    for (const [ccx, r] of cs) { const dx = x - ccx; if (abs(dx) < r) t = min(t, by - r * 0.45 - sqrt(r * r - dx * dx)); }
    if (t === Infinity) continue;
    const y0 = round(t), ys = by - max(1, round((by - y0) * 0.3)) - ((x >> 1) & 1);
    for (let y = y0; y <= by; y++) g.set(x, y, y === y0 ? top : y > ys ? sh : body, 3);
  }
}
// Rastrerade ljusstrålar ut från en punkt.
function rays(g, cx, cy, r0, r1, n, rot, hex, dens, yMax = 1e9) {
  const c = R(hex);
  for (let y = floor(cy - r1); y <= min(yMax, ceil(cy + r1)); y++) for (let x = floor(cx - r1); x <= ceil(cx + r1); x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = hypot(dx, dy);
    if (d < r0 || d > r1) continue;
    const u = fract(((atan2(dy, dx) + rot) / (2 * PI)) * n + 10);
    if (u < 0.5 && bay(x, y) < dens * (1 - (d - r0) / (r1 - r0)) * (1 - abs(u - 0.25) * 3)) g.set(x, y, c, 3);
  }
}
// Additivt sken efter att bilden målats (tre ringar i hela pixlar, som färgmatematiken i en 16-bitarsmaskin).
function glow(ctx, x, y, r, rgb, a = 0.16) {
  ctx.globalCompositeOperation = 'lighter'; x = round(x); y = round(y);
  for (const [k, al] of [[1, a * 0.45], [0.68, a * 0.75], [0.38, a]]) {
    ctx.fillStyle = `rgba(${rgb},${al})`; const rr = r * k;
    for (let j = -floor(rr); j <= floor(rr); j++) { const w = floor(sqrt(rr * rr - j * j)); ctx.fillRect(x - w, y + j, 2 * w + 1, 1); }
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ---------- Pixelbokstäver ----------
const F5 = {   // 5x7, titeln
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'], O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'], A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
};
const F3 = {   // 3x5, de små orden som flyger
  A: '.#.#.#####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###', G: '.###..#.##.#.##',
  H: '#.##.#####.##.#', I: '###.#..#..#.###', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.', R: '##.#.###.#.##.#', S: '.###...#...###.',
  T: '###.#..#..#..#.', U: '#.##.##.##.####', W: '#.##.#######.##', Y: '#.##.#.#..#..#.',
};
const WORDS = ['CAT', 'DOG', 'SUN', 'BEE', 'COW', 'HAT', 'BED', 'CAR', 'BIG', 'RED', 'YES', 'BAT'];
function word3(g, s, x, y, rp, lv = 5) {
  x = round(x - (s.length * 4 - 1) / 2); y = round(y - 2);
  for (let k = 0; k < s.length; k++) { const f = F3[s[k]]; if (!f) continue; for (let i = 0; i < 15; i++) if (f[i] === '#') g.set(x + k * 4 + (i % 3), y + floor(i / 3), rp, lv); }
}
// Gnista: 0 = en pixel, 1 = litet kors, 2 = stort kors med vit kärna.
function spark(g, x, y, size, rp = C.spark) {
  x = round(x); y = round(y);
  if (size <= 0) { g.set(x, y, rp, 4); return; }
  g.set(x, y, C.white, 5);
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { g.set(x + dx, y + dy, rp, 4); if (size > 1) g.set(x + dx * 2, y + dy * 2, rp, 3); }
}

// ---------- Stjärndelen ----------
// En fyruddig stjärnskärva (långa uddar upp och ner, korta åt sidorna). Kejsaren håller en, och tre hör ihop.
function shard(g, cx, cy, r, rp, lv, rot = 0) {
  const pts = [];
  for (let i = 0; i < 8; i++) { const a = rot + i * PI / 4 - PI / 2, rr = i % 2 ? r * 0.3 : i % 4 === 0 ? r : r * 0.72; pts.push([cx + cos(a) * rr, cy + sin(a) * rr]); }
  g.poly(pts, rp, lv);
}

// ====================================================================================================
// KEJSAREN
// ====================================================================================================
// Fötterna i origo, vänd åt vänster, ungefär 121 pixlar hög i skala 1 (skala med g.push).
// pose: { menace: 0..1   höjer stjärnskärvan, ögonen lyser starkare och manteln fladdrar mer
//         hand: [x, y]   valfritt: exakt var den främre handen ska vara (styr över menace)
//         sil: true      ren silhuett (bara ögon och skärva lyser), för att skymta långt borta
//         shard: false   utan stjärnskärva }
// Efteråt finns g.anchor.shard och g.anchor.eyes (skärmkoordinater) för den som vill lägga sken ovanpå.
export function drawEmperor(g, t = 0, pose = {}) {
  const m = clamp(pose.menace ?? 0), sil = !!pose.sil;
  const A = R(sil ? '#231a40' : '#4a3f78'), A2 = R(sil ? '#1a1432' : '#2f2752'), CP = R(sil ? '#2a1438' : '#a8243f'), CL = R(sil ? '#1c0f2a' : '#6a1838');
  const TR = R(sil ? '#3a2c5e' : '#e0aa3c'), EYE = R('#ffc23a'), GEM = R(sil ? '#3a2c5e' : '#e8433b');
  const b = sin(t * 2) > 0.3 ? 1 : 0, w = 1 + m * 0.8;
  const f = sin(t * 1.7) * w, f2 = sin(t * 1.7 - 1.1) * w, f3 = sin(t * 1.7 - 2.2) * w;

  // Mantel: bred, fladdrar bakåt (åt höger), sicksackfåll
  g.begin();
  g.poly([[-11, -85 + b], [12, -87 + b], [21, -70], [30 + f, -46], [39 + f2 * 2, -20], [45 + f3 * 3, -4],
    [37 + f3 * 3, -9], [34 + f3 * 2, 1], [27 + f2 * 2, -7], [22 + f2 * 2, 2], [15 + f, -6], [10, 1], [3, -5], [-4, 1], [-10, -5], [-16, 1], [-21 - f, -5], [-27 - f2, 0],
    [-25 - f, -30], [-20, -62], [-14, -78]], CL, 2);
  g.poly([[12, -87 + b], [21, -70], [30 + f, -46], [39 + f2 * 2, -20], [45 + f3 * 3, -4], [37 + f3 * 3, -9], [32 + f2 * 2, -28], [24 + f, -52], [16, -72]], CP, 3);
  g.poly([[14, -60], [22 + f, -36], [27 + f2 * 2, -7], [22 + f2 * 2, 2], [18 + f, -30]], CP, 2);
  // Hög krage bakom huvudet
  g.poly([[-12, -84 + b], [-21, -106 + b], [-11, -97 + b], [0, -90 + b], [10, -97 + b], [21, -107 + b], [13, -84 + b]], CP, 3);
  g.poly([[-21, -106 + b], [-11, -97 + b], [-12, -93 + b]], TR, 4); g.poly([[21, -107 + b], [10, -97 + b], [11, -93 + b]], TR, 3);
  g.end();

  // Främre armen (håller skärvan): axel, armbåge och hand med enkel tvåledad räckvidd
  const S = [-12, -80 + b];
  const Hd = pose.hand || [lerp(-24, -40, ease(m)), lerp(-58, -84, ease(m)) + b];
  const dx = Hd[0] - S[0], dy = Hd[1] - S[1], d = min(31.5, hypot(dx, dy)), L = 16, hh = sqrt(max(0, L * L - (d / 2) * (d / 2)));
  const ux = dx / (hypot(dx, dy) || 1), uy = dy / (hypot(dx, dy) || 1), sgn = -uy * 1 > 0 ? 1 : 1;
  let E = [S[0] + ux * d / 2 - uy * hh * sgn, S[1] + uy * d / 2 + ux * hh * sgn];
  if (E[1] < S[1] + uy * d / 2) E = [S[0] + ux * d / 2 + uy * hh, S[1] + uy * d / 2 - ux * hh];   // armbågen ska hänga nedåt
  const HP = [S[0] + ux * d, S[1] + uy * d], fx = (HP[0] - E[0]) / L, fy = (HP[1] - E[1]) / L;
  g.begin();
  g.thick(S[0], S[1], E[0], E[1], 7, A, 2); g.thick(E[0], E[1], HP[0], HP[1], 6.5, A, 3);
  g.thick(E[0] + fx * 5, E[1] + fy * 5, E[0] + fx * 9, E[1] + fy * 9, 9, A, 4); g.thick(E[0] + fx * 9, E[1] + fy * 9, E[0] + fx * 10.5, E[1] + fy * 10.5, 9, TR, 3);   // handskens krage
  g.ell(E[0], E[1], 4, 4, A);
  g.end();
  // Handen: öppen klo uppåt, skärvan svävar över handflatan
  const sx = HP[0] - 1, sy = HP[1] - 15 + sin(t * 2.6) * 1.2;
  g.begin();
  g.ell(HP[0], HP[1], 4, 3.6, A2);
  g.poly([[HP[0] - 4, HP[1] - 1], [HP[0] - 8, HP[1] - 6], [HP[0] - 5, HP[1] - 5], [HP[0] - 2, HP[1] - 2]], A2, 4);
  g.poly([[HP[0] + 2, HP[1] - 2], [HP[0] + 5, HP[1] - 7], [HP[0] + 3, HP[1] - 6], [HP[0], HP[1] - 2]], A2, 3);
  g.poly([[HP[0] - 2, HP[1] - 3], [HP[0] - 3, HP[1] - 8], [HP[0] - 1, HP[1] - 6], [HP[0] + 1, HP[1] - 3]], A2, 4);
  g.end();
  if (pose.shard !== false) {
    g.begin(); halo(g, ...g.pt(sx, sy), 11 * g.t.k, '#ffe98a', 0.5 + m * 0.3); g.end({ outline: false, edge: false });
    const rot = sin(t * 1.3) * 0.2;
    g.begin(); shard(g, sx, sy - 2, 12, C.star, 4, rot); g.end();
    g.begin(); shard(g, sx, sy - 2, 6.5, C.white, 5, rot); g.end({ outline: false, edge: false });
    g.anchor.shard = g.pt(sx, sy);
  }

  // Ben och stövlar
  g.begin();
  g.poly([[-13, -46], [-4, -46], [-5, -10], [-12, -10]], A, 2); g.poly([[1, -46], [11, -46], [10, -10], [2, -10]], A, 3);
  g.poly([[-14, -30], [-8, -38], [-3, -30], [-8, -24]], A, 4); g.poly([[0, -30], [6, -38], [12, -30], [6, -24]], A, 4);     // knäskydd
  g.poly([[-22, 0], [-16, -5], [-14, -14], [-4, -14], [-3, 0]], A2, 2); g.poly([[-7, 0], [-1, -5], [0, -14], [11, -14], [12, 0]], A2, 3);
  g.rect(-14, -15, 10, 2, TR, 3); g.rect(0, -15, 11, 2, TR, 3);
  g.end();
  // Höftplåtar och tygvåd
  g.begin();
  g.poly([[-14, -53], [14, -53], [16, -38], [9, -42], [6, -35], [-6, -35], [-9, -42], [-16, -38]], A2, 3);
  g.poly([[-5, -51], [5, -51], [6, -25], [0, -18], [-6, -25]], CP, 3);
  g.poly([[-5, -27], [0, -21], [5, -27], [6, -25], [0, -18], [-6, -25]], TR, 3);
  g.poly([[-2, -37], [0, -42], [2, -37], [0, -31]], TR, 4);
  g.end();
  // Bål
  g.begin();
  g.poly([[-13, -85 + b], [13, -85 + b], [10, -52], [-10, -52]], A, 3); g.ell(0, -74 + b, 13, 10.5, A);
  g.rect(-10, -64, 20, 1, A2, 1); g.rect(-10, -59, 20, 1, A2, 1);
  g.rect(-12, -55, 24, 3, TR, 3); g.rect(-2, -56, 4, 5, TR, 5);
  // Tre fattningar på bröstet: en är fylld
  g.rect(-2, -81 + b, 3, 3, pose.shard === false ? A2 : C.star, pose.shard === false ? 1 : 5); g.rect(-6, -75 + b, 3, 3, A2, 1); g.rect(2, -75 + b, 3, 3, A2, 1);
  g.end();
  // Bakre armen: knuten näve längs sidan
  g.begin();
  g.thick(13, -80 + b, 17, -65 + b, 7, A, 3); g.thick(17, -65 + b, 15, -52 + b, 6.5, A, 3); g.thick(16.4, -61 + b, 15.6, -56 + b, 9, A, 4); g.thick(15.6, -56 + b, 15.4, -54.5 + b, 9, TR, 3);
  g.ell(15, -49 + b, 4.2, 4, A2);
  g.end();
  // Axelskydd med taggar
  g.begin();
  g.poly([[-18, -86 + b], [-27, -97 + b], [-12, -90 + b]], A, 5); g.ell(-13, -83 + b, 8.5, 6.5, A);
  g.ell(-13, -83 + b, 8.5, 6.5, TR, false, (dx, dy, d2) => d2 > 0.62 && dy > 0.25, 3);
  g.poly([[17, -87 + b], [27, -98 + b], [12, -91 + b]], A, 5); g.ell(13, -83 + b, 9, 7, A);
  g.ell(13, -83 + b, 9, 7, TR, false, (dx, dy, d2) => d2 > 0.62 && dy > 0.25, 3);
  g.end();
  // Hjälm
  const Y = -96 + b;
  g.begin();
  g.ell(-0.5, Y, 9, 9.5, A);
  g.poly([[-9, Y + 3], [-10, Y + 10], [-5, Y + 9], [-2, Y + 14], [3, Y + 9], [8, Y + 9], [8, Y + 3]], A, 2);
  g.poly([[-11, Y - 4], [5, Y - 4], [4, Y + 3], [-1, Y + 3], [-3.5, Y + 9], [-6, Y + 3], [-11, Y + 3]], C.dark, 0);     // visir
  g.poly([[-11, Y - 3], [-6, Y], [-6, Y + 2], [-11, Y]], EYE, 5); g.poly([[-2, Y], [4, Y - 3], [4, Y], [-2, Y + 2]], EYE, 5);   // sneda, lysande ögon
  if (m > 0.5) { g.dot(-9, Y - 1, C.white, 5); g.dot(1, Y - 1, C.white, 5); }
  g.end();
  // Krona: band och fem spetsar, den i mitten högst
  g.begin();
  g.poly([[-10, Y - 5], [9, Y - 5], [10.5, Y - 10], [-11.5, Y - 10]], TR, 3);
  for (const [x, h, lean] of [[-9.5, 9, -4], [-5, 14, -2], [-0.5, 21, 0], [4, 14, 2], [8.5, 9, 4]]) g.poly([[x - 2.6, Y - 9], [x + lean, Y - 10 - h], [x + 2.6, Y - 9]], TR, 4);
  g.rect(-2, Y - 9, 3, 3, GEM, 4);
  g.end();
  g.anchor.eyes = g.pt(-3.5, Y - 0.5);
}

// ====================================================================================================
// BÖCKER
// ====================================================================================================
// Den stora boken, uppslagen. Origo mitt på bokens närmsta kant (vid ryggen). Ungefär 68 bred och 27 hög.
// o: { crack: 0..1 (delad i två halvor som glider isär), lines: false (tomma sidor), t }
function drawBook(g, o = {}) {
  const cr = clamp(o.crack || 0), t = o.t || 0;
  for (const s of [-1, 1]) {
    g.push(s * cr * 11, -cr * 3 + (cr ? sin(t * 1.4 + s) * 1.5 : 0), s * cr * 0.38);
    const X = (x) => s * x;
    const tear = cr > 0 ? [[X(1), -19], [X(-1.5), -14], [X(1.5), -9], [X(-1), -4], [X(1), 4]] : [[X(0), -19], [X(0), 4]];
    g.begin();    // pärm
    g.poly([...tear, [X(15), 6], [X(34), 4], [X(31), -23], [X(13), -25]].map((p) => p), C.leather, s < 0 ? 3 : 2);
    g.rect(X(31) - (s < 0 ? 0 : 2), 1, 2, 2, C.gold, 4); g.rect(X(29) - (s < 0 ? 0 : 2), -22, 2, 2, C.gold, 4);
    g.end();
    g.begin();    // sidornas tjocklek
    g.poly([[X(0.5), 3], [X(14), 4], [X(31), 2], [X(30), -1], [X(14), 0], [X(0.5), -1]], C.cream, 2);
    g.end();
    g.begin();    // uppslaget: sidan buktar upp på mitten och dyker ner mot ryggen
    g.poly([...tear.map((p) => [p[0], p[1] - 1]).slice(0, -1), [X(tear.length > 2 ? 1 : 0), 1], [X(14), -2], [X(30), 0], [X(27), -22], [X(13), -24]], C.cream, s < 0 ? 4 : 3);
    if (o.lines !== false) for (let r = 0; r < 6; r++) {
      const y = -19 + r * 3.1;
      let x = 4 + (r > 3 ? 0.4 : 0);
      for (let wI = 0; x < 24; wI++) { const len = 2 + floor(hash(r * 7 + wI, s + 3) * 4); for (let i = 0; i < len && x + i < 25 + r * 0.4; i++) g.dot(X(x + i) - (s > 0 ? 1 : 0), round(y - (x + i > 8 ? 1 : 0) + (x + i > 20 ? 1 : 0)), C.ink, hash(r, wI) < 0.25 ? 3 : 2); x += len + 1.6; }
    }
    g.rect(s < 0 ? -2 : 0, -19, 2, 20, C.cream, 2);    // skugga i vecket
    g.end();
    g.pop();
  }
  if (!cr) { g.begin(); g.poly([[-1, 2], [2, 2], [2, 10], [0.5, 8], [-1, 10]], C.red, 4); g.end(); }   // bokmärke
}
// Stensockeln som boken svävar över. Origo mitt på sockelns fot.
function drawPedestal(g, rp = C.stone, broken = false) {
  g.begin();
  g.poly([[-11, 0], [11, 0], [9, -3], [-9, -3]], rp, 2); g.rect(-6, -13, 12, 10, rp, 3); g.rect(-6, -13, 3, 10, rp, 4); g.rect(3, -13, 3, 10, rp, 2);
  g.poly([[-10, -13], [10, -13], [11, -17], [-11, -17]], rp, 4);
  if (broken) { g.line(-1, -17, 1, -12, C.dark, 0); g.line(1, -12, -1, -7, C.dark, 0); }
  g.end();
}
// Page: den lilla tomma boken med korta ben. Fötterna i origo, uppslagen mot oss, ungefär 17 hög.
// o: { back: true (sedd bakifrån), shut: true (blundar), hop: pixlar upp i luften }
function drawPage(g, t = 0, o = {}) {
  const hop = o.hop || 0, wag = round(sin(t * 3) * 1);
  g.push(0, -hop);
  g.begin(); g.rect(-5, -3, 2, 3, C.dark, 1); g.rect(3, -3, 2, 3, C.dark, 1); g.rect(-7, -1, 3, 1, C.dark, 1); g.rect(2, -1, 3, 1, C.dark, 1); g.end();
  g.begin();
  g.poly([[-10, -16], [0, -14], [10, -16], [10, -3], [0, -2], [-10, -3]], C.teal, 3);
  if (o.back) { g.rect(-1, -14, 2, 12, C.teal, 2); g.rect(-9, -14, 2, 2, C.gold, 4); g.rect(7, -14, 2, 2, C.gold, 4); }
  g.end();
  if (!o.back) {
    g.begin();
    g.poly([[-9, -17], [-0.5, -15], [-0.5, -4], [-9, -5]], C.cream, 4); g.poly([[0.5, -15], [9, -17], [9, -5], [0.5, -4]], C.cream, 3);
    if (o.shut) { g.rect(-6, -11, 3, 1, C.dark, 0); g.rect(3, -11, 3, 1, C.dark, 0); }
    else { g.rect(-6, -13, 2, 3, C.dark, 0); g.dot(-6, -13, C.white, 5); g.rect(3, -13, 2, 3, C.dark, 0); g.dot(3, -13, C.white, 5); }
    g.dot(-8, -9, C.pink, 3); g.dot(-7, -9, C.pink, 3); g.dot(6, -9, C.pink, 3); g.dot(7, -9, C.pink, 3);
    g.rect(-2, -8, 4, 1, C.dark, 0); g.dot(-3, -9, C.dark, 0); g.dot(2, -9, C.dark, 0);
    g.end();
  }
  g.begin(); g.poly([[4, -16], [6, -16], [6, -21 + wag], [5, -20 + wag], [4, -21 + wag]], C.red, 4); g.end();   // bokmärke som tofs
  g.pop();
}

// ====================================================================================================
// BARNEN BAKIFRÅN OCH TORNET I FJÄRRAN
// ====================================================================================================
// Ett barn i trasor sett bakifrån. Fötterna i origo, ungefär 31 hög i skala 1. o: { point: pekar åt höger, hold: håller upp armen }
function drawKidBack(g, look, t, o = {}) {
  const skin = R(look.skin), hair = R(look.hair), b = sin(t * 2.2 + (o.ph || 0)) > 0.3 ? 1 : 0, wv = round(sin(t * 1.5 + (o.ph || 0)) * 1);
  g.begin();
  g.rect(-5, -9, 4, 4, C.rag2, 2); g.rect(1, -9, 4, 4, C.rag2, 3);
  g.rect(-4, -5, 2, 4, skin, 2); g.rect(2, -5, 2, 4, skin, 3);
  g.rect(-5, -2, 4, 2, skin, 2); g.rect(1, -2, 4, 2, skin, 3);
  g.end();
  g.begin();
  if (o.point) g.thick(5.5, -17 + b, 12, -21 + b, 2.8, skin, 3); else g.thick(6, -17 + b, 7.5, -10 + b, 2.8, skin, 3);
  g.thick(-6, -17 + b, -7.5, -10 + b, 2.8, skin, 2);
  g.end();
  g.begin();
  g.poly([[-5.5, -19 + b], [5.5, -19 + b], [6.5, -8], [-6.5, -8]], C.rag, 3);
  for (let x = -6; x < 6; x += 2) g.rect(x + (x > 0 ? wv : 0), -8, 1, 1 + (mod(x, 4) === 0 ? 1 : 0), C.rag, 2);
  g.rect(1, -15 + b, 3, 3, C.rag3, 3); g.rect(-4, -13 + b, 2, 3, C.rag2, 2);
  g.rect(-6, -11, 12, 1, C.rope, 4);
  g.end();
  g.begin();
  const Y = -24.5 + b;
  if (look.style === 'long') g.poly([[-6, Y], [6, Y], [5, Y + 10], [-5, Y + 10]], hair, 2);
  g.rect(-1.5, Y + 4, 3, 3, skin, 2);
  g.ell(0, Y, 6.2, 5.8, skin, 0.75);
  g.ell(0, Y, 6.8, 6.3, hair, true, (dx, dy) => dy < (look.style === 'bowl' ? 0.45 : 0.25) || (abs(dx) < 0.55 && dy < 0.6));
  if (look.style === 'spiky') for (const [x, tx, ty] of [[-5, -6, 4], [-2, -2, 5], [2, 3, 5], [4, 7, 3]]) g.poly([[x - 1, Y - 4], [tx, Y - 5 - ty], [x + 3, Y - 4]], hair, 4);
  g.end();
}
// Kejsarens torn som liten siluett vid horisonten. Origo vid klippans fot, ungefär 34 hög i skala 1.
// Tre spetsar överst, som kronan.
function drawFarTower(g, c, lv = 3) {
  g.poly([[-12, 4], [-7, -3], [-3, -6], [3, -5], [7, -1], [13, 4]], c, lv);
  g.poly([[-2.5, -4], [2.5, -4], [2, -22], [-2, -22]], c, lv);
  g.poly([[-4, -22], [4, -22], [4.5, -25], [-4.5, -25]], c, lv);
  g.poly([[-4.5, -25], [-4, -30], [-2, -25]], c, lv); g.poly([[-1.5, -25], [0, -34], [1.5, -25]], c, lv); g.poly([[2, -25], [4, -30], [4.5, -25]], c, lv);
  g.poly([[-7, -2], [-4, -2], [-4.2, -13], [-5.5, -17], [-6.8, -13]], c, lv); g.poly([[4, -2], [7, -1], [6.8, -10], [5.5, -14], [4.2, -10]], c, lv);
}

// ====================================================================================================
// SCENER
// ====================================================================================================
// Varje scen: build(W, H) ger ett tillstånd med färdigmålad bakgrund (st.bg), draw(g, st, t) ritar det
// rörliga ovanpå, post(ctx, st, t) lägger sken efter målningen. t är sekunder sedan scenen började.

// ---------- Utsikten: titelskärmen (skymning) och slutscenen (gryning) ----------
const DUSK = {
  sky: ['#0d0b30', '#1f1856', '#46297a', '#8c3f74', '#dc7050', '#ffc078'], m1: '#6a4688', m1lit: '#8a5a92', haze: '#c26a70', m2: '#3b2b64', haze2: '#6a3f72',
  tower: '#181230', h1: '#2c2656', h1rim: '#57467f', h2: '#221d48', h2rim: '#463a74', tree: ['#2c2558', '#1d193f', '#15122f'], fg: '#110e28', fgRim: '#5a4476',
  cloud: ['#553b82', '#77508f', '#e58e6c'], crack: '#ff6a3a', burnt: '#17112c', stars: 70, sun: '#ffdc96',
};
const DAWN = {
  sky: ['#27307c', '#4658b8', '#8a7ad0', '#f09ca0', '#ffd696', '#fff2c0'], m1: '#7b78c2', m1lit: '#a79bd8', haze: '#f2bfae', m2: '#56589c', haze2: '#9a86b8',
  tower: '#2a2252', h1: '#4c8a6c', h1rim: '#90d08c', h2: '#38705a', h2rim: '#6cb07c', tree: ['#4c9068', '#2f6650', '#234c40'], fg: '#1c3a3a', fgRim: '#62a070',
  cloud: ['#fff4e4', '#ffd6c4', '#e89cb2'], crack: '#ff6a3a', burnt: '#2a2a4a', stars: 14, sun: '#fffbe0',
};
function vista(pal, o) {
  return {
    build(W, H) {
      const bg = new G(W, H), cx = W >> 1, hy = round(H * 0.6), tx = max(cx + 34, round(W * 0.76)), kx = round(W * (o.solo ? 0.34 : 0.27));
      bg.begin();
      sky(bg, W, 0, hy + 3, pal.sky, 12);
      disc(bg, tx - 26, hy, 58, 11, pal.sun, 0.5); disc(bg, tx - 26, hy + 1, 34, 6, pal.sun, 0.85);   // sista (eller första) ljuset bakom bergen
      const m1 = ridge(W, hy - 2, 26, 44, 11, 3, true);
      fill(bg, W, m1, hy + 3, pal.m1, { haze: pal.haze, hazeH: 12, lit: pal.m1lit, sd: 7 });
      const m2 = ridge(W, hy + 1, 10, 26, 23, 3);
      fill(bg, W, m2, hy + 8, pal.m2, { haze: pal.haze2, hazeH: 5 });
      const ty = round(m2[tx]) + 1;
      bg.push(tx, ty); drawFarTower(bg, R(pal.tower)); bg.pop();
      const h1 = ridge(W, hy + 7, 4, 40, 31);
      fill(bg, W, h1, H, pal.h1, { rim: pal.h1rim });
      disc(bg, tx, hy + 12, 30, 5, pal.burnt, 0.6); disc(bg, tx, hy + 12, 18, 3, pal.burnt, 1);        // bränd mark kring tornet
      for (let i = 0; i < 7; i++) {                                                                  // glödande sprickor
        let x = tx + (hash(i, 61) - 0.5) * 44, y = hy + 9 + hash(i, 62) * 6; const dir = hash(i, 63) < 0.5 ? -1 : 1;
        for (let j = 0, n = 3 + floor(hash(i, 64) * 5); j < n; j++) { bg.set(round(x), round(y), R(j < n - 2 ? pal.crack : '#a83a3a'), 3); x += dir; if (hash(i * 9 + j, 65) < 0.5) y += 1; }
      }
      const h2 = ridge(W, hy + 17, 6, 55, 37);
      fill(bg, W, h2, H, pal.h2, { rim: pal.h2rim });
      for (let i = 0, n = round(W / 9); i < n; i++) {                                                // dungar på närmsta åsen
        const x = floor(hash(i, 71) * W), y = round(h2[x]), r = 2 + hash(i, 72) * 2.5;
        if (abs(x - tx) < 26) { box(bg, x, y - 5, 1, 5, pal.tree[2]); bg.set(x - 1, y - 4, R(pal.tree[2]), 3); bg.set(x + 1, y - 3, R(pal.tree[2]), 3); continue; }   // döda träd nära tornet
        disc(bg, x, y - r, r + 1, r, pal.tree[1]); disc(bg, x - 1, y - r - 1, r * 0.6, r * 0.5, pal.tree[0]);
      }
      // Förgrundskullen: krön vid kx, faller av åt båda håll
      const fy = round(H * (o.solo ? 0.73 : 0.705)), fg = new Float32Array(W);
      for (let x = 0; x < W; x++) { const u = (x - kx) / (W * (x < kx ? 0.6 : 0.4)); fg[x] = fy + min(60, u * u * 15) + (fbm(x / 9, 81, 2) - 0.5) * 1.6; }
      fill(bg, W, fg, H, pal.fg, { rim: pal.fgRim });
      for (let x = 0; x < W; x++) if (hash(x, 83) < 0.3) { bg.set(x, round(fg[x]) - 1, R(pal.fgRim), 3); if (hash(x, 84) < 0.3) bg.set(x + (hash(x, 85) < 0.5 ? 1 : -1), round(fg[x]) - 2, R(pal.fgRim), 3); }
      if (W >= 225) {                                                                                // en gran ramar in bilden på breda skärmar
        const px = round(W * 0.075), by = round(fg[px]) + 2, hgt = 52;
        box(bg, px - 1, by - 8, 3, 8, pal.fg);
        for (let y = by - hgt; y < by - 5; y++) { const dd = y - (by - hgt), tier = dd % 9, hw = 1 + dd * 0.17 + tier * 0.75; for (let x = round(px - hw); x <= round(px + hw); x++) bg.set(x, y, R(x < px - hw + 1.2 && tier > 5 ? pal.fgRim : pal.fg), 3); }
      }
      bg.end({ outline: false, edge: false });
      return { bg, W, H, cx, hy, tx, ty, kx, fg, m1 };
    },
    draw(g, st, t) {
      const { W, H, cx, hy, tx, ty, kx, fg, m1 } = st;
      g.begin();
      for (let i = 0; i < pal.stars; i++) {                                                          // stjärnor som blinkar
        const x = floor(hash(i, 1) * W), y = floor(Math.pow(hash(i, 2), 1.5) * hy * 0.8), tw = sin(t * (0.8 + hash(i, 3) * 2) + i * 1.7);
        if (y > m1[x] - 3 || tw < -0.7) continue;
        g.set(x, y, C.white, tw > 0.4 ? 5 : 2);
        if (i % 8 === 0 && tw > 0.75) { g.set(x - 1, y, C.white, 2); g.set(x + 1, y, C.white, 2); g.set(x, y - 1, C.white, 2); g.set(x, y + 1, C.white, 2); }
      }
      for (let j = 0; j < 3; j++) cloud(g, mod(hash(j, 7) * (W + 90) + t * (1.4 + j * 0.7), W + 90) - 45, round(H * (0.27 + 0.075 * j)), 30 + j * 12, 4 + j, pal.cloud, j);
      // Tornets fönster och fyren i spetsen
      const fl = hash(floor(t * 7), 9);
      g.set(tx, ty - 13, C.fire, fl > 0.3 ? 5 : 3); g.set(tx - 1, ty - 19, C.fire, fl > 0.6 ? 4 : 3); g.set(tx + 5, ty - 8, C.red, 3);
      g.set(tx, ty - 35, C.red, sin(t * 2.2) > 0 ? 5 : 3); g.set(tx, ty - 36, C.fire, sin(t * 2.2) > 0.6 ? 5 : 2);
      g.end({ outline: false, edge: false });
      // Barnen på krönet
      const kids = o.kids, at = (x) => round(fg[clamp(round(x), 0, W - 1)]) + 1;
      if (o.solo) {
        g.push(kx, at(kx), 0, 1); drawKidBack(g, kids[0], t, { ph: 0 }); g.pop();
        g.push(kx + 24, at(kx + 24)); drawPage(g, t, { back: true, hop: max(0, round(sin(t * 4) * 3)) }); g.pop();
      } else {
        const spots = [[-20, 0.8, 1, {}], [-2, 1, 2, {}], [16, 0.9, 0, { point: true }]];
        for (const [dx, k, li, oo] of spots) { g.push(kx + dx, at(kx + dx) + (k > 1 ? 1 : 0), 0, k); drawKidBack(g, kids[li % kids.length], t, { ...oo, ph: dx }); g.pop(); }
      }
      // Ordgnistor som svävar uppåt
      g.begin(); st.sp = [];
      for (let i = 0, n = o.sparks; i < n; i++) {
        const sp = 3 + hash(i, 21) * 5, y = hy + 22 - mod(hash(i, 22) * (hy + 30) + t * sp, hy + 30), x = mod(hash(i, 23) * W + sin(t * 0.7 + i * 2.3) * 6 + t * 1.5, W);
        const tw = sin(t * (2 + hash(i, 24) * 2) + i), size = i % 4 === 0 ? (tw > 0 ? 2 : 1) : i % 2 ? (tw > 0.2 ? 1 : 0) : 0;
        spark(g, x, y, size); if (size > 1) st.sp.push([x, y]);
      }
      g.end({ outline: false, edge: false });
      if (o.title) drawTitle(g, cx, round(H * 0.085), t);
    },
    post(ctx, st, t) {
      glow(ctx, st.tx, st.ty - 20, 20 + sin(t * 1.3) * 2, '255,50,40', 0.11);
      glow(ctx, st.tx, st.ty - 34, 5, '255,120,60', 0.25);
      for (const [x, y] of st.sp || []) glow(ctx, x, y, 4, '255,200,80', 0.14);
    },
  };
}
// Titeln i guld med skugga, toning uppifrån och ett blänk som sveper förbi.
function drawTitle(g, cx, y, t) {
  // Två rader: "THE LAST" litet överst och "WORLD WAR" stort under. Blänket sveper över båda.
  const sweep = mod(t * 26, 260) - 30;
  const line = (s, c, yy, ph) => {
    const x0 = cx - round((s.length * 6 * c - c) / 2);
    for (const pass of [0, 1]) {
      g.begin();
      for (let k = 0; k < s.length; k++) {
        const rows = F5[s[k]], bob = round(sin(t * 1.6 - (k + ph) * 0.5) * 1);
        rows.forEach((r, jj) => { for (let i = 0; i < 5; i++) if (r[i] === '#') {
          const px = x0 + k * 6 * c + i * c, py = yy + jj * c + bob;
          if (!pass) g.rect(px + 1, py + (c > 2 ? 2 : 1), c, c, C.dark, 0);
          else { const sh = abs(px - cx + 80 + jj * c * 0.7 - sweep) < 5; g.rect(px, py, c, c, C.gold, sh ? 5 : jj < 2 ? 4 : jj > 4 ? 2 : 3); }
        } });
      }
      g.end(pass ? {} : { outline: true, edge: false });
    }
  };
  line('THE LAST', 2, y - 4, 0);
  line('WORLD WAR', 3, y + 14, 3);
}

// ---------- Ängen med sockeln: scen 1 till 3 i tre olika ljus ----------
const DAY = { sky: ['#2c58bc', '#4a84de', '#86bcf0', '#d2eaf2', '#fff0b4'], m1: '#7ea4dc', m1lit: '#a4c4ee', haze: '#d4e6f2', h1: '#6cbc58', h1rim: '#a8e07a', h2: '#4c9e48', h2rim: '#86d066', tree: ['#7cd060', '#3f9444', '#2c7440'], mound: '#3c8844', moundRim: '#92da70', stone: '#aaa6c0' };
const NIGHT = { sky: ['#07061c', '#110e36', '#241752', '#472464', '#70386e'], m1: '#291e50', m1lit: '#3a2a62', haze: '#4a2a62', h1: '#1e1a42', h1rim: '#3a3468', h2: '#181538', h2rim: '#2e2a5c', tree: ['#15122f', '#15122f', '#100e26'], mound: '#121130', moundRim: '#3a3470', stone: '#5c5884' };
const STORM = { sky: ['#0c0a28', '#201450', '#462276', '#843c84', '#c46a8a'], m1: '#37285f', m1lit: '#4a3474', haze: '#683e7c', h1: '#2a2856', h1rim: '#4a4682', h2: '#22204a', h2rim: '#3c3870', tree: ['#1c1a40', '#1c1a40', '#141230'], mound: '#1a2638', moundRim: '#46606c', stone: '#6c6890' };
function meadow(bg, W, H, pal, px, top) {
  const hy = round(H * 0.62);
  bg.begin();
  sky(bg, W, 0, hy + 3, pal.sky, 11);
  const m1 = ridge(W, hy, 20, 50, 14, 3, true); fill(bg, W, m1, hy + 3, pal.m1, { haze: pal.haze, hazeH: 10, lit: pal.m1lit, sd: 6 });
  const h1 = ridge(W, hy + 4, 6, 60, 33); fill(bg, W, h1, H, pal.h1, { rim: pal.h1rim });
  for (let i = 0, n = round(W / 8); i < n; i++) { const x = floor(hash(i, 91) * W), y = round(h1[x]) + 1, r = 2.5 + hash(i, 92) * 3; if (abs(x - px) < 18) continue; box(bg, x, y - 2, 1, 3, pal.tree[2]); disc(bg, x, y - r - 1, r + 1, r, pal.tree[1]); disc(bg, x - 1, y - r - 2, r * 0.6, r * 0.5, pal.tree[0]); }
  const h2 = ridge(W, hy + 15, 5, 70, 41); fill(bg, W, h2, H, pal.h2, { rim: pal.h2rim });
  const md = new Float32Array(W);
  for (let x = 0; x < W; x++) { const u = (x - px) / (W * 0.36 + 20); md[x] = top + min(50, u * u * 22) + (fbm(x / 8, 51, 2) - 0.5) * 1.5; }
  fill(bg, W, md, H, pal.mound, { rim: pal.moundRim });
  for (let x = 0; x < W; x++) if (hash(x, 53) < 0.3) bg.set(x, round(md[x]) - 1, R(pal.moundRim), 3);
  bg.end({ outline: false, edge: false });
  return { hy, md, m1 };
}
function twinkle(g, W, yMax, t, n, m1) {
  for (let i = 0; i < n; i++) {
    const x = floor(hash(i, 1) * W), y = floor(Math.pow(hash(i, 2), 1.4) * yMax), tw = sin(t * (0.8 + hash(i, 3) * 2) + i * 1.7);
    if ((m1 && y > m1[x] - 3) || tw < -0.7) continue;
    g.set(x, y, C.white, tw > 0.4 ? 5 : 2);
  }
}

const sceneBook = {
  build(W, H) {
    const bg = new G(W, H), cx = W >> 1, top = H - 31, m = meadow(bg, W, H, DAY, cx, top);
    bg.begin();
    for (let i = 0; i < W / 5; i++) { const x = floor(hash(i, 55) * W), y = round(m.md[x]) + 2 + floor(hash(i, 56) * 12); if (y < H) { bg.set(x, y, R(['#fff6c0', '#ff9ab0', '#ffffff'][i % 3]), 3); bg.set(x, y + 1, R('#2c7440'), 3); } }   // blommor
    bg.end({ outline: false, edge: false });
    bg.push(cx, top + 2); drawPedestal(bg); bg.pop();
    return { bg, W, H, cx, top, ...m };
  },
  draw(g, st, t) {
    const { W, H, cx, top } = st, by = top - 24 + round(sin(t * 1.5) * 2), cy = by - 12;
    g.begin();
    for (let j = 0; j < 3; j++) cloud(g, mod(hash(j, 8) * (W + 90) + t * (1.2 + j * 0.6), W + 90) - 45, round(H * (0.14 + 0.09 * j)), 28 + j * 13, 5 + j, ['#ffffff', '#f2f6ff', '#c4d6f4'], j + 3);
    rays(g, cx, cy, 20, 78, 14, t * 0.12, '#fff6c8', 0.75, top - 4);
    halo(g, cx, cy, 40, '#fff6c8', 0.45);
    g.end({ outline: false, edge: false });
    g.push(cx, by); drawBook(g, { t }); g.pop();
    // Orden stiger ur boken i en långsam spiral
    st.gl = [];
    for (let i = 0; i < 7; i++) {
      const u = fract(t * 0.07 + i / 7), a = u * 5 + i * 2.4, rad = 20 + u * 34 + (i % 3) * 4, x = cx + cos(a) * rad * 1.3, y = cy - 20 - u * 44 + sin(a) * 5;
      if (u < 0.03 || y < 7) continue;
      g.begin(); word3(g, WORDS[i % WORDS.length], x, y, u > 0.85 ? C.spark : C.white, 5); g.end({ outline: true, edge: false });
    }
    g.begin();
    for (let i = 0; i < 22; i++) { const u = fract(t * 0.16 + hash(i, 31)), a = hash(i, 32) * 6.28 + t * 0.4, rad = 8 + u * 52; const x = cx + cos(a) * rad * 1.3, y = cy - u * 30 + sin(a) * rad * 0.45; spark(g, x, y, i % 5 === 0 ? 2 : i % 2, C.spark); }
    g.end({ outline: false, edge: false });
    st.c = [cx, cy];
  },
  post(ctx, st, t) { glow(ctx, st.c[0], st.c[1], 40 + sin(t * 2) * 2, '255,230,140', 0.13); },
};

const sceneEmperor = {
  build(W, H) {
    const bg = new G(W, H), cx = W >> 1, px = cx - 50, top = H - 30, m = meadow(bg, W, H, NIGHT, px, top), mx = cx + 30, my = round(H * 0.37), mr = 43;
    bg.begin();                                                  // månen ritas in bakom bergen: bara där himlen syns
    for (let y = my - mr; y <= my + mr; y++) for (let x = mx - mr; x <= mx + mr; x++) {
      if (x < 0 || x >= W || y < 0 || y > m.m1[x] - 1) continue;
      const dx = x + 0.5 - mx, dy = y + 0.5 - my, d = hypot(dx, dy) / mr;
      if (d > 1) continue;
      const v = (-dx * 0.5 - dy * 0.8) / mr + (fbm((x + y * 0.6) / 9, 5, 2) - 0.5) * 0.5;
      bg.set(x, y, R(d > 0.93 ? '#f6e4f4' : v > 0.18 + bay(x, y) * 0.12 ? '#f0dcf0' : v < -0.3 + bay(x, y) * 0.12 ? '#b592cc' : '#d7bce2'), 3);
    }
    for (const [ox, oy, r] of [[-16, -12, 6], [12, 10, 8], [16, -20, 4], [-8, 18, 5]]) disc(bg, mx + ox, my + oy, r, r * 0.8, '#c4a4d6', 0.5);
    bg.end({ outline: false, edge: false });
    bg.push(px, top + 2); drawPedestal(bg, R(NIGHT.stone)); bg.pop();
    return { bg, W, H, cx, px, top, mx, my, mr, ...m };
  },
  draw(g, st, t) {
    const { W, H, cx, px, top, m1 } = st, me = ease((t - 0.6) / 2.6);
    g.begin();
    twinkle(g, W, st.hy * 0.9, t, 60, null);
    for (let j = 0; j < 2; j++) cloud(g, mod(hash(j, 9) * (W + 90) + t * (1.5 + j), W + 90) - 45, round(H * (0.5 + 0.07 * j)), 44 + j * 16, 4, ['#3a2a66', '#2a1f52', '#1c1640'], j + 6);
    g.end({ outline: false, edge: false });
    // Den lilla boken på sockeln, långt ifrån
    const by = top - 19 + round(sin(t * 1.5));
    g.begin(); halo(g, px, by - 6, 22, '#ffe9a0', 0.7); g.end({ outline: false, edge: false });
    g.push(px, by, 0, 0.5); drawBook(g, { t }); g.pop();
    g.begin(); for (let i = 0; i < 8; i++) { const u = fract(t * 0.2 + hash(i, 33)), a = hash(i, 34) * 6.28; spark(g, px + cos(a) * (6 + u * 16), by - 8 - u * 14 + sin(a) * 5, i % 3 === 0 ? 1 : 0); } g.end({ outline: false, edge: false });
    // Kejsaren i förgrunden: så stor att bara överkroppen ryms
    g.push(cx + 34, H + 26, 0, 1.18);
    drawEmperor(g, t, { menace: me, hand: [lerp(-25, -43, me), lerp(-58, -76, me)] });
    g.pop();
    st.sh = g.anchor.shard; st.ey = g.anchor.eyes; st.bk = [px, by - 6]; st.me = me;
  },
  post(ctx, st, t) {
    glow(ctx, st.mx, st.my, st.mr + 12, '190,150,230', 0.06);
    glow(ctx, st.bk[0], st.bk[1], 22, '255,220,120', 0.14);
    glow(ctx, st.sh[0], st.sh[1], 17 + st.me * 6 + sin(t * 3) * 1.5, '255,235,150', 0.17);
    glow(ctx, st.ey[0], st.ey[1], 7 + st.me * 2, '255,150,40', 0.2);
  },
};

const T_CRACK = 0.9;
const sceneBroke = {
  build(W, H) {
    const bg = new G(W, H), cx = W >> 1, top = H - 31, m = meadow(bg, W, H, STORM, cx, top);
    bg.begin();
    for (let j = 0; j < 5; j++) cloud(bg, hash(j, 12) * W, 7 + (j % 2) * 7, 60 + hash(j, 13) * 40, 8, ['#4a3478', '#2c2054', '#1a1438'], j + 9);
    bg.end({ outline: false, edge: false });
    bg.push(cx, top + 2); drawPedestal(bg, R(STORM.stone), true); bg.pop();
    return { bg, W, H, cx, top, ...m };
  },
  shake(t) { const tt = t - T_CRACK; return tt > 0 && tt < 0.6 ? [round(sin(tt * 70) * 1.2), round(cos(tt * 55) * 1.2)] : [0, 0]; },
  draw(g, st, t) {
    const { W, H, cx, top } = st, tt = t - T_CRACK, cr = ease(tt / 0.7), by = top - 24 + (tt < 0 ? round(sin(t * 40) * min(1.5, t * 2)) : 0), cy = by - 12;
    st.c = [cx, cy]; st.tt = tt;
    g.begin();
    if (tt < 0) {                                              // stjärnskärvan slår ner
      const u = clamp(t / T_CRACK), y = lerp(-12, cy - 6, u * u);
      for (let i = 0; i < 26; i++) g.set(cx + (i % 3) - 1, round(y - i * 1.6), i < 9 ? C.white : C.star, i < 16 ? 5 : 3);
      halo(g, cx, y, 9, '#fff6c8', 1);
    } else {
      const dens = clamp(1.25 - tt * 0.22, 0.45, 1);           // ljuspelaren ur sprickan
      for (let y = 0; y < cy; y++) for (let dx = -12; dx <= 12; dx++) {
        const a = abs(dx) + (sin(y * 0.4 + t * 9) > 0.4 ? 1 : 0), x = cx + dx;
        if (a < 3) g.set(x, y, C.white, 5); else if (bay(x, y) < dens * (1 - (a - 3) / 10)) g.set(x, y, a < 6 ? C.star : C.spark, a < 6 ? 5 : 4);
      }
      rays(g, cx, cy, 14, 60 + min(30, tt * 40), 12, -t * 0.25, '#ffe9a0', 0.6 * dens, top - 2);
      halo(g, cx, cy, 30, '#fff2b8', 0.8);
      if (tt < 1.1) { const rr = 10 + tt * 120; g.ell(cx, cy, rr, rr * 0.6, C.white, false, (dx, dy, d2) => d2 > 0.9 && bay(floor(dx * 97), floor(dy * 61)) < 1.1 - tt, 5); }   // tryckvåg
    }
    g.end({ outline: false, edge: false });
    g.push(cx, by); drawBook(g, { crack: cr, t }); g.pop();
    if (tt <= 0) return;
    // Orden far ut åt alla håll: gnistor med svans, och var femte är ett litet ord
    const N = 70, far = W * 0.62;
    g.begin();
    for (let i = 0; i < N; i++) {
      const P = 2.6 + hash(i, 41) * 1.6, raw = tt / P - hash(i, 42) * 0.55; if (raw < 0) continue;
      const u = fract(raw), a = -PI / 2 + (hash(i, 43) - 0.5) * PI * 1.55, sp = far * (0.45 + hash(i, 44) * 0.7);
      const pos = (uu) => { const d = Math.pow(uu, 0.75) * sp; return [cx + cos(a) * d + sin(uu * 9 + i) * 2, cy + sin(a) * d * 0.8 + uu * uu * 20]; };
      if (i % 5 === 0) continue;
      const [x, y] = pos(u);
      for (let k = 1; k <= 4; k++) { const [qx, qy] = pos(max(0, u - k * 0.012)); g.set(round(qx), round(qy), C.spark, 5 - k); }
      spark(g, x, y, u < 0.5 ? (i % 3 === 0 ? 2 : 1) : i % 2);
    }
    g.end({ outline: false, edge: false });
    for (let k = 0; k < 6; k++) {                              // lösa blad som virvlar iväg
      const u = fract(tt / 3.6 + k / 6), a = -PI / 2 + (hash(k, 47) - 0.5) * 2.6, d = 14 + u * far * 0.7, rot = t * (2 + k) + k;
      if (tt < u * 3.6 - 0.01 && tt < 3.6) continue;
      g.begin(); g.push(cx + cos(a) * d, cy - 4 + sin(a) * d * 0.6 + u * u * 26, rot); g.poly([[-3, -2], [3, -2.5], [3, 2], [-3, 2.5]], C.cream, 4); g.pop(); g.end();
    }
    for (let k = 0; k < 8; k++) {                              // åtta ord, jämnt utspridda i en solfjäder
      const P = 4.2, raw = tt / P - k * 0.045; if (raw < 0) continue;
      const u = fract(raw + (k % 2) * 0.5 * (raw > 1 ? 1 : 0)), a = -PI / 2 + ((((k * 3) % 8) + 0.5) / 8 - 0.5) * PI * 1.25, d = 16 + Math.pow(u, 0.7) * far * (0.75 + (k % 3) * 0.12);
      g.begin(); word3(g, WORDS[k], cx + cos(a) * d * 1.15, cy - 6 + sin(a) * d * 0.72, u > 0.75 ? C.spark : C.white, 5); g.end({ outline: true, edge: false });
    }
  },
  post(ctx, st, t) {
    const tt = st.tt;
    if (tt < 0) { glow(ctx, st.c[0], st.c[1], 16, '255,235,150', 0.2); return; }
    glow(ctx, st.c[0], st.c[1], 46 + sin(t * 5) * 3, '255,225,140', 0.16);
    if (tt < 0.7) { ctx.fillStyle = `rgba(255,250,225,${clamp(1 - tt / 0.7)})`; ctx.fillRect(0, 0, st.W, st.H); }   // blixten när boken spricker
  },
};

const RED = { sky: ['#0a081e', '#1e0f40', '#521a52', '#a2323e', '#e87038', '#ffb45a'], rock: '#140f28', rock2: '#231a3e', rockLit: '#3a2a54', ground: '#110d22', groundRim: '#3a2848' };
// Det stora tornet i scen 4. Origo vid klippans fot under tornets mitt.
function drawBigTower(g) {
  const st = R('#352b58'), dk = R('#221a40'), lit = R('#4e4276');
  g.begin();    // klippan
  g.poly([[-44, 12], [-30, -3], [-20, -8], [-12, -14], [10, -13], [18, -8], [30, -2], [46, 12]], dk, 2);
  g.poly([[-30, -3], [-20, -8], [-12, -14], [-6, -14], [-16, -4], [-28, 4]], dk, 4);
  g.end();
  g.begin();    // sidotorn
  g.poly([[-19, -8], [-11, -11], [-11, -25], [-15, -32], [-19, -25]], dk, 3); g.poly([[11, -11], [20, -7], [20, -22], [15.5, -29], [11, -22]], dk, 2);
  g.end();
  g.begin();    // tornkroppen
  g.poly([[-9, -12], [9, -12], [6, -54], [-6, -54]], st, 3); g.poly([[-9, -12], [-4, -12], [-2.5, -54], [-6, -54]], lit, 3); g.poly([[4, -12], [9, -12], [6, -54], [3, -54]], dk, 3);
  for (const y of [-21, -30, -39, -47]) g.rect(-8, y, 16, 1, dk, 1);
  g.poly([[-3, -12], [-3, -17], [0, -20], [3, -17], [3, -12]], C.dark, 0);    // port
  g.end();
  g.begin();    // plattformen överst, där kejsaren står
  g.poly([[-6, -54], [6, -54], [14, -61], [-14, -61]], st, 3); g.poly([[-6, -54], [-2, -54], [-6, -61], [-14, -61]], lit, 3);
  g.rect(-14, -65, 28, 4, st, 4); g.rect(-14, -67, 4, 2, st, 4); g.rect(10, -67, 4, 2, st, 3);
  g.end();
  g.begin();    // två klor håller de tomma platserna
  g.poly([[-14, -65], [-22, -69], [-24, -79], [-19, -72], [-10, -65]], st, 3); g.poly([[14, -65], [22, -69], [24, -79], [19, -72], [10, -65]], dk, 3);
  g.end();
  g.begin(); for (const [x, y] of [[-1, -51], [1, -43], [-2, -34], [1, -26], [-15, -24], [15, -20]]) { g.rect(x, y, 2, 3, C.fire, 4); g.dot(x, y, C.spark, 5); } g.end({ outline: false, edge: false });   // fönster
}
const sceneStar = {
  build(W, H) {
    const bg = new G(W, H), cx = W >> 1, hy = round(H * 0.74), tx = cx, by = H - 7;
    bg.begin();
    sky(bg, W, 0, hy + 2, RED.sky, 12);
    disc(bg, tx, hy + 4, 60, 26, '#ffcf7a', 0.35); disc(bg, tx, hy + 4, 38, 15, '#ffe2a0', 0.5);   // glöden vid horisonten
    const far = new Float32Array(W), near = new Float32Array(W);
    for (let x = 0; x < W; x++) {
      const e = abs(x - cx) / 86;                                                                    // bergen reser sig mot kanterna
      far[x] = hy - 2 - (1 - abs(fbm(x / 26, 15, 3) * 2 - 1)) * (8 + 26 * clamp(e - 0.25));
      near[x] = hy + 6 - (1 - abs(fbm(x / 17, 19, 3) * 2 - 1)) * (4 + 60 * clamp(e - 0.75) * clamp(e - 0.75));
    }
    fill(bg, W, far, H, RED.rock2, { lit: RED.rockLit, sd: 6, haze: '#7a2a44', hazeH: 9 });
    fill(bg, W, near, H, RED.rock, { lit: RED.rock2, sd: 5 });
    const gr = ridge(W, hy + 9, 3, 30, 27); fill(bg, W, gr, H, RED.ground, { rim: RED.groundRim });
    for (let i = 0; i < W / 9; i++) {                                                                // glödande sprickor i marken
      let x = hash(i, 61) * W, y = hy + 12 + hash(i, 62) * (H - hy - 12); const dir = hash(i, 63) < 0.5 ? -1 : 1;
      for (let j = 0, n = 4 + floor(hash(i, 64) * 9); j < n; j++) { bg.set(round(x), round(y), R(j % 4 === 3 ? '#ffb04a' : '#e8502e'), 3); x += dir * (1 + (hash(i * 7 + j, 66) < 0.4 ? 1 : 0)); if (hash(i * 9 + j, 65) < 0.45) y += hash(j, i) < 0.5 ? 1 : -1; }
    }
    bg.end({ outline: false, edge: false });
    return { bg, W, H, cx, hy, tx, by };
  },
  draw(g, st, t) {
    const { W, H, tx, by, hy } = st, sy = by - 106 + round(sin(t * 1.2) * 1.5);
    g.begin();
    twinkle(g, W, hy * 0.45, t, 40, null);
    for (let j = 0; j < 4; j++) cloud(g, mod(hash(j, 17) * (W + 120) + t * (1 + j * 0.5), W + 120) - 60, round(H * (0.2 + 0.11 * j)) + (j === 3 ? 6 : 0), 40 + j * 14, 4 + (j % 2) * 2, ['#2a1648', '#3c1c50', '#b23c40'], j + 20);
    halo(g, tx, sy + 4, 30, '#ffd48a', 0.5);
    g.end({ outline: false, edge: false });
    g.push(tx, by); drawBigTower(g); g.pop();                  // tornet ritas här så att molnen hamnar bakom det
    // Tre platser för stjärndelar: den i mitten lyser, de två bredvid är tomma
    for (const dx of [-23, 23]) {
      g.begin(); shard(g, tx + dx, by - 89, 9, R('#8a6cc0'), 3); g.end();
      g.begin(); shard(g, tx + dx, by - 89, 5.5, R('#150f2a'), 3); g.end({ outline: false, edge: false });
    }
    g.begin(); shard(g, tx, sy, 10.5, C.star, 4, sin(t * 1.1) * 0.12); g.end();
    g.begin(); shard(g, tx, sy, 5.5, C.white, 5, sin(t * 1.1) * 0.12); g.end({ outline: false, edge: false });
    // Kejsaren överst på tornet, liten och långt borta, sträcker sig mot stjärnan
    g.push(tx + 1, by - 65, 0, 0.23); drawEmperor(g, t, { shard: false, hand: [-17, -109 + sin(t * 1.5) * 2] }); g.pop();
    st.ey = g.anchor.eyes;
    g.begin();
    g.set(round(st.ey[0]) - 1, round(st.ey[1]), C.fire, 5); g.set(round(st.ey[0]), round(st.ey[1]), C.spark, 5);
    for (let i = 0; i < 26; i++) {                                                                   // glöd som stiger
      const y = H - mod(hash(i, 51) * H + t * (6 + hash(i, 52) * 8), H), x = mod(hash(i, 53) * W + sin(t + i) * 4 + t * 2, W);
      g.set(round(x), round(y), hash(floor(t * 6) + i, 5) < 0.5 ? C.spark : C.fire, y < H * 0.4 ? 3 : 5);
    }
    
    g.end({ outline: false, edge: false });
    st.s = [tx, sy];
  },
  post(ctx, st, t) {
    glow(ctx, st.s[0], st.s[1], 20 + sin(t * 2.4) * 2, '255,230,150', 0.16);
    glow(ctx, st.tx, st.hy + 4, 46, '255,90,40', 0.07);
  },
};

function scenePage(look) {
  return {
    build(W, H) {
      const bg = new G(W, H), cx = W >> 1, gy = H - 34, px = cx + 22;
      drawBackdrop(bg, 'forest', W, H, gy, 4);
      bg.begin();                                                 // ljusstråle ner genom träden mot platsen där Page landar
      for (let y = 0; y < gy; y++) for (let x = px - 30; x < px + 22; x++) { const c = px - 6 + (gy - y) * 0.16, hw = 7 + (gy - y) * 0.06; if (abs(x - c) < hw && bay(x, y) < 0.34 * (1 - abs(x - c) / hw) + 0.08) bg.set(x, y, R('#fff8cc'), 3); }
      disc(bg, px, gy + 1, 16, 4, '#e8f4a0', 0.45);
      bg.end({ outline: false, edge: false });
      return { bg, W, H, cx, gy, px };
    },
    draw(g, st, t) {
      const { W, H, cx, gy, px } = st;
      drawAmbient(g, 'forest', W, H, gy, t);
      const fall = clamp(t / 0.9), landed = t >= 0.9, bounce = landed ? abs(sin((t - 0.9) * 7)) * max(0, 7 - (t - 0.9) * 9) : 0;
      const hop = landed ? bounce + (t > 2.2 ? max(0, sin((t - 2.2) * 5)) * 3 : 0) : (1 - fall * fall) * (gy + 20);
      g.begin(); g.ell(px, gy + 1.5, 8 - min(4, hop * 0.2), 2, C.dark, false, null, 1); g.end({ outline: false, edge: false });
      g.push(px, gy + 1 - round(hop), landed ? 0 : (1 - fall) * 2.5); drawPage(g, t, { shut: !landed || (t - 0.9 < 0.5) || (t % 3.1) < 0.12 }); g.pop();
      g.push(cx - 26 - 38.5, gy - 61); drawHero(g, look, {}, { t, blink: (t % 3.4) < 0.14 }); g.pop();
      if (t > 1.0 && t < 2.6) {                                  // utropstecken över barnet
        const y = gy - 61 + 6 - round(min(1, (t - 1) * 6) * 3);
        g.begin(); g.rect(cx - 26, y, 3, 6, C.white, 5); g.rect(cx - 26, y + 8, 3, 2, C.white, 5); g.end();
      }
      g.begin();
      for (let i = 0; i < 10; i++) { const u = fract(t * 0.3 + hash(i, 35)), a = hash(i, 36) * 6.28; if (landed) spark(g, px + cos(a) * (9 + u * 9), gy - 9 - u * 16 + sin(a) * 4, i % 3 === 0 ? 2 : i % 2); }
      g.end({ outline: false, edge: false });
      st.landed = landed;
    },
    post(ctx, st, t) { if (st.landed) glow(ctx, st.px, st.gy - 9, 18 + sin(t * 2.5) * 2, '255,240,170', 0.12); },
  };
}

// ====================================================================================================
// SCEN OCH DOM
// ====================================================================================================
const FONT = 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
const CSS = `
.wl-root { position:absolute; inset:0; overflow:hidden; background:#07061a; font-family:${FONT}; font-weight:700; color:#fff; user-select:none; -webkit-user-select:none; -webkit-tap-highlight-color:transparent; touch-action:manipulation; }
.wl-root canvas { position:absolute; left:50%; top:50%; image-rendering:pixelated; image-rendering:crisp-edges; image-rendering:pixelated; }
.wl-fade { position:absolute; inset:0; background:#07061a; opacity:0; transition:opacity .22s linear; pointer-events:none; }
.wl-play { position:absolute; left:50%; bottom:max(calc(var(--u) * 4), calc(env(safe-area-inset-bottom) + 8px)); transform:translateX(-50%); display:flex; flex-direction:column; align-items:center;
  padding:calc(var(--u) * 1.8) calc(var(--u) * 8) calc(var(--u) * 1.5); border:calc(var(--u) * .7) solid #fff3c4; border-radius:calc(var(--u) * 5); cursor:pointer;
  background:linear-gradient(#ffe07a, #f5a623); color:#4a2800; box-shadow:0 calc(var(--u) * 1.3) 0 #9a5a00, 0 calc(var(--u) * 2.4) calc(var(--u) * 4) #0009; font:inherit; line-height:1; animation:wl-pulse 1.6s ease-in-out infinite; }
.wl-play b { font-size:calc(var(--u) * 7.6); letter-spacing:.02em; } .wl-play small { font-size:calc(var(--u) * 3.3); opacity:.7; margin-top:calc(var(--u) * .7); font-weight:600; }
.wl-play:active { transform:translateX(-50%) translateY(calc(var(--u) * 1)); box-shadow:0 calc(var(--u) * .3) 0 #9a5a00; animation:none; }
@keyframes wl-pulse { 50% { filter:brightness(1.12); transform:translateX(-50%) scale(1.04); } }
.wl-cap { position:absolute; left:0; right:0; bottom:0; text-align:center; pointer-events:none; padding:calc(var(--u) * 9) max(calc(var(--u) * 4), env(safe-area-inset-right)) max(calc(var(--u) * 3.2), calc(env(safe-area-inset-bottom) + 4px)) max(calc(var(--u) * 4), env(safe-area-inset-left));
  background:linear-gradient(transparent, #07061acc 45%, #07061af2); transition:opacity .22s linear; }
.wl-cap .en { font-size:calc(var(--u) * 6.6); line-height:1.15; text-shadow:0 2px 0 #000, 0 0 12px #000; }
.wl-cap .sv { font-size:max(13px, calc(var(--u) * 3.6)); line-height:1.2; font-weight:600; color:#cfd0ee; margin-top:calc(var(--u) * 1); text-shadow:0 1px 0 #000; }
.wl-cap.big .en { font-size:calc(var(--u) * 10); color:#ffe07a; }
.wl-skip { position:absolute; top:max(calc(var(--u) * 3), calc(env(safe-area-inset-top) + 6px)); right:max(calc(var(--u) * 3), calc(env(safe-area-inset-right) + 6px)); font:inherit; font-size:max(15px, calc(var(--u) * 3.8)); color:#fff; cursor:pointer;
  padding:calc(var(--u) * 1.8) calc(var(--u) * 3.4); min-height:44px; border-radius:999px; border:2px solid #ffffff66; background:#07061a99; }
.wl-dots { position:absolute; top:max(calc(var(--u) * 4.4), calc(env(safe-area-inset-top) + 12px)); left:max(calc(var(--u) * 4), calc(env(safe-area-inset-left) + 8px)); display:flex; gap:calc(var(--u) * 1.4); pointer-events:none; }
.wl-dots i { width:calc(var(--u) * 1.8); height:calc(var(--u) * 1.8); border-radius:50%; background:#ffffff44; } .wl-dots i.on { background:#ffe07a; }
`;
function makeRoot(el) {
  if (!document.getElementById('wl-intro-css')) { const s = document.createElement('style'); s.id = 'wl-intro-css'; s.textContent = CSS; document.head.appendChild(s); }
  const root = document.createElement('div'); root.className = 'wl-root';
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  el.appendChild(root);
  return root;
}
// Canvasen och bildslingan. Skalan är alltid ett heltal (skarpa, lika stora pixlar) och den logiska storleken
// räknas ur elementets mått: höjd kring 128, bredd efter proportionen, plus en pixels marginal åt varje håll.
function makeStage(root, fixedT) {
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d'); root.prepend(cv);
  let W = 0, H = 0, s = 0, g = null, st = null, scene = null, t0 = performance.now(), lw = 0, lh = 0;
  function layout() {
    const w = root.clientWidth, h = root.clientHeight;
    if (!w || !h) return false;
    if (w === lw && h === lh && st) return true;
    lw = w; lh = h; s = max(1, round(h / 128)); if (h / s < 114 && s > 1) s--;
    // Stående skärm: bilden är komponerad för liggande format, så den ritas som ett liggande band mitt på skärmen
    // (minst 190 pixlar brett i bildens egna pixlar) i stället för att pressas ihop.
    const sMax = max(1, floor(w / 190)); if (s > sMax) s = sMax;
    W = ceil(w / s) + 2; H = min(ceil(h / s) + 2, max(114, round(W * 0.8)));
    cv.width = W; cv.height = H; cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px';
    root.style.setProperty('--u', min(h, H * s) / 100 + 'px');
    g = new G(W, H); st = scene ? scene.build(W, H) : null;
    return true;
  }
  function frame() {
    if (!scene || !layout()) return;
    const t = fixedT ?? (performance.now() - t0) / 1000, a0 = performance.now();
    g.clear(); g.R.set(st.bg.R); g.L.set(st.bg.L);
    scene.draw(g, st, t); g.paint(ctx);
    if (scene.post) scene.post(ctx, st, t);
    const sh = scene.shake ? scene.shake(t) : [0, 0];
    cv.style.transform = `translate(calc(-50% + ${sh[0] * s}px), calc(-50% + ${sh[1] * s}px))`;
    root.dataset.ms = (performance.now() - a0).toFixed(1);       // ritkostnad per bildruta, för felsökning
  }
  const timer = setInterval(frame, 80);
  return {
    set(sc) { scene = sc; st = null; lw = 0; t0 = performance.now(); frame(); },
    time: () => (performance.now() - t0) / 1000,
    stop() { clearInterval(timer); },
  };
}

// Titelskärmen. Fyller elementet el, animerad pixelscen, spelets namn och en stor Play-knapp. Anropar onPlay vid tryck.
// Returnerar en funktion som städar bort allt (timrar, DOM). Skärmen ligger kvar tills städfunktionen anropas.
// Valfritt: looks (de tre barnens utseende, samma format som hjältens look), t (fryst tid, för arket).
export function showTitle(el, { onPlay, looks, t } = {}) {
  const root = makeRoot(el), stage = makeStage(root, t);
  stage.set(vista(DUSK, { title: true, kids: looks && looks.length ? looks : LOOKS, sparks: 26 }));
  const btn = document.createElement('button'); btn.className = 'wl-play'; btn.innerHTML = '<b>&#9654; Play</b><small>Spela</small>';
  btn.onclick = () => { if (onPlay) onPlay(); };
  root.appendChild(btn);
  let done = false;
  return () => { if (done) return; done = true; stage.stop(); root.remove(); };
}

// Introfilmen: scenerna visas i följd med en kort engelsk replik (text i bild plus ljud via play(url)) och svensk
// översättning under. Tryck går vidare, Skip hoppar över allt. Filmen städar bort sig själv och anropar sedan onDone.
// Returnerar en städfunktion (går att anropa när som helst, även efter onDone).
// Valfritt: look (barnets utseende i skogsscenen), base (mapp för ljudet, standard 'audio/intro/'),
// scene och t (visa en enda scen med fryst tid, för arket).
export function playIntro(el, { play, onDone, look, base = 'audio/intro/', scene, t } = {}) {
  const root = makeRoot(el), stage = makeStage(root, t), lk = look || LOOKS[0];
  const scenes = [sceneBook, sceneEmperor, sceneBroke, sceneStar, scenePage(lk), vista(DAWN, { solo: true, kids: [lk], sparks: 44 })];
  const fade = document.createElement('div'); fade.className = 'wl-fade';
  const cap = document.createElement('div'); cap.className = 'wl-cap'; cap.innerHTML = '<div class="en"></div><div class="sv"></div>';
  const skip = document.createElement('button'); skip.className = 'wl-skip'; skip.innerHTML = 'Skip &#9654;&#9654;';
  const dots = document.createElement('div'); dots.className = 'wl-dots'; dots.innerHTML = LINES.map(() => '<i></i>').join('');
  root.append(fade, cap, dots, skip);
  let i = -1, done = false, busy = false; const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  function cleanup() { if (done) return; done = true; stage.stop(); clearInterval(tick); timers.forEach(clearTimeout); root.remove(); }
  function finish() { if (done) return; cleanup(); if (onDone) onDone(); }
  function show(n) {
    i = n; const ln = LINES[n];
    stage.set(scenes[n]);
    cap.querySelector('.en').textContent = ln.en; cap.querySelector('.sv').textContent = ln.sv; cap.classList.toggle('big', n === LINES.length - 1);
    dots.querySelectorAll('i').forEach((d, k) => d.classList.toggle('on', k <= n));
    if (play && t === undefined) { try { play(base + ln.id + '.mp3'); } catch (e) {} }
  }
  function next() {
    if (done || busy) return;
    if (scene !== undefined || i >= LINES.length - 1) { busy = true; fade.style.opacity = 1; later(finish, 240); return; }
    busy = true; fade.style.opacity = 1;
    later(() => { show(i + 1); fade.style.opacity = 0; busy = false; }, 240);
  }
  root.onclick = next;
  skip.onclick = (e) => { e.stopPropagation(); finish(); };
  show(scene !== undefined ? clamp(scene | 0, 0, LINES.length - 1) : 0);
  const tick = setInterval(() => { if (t === undefined && !busy && stage.time() > LINES[i].dur) next(); }, 100);
  return cleanup;
}
