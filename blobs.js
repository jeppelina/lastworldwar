// Fiender v3: "klumparna" omritade till riktiga figurer. Fyra före detta slem (kladdis, geggis, isbiten, lavaklick)
// och två svärmar som också var runda klumpar med ögon (snowbies, coalcrew).
// Samma anrop som i game/enemies.js: draw(g, t, pose), (0, 0) är marken mitt under varelsen, den tittar åt VÄNSTER,
// uppåt är negativt y, pose = { attack: 0..1, hurt: 0..1 }. ROSTER_BLOBS längst ner har samma id och fält som ROSTER.
import { ramp as R } from './pixel.js';

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), bone: R('#ece4cf'), gold: R('#f2b632'), red: R('#d8433b'),
  wood: R('#9a6b3f'), leather: R('#8a5a34'), steel: R('#aab6c4'), fire: R('#ff7a1f'), fire2: R('#ffd84a'),
  ice: R('#bff0ff'), pink: R('#ee8fa8'), leaf: R('#58b04a'), orange: R('#f08a2a'),
  snow: R('#eef4fb'), moss: R('#6fa544'), smoke: R('#8d8aa0'),
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
// Något som händer då och då: 0 för det mesta, 0 → 1 → 0 under dur sekunder en gång per period.
const ev = (t, period, dur, off = 0) => { const x = (((t + off) % period) + period) % period; return x < dur ? sin((x / dur) * PI) : 0; };
// Öga: vit glob med mörk pupill.
function eye(g, x, y, w, h, o = {}) {
  if (o.shut) { g.rect(x, y + floor(h / 2), w, 1, C.dark, 0); return; }
  g.rect(x, y, w, h, o.col ?? C.white, 5);
  const pw = o.pw ?? max(1, ceil(w / 2)), ph = o.ph ?? max(1, ceil(h * 0.6));
  g.rect(x + (o.dx ?? 0), y + (o.dy ?? h - ph), pw, ph, C.dark, 0);
}
// Litet öga i hjältens stil: mörk pinne med vit glimt.
const peep = (g, x, y, shut, h = 3) => { if (shut) g.rect(x, y + 1, 2, 1, C.dark, 0); else { g.rect(x, y, 2, h, C.dark, 0); g.dot(x, y, C.white, 5); } };
// Ihopknipna ögon vid träff: > och <.
function wince(g, x, y, lt, col = C.dark) { g.dot(x + (lt ? 1 : 0), y, col, 0); g.dot(x + (lt ? 0 : 1), y + 1, col, 0); g.dot(x + (lt ? 1 : 0), y + 2, col, 0); }
// Glada bågar: ^ ^
function happy(g, x, y, col = C.dark) { g.dot(x, y + 1, col, 0); g.dot(x + 1, y, col, 0); g.dot(x + 2, y + 1, col, 0); }
// Smulor som kastas ut i en båge och saktar in. u = 0..1.
function spray(g, x, y, u, n, rp, o = {}) {
  if (u <= 0 || u >= 1) return;
  const d = eOut(u) * (o.dist || 24), sp = o.spread || 6, sz = u < 0.6 ? 2 : 1, dir = o.dir || -1;
  for (let i = 0; i < n; i++) { if (u > 0.75 && i % 2) continue; g.rect(x + dir * (d * (0.55 + 0.45 * ((i * 0.37) % 1)) + i), y + sin(i * 2.3) * sp * (0.3 + eOut(u)) + u * u * (o.fall ?? 5), sz, sz, i % 2 && o.rp2 != null ? o.rp2 : rp, o.lv ?? 5); }
}

