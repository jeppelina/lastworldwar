// Omritningar (granskningen 2026-11-17). Se wordart-more.js.
// Gruppen life: vardagens sysslor. Varje bild visar hjälten i färd med sysslan (inte bara ett föremål),
// och ska gå att skilja från grannorden i samma värld (breakfast mot porridge och egg, watch_tv mot
// play_video_games, sing mot music och listen_to_music, go_to_bed mot sleep, do_homework mot write och read_a_book).
import { redo, H } from './wordart.js';
import { G, ramp as R } from './pixel.js';

const { sin, cos, PI, TAU, abs, max, min, floor, round, clamp, lerp, ease, fract, C, CLOSE, standLegs, sitLegs,
  part, blit, hpx, hero, gait, heroFlip, shadow, ground, ball, sunDisc, digit, glass, bed, chair, note, cloudBlob } = H;

// ---------- egna färger ----------
const K = {
  oat: R('#e8d3a0'), jam: R('#d8283c'), juice: R('#ff9a1f'), cheese: R('#ffd84a'), bread: R('#d9a25e'), bowl: R('#4f8fe8'),
  table: R('#b07a45'), wall: R('#f3e6c8'), morning: R('#ffd9a0'), tile: R('#cfe8f5'), tile2: R('#cdeede'), steel: R('#b8c0d4'), net: R('#e8ecf6'),
  brick: R('#c8553d'), board: R('#2f7a4f'), roof: R('#6a4a8a'), sofa: R('#d0603a'), tv: R('#3a3d52'), screen: R('#6fc8ff'),
  pad: R('#4a4e66'), green: R('#3fae4a'), bike: R('#e04a3c'), tyre: R('#2b2740'), foam: R('#ffffff'), phone: R('#2d3148'),
  hill: R('#7cc46a'), book: R('#e05a4a'), speaker: R('#4a3a5a'), cone: R('#7a7f9a'), pyj: R('#7fb0f0'), ski: R('#ff6a3a'),
  pine: R('#2f8a4a'), toy: R('#ffcf3a'),
};

// ---------- små verktyg ----------
// Punkt i hjältens egna koordinater (fötterna i x, y, skala k, vridning ang) omräknad till bilden.
function hpt(g, x, y, k, hx, hy, ang = 0) { g.push(x, y, ang, k); g.push(-39.5, -61); const p = g.pt(hx, hy); g.pop(); g.pop(); return p; }
// Omvänt: bildpunkt till hjältens koordinater (utan vridning), för att sätta händer och fötter på föremål.
const inv = (x, y, k, wx, wy) => [39.5 + (wx - x) / k, 61 + (wy - y) / k];
// Ritar i hjältens koordinater (för munnar och detaljer på huvudet).
function onHero(g, x, y, k, ang, fn) { g.push(x, y, ang, k); g.push(-39.5, -61); fn(); g.pop(); g.pop(); }
// Bokstäver 3x5 i samma stil som siffrorna (A B C, plus och lika med).
const GLYPH = { A: '010101111101101', B: '110101110101110', C: '011100100100011', '+': '000010111010000', '=': '000111000111000' };
function glyph(g, ch, x, y, s = 1, col = C.white, lv = 5) {
  if (/[0-9]/.test(ch)) return digit(g, ch, x, y, s, col);
  const b = GLYPH[ch]; if (!b) return;
  part(g, () => { for (let i = 0; i < 15; i++) if (b[i] === '1') g.rect(x + (i % 3) * s, y + floor(i / 3) * s, s, s, col, lv); }, true);
}
// Stor not (en eller två ihopbundna), vit med mörk kant via rim().
function note2(g, x, y, double = false) {
  part(g, () => {
    g.ell(x, y + 6, 2.3, 1.8, C.white, false, null, 5); g.rect(x + 1.3, y, 1, 6.5, C.white, 5);
    if (double) { g.ell(x + 6, y + 5, 2.3, 1.8, C.white, false, null, 5); g.rect(x + 7.3, y - 1, 1, 6.5, C.white, 5); g.poly([[x + 1.3, y], [x + 8.3, y - 1], [x + 8.3, y + 1], [x + 1.3, y + 2]], C.white, 5); }
    else g.poly([[x + 2, y], [x + 5, y + 2], [x + 4.5, y + 3.5], [x + 2, y + 2]], C.white, 5);
  });
}
function window_(g, x, y, w, h, sky) {           // fönster med karm och spröjs
  part(g, () => { g.rect(x, y, w, h, sky, 3); g.rect(x + w / 2 - 1, y, 2, h, C.wood, 3); g.rect(x, y + h / 2 - 1, w, 2, C.wood, 3); });
}

