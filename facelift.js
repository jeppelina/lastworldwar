// Ansiktslyftet 2026-11-16: åtta vanliga fiender som var en rund klump med två ögon eller en omfärgad kopia av en annan
// fiende, omritade som egna figurer. Samma id, värld, typ och antal som förut (h och w följer det som ritas).
// Samma format som game/enemies.js: draw(g, t, pose), motorn har gjort g.push(x, y) så att (0, 0) är marken mitt under
// varelsen, varelsen tittar åt VÄNSTER, uppåt är negativt y, pose = { attack: 0..1, hurt: 0..1 }.
// Extra fält i pose som bara minibossfilmerna skickar (game/miniboss.js): out (Scorch: lågorna slocknar, 0..1).
// Läggs in i ROSTER längst ner i game/enemies.js med samma mönster som blobs.js. Ta bort den raden så är de gamla tillbaka.
import { ramp as R } from './pixel.js';

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), bone: R('#ece4cf'), gold: R('#f2b632'), red: R('#d8433b'),
  wood: R('#9a6b3f'), fire: R('#ff7a1f'), fire2: R('#ffd84a'), ice: R('#bff0ff'), pink: R('#ee8fa8'),
  leaf: R('#58b04a'), snow: R('#eef4fb'), smoke: R('#8d8aa0'), brass: R('#d9a441'), glass: R('#9fe0ff'),
};
const { sin, cos, PI, max, min, floor, ceil } = Math;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
const P = (pose) => ({ a: clamp((pose && pose.attack) || 0), hu: clamp((pose && pose.hurt) || 0) });
const bump = (a) => sin(clamp(a) * PI);                       // 0 → 1 → 0
const blinkAt = (t, seed = 0) => ((t + seed * 1.37) % 3.4) < 0.14;
const step = (t, sp = 2.6, ph = 0) => (sin(t * sp + ph) > 0.3 ? 1 : 0);   // andning i hela pixlar, som hjälten
const rnd = Math.round;
const eOut = (u) => 1 - (1 - clamp(u)) ** 3, eIn = (u) => clamp(u) ** 2;
const eIO = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2; };
const wave = (x) => sin(x + 0.6 * sin(x));                   // mjuk våg som stiger snabbare än den faller
// Attack i tre delar (samma som i game/enemies.js). w: laddar, h: slaget (landar vid a = 0,5), q: dallring efteråt.
const ACT0 = { w: 0, h: 0, s: 0, q: 0 };
function act(a) {
  if (a <= 0) return ACT0;
  const w = a < 0.3 ? eOut(a / 0.3) : a < 0.4 ? 1 : a < 0.5 ? 1 - (a - 0.4) / 0.1 : 0;
  const h = a < 0.4 ? 0 : a < 0.5 ? eIn((a - 0.4) / 0.1) : a < 0.64 ? 1 : 1 - eIO((a - 0.64) / 0.36);
  const q = a > 0.5 ? sin((a - 0.5) * 28) * (1 - a) * 2 * Math.exp(-(a - 0.5) * 5) : 0;
  return { w, h, s: h - 0.6 * w, q };
}
// Träff: 1 i smällen, sedan en liten motrörelse åt andra hållet och tillbaka till 0.
const rec = (hu) => hu * hu * cos((1 - hu) * 5.5);
// Vana som kommer ibland: 0 utanför fönstret, annars 0..1 genom det (period och längd i sekunder).
const habit = (t, per, dur, off = 0) => { const u = (((t + off) % per) + per) % per; return u < dur ? max(0.001, u / dur) : 0; };
// Öga: vit glob med mörk pupill.
function eye(g, x, y, w, h, o = {}) {
  if (o.shut) { g.rect(x, y + floor(h / 2), w, 1, C.dark, 0); return; }
  g.rect(x, y, w, h, o.col ?? C.white, 5);
  const pw = o.pw ?? max(1, ceil(w / 2)), ph = o.ph ?? max(1, ceil(h * 0.6));
  g.rect(x + (o.dx ?? 0), y + (o.dy ?? h - ph), pw, ph, C.dark, 0);
}
const peep = (g, x, y, shut, h = 3) => { if (shut) g.rect(x, y + 1, 2, 1, C.dark, 0); else { g.rect(x, y, 2, h, C.dark, 0); g.dot(x, y, C.white, 5); } };
function wince(g, x, y, lt, col = C.dark) { g.dot(x + (lt ? 1 : 0), y, col, 0); g.dot(x + (lt ? 0 : 1), y + 1, col, 0); g.dot(x + (lt ? 1 : 0), y + 2, col, 0); }
// Snurriga ögon (efter en smäll): ett litet @.
function dizzy(g, x, y, t, col = C.dark) { const s = floor(t * 12) % 4; g.rect(x, y, 3, 3, C.white, 5); g.dot(x + [0, 2, 2, 0][s], y + [0, 0, 2, 2][s], col, 0); g.dot(x + 1, y + 1, col, 0); }
// Smulor som kastas ut i en båge och saktar in. u = 0..1.
function spray(g, x, y, u, n, rp, o = {}) {
  if (u <= 0 || u >= 1) return;
  const d = eOut(u) * (o.dist || 24), sp = o.spread || 6, sz = u < 0.6 ? 2 : 1, dir = o.dir || -1;
  for (let i = 0; i < n; i++) { if (u > 0.75 && i % 2) continue; g.rect(x + dir * (d * (0.55 + 0.45 * ((i * 0.37) % 1)) + i), y + sin(i * 2.3) * sp * (0.3 + eOut(u)) + u * u * (o.fall ?? 5), sz, sz, i % 2 && o.rp2 != null ? o.rp2 : rp, o.lv ?? 5); }
}
// Rökpuff som stiger och växer. u = 0..1.
function puff(g, x, y, u, r = 2.5) { if (u <= 0 || u >= 1) return; const k = 0.6 + u; g.ell(x - u * 2, y - u * 8, r * k, r * k * 0.8, C.smoke, false, null, u < 0.5 ? 4 : 3); g.ell(x + 2 + u, y - 2 - u * 10, r * k * 0.6, r * k * 0.5, C.smoke, false, null, 5); }

