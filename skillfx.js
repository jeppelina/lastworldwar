// Skillträdets utseende: allt som ritas runt, bakom och på hjälten, samt spår, träffar, superattacker och segerjubel.
// Modulen lägger sig UTANPÅ spelets drawHero (game/hero.js, den omritade hjälten). Den läser hjältens fästpunkter ur
// heroPose() och hjältens siluett ur bilden (skillnaden före och efter att hjälten ritats), så den behöver inget mer
// av hjälten än de två krokar som redan finns där: heroPose och a.build (plus a.noScarf när huvan bärs).
// lk = looks(state) ur skills.js: vad de burna stegen lägger på (högst ett steg per nivå). st = newFxState(), ett litet
// minne per hjälte (spår, efterbilder). Koordinater: hjältens 80x72-ruta, fötterna vid y = 61, ansiktet åt höger.
// Kopia av prototypes/skilltree/skillfx.js. En sak skiljer: huvan ritas också i förminskad skala (kartmarkören och
// knappen Players), då utan skuggan över pannan som behöver hjältens pixlar. Annars stod hjälten där med platt hår utan huva.
import { ramp } from './pixel.js';
import { drawHero, drawPet, heroPose } from './hero.js';

const C = Object.fromEntries(Object.entries({
  ember: '#ff7a1f', gold: '#ffd84a', red: '#d8433b', rock: '#8a7c70', white: '#ffffff', shadow: '#1d1b2e', belt: '#f2b632', char: '#6a3038',
  vio: '#9a6bff', cyan: '#7fe9ff', ink: '#5a4ab0', teal: '#4fe0c0', smoke: '#3a3260', night: '#2e2a5c',
  leaf: '#3fa650', lime: '#b4f060', bark: '#7a5236', moss: '#4f8a3c', bone: '#e8dcc0', spirit: '#cfeee6', pine: '#3c6f66',
}).map(([k, v]) => [k, ramp(v)]));
const TAU = Math.PI * 2;
const rnd = (n) => { const s = Math.sin(n * 127.1 + 11.7) * 43758.5453; return s - Math.floor(s); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const bump = (p) => Math.sin(clamp(p, 0, 1) * Math.PI);
const step = (t, fps) => Math.floor(t * fps) / fps;                                    // tiden i hack, som en pixelanimation
const wob = (x, t) => (Math.sin(x * 1.3 + t * 7) + Math.sin(x * 0.7 - t * 5.3) + Math.sin(x * 2.9 + t * 11)) / 6 + 0.5;   // mjukt brus 0..1
const flat = (g) => g.end({ outline: false, edge: false });
const EYE = { might: ['gold', 'ember'], magic: ['cyan', 'vio'], shadow: ['teal', 'ink'], druid: ['lime', 'leaf'] };
const FEET = 39.5;                                                                     // hjältens mitt i sidled (heroPose().feet[0])

export const newFxState = () => ({ trail: [], hist: [], clone: null });

// ---------- Siluetten: vilka pixlar hjälten ritade ----------
// Rutan är större än 80x72 eftersom vapen sticker ut. Fungerar bara när transformen är en ren förflyttning.
const BX = -28, BY = -30, BW = 140, BH = 104;
const snapR = new Int16Array(BW * BH), snapL = new Int8Array(BW * BH), mask = new Uint8Array(BW * BH);
function snap(g, x0, y0) {
  for (let y = 0; y < BH; y++) { const cy = y0 + y; if (cy < 0 || cy >= g.h) continue;
    for (let x = 0; x < BW; x++) { const cx = x0 + x; if (cx < 0 || cx >= g.w) continue; const i = cy * g.w + cx; snapR[y * BW + x] = g.R[i]; snapL[y * BW + x] = g.L[i]; } }
}
function diff(g, x0, y0) {
  mask.fill(0);
  for (let y = 0; y < BH; y++) { const cy = y0 + y; if (cy < 0 || cy >= g.h) continue;
    for (let x = 0; x < BW; x++) { const cx = x0 + x; if (cx < 0 || cx >= g.w) continue; const i = cy * g.w + cx, j = y * BW + x;
      if (g.R[i] >= 0 && (g.R[i] !== snapR[j] || g.L[i] !== snapL[j])) mask[j] = 1; } }
}
const M = (x, y) => x >= 0 && y >= 0 && x < BW && y < BH && mask[y * BW + x] === 1;
// Hör pixeln (hjältens koordinater) till hjälten, och är den inte kontur? Används för sådant som ska ligga PÅ kroppen.
const onBody = (g, O, x, y) => { const X = O[0] + x, Y = O[1] + y; return M(x - BX, y - BY) && X >= 0 && Y >= 0 && X < g.w && Y < g.h && g.L[Y * g.w + X] !== 0; };
// En skuggbild av hjälten: hjälten ritas en gång till på en annan plats och färgas om till en enda färg, med skuggningen kvar.
// far = längst bort, då blir bara varannan pixel kvar. X, Y = bildkoordinater för hjältens ruta. Ritas före den riktiga hjälten.
function clone(g, look, gear, a, build, P, X, Y, far) {
  const sv = g.t, anchor = g.anchor, x0 = X + BX, y0 = Y + BY;
  g.t = { x: 0, y: 0, a: 0, c: 1, s: 0, k: 1 }; g.anchor = {};
  snap(g, x0, y0);
  g.push(X, Y); drawHero(g, look, gear, { ...a, noShadow: true, noPet: true, noFx: true, blink: false, build }); g.pop();
  for (let y = 0; y < BH; y++) { const cy = y0 + y; if (cy < 0 || cy >= g.h) continue;
    for (let x = 0; x < BW; x++) { const cx = x0 + x; if (cx < 0 || cx >= g.w) continue; const i = cy * g.w + cx, j = y * BW + x;
      if (g.R[i] < 0 || (g.R[i] === snapR[j] && g.L[i] === snapL[j])) continue;
      if (far && ((x + y) & 1)) { g.R[i] = snapR[j]; g.L[i] = snapL[j]; } else { g.R[i] = far ? C.smoke : C.ink; g.L[i] = Math.min(4, g.L[i]); } } }
  for (const [ex, ey] of P.eyes) for (let d = 0; d < 2; d++) { const cx = X + ex + d, cy = Y + ey + (P.eyeH > 1 ? 1 : 0); if (!far && cx >= 0 && cy >= 0 && cx < g.w && cy < g.h) { g.R[cy * g.w + cx] = C.teal; g.L[cy * g.w + cx] = 5; } }
  g.t = sv; g.anchor = anchor;
}

// ---------- Kanter som följer siluetten (slutdräkterna) ----------
// Magic: en ljuskant runt hela siluetten som vandrar, med enstaka gnistor.
function rimMagic(g, x0, y0, t) {
  const k = Math.floor(t * 7);
  g.begin();
  for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
    if (M(x, y) || !(M(x + 1, y) || M(x - 1, y) || M(x, y + 1) || M(x, y - 1))) continue;
    const ph = (x + y * 2 + k) % 6; if (ph > 4) continue;
    const sp = rnd(x * 7 + y * 13 + k) < 0.07;
    g.set(x0 + x, y0 + y, sp ? C.white : ph < 2 ? C.cyan : C.vio, sp ? 5 : ph < 2 ? 5 : 4);
  }
  flat(g);
}
// Shadow: rökslingor som drar bakåt (åt vänster) från siluettens bakkant.
function rimShadow(g, x0, y0, t) {
  const tt = step(t, 10);
  g.begin();
  for (let y = 2; y < BH - 2; y++) {
    const n = wob(y * 1.1 + 3, tt * 0.7); if (n < 0.38) continue;
    const len = 2 + Math.floor((n - 0.38) * 14);
    for (let x = 1; x < BW - 1; x++) {
      if (!M(x, y) || M(x - 1, y)) continue;
      for (let j = 1; j <= len; j++) { const xx = x - j, yy = y - (j >> 1); if (M(xx, yy)) break; if (j > len * 0.5 && ((xx + yy) & 1)) continue; g.set(x0 + xx, y0 + yy, j === len && n > 0.7 ? C.teal : C.smoke, j === len && n > 0.7 ? 4 : j < 3 ? 2 : 3); }
      break;                                                                           // bara den yttersta bakkanten på varje rad
    }
  }
  flat(g);
}
// Druid: månljus. En blek kant längs allt som vetter uppåt och bakåt, som om månen stod snett bakom hjälten.
function rimMoon(g, x0, y0, t) {
  const k = Math.floor(t * 3);
  g.begin();
  for (let y = 1; y < BH - 1; y++) for (let x = 1; x < BW - 1; x++) {
    if (M(x, y) || !(M(x + 1, y) || M(x, y + 1))) continue;
    if ((x * 3 + y + k) % 7 === 0) continue;
    g.set(x0 + x, y0 + y, (x + y * 2 + k) % 9 === 0 ? C.lime : C.spirit, 5);
  }
  flat(g);
}