// =====================================================================================
// breakfast: frukostbord med gröt och röd sylt, ostsmörgås och juice, morgonsolen stiger i fönstret.
redo('breakfast', 6, 2.4, (g, p) => {
  // väggen och fönstret med morgonhimmel, solen stiger över kullen, gardiner på sidorna
  part(g, () => g.rect(0, 0, 64, 40, K.wall, 3));
  part(g, () => g.rect(16, 3, 32, 22, C.sky, 4));
  const sy = 24 - ease(p === 0 ? 0.75 : p) * 11;
  part(g, () => { for (let i = 0; i < 6; i++) { const a = PI + (i + 0.5) * PI / 6; g.thick(23 + cos(a) * 7, sy + sin(a) * 7, 23 + cos(a) * 9.5, sy + sin(a) * 9.5, 1.4, C.sun, 5); } }, true);
  part(g, () => g.ell(23, sy, 5, 5, C.sun, true));
  part(g, () => g.poly([[16, 21], [26, 18], [38, 20], [48, 17], [48, 25], [16, 25]], K.hill, 3));
  part(g, () => { g.rect(14, 1, 36, 2, C.wood, 3); g.rect(14, 1, 2, 25, C.wood, 3); g.rect(48, 1, 2, 25, C.wood, 2); g.rect(31, 3, 2, 22, C.wood, 3); g.rect(12, 25, 40, 3, C.wood, 4); });
  part(g, () => { g.poly([[10, 0], [19, 0], [16, 12], [17, 30], [9, 30]], K.book, 3); g.poly([[45, 0], [54, 0], [55, 30], [47, 30], [48, 12]], K.book, 3); });
  // bordet
  part(g, () => { g.poly([[2, 36], [62, 36], [64, 50], [0, 50]], K.table, 3); g.rect(0, 50, 64, 3, K.table, 2); g.rect(4, 53, 3, 11, K.table, 2); g.rect(57, 53, 3, 11, K.table, 2); });
  // gröten i skålen med en röd syltklick
  part(g, () => { g.ell(14, 39, 12, 9, K.bowl, true, (dx, dy) => dy > 0); g.ell(14, 39, 12, 3.4, K.bowl, false, null, 4); g.ell(14, 39, 10.5, 2.6, K.oat, false, null, 4); });
  part(g, () => { g.ell(14, 38.6, 3.4, 1.6, K.jam, false, null, 3); g.dot(13, 38, K.jam, 5); });
  // ostsmörgås (brödskiva med rundad topp, osten med hål) på en tallrik
  part(g, () => g.ell(36, 46, 10, 2.8, C.plate, true));
  part(g, () => { g.rect(28, 34, 16, 11, K.bread, 3); g.ell(31, 34, 4, 3.4, K.bread, true); g.ell(41, 34, 4, 3.4, K.bread, true); });
  part(g, () => { g.poly([[29.5, 35], [42.5, 35], [43.5, 41], [28.5, 41]], K.cheese, 4); });
  part(g, () => { g.dot(32, 37, K.bread, 3); g.dot(39, 38, K.bread, 3); g.dot(35, 39, K.bread, 3); }, true);
  // juiceglaset
  glass(g, 55, 47, 0.75, K.juice);
  // ånga från gröten
  part(g, () => { for (let i = 0; i < 2; i++) { const u = fract(p + i / 2); g.ell(10 + i * 7 + sin(u * 6 + i) * 1.5, 33 - u * 7, 1.2 + u * 0.8, 0.9 + u * 0.5, C.cloud, false, null, u < 0.5 ? 5 : 4); } }, true);
});

// porridge: en stor skål sedd snett ovanifrån, ljus gröt med röd sylt i mitten, en sked, ånga som stiger.
redo('porridge', 6, 1.8, (g, p) => {
  shadow(g, 32, 58, 22);
  part(g, () => { g.ell(32, 36, 26, 21, K.bowl, true, (dx, dy) => dy > 0); g.rect(18, 54, 28, 3, K.bowl, 2); });
  part(g, () => g.ell(32, 36, 26, 9, K.bowl, false, null, 4));
  part(g, () => g.ell(32, 36.5, 23, 7, K.oat, true));
  part(g, () => { g.ell(30, 36, 7, 3, K.jam, true); g.ell(37, 38, 1.6, 1.2, K.jam, true); g.ell(24, 38.5, 1.4, 1, K.jam, true); });
  part(g, () => g.dot(28, 35, C.white, 5), true);
  part(g, () => { g.thick(44, 37, 58, 24, 3, K.steel, 4); g.ell(42, 38, 3.6, 2.2, K.steel, true); });
  part(g, () => { for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); g.ell(20 + i * 10 + sin(u * 6 + i * 2) * 2, 26 - u * 20, 1.8 + u * 1.6, 1.4 + u, C.cloud, false, null, u < 0.5 ? 5 : 4); } }, true);
});

function football(g, x, y, r) {                                  // vit fotboll med svarta femhörningar
  part(g, () => g.ell(x, y, r, r, C.white, true));
  part(g, () => { g.ell(x, y, r * 0.38, r * 0.38, C.ink, false, null, 1); for (let i = 0; i < 5; i++) { const a = -PI / 2 + i * TAU / 5; g.ell(x + cos(a) * r * 0.8, y + sin(a) * r * 0.8, r * 0.22, r * 0.22, C.ink, false, null, 1); } }, true);
}
// play_football: hjälten sparkar bollen, som flyger in i målet och buktar ut nätet (ruta 0 = bollen i luften).
redo('play_football', 8, 1.4, (g, p) => {
  const u = fract(p + 0.45);                                  // 0..0.2 tar sats, 0.2 sparken, sedan flyger bollen
  ground(g, 58, C.grass);
  part(g, () => { for (let x = 4; x < 64; x += 12) g.rect(x, 59, 6, 1, C.grass, 4); }, true);
  const fly = clamp((u - 0.22) / 0.45), inNet = u > 0.67;
  const bulge = inNet ? sin(clamp((u - 0.67) / 0.33) * PI) * 2.5 : 0;
  // målet: nätet bakom, stolparna framför
  const bx = lerp(22, 56, fly), by = inNet ? lerp(42, 53, clamp((u - 0.67) * 4)) : 54 - sin(fly * PI * 0.8) * 14;
  const net = () => part(g, () => { for (let x = 46; x <= 62; x += 3) g.line(x, 22, x + 1 + bulge * (x - 44) / 18, 58, K.net, 3); for (let y = 22; y <= 58; y += 4) g.line(46, y, 63, y + bulge * 0.4, K.net, 3); }, true);
  if (inNet) { football(g, bx, by, 4.5); net(); }                // i målet: bollen ligger bakom nätet
  else { net(); shadow(g, bx, 59, 3); if (u < 0.22) football(g, 24, 54, 4.5); else football(g, bx, by, 4.5); }
  part(g, () => { g.rect(44, 20, 3, 39, C.white, 5); g.rect(44, 20, 19, 3, C.white, 5); });
  if (fly > 0 && fly < 1) part(g, () => { for (let i = 1; i <= 3; i++) g.rect(bx - 5 - i * 3, by + 1 + i * 0.5, 2, 1, C.white, 4); }, true);
  // hjälten: stödbenet stilla, sparkbenet svingar bakåt och sedan fram
  const kick = u < 0.18 ? -ease(u / 0.18) : u < 0.3 ? lerp(-1, 1, (u - 0.18) / 0.12) : max(0, 1 - (u - 0.3) * 2.2);
  const legs = { b: [34, 52, 34, 56.5, 0], f: [42 + kick * 5, 51 - max(0, kick) * 3, 43 + kick * 11, 56 - max(0, kick) * 7, -kick * 0.4] };
  shadow(g, 16, 59, 7);
  hero(g, 16, 58, 0.72, { legs, handB: [50, 40], bendB: [1, 1], handF: [28, 41], bendF: [-1, 1] }, 'grin');
});

