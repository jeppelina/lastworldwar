// Striden så som den ser ut: scen, animationer, effekter och knappar.
// Reglerna (skada, turordning, fiendens nedräkning, superattack, belöningar, stjärnor) ligger i rules.js,
// som också simulatorn i sim/ kör. Ändra siffror där, inte här.
import { G, ramp } from './pixel.js';
import { drawHero, drawPet, drawShield, HOLD, weaponLen, tierOf, heldShield, arrowLook } from './hero.js';
import { BY_ID, heroStats } from './catalog.js';
import * as R from './rules.js';
import { pic } from './pics.js';
import { looks } from './skills.js';
import * as SFX from './skillfx.js';
import * as MB from './miniboss.js';

const BIOMES = ['forest', 'desert', 'swamp', 'ice', 'volcano', 'cloud'];
const SHADOW = ramp('#1d1b2e'), WHITE = ramp('#ffffff'), DUST = ramp('#cdbb9a'), SPARK = ramp('#ffd84a'), RED = ramp('#e2473d');
const lerp = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const bump = (p) => Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
const dash = (p, D, a = 0.35, b = 0.6) => (p < a ? D * ease(p / a) : p < b ? D : D * (1 - ease((p - b) / (1 - b))));
const seg = (p, a, b) => (p - a) / (b - a);

// ---------- Konst från agentfilerna, med enkel reserv om de saknas ----------
let ROSTER = null, BD = null;
const FALLBACK = [1, 2, 3, 'boss'].map((tier, i) => ({
  id: 'slime' + i, name: tier === 'boss' ? 'Jätteslemmet' : 'Slem', world: -1, tier, h: tier === 'boss' ? 140 : 14 + i * 8, w: tier === 'boss' ? 150 : 20 + i * 8, count: tier === 2 ? 4 : 1, fly: false,
  draw(g, t, pose) { const k = this.h / 14, q = Math.abs(Math.sin(t * 3)) * 2 * k; g.begin(); g.ell(0, -6 * k + q / 2, 9 * k + q / 2, 7 * k - q / 2, ramp(['#58c26d', '#4aa3d8', '#c25a8a', '#8a5ad0'][i])); g.rect(-5 * k, -9 * k, 2 * k, 3 * k, SHADOW, 0); g.rect(0, -9 * k, 2 * k, 3 * k, SHADOW, 0); g.end(); },
}));
export async function loadArt() {
  try { ROSTER = (await import('./enemies.js')).ROSTER; } catch (e) { ROSTER = null; }
  try { BD = await import('./backdrops.js'); } catch (e) { BD = null; }
  if (!ROSTER || !ROSTER.length) ROSTER = FALLBACK;
  return { enemies: ROSTER.length, backdrops: !!BD };
}
export const roster = () => ROSTER;

// ---------- Banans strider (reglerna står i rules.js) ----------
// army (valfri): kejsarens armé ur berättelsen, se armyFor i story.js och buildRun i rules.js. Utan den är allt som förut.
// mini (valfri): världens miniboss kan bli sista striden (K.miniboss, miniFight i rules.js). null = aldrig.
export const buildRun = (worldIdx, nodeIdx, node, army = null, mini = null) => R.buildRun(worldIdx, nodeIdx, node, ROSTER, Math.random, army, mini);
// Minibossar i vanliga banor med sannolikheten i balance.js. o.mini === false stänger av dem. För prov i webbläsaren:
// globalThis.LV_MINI = 1 ger en miniboss i varje bana som kan ha en (bara i minnet, sparas aldrig).
const miniOdds = (o) => (o.mini === false || !R.K.miniboss ? null : typeof globalThis.LV_MINI === 'number' ? { chance: globalThis.LV_MINI } : {});

// ---------- Attacker: en per vapentyp. pose(p, D) ger hjältens läge, events avfyras när p passerar "at".
// hit = vilken av vapnets träffar i WEAPON_RULES (rules.js) som landar. Skadan och hur många som träffas står där. ----------
const swingArc = (rest, p, up, down, a = 0.3, b = 0.5) => (p < a ? lerp(rest, up, ease(seg(p, 0, a))) : p < b ? lerp(up, down, seg(p, a, b)) : p < 0.75 ? down : lerp(down, rest, seg(p, 0.75, 1)));
export const ATTACKS = {      // exporteras för provscenen på fliken Powers (skill-stage.js)
  none: { dur: 0.6, ev: [{ at: 0.5, hit: 0 }], pose: (p, D) => ({ dx: dash(p, D), hand: [p > 0.42 && p < 0.6 ? 7 : 0, -2] }) },
  dagger: { dur: 0.8, ev: [{ at: 0.4, hit: 0 }, { at: 0.56, hit: 1 }], pose: (p, D) => ({ dx: dash(p, D, 0.3, 0.68), wAng: 1.5, hand: [(p > 0.36 && p < 0.45) || (p > 0.52 && p < 0.61) ? 8 : 0, -3] }) },
  club: { dur: 0.8, ev: [{ at: 0.5, hit: 0, fx: 'dust' }], pose: (p, D) => ({ dx: dash(p, D), wAng: swingArc(0.55, p, -1.1, 2.0) }) },
  sword: { dur: 0.8, ev: [{ at: 0.5, hit: 0, fx: 'slash' }], pose: (p, D) => ({ dx: dash(p, D), wAng: swingArc(0.42, p, -1.0, 2.1) }) },
  axe: { dur: 0.95, ev: [{ at: 0.5, hit: 0, fx: 'slash' }], pose: (p, D) => ({ dx: dash(p, D, 0.3, 0.65), wAng: 0.35 + (p < 0.2 ? 0 : p < 0.6 ? seg(p, 0.2, 0.6) * (Math.PI * 2 + 1.6) : (1 - seg(p, 0.6, 1)) * 1.6) }) },
  spear: { dur: 0.75, ev: [{ at: 0.45, hit: 0, fx: 'slash' }], pose: (p, D) => ({ dx: dash(p, D - 12, 0.3, 0.58), wAng: 1.5, hand: [p > 0.38 && p < 0.56 ? 11 : -4, -4] }) },
  hammer: { dur: 1.05, shake: 6, ev: [{ at: 0.6, hit: 0, fx: 'shock' }], pose: (p, D) => ({ dx: dash(p, D, 0.5, 0.74), dy: p < 0.6 ? -bump(p / 0.6) * 26 : 0, wAng: p < 0.45 ? lerp(0.3, -1.3, ease(p / 0.45)) : p < 0.6 ? lerp(-1.3, 2.3, seg(p, 0.45, 0.6)) : p < 0.78 ? 2.3 : lerp(2.3, 0.3, seg(p, 0.78, 1)) }) },
  great: { dur: 1.15, shake: 8, ev: [{ at: 0.62, hit: 0, fx: 'bigslash' }], drag: true, pose: (p, D, w) => { const dg = dragAng(w); return { dx: dash(p, D, 0.45, 0.76), wAng: p < 0.12 ? lerp(0.3, dg, ease(p / 0.12)) : p < 0.45 ? dg : p < 0.62 ? lerp(dg, 2.15, seg(p, 0.45, 0.62)) : p < 0.8 ? 2.15 : lerp(2.15, 0.3, seg(p, 0.8, 1)) }; } },   // vilar upprätt (HOLD.great = 0.3) och svingar därifrån
  staff: { dur: 1.1, ev: [{ at: 0.5, shoot: { r: 5, dur: 0.3, from: 'tip' } }, { at: 0.8, hit: 0, fx: 'boom' }], charge: { from: 0.08, to: 0.5, r0: 1, r1: 5, at: 'tip' }, pose: (p) => ({ wAng: p < 0.5 ? lerp(0.12, -0.35, ease(p / 0.5)) : p < 0.6 ? lerp(-0.35, 0.9, seg(p, 0.5, 0.6)) : lerp(0.9, 0.12, seg(p, 0.6, 1)), hand: [0, p < 0.5 ? -4 * ease(p / 0.5) : 0] }) },
  orb: { dur: 1.45, shake: 5, ev: [{ at: 0.62, shoot: { r: 15, dur: 0.26, from: 'over' } }, { at: 0.88, hit: 0, fx: 'bigboom' }], charge: { from: 0.05, to: 0.62, r0: 3, r1: 15, at: 'over' }, pose: (p) => ({ wAng: 0, noW: p > 0.05 && p < 0.95, hand: [p < 0.62 ? 0 : 5, p < 0.62 ? -9 * ease(p / 0.3) : -3] }) },
  bow: { dur: 0.85, ev: [{ at: 0.42, shoot: { arrow: true, dur: 0.18, from: 'hand' } }, { at: 0.6, hit: 0, fx: 'slash' }], pose: (p) => ({ wAng: 0, hand: [p < 0.42 ? 3 - 3 * ease(p / 0.42) : 4, -5] }) },
  // Kastknivar (v20): tre snabba kast med handleden, knivarna flyger rakt. Varje kniv är en av de tre träffarna i WEAPON_RULES.
  knives: { dur: 0.95, ev: [0.34, 0.45, 0.56].flatMap((at, i) => [{ at, shoot: { knife: true, dur: 0.12, from: 'hand' } }, { at: at + 0.12, hit: i, fx: i === 2 ? 'slash' : undefined }]),
    pose: (p) => { const f = [0.34, 0.45, 0.56].some((e) => p > e - 0.08 && p < e); return { wAng: f ? 1.4 : 0.3, hand: [f ? 7 : p > 0.2 && p < 0.68 ? -1 : 0, -5] }; } },
  // Kaststjärnor (v21): två kast, stjärnan snurrar rakt genom de två främsta (pierce). Handen är tom en stund efter varje kast.
  stars: { dur: 1, ev: [0.36, 0.58].flatMap((at, i) => [{ at, shoot: { star: true, pierce: true, dur: 0.18, from: 'hand' } }, { at: at + 0.18, hit: i, fx: i === 1 ? 'slash' : undefined }]),
    pose: (p) => { const f = [0.36, 0.58].some((e) => p > e - 0.1 && p < e); return { wAng: 0, noW: [0.36, 0.58].some((e) => p >= e && p < e + 0.12), hand: [f ? 8 : p > 0.18 && p < 0.72 ? -3 : 0, f ? -7 : -4] }; } },
};
// ---------- Steg 4 (v22): tvåhandsvapen och nya kastvapen. Närmaste handen följer greppet på tvåhandsvapnen (hero.js TWO). ----------
Object.assign(ATTACKS, {
  // Katana: kort laddning, ett blixtsnabbt språng förbi fienden (streak = vita streck efter hjälten), tre vita snitt efteråt.
  katana: { dur: 1.25, streak: [0.18, 0.36], ev: [0.5, 0.57, 0.64].map((at, i) => ({ at, hit: i, fx: 'cut' })),
    pose: (p, D, w, ew = 30) => {
      const past = D + 24 + ew * 0.55 + 22, dx = p < 0.18 ? -4 * ease(p / 0.18) : p < 0.34 ? lerp(-4, past, ease(seg(p, 0.18, 0.34))) : p < 0.72 ? past : lerp(past, 0, ease(seg(p, 0.72, 1)));
      const wAng = p < 0.18 ? lerp(0.62, -0.9, ease(p / 0.18)) : p < 0.34 ? lerp(-0.9, 2.3, seg(p, 0.18, 0.34)) : p < 0.72 ? 2.3 : lerp(2.3, 0.62, seg(p, 0.72, 1));
      return { dx, dy: p > 0.18 && p < 0.34 ? 2 : 0, wAng, hand: [p > 0.18 && p < 0.72 ? 4 : 0, -3] };
    } },
  // Stridsyxa: tar sats bakåt och svingar ett helt varv (2 pi) innan bladet landar på de tre främsta.
  greataxe: { dur: 1.2, shake: 7, ev: [{ at: 0.6, hit: 0, fx: 'bigslash' }], pose: (p, D) => ({ dx: dash(p, D, 0.4, 0.76), dy: p > 0.25 && p < 0.6 ? -bump(seg(p, 0.25, 0.6)) * 6 : 0,
    wAng: p < 0.22 ? lerp(0.25, -1.3, ease(p / 0.22)) : p < 0.6 ? lerp(-1.3, 2 + Math.PI * 2, ease(seg(p, 0.22, 0.6))) : p < 0.76 ? 2 : lerp(2, 0.25, seg(p, 0.76, 1)) }) },
  // Kastspjut: kastas i en flack båge, sticker i fienden en stund och flyger tillbaka till handen (handen är tom så länge).
  javelin: { dur: 1.25, ev: [{ at: 0.3, shoot: { javelin: true, dur: 0.2, stay: 0.28, back: 0.2, from: 'hand' } }, { at: 0.3 + 0.2 / 1.25, hit: 0, fx: 'slash' }],
    pose: (p) => ({ wAng: p < 0.3 ? lerp(0.18, -0.5, ease(p / 0.3)) : 1.45, noW: p >= 0.3 && p < 0.84, hand: [p < 0.3 ? -6 * ease(p / 0.3) : p < 0.4 ? 9 : p > 0.84 ? 2 : 0, p < 0.3 ? -6 : -3] }) },
  // Armborst: siktar, bulten går rakt genom de två främsta (pierce), rekyl bakåt. Bulten har pilarnas effekter (arrowLook).
  crossbow: { dur: 1, ev: [{ at: 0.45, shoot: { arrow: true, bolt: true, pierce: true, dur: 0.12, from: 'tip' } }, { at: 0.57, hit: 0, fx: 'slash' }],
    pose: (p) => ({ wAng: 1.57, hand: [p < 0.3 ? 3 * ease(p / 0.3) : 3, -6], dx: p > 0.45 && p < 0.75 ? -bump(seg(p, 0.45, 0.75)) * 5 : 0 }) },
  // Bomb: lobbas i en hög båge, smäll med rök och gnistor över alla. Smällen växer med materialet.
  bomb: { dur: 1.2, shake: 6, ev: [{ at: 0.32, shoot: { bomb: true, dur: 0.42, from: 'hand' } }, { at: 0.32 + 0.42 / 1.2, hit: 0, fx: 'bomb' }],
    pose: (p) => ({ wAng: 0, noW: p >= 0.32 && p < 0.85, hand: [p < 0.32 ? -5 * ease(p / 0.32) : p < 0.42 ? 7 : 0, p < 0.32 ? -9 * ease(p / 0.32) : -4] }) },
  // Hillebard: lång stöt framåt, sedan ett hugg med kroken över de två främsta.
  halberd: { dur: 1.15, shake: 4, ev: [{ at: 0.66, hit: 0, fx: 'bigslash' }], pose: (p, D) => ({ dx: dash(p, D - 16, 0.3, 0.78),
    wAng: p < 0.3 ? lerp(0.08, 1.45, ease(p / 0.3)) : p < 0.44 ? 1.45 : p < 0.54 ? lerp(1.45, 0.05, ease(seg(p, 0.44, 0.54))) : p < 0.66 ? lerp(0.05, 2.1, seg(p, 0.54, 0.66)) : p < 0.8 ? 2.1 : lerp(2.1, 0.08, seg(p, 0.8, 1)),
    hand: [p > 0.3 && p < 0.44 ? 12 : p > 0.44 && p < 0.6 ? -2 : 0, p > 0.44 && p < 0.6 ? -8 : -4] }) },
  // Steg 5 (v23). Jättesvärdet: hopp högt upp och ett slag rakt ned, chockvåg längs marken, stor skakning.
  giantblade: { dur: 1.3, shake: 11, ev: [{ at: 0.6, hit: 0, fx: 'quake' }], pose: (p, D) => ({ dx: dash(p, D, 0.42, 0.78), dy: p < 0.1 ? 0 : p < 0.45 ? -34 * ease(seg(p, 0.1, 0.45)) : p < 0.6 ? -34 * (1 - seg(p, 0.45, 0.6)) : 0,
    wAng: p < 0.15 ? lerp(-1.0, -0.3, ease(p / 0.15)) : p < 0.45 ? lerp(-0.3, -0.9, seg(p, 0.15, 0.45)) : p < 0.6 ? lerp(-0.9, 2.2, ease(seg(p, 0.45, 0.6))) : p < 0.8 ? 2.2 : lerp(2.2, -1.0, seg(p, 0.8, 1)), hand: [0, p > 0.15 && p < 0.6 ? -8 : 0] }) },
  // Jättehammaren: som hammaren men större, marken spricker under alla fiender.
  gianthammer: { dur: 1.35, shake: 12, ev: [{ at: 0.62, hit: 0, fx: 'quake' }], pose: (p, D) => ({ dx: dash(p, D, 0.5, 0.78), dy: p < 0.62 ? -bump(p / 0.62) * 30 : 0,
    wAng: p < 0.45 ? lerp(-0.9, -1.5, ease(p / 0.45)) : p < 0.62 ? lerp(-1.5, 2.3, seg(p, 0.45, 0.62)) : p < 0.8 ? 2.3 : lerp(2.3, -0.9, seg(p, 0.8, 1)), hand: [0, p > 0.1 && p < 0.62 ? -6 : 0] }) },
});
// Kastvapen (v21, v22): skotten får materialets spår och träff som pilarna (arrowTrail, arrowHit), bara utseende.
const THROWN = { knives: 1, stars: 1, javelin: 1, bomb: 1 };

