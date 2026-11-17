// Omritningar (granskningen 2026-11-17). Se wordart-more.js.
// Gruppen saker: föremål, djur, adjektiv och tal. Jespers anteckningar i docs/research/bilder-omritning.md går först.
import { redo, H } from './wordart.js';
import { ramp as R } from './pixel.js';

const { sin, cos, PI, TAU, abs, max, min, floor, round, lerp, fract, C, part, hero, shadow, apple, sparkle, digit, plush, standLegs, sitLegs, recolor } = H;

// ---------- egna färger ----------
const K = {
  steel: R('#aab6c4'), note: R('#5fae6a'), noteL: R('#bfe3b0'), coin: R('#f2b632'), bag: R('#d0453c'), leather: R('#8a5a34'),
  oldShoe: R('#8f7a62'), sole: R('#5a4a3e'), cup: R('#3fb0c8'), saucer: R('#eef1f6'), inside: R('#f4efe2'),
  bird: R('#3f86e0'), belly: R('#f5e6b8'), beak: R('#ff9a2a'), petal: R('#f0507a'), center: R('#ffd23a'), stem: R('#4caf50'),
  black: R('#3a3350'), hat: R('#2e2840'), band: R('#9a6bff'), moon: R('#fff1a8'), straw: R('#d9b968'),
  grey: R('#e6e6ee'), cardi: R('#8a6a9a'), puppy: R('#c9935a'), ear: R('#6e4426'), kitten: R('#f0a23c'), stripe: R('#c06a1e'),
  shirt: R('#5b8c8a'), pants: R('#5d5a6e'), scarf: R('#d8433b'), ten: R('#4a3f6a'), red: R('#e04a3c'),
};

// Ritar i hjältens egna koordinater (huvudets mitt 39.5, 23.5, fötterna 39.5, 61) när hjälten står i (x, y) med skala k.
function onHero(g, x, y, k, fn, ang = 0) { g.push(x, y, ang, k); g.push(-39.5, -61); fn(); g.pop(); g.pop(); }

// ---------- STOP ----------
// Bokstäver 3x5 i pixelstil (bara de som behövs).
const FONT = { S: '111100111001111', T: '111010010010010', O: '111101101101111', P: '111101111100100' };
function letters(g, str, x, y, s, col, lv = 5) {
  part(g, () => { [...str].forEach((ch, j) => { const b = FONT[ch]; for (let i = 0; i < 15; i++) if (b[i] === '1') g.rect(x + j * 4 * s + (i % 3) * s, y + floor(i / 3) * s, s, s, col, lv); }); }, true);
}
function octagon(cx, cy, r) { const p = []; for (let i = 0; i < 8; i++) { const a = PI / 8 + i * PI / 4; p.push([cx + cos(a) * r, cy + sin(a) * r]); } return p; }
redo('stop', 1, 0, (g) => {                       // en röd åttkantig skylt med vit kant och STOP i vitt, på en kort stolpe
  part(g, () => g.rect(30, 50, 4, 14, K.steel, 3));
  part(g, () => { g.poly(octagon(32, 29, 29), C.white, 5); g.poly(octagon(32, 29, 26), K.red, 3); });
  letters(g, 'STOP', 9, 22, 3, C.white);
});

// ---------- vatten: kranen rinner ner i ett fullt glas ----------
redo('water', 4, 0.5, (g, p) => {
  part(g, () => { g.rect(0, 6, 22, 6, K.steel, 4); g.rect(16, 6, 8, 11, K.steel, 3); g.rect(8, 2, 6, 4, K.steel, 4); g.rect(5, 1, 12, 2.5, K.red, 3); });   // kranen
  part(g, () => g.poly([[14, 22], [50, 22], [47, 61], [17, 61]], C.glass, 4));                                                                         // glaset
  part(g, () => g.poly([[15.4, 30], [48.6, 30], [46.4, 59.5], [17.6, 59.5]], C.water, 3));                                                             // vattnet
  part(g, () => { g.rect(18, 17, 4, 15, C.water, 4); for (let i = 0; i < 4; i++) { const y = 17 + fract(p + i / 4) * 13; g.rect(19, y, 1, 2, C.foam, 5); } }, true);   // strålen
  part(g, () => { const f = floor(p * 4) % 2; g.rect(16, 30, 32, 1, C.foam, 5); for (const [x, y] of [[13 - f, 27 - f], [25 + f, 26 - f], [16, 24 + f], [27, 28]]) g.rect(x, y, 2, 2, C.water, 5); }, true);   // stänk vid ytan
  part(g, () => { g.rect(20, 34, 2, 20, C.white, 5); g.rect(42, 36, 1, 8, C.foam, 5); for (let i = 0; i < 3; i++) { const u = fract(p + i / 3); g.ell(30 + i * 6, 56 - u * 22, 1.3, 1.3, C.foam, false, null, 5); } }, true);   // glans och bubblor
});

