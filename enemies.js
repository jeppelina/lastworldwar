// Fiender och bossar. Varje grundform är EN ritfunktion med varianter (form och tillbehör, inte bara färg).
// draw(g, t, pose): motorn har redan gjort g.push(x, y) så att (0, 0) är marken mitt under varelsen.
// Varelsen tittar åt VÄNSTER, uppåt är negativt y. pose = { attack: 0..1, hurt: 0..1 }.
import { ramp as R } from './pixel.js';
import { ROSTER_NEW } from './enemies-new.js';
import { ROSTER_BOSSES } from './bosses.js';
import { ROSTER_BLOBS } from './blobs.js';

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


// ---------- Rörelsehjälp för de vanliga fienderna ----------
const rnd = Math.round;
const eOut = (u) => 1 - (1 - clamp(u)) ** 3, eIn = (u) => clamp(u) ** 2;
const eIO = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2; };
// Mjuk våg som stiger snabbare än den faller (andning, svep): inte en ren sinus.
const wave = (x) => sin(x + 0.6 * sin(x));
// Attack i tre delar. w: laddar (mjukt bakåt, hålls kvar), h: slaget (två bildrutor, landar vid a = 0,5 och hålls kort),
// q: dallring efter träffen som klingar av. s = h - 0,6 w har samma spann som den gamla attackkurvan.
const ACT0 = { w: 0, h: 0, s: 0, q: 0 };
function act(a) {
  if (a <= 0) return ACT0;
  const w = a < 0.3 ? eOut(a / 0.3) : a < 0.4 ? 1 : a < 0.5 ? 1 - (a - 0.4) / 0.1 : 0;
  const h = a < 0.4 ? 0 : a < 0.5 ? eIn((a - 0.4) / 0.1) : a < 0.64 ? 1 : 1 - eIO((a - 0.64) / 0.36);
  const q = a > 0.5 ? sin((a - 0.5) * 28) * (1 - a) * 2 * Math.exp(-(a - 0.5) * 5) : 0;
  return { w, h, s: h - 0.6 * w, q };
}
// Träff: 1 i smällen (tryck ihop, luta bakåt), sedan en liten motrörelse åt andra hållet och tillbaka till 0.
const rec = (hu) => hu * hu * cos((1 - hu) * 5.5);
// Något som händer då och då: 0 för det mesta, 0 → 1 → 0 under dur sekunder en gång per period.
const ev = (t, period, dur, off = 0) => { const x = (((t + off) % period) + period) % period; return x < dur ? sin((x / dur) * PI) : 0; };
// Ihopknipna ögon vid träff: > och <.
function wince(g, x, y, lt, col = C.dark) { g.dot(x + (lt ? 1 : 0), y, col, 0); g.dot(x + (lt ? 0 : 1), y + 1, col, 0); g.dot(x + (lt ? 1 : 0), y + 2, col, 0); }
// Gnistor, sporer och smulor som kastas ut i en båge och saktar in. u = 0..1.
function spray(g, x, y, u, n, rp, o = {}) {
  if (u <= 0 || u >= 1) return;
  const d = eOut(u) * (o.dist || 24), sp = o.spread || 6, sz = u < 0.6 ? 2 : 1;
  for (let i = 0; i < n; i++) { if (u > 0.75 && i % 2) continue; g.rect(x - d * (0.55 + 0.45 * ((i * 0.37) % 1)) - i, y + sin(i * 2.3) * sp * (0.3 + eOut(u)) + u * u * (o.fall ?? 5), sz, sz, i % 2 && o.rp2 != null ? o.rp2 : rp, o.lv ?? 5); }
}

// ====================================================================================================
// GRUNDFORMER
// ====================================================================================================

// ---------- Slem: leaf (grodd med två blad som följer med), ice (huttrande iskub med skallrande tänder), lava (stenskorpa, låga, sur min), swamp (sömniga ögon på skaft, kaveldun) ----------
const CRUST = R('#5a3a44');
function slime(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), k = o.k || 1, kind = o.kind;
  // Vila: står och andas, och tar då och då ett litet skutt på stället (huka, sträck, landa, dallra).
  const x = (t * 0.5 + k * 0.7) % 1;
  const hop = x < 0.6 ? wave(t * 2.4) * 0.3 : x < 0.68 ? -eOut((x - 0.6) / 0.08) : x < 0.78 ? -1 + 2.4 * eOut((x - 0.68) / 0.1) : x < 0.86 ? 1.4 - 2.2 * eIn((x - 0.78) / 0.08) : -0.8 * (1 - eOut((x - 0.86) / 0.14));
  const s = (a > 0 ? -1.5 * A.w + 2.4 * A.h + A.q * 1.4 : hop) - hr * 2.4;
  const shut = blinkAt(t, k), ow = hu > 0.25;
  if (kind === 'ice') {                                  // stel kub: vickar på hörnet i stället för att dallra
    const T = -13, cold = a <= 0 && ev(t, 2.6, 0.8) > 0.1, sh = cold ? (sin(t * 70) > 0 ? 1 : -1) : 0;
    const tilt = A.w * 0.22 - A.h * 0.42 - A.q * 0.12 + hr * 0.22, px = tilt > 0 ? 10 : -10, lift = a > 0 ? 0 : rnd(max(0, hop) * 1.6);
    g.push(hu * 2 + sh * 0.6 + px * k, -lift, tilt, k); g.push(-px, 0);
    g.begin();
    for (const [ix, hh] of [[-7, 5], [-2, 8], [4, 4], [7, 6]]) g.poly([[ix - 2, T + 3], [ix + 0.5, T - hh], [ix + 3, T + 3]], C.ice, 5);
    g.poly([[-10, 0], [-11, T + 5], [-7, T + 1], [7, T + 1], [11, T + 5], [10, 0]], m, 3);
    g.poly([[-9, T + 5], [-6, T + 2], [4, T + 2], [1, T + 5]], m, 5);
    g.rect(-9, T + 6, 1, 8, m, 5); g.rect(-8, -2, 17, 2, m, 2);
    g.line(4, -9, 7, -6, C.white, 5); g.dot(7, -9, C.white, 5); g.dot(5, -4, m, 5);                                                   // glans i isen
    if (hu > 0.05) { g.line(5, T + 2, 7, T + 5, m, 1); g.line(7, T + 5, 5, T + 8, m, 1); }                                            // spricka
    if (ow) { wince(g, -8, T + 5, false); wince(g, -3, T + 5, true); }
    else { eye(g, -8, T + 5, 3, 3, { shut, pw: 1, ph: 1, dx: 1, dy: 1 }); eye(g, -3, T + 5, 3, 3, { shut, pw: 1, ph: 1, dx: 1, dy: 1 }); }
    g.line(-8, T + 4, -6, T + 3, m, 1); g.line(-3, T + 3, -1, T + 4, m, 1);                                                          // oroliga ögonbryn
    if (a > 0.05) g.rect(-7, T + 9, 6, 2 + rnd(A.h * 2), C.dark, 0);
    else { const ch = cold && sin(t * 50) > 0 ? 1 : 0; g.rect(-7, T + 9, 6, 2, C.white, 5); for (const tx of [-6, -4, -2]) g.dot(tx + ch, T + 9, C.dark, 0); g.rect(-7, T + 10, 6, 1, C.dark, 0); }   // tänderna skallrar
    g.end();
    g.pop(); g.pop();
    if (a > 0.45) { g.begin(); spray(g, -12 * k, -7 * k, (a - 0.45) / 0.55, 6, C.ice, { rp2: C.white, dist: 26, spread: 4, fall: 2 }); g.end(); }
    return;
  }
  const rx = 10 - s * 0.7, ry = 7.5 + s * 1.3, top = -ry * 1.7, ey = rnd(-ry * 0.95), fx = rnd(-A.h * 2), st = [];
  g.push(hu * 2, 0, 0, k);
  g.begin();
  if (kind === 'leaf') {
    const la = wave(t * 2.4 - 0.9) * 0.12 - s * 0.17;    // bladen kommer efter: fälls ut när kroppen plattas till, reser sig när den sträcks
    g.thick(fx + 1, top + 3, fx + 1.5, top - 3, 1.6, C.leaf, 2);
    g.push(fx + 1.5, top - 3, la); g.poly([[0, 0], [4, -5], [8, -4], [8, -1], [3, 1]], C.leaf, 4); g.line(1, -1, 6, -3, C.leaf, 2); g.pop();
    g.push(fx + 1.5, top - 3, -la * 1.3); g.poly([[0, 0], [-3, -4], [-7, -3], [-6, 0], [-2, 1]], C.leaf, 3); g.pop();
  }
  if (kind === 'lava') {
    if (hu > 0.05) for (let i = 0; i < 3; i++) g.rect(fx - 3 + i * 3, top - 1 - (1 - hu) * 9 - (i % 2) * 2, 2, 2, C.smoke, 4);      // lågan slocknar i en rökpuff
    else { const f = sin(t * 9) * 1.5, F = 1 + A.h * 1.2 - A.w * 0.5, y0 = top + 3; g.poly([[fx - 5, y0], [fx - 4, y0 - (6 + f) * F], [fx - 1, y0 - 3 * F], [fx + 1, y0 - (10 - f) * F], [fx + 4, y0 - 4 * F], [fx + 6, y0 - (7 + f) * F], [fx + 6, y0]], C.fire2, 4); }
  }
  if (kind === 'swamp') {
    [[-6, -2], [1, 1]].forEach(([bx, dx], i) => {         // ögonskaften vajar var för sig, lite efter kroppen
      const tx = fx + bx + dx + wave(t * 1.7 - i * 1.3) * 1.4 - A.h * 4 + (ow ? (i ? 3 : -3) : 0), ty = top - 3 + wave(t * 2.4 - 0.8 - i * 0.6);
      st.push([tx, ty]); g.thick(fx + bx, top + 4, tx, ty, 1.8, m, 2);
    });
    const cx = fx + 10 + wave(t * 1.3 - 1.5) * 1.5 - s;
    g.thick(fx + 7, top + 5, cx, top - 4, 1, C.leaf, 2); g.rect(cx - 1, top - 9, 2, 5, C.leather, 3);                               // kaveldun
  }
  g.ell(fx, -2.2, rx + 1.5, 3.2, m, false, (dx, dy) => dy < 0.68, 2);
  g.ell(fx, -ry * 0.7, rx, ry, m, true, (dx, dy) => dy < 0.7);
  g.rect(fx + rx - 1, -1, 3, 1, m, 2); g.dot(fx - rx - 3, -1, m, 3);                                                                 // lite som sipprar ut
  if (kind === 'lava') {
    g.ell(fx, -ry * 0.7, rx, ry, CRUST, false, (dx, dy) => dy < -0.32 + 0.16 * sin(dx * 9), 2);                                     // stelnad skorpa
    g.line(fx - 3, top + 2, fx - 1, top + 5, C.fire2, 5); g.line(fx + 3, top + 1, fx + 5, top + 4, C.fire2, 5);
    g.ell(fx + 4, -ry * 0.75, 2.2, 1.6, C.fire2, false, null, 4); g.ell(fx + 6, -3.5, 1.5, 1.2, C.fire2, false, null, 5);
    const bu = (t * 0.8) % 1; if (bu < 0.8) g.ell(fx - 1, -3, 1 + bu * 1.6, 1 + bu * 1.4, C.fire2, false, null, 5); else { g.dot(fx - 3, -5, C.fire2, 5); g.dot(fx + 1, -6, C.fire2, 5); }   // bubbla som spricker
    for (let i = 0; i < 2; i++) { const ph = (t * 1.3 + i * 0.5) % 1; g.rect(i ? fx + rx + 1 : fx - rx - 2, -5 + ph * 4, 2, 2, C.fire2, 5); }
  } else { g.rect(fx - rx * 0.55, top + 3, 2, 1, C.white, 5); g.dot(fx - rx * 0.55 - 1, top + 4, C.white, 5); }
  const mo = a > 0.05 ? 1 + A.w + A.h * 2.5 : 0;
  if (kind === 'leaf') {
    g.ell(fx + 1, -3.4, rx * 0.5, 2, m, false, null, 4);
    if (ow) { wince(g, fx - 7, ey, false); wince(g, fx - 2, ey, true); } else { peep(g, fx - 7, ey, shut); peep(g, fx - 2, ey, shut); }
    g.dot(fx - 9, ey + 3, C.pink, 3); g.dot(fx + 1, ey + 3, C.pink, 3);
    if (mo) { g.rect(fx - 7, ey + 4, 6, mo, C.dark, 0); g.rect(fx - 5, ey + 3 + mo, 3, 1, C.pink, 3); }
    else { g.rect(fx - 6, ey + 5, 4, 1, C.dark, 0); g.dot(fx - 7, ey + 4, C.dark, 0); g.dot(fx - 2, ey + 4, C.dark, 0); g.dot(fx - 4, ey + 5, C.white, 5); }   // flin med en tand
  }
  if (kind === 'lava') {
    if (ow) { wince(g, fx - 8, ey - 1, false); wince(g, fx - 3, ey - 1, true); }
    else { eye(g, fx - 8, ey - 1, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, mood: 'arg', inner: 1, lid: CRUST }); eye(g, fx - 3, ey - 1, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, mood: 'arg', inner: -1, lid: CRUST }); }
    if (mo) { g.rect(fx - 7, ey + 4, 6, mo, C.dark, 0); if (mo > 1.5) g.rect(fx - 6, ey + 5, 4, mo - 1, C.fire2, 5); }
    else { g.rect(fx - 6, ey + 5, 4, 1, C.dark, 0); g.dot(fx - 7, ey + 6, C.dark, 0); g.dot(fx - 2, ey + 6, C.dark, 0); }             // sur mun
  }
  if (kind === 'swamp') {
    g.ell(fx + 5, -ry * 0.9, 2.5, 1.6, m, false, null, 2); g.ell(fx - 3, -3, 2, 1.2, m, false, null, 2);
    st.forEach(([tx, ty], i) => {
      g.ell(tx, ty - 1.5, 3, 3, C.white, false, null, 5);
      if (shut || ow) g.ell(tx, ty - 1.5, 3, 3, m, false, (dx, dy) => dy < 0.55, 2);
      else { g.rect(tx - 2 + i * 2, ty - 1.5 + (i ? -1 : 0), 2, 2, C.dark, 0); g.ell(tx, ty - 1.5, 3, 3, m, false, (dx, dy) => dy < -0.15, 2); }   // tunga ögonlock
    });
    for (let i = 0; i < 3; i++) { const ph = (t * 0.7 + i * 0.37) % 1; g.rect(fx - rx - 3 + i * (rx + 1), top + 2 - ph * 9, ph < 0.5 ? 2 : 1, ph < 0.5 ? 2 : 1, m, 5); }
    if (mo) g.ell(fx - 3.5, ey + 5.5, 3.5, 1 + mo * 0.7, C.dark, false, null, 0);
    else { g.rect(fx - 7, ey + 5, 7, 1, m, 1); g.dot(fx, ey + 6, m, 1); const dl = (t * 0.45) % 1; g.rect(fx - 3, ey + 6, 1, dl < 0.7 ? 1 + rnd(dl * 4) : 1, C.ice, 5); if (dl >= 0.7 && ey + 10 + (dl - 0.7) * 16 < -1) g.dot(fx - 3, ey + 10 + (dl - 0.7) * 16, C.ice, 5); }   // dregel
  }
  g.end();
  if (a > 0.5 && kind !== 'leaf') {                       // spottar glöd eller rapar en bubbla
    const u = (a - 0.5) / 0.5, px = fx - 11 - eOut(u) * 24;
    g.begin();
    if (kind === 'lava') g.ell(px, ey + 4 - sin(u * PI) * 6 + u * 8, 2.2, 2.2, C.fire2);
    else { const r = 2.5 + u * 2; g.ell(px, ey + 3 - u * 8, r, r, m, false, (dx, dy, d2) => d2 > 0.45, 5); g.dot(px - 1, ey + 2 - u * 8, C.white, 5); }
    g.end();
  }
  g.pop();
}