// ---------- Nivå 1: huvud och blick ----------
function bandTails(g, P, t) {
  const Y = P.head[1] - 0.5, w = Math.round(Math.sin(t * 5) * 1.5), w2 = Math.round(Math.sin(t * 5 + 1.2) * 1.5);
  g.begin(); g.thick(30, Y - 4, 23, Y - 3 + w, 2.2, C.red, 3); g.thick(30, Y - 3, 24, Y + 2 + w2, 2.2, C.red, 2); g.end();
}
function bandFront(g, P) {
  if (P.helmet) return;
  const Y = P.head[1] - 0.5;
  g.begin(); g.rect(30, Y - 5, 20, 2, C.red, 3); g.rect(30, Y - 5, 20, 1, C.red, 4); g.rect(29, Y - 5, 2, 3, C.red, 2); flat(g);
}
// Shadow: en trasig halvmantel som hänger från axlarna och fladdrar bakåt. Ritas bakom hjälten.
function cloakBack(g, P, t) {
  const y = P.neck[1], w1 = Math.round(Math.sin(t * 2.6) * 1.4), w2 = Math.round(Math.sin(t * 2.6 - 1.1) * 2.2), w3 = Math.round(Math.sin(t * 2.6 - 2.1) * 2.6);
  g.begin();
  g.poly([[31, y - 1], [46, y - 1], [45, y + 9], [37, y + 13], [33 + w1, y + 22], [29 + w1, y + 17], [25 + w2, y + 25], [22 + w2, y + 18], [16 + w3, y + 24], [17 + w3, y + 15], [12 + w3, y + 15], [19 + w2, y + 8], [25 + w1, y + 3]], C.night, 3);
  g.poly([[31, y - 1], [25 + w1, y + 3], [19 + w2, y + 8], [12 + w3, y + 15], [17 + w3, y + 13], [23 + w2, y + 8], [29 + w1, y + 4]], C.ink, 4);   // ljusare överkant
  g.end();
  g.begin(); for (const [x, yy] of [[33 + w1, y + 21], [25 + w2, y + 24], [16 + w3, y + 23], [12 + w3, y + 15]]) g.dot(x, yy, C.teal, 5); flat(g);        // fransarnas spetsar glimmar
}
// Huvan och kragen. Ansiktets övre del hamnar i skugga, så att ögonen lyser ur mörkret. Under hjälm blir bara kragen kvar.
function hoodFront(g, P, O, t, shade = true) {
  const y = P.neck[1], Y = P.head[1] - 0.5;
  g.begin(); g.poly([[32, y - 2.5], [47, y - 2.5], [47, y + 2], [40.5, y + 4.5], [32, y + 3]], C.night, 3); g.poly([[32, y - 2.5], [47, y - 2.5], [47, y - 1], [32, y - 1]], C.ink, 4); g.end();
  g.begin(); g.rect(39, y + 1, 2, 2, C.teal, 5); flat(g);                                                                                               // spänne
  if (P.helmet) return;
  const Yr = Math.round(Y); if (shade) { g.begin(); for (let yy = Yr - 6; yy <= Yr + 2; yy++) for (let x = 37; x <= 51; x++) if (onBody(g, O, x, yy) && (yy < Yr || ((x + yy) & 1))) g.set(O[0] + x, O[1] + yy, C.smoke, yy < Yr - 2 ? 2 : 3); flat(g); }   // huvans skugga faller över pannan och tunnas ut över ögonen
  const sw = Math.round(Math.sin(t * 2.6 - 0.8) * 1);
  g.begin();
  g.poly([[30, Y - 3], [22 + sw, Y + 3], [20 + sw, Y + 10], [25, Y + 9], [29, Y + 6]], C.night, 2);                                                       // toppen som hänger bakåt
  g.ell(39.5, Y + 0.5, 12.8, 11.8, C.night, true, (dx, dy) => !(dx > -0.2 && dy > -0.5 && dy < 0.82));
  g.ell(39.5, Y + 0.5, 12.8, 11.8, C.ink, false, (dx, dy, d2) => dx > -0.34 && dx <= -0.2 && dy > -0.5 && dy < 0.82 || (dy <= -0.5 && dy > -0.62 && dx > -0.2 && d2 < 0.9), 4);   // kantband runt öppningen
  g.end();
}
// Druid: horn av grenar. Bakom huvudet, så att de sticker fram bakom hår och hjälm.
function antlers(g, P) {
  const Y = P.head[1] - 0.5;
  g.begin();
  g.thick(34, Y - 8, 30, Y - 14, 2.4, C.bone, 3); g.thick(30, Y - 14, 24, Y - 15, 1.9, C.bone, 3); g.thick(30, Y - 14, 30, Y - 21, 1.9, C.bone, 4); g.thick(27, Y - 14.5, 25, Y - 19, 1.5, C.bone, 4);
  g.thick(44, Y - 9, 49, Y - 15, 2.4, C.bone, 3); g.thick(49, Y - 15, 55, Y - 16, 1.9, C.bone, 3); g.thick(49, Y - 15, 49, Y - 22, 1.9, C.bone, 4); g.thick(52, Y - 15.5, 54, Y - 20, 1.5, C.bone, 4);
  g.end();
  g.begin(); for (const [x, y] of [[23, Y - 16], [30, Y - 22], [24, Y - 20], [55, Y - 17], [49, Y - 23], [54, Y - 21]]) g.dot(x, y, C.lime, 5); flat(g);  // spetsarna glöder svagt
}
function circlet(g, P, t) {
  if (P.helmet) return;
  const Y = P.head[1] - 0.5;
  g.begin(); g.rect(30, Y - 5, 20, 2, C.bark, 3); g.rect(30, Y - 5, 20, 1, C.bark, 4); for (const x of [32, 37, 42]) g.dot(x, Y - 4, C.moss, 4); flat(g);
  g.begin(); g.poly([[45, Y - 4], [47, Y - 7.5], [49, Y - 4], [47, Y - 2]], C.leaf, 4); g.end();
  g.begin(); g.dot(46, Y - 5, C.lime, Math.sin(t * 2.4) > 0 ? 5 : 4); g.dot(47, Y - 5, C.white, 5); flat(g);
}
function eyes(g, P, a, kind, t) {
  const [c1, c2] = EYE[kind].map((k) => C[k]);
  g.begin();
  for (const [ex, ey] of P.eyes) {
    if (a.blink) { g.rect(ex, ey + 1, 2, 1, c1, 4); continue; }
    g.rect(ex, ey, 2, P.eyeH, c1, kind === 'might' ? 4 : 5);
    if (P.eyeH > 1) { g.dot(ex, ey, kind === 'might' ? c1 : C.white, 5); g.dot(ex + 1, ey + 2, kind === 'might' ? c2 : c1, 4); }
    if (kind === 'shadow') for (let j = 1; j <= 3; j++) if (rnd(j + ex + Math.floor(t * 8)) > 0.25) g.dot(ex - j, ey + (P.eyeH > 1 ? 1 : 0), c1, 5 - j);   // ljusstrimma bakåt
    if (kind === 'might' && rnd(ex + Math.floor(t * 9)) > 0.4) g.dot(ex + (ex > 45 ? 2 : -1), ey - 1, C.ember, 5);                                     // en gnista ur ögonvrån
  }
  if (kind === 'magic' && !a.blink && t % 3.1 < 0.32) { const [ex, ey] = P.eyes[1]; for (const [dx, dy] of [[2, 0], [3, 0], [4, 0], [3, -1], [3, 1], [3, -2], [3, 2]]) g.dot(ex + dx, ey + dy, C.white, 5); }   // blänk
  if (kind === 'druid' && !a.blink && P.eyeH > 1) for (const [ex, ey] of P.eyes) g.dot(ex + 1, ey + 1, C.leaf, 3);                                   // mörkare pupill
  flat(g);
}

// ---------- Nivå 2: kropp och armar ----------
function hands(g, P, gear, t) {
  const hs = gear.shield ? [P.handBack] : [P.handBack, P.handFront], k = Math.floor(t * 6);
  g.begin();
  for (const [hx, hy] of hs) {
    g.ell(hx, hy, 1.8, 1.8, C.cyan, false, null, 5);
    for (let i = 0; i < 10; i++) { const an = i * TAU / 10; if ((i + k) % 2) g.dot(Math.round(hx - 0.5 + Math.cos(an) * 3.9), Math.round(hy - 0.5 + Math.sin(an) * 3.9), i % 3 ? C.cyan : C.vio, 4); }
    for (let i = 0; i < 2; i++) { const u = t * 1.4 + i * 0.5 + hx * 0.37, life = u % 1; g.dot(Math.round(hx - 0.5 + (rnd(i + Math.floor(u) * 3 + hx) - 0.5) * 6), Math.round(hy - 4 - life * 7), life < 0.5 ? C.white : C.cyan, 5); }
  }
  flat(g);
}
// Druid: lysande gröna tecken på armarna och ett barkband med mossa runt handleden. Ritas bara på pixlar som hör till hjälten.
function runeArms(g, P, O, gear, t) {
  const glow = Math.sin(t * 2.2) > -0.3 ? 5 : 3, arms = gear.shield ? [[P.armBack, [0.62, 0.86]]] : [[P.armFront, [0.2, 0.48, 0.74]], [P.armBack, [0.62, 0.86]]];
  g.begin();
  for (const [[[sx, sy], [ex, ey]], fs] of arms) {
    const d = Math.hypot(ex - sx, ey - sy) || 1, nx = -(ey - sy) / d, ny = (ex - sx) / d;
    fs.forEach((f, i) => {
      const cx = sx + (ex - sx) * f, cy = sy + (ey - sy) * f;
      for (let s = -2; s <= 2; s++) { const x = Math.round(cx + nx * s + (i % 2 ? Math.abs(s) * 0.6 : 0) * (ex - sx) / d), y = Math.round(cy + ny * s + (i % 2 ? Math.abs(s) * 0.6 : 0) * (ey - sy) / d); if (onBody(g, O, x, y)) g.set(O[0] + x, O[1] + y, s === 0 ? C.lime : C.leaf, s === 0 ? glow : 2); }
    });
    for (let s = -3; s <= 3; s++) for (let r = 0; r < 2; r++) { const f = 0.93 - r * 0.07, x = Math.round(sx + (ex - sx) * f + nx * s), y = Math.round(sy + (ey - sy) * f + ny * s); if (fs.length > 2 && onBody(g, O, x, y)) g.set(O[0] + x, O[1] + y, s === -2 && r ? C.moss : C.bark, r ? 3 : 2); }   // barkband
  }
  flat(g);
  const [hx, hy] = P.handBack; g.begin(); for (let i = 0; i < 2; i++) { const u = t * 0.9 + i * 0.5, life = u % 1; g.dot(Math.round(hx - 3 + rnd(i + Math.floor(u) * 5) * 6), Math.round(hy - 3 - life * 8), C.lime, life < 0.5 ? 5 : 4); } flat(g);
}

