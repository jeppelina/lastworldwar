// Omritningar (granskningen 2026-11-17). Se wordart-more.js.
// Gruppen act: handlingar, känslor, lägen, kroppen och striden. Föräldrans anteckningar i docs/research/bilder-omritning.md.
import { redo, H } from './wordart.js';
import { G, ramp as R } from './pixel.js';
import { drawHero } from './hero.js';
import { BY_ID as FOE } from './enemies.js';

const { sin, cos, PI, TAU, abs, max, min, floor, round, clamp, lerp, ease, fract, C, standLegs, sitLegs,
  part, blit, hpx, hero, heroFlip, drawFace, gait, leg, shadow, ground, ball, apple, star4, sparkle, bubble,
  box, plate, chair, arrow, clockFace } = H;
const LOOK = { skin: '#e9b48c', hair: '#6b4426', style: 'short' };
const SIZE = 64;

// Egna färger för den här gruppen.
const K = {
  snail: R('#e6c98f'), snailShell: R('#c0703a'), trail: R('#cfe8ff'), pole: R('#8a8fa3'), sign: R('#3f74e0'),
  tile1: R('#f07aa8'), tile2: R('#3d9be0'), tile3: R('#ffc93a'), tile4: R('#9a6bff'), tileOff: R('#4a4f78'),
  mirror: R('#c9d2e6'), sand: R('#d9b77a'), cuff: R('#3f74e0'), nail: R('#f6d6cf'), flesh: R('#fbf3d9'), anger: R('#e04a3c'),
};

