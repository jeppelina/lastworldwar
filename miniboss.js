// Minibossar: entré, namnskylt och nederlag för de sex fiender som kan komma som sista strid i en vanlig bana.
// Vilka som är minibossar, hur ofta de kommer och deras liv, skada och belöning står i balance.js (K.miniboss) och
// räknas i rules.js (miniFight). Här finns bara det som syns. Striden (battle.js) spelar en film i taget:
//   enter   2,6 till 2,8 sekunder: fienden kommer in på sitt eget sätt, skärmen får svarta band och mörknar,
//           och namnskylten slås upp i en stil som passar varelsen (klösmärken, sandsten, trä, is, glöd, vapen).
//   defeat  2,3 till 2,5 sekunder: fienden ger sig på sitt eget sätt, sedan går striden vidare som vanligt.
// Ett tryck var som helst i scenen hoppar över filmen. Ingen film väntar längre än tre sekunder, och inget rör svaren.
//
// En film är en tabell per id: dur (sekunder), card (andel av filmen när skylten kommer, bara entrén) och
//   pose(p, c)  -> { dx, dy, ang, k, piv, pose, hide, clip }  var fienden står (dx, dy från sin plats), vridning runt en
//                  punkt piv pixlar ovanför marken, skala k, extra fält till ritfunktionens pose, hide = ritas inte,
//                  clip = bara det som är ovanför marken syns (stiger upp ur eller sjunker ner i marken)
//   back(g, p, c), front(g, p, c)  ritar det som hör till filmen bakom respektive framför fienden
//   shake(p)    hur mycket skärmen skakar just nu (0 = inget)
//   night(p)    0..1: extra mörker (vargens månsken), annars bara de vanliga banden
//   ev          [{ at, sfx }] ljud som spelas en gång när filmen passerar at (ljuden finns i main.js: good, win, soft, tap)
// c = { x, gy, W, H, h, w, t } (fiendens plats, marken, scenens storlek, fiendens höjd och bredd, klockan).
// p går från 0 till 1 genom filmen.
import { ramp as R, G } from './pixel.js';