// ====================================================================================================
// PLOP: en tjock blå padda med en näckrosblad som hatt (och en liten blomma på brättet).
// Vana: blåser upp strupsäcken till en stor ballong, kväker så att hatten hoppar, och säcken sjunker ihop.
// Attack: kryper ihop, skjuter ut en lång klibbig tunga och rullar in den igen.
// Träff: plattas till en pannkaka, ögonen poppar upp på skaft, hatten far upp och en fluga rymmer ur munnen.
// ====================================================================================================
const TOAD = R('#5b9bd5'), TOADB = R('#f2e2a0'), PAD = R('#4caa52'), SPOT = R('#2f5f9a');
function plop(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 5);
  const cr = a <= 0 && hu <= 0 ? habit(t, 5.2, 1.4, 1.2) : 0, sac = cr ? (cr < 0.55 ? eOut(cr / 0.55) : cr < 0.7 ? 1 : 1 - eIO((cr - 0.7) / 0.3)) : A.w * 0.4;
  const pan = clamp(hu * 1.6), sq = A.w * 1.6 - A.h * 0.8 + pan * 3.2, br = step(t, 2.2);
  const hop = cr > 0.6 && cr < 0.8 ? bump((cr - 0.6) / 0.2) * 3 : 0, hatUp = pan * 9 + hop + A.h * 2, hatA = -0.15 + pan * 1.1 + A.q * 0.2;
  g.push(hu * 2, 0, hr * 0.08, k);
  g.begin();                                             // bakben, kropp, framfötter
  g.ell(9, -4.5 + sq * 0.3, 6 + pan, 4.5 - sq * 0.25, TOAD); g.poly([[5, -1], [15, -1], [17, 0], [4, 0]], TOAD, 2);
  g.ell(1, -8 + sq * 0.6, 11 + sq * 0.5, 7.5 - sq * 0.6 + br * 0.3, TOAD);
  for (const [x, y] of [[4, -12], [9, -9], [6, -6], [12, -6]]) g.ell(x, y + sq * 0.6, 1.4, 1.1, SPOT, false, null, 3);   // prickar
  g.ell(-4, -4.5 + sq * 0.3, 6.5, 3.5 - sq * 0.2, TOADB, false, null, 4);
  g.rect(-9, -1, 5, 1, TOAD, 3); g.dot(-10, -1, TOAD, 5); g.rect(-3, -1, 4, 1, TOAD, 2);
  g.end();
  if (sac > 0.02) { g.begin(); const r = 1.5 + sac * 4.5; g.ell(-8, -4 + sq * 0.3 - r * 0.3, r, r * 0.85, TOADB); g.dot(-9 - r * 0.4, -6 - r * 0.5, C.white, 5); g.end(); }
  g.begin();                                             // ögonkupor och ansikte
  const ey = -14.5 + sq * 0.8 - pan * 4, E = rnd(ey - 2);
  if (pan > 0.3) { g.thick(-5.5, -10 + sq * 0.6, -5.5, ey, 1.6, TOAD, 2); g.thick(2, -10 + sq * 0.6, 2, ey, 1.6, TOAD, 2); }
  g.ell(-5.5, ey, 3.5, 3.4, TOAD); g.ell(2, ey - 0.5, 3.5, 3.4, TOAD);
  if (hu > 0.25) { wince(g, -7, E, false); wince(g, 1, E, true); }
  else { eye(g, -8, E, 4, 4, { shut, pw: 2, ph: 2, dy: cr > 0 ? 0 : 2 }); eye(g, 0, E, 4, 4, { shut, pw: 2, ph: 2, dy: cr > 0 ? 0 : 2 }); }
  const my = rnd(-9 + sq * 0.6);
  if (a > 0.3 || pan > 0.2) g.poly([[-11, my - 1], [-2, my - 1], [-3, my + 2], [-10, my + 2]], C.dark, 0);
  else { g.rect(-11, my, 10, 1, SPOT, 1); g.dot(-1, my - 1, SPOT, 1); g.dot(-11, my - 1, SPOT, 1); }                                   // brett nöjt flin
  g.end();
  g.begin();                                             // näckrosbladet som hatt, med ett hack och en blomma
  g.push(-2, -20 + sq * 0.8 - hatUp - pan * 3, hatA + (pan > 0 ? sin(t * 9) * 0.3 * pan : 0));
  g.ell(0, 0, 8, 2.2, PAD, true, (dx, dy) => !(dx > 0.35 && dy > -0.1 && dy < dx * 0.9));
  g.line(-6, 0, 2, 0, PAD, 5); g.ell(4, -2, 1.6, 1.4, C.pink, false, null, 4); g.dot(4, -3, C.white, 5); g.dot(3, -2, C.fire2, 5);
  g.pop();
  g.end();
  if (A.h > 0.02) { g.begin(); const L = A.h * 30; g.thick(-8, my + 1, -8 - L, my - A.h * 4, 2, C.pink, 3); g.ell(-9 - L, my - A.h * 4, 2.8, 2.6, C.pink); g.dot(-10 - L, my - 1 - A.h * 4, C.white, 5); g.end(); }
  if (pan > 0.15) { g.begin(); const u = 1 - hu, fx = -10 - u * 14 + sin(t * 40) * 1.5, fy = -12 - u * 16; g.rect(rnd(fx), rnd(fy), 2, 1, C.dark, 0); g.dot(rnd(fx) + step(t, 50), rnd(fy) - 1, C.white, 5); g.end({ outline: false, edge: false }); }   // flugan rymmer
  if (cr > 0.6 && cr < 0.95) { g.begin(); const u = (cr - 0.6) / 0.35; g.rect(-16 - u * 4, -16 - u * 6, 1, 4, C.white, 5); g.rect(-17 - u * 4, -13 - u * 6, 2, 2, C.white, 5); g.rect(-16 - u * 4, -16 - u * 6, 3, 1, C.white, 5); g.end({ outline: false, edge: false }); }   // en not
  g.pop();
}

