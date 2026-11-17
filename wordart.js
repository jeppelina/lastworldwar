// Ordbilder ritade i kod: verb, adjektiv, prepositioner, tal och fraser som en stillbild eller en kort slinga.
// Varje bild är en ritfunktion per ord-id som ritar med pixelmotorn (pixel.js) på en 64x64-ruta, och där en
// människa behövs är det spelets egen hjälte (drawHero) med ett neutralt utseende.
//
// Regler för en bild:
//   - bilden ska bära betydelsen ensam (de yngsta läser inte), och gå att skilja från grannorden på korten
//     (run mot walk, fast mot slow, big mot small, sad mot cry ...)
//   - ruta 0 är nyckelbilden: den visas när rörelse är avstängd (prefers-reduced-motion) och som stillbild
//   - rörelsen är en kort slinga (n rutor på dur sekunder) och bara där rörelsen bär betydelsen
//
// I spelet blir en bild ett <img> med ett spritark (alla rutor bredvid varandra) som data-url. CSS flyttar
// object-position i steg, så att ingen JavaScript körs per bildruta och webbläsaren slutar rita bilder som inte syns.
// Arken ritas en gång, när ordet först visas (eller i förväg med warmArt), och sparas sedan.
import { G, ramp as R } from './pixel.js';
import { drawHero } from './hero.js';

const { sin, cos, PI, abs, max, min, floor, round } = Math;
const TAU = PI * 2;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
const lerp = (a, b, u) => a + (b - a) * u;
const ease = (u) => { u = clamp(u); return u * u * (3 - 2 * u); };
const fract = (v) => v - floor(v);

export const SIZE = 64;
// Hjältens neutrala utseende i ordbilderna (inte barnets egen hjälte, så att bilderna är desamma för alla).
export const LOOK = { skin: '#e9b48c', hair: '#6b4426', style: 'short' };

// ---------- färger ----------
const C = {
  dark: R('#2b2740'), white: R('#ffffff'), ink: R('#1d1b2e'), shadow: R('#1d1b2e'),
  skin: R(LOOK.skin), red: R('#e04a3c'), apple: R('#e8402f'), leaf: R('#4caf50'), stem: R('#7a4a2a'),
  wood: R('#9a6b3f'), plank: R('#c9965a'), card: R('#c99a5e'), grass: R('#62b84f'), dirt: R('#b98a5a'),
  water: R('#3d9be0'), foam: R('#d8f2ff'), sun: R('#ffc93a'), fire: R('#ff7a1f'), ice: R('#bff0ff'), snow: R('#f4fbff'),
  blue: R('#3f74e0'), sky: R('#8fd0ff'), grey: R('#9aa1b5'), stone: R('#8a8fa3'), cloud: R('#e8ecf6'), rain: R('#5a6588'),
  gold: R('#f2b632'), pink: R('#f07aa8'), purple: R('#9a6bff'), tort: R('#6f9a3e'), shell: R('#a8783a'),
  dog: R('#c58a4a'), dogd: R('#7a4f2a'), cat: R('#f0a23c'), catd: R('#b56a1e'), plate: R('#eef1f6'), glass: R('#cfeeff'),
  bed: R('#5a6fd0'), sheet: R('#f2f0ff'), pot: R('#5b6378'), soup: R('#e0913a'), paper: R('#fbf8ee'), pencil: R('#ffcf3a'),
  plush: R('#c98a4b'), night: R('#2f3570'), paleSkin: R('#d9b8a4'), hotSkin: R('#f29a7c'), coldSkin: R('#bcc8e6'), plushOld: R('#9e8f7c'), bow: R('#e64980'), patch: R('#6a9fd8'), note: R('#2b2740'),
};

// ---------- små verktyg ----------
// En del ritas mellan begin() och end(). flat = ingen kontur och ingen kantskuggning (glimtar, linjer, rök).
function part(g, fn, flat = false) { g.begin(); fn(); g.end(flat ? { outline: false, edge: false } : undefined); }
// Kopierar en färdig bild in i en annan, spegelvänd om flip. Tomma pixlar lämnar det som redan finns.
function blit(dst, src, flip = false) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    const i = y * src.w + x; if (src.R[i] < 0) continue;
    const dx = flip ? src.w - 1 - x : x; if (dx < 0 || dx >= dst.w || y >= dst.h) continue;
    const j = y * dst.w + dx; dst.R[j] = src.R[i]; dst.L[j] = src.L[i];
  }
}
// Fyller hjältens koordinatruta [hx, hx+1) x [hy, hy+1) i bilden (efter g:s aktuella förflyttning och skala).
// only = bara pixlar som redan har den rampen (ansiktet: måla bara på huden).
function hpx(g, hx, hy, rp, lv, only = -1) {
  const [x0, y0] = g.pt(hx, hy), [x1, y1] = g.pt(hx + 1, hy + 1);
  for (let y = round(min(y0, y1)); y < round(max(y0, y1)); y++) for (let x = round(min(x0, x1)); x < round(max(x0, x1)); x++) {
    if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue;
    const i = y * g.w + x; if (only >= 0 && g.R[i] !== only) continue; g.R[i] = rp; g.L[i] = lv;
  }
}

// ---------- hjälten ----------
// Ritar hjälten med fötterna i (x, y), skala k (1 = som i striden), vriden ang radianer kring fötterna.
// a = drawHero:s val (handB, handF, legs, blink ...). face = ansiktsuttryck som ritas ovanpå (se face()).
function hero(g, x, y, k = 0.8, a = {}, face = null, ang = 0, look = LOOK) {
  g.push(x, y, ang, k); g.push(-39.5, -61);
  drawHero(g, look, {}, { noPet: true, noFx: true, noShadow: true, t: 0, ...a });
  if (face) drawFace(g, face, 0, R(look.skin));
  g.pop(); g.pop();
}
// Hjälten spegelvänd (tittar åt vänster). Ritas i en egen bild som vänds och läggs ovanpå.
function heroFlip(g, x, y, k = 0.8, a = {}, face = null, look = LOOK) {
  const tmp = new G(g.w, g.h); hero(tmp, g.w - 1 - x, y, k, a, face, 0, look); blit(g, tmp, true);
}
// Ansiktsuttryck ovanpå hjältens huvud (hjältens egna koordinater, huvudets mitt 39.5, 23.5, ögonen i x 42 och 47).
// kind: smile, grin (öppen glad mun), frown (ledsen), wail (gråtande öppen mun), o (liten rund mun), tongue,
//       shut (stängda ögon), joy (glada streck-ögon ^ ^), sadbrow (ledsna ögonbryn), tear (tårar, fas tp 0..1)
function drawFace(g, kind, b = 0, sk = C.skin) {
  const Y = 23 + b, k = new Set(kind.split(' '));
  const on = (x, y, rp, lv) => hpx(g, x, y, rp, lv, sk);       // bara på huden
  const put = (x, y, rp, lv) => hpx(g, x, y, rp, lv);
  // Sudda den lilla snedmunnen och de bestämda ögonbrynen.
  for (let y = Y + 4; y <= Y + 7; y++) for (let x = 43; x <= 49; x++) on(x, y, sk, 3);
  if (k.has('sadbrow') || k.has('joy') || k.has('soft')) for (const [x, y] of [[41, Y - 2], [42, Y - 2], [43, Y - 1], [48, Y - 2], [49, Y - 2], [47, Y - 1]]) on(x, y, sk, 3);
  if (k.has('sadbrow')) for (const [x, y] of [[41, Y - 1], [42, Y - 2], [43, Y - 3], [47, Y - 3], [48, Y - 2], [49, Y - 1]]) put(x, y, C.dark, 1);
  if (k.has('shut') || k.has('joy')) {            // stäng ögonen: hud över ögonen, sedan ett streck eller en båge
    for (const ex of [42, 47]) for (let y = Y; y < Y + 3; y++) for (let x = ex; x < ex + 2; x++) put(x, y, sk, 3);
    if (k.has('joy')) for (const ex of [42, 47]) { put(ex - 0.5 + 0, Y + 1, C.dark, 0); put(ex + 0.5, Y, C.dark, 0); put(ex + 1.5, Y + 1, C.dark, 0); }
    else for (const ex of [42, 47]) { put(ex, Y + 2, C.dark, 0); put(ex + 1, Y + 2, C.dark, 0); }
  }
  if (k.has('smile')) { put(43, Y + 5, C.dark, 0); for (let x = 44; x <= 47; x++) put(x, Y + 6, C.dark, 0); put(48, Y + 5, C.dark, 0); }
  if (k.has('grin')) { for (let x = 43; x <= 48; x++) put(x, Y + 5, C.dark, 0); for (let x = 44; x <= 47; x++) put(x, Y + 6, C.red, 2); put(45, Y + 7, C.dark, 0); put(46, Y + 7, C.dark, 0); for (let x = 44; x <= 47; x++) put(x, Y + 5, C.white, 5); put(43, Y + 5, C.dark, 0); put(48, Y + 5, C.dark, 0); put(43, Y + 6, C.dark, 0); put(48, Y + 6, C.dark, 0); put(44, Y + 7, C.dark, 0); put(47, Y + 7, C.dark, 0); }
  if (k.has('frown')) { put(43, Y + 7, C.dark, 0); for (let x = 44; x <= 47; x++) put(x, Y + 6, C.dark, 0); put(48, Y + 7, C.dark, 0); }
  if (k.has('wail')) { for (let x = 44; x <= 47; x++) { put(x, Y + 5, C.dark, 0); put(x, Y + 8, C.dark, 0); } for (let y = Y + 5; y <= Y + 8; y++) { put(43, y, C.dark, 0); put(48, y, C.dark, 0); } for (let x = 44; x <= 47; x++) { put(x, Y + 6, C.dark, 1); put(x, Y + 7, C.red, 2); } }
  if (k.has('o')) { put(45, Y + 5, C.dark, 0); put(46, Y + 5, C.dark, 0); put(45, Y + 6, C.dark, 1); put(46, Y + 6, C.dark, 1); put(44, Y + 6, C.dark, 0); put(47, Y + 6, C.dark, 0); put(45, Y + 7, C.dark, 0); put(46, Y + 7, C.dark, 0); }
  if (k.has('chew')) { for (let x = 44; x <= 47; x++) put(x, Y + 6, C.dark, 0); put(44, Y + 5, C.dark, 0); put(47, Y + 5, C.dark, 0); }
  if (k.has('tongue')) { for (let x = 44; x <= 47; x++) put(x, Y + 5, C.dark, 0); put(46, Y + 6, C.pink, 3); put(47, Y + 6, C.pink, 3); put(46, Y + 7, C.pink, 2); put(47, Y + 7, C.pink, 2); }
  if (k.has('blush')) for (const [x, y] of [[40, Y + 4], [41, Y + 4], [49, Y + 4]]) on(x, y, C.pink, 3);
}
// Tårar som rinner ur ögonen. tp = fas 0..1, n strömmar per öga.
function tears(g, x, y, k, tp, b = 0) {
  g.push(x, y, 0, k); g.push(-39.5, -61);
  const Y = 23 + b;
  for (const ex of [42.5, 47.5]) for (let i = 0; i < 3; i++) {
    const u = fract(tp + i / 3), ty = Y + 3 + u * 9, tx = ex + (ex < 45 ? -u * 3 : u * 3);
    hpx(g, tx, ty, C.water, u < 0.5 ? 5 : 4); hpx(g, tx, ty + 1, C.water, 3);
  }
  for (const ex of [42, 47]) { hpx(g, ex, Y + 2, C.water, 5); hpx(g, ex + 1, Y + 2, C.water, 4); }
  g.pop(); g.pop();
}