// ---------- Nivå 4: sak eller sällskap ----------
function belt(g, P) {
  const y = P.belt;
  g.begin(); g.rect(34, y, 12, 3, C.belt, 3); g.rect(34, y, 12, 1, C.belt, 4); flat(g);
  g.begin(); g.ell(39.5, y + 1.5, 3.3, 3.1, C.belt, true); g.end();
  g.begin(); g.rect(39, y + 1, 1, 1, C.red, 4); flat(g);
}
const GLY = [['.#.', '#.#', '###', '#.#', '#.#'], ['##.', '#.#', '##.', '#.#', '##.'], ['.##', '#..', '#..', '#..', '.##']];   // A, B, C
function runes(g, P, t, front) {
  GLY.forEach((rows, i) => {
    const th = t * 1.1 + i * TAU / 3, s = Math.sin(th); if ((s >= 0) !== front) return;
    const x = Math.round(FEET + Math.cos(th) * 23) - 1, y = Math.round(P.chest[1] - 1 + s * 5) - 2;
    g.begin(); rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') g.dot(x + c, y + r, front ? C.cyan : C.vio, front ? 5 : 3); })); g.end({ edge: false });
  });
}
function smoke(g, t) {
  g.begin();
  for (let i = 0; i < 6; i++) {
    const cx = 26 + i * 5.2 + Math.sin(t * 1.3 + i * 2) * 2, cy = 60.5 + Math.sin(t * 2 + i) * 1.2, r = 3 + Math.sin(t * 1.7 + i * 1.3);
    for (let y = Math.floor(cy - r * 0.7); y <= cy + r * 0.7; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const dx = (x - cx) / r, dy = (y - cy) / (r * 0.7); if (dx * dx + dy * dy > 1 || ((x + y) & 1)) continue;
      const [X, Y] = g.pt(x, y); g.set(Math.round(X), Math.round(Y), dy < -0.5 ? C.teal : C.smoke, dy < -0.5 ? 3 : dy < 0 ? 4 : 3);
    }
  }
  flat(g);
}
// Druid: en vargande som står vakt bredvid hjälten. Spetsiga öron, lysande ögon, och ibland ett ylande mot månen.
function wolf(g, t) {
  const u = t % 6.5, howl = u > 5.5, tail = Math.round(Math.sin(t * 2.4) * 1.5), ear = t % 2.9 < 0.15 ? 1 : 0;
  g.push(64, 61, 0, 1.2);
  g.begin(); g.thick(-5, -5, -6, 0, 2.2, C.spirit, 2); g.thick(3, -5, 4, 0, 2.2, C.spirit, 2); g.end();                                          // bortre benen
  g.begin();
  g.poly([[-6, -8], [-11, -12 + tail], [-12, -8 + tail], [-8, -4]], C.spirit, 2);                                                                   // svans
  g.ell(-1, -6.5, 6.4, 3.4, C.spirit, true);
  if (howl) { g.poly([[2, -8], [4, -12], [8, -12], [7, -5]], C.spirit, 3); g.ell(7, -12.5, 3.2, 2.9, C.spirit, true); g.poly([[7, -14], [11, -19], [10, -12]], C.spirit, 4); g.poly([[4, -12], [1, -15], [6, -15]], C.spirit, 3); }
  else { g.poly([[2, -8], [5, -13], [9, -12], [7, -5]], C.spirit, 3); g.ell(8, -12.5, 3.4, 2.9, C.spirit, true); g.poly([[9, -13], [14, -11.5], [9, -10]], C.spirit, 4);
    g.poly([[5, -14], [5, -19 + ear], [8, -15]], C.spirit, 4); g.poly([[8, -15], [10, -19], [11, -14]], C.spirit, 3); }
  g.end();
  g.begin(); g.ell(-1, -6.5, 6.4, 3.4, C.pine, false, (dx, dy) => dy < -0.25, 3); g.poly([[-6, -8], [-11, -12 + tail], [-9, -8]], C.pine, 3); if (!howl) { g.poly([[5, -14], [5, -19 + ear], [7, -15]], C.pine, 3); g.poly([[3, -9], [5, -13], [7, -13], [5, -8]], C.pine, 3); } g.end({ outline: false });   // mörk rygg, man och öra
  g.begin(); g.thick(-3, -4, -3, 0, 2.2, C.spirit, 4); g.thick(5, -4, 6, 0, 2.2, C.spirit, 4); g.end();                                            // närmaste benen
  g.begin();
  if (howl) { g.dot(7, -13, C.lime, 5); for (let i = 0; i < 3; i++) { const p = ((u - 5.5) * 2 + i * 0.33) % 1; g.dot(10 + Math.round(p * 6), -22 - Math.round(p * 5), C.spirit, p < 0.6 ? 5 : 4); } }
  else { g.dot(9, -13, C.lime, 5); g.dot(13, -12, C.shadow, 0); }
  for (let i = 0; i < 3; i++) { const life = (t * 0.8 + i * 0.33) % 1; if (((i + Math.floor(t * 0.8 + i * 0.33)) & 1) === 0) g.dot(-5 + i * 3, -10 - Math.round(life * 5), C.lime, life < 0.5 ? 5 : 4); }   // andeljus
  flat(g);
  g.pop();
}