// ====================================================================================================
// GLIMMER: en tjock lysmask med en stor lykta till bakdel, små surrande vingar och lockiga antenner. Lyser upp träsket.
// Vana: lyktan fladdrar och slocknar, den knackar på den med ett ben, och den tänds igen med ett glitter.
// Attack: drar sig bakåt medan lyktan laddas, rusar fram och blixtrar till i en ring.
// Träff: lyktan slocknar med ett pff, antennerna hänger, den snurrar runt med yra ögon.
// ====================================================================================================
const BUG = R('#4a3a78'), LAMP = R('#d6f25a'), WING = R('#cfe8ff');
function glimmer(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 2);
  const fl = a <= 0 && hu <= 0 ? habit(t, 6.4, 1.8, 2) : 0;
  const off = hu > 0.2 || (fl > 0.1 && fl < 0.62 && (fl > 0.35 || step(t, 30))), tap = fl > 0.45 && fl < 0.65 ? bump((fl - 0.45) / 0.2) : 0, glit = fl > 0.62 && fl < 0.9;
  const hov = 14 + wave(t * 2.1) * 2.5 + A.w * 3 - A.h * 2, dx = A.w * 5 - A.h * 12 + A.q * 2, spin = hu > 0.2 ? (1 - hu) * PI * 2 * (hu > 0.5 ? 1 : 0) : 0;
  const L = off ? C.smoke : LAMP, wf = sin(t * (a > 0 ? 40 : 26)) * 2.5;
  g.push(hu * 3 + dx, -rnd(hov), hr * 0.25 + spin, k);
  if (!off) {                                            // ljusskenet runt lyktan
    g.begin(); const r = 11 + sin(t * 4) + A.w * 5;
    for (let i = 0; i < 12; i++) { const an = i * 0.52 + t * 0.6; if ((i + floor(t * 3)) % 3) g.dot(rnd(7 + cos(an) * r), rnd(-6 + sin(an) * r * 0.8), LAMP, 5); }
    g.end({ outline: false, edge: false });
  }
  g.begin();                                             // vingar bakom
  g.ell(1, -16 - wf, 5, 2.4, WING, false, null, 5); g.ell(5, -15 + wf * 0.7, 4.5, 2, WING, false, null, 4);
  g.end();
  g.begin();                                             // lyktan (bakdelen) med ränder, kropp och ben
  g.ell(8, -6, 8 + A.w, 7 + A.w, L, true); if (!off) g.ell(6, -8, 4, 3.5, LAMP, false, null, 5);
  for (const x of [4, 8, 12]) g.line(x, -12 + (x === 8 ? -1 : 0), x - 1, -1, off ? C.smoke : LAMP, 2);
  g.ell(-3, -9, 5.5, 5, BUG);
  for (let i = 0; i < 3; i++) g.line(-5 + i * 3, -5, -6 + i * 3 + (i === 2 ? tap * 4 : 0), -1 - (i === 2 ? tap * 6 : 0) + sin(t * 6 + i) * 0.6, BUG, 2);   // ben som dinglar (det bakre knackar på lyktan)
  g.end();
  g.begin();                                             // huvud, ögon och lockiga antenner
  const hx = -10, hy = -12 + (hu > 0.2 ? 2 : 0), ad = hu > 0.2 ? 5 : 0;
  g.ell(hx, hy, 5, 4.6, BUG);
  g.thick(hx + 1, hy - 4, hx - 2, hy - 10 + ad, 1.2, BUG, 2); g.thick(hx + 3, hy - 4, hx + 4, hy - 10 + ad, 1.2, BUG, 2);
  g.ell(hx - 3, hy - 11 + ad, 1.5, 1.5, off ? C.smoke : LAMP, false, null, 5); g.ell(hx + 5, hy - 11 + ad, 1.5, 1.5, off ? C.smoke : LAMP, false, null, 5);
  if (hu > 0.2) { dizzy(g, hx - 4, hy - 2, t); dizzy(g, hx, hy - 2, t + 0.3); }
  else { eye(g, hx - 4, hy - 2, 3, 3, { shut, pw: 2, ph: 2, dy: tap > 0 ? 0 : 1, dx: tap > 0 ? 1 : 0 }); eye(g, hx, hy - 2, 3, 3, { shut, pw: 2, ph: 2, dy: tap > 0 ? 0 : 1, dx: tap > 0 ? 1 : 0 }); }
  if (a > 0.3) g.rect(hx - 3, hy + 2, 3, 2, C.dark, 0); else { g.dot(hx - 3, hy + 2, C.dark, 0); g.dot(hx - 2, hy + 3, C.dark, 0); g.dot(hx - 1, hy + 2, C.dark, 0); }
  g.dot(hx - 5, hy + 1, C.pink, 4); g.dot(hx + 2, hy + 1, C.pink, 4);
  g.end();
  g.pop();
  if (A.h > 0.05) { g.begin(); const r = 6 + A.h * 14 * (1 + A.q); for (let i = 0; i < 16; i++) { const an = i * 0.393; g.dot(rnd(-14 + dx + cos(an) * r), rnd(-hov - 9 + sin(an) * r), i % 2 ? LAMP : C.white, 5); } g.end({ outline: false, edge: false }); }
  if (glit) { g.begin(); const u = (fl - 0.62) / 0.28; for (let i = 0; i < 5; i++) g.dot(rnd(7 + cos(i * 1.26) * u * 14), rnd(-hov - 6 + sin(i * 1.26) * u * 12), C.white, 5); g.end({ outline: false, edge: false }); }
  if (hu > 0.2) { g.begin(); puff(g, 10, -hov - 12, 1 - hu); g.end({ outline: false, edge: false }); }
}

// ====================================================================================================
// GRUMBLE: ett åskmoln med platt städtopp, korslagda puffiga armar, en blixt till lugg och ett eget litet regn.
// Vana: blåser upp kinderna, fnyser ut en liten molntuss åt sidan och regnet tar paus.
// Attack: stiger och mörknar med armarna uppe, slår ner en blixt framför sig.
// Träff: trycks ihop och gråter ett skyfall med darrande mun.
// ====================================================================================================
const CLOUD = R('#a9b1c8'), STORM = R('#6f7794');
function grumble(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 6);
  const hf = a <= 0 && hu <= 0 ? habit(t, 5.6, 1.2, 0.5) : 0, cheek = hf ? (hf < 0.5 ? eOut(hf / 0.5) : hf < 0.6 ? 1 : 0) : 0, blow = hf >= 0.6 ? (hf - 0.6) / 0.4 : 0;
  const dark = A.w > 0.4 || A.h > 0.2, m = dark ? STORM : CLOUD, sq = clamp(hu * 1.5) * 3, hov = 20 + wave(t * 1.6) * 2 + A.w * 4 - A.h * 2;
  const armUp = A.w * 1 + A.h * 0.6, cry = hu > 0.2;
  g.push(hu * 2, -rnd(hov), hr * 0.12, k);
  g.begin();                                             // regnet under (skyfall vid träff, paus när den fnyser)
  if (!(hf > 0.5)) { const n = cry ? 9 : 4; for (let i = 0; i < n; i++) { const q = (t * (cry ? 2.6 : 1.4) + i * 0.37) % 1; g.rect(-10 + i * (cry ? 2.6 : 5.5), 5 + q * q * (hov - 4), 1, 2, C.glass, 4); } }
  g.end({ outline: false, edge: false });
  if (a > 0.42 && a < 0.82 && (a < 0.62 || step(t, 40))) {      // blixten slår ner framför
    g.begin(); const x0 = -14, d = hov;
    g.poly([[x0 + 2, 2], [x0 + 6, 2], [x0 + 1, d * 0.4], [x0 + 5, d * 0.4], [x0 - 6, d + 1], [x0 - 2, d * 0.55], [x0 - 5, d * 0.55]], C.fire2, 4);
    g.end();
  }
  g.begin();                                             // molnkroppen med städtopp
  g.ell(9, -4 + sq * 0.5, 9, 6 - sq * 0.3, m); g.ell(-9, -4 + sq * 0.5, 8.5, 6 - sq * 0.3, m); g.ell(0, -8 + sq, 11 + sq, 9 - sq * 0.5, m);
  g.ell(1, -17 + sq * 1.4, 16 + sq, 3.4, m); g.ell(-12 + sq, -17.5 + sq * 1.4, 4, 2.6, m); g.ell(14 - sq, -17.5 + sq * 1.4, 4, 2.6, m);
  g.ell(0, 0, 15, 3, m, false, (dx, dy) => dy > 0.1, 2);
  g.end();
  g.begin();                                             // blixten som lugg
  const ly = -19 + sq * 1.4; g.poly([[0, ly], [5, ly - 6], [2, ly - 6], [7, ly - 12], [-1, ly - 4], [2, ly - 4]], C.fire2, 4);
  g.end();
  g.begin();                                             // ansiktet
  const fy = rnd(-14 + sq);
  if (cry || hu > 0.25) { wince(g, -9, fy, false); wince(g, -3, fy, true); }
  else { eye(g, -10, fy, 3, 3, { shut, pw: 2, ph: 2 }); eye(g, -4, fy, 3, 3, { shut, pw: 2, ph: 2 }); }
  g.thick(-11, fy - 2 + (dark ? 0 : 1), -7, fy - 1, 1.4, C.dark, 0); g.thick(-5, fy - 1, -1, fy - 2 + (dark ? 0 : 1), 1.4, C.dark, 0);       // arga ögonbryn
  if (cheek > 0) { g.ell(-13, fy + 4, 1.5 + cheek * 2, 1.5 + cheek * 2, m); g.ell(1, fy + 4, 1.5 + cheek * 2, 1.5 + cheek * 2, m); g.rect(-7, fy + 5, 2, 1, C.dark, 0); }
  else if (cry) { for (let i = 0; i < 5; i++) g.dot(-9 + i, fy + 6 + (i + floor(t * 12)) % 2, C.dark, 0); g.rect(-11, fy + 3, 1, 2 + step(t, 9), C.glass, 5); }
  else if (a > 0.3) g.ell(-6, fy + 6, 2.5, 1.6 + A.h, C.dark, false, null, 0);
  else { g.rect(-9, fy + 6, 5, 1, C.dark, 0); g.dot(-10, fy + 7, C.dark, 0); g.dot(-4, fy + 7, C.dark, 0); g.rect(-8, fy + 7, 3, 1, C.pink, 3); }   // surmulen underläpp
  g.end();
  g.begin();                                             // korslagda armar (lyfts i attacken)
  const ay = -2 + sq * 0.6 - armUp * 10;
  g.ell(-4 - armUp * 4, ay, 6, 2.6, m); g.ell(5 + armUp * 3, ay + 1 - armUp * 2, 6, 2.6, m);
  g.ell(-9 - armUp * 6, ay, 2.4, 2.4, m); g.ell(10 + armUp * 4, ay + 1 - armUp * 2, 2.4, 2.4, m);
  g.end();
  g.pop();
  if (blow > 0) { g.begin(); const u = blow; g.ell(-20 - u * 12, -hov - 8 - u * 2, 2 + u * 2.5, 1.6 + u * 1.6, CLOUD, false, null, u < 0.6 ? 5 : 4); g.end(); }
}