// ---------- liten hund och liten katt: ett stort ben bredvid som måttstock ----------
// Valpen sedd från sidan åt höger, med stort huvud, hängande öra, halsband och tunga. w = svansens vift (-1..1).
function puppy(g, x, y, k, w) {
  g.push(x, y, 0, k);
  part(g, () => {
    g.thick(-8, -10, -13, -16 - w * 3, 2.6, K.puppy, 3);                                     // svans
    g.thick(-5, -5, -5, 0, 3, K.ear, 2); g.thick(4, -5, 4, 0, 3, K.ear, 2);                    // bortre benen
    g.ell(-1, -8, 9, 5.6, K.puppy);                                                            // kropp
    g.thick(-7, -5, -7, 0, 3.2, K.puppy, 3); g.thick(6, -5, 6, 0, 3.2, K.puppy, 3);            // närmaste benen
    g.ell(9, -18, 7.5, 7, K.puppy); g.ell(15.5, -15, 3.8, 3, K.puppy, true, null, 4);          // huvud och nos
    g.poly([[4, -23], [9, -24], [8, -12], [4.5, -13]], K.ear, 2);                              // hängande öra
    g.rect(4, -12.5, 7, 2, K.red, 3);                                                          // halsband
  });
  part(g, () => { g.rect(11, -21, 2, 3, C.ink, 0); g.dot(11, -21, C.white, 5); g.rect(17.5, -17, 2, 2, C.ink, 0); g.rect(14, -12.5, 2, 3, C.pink, 3); }, true);
  g.pop();
}
// Kattungen sitter upprätt åt höger: spetsiga öron, morrhår, svansen rakt upp.
function kitten(g, x, y, k) {
  g.push(x, y, 0, k);
  part(g, () => {
    g.thick(-6, -3, -10, -10, 2.6, K.kitten, 3); g.thick(-10, -10, -9, -20, 2.6, K.kitten, 3);   // svansen uppåt
    g.ell(0, -8, 7, 8, K.kitten);                                                                // kropp (sitter)
    g.ell(3, -1, 3, 1.8, K.kitten, true, null, 4); g.ell(-4, -1, 3, 1.8, K.kitten, true, null, 3);  // tassar
    g.ell(3, -20, 7, 6.2, K.kitten);                                                             // huvud
    g.poly([[-2.5, -23], [-2, -31], [3, -25]], K.kitten, 3); g.poly([[4, -25], [9, -31], [9.5, -22]], K.kitten, 3);   // spetsiga öron
  });
  part(g, () => {
    g.dot(-1, -26, C.pink, 3); g.dot(8, -26, C.pink, 3);
    for (const [x0, y0] of [[-5, -9], [-6, -6], [-3, -12]]) g.rect(x0, y0, 3, 1, K.stripe, 2);
    g.rect(0, -21, 2, 2, C.ink, 0); g.rect(6, -21, 2, 2, C.ink, 0); g.dot(4, -18, C.pink, 3);
  }, true);
  part(g, () => { g.line(9, -18, 12, -19, C.cloud, 4); g.line(9, -16, 12, -15, C.cloud, 4); }, true);
  g.pop();
}
// Ett vuxet ben med en stor känga, till höger i rutan, som måttstock: djuret når bara upp till kängans skaft.
function bigBoot(g) {
  shadow(g, 46, 61, 17);
  part(g, () => { g.poly([[38, 0], [60, 0], [59, 40], [39, 40]], K.pants, 3); });                       // byxbenet
  part(g, () => { g.poly([[37, 36], [61, 36], [62, 60], [26, 60], [24, 52], [30, 47], [37, 45]], K.leather, 3); });   // kängan, tån åt vänster
  part(g, () => { g.rect(23, 58, 40, 4, C.dark, 2); g.rect(37, 36, 24, 2.5, K.leather, 4); for (let i = 0; i < 3; i++) g.rect(33 + i * 2, 45 - i * 3, 4, 1.2, C.plank, 4); }, true);
}
redo('small_dog', 4, 0.6, (g, p) => {
  bigBoot(g);
  shadow(g, 15, 61, 8);
  puppy(g, 14, 61, 0.88, sin(p * TAU));
});
redo('small_cat', 1, 0, (g) => {
  bigBoot(g);
  shadow(g, 13, 61, 7);
  kitten(g, 13, 61, 0.9);
});