// ---------- verktyg ----------
// Hjälten med valfri vridpunkt: (x, y) är där punkten piv (hjältens koordinater) hamnar, k = skala, ang = vridning
// kring den punkten. extra(g) ritas i hjältens koordinater efter ansiktet (munnar, kinder). gear = utrustning (svärdet).
function figure(g, x, y, k, a = {}, face = null, o = {}) {
  const piv = o.piv || [39.5, 61], look = o.look || LOOK;
  g.push(x, y, o.ang || 0, k); g.push(-piv[0], -piv[1]);
  drawHero(g, look, o.gear || {}, { noPet: true, noFx: true, noShadow: true, t: 0, ...a });
  if (o.before) o.before(g);
  if (face) drawFace(g, face, 0, R(look.skin));
  if (o.extra) o.extra(g);
  g.pop(); g.pop();
}
// Som figure men spegelvänd (tittar åt vänster): ritas i en egen bild som vänds och läggs ovanpå.
function figureFlip(g, x, y, k, a = {}, face = null, o = {}) {
  const tmp = new G(g.w, g.h); figure(tmp, g.w - 1 - x, y, k, a, face, o); blit(g, tmp, true);
}
// Bildpunkt för en punkt i hjältens koordinater (samma förflyttning som figure).
function at(x, y, k, hx, hy, o = {}) {
  const g = new G(1, 1), piv = o.piv || [39.5, 61];
  g.push(x, y, o.ang || 0, k); g.push(-piv[0], -piv[1]); return g.pt(hx, hy);
}
// Stor skrattmun (öppen D-form med tänder och tunga) i hjältens koordinater. Ritas efter drawFace.
function bigMouth(g, Y = 23) {
  const put = (x, y, rp, lv) => hpx(g, x, y, rp, lv);
  for (let x = 43; x <= 49; x++) put(x, Y + 5, C.dark, 0);
  for (let x = 44; x <= 48; x++) put(x, Y + 6, C.white, 5);
  put(43, Y + 6, C.dark, 0); put(49, Y + 6, C.dark, 0);
  for (let x = 44; x <= 48; x++) put(x, Y + 7, C.red, 2);
  put(43, Y + 7, C.dark, 0); put(49, Y + 7, C.dark, 0);
  for (let x = 45; x <= 47; x++) put(x, Y + 8, C.pink, 3);
  put(44, Y + 8, C.dark, 0); put(48, Y + 8, C.dark, 0);
  for (let x = 45; x <= 47; x++) put(x, Y + 9, C.dark, 0);
}
// Tar bort hjältens bestämda ögonbryn (de är i hårets färg, så drawFace kan inte sudda dem).
const SKIN = R(LOOK.skin), HAIR = R(LOOK.hair);
function noBrows(g, Y = 23) { for (const [x, y] of [[41, Y - 2], [42, Y - 2], [43, Y - 1], [48, Y - 2], [49, Y - 2], [47, Y - 1]]) hpx(g, x, y, SKIN, 3, HAIR); }
// Glada stängda ögon som bågar (^ ^), ritade i hela hjältepixlar så att de håller i alla skalor.
function happyEyes(g, Y = 23) {
  noBrows(g, Y);
  for (const ex of [42, 47]) {
    for (let y = Y; y < Y + 3; y++) for (let x = ex; x < ex + 2; x++) hpx(g, x, y, SKIN, 3);
    hpx(g, ex - 1, Y + 2, C.dark, 0); hpx(g, ex, Y + 1, C.dark, 0); hpx(g, ex + 1, Y + 1, C.dark, 0); hpx(g, ex + 2, Y + 2, C.dark, 0);
  }
}
// Snigel från sidan åt höger: stort snäckskal med spiral, mjuk kropp, ögon på skaft. st = hur långt huvudet sträcks fram.
function snail(g, x, y, k = 1, st = 0, t = 0) {
  g.push(x, y, 0, k);
  part(g, () => {
    g.poly([[-17, 0], [-15, -4], [10 + st, -5], [15 + st, -9], [19 + st, -9], [21 + st, -4], [21 + st, 0]], K.snail, 4);   // fot och hals
    g.ell(17 + st, -9, 4.4, 4.6, K.snail, true);                                                                            // huvud
  });
  const bob = sin(t * TAU) * 0.8;
  part(g, () => { g.thick(15 + st, -12, 13 + st, -19 + bob, 1.6, K.snail, 4); g.thick(19 + st, -12, 21 + st, -19 - bob, 1.6, K.snail, 4); });   // ögonskaft
  part(g, () => { g.ell(13 + st, -20 + bob, 1.8, 1.8, C.white, false, null, 5); g.ell(21 + st, -20 - bob, 1.8, 1.8, C.white, false, null, 5); });
  part(g, () => { g.dot(13.5 + st, -20 + bob, C.ink, 0); g.dot(21.5 + st, -20 - bob, C.ink, 0); g.line(17 + st, -7, 19 + st, -7, C.ink, 1); }, true);
  part(g, () => g.ell(-1, -13, 12, 11.5, K.snailShell, true));                                                               // skalet
  part(g, () => {                                                                                                            // spiralen
    let px = null, py = null;
    for (let i = 0; i <= 60; i++) { const a = i / 60 * PI * 3.4, r = 9.5 * (1 - i / 66); const qx = -1 + cos(a + PI) * r, qy = -13 + sin(a + PI) * r * 0.95; if (px !== null) g.line(round(px), round(py), round(qx), round(qy), K.snailShell, 1); px = qx; py = qy; }
  }, true);
  g.pop();
}
// Stor hand från sidan med fingrarna uppåt. dir 1 = handflatan åt höger. Vridning ang kring handleden (x, y).
function bigHand(g, x, y, dir, ang, k = 1, cuff = true) {
  g.push(x, y, ang, k);
  part(g, () => {
    if (cuff) g.rect(-5, -2, 10, 9, K.cuff, 3);                                                           // ärmen
    g.poly([[-5, -2], [-5.5, -14], [-4, -24], [3, -25], [5, -14], [5, -2]].map(([a, b]) => [a * dir, b]), C.skin, 3);   // handflata och fingrar
    g.poly([[4, -8], [8, -12], [9.5, -16], [7, -17], [4, -14]].map(([a, b]) => [a * dir, b]), C.skin, 4);              // tummen
  });
  if (k >= 0.8) part(g, () => { for (const fx of [-2.5, 0, 2.5]) g.line(fx * dir, -24, fx * dir, -17, C.skin, 1); }, true);   // fingrarnas skåror (bara när handen är stor)
  else part(g, () => g.line(0, -24, 0, -18, C.skin, 2), true);
  g.pop();
}
// Äpple med bett: ritas i en egen bild, bitarna skärs bort och det vita fruktköttet syns i kanten.
function bittenApple(g, x, y, s, bites) {
  const tmp = new G(SIZE, SIZE); apple(tmp, x, y, s);
  const cut = (px, py) => { let m = 1e9; for (const [bx, by, r] of bites) m = min(m, Math.hypot(px - bx, py - by) - r); return m; };
  for (let py = 0; py < SIZE; py++) for (let px = 0; px < SIZE; px++) {
    const i = py * SIZE + px; if (tmp.R[i] < 0) continue;
    const m = cut(px + 0.5, py + 0.5);
    if (m < 0) tmp.R[i] = -1; else if (m < 1) { tmp.R[i] = C.apple; tmp.L[i] = 0; } else if (m < 2.6 && tmp.R[i] === C.apple && tmp.L[i] !== 0) { tmp.R[i] = K.flesh; tmp.L[i] = m < 1.8 ? 4 : 5; }
  }
  blit(g, tmp);
}
// En av spelets egna fiender (Bonk Goblin, världen 1). Tittar åt vänster. (x, y) = marken mitt under, k = skala.
function goblin(g, x, y, k, t, pose = {}, angry = false) {
  g.push(x, y, 0, k); FOE.goblingang.draw(g, t, { attack: 0, hurt: 0, ...pose }); g.pop();
  if (angry) {                                   // arga ögonbryn i V (goblinens egna koordinater, skala 0,8 som i fiendelistan, vila utan attack)
    g.push(x, y, 0, k * 0.8); const Y = -16;
    part(g, () => { g.thick(-8.5, Y - 6.5, -4.5, Y - 4.2, 1.3, C.dark, 1); g.thick(-2.5, Y - 5.2, 2, Y - 7.5, 1.3, C.dark, 1); }, true);
    g.pop();
  }
}
// Smäll: guldstjärna med vita strålar.
function burst(g, x, y, r) {
  part(g, () => { for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8; g.line(round(x + cos(a) * (r + 1)), round(y + sin(a) * (r + 1)), round(x + cos(a) * (r + 4)), round(y + sin(a) * (r + 4)), C.white, 5); } }, true);
  star4(g, x, y, r, C.gold); sparkle(g, x, y, 1);
}