// ====================================================================================================
// ICEFANG: en knubbig sabeltandad snöunge med två långa istappar till huggtänder, tofsöron och en kort svans med tofs.
// Vana: en snöflinga landar på nosen, ögonen går i kors och den nyser så att hela kroppen hoppar.
// Attack: hukar och vickar på baken, slår en kullerbytta framåt i ett hopp och slår med tassen.
// Träff: pälsen puffar ut åt alla håll, tänderna dallrar som stämgafflar.
// ====================================================================================================
const CUB = R('#e3eef8'), STRIPE = R('#93a8c4'), NOSE = R('#ee8fa8');
function icefang(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 4);
  const sn = a <= 0 && hu <= 0 ? habit(t, 6, 2, 3) : 0, cross = sn > 0.35 && sn < 0.7, sneeze = sn >= 0.7 && sn < 0.85 ? bump((sn - 0.7) / 0.15) : 0;
  const wig = a > 0 && a < 0.38 ? sin(a * 70) * 2 * A.w : 0, crouch = A.w * 3, leap = A.h > 0 ? bump(clamp((a - 0.4) / 0.24)) * 7 : 0, dx = -A.h * 12 + A.q * 2;
  const poof = hu > 0.15 ? clamp(hu * 1.4) : 0, br = step(t, 2.2);
  g.push(hu * 2 + dx, -leap - sneeze * 2, hr * 0.12 + sneeze * 0.12 - A.h * 0.15, k);
  g.begin();                                             // svans och bortre ben
  const tw = a > 0 ? -6 * A.w : wave(t * 2) * 2;
  g.thick(15 + wig, -10 + crouch, 20 + wig, -16 + tw, 2.6, CUB, 3); g.ell(21 + wig, -17 + tw, 2.4, 2.4, STRIPE);
  g.thick(-6, -6 + crouch, -7, -1, 3, CUB, 1); g.thick(10 + wig, -6 + crouch, 11, -1, 3, CUB, 1);
  g.end();
  g.begin();                                             // kropp med ränder och närmre ben
  g.ell(5 + wig * 0.5, -10 + crouch + br * 0.3, 10.5 + poof * 2, 7 - crouch * 0.2 + poof * 2, CUB);
  for (const x of [6, 10, 14]) g.line(x + wig * 0.5, -16 + crouch, x - 1 + wig * 0.5, -12 + crouch, STRIPE, 2);
  if (poof) for (let i = 0; i < 10; i++) { const an = i * 0.63 + 0.3, r = 12 + poof * 3; g.poly([[4 + cos(an) * (r - 3), -10 + sin(an) * (r - 4) * 0.6], [4 + cos(an + 0.15) * r, -10 + sin(an + 0.15) * r * 0.6], [4 + cos(an + 0.3) * (r - 3), -10 + sin(an + 0.3) * (r - 4) * 0.6]], CUB, 5); }
  const paw = A.h > 0 ? -A.h * 5 : 0;
  g.thick(-3, -6 + crouch, -4 + paw, -1 + paw * 0.6, 3.2, CUB, 3); g.rect(-7 + paw, -1 + paw * 0.6, 5, 1, CUB, 4);
  g.thick(13 + wig, -6 + crouch, 14, -1, 3.2, CUB, 3); g.rect(12, -1, 5, 1, CUB, 4);
  g.end();
  g.begin();                                             // huvudet: runt med kindtofsar, tofsöron och istapptänder
  const hx = -9, hy = -15 + crouch * 0.7, vib = hu > 0.1 ? sin(t * 70) * hu * 1.5 : 0;
  g.poly([[hx - 7, hy - 3], [hx - 7, hy - 10], [hx - 2, hy - 7]], CUB, 4); g.poly([[hx + 3, hy - 7], [hx + 7, hy - 10], [hx + 7, hy - 3]], CUB, 3);
  g.dot(hx - 7, hy - 12, STRIPE, 3); g.dot(hx + 6, hy - 13, STRIPE, 3);
  g.ell(hx, hy, 8.5 + poof, 7.5 + poof, CUB);
  g.poly([[hx - 8, hy + 1], [hx - 11, hy + 3], [hx - 8, hy + 4]], CUB, 4); g.poly([[hx + 7, hy + 1], [hx + 10, hy + 4], [hx + 7, hy + 5]], CUB, 2);
  g.line(hx - 1, hy - 7, hx, hy - 4, STRIPE, 2); g.line(hx + 2, hy - 7, hx + 2, hy - 4, STRIPE, 2);
  g.ell(hx - 4, hy + 3, 3.5, 2.6, C.white, false, null, 5);
  g.rect(hx - 6, hy + 1, 2, 2, NOSE, 3);
  const ey = rnd(hy - 3);
  if (hu > 0.25) { wince(g, hx - 6, ey, false); wince(g, hx - 1, ey, true); }
  else if (cross) { eye(g, hx - 7, ey, 3, 3, { pw: 1, ph: 2, dx: 2, dy: 1 }); eye(g, hx - 2, ey, 3, 3, { pw: 1, ph: 2, dx: 0, dy: 1 }); }
  else if (sneeze > 0.2) { g.rect(hx - 7, ey + 1, 3, 1, C.dark, 0); g.rect(hx - 2, ey + 1, 3, 1, C.dark, 0); }
  else { eye(g, hx - 7, ey, 3, 3, { shut, pw: 2, ph: 2 }); eye(g, hx - 2, ey, 3, 3, { shut, pw: 2, ph: 2 }); }
  const fl = a > 0.35 ? 1 : 0;
  g.poly([[hx - 7 + vib, hy + 3], [hx - 4 + vib, hy + 3], [hx - 5.8 - vib, hy + 12 + fl]], C.ice, 5); g.poly([[hx - 2 - vib, hy + 3], [hx + 1 - vib, hy + 3], [hx - 0.8 + vib, hy + 12 + fl]], C.ice, 4);
  g.dot(hx - 6, hy + 4, C.white, 5); g.dot(hx - 1, hy + 4, C.white, 5);
  if (a > 0.35 || sneeze > 0.2) g.rect(hx - 4, hy + 4, 2, 2, C.dark, 0);
  g.end();
  g.pop();
  if (sn > 0.05 && sn < 0.4) { g.begin(); const u = sn / 0.4, fx = rnd(-16 + u * 2 + sin(u * 9) * 2), fy = rnd(-34 + u * 15); g.dot(fx, fy, C.white, 5); g.dot(fx - 1, fy, C.ice, 5); g.dot(fx + 1, fy, C.ice, 5); g.dot(fx, fy - 1, C.ice, 5); g.dot(fx, fy + 1, C.ice, 5); g.end({ outline: false, edge: false }); }
  if (sneeze > 0) { g.begin(); spray(g, -20, -13, sn > 0.7 ? (sn - 0.7) / 0.3 : 0, 6, C.snow, { dist: 12, spread: 4, fall: 2, rp2: C.white }); g.end({ outline: false, edge: false }); }
  if (A.h > 0.3 && a < 0.62) { g.begin(); for (let i = 0; i < 3; i++) g.thick(-26 + i * 3, -16 + i * 3, -21 + i * 3, -6 + i * 3, 1, C.white, 5); g.end({ outline: false, edge: false }); }   // tasslag
}