// ====================================================================================================
// SPROUT: en grodd som inte har kommit ur sitt nötskal än. Skalet sitter kvar som byxor med naggad kant,
// rotben sticker ut under, och på huvudet växer ett stort tuggat blad och ett litet.
// Vana: drar ner bladet över ögonen som en keps, kikar fram under det och fäller upp det med ett "bu!".
// Attack: kryper ihop i skalet, slår en kullerbytta framåt och smäller till med bladet.
// Träff: dyker ner i skalet så att bara ögonen syns över kanten, bladet fladdrar bakåt.
// ====================================================================================================
const NUT = R('#b9824a'), LEAF = R('#3f9a48');
function sprout(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, m = R(o.hex || '#8ad65a');
  const idle = a <= 0 && hu <= 0, x = idle ? (t + 1.5) % 5.6 : 99;
  const hide = x < 0.3 ? eOut(x / 0.3) : x < 0.9 ? 1 : x < 1.1 ? 1 - 0.5 * eOut((x - 0.9) / 0.2) : x < 1.6 ? 0.5 : x < 1.75 ? 0.5 + 0.5 * (x - 1.6) / 0.15 : x < 2.1 ? 1 : x < 2.3 ? 1 - 1.18 * eOut((x - 2.1) / 0.2) : x < 2.7 ? -0.18 * (1 - eOut((x - 2.3) / 0.4)) : 0;
  const boo = x >= 2.1 && x < 2.9, peek = x >= 0.9 && x < 1.75, hc = clamp(hide);
  const b = boo ? 1 : step(t, 2.4), shut = blinkAt(t, 3);
  const duck = rnd(clamp(hu * 1.7) * 4 + A.w * 3), hy = -14 + duck - b;
  const roll = a > 0 ? -2 * PI * eIO((a - 0.26) / 0.24) : 0, hop = a > 0 ? bump((a - 0.26) / 0.24) * 5 : boo ? bump((x - 2.1) / 0.3) * 2 : 0;
  const tap = idle && x > 3 && ev(t, 3.7, 0.9, 1) > 0 ? step(t, 14) : 0;                                                              // trampar med ena rotfoten
  g.push(hu * 2, -hop, 0, k); g.push(0, -9, roll + hr * 0.1 + A.q * 0.1); g.push(0, 9);
  g.begin();                                             // rotben, rotsvans och huvud
  g.line(6, -6, 9, -4, C.wood, 2); g.dot(10, -5, C.wood, 3);
  g.thick(-3, -5, -3.5, -1, 2, C.wood, 2); g.rect(-6, -1 - tap, 4, 1, C.wood, 3);
  g.thick(3, -5, 3.5, -1, 2, C.wood, 3); g.rect(1, -1, 5, 1, C.wood, 4);
  g.ell(0, hy, 8, 6.2, m);
  g.rect(-5, hy - 5, 2, 1, C.white, 5); g.dot(-6, hy - 4, C.white, 5);
  const ey = rnd(hy - 4);
  if (boo || hu > 0) { eye(g, -7, ey, 3, 3, { pw: 1, ph: 2, dx: 1, dy: hu > 0 ? 0 : 1 }); eye(g, -3, ey, 3, 3, { pw: 1, ph: 2, dx: 1, dy: hu > 0 ? 0 : 1 }); }
  else { peep(g, -6, ey, shut); peep(g, -2, ey, shut); g.line(-3, ey - 2, -1, ey - 3, m, 1); }                                        // ett höjt ögonbryn
  g.dot(-8, ey + 3, C.pink, 3); g.dot(1, ey + 3, C.pink, 3);
  if (boo || a > 0.05) { g.rect(-6, ey + 4, 5, 2, C.dark, 0); g.rect(-5, ey + 5, 3, 1, C.pink, 3); }
  else { g.rect(-6, ey + 5, 4, 1, C.dark, 0); g.dot(-7, ey + 4, C.dark, 0); g.dot(-4, ey + 5, C.white, 5); }                          // flin med en tand
  g.end();
  g.begin();                                             // nötskalet som byxor
  g.ell(0, -7.5, 8.5, 5, NUT, true, (dx, dy) => dy > -0.25);
  for (const tx of [-8, -4, 0, 4]) g.poly([[tx, -8.5], [tx + 2, -11], [tx + 4.5, -8.5]], NUT, tx < 0 ? 4 : 3);
  g.ell(-2, -5.5, 3.5, 2, NUT, false, null, 5);                                                                                      // ljus mage
  g.line(4, -8, 5, -6, NUT, 1); g.line(5, -6, 4, -4, NUT, 1);                                                                        // spricka
  g.end();
  g.begin();                                             // stjälk och blad: det stora bladet kommer efter kroppen
  const la = -0.45 + wave(t * 2.4 - 0.9) * 0.1 - hide * 3.55 + A.w * 0.6 - A.h * 2.9 - A.q * 0.5 + hu * 0.9 + (hu > 0 ? sin(t * 60) * 0.08 : 0);
  const sx = 2 - 3 * hc - A.h * 2 + hu * 1.5, sy = hy - 8.5 + 2 * hc + A.h;
  g.thick(1, hy - 5, sx, sy, 1.6, LEAF, 2);
  g.push(sx, sy, -2.5 + hc * 1.7 - wave(t * 2.4 - 1.5) * 0.12 - hu * 0.6); g.poly([[0, 0], [2, -2], [5, -1.5], [5, 0.5], [2, 1.5]], LEAF, 3); g.pop();
  g.push(sx, sy, la);
  g.poly([[0, 0], [2, -3], [4, -3.4], [5, -2], [6.5, -3.4], [9, -1.5], [9.5, 0.5], [6, 2.5], [2, 2]], LEAF, 4); g.line(1, 0, 8, 0, LEAF, 2);   // ett bett är taget ur kanten
  g.pop();
  g.end();
  g.pop(); g.pop(); g.pop();
  if (a > 0.5 && a < 0.72) { g.begin(); spray(g, -11 * k, -12 * k, (a - 0.5) / 0.22, 4, LEAF, { dist: 10, spread: 5, fall: 3, lv: 4 }); g.end({ outline: false, edge: false }); }
}

