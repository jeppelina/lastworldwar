// Ordens styrka. Räknas i bakgrunden efter varje svar och syns som färg i boken, från Wood till Neutron Star.
// Två saker krävs för att ett ord ska stiga: poäng (rätt svar, svårare övningar ger mer) och antal olika dagar
// man svarat rätt. Det går alltså inte att nöta upp ett ord till toppen på en kväll.

export const TIERS = [
  { name: 'Wood', color: '#a9743f', ink: '#2a1a0a' }, { name: 'Iron', color: '#8793a3', ink: '#10151c' }, { name: 'Steel', color: '#c3d0de', ink: '#182230' },
  { name: 'Gold', color: '#f2b632', ink: '#3a2600' }, { name: 'Emerald', color: '#2fbf71', ink: '#062a16' }, { name: 'Crystal', color: '#ee7fd8', ink: '#3a0a32' },
  { name: 'Star', color: '#fff0a0', ink: '#4a3a00' }, { name: 'Neutron Star', color: '#9fe8ff', ink: '#06283a' },
];
const NEED_SCORE = [0, 3, 5, 12, 18, 26, 36, 50];     // poäng som krävs för varje nivå
const NEED_DAYS = [0, 1, 1, 2, 3, 5, 7, 10];          // Steel går att nå första dagen (2026-11-12). Från Gold krävs flera dagar.         // antal olika dagar med rätt svar som krävs
const INTERVAL = [1, 1, 2, 3, 5, 8, 13, 21];          // dagar tills ordet vill repeteras igen, per nivå

// Hur mycket ett rätt svar är värt per övningstyp: känna igen < koppla ord och skrift < plocka fram < stava.
export const WEIGHT = { listen_pick_picture: 1, true_false: 1, picture_pick_word: 1.5, listen_pick_word: 1.5, read_pick_picture: 1.5, en_to_sv: 1.5, sv_to_en: 2, sentence_gap: 2, missing_letter: 2.5, spell_tiles: 3, build_sentence: 3 };

// Bossarnas egna uppgifter (game/boss/) bokförs som vanliga stridssvar, med vikten för en övningstyp som redan finns.
// Därför räknar en äldre klient ordboken exakt likadant. Bossuppgiftens eget namn sparas bara i svarsloggen.
//   bildkort (känna igen ordet, med bild eller på ljud)  -> listen_pick_picture, vikt 1
//   ordkort som ska läsas efter att ordet har hörts       -> listen_pick_word, vikt 1,5
//   skrivna ord eller ledtrådar som ska leda till en bild -> read_pick_picture, vikt 1,5
// Ingen bossuppgift ger mer än 1,5: i trollets sista fas bokförs två eller tre ord i samma uppgift, och sfinxens bilduppgifter
// går delvis att lösa på bilderna. (Designnoten föreslog 1,5 och 3 för trollets fas 2 och 3. Det här är med flit lägre.)
export const BOSS_AS = {
  troll_look: 'listen_pick_picture', troll_listen: 'listen_pick_picture', troll_listen_text: 'listen_pick_word',
  troll_order: 'listen_pick_picture', troll_order_text: 'listen_pick_word',
  sphinx_odd: 'listen_pick_picture', sphinx_pattern: 'listen_pick_picture', sphinx_pattern_text: 'read_pick_picture',
  sphinx_clue: 'listen_pick_picture', sphinx_clue_text: 'read_pick_picture',
};

export const tierOf = (rec) => { if (!rec) return -1; let t = 0; for (let i = 1; i < TIERS.length; i++) if (rec.s >= NEED_SCORE[i] && rec.d >= NEED_DAYS[i]) t = i; return t; };
export const isDue = (rec, day) => !!rec && day - rec.last >= INTERVAL[tierOf(rec)];
// Vad som fattas till nästa nivå, för bokens detaljruta.
export function nextNeed(rec) {
  const t = tierOf(rec); if (t >= TIERS.length - 1) return null;
  return { tier: TIERS[t + 1], score: Math.max(0, Math.ceil(NEED_SCORE[t + 1] - rec.s)), days: Math.max(0, NEED_DAYS[t + 1] - rec.d) };
}

export const STEEL = 2;      // "inlärt för nu": nivån som ordmätaren och kartans räknare använder

// book: { ordId: { s: poäng, d: dagar med rätt, last: senaste dag, ld: senaste dag med rätt, td: rätt i dag, r: rätt totalt, w: fel totalt,
//                  mt: högsta nivå ordet har nått } }
// mt sjunker aldrig, även om poängen gör det. Den finns för att xp för en ordnivå bara ska ges en gång per ord och nivå.
export function meet(book, id, day) { if (!book[id]) book[id] = { s: 0, d: 0, last: day, ld: -1, td: 0, r: 0, w: 0, mt: 0 }; return book[id]; }
// start: försprång. Är det här första gången ordet möts och svaret är rätt får ordet minst så många poäng.
// Spelet ger inget försprång längre (balans v13). Parametern finns kvar för att gamla svar i loggen ska spelas upp exakt som förut.
// Returnerar { before, after, top, up }: nivån före och efter, högsta nivån före svaret, och up = ordet nådde en ny högsta nivå.
export function record(book, id, right, type, day, start = 0) {
  const first = !book[id], rec = meet(book, id, day), before = tierOf(rec);
  if (rec.mt === undefined) rec.mt = Math.max(0, before);    // bok från före balans v2: nivåer som redan nåtts räknas som nådda
  if (rec.last !== day) rec.td = 0;
  rec.last = day;
  if (right) {
    let gain = WEIGHT[type] || 1;
    if (rec.ld !== day) { if (rec.ld >= 0 && day - rec.ld >= INTERVAL[before]) gain *= 2; rec.d++; rec.ld = day; }   // ny dag, och extra om det gått lagom lång tid
    gain /= 1 + 0.25 * rec.td;                                  // avtagande samma dag: första rätta svaret är värt mest
    rec.s += gain; rec.td++; rec.r++;
    if (first && start > 0) rec.s = Math.max(rec.s, start);
  } else { rec.s = Math.max(0, rec.s * 0.75 - 1); rec.w++; }
  const after = tierOf(rec), top = rec.mt;
  if (after > top) rec.mt = after;
  return { before, after, top, up: after > top };
}