// Storsvärdets vinkel när det släpas: spetsen mot marken. Vapnets längd beror på materialet (v3), så vinkeln räknas ur
// längden (handen är 16,5 pixlar över marken). Utan vapen (provscenen) som förut.
const dragAng = (w) => (w ? -Math.acos(Math.max(-1, Math.min(1, -16.5 / weaponLen(w)))) : -2.08);

// ---------- Materialets effekter i striden (utrustning v3, bara utseende: skadan, tiderna och reglerna är desamma) ----------
// Vapen av Ice, Fire, Shadow, Crystal och Star får ett spår under slaget, en egen träff och en egen superattack:
//   Fire     glöd som följer spetsen, glöd och lågor på fienden
//   Ice      snöflingor efter spetsen, iskristaller och en kort frost över fienden
//   Shadow   en rökstrimma efter hjältens språng, rökpuffar och en kort skugga över fienden
//   Crystal  glitter efter spetsen, skärvor som splittras ut
//   Star     glimtar efter spetsen, stjärnor vid träffen och ett stjärnregn över fienden på superattacken
// Följeslagare av Ice och uppåt följer med i superattacken (flyger fram och träffar med sitt material).
// Skillträdet går före: bär hjälten ett spår (nivå 3) ritas varken materialets spår eller dess träffgnistor, och bär hjälten
// en superattack (nivå 5) blir det inget stjärnregn. Fiendens frost och skugga ritas ändå (ett annat lager än gnistorna).
export const MATFX = { is: 'ice', eld: 'fire', skugg: 'shadow', kristall: 'crystal', stjarn: 'star' };
const MC = { ice: ramp('#bff0ff'), fire: ramp('#ff7a1f'), fire2: ramp('#ffd84a'), smoke: ramp('#3a3260'), vio: ramp('#9a6bff'), pink: ramp('#ee7fd8'), night: ramp('#2e2a5c') };
const rr = (a, b) => a + Math.random() * (b - a);
const mf = (t, now, dur, x, y, o = {}) => ({ kind: 'mf', t, t0: now, dur, x, y, vx: 0, vy: 0, ...o });
// Spåret: anropas varje bildruta medan hjälten slår. tip = vapnets spets, body = hjältens mitt, dash = hjälten är i språng.
export function matTrail(fx, kind, tip, body, now, dash) {
  if (!kind || !tip) return;
  if (kind === 'fire') fx.push(mf('ember', now, rr(0.3, 0.5), tip[0] + rr(-2, 2), tip[1] + rr(-2, 2), { vx: rr(-15, 5), vy: rr(-30, -12) }));
  else if (kind === 'ice') { if (Math.random() < 0.6) fx.push(mf('flake', now, rr(0.4, 0.6), tip[0] + rr(-3, 3), tip[1] + rr(-3, 3), { vx: rr(-8, 4), vy: rr(6, 16) })); }
  else if (kind === 'crystal' || kind === 'star') { if (Math.random() < 0.55) fx.push(mf('star', now, rr(0.25, 0.4), tip[0] + rr(-3, 3), tip[1] + rr(-3, 3), { s: 1, rp: kind === 'star' ? MC.fire2 : MC.pink })); }
  else if (kind === 'shadow' && dash && body && Math.random() < 0.7) fx.push(mf('puff', now, rr(0.35, 0.55), body[0] + rr(-8, 2), body[1] + rr(-14, 12), { r: rr(2, 4) }));
}
// Träffen. x, y = träffpunkten, h = fiendens höjd, sup = superattacken (större), burst = gnistorna ritas (inte under ett skillspår).
export function matHit(fx, kind, x, y, now, { sup = false, burst = true, h = 20 } = {}) {
  if (!kind) return null;
  const n = sup ? 2 : 1;
  if (burst) {
    if (kind === 'fire') { for (let i = 0; i < 10 * n; i++) fx.push(mf('ember', now, rr(0.4, 0.8), x + rr(-6, 6), y + rr(-6, 6), { vx: rr(-30, 30), vy: rr(-55, -15) })); for (let i = 0; i < 3 + 2 * n; i++) fx.push(mf('flame', now + i * 0.04, rr(0.35, 0.55), x + rr(-h * 0.35, h * 0.35), y + h * 0.45, { s: rr(3, 5) * (sup ? 1.4 : 1) })); }
    else if (kind === 'ice') { for (let i = 0; i < 3 * n; i++) fx.push(mf('crys', now + i * 0.05, 0.4, x + rr(-h * 0.3, h * 0.3), y + rr(-h * 0.3, h * 0.3), { s: rr(3, 5) * (sup ? 1.5 : 1) })); for (let i = 0; i < 8 * n; i++) fx.push(mf('flake', now, rr(0.4, 0.7), x, y, { vx: rr(-40, 40), vy: rr(-40, 10) })); }
    else if (kind === 'shadow') for (let i = 0; i < 6 * n; i++) { const a = i / (6 * n) * 6.283; fx.push(mf('puff', now, rr(0.4, 0.6), x + Math.cos(a) * 3, y + Math.sin(a) * 3, { vx: Math.cos(a) * 30, vy: Math.sin(a) * 20, r: rr(2.5, 4.5) })); }
    else if (kind === 'crystal') for (let i = 0; i < 10 * n; i++) { const a = rr(0, 6.283), v = rr(40, 90); fx.push(mf('shard', now, rr(0.35, 0.6), x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 25, rp: i % 3 ? MC.pink : WHITE })); }
    else if (kind === 'star') for (let i = 0; i < 5 * n; i++) { const a = rr(0, 6.283), v = rr(20, 60); fx.push(mf('star', now + i * 0.03, rr(0.35, 0.55), x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: sup ? 3 : 2, rp: MC.fire2 })); }
  }
  // fiendens färg en kort stund (frost, skugga). Fire får lågorna ovan i stället.
  return kind === 'ice' ? { rp: MC.ice, t0: now, until: now + (sup ? 0.9 : 0.55) } : kind === 'shadow' ? { rp: MC.night, t0: now, until: now + (sup ? 0.7 : 0.4) } : null;
}
// Star-superattackens stjärnregn: stjärnor faller över fienden och landar när slaget träffar (until = sekunder dit).
export function matSuper(fx, kind, x, y, now, until) {
  if (kind !== 'star') return;
  for (let i = 0; i < 12; i++) { const d = Math.max(0.15, until - 0.05 - i * 0.03), ox = rr(-22, 22); fx.push(mf('fall', now + i * 0.03, d, x + ox - 30, y - 70, { x1: x + ox * 0.4, y1: y + rr(-8, 8), s: i % 3 ? 2 : 3 })); }
}
// Ritar en effekt (kind 'mf'). q = förloppet 0..1, tt = sekunder sedan start. Anropas mellan begin och en platt end.
export function drawMatFx(g, e, q, tt) {
  const X = Math.round(e.x + e.vx * tt), Y = Math.round(e.y + e.vy * tt);
  if (e.t === 'ember') { const x = Math.round(X + Math.sin(tt * 18 + e.x) * 1.2); g.set(x, Y, q < 0.35 ? MC.fire2 : MC.fire, q < 0.6 ? 5 : 3); if (q < 0.3) g.set(x, Y + 1, MC.fire, 4); }
  else if (e.t === 'flake') { const yy = Math.round(e.y + e.vy * tt + 20 * tt * tt); g.set(X, yy, WHITE, 5); if (q < 0.6) { g.set(X - 1, yy, MC.ice, 4); g.set(X + 1, yy, MC.ice, 4); g.set(X, yy - 1, MC.ice, 4); g.set(X, yy + 1, MC.ice, 4); } }
  else if (e.t === 'crys') {                                     // iskristall med sex armar som växer och smälter
    const L = Math.round(e.s * Math.sin(Math.min(1, q * 1.6) * Math.PI / 2) * (q > 0.7 ? (1 - q) / 0.3 : 1));
    for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; for (let j = 0; j <= L; j++) g.set(Math.round(X + Math.cos(a) * j), Math.round(Y + Math.sin(a) * j), j === L ? WHITE : MC.ice, 5); }
  }
  else if (e.t === 'puff') { const r = (e.r || 3) * (0.6 + q * 0.8); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r && ((Math.round(dx) + Math.round(dy) + (q > 0.5 ? 1 : 0)) & 1 || q < 0.4)) g.set(Math.round(X + dx), Math.round(Y + dy - q * 4), dx * dx + dy * dy > r * r * 0.5 ? MC.smoke : MC.vio, q < 0.5 ? 2 : 1); }
  else if (e.t === 'shard') { const yy = Math.round(e.y + e.vy * tt + 90 * tt * tt), k = Math.floor(tt * 20) % 2; g.set(X, yy, e.rp, 5); g.set(X + (k ? 1 : 0), yy + (k ? 0 : 1), e.rp, 3); if (q < 0.5) g.set(X - (k ? 1 : 0), yy - (k ? 0 : 1), WHITE, 5); }
  else if (e.t === 'star' || e.t === 'fall') {
    let x = X, y = Y, k = Math.round((e.s || 2) * Math.sin(q * Math.PI));
    if (e.t === 'fall') { x = Math.round(lerp(e.x, e.x1, q * q)); y = Math.round(lerp(e.y, e.y1, q * q)); k = e.s; for (let j = 1; j < 5; j++) g.set(x - j * 2 + (j & 1), y - j * 2 - (j & 1), j < 3 ? MC.fire2 : WHITE, j < 3 ? 5 : 3); }
    g.set(x, y, WHITE, 5); for (let j = 1; j <= k; j++) { const c = j === 1 ? WHITE : e.rp || MC.fire2; g.set(x + j, y, c, 5); g.set(x - j, y, c, 5); g.set(x, y + j, c, 5); g.set(x, y - j, c, 5); }
  }
  else if (e.t === 'flame') { const h = Math.round(e.s * Math.sin(Math.min(1, q * 1.3) * Math.PI)), f = Math.floor(tt * 14) % 2; for (let j = 0; j < h; j++) { const w = Math.max(0, Math.round((h - j) / 3)); for (let dx = -w; dx <= w; dx++) g.set(X + dx + (j > h / 2 ? f : 0), Y - j, j < h / 3 ? MC.fire2 : MC.fire, j < h / 3 ? 5 : 4); } }
}
// Fiendens färg efter träffen: pixlarna som fienden just ritade (jämfört med ögonblicksbilden) färgas om, varannan pixel
// medan färgen bleknar. Hjälten och bakgrunden rörs inte.
let TS = null;
export function tintSnap(g, x0, y0, x1, y1) {
  const w = x1 - x0 + 1, h = y1 - y0 + 1; if (w <= 0 || h <= 0) return null;
  if (!TS || TS.R.length < w * h) TS = { R: new Int16Array(w * h), L: new Int8Array(w * h) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const X = x0 + x, Y = y0 + y, j = y * w + x; if (X < 0 || Y < 0 || X >= g.w || Y >= g.h) { TS.R[j] = -2; continue; } const i = Y * g.w + X; TS.R[j] = g.R[i]; TS.L[j] = g.L[i]; }
  return { x0, y0, w, h };
}
export function tintApply(g, sn, rp, q) {
  if (!sn) return;
  for (let y = 0; y < sn.h; y++) for (let x = 0; x < sn.w; x++) {
    const j = y * sn.w + x; if (TS.R[j] === -2) continue; const i = (sn.y0 + y) * g.w + sn.x0 + x;
    if (g.R[i] < 0 || (g.R[i] === TS.R[j] && g.L[i] === TS.L[j]) || g.L[i] === 0) continue;
    if (q > 0.5 && (x + y) & 1) continue;                       // bleknar: varannan pixel
    g.R[i] = rp; g.L[i] = Math.max(2, g.L[i]);
  }
}