// go_skiing: hjälten åker skidor nerför en snöig backe med stavar, snön yr bakom, granar susar förbi.
redo('go_skiing', 8, 1.2, (g, p) => {
  const sl = (x) => 30 + x * 0.42;                             // backens kant
  part(g, () => g.rect(0, 0, 64, 64, C.sky, 4));
  part(g, () => g.poly([[0, sl(0) - 13], [64, sl(64) - 13], [64, 64], [0, 64]], C.snow, 4));
  for (let i = 0; i < 3; i++) {                                // granar högre upp på backen som glider bakåt (hjälten åker framåt)
    const x = 76 - fract(p + i / 3) * 92, y = sl(x) - 13;
    part(g, () => { g.rect(x - 0.5, y - 3, 2, 3, C.wood, 2); g.poly([[x - 5, y - 3], [x + 6, y - 3], [x + 0.5, y - 15]], K.pine, 3); g.poly([[x - 3.5, y - 9], [x + 4.5, y - 9], [x + 0.5, y - 18]], K.pine, 4); });
  }
  part(g, () => g.poly([[0, sl(0)], [64, sl(64)], [64, 64], [0, 64]], C.snow, 3));
  const ang = 0.12, X = 30, Y = sl(30) + 1, b = sin(p * TAU * 2) * 0.6;
  // snö som yr bakom skidorna
  part(g, () => { for (let i = 0; i < 7; i++) { const u = fract(p * 2 + i / 7); g.rect(X - 8 - u * 16, sl(X - 8 - u * 16) - 2 - sin(u * PI) * 9 + (i % 2) * 2, 2.5, 2.5, C.white, 5); } }, true);
  // stavarna bakom
  const [h1x, h1y] = hpt(g, X, Y + b, 0.8, 50, 44, ang);
  part(g, () => { g.thick(h1x, h1y, h1x - 14, h1y + 10, 1.2, C.grey, 3); });
  hero(g, X, Y + b, 0.8, { legs: { b: [40, 52, 35, 57, 0], f: [46, 51, 41, 57, 0] }, handB: [50, 44], bendB: [1, 1], handF: [45, 45], bendF: [0, 1] }, 'grin', ang);
  // skidorna längs backen
  part(g, () => { g.thick(X - 13, sl(X - 13), X + 13, sl(X + 13), 2, K.ski, 4); g.thick(X + 12, sl(X + 12), X + 15, sl(X + 15) - 2, 2, K.ski, 4); });
  const [h2x, h2y] = hpt(g, X, Y + b, 0.8, 45, 45, ang);
  part(g, () => { g.thick(h2x, h2y, h2x - 12, h2y + 12, 1.2, C.grey, 4); g.ell(h2x - 11, h2y + 11, 1.8, 0.8, C.grey, false, null, 3); });
});

// wash_my_hands: nära, två händer gnuggas under kranen, vattnet rinner, såpbubblor flyger.
// En hand med fingrarna uppåt, handleden i (x, y), lutad ang. side = 1 tummen åt vänster, -1 åt höger.
// Varje finger är en egen del, så att konturen skiljer fingrarna åt.
function handUp(g, x, y, ang, side, k = 1) {
  g.push(x, y, ang, k);
  part(g, () => { g.rect(-5, 0, 10, 8, C.skin, 3); });                                       // handleden
  part(g, () => g.thick(-side * 5, -5, -side * 10, -12, 3.2, C.skin, 3));                    // tummen
  for (let i = 0; i < 4; i++) { const fx = -4.5 + i * 3, len = [17, 20, 19.5, 16][side > 0 ? i : 3 - i]; part(g, () => g.thick(fx, -8, fx, -len, 3, C.skin, i % 2 ? 3 : 4)); }
  part(g, () => g.ell(0, -5, 6.5, 7, C.skin, 0.75));                                         // handflatan
  g.pop();
}
redo('wash_my_hands', 6, 0.6, (g, p) => {
  part(g, () => g.rect(0, 0, 64, 64, K.tile, 4));
  part(g, () => { for (let x = 0; x < 64; x += 10) g.rect(x, 0, 1, 64, K.tile, 2); for (let y = 0; y < 64; y += 10) g.rect(0, y, 64, 1, K.tile, 2); }, true);
  part(g, () => { g.ell(32, 62, 31, 6, C.plate, true); g.ell(32, 61, 26, 3, C.plate, false, null, 2); });       // handfatet
  part(g, () => { g.rect(16, 0, 6, 6, K.steel, 3); g.rect(16, 2, 18, 5, K.steel, 4); g.rect(29, 6, 6, 5, K.steel, 3); g.ell(19, 1, 4, 2, C.blue, true); });   // kranen
  // vattnet från kranen ner på fingertopparna
  part(g, () => { for (let y = 11; y < 22; y++) { const ph = (y + floor(p * 6) * 2) % 6; g.rect(30.5 + (ph === 0 ? 1 : 0), y, 3, 1, C.water, ph < 3 ? 4 : 3); } });
  // två händer som gnuggas mot varandra (upp och ner i otakt), ärmarna längst ner
  const s = sin(p * TAU) * 2;
  part(g, () => { g.rect(13, 56, 15, 8, C.leaf, 3); g.rect(36, 56, 15, 8, C.leaf, 2); });
  handUp(g, 21, 56 + s, 0.3, 1, 1.3);
  handUp(g, 43, 56 - s, -0.3, -1, 1.3);
  // skum och stänk
  part(g, () => { for (const [x, y, r] of [[32, 27 + s, 2.4], [31.5, 34, 2], [32.5, 41 - s, 2.2], [32, 47, 1.8], [36, 30, 1.4]]) g.ell(x, y, r, r, C.white, false, null, 5); }, true);
  part(g, () => { for (let i = 0; i < 4; i++) { const u = fract(p + i / 4), x = 8 + i * 15 + sin(u * 5 + i) * 3, y = 34 - u * 26; g.ell(x, y, 1.6 + (i % 2), 1.6 + (i % 2), C.white, false, (dx, dy, d2) => d2 > 0.4, 5); } }, true);
  part(g, () => { const u = fract(p * 2); for (const d of [-1, 1]) g.rect(32 + d * (3 + u * 6), 24 - sin(u * PI) * 4, 1, 1, C.water, 5); }, true);
});