// Gångcykel: knä och fotled för ett ben med fas ph (radianer). stride = steglängd, lift = hur högt foten lyfts.
function leg(hipX, ph, stride, lift) {
  const sw = sin(ph), up = max(0, cos(ph)) * lift;
  const ax = hipX + sw * stride, ay = 56.5 - up;
  const kx = (hipX + ax) / 2 + 2 + up * 0.35, ky = (47 + ay) / 2 + (up > 1 ? -up * 0.25 : 0.5);
  return [kx, ky, ax, ay, sw < 0 ? -sw * 0.45 : -sw * 0.12];
}
// Hela gången: ben och armar i fas ph. run = springsteg (längre steg, armarna böjda och högre).
function gait(ph, run) {
  const st = run ? 7 : 4, li = run ? 4 : 1.6;
  const legs = { b: leg(35.5, ph + PI, st, li), f: leg(42, ph, st, li) };
  const s = sin(ph), aw = run ? 6 : 4;
  return {
    legs,
    handB: [45 + s * aw, (run ? 42 : 45.5) - abs(s) * (run ? 2 : 0.5)], bendB: run ? [-1.5, 2.5] : [-1, 1.5],
    handF: [33 - s * aw, (run ? 42 : 45.5) - abs(s) * (run ? 2 : 0.5)], bendF: run ? [-1.5, 2.5] : [-1, 1],
  };
}
const standLegs = { b: [35, 52, 34.5, 56.5, 0], f: [42.5, 52, 43, 56.5, 0] };

// ---------- föremål ----------
function shadow(g, x, y, rx) { part(g, () => g.ell(x, y, rx, max(1.2, rx * 0.22), C.shadow, false, null, 1), true); }
function ground(g, y, col = C.grass) { part(g, () => g.rect(0, y, SIZE, SIZE - y, col, 3)); }
function ball(g, x, y, r, col = C.red) {
  part(g, () => { g.ell(x, y, r, r, col, true); if (r > 3) { g.ell(x + r * 0.15, y, r * 0.35, r, C.white, false, null, 4); } });
}
function apple(g, x, y, s = 1) {
  part(g, () => {
    g.ell(x - 1.6 * s, y, 3.4 * s, 3.6 * s, C.apple); g.ell(x + 1.6 * s, y, 3.4 * s, 3.6 * s, C.apple);
    g.rect(x - 0.5, y - 5 * s, 1, 2.5 * s, C.stem, 3);
    g.poly([[x + 0.5, y - 4.5 * s], [x + 3.5 * s, y - 6 * s], [x + 2 * s, y - 3.5 * s]], C.leaf, 3);
    if (s >= 0.9) g.dot(x - 2.5 * s, y - 1.5 * s, C.white, 5);
  });
}
function star4(g, x, y, r, col = C.gold) { part(g, () => { g.poly([[x, y - r], [x + r * 0.3, y - r * 0.3], [x + r, y], [x + r * 0.3, y + r * 0.3], [x, y + r], [x - r * 0.3, y + r * 0.3], [x - r, y], [x - r * 0.3, y - r * 0.3]], col, 5); }, true); }
function sparkle(g, x, y, s) { if (s <= 0) return; part(g, () => { const r = round(s); g.set(x, y, C.white, 5); for (let j = 1; j <= r; j++) { g.set(x + j, y, C.gold, 5); g.set(x - j, y, C.gold, 5); g.set(x, y + j, C.gold, 5); g.set(x, y - j, C.gold, 5); } }, true); }
function cloudBlob(g, x, y, w, col = C.cloud) { part(g, () => { g.ell(x, y, w * 0.32, w * 0.24, col); g.ell(x - w * 0.25, y + w * 0.06, w * 0.24, w * 0.18, col); g.ell(x + w * 0.27, y + w * 0.06, w * 0.24, w * 0.18, col); g.rect(x - w * 0.42, y + w * 0.05, w * 0.84, w * 0.17, col, 3); }); }
function sunDisc(g, x, y, r, t = 0) {
  part(g, () => { for (let i = 0; i < 8; i++) { const a = i * PI / 4 + t; g.thick(x + cos(a) * (r + 1.5), y + sin(a) * (r + 1.5), x + cos(a) * (r + 4.5), y + sin(a) * (r + 4.5), 1.6, C.sun, 5); } }, true);
  part(g, () => g.ell(x, y, r, r, C.sun, true));
}
function bubble(g, x, y, w, h, tailX, tailY) {        // tankebubbla med tre små ringar ner mot huvudet
  part(g, () => { g.ell(x, y, w / 2, h / 2, C.white, false, null, 5); g.ell(lerp(tailX, x, 0.45), lerp(tailY, y, 0.45) + 2, 2.2, 2, C.white, false, null, 5); g.ell(tailX, tailY, 1.3, 1.2, C.white, false, null, 5); });
}
function digit(g, ch, x, y, s = 1, col = C.dark) {    // siffror 3x5 i pixelstil
  const F = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111' };
  const bits = F[ch]; if (!bits) return;
  part(g, () => { for (let i = 0; i < 15; i++) if (bits[i] === '1') g.rect(x + (i % 3) * s, y + floor(i / 3) * s, s, s, col, 3); });
}
// Hund från sidan som tittar åt höger. k = storlek, t = tid (svansen viftar, benen går om walk).
function dog(g, x, y, k = 1, t = 0, walk = false) {
  g.push(x, y, 0, k);
  const w = round(sin(t * TAU * 2) * 1.5), st = walk ? sin(t * TAU) * 2 : 0;
  part(g, () => {
    g.thick(-7, -7, -11, -12 + w, 2.2, C.dog, 3);                                        // svans
    g.thick(-5 - st, -3, -5 + st, 0, 2.6, C.dogd, 2); g.thick(4 + st, -3, 4 - st, 0, 2.6, C.dogd, 2);   // bortre benen
    g.ell(-1, -7, 8, 4.6, C.dog);                                                         // kropp
    g.thick(-6 + st, -4, -6 - st, 0, 2.8, C.dog, 3); g.thick(5 - st, -4, 5 + st, 0, 2.8, C.dog, 3);    // närmaste benen
    g.ell(8, -12, 4.6, 4.2, C.dog); g.ell(12, -10.5, 2.6, 2, C.dog, true, null, 4);        // huvud och nos
    g.poly([[5, -15], [8, -16], [7.5, -9], [5, -10]], C.dogd, 2);                         // öra
  });
  part(g, () => { g.dot(9, -13, C.ink, 0); g.dot(14, -11, C.ink, 0); g.dot(12, -9, C.red, 3); }, true);
  g.pop();
}
// Katt från sidan, åt höger.
function cat(g, x, y, k = 1, t = 0) {
  g.push(x, y, 0, k);
  const w = round(sin(t * TAU) * 1.5);
  part(g, () => {
    g.thick(-6, -5, -10, -9 + w, 1.6, C.cat, 3); g.thick(-10, -9 + w, -9, -13 + w, 1.6, C.cat, 3);
    g.thick(-4, -3, -4, 0, 2.2, C.catd, 2); g.thick(4, -3, 4, 0, 2.2, C.catd, 2);
    g.ell(0, -5, 6, 3.6, C.cat);
    g.thick(-3, -3, -3, 0, 2.2, C.cat, 3); g.thick(5, -3, 5, 0, 2.2, C.cat, 3);
    g.ell(6.5, -9, 3.8, 3.4, C.cat);
    g.poly([[3.5, -11], [4.2, -15], [6.5, -12]], C.cat, 3); g.poly([[7, -12], [9.5, -15], [10, -11]], C.cat, 3);
  });
  part(g, () => { g.dot(8, -10, C.ink, 0); g.dot(10, -8, C.pink, 3); }, true);
  g.pop();
}
// Sköldpadda åt höger: skal med rutor, huvud som sticker ut, korta ben som trampar.
function tortoise(g, x, y, k = 1, t = 0) {
  g.push(x, y, 0, k);
  const st = sin(t * TAU) * 1;
  part(g, () => {
    g.ell(9, -4, 3, 2.4, C.tort); g.thick(6, -3, 8, -4, 2, C.tort, 3);                    // hals och huvud
    g.thick(-5 + st, -2, -5 - st, 0.5, 2.4, C.tort, 2); g.thick(4 - st, -2, 4 + st, 0.5, 2.4, C.tort, 2);
    g.ell(0, -4, 7.5, 5, C.shell, true, (dx, dy) => dy < 0.55);
    g.rect(-7, -2, 14.5, 1.5, C.tort, 2);
  });
  part(g, () => { g.line(-3, -7, -1, -4, C.stem, 1); g.line(2, -7, 1, -4, C.stem, 1); g.line(-5, -4, 5, -4, C.stem, 1); g.dot(10, -5, C.ink, 0); }, true);
  g.pop();
}
// Kartong. open = locket uppfällt (man ser in), front = framsidan ritas (döljer det som ligger i).
function box(g, x, y, w, h, o = {}) {
  part(g, () => {
    if (o.open) { g.poly([[x, y], [x - 4, y - 4], [x + 2, y - 4], [x + 5, y]], C.card, 4); g.poly([[x + w, y], [x + w + 4, y - 4], [x + w - 2, y - 4], [x + w - 5, y]], C.card, 2); }
    if (o.open) g.rect(x + 1, y - 1, w - 2, 3, C.dirt, 1);
    if (o.front !== false) { g.rect(x, y, w, h, C.card, 3); g.rect(x + w / 2 - 1, o.open ? y + 2 : y, 2, o.open ? h - 2 : h, C.card, 4); }
    if (!o.open) g.rect(x - 1, y - 1.5, w + 2, 2.5, C.card, 4);
  });
}
function plate(g, x, y, w = 14, food = null) {
  part(g, () => { g.ell(x, y, w / 2, w * 0.16, C.plate, true); g.ell(x, y - 0.3, w / 2 - 2, w * 0.1, C.plate, false, null, 2); });
  if (food) food();
}
function glass(g, x, y, fill = 0, col = C.water) {       // glas, fill 0..1
  part(g, () => { g.poly([[x - 4, y - 12], [x + 4, y - 12], [x + 3, y], [x - 3, y]], C.glass, 4); if (fill > 0) g.poly([[x - 3.6 + 0, y - 12 * fill + 0.5], [x + 3.6, y - 12 * fill + 0.5], [x + 3, y - 0.5], [x - 3, y - 0.5]], col, 3); });
}
function bed(g, x, y, w = 40) {                              // säng från sidan: ram, madrass, kudde
  part(g, () => { g.rect(x, y - 14, 3, 16, C.wood, 3); g.rect(x + w - 3, y - 9, 3, 11, C.wood, 2); g.rect(x, y - 6, w, 4, C.wood, 2); g.rect(x + 2, y - 9, w - 4, 3, C.sheet, 4); });
  part(g, () => g.ell(x + 8, y - 11, 5.5, 3, C.sheet, true));
}
function chair(g, x0, seatY, gy, flip = false) {     // stol från sidan: sits x0..x0+14, ryggstödet till vänster (höger med flip)
  const bx = flip ? x0 + 12 : x0;
  part(g, () => { g.rect(bx, seatY - 14, 2.5, gy - seatY + 14, C.wood, 3); g.rect(x0, seatY, 14.5, 2.5, C.plank, 4); g.rect(flip ? x0 : x0 + 12, seatY + 2, 2.5, gy - seatY - 2, C.wood, 2); g.rect(bx + (flip ? -1 : 1), seatY - 12, 1, 9, C.plank, 4); });
}
// Pil uppåt (dir -1) eller nedåt (dir 1) vid (x, y).
function arrow(g, x, y, dir) { part(g, () => { g.rect(x - 1, y - 5, 3, 10, C.white, 5); g.poly(dir < 0 ? [[x - 4.5, y - 4], [x + 5.5, y - 4], [x + 0.5, y - 10]] : [[x - 4.5, y + 4], [x + 5.5, y + 4], [x + 0.5, y + 10]], C.white, 5); }); }
// Byter en färgramp mot en annan i hela bilden (hjältens hy: blek, frusen, varm).
function recolor(g, from, to) { for (let i = 0; i < g.R.length; i++) if (g.R[i] === from) g.R[i] = to; }
const sitLegs = { b: [48, 48, 48.5, 55.5, 0], f: [53, 47.5, 53.5, 55.5, 0] };