// ---------- Goblin: liten buse med underbett som väger benklubban i handen (i gäng), eller högfärdig ökengoblin med turban, fjäder, mustasch och kroksabel ----------
function goblin(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), skin = R(o.skin || '#7cba4a'), cloth = R(o.cloth || '#8a5a34'), k = o.k || 1, tb = o.turban, ph = o.ph || 0;
  const sp = tb ? 2.2 : 3.2, b = step(t, sp, ph), cr = rnd(A.w * 1.6 - A.h * 1.2), by = b + cr, Y = -16 + by;
  const ow = hu > 0.25, shut = blinkAt(t, ph + (tb ? 1 : 0)), el = wave(t * sp + ph - 1.1) + hu * 3;       // öronen kommer efter kroppen
  enter(g, hr, k);
  const rest = tb ? -0.62 + wave(t * 1.1) * 0.07 : -0.45 + wave(t * sp + ph - 0.7) * 0.13;
  const ang = rest + A.w * (0.7 - rest) + A.h * (-1.9 - rest) - A.q * 0.3, hx = -8 + A.w * 2 - A.h * 3, hy = -9 + by - A.w * 3 + A.h * 3;
  g.begin();                                             // vapenarm (bortre)
  g.thick(-4, -10 + by, hx, hy, 2.6, skin, 2);
  g.push(hx, hy, ang);
  if (tb) {
    g.poly([[-1, -2], [1.5, -2], [3.5, -8], [2.5, -13], [-2.5, -17], [-1, -12], [-1.5, -7]], C.steel, 4); g.line(1, -4, 2, -10, C.steel, 2);
    g.rect(-3, -3, 6, 1.6, C.gold, 3); g.rect(-1, -1.5, 2, 4.5, C.leather, 3); g.rect(-1, 3, 2, 2, C.red, 4);
  } else {
    g.poly([[-1.2, 3], [1.2, 3], [3, -9], [2, -13], [-2, -13], [-3, -9]], C.wood, 3); g.line(0, -2, 1, -10, C.wood, 2); g.rect(-2, -4, 4, 1, C.leather, 2);
    g.rect(-4, -11, 2, 2, C.bone, 5); g.rect(2, -8, 2, 2, C.bone, 5); g.rect(-1, -14, 2, 2, C.bone, 5);
  }
  g.pop(); g.end();
  g.begin();                                             // ben, kropp och närmre arm
  if (tb) {
    g.rect(-5, -4, 4, 3, cloth, 2); g.rect(1, -4, 4, 3, cloth, 3);
    g.rect(-6, -1, 5, 1, C.gold, 3); g.dot(-7, -2, C.gold, 4); g.rect(0, -1, 5, 1, C.gold, 3); g.dot(-1, -2, C.gold, 4);             // tofflor med uppnäst tå
    g.poly([[-6, -11 + by], [5, -11 + by], [5, -4], [-5, -4]], C.bone, 4);                                                           // bröstet fram
    g.poly([[-6, -11 + by], [-3, -11 + by], [-4, -6], [-5, -6]], cloth, 4); g.poly([[2, -11 + by], [5, -11 + by], [5, -6], [3, -6]], cloth, 2);
    g.rect(-5, -6, 10, 2, C.gold, 3); g.rect(2, -4, 2, 2, C.gold, 2); g.dot(-2, -5, C.red, 4);
    g.thick(3, -10 + by, 7, -7, 2.4, skin, 3); g.thick(7, -7, 4, -5, 2.2, skin, 4);                                                  // handen i sidan
  } else {
    g.rect(-4, -4, 3, 4, skin, 2); g.rect(1, -4, 3, 4, skin, 3); g.rect(-6, -1, 5, 1, skin, 3); g.rect(0, -1, 5, 1, skin, 4);
    g.poly([[-5, -11 + by], [5, -11 + by], [5, -3], [-5, -3]], cloth, 3);
    g.poly([[-5, -3], [-3, -1], [-1, -3], [1, -1], [3, -3], [5, -1], [5, -3]], cloth, 2);
    g.rect(-5, -6, 10, 1, C.bone, 2); g.rect(-2, -5, 1, 2, C.bone, 2); g.rect(1, -10 + by, 3, 3, C.moss, 3);                         // rep och lapp
    g.thick(3, -10 + by, 5, -6, 2.4, skin, 3); g.rect(4, -6, 2, 2, skin, 4);
  }
  g.end();
  g.begin();                                             // huvud
  g.poly([[-5, Y - 2], [-11, Y - 7 + el * 0.6], [-7, Y + 1]], skin, 2);
  if (tb) {
    const ft = wave(t * sp - 0.8) * 1.2 + hu * 2;
    g.poly([[4, Y - 2], [11, Y - 6 + el], [6, Y + 3]], skin, 4);
    g.poly([[5, Y - 6], [9, Y - 4 + ft], [10, Y + 1 + ft], [7, Y - 1 + ft * 0.5], [5, Y - 3]], C.bone, 2);                            // turbanens ände fladdrar
  } else { g.poly([[4, Y - 2], [9, Y - 6 + el * 0.5], [13, Y - 4 + el * 1.4], [10, Y - 2 + el], [11, Y + el], [6, Y + 3]], skin, 4); g.dot(7, Y + 2, C.gold, 5); }   // naggat öra med ring
  g.ell(-0.5, Y, 7, 6, skin, 0.9);
  if (tb) {
    const fl = wave(t * sp + ph - 1.5) * 1.5 - A.h * 3 + A.w * 2 + hu * 3;                                                           // fjädern vajar sist av allt
    g.poly([[-5, Y - 7], [-6 + fl * 0.5, Y - 12], [-4 + fl, Y - 15], [-2 + fl * 0.6, Y - 12], [-3, Y - 7]], C.purple, 4);
    g.ell(-0.5, Y - 5.5, 7.6, 3.2, C.bone, 1.1); g.ell(0.5, Y - 8.5, 5.4, 2.8, C.bone, 1.1); g.ell(1.5, Y - 10.8, 2.8, 1.6, C.bone, 1.1);
    g.line(-6, Y - 5, 5, Y - 7, C.bone, 2); g.line(-3, Y - 9, 5, Y - 9, C.bone, 2);
    g.rect(-6, Y - 8, 3, 3, C.gold, 3); g.dot(-5, Y - 7, C.red, 4);
    g.poly([[-7, Y - 1], [-11, Y - 2], [-9, Y + 2], [-7, Y + 3]], skin, 4);                                                           // näsan i vädret
    if (ow) { wince(g, -6, Y - 3, false); wince(g, -2, Y - 3, true); }
    else { eye(g, -6, Y - 3, 3, 3, { shut, pw: 1, ph: 2, mood: 'lomsk', lid: skin }); eye(g, -2, Y - 3, 3, 3, { shut, pw: 1, ph: 2, mood: 'lomsk', lid: skin }); g.line(-2, Y - 5, 0, Y - 6, skin, 1); }
    g.line(-8, Y + 3, -5, Y + 3, C.dark, 0); g.dot(-9, Y + 2, C.dark, 0);                                                             // tunn mustasch med snurr
    g.rect(-4, Y + 5, 2, 2, C.dark, 1);                                                                                               // litet pipskägg
    if (a > 0.05) g.rect(-5, Y + 4, 3, 1, C.dark, 0);
  } else {
    g.line(-1, Y - 6, -2, Y - 9, C.dark, 1); g.line(1, Y - 6, 3, Y - 8, C.dark, 1);                                                   // två hårstrån
    g.poly([[-7, Y + 2], [-9, Y + 4], [-7, Y + 6], [-1, Y + 6], [2, Y + 3]], skin, 2);                                                // underbett
    g.poly([[-7, Y - 1], [-11, Y + 1], [-10, Y + 3], [-7, Y + 3]], skin, 4);
    if (ow) { wince(g, -6, Y - 4, false); wince(g, -2, Y - 4, true); }
    else { eye(g, -6, Y - 3, 2, 2, { shut, col: C.fire2, ph: 1, pw: 1, dy: 1 }); eye(g, -2, Y - 4, 3, 3, { shut, col: C.fire2, ph: 2, pw: 1 }); g.line(-7, Y - 5, -5, Y - 4, skin, 1); g.line(-2, Y - 5, 1, Y - 6, skin, 1); }
    g.rect(-6, Y + 4, 6, a > 0.05 ? 2 : 1, C.dark, 0); g.dot(-6, Y + 3, C.white, 5); g.dot(-2, Y + 3, C.white, 5);
  }
  g.end();
  if (tb && a > 0.44 && a < 0.6) { g.begin(); g.ell(-9, -12, 15, 15, C.white, false, (dx, dy, d2) => d2 > 0.8 && dx < -0.15 && dy > -0.75 && dy < 0.6, 5); g.end({ edge: false }); }   // sabelhugget syns som en båge
  g.pop();
}

// ---------- Fladdermus: nyfiken skogsfladdermus med stora öron (ett vikt), krage och dinglande fötter, eller glödfladdra med lågtofs och gnistsvans ----------
function bat(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), k = o.k || 1, ph = o.ph || 0, fire = o.fire;
  // Vingslag: snabbt ner, långsammare upp, och yttervingen kommer efter innervingen.
  const p = t * 9.5 + ph, f1 = a > 0 ? -A.w * 1.2 + A.h * 1.1 + A.q * 0.5 : wave(p), f2 = a > 0 ? -A.w * 1.3 + A.h * 1.3 + A.q : wave(p - 1);
  const F1 = f1 * 4.5, F2 = f2 * 5, hov = (o.hov || 16) + wave(t * 2.2 + ph) * 2 + (a > 0 ? A.w * 4 - A.h * 5 : f1 * 0.8);            // kroppen gungar mot vingslaget
  const shut = blinkAt(t, 2 + ph), ow = hu > 0.25;
  g.push(hu * 2, -rnd(hov), hr * 0.45 - A.h * 0.25 + A.w * 0.15, k);
  g.begin();
  for (const sx of [-1, 1]) {
    const ex = sx * 8, ey = -6 + F1 * 0.5, wx = sx * 14, wy = -9 + F1 * 0.5 + F2 * 0.5;
    g.poly([[sx * 3, -1], [ex, ey], [wx, wy], [sx * 18, -3 + F1 * 0.3 + F2], [sx * 14, 1 + F1 * 0.2 + F2 * 0.7], [sx * 12, 5 + F2 * 0.3], [sx * 9, 1 + F1 * 0.3], [sx * 7, 5], [sx * 4, 4]], m, sx < 0 ? 2 : 1);
    g.thick(sx * 3, -1, ex, ey, 1.6, m, 4); g.thick(ex, ey, wx, wy, 1.3, m, 4); g.line(ex, ey, sx * 12, 4 + F2 * 0.3, m, sx < 0 ? 1 : 2);
    if (fire) { g.dot(sx * 18 - (sx > 0 ? 1 : 0), -3 + F1 * 0.3 + F2, C.fire2, 5); g.dot(sx * 12 - (sx > 0 ? 1 : 0), 4 + F2 * 0.3, C.fire2, 5); }
  }
  if (fire) { const w = sin(t * 12 + ph) * 1.5; g.poly([[3, 3], [9, 5 + w], [14, 3 - w - f2], [10, 8 + w], [4, 7]], C.fire2, 4); }
  else { const d = rnd(f2 * 0.6 + 0.5); g.line(-2, 6, -3, 8 + d, m, 2); g.line(2, 6, 2, 8 + d, m, 2); }
  g.end();
  g.begin();
  if (fire) { const w = sin(t * 10 + ph) * 1.2, F = 1 + A.h * 0.8; g.poly([[-4, -4], [-3, -4 - (6 + w) * F], [-1, -7], [1, -4 - (8 - w) * F], [3, -7], [5, -4 - (5 + w) * F], [4, -3]], C.fire2, 4); }
  else {
    const ew = wave(p * 0.25 - 1) - ev(t, 4.1, 0.3, ph) * 2 + hu * 4;                                                                 // öronen vickar till ibland
    g.poly([[-5, -3], [-8, -12 + ew], [-1, -5]], m, 4); g.poly([[-5, -5], [-7, -10 + ew], [-3, -6]], C.pink, 3);
    g.poly([[5, -3], [8, -11 + ew * 0.5], [1, -5]], m, 2); g.poly([[8, -11 + ew * 0.5], [11, -9 + ew * 0.5], [7, -8]], m, 3);
  }
  g.ell(0, 0, 5.5, 6, m);
  if (fire) g.ell(0, 4, 3, 1.8, C.fire, false, null, 4); else { g.ell(0, 4.3, 3.6, 1.7, m, false, null, 5); g.dot(-3, 4, m, 2); g.dot(2, 5, m, 2); }
  if (ow) { wince(g, -5, -3, false); wince(g, -1, -3, true); }
  else if (fire) { eye(g, -5, -3, 3, 3, { shut, pw: 1, ph: 2, col: C.fire2, mood: 'arg', inner: 1, lid: m }); eye(g, -1, -3, 3, 3, { shut, pw: 1, ph: 2, col: C.fire2, mood: 'arg', inner: -1, lid: m }); }
  else { eye(g, -5, -3, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1 }); eye(g, -1, -3, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1 }); g.dot(-2, 0, C.pink, 3); }
  if (a > 0.05) { g.rect(-4, 2, 5, 2 + rnd(A.h), C.dark, 0); g.dot(-4, 2, C.white, 5); g.dot(0, 2, C.white, 5); }
  else if (fire) { g.rect(-4, 2, 5, 1, C.dark, 0); g.dot(-3, 3, C.white, 5); g.dot(-1, 3, C.white, 5); }
  else { g.rect(-4, 2, 4, 1, C.dark, 0); g.dot(-5, 1, C.dark, 0); g.dot(-2, 3, C.white, 5); }                                         // snett leende, en huggtand
  g.end();
  if (a > 0.42 && !fire) {                               // ultraljud
    g.begin(); const u = (a - 0.42) / 0.58; for (let i = 0; i < 3; i++) { const r = 6 + i * 5 + eOut(u) * 8; if (u < 0.8 - i * 0.1) g.ell(-6, 1, r, r, C.white, false, (dx, dy, d2) => d2 > 0.72 && dx < -0.62, 5); } g.end({ edge: false });
  }
  if (a > 0.45 && fire) { const u = (a - 0.45) / 0.55; g.begin(); g.ell(-8 - eOut(u) * 16, 2 + u * u * 8, 2.6 - u, 2.6 - u, C.fire2); g.end(); }
  if (fire) { g.begin(); for (let i = 0; i < 2; i++) { const q = (t * 1.4 + i * 0.5 + ph) % 1; g.rect(5 + i * 4, 9 + q * 8, 1, 1, C.fire2, q < 0.5 ? 5 : 3); } g.end({ outline: false, edge: false }); }
  g.pop();
}

// ---------- Svamp: sur gubbe med armarna i kors, tuggad hattkant och en snigel på hatten, eller snuvig giftsvamp med hängande topp, röd näsa och näsduk ----------
function mushroom(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), cap = R(o.hex), k = o.k || 1, tall = o.tall, H = tall ? 17 : 9, b = step(t, 2.2);
  const shut = blinkAt(t, H), ow = hu > 0.25, fy = -H + 1;
  // Snuvig: "a... a..." i två små ryck bakåt, och sedan ett litet nys framåt.
  let sn = 0;
  if (tall && a <= 0) { const x = t % 4.6; sn = x < 0.25 ? x * 2 : x < 0.5 ? 0.5 : x < 0.75 ? 0.5 + (x - 0.5) * 2 : x < 1.1 ? 1 : x < 1.2 ? 1 - (x - 1.1) * 22 : x < 1.7 ? -1.2 * (1 - eOut((x - 1.2) / 0.5)) : 0; }
  g.push(hu * 2, 0, hr * 0.14 + A.w * 0.22 - A.h * 0.36 - A.q * 0.1 + sn * 0.09, k);
  g.begin();                                             // fot med ansikte
  const tap = !tall && a <= 0 && ev(t, 3.3, 1.3) > 0 ? step(t, 16) : 0;                                                               // trampar otåligt
  g.rect(-6, -2 - tap, 5, 2, C.leather, 2); g.rect(1, -2, 5, 2, C.leather, 3);
  g.ell(0, -(H + 4) / 2 - 1, tall ? 5.5 : 6.5, (H + 4) / 2, C.bone, 0.9);
  if (tall) {
    g.rect(-5, -8, 10, 1, C.bone, 2); for (const x of [-4, -1, 2]) g.dot(x, -7, C.bone, 2);                                           // krage på foten
    const cl = shut || sn > 0.6 || A.w > 0.5;
    if (ow) { wince(g, -6, fy, false); wince(g, -1, fy, true); }
    else { eye(g, -6, fy, 3, 3, { shut: cl, mood: 'somnig', lid: C.bone, pw: 1, ph: 1, dx: 0, dy: 2 }); eye(g, -1, fy, 3, 3, { shut: cl, mood: 'somnig', lid: C.bone, pw: 1, ph: 1, dx: 0, dy: 2 }); }
    g.rect(-3, fy + 2, 2, 2, C.red, 4); g.rect(-3, fy + 4, 1, 1 + step(t, 1.9), C.ice, 5);                                            // röd näsa som droppar
    if (sn > 0.3 || A.w > 0.3) g.ell(-2.5, fy + 7.5, 1.6, 1.2 + max(sn, A.w), C.dark, false, null, 0); else g.rect(-4, fy + 7, 3, 1, C.dark, 0);
  } else {
    if (ow) { wince(g, -5, fy, false); wince(g, -1, fy, true); }
    else if (shut) { g.rect(-5, fy + 2, 2, 1, C.dark, 0); g.rect(-1, fy + 2, 2, 1, C.dark, 0); }
    else { g.rect(-5, fy + 1, 2, 2, C.dark, 0); g.dot(-5, fy + 1, C.white, 5); g.rect(-1, fy + 1, 2, 2, C.dark, 0); g.dot(-1, fy + 1, C.white, 5); }
    g.line(-7, fy - 1, -4, fy, C.dark, 0); g.line(-1, fy, 2, fy - 1, C.dark, 0);                                                      // tunga, sura ögonbryn under hattkanten
    g.rect(-3, fy + 2, 2, 2, C.pink, 3);
    if (a > 0.05) g.rect(-4, fy + 4, 3, 2, C.dark, 0); else { g.rect(-4, fy + 4, 3, 1, C.dark, 0); g.dot(-5, fy + 5, C.dark, 0); g.dot(-1, fy + 5, C.dark, 0); }
  }
  g.end();
  g.begin();                                             // armar
  if (tall) {
    const hx = -9 + max(sn, A.w) * 2, hy2 = fy + 6 - max(0, sn, A.w) * 3, fl = wave(t * 2.2 - 1) * 1.2;
    g.thick(-5, fy + 7, hx, hy2, 2, C.bone, 2); g.thick(5, fy + 7, 7, fy + 11, 2, C.bone, 2);
    g.poly([[hx, hy2 - 2], [hx - 3, hy2 - 1], [hx - 2 + fl, hy2 + 5], [hx + 1, hy2 + 3]], C.white, 4); g.dot(hx - 1, hy2 + 1, C.ice, 3);   // näsduk
  } else if (a > 0.02) { g.thick(-5, -4, -9 - A.h * 2, -2 - A.s * 4, 2, C.bone, 2); g.thick(5, -4, 9, -1 - A.w * 3, 2, C.bone, 2); }
  else { g.thick(6, -4, -3, -1.5, 2, C.bone, 2); g.thick(-6, -4, 3, -1.5, 2, C.bone, 3); }                                            // armarna i kors
  g.end();
  g.begin();                                             // hatt: lyfter från huvudet vid träff och dimper ner igen
  const hy = -H - 3 + b - max(0, hr) * 4 - max(0, sn) * 0.6;
  if (tall) {
    const d = wave(t * 1.7 - 1) * 1.5 + sn * 2 + A.w * 3 - A.h * 7 - A.q * 3;                                                         // toppen slänger efter
    g.poly([[-12, hy + 3], [12, hy + 3], [9, hy - 4], [3, hy - 12], [-4 + d, hy - 17], [-9 + d, hy - 14], [-4, hy - 9], [-9, hy - 3]], cap, 3);
    g.rect(-11, hy + 3, 22, 1, C.bone, 2);
    for (const [x, y, r] of [[-5, -1, 2], [3, -4, 2.4], [7, 0, 1.6]]) g.ell(x, hy + y, r, r * 0.8, C.fire2, false, null, 5);
    g.rect(-1, hy - 10, 3, 3, cap, 2); g.dot(-1, hy - 10, cap, 5); g.dot(1, hy - 8, cap, 5);                                          // lapp
    g.rect(8, hy + 4, 1, 2 + step(t, 1.9), cap, 5);
  } else {
    g.ell(0, hy, 13, 9, cap, true, (dx, dy) => dy < 0.35 && (dx - 0.82) ** 2 + (dy - 0.3) ** 2 > 0.04);                               // en tugga saknas i kanten
    g.rect(-11, hy + 3, 19, 1, C.bone, 2); for (let x = -10; x < 8; x += 3) g.dot(x, hy + 3, C.bone, 1);
    for (const [x, y, r] of [[-6, -5, 2.6], [2, -6.5, 3], [-1, -1, 1.6]]) g.ell(x, hy + y, r, r * 0.75, C.white, false, null, 5);
    const hid = a > 0 || hu > 0;                                                                                                       // snigeln drar in sig när det smäller
    g.ell(9.5, hy - 7.5, 2.4, 2.2, C.orange); g.dot(9, hy - 8, C.rust, 2);
    if (!hid) { g.rect(5, hy - 6, 4, 1, C.fire2, 4); g.dot(5, hy - 7, C.fire2, 4); g.dot(5, hy - 8 - step(t, 1.5), C.fire2, 5); }
  }
  g.end();
  g.begin();
  if (a > 0.45) spray(g, tall ? -9 : -11, tall ? fy + 5 : hy + 3, (a - 0.45) / 0.55, tall ? 8 : 6, tall ? C.fire2 : cap, { rp2: tall ? C.leaf : C.white, dist: tall ? 28 : 22, spread: 7 });
  if (sn < 0) spray(g, -8, fy + 5, 1 + sn / 1.2 * 0.95, 3, C.fire2, { dist: 10, spread: 3 });
  if (!tall && a <= 0) { const hm = (t % 5.2) / 0.7; if (hm < 1) { g.rect(-13 - hm * 3, fy + 2 - hm * 4, 2, 2, C.white, 4); g.dot(-15 - hm * 4, fy - hm * 5, C.white, 4); } }   // fnyser
  g.end({ edge: false });
  g.pop();
}