// ---------- Nivå 6: slutdräkter ----------
// Titan. Tyngd i stället för eld runt hela kroppen: en bränd mantel med glödande fåll, stenaxlar med glödsprickor,
// och mark som spricker och pulserar under fötterna. Kroppen blir bara lite kraftigare (build 2).
function titanBack(g, P, t) {
  const y = P.neck[1], w1 = Math.round(Math.sin(t * 1.5) * 1), w2 = Math.round(Math.sin(t * 1.5 - 1) * 1.6), k = Math.floor(t * 7);
  const hem = [[36, y + 24], [32 + w1, y + 27], [28 + w1, y + 24], [24 + w2, y + 28], [20 + w2, y + 24], [16 + w2, y + 27], [13 + w2, y + 22]];
  g.begin();
  g.poly([[30, y - 1], [47, y - 1], [47, y + 9], [40, y + 14], ...hem, [17 + w2, y + 13], [23 + w1, y + 4]], C.char, 3);
  g.poly([[30, y - 1], [23 + w1, y + 4], [17 + w2, y + 13], [13 + w2, y + 22], [18 + w2, y + 18], [24 + w1, y + 9], [30, y + 4]], C.char, 4);
  g.end();
  g.begin();                                                                                                              // fållen glöder
  for (let i = 1; i < hem.length; i++) { const [ax, ay] = hem[i - 1], [bx, by] = hem[i], n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s <= n; s++) { const x = Math.round(ax + (bx - ax) * s / n), yy = Math.round(ay + (by - ay) * s / n), hot = rnd(x * 3 + k) > 0.35; g.dot(x, yy - 1, hot ? C.gold : C.ember, hot ? 5 : 4); if (hot) g.dot(x, yy - 2, C.ember, 4); if (rnd(x + k * 3) > 0.8) g.dot(x, yy - 3, C.red, 3); } }
  for (let i = 0; i < 4; i++) { const u = t * 0.7 + i * 0.25, life = u % 1; g.dot(Math.round(14 + rnd(i * 7 + Math.floor(u)) * 22 - life * 5), Math.round(y + 24 - life * 16), life < 0.5 ? C.gold : C.ember, life < 0.3 ? 5 : 4); }   // glöd som släpper från fållen
  flat(g);
}
function titanFront(g, P, t) {
  const y = P.neck[1], pulse = Math.sin(t * 1.6) > 0 ? 5 : 4;
  g.begin(); g.poly([[32, y - 2.5], [47, y - 2.5], [47, y + 1.5], [40, y + 4], [32.5, y + 2.5]], C.char, 3); g.poly([[32, y - 2.5], [47, y - 2.5], [47, y - 1], [32, y - 1]], C.char, 5); g.end();   // mantelns krage
  g.begin(); g.rect(39, y + 1, 2, 2, C.gold, 5); flat(g);
  g.begin(); g.poly([[44, y + 3], [44.5, y - 2], [48, y - 3.5], [51.5, y - 1], [51, y + 3.5], [47, y + 5]], C.rock, 3); g.poly([[47, y - 3], [49.5, y - 6.5], [50.5, y - 1.5]], C.rock, 4); g.end();                    // bortre axelplattan
  g.begin(); g.poly([[24.5, y + 4], [25, y - 1], [29, y - 3.5], [34.5, y - 2.5], [36.5, y + 2.5], [34, y + 6.5], [27.5, y + 6.5]], C.rock, 3);
  g.poly([[25, y - 1], [29, y - 3.5], [34.5, y - 2.5], [35.5, y], [29.5, y - 1], [26, y + 1]], C.rock, 5);                                                                                                // ljus överkant
  g.poly([[25.5, y - 0.5], [26.5, y - 6], [30, y - 3]], C.rock, 4); g.poly([[30.5, y - 3], [33, y - 6.5], [34.5, y - 2.5]], C.rock, 3); g.end();                                                           // två taggar
  g.begin(); for (const [x, yy] of [[27, y + 2], [28, y + 3], [29, y + 3], [30, y + 4], [31, y + 5], [30, y + 2], [31, y + 1], [47, y + 1], [48, y + 2], [49, y + 1]]) g.dot(x, yy, C.gold, pulse); g.dot(29, y + 4, C.ember, 4); g.dot(32, y + 6, C.ember, 4); flat(g);   // glödspricka
}
const CRACK = [[[-3, 0], [-9, 1], [-14, 0], [-20, 2], [-25, 1]], [[2, 0], [8, 1], [13, 0], [19, 2], [24, 1]], [[-4, 1], [-8, 3], [-12, 3]], [[4, 1], [8, 3], [13, 3]], [[-1, 1], [0, 4]]];
function cracks(g, t) {
  g.begin(); for (const seg of CRACK) for (let i = 1; i < seg.length; i++) g.line(FEET + seg[i - 1][0], 62 + seg[i - 1][1], FEET + seg[i][0], 62 + seg[i][1], C.shadow, 0); flat(g);
  g.begin();                                                                                                              // en långsam våg av glöd går utåt genom sprickorna
  CRACK.forEach((seg) => { for (let i = 1; i < seg.length; i++) { const [ax, ay] = seg[i - 1], [bx, by] = seg[i], n = Math.abs(bx - ax) || 1;
    for (let s = 0; s <= n; s++) { const x = ax + (bx - ax) * s / n, yy = ay + (by - ay) * s / n, w = Math.sin(t * 2.2 - Math.abs(x) * 0.32); if (w > 0.25) g.dot(Math.round(FEET + x), Math.round(62 + yy), w > 0.75 ? C.gold : C.ember, w > 0.75 ? 5 : 4); } } });
  flat(g);
}
// Spark Mage: en stor runcirkel som står upprätt bakom hjälten och vrider sig, och en ljusring på marken.
function mageHalo(g, P, t) {
  const cx = FEET, cy = P.chest[1] - 7, R = 22;
  g.begin();
  for (let i = 0; i < 120; i++) { const an = i * TAU / 120, c = Math.cos(an), s = Math.sin(an); g.dot(Math.round(cx - 0.5 + c * R), Math.round(cy - 0.5 + s * R), C.vio, 5); g.dot(Math.round(cx - 0.5 + c * (R - 1)), Math.round(cy - 0.5 + s * (R - 1)), C.vio, 3); }
  for (let i = 0; i < 72; i++) { const an = i * TAU / 72 - t * 0.5; if (i % 6 < 4) g.dot(Math.round(cx - 0.5 + Math.cos(an) * (R - 4)), Math.round(cy - 0.5 + Math.sin(an) * (R - 4)), C.cyan, 5); }
  for (let j = 0; j < 8; j++) { const an = t * 0.35 + j * TAU / 8, c = Math.cos(an), s = Math.sin(an); for (let r = R + 1; r <= R + (j % 2 ? 2 : 4); r++) g.dot(Math.round(cx - 0.5 + c * r), Math.round(cy - 0.5 + s * r), j % 2 ? C.vio : C.cyan, 5); if (j % 2 === 0) star4(g, ...g.pt(cx + c * (R + 5), cy + s * (R + 5)), C.cyan, C.vio); }
  flat(g);
}
function circle(g, t) {
  const cx = FEET, cy = 62.5;
  g.begin();
  for (let i = 0; i < 72; i++) { const an = i * TAU / 72, x = Math.round(cx - 0.5 + Math.cos(an) * 21), y = Math.round(cy - 0.5 + Math.sin(an) * 4.6); g.dot(x, y, C.vio, 5); g.dot(x, y + 1, C.vio, 2); }
  for (let i = 0; i < 48; i++) { const an = i * TAU / 48; if ((i + Math.floor(t * 5)) % 4 < 2) g.dot(Math.round(cx - 0.5 + Math.cos(an) * 15), Math.round(cy - 0.5 + Math.sin(an) * 3.2), C.cyan, 5); }
  for (let j = 0; j < 6; j++) { const an = t * 0.8 + j * TAU / 6, x = Math.round(cx - 0.5 + Math.cos(an) * 21), y = Math.round(cy - 0.5 + Math.sin(an) * 4.6), h = 3 + Math.round(rnd(j + Math.floor(t * 6)) * 5); g.rect(x, y - 1, 2, 2, C.white, 5); for (let k = 2; k <= h; k++) g.dot(x, y - k, k < 4 ? C.cyan : C.vio, k < 4 ? 5 : 4); }
  flat(g);
}
// Forest Guardian: mossmantel med hängande rankor på ryggen, barkaxlar med mossa och ett lysande tecken, rötter som
// griper om marken, och månljus längs siluetten (rimMoon).
function guardianBack(g, P, t) {
  const y = P.neck[1], w1 = Math.round(Math.sin(t * 1.3) * 1), w2 = Math.round(Math.sin(t * 1.3 - 1) * 1.6);
  g.begin();
  g.poly([[30, y - 1], [47, y - 1], [47, y + 9], [40, y + 14], [36, y + 22], [33 + w1, y + 25], [30 + w1, y + 22], [27 + w1, y + 26], [23 + w2, y + 22], [19 + w2, y + 25], [15 + w2, y + 20], [17 + w2, y + 12], [23 + w1, y + 4]], C.moss, 2);
  g.poly([[30, y - 1], [23 + w1, y + 4], [17 + w2, y + 12], [15 + w2, y + 20], [20 + w2, y + 16], [25 + w1, y + 8], [30, y + 4]], C.moss, 4);
  g.end();
  g.begin(); for (const [x, yy] of [[22, y + 7], [26, y + 11], [20, y + 14], [29, y + 15], [24, y + 18], [33, y + 19], [18, y + 19]]) { g.dot(x + w1, yy, C.leaf, 2); g.dot(x + 1 + w1, yy, C.lime, 4); g.dot(x + w1, yy + 1, C.leaf, 3); } flat(g);      // lövtofsar i mossan
  g.begin(); [[17, 21, 6], [22, 23, 7], [28, 24, 5], [34, 23, 6]].forEach(([x, top, len], i) => { const s = Math.sin(t * 1.7 + i * 1.3); for (let k = 0; k < len; k++) g.dot(Math.round(x + (i < 2 ? w2 : w1) + s * k * 0.35), y + top + k, k === len - 1 ? C.lime : C.leaf, k === len - 1 ? 5 : 3); }); flat(g);   // rankor som hänger och svajar
}
function guardianFront(g, P, t) {
  const y = P.neck[1];
  g.begin(); g.poly([[32, y - 2.5], [47, y - 2.5], [47, y + 1.5], [40, y + 4], [32.5, y + 2.5]], C.moss, 3); g.poly([[32, y - 2.5], [47, y - 2.5], [47, y - 1], [32, y - 1]], C.moss, 5); g.end();   // mosskrage
  g.begin(); g.poly([[38.5, y], [41.5, y + 0.5], [40, y + 4.5]], C.lime, 4); g.end();
  g.begin(); g.poly([[44, y + 3], [44.5, y - 2], [48.5, y - 3], [51.5, y], [50.5, y + 4], [47, y + 5]], C.bark, 3); g.end();
  g.begin(); g.poly([[24.5, y + 4], [25.5, y - 1.5], [29.5, y - 3.5], [34.5, y - 2], [36.5, y + 2.5], [33.5, y + 6.5], [27.5, y + 6.5]], C.bark, 3); g.poly([[24.5, y + 1], [22.5, y - 4], [27, y - 2]], C.bark, 4); g.end();   // barkplatta med en kvist
  g.begin(); for (const [x, yy] of [[27, y + 1], [27, y + 3], [33, y + 1], [33, y + 3], [34, y + 4], [47, y], [49, y + 2]]) g.dot(x, yy, C.bark, 1);                                                    // barkens fåror
  for (const [x, yy] of [[26, y - 2], [27, y - 3], [28, y - 3], [29, y - 4], [31, y - 4], [32, y - 3], [33, y - 3], [34, y - 2], [46, y - 3], [47, y - 3], [48, y - 4], [49, y - 3]]) g.dot(x, yy, C.moss, 4); for (const [x, yy] of [[28, y - 4], [32, y - 4], [48, y - 5], [22, y - 4]]) g.dot(x, yy, C.lime, 5);
  const gl = Math.sin(t * 2) > -0.2 ? 5 : 4; for (const [x, yy] of [[30, y], [29, y + 1], [31, y + 1], [30, y + 2], [30, y + 3], [30, y + 4]]) g.dot(x, yy, C.lime, gl); flat(g);                         // tecknet på axeln
}
const ROOT = [[[-4, 0], [-9, 2], [-13, 1], [-18, 3], [-22, 2]], [[3, 0], [8, 2], [13, 1], [17, 3], [22, 2]], [[-6, 1], [-10, 4], [-15, 4]], [[5, 1], [10, 4], [15, 4]]];
function roots(g, t) {
  g.begin(); for (const seg of ROOT) for (let i = 1; i < seg.length; i++) g.thick(FEET + seg[i - 1][0], 62 + seg[i - 1][1], FEET + seg[i][0], 62 + seg[i][1], 2.2 - i * 0.3, C.bark, 3); g.end();
  g.begin(); ROOT.forEach((seg, s) => seg.forEach(([x, y], i) => { if (i && Math.sin(t * 1.8 - i * 0.9 + s) > 0.2) g.dot(Math.round(FEET + x), 61 + y, C.lime, 5); if (i === seg.length - 1) g.dot(Math.round(FEET + x + (x < 0 ? -1 : 1)), 60 + y, C.leaf, 4); })); flat(g);
}
function rising(g, t, n, c1, c2, speed, x0, x1) {
  g.begin();
  for (let i = 0; i < n; i++) {
    const u = t * speed + i / n, life = u % 1, cyc = Math.floor(u), x = Math.round(x0 + rnd(i * 5 + cyc) * (x1 - x0) + Math.sin(life * 6 + i) * 2), y = Math.round(60 - life * 44);
    g.dot(x, y, life < 0.6 ? c1 : c2, life < 0.3 ? 5 : 4); if (life < 0.2) g.dot(x, y + 1, c1, 4);
  }
  flat(g);
}

