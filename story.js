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
// ----- Andra lagret (2026-11-16): korta händelser på kartan (BEATS) -----
// Samma fält och samma händelser som MOMENTS ({ op: 'seen', id }, engångsnyckeln 'story:<id>:<omgång>'), och samma
// avstånd: en händelse räknas som en stund, så högst EN av dem (stund eller händelse) per K.story.gap vunna strider.
// Stunderna i MOMENTS går alltid före. Alla spelas på kartan, med en rad och högst en svensk stödrad.
//   here: true   spelas bara när barnet tittar på händelsens värld (annars väntar den, inget bokförs)
// En äldre klient sparar id:t bland sedda men spelar det aldrig (den känner bara MOMENTS).
export const BEATS = [
  // Word Forest
  { id: 'b1-page-map', sv: 'Page läser kartan upp och ner', world: 0, where: 'map', scene: 'pageMap', here: true, levels: 3, dur: 6,
    line: ['Page reads the map. Upside down!', 'Page läser kartan. Upp och ner!'] },
  { id: 'b1-sack', sv: 'Stjärnsnapparna tappar en säck', world: 0, where: 'map', scene: 'snatchers', here: true, levels: 4, dur: 7,
    line: ['Star Snatchers! They dropped a bag.', 'Stjärnsnappare! De tappade en säck.'], decor: ['ordskogen', 'sack'] },
  { id: 'b1-lantern', sv: 'Lyktan tänds', world: 0, where: 'map', scene: 'lantern', here: true, levels: 7, dur: 6,
    line: ['Your words light the lantern!', 'Dina ord tänder lyktan!'], decor: ['ordskogen', 'lantern'] },
  { id: 'b-page-new', sv: 'Page får en ny sida (25 starka ord)', world: 0, where: 'map', scene: 'pageNew', strong: 25, dur: 6,
    line: ['Strong words! Page has a new page.', 'Starka ord! Page har fått en ny sida.'] },
  // Sun Desert
  { id: 'b2-dig', sv: 'Clunk gräver och hittar en sko', world: 1, where: 'map', scene: 'dig', here: true, levels: 3, dur: 8,
    line: ['Clunk digs for a star. He finds a shoe!', 'Clunk gräver efter en stjärna. Han hittar en sko!'], decor: ['soloknen', 'hole'] },
  { id: 'b2-camel', sv: 'Björnen som är en kamel', world: 1, where: 'map', scene: 'camel', here: true, levels: 5, dur: 7,
    line: ['I am not a bear. I am a camel!', 'Jag är ingen björn. Jag är en kamel!'] },
  { id: 'b2-crate', sv: 'Kejsaren tappar en låda', world: 1, where: 'map', scene: 'crate', here: true, levels: 7, dur: 7,
    line: ['The Emperor dropped a box. Oops!', 'Kejsaren tappade en låda. Hoppsan!'], decor: ['soloknen', 'crate'] },
  // Mushroom Swamp
  { id: 'b3-snore', sv: 'Jätten snarkar', world: 2, where: 'map', scene: 'snore', here: true, levels: 5, after: 'w3-lugg', dur: 6,
    line: ['Zzz... The giant is still asleep.', 'Zzz... Jätten sover fortfarande.'] },
  { id: 'b3-bridge', sv: 'Bron blir lagad', world: 2, where: 'map', scene: 'bridge', here: true, levels: 6, dur: 6,
    line: ['You fixed the bridge!', 'Du lagade bron!'], decor: ['svamptrasket', 'bridge'] },
  { id: 'b3-star', sv: 'En stjärnbit faller långt bort', world: 2, where: 'map', scene: 'starFall', here: true, levels: 8, dur: 6,
    line: ['A star piece! It fell far away.', 'En stjärnbit! Den föll långt bort.'] },
  // Världarna efter (några få, så att de inte är tomma)
  { id: 'b4-snowman', sv: 'Snögubben tappar näsan', world: 3, where: 'map', scene: 'snowman', here: true, levels: 2, dur: 7,
    line: ['Oh no! His nose fell off.', 'Åh nej! Hans näsa ramlade av.'], decor: ['frostbergen', 'snowman'] },
  { id: 'b4-achoo', sv: 'Kejsaren nyser', world: 3, where: 'map', scene: 'achoo', here: true, levels: 6, dur: 7,
    line: ['Achoo! The Emperor is cold.', 'Atjo! Kejsaren fryser.'] },
  { id: 'b5-camp', sv: 'Arméns läger', world: 4, where: 'map', scene: 'camp', here: true, levels: 3, dur: 7,
    line: ['The army made a camp here. Shh!', 'Armén har slagit läger här. Sch!'], decor: ['meningsvulkanen', 'camp'] },
  { id: 'b6-page', sv: 'En borttappad sida', world: 5, where: 'map', scene: 'lostPage', here: true, levels: 3, dur: 7,
    line: ['A lost page! It belongs to Page.', 'En borttappad sida! Den hör till Page.'] },
];
export const BY_ID = Object.fromEntries([...MOMENTS, ...BEATS].map((m) => [m.id, m]));
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
  if (m.here && c.here != null && c.here !== (m.world || 0)) return false;      // händelsen hör till en annan värld än den som syns
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
// Först en stund ur MOMENTS, annars en händelse ur BEATS. Samma avstånd gäller för båda (de räknas ihop i foldStory).
export const dueAny = (st, c) => due(st, c, MOMENTS) || due(st, c, BEATS);

