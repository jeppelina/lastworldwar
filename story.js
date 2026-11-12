// Berättelsen: korta stunder där kejsaren (The Emperor) visar sig. Här står bara tabellen och reglerna, utan DOM,
// så att node-testerna kan köra filen. Bilderna ligger i story-scenes.js (helskärm) och map/story.js (på kartan).
// Underlag: docs/pedagogik/story.md (tillägget om kejsaren: ett ständigt hot som alltid är långt borta, kartan som
// sakta förändras, huvudberättelsen går långsamt).
//
// REGLER
//   - En stund är en godbit på fem till femton sekunder. Den tar aldrig något från barnet och går alltid att trycka förbi.
//   - Den utlöses av verkliga framsteg (klarade banor, slagna bossar, ord som blivit starka), aldrig av tid.
//   - Högst EN stund åt gången, och minst `gap` vunna strider mellan två stunder (K.story.gap, eller stundens eget tal,
//     aldrig mindre än en).
//   - Vilka stunder ett barn har sett sparas som händelser av typen 'story' i synkloggen:
//       { op: 'seen', id }   med engångsnyckeln 'story:<id>:<omgång>', så att två enheter skriver samma rad
//       { op: 'reset' }      föräldern nollställer: allt glöms och omgången räknas upp (då gäller nya nycklar)
//     fold() i sync.js känner inte typen och hoppar över den, liksom äldre klienter. Guld, xp och banor rörs aldrig.
//   - Det som ändras på kartan (brännmärket, flaggan, ballongen i trädet) räknas fram ur de sedda stunderna (decor).
//
// LÄGG TILL EN STUND: en ny rad i MOMENTS. Fälten:
//   id       får aldrig ändras eller återanvändas (det står i barnens händelser)
//   sv       kort svenskt namn till föräldraskärmen
//   where    'map' (spelas på kartan, bilden finns i map/story.js) eller 'full' (helskärm, story-scenes.js)
//   scene    bildens namn i den filen
//   line     [engelska, svenska] eller null. Kort. audio = ett befintligt klipp som säger exakt den engelska raden.
//   dur      sekunder om ingen trycker
//   on       var den får börja: 'enter' (barnet väljs på profilväljaren) och 'win' (efter en vunnen bana eller boss)
//   Villkor (alla som anges måste gälla). world = index för världen som levels, atBoss och boss gäller:
//     levels: n        minst n klarade vanliga banor i världen
//     atBoss: 'shut'   barnet står vid världens boss och ordmätaren är stängd ('open' = mätaren är öppen)
//     boss: true       världens boss är slagen
//     strong: n        minst n ord i boken är Steel eller bättre
//     after: id        en annan stund är sedd
//   gap      eget avstånd i vunna strider sedan förra stunden (annars K.story.gap)
//   decor    [världens id, sak] som finns kvar på kartan när stunden är sedd (ritas i map/story.js)
// Ordningen i listan är förtur: den första stunden som är osedd och uppfyller sina villkor spelas.
import { K, nodes as NODES } from './balance.js';