// ---------- Spindel: lömsk luden spindel som gnuggar käkarna och trummar med benen, eller småkryp i svärm som kilar i sidled och tvärstannar ----------
function spider(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), k = o.k || 1, L = o.long || 1, ph = o.ph || 0, cute = o.cute;
  let dxs = 0, scurry = false, n = 0;
  if (cute && a <= 0) { const tt = t + ph * 3, x0 = (tt % 2.3) / 0.3; n = floor(tt / 2.3); scurry = x0 < 1; const p1 = sin(n * 2.4) * 3, p0 = sin((n - 1) * 2.4) * 3; dxs = rnd(p0 + (p1 - p0) * eIO(x0)); }
  const bob = scurry ? -step(t, 30) : wave(t * 2.2 + ph) * 0.6, by = -7 + bob + A.w * 2 - A.h * 2.5 + max(0, hr) * 2, bx = A.w * 3 - A.h * 4;
  const shut = blinkAt(t, 5 + ph), ow = hu > 0.25, curl = 1 - max(0, hr) * 0.3;
  g.push(hu * 2 + dxs, 0, hr * 0.1, k);
  g.begin();
  for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) {
    const front = sd < 0 && i >= 2, tapv = a > 0 || cute ? 0 : ev(t, 3.4, 0.22, -i * 0.1 - (sd > 0 ? 0.5 : 0)) * 2;                  // trummar med benen, ett i taget
    const scr = scurry ? sin(t * 40 + i * 2 + sd) * 1.2 : 0, lift = front ? A.w * (7 + i * 2) : 0, stab = front ? A.h * 4 : 0;
    const kx = sd * (5 + i * 2.6 * L) * curl + bx * 0.6 + scr, ky = by - 8 + i * 1.6 - lift * 0.6 - tapv * 0.5, fx = sd * (7 + i * 3.6 * L) * curl + scr - stab - (lift ? 2 : 0), fy = -lift - tapv;
    if (o.thick) { g.thick(sd * 3 + bx, by, kx, ky, 1.7, m, 2); g.thick(kx, ky, fx, fy, 1.5, m, 2); } else { g.line(sd * 3 + bx, by, kx, ky, m, 2); g.line(kx, ky, fx, fy - 1, m, 2); }
  }
  g.end();
  g.begin();
  g.push(bx, 0);
  if (!cute) for (const [x, y] of [[3, -9], [7, -8.5], [10, -6]]) g.poly([[x - 1.5, by + y + 2], [x + 1, by + y - 1.5], [x + 2.5, by + y + 2]], m, 4);   // ludd
  g.ell(5, by - 2, 7, 6.5, m); g.ell(-4, by, 4.8, 4.2, m);
  if (o.mark) { g.poly([[6, by - 8], [9.5, by - 4.5], [6, by - 1], [2.5, by - 4.5]], C.fire2, 4); g.rect(5, by - 5, 2, 2, m, 2); g.dot(10, by - 1, C.fire2, 3); g.dot(11, by - 5, C.fire2, 3); }   // ruta på ryggen
  if (cute) {
    const gl = scurry ? 0 : (sin(n * 1.7) > 0 ? 1 : 0);                                                                               // tittar sig omkring när de står still
    if (ow) { wince(g, -8, by - 3, false); wince(g, -4, by - 3, true); }
    else { eye(g, -8, by - 3, 3, 4, { shut, pw: 2, ph: 2, dx: gl }); eye(g, -4, by - 3, 3, 4, { shut, pw: 2, ph: 2, dx: gl }); }
    g.dot(-3, by - 5, m, 5); g.dot(-2, by - 6, m, 5);
  } else {
    if (ow) { wince(g, -9, by - 3, false); wince(g, -5, by - 3, true); }
    else { eye(g, -9, by - 3, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, mood: 'lomsk', lid: m }); eye(g, -5, by - 3, 3, 3, { shut, col: C.fire2, pw: 1, ph: 2, mood: 'lomsk', lid: m }); }
    g.dot(-8, by - 5, C.fire2, 5); g.dot(-4, by - 5, C.fire2, 4); g.dot(-1, by - 3, C.fire2, 4);
    if (a > 0.05) { g.rect(-8, by + 2, 1, 2 + rnd(A.h * 3), C.bone, 4); g.rect(-5, by + 2, 1, 2 + rnd(A.h * 3), C.bone, 4); }
    else { const r = step(t, 7); g.line(-8, by + 2, -10, by + 4 + r, m, 4); g.line(-5, by + 2, -8, by + 5 - r, m, 4); }               // gnuggar käkarna
  }
  g.pop(); g.end();
  g.pop();
}

// ---------- Varg: smygande gråvarg med rest ragg, isvarg med kristaller och frostandedräkt, glödhund med eldman och rök ur nosen ----------
function wolf(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), k = o.k || 1, kind = o.kind;
  const br = wave(t * 2.2) * 0.6, cy = rnd(A.w * 2.5 - A.h), bx = A.w * 3 - A.h * 4;                                                  // hukar bakåt och kastar sig fram
  const tw1 = wave(t * 1.5) * 2 + A.q * 3, T = tw1 + wave(t * 1.5 - 1) * 3 + A.q * 5 + hu * 12, shut = blinkAt(t, 7), ow = hu > 0.25; // svansspetsen kommer efter, och stoppas in vid träff
  const fl = (i) => sin(t * 10 + i * 2.1) * 1.6, snarl = a > 0 ? 0 : ev(t, 5.6, 1.1), flick = ev(t, 3.7, 0.28, 1);
  enter(g, hr, k, 0.08);
  g.begin();                                             // bortre ben och svans
  g.thick(-7 + bx, -12 + cy, -10, -1, 3.4, m, 1); g.thick(14 + bx, -12 + cy, 17, -1, 3.4, m, 1);
  g.push(bx, cy);
  if (kind === 'fire') { g.poly([[15, -15], [21, -20 + tw1], [24, -28 + T * 0.6 + fl(0)], [26, -21 + tw1], [31, -25 + T + fl(1)], [28, -15 + T * 0.6], [22, -12], [16, -11]], C.fire, 4); g.poly([[18, -15], [23, -19 + tw1], [25, -16 + tw1], [21, -13]], C.fire2, 5); }
  else {
    g.poly([[15, -17], [22, -22 + tw1], [29, -26 + T], [28, -19 + T], [22, -14 + tw1 * 0.6], [16, -11]], m, 3); g.poly([[25, -24 + (tw1 + T) / 2], [29, -26 + T], [28, -20 + T]], kind === 'ice' ? C.ice : C.bone, 5);
    if (!kind) { g.dot(21, -19 + tw1, C.leaf, 4); g.dot(22, -18 + tw1, C.leaf, 3); }                                                   // en kardborre i svansen
  }
  g.pop(); g.end();
  g.begin();                                             // kropp och närmre ben
  g.push(bx, cy);
  if (kind === 'ice') { const sp = floor(t * 2.5) % 6; [[-3, 7], [3, 10], [9, 6], [14, 5]].forEach(([x, hh], i) => { g.poly([[x - 2.5, -19], [x + 1, -20 - hh], [x + 3, -19]], C.ice, 5); if (sp === i) { g.dot(x + 1, -22 - hh, C.white, 5); g.dot(x - 1, -20 - hh, C.white, 5); g.dot(x + 2, -20 - hh, C.white, 5); } }); }   // det glittrar i kristallerna
  if (kind === 'fire') g.poly([[-9, -20], [-7, -28 + fl(0)], [-3, -23], [0, -31 + fl(1)], [4, -23], [8, -28 + fl(2)], [11, -21], [15, -24 + fl(3)], [16, -17]], C.fire, 4);
  if (!kind) { const hh = 2 + A.w * 3 + snarl * 1.5; for (const x of [-7, -2, 3, 8]) g.poly([[x - 2, -20], [x + 1, -21 - hh], [x + 2.5, -20]], m, 2); }   // raggen reser sig
  g.ell(4, -14 + br * 0.3, 13, 6.5 + br * 0.3, m); g.ell(-6, -15, 8, 7.6, m);
  if (kind === 'fire') { g.line(-2, -15, 3, -12, C.fire2, 5); g.line(3, -12, 7, -14, C.fire2, 5); g.line(9, -16, 12, -12, C.fire2, 4); }
  else g.poly([[-12, -13], [-13, -8], [-10, -10], [-9, -6], [-6, -9], [-4, -12]], m, 5);                                               // bröstpäls
  if (kind === 'ice') { g.poly([[1, -8], [2, -5], [3, -8]], C.ice, 5); g.poly([[6, -8], [7, -6], [8, -8]], C.ice, 5); }
  g.pop();
  g.thick(-3 + bx, -10 + cy, -5, -2, 3.6, m, 3); g.rect(-8, -2, 5, 2, m, 4); g.dot(-9, -1, C.bone, 5);
  g.thick(10 + bx, -12 + cy, 9 + bx * 0.5, -6 + cy * 0.5, 5, m, 3); g.thick(9 + bx * 0.5, -6 + cy * 0.5, 12, -2, 3, m, 3); g.rect(9, -2, 5, 2, m, 4); g.dot(8, -1, C.bone, 5);
  g.end();
  const hx = -13 + bx * 0.6 + A.w - A.h * 4, hy = -20 + cy + A.w * 2 - A.h + rnd(br * 0.5) - max(0, hr) * 3, flat = A.w * 0.6 + hu * 0.9;
  g.push(hx, hy, 0.08 + A.w * 0.2 - A.h * 0.25 - hr * 0.3 - snarl * 0.06);
  g.begin();                                             // huvud: läppen dras upp ibland, käftarna slår igen i hugget
  g.poly([[1, -4], [4 + flat * 5, -12 + flat * 6], [7, -3]], m, 2); g.poly([[-3, -4], [-2 + flat * 5 - flick * 2, -12 + flat * 5 + flick], [2, -4]], m, 4);
  const op = a > 0 ? (a < 0.4 ? A.w * 2 : a < 0.5 ? 2 + (a - 0.4) * 40 : a < 0.56 ? 6 * (1 - (a - 0.5) / 0.06) : 0) : snarl * 1.6 + (ow ? 3 : 0);
  g.poly([[-1, 2], [-11, 3 + op], [-10, 5.5 + op], [1, 6]], m, 2);
  if (op > 1) { g.poly([[-1, 2], [-11, 2], [-10, 3 + op], [-1, 4]], C.red, 1); g.rect(-9, 2 + op, 1, 2, C.white, 5); g.rect(-6, 2 + op * 0.7, 1, 2, C.white, 5); if (op > 3) g.rect(-7, 3 + op * 0.5, 3, 1, C.pink, 3); }
  g.ell(0, 0, 6.5, 5.5, m);
  g.poly([[-3, -3.5], [-12, -1], [-13, 2.5], [-4, 3.5]], m, 4);
  g.rect(-14, -1, 2, 2, C.dark, 0);
  g.rect(-11, 2, 1, 2, C.white, 5); g.rect(-8, 2, 1, 2, C.white, 5); if (op > 0.5) { g.dot(-6, 3, C.white, 5); g.dot(-4, 3, C.white, 5); }
  g.poly([[2, 2], [7, 5], [2, 6]], m, 3); g.poly([[3, -1], [8, 1], [3, 3]], m, 4);                                                     // kindpäls
  if (kind === 'ice') g.rect(-11, -2, 5, 1, C.snow, 5);
  if (ow) wince(g, -5, -4, false);
  else if (kind === 'fire') { if (shut) g.rect(-5, -2, 3, 1, C.dark, 0); else { g.rect(-5, -3, 3, 2, C.fire2, 5); g.dot(-5, -3, C.white, 5); } g.line(-6, -4, -2, -5, C.dark, 1); }
  else { eye(g, -5, -3, 3, 2, { shut, col: kind === 'ice' ? C.ice : C.fire2, pw: 1, ph: 2, dy: 0 }); g.line(-6, -4, -2, -5, m, 1); }
  g.end();
  g.pop();
  if (kind === 'ice') {
    g.begin();
    if (a > 0.45) spray(g, hx - 15, hy + 2, (a - 0.45) / 0.55, 5, C.ice, { rp2: C.white, dist: 20, spread: 4, fall: 3 });
    else if (a <= 0) { const bp = (t % 3.2) / 1.1; if (bp < 1) { g.rect(hx - 16 - bp * 6, hy + 1 - bp * 3, bp < 0.5 ? 3 : 2, 2, C.snow, 5); g.dot(hx - 20 - bp * 7, hy - 1 - bp * 4, C.snow, 4); } }   // frostandedräkt
    g.end({ outline: false, edge: false });
  }
  if (kind === 'fire') {
    if (a > 0.45) { g.begin(); const u = eOut((a - 0.45) / 0.55), fx = hx - 14; g.poly([[fx, hy + 1], [fx - 5 - u * 12, hy - 3], [fx - 3 - u * 10, hy + 1], [fx - 7 - u * 12, hy + 4], [fx, hy + 4]], C.fire2, 4); g.end(); }
    else if (a <= 0) { const sm = (t % 1.7) / 1.7; g.begin(); g.rect(hx - 14, hy - 3 - sm * 7, sm > 0.5 ? 2 : 1, sm > 0.5 ? 2 : 1, C.smoke, 4); g.end({ outline: false, edge: false }); }
  }
  g.pop();
}

// ---------- Kaktus: butter krukväxt som har rymt med krukan på, spänner armarna och har blomman på svaj ----------
function cactus(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R('#5fae4e'), pot = R('#c26a3c'), shut = blinkAt(t, 3), ow = hu > 0.25;
  // Stammen böjer sig från roten: mitten följer lite, toppen mer, och blomman kommer sist.
  const B = wave(t * 1.6) * 1.2 + A.w * 4 - A.h * 6 - A.q * 3 + hr * 4, b3 = rnd(B * 0.3), b8 = rnd(B * 0.8), bt = rnd(B), bf = rnd(B + wave(t * 1.6 - 1.1) * 1.4 - A.q * 2);
  const flex = a > 0 ? A.w * 4 - A.h * 2 : ev(t, 4.4, 1) * 2.5;                                                                        // spänner musklerna ibland
  g.push(hu * 2, 0, 0, o.k || 1);
  g.begin();                                             // armar
  g.thick(-5 + b3, -14, -11 + b3, -14, 4.6, m, 3); g.thick(-10.5 + b3, -15, -10.5 + b3 - flex * 0.2, -21 - flex, 4.6 + flex * 0.3, m, 3);
  g.thick(5 + b3, -11, 11 + b3, -11, 4.6, m, 2); g.thick(10.5 + b3, -12, 10.5 + b3 + flex * 0.2, -17 - flex, 4.6 + flex * 0.3, m, 2);
  g.dot(-14 + b3, -17 - flex * 0.5, C.bone, 5); g.dot(-11 + b3, -25 - flex, C.bone, 5); g.dot(13 + b3, -14, C.bone, 5); g.dot(10 + b3, -21 - flex, C.bone, 5);
  g.end();
  g.begin();                                             // stam
  g.poly([[-6, -6], [6, -6], [6 + b3, -15], [6 + bt, -25], [3 + bt, -29], [-3 + bt, -29], [-6 + bt, -25], [-6 + b3, -15]], m, 3);
  g.line(-2, -7, -2 + b3, -15, m, 2); g.line(-2 + b3, -15, -2 + bt, -28, m, 2); g.line(2, -7, 2 + b3, -15, m, 2); g.line(2 + b3, -15, 2 + bt, -28, m, 2);
  for (const [x, y, f] of [[-7, -10, 0.15], [6, -13, 0.3], [-7, -18, 0.5], [6, -21, 0.7], [-7, -26, 0.95]]) g.dot(x + rnd(B * f), y, C.bone, 5);
  if (ow) { wince(g, -5 + b8, -23, false); wince(g, b8, -23, true); }
  else { eye(g, -5 + b8, -23, 3, 3, { shut, pw: 1, ph: 2, mood: 'arg', inner: 1, lid: m }); eye(g, b8, -23, 3, 3, { shut, pw: 1, ph: 2, mood: 'arg', inner: -1, lid: m }); }
  if (a > 0.05) g.ell(-2 + b8, -16.5, 2, 1.5 + A.h, C.dark, false, null, 0);
  else { g.rect(-4 + b8, -18, 4, 1, C.dark, 0); g.dot(-5 + b8, -17, C.dark, 0); g.dot(b8, -17, C.dark, 0); g.rect(-4 + b8, -17, 4, 1, m, 5); }   // putar med underläppen
  g.end();
  g.begin(); g.ell(1 + bf, -30.5, 3.6, 2.4, C.pink); g.dot(bf, -31, C.fire2, 5); g.dot(1 + bf, -31, C.fire2, 5); g.poly([[4 + bf, -30], [7 + bf, -28 + hu * 2], [4 + bf, -28]], C.pink, 2); g.end();
  g.begin();                                             // kruka med spricka
  g.poly([[-7, 0], [7, 0], [8, -6], [-8, -6]], pot, 3); g.rect(-9, -8, 18, 2, pot, 4); g.line(3, -6, 2, -3, pot, 1); g.line(2, -3, 4, -1, pot, 1); g.rect(-6, -5, 2, 1, pot, 5);
  g.end();
  g.begin();
  if (a > 0.45) { const u = eOut((a - 0.45) / 0.55); for (let i = 0; i < 4; i++) g.rect(-12 + b8 - u * 30 - i * 3, -25 + i * 5 + u * u * 3, 3, 1, C.bone, 5); }   // taggar flyger
  if (hu > 0.05) { const u = 1 - hu; for (const [x, y, dx, dy] of [[-8, -20, -1, -1], [8, -22, 1, -1], [9, -12, 1, 0], [-9, -11, -1, 0.5]]) g.dot(x + dx * u * 8, y + dy * u * 8 + u * u * 6, C.bone, 5); }
  g.end();
  g.pop();
}