// ====================================================================================================
// SCORCH: en lång eldsalamander som kryper lågt, med en kam av lågor längs ryggen och en ringlad svans med låga i spetsen.
// Vana: slickar sitt eget öga med en lång tunga, som en gecko.
// Attack: reser huvudet bakåt medan magen glöder, sprutar sedan en eldstråle framåt.
// Träff: lågorna krymper till rök, den magplaskar platt och hostar en rökring.
// pose.out (0..1, bara i minibossens nederlag): lågorna slocknar helt och färgen grånar.
// ====================================================================================================
const SALA = R('#8a3b3f'), SALAB = R('#f08a2a'), ASH = R('#7d7480');
function scorch(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 1);
  const out = clamp((pose && pose.out) || 0), m = out > 0.6 ? ASH : SALA, flame = clamp(1 - out - hu * 0.8) * (1 + A.w * 0.4);
  const lick = a <= 0 && hu <= 0 && !out ? habit(t, 5.8, 1.1, 2.4) : 0, flat = clamp(hu * 1.4) * 2.5, rear = A.w * 5 - A.h * 2;
  const crawl = wave(t * 2.4) * 0.6, fl = (i) => sin(t * 11 + i * 2.3) * 1.5;
  g.push(hu * 2, 0, hr * 0.06, k);
  g.begin();                                             // svans som ringlar upp, med låga i spetsen
  const tw = wave(t * 1.7) * 2 + A.q * 3;
  for (let i = 0; i <= 8; i++) { const u = i / 8; g.ell(13 + u * 16, -6 - u * u * 12 + flat * (1 - u) + tw * u, 4.2 - u * 2.6, 3.6 - u * 2.2, m); }
  g.thick(-8, -5 + flat, -12, -1, 2.6, m, 1); g.thick(9, -5 + flat, 12, -1, 2.6, m, 1);       // bortre ben
  g.end();
  if (flame > 0.05) { g.begin(); const tx = 29, ty = -18 + tw; g.poly([[tx - 2, ty], [tx + 1 + fl(1), ty - 6 * flame], [tx + 3, ty - 1], [tx + 5 + fl(2), ty - 4 * flame], [tx + 3, ty + 2]], C.fire, 4); g.dot(tx + 1, ty - 1, C.fire2, 5); g.end(); }
  g.begin();                                             // rygg-kam av lågor
  if (flame > 0.05) for (let i = 0; i < 5; i++) { const x = -10 + i * 5, hh = (5 + (i % 2) * 2) * flame + fl(i); g.poly([[x - 2, -9 + flat], [x + 0.5, -10 - hh + flat], [x + 3, -9 + flat]], i % 2 ? C.fire2 : C.fire, 4); }
  g.end();
  g.begin();                                             // kroppen, prickar och närmre ben
  g.ell(1, -7 + flat * 0.6 + crawl * 0.3, 15, 5 - flat * 0.3, m); g.ell(-1, -4 + flat * 0.4, 12, 2.2, out > 0.6 ? ASH : SALAB, false, null, 4);
  for (const [x, y] of [[-6, -9], [1, -10], [7, -8], [12, -9]]) if (!out) g.ell(x, y + flat * 0.6, 1.5, 1, C.fire2, false, null, 5);
  g.thick(-7, -4 + flat, -11 - crawl, -1, 2.8, m, 3); g.rect(-14 - crawl, -1, 4, 1, m, 4); g.dot(-14 - crawl, -2, m, 4);
  g.thick(10, -4 + flat, 13 + crawl, -1, 2.8, m, 3); g.rect(12 + crawl, -1, 4, 1, m, 4); g.dot(16 + crawl, -2, m, 4);
  g.end();
  g.begin();                                             // huvudet: platt och brett med stora ögon på kullar och ett stort flin
  const hx = -18 + rear * 0.4 - A.h * 3, hy = -9 + flat * 0.7 - rear;
  g.push(hx, hy, A.w * 0.35 - A.h * 0.2 + hr * 0.2);
  g.ell(0, 0, 8, 4.6 + A.w, m); g.ell(-2, 2, 6, 2, out > 0.6 ? ASH : SALAB, false, null, 4);
  g.ell(-1, -4, 2.6, 2.4, m); g.ell(4, -4, 2.6, 2.4, m);
  const ey = -6;
  if (hu > 0.25) { wince(g, -2, ey, false); wince(g, 3, ey, true); }
  else { eye(g, -3, ey, 3, 3, { shut: shut || (lick > 0.4 && lick < 0.7), pw: 2, ph: 2, dx: 0, dy: 1 }); eye(g, 3, ey, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1 }); }
  if (a > 0.3 || lick > 0) g.poly([[-8, 1], [-1, 1], [-2, 3], [-7, 3]], C.dark, 0);
  else { g.rect(-8, 1, 8, 1, C.dark, 0); g.dot(0, 0, C.dark, 0); g.dot(-4, 2, C.white, 5); }
  g.dot(-6, -1, C.dark, 1); g.dot(-4, -1, C.dark, 1);
  if (lick > 0) { const u = bump(lick), tx = -6 + u * 3, ty = 2 - u * 9; g.thick(-5, 2, tx, ty, 1.4, C.pink, 3); g.ell(tx, ty, 1.3, 1.3, C.pink); }   // slickar ögat
  g.pop();
  g.end();
  if (a > 0.45 && a < 0.85 && flame > 0.05) {          // eldstrålen
    g.begin(); const u = eOut((a - 0.45) / 0.3) * (a < 0.75 ? 1 : 1 - (a - 0.75) / 0.1), fx = hx - 8, fy = hy + 1, L = 8 + u * 26;
    g.poly([[fx, fy - 2], [fx - L * 0.5, fy - 5 - u * 2], [fx - L, fy - 2 + fl(3)], [fx - L * 0.8, fy + 1], [fx - L, fy + 4 + fl(4)], [fx - L * 0.5, fy + 5], [fx, fy + 2]], C.fire, 4);
    g.poly([[fx, fy - 1], [fx - L * 0.6, fy - 2], [fx - L * 0.7, fy + 1], [fx - L * 0.5, fy + 2], [fx, fy + 1]], C.fire2, 5);
    g.end();
  }
  if (hu > 0.15 || out > 0.2) { g.begin(); puff(g, -2, -14, ((t * 0.9) % 1)); if (hu > 0.3) puff(g, hx - 6, hy - 2, 1 - hu, 1.6); g.end({ outline: false, edge: false }); }
  g.pop();
}

