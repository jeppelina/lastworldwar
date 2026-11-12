// Skillträdet: data och rena funktioner. Ingen DOM och ingen ritning här, så filen går att köra i simulatorn (node).
// Fyra vägar med sex steg var. Att LÅSA UPP och att BÄRA är två olika saker:
//   Låsa upp: stegen tas i ordning inom en väg, vägarna blandas fritt (ett steg i varje går bra). Kostar en spark.
//   Bära: varje upplåst steg har en strömbrytare. Stegen är ordnade i sex nivåer (steg 1 i alla vägar är nivå 1 och så
//   vidare), och högst ETT steg per nivå kan vara på, från vilken väg som helst. En nivå får också vara tom.
// Varje nivå håller samma SORTS sak i alla vägar, så att vilka sex som helst passar ihop:
//   1 huvud och blick, 2 kropp och armar, 3 vapnets spår och träff, 4 sällskap eller sak med liten förmån,
//   5 superattack och segerpose, 6 slutdräkt (rygg, axlar, mark).
// Poängen heter sparks (gnistor ur den spruckna boken). Design: docs/research/skilltree.md.
// Kopia av prototypes/skilltree/skills.js. Två saker skiljer: reglerna för sparks läses ur balance.js (K.skill), och
// förmånerna på nivå 4 är avstängda tills K.skill.perks.on slås på (talen står också där).
import { K } from './balance.js';
import { WORLD_IDS, nodeCount } from './rules.js';
import { tierOf } from './words.js';

export const LEVELS = ['Head', 'Body', 'Hit', 'Friend', 'Super', 'Legend'];
// look: vad steget lägger på hjälten när det bärs (läses av skillfx.js). perk: liten regeländring (läses av reglerna
// när K.skill.perks.on är sann, annars av ingen: trädet är bara utseende).
const PK = (K.skill && K.skill.perks) || {};
export const PATHS = [
  { id: 'might', name: 'Might', title: 'the Mighty', hex: '#ff7a1f', nodes: [
    { name: 'Red Band', line: 'A red headband.', look: { band: 1 } },
    { name: 'Strong Arms', line: 'A bit stronger.', look: { build: 1 } },
    { name: 'Heavy Hit', line: 'Your hits crack the ground.', look: { trail: 'might' } },
    { name: 'Champ Belt', line: 'A gold belt.', look: { belt: 1 }, perk: { atkPct: PK.atkPct } },
    { name: 'Quake', line: 'Rocks jump out of the ground.', look: { sup: 'might' } },
    { name: 'Titan', line: 'A cape of hot embers.', look: { titan: 1, build: 2, eyes: 'might' } },
  ] },
  { id: 'magic', name: 'Magic', title: 'the Bright', hex: '#9a6bff', nodes: [
    { name: 'Bright Eyes', line: 'Your eyes glow.', look: { eyes: 'magic' } },
    { name: 'Spark Hands', line: 'Your hands glow.', look: { hands: 1 } },
    { name: 'Star Trail', line: 'Your hits leave stars.', look: { trail: 'magic' } },
    { name: 'Rune Ring', line: 'Flying letters.', look: { runes: 1 }, perk: { superAdd: PK.superAdd } },
    { name: 'Star Rain', line: 'Stars fall from the sky.', look: { sup: 'magic' } },
    { name: 'Spark Mage', line: 'You float on magic.', look: { mage: 1, eyes: 'magic' } },
  ] },
  { id: 'shadow', name: 'Shadow', title: 'the Swift', hex: '#4fe0c0', nodes: [
    { name: 'Dark Hood', line: 'A hood and a cloak.', look: { hood: 1, eyes: 'shadow' } },
    { name: 'Quick Step', line: 'You are so fast.', look: { build: -1, quick: 1 } },
    { name: 'Ghost Cut', line: 'Shadows follow your hits.', look: { trail: 'shadow' } },
    { name: 'Smoke Step', line: 'Smoky feet.', look: { smoke: 1 }, perk: { dodge: PK.dodge } },
    { name: 'Shadow Strike', line: 'You hit from the shadows.', look: { sup: 'shadow' } },
    { name: 'Night Wind', line: 'You are a shadow.', look: { night: 1, eyes: 'shadow' } },
  ] },
  { id: 'druid', name: 'Druid', title: 'the Wild', hex: '#5fd06a', nodes: [
    { name: 'Antler Crown', line: 'A crown with antlers.', look: { antlers: 1 } },
    { name: 'Rune Arms', line: 'Green signs on your arms.', look: { tattoo: 1 } },
    { name: 'Thorn Root', line: 'Roots jump out of the ground.', look: { trail: 'druid' } },
    { name: 'Wolf Spirit', line: 'A wolf by your side.', look: { wolf: 1 }, perk: { healPct: PK.healPct } },
    { name: 'Wild Hunt', line: 'A big stag runs with you.', look: { sup: 'druid' } },
    { name: 'Forest Guardian', line: 'Bark and moss armour.', look: { guardian: 1, eyes: 'druid' } },
  ] },
];
for (const p of PATHS) p.nodes.forEach((n, i) => { n.id = `${p.id}.${i + 1}`; n.path = p.id; n.step = i + 1; });
export const NODES = Object.fromEntries(PATHS.flatMap((p) => p.nodes).map((n) => [n.id, n]));
export const PATH = Object.fromEntries(PATHS.map((p) => [p.id, p]));
export const TOTAL = Object.keys(NODES).length;