// do_homework: hjälten sitter vid skrivbordet och räknar i ett räknehäfte, 1 + 1 = 2 skrivs fram med pennan.
// Hjälten sitter till höger och skriver åt vänster om sig, så att armen bara skymmer det som inte är skrivet än.
redo('do_homework', 8, 2.4, (g, p) => {
  const X = 53, Y = 63, k = 0.96;
  chair(g, 48, 49, 64, true);
  const done = p === 0 ? 5 : min(5, floor(p * 7)), tip = [17.5 + min(done, 5) * 5, 50];
  const [hx, hy] = inv(63 - X, Y, k, 63 - tip[0] - 3, tip[1] - 4);
  heroFlip(g, X, Y, k, { legs: sitLegs, handB: [hx, hy], bendB: [1, 2], handF: [46, 46], bendF: [-1, 1] }, 'smile');
  // skrivbordet framför (döljer benen), sett lite ovanifrån, och en stapel skolböcker
  part(g, () => { g.poly([[0, 38], [48, 38], [50, 52], [0, 52]], K.table, 4); g.rect(0, 52, 50, 12, K.table, 2); g.rect(18, 56, 12, 3, K.table, 4); });
  part(g, () => { g.rect(1, 34, 12, 4, K.book, 3); g.rect(1, 30, 11, 4, C.blue, 3); g.rect(2, 26, 11, 4, C.leaf, 3); });
  // räknehäftet med rutor, 1 + 1 = 2 skrivs fram
  part(g, () => g.poly([[15, 40], [45, 40], [47, 51], [13, 51]], C.paper, 5));
  part(g, () => { for (let x = 18; x < 45; x += 4) g.line(x, 41, x - 0.6, 50, K.tile, 3); }, true);
  ['1', '+', '1', '=', '2'].slice(0, done).forEach((ch, i) => glyph(g, ch, 16.5 + i * 5, 43, 1.4, i === 1 || i === 3 ? C.red : C.blue, 3));
  // armen från axeln till pennan
  const [sx0, sy] = hpt(g, 63 - X, Y, k, 44, 38), sx = 63 - sx0;
  part(g, () => { g.thick(sx, sy, tip[0] + 3, tip[1] - 4, 3.4, C.skin, 3); g.ell(tip[0] + 3, tip[1] - 4, 2.4, 2.2, C.skin, 0.75); });
  part(g, () => { g.thick(tip[0], tip[1], tip[0] + 5, tip[1] - 9, 2.2, C.pencil, 4); g.poly([[tip[0] - 0.5, tip[1] + 0.5], [tip[0] - 0.5, tip[1] - 2.5], [tip[0] + 2, tip[1] - 1]], C.plank, 4); });
});

// clean_my_room: hjälten sopar golvet med en kvast i ett stökigt rum, en leksak åker ner i leksakslådan.
redo('clean_my_room', 8, 1.6, (g, p) => {
  part(g, () => g.rect(0, 0, 64, 56, K.wall, 3));
  part(g, () => { g.rect(0, 56, 64, 8, C.plank, 3); for (let x = 0; x < 64; x += 11) g.rect(x, 56, 1, 8, C.plank, 2); });
  part(g, () => { g.rect(1, 53, 6, 4, C.blue, 3); g.poly([[24, 55], [28, 55], [28, 53], [31, 53], [31, 56], [24, 56]], C.red, 4); });   // stök på golvet: kloss och strumpa
  // leksakslådan med leksaker som sticker upp
  part(g, () => { g.ell(51, 41, 3.5, 3.5, C.red, true); g.rect(55, 37, 5, 5, K.toy, 3); g.thick(46, 42, 44, 35, 2, C.blue, 3); });
  part(g, () => { g.rect(42, 42, 21, 16, C.card, 3); g.rect(41, 41, 23, 3, C.card, 4); });
  part(g, () => { g.rect(48, 48, 9, 4, C.card, 2); }, true);
  // hjälten sopar: kvasten sveper fram och tillbaka
  const sw = sin(p * TAU), bx = 33 + sw * 3, top = [bx - 16, 26];
  const X = 13, k = 0.8, at = (u) => [lerp(top[0], bx, u), lerp(top[1], 54, u)];
  const [hx, hy] = inv(X, 60, k, ...at(0.22)), [lx, ly] = inv(X, 60, k, ...at(0.5));
  shadow(g, X, 61, 7);
  part(g, () => g.thick(top[0], top[1], bx, 54, 1.8, C.wood, 3));
  hero(g, X, 60, k, { legs: standLegs, handB: [hx, hy], bendB: [1, 2], handF: [lx, ly], bendF: [-1, 2] }, 'smile');
  part(g, () => { g.poly([[bx - 3, 52], [bx + 4, 52], [bx + 9, 60], [bx - 7, 60]], C.sun, 4); g.rect(bx - 3.5, 51, 8, 2.5, C.red, 3); });
  part(g, () => { for (let x = -5; x <= 7; x += 3) g.line(bx + x * 0.5, 54, bx + x, 59, C.sun, 2); }, true);
  // dammoln och en kloss som sopas fram och hoppar ner i lådan
  part(g, () => { for (let i = 0; i < 3; i++) { const u = fract(p * 2 + i / 3); g.ell(bx + 9 + u * 5, 58 - u * 6, 1 + u * 1.5, 0.8 + u, C.cloud, false, null, u < 0.5 ? 4 : 3); } }, true);
  const u = fract(p + 0.3), tx = u < 0.5 ? lerp(41, 44, u * 2) : lerp(44, 52, (u - 0.5) * 2), ty = u < 0.5 ? 57 : 57 - sin((u - 0.5) * 2 * PI) * 22;
  if (u < 0.9) part(g, () => { g.rect(tx - 3, ty - 5, 5, 5, C.leaf, 3); g.dot(tx - 2, ty - 4, C.white, 5); });
});