// ====================================================================================================
// EMBER BAT: små fladdermöss med jättestora öron som var och en bär en tänd tändsticka som en fackla.
// Vana: lågan fräser ner till nästan ingenting, fladdermusen blåser på den med runda kinder och den flammar upp igen.
// Attack: drar tändstickan bakåt, dyker framåt och petar med lågan i ett regn av gnistor.
// Träff: tändstickan slocknar med en rökslinga, öronen viker sig och den snurrar ett varv.
// ====================================================================================================
const BAT = R('#5a3048'), EAR = R('#f2a0b0'), MATCH = R('#e8c48a');
function emberbat(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 3);
  const sp = a <= 0 && hu <= 0 ? habit(t, 4.6, 1.4, 1) : 0, low = sp > 0 && sp < 0.6, blow = sp > 0.35 && sp < 0.7;
  const fz = hu > 0.2 ? 0 : low ? 0.3 + step(t, 30) * 0.2 : sp >= 0.6 && sp < 0.8 ? 1.5 : 1;
  const hov = 13 + wave(t * 3.2) * 2 + A.w * 3 - A.h * 4, dx = A.w * 4 - A.h * 9, wf = sin(t * (a > 0 ? 34 : 22)) * 3.5, spin = hu > 0.4 ? (1 - hu) * PI * 2 : 0;
  g.push(hu * 2 + dx, -rnd(hov), hr * 0.3 + spin + A.h * 0.25, k);
  g.begin();                                             // vingar med flikig kant
  for (const s of [-1, 1]) { const y = -2 + wf * (s < 0 ? 1 : 0.8); g.poly([[s * 3, -3], [s * 9, y - 4], [s * 13, y - 1], [s * 11, y + 1], [s * 9, y], [s * 7, y + 2], [s * 4, 1]], BAT, s < 0 ? 3 : 2); g.line(s * 3, -3, s * 12, y - 2, BAT, 4); }
  g.end();
  g.begin();                                             // kropp, jätteöron och ansikte
  const ef = hu > 0.2 ? 4 : 0;
  g.poly([[-4, -5], [-7 - ef * 0.5, -13 + ef], [-1, -7]], BAT, 4); g.poly([[1, -7], [4 + ef * 0.5, -14 + ef], [5, -5]], BAT, 3);
  g.poly([[-4, -6], [-6 - ef * 0.5, -11 + ef], [-2, -7]], EAR, 4); g.poly([[2, -7], [4 + ef * 0.5, -12 + ef], [4, -6]], EAR, 3);
  g.ell(0, -1, 5.5, 5.2, BAT);
  if (hu > 0.25) { wince(g, -4, -3, false); wince(g, 0, -3, true); }
  else { eye(g, -4, -3, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: blow ? 0 : 1 }); eye(g, 0, -3, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: blow ? 0 : 1 }); }
  if (blow) g.ell(-5, 1.5, 2, 1.6, BAT, false, null, 4); else { g.dot(-3, 2, C.white, 5); g.dot(-2, 1, C.dark, 0); }
  g.dot(-5, 1, C.pink, 3); g.dot(2, 1, C.pink, 3);
  g.thick(-1, 3, -2, 6, 1.2, BAT, 2); g.thick(2, 3, 2, 6, 1.2, BAT, 2);
  g.end();
  g.begin();                                             // tändstickan i fötterna, framåt riktad
  const ang = -0.35 - A.w * 0.9 + A.h * 0.7, tx = 1 - cos(ang) * 10, ty = 7 - sin(ang) * 10;
  g.thick(1, 7, tx, ty, 1.4, MATCH, 4); g.ell(tx, ty, 1.4, 1.4, hu > 0.2 ? C.smoke : C.red);
  g.end();
  if (fz > 0) { g.begin(); const fy = ty - 1, h = 6 * fz + sin(t * 18) * 0.8; g.poly([[tx - 2.5, fy + 1], [tx - 1, fy - h], [tx + 0.5, fy - h * 0.55], [tx + 2.5, fy + 1]], C.fire, 4); g.dot(rnd(tx - 0.5), rnd(fy - 1), C.fire2, 5); g.end(); }
  if (blow) { g.begin(); g.dot(-8, 1, C.white, 5); g.dot(-10, 0, C.white, 4); g.end({ outline: false, edge: false }); }
  if (hu > 0.2) { g.begin(); puff(g, tx, ty - 2, 1 - hu, 1.4); g.end({ outline: false, edge: false }); }
  g.pop();
  if (A.h > 0.2 && a < 0.7) { g.begin(); spray(g, -10 + dx, -hov + 2, (a - 0.45) / 0.25, 5, C.fire2, { dist: 10, spread: 4, fall: 4, rp2: C.fire }); g.end({ outline: false, edge: false }); }
}