// ---------- Pilarna (v20): fler effekter för varje material, bara utseende ----------
// al = arrowLook(båge, koger) ur hero.js: t = materialsteget, mat, hex och fjädrarnas färg.
//   Wooden   en enkel pil: träskaft, trubbig träspets, vita fjädrar
//   Iron     järnspets och röda fjädrar
//   Steel    spets och fjädrar i materialet, ett kort glödspår och en liten glöd vid träffen
//   Golden   längre glödspår med gnistor, spetsen blänker, större glöd vid träffen
//   Emerald  gröna gnistor i spåret och en krans av ädelstensglimtar vid träffen
//   Ice      isspets, spår av snöflingor, iskristaller och frost på fienden (matHit)
//   Fire     brinnande pil, spår av glöd och lågor, eldsmäll vid träffen
//   Shadow   svart pil i en strimma rök, rökpuffar och skugga på fienden
//   Crystal  kristallspets, glitter i spåret, skärvor som splittras ut
//   Star     komet: lysande huvud och en lång svans av stjärnor, stjärnor vid träffen
// Spåret blir tätare och längre för varje steg. Skadan, tiderna och reglerna är desamma som för en vanlig pil.
const AC = { wood: ramp('#9a6b3f'), iron: ramp('#6b7384'), red: ramp('#d8433b') };
function drawArrow(g, al, x, y, an, now, bolt = false) {        // bolt (v22): armborstets kortare bult med samma effekter
  const t = al ? al.t : 0, m = al ? ramp(al.hex) : WHITE, fl = al ? ramp(al.fletch) : WHITE, L = (bolt ? 5 : 9) + Math.min(3, t * 0.4);
  g.push(x, y, an);
  if (t >= 9) { g.ell(4, 0, 3.2, 3.2, MC.fire2); g.ell(4, 0, 1.6, 1.6, WHITE, false, null, 5); }                             // kometens huvud
  g.thick(-L, 0, 2, 0, 1.6, t === 7 ? MC.smoke : t >= 2 ? DUST : AC.wood, 3);
  const head = t === 0 ? AC.wood : t === 1 ? AC.iron : t === 5 ? MC.ice : m;
  if (t === 5) g.poly([[1, -2], [8, 0], [1, 2], [3, 0]], head, 5);                                                            // isspets
  else if (t === 8) g.poly([[1, 0], [4, -2.5], [8, 0], [4, 2.5]], head, 5);                                                   // kristall
  else g.poly([[2, -2.5], [t === 0 ? 5.5 : 7, 0], [2, 2.5]], head, t >= 2 ? 5 : 4);
  if (t === 6) { const f = Math.floor(now * 14) % 2; g.poly([[2, -1.5], [-2 - f, -3.5], [-5, 0], [-2 + f, 3], [2, 1.5]], MC.fire, 4); g.poly([[2, -0.8], [-1, -1.5], [-2, 0], [2, 0.8]], MC.fire2, 5); }   // lågan längs skaftet
  g.poly([[-L, -2], [-L + 3, 0], [-L, 2]], fl, 4); if (t >= 4) g.poly([[-L - 2, -3], [-L + 1, 0], [-L - 2, 3]], fl, 3);       // fjädrar, dubbla från Emerald
  if (t >= 3 && Math.floor(now * 10) % 2) g.dot(5, -1, WHITE, 5);                                                                // blänk i spetsen
  g.pop();
}
function arrowTrail(fx, al, x, y, an, now) {
  const t = al ? al.t : 0, bx = x - Math.cos(an) * 10, by = y - Math.sin(an) * 10, m = al ? ramp(al.hex) : WHITE;
  if (t < 2) { if (Math.random() < 0.3) fx.push({ kind: 'p', t0: now, dur: 0.15, x: bx, y: by, vx: -10, vy: 0, rp: DUST, lv: 3 }); return; }
  const n = 2 + Math.floor(t / 2), len = 6 + t * 1.6;                                                                       // spåret blir tätare och längre för varje steg
  for (let i = 0; i < n; i++) {
    const d = 0.25 + t * 0.04, u = (i + Math.random()) / n, jx = bx - Math.cos(an) * u * len, jy = by - Math.sin(an) * u * len + rr(-1, 1) * Math.min(3, t * 0.4);
    if (t <= 3) fx.push({ kind: 'p', t0: now, dur: d, x: jx, y: jy, vx: -8, vy: rr(-4, 4), rp: i % 2 && t === 3 ? SPARK : m, lv: 5 });
    else if (t === 4) fx.push(i % 2 ? mf('star', now, d, jx, jy, { s: 1, rp: m }) : { kind: 'p', t0: now, dur: d, x: jx, y: jy, vx: -8, vy: rr(-4, 4), rp: m, lv: 5 });
    else if (t === 5) fx.push(mf('flake', now, d + 0.15, jx, jy, { vx: rr(-10, 0), vy: rr(2, 10) }));
    else if (t === 6) fx.push(i % 2 ? mf('flame', now, 0.3, jx, jy + 2, { s: 3 }) : mf('ember', now, d + 0.1, jx, jy, { vx: rr(-15, 0), vy: rr(-25, -8) }));
    else if (t === 7) fx.push(mf('puff', now, d + 0.2, jx, jy, { r: rr(1.5, 3), vx: rr(-8, 0), vy: rr(-6, 2) }));
    else if (t === 8) fx.push(mf('star', now, d, jx, jy, { s: 1, rp: i % 2 ? MC.pink : WHITE }));
    else fx.push(mf('star', now, d + 0.15, jx, jy, { s: i % 2 ? 2 : 3, rp: i % 3 ? MC.fire2 : WHITE }));                     // kometens svans
    if (t >= 5 && i % 2 === 0) fx.push({ kind: 'p', t0: now, dur: d, x: jx, y: jy, vx: -6, vy: 0, rp: t === 7 ? MC.vio : t === 9 ? MC.fire2 : m, lv: 5 });   // en lysande kärna i spåret
  }
}
// Kaststjärnan i luften (v21): fyra uddar, sex från Golden, snurrar fort. Spåret och träffen kommer från pilarnas regler.
function drawStarShot(g, al, m, x, y, now) {
  const t = al ? al.t : 0, n = t >= 3 ? 6 : 4, r = 4 + Math.min(2, t * 0.25);
  g.push(x, y, now * 22);
  for (let i = 0; i < n; i++) { g.push(0, 0, i * 6.283 / n); g.poly([[-1.5, 0], [0, -r], [1.5, 0]], m, i % 2 ? 3 : 5); g.pop(); }
  g.ell(0, 0, 1.3, 1.3, t >= 5 ? WHITE : DUST); g.pop();
}
// Glöden vid träffen för Steel, Golden och Emerald (från Ice tar materialets egen träff över, matHit, och blir större).
function arrowHit(fx, al, x, y, now, sup) {
  const t = al.t, m = ramp(al.hex), n = (4 + t * 2) * (sup ? 2 : 1);
  if (t >= 2 && t <= 4) for (let i = 0; i < n; i++) { const a = i / n * 6.283, v = 20 + t * 8; fx.push(t === 4 && i % 2 ? mf('star', now, 0.35, x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 1, rp: m }) : { kind: 'p', t0: now, dur: 0.3, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 10, rp: t === 3 && i % 3 ? SPARK : m, lv: 5 }); }
  if (t >= 6) for (let i = 0; i < t - 4; i++) { const a = rr(0, 6.283); fx.push(mf(t === 6 ? 'flame' : t === 7 ? 'puff' : 'star', now + i * 0.03, 0.4, x + Math.cos(a) * 6, y + Math.sin(a) * 4, { s: 3, r: 3, rp: t === 8 ? MC.pink : MC.fire2, vx: Math.cos(a) * 20, vy: Math.sin(a) * 10 })); }   // extra för varje steg från Fire
}