// ---------- bilderna ----------

// --- äta: nära ansiktet, ett stort äpple, bitarna försvinner, kinderna tuggar ---
const EAT = [24, 90, 1.5];
redo('eat', 6, 1.5, (g, p) => {
  const f = floor(p * 6), biting = f % 2 === 1, nb = 2 + floor(f / 2) + (biting ? 0 : 0);
  const BITES = [[-12, -2, 4.6], [-11, 6, 4.2], [-8.5, -8.5, 4], [-13, 2, 4]];
  const ax = biting ? 44 : 52, ay = biting ? 41 : 44, s = 2.4;
  const [hx, hy] = (() => { const [X0, Y0] = at(...EAT, 39.5, 61); return [39.5 + (ax + 3 - X0) / EAT[2], 61 + (ay + 9 - Y0) / EAT[2]]; })();
  figure(g, EAT[0], EAT[1], EAT[2], { legs: standLegs, handB: [hx, hy], bendB: [2, 2] }, biting ? 'o' : 'chew blush', {
    before: (q) => { if (!biting) part(q, () => q.ell(49.5, 28.5, 3.4, 2.8, C.skin, 1.2)); },          // puffig tuggkind
  });
  bittenApple(g, ax, ay, s, BITES.slice(0, nb).map(([bx, by, r]) => [ax + bx, ay + by, r]));
  if (!biting) part(g, () => { const u = (f / 2) % 1 + 0.3; for (const [dx, dy] of [[-2, -3], [1, 2], [-4, 3]]) g.rect(round(37 + dx * (1 + u * 2)), round(44 + dy * (1 + u)), 1.5, 1.5, K.flesh, 5); });   // smulor
});

// --- långsamt: en stor snigel kryper, hjälten bakom tar pyttesmå steg ---
redo('slow', 8, 4.0, (g, p) => {
  const ph = p * TAU + PI / 2, a = gait(ph, false);
  a.legs.b = leg(35.5, ph + PI, 1.6, 0.6); a.legs.f = leg(42, ph, 1.6, 0.6);
  a.handB = [46, 46.5]; a.handF = [33, 46.5];
  part(g, () => { g.rect(1, 60, 24, 1.2, K.trail, 5); g.rect(4, 61, 16, 1, K.trail, 4); }, true);                 // slemspåret
  sparkle(g, 4 + floor(p * 8) % 3 * 6, 59, 1);
  shadow(g, 10, 61, 6);
  figure(g, 10, 60, 0.62, a, 'shut');
  shadow(g, 36, 61, 18);
  snail(g, 33, 61, 1.15, (sin(p * TAU) + 1) * 1.2, p);
});

// --- gå: hjälten går lugnt tvärs över rutan på en stig och lämnar fotspår ---
redo('walk', 12, 2.6, (g, p) => {
  const u = fract(p + 0.5), x = lerp(12, 52, u), ph = p * TAU * 2.5 + PI / 2, a = gait(ph, false);
  part(g, () => { g.rect(0, 56, SIZE, 8, C.dirt, 3); g.rect(0, 56, SIZE, 1, C.dirt, 4); });
  part(g, () => { for (let fx = 4, i = 0; fx < x - 7; fx += 6, i++) { const fy = i % 2 ? 61 : 58.5; g.rect(fx, fy, 3, 1.5, C.dirt, 1); g.dot(fx + 3, fy, C.dirt, 1); } }, true);
  shadow(g, x, 61, 8);
  figure(g, x, 60 - abs(sin(ph)) * 0.6, 0.82, a, 'smile');
});
// --- springa: som förut, lite snabbare steg ---
redo('run', 8, 0.48, (g, p) => {
  const ph = p * TAU + PI / 2, a = gait(ph, true), bob = abs(sin(ph)) * 1.6;
  shadow(g, 31, 61, 9);
  hero(g, 31, 60 - bob, 0.9, { ...a, t: p * 2.03 }, null, 0.12);
});