const C = {
  dark: R('#2b2740'), white: R('#ffffff'), bone: R('#ece4cf'), gold: R('#f2b632'), red: R('#d8433b'),
  wood: R('#9a6b3f'), fire: R('#ff7a1f'), fire2: R('#ffd84a'), ice: R('#bff0ff'), pink: R('#ee8fa8'),
  leaf: R('#58b04a'), snow: R('#eef4fb'), smoke: R('#8d8aa0'), dust: R('#cdbb9a'), sand: R('#e2c27a'),
  dirt: R('#7a5a3a'), moon: R('#fff1c4'), steel: R('#aab6c4'), mouse: R('#9a96a8'), banner: R('#a8243f'),
  lava: R('#ff9a2a'), glow: R('#fff6a8'), navy: R('#39446e'),
};
const { sin, cos, PI, max, min, floor } = Math;
const clamp = (v, a = 0, b = 1) => max(a, min(b, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const bump = (u) => sin(clamp(u) * PI);
const eOut = (u) => 1 - (1 - clamp(u)) ** 3, eIn = (u) => clamp(u) ** 2;
const eIO = (u) => { u = clamp(u); return u < 0.5 ? 4 * u * u * u : 1 - ((-2 * u + 2) ** 3) / 2; };
const fr = (v) => v - floor(v);
const rnd = Math.round;
// Band och mörker: in under första 12 procenten, ut under de sista 10.
const frame = (p) => (p < 0.12 ? eOut(p / 0.12) : p > 0.9 ? 1 - eIn((p - 0.9) / 0.1) : 1);

// Partiklar som är en ren funktion av tiden (u = 0..1 sedan utbrottet), så att samma bildruta alltid ser likadan ut.
function burst(g, x, y, u, n, rp, o = {}) {
  if (u <= 0 || u >= 1) return;
  const sp = o.sp || 30, gr = o.gr ?? 40, up = o.up ?? 1, sz = u < 0.5 ? (o.sz || 2) : 1;
  for (let i = 0; i < n; i++) {
    const an = (o.a0 ?? -PI) + fr(i * 0.618 + 0.13) * (o.arc ?? PI), v = sp * (0.45 + 0.55 * fr(i * 0.37 + 0.5));
    g.rect(rnd(x + cos(an) * v * u), rnd(y + sin(an) * v * u * up + gr * u * u), sz, sz, i % 3 === 0 && o.rp2 != null ? o.rp2 : rp, o.lv ?? 4);
  }
}
const part = (g, fn) => { g.begin(); fn(); g.end({ outline: false, edge: false }); };
const solid = (g, fn) => { g.begin(); fn(); g.end(); };

// ---------- Små figurer som bara finns i filmerna ----------
// Musen som körde riddarens rustning. wave: vinkar (0..1), run: springer (benen går).
function mouse(g, x, y, t, wave = 0, run = 0) {
  g.push(rnd(x), rnd(y), 0, 1.4);
  solid(g, () => {
    g.thick(5, -3, 11, -6 + sin(t * 8) * 1.5, 1, C.pink, 3);                                           // svansen
    g.ell(1, -4, 5, 3.6, C.mouse); g.ell(-4, -6, 3.2, 2.8, C.mouse);
    g.ell(-3, -10, 2.4, 2.4, C.mouse); g.ell(-3, -10, 1.3, 1.3, C.pink, false, null, 4); g.ell(1, -9, 2, 2, C.mouse);
    g.dot(-8, -6, C.pink, 4); g.dot(-5, -7, C.dark, 0); g.dot(-6, -8, C.white, 5);
    const l = run ? (floor(t * 16) % 2) * 2 - 1 : 0; g.line(-2 + l, -1, -2 + l, 0, C.mouse, 2); g.line(3 - l, -1, 3 - l, 0, C.mouse, 2);
    if (wave > 0) g.thick(-3, -5, -6, -9 - sin(t * 18) * 1.5 * wave, 1.2, C.mouse, 4);
  });
  g.pop();
}
// Skarabé som springer ut ur bandagehögen.
function beetle(g, x, y, t) { solid(g, () => { g.ell(x, y - 2, 3, 2.2, R('#2f9fb0')); g.dot(x - 3, y - 2, C.dark, 0); const l = floor(t * 18) % 2; g.dot(x - 1 + l, y, C.dark, 0); g.dot(x + 2 - l, y, C.dark, 0); }); }
// En blomma som växer upp (u = 0..1).
function flower(g, x, y, u, t) {
  if (u <= 0) return;
  const hgt = eOut(u) * 12, op = seg(u, 0.55, 1);
  solid(g, () => {
    g.thick(x, y, x + sin(t * 2) * 0.6, y - hgt, 1.4, C.leaf, 3);
    if (u > 0.3) g.ell(x + 2.5, y - hgt * 0.45, 2.2 * seg(u, 0.3, 0.6), 1, C.leaf, false, null, 4);
    if (op > 0) for (let i = 0; i < 5; i++) { const an = i * 1.257 + t * 0.4; g.ell(x + cos(an) * 2.2 * op, y - hgt + sin(an) * 2.2 * op, 1.6 * op, 1.6 * op, C.pink, false, null, 4); }
    if (u > 0.2) g.ell(x, y - hgt, 1.4, 1.4, C.fire2, false, null, 5);
  });
}
// Ett "Z" i pixlar.
function zed(g, x, y, s, rp, lv = 5) { x = rnd(x); y = rnd(y); for (let i = 0; i < s; i++) { g.dot(x + i, y, rp, lv); g.dot(x + i, y + s - 1, rp, lv); g.dot(x + s - 1 - i, y + i, rp, lv); } }
// Fanan som riddaren bär in och sätter i marken. lean: lutning (faller vid nederlaget).
function banner(g, x, y, t, lean = 0) {
  g.push(rnd(x), rnd(y), lean);
  solid(g, () => {
    g.thick(0, 0, 0, -58, 1.6, C.wood, 3); g.ell(0, -59, 1.6, 1.6, C.gold);
    const wv = (i) => sin(t * 5 - i * 0.9) * 1.5;
    g.poly([[0, -56], [-16, -56 + wv(2)], [-13, -50 + wv(2)], [-16, -44 + wv(2)], [0, -44]], C.banner, 3);
    g.poly([[-2, -55], [-4, -55], [-4, -46], [-2, -46]], C.gold, 4); g.rect(-11, -52 + rnd(wv(1)), 4, 4, C.gold, 5);
  });
  g.pop();
}

// ====================================================================================================
// FILMERNA, en per miniboss. epithet = raden under namnet på skylten. style = skyltens stil (se PLATE).
// ====================================================================================================
const OFF = (c) => c.W - c.x + c.w + 20;     // så långt till höger att fienden är utanför scenen
export const MB = {
  // ---------- Growl (Ordskogen): hoppar in från höger, ylar mot en måne som blixtrar fram ----------
  morr: {
    epithet: 'Terror of the Den', style: 'claw',
    enter: {
      dur: 2.7, card: 0.42, ev: [{ at: 0.28, sfx: 'soft' }, { at: 0.42, sfx: 'tap' }],
      pose(p, c) {
        if (p < 0.28) { const u = p / 0.28; return { dx: (1 - eOut(u)) * OFF(c), dy: -bump(u) * c.H * 0.32, ang: 0.3 - u * 0.4, pose: { attack: 0.46 } }; }
        const how = seg(p, 0.38, 0.46) * (1 - seg(p, 0.76, 0.84));
        return { dx: 0, dy: p < 0.34 ? rnd(bump(seg(p, 0.28, 0.34)) * 1.5) : 0, ang: 0.36 * eIO(how), piv: 6, pose: { hurt: 0.32 * how } };
      },
      night: (p) => seg(p, 0.34, 0.42) * (1 - seg(p, 0.82, 0.92)),
      shake: (p) => (p > 0.28 && p < 0.33 ? 6 : 0),
      back(g, p, c) {
        const m = seg(p, 0.38, 0.48) * (1 - seg(p, 0.84, 0.94)); if (m <= 0) return;      // månen
        const mx = c.W * 0.88, my = c.H * 0.2, r = c.H * 0.1 * (0.7 + 0.3 * m);
        part(g, () => { for (let i = 0; i < 18; i++) { const an = i * 0.349 + c.t * 0.3; g.dot(rnd(mx + cos(an) * r * 1.5), rnd(my + sin(an) * r * 1.5), C.moon, 5); } });
        solid(g, () => { g.ell(mx, my, r, r, C.moon, false, null, 5); g.ell(mx + r * 0.15, my + r * 0.1, r * 0.85, r * 0.85, C.moon, false, (dx, dy) => dx > 0.2 && dy > 0.1, 4); g.ell(mx + r * 0.3, my - r * 0.2, r * 0.22, r * 0.2, C.moon, false, null, 2); g.ell(mx - r * 0.35, my + r * 0.3, r * 0.15, r * 0.13, C.moon, false, null, 2); });
      },
      front(g, p, c) {
        part(g, () => burst(g, c.x, c.gy, seg(p, 0.28, 0.5), 14, C.dust, { sp: 26, gr: 10, up: 0.4 }));
        const how = seg(p, 0.42, 0.8); if (how <= 0 || how >= 1) return;                   // ylandet: ringar ut från nosen
        part(g, () => { for (let k = 0; k < 3; k++) { const u = fr(how * 2.2 - k * 0.33); if (how * 2.2 < k * 0.33) continue; const r = 3 + u * 18, cx = c.x - c.w * 0.35, cy = c.gy - c.h * 0.95;
          for (let i = 0; i < 9; i++) { const an = -PI * 0.95 + i * 0.16; g.dot(rnd(cx + cos(an) * r), rnd(cy + sin(an) * r * 0.9), u < 0.6 ? C.white : C.moon, 5); } } });
      },
    },
    defeat: {
      dur: 2.4,
      pose(p, c) {
        if (p < 0.32) return { dx: sin(c.t * 40) * 0.7, dy: 0, pose: { hurt: 0.75 } };          // gnyr och darrar
        const u = seg(p, 0.32, 1); return { dx: eIn(u) * OFF(c), dy: -rnd(Math.abs(sin(u * PI * 7)) * 1.2), ang: 0.07, pose: { hurt: 0.55 } };
      },
      front(g, p, c) {
        if (p > 0.05 && p < 0.4) part(g, () => { const u = fr(p * 5); g.rect(rnd(c.x - c.w * 0.32), rnd(c.gy - c.h * 0.62 + u * 10), 1, 2, C.ice, 5); });       // en tår
        if (p > 0.08 && p < 0.34) part(g, () => { const u = seg(p, 0.08, 0.34), x = c.x - c.w * 0.45 - u * 6, y = c.gy - c.h * 1.05 - u * 6; g.rect(rnd(x), rnd(y), 2, 1, C.white, 4); g.rect(rnd(x) - 2, rnd(y) - 2, 2, 1, C.white, 4); });   // gnyende små streck
      },
    },
  },

  // ---------- Stumbles (Solöknen): stiger upp ur sanden, nederlag: lindas upp till en hög och en skarabé springer ut ----------
  snubbel: {
    epithet: 'Lord of the Lost Bandages', style: 'sand',
    enter: {
      dur: 2.7, card: 0.42, ev: [{ at: 0.05, sfx: 'soft' }],
      pose(p, c) {
        const u = seg(p, 0, 0.42), sh = seg(p, 0.45, 0.8);
        return { dx: rnd(sin(sh * PI * 4) * 2 * (1 - sh)), dy: (1 - eOut(u)) * (c.h + 3), clip: true, pose: { attack: 0.22 * bump(sh) } };
      },
      shake: (p) => (p < 0.42 ? 2.5 : 0),
      front(g, p, c) {
        const u = seg(p, 0, 0.5);
        if (u > 0 && u < 1) part(g, () => { for (let i = 0; i < 12; i++) { const q = fr(c.t * 2.2 + i * 0.27), x = c.x + (fr(i * 0.618) - 0.5) * c.w * 1.1; g.rect(rnd(x + (x - c.x) * q * 0.4), rnd(c.gy - 1 - bump(q) * (8 + (i % 4) * 4)), 1, 1, C.sand, 4 + (i % 2)); } });
        part(g, () => { const m = 1 - seg(p, 0.5, 0.95); if (m > 0) g.ell(c.x, c.gy + 1, c.w * 0.6 * m, 3 * m, C.sand, false, null, 4); });    // sandhög som sjunker ihop
      },
    },
    defeat: {
      dur: 2.4,
      pose(p, c) {
        if (p >= 0.55) return { hide: true };
        const u = seg(p, 0, 0.55); return { ang: -eIn(u) * PI * 5, piv: c.h * 0.5, k: 1 - 0.35 * eIn(u), dy: -bump(u) * 6, pose: { hurt: 0.5 } };
      },
      front(g, p, c) {
        if (p < 0.6) part(g, () => { const u = seg(p, 0.05, 0.6); for (let i = 0; i < 8; i++) { const an = i * 0.785 + u * 9, r = 6 + u * 26 + (i % 3) * 3, cx = c.x, cy = c.gy - c.h * 0.5;
          g.line(rnd(cx + cos(an) * r * 0.5), rnd(cy + sin(an) * r * 0.5), rnd(cx + cos(an + 0.4) * r), rnd(cy + sin(an + 0.4) * r + u * 20), C.bone, 5); } });
        if (p >= 0.5) {
          solid(g, () => { const m = eOut(seg(p, 0.5, 0.62)); for (const [dx, dy, r] of [[-6, -2, 6], [5, -2, 6], [0, -6, 5], [-2, -9, 3]]) g.ell(c.x + dx * m, c.gy + dy * m, r * m, r * 0.6 * m, C.bone); g.line(c.x - 8, c.gy - 4, c.x + 6, c.gy - 6, C.bone, 2); g.line(c.x - 4, c.gy - 7, c.x + 4, c.gy - 2, C.bone, 2); });
          const b = seg(p, 0.62, 1); if (b > 0) beetle(g, c.x + 8 + eIn(b) * (c.W - c.x), c.gy, c.t);
        }
      },
    },
  },

  // ---------- Grumpstump (Svampträsket): skakar sig upp ur marken med rötter och jord, nederlag: gäspar, sjunker ner, en blomma växer ----------
  grumpstump: {
    epithet: 'The Grumpiest Root', style: 'wood',
    enter: {
      dur: 2.6, card: 0.44, ev: [{ at: 0.02, sfx: 'soft' }, { at: 0.42, sfx: 'soft' }],
      pose(p, c) {
        const u = seg(p, 0, 0.42), ang = seg(p, 0.48, 0.58) * (1 - seg(p, 0.7, 0.8));
        return { dx: p < 0.42 ? rnd(sin(c.t * 60)) : 0, dy: (1 - eOut(u)) * (c.h + 4), clip: true, pose: { attack: 0.28 * ang } };
      },
      shake: (p) => (p < 0.42 ? 3 : p < 0.46 ? 6 : 0),
      front(g, p, c) {
        const u = seg(p, 0, 0.55);
        if (u > 0 && u < 1) part(g, () => { for (let i = 0; i < 14; i++) { const q = fr(c.t * 1.8 + i * 0.31), x = c.x + (fr(i * 0.618) - 0.5) * c.w; g.rect(rnd(x + (x - c.x) * q * 0.6), rnd(c.gy - 2 - bump(q) * (10 + (i % 5) * 4)), 2, 2, i % 3 ? C.dirt : C.leaf, 3 + (i % 3)); } });
        part(g, () => burst(g, c.x, c.gy, seg(p, 0.42, 0.62), 16, C.dirt, { sp: 34, gr: 30, rp2: C.leaf }));
      },
    },
    defeat: {
      dur: 2.4,
      pose(p, c) {
        if (p < 0.25) return { pose: { hurt: 0.35 } };
        const u = seg(p, 0.25, 0.65); return u >= 1 ? { hide: true } : { dx: rnd(sin(c.t * 50) * 0.8), dy: eIn(u) * (c.h + 4), clip: true, pose: { hurt: 0.2 } };
      },
      shake: (p) => (p > 0.25 && p < 0.65 ? 2 : 0),
      front(g, p, c) {
        if (p < 0.25) part(g, () => { const u = seg(p, 0, 0.25); zed(g, c.x - c.w * 0.2 + u * 4, c.gy - c.h - 4 - u * 8, 4, C.white); });   // en gäspning
        part(g, () => burst(g, c.x, c.gy, seg(p, 0.25, 0.75), 12, C.dirt, { sp: 22, gr: 25 }));
        flower(g, c.x, c.gy, seg(p, 0.62, 0.92), c.t);
      },
    },
  },

  // ---------- Snooze (Frostbergen): rullar ner som en snöboll, nederlag: tippar bakåt, somnar och snöar över ----------
  gasp: {
    epithet: 'King of the Snowdrift', style: 'ice',
    enter: {
      dur: 2.8, card: 0.46, ev: [{ at: 0.4, sfx: 'soft' }],
      pose(p, c) {
        if (p < 0.4) { const u = p / 0.4; return { dx: (1 - u) * (c.W - c.x + 10), dy: -(1 - eIn(u)) * c.H * 0.7, ang: -(1 - u) * PI * 4, piv: c.h * 0.5, k: 0.8 + 0.2 * u, pose: { hurt: 0.6 } }; }
        const d = seg(p, 0.4, 0.55), sh = seg(p, 0.55, 0.78);
        return { dx: rnd(sin(sh * PI * 6) * 2.5 * bump(sh)), dy: rnd(bump(d) * 2), pose: { hurt: 0.6 * (1 - d) } };
      },
      shake: (p) => (p > 0.4 && p < 0.46 ? 9 : 0),
      front(g, p, c) {
        if (p < 0.4) part(g, () => { const u = p / 0.4, x0 = c.x + (1 - u) * (c.W - c.x + 10), y0 = c.gy - (1 - eIn(u)) * c.H * 0.7 - c.h * 0.4; for (let i = 0; i < 10; i++) g.rect(rnd(x0 + 6 + i * 4), rnd(y0 - 6 + fr(i * 0.618) * 20 - i * 2), 2, 2, i % 2 ? C.snow : C.white, 5); });
        part(g, () => burst(g, c.x, c.gy - 4, seg(p, 0.4, 0.7), 24, C.snow, { sp: 50, gr: 40, rp2: C.white, arc: PI * 1.1, a0: -PI * 1.05 }));
        part(g, () => burst(g, c.x, c.gy - c.h * 0.8, seg(p, 0.56, 0.8), 12, C.snow, { sp: 26, gr: 30, rp2: C.white }));      // skakar av sig snön
      },
    },
    defeat: {
      dur: 2.5,
      pose(p, c) {
        if (p > 0.84) return { hide: true };
        const u = seg(p, 0, 0.4); return { ang: eOut(u) * 1.15, dx: -eOut(u) * 6, dy: 0, pose: { hurt: 0.45 } };
      },
      front(g, p, c) {
        const z = seg(p, 0.3, 1);
        const d = eOut(seg(p, 0.42, 0.86)); if (d > 0) solid(g, () => { g.ell(c.x + c.h * 0.4, c.gy + 1, (c.h * 0.65 + 6) * d, (c.h * 0.32) * d, C.snow); g.ell(c.x + c.h * 0.15, c.gy - c.h * 0.12 * d, c.h * 0.3 * d, c.h * 0.22 * d, C.snow); g.ell(c.x + c.h * 0.65, c.gy - c.h * 0.1 * d, c.h * 0.28 * d, c.h * 0.2 * d, C.snow); });
        part(g, () => { for (let i = 0; i < 3; i++) { const u = fr(z * 1.6 - i * 0.33); if (z * 1.6 < i * 0.33) continue; zed(g, c.x + c.h * 0.3 + u * 8 + i * 3, c.gy - c.h * 0.62 - u * 22, 3 + (i % 2) * 2, C.navy, 2); } });
        part(g, () => { for (let i = 0; i < 10; i++) { const q = fr(c.t * 0.5 + i * 0.13); g.dot(rnd(c.x - 20 + i * 9 + sin(c.t + i) * 3), rnd(c.gy - 60 + q * 60), C.white, 5); } });
      },
    },
  },

  // ---------- Scorch (Meningsvulkanen): marken spricker, en eldpelare, salamandern hoppar ut; nederlag: slocknar, krymper och kilar iväg ----------
  glodhund: {
    epithet: 'Fire-Tongue of the Volcano', style: 'ember',
    enter: {
      dur: 2.6, card: 0.44, ev: [{ at: 0.22, sfx: 'soft' }, { at: 0.5, sfx: 'tap' }],
      pose(p, c) {
        if (p < 0.24) return { hide: true };
        if (p < 0.5) { const u = seg(p, 0.24, 0.5); return { dy: -bump(u) * c.H * 0.3 + (u < 0.2 ? (1 - u / 0.2) * c.h : 0), ang: 0.4 - u * 0.5, clip: true, pose: { attack: 0.3 } }; }
        const r = seg(p, 0.55, 0.62) * (1 - seg(p, 0.76, 0.84)); return { pose: { attack: 0.3 * r } };
      },
      night: (p) => 0.4 * seg(p, 0, 0.1) * (1 - seg(p, 0.8, 0.9)),
      shake: (p) => (p > 0.22 && p < 0.3 ? 7 : p > 0.5 && p < 0.54 ? 4 : 0),
      back(g, p, c) {
        const k = seg(p, 0, 0.24) * (1 - seg(p, 0.4, 0.6)); if (k <= 0) return;           // en glödande spricka i marken
        solid(g, () => { const L = c.w * 0.5 * k; g.poly([[c.x - L, c.gy], [c.x - L * 0.4, c.gy - 1], [c.x, c.gy], [c.x + L * 0.5, c.gy - 1], [c.x + L, c.gy], [c.x, c.gy + 2]], C.lava, 5); });
      },
      front(g, p, c) {
        const f = seg(p, 0.22, 0.45);                                                     // eldpelaren
        if (f > 0 && f < 1) solid(g, () => { const hh = c.H * 0.6 * bump(f), wd = 8 + 6 * bump(f); g.poly([[c.x - wd, c.gy], [c.x - wd * 0.5, c.gy - hh * 0.6], [c.x - 2, c.gy - hh], [c.x + 3, c.gy - hh * 0.75], [c.x + wd * 0.6, c.gy - hh * 0.5], [c.x + wd, c.gy]], C.fire, 4); g.poly([[c.x - wd * 0.5, c.gy], [c.x, c.gy - hh * 0.7], [c.x + wd * 0.4, c.gy]], C.fire2, 5); });
        part(g, () => burst(g, c.x, c.gy - 4, seg(p, 0.22, 0.6), 20, C.fire2, { sp: 50, gr: 50, rp2: C.fire, lv: 5 }));
        if (p < 0.24) part(g, () => { for (let i = 0; i < 5; i++) { const q = fr(c.t * 2 + i * 0.2); g.dot(rnd(c.x - 10 + i * 5), rnd(c.gy - q * 8), C.lava, 5); } });
      },
    },
    defeat: {
      dur: 2.4,
      pose(p, c) {
        const o = seg(p, 0, 0.35), s = seg(p, 0.35, 0.55), r = seg(p, 0.55, 1);
        return { dx: eIn(r) * OFF(c), dy: r > 0 ? -rnd(Math.abs(sin(r * PI * 10))) : 0, k: 1 - 0.5 * eIO(s), pose: { out: o, hurt: r > 0 ? 0 : 0.35 * (1 - s) } };
      },
      front(g, p, c) {
        part(g, () => { for (let i = 0; i < 4; i++) { const u = seg(p, 0.05 + i * 0.08, 0.5 + i * 0.08); if (u <= 0 || u >= 1) continue; const x = c.x - c.w * 0.3 + i * c.w * 0.18, y = c.gy - c.h * 0.6;
          g.ell(rnd(x - u * 3), rnd(y - u * 16), 2 + u * 3, 1.6 + u * 2.4, C.smoke, false, null, u < 0.5 ? 4 : 3); } });
        if (p > 0.55) part(g, () => { const r = seg(p, 0.55, 1); for (let i = 0; i < 3; i++) { const u = fr(r * 4 + i * 0.33); g.rect(rnd(c.x + eIn(r) * OFF(c) + 8 + u * 6), rnd(c.gy - 1 - u * 3), 2, 1, C.dust, 4); } });
      },
    },
  },

  // ---------- Sir Clank (Molnslottet): marscherar in med en fana och sätter den i marken; nederlag: rustningen faller isär och en mus kliver ut ----------
  rostis: {
    epithet: 'Knight of the Rusty Banner', style: 'heraldic', stay: true,
    enter: {
      dur: 2.7, card: 0.48, ev: [{ at: 0.58, sfx: 'soft' }, { at: 0.62, sfx: 'win' }],
      pose(p, c) {
        if (p < 0.55) { const u = p / 0.55; return { dx: (1 - u) * OFF(c), dy: -rnd(Math.abs(sin(u * PI * 7)) * 2.5), pose: {} }; }
        const s = seg(p, 0.64, 0.72) * (1 - seg(p, 0.82, 0.9)); return { pose: { attack: 0.22 * s } };
      },
      shake: (p) => (p > 0.58 && p < 0.62 ? 4 : 0),
      back(g, p, c) {
        const u = clamp(p / 0.55), carry = p < 0.58, x = carry ? c.x + (1 - u) * OFF(c) + c.w * 0.32 : c.x + c.w * 0.62;
        banner(g, x, c.gy - (carry ? 4 + Math.abs(sin(u * PI * 7)) * 2.5 : 0), c.t, carry ? 0.12 : 0);
      },
      front(g, p, c) { part(g, () => burst(g, c.x + c.w * 0.62, c.gy, seg(p, 0.58, 0.75), 10, C.dust, { sp: 18, gr: 12, up: 0.5 })); },
    },
    // Fanan står kvar medan striden pågår.
    stay(g, c) { banner(g, c.x + c.w * 0.62, c.gy, c.t, 0); },
    defeat: {
      dur: 2.5, ev: [{ at: 0.24, sfx: 'soft' }],
      pose(p, c) { return p < 0.24 ? { dx: rnd(sin(c.t * 50) * 1.2), pose: { hurt: 0.5 } } : { hide: true }; },
      back(g, p, c) { banner(g, c.x + c.w * 0.62, c.gy, c.t, eIn(seg(p, 0.28, 0.5)) * 1.45); },
      front(g, p, c) {
        const u = seg(p, 0.24, 0.62);
        if (p >= 0.24) solid(g, () => {                                                     // rustningens delar flyger och landar
          const parts = [[-0.9, -1.25, 'helm'], [0.7, -1.0, 'plate'], [-1.2, -0.7, 'arm'], [1.2, -0.75, 'arm'], [-0.5, -0.9, 'leg'], [0.4, -1.1, 'sword']];
          parts.forEach(([vx, vy, kind], i) => {
            const T = clamp(u * 1.3), x = c.x + vx * 30 * T, y0 = c.gy - c.h * 0.5, y = min(c.gy - 2, y0 + vy * 70 * T + 110 * T * T), an = T * (3 + i) * (vx < 0 ? -1 : 1) * (y >= c.gy - 2 ? 0 : 1);
            g.push(rnd(x), rnd(y), an);
            if (kind === 'helm') { g.ell(0, 0, 5, 4.5, C.steel); g.rect(-5, -1, 6, 1, C.dark, 0); g.rect(1, -7, 2, 3, C.red, 3); }
            else if (kind === 'plate') { g.ell(0, 0, 6, 5, C.steel); g.line(0, -4, 0, 4, C.steel, 2); }
            else if (kind === 'sword') { g.rect(-1, -10, 2, 14, C.steel, 4); g.rect(-3, 3, 6, 1, C.gold, 4); }
            else g.rect(-2, -4, 4, 8, C.steel, 3);
            g.pop();
          });
        });
        if (p >= 0.26) { const w = seg(p, 0.45, 0.7), r = seg(p, 0.72, 1); mouse(g, c.x + eIn(r) * OFF(c), c.gy, c.t, w > 0 && w < 1 ? 1 : 0, r > 0); }
        if (p > 0.26 && p < 0.45) part(g, () => { for (let i = 0; i < 3; i++) g.rect(rnd(c.x - 4 + i * 3), rnd(c.gy - 16 - seg(p, 0.26, 0.45) * 6), 1, 3, C.white, 5); });     // "!"
      },
    },
  },
};
export const has = (id) => !!MB[id];

// ====================================================================================================
// NAMNSKYLTEN: en skylt i pixlar (ritad med G) med namnet och raden under i spelets vanliga stil.
// Varje stil har en egen skylt och ett eget sätt att komma in. q = 0..1 genom skyltens tid.
// ====================================================================================================
const PW = 132, PH = 38;
const PLATE = {
  claw(g, q, t) {                                        // mörkt, trasigt skinn och tre klösmärken som rivs upp
    const hide = R('#3a3348'); g.begin();
    for (let x = 0; x < PW; x++) { const a = 4 + rnd(fr(sin(x * 1.7) * 43.1) * 3), b = PH - 4 - rnd(fr(sin(x * 2.3) * 17.7) * 3); g.rect(x, a, 1, b - a, hide, 2 + (x % 7 === 0 ? 1 : 0)); }
    g.end();
    g.begin();
    for (let i = 0; i < 3; i++) { const u = seg(q, 0.02 + i * 0.05, 0.1 + i * 0.05); if (u <= 0) continue; const x0 = 18 + i * 9, x1 = x0 + 92;
      g.thick(x1, 6 + i, x1 - (x1 - x0) * u, 6 + i + (PH - 16) * u, 3.4, C.red, 2); g.thick(x1, 6 + i, x1 - (x1 - x0) * u, 6 + i + (PH - 16) * u, 1.6, C.white, 5); }
    g.end({ outline: false });
  },
  sand(g, q, t) {                                        // en papyrusrulle i sandsten med tecken längs kanten
    const st = R('#dcbc80'); g.begin(); g.rect(8, 5, PW - 16, PH - 10, st, 3); g.rect(8, 5, PW - 16, 2, st, 5); g.end();
    g.begin(); for (const x of [6, PW - 6]) g.ell(x, PH / 2, 4, PH / 2 - 3, st, true); g.end();
    g.begin(); for (let x = 14; x < PW - 14; x += 9) { const k = (x / 9) % 3; if (k < 1) g.rect(x, 8, 3, 2, C.dirt, 1); else if (k < 2) { g.dot(x, 9, C.dirt, 1); g.dot(x + 2, 8, C.dirt, 1); g.dot(x + 1, 10, C.dirt, 1); } else g.rect(x, 8, 1, 3, C.dirt, 1); g.rect(x + 2, PH - 9, 2, 1, C.dirt, 1); } g.end({ outline: false, edge: false });
  },
  wood(g, q, t) {                                        // en planka med ådring, spikar, ett blad och en svamp
    const wd = R('#9a6b3f'); g.begin(); g.rect(4, 6, PW - 8, PH - 12, wd, 3); g.end();
    g.begin(); for (const [y, x0, x1] of [[10, 10, 60], [15, 40, 110], [22, 8, 50], [27, 70, 124]]) g.line(x0, y, x1, y + 1, wd, 2); g.ell(96, 12, 4, 2, wd, false, null, 2); g.end({ outline: false });
    g.begin(); for (const x of [9, PW - 10]) g.rect(x, 9, 2, 2, C.steel, 4); g.end();
    g.begin(); g.ell(PW - 14, 4, 4, 2, C.leaf); g.thick(PW - 18, 6, PW - 16, 4, 1, C.leaf, 2); g.ell(10, PH - 6, 3, 2, C.red); g.dot(9, PH - 7, C.white, 5); g.end();
  },
  ice(g, q, t) {                                         // en isplatta med istappar under och glitter
    g.begin(); g.rect(4, 5, PW - 8, PH - 14, C.ice, 3); g.rect(4, 5, PW - 8, 3, C.ice, 5); g.end();
    g.begin(); for (let x = 8; x < PW - 8; x += 7) { const L = 3 + rnd(fr(x * 0.37) * 5) * (0.4 + 0.6 * clamp(q * 4)); g.poly([[x, PH - 9], [x + 1.5, PH - 9 + L], [x + 3, PH - 9]], C.ice, 4); } g.end();
    g.begin(); for (let i = 0; i < 6; i++) { if ((floor(t * 4) + i) % 3) continue; const x = 10 + i * 21, y = 7 + (i % 3) * 7; g.dot(x, y, C.white, 5); g.dot(x - 1, y, C.white, 4); g.dot(x + 1, y, C.white, 4); g.dot(x, y - 1, C.white, 4); g.dot(x, y + 1, C.white, 4); } g.end({ outline: false, edge: false });
  },
  ember(g, q, t) {                                       // basalt med glödande sprickor och gnistor som stiger
    g.begin(); g.rect(4, 6, PW - 8, PH - 12, R('#3a2a30'), 3); g.end();
    g.begin(); const L = C.lava; for (const pts of [[[10, 28], [22, 22], [30, 26], [44, 18]], [[70, 30], [82, 24], [96, 27], [110, 20], [122, 23]], [[52, 8], [58, 14], [66, 11]]]) for (let i = 0; i + 1 < pts.length; i++) g.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], L, 5); g.end({ outline: false });
    g.begin(); for (let i = 0; i < 10; i++) { const u = fr(t * 0.8 + i * 0.29); g.dot(rnd(8 + fr(i * 0.618) * (PW - 16) + sin(t * 3 + i) * 2), rnd(PH - 6 - u * (PH - 4)), u < 0.5 ? C.fire2 : C.fire, 5); } g.end({ outline: false, edge: false });
  },
  heraldic(g, q, t) {                                    // ett rött band med guldkant, kluvna ändar och en liten sköld
    g.begin(); g.poly([[0, 8], [14, 8], [14, PH - 8], [0, PH - 8], [6, PH / 2]], C.banner, 2); g.poly([[PW, 8], [PW - 14, 8], [PW - 14, PH - 8], [PW, PH - 8], [PW - 6, PH / 2]], C.banner, 2); g.end();
    g.begin(); g.rect(10, 5, PW - 20, PH - 10, C.banner, 3); g.rect(10, 5, PW - 20, 2, C.gold, 4); g.rect(10, PH - 7, PW - 20, 2, C.gold, 3); g.end();
    g.begin(); g.poly([[3, 2], [21, 2], [21, 14], [12, 22], [3, 14]], R('#39446e'), 3); g.rect(11, 4, 2, 15, C.gold, 5); g.rect(5, 9, 14, 2, C.gold, 5); g.end();
  },
};
// Hur skylten kommer in: { tf (transform), op (opacitet), clip (clip-path för texten) } för q = 0..1 genom skyltens tid.
const MOVE = {
  claw: (q) => ({ tf: `translate(-50%, 0) translate(${rnd(sin(q * 90) * 4 * (1 - seg(q, 0, 0.2)))}px, 0) rotate(-2deg)`, clip: `inset(0 ${100 - 100 * eOut(seg(q, 0.12, 0.3))}% 0 0)` }),
  sand: (q) => ({ tf: `translate(-50%, 0) scaleX(${0.05 + 0.95 * eOut(seg(q, 0, 0.18))})` }),
  wood: (q) => { const u = seg(q, 0, 0.16), sw = q > 0.16 ? sin((q - 0.16) * 30) * 6 * Math.exp(-(q - 0.16) * 9) : 0; return { tf: `translate(-50%, ${-140 * (1 - eIn(u))}%) rotate(${sw.toFixed(2)}deg)` }; },
  ice: (q) => { const u = eOut(seg(q, 0, 0.15)); return { tf: `translate(-50%, 0) scale(${(1.5 - 0.5 * u).toFixed(3)})`, op: u }; },
  ember: (q) => ({ tf: 'translate(-50%, 0)', op: q < 0.22 ? (fr(sin(q * 400) * 9) > 0.45 ? 1 : 0.15) : 1 }),
  heraldic: (q) => ({ tf: `translate(-50%, 0) scaleY(${0.05 + 0.95 * eOut(seg(q, 0, 0.18))})` }),
};