// watch_tv: hjälten sitter i soffan och tittar på teven, bilden på skärmen flimrar och byter.
function sofa(g) {
  part(g, () => { g.rect(0, 30, 9, 28, K.sofa, 2); g.rect(2, 46, 30, 9, K.sofa, 3); g.rect(2, 55, 30, 3, K.sofa, 2); g.rect(3, 58, 3, 3, C.wood, 2); g.rect(27, 58, 3, 3, C.wood, 2); });
}
function tvSet(g, x, y, w, h, fn) {                              // teve på en låg bänk, fn ritar bilden i skärmen
  part(g, () => { g.rect(x - 2, y + h + 6, w + 4, 3, C.wood, 3); g.rect(x, y + h + 9, 3, 5, C.wood, 2); g.rect(x + w - 3, y + h + 9, 3, 5, C.wood, 2); g.rect(x + w / 2 - 2, y + h, 4, 6, K.tv, 2); });
  part(g, () => g.rect(x, y, w, h, K.tv, 3));
  part(g, () => { const G2 = g; G2.rect(x + 2, y + 2, w - 4, h - 4, K.screen, 3); fn(x + 2, y + 2, w - 4, h - 4); });
}
redo('watch_tv', 6, 1.2, (g, p) => {
  const f = floor(p * 6);
  sofa(g);
  shadow(g, 16, 61, 12);
  hero(g, 16, 59, 0.8, { legs: sitLegs, handB: [48, 46], bendB: [0, 1], handF: [45, 47], bendF: [-1, 1] }, 'o');
  part(g, () => g.rect(2, 46, 7, 9, K.sofa, 3));
  tvSet(g, 37, 18, 26, 22, (x, y, w, h) => {
    if (f < 3) { g.rect(x, y + h - 5, w, 5, K.hill, 3); g.ell(x + 6 + f * 3, y + 6, 3, 3, C.sun, true); g.ell(x + w - 7 - f, y + 5, 4, 2, C.cloud, false, null, 5); }
    else { g.rect(x, y, w, h, C.water, 3); g.ell(x + 4 + (f - 3) * 4, y + 9, 4, 2.6, C.fire, true); g.poly([[x + (f - 3) * 4, y + 9], [x - 2 + (f - 3) * 4, y + 6], [x - 2 + (f - 3) * 4, y + 12]], C.fire, 3); g.dot(x + 6 + (f - 3) * 4, y + 8, C.ink, 0); }
  });
  // skenet från skärmen
  part(g, () => { for (const [y0, y1] of [[24, 22], [32, 32], [40, 42]]) if ((f + y0) % 2) g.line(30, y1, 34, y0, C.white, 4); }, true);
});

// play_video_games: hjälten sitter nära skärmen med en stor handkontroll, sladden går till teven, en figur hoppar i spelet.
redo('play_video_games', 6, 0.9, (g, p) => {
  const f = floor(p * 6), jump = sin(p * PI) * 6;
  tvSet(g, 30, 10, 33, 26, (x, y, w, h) => {
    g.rect(x, y + h - 4, w, 4, C.leaf, 3); g.rect(x + 14, y + h - 10, 6, 6, C.plank, 4); g.rect(x + 14, y + h - 10, 6, 1, C.plank, 2);
    const mx = x + 4 + p * 20, my = y + h - 4 - jump;
    g.rect(mx, my - 7, 5, 5, C.red, 4); g.rect(mx + 1, my - 10, 3, 3, C.skin, 4); g.rect(mx, my - 2, 2, 2, C.blue, 3); g.rect(mx + 3, my - 2, 2, 2, C.blue, 3);
    if (f % 2) g.ell(x + w - 5, y + 5, 2, 2, C.gold, false, null, 5);
  });
  // pallen och hjälten som lutar sig fram
  part(g, () => g.ell(14, 56, 11, 5, C.purple, true));
  const X = 14, Y = 64, k = 0.85, ang = 0.1;
  const [cx, cy] = hpt(g, X, Y, k, 51, 37, ang);
  hero(g, X, Y, k, { legs: sitLegs, handB: [53, 36], bendB: [-1, 2], handF: [49, 38], bendF: [-1, 2] }, 'grin', ang);
  // sladden från kontrollen till teven
  part(g, () => { for (let i = 0; i <= 12; i++) { const u = i / 12; g.set(round(lerp(cx + 4, 46, u)), round(lerp(cy + 3, 49, u) + sin(u * PI) * 6), C.ink, 1); } }, true);
  // handkontrollen
  part(g, () => { g.ell(cx - 5, cy + 1.5, 4.2, 4, K.pad, true); g.ell(cx + 5, cy + 1.5, 4.2, 4, K.pad, true); g.rect(cx - 5, cy - 2.5, 10, 6, K.pad, 3); });
  part(g, () => { g.rect(cx - 8, cy, 5, 1, C.white, 5); g.rect(cx - 6, cy - 2, 1, 5, C.white, 5);
    for (const [dx, dy, c, on] of [[4, -1, C.red, 0], [6, 1, C.leaf, 1], [2, 1, C.blue, 2], [4, 3, C.sun, 0]]) g.rect(cx + dx, cy + dy, 1.5, 1.5, c, f % 3 === on ? 5 : 3); }, true);
});

// listen_to_music: nära, hjälten har stora hörlurar, blundar och nickar i takt, noter strömmar ut ur luren.
redo('listen_to_music', 6, 0.9, (g, p) => {
  const nod = (floor(p * 6) % 3 === 0) ? 1.5 : 0;
  const [X, Y, k] = CLOSE, hx = X + 1, hy = 36 + nod;
  hero(g, X, Y + nod, k, { legs: standLegs }, 'smile shut blush', 0.03 + nod * 0.02);
  part(g, () => { for (let i = 0; i <= 16; i++) { const a = PI * 1.02 + i / 16 * PI * 0.5; g.thick(hx - 4 + cos(a) * 16, hy + 2 + sin(a) * 17.5, hx - 4 + cos(a + 0.05) * 16, hy + 2 + sin(a + 0.05) * 17.5, 3, K.phone, 3); } });
  part(g, () => { g.ell(hx - 7, hy + 4, 6, 7.5, K.phone, true); g.ell(hx - 6, hy + 4, 3.4, 5, C.red, true); });
  for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); note2(g, 6 - u * 2 + sin(u * 6 + i) * 2, 34 - u * 30, i === 1); }
  part(g, () => { for (const r of [10, 13]) for (let a = -0.7; a <= 0.7; a += 0.14) g.set(round(hx - 9 - cos(a) * r), round(hy + 4 + sin(a) * r), C.white, (floor(p * 6) + r) % 2 ? 5 : 3); }, true);
});