// --- stå: reser sig från stolen och står rak, en pil uppåt ---
redo('stand', 8, 2.6, (g, p) => {
  const f = floor(p * 8), sitting = f >= 5;
  chair(g, 4, 46, 60);
  if (sitting) { shadow(g, 22, 61, 12); hero(g, 22, 61, 0.9, { legs: sitLegs, handB: [49, 45], handF: [40, 46] }, 'smile'); return; }
  part(g, () => g.ell(32, 61, 11, 2.4, C.gold, false, null, 3), true);                                      // markeringen på golvet
  hero(g, 32, 60, 0.9, { legs: standLegs, handB: [46.5, 48], bendB: [0.5, 0], handF: [33, 48], bendF: [-0.5, 0] }, 'smile');
  arrow(g, 54, 34 - (f % 5) * 1.5, -1);
});

// --- titta: handen som skärm över ögonen, spanar åt höger och sedan åt vänster ---
redo('look', 6, 2.4, (g, p) => {
  const f = floor(p * 6), left = f >= 3, k = 1.3, x = left ? 36 : 27, y = 84;
  // Närmaste armen upp: armbågen sticker fram, handen ligger platt över ögonbrynen som en skärm.
  // Hjältens närmaste arm göms vid axeln och ritas om här: armbågen fram framför hakan, handen platt över ögonbrynen.
  const a = { legs: standLegs, handF: [35, 37], bendF: [0, 0] };
  const eyes = (q) => {
    part(q, () => { q.thick(34, 37, 55, 31, 4.2, C.skin, 3); q.ell(55, 30.5, 2.6, 2.6, C.skin, 1.2); q.thick(55, 30, 50.5, 20, 3.6, C.skin, 3); });   // överarm, armbåge, underarm
    part(q, () => { q.thick(46, 18.5, 57, 17.5, 3.4, C.skin, 4); q.ell(48, 18.8, 3, 2.6, C.skin, 1.2); });   // handen som skärm, fingrarna framåt
    part(q, () => { q.line(50, 18, 56, 17.5, C.skin, 1); }, true);                                          // fingrarnas skåra
  };
  if (left) figureFlip(g, x, y, k, a, 'o', { extra: eyes }); else figure(g, x, y, k, a, 'o', { extra: eyes });
});

// --- klappa: två stora händer möts, en smäll när de slår ihop ---
redo('clap', 6, 0.6, (g, p) => {
  const f = floor(p * 6), d = [0, 2.5, 5, 6.5, 5, 2.5][f], X = 18, Y = 74, k = 1.2;
  const hx = 57, hy = 42;                                                  // där händerna möts, framför bröstet (hjältens koordinater)
  figure(g, X, Y, k, { legs: standLegs, handF: [hx - 2 - d, hy + 2], bendF: [-1, 4], handB: [hx + 1 + d, hy + 1], bendB: [0, 4] }, 'blush', { extra: (q) => { happyEyes(q); bigMouth(q); } });
  // Öppna handflator ovanpå hjältens händer, fingrarna uppåt, handflatorna mot varandra.
  const [ax, ay] = at(X, Y, k, hx - 1.5 - d, hy + 3), [bx, by] = at(X, Y, k, hx + 1.5 + d, hy + 2);
  bigHand(g, bx, by, -1, 0.1 + d * 0.05, 0.7, false);
  bigHand(g, ax, ay, 1, -0.1 - d * 0.05, 0.7, false);
  const cx = (ax + bx) / 2, cy = ay - 21;
  if (f === 0) { burst(g, cx, cy, 4); part(g, () => { g.line(cx - 8, cy + 6, cx - 11, cy + 4, C.white, 5); g.line(cx + 8, cy + 6, cx + 11, cy + 4, C.white, 5); }, true); }
  else if (f === 1) sparkle(g, round(cx), round(cy), 2);
});

// --- dansa: hoppar åt sidorna och snurrar runt, armarna upp, ett golv med färgade rutor och en discokula ---
redo('dance', 8, 1.6, (g, p) => {
  const f = floor(p * 8), TILES = [K.tile1, K.tile2, K.tile3, K.tile4];
  part(g, () => { for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { const lit = (i + r + f) % 3 === 0; g.rect(i * 11 - (r ? 5 : 0), 54 + r * 5, 10, 4, lit ? TILES[(i + r * 2 + f) % 4] : K.tileOff, lit ? 4 : 3); } });
  part(g, () => g.line(52, 0, 52, 2, C.grey, 2), true);
  part(g, () => g.ell(52, 8, 6, 6, K.mirror, true));
  part(g, () => { g.line(46, 7, 58, 7, K.mirror, 1); g.line(47, 10, 57, 10, K.mirror, 1); g.line(50, 2, 50, 14, K.mirror, 1); g.line(54, 2, 54, 14, K.mirror, 1); }, true);
  sparkle(g, f % 2 ? 45 : 59, f % 2 ? 12 : 4, 2);
  const X = [32, 27, 25, 27, 32, 37, 39, 37][f], hop = [3, 0, 3, 0, 3, 0, 3, 0][f], flip = f === 2 || f === 3 || f === 6 || f === 7;
  const up = { handB: [55, 8], bendB: [2, 0], handF: [24, 8], bendF: [-2, 0] };
  const oneUp = f % 4 === 1 ? { handB: [55, 8], bendB: [2, 0], handF: [27, 44] } : { handB: [51, 44], handF: [24, 8], bendF: [-2, 0] };
  const legs = hop ? { b: [33, 51, 33, 55, 0.3], f: [45, 50, 44, 54.5, 0.2] } : f % 4 === 1 ? { b: [34, 52, 34, 56.5, 0], f: [47, 50, 48, 53, 0.4] } : { b: [31, 50, 29, 53, -0.4], f: [44, 52, 44, 56.5, 0] };
  const a = { legs, ...(hop ? up : oneUp) };
  shadow(g, X, 59, 7);
  if (flip) heroFlip(g, X, 58 - hop, 0.86, a, 'grin'); else hero(g, X, 58 - hop, 0.86, a, 'grin');
});