// ---------- Skorpion: nervös nypare som klapprar med klorna i takt, med en svans som böljar led för led ----------
function scorpion(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex || '#d08a3c'), shut = blinkAt(t, 4), ow = hu > 0.25;
  const cl = (x) => x < 0.1 || (x > 0.26 && x < 0.36), sn = cl(t % 2.4) ? 0 : 2.2, sn2 = a > 0 ? 3 * A.w : cl((t + 1.2) % 2.4) ? 0 : 1.6;   // klapp-klapp, paus
  const by = rnd(A.w * 1.5 - A.h + max(0, hr) * 1.5);
  enter(g, hr, o.k || 1, 0.1);
  g.begin();                                             // ben
  for (let i = 0; i < 4; i++) { const hx = -4 + i * 3.6, w = wave(t * 3 - i * 0.9) * 0.6; g.line(hx, -5 + by, hx + 2 + w, -10 + by * 0.5, m, 2); g.line(hx + 2 + w, -10 + by * 0.5, hx + 5 + w, -1, m, 2); }
  g.end();
  g.begin(); g.thick(-7, -7 + by, -12, -12 - A.w * 2, 2.2, m, 2); claw(g, -14, -14 - A.w * 2, -1, sn2, m, 3, 2); g.end();              // bortre klo
  g.begin();                                             // kropp och svans
  g.push(0, by);
  g.ell(11, -6, 3.6, 3.2, m); g.ell(6, -5.5, 4.6, 4, m); g.ell(0, -5.5, 5, 4.5, m); g.ell(-6, -5, 4.6, 4, m);
  g.rect(-1, -10, 3, 1, m, 5); g.rect(5, -9, 3, 1, m, 5); g.line(-3, -6, -3, -3, m, 1); g.line(3, -6, 3, -3, m, 1);                     // ryggplåtar
  let x = 13, y = -8, ang = -PI / 2 + 0.55; const L = 4.3 - A.w * 0.5 + A.h * 1.7;
  for (let i = 0; i < 6; i++) { const r = 2.9 - i * 0.15; g.ell(x, y, r, r, m); x += cos(ang) * L; y += sin(ang) * L; ang -= (0.6 + A.w * 0.12 + wave(t * 1.8 - i * 0.55) * 0.05 + hu * 0.1) * (1 - A.h) + (i < 3 ? 0.8 : 0.12) * A.h + A.q * 0.03 * i; }   // i hugget rätas svansen ut framåt
  const nx = -sin(ang), ny = cos(ang);
  g.ell(x, y, 3, 3, C.red);
  g.poly([[x + nx * 2, y + ny * 2], [x - nx * 2, y - ny * 2], [x + cos(ang) * 7, y + sin(ang) * 7]], C.red, 5);
  if (a <= 0) { const dr = (t * 0.55) % 1; if (dr < 0.5) g.dot(x + cos(ang) * 7, y + sin(ang) * 7 + 2 + dr * 8, C.moss, 5); }           // det droppar från gadden
  if (ow) { wince(g, -10, -9, false); wince(g, -6, -10, true); }
  else { eye(g, -10, -9, 3, 3, { shut, pw: 1, ph: 2, dy: 1 }); eye(g, -6, -10, 3, 3, { shut, pw: 1, ph: 2, dy: 1, mood: 'arg', inner: -1, lid: m }); }
  g.pop(); g.end();
  g.begin();                                             // närmre klo: öppnas brett, nyper, darrar efteråt
  const cx = -16 + A.w * 2 - A.h * 5 + max(0, hr) * 4, cy = -6.5 + by - A.w * 3 + A.q * 1.5 - max(0, hr) * 3;
  g.thick(-8, -4 + by, cx + 3, cy + 0.5, 2.4, m, 3); claw(g, cx, cy, -1, a > 0 ? (A.h > 0.6 ? 0 : 1 + A.w * 3) : sn, m, 3.6);
  g.end();
  g.pop();
}

// ---------- Kobra: självbelåten ormtjusare som vaggar så att rörelsen vandrar upp längs halsen, huvan fälls ut när den laddar ----------
function snake(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), bel = R(o.belly), shut = blinkAt(t, 6), ow = hu > 0.25;
  const sway = (u) => wave(t * 1.8 - u * 1.7) * 2.4 * u, s1 = sway(1), tl = wave(t * 3.2 - 1) * 1.5;
  const hx = -3 + s1 - A.s * 10 + max(0, hr) * 4, hy = -28 + abs(s1) * 0.3 + A.h * 9 - A.w * 2 + max(0, hr) * 2, hf = 1 + A.w * 0.22 - hu * 0.3 + wave(t * 1.8) * 0.03;
  enter(g, hr, o.k || 1, 0.12);
  g.begin();                                             // hoprullad kropp
  g.poly([[9, -4], [19, -6 + tl], [22, -9 + tl * 1.6], [21, -4 + tl], [10, 0]], m, 2);
  g.ell(1, -4, 12, 4.2, m); g.ell(0, -9.5, 9, 3.8, m);
  for (const x of [-7, -1, 5]) { g.rect(x, -3, 2, 2, m, 1); g.dot(x + 2, -4, m, 5); g.rect(x + 2, -10, 2, 2, m, 1); g.dot(x + 1, -11, m, 5); }
  g.rect(-8, -1, 17, 1, bel, 3);
  g.end();
  g.begin();                                             // hals och huva
  for (let i = 0; i <= 7; i++) { const u = i / 7, x = 1 + (hx + 2) * u + sin(u * PI) * (4 + A.w * 2) + sway(u) - s1 * u, y = -11 + (hy + 16) * u; g.ell(x, y, 3.7, 3.7, m, false, null, 3); g.ell(x - 1.6, y, 1.8, 2.6, bel, false, null, 4); }
  g.ell(hx + 3, hy + 3, 8.5 * hf, 8, m, false, null, 2); g.ell(hx + 3, hy + 3, 8.5 * hf, 8, m, false, (dx, dy, d2) => d2 > 0.74 && dx > 0, 4);
  g.ell(hx + 1, hy + 5, 5 * hf, 6, bel, false, null, 4);
  g.rect(hx + 7 * hf, hy - 1, 2, 2, m, 1); g.rect(hx + 8 * hf, hy + 4, 2, 2, m, 1); for (const y of [3, 6, 9]) g.rect(hx - 2, hy + y, 5, 1, bel, 2);
  g.end();
  g.begin();                                             // huvud
  const bite = a > 0.36 && a < 0.75;
  if (bite) { g.poly([[hx - 2, hy + 1], [hx - 9, hy + 1], [hx - 7, hy + 6], [hx - 1, hy + 5]], C.red, 1); g.rect(hx - 8, hy + 2, 1, 3, C.white, 5); g.rect(hx - 5, hy + 2, 1, 2, C.white, 5); }
  g.ell(hx - 1, hy - 1, 5.6, 4.2, m); g.poly([[hx - 4, hy - 4], [hx - 10, hy], [hx - 4, hy + 2]], m, 4);
  g.dot(hx - 9, hy - 1, m, 1);
  if (ow) wince(g, hx - 6, hy - 3, false); else eye(g, hx - 6, hy - 3, 3, 3, { shut, pw: 1, ph: 2, mood: a > 0 ? 'arg' : 'lomsk', inner: -1, lid: m });
  if (!bite) { g.line(hx - 8, hy + 1, hx - 4, hy + 2, m, 1); g.dot(hx - 3, hy + 1, m, 1); }                                             // snett leende
  const fk = t % 2.1;
  if (a <= 0 && !ow && (fk < 0.14 || (fk > 0.26 && fk < 0.4))) { g.rect(hx - 13, hy + 1, 4, 1, C.red, 3); g.dot(hx - 14, hy, C.red, 3); g.dot(hx - 14, hy + 2, C.red, 3); }   // tungan: två snabba fladder
  g.end();
  g.pop();
}

// ---------- Skelett: skramlig ökenrövare med fladdrande bandana, höftskynke och en pil i skölden, eller stel frusen viking med avbrutet horn, päls och istappsskägg ----------
function skeleton(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), bn = R(o.hex || '#ece4cf'), vk = o.viking, b = step(t, vk ? 1.7 : 2.6);
  const rat = !vk && a <= 0 && ev(t, 3.3, 0.5) > 0 ? (sin(t * 60) > 0 ? 1 : -1) : 0;                                                   // det skallrar till i benen
  const jo = rat || a > 0.05 || hu > 0.25 ? 1 : 0, ux = rnd(A.w * 2 - A.h * 3), sx = ux + rnd(-A.q * 2) + (rat > 0 ? 1 : 0);           // överkroppen lutar, skallen kommer efter
  const Y = -36 + b - max(0, hr) * 6 - (rat ? 1 : 0), hx = -12 + ux - A.h * 2, hy = -22 + b - A.s * 3;
  enter(g, hr, o.k || 1);
  g.begin();                                             // vapenarm
  g.thick(-6 + ux, -29 + b, -10 + ux, -24 + b, 2, bn, 2); g.thick(-10 + ux, -24 + b, hx, hy, 2, bn, 2);
  g.push(hx, hy, -0.45 - A.s * 1.3 - A.q * 0.25);
  if (vk) { g.poly([[-1, 4], [1, 4], [1, -17], [-1, -17]], C.wood, 3); g.poly([[-1, -17], [-8, -20], [-10, -14], [-7, -8], [-1, -10]], C.steel, 4); g.line(-8, -19, -9, -14, C.ice, 5); g.rect(-1.5, -11, 3, 2, C.gold, 3); g.rect(-1.5, -3, 3, 1, C.leather, 2); }
  else { g.poly([[-1.5, -3], [1.5, -3], [1.5, -16], [0, -20], [-1.5, -16]], C.steel, 4); g.rect(0, -12, 2, 2, C.rust, 3); g.rect(-1, -7, 2, 2, C.rust, 3); g.rect(-4, -4, 8, 1.6, C.rust, 3); g.rect(-1, -2.5, 2, 5, C.leather, 3); }
  g.pop(); g.end();
  g.begin();                                             // ben, bäcken, revben
  g.thick(-3, -14, -4.5, -7, 2, bn, 2); g.thick(-4.5, -7, -3, -1, 2, bn, 2); g.rect(-6, -2, 5, 2, bn, 3); g.dot(-5, -7, bn, 5);
  g.thick(3, -14, 3.5, -7, 2, bn, 3); g.thick(3.5, -7, 3, -1, 2, bn, 3); g.rect(1, -2, 5, 2, bn, 3); g.dot(3, -7, bn, 5);
  g.rect(-5, -17, 10, 4, bn, 3); g.rect(-1, -18, 2, 1, bn, 2);
  if (vk) g.rect(-5, -17, 10, 1, C.leather, 3); else g.poly([[-5, -15], [5, -15], [4, -10], [2, -12], [0, -9], [-2, -12], [-4, -10]], C.red, 2);   // bälte eller trasigt höftskynke
  g.ell(ux, -24 + b, 6.5, 6, bn); g.rect(-1 + ux * 0.5, -18, 2, 2, bn, 2);
  for (const y of [-26, -23, -20]) g.rect(-5 + ux, y + b, 10, 1, C.dark, 1);
  g.rect(-1 + ux, -28 + b, 2, 9, bn, 4); g.rect(-7 + ux, -31 + b, 14, 2, bn, 4);
  if (vk) { g.ell(ux + 1, -30.5 + b, 9, 3.4, C.snow, false, null, 4); for (const x of [-6, -1, 4]) g.poly([[x + ux, -29 + b], [x + 2 + ux, -25 + b], [x + 4 + ux, -29 + b]], C.snow, 3); }   // päls över axlarna
  g.end();
  g.begin();                                             // skalle
  if (vk) { g.poly([[-6 + sx, Y - 3], [-10 + sx, Y - 5], [-12 + sx, Y - 12], [-8 + sx, Y - 8], [-4 + sx, Y - 6]], C.bone, 3); g.poly([[5 + sx, Y - 3], [9 + sx, Y - 5], [10 + sx, Y - 8], [7 + sx, Y - 7], [3 + sx, Y - 6]], C.bone, 2); }   // ett horn är avbrutet
  g.rect(-5 + sx, Y + 3, 9, 3 + jo, bn, 3);
  g.ell(-0.5 + sx, Y, 6.6, 6, bn);
  g.rect(-5 + sx, Y - 1, 3, 3, C.dark, 0); g.rect(sx, Y - 2, 3, 4, C.dark, 0);
  if (hu < 0.25) { const gl = floor(t * 0.6) % 4 === 3 ? 1 : 0; g.dot(-5 + sx + gl, Y, vk ? C.ice : C.fire2, 5); g.dot(sx + gl, Y - 1 + gl, vk ? C.ice : C.fire2, 5); }   // glöden i ögonhålorna ser sig om
  g.dot(-2 + sx, Y + 3, C.dark, 0);
  for (let x = -4; x <= 2; x += 2) g.dot(x + sx, Y + 5 + jo, C.dark, 0);
  if (vk) {
    g.ell(-0.5 + sx, Y, 7.2, 6.6, C.steel, true, (dx, dy) => dy < -0.3); g.rect(-7 + sx, Y - 3, 14, 1, C.steel, 2); g.rect(-2 + sx, Y - 2, 2, 3, C.steel, 4); g.dot(-5 + sx, Y - 3, C.gold, 4); g.dot(3 + sx, Y - 3, C.gold, 4);
    const bw = wave(t * 1.7 - 1.2) + A.q * 2 + ux * 0.3;                                                                                // skägget svänger efter
    for (const [x, hh] of [[-4, 4], [-1, 7], [2, 4]]) g.poly([[x - 1 + sx, Y + 6 + jo], [x + 0.5 + sx + bw, Y + 6 + jo + hh], [x + 2 + sx, Y + 6 + jo]], C.ice, 5);
  } else {
    const f = wave(t * 2.6 - 1.2) * 1.5 - A.q * 2 + hu * 2;
    g.rect(-7 + sx, Y - 4, 13, 2, C.red, 3); g.dot(-3 + sx, Y - 4, C.white, 4); g.dot(1 + sx, Y - 3, C.white, 4);
    g.poly([[5 + sx, Y - 4], [11 + sx, Y - 5 + f], [13 + sx, Y - 2 + f], [10 + sx, Y - 1 + f], [5 + sx, Y - 2]], C.red, 2); g.poly([[5 + sx, Y - 3], [9 + sx, Y + 1 + f * 0.6], [11 + sx, Y + 3 + f], [7 + sx, Y + 1]], C.red, 3);
  }
  g.end();
  g.begin();                                             // sköldarm
  const sy = b - rnd(hu * 2);
  g.thick(6 + ux, -29 + b, 8, -22 + sy, 2, bn, 3);
  if (vk) { g.ell(8.5, -19.5 + sy, 6.5, 6.5, R('#4f7fb5')); g.ell(8.5, -19.5 + sy, 6.5, 6.5, C.snow, false, (dx, dy) => dx * dy > 0, 4); g.ell(8.5, -19.5 + sy, 6.5, 6.5, C.steel, false, (dx, dy, d2) => d2 > 0.62, 3); g.ell(8.5, -19.5 + sy, 2, 2, C.steel); }
  else { g.ell(8.5, -19.5 + sy, 6, 6, C.wood); g.ell(8.5, -19.5 + sy, 2, 2, C.steel); g.line(5, -23 + sy, 8, -20 + sy, C.wood, 1); g.line(11, -17 + sy, 15, -13 + sy, C.wood, 4); g.dot(15, -12 + sy, C.red, 4); g.dot(16, -14 + sy, C.red, 4); }   // en pil sitter kvar
  g.end();
  if (vk && a <= 0) { const bp = (t % 3.6) / 1.2; if (bp < 1) { g.begin(); g.rect(-9 + sx - bp * 6, Y + 3 - bp * 3, bp < 0.5 ? 3 : 2, 2, C.snow, 5); g.end({ outline: false, edge: false }); } }   // frostandedräkt
  g.pop();
}

// ---------- Mumie: klumpig sömngångare som snubblar på sin egen binda, med en skarabé i guld på bröstet ----------
function mummy(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R('#d9cfae'), f = wave(t * 3.2 - 1) * 1.5 + A.q * 3, shut = hu > 0.25 || blinkAt(t, 3);
  // Snubblar till då och då: tippar framåt, armarna far upp, och tar sig upp igen med ett litet överslag.
  let st = 0; if (a <= 0) { const x = t % 3.8; st = x < 0.18 ? eIn(x / 0.18) : x < 0.5 ? 1 - eOut((x - 0.18) / 0.32) * 1.25 : x < 0.8 ? -0.25 * (1 - eIO((x - 0.5) / 0.3)) : 0; }
  const ay = -26 + A.s * 8 - st * 5, ax = -15 + A.w * 2 - A.h * 3;
  g.push(hu * 2, 0, hr * 0.2 - 0.08 + wave(t * 1.5) * 0.04 - st * 0.16 + A.w * 0.1 - A.h * 0.12, o.k || 1);
  g.begin(); g.thick(-4, -28, ax, ay - 1, 4, m, 2); g.rect(ax - 3, ay - 3, 4, 5, m, 2); g.end();                                       // bortre arm
  g.begin();                                             // ben och kropp
  g.rect(-6, -13, 5, 13, m, 2); g.rect(1, -13, 5, 13, m, 3); g.rect(-9, -3, 8, 3, m, 2); g.rect(0, -2, 7, 2, m, 3);
  g.rect(6, -1, 8, 1, m, 2); g.rect(13, -2, 4, 1, m, 3);                                                                               // bindan som släpar efter
  g.poly([[-7, -32], [7, -32], [6, -12], [-6, -12]], m, 3);
  for (let y = -29; y < -13; y += 4) g.rect(-7, y, 14, 1, m, 2);
  for (const y of [-9, -5]) { g.rect(-6, y, 5, 1, m, 1); g.rect(1, y + 1, 5, 1, m, 2); }
  g.thick(-6, -30, 5, -19, 1, m, 1);
  g.poly([[5, -19], [11, -17 + f], [16, -20 + f], [16, -17 + f], [11, -14 + f], [5, -15]], m, 4);
  g.rect(-3, -27, 3, 3, C.gold, 3); g.dot(-2, -26, C.ice, 5); g.dot(-4, -28, C.gold, 2); g.dot(0, -28, C.gold, 2);                     // skarabé
  g.end();
  g.begin();                                             // huvud
  g.poly([[3, -43], [9, -46 - f], [12, -43 - f], [8, -42], [5, -40]], m, 4);
  g.ell(-1, -38, 7, 7, m);
  g.rect(-7, -42, 12, 1, m, 2); g.rect(-6, -34, 11, 1, m, 2); g.line(-6, -45, 3, -43, m, 2);
  g.rect(-8, -40, 9, 3, C.dark, 0);
  if (!shut) { g.rect(-6, -40, 2, 2, C.fire2, 5); g.rect(-6, -40, 2, 1, C.dark, 0); }                                                   // ett sömnigt öga
  g.poly([[-3, -41], [1, -41], [1, -37 + rnd(f * 0.4)], [-2, -38]], m, 4);                                                              // en flik hänger för det andra
  g.end();
  g.begin();                                             // närmre arm
  g.thick(4, -28, ax + 5, ay + 1, 4.2, m, 3); g.rect(ax + 2, ay - 1, 4, 5, m, 4);
  g.line(-1, -28, -1, -25, m, 1); g.line(-5, -27, -5, -24, m, 1);
  g.poly([[ax + 4, ay + 3], [ax + 3, ay + 9 + f], [ax + 5, ay + 9 + f], [ax + 6, ay + 3]], m, 4);
  g.end();
  if (a > 0.45) {                                        // bindelpiska: snärtar ut snabbt, dras in mjukt
    g.begin(); const u = (a - 0.45) / 0.55, L = (u < 0.2 ? eOut(u / 0.2) : 1 - eIO((u - 0.2) / 0.8)) * 26; let px = ax - 2, py = ay;
    for (let j = 1; j <= 3; j++) { const qx = ax - 2 - L * j / 3, qy = ay + 1 + sin(j * 1.9 + u * 10) * 2.5 * (j / 3); g.thick(px, py, qx, qy, 2, m, 4); px = qx; py = qy; }
    g.end();
  }
  g.pop();
}