// ====================================================================================================
// GUNK: träskgegga som bor i en ihålig stock, som en eremitkräfta. Huvudet väller ut framtill med två olika stora
// grodögon, en klick hänger ut baktill, och på stocken växer mossa, en kvist och en flugsvamp.
// Vana: drar sig in i stocken (två ögon i mörkret), tittar ut i FEL ände, ser sig om och ploppar fram igen.
// Attack: drar sig in, skjuter ut som en lång seg arm med öppen mun, fjädrar tillbaka.
// Träff: trycks in i stocken så att ögonen står ut på skaft och geggan sprutar ut baktill.
// ====================================================================================================
const BARK = R('#8a6644');
function gunk(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, m = R(o.hex || '#a9c83c');
  const idle = a <= 0 && hu <= 0, x = idle ? (t + 5.3) % 7.5 : 99, HY = -7.5;
  let out = 1, back = 0, wow = 0;
  if (a > 0) out = 1 - A.w * 0.7 + A.h * 1.4 + A.q * 0.4;
  else if (hu > 0) out = 1 - clamp(hu * 1.7) * 0.85 - min(0, hr) * 1.2;
  else if (x < 0.35) out = 1 - eIO(x / 0.35);
  else if (x < 3) { out = 0; back = x < 0.9 ? 0 : x < 1.15 ? eOut((x - 0.9) / 0.25) : x < 2.4 ? 1 : x < 2.7 ? 1 - eIn((x - 2.4) / 0.3) : 0; }
  else if (x < 3.3) { out = 1.25 * eOut((x - 3) / 0.3); wow = 1; }
  else if (x < 3.8) { out = 1.25 - 0.25 * eOut((x - 3.3) / 0.5); wow = x < 3.6 ? 1 : 0; }
  const HX = out <= 1 ? -11 + (1 - out) * 14 : -11 - (out - 1) * 10, shut = blinkAt(t, 4);
  const vis = (X, Y) => X <= -6 || ((X + 6) / 2.5) ** 2 + ((Y - HY) / 5.2) ** 2 <= 1;                                               // det som syns av huvudet: utanför stocken eller i hålet
  // Ett grodöga. clip: klipps mot hålet. lid: hur långt ögonlocket hänger (-1 inget, 0 halvt). look: pupillens läge.
  const ball = (ex, ey2, r, clip, lid, look, cross) => {
    const cp = clip ? (dx, dy) => vis(ex + dx * r, ey2 + dy * r) : null;
    g.ell(ex, ey2 + r * 0.6, r * 0.8, r, m, false, cp, 2);                                                                          // kort skaft
    g.ell(ex, ey2, r, r, C.white, false, cp, 5);
    if (clip && !vis(ex, ey2)) return;
    if (cross) wince(g, rnd(ex - 1), rnd(ey2 - 1), cross > 0); else g.rect(rnd(ex - 1 + look), rnd(ey2 - (r > 2.5 ? 0.5 : 1)), r > 2.5 ? 2 : 1, 2, C.dark, 0);
    if (lid > -1) g.ell(ex, ey2, r, r, m, false, (dx, dy) => dy < lid, 2);
  };
  const head = (cx, cy, dir, clip, face) => {
    g.ell(cx, cy, 5, 5, m, true, clip ? (dx, dy) => vis(cx + dx * 5, cy + dy * 5) : null);
    const lid = wow ? -1 : shut ? 0.9 : -0.1, look = dir < 0 ? -1 : rnd(sin(t * 5) * 1.2);
    ball(cx + dir * 2.5, cy - 6, 3, clip, lid, look); ball(cx - dir * 2.5, cy - 6.5, 2.2, clip, lid, look * 0.6);
    if (!face) return;
    const mo = a > 0.05 ? A.w * 0.4 + A.h : wow ? 0.5 : 0;
    if (mo) { g.ell(cx - 2, cy + 1.5, 3, 1 + mo * 2.2, C.dark, false, null, 0); g.rect(cx - 3, cy + 2, 2, 1, C.pink, 3); }
    else {
      g.rect(cx - 4, cy + 1, 6, 1, m, 1); g.dot(cx + 2, cy, m, 1);                                                                   // lat mun med ena mungipan uppåt
      const dl = (t * 0.45) % 1; if (dl > 0.3) g.rect(cx - 3, cy + 2, 1, dl < 0.8 ? rnd((dl - 0.3) * 6) : 1, m, 5);                                // dregel
    }
    g.dot(cx + 1, cy - 2, m, 5); g.ell(cx + 2, cy + 3, 1.6, 1, m, false, null, 2);
  };
  g.push(hu * 2, -rnd(max(0, hr) * 2), 0, k);
  g.begin();                                             // bakom stocken: klicken baktill, eller huvudet i fel ände
  g.rect(-11, -1, 6, 1, m, 2);                                                                                                       // pöl under hålet
  if (back > 0.02) head(7 + back * 10, HY + 1, 1, false, back > 0.8);
  else {
    const tl = hu > 0 ? hu : idle && x < 3 ? -0.7 : 0;                                                                               // sprutar ut vid träff, dras in när huvudet är på väg bakåt
    g.ell(13 + tl * 3.5, -4.5, 3 + tl * 2, 2.8 + max(0, tl), m); g.rect(13, -1, 4 + rnd(max(0, tl) * 3), 1, m, 2);
    const dr = (t * 0.6) % 1; if (tl <= 0 && dr < 0.5) g.dot(15, -2 + rnd(dr * 2), m, 4);
    if (hu > 0.05) spray(g, 17, -6, 1 - hu, 4, m, { dir: 1, dist: 12, spread: 4, fall: 6, lv: 4 });
  }
  g.end();
  g.begin();                                             // stocken
  g.thick(-1, -14, -3, -17, 1.4, BARK, 2); g.poly([[-3, -17], [-8, -19.5], [-6, -15.5]], C.leaf, 4);                                 // kvist med ett blad
  g.poly([[-6, -14], [10, -14], [12.5, -11], [12.5, -4], [10, -1], [-6, -1]], BARK, 3);
  g.rect(-5, -13, 15, 2, BARK, 4); g.rect(-5, -3, 16, 2, BARK, 2);
  g.line(-1, -9, 5, -9, BARK, 2); g.line(3, -6, 9, -6, BARK, 2); g.dot(9, -10, BARK, 1); g.dot(0, -5, BARK, 1);
  g.ell(2.5, -13.6, 4.5, 1.6, C.moss, false, null, 3); g.dot(0, -12, C.moss, 3); g.dot(4, -12, C.moss, 2); g.dot(5, -11, C.moss, 2);
  g.ell(-6, HY, 3.5, 6.5, BARK, false, null, 5);                                                                                    // sågad ände med hål
  g.ell(-6, HY, 2.5, 5.2, C.dark, false, null, 1);
  if (out < 0.15 && back < 0.02 && hu <= 0) {                                                                                       // två ögon i mörkret
    const bl = shut || (x > 0.55 && x < 0.68);
    if (bl) { g.rect(-8, -9, 2, 1, C.fire2, 4); g.rect(-5, -9, 2, 1, C.fire2, 4); } else { g.rect(-8, -10, 2, 2, C.fire2, 5); g.rect(-5, -10, 2, 2, C.fire2, 5); g.dot(-8, -9, C.dark, 0); g.dot(-5, -9, C.dark, 0); }
  }
  g.end();
  g.begin();                                             // svampen på stocken hoppar till och landar snett
  g.push(7, -14 - max(0, hr) * 3 - max(0, A.q) * 2, wave(t * 1.7 - 1) * 0.05 + hu * 0.5 - A.h * 0.3 + A.q * 0.4);
  g.rect(-1, -3, 2, 3, C.bone, 3); g.poly([[-3.5, -3], [-2, -5.6], [1, -6], [3.5, -3]], C.red, 3); g.dot(-1, -5, C.white, 5); g.dot(1, -4, C.white, 5);
  g.pop(); g.end();
  if (out > 0.04 || hu > 0) {                            // huvudet framtill
    g.begin();
    if (HX < -7) { const nw = out > 1 ? max(4.5, 8 - (out - 1) * 3.5) : 8; g.thick(-5, HY, HX, HY + (out > 1 ? 1 : 0), nw, m, 3); if (out > 1.1) { g.line(-7, HY - nw / 2 + 1, HX + 4, HY - nw / 2 + 2, m, 5); g.line(-7, HY + nw / 2 - 1, HX + 4, HY + nw / 2, m, 2); } }                                        // halsen blir smalare när den sträcks
    if (hu > 0.05) {                                                                                                                 // intryckt: ögonen står ut på skaft
      g.ell(HX, HY, 5, 5, m, true, (dx, dy) => vis(HX + dx * 5, HY + dy * 5));
      g.thick(-6, HY - 2, -11, -11, 1.8, m, 2); g.thick(-6, HY - 2, -8, -13, 1.8, m, 2);
      ball(-12, -12.5, 3, false, -1, 0, -1); ball(-7.5, -15, 2.2, false, -1, 0, 1);
    } else head(HX, HY, -1, true, HX < -7);
    g.end();
  }
  g.pop();
}