// ---------- gammal: en gammal man med vitt hår, vitt skägg och mustasch, böjd, med käpp ----------
const OLDLOOK = { skin: '#e9b48c', hair: '#e6e6ee', style: 'short' };
redo('old', 1, 0, (g) => {
  shadow(g, 32, 62, 13);
  hero(g, 27, 61, 0.98, { legs: { b: [35, 52, 34, 56.5, 0], f: [43, 52, 44, 56.5, 0] }, handB: [52, 42], bendB: [2, 2], noScarf: true }, 'smile', 0.16, OLDLOOK);
  recolor(g, K.shirt, K.cardi);
  onHero(g, 27, 61, 0.98, () => {
    part(g, () => g.thick(53, 42, 55, 61, 2.2, C.wood, 3));                                      // käppen
    part(g, () => g.ell(52.5, 42.5, 2.6, 2.6, R(OLDLOOK.skin), 0.75));                           // handen om käppen
    part(g, () => g.poly([[39, 27], [51, 26], [51, 30], [46, 35], [41, 32]], K.grey, 5));                // vitt skägg
    part(g, () => g.poly([[42, 27], [49, 27], [50, 29], [46, 28.5], [45.5, 29], [41, 29]], K.grey, 5));   // mustasch
    part(g, () => { g.line(41, 19, 43, 19, C.stem, 2); g.line(47, 19, 49, 19, C.stem, 2); }, true);       // rynkor i pannan
  }, 0.16);
});

// ---------- ny: en blank nalle i ett öppnat paket, glitter ----------
redo('new', 3, 0.9, (g, p) => {
  const f = floor(p * 3);
  part(g, () => { g.push(55, 61, -0.25, 1); g.rect(-4, -26, 8, 26, C.red, 4); g.rect(-1, -26, 2.5, 26, C.gold, 4); g.pop(); });   // locket står lutat mot paketet
  part(g, () => { g.ell(51, 33, 3.2, 2.2, C.gold, true); g.ell(57, 32, 3.2, 2.2, C.gold, true); g.ell(54, 33.5, 1.5, 1.5, C.gold, true, null, 4); });   // rosetten på locket
  part(g, () => g.rect(9, 37, 38, 4, C.red, 1));                                                                   // insidan av paketet
  g.push(28, 46, 0, 0.78); plush(g, 0, 0, false); g.pop();                                                        // nallen sticker upp
  part(g, () => { g.rect(8, 39, 40, 23, C.red, 3); g.rect(25, 39, 6, 23, C.gold, 4); g.rect(8, 39, 40, 2, C.red, 4); });   // paketets framsida med band
  sparkle(g, 8, 14, f === 0 ? 3 : 1); sparkle(g, 52, 16, f === 1 ? 3 : 1); sparkle(g, 40, 8, f === 2 ? 2 : 1); sparkle(g, 4, 50, f === 0 ? 2 : 0);
});