export const MOMENTS = [
  // ----- Nyckelstunder: hör ihop med bossen och ska komma när barnet står där -----
  { id: 'w1-gate', sv: 'Bossens port', world: 0, where: 'map', scene: 'gate', atBoss: 'shut', gap: 1, dur: 7,
    line: ['Make your words strong. Then the gate opens.', 'Gör dina ord starka. Då öppnas porten.'] },
  { id: 'w1-troll-why', sv: 'Trollet och stjärnbiten', world: 0, where: 'full', scene: 'trollWhy', atBoss: 'open', gap: 1, dur: 8,
    line: ['The Troll found a star piece. It took the words.', 'Trollet hittade en stjärnbit. Den tog orden.'] },
  { id: 'w1-troll-won', sv: 'Kejsaren blir arg', world: 0, where: 'full', scene: 'emperorAngry', boss: true, gap: 1, dur: 9,
    line: ['You helped the Troll. The Emperor is not happy!', 'Du hjälpte trollet. Kejsaren är inte glad!'], decor: ['ordskogen', 'scorch'] },
  { id: 'w2-sphinx-won', sv: 'Kejsaren tar skylten', world: 1, where: 'full', scene: 'steal', boss: true, gap: 1, dur: 9,
    line: ['Hey! He took the signpost!', 'Hallå! Han tog skylten!'], decor: ['soloknen', 'flag'] },
  // ----- Stunder längs vägen -----
  { id: 'w1-airship', sv: 'Luftskeppet', world: 0, where: 'map', scene: 'airship', levels: 2, dur: 8,
    line: ['He has one star. He wants three.', 'Han har en stjärna. Han vill ha tre.'], audio: 'audio/intro/star.mp3' },
  { id: 'w1-peeper', sv: 'Spanaren i ballongen', world: 0, where: 'map', scene: 'peeper', levels: 5, dur: 7,
    line: ['A scout! He is watching us.', 'En spanare! Han tittar på oss.'], decor: ['*', 'watch'] },
  { id: 'w1-peeper-off', sv: 'Spanaren ger sig av', world: 0, where: 'map', scene: 'peeperOff', after: 'w1-peeper', on: ['win'], gap: 1, dur: 5,
    line: ['Bye bye, scout!', 'Hej då, spanaren!'], decor: ['ordskogen', 'balloon'] },
  { id: 'spy-1', sv: 'Kikaren (15 starka ord)', world: 0, where: 'map', scene: 'spy', strong: 15, dur: 8,
    line: ['Look! Tap him!', 'Titta! Tryck på honom!'] },
  { id: 'w2-march', sv: 'Kejsarens armé', world: 1, where: 'full', scene: 'march', levels: 1, dur: 9,
    line: ["The Emperor's army! They want the words too.", 'Kejsarens armé! De vill också ha orden.'] },
  { id: 'spy-2', sv: 'Kikaren (40 starka ord)', world: 1, where: 'map', scene: 'spy', strong: 40, levels: 3, dur: 8,
    line: ['He is back! Tap him!', 'Han är tillbaka! Tryck på honom!'] },
  { id: 'w3-lugg', sv: 'Jätten sover', world: 2, where: 'full', scene: 'lugg', levels: 3, dur: 9,
    line: ['Shh! The giant is sleeping.', 'Sch! Jätten sover.'], decor: ['svamptrasket', 'tracks'] },
  { id: 'spy-3', sv: 'Kikaren (70 starka ord)', world: 2, where: 'map', scene: 'spy', strong: 70, levels: 6, dur: 8,
    line: ['There he is! Tap him!', 'Där är han! Tryck på honom!'] },
];
export const BY_ID = Object.fromEntries(MOMENTS.map((m) => [m.id, m]));
// Stunden som släpper in kejsarens armé i vanliga banor (K.story.army i balance.js).
export const ARMY_AFTER = 'w2-march';
// Saker som finns på kartan från början, tills en stund byter ut dem: skylten som kejsaren tar, trädet där ballongen fastnar.
export const DECOR_START = { ordskogen: ['tree'], soloknen: ['sign'] };
const DECOR_SWAP = { balloon: 'tree', flag: 'sign' };

// ---------- Det barnet har sett: räknas ur profilens händelser, i loggens ordning ----------
// seen: id -> ordningstal (1 = första stunden i den här omgången). wins: vunna strider sedan den senaste stunden
// (eller sedan början om ingen är sedd). gen: antal nollställningar, ingår i engångsnyckeln.
export function foldStory(events) {
  let seen = {}, n = 0, wins = 0, gen = 0;
  for (const e of events || []) {
    const p = e.payload || {};
    if (e.type === 'stage') { if (p.win && p.kind === 'battle') wins++; continue; }
    if (e.type !== 'story') continue;
    if (p.op === 'reset') { seen = {}; n = 0; gen++; }
    else if (p.op === 'seen' && typeof p.id === 'string' && !seen[p.id]) { seen[p.id] = ++n; wins = 0; }      // okända id sparas men spelas aldrig
  }
  return { seen, count: n, wins, gen };
}
export const fresh = () => foldStory([]);
export const onceKey = (st, id) => `story:${id}:${(st && st.gen) || 0}`;