// Vännen i bilderna med två personer (ge, krama): ett annat neutralt utseende.
const FRIEND = { skin: '#c98e62', hair: '#2b2230', style: 'bob' };
function gift(g, x, y) { part(g, () => { g.rect(x - 5, y - 4, 10, 9, C.red, 3); g.rect(x - 6, y - 6, 12, 3, C.red, 4); g.rect(x - 1, y - 6, 2, 11, C.gold, 4); }); part(g, () => { g.ell(x - 2, y - 7.5, 2, 1.4, C.gold, true); g.ell(x + 2, y - 7.5, 2, 1.4, C.gold, true); }); }
function heart(g, x, y, s = 1) { part(g, () => { g.ell(x - 2.2 * s, y, 2.8 * s, 2.6 * s, C.pink); g.ell(x + 2.2 * s, y, 2.8 * s, 2.6 * s, C.pink); g.poly([[x - 4.8 * s, y + 0.8 * s], [x + 4.8 * s, y + 0.8 * s], [x, y + 6 * s]], C.pink, 3); }); }
function zz(g, x, y, s, u) {                                // ett Z som stiger och bleknar
  if (u > 0.95) return; const w = 2 + s * 1.5;
  part(g, () => { g.rect(x, y, w, 1, C.white, 5); g.line(x + w - 1, y + 1, x, y + w - 1, C.white, 5); g.rect(x, y + w - 1, w, 1, C.white, 5); }, true);
}
function openBook(g, x, y, p) {                              // öppen bok sedd snett framifrån, en sida vänds mitt i slingan
  part(g, () => { g.poly([[x - 9, y], [x, y + 2], [x, y + 9], [x - 9, y + 7]], C.paper, 4); g.poly([[x, y + 2], [x + 9, y], [x + 9, y + 7], [x, y + 9]], C.paper, 3); g.rect(x - 0.5, y + 2, 1, 7, C.blue, 2); });
  part(g, () => { for (let i = 0; i < 3; i++) { g.line(x - 7, y + 2 + i * 2, x - 2, y + 3 + i * 2, C.grey, 2); g.line(x + 2, y + 3 + i * 2, x + 7, y + 2 + i * 2, C.grey, 2); } }, true);
  const u = p > 0.6 ? (p - 0.6) / 0.3 : -1;
  if (u >= 0 && u <= 1) part(g, () => { const tx = x + 8 - u * 16; g.poly([[x, y + 2], [tx, y - 1 - sin(u * PI) * 4], [tx, y + 6 - sin(u * PI) * 4], [x, y + 9]], C.white, 5); });
}
function paperSheet(g) { part(g, () => { g.poly([[6, 10], [56, 8], [58, 56], [8, 58]], C.paper, 4); }); }
function pencil(g, x, y) { part(g, () => { g.thick(x + 2, y - 2, x + 14, y - 16, 3.4, C.pencil, 4); g.thick(x + 12, y - 14, x + 15, y - 17.5, 3.4, C.pink, 3); g.poly([[x, y], [x + 1, y - 4], [x + 4, y - 1]], C.plank, 4); }); part(g, () => g.dot(x, y, C.ink, 0), true); }
function crayon(g, x, y) { part(g, () => { g.thick(x + 2, y - 2, x + 12, y - 14, 4, C.blue, 3); g.thick(x + 4, y - 4, x + 10, y - 11, 4.2, C.white, 4); g.poly([[x, y], [x + 0.5, y - 4], [x + 4, y - 0.5]], C.blue, 4); }); }
function note(g, x, y, u) { if (u > 0.9) return; part(g, () => { g.ell(x, y + 6, 2.2, 1.7, C.white, false, null, 5); g.rect(x + 1.2, y, 1, 6, C.white, 5); g.poly([[x + 2, y], [x + 5, y + 2], [x + 4.5, y + 3.5], [x + 2, y + 2]], C.white, 5); }); }
function clockFace(g, x, y, r, p) {
  part(g, () => { g.ell(x, y, r, r, C.white, true); g.ell(x, y, r - 1.6, r - 1.6, C.plate, false, null, 5); });
  part(g, () => { const a = p * TAU - PI / 2; g.line(x, y, x + cos(a) * (r - 3), y + sin(a) * (r - 3), C.red, 3); g.line(x, y, x, y - r + 4, C.ink, 1); g.line(x, y, x + 3, y, C.ink, 1); for (let i = 0; i < 4; i++) { const b = i * PI / 2; g.set(round(x + cos(b) * (r - 2.5)), round(y + sin(b) * (r - 2.5)), C.ink, 1); } }, true);
}
function plush(g, x, y, old) {                              // nalle sittande framifrån
  const c = old ? C.plushOld : C.plush;
  part(g, () => {
    g.ell(x - 9, y - 4, 5, 4, c); g.ell(x + 9, y - 4, 5, 4, c);                               // fötter
    g.ell(x, y - 13, 11, 11, c);                                                               // kropp
    g.ell(x - 12, y - 18, 4, 6, c); g.ell(x + 12, y - 18, 4, 6, c);                            // armar
    g.ell(x - 9, y - 39, 4.5, 4.5, c); if (!old) g.ell(x + 9, y - 39, 4.5, 4.5, c);           // öron (det gamla har ett trasigt)
    g.ell(x, y - 31, 10, 9, c);                                                                // huvud
    g.ell(x, y - 27.5, 4.5, 3.4, old ? C.stone : C.plank, true);                               // nos
    g.ell(x, y - 12, 6.5, 6.5, old ? C.stone : C.plank, true);                                 // mage
  });
  if (old) part(g, () => { g.poly([[x + 6, y - 42], [x + 11, y - 40], [x + 8, y - 36]], c, 2); g.rect(x - 6, y - 18, 5, 5, C.patch, 3); g.dot(x - 5, y - 17, C.white, 4); g.dot(x - 3, y - 15, C.white, 4); });
  part(g, () => { g.dot(x - 4, y - 33, C.ink, 0); if (old) { g.rect(x + 3, y - 34, 3, 1, C.ink, 0); g.rect(x + 4, y - 35, 1, 3, C.ink, 0); } else { g.dot(x + 4, y - 33, C.ink, 0); g.dot(x - 4, y - 34, C.white, 5); g.dot(x + 4, y - 34, C.white, 5); } g.rect(x - 1, y - 29, 2, 1, C.ink, 0); }, true);
  if (old) part(g, () => { g.line(x + 2, y - 8, x + 4, y - 4, C.ink, 1); g.line(x - 8, y - 26, x - 6, y - 24, C.ink, 1); }, true);
  else part(g, () => { g.poly([[x, y - 22], [x - 6, y - 25], [x - 6, y - 19]], C.bow, 3); g.poly([[x, y - 22], [x + 6, y - 25], [x + 6, y - 19]], C.bow, 3); g.ell(x, y - 22, 1.6, 1.6, C.bow, true); g.ell(x - 4, y - 36, 1.4, 2, C.white, false, null, 5); });
}