// ---------- Svarsloggen i händelser av typen 'words' ----------
// En rad per svar: [ord, övningstyp, 1 rätt | 0 fel | -1 mött utan poäng, försprång]. -1 skrivs för möt-kortet, för ett
// fel svar på en riskfri första fråga och för ett rätt svar som fått hjälp av boken (helped): ordet finns då i boken men
// får inga poäng. Försprånget (fjärde talet) skrivs inte längre (balans v13), men rader som har det spelas upp som förut.
// Formatet är oförändrat, så en äldre klient räknar samma ordbok ur samma rader.
export const logRows = (log) => log.map((l) => [l.id, l.type, (l.free && !l.right) || (l.helped && l.right) ? -1 : l.right ? 1 : 0]);
export function replayRows(book, rows, day) {
  for (const [w, type, r, hs] of rows || []) { if (r < 0) meet(book, w, day); else record(book, w, r > 0, type, day, +hs || 0); }
  return book;
}

// ---------- Ordmätare ----------
// Hur många av orden i en lista som har nått en nivå, och andelen. Används av bossens mätare, kartan och boken.
export const countAt = (book, items, tier = STEEL) => items.filter((it) => tierOf(book[it.id]) >= tier).length;
export const learnedShare = (book, items, tier = STEEL) => (items.length ? countAt(book, items, tier) / items.length : 1);

// Färre ord per värld: behåller bara den första andelen (share) av varje banas nya ord och fraser. Ord som faller bort
// försvinner också ur världens ordlista (alltså ur bossens ord och ur repetitionen), och meningar som använder dem tas bort.
// Innehållet ändras inte, en ny kopia returneras. Används för ung-läget och för K.wordShare i balance.js.
export function thinContent(content, share) {
  if (!(share < 1)) return content;
  const drop = new Set();
  const nodes = content.nodes.map((n) => { const o = { ...n }; for (const key of ['introduce', 'phrases']) { const a = n[key] || [], keep = Math.ceil(a.length * share); a.slice(keep).forEach((id) => drop.add(id)); o[key] = a.slice(0, keep); } return o; });
  const en = new Map(content.items.map((i) => [String(i.en).toLowerCase(), i.id]));
  const uses = (s) => (s.uses && s.uses.length ? s.uses : [...new Set((s.tiles || []).map((t) => en.get(String(t).toLowerCase().replace(/[^a-z' ]/g, ''))).filter(Boolean))]);
  const gone = new Set((content.sentences || []).filter((s) => uses(s).some((u) => drop.has(u))).map((s) => s.id));
  for (const n of nodes) n.sentences = (n.sentences || []).filter((id) => !gone.has(id));
  return { ...content, nodes, items: content.items.filter((i) => !drop.has(i.id)), sentences: (content.sentences || []).filter((s) => !gone.has(s.id)) };
}

// Vilka övningar som passar ordet just nu. Ord med bild börjar med att lyssna och peka; ord utan bild börjar
// med svensk översättning. Högre nivå ger övningar som kräver mer: läsa, översätta åt andra hållet, stava.
export function tasksFor(item, rec, reading = true) {
  if (!reading) {      // barn som inte läser än: nästan bara bilder. Skrivna ord bara med två val.
    const t0 = Math.max(0, tierOf(rec));
    if (!item.pic) return ['en_to_sv'];
    return t0 === 0 ? ['listen_pick_picture'] : t0 < 3 ? ['listen_pick_picture', 'listen_pick_picture', 'true_false'] : ['listen_pick_picture', 'listen_pick_picture', 'true_false', 'picture_pick_word'];
  }
  const t = Math.max(0, tierOf(rec)), pic = !!item.pic, phrase = item.pos === 'phrase', short = item.en.length < 3 || /\s/.test(item.en) || phrase;
  if (phrase) return t < 2 ? ['en_to_sv'] : ['en_to_sv', 'sv_to_en', 'listen_pick_word'];
  if (pic) {
    if (t === 0) return ['listen_pick_picture'];
    if (t === 1) return ['listen_pick_picture', 'picture_pick_word', 'true_false'];
    if (t === 2) return ['picture_pick_word', 'listen_pick_word', 'read_pick_picture'];
    if (t === 3) return short ? ['read_pick_picture', 'sv_to_en'] : ['read_pick_picture', 'sv_to_en', 'missing_letter'];
    return short ? ['sv_to_en', 'listen_pick_word'] : ['sv_to_en', 'missing_letter', 'spell_tiles'];
  }
  if (t === 0) return ['en_to_sv'];
  if (t === 1) return ['en_to_sv', 'listen_pick_word'];
  if (t === 2) return ['en_to_sv', 'sv_to_en', 'listen_pick_word'];
  if (t === 3) return short ? ['sv_to_en', 'listen_pick_word'] : ['sv_to_en', 'missing_letter'];
  return short ? ['sv_to_en', 'listen_pick_word'] : ['sv_to_en', 'missing_letter', 'spell_tiles'];
}