// ---------- Andra lagret: spår som ligger kvar på kartan ----------
// Ett spår bokförs tyst (ingen bild, ingen rad, inget avstånd) så fort dess villkor gäller, som en händelse av typen 'story':
//   { op: 'trace', id, w? }  engångsnyckeln 'story:t:<id>:<omgång>'. w = världens id för blommorna (där barnet var).
// foldStory ser inte op 'trace', och en äldre klient hoppar över den helt. Nollställning glömmer spåren också; de som
// bygger på framsteg kommer då tillbaka direkt, de som en händelse lämnat kommer när händelsen setts igen.
// Kistan som barnet trycker upp bokförs på samma sätt med id 'open-<värld>' (värld 1 till 3).
const HP = () => K.happen || {};
// Världens dag (Stockholm, ungefär: sommartiden spelar ingen roll för att räkna speldagar).
export const dayNo = (ts) => (Number.isFinite(ts) ? Math.floor((ts + 3600e3) / 864e5) : null);
export const TRACES = (() => {
  const out = [], h = HP();
  WORLD_IDS.forEach((w, k) => {
    out.push({ id: `flag-${k + 1}`, sv: 'Hjältens flagga vid bossen', world: k, kind: 'heroFlag', boss: true });
    out.push({ id: `statue-${k + 1}`, sv: 'Staty av hjälten', world: k, kind: 'statue', boss: true, bossDays: h.statueDays || 1 });
  });
  out.push({ id: 'lantern-dark', sv: 'En släckt lykta', world: 0, kind: 'lanternDark', levels: 5 });
  out.push({ id: 'bridge-broken', sv: 'En trasig bro', world: 2, kind: 'bridgeOld', levels: 2 });
  for (let k = 0; k < 3; k++) out.push({ id: `chest-${k + 1}`, sv: 'En hittad kista', world: k, kind: 'chest', levels: h.chestLevels || 3, days: h.chestDays || 3 });
  for (let n = 1; n <= (h.bloomMax || 8); n++) out.push({ id: `bloom-${n}`, sv: 'En blomma', kind: 'bloom', strong: n * (h.bloomEvery || 10) });
  return out;
})();
// Kistornas innehåll: bara ett skämt, aldrig guld eller saker (det skulle ändra balansen).
export const CHEST_JOKE = ['A sock! Just one sock.', 'A rubber duck! Quack.', 'A paper crown!'];
export const openId = (k) => `open-${k + 1}`;
export const traceKey = (tr, id) => `story:t:${id}:${(tr && tr.gen) || 0}`;