// ride_a_bike: hjälten trampar en cykel, hjulens ekrar snurrar, marken susar förbi bakåt.
// Benen räknas fram (höft, knä, pedal) så att fötterna följer pedalerna runt.
function legTo(hx, hy, fx, fy, L = 5.2) {                       // knä framåt-uppåt mellan höft och fot (hjältens koordinater)
  let dx = fx - hx, dy = fy - hy, d = Math.hypot(dx, dy);
  if (d > L * 2) { fx = hx + dx / d * L * 2; fy = hy + dy / d * L * 2; dx = fx - hx; dy = fy - hy; d = L * 2; }
  const h = Math.sqrt(max(0, L * L - d * d / 4)), mx = (hx + fx) / 2, my = (hy + fy) / 2;
  return [mx + (-dy / d) * -h, my + (dx / d) * -h, fx, fy, 0];
}
function wheel(g, x, y, r, p) {
  part(g, () => { g.ell(x, y, r, r, K.tyre, false, (dx, dy, d2) => d2 > 0.62, 1); g.ell(x, y, r * 0.78, r * 0.78, C.grey, false, (dx, dy, d2) => d2 > 0.8, 4); });
  part(g, () => { for (let i = 0; i < 3; i++) { const a = p * TAU + i * PI / 3; g.line(x - cos(a) * r * 0.7, y - sin(a) * r * 0.7, x + cos(a) * r * 0.7, y + sin(a) * r * 0.7, C.grey, 4); } g.set(round(x), round(y), C.ink, 1); }, true);
}
redo('ride_a_bike', 8, 0.8, (g, p) => {
  const a = p * TAU, X = 25, Y = 50, k = 0.9;
  ground(g, 58, C.dirt);
  part(g, () => { for (let i = 0; i < 4; i++) g.rect(fract(i / 4 - p) * 72 - 6, 60 + (i % 2) * 2, 5, 1, C.dirt, 1); }, true);
  part(g, () => { for (let i = 0; i < 3; i++) g.rect(fract(i / 3 - p * 2) * 20 - 14 + 4, 30 + i * 7, 7, 1, C.white, 5); }, true);
  const BB = [29, 47], cr = 3.2;
  shadow(g, 31, 59, 14);
  // bortre pedalen och benet ritas bakom cykeln
  const pB = [BB[0] - cos(a) * cr, BB[1] - sin(a) * cr], pF = [BB[0] + cos(a) * cr, BB[1] + sin(a) * cr];
  wheel(g, 13, 50, 8, -p * 2); wheel(g, 49, 50, 8, -p * 2);
  // ramen
  part(g, () => { const c = K.bike; g.thick(13, 50, BB[0], BB[1], 2, c, 3); g.thick(13, 50, 25, 37, 2, c, 3); g.thick(BB[0], BB[1], 24, 37, 2.2, c, 3); g.thick(24, 39, 44, 37, 2.2, c, 4); g.thick(BB[0], BB[1], 44, 37, 2.2, c, 3); g.thick(44, 35, 49, 50, 2, c, 3); g.thick(44, 35, 43, 31, 2, C.grey, 3); g.thick(40, 31, 46, 31, 2, C.grey, 4); });
  part(g, () => { g.rect(19, 35, 9, 2.5, C.ink, 2); });
  // hjälten: höften på sadeln, händerna på styret, fötterna på pedalerna
  const ip = (pt) => inv(X, Y, k, pt[0], pt[1]), [hhx, hhy] = [38.5, 46.5];
  const fb = ip(pB), ff = ip(pF), hand = ip([45, 31]);
  const legs = { b: legTo(hhx, hhy, fb[0], fb[1] - 1), f: legTo(hhx + 3, hhy, ff[0], ff[1] - 1) };
  hero(g, X, Y, k, { legs, handB: hand, bendB: [1, 1], handF: [hand[0] - 2, hand[1] + 1], bendF: [0, 1] }, 'grin', 0.08);
  part(g, () => { g.thick(pB[0], pB[1], pF[0], pF[1], 1.2, C.grey, 3); g.rect(pF[0] - 1.5, pF[1] - 0.5, 3, 1.5, C.ink, 2); g.ell(BB[0], BB[1], 2.2, 2.2, C.grey, true); });
});

// take_a_shower: nära, hjälten står i duschen, vattnet strilar över huvudet, schamposkum på håret, blundar och ler.
redo('take_a_shower', 6, 0.6, (g, p) => {
  const f = floor(p * 6);
  part(g, () => g.rect(0, 0, 64, 64, K.tile2, 3));
  part(g, () => { for (let x = 4; x < 64; x += 10) g.rect(x, 0, 1, 64, K.tile2, 1); for (let y = 6; y < 64; y += 10) g.rect(0, y, 64, 1, K.tile2, 1); }, true);
  // hjälten utan kläder på överkroppen: rita i en egen bild och färga allt under huvudet som hud
  const tmp = new G(64, 64), [X, Y, k] = [24, 94, 1.5];
  hero(tmp, X, Y, k, { legs: standLegs, noScarf: true, handB: [44, 46], handF: [36, 47] }, 'smile shut');
  const neck = round(Y - (61 - 33) * k);
  for (let y = neck; y < 64; y++) for (let x = 0; x < 64; x++) { const i = y * 64 + x; if (tmp.R[i] >= 0 && tmp.R[i] !== C.skin) { tmp.R[i] = C.skin; if (tmp.L[i] > 0) tmp.L[i] = 3; } }
  blit(g, tmp);
  // skummet på håret
  part(g, () => { for (const [x, y, r] of [[13, 21, 4], [19, 17, 4.5], [26, 16, 4.5], [33, 18, 4], [38, 22, 3], [9, 27, 3]]) g.ell(x, y, r, r * 0.9, C.white, true); });
  // duschmunstycket och vattnet
  part(g, () => { g.rect(56, 0, 3, 8, K.steel, 3); g.rect(46, 5, 13, 3, K.steel, 4); g.poly([[38, 8], [50, 4], [52, 9], [42, 12]], K.steel, 3); });
  part(g, () => { for (let i = 0; i < 9; i++) { const x0 = 40 + i * 1.6, x1 = 6 + i * 6; for (let j = 0; j < 4; j++) { const u = fract(j / 4 + p + i * 0.13); if (u > 0.85) continue; g.rect(round(lerp(x0, x1, u)), round(12 + u * 52), 1.5, 4, C.blue, (i + j) % 2 ? 3 : 4); } } }, true);
  part(g, () => { for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); g.ell(52 + i * 3 - u * 4, 50 - u * 30, 1.6, 1.6, C.white, false, (dx, dy, d2) => d2 > 0.4, 5); } }, true);
});