// ---------- Poäng ----------
// Tre källor, så att både spelande, bossar och lärande matar trädet. Talen står i balance.js (K.skill):
// levelFirst, levelEvery (första sparken och sedan var N:e nivå), perBoss (första gången varje världs slutboss besegras),
// bookStep, bookTier, bookMax (en spark per bookStep ord som nått bookTier i boken eller bättre, högst bookMax).
export const POINTS = K.skill;
export const pointsFromLevel = (level) => (level < POINTS.levelFirst ? 0 : 1 + Math.floor((level - POINTS.levelFirst) / POINTS.levelEvery));
export const nextPointLevel = (level) => { let l = Math.max(level + 1, POINTS.levelFirst); while (pointsFromLevel(l) === pointsFromLevel(level)) l++; return l; };
export const pointsFromBook = (words) => Math.min(POINTS.bookMax, Math.floor((words || 0) / POINTS.bookStep));
// src: { level, bosses, bookWords, bonus } där bookWords = antal ord i boken som nått Steel eller bättre och bonus = testknappen.
// Alla tre källorna kan bara växa (nivån sjunker aldrig, en klarad boss förblir klarad, och för boken räknas ordets
// högsta nådda nivå), så antalet sparks minskar aldrig. Aldrig fler än det finns steg i trädet.
export function pointsEarned(src = {}) {
  return Math.min(TOTAL, pointsFromLevel(src.level || 1) + (src.bosses || 0) * POINTS.perBoss + pointsFromBook(src.bookWords) + (src.bonus || 0));
}
// Det sparks räknas ur, läst ur en profil så som adopt() i main.js bygger den: p.level, p.done (värld -> stjärnor per nod)
// och p.words (boken). bosses = världar vars sista nod (slutbossen) är klarad. bookWords = ord vars högsta nådda nivå
// (mt, sjunker aldrig) är bookTier eller bättre. Boken läses som den är, inte genom världarnas innehållsfiler: då kan
// en fil som inte gick att hämta aldrig ta bort en spark.
export const sparkSrc = (p) => ({ level: p.level || 1,
  bosses: WORLD_IDS.filter((id, k) => ((p.done || {})[id] || [])[nodeCount(k) - 1] > 0).length,
  bookWords: Object.values(p.words || {}).filter((r) => Math.max(r.mt || 0, tierOf(r)) >= POINTS.bookTier).length });