// ---------- Villkoren ----------
// Världens banor ur balance.js: en nod med rek är en bana, den sista är bossen. done = P.done (världens id -> lista).
const WORLD_IDS = Object.keys(NODES.rec);
function worldFacts(k, done) {
  const id = WORLD_IDS[k], recs = NODES.rec[id] || [], d = (done || {})[id] || [], boss = recs.length - 1;
  let levels = 0, before = true;
  for (let i = 0; i < boss; i++) { if (recs[i] != null && d[i]) levels++; if (!d[i]) before = false; }
  return { levels, boss: !!d[boss], atBoss: boss >= 0 && before && !d[boss] };
}
// c: { on, done, strong, gateOpen(k) }. Säger om stundens villkor gäller (utan hänsyn till om den är sedd eller till avståndet).
export function ready(m, c, st) {
  if (m.on && c.on && !m.on.includes(c.on)) return false;
  if (m.after && !(st.seen || {})[m.after]) return false;
  if (m.strong != null && !((c.strong || 0) >= m.strong)) return false;
  if (m.levels != null || m.atBoss || m.boss) {
    const f = worldFacts(m.world || 0, c.done);
    if (m.levels != null && f.levels < m.levels) return false;
    if (m.boss && !f.boss) return false;
    if (m.atBoss) { if (!f.atBoss) return false; const open = c.gateOpen ? !!c.gateOpen(m.world || 0) : true; if ((m.atBoss === 'open') !== open) return false; }
  }
  return true;
}
// Avståndet: den allra första stunden behöver inget, sedan minst en vunnen strid emellan.
export const gapOf = (m) => Math.max(1, m.gap != null ? m.gap : (K.story && K.story.gap) || 1);
// Högst EN stund: den första i tabellen som är osedd, vars villkor gäller och som ligger tillräckligt långt efter den förra.
export function due(st, c, table = MOMENTS) {
  st = st || fresh();
  for (const m of table) {
    if (st.seen[m.id] || !ready(m, c, st)) continue;
    if (st.count > 0 && st.wins < gapOf(m)) continue;
    return m;
  }
  return null;
}

// ---------- Det som följer av de sedda stunderna ----------
// Kartans dekor: världens id -> lista med saker. watch = spanarens ballong svävar vid hjälten (tills den har gett sig av).
export function decor(st, table = MOMENTS) {
  const seen = (st && st.seen) || {}, out = {}; let watch = false;
  for (const [w, list] of Object.entries(DECOR_START)) out[w] = [...list];
  for (const m of table) {
    if (!m.decor || !seen[m.id]) continue;
    const [w, kind] = m.decor;
    if (kind === 'watch') { watch = true; continue; }
    const list = out[w] || (out[w] = []), old = DECOR_SWAP[kind] ? list.indexOf(DECOR_SWAP[kind]) : -1;
    if (old >= 0) list.splice(old, 1);
    if (!list.includes(kind)) list.push(kind);
  }
  if (seen['w1-peeper-off']) watch = false;
  return { decor: out, watch };
}
// Kejsarens armé får dyka upp i vanliga banor först när trupperna har visat sig.
export const armyOn = (st) => !!(st && st.seen && st.seen[ARMY_AFTER] && K.story && K.story.army && K.story.army.chance > 0);
// Det rules.buildRun behöver. pool = arméns fiender (enemies-new.js, world -1). chance kan sättas av en testkrok.
export const armyFor = (st, pool, chance) => (armyOn(st) && pool && pool.length ? { pool, chance: chance != null ? chance : K.story.army.chance, max: K.story.army.max } : null);