// ---------- Skarabé (pytteliten, i svärm): noshornsbagge i miniatyr som kilar på stället i ryck, vickar på antennen och välter bakåt vid träff ----------
function beetle(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex || '#2f9fb0'), dk = R('#4a4266'), ph = o.ph || 0;
  const run = a <= 0 && ev(t, 2.9, 1.4, ph * 2) > 0, w = run ? step(t, 22, ph) : 0, an = rnd(wave(t * 3 + ph - 1) * 0.8), kick = hu > 0.1 ? step(t, 30) : 0;
  g.push(hu * 2, -max(0, hr) * 3, hr * 0.7 + A.w * 0.3 - A.h * 0.4, o.k || 1);
  g.begin();
  g.line(-3, -2, -5 + w, -kick, dk, 2); g.line(1, -2, 1 - w, 0, dk, 2); g.line(4, -2, 6 + w, -kick, dk, 2);
  if (A.h > 0.1) { const fl = step(t, 40) * 2; g.poly([[1, -6], [5, -12 - fl], [9, -8 - fl]], C.ice, 5); g.poly([[2, -6], [9, -10 + fl], [10, -5]], C.ice, 4); }
  g.ell(1.5, -4.5, 5, 3.8, m); g.line(1, -8, 4, -2, m, 1); g.dot(-1, -7, C.white, 5); g.dot(3, -6, C.gold, 5); g.dot(5, -4, C.gold, 4);
  g.ell(-4.5, -3.5, 2.5, 2.5, dk); g.line(-6, -5, -8, -7, dk, 3); g.dot(-8, -8, dk, 4); g.dot(-4, -7 - an, dk, 3); g.dot(-6, -4, C.white, 5);   // horn och antenn
  g.end();
  g.pop();
}

// ---------- Padda: lat och nöjd, blåser upp strupen sakta och släpper snabbt, följer en fluga med ögonen och tar den ibland ----------
function frog(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R('#6bbf59'), bel = R('#dbe8a2'), shut = blinkAt(t, 8), ow = hu > 0.25;
  const cx = (t * 0.45) % 1, cro = a > 0 ? A.w * 3 : (cx < 0.35 ? eIO(cx / 0.35) : cx < 0.5 ? 1 : cx < 0.58 ? 1 - (cx - 0.5) / 0.08 : 0) * 2.4;
  const sq = A.w * 1.5 - A.h + max(0, hr) * 2.5 - cro * 0.2, q5 = sq * 0.5;                                                            // hur mycket kroppen trycks ihop
  const fc = t % 6.5, fly = a <= 0 && hu <= 0 && fc < 5.5, zap = a <= 0 && fc > 5.36 && fc < 5.56, flx = rnd(3 + cos(t * 2.3) * 7), fly_y = rnd(-20 + sin(t * 3.1) * 1.5);
  enter(g, hr, o.k || 1, 0.12);
  g.begin();
  g.ell(7, -5 + sq * 0.3, 6, 5 - sq * 0.3, m); g.poly([[3, -2], [13, -2], [16, 0], [2, 0]], m, 2); g.dot(15, -1, m, 5);
  g.ell(0, -8 + q5, 10 + q5, 7.5 - q5, m); g.ell(-3, -5, 6.5, 4, bel, false, null, 4); g.ell(-6, -4.5, 3 + cro, 2.5 + cro, bel, false, null, 5);
  g.ell(5, -11 + q5, 2, 1.5, m, false, null, 2); g.ell(1, -13 + q5, 1.5, 1, m, false, null, 2); g.dot(8, -8, m, 5); g.dot(9, -6, m, 2);   // vårtor
  g.thick(-3, -5, -5, -1, 2.6, m, 3); g.rect(-9, -1, 6, 1, m, 3); g.dot(-10, -1, m, 5);
  const ey0 = -14.5 + sq * 0.7, E = rnd(ey0 - 2.5);
  g.ell(-5.5, ey0, 3.6, 3.6, m); g.ell(2, ey0 - 0.5, 3.6, 3.6, m);
  if (ow) { wince(g, -7, E, false); wince(g, 1, E, true); }
  else {                                                 // utan fluga tittar ögonen åt var sitt håll
    eye(g, -8, E, 4, 4, { shut, pw: 2, ph: 2, dx: fly && flx > -2 ? 2 : 0, dy: fly ? 0 : 2 });
    eye(g, 0, E, 4, 4, { shut, pw: 2, ph: 2, dx: fly && flx < 3 ? 0 : 2, dy: 0, mood: fly || a > 0 ? null : 'somnig', lid: m });
  }
  if (a > 0.05 || zap) g.poly([[-10, -10 + q5], [-2, -10 + q5], [-3, -6 + q5], [-9, -7 + q5]], C.dark, 0);
  else { g.rect(-10, -9 + rnd(q5), 10, 1, m, 1); g.dot(0, -10 + rnd(q5), m, 1); }                                                       // nöjt streck till mun
  g.end();
  if (A.h > 0.02) { g.begin(); const L = A.h * 28; g.thick(-8, -8, -8 - L, -9 - A.h * 3, 2, C.pink, 3); g.ell(-9 - L, -9 - A.h * 3, 2.6, 2.6, C.pink); g.end(); }
  if (zap) { g.begin(); g.thick(-6, -9, flx, fly_y, 1.6, C.pink, 3); g.end(); }
  if (fly && !zap) { g.begin(); g.rect(flx, fly_y, 2, 1, C.dark, 0); g.dot(flx + step(t, 40), fly_y - 1, C.white, 5); g.end({ outline: false, edge: false }); }
  g.pop();
}

// ---------- Köttätande växt: glupsk blomma med kronblad i nacken som tuggar i luften, med blad som händer ----------
function plant(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), st = R('#4f9a3e'), hd = R(o.hex || '#d8433b'), shut = blinkAt(t, 9), ow = hu > 0.25;
  const sw = wave(t * 1.5), sw2 = wave(t * 1.5 - 1.1) + A.q * 2;                                                                        // huvudet kommer efter stjälken
  const hx = -6 + sw2 * 2.2 - A.s * 9 + max(0, hr) * 5, hy = -31 + abs(sw2) + A.h * 6 - A.w * 3 - max(0, hr) * 2;
  const ch = t % 2.6, chomp = ch < 0.14 || (ch > 0.3 && ch < 0.44);                                                                     // två snabba hugg, sedan vila
  const op = a > 0 ? (a < 0.42 ? 0.15 + A.w * 0.85 : a < 0.5 ? 1 - (a - 0.42) / 0.08 : a < 0.62 ? 0.02 : 0.02 + (a - 0.62) / 0.38 * 0.2) : ow ? 0.5 : chomp ? 0.04 : 0.24 + wave(t * 2.4) * 0.06;
  const lf = wave(t * 1.5 - 0.6) * 1.5 + A.w * 4 - A.h * 3, pw = sw2 * 0.8 + hu * 3;
  enter(g, hr, o.k || 1, 0.12);
  g.begin();                                             // blad och stjälk
  g.poly([[0, -2], [-12, -10 - lf], [-17, -5 - lf], [-8, 0]], C.leaf, 4); g.line(-3, -3, -13, -8 - lf, C.leaf, 2);
  g.poly([[0, -2], [12, -11 + lf], [18, -6 + lf], [8, 0]], C.leaf, 2); g.line(3, -3, 13, -9 + lf, C.leaf, 1);
  tube(g, [0, -1], [9 + sw * 2, -16], [hx + 8, hy + 3], 2.6, 2.4, st, 10, false, 3);
  g.poly([[5 + sw, -10], [9 + sw, -9], [6 + sw, -7]], st, 5); g.poly([[6 + sw, -20], [10 + sw, -22], [8 + sw, -18]], st, 5);
  g.end();
  g.push(hx + 8, hy + 2, A.w * 0.25 - A.h * 0.2 + hr * 0.4);
  g.begin();                                             // kronblad, gap och underkäke
  for (const p of [[1, -7, 8, -12 + pw, 6, -3], [3, -3, 11, -1 + pw, 3, 3], [1, 3, 8, 10 + pw, -1, 7]]) g.poly([[p[0], p[1]], [p[2], p[3]], [p[4], p[5]]], C.fire2, 4);
  g.poly([[0, 0], [-22 * cos(op), -22 * sin(op)], [-22 * cos(op), 22 * sin(op)]], C.red, 1);
  g.push(0, 0, -op); g.poly([[1, 0], [-22, 0], [-21, 4], [-15, 8], [-5, 8], [1, 4]], hd, 2);
  for (let x = -20; x < -3; x += 4) g.poly([[x, 0], [x + 1.5, -3], [x + 3, 0]], C.white, 5);
  if (a <= 0 && !chomp) g.rect(-17, 8, 1, 2 + step(t, 2), C.ice, 5);                                                                    // dregel
  g.pop(); g.end();
  g.begin();                                             // överkäke
  g.push(0, 0, op); g.poly([[1, 0], [-22, 0], [-22, -4], [-17, -9], [-6, -11], [1, -6]], hd, 3);
  for (let x = -22; x < -5; x += 4) g.poly([[x, 0], [x + 1.5, 3], [x + 3, 0]], C.white, 5);
  for (const [x, y, r] of [[-5, -8, 2], [-17, -6, 1.4], [-1, -3, 1.4]]) g.ell(x, y, r, r * 0.8, C.white, false, null, 5);
  if (ow) wince(g, -11, -6, false); else { eye(g, -12, -6, 4, 4, { shut, pw: 2, ph: 2, dx: 0, dy: 2, col: C.fire2 }); g.line(-13, -8, -8, -7, hd, 1); }
  g.pop(); g.end();
  g.begin(); g.ell(1, 0, 3, 3.4, C.leaf); g.end();
  g.pop();
  g.pop();
}

// ---------- Spöke: blygt irrbloss med svans som bär en gungande lykta på en pinne, eller högfärdigt slottsspöke med krona och guldkedja som retas ----------
function ghost(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), wisp = o.kind === 'wisp', shut = blinkAt(t, 1), ow = hu > 0.25;
  // Svävar i en lat åtta, och fållen böljar som en våg som vandrar bakåt.
  const dx = wave(t * 0.9) * (wisp ? 2.5 : 1.2), hov = (o.hov || 8) + wave(t * 1.8) * 2 + A.w * 2 - A.h * 2, wv = t * 4;
  const tease = !wisp && a <= 0 && hu <= 0 ? ev(t, 5, 1.7) : 0, wag = tease > 0.2 ? step(t, 14) : 0, r = -A.w * 2 + A.h * 8 + tease * 7;   // slottsspöket retas: tungan ut, händerna viftar vid öronen
  g.push(hu * 2 + rnd(dx) + A.w * 3 - A.h * 4, -rnd(hov), hr * 0.25 + A.w * 0.1 - A.h * 0.12, (o.k || 1) * (1 + A.w * 0.14 + A.h * 0.05 - max(0, hr) * 0.1));
  g.begin();
  if (wisp) { const f = sin(t * 9) * 1.5; g.poly([[-5, -19], [-3 + hu * 2, -25 + f], [0, -22], [2 + hu * 4, -29 - f], [5, -19]], m, 5); }
  if (wisp) g.poly([[-6, -11], [-12, -12 - A.h * 2], [-12, -9 - A.h * 2], [-6, -6]], m, 4);
  else g.poly([[-6, -11], [-13, -13 - r + wag], [-12, -9 - r + wag], [-6, -6]], m, 4);
  g.poly([[6, -11], [12, -13 - r - wag], [13, -9 - r - wag], [6, -6]], m, 2);
  const hem = [[-8, -13], [8, -13]];
  if (wisp) { const tw = wave(t * 1.8 - 1.4) * 2 + A.q * 3; hem.push([11, -6], [15 + tw * 0.5, 3 + tw], [9, 1]); }                    // svansen slänger efter
  for (let i = wisp ? 1 : 0; i <= 4; i++) hem.push([8 - i * 4 + (i === 0 ? 3 : 0), (i % 2 ? -2 : 2) + sin(wv - i * 1.3) * 1.4]);
  g.ell(0, -13, 8, 8, m); g.poly(hem, m, 3); g.rect(-8, -13, 3, 9, m, 4); g.rect(5, -13, 3, 10, m, 2);
  if (wisp) { g.ell(1, -7, 3.5, 2.6, m, false, null, 5); g.dot(-7, -11, C.pink, 3); g.dot(3, -11, C.pink, 3); }
  else { g.line(-6, -5, -1, -3, C.gold, 3); g.line(-1, -3, 4, -5, C.gold, 3); g.rect(-2, -3, 2, 2, C.red, 4); }                         // guldkedja
  if (ow) { wince(g, -6, -15, false); wince(g, -1, -15, true); }
  else if (shut) { g.rect(-6, -14, 3, 1, C.dark, 0); g.rect(-1, -14, 3, 1, C.dark, 0); }
  else if (tease > 0.2) { for (const x of [-6, -1]) { g.dot(x, -13, C.dark, 0); g.dot(x + 1, -14, C.dark, 0); g.dot(x + 2, -13, C.dark, 0); } }   // glada bågar
  else if (wisp) { g.ell(-4.5, -14, 1.7, 2.5, C.dark, false, null, 0); g.ell(0.5, -14, 1.7, 2.5, C.dark, false, null, 0); g.dot(-5, -16, C.white, 5); g.dot(0, -16, C.white, 5); }
  else { g.ell(-4.5, -13.5, 1.7, 1.8, C.dark, false, null, 0); g.ell(0.5, -13.5, 1.7, 1.8, C.dark, false, null, 0); g.dot(-5, -14, C.white, 5); g.dot(0, -14, C.white, 5); g.line(-6, -17, -3, -16, m, 1); g.line(-1, -16, 2, -17, m, 1); }
  const mo = A.w * 0.5 + A.h;
  if (wisp || a > 0) g.ell(-2.5, -8.5, 1.6 + mo * 1.5, 1.4 + mo * 2.4, C.dark, false, null, 0); else g.rect(-4, -9, 4, 1, C.dark, 0);
  if (!wisp && (tease > 0.2 || a > 0.4)) g.rect(-4, -8, 3, 3 + wag, C.pink, 3);
  g.end();
  if (!wisp) {                                           // kronan hoppar till och landar snett
    g.begin(); g.push(1, -20 - max(0, hr) * 5 - max(0, A.q) * 2, 0.2 + wave(t * 1.8 - 1) * 0.07 + hu * 0.3);
    g.rect(-5, -3, 10, 3, C.gold, 3); for (const x of [-5, -1.5, 2]) g.poly([[x, -3], [x + 1.5, -7], [x + 3, -3]], C.gold, 4); g.dot(0, -2, C.red, 4); g.dot(-4, -2, C.ice, 4);
    g.pop(); g.end();
  } else {                                               // lyktan hänger i pinnen och gungar efter
    const ly = -12 - A.h * 2, sw = wave(t * 1.8 - 1.2) * 0.25 + A.w * 0.6 - A.h * 0.9 - A.q * 0.8;
    g.begin(); g.thick(-10, ly + 1, -14, ly - 3, 1.2, C.wood, 3);
    g.push(-14, ly - 3, sw); g.rect(-1.5, 1, 3, 1, C.gold, 2); g.rect(-2.5, 2, 5, 6, C.gold, 3); g.rect(-1.5, 3, 3, 4, C.fire2, 5); g.dot(-1, 4 + step(t, 7), C.white, 5); g.pop();
    g.end();
    if (a > 0.47 && a < 0.66) { g.begin(); for (let i = 0; i < 6; i++) { const an = i * 1.05 + 0.4, r0 = 6, r1 = 9 + (a - 0.47) * 20; g.line(-15 + cos(an) * r0, ly + 3 + sin(an) * r0, -15 + cos(an) * r1, ly + 3 + sin(an) * r1, C.fire2, 5); } g.end({ outline: false, edge: false }); }   // lyktan blixtrar till
  }
  g.pop();
}

// ---------- Krabba: vinkarkrabba med en jätteklo som går i sidled i ryck (mossa, havstulpaner och svamp på skalet), eller magmakrabba med rykande vulkan på ryggen ----------
function crab(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), mag = o.kind === 'magma', shut = blinkAt(t, 2), ow = hu > 0.25, hide = max(0, hr);
  const ph = (t * (mag ? 0.4 : 0.6)) % 1, mv = a <= 0 && (ph < 0.15 || (ph > 0.5 && ph < 0.65));                                        // två steg i sidled, paus, två steg tillbaka
  const sx = a > 0 ? 0 : ph < 0.15 ? -1.5 + 3 * eIO(ph / 0.15) : ph < 0.5 ? 1.5 : ph < 0.65 ? 1.5 - 3 * eIO((ph - 0.5) / 0.15) : -1.5;
  const c = t % 2.2, clack = c < 0.1 || (c > 0.24 && c < 0.34), dip = rnd(A.w * 2 - A.h + hide * 2);
  g.push(hu * 2 + rnd(sx) + A.w * 2 - A.h * 3, 0, hr * 0.1, o.k || 1);
  g.begin();                                             // ben
  for (let i = 0; i < 3; i++) for (const sd of [-1, 1]) { const w = mv ? sin(t * 26 + i * 2 + sd) : 0; g.thick(sd * (6 + i * 2), -6 + dip, sd * (12 + i * 2) + w, -9 + i * 1.5 + dip * 0.5, 1.6, m, 2); g.thick(sd * (12 + i * 2) + w, -9 + i * 1.5 + dip * 0.5, sd * (14 + i * 2.5) + w, 0, 1.6, m, 2); }
  g.end();
  g.begin(); g.thick(9, -9 + dip, 14, -13 + dip, 2.2, m, 2); claw(g, 16, -15.5 + dip, -1, a > 0 ? A.w * 2 : clack ? 2 : 0.5, m, 3.2, 2); g.end();   // bortre klo: liten
  g.begin();                                             // skal
  g.push(0, dip);
  if (mag) { const f = sin(t * 8) * 1.5; g.poly([[6, -21], [7, -26 + f], [9, -23], [11, -28 - f], [13, -21]], C.fire2, 4); g.poly([[3, -12], [6, -21], [13, -21], [16, -11]], R('#5a4a52'), 3); g.rect(7, -21, 5, 1, C.fire, 5); g.line(8, -20, 7, -15, C.fire2, 4); }
  const st = [[-6, -5], [1, 2]].map(([bx, tx], i) => [bx, tx + wave(t * 1.6 - i * 1.1) * 1.2, -18 + hide * 4 + wave(t * 2.1 - i) * 0.6]);  // ögonskaften vajar var för sig
  for (const [bx, tx, ty] of st) g.thick(bx, -13, tx, ty, 1.6, m, 3);
  g.ell(0, -8, 12, 7, m); g.ell(0, -5.5, 10, 3.5, R(o.belly || '#ecd9b0'), false, (dx, dy) => dy > 0.1, 4);
  if (mag) { g.line(-8, -11, -5, -9, C.fire2, 5); g.line(-5, -9, -6, -7, C.fire2, 5); g.line(8, -10, 6, -8, C.fire2, 5); g.line(1, -13, 3, -10, C.fire2, 4); }
  else {
    g.ell(5, -13, 6, 3, C.moss, false, null, 3); g.rect(6, -18, 2, 4, C.bone, 3); g.ell(7, -18.5, 3.6, 2.4, C.red, true, (dx, dy) => dy < 0.4); g.dot(6, -20, C.white, 5);
    g.ell(-7, -11, 1.8, 1.4, C.bone, false, null, 4); g.dot(-7, -11, C.dark, 1); g.ell(-3, -13, 1.4, 1.1, C.bone, false, null, 3);        // havstulpaner
    const bq = (t * 0.6) % 1; if (bq < 0.7 && a <= 0) g.dot(-10 - bq * 3, -8 - bq * 8, C.white, 5);                                      // en bubbla ur munnen
  }
  st.forEach(([bx, tx, ty], i) => {
    const ex = rnd(tx - 2), ey = rnd(ty - 3);
    if (ow) wince(g, ex, ey, i === 1); else eye(g, ex, ey, 3, 3, { shut, pw: 1, ph: 2, dx: floor(t * 0.5 + i * 0.4) % 3 === 2 ? 2 : 0, mood: mag ? 'arg' : null, inner: i ? -1 : 1, lid: m });
  });
  g.rect(-7, -7, 6, 1, C.dark, 0); g.dot(-8, -8, C.dark, 0); g.dot(-1, -8, C.dark, 0);
  g.pop(); g.end();
  if (mag && a <= 0) { g.begin(); for (let i = 0; i < 2; i++) { const q = (t * 0.45 + i * 0.5) % 1; g.ell(10 + q * 3, -28 - q * 5 + dip, 1.2 + q * 1.4, 1 + q * 0.8, C.smoke, false, null, q < 0.6 ? 4 : 3); } g.end({ outline: false, edge: false }); }   // rökpuffar
  g.begin();                                             // närmre klo: stor. Öppnas, nyper, darrar efteråt, och hålls för ansiktet vid träff
  const R5 = mag ? 5 : 5.8, cx = -18 + A.w * 3 - A.h * 8 + hide * 5, cy = -13 + dip - A.w * 5 + A.h * 3 + A.q * 1.5 + hide * 3;
  g.thick(-10, -8 + dip, cx + 3, cy + 2, 2.6, m, 3); claw(g, cx, cy, -1, a > 0 ? (A.h > 0.7 ? 0 : 1.5 + A.w * 4) : clack ? 0 : 2.5, m, R5);
  if (mag) g.dot(cx - R5 * 2, cy - 2, C.fire2, 5);
  g.end();
  g.pop();
}