// --- vänta: vid busshållplatsen, tittar på klockan på armen och stampar med foten, klockan snurrar ---
redo('wait', 8, 2.4, (g, p) => {
  const f = floor(p * 8), tap = f % 2;
  part(g, () => { g.rect(10, 16, 2.5, 45, K.pole, 3); g.rect(3, 4, 16, 14, K.sign, 3); });
  part(g, () => { g.rect(5.5, 7, 11, 6, C.white, 5); g.rect(6.5, 8, 3, 2, K.sign, 3); g.rect(10.5, 8, 3, 2, K.sign, 3); g.dot(7, 14, C.ink, 0); g.dot(14, 14, C.ink, 0); g.rect(6, 14, 2, 1, C.ink, 0); g.rect(13, 14, 2, 1, C.ink, 0); }, true);   // buss på skylten
  shadow(g, 34, 61, 8);
  hero(g, 34, 60, 0.86, { legs: { b: [34.5, 52, 34.5, 56.5, 0], f: [44, 51, 45, 55.5 - tap * 2, -0.25 * tap] }, handF: [45, 37], bendF: [-3, 3], handB: [44, 39], bendB: [2, 3] }, 'frown');
  const [wx, wy] = at(34, 60, 0.86, 45, 36);
  part(g, () => { g.rect(round(wx) - 1.5, round(wy) - 1.5, 4, 4, C.white, 5); g.dot(round(wx), round(wy), C.ink, 0); g.dot(round(wx) + 1, round(wy) - 1, C.ink, 0); });   // armbandsuret
  clockFace(g, 52, 13, 9, p * 2);
  part(g, () => { for (let i = 0; i < 3; i++) if (f % 4 >= i + 1) g.rect(24 + i * 4, 8, 2, 2, C.white, 5); }, true);
});

// --- glad: närmare, armarna rakt upp, hoppar, glitter ---
redo('happy', 6, 0.9, (g, p) => {
  const f = floor(p * 6), h = [3, 4, 2, 0, 0, 2][f];
  for (const [x, y, s] of [[6, 10, f % 2 ? 2 : 1], [58, 12, f % 2 ? 1 : 2], [8, 46, f % 3 === 0 ? 2 : 1], [57, 44, f % 3 === 1 ? 2 : 1]]) sparkle(g, x, y, s);
  part(g, () => { const CONF = [C.pink, C.sun, C.blue, C.leaf]; for (let i = 0; i < 8; i++) { const u = fract(p + i * 0.37), x = 4 + (i * 17) % 56, y = 2 + u * 30; g.rect(round(x + sin(u * 9 + i) * 2), round(y), 2, 1.5, CONF[i % 4], 5); } }, true);
  figure(g, 32, 82 - h, 1.25, { legs: standLegs, handB: [56, 9], bendB: [2, 0], handF: [22, 9], bendF: [-2, 0] }, 'blush', { extra: (q) => { happyEyes(q); bigMouth(q); } });
});

// --- skratta: tätt inpå, huvudet bakåt och vickar, stor öppen mun, glädjetårar ---
redo('laugh', 6, 0.6, (g, p) => {
  const f = floor(p * 6), ang = [-0.22, -0.32, -0.22, -0.32, -0.22, -0.32][f], sh = f % 2;
  figure(g, 31 + sh, 37 - sh, 1.85, { legs: standLegs }, 'blush', { piv: [39.5, 23.5], ang, extra: (q) => { happyEyes(q); bigMouth(q); hpx(q, 40.5, 25, C.water, 5); hpx(q, 50, 24.5, C.water, 5); } });
  part(g, () => { for (const [x, y, dx, dy] of [[5, 18, -1, -1], [4, 26, -1, 0], [58, 10, 1, -1], [60, 20, 1, 0]]) g.line(x, y + sh, x + dx * 3, y + dy * 3 + sh, C.white, 5); }, true);
});