// ---------- gammal sko: stor, sliten, sulan glappar, tån sticker ut ----------
redo('old_shoe', 1, 0, (g, p) => {                                                    // stillbild (Jesper 2026-11-17)
  const a = 0.3;                                                                            // sulan glappar öppen
  const tx = 32 + cos(a) * 28, ty = 46 + sin(a) * 28;
  part(g, () => { g.push(32, 46, a, 1); g.rect(0, 0, 28, 5, K.sole, 3); g.pop(); });                    // främre sulan glappar som en mun
  part(g, () => g.poly([[32, 46], [60, 46], [tx, ty]], C.dark, 1), true);                               // mörkt gap mellan sula och sko
  part(g, () => g.rect(2, 46, 31, 5, K.sole, 3));                                                       // hälen och bakre sulan
  part(g, () => g.poly([[2, 46], [3, 20], [22, 19], [30, 29], [47, 31], [57, 37], [60, 46]], K.oldShoe, 3));   // ovandelen
  part(g, () => { g.ell(45, 35, 6, 3.5, C.dark, false, null, 1); }, true);                              // hål i tån
  part(g, () => { g.ell(42, 35, 2.4, 2.2, C.skin, true); g.ell(46.5, 34, 2.4, 2.2, C.skin, true); g.ell(50.5, 35.5, 2, 1.9, C.skin, true); });   // tårna sticker ut
  part(g, () => { g.rect(7, 27, 8, 8, C.patch, 3); g.dot(8, 28, C.white, 4); g.dot(13, 33, C.white, 4); }, true);   // lapp
  part(g, () => { g.line(21, 22, 25, 27, C.white, 4); g.line(24, 25, 27, 30, C.white, 4); g.line(27, 28, 22, 40, C.white, 4); g.line(25, 31, 30, 42, C.white, 4); }, true);   // trasiga snören som hänger
  part(g, () => { g.line(32, 38, 36, 42, C.ink, 1); g.line(12, 39, 16, 43, C.ink, 1); }, true);         // sprickor
  const fx = 50, fy = 10;
  part(g, () => { g.rect(round(fx), round(fy), 2, 2, C.ink, 1); g.set(round(fx), round(fy) - 1, C.white, 4); g.set(round(fx) + 1, round(fy) - 1, C.white, 4); }, true);   // fluga
});

// ---------- tal: stillbilder med stor siffra överst, äpplena under ----------
// 1 till 5 på en rad. 6 till 10 i en tioram: en full rad om fem och resten under, tomma rutor syns.
const NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
function bigNumber(g, n) {
  const d = String(n), s = 4, w = d.length * 4 * s - s, x0 = round(32 - w / 2);
  part(g, () => g.rect(x0 - 4, 1, w + 8, 5 * s + 4, C.white, 5));
  [...d].forEach((ch, j) => digit(g, ch, x0 + j * 4 * s, 3, s, C.blue));
}
for (const [id, n] of Object.entries(NUM)) {
  redo(id, 1, 0, (g) => {
    bigNumber(g, n);
    if (n <= 5) {
      const s = [0, 2.6, 2.0, 1.6, 1.3, 1.1][n], step = [0, 0, 26, 20, 15, 12.5][n];
      for (let i = 0; i < n; i++) apple(g, 32 + (i - (n - 1) / 2) * step, 46, s);
    } else {
      part(g, () => g.rect(2, 26, 60, 37, K.ten, 2));                                         // tioramen
      part(g, () => { for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) g.rect(4 + c * 11.6, 28 + r * 17.5, 10.4, 15.8, K.ten, 4); }, true);
      for (let i = 0; i < n; i++) apple(g, 9.2 + (i % 5) * 11.6, i < 5 ? 37 : 54.5, 1.05);
    }
  });
}

// ---------- tallrik: bara en tom tallrik ----------
redo('plate', 1, 0, (g) => {
  shadow(g, 33, 50, 27);
  part(g, () => { g.ell(32, 36, 29, 17, C.plate, false, null, 4); });
  part(g, () => { g.ell(32, 36, 29, 17, C.blue, false, (dx, dy, d2) => d2 > 0.86, 3); }, true);   // blå kant
  part(g, () => { g.ell(32, 37, 18, 10, C.plate, false, null, 3); g.ell(32, 37, 18, 10, C.plate, false, (dx, dy, d2) => dy < -0.5 && d2 > 0.6, 2); }, true);   // botten
  part(g, () => { g.line(14, 30, 18, 26, C.white, 5); g.line(44, 46, 49, 43, C.white, 5); }, true);    // glans
});