// ---------- Pingvinvakt: viktig liten soldat som vaggar på stället, med medalj, vimpel på spjutet och en hjälm som glider efter ----------
function penguin(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), ph = o.ph || 0, shut = blinkAt(t, ph), ow = hu > 0.25;
  const wd = a > 0 ? 0 : wave(t * 4 + ph), rock = wd * 0.08, lf = wd > 0.4 ? 1 : 0, rf = wd < -0.4 ? 1 : 0;                              // vaggar: en fot i taget lyfter
  const salute = a <= 0 && hu <= 0 ? ev(t, 6.3, 1.2, ph * 2) : 0, hl = rnd(wave(t * 4 + ph - 1.3) * 0.7) - rnd(max(0, hr) * 4), fl = wave(t * 4 + ph - 1.6) * 1.5 + A.q * 3;
  g.push(hu * 2, 0, hr * 0.15 + rock + A.w * 0.18 - A.h * 0.22, o.k || 1);
  g.begin();                                             // spjut med vimpel
  g.push(-8 + A.w * 3 - A.h * 7, -8 - A.w * 2, -0.22 - rock + A.w * 0.5 - A.h * 1.25 - A.q * 0.15);
  g.poly([[-0.8, 6], [0.8, 6], [0.8, -15], [-0.8, -15]], C.wood, 3); g.poly([[0, -22], [2.6, -15], [-2.6, -15]], C.ice, 5); g.rect(-1.5, -15, 3, 1, C.gold, 3);
  g.poly([[0.8, -14], [5, -12 + fl], [0.8, -10]], C.red, 3);
  g.pop(); g.end();
  g.begin();
  g.rect(-5, -2 - lf, 4, 2, C.orange, 3); g.rect(1, -2 - rf, 4, 2, C.orange, 3);
  g.poly([[5, -5], [9, -2], [5, -1]], C.navy, 2);                                                                                       // stjärt
  g.ell(0, -10, 7, 9.5, C.navy); g.ell(-2, -8, 4.6, 6.8, C.snow, false, null, 5);
  g.poly([[5, -13], [9, -6 - hu * 4], [6, -5]], C.navy, 2);
  g.poly([[-5, -11], [-9, -8 - salute * 9 - hu * 5], [-6, -7 - salute * 3]], C.navy, 4);                                                // gör honnör ibland
  g.dot(-2, -11, C.red, 4); g.dot(-2, -10, C.gold, 5);                                                                                  // medalj
  g.poly([[-6, -14.5], [-10, -13 - (a > 0.3 ? 1 : 0)], [-6, -12.5]], C.orange, 4); if (a > 0.3) g.poly([[-6, -12.5], [-9, -11.5], [-6, -11]], C.orange, 2);
  if (ow) { wince(g, -5, -18, false); wince(g, -1, -18, true); }
  else if (shut) { g.rect(-5, -16, 2, 1, C.white, 5); g.rect(-1, -16, 2, 1, C.white, 5); }
  else { g.rect(-5, -17, 2, 2, C.white, 5); g.dot(-5, -16, C.dark, 0); g.rect(-1, -17, 2, 2, C.white, 5); g.dot(-1, -16, C.dark, 0); }
  g.dot(-3, -14, C.pink, 3);
  g.ell(0, -17.5 + hl, 6.4, 4.6, C.steel, true, (dx, dy) => dy < 0.1); g.rect(-6, -18 + hl, 13, 1, C.steel, 2); g.poly([[-1, -21 + hl], [0.5, -25 + hl], [2, -21 + hl]], C.steel, 5); g.dot(3, -20 + hl, C.steel, 1);
  g.end();
  g.pop();
}

// ---------- Snögubbe: glad busunge som jonglerar med en snöboll, med sned hatt, lång halsduk och bollar som gungar efter varandra ----------
function snowman(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), shut = blinkAt(t, 4), ow = hu > 0.25;
  const f = wave(t * 3 - 1) * 1.5 + A.q * 3 + hu * 3, b1 = step(t, 2.2), b2 = step(t, 2.2, -0.8);                                        // mittbollen och huvudet gungar efter varandra
  const lean = A.w * 3 - A.h * 3, m1 = rnd(lean * 0.5 + hr * 2), m2 = rnd(lean + hr * 5 - A.q * 2);
  const ax = -14 + m1 + A.w * 12 - A.h * 2, ay = -25 + b1 - A.w * 10 + A.h * 6;                                                          // kastarmen: bakåt och upp, sedan fram och ner
  enter(g, hr, o.k || 1, 0.06);
  g.begin();                                             // pinnarmar
  g.thick(-6 + m1, -22 + b1, ax, ay, 1.6, C.wood, 3);
  const bx = 15 + m1 - A.w * 2, by = -26 + b1 + f * 0.5 + A.w * 6 - A.h * 5;
  g.thick(6 + m1, -21 + b1, bx, by, 1.6, C.wood, 2); g.line(bx, by, bx + 3, by - 3, C.wood, 2); g.line(bx, by, bx + 3, by + 1, C.wood, 2);
  g.end();
  g.begin(); g.ell(0, -9, 11, 9.5, C.snow); g.end();
  g.begin(); g.ell(m1, -22 + b1, 8, 7, C.snow); g.rect(-5 + m1, -24 + b1, 2, 2, C.dark, 0); g.rect(-6 + m1, -19 + b1, 2, 2, C.dark, 0); g.end();
  g.begin();                                             // huvud, halsduk, hatt
  const hy = b2;
  g.ell(-0.5 + m2, -32 + hy, 6, 5.6, C.snow);
  g.rect(-6 + m1, -28 + b1, 12, 2, C.red, 3); g.dot(-3 + m1, -28 + b1, C.white, 4); g.dot(1 + m1, -27 + b1, C.white, 4);
  g.poly([[4 + m1, -28 + b1], [10 + m1, -27 + f], [13 + m1, -21 + f * 1.4], [9 + m1, -21 + f * 1.4], [6 + m1, -26 + b1]], C.red, 2);
  g.push(m2, -37 + hy - max(0, hr) * 4, -0.14 + hu * 0.3);
  g.rect(-7, -1, 13, 2, C.dark, 2); g.rect(-4, -7, 8, 6, C.dark, 3); g.rect(-4, -3, 8, 1, C.red, 3); g.dot(3, -3, C.leaf, 4); g.dot(4, -4, C.red, 5);
  g.pop();
  g.poly([[-5 + m2, -33 + hy], [-12 + m2, -31.5 + hy], [-5 + m2, -30.5 + hy]], C.orange, 4);
  if (ow) { wince(g, -5 + m2, -36 + hy, false); wince(g, -1 + m2, -36 + hy, true); }
  else if (shut) { g.rect(-4 + m2, -35 + hy, 2, 1, C.dark, 0); g.rect(m2, -35 + hy, 2, 1, C.dark, 0); }
  else { g.rect(-4 + m2, -35 + hy, 2, 2, C.dark, 0); g.rect(m2, -35 + hy, 2, 2, C.dark, 0); g.line(-5 + m2, -37 + hy, -3 + m2, -36 + hy, C.wood, 2); g.line(m2, -37 + hy, 2 + m2, -38 + hy, C.wood, 2); }   // ett ögonbryn i vädret
  if (a > 0.3 && a < 0.7) g.rect(-3 + m2, -30 + hy, 2, 2, C.dark, 0);
  else { g.dot(-5 + m2, -30 + hy, C.dark, 0); g.dot(-3 + m2, -29 + hy, C.dark, 0); g.dot(-1 + m2, -29 + hy, C.dark, 0); g.dot(1 + m2, -31 + hy, C.dark, 0); }   // snett kolflin
  g.end();
  g.begin();                                             // vante och snöboll: jonglerar i vila, kastar i attacken
  g.ell(ax, ay, 2.2, 2.2, C.red);
  if (a > 0.47) { const u = (a - 0.47) / 0.53; if (u < 0.95) g.ell(-18 - eOut(u) * 40, -24 - sin(u * PI) * 9 + u * 9, 3.2, 3.2, C.snow); }
  else if (a > 0) g.ell(ax - 1, ay - 4, 3.2, 3.2, C.snow);
  else { const j = (t % 1.5) / 1.5; g.ell(ax - 1, ay - 4 - (j < 0.7 ? sin(j / 0.7 * PI) * 9 : 0), 3.2, 3.2, C.snow); }
  g.end();
  g.pop();
}

// ---------- Yeti: sömnig jätte i nattmössa som nickar till, rycker upp sig och somnar om ----------
function yeti(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), fur = C.snow, skin = R('#7fb2d9'), capc = R('#b8506e'), br = wave(t * 1.4);
  // Huvudet sjunker sakta, ögonen faller ihop, och så rycker han till.
  const x = t % 7, doze = a <= 0 && hu <= 0, nod = !doze ? 0 : x < 4 ? eIO(x / 4) : x < 4.15 ? 1 - (x - 4) / 0.15 : 0, wide = !doze || (x > 4.05 && x < 4.9);
  const shut = nod > 0.6 || blinkAt(t, 4), ow = hu > 0.25, hdx = rnd(-nod * 2 - A.h * 2 + A.w * 2), hdy = rnd(nod * 3 - max(0, hr) * 3 - br * 0.5);
  const arm = (ax, ay2, ang, lv) => {
    g.push(ax, ay2, ang); tube(g, [0, 0], [-1, 16], [-3, 31], 6.5, 5.5, fur, 5);
    for (const yy of [8, 20]) g.poly([[3, yy], [9, yy + 4], [3, yy + 6]], fur, lv);
    g.ell(-3, 35, 6.5, 5, skin); g.pop();
  };
  enter(g, hr, o.k || 1, 0.1);
  g.begin(); arm(-15, -41 - br * 0.5, 0.25 + A.s * 1.5 - A.q * 0.2, 2); g.end();
  g.begin();                                             // ben
  g.rect(-15, -15, 12, 12, fur, 2); g.rect(4, -15, 12, 12, fur, 3);
  g.poly([[-20, 0], [-19, -5], [-4, -5], [-3, 0]], skin, 3); g.poly([[1, 0], [2, -5], [18, -5], [19, 0]], skin, 3);
  for (const tx of [-18, -13, -8, 3, 8, 13]) g.dot(tx, -1, skin, 1);
  g.end();
  g.begin();                                             // kropp och huvud i ett
  for (const [fx, fy, dx, dy] of [[-19, -24, -5, 4], [-18, -34, -6, 3], [20, -22, 5, 5], [20, -34, 6, 3], [14, -46, 6, -2], [-2, -11, -2, 6], [8, -11, 2, 6]]) g.poly([[fx, fy - 3], [fx + dx, fy + dy], [fx, fy + 4]], fur, 3);
  g.ell(1, -30 - br * 0.6, 20, 21 + br * 0.6, fur);
  g.ell(-4, -24, 10, 9, fur, false, null, 4);                                                                                            // ljusare mage
  g.poly([[-12 + hdx, -58 + hdy], [-15 + hdx, -65 + hdy], [-7 + hdx, -60 + hdy]], skin, 2); g.poly([[1 + hdx, -59 + hdy], [6 + hdx, -66 + hdy], [7 + hdx, -58 + hdy]], skin, 2);
  g.ell(-5 + hdx, -50 + hdy, 12.5, 11, fur);
  for (const [lx, ly] of [[-6, -26], [2, -20], [-10, -17], [8, -30], [-1, -33]]) { g.line(lx, ly, lx + 2, ly + 2, fur, 2); g.line(lx + 2, ly + 2, lx + 4, ly, fur, 2); }
  g.end();
  g.begin();                                             // ansikte: sömnig, en tand sticker upp
  const fx = -9 + hdx, fy = -48 + hdy;
  g.ell(fx, fy, 8.5, 7.5, skin, 0.75);
  if (ow) { wince(g, fx - 5, fy - 4, false); wince(g, fx + 1, fy - 4, true); }
  else { const mood = wide ? null : 'somnig'; eye(g, fx - 6, fy - 4, 4, 4, { shut, mood, lid: skin, pw: 2, ph: 2 }); eye(g, fx + 1, fy - 4, 4, 4, { shut, mood, lid: skin, pw: 2, ph: 2 }); }
  g.rect(fx - 4, fy + 1, 3, 2, skin, 1);
  const mo = a > 0.05 ? 1 + A.w * 2 + A.h * 3 : wide && doze ? 2 : 0;
  g.rect(fx - 6, fy + 4, 10, 1 + mo, C.dark, 0); g.rect(fx - 4, fy + 2 + mo, 2, 3, C.white, 5); g.rect(fx + 1, fy + 3 + mo, 2, 2, C.white, 5);
  g.end();
  g.begin();                                             // nattmössa: toppen hänger och slänger efter
  const cl = wave(t * 1.4 - 1.3) * 1.5 + nod * 3 + A.q * 4 - max(0, hr) * 6, tx = 12 + hdx, ty = -47 + hdy + cl;
  g.poly([[-14 + hdx, -56 + hdy], [-9 + hdx, -61 + hdy], [0 + hdx, -62 + hdy], [7 + hdx, -58 + hdy], [tx, ty], [tx - 3, ty + 1], [3 + hdx, -54 + hdy], [-13 + hdx, -53 + hdy]], capc, 3);
  g.line(-8 + hdx, -60 + hdy, -6 + hdx, -55 + hdy, C.white, 4); g.line(-1 + hdx, -61 + hdy, 1 + hdx, -55 + hdy, C.white, 4); g.line(6 + hdx, -57 + hdy, 5 + hdx, -53 + hdy, C.white, 4);
  g.rect(-14 + hdx, -55 + hdy, 17, 2, C.white, 4); g.ell(tx - 1, ty + 2, 2.6, 2.6, C.white);
  g.end();
  g.begin(); arm(19, -40 - br * 0.5, -0.12 + A.s * 1.2 - A.q * 0.2, 3); g.end();
  if (nod > 0.35) { g.begin(); for (let i = 0; i < 2; i++) { const u = ((t * 0.5 + i * 0.5) % 1); glyph(g, rnd(-24 - u * 6 - i * 2), rnd(-58 - u * 8), LETTER_Z, C.white, u < 0.6 ? 5 : 3, 1); } g.end({ outline: false, edge: false }); }   // zzz
  g.pop();
}