// Var sparksen kommer ifrån, för skärmen och testerna.
export const pointsBreakdown = (src = {}) => ({ level: pointsFromLevel(src.level || 1), bosses: (src.bosses || 0) * POINTS.perBoss, book: pointsFromBook(src.bookWords), earned: pointsEarned(src) });

// ---------- Tillstånd ----------
// got: upplåsta steg i den ordning de togs. worn: nivå (1 till 6) -> stegets id, bara för nivåer där något är på.
export const fresh = () => ({ got: [], worn: {} });
export const depth = (st, pathId) => st.got.filter((id) => NODES[id].path === pathId).length;
export const has = (st, id) => st.got.includes(id);
export const isWorn = (st, id) => !!NODES[id] && st.worn[NODES[id].step] === id;
export const spent = (st) => st.got.length;

// Får steget låsas upp? earned = pointsEarned(...). why: 'have' (har redan), 'order' (föregående steg saknas), 'points' (inga sparks kvar).
export function canPick(st, id, earned) {
  const n = NODES[id];
  if (!n) return { ok: false, why: 'unknown' };
  if (has(st, id)) return { ok: false, why: 'have' };
  if (n.step !== depth(st, n.path) + 1) return { ok: false, why: 'order' };
  if (spent(st) >= earned) return { ok: false, why: 'points' };
  return { ok: true };
}
// Ett nytt steg sätts på direkt (och tar nivåns plats), så att det man just valde alltid syns.
export function pick(st, id, earned) { return canPick(st, id, earned).ok ? { got: [...st.got, id], worn: { ...st.worn, [NODES[id].step]: id } } : st; }
// Bära: bara upplåsta steg. Det som redan satt på samma nivå stängs av.
export function wear(st, id) { return has(st, id) ? { got: st.got, worn: { ...st.worn, [NODES[id].step]: id } } : st; }
export function unwear(st, level) { if (!st.worn[level]) return st; const worn = { ...st.worn }; delete worn[level]; return { got: st.got, worn }; }
export const toggle = (st, id) => (isWorn(st, id) ? unwear(st, NODES[id].step) : wear(st, id));
// Lämna tillbaka går bara på vägens översta steg, så att ordningen alltid håller. Bars steget stängs nivån av.
export const canUnpick = (st, id) => has(st, id) && NODES[id].step === depth(st, NODES[id].path);
export function unpick(st, id) { if (!canUnpick(st, id)) return st; const out = isWorn(st, id) ? unwear(st, NODES[id].step) : st; return { got: out.got.filter((x) => x !== id), worn: out.worn }; }
export const respec = () => fresh();
// Tillståndet som det skulle se ut om steget bars (för att prova innan man låser upp).
export function preview(st, id) { return { got: st.got, worn: { ...st.worn, [NODES[id].step]: id } }; }