// ====================================================================================================
// SHIVER: en spetsig iskristall på skridskor som fryser om sig själv. En liten fisk är infrusen i den, och
// en toppluva är trädd över spetsen så att tofsen dinglar baktill.
// Vana: glider fram och tillbaka, huttrar så att tänderna skallrar, och halkar ibland: tippar bakåt, vinglar och reser sig.
// Attack: lutar sig bakåt, fäller fram spetsen som en lans och studsar upp igen.
// Träff: spricker, mössan hoppar av spetsen och fisken vänder sig.
// ====================================================================================================
function shiver(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, m = R(o.hex || '#74d3f7');
  const idle = a <= 0 && hu <= 0, x = idle ? (t + 3) % 6.4 : 99;
  const slip = x < 0.2 ? eOut(x / 0.2) : x < 0.75 ? 1 + sin((x - 0.2) * 26) * 0.12 : x < 1.05 ? 1 - 1.25 * eIO((x - 0.75) / 0.3) : x < 1.4 ? -0.25 * (1 - eOut((x - 1.05) / 0.35)) : 0;
  const scared = x < 1.05, cold = idle && x > 1.6 && ev(t, 2.9, 0.8) > 0.1, sh = cold ? (sin(t * 70) > 0 ? 1 : -1) : 0;
  const gl = idle ? wave(t * 1.1) : 0, shut = blinkAt(t, 1), ow = hu > 0.25;
  const tilt = slip * 0.42 + A.w * 0.3 - A.h * 1.1 - A.q * 0.15 + hr * 0.25 - (idle ? cos(t * 1.1) * 0.05 * (1 - clamp(slip)) : 0);
  const px = tilt > 0 ? 6 : -7, fl = scared ? rnd(clamp(slip) * 2) : 0;
  g.push(hu * 2 + sh * 0.6 + rnd(gl * 2.5) - clamp(slip) * 2 + px * k, 0, tilt, k); g.push(-px, 0);
  g.begin();                                             // skridskor med långa skenor
  g.rect(-6 - fl, -3 - fl, 4, 2, C.leather, 3); g.rect(-8 - fl, -1 - fl, 7, 1, C.steel, 4); g.dot(-9 - fl, -2 - fl, C.steel, 5);
  g.rect(1, -3, 4, 2, C.leather, 2); g.rect(0, -1, 7, 1, C.steel, 4); g.dot(7, -2, C.steel, 3);
  g.end();
  g.begin();                                             // kristallen: en hög spets med ett sidoskott och en liten tagg framtill
  g.poly([[4, -3], [7, -9], [12, -15], [11, -8], [9, -3]], m, 2); g.poly([[7, -9], [12, -15], [9, -8]], m, 4);
  g.poly([[-6, -3], [-12, -9], [-9, -3]], m, 4); g.line(-11, -8, -8, -4, m, 5);
  g.poly([[-7, -3], [-8, -13], [-5, -21], [0, -27], [4, -21], [6, -12], [5, -3]], m, 3);
  g.poly([[-7, -3], [-8, -13], [-5, -21], [-5.5, -13], [-5, -3]], m, 5);                                                             // ljus fasett
  g.poly([[5, -3], [6, -12], [4, -21], [2.5, -12], [3, -3]], m, 1);                                                                  // mörk fasett
  g.poly([[-5, -21], [0, -27], [-0.5, -20]], m, 5); g.poly([[0, -27], [4, -21], [-0.5, -20]], m, 2);                                 // slipad topp
  g.line(-5, -21, 4, -21, m, 4); g.dot(-2, -10, C.white, 5); g.dot(0, -5, C.white, 5); g.dot(-3, -4, C.white, 5);
  if (hu > 0.05) { g.ell(-1, -7.5, 2.6, 1.6, C.orange, false, null, 4); g.poly([[-3, -7.5], [-5.5, -9.5], [-5.5, -5.5]], C.orange, 3); g.dot(0, -8, C.white, 5); }   // fisken har vänt sig
  else { g.ell(-1.5, -7.5, 2.6, 1.6, C.orange, false, null, 4); g.poly([[0.5, -7.5], [3, -9.5], [3, -5.5]], C.orange, 3); g.dot(-3, -8, C.dark, 0); }
  if (hu > 0.05) { g.line(3, -19, 5, -16, m, 0); g.line(5, -16, 3, -13, m, 0); g.line(5, -16, 6, -15, m, 0); }                       // spricka
  if (ow) { wince(g, -5, -19, false); wince(g, -1, -19, true); }
  else if (scared || a > 0) { eye(g, -5, -19, 3, 3, { pw: 1, ph: 1, dx: 1, dy: 1 }); eye(g, -1, -19, 3, 3, { pw: 1, ph: 1, dx: 1, dy: 1 }); }
  else { eye(g, -5, -19, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1 }); eye(g, -1, -19, 3, 3, { shut, pw: 2, ph: 2, dx: 0, dy: 1 }); }
  if (!ow) { g.line(-5, -20, -4, -21, m, 1); g.line(0, -21, 1, -20, m, 1); }                                                         // oroliga ögonbryn
  if (a > 0.05) g.rect(-4, -15, 5, 2 + rnd(A.h * 2), C.dark, 0);
  else if (scared) g.rect(-3, -15, 2, 2, C.dark, 0);
  else { const ch = cold && sin(t * 50) > 0 ? 1 : 0; g.rect(-5, -15, 6, 2, C.white, 5); for (const tx of [-4, -2, 0]) g.dot(tx - ch, -15, C.dark, 0); g.rect(-5, -14, 6, 1, C.dark, 0); }   // tänderna skallrar
  g.end();
  g.begin();                                             // toppluvan hänger på sidoskottet som på en krok, och gungar efter
  const sw = wave(t * 1.1 - 1.2) * 0.12 + clamp(slip) * 0.5 + hu * 0.7 - A.h * 0.9 + A.q * 0.6 + sh * 0.1;
  g.push(12, -15 - max(0, hr) * 5 - (scared ? clamp(slip) * 2 : 0), 0.35 + sw);
  g.poly([[-3.5, 1], [-3, -3], [0, -5], [3, -3], [3.5, 1]], C.red, 3); g.rect(-4, 0, 8, 2, C.white, 4);
  g.ell(0.5, -5.5, 1.7, 1.7, C.white); g.dot(-1, -2, C.white, 5); g.dot(1, -2, C.white, 5);
  g.pop();
  g.end();
  g.pop(); g.pop();
  if (a > 0.45) { g.begin(); spray(g, -14 * k, -9 * k, (a - 0.45) / 0.55, 6, C.ice, { rp2: C.white, dist: 24, spread: 4, fall: 2 }); g.end(); }
  if (hu > 0.05) { g.begin(); spray(g, 9 * k, -12 * k, 1 - hu, 3, C.ice, { dir: 1, dist: 8, spread: 3, fall: 9 }); g.end(); }
}