// ====================================================================================================
// SNAP: en blå träskkräfta med EN jättestor klo och en pytteliten, ögon på skaft, långa antenner och en svans som fläkt.
// Vana: klickar två gånger med den stora klon och putsar den sedan noga med den lilla.
// Attack: höjer den stora klon högt bakåt och klipper till framför sig med ett SNAP (stjärna och streck).
// Träff: den stora klon är för tung och dunsar i marken, ögonen dras in på sina skaft.
// ====================================================================================================
const CRAY = R('#4e7fa0'), JOINT = R('#f08a2a');
function snap(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 6);
  const cl = a <= 0 && hu <= 0 ? habit(t, 5, 2, 0.7) : 0, clack = cl > 0 && cl < 0.4 ? (floor(cl * 20) % 4 < 2 ? 1 : 0) : 0, polish = cl >= 0.45 && cl < 0.95;
  const flop = clamp(hu * 1.5), stalk = 5 - flop * 4, br = step(t, 2.4);
  g.push(hu * 2, 0, hr * 0.08 - flop * 0.08, k);
  g.begin();                                             // svans i segment med fläkt, ben och antenner
  for (let i = 0; i < 4; i++) g.ell(11 + i * 4.5, -6 + i * 0.6, 4 - i * 0.5, 3.4 - i * 0.4, CRAY);
  g.poly([[25, -6], [30, -10 + sin(t * 3)], [31, -5], [30, 0 - sin(t * 3)], [25, -4]], CRAY, 4);
  for (let i = 0; i < 3; i++) g.thick(-2 + i * 4, -5, -4 + i * 4 + sin(t * 9 + i) * 0.5 * (a > 0 ? 3 : 1), -1, 1.2, CRAY, 2), g.dot(-5 + i * 4, -1, CRAY, 2);
  const aw = wave(t * 1.3) * 2;
  g.line(-8, -12, 6, -22 + aw, CRAY, 3); g.line(6, -22 + aw, 20, -18 + aw, CRAY, 4); g.line(-7, -11, 10, -19 - aw, CRAY, 2); g.line(10, -19 - aw, 24, -14 - aw, CRAY, 3);
  g.end();
  g.begin();                                             // kroppen, ögonskaft och den lilla klon
  g.ell(1, -9 + br * 0.3, 10, 6, CRAY); for (const x of [-2, 3, 8]) g.line(x, -14, x - 1, -10, CRAY, 2);
  g.thick(-5, -12, -6, -12 - stalk, 1.4, CRAY, 2); g.thick(-1, -13, -1, -13 - stalk, 1.4, CRAY, 2);
  if (hu > 0.25) { wince(g, -8, -15 - stalk, false); wince(g, -2, -15 - stalk, true); }
  else { eye(g, -8, rnd(-14 - stalk), 3, 3, { shut, pw: 2, ph: 2, dx: polish ? 1 : 0, dy: polish ? 1 : 0 }); eye(g, -2, rnd(-14 - stalk), 3, 3, { shut, pw: 2, ph: 2, dx: polish ? 1 : 0, dy: polish ? 1 : 0 }); }
  g.rect(-9, -6, 4, 1, C.dark, 0); if (a > 0.3) g.rect(-9, -5, 3, 1, C.pink, 3);
  const px = polish ? -10 + sin(t * 30) * 2 : -9, py = polish ? -15 : -4;
  g.thick(-5, -4, px + 2, py, 1.6, CRAY, 3); g.ell(px, py, 1.6, 1.3, JOINT, true);
  g.end();
  g.begin();                                             // den stora klon på en böjd arm
  const ang = flop ? -0.5 - flop * 0.4 : 0.3 + A.w * 0.9 - A.h * 0.9 + A.q * 0.3 + (polish ? 0.2 : 0), ex = -5 + cos(PI + ang) * 7, ey = -10 + sin(PI + ang) * 7 + flop * 5;
  g.thick(-2, -9, ex, ey, 2.6, CRAY, 3); g.ell(ex, ey, 1.8, 1.8, JOINT, false, null, 4);
  g.push(ex, ey, ang);
  const op = a > 0 ? (a < 0.42 ? 3.5 * A.w : a < 0.52 ? 0 : 1) : clack ? 0 : polish ? 1 : 2;
  g.ell(-6, 0, 7.5, 5, CRAY); g.ell(-7, 2, 4.5, 1.8, JOINT, false, null, 4);
  g.poly([[-12, -4], [-21, -5 - op], [-19, -1 - op * 0.5], [-12, 0]], CRAY, 4);
  g.poly([[-12, 1], [-20, 3 + op * 0.6], [-18, 5 + op * 0.6], [-11, 4]], CRAY, 2);
  for (const x of [-18, -15]) g.dot(x, -2 - op * 0.6, C.bone, 4);
  g.pop();
  g.end();
  if ((a > 0.48 && a < 0.7) || (clack && floor(cl * 20) % 4 === 0)) {     // SNAP: en stjärna där klon slår ihop
    g.begin(); const big = a > 0, sx = rnd(ex - 22 * cos(ang)), sy = rnd(ey - 22 * sin(ang)), r = big ? 5 : 2.5;
    for (let i = 0; i < 8; i++) { const an = i * PI / 4, L = i % 2 ? r * 0.5 : r; g.line(sx, sy, rnd(sx + cos(an) * L), rnd(sy + sin(an) * L), i % 2 ? C.white : C.fire2, 5); }
    g.end({ outline: false, edge: false });
  }
  if (polish && step(t, 9)) { g.begin(); g.dot(rnd(ex - 9), rnd(ey - 5), C.white, 5); g.end({ outline: false, edge: false }); }
  g.pop();
}