// ---------- Hjälten med allt på ----------
// a som i drawHero, plus: off = [dx, dy] hur långt hjälten just nu är från sin plats (anfallssprång), så att sällskapet
// stannar kvar; busy = true under attacker, då vilar småvanorna.
export function drawHeroWithSkills(g, look, gear, a = {}, lk = null, st = null) {
  if (!lk || !lk.any) { drawHero(g, look, gear, a); return; }
  const t = a.t || 0, ha = { ...a, build: lk.build, noScarf: lk.hood || lk.titan || lk.guardian ? true : a.noScarf }, P = heroPose(gear, t, ha), off = a.off || [0, 0], plain = g.t.a === 0 && g.t.k === 1;
  if (lk.hood && !gear.helmet) look = { ...look, style: 'buzz' };                     // håret ligger platt under huvan
  let ox = 0, oy = 0;
  if (lk.mage && !P.hover) oy = -(3 + Math.round(Math.sin(t * 1.8)));                  // svävar (om inte vingar redan lyfter)
  if (lk.quick && !a.busy) { const ph = (t % 4.2) / 0.34; if (ph < 1) ox = Math.round(bump(ph) * 7); }   // snabbt sidosteg då och då
  if (!a.noShadow) { g.begin(); g.ell(FEET + ox, 62.5 - off[1], 15 - Math.min(7, P.hover - oy), 2.6, C.shadow, false, null, 1); flat(g); }
  if (gear.pet && !a.noPet) { g.push(-off[0], -off[1]); drawPet(g, gear.pet, P.pet[0], P.pet[1], t); g.pop(); }
  if (lk.wolf) { g.push(-off[0], -off[1]); wolf(g, t); g.pop(); }                   // vargen står kvar på sin plats, bakom hjälten, när hjälten springer fram
  // marken under fötterna: följer hjälten i sidled men ligger kvar på marken när hjälten hoppar eller svävar
  g.push(ox, -off[1]);
  if (lk.titan) cracks(g, t);
  if (lk.guardian) roots(g, t);
  if (lk.mage) circle(g, t);
  g.pop();
  // bakom hjälten
  g.push(ox, oy);
  const o = g.pt(0, 0), O = [Math.round(o[0]), Math.round(o[1])], x0 = O[0] + BX, y0 = O[1] + BY;
  const ghost = lk.quick || lk.trail === 'shadow' || lk.night;
  if (st && plain && ghost) {
    st.hist = st.hist.filter((e) => e.t <= t && t - e.t < 0.3); st.hist.push({ x: O[0], y: O[1], t });
    [0.13, 0.065].forEach((age, k) => { const h = st.hist.find((e) => t - e.t <= age + 0.025); if (h && Math.abs(h.x - O[0]) + Math.abs(h.y - O[1]) >= 5) clone(g, look, gear, ha, lk.build, P, h.x, h.y, !k); });
    if (lk.quick && !a.busy && !ox && t % 1.4 < 0.1) clone(g, look, gear, ha, lk.build, P, O[0] - 4, O[1], true);     // konturen fladdrar till
  }
  if (lk.mage) mageHalo(g, P, t);
  if (lk.titan) titanBack(g, P, t);
  if (lk.guardian) guardianBack(g, P, t);
  if (lk.hood) cloakBack(g, P, t);
  if (lk.band) bandTails(g, P, t);
  if (lk.antlers) antlers(g, P);
  if (lk.runes) runes(g, P, t, false);
  // hjälten, och siluetten ur skillnaden
  const need = plain && (lk.mage || lk.night || lk.guardian || lk.tattoo || lk.hood);
  if (need) snap(g, x0, y0);
  drawHero(g, look, gear, { ...ha, noShadow: true, noPet: true });
  if (need) diff(g, x0, y0);
  // framför hjälten
  if (lk.tattoo && need) runeArms(g, P, O, gear, t);
  if (lk.belt) belt(g, P);
  if (lk.titan) titanFront(g, P, t);
  if (lk.guardian) guardianFront(g, P, t);
  if (lk.hood) hoodFront(g, P, O, t, !!need);
  if (lk.band) bandFront(g, P);
  if (lk.antlers) circlet(g, P, t);
  if (lk.night && need && !P.visor) { const Y = Math.round(P.head[1] - 0.5); g.begin(); for (let y = Y + 3; y <= Y + 8; y++) for (let x = 40; x <= 51; x++) if (onBody(g, O, x, y)) g.set(O[0] + x, O[1] + y, C.ink, y === Y + 3 ? 4 : x > 48 ? 2 : 3); flat(g); }   // halvmask
  if (lk.eyes) eyes(g, P, a, lk.eyes, t);
  if (lk.hands) hands(g, P, gear, t);
  if (need && lk.mage) rimMagic(g, x0, y0, t);
  if (need && lk.night) rimShadow(g, x0, y0, t);
  if (need && lk.guardian) rimMoon(g, x0, y0, t);
  if (lk.runes) runes(g, P, t, true);
  if (lk.smoke) smoke(g, t);
  if (lk.titan) rising(g, t, 4, C.gold, C.ember, 0.45, 20, 58);
  if (lk.mage) rising(g, t, 6, C.cyan, C.white, 0.5, 18, 60);
  if (lk.guardian) rising(g, t, 5, C.lime, C.spirit, 0.35, 16, 62);
  if (lk.trail === 'druid' && gear.weapon && g.anchor.tip && !a.busy) { const [tx, ty] = g.anchor.tip; g.begin(); for (let i = 0; i < 4; i++) { const an = t * 3 + i * TAU / 4; g.set(Math.round(tx + Math.cos(an) * 4), Math.round(ty + Math.sin(an) * 3), i % 2 ? C.lime : C.leaf, 5); } flat(g); }   // naturkraft kring vapenspetsen
  g.pop();
  if (st && plain) st.clone = (g2, X, Y, far) => clone(g2, look, gear, ha, lk.build, P, X, Y, far);   // Shadow Strike lånar skuggbilden medan hjälten är borta
}