// ====================================================================================================
// SIZZLE: en sur lavaklump med stenskorpa: tre skorpflak som ryggplattor, ett tungt ögonbryn av sten,
// underbett med två stentänder, och en smält kärna som lyser igenom i magen.
// Vana: bubblar och fräser, men svalnar då och då: skorpan växer över kroppen, ögonen faller ihop, den somnar ("z"),
// rycker till, skakar av sig skorpan och flammar upp igen.
// Attack: drar efter andan, kastar sig fram med gapet öppet och spottar en glödklick. Plattorna skallrar efteråt.
// Träff: plattas till, plattorna hoppar av ryggen en efter en och landar igen, en rökpuff ur toppen.
// ====================================================================================================
const CRUST = R('#5a3a44'), PLATE = R('#93606a'), TOOTH = R('#cdbfae');
const PLATES = [[-2, 2.5, -0.2, 1], [4.5, 4, 0.5, 0.85], [9, 8, 1.05, 0.65]];
function sizzle(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1, m = R(o.hex || '#e2552a');
  const idle = a <= 0 && hu <= 0, x = idle ? (t + 4) % 8.2 : 99;
  const cool = x < 1.6 ? eIO(x / 1.6) : x < 2.3 ? 1 : x < 2.42 ? 1 - (x - 2.3) / 0.12 : 0;
  const flare = x >= 2.3 && x < 3.1 ? 1 - eOut((x - 2.3) / 0.8) : 0, jit = x > 2.12 && x < 2.4 ? (sin(t * 60) > 0 ? 1 : -1) : 0;
  const s = (a > 0 ? -1.2 * A.w + 1.6 * A.h + A.q * 1.2 : wave(t * 2.2) * 0.35 * (1 - cool) + flare * 1.5 - cool * 0.5) - hr * 2.2;
  const rx = 10 - s * 0.6, ry = 7.5 + s * 1.1, cy = -1 - ry * 0.8, top = cy - ry, ow = hu > 0.25, shut = blinkAt(t, 2) || cool > 0.85;
  const ey = rnd(cy - 3), j = a > 0.05 ? rnd(A.w + A.h * 3) : flare > 0.3 ? 2 : 0, jy = cy + 2.5 + j;
  g.push(hu * 2 + jit * 0.5, 0, A.w * 0.16 - A.h * 0.26 - A.q * 0.08 + hr * 0.12, k);
  g.begin();                                             // fötter, svans och den smälta kroppen
  g.rect(-8, -2, 4, 2, CRUST, 2); g.rect(4, -2, 4, 2, CRUST, 3);
  g.poly([[7, -5], [13, -3], [13, -1], [7, -1]], m, 2);
  g.ell(-1, cy, rx, ry, m, true, (dx, dy) => dy < 0.75);
  g.ell(2, cy + 2.5, 5, 2.8, C.fire, false, null, 4); g.ell(3, cy + 3, 2.5, 1.4, C.fire2, false, null, 5);                           // smält kärna
  g.ell(-2, top + 2.5, 4.5, 1.6, C.fire2, false, null, 5); g.ell(5, top + 4.5, 3.5, 1.6, C.fire2, false, null, 4);                   // glöd under plattorna
  if (cool < 0.5) { const bu = (t * 0.55) % 1; if (bu < 0.8) g.ell(7, cy - 1, 1 + bu * 1.8, 1 + bu * 1.6, C.fire2, false, null, 5); else { g.dot(5, cy - 3, C.fire2, 5); g.dot(9, cy - 4, C.fire2, 5); g.dot(8, cy + 1, C.fire2, 5); } }   // bubbla som spricker
  if (cool > 0.05) g.ell(-1, cy, rx, ry, CRUST, false, (dx, dy) => dy < 0.75 && dy < -1 + cool * 1.5 + 0.16 * sin(dx * 9), 2);        // skorpan växer när den svalnar
  g.rect(-10, cy + 2, 7, 1 + j, cool > 0.6 ? C.fire : C.fire2, 5);                                                                   // glödande gap
  g.end();
  g.begin();                                             // ryggplattor: hoppar av en efter en vid träff, skallrar efter slaget
  PLATES.forEach(([bx, by, an, sc], i) => {
    const pop = hu > 0 ? bump((1 - hu - i * 0.12) / 0.7) * 5 : flare * (i % 2 ? 3 : 2) + max(0, A.q * (i % 2 ? 1 : -1)) * 2;
    g.push(bx, top + by, an + (hu > 0 ? (i - 1) * pop * 0.09 : 0) - A.w * 0.15 + A.h * 0.1, sc);
    g.poly([[-3, 1 - pop], [-2.5, -5 - pop], [0.5, -7 - pop], [3, -4 - pop], [3, 1 - pop]], PLATE, 3);
    g.poly([[-2.5, -5 - pop], [0.5, -7 - pop], [0, -3 - pop], [-2, -2 - pop]], PLATE, 5); g.line(1, -4 - pop, 2, -1 - pop, PLATE, 1);
    g.rect(-2, -pop, 4, 1, C.fire, 4);                                                                                               // plattans fot glöder
    g.pop();
  });
  g.end();
  g.begin();                                             // ögon under ett tungt ögonbryn av sten, och underbett
  const br = (flare > 0.25 || ow ? -2 : 0) + (cool > 0.5 ? 1 : 0) - rnd(A.w);
  if (ow) { wince(g, -10, ey, false); wince(g, -6, ey - 1, true); }
  else if (flare > 0.25) { eye(g, -10, ey, 3, 3, { pw: 1, ph: 1, dx: 1, dy: 1 }); eye(g, -6, ey - 1, 3, 3, { pw: 1, ph: 1, dx: 1, dy: 1 }); }   // klarvaken
  else if (shut || cool > 0.4) { g.rect(-10, ey + 2, 3, 1, C.dark, 0); g.rect(-6, ey + 1, 3, 1, C.dark, 0); }                        // sömniga springor
  else { eye(g, -10, ey, 3, 3, { pw: 1, ph: 2, dy: 1 }); eye(g, -6, ey - 1, 3, 3, { pw: 1, ph: 2, dy: 1 }); }
  g.poly([[-12, ey - 1 + br], [-3, ey - 4 + br], [-2, ey - 2 + br], [-11, ey + 1 + br]], PLATE, 2);
  g.poly([[-12, jy], [-11, jy + 3], [-4, jy + 3.5], [-2, jy + 1], [-5, jy + 0.5]], PLATE, 2);
  g.rect(-10, jy - 2, 1, 2, TOOTH, 4); g.rect(-6, jy - 1, 1, 2, TOOTH, 4);
  g.end();
  if (idle && x > 1.3 && x < 2.3) {                      // sover: ett litet z stiger
    const q = (x - 1.3) % 0.5 / 0.5, zx = rnd(-13 - q * 3), zy = rnd(top - 3 - q * 5);
    g.begin(); g.rect(zx, zy, 4, 1, C.white, 5); g.dot(zx + 2, zy + 1, C.white, 5); g.dot(zx + 1, zy + 2, C.white, 5); g.rect(zx, zy + 3, 4, 1, C.white, 5); g.end({ edge: false });
  }
  if (flare > 0.05) { g.begin(); for (let i = 0; i < 5; i++) g.rect(-7 + i * 3.5, top - 3 - (1 - flare) * 9 - (i % 2) * 3, flare > 0.5 ? 2 : 1, flare > 0.5 ? 2 : 1, i % 2 ? CRUST : C.fire2, i % 2 ? 3 : 5); g.end({ outline: false, edge: false }); }   // skorpflagor och gnistor
  if (hu > 0.05) { g.begin(); for (let i = 0; i < 3; i++) g.rect(-4 + i * 3, top - 4 - (1 - hu) * 9 - (i % 2) * 2, 2, 2, C.smoke, 4); g.end(); }      // rökpuff
  if (idle && cool < 0.3 && !flare) { g.begin(); for (let i = 0; i < 2; i++) { const ph = (t * 1.1 + i * 0.5) % 1; g.rect(i ? 10 : -12, cy - 2 - ph * 9, ph < 0.5 ? 2 : 1, ph < 0.5 ? 2 : 1, C.fire2, ph < 0.6 ? 5 : 3); } g.end({ outline: false, edge: false }); }
  if (a > 0.5) {                                         // spottar en glödklick
    const u = (a - 0.5) / 0.5, px = -13 - eOut(u) * 24, py = cy + 3 - sin(u * PI) * 6 + u * 7;
    g.begin(); g.ell(px, py, 2.6 - u, 2.6 - u, C.fire2); g.rect(px + 4, py - 1, 2, 2, C.fire, 5); g.dot(px + 8, py, C.fire, 4); g.end();
  }
  g.pop();
}