// ---------- Härlett: utseende, förmåner, titel ----------
// Utseendet läggs ihop från de burna stegen, nivå 1 först. Två saker kan komma från flera nivåer:
//   eyes: nivå 1 äger blicken. Slutdräktens ögon gäller bara om nivå 1 inte har sagt något.
//   build: störst vinner (Strong Arms 1, Titan 2). Smal (-1) gäller bara om inget annat finns.
export function looks(st) {
  const lk = { any: false, worn: {} }; let build = 0;
  for (let level = 1; level <= 6; level++) {
    const n = NODES[st.worn[level]]; if (!n) continue;
    lk.any = true; lk.worn[level] = n.path;
    for (const [k, v] of Object.entries(n.look)) {
      if (k === 'build') { if (v > 0) build = Math.max(build, v); else if (build === 0) build = v; }
      else if (k === 'eyes') { if (lk.eyes === undefined) lk.eyes = v; }
      else lk[k] = v;
    }
  }
  lk.build = build; lk.pose = lk.worn[5] || null;                                      // segerposen hör till superattacken på nivå 5
  return lk;
}
// Förmånen hör till det burna steget på nivå 4. Det kan alltså aldrig vara mer än EN förmån aktiv.
// Varje tal har dessutom ett tak här, så att en framtida nod inte kan råka bli stor.
// AVSTÄNGT: så länge K.skill.perks.on är falsk ger perks() bara nollor, och ingen regel i rules.js läser dem ännu.
// Talen måste mätas om mot den nuvarande balansen innan de slås på (se anteckningen vid K.skill.perks i balance.js).
export const PERK_CAP = { atkPct: 3, superAdd: 0.1, dodge: 0.5, healPct: 2 };
export const perksOn = () => !!PK.on;
export function perks(st) {
  const out = { atkPct: 0, superAdd: 0, dodge: 0, healPct: 0 }, n = NODES[st.worn[4]];
  if (!perksOn()) return out;
  for (const [k, v] of Object.entries((n && n.perk) || {})) out[k] = Math.min(PERK_CAP[k], v);
  return out;
}
// Hjältens värden med förmånen inräknad. stats = heroStats(profile) ur catalog.js. Bara attacken ändras här,
// resten följer med som run.perks och används av reglerna: superAdd läggs på K.superMult, dodge = andel av skadan som
// försvinner på nedräkningens första slag i en omgång (aldrig på slag efter fel svar), healPct = andel av maxlivet som
// kommer tillbaka efter varje slagen fiende i omgången.
export function applyPerks(stats, pk) { return { ...stats, atk: stats.atk + (pk.atkPct ? Math.max(1, Math.round(stats.atk * pk.atkPct / 100)) : 0), perks: pk }; }
// Titeln under namnet: slutdräktens väg (med stjärna), annars den väg som har minst tre burna steg.
export function title(st) {
  const cap = NODES[st.worn[6]]; if (cap) return { text: PATH[cap.path].title, star: true, path: cap.path };
  const count = {}; for (const id of Object.values(st.worn)) count[NODES[id].path] = (count[NODES[id].path] || 0) + 1;
  const best = PATHS.find((p) => count[p.id] >= 3);
  return best ? { text: best.title, star: false, path: best.id } : null;
}

// ---------- Händelseloggen ----------
// Händelsetypen 'skill' med payload:
//   { op: 'pick', node }     lås upp (och sätt på)
//   { op: 'wear', node }     sätt på ett upplåst steg
//   { op: 'unwear', level }  stäng av nivån
//   { op: 'unpick', node }   lämna tillbaka vägens översta steg
//   { op: 'respec' }         lämna tillbaka allt
// Samma regel som fold() i sync.js: spela upp i ordningen (ts, id), hoppa över det som inte går.
// Antalet sparks kontrolleras mot vad barnet har tjänat NU (talet minskar aldrig, så det är aldrig strängare än
// kontrollen i stunden). Väljer två enheter var sitt steg för samma spark vinner den tidigaste, den andra hamnar i
// rejected och kan visas som ett litet meddelande. Två wear på samma nivå: den senaste vinner, som för utrustning.
export function foldSkills(events, earned = TOTAL) {
  const evs = events.filter((e) => e.type === 'skill').sort((a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let st = fresh(); const rejected = [];
  for (const e of evs) {
    const p = e.payload || {}, id = String(p.node || '');
    if (p.op === 'respec') st = fresh();
    else if (p.op === 'wear') st = wear(st, id);
    else if (p.op === 'unwear') st = unwear(st, +p.level || 0);
    else if (p.op === 'unpick') st = unpick(st, id);
    else if (p.op === 'pick') { if (has(st, id)) continue; const r = canPick(st, id, earned); if (r.ok) st = pick(st, id, earned); else rejected.push({ id: e.id, node: id, why: r.why }); }
  }
  return { ...st, rejected };
}