// ---------- pengar: sedlar i en solfjäder och mynt framför ----------
function bill(g, x, y, ang) {
  g.push(x, y, ang, 1);
  part(g, () => { g.rect(-16, -9, 32, 18, K.note, 3); });
  part(g, () => { g.rect(-14, -7, 28, 14, K.noteL, 3); g.ell(0, 0, 5, 5, K.note, false, null, 3); g.ell(0, 0, 3, 3, K.noteL, false, null, 4); }, true);
  part(g, () => { g.rect(-12, -5, 2, 4, K.note, 2); g.rect(10, 1, 2, 4, K.note, 2); }, true);
  g.pop();
}
function coin(g, x, y, r) {
  part(g, () => { g.ell(x, y, r, r * 0.95, K.coin, true); g.ell(x, y, r - 2, r * 0.95 - 2, K.coin, false, null, 4); });
  part(g, () => { g.rect(x - 0.5, y - r * 0.45, 1.5, r * 0.9, K.coin, 2); }, true);
}
redo('money', 1, 0, (g) => {
  bill(g, 24, 24, -0.35); bill(g, 33, 22, 0); bill(g, 41, 26, 0.35);
  coin(g, 18, 48, 8); coin(g, 34, 51, 8); coin(g, 48, 46, 7);
});

// ---------- häxa: spetsig svart hatt med brätte, flyger på en kvast framför månen ----------
const WITCH = { skin: '#e9b48c', hair: '#e2742a', style: 'long' };
redo('witch', 4, 1.2, (g, p) => {
  const b = round(sin(p * TAU) * 1.5);
  part(g, () => g.ell(13, 15, 11, 11, K.moon, true));                                          // månen
  const X = 34, Y = 54 + b, k = 0.82;
  onHero(g, X, Y, k, () => {
    part(g, () => { g.thick(10, 52, 68, 46, 2.4, C.wood, 3); });                                  // kvastskaftet
    part(g, () => { g.poly([[-4, 46], [10, 49], [10, 55], [-4, 62]], K.straw, 4); g.rect(9, 48.5, 3, 6, K.red, 3); });   // riset
  });
  hero(g, X, Y, k, { legs: sitLegs, handB: [62, 46], bendB: [1, 1], handF: [56, 47], bendF: [-1, 1], noScarf: true }, 'grin', 0, WITCH);
  recolor(g, K.shirt, K.black); recolor(g, K.pants, K.black);
  onHero(g, X, Y, k, () => {
    part(g, () => {
      g.ell(40, 14, 17, 3.6, K.hat, true);                                                       // brättet
      g.poly([[30, 13], [49, 13], [43, 3], [36, -4], [27, -6], [33, 3]], K.hat, 3);             // spetsen, böjd bakåt
    });
    part(g, () => g.rect(31, 9, 18, 3, K.band, 4));                                              // bandet
  });
});