// read_a_book: nära, hjälten håller en stor uppslagen bok med bilder, en sida vänds.
function bigBook(g, x, y, s, p) {                              // stor uppslagen bok: textrader till vänster, en bild till höger, en sida vänds
  g.push(x, y, 0, s);
  part(g, () => { g.poly([[-12.5, -1], [0, 2], [12.5, -1], [12.5, 10.5], [0, 12.5], [-12.5, 10.5]], K.book, 3); });
  part(g, () => { g.poly([[-11, -2.5], [-5, -3], [0, 0], [0, 10.5], [-5, 8], [-11, 8.5]], C.paper, 5); g.poly([[0, 0], [5, -3], [11, -2.5], [11, 8.5], [5, 8], [0, 10.5]], C.paper, 4); });
  part(g, () => { for (let i = 0; i < 4; i++) g.line(-9.5, -0.5 + i * 2.2, -2, 0.8 + i * 2.2, C.grey, 2); g.line(0, 0, 0, 10, C.grey, 2); }, true);
  part(g, () => { g.ell(4.5, 1.2, 1.8, 1.8, C.sun, true); g.poly([[2, 7.5], [5.5, 3], [9, 7], [9, 8], [2, 9]], C.leaf, 3); });
  const u = p > 0.5 ? (p - 0.5) / 0.35 : -1;
  if (u >= 0 && u <= 1) part(g, () => { const tx = 11 - u * 22; g.poly([[0, 0], [tx, -2.5 - sin(u * PI) * 3], [tx, 8.5 - sin(u * PI) * 3], [0, 10.5]], C.white, 5); });
  g.pop();
}
redo('read_a_book', 6, 2.4, (g, p) => {
  const [X, Y, k] = [22, 92, 1.5];
  hero(g, X, Y, k, { legs: standLegs }, 'smile');
  bigBook(g, 42, 45, 1.6, p);
  part(g, () => { g.ell(23, 60, 3, 3, C.skin, 0.75); g.ell(61, 59, 3, 3, C.skin, 0.75); });
});

// school: skolhuset med klocka i tornet och en svart tavla med ABC i fönstret, ett barn med ryggsäck går mot dörren.
redo('school', 8, 1.6, (g, p) => {
  const sw = sin(p * TAU * 2) * 0.35;
  ground(g, 58, C.grass);
  part(g, () => { g.rect(4, 26, 56, 32, K.brick, 3); g.poly([[2, 27], [32, 10], [62, 27]], K.roof, 3); });
  part(g, () => { for (let y = 30; y < 58; y += 5) g.rect(4, y, 56, 1, K.brick, 2); }, true);
  // klocktornet med klockan som svänger
  part(g, () => { g.rect(26, 2, 12, 12, C.paper, 3); g.poly([[24, 3], [32, -4], [40, 3]], K.roof, 4); });
  g.push(32, 5, sw, 1); part(g, () => { g.poly([[-3, 6], [3, 6], [2, 1], [-2, 1]], C.gold, 4); g.ell(0, 1, 2, 1.6, C.gold, true); }); part(g, () => g.dot(-0.5, 6, C.ink, 1), true); g.pop();
  part(g, () => { for (const d of [-1, 1]) if (abs(sw) > 0.25) { g.line(32 + d * 7, 6, 32 + d * 9, 4, C.white, 5); g.line(32 + d * 7, 9, 32 + d * 10, 9, C.white, 5); } }, true);
  // tavlan med ABC
  part(g, () => { g.rect(34, 29, 25, 15, C.wood, 3); g.rect(36, 31, 21, 11, K.board, 3); });
  ['A', 'B', 'C'].forEach((ch, i) => glyph(g, ch, 37.5 + i * 6.5, 32.5, 1.6, C.white, 5));
  // fönster och dörr
  window_(g, 7, 30, 12, 11, C.sky);
  part(g, () => { g.rect(21, 43, 11, 15, C.wood, 3); g.rect(21, 43, 11, 2, C.wood, 4); g.dot(29, 51, C.gold, 5); });
  part(g, () => g.poly([[21, 58], [32, 58], [36, 64], [17, 64]], C.stone, 4));
  // barnet med ryggsäck går fram mot dörren
  const ph = p * TAU * 2 + PI / 2, a = gait(ph, false), x = lerp(2, 18, p === 0 ? 0.6 : p);
  shadow(g, x, 61, 5);
  hero(g, x, 61, 0.48, a, 'smile');
  onHero(g, x, 61, 0.48, 0, () => part(g, () => { g.rect(23, 34, 9, 12, C.blue, 3); g.rect(24, 40, 7, 4, C.blue, 4); }));
});