// ====================================================================================================
// THE SNOWBIES: fnittriga snöbollsungar på snöbollskrig. Pinnarmar med röda vantar, morotsnäsa, en kvist som lugg
// och en snöboll redo i handen.
// Vana: kastar upp bollen och fångar den, fnittrar, och tappar den ibland i huvudet (sitter kvar som en mössa, skakas av).
// Attack: tar sats bakåt och kastar bollen i en båge, och rullar ihop en ny.
// Träff: plattas till, tappar bollen i luften och näsan hänger.
// ====================================================================================================
function snowbie(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1;
  const idle = a <= 0 && hu <= 0, x = idle ? t % 6.6 : 99;
  let bx = 8, by = -15, br = 2.5, cap = 0, shake = 0, flick = 0;
  if (idle) {
    if (x < 4.4) { const u = (x % 2.2) / 0.6; if (u < 1) { by -= bump(u) * 6; flick = u < 0.25 ? 1 : 0; } }
    else if (x < 5.2) { const q = (x - 4.4) / 0.8; bx = 8 - eIn(q) * 8; by = -15 - sin(q * PI) * 9 + q * 1.5; flick = q < 0.2 ? 1 : 0; }   // för högt: den landar på huvudet
    else if (x < 5.9) { cap = 1; br = 0; }
    else if (x < 6.2) { cap = 1 - (x - 5.9) / 0.3; shake = sin(t * 60) > 0 ? 1 : -1; br = 0; }
    else br = 2.5 * eOut((x - 6.2) / 0.4);
  }
  const gig = idle && x < 4.2 && ev(t, 4.7, 0.9, 2) > 0, q = max(0, hr) * 0.3 + (cap > 0.5 ? 0.1 : 0) + A.w * 0.1, rx = 5.5 * (1 + q), ry = 5.5 * (1 - q);
  const cy = -2 - ry - (gig ? step(t, 22) : 0), ow = hu > 0.25, shut = blinkAt(t, 1) || cap > 0.5;
  const hx = 7.5 + A.w * 1.5 - A.h * 12.5, hy = -13 + A.w * 4 - A.h * 1.5 - flick + (hu > 0 ? 2 : 0);
  if (a > 0) { bx = hx + 0.5; by = hy - 2; br = a < 0.47 ? 2.5 : a > 0.8 ? 2.5 * eOut((a - 0.8) / 0.2) : 0; }
  if (hu > 0) { by -= sin(hu * PI) * 6; bx += (1 - hu) * 2; }
  g.push(hu * 2 + shake * 0.6, 0, A.w * 0.25 - A.h * 0.3 + hr * 0.2, k);
  g.begin();                                             // bortre armen med vante och snöboll
  g.thick(4, cy - 1, hx, hy, 1.4, C.wood, 2); g.rect(hx - 1, hy - 1, 2, 2, C.red, 3);
  if (br > 0.4) g.ell(bx, by, br, br, C.snow);
  g.end();
  g.begin();                                             // fötter, kropp och ansikte
  g.rect(-4, -2, 3, 2, C.wood, 2); g.rect(1, -2, 3, 2, C.wood, 3);
  g.ell(0, cy, rx, ry, C.snow);
  if (cap <= 0.5) { g.thick(0, cy - ry + 1, 1, cy - ry - 3, 1.4, C.wood, 3); g.line(1, cy - ry - 2, 3, cy - ry - 4, C.wood, 3); }     // kvist som lugg
  const fy = rnd(cy - 3);
  if (ow) { wince(g, -5, fy - 1, false); wince(g, -1, fy - 1, true); }
  else if (gig) { happy(g, -5, fy); happy(g, -1, fy); }
  else if (shut) { g.rect(-4, fy + 1, 2, 1, C.dark, 0); g.rect(0, fy + 1, 2, 1, C.dark, 0); }
  else { g.rect(-4, fy, 2, 2, C.dark, 0); g.rect(0, fy, 2, 2, C.dark, 0); g.dot(-4, fy, C.white, 5); g.dot(0, fy, C.white, 5); }
  g.poly(hu > 0.1 ? [[-3, fy + 2], [-6, fy + 6], [-2, fy + 4]] : [[-3, fy + 2], [-8, fy + 3], [-3, fy + 4]], C.orange, 4);           // näsan hänger vid träff
  if (gig || a > 0.4) g.rect(-3, fy + 5, 3, 2, C.dark, 0); else { g.dot(-3, fy + 5, C.dark, 0); g.dot(-2, fy + 6, C.dark, 0); g.dot(-1, fy + 6, C.dark, 0); g.dot(0, fy + 5, C.dark, 0); }
  g.dot(2, fy + 3, C.pink, 3);
  const ax = -7 - A.w * 1 + (gig ? 0 : 0), ay = cy + 3 - A.w * 3 - (gig ? step(t, 22) * 2 : 0);
  g.thick(-4, cy + 1, ax, ay, 1.4, C.wood, 3); g.rect(ax - 1, ay - 1, 2, 2, C.red, 4);                                              // närmre armen
  if (cap > 0.05) g.ell(0, cy - ry - 0.5, 4 * cap + 0.5, 1.8, C.snow, false, null, 5);                                              // bollen som mössa
  g.end();
  if (shake) { g.begin(); spray(g, 0, cy - ry - 2, 1 - cap, 4, C.snow, { dist: 7, spread: 5, fall: 4 }); g.end(); }
  g.pop();
  if (a >= 0.47 && a < 0.97) {                           // bollen i luften
    const u = (a - 0.47) / 0.5, fx = (-6 - eOut(u) * 24) * k, fyy = (-15 - sin(u * PI) * 3 + u * 9) * k;
    g.begin(); g.ell(fx, fyy, 2.5 * k, 2.5 * k, C.snow); g.end();
    g.begin(); for (let i = 1; i < 3; i++) g.rect(fx + i * 4, fyy + i, 1, 1, C.snow, 5); g.end({ outline: false, edge: false });
  }
}