// ---------- fågel, sol och blomma ----------
redo('bird', 1, 0, (g) => {                       // liten blå fågel från sidan, ljus mage, orange näbb, står på marken
  shadow(g, 32, 58, 12);
  part(g, () => { g.line(28, 48, 27, 57, K.beak, 2); g.line(34, 48, 35, 57, K.beak, 2); g.rect(24, 57, 5, 1, K.beak, 2); g.rect(33, 57, 5, 1, K.beak, 2); }, true);   // ben
  part(g, () => {
    g.poly([[16, 34], [4, 30], [6, 38], [16, 42]], K.bird, 2);                                   // stjärt
    g.ell(30, 38, 15, 11, K.bird);                                                               // kropp
    g.ell(44, 24, 9, 8.5, K.bird);                                                               // huvud
    g.poly([[52, 21], [61, 25], [52, 28]], K.beak, 4);                                           // näbb
  });
  part(g, () => g.ell(34, 43, 10, 6, K.belly, true, null, 4));                                   // mage
  part(g, () => g.poly([[16, 32], [34, 31], [30, 42], [20, 42]], K.bird, 2));                    // vinge
  part(g, () => { g.rect(46, 21, 3, 3, C.ink, 0); g.dot(46, 21, C.white, 5); g.line(20, 36, 28, 35, K.bird, 1); g.line(21, 39, 28, 38, K.bird, 1); }, true);
});
redo('sun', 1, 0, (g) => {                        // stor gul sol med raka strålar och ett glatt ansikte
  part(g, () => { for (let i = 0; i < 12; i++) { const a = i * PI / 6, r0 = 19, r1 = i % 2 ? 27 : 31; g.poly([[32 + cos(a - 0.12) * r0, 32 + sin(a - 0.12) * r0], [32 + cos(a) * r1, 32 + sin(a) * r1], [32 + cos(a + 0.12) * r0, 32 + sin(a + 0.12) * r0]], C.fire, 4); } });
  part(g, () => g.ell(32, 32, 18, 18, C.sun, true));
  part(g, () => { g.rect(25, 26, 3, 4, C.ink, 0); g.rect(37, 26, 3, 4, C.ink, 0); g.dot(25, 26, C.white, 5); g.dot(37, 26, C.white, 5); g.line(25, 36, 27, 38, C.ink, 0); g.line(28, 39, 36, 39, C.ink, 0); g.line(37, 38, 39, 36, C.ink, 0); g.rect(21, 33, 3, 2, C.fire, 4); g.rect(41, 33, 3, 2, C.fire, 4); }, true);
});
redo('flower', 1, 0, (g) => {                     // en blomma med stjälk och två blad: rosa kronblad runt en gul mitt
  part(g, () => { g.thick(32, 30, 32, 62, 3, K.stem, 3); });
  part(g, () => { g.poly([[32, 50], [18, 40], [14, 46], [24, 52]], K.stem, 4); g.poly([[33, 44], [48, 36], [51, 41], [40, 47]], K.stem, 3); });
  part(g, () => { for (let i = 0; i < 6; i++) { const a = i * PI / 3 - PI / 2; g.ell(32 + cos(a) * 10, 21 + sin(a) * 10, 7, 7, K.petal, true); } });
  part(g, () => g.ell(32, 21, 6.5, 6.5, K.center, true));
});

// ---------- kopp: en tom kopp med fat. Man ser ner i den: en mörk insida med botten, ingen dryck ----------
redo('cup', 1, 0, (g) => {
  part(g, () => g.ell(30, 54, 27, 7, K.saucer, true));                                          // fatet
  part(g, () => g.ell(51, 36, 8, 8, K.cup, true, (dx, dy, d2) => d2 > 0.38));                    // örat
  part(g, () => { g.poly([[8, 24], [52, 24], [48, 44], [40, 54], [20, 54], [12, 44]], K.cup, 3); g.ell(30, 24, 22, 8, K.cup, false, null, 3); });   // koppen
  part(g, () => g.ell(30, 24, 20.5, 7, K.cup, false, null, 1), true);                            // öppningen: koppens insida i skugga
  part(g, () => g.ell(30, 24, 20.5, 7, K.cup, false, (dx, dy) => dy < -0.05, 2), true);           // bortre innerväggen lite ljusare
  part(g, () => g.ell(30, 27.5, 9, 2.4, K.cup, false, null, 2), true);                           // botten långt ner: koppen är tom
  part(g, () => { g.rect(16, 30, 2, 12, C.white, 5); g.ell(30, 40, 4, 3, C.white, false, null, 5); }, true);   // glans och en vit prick
});

// ---------- väska: en vanlig handväska (inte en ryggsäck) ----------
redo('bag', 1, 0, (g) => {
  part(g, () => g.ell(32, 30, 13, 18, K.leather, false, (dx, dy, d2) => d2 > 0.62 && dy < 0, 3));   // handtaget
  shadow(g, 32, 61, 22);
  part(g, () => g.poly([[14, 30], [50, 30], [56, 59], [8, 59]], K.bag, 2));                       // väskan
  part(g, () => g.poly([[13, 29], [51, 29], [48, 43], [16, 43]], K.bag, 3));                      // locket
  part(g, () => { g.rect(29, 39, 6, 6, C.gold, 4); g.dot(31, 41, C.dark, 1); }, true);           // spännet
  part(g, () => { g.line(10, 57, 54, 57, K.bag, 1); g.line(18, 32, 46, 32, K.bag, 5); }, true);
});