const CSS = `
.mbfx { position:absolute; inset:0; z-index:5; pointer-events:none; }
.mbfx .dim { position:absolute; inset:0; background:#05040c; opacity:0; }
.mbfx .bar { position:absolute; left:0; right:0; height:11%; background:#000; transform:scaleY(0); }
.mbfx .bar.t { top:0; transform-origin:top; } .mbfx .bar.b { bottom:0; transform-origin:bottom; }
.mbfx .skip { position:absolute; inset:0; pointer-events:auto; background:transparent; cursor:pointer; }
.mbfx .skip span { position:absolute; right:10px; bottom:calc(11% + 6px); font-size:12px; color:#fffa; text-shadow:0 1px 0 #000; }
.mbcard { position:absolute; left:43%; top:13%; width:min(66%, 440px); font-size:28px; transform-origin:50% 50%; }
.mbfx .mbcard canvas { position:relative; inset:auto; display:block; width:100%; height:auto; image-rendering:pixelated; }
.mbcard .txt { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding-bottom:2%; }
.mbcard b { font-size:1em; font-weight:900; line-height:1; letter-spacing:1px; white-space:nowrap; }
.mbcard small { font-size:max(11px, 0.42em); font-weight:800; margin-top:3px; white-space:nowrap; }
.mbcard.claw b { color:#fff; transform:skewX(-8deg); text-shadow:2px 2px 0 #000, -2px 0 0 #000, 0 -2px 0 #000, 3px 3px 0 #d8433b; } .mbcard.claw small { color:#fff; text-shadow:1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000; }
.mbcard.sand b { color:#5a3a1a; text-shadow:1px 1px 0 #fff2c8, -1px -1px 0 #7a5228; letter-spacing:3px; } .mbcard.sand small { color:#6a4a22; }
.mbcard.wood b { color:#3b2412; text-shadow:0 1px 0 #d6b684, 0 -1px 0 #2a1a0c; } .mbcard.wood small { color:#f2e2c0; text-shadow:1px 1px 0 #3b2412; }
.mbcard.ice b { color:#f2fdff; text-shadow:2px 0 0 #3a7fc0, -2px 0 0 #3a7fc0, 0 2px 0 #3a7fc0, 0 -2px 0 #3a7fc0, 0 0 10px #bff0ff; } .mbcard.ice small { color:#1f4f80; }
.mbcard.ember b { color:#ffd84a; text-shadow:2px 2px 0 #7a1e10, -2px 0 0 #7a1e10, 0 -2px 0 #7a1e10, 0 0 12px #ff7a1f; } .mbcard.ember small { color:#ffb070; text-shadow:1px 1px 0 #000; }
.mbcard.heraldic b { color:#ffe08a; text-shadow:2px 2px 0 #4a1020, -1px -1px 0 #4a1020; letter-spacing:2px; font-variant:small-caps; } .mbcard.heraldic small { color:#ffe8b0; text-shadow:1px 1px 0 #4a1020; }
.banner.boss.mini { color:#ffd84a; }
.hud .foe.mini { box-shadow:0 0 0 2px #f2b632; } .hud .foe.mini .name::before { content:'★ '; color:#ffd84a; }
`;
let styled = false;
const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

