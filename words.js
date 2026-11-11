// Ordens styrka. Räknas i bakgrunden efter varje svar och syns som färg i boken, från Wood till Neutron Star.
// Två saker krävs för att ett ord ska stiga: poäng (rätt svar, svårare övningar ger mer) och antal olika dagar
// man svarat rätt. Det går alltså inte att nöta upp ett ord till toppen på en kväll.

export const TIERS = [
  { name: 'Wood', color: '#a9743f', ink: '#2a1a0a' }, { name: 'Iron', color: '#8793a3', ink: '#10151c' }, { name: 'Steel', color: '#c3d0de', ink: '#182230' },
  { name: 'Gold', color: '#f2b632', ink: '#3a2600' }, { name: 'Emerald', color: '#2fbf71', ink: '#062a16' }, { name: 'Crystal', color: '#ee7fd8', ink: '#3a0a32' },
  { name: 'Star', color: '#fff0a0', ink: '#4a3a00' }, { name: 'Neutron Star', color: '#9fe8ff', ink: '#06283a' },
];
const NEED_SCORE = [0, 3, 7, 12, 18, 26, 36, 50];     // poäng som krävs för varje nivå
const NEED_DAYS = [0, 1, 2, 3, 5, 7, 10, 14];         // antal olika dagar med rätt svar som krävs
const INTERVAL = [1, 1, 2, 3, 5, 8, 13, 21];          // dagar tills ordet vill repeteras igen, per nivå

// Hur mycket ett rätt svar är värt per övningstyp: känna igen < koppla ord och skrift < plocka fram < stava.
export const WEIGHT = { listen_pick_picture: 1, true_false: 1, picture_pick_word: 1.5, listen_pick_word: 1.5, read_pick_picture: 1.5, en_to_sv: 1.5, sv_to_en: 2, sentence_gap: 2, missing_letter: 2.5, spell_tiles: 3, build_sentence: 3 };

export const tierOf = (rec) => { if (!rec) return -1; let t = 0; for (let i = 1; i < TIERS.length; i++) if (rec.s >= NEED_SCORE[i] && rec.d >= NEED_DAYS[i]) t = i; return t; };
export const isDue = (rec, day) => !!rec && day - rec.last >= INTERVAL[tierOf(rec)];
// Vad som fattas till nästa nivå, för bokens detaljruta.
export function nextNeed(rec) {
  const t = tierOf(rec); if (t >= TIERS.length - 1) return null;
  return { tier: TIERS[t + 1], score: Math.max(0, Math.ceil(NEED_SCORE[t + 1] - rec.s)), days: Math.max(0, NEED_DAYS[t + 1] - rec.d) };
}

// book: { ordId: { s: poäng, d: dagar med rätt, last: senaste dag, ld: senaste dag med rätt, td: rätt i dag, r: rätt totalt, w: fel totalt } }
export function meet(book, id, day) { if (!book[id]) book[id] = { s: 0, d: 0, last: day, ld: -1, td: 0, r: 0, w: 0 }; return book[id]; }
export function record(book, id, right, type, day) {
  const rec = meet(book, id, day), before = tierOf(rec);
  if (rec.last !== day) rec.td = 0;
  rec.last = day;
  if (right) {
    let gain = WEIGHT[type] || 1;
    if (rec.ld !== day) { if (rec.ld >= 0 && day - rec.ld >= INTERVAL[before]) gain *= 2; rec.d++; rec.ld = day; }   // ny dag, och extra om det gått lagom lång tid
    gain /= 1 + rec.td;                                  // avtagande samma dag: första rätta svaret är värt mest
    rec.s += gain; rec.td++; rec.r++;
  } else { rec.s = Math.max(0, rec.s * 0.75 - 1); rec.w++; }
  return { before, after: tierOf(rec) };
}

// Vilka övningar som passar ordet just nu. Ord med bild börjar med att lyssna och peka; ord utan bild börjar
// med svensk översättning. Högre nivå ger övningar som kräver mer: läsa, översätta åt andra hållet, stava.
export function tasksFor(item, rec) {
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