// ---------- Vapnets spår ----------
// Anropas varje bildruta under en attack med vapenspetsen och handen (bildkoordinater, g.anchor.tip och g.anchor.hand).
export function trailPush(st, tip, hand, now) { st.trail.push({ x: tip[0], y: tip[1], hx: hand[0], hy: hand[1], t: now }); if (st.trail.length > 14) st.trail.shift(); }
const LIFE = 0.24;
function star4(g, x, y, c1, c2) { x = Math.round(x); y = Math.round(y); g.set(x, y, C.white, 5); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) g.set(x + dx, y + dy, c1, 5); for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) g.set(x + dx, y + dy, c2, 4); }
export function drawTrail(g, st, lk, now) {
  const kind = lk && lk.trail; if (!kind || !st) return;
  const T = st.trail = st.trail.filter((p) => now - p.t < LIFE && now >= p.t); if (T.length < 2) return;
  const pts = [];                                                                      // mjuk båge: vinkeln runt handen tonas mellan bildrutorna
  for (let i = 1; i < T.length; i++) {
    const A = T[i - 1], B = T[i], a0 = Math.atan2(A.y - A.hy, A.x - A.hx), r0 = Math.hypot(A.x - A.hx, A.y - A.hy), r1 = Math.hypot(B.x - B.hx, B.y - B.hy);
    let a1 = Math.atan2(B.y - B.hy, B.x - B.hx); while (a1 - a0 > Math.PI) a1 -= TAU; while (a0 - a1 > Math.PI) a1 += TAU;
    const n = clamp(Math.ceil(Math.hypot(B.x - A.x, B.y - A.y) / 4), 1, 8);
    for (let s = 0; s < n; s++) { const f = s / n, an = a0 + (a1 - a0) * f, r = r0 + (r1 - r0) * f; pts.push({ x: A.hx + (B.hx - A.hx) * f + Math.cos(an) * r, y: A.hy + (B.hy - A.hy) * f + Math.sin(an) * r, age: now - (A.t + (B.t - A.t) * f) }); }
  }
  const last = T[T.length - 1]; pts.push({ x: last.x, y: last.y, age: now - last.t });
  g.begin();
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i - 1], q = pts[i], f = 1 - q.age / LIFE;
    if (Math.hypot(q.x - p.x, q.y - p.y) < 0.5) continue;
    if (kind === 'might') g.thick(p.x, p.y, q.x, q.y, 1.5 + 4 * f, f > 0.7 ? C.gold : f > 0.4 ? C.ember : C.red, f > 0.7 ? 5 : f > 0.4 ? 4 : 3);
    if (kind === 'magic') g.thick(p.x, p.y, q.x, q.y, 1.4 + 2.2 * f, f > 0.6 ? C.cyan : C.vio, f > 0.6 ? 5 : 4);
    if (kind === 'shadow') { g.line(p.x, p.y, q.x, q.y, f > 0.6 ? C.white : C.teal, f > 0.6 ? 5 : 4); g.line(p.x - 1, p.y + 2, q.x - 1, q.y + 2, f > 0.4 ? C.teal : C.ink, f > 0.4 ? 4 : 3); }
    if (kind === 'druid') g.thick(p.x, p.y, q.x, q.y, 2.4, C.leaf, 3);
  }
  if (kind === 'magic') {                                                              // mörk kontur runt bandet och stjärnorna, så att spåret syns mot ljus himmel
    g.end({ edge: false });
    for (let i = 2; i < pts.length; i += 3) { const q = pts[i], f = 1 - q.age / LIFE; g.begin(); if (f > 0.35) star4(g, q.x, q.y - 3 + (i % 2) * 6, C.cyan, C.vio); else g.set(Math.round(q.x), Math.round(q.y + (1 - f) * 8), C.cyan, 5); g.end({ edge: false }); }
    return;
  }
  if (kind === 'druid') {                                                              // taggar åt båda håll längs rankan
    g.end({ edge: false }); g.begin();
    for (let i = 1; i < pts.length; i += 2) { const p = pts[i - 1], q = pts[i], d = Math.hypot(q.x - p.x, q.y - p.y) || 1, s = i % 4 === 1 ? 1 : -1, nx = -(q.y - p.y) / d * s, ny = (q.x - p.x) / d * s; g.poly([[q.x - (q.x - p.x) / d * 1.5, q.y - (q.y - p.y) / d * 1.5], [q.x + nx * 5 + (q.x - p.x) / d * 2, q.y + ny * 5 + (q.y - p.y) / d * 2], [q.x + (q.x - p.x) / d * 1.5, q.y + (q.y - p.y) / d * 1.5]], C.bone, 4); }
    g.end({ edge: false }); return;
  }
  flat(g);
}

// ---------- Effekter i scenen: träffar, superattacker, jubel ----------
// En effekt är ett litet objekt { kind: 'sk', id, t0, dur, x, y, gy, ... } som ritas med drawFx tills den är slut.
// x, y = målets mitt, gy = markens y, hx, hy = hjältens mitt. Allt i bildkoordinater.
const fxo = (id, c, dur, more) => ({ kind: 'sk', id, t0: c.now, dur, x: c.x, y: c.y, gy: c.gy, hx: c.hx, hy: c.hy, seed: Math.floor(c.now * 97) % 997, ...more });
// Vid varje träff. Utan spår på nivå 3: inget extra (spelets egen gnistskur räcker).
export function impactFx(lk, c) { return lk && lk.trail ? [fxo(lk.trail + '-hit', c, { might: 0.55, magic: 0.45, shadow: 0.4, druid: 0.7 }[lk.trail])] : []; }
// När en superattack börjar. c.until = sekunder kvar till träffen, så att effekten kan landa i takt med skadan.
export function superFx(lk, c) {
  const s = lk && lk.sup, u = c.until || 0; if (!s) return [];
  if (s === 'might') return [fxo('might-super', { ...c, now: c.now + u }, 1.0)];
  if (s === 'magic') return [fxo('magic-charge', c, Math.max(0.3, u)), fxo('magic-super', c, u + 0.75, { until: u })];
  if (s === 'shadow') return [fxo('puff', { ...c, x: c.hx, y: c.hy }, 0.35), fxo('shadow-super', { ...c, now: c.now + Math.max(0, u - 0.3) }, 0.75), fxo('puff', { ...c, x: c.hx, y: c.hy, now: c.now + u + 0.35 }, 0.3)];
  return [fxo('druid-super', c, u + 0.7, { until: u })];
}
// Under Shadow Strike syns inte hjälten: p = hur långt attacken har kommit (0..1).
export const heroHidden = (lk, sup, p) => !!(sup && lk && lk.sup === 'shadow' && p > 0.2 && p < 0.9);
export function cheerFx(lk, c) { return [fxo((lk && lk.pose ? lk.pose : 'none') + '-cheer', c, 1.1)]; }
// Segerposen följer superattacken på nivå 5: p 0..1. Ger samma slags värden som attackernas pose (hand, dy) plus dx.
export function victoryPose(lk, p) {
  const m = lk && lk.pose, up = bump(p);
  if (m === 'might') return { hand: [-3, -11 * Math.min(1, p * 4)], wAng: -0.25, dy: -Math.abs(Math.sin(p * TAU * 1.5)) * 4 };
  if (m === 'magic') return { hand: [0, -8 * up], wAng: 0, dy: -up * 7 };
  if (m === 'shadow') return { dx: Math.round(Math.sin(p * TAU * 2) * 9 * (1 - p)), hand: [2, -3] };
  if (m === 'druid') return { hand: [-2, -12 * Math.min(1, p * 3)], wAng: -0.15 };
  return { dy: -Math.abs(Math.sin(p * TAU)) * 5 };
}