// ====================================================================================================
// PEEPER: en liten uggla med tofsar som flyger runt med en kikare i mässing och skriver ner allt i luften.
// Vana: drar ut kikaren i tre led, spanar så att linsen blänker och skjuter ihop den igen.
// Attack: lyfter kikaren som en klubba bakåt och bonkar till framåt i en dykning.
// Träff: huvudet snurrar ett halvt varv (baksidan syns, bara fjädrar), fjädrar yr och kikaren skjuts ihop.
// ====================================================================================================
const OWL = R('#a3825c'), BELLY = R('#f2e2c0'), DISC = R('#e8d6b0');
function peeper(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, shut = blinkAt(t, 7);
  const sc = a <= 0 && hu <= 0 ? habit(t, 5.4, 2.2, 1.8) : 0, ext = sc ? (sc < 0.25 ? eOut(sc / 0.25) : sc < 0.8 ? 1 : 1 - eIO((sc - 0.8) / 0.2)) : 0;
  const glint = sc > 0.35 && sc < 0.75 && floor(t * 6) % 3 === 0, back = hu > 0.35 && hu < 0.85;
  const hov = 16 + wave(t * 2.6) * 2.5 + A.w * 4 - A.h * 5, dx = A.w * 3 - A.h * 10, wf = sin(t * 18) * 3;
  g.push(hu * 2 + dx, -rnd(hov), hr * 0.2 - A.w * 0.15 + A.h * 0.2, k);
  g.begin();                                             // vingar och fötter
  g.poly([[4, -6], [12, -10 - wf], [14, -4 - wf * 0.6], [11, 0], [5, 0]], OWL, 2);
  g.poly([[-4, -6], [-10, -11 + wf * 0.8], [-12, -5 + wf * 0.5], [-9, 0], [-3, 0]], OWL, 3);
  g.line(-3, 6, -3, 8, C.gold, 3); g.line(1, 6, 1, 8, C.gold, 3); g.dot(-4, 8, C.gold, 3); g.dot(0, 8, C.gold, 3);
  g.end();
  g.begin();                                             // kropp och huvud med ansiktsskiva och tofsar
  g.ell(0, 0, 7, 7.5, OWL); g.ell(-1, 2, 4.5, 5, BELLY, false, null, 4);
  for (const [x, y] of [[-3, 0], [0, 2], [-2, 4], [1, 5]]) g.dot(x, y, OWL, 2);
  g.poly([[-7, -12], [-9, -19], [-4, -14]], OWL, 4); g.poly([[3, -14], [6, -19], [6, -12]], OWL, 3);
  g.ell(-1, -10, 7.5, 6, OWL);
  if (back) { for (const [x, y] of [[-4, -12], [0, -9], [-3, -7], [2, -12]]) g.line(x, y, x + 2, y + 1, OWL, 2); }   // bakhuvudet: bara fjädrar
  else {
    g.ell(-4.5, -10, 3.4, 3.4, DISC, false, null, 4); g.ell(1.5, -10, 3.4, 3.4, DISC, false, null, 4);
    if (hu > 0.2) { wince(g, -6, -11, false); wince(g, 1, -11, true); }
    else { eye(g, -6, -11, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1, col: C.fire2 }); if (!ext) eye(g, 0, -11, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1, col: C.fire2 }); }
    g.poly([[-2.5, -8], [-0.5, -8], [-1.5, -5]], C.gold, 4);
  }
  g.end();
  g.begin();                                             // kikaren i mässing: i handen, eller utdragen för ögat
  if (back) {} else if (ext > 0 || a <= 0) {
    const ex2 = ext * 7, x0 = ext > 0 ? 1 : 6, y0 = ext > 0 ? -9.5 : -1;
    if (ext > 0) { g.rect(x0 - 4 - ex2, y0 - 1.5, 4 + ex2 * 0.3, 3, C.brass, 4); g.rect(x0 - 2 - ex2 * 0.6, y0 - 2, 3, 4, C.brass, 3); g.rect(x0 - 5 - ex2, y0 - 2, 2, 4, C.brass, 2); if (glint) g.dot(x0 - 5 - ex2, y0 - 1, C.white, 5); else g.dot(x0 - 5 - ex2, y0, C.glass, 5); }
    else { g.thick(4, -2, 9, 3, 2.6, C.brass, 3); g.dot(9, 3, C.glass, 5); }
  } else {
    const ang = -1.4 - A.w * 0.9 + A.h * 2.6, cx = 3, cy = -3;
    g.push(cx, cy, ang); g.rect(0, -1.5, 11, 3, C.brass, 3); g.rect(8, -2, 3, 4, C.brass, 4); g.pop();
  }
  g.end();
  g.pop();
  if (A.h > 0.3 && a < 0.62) { g.begin(); const sx = -12 + dx, sy = -hov - 4; for (let i = 0; i < 6; i++) { const an = i * 1.05; g.line(sx, sy, rnd(sx + cos(an) * 4), rnd(sy + sin(an) * 4), C.white, 5); } g.end({ outline: false, edge: false }); }
  if (hu > 0.2) { g.begin(); for (let i = 0; i < 3; i++) { const u = 1 - hu, x = rnd(-4 + i * 5 + sin(t * 4 + i) * 3 + u * (i - 1) * 8), y = rnd(-hov - 6 + u * 18 + i * 2); g.line(x, y, x + 2, y + 1, OWL, 4); } g.end({ outline: false, edge: false }); }
}

// ====================================================================================================
// ROSTER_FACELIFT: samma fält som ROSTER i game/enemies.js. Läggs in i ROSTER längst ner i enemies.js:
//   for (const b of ROSTER_FACELIFT) { const old = ROSTER.find((e) => e.id === b.id); if (old) Object.assign(old, { draw: b.draw, h: b.h, w: b.w }); }
// Namnen, världarna, typerna och antalen är desamma som förut (testas i game/balance.test.mjs).
// ====================================================================================================
const E = (id, name, world, tier, h, w, draw, extra = {}) => ({ id, name, world, tier, h, w, count: 1, fly: false, draw, ...extra });

export const ROSTER_FACELIFT = [
  E('plask', 'Plop', 2, 1, 24, 30, (g, t, p) => plop(g, t, p, {})),
  E('klo', 'Snap', 2, 2, 30, 60, (g, t, p) => snap(g, t, p, {})),
  E('irrbloss', 'Glimmer', 2, 3, 44, 42, (g, t, p) => glimmer(g, t, p, { k: 1.25 }), { fly: true }),
  E('istand', 'Icefang', 3, 2, 33, 46, (g, t, p) => icefang(g, t, p, { k: 1.15 })),
  E('glodfladdror', 'Ember Bat', 4, 1, 28, 28, (g, t, p) => emberbat(g, t, p, {}), { count: 4, fly: true }),
  E('glodhund', 'Scorch', 4, 3, 32, 80, (g, t, p) => scorch(g, t, p, { k: 1.3 })),
  E('surmoln', 'Grumble', 5, 1, 46, 48, (g, t, p) => grumble(g, t, p, {}), { fly: true }),
  E('kikaroga', 'Peeper', 5, 2, 38, 30, (g, t, p) => peeper(g, t, p, { k: 1.1 }), { fly: true }),
];
// Ritfunktionerna, för minibossfilmerna (Scorch) och granskningssidan.
export const DRAW_FACELIFT = { plop, snap, glimmer, icefang, emberbat, scorch, grumble, peeper };