// Lagret över scenen: band, mörker, skylten och "tryck för att hoppa över". onSkip anropas vid ett tryck.
export function overlay(scene, onSkip) {
  if (!styled && typeof document !== 'undefined') { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); styled = true; }
  const el = document.createElement('div'); el.className = 'mbfx';
  el.innerHTML = '<div class="dim"></div><div class="bar t"></div><div class="bar b"></div><button class="skip" aria-label="Skip"><span>Tap to skip ▸▸</span></button>';
  el.querySelector('.skip').onclick = (e) => { e.stopPropagation(); onSkip(); };
  scene.appendChild(el);
  let card = null, cg = null, cctx = null;
  return {
    el,
    // Ett steg i filmen: p = 0..1, spec = filmen, mb = minibossens post i MB, name = fiendens namn, t = klockan.
    update(p, spec, mb, name, t, kind) {
      const fb = frame(p), night = spec.night ? spec.night(p) : 0;
      el.querySelector('.dim').style.opacity = (0.22 * fb + 0.3 * night).toFixed(3);
      el.querySelectorAll('.bar').forEach((b) => (b.style.transform = `scaleY(${fb.toFixed(3)})`));
      const c0 = spec.card ?? 0.4, q = kind === 'enter' ? (p - c0) / (1 - c0) : -1;
      if (card) card.style.display = q < 0 ? 'none' : '';
      if (q < 0) return;
      if (!card) {
        card = document.createElement('div'); card.className = 'mbcard ' + mb.style;
        card.innerHTML = `<canvas width="${PW}" height="${PH}"></canvas><div class="txt"><b>${esc(name)}</b><small>${esc(mb.epithet)}</small></div>`;
        el.insertBefore(card, el.querySelector('.skip')); cg = new G(PW, PH); cctx = card.querySelector('canvas').getContext('2d');
      }
      cg.clear(); try { PLATE[mb.style](cg, q, t); } catch (e) {} cg.paint(cctx);
      const cw = Math.min(el.clientWidth * 0.66, 440, el.clientHeight * 1.25);      // skylten får aldrig täcka mer än en dryg tredjedel av scenens höjd
      if (cw > 0) { card.style.width = cw + 'px'; card.style.fontSize = Math.max(16, cw * 0.085) + 'px'; }
      const mv = MOVE[mb.style](q), out = 1 - seg(q, 0.88, 1);
      card.style.transform = mv.tf; card.style.opacity = ((mv.op ?? 1) * out).toFixed(3);
      card.querySelector('.txt').style.clipPath = mv.clip || '';
    },
    remove() { el.remove(); },
  };
}

// Ritar fn(g2) men behåller bara pixlarna ovanför raden clipY (fienden stiger upp ur eller sjunker ner i marken).
let tmp = null;
export function clipped(g, clipY, fn) {
  if (!tmp || tmp.w !== g.w || tmp.h !== g.h) tmp = new G(g.w, g.h);
  tmp.clear(); tmp.flash = g.flash; fn(tmp);
  const lim = Math.max(0, Math.min(g.h, clipY)) * g.w;
  for (let i = 0; i < lim; i++) if (tmp.R[i] >= 0) { g.R[i] = tmp.R[i]; g.L[i] = tmp.L[i]; }
}
// Skyltens ritning för granskningssidan (prototypes/enemies-v4).
export const plateFor = (style) => PLATE[style];
export const PLATE_SIZE = [PW, PH];