// ====================================================================================================
// COAL CREW: små kolbitar som vill se farliga ut. Röda boxhandskar, skrovlig kant och en glödgnista som lugg.
// Vana: spänner musklerna (armarna upp, sprickorna glöder, gnistan blir en låga, belåten min) och pyser ihop med en rökpuff.
// Attack: hukar, flammar upp orange och dubbelt så stor och boxar framåt.
// Träff: slocknar och blir askgrå, luggen blir rök.
// ====================================================================================================
const COAL = R('#5d5172'), ASH = R('#a09cae');
function coal(g, t, pose, o) {
  const { a, hu } = P(pose), A = act(a), hr = rec(hu), k = o.k || 1;
  const idle = a <= 0 && hu <= 0, x = idle ? t % 3.9 : 99;
  const flex = x < 0.22 ? eOut(x / 0.22) : x < 1.1 ? 1 : x < 1.3 ? 1 - eIO((x - 1.1) / 0.2) : 0, puff = x >= 1.2 && x < 1.9 ? (x - 1.2) / 0.7 : 0;
  const hot = a > 0 ? clamp(A.h * 1.3) : 0, m = hu > 0.12 ? ASH : hot > 0.5 ? C.fire : COAL, glow = hot > 0.5 ? C.fire2 : C.fire;
  const cr = rnd(A.w * 2) - (flex > 0.5 ? 1 : 0) + (idle && !flex ? step(t, 2.8) : 0), Y = cr;
  g.push(hu * 2, -hot * 2, hr * 0.5 + A.w * 0.15 - A.h * 0.2, k * (1 + hot * 0.3));
  g.begin();
  if (hu > 0.05) { g.rect(0, -13 - (1 - hu) * 6, 2, 2, C.smoke, 4); g.dot(2, -15 - (1 - hu) * 8, C.smoke, 3); }                      // luggen slocknar
  else if (hot > 0.3 || flex > 0.5) { const f = sin(t * 30) * 1.2, F = hot > 0.3 ? 1 : 0.6; g.poly([[-3, -9 + Y], [-2, -9 + Y - (5 + f) * F], [0, -11 + Y], [2, -9 + Y - (7 - f) * F], [4, -9 + Y]], C.fire2, 5); }
  else { const f = step(t, 12); g.rect(1, -12 - f + Y, 1, 2 + f, C.fire, 5); g.dot(2, -13 - f * 2 + Y, C.fire2, 5); }                // glödgnista som lugg
  g.rect(-4, -2, 3, 2, m, 1); g.rect(2, -2, 3, 2, m, 1);
  // armar: hänger, spänns uppåt, eller boxar framåt
  const jab = idle && !flex && x > 1.9 ? (step(t, 9) ? 1 : 0) : 0, gl = hu > 0.12 ? ASH : C.red;                                      // skuggboxas lite mellan varven
  const lx = -8 - jab * 2 - flex - A.h * 5 + A.w * 2, ly = -7 - flex * 5 - A.h * 1 + Y * (1 - flex), rxx = 8 + flex + A.w - jab, ryy = -6 - flex * 6 - A.w * 3 + Y * (1 - flex);
  g.thick(-5, -6 + Y, -8 - flex, -5 + Y - flex, 2, m, 2); g.thick(-8 - flex, -5 + Y - flex, lx, ly, 2, m, 2); g.rect(lx - 1.5, ly - 1.5, 3, 3, gl, 4);
  g.thick(5, -6 + Y, 8 + flex, -5 + Y - flex, 2, m, 1); g.thick(8 + flex, -5 + Y - flex, rxx, ryy, 2, m, 1); g.rect(rxx - 1.5, ryy - 1.5, 3, 3, gl, 2);
  g.poly([[-6, -3], [-7, -7 + Y], [-3, -11 + Y], [3, -10 + Y], [7, -6 + Y], [6, -2], [0, -2]], m, 3);
  g.poly([[-3, -11 + Y], [3, -10 + Y], [1, -8 + Y], [-4, -8 + Y]], m, 5);
  if (hot <= 0.5 && hu <= 0.12) { g.line(3, -7 + Y, 5, -4, glow, flex > 0.5 ? 5 : 3); g.line(5, -4, 4, -3, glow, flex > 0.5 ? 5 : 3); if (flex > 0.5) { g.dot(-6, -5, C.fire2, 5); g.dot(1, -3, C.fire2, 5); } }   // sprickan glöder
  if (hu > 0.25) { g.rect(-5, -6 + Y, 2, 1, C.dark, 0); g.rect(-1, -6 + Y, 2, 1, C.dark, 0); }
  else if (flex > 0.5) { g.rect(-5, -6 + Y, 2, 1, C.fire2, 5); g.rect(-1, -6 + Y, 2, 1, C.fire2, 5); g.rect(-4, -4 + Y, 3, 1, C.white, 5); }   // belåten: blundar och ler brett
  else { const ec = hot > 0.5 ? C.white : C.fire2; g.rect(-5, -7 + Y, 2, 2, ec, 5); g.rect(-1, -7 + Y, 2, 2, ec, 5); g.dot(-5, -6 + Y, C.dark, 0); g.dot(-1, -6 + Y, C.dark, 0); g.line(-6, -9 + Y, -4, -8 + Y, m, 1); g.line(-1, -8 + Y, 1, -9 + Y, m, 1); if (a > 0.05) g.rect(-4, -4 + Y, 3, 1, C.dark, 0); }
  g.end();
  if (puff > 0) { g.begin(); g.ell(1 + puff * 2, -13 - puff * 6, 1.5 + puff * 1.5, 1.2 + puff, C.smoke, false, null, 4); g.end(); }  // pyser ihop
  if (a > 0.75) { g.begin(); const u = (a - 0.75) / 0.25; g.ell(1, -13 - u * 6, 2 + u * 2, 1.5 + u * 1.5, C.smoke, false, null, 4); g.end(); }
  g.pop();
}