// ---------- bilderna ----------
// ART[id] = { n: antal rutor (1 = stillbild), dur: slingans längd i sekunder, draw(g, p): p = fas 0..1 (ruta/n) }
export const ART = {};
const art = (id, n, dur, draw) => { ART[id] = { n, dur, draw }; };
const still = (id, draw) => art(id, 1, 0, draw);

// --- rörelse: springa, gå, fort, långsamt, hoppa ---
// run och walk är bara hjälten (inga effekter), fast har fartstreck och damm, slow har en sköldpadda bredvid.
art('run', 8, 0.64, (g, p) => {                    // springer på stället, lutar framåt, långa steg och böjda armar
  const ph = p * TAU + PI / 2, a = gait(ph, true), bob = abs(sin(ph)) * 1.6;
  shadow(g, 31, 61, 9);
  hero(g, 31, 60 - bob, 0.9, { ...a, t: p * 2.03 }, null, 0.12);
});
art('walk', 8, 1.1, (g, p) => {                    // går lugnt, upprätt, korta steg
  const ph = p * TAU + PI / 2, a = gait(ph, false), bob = abs(sin(ph)) * 0.6;
  shadow(g, 32, 61, 9);
  hero(g, 32, 60 - bob, 0.9, a, null);
});
art('fast', 8, 0.4, (g, p) => {                    // springer så det står härliga om det: fartstreck, dammoln, framåtlutad
  const ph = p * TAU + PI / 2, a = gait(ph, true), bob = abs(sin(ph)) * 1.6;
  part(g, () => { for (let i = 0; i < 5; i++) { const y = 22 + i * 7, x0 = 1 + fract(p + i * 0.37) * 6; g.rect(x0, y, 9 + (i % 2) * 6, 1, C.white, 5); } }, true);
  for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); part(g, () => g.ell(22 - u * 18, 58 - u * 4, 2 + u * 3, 1.6 + u * 2, C.dirt, false, null, u < 0.4 ? 4 : 3), true); }
  shadow(g, 39, 61, 8);
  hero(g, 39, 60 - bob, 0.86, { ...a, t: p * 2.03 }, 'grin', 0.25);
});
art('slow', 8, 2.4, (g, p) => {                    // går mycket sakta bredvid en sköldpadda, små steg, halvslutna ögon
  const ph = p * TAU + PI / 2, a = gait(ph, false);
  a.legs.b = leg(35.5, ph + PI, 2, 0.8); a.legs.f = leg(42, ph, 2, 0.8);
  shadow(g, 20, 61, 8); shadow(g, 48, 61, 8);
  hero(g, 20, 60, 0.8, a, 'shut');
  tortoise(g, 47, 60, 1.05, p);
});
art('jump', 8, 1.0, (g, p) => {                    // hoppar högt med armarna upp och landar (ruta 0 = högst upp)
  const u = fract(p + 0.5), air = u > 0.15 && u < 0.85, h = air ? sin((u - 0.15) / 0.7 * PI) * 15 : 0, crouch = air ? 0 : 2;
  shadow(g, 32, 61, max(4, 9 - h * 0.3));
  if (!air) part(g, () => { g.ell(19, 59, 2.4, 1.4, C.cloud, false, null, 4); g.ell(45, 59, 2.4, 1.4, C.cloud, false, null, 4); }, true);
  const legs = air ? { b: [32, 51, 33, 55, 0.4], f: [44, 50, 43, 54.5, 0.2] } : { b: [32, 52, 34, 56.5, 0], f: [45, 52, 43, 56.5, 0] };
  const arms = air ? { handB: [53, 27], bendB: [2, -1], handF: [25, 27], bendF: [-2, -1] } : { handB: [46, 46], handF: [31, 46] };
  hero(g, 32, 60 - h + crouch, 0.86, { legs, ...arms }, air ? 'grin' : null);
  if (air && h > 8) part(g, () => { for (const x of [27, 32, 37]) g.line(x, 63 - h, x, 66 - h * 0.6, C.white, 4); }, true);
});

// --- stå och sitta (ett par) ---
still('stand', (g) => {                               // står rakt upp bredvid en tom stol, med en pil uppåt
  shadow(g, 22, 61, 8); chair(g, 40, 46, 60, true);
  hero(g, 22, 60, 0.9, { legs: standLegs, handB: [46, 46], handF: [32, 46] });
});
still('sit', (g) => {                                 // sitter på en stol, fötterna i golvet
  shadow(g, 30, 61, 14); chair(g, 14, 48, 60);
  hero(g, 32, 61, 0.9, { legs: sitLegs, handB: [49, 45], handF: [40, 46] });
});

// --- stort och litet: samma boll, hjälten som måttstock ---
art('big', 6, 1.6, (g, p) => {                        // bollen växer sig större än hjälten, som tittar upp med armarna ut
  const u = p === 0 ? 1 : ease(min(1, p * 1.6)), r = lerp(5, 19, u);
  shadow(g, 44, 61, r * 0.9); ball(g, 44, 60 - r, r, C.red);
  hero(g, 13, 60, 0.6, { legs: standLegs, handB: [53, 30], bendB: [1, -1], handF: [26, 31], bendF: [-1, -1] }, 'o');
});
art('small', 6, 1.6, (g, p) => {                      // bollen krymper till en pytteliten boll vid hjältens fot, pilen pekar på den
  const u = p === 0 ? 1 : ease(min(1, p * 1.6)), r = lerp(8, 2.4, u);
  shadow(g, 42, 61, max(2, r)); ball(g, 42, 60 - r, r, C.red);
  hero(g, 20, 60, 0.6, { legs: standLegs, handB: [54, 49], bendB: [1, 0] }, 'smile');
  if (u > 0.9) arrow(g, 42, 46, 1);
});

// --- glad och ledsen (ett par) ---
art('happy', 6, 0.9, (g, p) => {                      // skuttar med armarna upp, stort leende, solen och glitter
  const h = abs(sin(p * PI)) * 5;
  sunDisc(g, 53, 10, 5, p * 0.8);
  shadow(g, 30, 61, 8);
  hero(g, 30, 60 - h, 0.86, { legs: standLegs, handB: [53, 27], bendB: [2, -1], handF: [25, 27], bendF: [-2, -1] }, 'grin joy blush');
  sparkle(g, 10, 24 + round(sin(p * TAU)), 2); sparkle(g, 54, 36, p < 0.5 ? 2 : 1); sparkle(g, 14, 44, p < 0.5 ? 1 : 2);
});
art('sad', 6, 1.8, (g, p) => {                        // hänger med armarna och huvudet, ledsen mun, ett grått moln som regnar
  cloudBlob(g, 32, 7, 22, C.rain);
  part(g, () => { for (let i = 0; i < 6; i++) { const x = 21 + i * 4, y = 13 + fract(p + i * 0.37) * 8; g.line(x, y, x - 1, y + 2, C.water, 4); } }, true);
  shadow(g, 32, 61, 8);
  hero(g, 32, 61, 0.86, { legs: standLegs, handB: [44, 49], handF: [35, 49], bendB: [0, 1], bendF: [0, 1] }, 'frown sadbrow');
  recolor(g, C.skin, C.paleSkin);
});

// --- varmt och kallt (ett par) ---
art('hot', 6, 1.2, (g, p) => {                        // stark sol, varm röd hy, svettdroppar, tungan ute, värmeslingor
  sunDisc(g, 52, 11, 7, p * 0.8);
  part(g, () => { for (let i = 0; i < 3; i++) { const x = 6 + i * 6; for (let y = 34; y < 54; y++) g.set(x + round(sin(y * 0.6 + p * TAU) * 1.2), y, C.fire, (y % 3) ? 4 : 5); } }, true);
  ground(g, 60, C.dirt);
  hero(g, 34, 60, 0.86, { legs: standLegs }, 'tongue sadbrow');
  recolor(g, C.skin, C.hotSkin);
  part(g, () => { const u = fract(p * 1.5); g.ell(22 - u * 4, 24 + u * 6, 1.2, 1.7, C.water, true); g.ell(48 + u * 4, 20 + u * 6, 1.2, 1.7, C.water, true); g.ell(24 - fract(u + 0.5) * 4, 18 + fract(u + 0.5) * 6, 1, 1.4, C.water, true); });
});
art('cold', 6, 0.6, (g, p) => {                       // snö faller, blåfrusen hy, armarna i kors, huttrar, rök ur munnen
  const sh = (floor(p * 6) % 2) ? 1 : 0;
  part(g, () => { for (let i = 0; i < 14; i++) { const x = (i * 23) % 62 + 1, y = fract(p * 0.5 + i * 0.29) * 60; g.rect(x + round(sin(y * 0.3 + i)), floor(y), 2, 2, C.snow, 5); } }, true);
  ground(g, 60, C.snow);
  hero(g, 31 + sh, 60, 0.86, { legs: standLegs, handB: [38, 40], bendB: [3, 1], handF: [43, 41], bendF: [-2, 2] }, 'o sadbrow');
  recolor(g, C.skin, C.coldSkin);
  part(g, () => { const u = fract(p * 0.5); g.ell(49 + u * 7, 32 - u * 3, 1.5 + u * 2, 1 + u * 1.2, C.white, false, null, u < 0.5 ? 5 : 4); }, true);
});