// --- tänka: handen under hakan, blicken uppåt, en tankebubbla med ett frågetecken ---
redo('think', 6, 2.0, (g, p) => {
  const f = floor(p * 6);
  figure(g, 20, 72, 1.05, { legs: standLegs, handF: [49, 34], bendF: [-5, 5] }, null, {
    extra: (q) => { noBrows(q); hpx(q, 41, 20, C.dark, 0); hpx(q, 42, 19, C.dark, 0); hpx(q, 43, 19, C.dark, 0); hpx(q, 47, 21, C.dark, 0); hpx(q, 48, 21, C.dark, 0); for (const ex of [42, 47]) { hpx(q, ex, 25, C.skin, 3, C.dark); hpx(q, ex + 1, 25, C.skin, 3, C.dark); hpx(q, ex, 22, C.dark, 0); hpx(q, ex + 1, 22, C.dark, 0); } },   // pupillerna uppåt
  });
  // Bubblan: ringarna tänds en i taget, sedan frågetecknet (ruta 0 = hela bubblan).
  const show = f === 0 ? 9 : f;
  if (show >= 1) part(g, () => g.ell(30, 18, 1.5, 1.4, C.white, false, null, 5));
  if (show >= 2) part(g, () => g.ell(35, 13, 2.4, 2.2, C.white, false, null, 5));
  if (show >= 3) {
    part(g, () => { g.ell(49, 16, 13, 12, C.white, false, null, 5); g.ell(41, 20, 6, 5, C.white, false, null, 5); g.ell(56, 21, 6, 5, C.white, false, null, 5); });
    const b = f % 2;
    part(g, () => { const X = 46, Y = 8 + b; g.rect(X, Y, 7, 2.5, C.blue, 3); g.rect(X + 5, Y, 2.5, 7, C.blue, 3); g.rect(X + 2, Y + 6, 5.5, 2.5, C.blue, 3); g.rect(X + 2, Y + 6, 2.5, 4, C.blue, 3); g.rect(X + 2, Y + 12, 2.5, 2.5, C.blue, 3); g.rect(X - 0.5, Y + 2, 2.5, 2, C.blue, 3); });
  }
});

// --- under: samma låda som i in och on, nu på ben, inget ovanpå; bollen rullar in under ---
redo('under', 6, 1.4, (g, p) => {
  const u = p === 0 ? 1 : ease(min(1, p * 1.5)), bx = lerp(4, 32, u);
  shadow(g, 32, 60, 16);
  part(g, () => { for (const lx of [19, 42]) g.rect(lx, 38, 3, 22, C.wood, 2); });
  box(g, 18, 24, 28, 15);
  ball(g, bx, 54, 6, C.red);
});

// --- in: bollen faller hela vägen ner i en öppen låda och ligger kvar inne i den (granskning 2026-11-18: in och on var för
// lika, bollen stack upp över kanten). Lådans framsida är bara en ram, så att bollen syns där inne. ---
redo('in', 6, 1.4, (g, p) => {
  const x = 17, y = 34, w = 30, h = 24, u = p === 0 ? 1 : ease(min(1, p * 1.4)), by = lerp(4, y + h - 8, u);
  shadow(g, 32, 60, 16);
  box(g, x, y, w, h, { open: true, front: false });
  part(g, () => { g.rect(x + 1, y + 1, w - 2, h - 2, C.dirt, 1); g.rect(x + 2, y + h - 5, w - 4, 3, C.dirt, 2); });      // insidan, mörk
  ball(g, 32, by, 6, C.red);
  part(g, () => { g.rect(x, y, w, 3, C.card, 4); g.rect(x, y + h - 3, w, 3, C.card, 3); g.rect(x, y, 3, h, C.card, 3); g.rect(x + w - 3, y, 3, h, C.card, 3); });
  if (u < 1) part(g, () => { g.line(32, by - 9, 32, by - 13, C.white, 4); }, true);
});