// ---------- Imp: fnissande busfrö med treudd och svans som slår som en katts, eller tjurig stengargoyle med tunga vingar, mossa och en naggad hornspets ----------
function imp(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), fly = o.fly, b = step(t, fly ? 1.8 : 3), shut = blinkAt(t, 3), ow = hu > 0.25;
  const sp = fly ? 4.2 : 8, f1 = a > 0 ? -A.w * 4 + A.h * 4 : wave(t * sp) * 3, f = f1 + (a > 0 ? A.q * 3 : wave(t * sp - 0.9) * 2);    // vingspetsen kommer efter
  const gig = !fly && a <= 0 && hu <= 0 && ev(t, 4.7, 1.2) > 0, sh = gig ? step(t, 24) : 0;                                              // fnissar: axlarna skakar, handen för munnen
  const hov = fly ? 12 + wave(t * 2.1) * 2 - f1 * 0.4 + A.w * 3 - A.h * 5 : 0, cr = fly ? 0 : rnd(A.w * 1.5 - A.h), Y = -17 + b + cr - sh;
  g.push(hu * 2, -hov, hr * 0.15 + A.w * 0.1 - A.h * 0.15, o.k || 1);
  g.begin();                                             // vingar och svans
  if (fly) {
    g.poly([[3, -13], [8, -26 + f1], [15, -32 + f], [24, -28 + f], [20, -24 + f], [26, -18 + f], [19, -17 + f * 0.5], [21, -10], [14, -13], [10, -8]], m, 1); g.thick(3, -13, 8, -26 + f1, 1.6, m, 3); g.thick(8, -26 + f1, 24, -28 + f, 1.4, m, 3); g.thick(8, -26 + f1, 26, -18 + f, 1.2, m, 3);
    g.poly([[-3, -13], [-8, -25 + f1], [-14, -31 + f], [-22, -27 + f], [-18, -23 + f], [-23, -18 + f], [-17, -17 + f * 0.5], [-19, -11], [-12, -13], [-9, -9]], m, 2); g.thick(-3, -13, -8, -25 + f1, 1.6, m, 4); g.thick(-8, -25 + f1, -22, -27 + f, 1.4, m, 4);
  } else g.poly([[3, -13], [10, -22 + f1], [17, -17 + f], [13, -13 + f * 0.5], [15, -8], [5, -9]], m, 1);
  const tw1 = wave(t * 3) * 2 + hu * -3, tw2 = wave(t * 3 - 1.1) * 2.5 + A.q * 3;
  g.thick(3, -5 + cr, 9, -3, 1.6, m, 2); g.thick(9, -3, 13 + tw2 * 0.4, -8 + tw1, 1.6, m, 2); g.poly([[11 + tw2 * 0.6, -9 + tw1], [14 + tw2, -13 + tw1], [16 + tw2 * 0.6, -8 + tw1]], m, 4);
  g.end();
  g.begin();                                             // arm och treudd, eller klor
  if (fly) { const cx = -9 + A.w * 2 - A.h * 5, cy = -10 + cr - A.w * 4 + A.h * 4; g.thick(-3, -11, cx, cy, 2.4, m, 3); for (const d of [-2, 0, 2]) g.line(cx, cy + d * 0.6, cx - 3, cy + d + A.h, C.bone, 5); }
  else {
    const hx = -8 + A.w * 2 - A.h * 3, hy = -9 + cr - A.w * 2 + A.h;
    g.thick(-3, -11 + cr, hx, hy, 2.2, m, 2);
    g.push(hx, hy, -0.25 + wave(t * 3 - 0.5) * 0.06 + A.w * 0.7 - A.h * 1.25 - A.q * 0.2);
    g.poly([[-0.8, 5], [0.8, 5], [0.8, -15], [-0.8, -15]], C.dark, 2); g.rect(-3.5, -16, 7, 1.4, C.steel, 4);
    for (const px of [-3.5, -0.7, 2.1]) g.poly([[px, -16], [px + 0.7, -21 - (px === -0.7 ? 2 : 0)], [px + 1.4, -16]], C.steel, 5);
    g.pop();
  }
  g.end();
  g.begin();                                             // kropp
  g.rect(-4, -4, 3, 4, m, 2); g.rect(1, -4, 3, 4, m, 3); g.rect(-5, -1, 4, 1, C.dark, 1); g.rect(1, -1, 4, 1, C.dark, 1);
  g.ell(0, -8.5 + cr - sh, 4.6, 5.5, m); g.ell(-1, -7.5 + cr - sh, 2.6, 3.4, fly ? m : C.orange, false, null, fly ? 4 : 3);
  if (fly) { g.ell(2, -11, 2.4, 1.5, C.moss, false, null, 3); g.line(-2, -6, 0, -4, m, 1); g.line(0, -4, -1, -2, m, 1); }                 // mossa och en spricka
  else if (gig) g.thick(3, -10 + cr, -3, Y + 4, 2, m, 4);                                                                               // handen för munnen
  else g.thick(3, -10 + cr, 5, -6 + cr, 2, m, 4);
  g.end();
  g.begin();                                             // huvud
  g.poly([[-5, Y - 3], [-8, Y - 10], [-2, Y - 5]], C.bone, 4);
  if (fly) g.poly([[3, Y - 4], [6, Y - 7], [5, Y - 8], [7, Y - 8], [6, Y - 2]], C.bone, 2); else g.poly([[3, Y - 4], [8, Y - 9], [6, Y - 2]], C.bone, 2);   // ena hornet är naggat eller snett
  g.poly([[5, Y - 1], [11, Y - 4 + rnd(tw1 * 0.4)], [6, Y + 2]], m, 2);
  g.ell(-0.5, Y, 7, 6, m);
  if (ow) { wince(g, -6, Y - 2, false); wince(g, -1, Y - 2, true); }
  else if (fly) { eye(g, -6, Y - 2, 3, 3, { shut, col: C.ice, mood: 'arg', inner: 1, pw: 1, ph: 2, lid: m }); eye(g, -1, Y - 2, 3, 3, { shut, col: C.ice, mood: 'arg', inner: -1, pw: 1, ph: 2, lid: m }); }
  else if (gig) { for (const ex of [-6, -1]) { g.dot(ex, Y - 1, C.dark, 0); g.dot(ex + 1, Y - 2, C.dark, 0); g.dot(ex + 2, Y - 1, C.dark, 0); } }
  else { eye(g, -6, Y - 2, 3, 3, { shut, col: C.fire2, mood: 'lomsk', lid: m, pw: 1, ph: 2 }); eye(g, -1, Y - 2, 3, 3, { shut, col: C.fire2, mood: 'lomsk', lid: m, pw: 1, ph: 2 }); }
  if (fly) { g.rect(-6, Y + 3, 6, 1, C.dark, 0); g.rect(-5, Y + 1, 1, 2, C.white, 5); g.rect(-2, Y + 1, 1, 2, C.white, 5); g.dot(3, Y - 4, m, 1); g.dot(2, Y + 3, m, 1); }   // underbett
  else if (!gig) { g.rect(-6, Y + 2, 7, 2, C.white, 5); for (const mx of [-4, -2, 0]) g.dot(mx, Y + 3, C.dark, 0); g.dot(-7, Y + 1, C.dark, 0); g.dot(1, Y + 1, C.dark, 0); if (a > 0.4) g.rect(-4, Y + 4, 2, 2, C.pink, 3); }
  g.end();
  if (fly && a <= 0) { const q = (t * 0.6) % 1; if (q < 0.6) { g.begin(); g.dot(6, -3 + q * 14, m, 2); g.dot(-4, -1 + q * 11, m, 3); g.end({ outline: false, edge: false }); } }   // det smular om stenen
  g.pop();
}

// ---------- Eldande: dansande låga vars topp slickar efter, som nästan slocknar ibland och flammar upp igen ----------
function flame(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), shut = blinkAt(t, 5), ow = hu > 0.25, fl = (i) => sin(t * 9 + i * 2.1) * 1.6;
  const gut = a <= 0 ? ev(t, 5.5, 0.6) : 0, H = 1 - gut * 0.4 - A.w * 0.22 + A.h * 0.3 + A.q * 0.12 - max(0, hr) * 0.35;                    // höjd: sjunker ihop, flammar upp
  const off = (y) => { const u = -y / 27; return wave(t * 2.4 - u * 1.8) * 2.6 * u + hu * 7 * u * u - A.h * 3 * u; };                    // vågen vandrar uppåt i lågan
  const S = (pts) => pts.map(([x, y]) => [x + off(y), y * H]), fo = rnd(off(-10)), fy = rnd(-10 * H);
  g.push(hu * 2, -(o.hov || 4) - wave(t * 2.6), 0, (o.k || 1) * (1 + A.h * 0.12));
  g.begin();
  g.poly(S([[-8, -8], [-14, -13 + fl(4) - A.s * 5], [-11, -6]]), C.fire, 4); g.poly(S([[8, -8], [13, -12 + fl(5) - A.s * 5], [10, -5]]), C.fire, 2);
  g.poly(S([[-8, -4], [-9, -11], [-6, -15 + fl(0)], [-7, -21 + fl(1)], [-3, -18], [-1, -27 + fl(2)], [3, -19], [6, -23 + fl(3)], [7, -14], [9, -9], [7, -3], [3, 0], [-4, 0]]), C.fire, 3);
  g.end();
  g.begin();
  g.poly(S([[-5, -3], [-6, -9], [-4, -13 + fl(1)], [-1, -18 + fl(2)], [2, -13], [5, -9], [4, -3], [0, -1]]), C.fire2, 4);
  g.ell(fo * 0.3, -3 * H, 3, 1.6, C.white, false, null, 4);                                                                              // vitglödgad kärna
  if (ow) { wince(g, -4 + fo, fy, false); wince(g, fo, fy, true); } else { peep(g, -4 + fo, fy, shut || gut > 0.5); peep(g, fo, fy, shut || gut > 0.5); }
  if (a > 0.05) g.ell(-1.5 + fo, fy + 5.5, 2, 1.4 + A.w + A.h, C.dark, false, null, 0); else { g.rect(-3 + fo, fy + 5, 4, 1, C.dark, 0); g.dot(-4 + fo, fy + 4, C.dark, 0); g.dot(1 + fo, fy + 4, C.dark, 0); }
  g.end({ outline: false });
  g.begin();                                             // gnistor som stiger och slocknar
  for (let i = 0; i < 3; i++) { const q = (t * 0.9 + i * 0.37) % 1; g.rect(-5 + i * 5 + sin(q * 6 + i) * 2, -24 * H - q * 10, q < 0.5 ? 2 : 1, q < 0.5 ? 2 : 1, i % 2 ? C.fire : C.fire2, q < 0.6 ? 5 : 3); }
  g.end({ outline: false, edge: false });
  if (a > 0.45) { g.begin(); const u = (a - 0.45) / 0.55, x = -12 - eOut(u) * 32; g.poly([[x + 2, -9], [x + 9, -7], [x + 2, -4]], C.fire, 4); g.ell(x, -6.5, 3.2, 3.2, C.fire2); g.end(); }
  g.pop();
}

// ---------- Golem: urgammal stenbjässe med mossa, hängande rankor och ett fågelbo på axeln ----------
function golem(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex), glow = R(o.glow), br = step(t, 1.4), shut = blinkAt(t, 6) || hu > 0.25;
  const jolt = rnd(A.q * 2), hop = rnd(max(0, hr) * 3), vine = wave(t * 1.4 - 1.2) * 1.5 + A.q * 3;                                       // stenarna hoppar isär vid träff
  const arm = (ax, ay, ang, lv, near) => {
    g.push(ax, ay, ang); g.poly([[-6, 2], [6, 2], [7, 24], [-7, 24]], m, lv - 1); g.poly([[-9, 22], [8, 20], [10, 42], [-4, 45], [-11, 38]], m, lv);
    g.rect(-8, 30, 17, 1, m, lv - 2); g.line(-3, 36, 2, 39, m, lv - 2); g.ell(0, 0, 9.5, 8.5, m);
    if (o.moss) { g.ell(0, -4, 8, 4, C.moss, false, (dx, dy) => dy < 0.3, 3); if (near) { g.line(4, 3, 4 + vine * 0.5, 12, C.leaf, 2); g.line(4 + vine * 0.5, 12, 3 + vine, 19, C.leaf, 3); g.line(-3, 3, -3 + vine * 0.6, 10, C.leaf, 2); g.dot(3 + vine, 20, C.leaf, 5); } }   // rankor som svajar efter
    g.pop();
  };
  enter(g, hr, o.k || 1, 0.08);
  g.begin(); arm(-21, -47 + br - hop, 0.12 + A.w * -0.9 + A.h * 1.6, 3, false); g.end();
  g.begin(); g.poly([[-16, -18], [-3, -18], [-2, 0], [-18, 0]], m, 2); g.poly([[4, -18], [17, -18], [19, 0], [3, 0]], m, 3); g.rect(-18, -4, 16, 1, m, 1); g.rect(3, -4, 16, 1, m, 1); g.line(-12, -14, -9, -9, m, 1); g.end();
  g.begin();                                             // bål
  const ty = br + jolt - hop;
  g.poly([[-22, -55 + ty], [-8, -61 + ty], [14, -59 + ty], [24, -49 + ty], [22, -28], [14, -16], [-14, -16], [-22, -28]], m, 3);
  g.poly([[-20, -54 + ty], [-8, -59 + ty], [12, -57 + ty], [7, -49], [-13, -47]], m, 4);
  g.poly([[-19, -27], [19, -27], [13, -17], [-13, -17]], m, 2);
  const gl = sin(t * 1.4) > 0 ? 5 : 4;                                                                                                   // sprickorna pulserar sakta
  g.line(-6, -44, -2, -38, glow, gl); g.line(-2, -38, -7, -32, glow, gl); g.line(-7, -32, -4, -27, glow, gl); g.line(8, -42, 11, -36, glow, 4); g.line(11, -36, 8, -31, glow, 4);
  if (o.moss) {
    g.ell(10, -57 + ty, 9, 4, C.moss, false, (dx, dy) => dy < 0.4, 3); g.ell(-14, -30, 5, 3, C.moss, false, null, 3); g.ell(12, -22, 4, 2.4, C.moss, false, null, 2);
    g.rect(-17, -34, 2, 3, C.bone, 3); g.ell(-16, -35, 2.6, 1.8, C.red, true, (dx, dy) => dy < 0.4);                                     // en liten svamp
  }
  g.end();
  g.begin();                                             // huvud
  const hy = br + jolt - hop * 2;
  if (o.moss) { const lw = wave(t * 1.4 - 0.8) * 1.2; g.thick(-4, -69 + hy, -3 + lw * 0.5, -74 + hy, 1.4, C.leaf, 2); g.poly([[-3 + lw * 0.5, -74 + hy], [2 + lw, -77 + hy], [2 + lw, -73 + hy]], C.leaf, 4); g.poly([[-3 + lw * 0.5, -74 + hy], [-8 + lw, -76 + hy], [-7 + lw, -72 + hy]], C.leaf, 3); }
  g.poly([[-17, -57 + hy], [-13, -68 + hy], [-2, -70 + hy], [5, -64 + hy], [4, -55 + hy], [-12, -53 + hy]], m, 3);
  g.poly([[-13, -67 + hy], [-2, -69 + hy], [3, -64 + hy], [-10, -64 + hy]], m, 4);
  g.rect(-15, -63 + hy, 13, 4, C.dark, 0);
  if (!shut) { const lk = floor(t * 0.4) % 4 === 3 ? 1 : 0; g.rect(-14 + lk, -62 + hy, 3, 2, glow, 5); g.rect(-8 + lk, -62 + hy, 3, 2, glow, 5); if (o.moss && a <= 0) { g.rect(-14, -63 + hy, 4, 1, m, 2); g.rect(-8, -63 + hy, 4, 1, m, 2); } }
  g.rect(-13, -57 + hy, 9, 1, m, 1); if (a > 0.05) g.rect(-13, -57 + hy, 9, 2, glow, 4);
  g.end();
  g.begin(); arm(22, -47 + br - hop, -0.1 - A.w * 0.5 + A.h * 1.0, 4, true); g.end();
  if (o.moss) {                                          // fågelboet på axeln: fågeln hoppar till ibland och flyger upp när det smäller
    const up = a > 0 || hu > 0, by = up ? -70 - bump(max(a, hu)) * 8 : -61 + ty - rnd(ev(t, 2.3, 0.25) * 2), bx = up ? 20 : 15;
    g.begin(); g.rect(11, -59 + ty, 9, 2, C.wood, 2); g.dot(10, -60 + ty, C.wood, 3); g.dot(20, -60 + ty, C.wood, 3); g.end();
    g.begin(); g.ell(bx, by, 2.4, 2.2, C.orange); g.dot(bx - 3, by, C.fire2, 5); g.dot(bx - 1, by - 1, C.dark, 0); if (up) g.poly([[bx, by - 1], [bx + 4, by - 4 + step(t, 30) * 4], [bx + 2, by]], C.orange, 4); g.end();
  }
  if (a > 0.5) { g.begin(); spray(g, -34, -3, (a - 0.5) / 0.5, 6, C.bone, { rp2: m, dist: 14, spread: 4, fall: -6 }); g.end(); }           // grus yr när näven slår i
  g.pop();
}

// ---------- Moln med ansikte: muttrande åskmoln med buskiga ögonbryn, tussar som sväller i tur och ordning och en blixt som slår ner ----------
function cloud(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(A.w > 0.5 || A.h > 0.3 ? '#7a82a2' : (o.hex || '#9aa3c0')), shut = blinkAt(t, 2), ow = hu > 0.25;
  const gr = a <= 0 && hu <= 0 && ev(t, 4.8, 1) > 0, jx = gr ? (sin(t * 55) > 0 ? 1 : 0) : 0, hov = (o.hov || 18) + wave(t * 1.5) * 2 + A.w * 2 - A.h * 3;   // muttrar och skakar
  const pf = (i) => wave(t * 1.9 - i * 1.1) * 0.7 + A.w * 1.2, sp = max(0, hr) * 3;                                                       // tussarna far isär vid träff
  g.push(hu * 2 + jx, -rnd(hov), hr * 0.15, o.k || 1);
  if (a > 0.42 && a < 0.8 && (a < 0.62 || step(t, 40))) { g.begin(); const d = eOut((a - 0.42) / 0.1) * 6; g.poly([[-4, 2], [1, 2], [-4, 8 + d * 0.3], [-1, 8 + d * 0.3], [-9, 17 + d], [-6, 10 + d * 0.3], [-9, 10 + d * 0.3]], C.fire2, 4); g.end(); }
  else { g.begin(); for (let i = 0; i < (gr ? 6 : 4); i++) { const q = (t * 1.5 + i * 0.29) % 1; g.rect(-10 + i * (gr ? 4 : 6), 4 + q * q * 11, 1, 2, C.ice, 4); } g.end({ outline: false, edge: false }); }
  g.begin();
  g.ell(9 + sp, -4, 9 + pf(0), 6.5 + pf(0) * 0.6, m); g.ell(1, -9.5 - sp * 0.6, 9 + pf(1), 8 + pf(1) * 0.6, m); g.ell(-9 - sp, -5, 8.5 + pf(2), 6.5 + pf(2) * 0.6, m); g.ell(-1, -2, 13, 5.5, m);
  g.ell(-1, -1.5, 12, 3.6, m, false, (dx, dy) => dy > 0.25, 2);                                                                           // mörk, regntung undersida
  if (ow) { wince(g, -10, -9, false); wince(g, -4, -9, true); }
  else { eye(g, -10, -9, 3, 3, { shut, mood: 'arg', inner: 1, pw: 2, ph: 2 }); eye(g, -4, -9, 3, 3, { shut, mood: 'arg', inner: -1, pw: 2, ph: 2 }); }
  g.ell(-10, -11.5 + (gr ? 1 : 0), 3, 1.5, m, false, null, 5); g.ell(-2.5, -12 + (gr ? 1 : 0), 3, 1.5, m, false, null, 5);                  // buskiga ögonbryn
  if (a > 0.05) g.ell(-5.5, -2.5, 2 + A.h, 1.5 + A.h + A.w * 0.5, C.dark, false, null, 0);
  else if (gr) { for (let i = 0; i < 6; i++) g.dot(-9 + i, -3 + ((i + jx) % 2), C.dark, 0); g.dot(5, -6, C.fire2, 5); g.dot(4, -5, C.fire2, 5); g.dot(5, -4, C.fire2, 5); }   // det gnistrar till inuti
  else { g.rect(-8, -3, 5, 1, C.dark, 0); g.dot(-9, -2, C.dark, 0); g.dot(-3, -2, C.dark, 0); }
  g.end();
  g.pop();
}