// --- i, på, under: boll och låda ---
art('in', 6, 1.4, (g, p) => {                         // bollen faller ner i den öppna lådan och ligger kvar där i
  const u = p === 0 ? 1 : ease(min(1, p * 1.5)), by = lerp(8, 37, u);
  shadow(g, 32, 59, 14);
  box(g, 18, 40, 28, 18, { open: true, front: false });
  ball(g, 32, by, 6, C.red);
  box(g, 18, 40, 28, 18, { open: true });
  if (u < 1) part(g, () => { g.line(32, by - 9, 32, by - 12, C.white, 4); }, true);
});
art('on', 6, 1.4, (g, p) => {                         // bollen landar och ligger ovanpå den stängda lådan
  const u = p === 0 ? 1 : ease(min(1, p * 1.5)), by = lerp(6, 33, u);
  shadow(g, 32, 59, 14);
  box(g, 18, 40, 28, 18);
  ball(g, 32, by, 6, C.red);
});
art('under', 6, 1.4, (g, p) => {                      // lådan står på en pall, bollen rullar in under den
  const u = p === 0 ? 1 : ease(min(1, p * 1.5)), bx = lerp(4, 32, u);
  shadow(g, 32, 59, 18);
  part(g, () => { g.rect(14, 38, 36, 3, C.wood, 3); g.rect(15, 41, 3, 18, C.wood, 2); g.rect(46, 41, 3, 18, C.wood, 2); });
  box(g, 20, 21, 24, 16);
  ball(g, bx, 53, 6, C.red);
});

// --- tal: antal äpplen, och siffran i hörnet ---
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
for (const [id, n] of Object.entries(NUM)) {
  // Platser: 1 till 5 på en rad i mitten (eller tärningsmönster), 6 till 10 i två rader om fem (tioram).
  const spots = [];
  if (n <= 5) { const LAY = { 1: [[32, 30]], 2: [[22, 30], [42, 30]], 3: [[16, 30], [32, 30], [48, 30]], 4: [[22, 20], [42, 20], [22, 40], [42, 40]], 5: [[16, 20], [32, 20], [48, 20], [24, 40], [40, 40]] }; spots.push(...LAY[n]); }
  else for (let i = 0; i < n; i++) spots.push([8 + (i % 5) * 12, i < 5 ? 20 : 40]);
  const s = n === 1 ? 2.2 : n <= 3 ? 1.6 : n <= 5 ? 1.35 : 1;
  art(id, n + 2, (n + 2) * 0.32, (g, p) => {         // äpplena kommer ett i taget (ruta 0 = alla)
    const f = round(p * (n + 2)), shown = f === 0 ? n : min(n, f);
    spots.forEach(([x, y], i) => { if (i < shown) apple(g, x, y + (i === shown - 1 && f > 0 && f <= n ? -1 : 0), s); });
    const d = String(n), w = d.length * 8 - 2; part(g, () => g.rect(SIZE - 6 - w, 48, w + 4, 14, C.white, 5));
    [...d].forEach((ch, j) => digit(g, ch, SIZE - 4 - w + j * 8, 50, 2, C.blue));
  });
}

// --- ansiktet nära: le, skratta, gråta ---
// Hjälten i skala 1.8 med huvudet mitt i rutan (fötterna hamnar långt under kanten).
const CLOSE = [29, 92, 1.5];
art('smile', 6, 2.4, (g, p) => {                      // lugnt leende med stängd mun, rosiga kinder, ett litet glitter
  hero(g, ...CLOSE, { legs: standLegs }, 'smile soft blush');
  sparkle(g, 10, 14, p < 0.5 ? 2 : 1);
});
art('laugh', 6, 0.5, (g, p) => {                      // skrattar: ögonen ihopknipna, stor öppen mun, huvudet skakar, skrattstreck
  const sh = (floor(p * 6) % 2) ? 1 : 0;
  hero(g, CLOSE[0] + sh, CLOSE[1] - sh, CLOSE[2], { legs: standLegs }, 'grin joy blush');
  part(g, () => { for (const [x, y, dx] of [[6, 18, -1], [7, 26, -1], [58, 16, 1], [59, 26, 1]]) { g.line(x, y, x + dx * 3, y - 2 + sh, C.white, 5); } }, true);
});
art('cry', 6, 0.9, (g, p) => {                        // gråter: ledsna ögonbryn, öppen gråtmun, tårar som rinner
  hero(g, ...CLOSE, { legs: standLegs }, 'wail sadbrow');
  tears(g, ...CLOSE, p);
});

// --- att äta, sova, simma ---
art('eat', 6, 1.2, (g, p) => {                        // tar ett äpple till munnen och tuggar, ett bett saknas i äpplet
  const u = (sin(p * TAU) + 1) / 2, hx = lerp(46, 50, u), hy = lerp(33, 39, u);
  shadow(g, 30, 61, 9);
  hero(g, 30, 60, 0.9, { legs: standLegs, handB: [hx + 1, hy + 2], bendB: [2, 3] }, u < 0.5 ? 'chew blush' : 'o');
  g.push(30, 60, 0, 0.9); g.push(-39.5, -61); const [ax, ay] = g.pt(hx + 3, hy - 1); g.pop(); g.pop();
  apple(g, ax, ay, 1.15);
  part(g, () => g.ell(ax + 3.2, ay - 1, 1.8, 2.2, C.paper, false, null, 4), true);       // bettet
});
art('sleep', 6, 2.4, (g, p) => {                      // ligger i sängen med huvudet på kudden och täcket upp till hakan, Z Z Z stiger
  part(g, () => { g.rect(4, 14, 56, 40, C.wood, 2); g.rect(6, 16, 52, 6, C.wood, 3); });                                  // sänggavel
  part(g, () => g.ell(30, 36, 22, 9, C.sheet, true));                                                                        // kudde
  hero(g, 30, 74, 1.1, { legs: standLegs, blink: true }, 'shut');
  part(g, () => { g.rect(2, 45, 60, 19, C.bed, 3); g.rect(2, 45, 60, 3, C.sheet, 4); for (let x = 8; x < 60; x += 12) g.rect(x, 52, 6, 6, C.bed, 4); });   // täcket
  for (let i = 0; i < 3; i++) { const u = fract(p + i / 3), s = 1 + floor(u * 2); zz(g, 44 + i * 2 + u * 8, 30 - u * 24, s, u); }
});
art('swim', 8, 1.2, (g, p) => {                       // simmar: huvudet och axlarna ovanför vattnet, armarna tar simtag i tur och ordning
  const ph = p * TAU, s = sin(ph);
  hero(g, 28, 64, 1.0, { legs: standLegs, handB: [50 + s * 8, 34 + max(0, -s) * 12 - max(0, s) * 4], bendB: [1, -1], handF: [36 - s * 8, 36 + max(0, s) * 12 - max(0, -s) * 4], bendF: [1, -1] }, 'o');
  part(g, () => { for (let x = 0; x < SIZE; x++) { const y = 42 + round(sin(x * 0.35 + ph) * 1); g.rect(x, y, 1, SIZE - y, C.water, 3); } });
  part(g, () => { for (let x = 0; x < SIZE; x += 7) g.rect((x + round(p * 7)) % SIZE, 42 + round(sin(x * 0.35 + ph)), 3, 1, C.foam, 5); g.ell(30, 43, 14, 1.5, C.foam, false, null, 5); }, true);
  const sp = fract(p * 2); part(g, () => { for (let i = 0; i < 5; i++) g.rect(round(46 + i * 3 + sp * 2), round(40 - sin(sp * PI) * 6 + (i % 2) * 2), 1.5, 1.5, C.foam, 5); }, true);
});

// --- händer och armar: vinka, klappa, ge, krama ---
art('wave', 6, 0.9, (g, p) => {                       // vinkar med armen högt upp, ler
  const w = sin(p * TAU) * 4;
  shadow(g, 28, 61, 9);
  hero(g, 28, 60, 0.9, { legs: standLegs, handB: [55 + w, 24], bendB: [2, 0] }, 'smile');
  part(g, () => { g.line(56, 12, 59, 9, C.white, 5); g.line(60, 16, 63, 14, C.white, 5); }, true);
});
art('clap', 6, 0.6, (g, p) => {                       // klappar händerna framför bröstet, stjärnor när händerna möts
  const shut = p < 0.34, d = shut ? 0 : 5 * sin((p - 0.34) / 0.66 * PI);
  shadow(g, 28, 61, 9);
  hero(g, 28, 60, 0.9, { legs: standLegs, handB: [50 + d, 33], bendB: [-1, 2], handF: [47 - d, 34], bendF: [-1, 2] }, 'grin');
  if (shut) part(g, () => { for (const [dx, dy] of [[5, -4], [7, 0], [5, 4]]) g.line(46 + dx, 25 + dy, 49 + dx, 25 + dy * 1.6, C.gold, 5); }, true);
});
art('give', 8, 1.8, (g, p) => {                       // hjälten räcker fram ett paket till en vän, som tar emot det
  const u = ease(min(1, p * 1.4)), bx = lerp(24, 36, u);
  shadow(g, 14, 61, 7); shadow(g, 50, 61, 7);
  hero(g, 14, 60, 0.78, { legs: standLegs, handB: [lerp(51, 56, u), 40], bendB: [1, 2] }, 'smile');
  heroFlip(g, 50, 60, 0.78, { legs: standLegs, handB: [lerp(49, 55, u), 40], bendB: [1, 2] }, 'grin', FRIEND);
  gift(g, bx, 31);
});
art('hug', 6, 1.6, (g, p) => {                        // två kramas, armarna om varandra, ett hjärta ovanför
  const s = sin(p * TAU) * 0.6;
  shadow(g, 32, 61, 14);
  heroFlip(g, 38 + s, 60, 0.82, { legs: standLegs, handB: [46, 40], handF: [44, 41], bendF: [0, 1] }, 'smile', FRIEND);
  hero(g, 26 - s, 60, 0.82, { legs: standLegs, handB: [53, 39], bendB: [0, 1], handF: [52, 40], bendF: [2, 1] }, 'smile shut');
  heart(g, 32, 8 - round(abs(sin(p * TAU)) * 2), 1);
});