// --- arm: hjälten sträcker ut armen, armen lyser och en pil pekar på den ---
// En arm för sig: ärmkanten vid axeln till vänster, överarm, en lätt böjd armbåge, underarm och en öppen hand
// med fingrarna utsträckta åt höger. w = fingrarnas lilla vinkning (radianer).
const TUNIC = R('#5b8c8a');
function lonelyArm(g, w) {
  part(g, () => {
    g.thick(8, 24, 30, 30, 10, C.skin, 3); g.ell(30, 30.5, 5, 4.8, C.skin, 1.2);                          // överarm och armbåge
    g.thick(30, 31, 47, 36, 8.4, C.skin, 3); g.thick(44, 35.2, 49, 36.6, 6.4, C.skin, 3);                 // underarm smalnar mot handleden
  });
  part(g, () => { g.rect(1, 16, 9, 17, TUNIC, 3); g.rect(8, 16, 3, 17, TUNIC, 4); });                    // ärmkanten vid axeln
  part(g, () => { g.line(9, 17, 9, 31, TUNIC, 1); }, true);
  const F = [[2.4, -0.5, 10.5], [0.9, -0.15, 12], [-0.6, 0.15, 11.4], [-2, 0.45, 9.2]];                  // fingrarna: läge på handflatan, vinkel, längd
  part(g, () => {
    g.ell(53, 37.5, 5.4, 5, C.skin, 1.2);                                                                // handflatan
    for (const [dy, an, L] of F) { const a = an + w * (dy > 0 ? 1 : -0.5), x0 = 56, y0 = 37.5 + dy * 1.4; g.thick(x0, y0, x0 + cos(a) * L * 0.62, y0 + sin(a) * L * 0.62, 2.4, C.skin, 3); }
    g.thick(50, 33.5, 54, 29.5, 2.6, C.skin, 4); g.ell(54.5, 29, 1.5, 1.5, C.skin, 1.2);                   // tummen
  });
  part(g, () => {
    for (const [dy, an, L] of F) { const a = an + w * (dy > 0 ? 1 : -0.5), x0 = 56, y0 = 37.5 + dy * 1.4; g.dot(round(x0 + cos(a) * L * 0.62) - 1, round(y0 + sin(a) * L * 0.62) - 1, K.nail, 5); }   // naglarna
    g.line(29, 27, 32, 29, C.skin, 1);                                                                   // armbågsvecket
  }, true);
}
redo('arm', 4, 1.6, (g, p) => {
  const w = [0, 0.12, 0.2, 0.12][floor(p * 4)];
  lonelyArm(g, w);
});

// --- fot: en bar fot från sidan, stillbild: vrist med ankelknöl, häl, fotvalv, fem tår med naglar ---
function sideFoot(g, x, y) {
  g.push(x, y);
  part(g, () => {
    g.poly([[-15, -40], [-3, -40], [-2, -24], [6, -18], [18, -13], [27, -9], [30, -4], [30, 0], [14, 0], [4, -2.5], [-6, -2], [-16, 0], [-20, -6], [-17, -16]], C.skin, 3);   // vrist, fotrygg, valv och häl
    g.ell(-14, -6, 6.5, 6, C.skin, 1.2);                                                                  // hälen
  });
  part(g, () => { g.ell(-7.5, -19, 2.6, 2.2, C.skin, false, null, 4); }, true);   // ankelknölen, svag
  part(g, () => {                                                                                         // tårna: lillatån längst bak, stortån längst fram
    for (const [tx, ty, r] of [[14.5, -2, 2], [18.5, -2.3, 2.3], [22.5, -2.6, 2.6], [26.5, -3, 2.9], [31, -3.8, 3.8]]) g.ell(tx, ty, r, r * 0.95, C.skin, 1.2);
  });
  part(g, () => { for (const [tx, ty, w] of [[14.5, -3.6, 1], [18.5, -4.2, 1.5], [22.5, -4.8, 1.5], [26.5, -5.4, 2], [31.5, -6.8, 2.5]]) g.rect(tx, ty, w, 1.5, K.nail, 5); }, true);   // naglarna
  part(g, () => { g.rect(-17, -46, 17, 8, K.cuff, 3); g.rect(-17, -40, 17, 2, K.cuff, 2); });             // byxkanten
  g.pop();
}
redo('foot', 1, 0, (g) => {
  shadow(g, 31, 57, 22);
  sideFoot(g, 24, 56);
});

// --- strid: hjälten med svärd och en goblin drabbar samman, en smäll mellan dem ---
const SWORD = { slot: 'weapon', type: 'sword', mat: 'jarn', hex: '#8793a3' };
redo('battle', 6, 0.9, (g, p) => {
  const f = floor(p * 6), clash = f === 0 || f === 5, wind = f === 2 || f === 3;
  const hx = clash ? 15 : wind ? 12 : 14, ex = clash ? 50 : wind ? 53 : 51;
  shadow(g, hx, 61, 8); shadow(g, ex, 61, 9);
  figure(g, hx, 60, 0.8, { legs: clash ? { b: [33, 52, 31, 56.5, 0], f: [46, 51, 48, 56.5, 0] } : standLegs, handB: clash ? [55, 36] : wind ? [46, 28] : [50, 38], bendB: [1, 1], wAng: clash ? 0.85 : wind ? -0.35 : 0.4 }, null, { gear: { weapon: SWORD } });
  goblin(g, ex, 60, 1.6, 0, { attack: clash ? 0.42 : wind ? 0.2 : 0.05 }, !clash);
  if (clash) burst(g, 35, 26, f === 0 ? 4 : 3);
});