// ---------- Hjälten parerar när fienden slår (bara utseende: skadan, tiderna och reglerna är desamma) ----------
// Vapnets vinkel i en parad: [hög, låg] (0 = rakt upp, positivt = framåt). Båge, klot och tomma händer saknas här: då viker
// hjälten undan och tar emot slaget i stället. Skölden lyfts med a.guard i hero.js (närmaste handen och skölden flyttas).
const GUARD = { dagger: [1.7, 2.1], club: [0.85, 1.45], sword: [0.95, 1.55], axe: [0.7, 1.35], spear: [0.55, 1.25], hammer: [0.25, 1.0], staff: [1.35, 1.0], great: [0.2, 0.9],
  katana: [0.6, 1.3], greataxe: [0.3, 1.0], halberd: [0.15, 0.9], javelin: [0.55, 1.25],      // steg 4 (v22)
  giantblade: [0.2, 0.9], gianthammer: [0.25, 1.0] };                                         // steg 5 (v23)
// Hur mycket hjälten har lyft parad (0..1) under fiendens slag (p = 0..1, slaget landar vid 0,5) och stöten efter träffen.
const guardUp = (p) => (p < 0.2 ? 0 : p < 0.42 ? ease(seg(p, 0.2, 0.42)) : p < 0.66 ? 1 : p < 0.94 ? 1 - ease(seg(p, 0.66, 0.94)) : 0);
const guardJolt = (p) => (p > 0.5 ? bump(Math.min(1, seg(p, 0.5, 0.8))) : 0);

export class Battle {
  // el: tomt element. o: { profile, worldIdx, nodeIdx, node (med rec och ease), words, play(url), onEnd(result),
  //   rewardMult (avtrappningen: andel av fiendernas guld som delas ut, bara för siffran som flyger upp),
  //   bossFor(striden, bossens post i ROSTER) -> BossFight eller null: bossar med egen mekanik (boss/index.js). Finns en
  //   sådan (this.bf) tar den över bosstriden: uppgifterna, stenraden, fasbytena, segern och förlusten. Övriga bossar går som förut.
  //   onBook() (valfri): bokknappen i scenen visas och anropar den. bookCount() -> talet i knappens märke (nya ord kvar).
  //   power, powerMult: Power start. Första rätta svaret slår powerMult gånger skadan (bara skadan, inget i ordboken). }
  // Striden kan vänta (pause, resume) medan boken är öppen: klockan som animationerna går efter står då still, och
  // väntetider som går ut under tiden körs först när striden fortsätter (later, hold). Bossar med egen mekanik har egna
  // väntetider och pausas aldrig: bokknappen finns inte i bossbanor.
  constructor(el, o) {
    Object.assign(this, o); this.el = el;
    this.gear = Object.fromEntries(Object.entries(o.profile.eq).filter(([, id]) => id && BY_ID[id]).map(([k, id]) => [k, BY_ID[id]]));      // okända id (nyare klient) hoppas över
    // run = regeltillståndet (liv, strid, rad, guld, xp). Scenen lägger bara till det som behövs för att rita.
    this.run = R.newRun(heroStats(o.profile), buildRun(o.worldIdx, o.nodeIdx, o.node, o.army || null, miniOdds(o)));
    this.hero = Object.assign(this.run.hero, { flashUntil: 0, hurtAt: -9 });
    this.fx = []; this.anim = null; this.phase = 'intro'; this.shake = 0;
    this.q = R.newQuiz(); this.target = null; this.over = false; this.bf = null;
    this.paused = false; this.pauseAt = 0; this.away = 0; this.held = []; this.task = null;
    this.mb = null; this.cine = null; this.ov = null; this.miniDown = null;      // miniboss: filmen som spelas och lagret över scenen (miniboss.js)
    // Skillträdet: det hjälten bär (bara utseende, se skills.js och skillfx.js). lk = null när inget bärs, då ritas allt som förut.
    const lk = o.profile.skills && o.profile.skills.worn ? looks(o.profile.skills) : null;
    this.lk = lk && lk.any ? lk : null; this.sk = SFX.newFxState(); this.cheered = false;
    // Materialets effekter (v3): vapnets och följeslagarens sort ur MATFX, eller null. Följeslagaren följer med i
    // superattacken från Ice och uppåt.
    const wp = this.gear.weapon, pt = this.gear.pet;
    this.mk = wp ? MATFX[wp.mat] || null : null; this.pk = pt && tierOf(pt) >= 5 ? MATFX[pt.mat] || 'star' : null;
    // Pilarna (v20, bara utseende): bågens eller kogrets material, det högsta. Elementet följer pilen, så ett Fire-koger ger eldpilar.
    this.arrow = wp && (wp.type === 'bow' || wp.type === 'crossbow') ? arrowLook(wp, this.gear.shield) : null;      // armborstets bultar som pilarna (v22)
    if (this.arrow) this.mk = MATFX[this.arrow.mat] || null;
    this.shot = this.arrow || (wp && THROWN[wp.type] ? { t: tierOf(wp), mat: wp.mat, hex: wp.hex, fletch: wp.hex } : null);   // skottens utseende (v21)
    el.innerHTML = `<div class="scene"><canvas class="bg"></canvas><canvas class="fg"></canvas><div class="floaters"></div>
      <div class="hud"><div class="hp me"><b>♥</b><div class="bar"><i></i></div><span></span></div>
      <div class="mid"><span class="wave"></span><span class="streak"><i></i><i></i><i></i></span></div>
      <div class="hp foe"><span class="name"></span><div class="bar"><i></i></div><span class="cd"></span></div></div>
      <button class="flee">Give up</button><button class="bookbtn" aria-label="Word Book" hidden>📖<i></i></button><div class="word"></div><div class="banner"></div></div>
      <div class="quiz"><div class="speak"><button class="again" aria-label="Spela igen">🔊</button><button class="slow" aria-label="Långsamt">🐢</button></div><div class="cards"></div></div>`;
    this.$ = (s) => el.querySelector(s);
    this.$('.again').onclick = () => this.target && this.play(`audio/${this.target.en}.mp3`);
    this.$('.slow').onclick = () => this.target && this.play(`audio/${this.target.en}.slow.mp3`);
    this.$('.flee').onclick = () => { if (!this.over) { this.gaveUp = true; this.finish(false); } };
    if (this.onBook) { const bb = this.$('.bookbtn'); bb.hidden = false; bb.onclick = () => { if (!this.over && !this.paused) this.onBook(); }; }
    this.timer = setInterval(() => this.frame(), 45);
    this.nextFight();
  }
  destroy() { this.over = true; this.held = []; if (this.ov) { this.ov.remove(); this.ov = null; } this.cine = null; if (this.bf) this.bf.stop(); clearInterval(this.timer); clearTimeout(this.bt); this.el.innerHTML = ''; }
  // Stridens klocka i sekunder. Den står still medan striden väntar, så att en attack som pågick fortsätter där den var.
  now() { return ((this.paused ? this.pauseAt : performance.now()) - this.away) / 1000; }
  pause() { if (this.paused || this.over) return false; this.pauseAt = performance.now(); this.paused = true; return true; }
  resume() {
    if (!this.paused) return;
    const gone = performance.now() - this.pauseAt; this.away += gone; this.paused = false;
    if (this.answeredAt) this.answeredAt += gone;
    if (this.task && this.task.ms === undefined) this.task.away = (this.task.away || 0) + gone;      // svarstiden räknar inte tiden i boken
    const held = this.held; this.held = []; for (const fn of held) fn();
  }
  hold(fn) { if (this.paused) this.held.push(fn); else fn(); }
  later(fn, ms) { setTimeout(() => this.hold(fn), ms); }
  // Frågan som är uppe och inte besvarad (inte ett möt-kort), eller null. Används av bokknappens regel.
  openQuestion() { const t = this.task; return this.phase === 'ask' && !this.over && t && !t.meet && t.ms === undefined ? t : null; }
  // Ett litet bokmärke vid ordet: svaret på den här frågan har fått hjälp av boken.
  markHelped() { const w = this.$('.word'); if (w && !w.querySelector('.helped')) w.insertAdjacentHTML('beforeend', '<span class="helped" aria-label="Helped by the book">📖</span>'); }