// ====================================================================================================
// ROSTER: samma id, värld, nivå, antal och fält som i game/enemies.js (h och w är det som faktiskt ritas).
// Läggs in med samma slinga som bossarna:
//   for (const b of ROSTER_BLOBS) { const old = ROSTER.find((e) => e.id === b.id); if (old) Object.assign(old, { draw: b.draw, h: b.h, w: b.w, name: b.name }); }
// ====================================================================================================
const E = (id, name, world, tier, h, w, draw, extra = {}) => ({ id, name, world, tier, h, w, count: 1, fly: false, draw, ...extra });

export const ROSTER_BLOBS = [
  E('kladdis', 'Sprout', 0, 1, 29, 23, (g, t, p) => sprout(g, t, p, { hex: '#b6e36a' })),
  E('geggis', 'Gunk', 2, 1, 23, 39, (g, t, p) => gunk(g, t, p, { hex: '#a9c83c', k: 1.1 })),
  E('isbiten', 'Shiver', 3, 1, 28, 30, (g, t, p) => shiver(g, t, p, { hex: '#5cc4f2' })),
  E('lavaklick', 'Sizzle', 4, 1, 27, 36, (g, t, p) => sizzle(g, t, p, { hex: '#e2552a', k: 1.35 })),
  E('snowbies', 'The Snowbies', 3, 1, 19, 23, (g, t, p) => snowbie(g, t, p, {}), { count: 4 }),
  E('coalcrew', 'Coal Crew', 4, 1, 16, 22, (g, t, p) => coal(g, t, p, {}), { count: 5 }),
];
export const BY_ID_BLOBS = Object.fromEntries(ROSTER_BLOBS.map((e) => [e.id, e]));