function slash(g, x, y, ang, len, p) {                                                 // ett snitt som dras fram (p 0..1) och sedan tunnas ut
  const c = Math.cos(ang), s = Math.sin(ang), a0 = -len / 2, a1 = -len / 2 + len * Math.min(1, p * 2.2), thin = p > 0.6;
  for (let d = a0; d <= a1; d += 0.5) {
    const X = Math.round(x + c * d), Y = Math.round(y + s * d), mid = 1 - Math.abs(d) / (len / 2);
    g.set(X, Y, C.white, 5); if (!thin && mid > 0.25) { g.set(X, Y + 1, C.teal, 5); g.set(X, Y - 1, C.teal, 4); if (mid > 0.6) g.set(X, Y + 2, C.teal, 3); }
  }
}
function spike(g, x, gy, h, w, k) {                                                    // en stenpigg med glödande fot
  if (h < 1) return;
  g.begin(); g.poly([[x - w / 2, gy + 1], [x - w * 0.1 + k, gy - h], [x + w / 2, gy + 1]], C.rock, 3); g.poly([[x - w * 0.1 + k, gy - h], [x + w / 2, gy + 1], [x + w * 0.1, gy + 1]], C.rock, 2); g.end();
  g.begin(); g.rect(Math.round(x - w / 2), gy, Math.round(w), 1, C.gold, 5); g.rect(Math.round(x - w / 2) + 1, gy - 1, 2, 1, C.ember, 4); flat(g);
}
function thorn(g, x, gy, h, lean, w = 5) {                                             // en vass rot ur marken, med tagg på sidan och ljus spets
  if (h < 1.5) return;
  const tx = x + lean * h * 0.45, ty = gy + 1 - h;
  g.begin(); g.poly([[x - w / 2, gy + 1], [x + lean * h * 0.15 - 1, gy + 1 - h * 0.55], [tx, ty], [x + lean * h * 0.3 + 1.5, gy + 1 - h * 0.5], [x + w / 2, gy + 1]], C.bark, 3);
  if (h > 7) g.poly([[x + lean * h * 0.2 - lean * 1, gy + 1 - h * 0.45], [x + lean * h * 0.2 - lean * 5, gy - h * 0.62], [x + lean * h * 0.26, gy + 1 - h * 0.62]], C.bark, 4);
  g.end();
  g.begin(); g.set(Math.round(tx), Math.round(ty), C.lime, 5); g.set(Math.round(tx - lean), Math.round(ty + 1), C.leaf, 4); if (h > 9) g.set(Math.round(x + lean * h * 0.2), Math.round(gy - h * 0.3), C.moss, 4); flat(g);
}
function bigStar(g, x, y, r) {                                                         // fyruddig stjärna
  x = Math.round(x); y = Math.round(y);
  g.begin(); g.poly([[x, y - r], [x + 1.4, y - 1.4], [x + r, y], [x + 1.4, y + 1.4], [x, y + r], [x - 1.4, y + 1.4], [x - r, y], [x - 1.4, y - 1.4]], C.gold, 4); g.rect(x - 1, y - 1, 3, 3, C.gold, 4); g.end();
  g.begin(); g.rect(x - 0.5, y - 0.5, 1, 1, C.white, 5); g.rect(x - 1.5, y - 0.5, 3, 1, C.white, 5); g.rect(x - 0.5, y - 1.5, 1, 3, C.white, 5); flat(g);
}
// Den stora andehjorten i Wild Hunt: sänkt huvud, stora vassa horn, lysande öga. Fötterna i origo, nosen åt höger.
export function drawStag(g, x, gy, t, k = 1) {
  const ga = Math.sin(t * 22), leg = (lx, ph, lv) => { const s = Math.sin(t * 22 + ph) * 6; g.thick(lx, -11, lx + s, -1, 2.8, C.spirit, lv); };
  g.push(x, gy + Math.round(ga * 1.2), 0, k);
  g.begin(); leg(-9, 0, 2); leg(9, Math.PI, 2); g.end();
  g.begin();
  g.ell(0, -16, 14, 7.5, C.spirit, true); g.poly([[-12, -19], [-19, -24], [-14, -15]], C.spirit, 4);
  g.poly([[8, -20], [17, -24], [22, -19], [14, -12]], C.spirit, 3);                                                      // nacken, framåtlutad
  g.poly([[17, -24], [24, -22], [29, -15], [26, -13], [20, -16]], C.spirit, 4);                                           // huvudet, sänkt
  g.poly([[16, -23], [13, -27], [18, -25]], C.spirit, 3);
  g.end();
  g.begin(); leg(-6, Math.PI, 4); leg(12, 0, 4); g.end();
  g.begin();                                                                                                               // hornen pekar framåt
  g.thick(19, -24, 22, -33, 2.2, C.bone, 4); g.thick(22, -33, 29, -36, 1.9, C.bone, 4); g.thick(22, -33, 20, -40, 1.9, C.bone, 5); g.thick(25.5, -34.5, 27, -41, 1.6, C.bone, 5);
  g.thick(22, -23, 28, -29, 2.2, C.bone, 3); g.thick(28, -29, 35, -29, 1.9, C.bone, 4); g.thick(28, -29, 31, -36, 1.9, C.bone, 4); g.thick(31.5, -29, 35, -34, 1.6, C.bone, 5);
  g.end();
  g.begin(); g.rect(23, -20, 2, 2, C.lime, 5); g.rect(-5, -18, 3, 1, C.lime, 4); g.rect(-6, -16, 1, 2, C.lime, 4); g.rect(3, -15, 1, 3, C.lime, 4); g.rect(2, -14, 3, 1, C.lime, 4);
  for (const [ax, ay] of [[29, -37], [20, -41], [27, -42], [35, -30], [31, -37], [35, -35]]) g.rect(ax, ay, 1, 1, C.lime, 5); flat(g);
  g.pop();
}
const FX = {
  'might-hit'(g, e, q, tt) {
    g.begin();
    for (let r = 0; r < 6; r++) {
      const dir = r % 2 ? 1 : -1, L = (9 + rnd(e.seed + r) * 13) * Math.min(1, q * 4); let cy = e.gy + 1 + (r >> 1);
      for (let d = 1; d < L; d++) { if (rnd(e.seed + r * 9 + d) < 0.3) cy = clamp(cy + (rnd(e.seed + d + r) < 0.5 ? 1 : -1), e.gy, e.gy + 4); const hot = q < 0.5 && d < L * 0.65; g.set(Math.round(e.x + dir * d), cy, hot ? C.gold : C.shadow, hot ? 5 : 0); }
    }
    for (let i = 0; i < 9; i++) { const an = -Math.PI * (0.15 + 0.7 * rnd(e.seed + i * 3)), v = 50 + rnd(e.seed + i) * 60; g.set(Math.round(e.x + Math.cos(an) * v * tt), Math.round(e.gy - 2 + Math.sin(an) * v * tt + 90 * tt * tt), i % 2 ? C.gold : C.ember, q < 0.5 ? 5 : 3); }
    flat(g);
    for (let i = 0; i < 6; i++) {
      const vx = (rnd(e.seed + i) - 0.5) * 90, vy = 70 + rnd(e.seed + i + 7) * 70, rx = e.x + vx * tt, ry = e.gy - (vy * tt - 240 * tt * tt); if (ry > e.gy + 1) continue;
      g.begin(); g.rect(Math.round(rx) - 1, Math.round(ry) - 1, i % 2 ? 3 : 2, i % 3 ? 2 : 3, C.rock, 3); g.end();
    }
  },
  'magic-hit'(g, e, q) {
    const R = 4 + q * 13;
    g.begin();
    for (let k = 0; k < 8; k++) { const an = k * TAU / 8, L = k % 2 ? R * 0.62 : R; for (let r = Math.max(1, L - 5); r <= L; r++) g.set(Math.round(e.x + Math.cos(an) * r), Math.round(e.y + Math.sin(an) * r), r > L - 2 ? C.white : C.cyan, 5); }
    for (let i = 0; i < 40; i++) { const an = i * TAU / 40; if ((i + Math.floor(q * 12)) % 2) g.set(Math.round(e.x + Math.cos(an) * R * 0.75), Math.round(e.y + Math.sin(an) * R * 0.75), C.vio, q < 0.6 ? 5 : 3); }
    for (let k = 0; k < 4; k++) { const an = k * TAU / 4 + 0.6 + e.seed, d = 6 + q * 20; if (q < 0.8) star4(g, e.x + Math.cos(an) * d, e.y + Math.sin(an) * d, C.cyan, C.vio); }
    flat(g);
  },
  'shadow-hit'(g, e, q, tt) {
    g.begin();
    slash(g, e.x, e.y, 0.8, 26, q / 0.55); if (q > 0.22) slash(g, e.x, e.y, Math.PI - 0.8, 26, (q - 0.22) / 0.6);
    for (let i = 0; i < 7; i++) { const an = rnd(e.seed + i) * TAU, v = 30 + rnd(e.seed + i * 5) * 50; g.set(Math.round(e.x + Math.cos(an) * v * tt), Math.round(e.y + Math.sin(an) * v * tt + 80 * tt * tt), i % 3 ? C.smoke : C.teal, i % 3 ? 3 : 5); }
    flat(g);
  },
  'druid-hit'(g, e, q, tt) {                                                           // vassa rötter slår upp ur marken under fienden
    const up = q < 0.25 ? q / 0.25 : q < 0.6 ? 1 : 1 - (q - 0.6) / 0.4;
    [[-12, 11, -1], [-6, 18, -0.5], [1, 24, 0.3], [8, 16, 0.8], [13, 10, 1.2]].forEach(([dx, h, lean], i) => thorn(g, e.x + dx, e.gy, h * Math.min(1, up * (1 + i * 0.1)), lean, 5 + (i === 2 ? 2 : 0)));
    g.begin();
    for (let i = 0; i < 9; i++) { const an = -Math.PI * (0.1 + 0.8 * rnd(e.seed + i * 3)), v = 40 + rnd(e.seed + i) * 55; g.set(Math.round(e.x + Math.cos(an) * v * tt), Math.round(e.gy - 3 + Math.sin(an) * v * tt + 110 * tt * tt), i % 3 === 0 ? C.lime : i % 3 === 1 ? C.bark : C.leaf, i % 3 ? 3 : 5); }
    if (q < 0.3) for (let i = 0; i < 24; i++) { const an = i * TAU / 24; g.set(Math.round(e.x + Math.cos(an) * (5 + q * 40)), Math.round(e.gy + 1 + Math.sin(an) * (1 + q * 8)), C.lime, 5); }   // grön ring längs marken
    flat(g);
  },
  'might-super'(g, e, q, tt) {
    const x0 = e.hx + 14, n = Math.max(3, Math.ceil((e.x + 34 - x0) / 10));
    g.begin(); for (let x = x0; x < x0 + n * 10 * Math.min(1, q * 3); x++) g.set(Math.round(x), e.gy + 1 + (rnd(Math.floor(x / 3) + e.seed) < 0.4 ? 1 : 0), q < 0.6 && rnd(x + Math.floor(tt * 20)) < 0.5 ? C.gold : C.shadow, q < 0.6 ? 5 : 0); flat(g);
    for (let i = 0; i < n; i++) spike(g, x0 + i * 10 + 4, e.gy, (10 + (i % 3) * 6 + (Math.abs(x0 + i * 10 - e.x) < 8 ? 8 : 0)) * bump((tt - i * 0.045) / 0.6), 7 + (i % 2) * 2, i % 2 ? 1 : -1);
    const ph = bump(tt / 0.5) * 38;                                                    // eldpelare genom målet
    if (ph > 1) { g.begin(); for (let dx = -5; dx <= 5; dx++) { const h = ph * (1 - Math.abs(dx) / 7) * (0.75 + 0.25 * wob(dx + e.x, tt * 2)); for (let j = 0; j < h; j++) { const f = j / h, a = Math.abs(dx); g.set(Math.round(e.x + dx), e.gy - j, a < 2 && f < 0.7 ? C.white : a < 4 && f < 0.85 ? C.gold : f < 0.9 ? C.ember : C.red, a < 2 && f < 0.7 ? 5 : a < 4 ? 5 : 4); } } flat(g); }
  },
  'magic-charge'(g, e, q, tt) {                                                        // gnistor dras in mot hjälten medan ringen under fötterna tänds
    g.begin();
    for (let i = 0; i < 12; i++) { const an = i * TAU / 12 + tt * 3, r = 30 * (1 - q) + 3; star4(g, e.hx + Math.cos(an) * r, e.hy + Math.sin(an) * r * 0.8, C.cyan, C.vio); }
    for (let i = 0; i < 60; i++) { const an = i * TAU / 60; if ((i + Math.floor(tt * 14)) % 3) g.set(Math.round(e.hx + Math.cos(an) * 24 * q), Math.round(e.gy + 1 + Math.sin(an) * 5 * q), C.cyan, 5); }
    flat(g);
  },
  'magic-super'(g, e, q, tt) {
    for (let j = 0; j < 7; j++) {
      const land = e.until + j * 0.075, fall = 0.3, p = (tt - (land - fall)) / fall, tx = e.x + (rnd(e.seed + j) - 0.5) * 26, ty = e.y + (rnd(e.seed + j * 3) - 0.3) * 18;
      if (p < 0) continue;
      if (p < 1) {
        const x = tx - 46 * (1 - p), y = ty - 80 * (1 - p);
        g.begin(); for (let k = 1; k < 9; k++) { g.set(Math.round(x - k * 2.3), Math.round(y - k * 4), k < 4 ? C.cyan : C.vio, k < 4 ? 5 : 4); if (k < 5) g.set(Math.round(x - k * 2.3) + 1, Math.round(y - k * 4), C.white, 5); } flat(g);
        bigStar(g, x, y, 6);
      } else if (p < 1.7) { g.begin(); const R = 3 + (p - 1) * 14; for (let k = 0; k < 8; k++) { const an = k * TAU / 8; for (let r = R - 3; r <= R; r++) g.set(Math.round(tx + Math.cos(an) * r), Math.round(ty + Math.sin(an) * r), r > R - 1 ? C.white : j % 2 ? C.cyan : C.gold, 5); } flat(g); }
    }
  },
  puff(g, e, q) {
    g.begin();
    for (let i = 0; i < 9; i++) { const an = i * TAU / 9 + e.seed, d = 4 + q * 16, cx = e.x + Math.cos(an) * d, cy = e.y + 4 + Math.sin(an) * d * 0.8, r = 5 * (1 - q) + 1;
      for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r && (q < 0.4 || ((x + y) & 1))) g.set(x, y, y < cy - r * 0.3 ? C.ink : C.smoke, y < cy - r * 0.3 ? 4 : 3); }
    flat(g);
  },
  'shadow-super'(g, e, q, tt, st) {
    const cuts = [[-0.55, 0], [0.7, 0.14], [-1.35, 0.28], [0.2, 0.42]];
    cuts.forEach(([an, at], i) => {                                                    // en skuggbild blinkar till på var sin sida om målet för varje snitt
      const p = (tt - at) / 0.2; if (p < 0 || p > 1 || !st || !st.clone) return;
      st.clone(g, Math.round(e.x + (i % 2 ? 18 : -30) - 38), Math.round(e.gy - 61 - (i > 1 ? 8 : 0)), false);
    });
    g.begin(); cuts.forEach(([an, at]) => { const p = (tt - at) / 0.3; if (p >= 0 && p <= 1) slash(g, e.x, e.y, an, 44, p); });
    if (tt > 0.5) for (let i = 0; i < 14; i++) { const an = rnd(e.seed + i) * TAU, v = 40 + rnd(e.seed + i * 5) * 70, u = tt - 0.5; g.set(Math.round(e.x + Math.cos(an) * v * u), Math.round(e.y + Math.sin(an) * v * u + 70 * u * u), i % 3 ? C.smoke : C.teal, i % 3 ? 3 : 5); }
    flat(g);
  },
  'druid-super'(g, e, q, tt) {                                                         // månen går upp, hjorten stormar fram och rötter slår upp i dess spår
    const x0 = e.hx - 60, sp = Math.max(160, (e.x - x0) / Math.max(0.2, e.until)), x = e.x + (tt - e.until) * sp;
    const mq = Math.min(1, tt / 0.25) * (q > 0.8 ? (1 - q) / 0.2 : 1), mx = Math.round(e.hx + 26), my = Math.round(e.gy - 52 - mq * 5);
    if (mq > 0.2) { g.begin(); g.ell(mx, my, 7, 7, C.spirit, true, (dx, dy) => (dx - 0.45) ** 2 + (dy + 0.15) ** 2 > 0.6); g.end(); }
    for (let i = 0; i < 9; i++) { const rx = x0 + 30 + i * 16, since = (x - 24 - rx) / sp; if (since > 0 && since < 0.55) thorn(g, rx, e.gy, (8 + (i % 3) * 5) * bump(since / 0.55), i % 2 ? 0.7 : -0.5, 5); }
    g.begin(); for (let i = 0; i < 12; i++) g.set(Math.round(x - 20 - rnd(i + e.seed) * 46), Math.round(e.gy - 5 - rnd(i * 3 + e.seed) * 30 + Math.sin(tt * 9 + i) * 3), i % 3 ? C.lime : C.spirit, 5); flat(g);
    drawStag(g, Math.round(x), e.gy, tt);
  },
  cheer(g, e, q, tt, st, kind) {
    g.begin();
    for (let i = 0; i < 16; i++) {
      const r1 = rnd(e.seed + i), r2 = rnd(e.seed + i * 7 + 3);
      if (kind === 'might') { const an = -Math.PI * (0.25 + 0.5 * r1), v = 50 + r2 * 50; g.set(Math.round(e.hx + Math.cos(an) * v * tt), Math.round(e.gy - 10 + Math.sin(an) * v * tt + 70 * tt * tt), i % 2 ? C.gold : C.ember, q < 0.6 ? 5 : 3); }
      else if (kind === 'magic') { if (i < 8) { const an = i * TAU / 8 + tt * 2.5, r = 10 + q * 22; if ((i + Math.floor(tt * 8)) % 3) star4(g, e.hx + Math.cos(an) * r, e.hy - 6 + Math.sin(an) * r * 0.7, C.cyan, C.vio); } }
      else if (kind === 'shadow') { const an = r1 * TAU, v = 20 + r2 * 40; g.set(Math.round(e.hx + Math.cos(an) * v * tt), Math.round(e.hy + Math.sin(an) * v * tt * 0.6), i % 2 ? C.teal : C.white, q < 0.5 ? 5 : 3); }
      else if (kind === 'druid') { const an = i * TAU / 16, r = 6 + q * 30; g.set(Math.round(e.hx + Math.cos(an) * r), Math.round(e.gy + 1 + Math.sin(an) * r * 0.2), C.lime, q < 0.6 ? 5 : 4); g.set(Math.round(e.hx - 24 + r1 * 48), Math.round(e.gy - 4 - ((tt * 30 + r2 * 40) % 44)), i % 2 ? C.lime : C.spirit, 5); }
      else g.set(Math.round(e.hx - 20 + r1 * 40), Math.round(e.hy - 30 + r2 * 10 + tt * 40), C.gold, 5);
    }
    flat(g);
    if (kind === 'druid') [[-16, 10, -0.6], [-8, 14, -0.2], [9, 14, 0.3], [17, 10, 0.7]].forEach(([dx, h, lean]) => thorn(g, e.hx + dx, e.gy, h * bump(q), lean, 5));   // rötter reser sig runt hjälten
  },
};
// Ritar en effekt. Returnerar false när den är slut och kan tas bort ur listan.
export function drawFx(g, e, now, st) {
  const tt = now - e.t0, q = tt / e.dur; if (q >= 1) return false; if (q < 0) return true;
  if (e.id.endsWith('-cheer')) FX.cheer(g, e, q, tt, st, e.id.split('-')[0]); else if (FX[e.id]) FX[e.id](g, e, q, tt, st);
  return true;
}
// För ikoner: rita en effekt vid en bestämd tidpunkt.
export function drawFxAt(g, id, e, q, dur = 0.5) { const c = { seed: 3, hx: -40, hy: 0, until: 0.3, ...e }; if (id.endsWith('-cheer')) FX.cheer(g, c, q, q * dur, null, id.split('-')[0]); else FX[id](g, c, q, q * dur, null); }
export const iconParts = { spike, thorn, bigStar, slash, flat };