  // ----- scenens geometri -----
  nextFight() {
    const en = R.startFight(this.run), f = en.f, d = f.def, n = f.n;
    const spread = n > 1 ? Math.min(d.w * 0.85, 26) : 0, swarmW = d.w + spread * (n - 1);
    // Zoomen bestäms av höjden (108, 162 eller 216 pixlar); bredden följer skärmens form så att scenen fyller hela bredden i liggande läge.
    const sc = this.$('.scene'), asp = Math.max(1.5, Math.min(3.4, sc.clientHeight > 40 ? sc.clientWidth / sc.clientHeight : 16 / 9));
    const H = d.h > 100 || swarmW > 162 * asp * 0.42 ? 216 : d.h > 52 || swarmW > 108 * asp * 0.42 ? 162 : 108, W = Math.round(H * asp);
    this.W = W; this.H = H; this.groundY = Math.round(H * 0.8); this.heroX = Math.round(W * 0.17) + 10;
    const cx = Math.round(W * 0.74) - Math.max(0, swarmW / 2 - W * 0.2);
    en.members.forEach((m, i) => Object.assign(m, { x: Math.round(cx + (i - (n - 1) / 2) * spread), flashUntil: 0, hurtAt: -9, deadAt: 0, ph: i * 0.61 }));
    this.enemy = en;
    this.enemy.front = Math.min(...this.enemy.members.map((m) => m.x)) - d.w / 2;
    const scene = this.$('.scene'), bg = this.$('.bg'), fg = this.$('.fg');
    bg.width = fg.width = W; bg.height = fg.height = H;
    this.g = new G(W, H); this.ctx = fg.getContext('2d');
    const b = new G(W, H), biome = BIOMES[this.worldIdx] || 'forest';
    if (BD) { try { BD.drawBackdrop(b, biome, W, H, this.groundY, this.worldIdx * 100 + this.nodeIdx * 7 + this.run.fi); } catch (e) { console.error(e); } }
    else { b.begin(); b.rect(0, 0, W, this.groundY, ramp('#7fb7e6'), 3); b.rect(0, this.groundY - 3, W, H, ramp('#5aa257'), 3); b.end({ outline: false, edge: false }); }
    b.paint(bg.getContext('2d'));
    this.bf = f.tier === 'boss' && this.bossFor && this.quiz && R.stoneBoss(d) ? this.bossFor(this, d) : null;      // boss med egen mekanik
    this.mb = f.mini && MB.has(d.id) ? MB.MB[d.id] : null; this.$('.foe').classList.toggle('mini', !!this.mb);
    this.hud(); this.phase = 'intro'; this.introAt = this.now();
    // Miniboss: entrén och namnskylten i stället för den vanliga skylten, och första frågan när filmen är slut eller överhoppad.
    if (this.mb) { this.introAt = -99; return this.startCine('enter', en.members[0], () => { if (!this.over) this.ask(); }); }
    this.banner(f.tier === 'boss' ? `BOSS: ${d.name}` : n > 1 ? `${n} × ${d.name}` : d.name, f.tier === 'boss');
    this.later(() => { if (!this.over) this.ask(); }, f.tier === 'boss' ? 1500 : 900);
  }
  // ----- minibossens filmer (miniboss.js): kind 'enter' eller 'defeat', m = medlemmen som filmen gäller, done = det som kommer sedan -----
  startCine(kind, m, done) {
    if (this.ov) this.ov.remove();
    this.cine = { kind, spec: this.mb[kind], m, t0: this.now(), done, fired: new Set() };
    this.ov = MB.overlay(this.$('.scene'), () => this.endCine());
  }
  endCine() {
    const c = this.cine; if (!c) return;
    this.cine = null; if (this.ov) { this.ov.remove(); this.ov = null; }
    if (c.done) this.hold(c.done);
  }
  banner(text, big) { const b = this.$('.banner'); b.textContent = text; b.className = 'banner on' + (big ? ' boss' : ''); clearTimeout(this.bt); this.bt = setTimeout(() => (b.className = 'banner'), big ? 1600 : 1000); }
  alive() { return R.alive(this.run); }
  hud() {
    const h = this.hero, e = this.enemy, f = e.f, hp = e.members.reduce((s, m) => s + Math.max(0, m.hp), 0), mx = e.members.length * f.hpEach;
    this.$('.me i').style.width = (100 * h.hp / h.maxHp) + '%'; this.$('.me span').textContent = Math.max(0, h.hp);
    this.$('.foe .name').textContent = f.def.name + (f.n > 1 ? ` ×${this.alive().length}` : '');
    this.$('.foe i').style.width = (100 * hp / mx) + '%';
    this.$('.cd').textContent = '⚔'.repeat(Math.max(0, f.every - e.cd + 1)) + '·'.repeat(Math.max(0, e.cd - 1));
    this.$('.cd').classList.toggle('now', e.cd <= 1);
    this.$('.wave').textContent = `Fight ${this.run.fi + 1}/${this.run.fights.length}`;
    this.el.querySelectorAll('.streak i').forEach((p, i) => p.classList.toggle('on', !!this.power || i < this.run.streak));      // Power start: alla tre lyser tills den är använd
    this.$('.streak').classList.toggle('full', !!this.power || this.run.streak >= R.K.superStreak);
    if (this.bookCount) this.$('.bookbtn i').textContent = this.bookCount() || '';
    if (this.bf) this.bf.hud();                                  // ordstenar i stället för livmätare och nedräkning
  }
  // Ett ord blev starkare i boken: en rad som stiger över hjälten, i ordnivåns färg.
  note(text, color) { const f = document.createElement('div'); f.className = 'fl grow'; f.textContent = text; f.style.left = '50%'; f.style.top = '34%'; if (color) f.style.color = color; this.$('.floaters').appendChild(f); setTimeout(() => f.remove(), 1500); }
  float(text, x, y, cls = '') { const f = document.createElement('div'); f.className = 'fl ' + cls; f.textContent = text; f.style.left = (100 * x / this.W) + '%'; f.style.top = (100 * y / this.H) + '%'; this.$('.floaters').appendChild(f); setTimeout(() => f.remove(), 900); }

  // ----- frågan -----
  // Tydligt besked om svaret: ljud, grön eller röd ram runt frågepanelen och en stor bock eller ett kryss.
  mark(right) { this.answeredAt = performance.now(); if (this.sfx) this.sfx(right ? 'right' : 'wrong'); const q = this.$('.quiz'); q.classList.remove('ok', 'bad'); q.classList.add(right ? 'ok' : 'bad'); }
  // Nästa fråga kommer först när beskedet har hunnit synas (minMs sedan svaret) och rösten har pratat klart.
  askSoon(minMs) {
    const wait = Math.max(0, minMs - (performance.now() - (this.answeredAt || 0)));
    const idle = this.voiceIdle ? Promise.race([this.voiceIdle(), new Promise((r) => setTimeout(r, 3500))]) : Promise.resolve();
    Promise.all([idle, new Promise((r) => setTimeout(r, wait))]).then(() => this.hold(() => { if (!this.over) this.ask(); }));
  }
  ask() {
    if (this.over) return;
    if (this.bf) return this.bf.ask();                           // bossens egna uppgifter i stället för den vanliga frågan
    this.phase = 'ask'; this.first = true; this.$('.quiz').classList.remove('ok', 'bad');
    if (this.quiz) { this.target = null; this.task = this.quiz.next(); this.quiz.render(this.task, this.$('.quiz'), this.$('.word'), (r) => this.onTask(r)); return; }   // världar med byggd pedagogik
    const t = this.target = R.nextWord(this.q, this.words);
    const opts = [t, ...this.words.filter((w) => w !== t).sort(() => Math.random() - 0.5).slice(0, R.K.options - 1)].sort(() => Math.random() - 0.5);
    const cards = this.$('.cards'); cards.innerHTML = '';
    for (const o of opts) { const b = document.createElement('button'); b.className = 'card'; b.innerHTML = pic(o); b.dataset.en = o.en; b.onclick = () => this.answer(o, b); cards.appendChild(b); }
    this.$('.word').textContent = t.en;                       // ordet står utskrivet så att man tränar att läsa det
    this.play(`audio/${t.en}.mp3`);
  }
  // Svar från övningsmotorn. meet = ett nytt ord visades som ett kort och barnet tryckte på det: ett gratis slag, utan
  // risk och utan att raden eller fiendens nedräkning rörs. free = riskfri första fråga (bara när möt-korten är av):
  // fel svar kostar inget, ordet lärs in och kommer tillbaka.
  onTask(r) {
    if (this.phase !== 'ask' || this.over) return;
    if (r.meet) { this.phase = 'anim'; this.answeredAt = performance.now(); if (this.sfx) this.sfx('good'); this.note('Free hit!', '#8dffb0'); this.heroAttack(false, { free: true }); return this.hud(); }
    this.mark(r.right);
    if (!r.right && r.free) return this.ask();
    this.phase = 'anim';
    if (r.right && this.task && this.task.helped) this.note('📖 No points', '#ffd9a0');      // boken hjälpte: slaget är som vanligt, ordet får inga poäng
    if (r.right) { const mult = this.power ? this.powerMult || 1 : 1; this.power = false; this.heroAttack(R.answerRight(this.run), { mult }); }
    else { R.answerWrong(this.run); this.enemyAttack(); }
    this.hud();
  }
  answer(o, btn) {
    if (this.phase !== 'ask') return;
    this.phase = 'anim'; this.mark(o === this.target);
    if (o === this.target) {
      btn.classList.add('right');
      this.heroAttack(R.answerRight(this.run));
    } else {
      btn.classList.add('wrong'); R.answerWrong(this.run);
      [...this.el.querySelectorAll('.card')].forEach((c) => { if (c.dataset.en === this.target.en) c.classList.add('right'); });
      R.missWord(this.q);
      this.play(`audio/${this.target.en}.slow.mp3`);
      this.enemyAttack();
    }
    this.hud();
  }