// --- att göra saker: laga mat, läsa, skriva, rita, sjunga, dansa, klättra ---
art('cook', 6, 1.0, (g, p) => {                       // rör i en gryta som puttrar på elden, ånga stiger
  const ph = p * TAU, sx = 46 + cos(ph) * 2, sy = 41 + sin(ph) * 0.6;
  shadow(g, 20, 61, 8);
  hero(g, 20, 60, 0.86, { legs: standLegs, handB: [sx, sy - 6], bendB: [1, 2] }, 'smile');
  part(g, () => { g.thick(36, 61, 58, 58, 2.4, C.wood, 3); g.thick(36, 58, 58, 61, 2.4, C.wood, 2); });
  part(g, () => { for (let i = 0; i < 4; i++) { const x = 38 + i * 5; g.poly([[x, 59], [x + 4, 59], [x + 2 + sin(ph * 2 + i), 52 - (i % 2) * 3]], i % 2 ? C.fire : C.sun, 5); } }, true);
  part(g, () => { g.ell(47, 46, 11, 7, C.pot, true, (dx, dy) => dy > -0.3); g.rect(35, 43, 24, 2.5, C.pot, 4); g.rect(32, 44, 3, 2, C.pot, 2); g.rect(59, 44, 3, 2, C.pot, 2); g.rect(38, 43.5, 18, 1.5, C.soup, 4); });
  g.push(20, 60, 0, 0.86); g.push(-39.5, -61); const [hx, hy] = g.pt(sx, sy - 6); g.pop(); g.pop();
  part(g, () => g.thick(hx, hy, hx + 5, 46, 1.4, C.wood, 3));
  part(g, () => { for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); g.ell(40 + i * 6 + sin(u * 6 + i) * 2, 40 - u * 22, 1.6 + u * 1.6, 1.4 + u, C.cloud, false, null, u < 0.5 ? 5 : 4); } }, true);
});
art('read_a_book', 6, 2.4, (g, p) => {                // sitter med en öppen bok och läser, en sida vänds
  shadow(g, 34, 61, 12); chair(g, 22, 48, 60);
  hero(g, 30, 61, 0.9, { legs: sitLegs, handB: [53, 40], bendB: [1, 2], handF: [46, 41], bendF: [-1, 2] }, 'smile');
  openBook(g, 47, 36, p);
});
art('write', 8, 1.6, (g, p) => {                      // en penna skriver bokstavsrader på ett papper, rad för rad
  paperSheet(g);
  const tot = 3 * 18, done = p === 0 ? tot : floor(p * tot * 1.15);
  let k = 0; let tip = [12, 18];
  part(g, () => { for (let r = 0; r < 3; r++) for (let i = 0; i < 18; i++, k++) { if (k >= done) break; const x = 12 + i * 2.2, y = 18 + r * 11; const hgt = [3, 5, 2, 4, 3, 5, 2, 3][(i + r * 3) % 8]; if (i % 6 === 5) continue; g.rect(x, y + 5 - hgt, 1, hgt, C.blue, 2); if (i % 2) g.rect(x, y + 4, 2, 1, C.blue, 2); tip = [x + 2, y + 4]; } });
  pencil(g, tip[0], tip[1]);
});
art('draw', 8, 1.6, (g, p) => {                       // en krita ritar en sol och ett hus på papperet
  paperSheet(g);
  const pts = [];
  for (let i = 0; i <= 24; i++) { const a = i / 24 * TAU; pts.push([22 + cos(a) * 6, 22 + sin(a) * 6, C.sun]); }
  for (const [x0, y0, x1, y1] of [[34, 46, 34, 34], [34, 34, 42, 27], [42, 27, 50, 34], [50, 34, 50, 46], [50, 46, 34, 46]]) for (let i = 0; i <= 10; i++) pts.push([lerp(x0, x1, i / 10), lerp(y0, y1, i / 10), C.red]);
  const done = p === 0 ? pts.length : floor(p * pts.length * 1.15); let tip = pts[0];
  part(g, () => { for (let i = 0; i < min(done, pts.length); i++) { const [x, y, c] = pts[i]; g.rect(x, y, 2, 2, c, 3); tip = pts[i]; } });
  if (done >= 25) part(g, () => { for (let i = 0; i < 8; i++) { const a = i * PI / 4; g.line(22 + cos(a) * 8, 22 + sin(a) * 8, 22 + cos(a) * 10, 22 + sin(a) * 10, C.sun, 4); } }, true);
  crayon(g, tip[0] + 1, tip[1] + 1);
});
art('sing', 6, 1.2, (g, p) => {                       // sjunger med öppen mun och huvudet bakåt, noter flyger ur munnen
  shadow(g, 24, 61, 9);
  hero(g, 24, 60, 0.9, { legs: standLegs, handF: [38, 36], bendF: [-2, 2] }, 'o shut');
  for (let i = 0; i < 2; i++) { const u = fract(p + i / 2); note(g, 44 + u * 12, 28 - u * 22 + sin(u * 8) * 2, u); }
});
art('dance', 8, 1.2, (g, p) => {                      // dansar: höfterna svänger, armarna växlar upp och ner, ett ben lyfts
  const s = floor(p * 4) % 2, sway = s ? 2 : -2;
  shadow(g, 32, 61, 9);
  const legs = s ? { b: [33, 52, 34, 56.5, 0], f: [47, 50, 46, 53, 0.3] } : { b: [31, 50, 29, 53, -0.4], f: [44, 52, 43, 56.5, 0] };
  const arms = s ? { handB: [54, 26], bendB: [2, -1], handF: [28, 46] } : { handB: [50, 46], handF: [24, 27], bendF: [-2, -1] };
  hero(g, 32 + sway, 60 - (floor(p * 8) % 2), 0.88, { legs, ...arms }, 'grin', sway * 0.04);
  sparkle(g, s ? 8 : 56, 14, 2); sparkle(g, s ? 54 : 10, 40, 1);
});
art('climb', 8, 1.6, (g, p) => {                      // klättrar uppför en stege, händerna växlar, stegen glider nedåt
  const off = fract(p) * 8, s = floor(p * 2) % 2;
  part(g, () => { g.rect(37, 0, 2, SIZE, C.wood, 3); g.rect(52, 0, 2, SIZE, C.wood, 2); for (let y = -8 + off; y < SIZE; y += 8) g.rect(37, y, 17, 2, C.plank, 4); });
  const tmp = new G(SIZE, SIZE);
  hero(tmp, 30, 62, 0.86, { legs: s ? { b: [42, 50, 44, 53, 0], f: [47, 54, 48, 58, 0] } : { b: [42, 53, 44, 58, 0], f: [47, 50, 48, 53, 0] }, handB: s ? [54, 22] : [53, 30], bendB: [2, 0], handF: s ? [48, 31] : [48, 23], bendF: [0, 0] }, 'smile');
  blit(g, tmp);
});

// --- vänta, titta, tänka ---
art('wait', 8, 2.0, (g, p) => {                       // står med armarna i kors och stampar med foten, klockans visare går
  const tap = floor(p * 8) % 2;
  shadow(g, 22, 61, 8);
  hero(g, 22, 60, 0.86, { legs: { b: [34.5, 52, 34.5, 56.5, 0], f: [44, 51, 45, 55.5 - tap * 2, -0.25 * tap] }, handB: [38, 40], bendB: [3, 1], handF: [43, 41], bendF: [-2, 2] }, 'frown');
  clockFace(g, 50, 24, 9, p);
  part(g, () => { for (let i = 0; i < 3; i++) if (floor(p * 4) % 4 >= i) g.rect(14 + i * 4, 8, 2, 2, C.white, 5); }, true);
});
art('look', 6, 1.8, (g, p) => {                       // håller handen över ögonen och spanar mot en fågel långt bort
  shadow(g, 18, 61, 8);
  hero(g, 18, 60, 0.86, { legs: standLegs, handB: [48, 19], bendB: [3, -2] }, 'o');
  part(g, () => { for (let i = 0; i < 5; i++) g.rect(36 + i * 4.5, 23 - i * 2.2, 2, 1, C.white, 4); }, true);
  const fy = 9 + round(sin(p * TAU) * 1.5), f = floor(p * 6) % 2;
  part(g, () => { g.poly([[54, fy], [58, fy - 3 * (f ? -1 : 1)], [60, fy]], C.blue, 3); g.poly([[58, fy], [62, fy - 3 * (f ? -1 : 1)], [63, fy]], C.blue, 3); g.ell(58.5, fy + 0.5, 2.5, 1.6, C.blue); });
});