// Spåren och det som villkoren behöver ur loggen: speldagar, första striden per värld och dagen då bossen slogs.
export function foldTraces(events) {
  let got = {}, gen = 0; const days = new Set(), first = {}, boss = {};
  for (const e of events || []) {
    const p = e.payload || {};
    if (e.type === 'stage') {
      const d = dayNo(e.ts); if (d == null) continue;
      days.add(d);
      if (typeof p.world === 'string') {
        if (!(first[p.world] <= d)) first[p.world] = d;
        const recs = NODES.rec[p.world];
        if (p.win && recs && p.node === recs.length - 1 && !(boss[p.world] <= d)) boss[p.world] = d;
      }
      continue;
    }
    if (e.type !== 'story') continue;
    if (p.op === 'reset') { got = {}; gen++; }
    else if (p.op === 'trace' && typeof p.id === 'string' && !got[p.id]) got[p.id] = { w: typeof p.w === 'string' ? p.w : null };
  }
  return { got, gen, days: [...days].sort((a, b) => a - b), first, boss };
}
// c som för due, plus today (dayNo för i dag, så att statyn syns redan när barnet kommer in nästa dag).
function traceReady(t, c, tr) {
  if (!ready(t, c, { seen: {} })) return false;
  const wid = WORLD_IDS[t.world || 0], days = new Set(tr.days); if (c.today != null) days.add(c.today);
  if (t.days != null) { const f = tr.first[wid]; if (f == null || [...days].filter((d) => d >= f).length < t.days) return false; }
  if (t.bossDays != null) { const b = tr.boss[wid]; if (b == null || [...days].filter((d) => d > b).length < t.bossDays) return false; }
  return true;
}
// Spåren som ska bokföras nu (i tabellens ordning). Aldrig fler än tabellen har, och ett spår bokförs en gång per omgång.
export const pendingTraces = (c, tr) => TRACES.filter((t) => !(tr.got || {})[t.id] && traceReady(t, c, tr));

// Allt som ligger på kartan: första lagrets dekor (decor) plus spåren och det som händelserna i BEATS lämnat.
// bloom: världens id -> antal blommor (högst K.happen.bloomMax).
const SWAP2 = { lantern: 'lanternDark', bridge: 'bridgeOld', chestOpen: 'chest' };
export function decorAll(st, tr) {
  const d = decor(st), out = d.decor, got = (tr && tr.got) || {}, seen = (st && st.seen) || {}, bloom = {};
  const add = (w, kind) => { const list = out[w] || (out[w] = []), old = SWAP2[kind] ? list.indexOf(SWAP2[kind]) : -1; if (old >= 0) list.splice(old, 1); if (!list.includes(kind)) list.push(kind); };
  for (const t of TRACES) {
    if (!got[t.id]) continue;
    if (t.kind === 'bloom') { const w = got[t.id].w && NODES.rec[got[t.id].w] ? got[t.id].w : WORLD_IDS[0]; bloom[w] = Math.min(HP().bloomMax || 8, (bloom[w] || 0) + 1); continue; }
    add(WORLD_IDS[t.world], t.kind);
  }
  for (let k = 0; k < 3; k++) if (got[openId(k)] && got[`chest-${k + 1}`]) add(WORLD_IDS[k], 'chestOpen');
  for (const m of BEATS) if (m.decor && seen[m.id]) add(m.decor[0], m.decor[1]);
  for (const w of Object.keys(bloom)) add(w, 'garden');
  return { decor: out, watch: d.watch, bloom };
}
// Alla saker som någon gång kan stå i en värld, så att kartan kan ge dem platser i en fast ordning (de flyttar inte när
// en ny sak tillkommer). Världens id -> lista med saker.
export function decorKeys() {
  const out = {}, add = (w, k) => { const l = out[w] || (out[w] = []); if (!l.includes(k)) l.push(k); };
  for (const [w, list] of Object.entries(DECOR_START)) list.forEach((k) => add(w, k));
  for (const m of [...MOMENTS, ...BEATS]) if (m.decor && m.decor[0] !== '*') add(m.decor[0], m.decor[1]);
  for (const t of TRACES) { if (t.kind === 'bloom') WORLD_IDS.forEach((w) => add(w, 'garden')); else add(WORLD_IDS[t.world], t.kind); }
  for (let k = 0; k < 3; k++) add(WORLD_IDS[k], 'chestOpen');
  return out;
}