  // ----- hjältens attack -----
  // x.free: gratis slag (möt-kortet), nedräkningen tickar inte efteråt. x.mult: Power start, skadan gånger mult.
  heroAttack(sup, x = {}) {
    const type = this.gear.weapon && ATTACKS[this.gear.weapon.type] ? this.gear.weapon.type : 'none', A = ATTACKS[type];      // en sort utan attack här slår som tomma händer
    this.anim = { who: 'hero', type, A, t0: this.now(), dur: A.dur * (sup ? 1.15 : 1), sup, free: !!x.free, mult: x.mult > 1 ? x.mult : 1, fired: new Set(), D: Math.max(0, this.enemy.front - this.heroX - 24) };
    if (sup) this.banner('SUPER!', true); else if (this.anim.mult > 1) this.banner('POWER!', true);
    // Superattackens utseende följer det burna steget på nivå 5. until = sekunder till första träffen, så att effekten landar med skadan.
    if (sup && this.lk) { const [tx, ty] = this.target3(), hit = A.ev.find((e) => e.hit !== undefined) || A.ev[0]; this.fx.push(...SFX.superFx(this.lk, { now: this.anim.t0, x: tx, y: ty, gy: this.groundY, hx: this.heroX, hy: this.groundY - 26, until: hit.at * this.anim.dur })); }
    // Star-vapnets stjärnregn (v3), bara när inget buret steg har en egen superattack
    if (sup && this.mk === 'star' && !(this.lk && this.lk.sup)) { const [tx, ty] = this.target3(), hit = A.ev.find((e) => e.hit !== undefined) || A.ev[0]; matSuper(this.fx, 'star', tx, ty, this.anim.t0, hit.at * this.anim.dur); }
  }
  // Segerposen efter sista fienden: följer superattacken på nivå 5 (en rörelse och gnistor, inget i reglerna). Utan ett buret steg där händer inget.
  cheer() {
    if (this.cheered || !this.lk || !this.lk.pose || this.anim) return;
    this.cheered = true; const now = this.now();
    this.anim = { who: 'cheer', t0: now, dur: 0.9, fired: new Set() };
    this.fx.push(...SFX.cheerFx(this.lk, { now, x: this.heroX, y: this.groundY - 26, gy: this.groundY, hx: this.heroX, hy: this.groundY - 26 }));
  }
  target3() { const f = this.enemy.f.def, a = this.alive()[0] || this.enemy.members[0]; return [a.x, this.groundY - f.h * 0.5]; }
  fire(ev) {
    const a = this.anim, mat = this.gear.weapon ? ramp(this.gear.weapon.hex) : WHITE, [tx, ty] = this.target3();
    if (ev.shoot) {
      const from = ev.shoot.from === 'tip' ? this.tip : ev.shoot.from === 'over' ? this.over3 : this.hand;
      const shots = ev.shoot.arrow && a.sup ? [-10, 0, 10] : (ev.shoot.knife || ev.shoot.star) && a.sup ? [-5, 5] : [0];
      const al = this.alive(), far = ev.shoot.pierce && al.length > 1 ? al[1].x + 8 : tx;          // pierce: skottet går genom de två främsta
      const S = ev.shoot, thrown = S.knife || S.star || S.javelin || S.bomb;
      for (const off of shots) this.fx.push({ kind: 'proj', t0: this.now(), dur: S.dur + (S.stay || 0) + (S.back || 0), fly: S.dur, stay: S.stay || 0, x0: from[0], y0: from[1], x1: S.javelin ? tx - 4 : far, y1: ty + off, r: (S.r || 1) * (a.sup ? 1.3 : 1), arrow: S.arrow, bolt: S.bolt, knife: S.knife, star: S.star, javelin: S.javelin, bomb: S.bomb, al: S.arrow ? this.arrow : thrown ? this.shot : null, mat });
      return;
    }
    // träff
    for (const { m, dmg } of this.bf ? this.bf.heroHits(ev) : R.heroHit(this.run, a.type, ev.hit, a.sup, Math.random, a.mult || 1)) {
      m.flashUntil = this.now() + 0.12; m.hurtAt = this.now();
      this.float(dmg, m.x, this.groundY - this.enemy.f.def.h - 6, a.sup || a.mult > 1 ? 'crit' : '');
      this.burst(m.x, this.groundY - this.enemy.f.def.h * 0.5, a.sup ? 14 : 7, mat, 60);
      if (m.hp <= 0 && !m.deadAt) { m.deadAt = this.now(); this.burst(m.x, this.groundY - this.enemy.f.def.h * 0.4, 12, DUST, 40); if (this.mb) this.miniDown = m; }
    }
    this.shake = Math.max(this.shake, (a.A.shake || 2) * (a.sup ? 1.5 : 1));
    if (ev.hit !== undefined && this.shot && this.shot.t >= 2) arrowHit(this.fx, this.shot, tx, ty, this.now(), a.sup);   // pilens och kastvapnets glöd vid träffen (v20, v21)
    if (ev.hit !== undefined && (this.mk || (a.sup && this.pk))) {      // materialets träff och fiendens färg (v3)
      const h = this.enemy.f.def.h, now = this.now(), al = this.alive(), hitM = al.length ? al : this.enemy.members.slice(0, 1);
      const tint = matHit(this.fx, this.mk, tx, ty, now, { sup: a.sup, burst: !(this.lk && this.lk.trail), h });
      if (a.sup && this.pk && this.petAt) matHit(this.fx, this.pk, tx - 6, ty + 4, now, { sup: false, burst: true, h: h * 0.6 });   // följeslagaren slår med
      if (tint) for (const m of hitM) m.tint = tint;
    }
    if (this.lk) this.fx.push(...SFX.impactFx(this.lk, { now: this.now(), x: tx, y: ty, gy: this.groundY, hx: this.heroX, hy: this.groundY - 26 }));   // träffen från det burna steget på nivå 3
    if (ev.fx === 'slash' || ev.fx === 'bigslash') this.fx.push({ kind: 'slash', t0: this.now(), dur: 0.16, x: tx - 4, y: ty, r: (ev.fx === 'bigslash' ? 22 : 12) * (a.sup ? 1.4 : 1), mat });
    if (ev.fx === 'shock' || ev.fx === 'dust') this.fx.push({ kind: 'shock', t0: this.now(), dur: 0.4, x: this.heroX + a.D + 18, y: this.groundY, r: ev.fx === 'shock' ? 60 : 16 });
    if (ev.fx === 'boom' || ev.fx === 'bigboom') this.burst(tx, ty, ev.fx === 'bigboom' ? 40 : 18, mat, ev.fx === 'bigboom' ? 130 : 80);
    if (ev.fx === 'quake') {                                               // jättevapnen (v23): en chockvåg åt båda hållen, damm och sprickor i marken
      const gy = this.groundY, x0 = this.heroX + a.D + 22;
      this.fx.push({ kind: 'shock', t0: this.now(), dur: 0.5, x: x0, y: gy, r: 90 }); this.fx.push({ kind: 'shock', t0: this.now() + 0.08, dur: 0.45, x: x0, y: gy, r: 60 });
      for (let i = 0; i < 18; i++) this.fx.push({ kind: 'p', t0: this.now(), dur: 0.5, x: x0 + rr(-10, 60), y: gy - 1, vx: rr(-20, 40), vy: rr(-80, -30), rp: DUST, lv: 3 + (i % 3) });
      this.fx.push({ kind: 'crack', t0: this.now(), dur: 0.9, x: x0, y: gy, r: 30 + (this.gear.weapon ? tierOf(this.gear.weapon) * 4 : 0) });      // sprickan blir längre för varje material
      this.burst(tx, ty, a.sup ? 30 : 16, mat, 110);
    }
    if (ev.fx === 'cut') this.fx.push({ kind: 'cut', t0: this.now(), dur: 0.22, x: tx, y: ty, r: (this.enemy.f.def.h * 0.5 + 6) * (a.sup ? 1.3 : 1), an: [-0.7, 0.5, -0.15][ev.hit % 3], mat });   // katanans snitt (v22)
    if (ev.fx === 'bomb') {                                                // bombens smäll (v22): gnistor, rök och en tryckvåg, mer för varje material
      const t = this.shot ? this.shot.t : 0, k = a.sup ? 1.5 : 1;
      this.burst(tx, ty, Math.round((16 + t * 3) * k), SPARK, 100 + t * 6); this.burst(tx, ty, Math.round((10 + t) * k), DUST, 50);
      for (let i = 0; i < 4 + Math.floor(t / 2); i++) { const an = i * 2.4; this.fx.push(mf('puff', this.now() + i * 0.03, 0.5 + t * 0.03, tx + Math.cos(an) * 6, ty + Math.sin(an) * 4, { r: 3 + t * 0.25, vx: Math.cos(an) * 14, vy: -10 - i })); }
      this.fx.push({ kind: 'shock', t0: this.now(), dur: 0.4, x: tx, y: this.groundY, r: 30 + t * 4 });
      const BC = { 5: MC.ice, 7: MC.vio, 8: MC.pink, 9: MC.fire2 }[t] || MC.fire;      // eldklotets färg: eld, is, skugga, kristall, stjärna
      this.fx.push({ kind: 'boom', t0: this.now(), dur: 0.5 + t * 0.02, x: tx, y: ty, r: (9 + t * 1.5 + this.enemy.f.def.h * 0.3) * k, rp: BC });
    }
    this.hud();
  }
  sparks(x, y, n) { this.burst(x, y, n, SPARK, 90); }
  burst(x, y, n, rp, speed) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7); this.fx.push({ kind: 'p', t0: this.now(), dur: 0.25 + Math.random() * 0.35, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, rp, lv: 3 + (i % 3) }); } }

  // a = attacken som just tog slut. Ett gratis slag (a.free) kan fälla fienden, men tickar inte nedräkningen.
  afterHero(a) {
    if (this.bf) return this.bf.afterHero();
    const free = !!(a && a.free), next = R.afterHeroAttack(this.run, free);
    if (next === 'next' || next === 'won') {
      const f = this.enemy.f;
      const gold = Math.round(f.gold * (this.rewardMult ?? 1));      // samma avtrappning som resultatskärmen räknar med (reward i rules.js)
      if (gold > 0) this.float(`+${gold} gold`, this.enemy.members[0].x, this.groundY - f.def.h - 14, 'gold');
      if (next === 'won') this.cheer();
      const go = () => { if (this.over) return; if (next === 'next') this.nextFight(); else this.finish(true); };
      // Slagen miniboss: nederlagsfilmen först (går att hoppa över), sedan som vanligt.
      if (this.mb && this.miniDown) { const m = this.miniDown; this.banner('Mini-boss defeated!', true); this.$('.banner').classList.add('mini'); if (this.sfx) this.sfx('win'); return this.startCine('defeat', m, () => { this.miniDown = null; this.later(go, 250); }); }
      this.later(go, 900);
      return;
    }
    if (next === 'enemy') this.enemyAttack(); else { this.hud(); this.phase = 'wait'; this.askSoon(free ? 900 : 2000); }
  }
  // kind: vilken av bossens två attacker som spelas (bara bossar med egen mekanik skickar med den).
  enemyAttack(kind) { R.resetCountdown(this.run); this.anim = { who: 'enemy', t0: this.now(), dur: this.bf ? 1.05 : 0.85, fired: new Set(), kind: kind || 0, guard: this.guardFor() }; }
  // Vilken parad hjälten tar den här gången. Växlar i tur och ordning (ingen slump, så inget slumptal i spelet rörs):
  // med sköld: sköldmur, skölden högt och långt fram (oftare mot flygande fiender) eller sköld och vapen i kors; utan sköld: hög eller låg parad med
  // vapnet, och var tredje gång viker hjälten undan och tar emot slaget; utan närstridsvapen: viker undan eller duckar.
  guardFor() {
    const n = this.parryN = (this.parryN || 0) + 1, w = this.gear.weapon, melee = !!(w && GUARD[w.type]), fly = !!(this.enemy && this.enemy.f.def.fly);
    if (heldShield(this.gear)) return { kind: 'shield', v: fly && n % 2 ? 1 : n % 3 === 2 && melee ? 2 : n % 3 === 1 ? 1 : 0 };      // kogret på ryggen är ingen sköld
    if (melee) return n % 3 === 0 ? { kind: 'dodge', v: n % 2 } : { kind: 'weapon', v: fly ? 0 : n % 3 === 1 ? 0 : 1 };
    return { kind: 'dodge', v: n % 2 };
  }
  // Hjältens läge i paraden: dx, dy, wAng, hand och guard (som i ATTACKS). gd = guardFor(), p = slagets förlopp.
  guardPose(gd, p) {
    const r = guardUp(p), k = guardJolt(p), w = this.gear.weapon, hold = w ? HOLD[w.type] ?? 0 : 0, G = w && GUARD[w.type];
    const turn = (to) => (G ? hold + (to - hold) * r : undefined);
    if (gd.kind === 'shield') {
      if (gd.v === 1) return { dx: 2 * r - 6 * k, dy: 0.5 * r, guard: [23 * r - 3 * k, -9 * r], hand: [-2 * r, r] };                  // skölden högt och långt fram, hjälten kikar över kanten
      if (gd.v === 2) return { dx: -4 * k, dy: r, guard: [15 * r - 2 * k, -4 * r], wAng: turn(G ? G[0] : 0), hand: [2 * r, -6 * r] };   // sköld och vapen i kors
      return { dx: -4 * k, dy: r, guard: [19 * r - 2.5 * k, -6 * r], hand: [-3 * r, -r] };                                              // sköldmur, böjda knän
    }
    if (gd.kind === 'weapon') {
      const to = G[gd.v], wa = turn(to) - 0.3 * k;
      return gd.v ? { dx: -4 * k, dy: 2 * r, wAng: wa, hand: [5 * r, -2 * r] } : { dx: -4 * k, wAng: wa, hand: [3 * r, -8 * r] };
    }
    return gd.v ? { dx: -3 * r - k, dy: 4 * r, hand: [-2 * r, -3 * r] } : { dx: -7 * r - 2 * k, dy: 2 * r, hand: [-3 * r, -4 * r] };       // duckar, eller lutar sig bakåt och tar emot
  }
  // Klang där slaget tar emot (sköld eller klinga), med gnistor och lite damm vid fötterna. En svisch om hjälten viker undan.
  clang(gd) {
    const now = this.now(), gy = this.groundY, rot = (this.parryN % 4) * 0.2;
    let at = null;
    if (gd.kind === 'shield' && this.guardAt) at = [this.guardAt[0] + 7, this.guardAt[1] - 1];
    else if (gd.kind === 'weapon' && this.tip && this.hand) at = [lerp(this.hand[0], this.tip[0], 0.6) + 2, lerp(this.hand[1], this.tip[1], 0.6)];
    if (at) { this.fx.push({ kind: 'clang', t0: now, dur: 0.26, x: Math.round(at[0]), y: Math.round(at[1]), rot }); this.burst(at[0], at[1], 7, SPARK, 70); }
    else this.fx.push({ kind: 'whiff', t0: now, dur: 0.24, x: this.heroX + 10, y: gy - 30 + (gd.v ? 8 : 0) });
    for (let i = 0; i < 4; i++) this.fx.push({ kind: 'p', t0: now, dur: 0.3, x: this.heroX - 6 + i * 4, y: gy - 1, vx: -25 - i * 8, vy: -15 - i * 4, rp: DUST, lv: 4 });
  }
  enemyHit() {
    const dmg = this.bf ? this.bf.strike() : R.enemyStrike(this.run);
    this.hero.flashUntil = this.now() + 0.14; this.hero.hurtAt = this.now(); this.shake = Math.max(this.shake, this.bf ? 6 : 4);
    this.float(dmg > 0 ? `-${dmg}` : 'Phew!', this.heroX, this.groundY - 56, 'hurt'); this.burst(this.heroX, this.groundY - 26, 8, RED, 60); this.hud();
  }
  // Ett snedsteg mitt i en uppgift (fel ord när en mening byggs): fienden slår, men uppgiften står kvar och nedräkningen rörs inte.
  slip() {
    if (this.over || this.phase !== 'ask' || this.bf) return;
    if (this.anim) { this.enemyHit(); return this.afterSlip(); }               // redan mitt i ett slag: skadan direkt
    this.anim = { who: 'enemy', t0: this.now(), dur: 0.7, fired: new Set(), kind: 0, slip: true, guard: this.guardFor() };
  }
  afterSlip() { if (R.defeated(this.run)) { this.phase = 'anim'; this.hero.deadAt = this.now(); this.later(() => this.finish(false), 900); } else this.hud(); }
  afterEnemy() { if (this.bf) return this.bf.afterEnemy(); if (R.defeated(this.run)) { this.hero.deadAt = this.now(); this.later(() => this.finish(false), 900); } else { this.hud(); this.phase = 'wait'; this.askSoon(3200); } }
  finish(win) {
    if (this.over) return; this.over = true; this.phase = 'over';
    const res = R.result(this.run, win); if (this.gaveUp) res.gaveUp = true;
    if (this.bf) { if (res.boss) Object.assign(res.boss, this.bf.summary()); this.bf.stop(); }
    this.onEnd(res);
  }

  // ----- bildrutan -----
  frame() {
    if (this.paused) return;                                     // boken är öppen: scenen står still
    const now = this.now(), g = this.g, { W, H, groundY } = this; if (!g) return;
    g.clear();
    const cn = this.cine, cp = cn ? Math.min(1, (now - cn.t0) / cn.spec.dur) : 0;      // minibossens film och hur långt den har kommit
    if (cn && cn.spec.shake) this.shake = Math.max(this.shake, cn.spec.shake(cp) || 0);
    const sh = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0; this.shake *= 0.8;
    if (BD && BD.drawAmbient) { try { BD.drawAmbient(g, BIOMES[this.worldIdx] || 'forest', W, H, groundY, now); } catch (e) {} }
    // hjältens läge
    const lk = this.lk;
    if (lk && this.bf && this.bf.defeated && !this.cheered && !this.anim) this.cheer();      // en hjälpt boss: segerposen medan bossen säger sin sista replik
    let hp = {}, a = this.anim, p = a ? (now - a.t0) / a.dur : 0;
    if (a && a.who === 'hero') hp = a.A.pose(Math.min(1, p), a.D, this.gear.weapon, this.enemy.f.def.w) || {};      // ew = fiendens bredd (katanans språng förbi fienden)
    else if (a && a.who === 'cheer') hp = SFX.victoryPose(lk, Math.min(1, p)) || {};
    else if (a && a.who === 'enemy' && a.guard) hp = this.guardPose(a.guard, Math.min(1, p));      // paraden
    const hurt = Math.max(0, 1 - (now - this.hero.hurtAt) / 0.25), dx = (hp.dx || 0) - hurt * 5, dy = hp.dy || 0;
    const hx = this.heroX + dx + sh;
    g.begin(); g.ell(hx, groundY + 1.5, 12 + dy / 6, 2.4, SHADOW, false, null, 1); g.end({ outline: false, edge: false });
    const deadFor = this.hero.deadAt ? now - this.hero.deadAt : -1;
    if (deadFor < 0 || Math.floor(deadFor * 12) % 2 === 0) {
      let px = hx - 28, py = groundY - 30 + Math.round(Math.sin(now * 2) * 2);
      if (this.pk && a && a.who === 'hero' && a.sup) { const u = bump(seg(Math.min(1, p), 0.15, 0.85)); px += Math.round(u * Math.max(0, this.enemy.front - px - 14)); py -= Math.round(u * 22); }   // följeslagaren flyger fram och upp i superattacken (v3)
      this.petAt = [px, py];
      if (this.gear.pet) drawPet(g, this.gear.pet, px, py, now);
      if (!(lk && SFX.heroHidden(lk, a && a.who === 'hero' && a.sup, Math.min(1, p)))) {      // under Shadow Strike är hjälten borta en stund
        g.push(Math.round(hx - 38.5), Math.round(groundY - 61 + dy)); g.flash = now < this.hero.flashUntil;
        const gear = hp.noW ? Object.assign({}, this.gear, { weapon: null }) : this.gear, args = { t: now, wAng: hp.wAng, hand: hp.hand, guard: hp.guard, noShadow: true, noPet: true };
        // off = hur långt hjälten är från sin plats (så att sällskapet står kvar), busy = småvanorna vilar under attacker
        if (lk) SFX.drawHeroWithSkills(g, this.profile.look, gear, { ...args, off: [Math.round(dx), Math.round(dy)], busy: !!a }, lk, this.sk); else drawHero(g, this.profile.look, gear, args);
        g.flash = false; this.tip = g.anchor.tip || g.anchor.hand; this.hand = g.anchor.hand; this.guardAt = g.anchor.shield || null; this.over3 = [this.hand[0] - 4, this.hand[1] - 34]; g.pop();
        // skillträdets saker framför hjälten (axelplattor, krage) ritas efter skölden: en lyft sköld ritas en gång till ovanpå
        if (lk && hp.guard && heldShield(this.gear) && this.guardAt && (hp.guard[0] || hp.guard[1])) drawShield(g, heldShield(this.gear), this.guardAt[0] - 0.5, this.guardAt[1] - 0.5);
        if (lk && lk.trail && a && a.who === 'hero' && !this.fx.some((e) => e.kind === 'proj')) SFX.trailPush(this.sk, this.tip, this.hand, now);   // medan ett skott flyger hör spåret till skottet
        else if (this.mk && a && a.who === 'hero' && p > 0.12 && p < 0.8) matTrail(this.fx, this.mk, this.tip, [hx, groundY - 30 + dy], now, Math.abs((hp.dx || 0) - (this.lastDx ?? 0)) > 0.6);   // materialets spår (v3), bara utan skillspår
        this.lastDx = hp.dx || 0;
      }
    }
    if (lk) SFX.drawTrail(g, this.sk, lk, now);
    // katanans språng: vita streck efter hjälten (v22)
    if (a && a.who === 'hero' && a.A.streak && p > a.A.streak[0] && p < a.A.streak[1]) for (let i = 0; i < 3; i++) this.fx.push({ kind: 'p', t0: now, dur: 0.16, x: hx - 8 - i * 3, y: groundY - 10 - i * 9 - Math.round(Math.random() * 3), vx: -60, vy: 0, rp: WHITE, lv: 5 });
    // storsvärdet river upp gnistor när det släpas
    if (a && a.who === 'hero' && a.A.drag && p > 0.12 && p < 0.45 && this.tip) this.fx.push({ kind: 'p', t0: now, dur: 0.25, x: this.tip[0], y: groundY, vx: -30 - Math.random() * 30, vy: -20 - Math.random() * 30, rp: SPARK, lv: 5 });
    // fienderna
    const f = this.enemy.f, d = f.def, ea = a && a.who === 'enemy' ? Math.min(1, p) : 0, al = this.alive();
    const cc = (m) => ({ x: m.x, gy: groundY, W, H, h: d.h, w: d.w, t: now });
    try { if (cn && cn.spec.back) cn.spec.back(g, cp, cc(cn.m)); else if (!cn && this.mb && this.mb.stay && this.enemy.members[0].hp > 0) this.mb.stay(g, cc(this.enemy.members[0])); } catch (e) { if (!this.err) { this.err = 1; console.error(e); } }
    this.enemy.members.forEach((m, i) => {
      if (cn && cn.m === m) {                                    // minibossen i sin film: läge, vridning och skala från miniboss.js
        let c = {}; try { c = cn.spec.pose(cp, cc(m)) || {}; } catch (e) { if (!this.err) { this.err = 1; console.error(e); } }
        if (c.hide) return;
        const draw = (gg) => {
          gg.push(Math.round(m.x + (c.dx || 0) + sh), Math.round(groundY + (c.dy || 0) - (c.piv || 0)), c.ang || 0, c.k || 1); if (c.piv) gg.push(0, c.piv);
          try { d.draw(gg, now + m.ph, Object.assign({ attack: 0, hurt: 0 }, c.pose)); } catch (e) { if (!this.err) { this.err = 1; console.error(d.id, e); } }
          if (c.piv) gg.pop(); gg.pop();
        };
        if (c.clip) MB.clipped(g, groundY + 1, draw); else draw(g);
        return;
      }
      const dead = m.deadAt && m !== this.miniDown ? now - m.deadAt : -1; if (dead > 0.5) return;
      const lunge = ea && (al[0] === m || f.n > 1) ? -bump(ea) * Math.max(0, m.x - this.heroX - d.w / 2 - 14) * (f.tier === 'boss' ? 0.35 : 0.8) : 0;
      const hurtE = Math.max(0, 1 - (now - m.hurtAt) / 0.3), intro = Math.max(0, 1 - (now - this.introAt) / 0.5);
      const ex = Math.round(m.x + lunge + hurtE * 4 + intro * intro * 80 + sh);
      if (d.fly) { g.begin(); g.ell(ex, groundY + 1.5, d.w * 0.3, 2, SHADOW, false, null, 1); g.end({ outline: false, edge: false }); }
      if (dead >= 0 && Math.floor(dead * 16) % 2) return;
      const ti = m.tint && now < m.tint.until && !(now < m.flashUntil) ? tintSnap(g, Math.round(ex - d.w * 0.6 - 4), Math.round(groundY - d.h - 6), Math.round(ex + d.w * 0.6 + 4), groundY + 2) : null;   // frost eller skugga efter träffen (v3)
      g.push(ex, groundY + (dead > 0 ? Math.round(dead * 8) : 0)); g.flash = now < m.flashUntil;
      const pose = { attack: ea && (al[0] === m || f.n > 1) ? ea : 0, hurt: hurtE };
      if (this.bf) Object.assign(pose, this.bf.pose(a));         // attackKind, phase, defeated, talk (valfria fält i bosses.js)
      try { d.draw(g, now + m.ph, pose); } catch (e) { if (!this.err) { this.err = 1; console.error(d.id, e); } }
      g.flash = false; g.pop();
      if (ti) tintApply(g, ti, m.tint.rp, (now - m.tint.t0) / (m.tint.until - m.tint.t0));
    });
    if (cn) {
      try { if (cn.spec.front) cn.spec.front(g, cp, cc(cn.m)); } catch (e) { if (!this.err) { this.err = 1; console.error(e); } }
      for (const [j, e] of (cn.spec.ev || []).entries()) if (cp >= e.at && !cn.fired.has(j)) { cn.fired.add(j); if (this.sfx && e.sfx) this.sfx(e.sfx); }
      if (this.ov) this.ov.update(cp, cn.spec, this.mb, d.name, now, cn.kind);
      if (cp >= 1) this.endCine();
    }
    // händelser
    if (a) {
      if (a.who === 'hero') {
        const c = a.A.charge, mat = this.gear.weapon ? ramp(this.gear.weapon.hex) : WHITE;
        if (c && p >= c.from && p < c.to) { const at = c.at === 'tip' ? this.tip : this.over3, r = lerp(c.r0, c.r1, seg(p, c.from, c.to)) * (a.sup ? 1.3 : 1); g.begin(); g.ell(at[0], at[1], r, r, mat); g.end(); if (Math.random() < 0.6) this.fx.push({ kind: 'p', t0: now, dur: 0.3, x: at[0] + (Math.random() - 0.5) * r * 4, y: at[1] + (Math.random() - 0.5) * r * 4, vx: 0, vy: -10, rp: mat, lv: 5 }); }
        a.A.ev.forEach((ev, i) => { if (p >= ev.at && !a.fired.has(i)) { a.fired.add(i); this.fire(ev); } });
        if (p >= 1) { this.anim = null; this.afterHero(a); }
      } else if (a.who === 'cheer') { if (p >= 1) this.anim = null; }
      else {
        if (p >= 0.5 && !a.fired.has(0)) { a.fired.add(0); this.enemyHit(); if (a.guard) this.clang(a.guard); }
        if (p >= 1) { const slip = a.slip; this.anim = null; if (slip) this.afterSlip(); else this.afterEnemy(); }
      }
    }
    // effekter
    g.begin(); let any = false;
    this.fx = this.fx.filter((e) => {
      if (e.kind === 'sk') return true;                          // skillträdets effekter ritas för sig längre ner
      const q = (now - e.t0) / e.dur; if (q >= 1) return false;
      if (e.kind === 'mf') { if (q >= 0) { any = true; drawMatFx(g, e, q, now - e.t0); } return true; }   // materialets effekter (v3), kan börja lite senare
      any = true;
      if (e.kind === 'p') { const tt = now - e.t0; g.set(Math.round(e.x + e.vx * tt), Math.round(e.y + e.vy * tt + 60 * tt * tt), e.rp, q < 0.5 ? e.lv : 3); }
      if (e.kind === 'shock') for (let s = -1; s <= 1; s += 2) for (let j = 0; j < 5; j++) g.set(Math.round(e.x + s * (q * e.r + j * 2)), Math.round(e.y - j * (1 - q) * 2 - 1), DUST, 4 - (j % 2));
      if (e.kind === 'clang') {                                  // stjärna med åtta strålar som skjuter ut och slocknar
        const L = 4 + 9 * Math.sqrt(q), c0 = q < 0.5 ? 1 : Math.round(L * 0.45);
        for (let i = 0; i < 8; i++) { const an = i * Math.PI / 4 + e.rot, len = i % 2 ? L * 0.55 : L; for (let j = c0; j <= len; j++) { const x = Math.round(e.x + Math.cos(an) * j), y = Math.round(e.y + Math.sin(an) * j); g.set(x, y, j < len * 0.6 ? WHITE : SPARK, 5); if (!(i % 2) && j < len * 0.6) g.set(x + Math.round(-Math.sin(an)), y + Math.round(Math.cos(an)), SPARK, 5); } }   // de fyra stora strålarna är två pixlar breda
        if (q < 0.4) { g.set(e.x, e.y, WHITE, 5); g.set(e.x + 1, e.y, WHITE, 5); g.set(e.x, e.y + 1, WHITE, 5); g.set(e.x - 1, e.y, WHITE, 5); g.set(e.x, e.y - 1, WHITE, 5); }
      }
      if (e.kind === 'whiff') for (let j = 0; j < 3; j++) { const x0 = Math.round(e.x + 4 + q * 10 + j * 2), y = e.y + j * 5 - 5, len = Math.round(9 - j * 2 - q * 6); for (let i = 0; i < len; i++) { g.set(x0 + i, y, WHITE, i < 2 ? 3 : 5); if (i > 1) g.set(x0 + i, y + 1, SHADOW, 2); } }   // mörk kant under, så att det syns mot moln och snö
      if (e.kind === 'boom') {                                   // bombens eldklot (v22): vit kärna, materialets färg, grå rök i kanten som glesnar
        const r = e.r * Math.sqrt(q), r2 = r * r, core = r * (0.55 - q * 0.5);
        for (let dy = -Math.ceil(r); dy <= r; dy++) for (let dx = -Math.ceil(r); dx <= r; dx++) {
          const d2 = dx * dx + dy * dy; if (d2 > r2) continue;
          const edge = d2 > r2 * 0.6; if (q > 0.5 && (dx + dy + Math.floor(q * 8)) & 1) continue;
          g.set(Math.round(e.x + dx), Math.round(e.y + dy - q * 6), d2 < core * core ? WHITE : edge && q > 0.3 ? DUST : e.rp, d2 < core * core ? 5 : edge ? 2 : 4);
        }
      }
      if (e.kind === 'crack') { const L = e.r * Math.min(1, q * 4); for (let j = 0; j < L; j++) { const z = Math.round(Math.sin(j * 0.9 + e.x) * 1.2); g.set(Math.round(e.x + j), e.y + z, SHADOW, 0); if (j % 7 === 3) g.set(Math.round(e.x + j), e.y + z - 1, SHADOW, 0); if (q < 0.3 && j % 5 === 0) g.set(Math.round(e.x + j), e.y + z - 2, SPARK, 5); } }   // spricka i marken (v23)
      if (e.kind === 'cut') { const L = e.r * Math.min(1, q * 3), c = Math.cos(e.an), s = Math.sin(e.an); for (let j = -L; j <= L; j++) { const x = Math.round(e.x + c * j), y = Math.round(e.y + s * j); g.set(x, y, WHITE, 5); if (q < 0.5) g.set(x, y + 1, e.mat, 4); } }   // katanans snitt: en vit linje rakt genom fienden
      if (e.kind === 'slash') for (let k = -1; k <= 1; k += 0.08) { const an = k * 1.1, rr = e.r * (0.8 + q * 0.5); g.set(Math.round(e.x + Math.cos(an) * rr), Math.round(e.y + Math.sin(an) * rr), k * k < 0.3 ? WHITE : e.mat, 5); g.set(Math.round(e.x + Math.cos(an) * (rr - 1)), Math.round(e.y + Math.sin(an) * rr), e.mat, 4); }
      return true;
    });
    if (any) g.end({ outline: false, edge: false });
    for (const e of this.fx) if (e.kind === 'proj') {
      // arc = bågens höjd: pilen 6, bomben 38, bulten och kastspjutet flackt. Kastspjutet sticker i fienden (stay) och flyger tillbaka.
      const arc = e.bomb ? 38 : e.javelin ? 8 : e.arrow && !e.bolt ? 6 : 0, tt = now - e.t0;
      let q = Math.min(1, tt / (e.fly || e.dur)), x = lerp(e.x0, e.x1, q), y = lerp(e.y0, e.y1, q) - bump(q) * arc;
      let an = Math.atan2(e.y1 - e.y0 - arc * Math.PI * Math.cos(Math.PI * q), e.x1 - e.x0);      // skottet följer sin båge
      if (e.javelin && tt > e.fly + e.stay && this.hand) { const u = Math.min(1, (tt - e.fly - e.stay) / Math.max(0.01, e.dur - e.fly - e.stay)); x = lerp(e.x1, this.hand[0], u); y = lerp(e.y1, this.hand[1] - 6, u) - bump(u) * 10; an = -Math.PI / 2 + u * 9; }
      g.begin();
      if (e.arrow) drawArrow(g, e.al, x, y, an, now, e.bolt);
      else if (e.knife) { g.push(x, y, an); g.poly([[-3, -1.2], [5, -0.6], [8, 0], [5, 0.6], [-3, 1.2]], e.mat, 4); g.rect(-6, -1, 3, 2, DUST, 2); g.pop(); }   // kniven flyger rakt med spetsen före
      else if (e.star) drawStarShot(g, e.al, e.mat, x, y, now);                                                                // stjärnan snurrar
      else if (e.javelin) { g.push(x, y, an); g.thick(-15, 0, 6, 0, 1.5, AC.wood, 3); g.poly([[5, -2], [11, 0], [5, 2]], e.mat, 5); g.poly([[-15, -2.5], [-11, 0], [-15, 2.5]], RED, 4); g.pop(); }   // kastspjutet (v22)
      else if (e.bomb) { const k = Math.floor(now * 12) % 2; g.ell(x, y, 3.6, 3.6, SHADOW); g.ell(x, y, 3.6, 3.6, e.mat, false, (dx, dy) => Math.abs(dy) < 0.3, 4); g.dot(Math.round(x + 2), Math.round(y - 4), k ? SPARK : RED, 5); g.dot(Math.round(x - 1), Math.round(y - 2), WHITE, 5); }   // bomben med stubin (v22)
      else g.ell(x, y, e.r, e.r, e.mat);
      g.end();
      if (e.arrow || e.al) arrowTrail(this.fx, e.al, x, y, an, now);
      else if (Math.random() < 0.8) this.fx.push({ kind: 'p', t0: now, dur: 0.25, x: x - 3, y: y + (Math.random() - 0.5) * e.r, vx: -20, vy: 0, rp: e.mat, lv: 5 });
      if (lk && lk.trail) SFX.trailPush(this.sk, [x, y], [x - 1, y], now);
    }
    if (lk || this.fx.some((e) => e.kind === 'sk')) this.fx = this.fx.filter((e) => e.kind !== 'sk' || SFX.drawFx(g, e, now, this.sk));
    g.paint(this.ctx);
  }
}