// --- med hunden, tandborsten, sängen ---
art('walk_the_dog', 8, 1.1, (g, p) => {               // går med hunden i koppel, båda tar steg
  const ph = p * TAU + PI / 2, a = gait(ph, false);
  shadow(g, 18, 61, 7); shadow(g, 48, 61, 8);
  hero(g, 18, 60, 0.76, { ...a, handB: [52, 44] }, 'smile');
  dog(g, 47, 60, 0.9, p, true);
  part(g, () => { g.line(33, 41, 37, 47, C.red, 3); g.line(37, 47, 44, 49, C.red, 3); }, true);
});
art('brush_my_teeth', 6, 0.5, (g, p) => {              // nära ansiktet: tandborsten åker fram och tillbaka vid munnen, skum
  const d = sin(p * TAU) * 2.5;
  hero(g, ...CLOSE, { legs: standLegs }, 'grin');
  part(g, () => { g.thick(46 + d, 47, 62 + d, 52, 3, C.blue, 4); g.rect(44 + d, 42.5, 5, 3, C.white, 5); g.rect(43 + d, 45, 6, 2, C.blue, 3); });
  part(g, () => { for (const [x, y, r] of [[38, 47, 1.6], [52, 40, 1.3], [48, 49, 1.2], [36, 44, 1]]) g.ell(x + (floor(p * 6) % 2), y, r, r, C.white, false, null, 5); }, true);
});
art('go_to_bed', 8, 2.2, (g, p) => {                  // går fram till sängen och gäspar, månen lyser i fönstret
  const ph = p * TAU + PI / 2, a = gait(ph, false);
  part(g, () => { g.rect(4, 6, 18, 16, C.night, 3); g.rect(12, 6, 2, 16, C.wood, 3); g.rect(4, 13, 18, 2, C.wood, 3); });
  part(g, () => { g.ell(9, 10, 2.6, 2.6, C.sun, true); g.ell(10.5, 9, 2, 2, C.night, false, null, 3); });
  bed(g, 30, 60, 32);
  shadow(g, 16, 61, 7);
  hero(g, 16, 60, 0.76, { ...a, handB: [44, 30], bendB: [2, 0] }, 'o shut');
  zz(g, 24, 16 - p * 4, 1, p);
});
// --- hungrig och törstig (ett par): en tankebubbla visar vad som saknas ---
art('hungry', 6, 1.0, (g, p) => {                     // håller sig om magen, magen kurrar, bubblan visar mat, tom tallrik
  const r = floor(p * 6) % 2;
  shadow(g, 22, 61, 8);
  hero(g, 22, 60, 0.82, { legs: standLegs, handF: [38, 47], bendF: [-1, 1], handB: [44, 48], bendB: [0, 1] }, 'o sadbrow');
  part(g, () => { for (const [x, y] of [[33, 44], [35, 47], [33, 50]]) g.line(x + r, y, x + 3 + r, y + 1, C.white, 5); }, true);
  bubble(g, 47, 14, 26, 18, 34, 28);
  apple(g, 42, 15, 0.9); part(g, () => { g.rect(48, 13, 7, 6, C.plank, 3); g.ell(51.5, 12.5, 3.6, 2, C.plank, true); });   // äpple och bröd
  plate(g, 50, 58, 16);
});
art('thirsty', 6, 1.0, (g, p) => {                    // tungan ute, håller fram ett tomt glas, bubblan visar ett glas vatten
  shadow(g, 22, 61, 8);
  hero(g, 22, 60, 0.82, { legs: standLegs, handB: [51, 44], bendB: [1, 2] }, 'tongue sadbrow');
  g.push(22, 60, 0, 0.82); g.push(-39.5, -61); const [gx, gy] = g.pt(53, 46); g.pop(); g.pop();
  glass(g, gx + 2, gy + 2, 0);
  bubble(g, 47, 14, 24, 18, 34, 28);
  glass(g, 47, 21, 0.8, C.water);
  part(g, () => { for (let i = 0; i < 3; i++) { const a = p * TAU + i * 2; g.set(round(14 + i * 3), round(40 + sin(a) * 1), C.sun, 4); } }, true);
});

// --- gammal och ny (ett par): samma nalle, sliten och grå mot ny och blank ---
art('old', 6, 1.6, (g, p) => {                       // grå blekt nalle med lapp, ett öra trasigt, dammoln och en fluga
  plush(g, 32, 58, true);
  const fx = 46 + cos(p * TAU) * 8, fy = 18 + sin(p * TAU * 2) * 4;
  part(g, () => { g.rect(round(fx), round(fy), 2, 1, C.ink, 1); g.set(round(fx), round(fy) - 1, C.white, 4); g.set(round(fx) + 1, round(fy) - 1, C.white, 4); }, true);
  part(g, () => { for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); g.ell(14 + i * 16, 58 - u * 8, 1.5 + u, 1 + u * 0.6, C.stone, false, null, 3); } }, true);
});
art('new', 6, 1.2, (g, p) => {                       // ny blank nalle med rosett, glitter som tänds och slocknar
  plush(g, 32, 58, false);
  const f = floor(p * 6);
  sparkle(g, 12, 16, f % 3 === 0 ? 3 : 1); sparkle(g, 52, 12, f % 3 === 1 ? 3 : 1); sparkle(g, 54, 42, f % 3 === 2 ? 3 : 1); sparkle(g, 10, 44, f % 2 ? 2 : 0);
});

// ---------- fraser byggda av samma delar (run fast, big dog ...) ----------
// Fraserna jämförs bara med varandra på korten (quiz.js håller fraser och enstaka ord isär), så bilderna
// behöver skilja sig från de andra fraserna: storleken på djuret, farten, höjden, varmt mot kallt, gammalt mot nytt.
const REF = (g) => hero(g, 13, 60, 0.6, { legs: standLegs }, 'smile');      // hjälten som måttstock bredvid djuren
art('big_dog', 6, 1.2, (g, p) => { shadow(g, 13, 61, 5); shadow(g, 42, 61, 16); REF(g); dog(g, 38, 60, 1.7, p); });
art('small_dog', 6, 1.2, (g, p) => { shadow(g, 13, 61, 5); shadow(g, 44, 61, 5); REF(g); dog(g, 44, 60, 0.6, p); arrow(g, 46, 40, 1); });
art('small_cat', 6, 1.6, (g, p) => { shadow(g, 13, 61, 5); shadow(g, 44, 61, 5); REF(g); cat(g, 43, 60, 0.75, p); arrow(g, 46, 40, 1); });
art('run_fast', 8, 0.5, (g, p) => {                   // springer tvärs över rutan med fartstreck och damm
  const ph = p * TAU * 2 + PI / 2, a = gait(ph, true), x = 32 + (fract(p + 0.5) - 0.5) * 20;
  part(g, () => { for (let i = 0; i < 4; i++) g.rect(x - 26 + (i % 2) * 4, 26 + i * 8, 12, 1, C.white, 5); }, true);
  part(g, () => g.ell(x - 14, 58, 4, 2.4, C.dirt, false, null, 4), true);
  shadow(g, x, 61, 8);
  hero(g, x, 60 - abs(sin(ph)) * 1.6, 0.86, { ...a, t: p }, 'grin', 0.25);
});
art('run_slow', 8, 2.6, (g, p) => {                   // springer med tunga, sega steg, trött och svettig, sköldpaddan håller jämna steg
  const ph = p * TAU + PI / 2, a = gait(ph, true), bob = abs(sin(ph)) * 1;
  shadow(g, 22, 61, 8); shadow(g, 50, 61, 7);
  hero(g, 22, 60 - bob, 0.8, a, 'o sadbrow', 0.06);
  part(g, () => { const u = fract(p * 2); g.ell(14, 22 + u * 6, 1, 1.5, C.water, true); }, true);
  tortoise(g, 49, 60, 0.95, p);
});
art('jump_high', 8, 1.4, (g, p) => {                  // hoppar ända upp till en stjärna högt upp (ruta 0 = högst upp)
  const u = fract(p + 0.5), air = u > 0.1 && u < 0.9, h = air ? sin((u - 0.1) / 0.8 * PI) * 27 : 0;
  ground(g, 61, C.grass);
  star4(g, 48, 7, 5); sparkle(g, 48, 7, h > 22 ? 3 : 1);
  shadow(g, 30, 61, max(3, 8 - h * 0.15));
  const legs = air ? { b: [32, 51, 33, 55, 0.4], f: [44, 50, 43, 54.5, 0.2] } : { b: [32, 52, 34, 56.5, 0], f: [45, 52, 43, 56.5, 0] };
  hero(g, 30, 60 - h, 0.62, { legs, ...(air ? { handB: [54, 24], bendB: [2, -1], handF: [26, 27], bendF: [-2, -1] } : {}) }, air ? 'grin' : null);
  if (air && h > 12) part(g, () => { for (const x of [26, 30, 34]) g.line(x, 64 - h * 0.6, x, 60 - h * 0.4, C.white, 4); }, true);
});
art('hot_milk', 6, 1.4, (g, p) => {                   // mugg med mjölk och ånga som ringlar upp
  part(g, () => { g.rect(18, 26, 24, 28, C.red, 3); g.ell(42, 38, 6, 7, C.red, true, (dx, dy, d2) => d2 > 0.35); g.rect(18, 25, 24, 3, C.white, 5); });
  part(g, () => { for (let i = 0; i < 3; i++) { const x0 = 22 + i * 8; for (let k = 0; k < 14; k++) { const y = 22 - k, x = x0 + round(sin((k + p * 14) * 0.5 + i) * 1.5); if ((k + floor(p * 14)) % 7 < 5) g.set(x, y, C.white, 4); } } }, true);
  part(g, () => { g.ell(30, 58, 16, 2.4, C.fire, false, null, 4); }, true);
});
art('cold_milk', 6, 1.4, (g, p) => {                  // glas med mjölk och isbitar, frost och snöflingor
  part(g, () => { g.poly([[16, 20], [44, 20], [41, 58], [19, 58]], C.glass, 4); g.poly([[17.5, 28], [42.5, 28], [40.6, 56], [19.4, 56]], C.white, 5); });
  part(g, () => { g.rect(22, 24, 7, 7, C.ice, 5); g.rect(32, 22, 7, 7, C.ice, 4); g.rect(27, 31, 6, 6, C.ice, 5); });
  const f = floor(p * 6);
  for (const [x, y, k] of [[52, 14, 0], [8, 30, 1], [54, 44, 2]]) { const on = (f + k) % 3 !== 0; part(g, () => { g.rect(x - 3, y, 7, 1, C.snow, on ? 5 : 3); g.rect(x, y - 3, 1, 7, C.snow, on ? 5 : 3); g.set(x - 2, y - 2, C.snow, 5); g.set(x + 2, y + 2, C.snow, 5); g.set(x + 2, y - 2, C.snow, 5); g.set(x - 2, y + 2, C.snow, 5); }, true); }
});
function shoe(g, x, y, old) {                                // sko från sidan med snören, tån åt höger
  const c = old ? C.plushOld : C.blue;
  part(g, () => {
    g.poly([[x - 16, y - 4], [x - 15, y - 16], [x - 4, y - 17], [x + 2, y - 10], [x + 13, y - 8], [x + 17, y - 4], [x + 17, y], [x - 16, y]], c, 3);
    g.rect(x - 17, y - 2, 35, 3.5, old ? C.stone : C.white, old ? 3 : 5);
    for (let i = 0; i < 3; i++) g.rect(x - 4 + i * 4, y - 13 + i * 1.4, 3, 1.3, C.white, 5);
  });
  if (old) part(g, () => { g.ell(x + 10, y - 4, 3, 2.2, C.skin, true); g.rect(x - 12, y - 12, 5, 5, C.patch, 3); g.line(x - 2, y - 6, x + 3, y - 3, C.ink, 1); g.line(x + 16, y + 1, x + 19, y + 3, C.stone, 2); }, true);
  else part(g, () => { g.line(x - 13, y - 13, x - 10, y - 13, C.white, 5); g.line(x + 4, y - 8, x + 9, y - 7, C.white, 5); }, true);
}
art('old_shoe', 6, 1.6, (g, p) => {                   // sliten grå sko med hål där tån sticker ut, lapp och en fluga
  shadow(g, 32, 50, 18); shoe(g, 30, 48, true);
  const fx = 44 + cos(p * TAU) * 9, fy = 20 + sin(p * TAU * 2) * 4;
  part(g, () => { g.rect(round(fx), round(fy), 2, 1, C.ink, 1); g.set(round(fx), round(fy) - 1, C.white, 4); g.set(round(fx) + 1, round(fy) - 1, C.white, 4); }, true);
});
art('new_shoe', 6, 1.2, (g, p) => {                   // ny blank sko med glitter
  shadow(g, 32, 50, 18); shoe(g, 30, 48, false);
  const f = floor(p * 6);
  sparkle(g, 12, 18, f % 3 === 0 ? 3 : 1); sparkle(g, 50, 22, f % 3 === 1 ? 3 : 1); sparkle(g, 56, 52, f % 3 === 2 ? 2 : 0);
});
// Rita ett djur: djuret växer fram från vänster på papperet bakom kritan (ruta 0 = färdig teckning).
function drawAnimal(g, p, fn) {
  paperSheet(g);
  const tmp = new G(SIZE, SIZE); fn(tmp);
  const edge = p === 0 ? SIZE : lerp(8, 60, min(1, p * 1.2));
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < min(SIZE, edge); x++) { const i = y * SIZE + x; if (tmp.R[i] >= 0) { g.R[i] = tmp.R[i]; g.L[i] = tmp.L[i]; } }
  crayon(g, min(56, edge), p === 0 ? 40 : 30 + sin(p * 30) * 8);
}
art('draw_a_cat', 8, 1.8, (g, p) => drawAnimal(g, p, (t) => cat(t, 30, 50, 2.2, 0)));
art('draw_a_dog', 8, 1.8, (g, p) => drawAnimal(g, p, (t) => dog(t, 28, 52, 1.6, 0)));