// ---------- Flygande öga: nyfiken tjuvkikare med ögonfransar som spanar åt alla håll, kisar misstänksamt och spärrar upp ögat ----------
function eyeball(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex || '#8a5ab8'), iris = R(o.iris || '#2fbf71');
  const f1 = a > 0 ? -A.w * 4 + A.h * 4 : wave(t * 8.5) * 3.5, f = f1 + (a > 0 ? A.q * 2 : wave(t * 8.5 - 1) * 2), hov = (o.hov || 15) + wave(t * 2) * 2.5 + A.w * 2 - A.h * 2;
  const bl = (t + 1.4) % 3.4, shut = hu > 0.25 || bl < 0.14, sq = a <= 0 && t % 6 < 1.3;                                                  // kisar misstänksamt en stund då och då
  const lid = shut ? 0.75 : a > 0 ? -0.4 + A.w * 0.3 - A.h * 0.45 : bl < 0.22 ? 0.2 : sq ? -0.12 : -0.42;
  const lk = a > 0 || sq ? 0 : floor(t * 0.9) % 5, px = lk === 2 ? 3 : lk === 3 ? 1 : 0, py = lk === 2 ? -1 : lk === 3 ? 2 : 0;            // blicken hoppar: mot hjälten, bakåt, nedåt
  g.push(hu * 2, -hov, hr * 0.3, o.k || 1);
  g.begin();
  for (const sx of [-1, 1]) { g.poly([[sx * 6, -3], [sx * 11, -8 + f1], [sx * 15, -11 + f], [sx * 19, -4 + f], [sx * 14, -2 + f * 0.5], [sx * 12, 3], [sx * 8, 2]], m, sx < 0 ? 2 : 1); g.thick(sx * 6, -3, sx * 11, -8 + f1, 1.5, m, 4); g.thick(sx * 11, -8 + f1, sx * 15, -11 + f, 1.3, m, 4); }
  const n1 = wave(t * 2 - 0.8) * 1.5, n2 = wave(t * 2 - 1.8) * 2.5;                                                                        // synnerven slingrar efter
  g.thick(2, 8, 4 + n1, 12, 1.8, C.red, 2); g.thick(4 + n1, 12, 3 + n2, 16, 1.6, C.red, 2);
  g.line(-5, -9, -7, -12, m, 1); g.line(0, -9, 0, -13, m, 1); g.line(5, -9, 7, -12, m, 1);                                                // ögonfransar
  g.end();
  g.begin();
  g.ell(0, 0, 9.5, 9.5, C.bone);
  g.ell(-3.5 + px, 0.5 + py, 5, 5.4, iris); g.ell(-4.5 + px, 0.8 + py, 1.7 + A.h, 3.2 - A.w * 1.4 + A.h, C.dark, false, null, 0); g.rect(-7 + px, -2 + py, 2, 2, C.white, 5);
  g.line(5, 3, 8, 2, C.red, 3); g.line(4, 6, 6, 6, C.red, 3);
  g.ell(0, 0, 9.5, 9.5, m, true, (dx, dy) => dy < lid); g.ell(0, 0, 9.5, 9.5, m, false, (dx, dy) => dy > 0.86 - (sq ? 0.22 : A.w * 0.2), 2);
  g.end();
  if (a > 0.45) { g.begin(); const u = (a - 0.45) / 0.55, L = (u < 0.15 ? u / 0.15 : 1 - eIO((u - 0.15) / 0.85)) * 34; g.rect(-9 - L, -1, L, 3, iris, 5); g.rect(-9 - L, 0, L, 1, C.white, 5); g.end({ edge: false }); }
  g.pop();
}

// ---------- Riddare (tom, rostig rustning): högfärdig gammal herre som stöder sig på svärdet, med visir som slår upp och igen och en trasig mantel ----------
function knight(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), m = R(o.hex || '#8793a3'), b = step(t, 2), glow = C.ice, shut = blinkAt(t, 8);
  const ux = rnd(A.w * 2 - A.h * 3), hx = -14 + ux + A.w * 4 - A.h * 2, hy = -29 + b - A.w * 6 + A.h * 6;
  const ang = PI - 0.06 + wave(t * 2) * 0.02 + A.w * (PI + 0.5) + A.h * (PI / 2 - 0.3) - A.q * 0.15;                                      // svärdet: spetsen i marken, lyfts bakåt över huvudet, huggs ner
  const cf = wave(t * 1.8 - 1) * 1.5 + A.w * 2 - A.h * 4 + hu * 3, vis = hu > 0.1 ? 3 : a <= 0 ? rnd(ev(t, 4.2, 0.4) * 2.4) : 0;           // visiret slår upp
  enter(g, hr, o.k || 1, 0.12);
  g.begin();                                             // mantel
  g.poly([[3 + ux, -30 + b], [11 + ux, -29 + b], [19 + cf, -15], [21 + cf, -5], [17 + cf * 0.6, -8], [14 + cf, -3], [10, -9], [6, -12]], C.red, 2); g.line(12 + ux, -27 + b, 17 + cf, -12, C.red, 1);
  g.end();
  g.begin();                                             // svärdsarm
  g.thick(-8 + ux, -28 + b, hx, hy, 5, m, 2);
  g.push(hx, hy, ang);
  g.poly([[-2.5, -4], [2.5, -4], [3, -24], [0, -30], [-3, -24]], C.steel, 4); g.poly([[-0.5, -6], [0.5, -6], [0.5, -24], [-0.5, -24]], C.steel, 2);
  g.rect(1, -17, 2, 3, C.rust, 3); g.rect(-2, -10, 2, 2, C.rust, 3);
  g.poly([[-6, -6], [6, -6], [6, -3.5], [-6, -3.5]], C.gold, 3); g.rect(-1.5, -3.5, 3, 7, C.leather, 3);
  g.pop(); g.end();
  g.begin();                                             // ben
  g.rect(-8, -14, 6, 10, m, 2); g.rect(2, -14, 6, 10, m, 3); g.rect(-10, -5, 9, 5, m, 2); g.rect(1, -5, 9, 5, m, 3); g.rect(-8, -10, 6, 2, m, 5); g.rect(2, -10, 6, 2, m, 5); g.dot(4, -7, C.rust, 3);
  g.end();
  g.begin();                                             // bål
  g.ell(ux, -23 + b, 10, 9, m); g.rect(-9, -16, 18, 3, m, 2); g.rect(-9, -16, 18, 1, C.leather, 2);
  g.ell(-9.5 + ux, -29 + b, 5.4, 4.2, m); g.ell(9.5 + ux, -28 + b, 5.4, 4.2, m);                                                          // ena axelplåten har halkat ner
  g.rect(-3 + ux, -25 + b, 3, 3, C.red, 4); g.dot(-2 + ux, -24 + b, C.gold, 5); g.rect(3 + ux, -20 + b, 3, 2, C.rust, 3); g.rect(-7 + ux, -22 + b, 2, 2, C.rust, 3); g.dot(5 + ux, -27 + b, C.rust, 3);
  g.end();
  g.begin();                                             // hjälm: hoppar till vid träff
  const Y = -38 + b - rnd(max(0, hr) * 4), sx = ux + rnd(-A.q * 2), pf = wave(t * 2 - 1.2) * 1.5 + A.q * 3 + hu * 3;
  g.poly([[-1 + sx, Y - 7], [4 + sx, Y - 14 + pf * 0.5], [11 + sx, Y - 12 + pf], [14 + sx, Y - 4 + pf * 1.4], [9 + sx, Y - 1], [6 + sx, Y - 5]], C.red, 3);
  g.ell(-0.5 + sx, Y, 9, 8.5, m);
  g.rect(-10 + sx, Y - 2 - vis, 12, 3 + vis, C.dark, 0); if (!shut) { g.rect(-8 + sx, Y - 1 - (vis > 1 ? 1 : 0), 2, 2, glow, 5); g.rect(-3 + sx, Y - 1 - (vis > 1 ? 1 : 0), 2, 2, glow, 5); }
  g.rect(-10 + sx, Y - 4 - vis, 12, 2, m, 4);                                                                                              // visirkant
  g.rect(-6 + sx, Y - 9, 2, 5 - vis, m, 5); for (const dx of [-8, -6, -4]) g.dot(dx + sx, Y + 4, m, 1);
  g.rect(3 + sx, Y + 2, 3, 2, C.rust, 3); g.dot(4 + sx, Y - 5, C.rust, 3);
  g.end();
  g.begin();                                             // sköldarm
  const sy = b - rnd(hu * 3);
  g.thick(9 + ux, -28 + b, 11, -20 + sy, 5, m, 3);
  g.poly([[5, -27 + sy], [19, -27 + sy], [19, -16 + sy], [12, -7 + sy], [5, -16 + sy]], R('#4f6fb0'), 3); g.rect(11, -27 + sy, 2, 16, C.gold, 4); g.rect(5, -22 + sy, 14, 2, C.gold, 4); g.rect(15, -18 + sy, 2, 2, C.rust, 3); g.line(6, -26 + sy, 9, -24 + sy, C.dark, 1);
  g.end();
  g.pop();
}

// ---------- Stjärnskott (pyttesmå, i svärm): kaxiga små stjärnor som blinkar med ena ögat, tindrar till och drar ett stoftspår efter sig ----------
function star(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), ph = o.ph || 0, hv = (tt) => (o.hov || 12) + wave(tt * 2.6 + ph) * 3, hov = hv(t) + A.w * 2 - A.h * 2;
  const shut = blinkAt(t, ph), wink = a <= 0 && ev(t, 3.9, 0.45, ph * 3) > 0, tw = ev(t, 1.7, 0.4, ph), ow = hu > 0.25, bx = A.w * 3 - A.h * 3;
  g.begin();                                             // stoftspåret följer stjärnans bana med fördröjning
  for (let i = 1; i <= 4; i++) g.rect(4 + bx + i * 3.5 + A.h * i * 2, -hv(t - i * 0.13) - 3 + i, i < 3 ? 2 : 1, i < 3 ? 2 : 1, C.fire2, i < 3 ? 5 : 3);
  g.end({ outline: false, edge: false });
  g.push(hu * 2 + bx, -hov, wave(t * 2 + ph) * 0.22 + (a > 0 ? eIO((a - 0.3) / 0.45) * PI * 2 : 0) + hr * 0.9, (o.k || 1) * (1 + tw * 0.12 - A.w * 0.15 + A.h * 0.1 - max(0, hr) * 0.2));
  g.begin();
  const pts = [], inner = []; for (let i = 0; i < 10; i++) { const an = -PI / 2 + i * PI / 5, r = i % 2 ? 3.4 : 7; pts.push([cos(an) * r, sin(an) * r]); inner.push([cos(an) * r * 0.55, sin(an) * r * 0.55 + 0.5]); }
  g.poly(pts, C.fire2, 4); g.poly(inner, C.fire2, 5);
  if (ow) { g.rect(-3, 0, 2, 1, C.dark, 0); g.rect(0, 0, 2, 1, C.dark, 0); }
  else { if (shut) g.rect(-3, 0, 2, 1, C.dark, 0); else g.rect(-3, -1, 1, 2, C.dark, 0); if (shut || wink) g.rect(0, 0, 2, 1, C.dark, 0); else g.rect(0, -1, 1, 2, C.dark, 0); }
  g.dot(-4, 1, C.pink, 3); g.dot(2, 1, C.pink, 3);
  if (a > 0.05) g.rect(-2, 2, 2, 2, C.dark, 0); else { g.rect(-2, 2, 2, 1, C.dark, 0); if (wink) g.dot(0, 1, C.dark, 0); }
  if (tw > 0.3) { g.dot(0, -9, C.white, 5); g.dot(-1, -8, C.white, 5); g.dot(1, -8, C.white, 5); g.dot(0, -7, C.white, 5); }                // tindrar till i toppen
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
  E('kladdis', 'Sprout', 0, 1, 23, 26, (g, t, p) => slime(g, t, p, { hex: '#6fcf5a', kind: 'leaf' })),
  E('goblingang', 'Bonk Goblin', 0, 1, 19, 25, (g, t, p) => goblin(g, t, p, { k: 0.8 }), { count: 5 }),
  E('fladdris', 'Flitter', 0, 1, 36, 40, (g, t, p) => bat(g, t, p, { hex: '#7a5ab0', k: 1.15, hov: 18 }), { fly: true }),
  E('sursvamp', 'Grumpcap', 0, 2, 27, 34, (g, t, p) => mushroom(g, t, p, { hex: '#d8433b', k: 1.25 })),
  E('trassel', 'Tangle', 0, 2, 20, 51, (g, t, p) => spider(g, t, p, { hex: '#5a4a78', k: 1.2, long: 1.15, thick: 1, mark: 1 })),
  E('morr', 'Growl', 0, 3, 36, 60, (g, t, p) => wolf(g, t, p, { hex: '#8f95a8', k: 1.05 })),
  E('mossis', 'Old Mossy', 0, 3, 78, 74, (g, t, p) => golem(g, t, p, { hex: '#8d8a80', glow: '#d6f25a', moss: 1 })),
  // ----- 1 Solöknen -----
  E('stick', 'Prickle', 1, 1, 34, 31, (g, t, p) => cactus(g, t, p, {})),
  E('skarabeer', 'Scuttle Bug', 1, 1, 9, 18, (g, t, p) => beetle(g, t, p, { hex: '#2f9fb0' }), { count: 6 }),
  E('nyp', 'Pinch', 1, 1, 26, 48, (g, t, p) => scorpion(g, t, p, { k: 1.1 })),
  E('turbangoblin', 'Swish', 1, 2, 37, 40, (g, t, p) => goblin(g, t, p, { k: 1.3, turban: 1, skin: '#b9a24a', cloth: '#7a4fb0' })),
  E('vas', 'Hiss', 1, 2, 37, 45, (g, t, p) => snake(g, t, p, { hex: '#c9a03a', belly: '#f2e2a0', k: 1.1 })),
  E('skramlis', 'Rattlebones', 1, 2, 43, 38, (g, t, p) => skeleton(g, t, p, {})),
  E('snubbel', 'Stumbles', 1, 3, 51, 41, (g, t, p) => mummy(g, t, p, { k: 1.05 })),
  // ----- 2 Svampträsket -----
  E('geggis', 'Gunk', 2, 1, 27, 32, (g, t, p) => slime(g, t, p, { hex: '#9aa83a', kind: 'swamp', k: 1.2 })),
  E('plask', 'Plop', 2, 1, 21, 30, (g, t, p) => frog(g, t, p, { k: 1.1 })),
  E('smakryp', 'Skitter', 2, 1, 10, 22, (g, t, p) => spider(g, t, p, { hex: '#7a4a8a', k: 0.6, long: 0.75, cute: 1 }), { count: 6 }),
  E('klo', 'Snap', 2, 2, 24, 58, (g, t, p) => crab(g, t, p, { hex: '#5f9a8a', kind: 'moss', k: 1.1 })),
  E('fnys', 'Sneezecap', 2, 2, 43, 30, (g, t, p) => mushroom(g, t, p, { hex: '#8a4fc0', tall: 1, k: 1.15 })),
  E('glufs', 'Munchbloom', 2, 2, 47, 45, (g, t, p) => plant(g, t, p, { hex: '#d8433b', k: 1.1 })),
  E('irrbloss', 'Glimmer', 2, 3, 42, 32, (g, t, p) => ghost(g, t, p, { hex: '#8fe8b0', kind: 'wisp', k: 1.1, hov: 9 }), { fly: true }),
  // ----- 3 Frostbergen -----
  E('isbiten', 'Shiver', 3, 1, 25, 26, (g, t, p) => slime(g, t, p, { hex: '#74d3f7', kind: 'ice', k: 1.1 })),
  E('pingviner', 'Waddle Guard', 3, 1, 31, 26, (g, t, p) => penguin(g, t, p, {}), { count: 3 }),
  E('morot', 'Flurry', 3, 2, 45, 40, (g, t, p) => snowman(g, t, p, {})),
  E('istand', 'Icefang', 3, 2, 40, 69, (g, t, p) => wolf(g, t, p, { hex: '#b8d4ee', kind: 'ice', k: 1.2 })),
  E('viking', 'Chillbeard', 3, 3, 56, 51, (g, t, p) => skeleton(g, t, p, { hex: '#cfe3ee', viking: 1, k: 1.15 })),
  E('gasp', 'Snooze', 3, 3, 66, 65, (g, t, p) => yeti(g, t, p, {})),
  // ----- 4 Meningsvulkanen -----
  E('lavaklick', 'Sizzle', 4, 1, 30, 36, (g, t, p) => slime(g, t, p, { hex: '#d8502a', kind: 'lava', k: 1.35 })),
  E('glodfladdror', 'Ember Bat', 4, 1, 28, 30, (g, t, p) => bat(g, t, p, { hex: '#c0462a', fire: 1, k: 0.85, hov: 14 }), { count: 4, fly: true }),
  E('busimp', 'Rascal', 4, 2, 37, 41, (g, t, p) => imp(g, t, p, { hex: '#d8433b', k: 1.2 })),
  E('magmakrabba', 'Cinderclaw', 4, 2, 40, 73, (g, t, p) => crab(g, t, p, { hex: '#7a5a62', kind: 'magma', belly: '#f08a2a', k: 1.4 })),
  E('fras', 'Flicker', 4, 2, 41, 35, (g, t, p) => flame(g, t, p, { k: 1.25, hov: 5 }), { fly: true }),
  E('glodhund', 'Scorch', 4, 3, 44, 77, (g, t, p) => wolf(g, t, p, { hex: '#5f4650', kind: 'fire', k: 1.3 })),
  // ----- 5 Molnslottet -----
  E('stjarnskott', 'Twinkle', 5, 1, 23, 23, (g, t, p) => star(g, t, p, {}), { count: 5, fly: true }),
  E('surmoln', 'Grumble', 5, 1, 40, 41, (g, t, p) => cloud(g, t, p, { k: 1.1 }), { fly: true }),
  E('kikaroga', 'Peeper', 5, 2, 31, 40, (g, t, p) => eyeball(g, t, p, {}), { fly: true }),
  E('bu', 'Whoo', 5, 2, 47, 36, (g, t, p) => ghost(g, t, p, { hex: '#e4ecff', kind: 'castle', k: 1.3, hov: 9 }), { fly: true }),
  E('grus', 'Gravel', 5, 2, 63, 71, (g, t, p) => imp(g, t, p, { hex: '#8a8fa0', fly: 1, k: 1.4 }), { fly: true }),
  E('rostis', 'Sir Clank', 5, 3, 59, 53, (g, t, p) => knight(g, t, p, { k: 1.1 })),
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
// Nya fiender (enemies-new.js). Bara de som är klara och hör till världar som finns. Kvar att släppa in senare:
// mozzies, bigwool, sirgust (behöver ett pass till), Math Mountains och Reading Land (världarna finns inte än)
// och kejsarens armé (snatchers, clunk, peeper, lugg: ska komma med berättelsen, inte från första banan).
const NEW_IN = ['snorkel', 'grumpstump', 'snowbies', 'scoop', 'sirtusk', 'coalcrew', 'whistler', 'cindershell', 'fluff', 'grandtock'];
for (const e of ROSTER_NEW) if (NEW_IN.includes(e.id)) ROSTER.push(e);
// De två gamla extrabossarna utgår: kartan har en boss per värld.
for (const id of ['magmus', 'skuggriddaren']) { const i = ROSTER.findIndex((e) => e.id === id); if (i >= 0) ROSTER.splice(i, 1); }
// Omritade bossar (bosses.js): samma id, värld och typ som förut, ny bild, storlek och namn.
for (const b of ROSTER_BOSSES) { const old = ROSTER.find((e) => e.id === b.id); if (old) Object.assign(old, { draw: b.draw, h: b.h, w: b.w, name: b.name }); }
// Omritade klumpfiender (blobs.js, 2026-11-12): samma id, värld och typ, ny bild och storlek.
for (const b of ROSTER_BLOBS) { const old = ROSTER.find((e) => e.id === b.id); if (old) Object.assign(old, { draw: b.draw, h: b.h, w: b.w, name: b.name }); }
export const BY_ID = Object.fromEntries(ROSTER.map((e) => [e.id, e]));