// --- fiende: spelets goblin framifrån, stor och enkel: arga ögonbryn i V, röda ögon, morrande mun med huggtänder,
// klubban höjd över huvudet och skakar, ett argt tecken ---
const GOB = R('#7cba4a'), GOBC = R('#8a5a34'), CLUB = R('#9a6b3f'), BONE = R('#ece4cf'), EYE = R('#ffd84a');
function angryGoblin(g, x, y, sh, swing) {
  g.push(x, y);
  part(g, () => {
    g.rect(-9, -6, 6, 6, GOB, 2); g.rect(3, -6, 6, 6, GOB, 3); g.rect(-11, -1.5, 8, 2, GOB, 2); g.rect(3, -1.5, 8, 2, GOB, 3);   // ben och fötter
    g.poly([[-11, -22], [11, -22], [12, -6], [-12, -6]], GOBC, 3); g.poly([[-12, -6], [-8, -3], [-4, -6], [0, -3], [4, -6], [8, -3], [12, -6]], GOBC, 2);   // tunika med trasig fåll
    g.thick(-11, -19, -17, -10, 4, GOB, 2); g.ell(-17, -9, 3.2, 3.2, GOB, true);                       // vänster arm och knuten näve
  });
  part(g, () => g.rect(-11, -14, 22, 2, BONE, 3));                                                       // repet i midjan
  g.push(0, sh);
  part(g, () => {
    g.poly([[-12, -36], [-25, -44], [-15, -28]], GOB, 2); g.poly([[12, -36], [25, -44], [15, -28]], GOB, 3);   // spetsiga öron
    g.ell(0, -34, 15, 13, GOB, true);                                                                    // huvudet
  });
  part(g, () => {
    g.ell(-6, -36, 4, 3.4, EYE, false, null, 5); g.ell(6, -36, 4, 3.4, EYE, false, null, 5);             // gula ögon
    g.rect(-6, -37, 2.5, 3, K.anger, 2); g.rect(4, -37, 2.5, 3, K.anger, 2);                             // röda pupiller
  });
  part(g, () => { g.thick(-12, -43, -2, -38, 3, C.dark, 1); g.thick(12, -43, 2, -38, 3, C.dark, 1); }, true);   // arga ögonbryn i V
  part(g, () => {
    g.poly([[-9, -29], [9, -29], [7, -23], [-7, -23]], C.dark, 1);                                       // öppen morrande mun
    for (let i = 0; i < 5; i++) { const tx = -7.5 + i * 3.6; g.poly([[tx, -29], [tx + 2.6, -29], [tx + 1.3, -26.6]], BONE, 5); }   // tänderna uppe
    g.poly([[-7, -23], [-4, -23], [-5.5, -27.5]], BONE, 5); g.poly([[7, -23], [4, -23], [5.5, -27.5]], BONE, 5);   // huggtänder nere
  });
  part(g, () => { g.rect(-1.5, -33, 3, 2, GOB, 2); }, true);                                              // näsan
  g.pop();
  // klubban i höger hand (bildens höger), höjd över huvudet
  g.push(19, -30, 0.3 + swing);
  part(g, () => { g.poly([[-1.6, 2], [1.6, 2], [4.2, -17], [2.8, -22], [-2.8, -22], [-4.2, -17]], CLUB, 3); g.rect(-2, -3, 4, 1.5, GOBC, 2); });
  part(g, () => { g.rect(-4, -18, 2.2, 2.2, BONE, 5); g.rect(2, -14, 2.2, 2.2, BONE, 5); g.rect(-0.5, -22.5, 2, 2, BONE, 5); }, true);
  g.pop();
  part(g, () => { g.thick(11, -19, 18, -28, 4, GOB, 3); g.ell(18.5, -29, 3.4, 3.4, GOB, true); });           // höger arm upp till klubban, framför örat
  g.pop();
}
redo('enemy', 4, 0.6, (g, p) => {
  const f = floor(p * 4), sh = f % 2, swing = [0, -0.25, 0, -0.25][f];
  shadow(g, 32, 61, 16);
  angryGoblin(g, 30, 60, sh, swing);
  part(g, () => { const X = 9, Y = 8 - sh; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.thick(X + dx * 1.5, Y + dy * 4.5, X + dx * 1.5, Y + dy * 1.5, 1.5, K.anger, 4); g.thick(X + dx * 1.5, Y + dy * 1.5, X + dx * 4.5, Y + dy * 1.5, 1.5, K.anger, 4); } });   // argt tecken
});

// --- hungrig: som förut, men bubblan visar bara ett större äpple och tallriken (som såg ut som en pöl) är borta ---
redo('hungry', 6, 1.0, (g, p) => {
  const r = floor(p * 6) % 2;
  shadow(g, 22, 61, 8);
  hero(g, 22, 60, 0.82, { legs: standLegs, handF: [38, 47], bendF: [-1, 1], handB: [44, 48], bendB: [0, 1] }, 'o sadbrow');
  part(g, () => { for (const [x, y] of [[33, 44], [35, 47], [33, 50]]) g.line(x + r, y, x + 3 + r, y + 1, C.white, 5); }, true);
  bubble(g, 47, 15, 26, 24, 34, 30);
  apple(g, 47, 17, 1.55);
});