// go_to_bed: kvällen, månen i fönstret. Hjälten gäspar bredvid sängen, sätter sig och sträcker på sig, lägger sig
// och drar upp täcket. Slingan slutar innan Z Z Z (det är sleep). Ruta 0 = sitter på sängkanten och gäspar.
function room(g) {
  part(g, () => g.rect(0, 0, 64, 64, C.night, 3));
  part(g, () => { g.rect(26, 5, 18, 16, C.night, 1); g.rect(34, 5, 2, 16, C.wood, 3); g.rect(26, 12, 18, 2, C.wood, 3); g.rect(24, 3, 22, 2, C.wood, 4); g.rect(24, 21, 22, 2, C.wood, 4); g.rect(24, 3, 2, 20, C.wood, 3); g.rect(44, 3, 2, 20, C.wood, 3); });
  part(g, () => { g.ell(30, 9, 2.6, 2.6, C.sun, true); g.ell(31.5, 8, 2, 2, C.night, false, null, 1); }, true);
  part(g, () => { g.set(40, 8, C.white, 5); g.set(28, 17, C.white, 4); g.set(41, 17, C.white, 5); }, true);
  part(g, () => g.rect(0, 58, 64, 6, C.wood, 2));
}
function bedL(g) {                                              // säng med huvudgaveln till vänster, ingen fotgavel
  part(g, () => { g.rect(2, 36, 4, 24, C.wood, 3); g.rect(2, 50, 44, 4, C.wood, 2); g.rect(42, 54, 3, 5, C.wood, 2); g.rect(6, 54, 3, 5, C.wood, 2); g.rect(4, 46, 41, 4, C.sheet, 4); });
  part(g, () => g.ell(12, 43, 6.5, 3.2, C.sheet, true));
}
function yawnMouth(g, x, y, k, ang) { part(g, () => onHero(g, x, y, k, ang, () => { g.ell(46, 29.5, 2.4, 2.8, C.dark, false, null, 0); g.ell(46, 30.2, 1.4, 1.6, C.red, false, null, 2); }), true); }
redo('go_to_bed', 8, 3.6, (g, p) => {
  const f = floor(p * 8), ns = { noScarf: true };
  room(g); bedL(g);
  if (f === 7) {                                                // står bredvid sängen och gäspar med handen för munnen
    shadow(g, 53, 61, 7);
    hero(g, 53, 60, 0.78, { ...ns, legs: standLegs, handB: [49, 33], bendB: [2, 3] }, 'shut');
    yawnMouth(g, 53, 60, 0.78, 0);
  } else if (f === 0) {                                         // sitter på sängkanten, sträcker armarna och gäspar
    hero(g, 40, 59, 0.78, { ...ns, legs: sitLegs, handB: [52, 12], bendB: [2, -1], handF: [30, 12], bendF: [-2, -1] }, 'shut');
    yawnMouth(g, 40, 59, 0.78, 0);
  } else {                                                      // ligger med huvudet på kudden och drar upp täcket till hakan
    const cover = [0, 0.3, 0.55, 0.8, 1, 1, 1][f];
    const x0 = lerp(38, 21, cover);
    hero(g, 44, 41, 0.8, { ...ns, legs: standLegs, handB: [45, 44], bendB: [1, 1], handF: [43, 46] }, f >= 5 ? 'shut smile' : f === 4 ? 'o' : 'smile', -PI / 2);
    part(g, () => { g.poly([[x0, 34], [43, 35], [47, 50], [x0 - 1, 50]], C.bed, 3); g.rect(x0 - 1, 33.5, 3, 16.5, C.sheet, 4); for (let x = x0 + 5; x < 43; x += 8) g.rect(x, 40, 4, 4, C.bed, 4); });
    if (f < 5) part(g, () => { g.ell(x0, 35, 2, 2, C.skin, 0.75); g.ell(x0 + 1, 38, 2, 2, C.skin, 0.75); });
  }
});

// music: en högtalare som pumpar i takt, ljudvågor och noter flyger ut (ingen hjälte: det är själva musiken).
redo('music', 6, 0.75, (g, p) => {
  const beat = floor(p * 6) % 2 === 0, b = beat ? 1 : 0;
  shadow(g, 24, 61, 16);
  part(g, () => { g.rect(8, 10, 32, 50, K.speaker, 3); g.rect(8, 10, 32, 2, K.speaker, 4); });
  part(g, () => { g.ell(24, 22, 6, 6, K.tv, false, null, 1); g.ell(24, 22, 4, 4, K.cone, true); g.ell(24, 22, 1.5, 1.5, K.tv, false, null, 2); });
  part(g, () => { g.ell(24, 44, 12 + b, 12 + b, K.tv, false, null, 1); g.ell(24, 44, 9.5 + b, 9.5 + b, K.cone, true); g.ell(24, 44, 3.5 + b * 0.5, 3.5 + b * 0.5, K.tv, true); });
  part(g, () => { for (let i = 0; i < 3; i++) { const r = 8 + i * 6 + (beat ? 2 : 0); for (let a = -0.6; a <= 0.6; a += 0.08) g.set(round(30 + cos(a) * r + 8), round(40 + sin(a) * r), C.white, i === 0 ? 5 : 4); } }, true);
  for (let i = 0; i < 3; i++) { const u = fract(p / 2 + i / 3); note2(g, 46 + u * 8 + (i - 1) * 3, 22 - u * 20 + (i - 1) * 2, i % 2 === 0); }
});

// sing: hjälten sjunger med hakan upp och stor öppen mun, ena armen ut, noter strömmar ur munnen.
redo('sing', 6, 1.2, (g, p) => {
  const X = 31, Y = 90, k = 1.45, ang = -0.22, sw = sin(p * TAU) * 1.5;
  hero(g, X, Y, k, { legs: standLegs, handB: [58, 42 + sw], bendB: [2, -1], handF: [38, 40], bendF: [-2, 2] }, 'shut blush', ang);
  part(g, () => onHero(g, X, Y, k, ang, () => { g.ell(46.5, 30.2, 3.4, 4, C.dark, false, null, 0); g.ell(46.5, 30.8, 2.4, 3, C.dark, false, null, 1); g.ell(46.5, 32, 2, 1.6, C.red, false, null, 3); g.rect(44.5, 27, 4, 1, C.white, 5); }), true);
  const [mx, my] = hpt(g, X, Y, k, 49, 29, ang);
  for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); note2(g, mx + 3 + u * 9, my - 9 - u * 18 + sin(u * 8 + i) * 2, i === 1); }
});