// ---------- rendering ----------
// Ritar en bild vid fas p på en ny G (64x64).
export function drawArt(id, p = 0, g = new G(SIZE, SIZE)) { const A = ART[id]; if (!A) return null; g.clear(); A.draw(g, p); rim(g); return g; }
// Ljusa detaljer utan kontur (fartstreck, glitter, Z, noter, snö) får en mörk kant, så att de syns även på ljusa
// bakgrunder (boksidan och ordboken är ljusa, korten i striden mörka).
const LIGHT = new Set([C.white, C.snow, C.foam, C.cloud, C.gold]);
function rim(g) {
  const { w, h, R: Rr, L } = g, add = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (Rr[i] >= 0) continue;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) if (j >= 0 && LIGHT.has(Rr[j]) && L[j] >= 4) { add.push(i, Rr[j]); break; }
  }
  for (let k = 0; k < add.length; k += 2) { Rr[add[k]] = add[k + 1]; L[add[k]] = 0; }
}
// Ord vars ritade bild är avstängd (föräldern har underkänt den i granskningssidan): de visar den gamla bildfilen.
export const OFF = new Set(['smile']);      // Jesper 2026-11-17: den ritade smile-bilden avvisad, emojin används
export const hasArt = (id) => !!ART[id] && !OFF.has(id);
const SHEET = new Map();
const canDraw = () => typeof document !== 'undefined' && !!document.createElement;
// Alla rutor bredvid varandra på en canvas, som data-url. Sparas efter första gången.
export function sheetURL(id) {
  if (SHEET.has(id)) return SHEET.get(id);
  const A = ART[id]; if (!A || !canDraw()) return null;
  const c = document.createElement('canvas'); c.width = SIZE * A.n; c.height = SIZE;
  const ctx = c.getContext('2d'), one = document.createElement('canvas'); one.width = one.height = SIZE;
  const oc = one.getContext('2d'), g = new G(SIZE, SIZE);
  for (let f = 0; f < A.n; f++) { drawArt(id, f / A.n, g); g.img = null; g.paint(oc); ctx.drawImage(one, f * SIZE, 0); }
  const url = c.toDataURL('image/png'); SHEET.set(id, url); return url;
}
// Första rutan som egen data-url (stillbild, till exempel som bakgrundsbild i minispelet med dimman).
const STILL = new Map();
export function artStill(id) {
  if (STILL.has(id)) return STILL.get(id);
  if (!ART[id] || !canDraw()) return null;
  const c = document.createElement('canvas'); c.width = c.height = SIZE; drawArt(id, 0).paint(c.getContext('2d'));
  const url = c.toDataURL('image/png'); STILL.set(id, url); return url;
}
// CSS för de rörliga bilderna läggs in en gång. Ett ark med n rutor visas med object-fit: cover (en ruta hög)
// och object-position flyttas i n steg från vänster kant till höger kant.
const KEYS = new Set();
function css(n) {
  if (!canDraw()) return;
  let st = document.getElementById('wordart-css');
  if (!st) { st = document.createElement('style'); st.id = 'wordart-css'; st.textContent = 'img.wart{image-rendering:pixelated;aspect-ratio:1/1}img.wart.wanim{object-fit:cover!important;object-position:0 0}@media (prefers-reduced-motion:reduce){img.wart.wanim{animation:none!important}}'; document.head.appendChild(st); }
  if (n > 1 && !KEYS.has(n)) { KEYS.add(n); st.textContent += `@keyframes wart${n}{to{object-position:${(100 * n / (n - 1)).toFixed(4)}% 0}}`; }
}
// HTML för en ordbild: ett <img> med arket. cls = klassen bilden ska ha där den visas (pimg i spelet, mpic i minispelen).
// Ett dolt span med ordets id följer med, så att svarsloggen (som läser kortets text eller bildens filnamn) får samma
// värde som med de gamla bildfilerna.
export function artHTML(id, cls = 'pimg') {
  const A = ART[id], url = A && sheetURL(id); if (!url) return '';
  css(A.n);
  const anim = A.n > 1 ? ` wanim" style="animation:wart${A.n} ${A.dur}s steps(${A.n}) infinite` : '';
  return `<img class="${cls} wart${anim}" src="${url}" alt="" draggable="false" data-art="${id}"><span hidden>${id}</span>`;
}
// Ritar arken i förväg, några åt gången när webbläsaren har tid, så att första kortet inte behöver vänta.
export function warmArt(ids = Object.keys(ART)) {
  if (!canDraw()) return;
  const todo = ids.filter((id) => ART[id] && !SHEET.has(id));
  const step = (dl) => { const t0 = performance.now(); while (todo.length && performance.now() - t0 < 8) sheetURL(todo.shift()); if (todo.length) later(step); };
  const later = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 500 }) : setTimeout(fn, 30));
  later(step);
}

// ---------- omritningar i egna filer ----------
// wordart-more.js laddar filer som ritar om ord (granskningen 2026-11-17). redo() byter bilden och sparar den gamla i OLD,
// så att granskningssidan kan visa före och efter. H ger de filerna samma verktyg och färger som bilderna här.
export const OLD = {};
export function redo(id, n, dur, draw) { if (ART[id] && !OLD[id]) OLD[id] = ART[id]; ART[id] = { n, dur, draw }; }
export const H = { sin, cos, PI, TAU, abs, max, min, floor, round, clamp, lerp, ease, fract, C, CLOSE, FRIEND, REF, standLegs, sitLegs,
  part, blit, hpx, hero, heroFlip, drawFace, tears, leg, gait, shadow, ground, ball, apple, star4, sparkle, cloudBlob, sunDisc, bubble, digit,
  dog, cat, tortoise, box, plate, glass, bed, chair, arrow, recolor, gift, heart, zz, openBook, paperSheet, pencil, crayon, note, clockFace, plush, shoe, drawAnimal };
