// Spelets skal: vem spelar, karta, strid, resultat, utrustning och dagens butik.
import { G, ramp } from './pixel.js';
import { W, H, drawHero, drawIcon, HAIR_STYLES } from './hero.js';
import { ITEMS, BY_ID, SLOTS, RARITY, dailyShop, heroStats, xpToLevel, levelKeepGrant } from './catalog.js';
import { Battle, loadArt } from './battle.js';
import { Quiz } from './quiz.js';
import { showTitle, playIntro } from './intro.js';
import { pic, preloadPics } from './pics.js';
import { TIERS, STEEL, tierOf, isDue, nextNeed, countAt, thinContent, record as wordRecord, meet as wordMeet } from './words.js';
import * as R from './rules.js';
import { K, version as BV } from './balance.js';
import * as sync from './sync.js';
import { SYNC_CONFIG } from './sync-config.js';
import { MINI, miniFor } from './minigames/index.js';
import { usable, esc } from './minigames/shared.js';

const $ = (id) => document.getElementById(id);
const KEY = 'larovarlden-spel-v4';
const fmt = (n) => n.toLocaleString('sv-SE');

// ---------- Tillstånd ----------
function fresh() {
  const mk = (name, look) => ({ name, look, level: 1, xp: 0, gold: 0, owned: [], eq: {}, done: {}, bought: {}, seenShop: '', runs: 0, defeats: 0 });
  return { dayOffset: 0, profiles: [mk('Player 1', { skin: '#f3c7a2', hair: '#6b4426', style: 'spiky' }), mk('Player 2', { skin: '#f0bd93', hair: '#e9c463', style: 'short' }), mk('Player 3', { skin: '#e9b48c', hair: '#b5532a', style: 'bowl' })] };
}
let S; try { S = JSON.parse(localStorage.getItem(KEY)) || fresh(); } catch (e) { S = fresh(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
let P = null, MAP = null, battle = null, words = [];
const CONTENT = {};                                    // världsindex -> innehåll (content/worldN.json)
const dayNum = () => { const d = new Date(Date.now() + S.dayOffset * 864e5); return Math.floor((d.getTime() - d.getTimezoneOffset() * 6e4) / 864e5); };
const today = () => sync.dayKey(Date.now(), S.dayOffset);
// ---------- Synk: händelseloggen är facit, P är en kopia som fylls på efter varje ändring ----------
const pid = (p) => 'p' + (S.profiles.indexOf(p) + 1);           // p1, p2, p3 i den ordning profilerna står i fresh(). Ändra aldrig ordningen. Namnen finns bara på enheten.
// Det här räknas fram ur profilens händelser varje gång något ändras (utöver guld, nivå och föremål som sync.fold ger):
//   boken        händelser av typen 'words', en per spelad bana: [ord, övningstyp, 1 rätt | 0 fel | -1 första mötet, försprång]
//   paid         engångsnycklar som redan har gett något (payload.once): 'w:<ord>:<nivå>' = xp för en ordnivå, 'bal-2' = nivåskyddet
//   look, prefs  senaste händelsen av typen gäller. young (ung-läge) läses ur den senaste prefs som har fältet, eftersom en
//                äldre klient skriver prefs utan det
//   open         bossar som föräldern har öppnat för hand (typen 'unlock', senaste per värld gäller)
//   mini         kommer från sync.fold: per minispelsnod ('värld:nod') dagen den spelades klart första gången och senaste dagen den gav guld
const adopt = (p) => {
  const id = pid(p), evs = sync.eventsFor(id);
  Object.assign(p, sync.stateFor(id, today()));
  const book = {}, paid = {}, open = {}; let look = null, prefs = null, young = false;
  for (const e of evs) {
    const pl = e.payload || {};
    if (e.type === 'words') for (const [w, type, r, hs] of pl.a || []) { if (r < 0) wordMeet(book, w, pl.day); else wordRecord(book, w, r > 0, type, pl.day, +hs || 0); }
    else if (e.type === 'grant' && pl.once != null) paid[pl.once] = 1;
    else if (e.type === 'look') look = pl;
    else if (e.type === 'prefs') { prefs = pl; if (typeof pl.young === 'boolean') young = pl.young; }
    else if (e.type === 'unlock' && pl.world) open[pl.world] = pl.open !== false;
  }
  // En ordnivå som redan har gett xp räknas som nådd, även om svaren som ledde dit aldrig sparades (strid som avbröts).
  for (const k of Object.keys(paid)) { const m = /^w:(.+):(\d+)$/.exec(k); if (m && book[m[1]]) book[m[1]].mt = Math.max(book[m[1]].mt || 0, +m[2]); }
  p.words = book; p.paid = paid; p.open = open; p.young = young;
  if (look && look.skin) p.look = look; p.reading = prefs ? prefs.reading !== false : true;
  if (prefs && prefs.name) p.name = prefs.name;                 // namnet följer med mellan enheter (ligger i hushållets skyddade data, inte i koden)
  levelKeep(p, evs);
  save();
};
// Balans version 2 bytte xp-kurva. Nivån räknas alltid fram ur summan av xp, så utan åtgärd hade barn på nivå 6 till 12
// kunnat se nivån sjunka ett steg (den nya kurvan kräver upp till 41 xp mer för samma nivå där). Första gången en profil
// med xp från före bytet öppnas i den nya versionen bokförs därför en engångsgåva: skillnaden mellan vad barnets
// nivå kostar med nya och gamla kurvan (och nivån efter, ifall en annan enhet hunnit längre), aldrig mindre än noll.
// Nyckeln 'bal-2' ger händelsen samma id på alla enheter, så den ges en gång. Räkningen står i catalog.js (levelKeepGrant)
// och kontrolleras i balance.test.mjs.
function levelKeep(p, evs) {
  if (p.paid['bal-2']) return;
  let old = 0; for (const e of evs) if ((e.type === 'stage' || e.type === 'grant') && !(e.payload && e.payload.bv)) old += Math.max(0, Math.round(+(e.payload || {}).xp || 0));
  if (old <= 0) return;                                          // inget tjänat före bytet: inget att skydda
  const g = levelKeepGrant(old);
  if (sync.record(pid(p), 'grant', { gold: 0, xp: g.xp, reason: 'balance-v2', was: g.level, bv: BV }, { once: 'bal-2' })) Object.assign(p, sync.stateFor(pid(p), today()));
  p.paid['bal-2'] = 1;
}
const rec = (type, payload) => { sync.record(pid(P), type, payload); adopt(P); };
const gearOf = (p, preview) => { const eq = { ...p.eq }; if (preview) eq[preview.slot] = preview.id; return Object.fromEntries(Object.entries(eq).filter(([, id]) => id).map(([k, id]) => [k, BY_ID[id]])); };

// ---------- Ljud: en AudioContext som låses upp av första trycket (krav i Safari på iOS) ----------
let actx; const buffers = new Map();
function unlock() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {} }
// Röstklipp spelas i tur och ordning, aldrig ovanpå varandra (en instruktion hinner bli klar innan ordet sägs).
// Högst ett klipp får vänta bakom det som spelas, så att upprepade tryck inte bygger en lång kö.
let voice = Promise.resolve(), waiting = 0;
function playNow(url) {
  return new Promise(async (res) => {
    try {
      unlock(); if (!buffers.has(url)) buffers.set(url, await actx.decodeAudioData(await (await fetch(url)).arrayBuffer()));
      const s = actx.createBufferSource(); s.buffer = buffers.get(url); s.connect(actx.destination); s.onended = res; s.start();
      setTimeout(res, (s.buffer.duration + 0.4) * 1000);
    } catch (e) { res(); }
  });
}
function play(url) { if (waiting >= 2) return voice; waiting++; voice = voice.then(() => playNow(url)).then(() => new Promise((r) => setTimeout(r, 180))).then(() => { waiting--; }); return voice; }
const voiceIdle = () => voice;
// Korta ljudeffekter som skapas direkt i webbläsaren: ett ljust pling för rätt, ett mörkt dunk för fel.
// BLIP är minispelens små ljud (tryck, vänd kort, vrid, rätt, mjukt fel, klart): [frekvens, start, längd].
const BLIP = { tap: [[520, 0, 0.05]], flip: [[660, 0, 0.05]], turn: [[440, 0, 0.04]], good: [[660, 0, 0.09], [990, 0.09, 0.14]], soft: [[300, 0, 0.12], [240, 0.1, 0.16]], win: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.25]] };
function sfx(kind) {
  try {
    unlock(); const t = actx.currentTime, tone = (f0, f1, at, dur, type, vol) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(vol, t + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur); o.connect(g); g.connect(actx.destination); o.start(t + at); o.stop(t + at + dur + 0.02); };
    if (kind === 'right') { tone(784, 784, 0, 0.11, 'triangle', 0.22); tone(1175, 1175, 0.1, 0.2, 'triangle', 0.22); }
    else if (kind === 'level') { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, i * 0.11, i === 4 ? 0.5 : 0.14, 'triangle', 0.24)); tone(262, 262, 0.44, 0.5, 'sine', 0.2); }
    else if (kind === 'wrong') { tone(220, 150, 0, 0.28, 'sawtooth', 0.12); tone(110, 80, 0, 0.3, 'sine', 0.2); }
    else if (BLIP[kind]) for (const [f, at, len] of BLIP[kind]) tone(f, f, at, len + 0.02, 'triangle', 0.13);
  } catch (e) {}
}

// ---------- Ikoner ----------
const ICON = {};
{ const c = document.createElement('canvas'); c.width = c.height = 32; const ctx = c.getContext('2d'), g = new G(32, 32); for (const it of ITEMS) { g.clear(); drawIcon(g, it); ctx.clearRect(0, 0, 32, 32); g.paint(ctx); ICON[it.id] = c.toDataURL(); } }

function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); screen = id; if (stale && id !== 'battle' && id !== 'mini') location.reload(); }
let screen = 'who', toastT;
function toast(msg) { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200); }

// ---------- Hjälteporträtt som animeras på de skärmar som visar gubben ----------
const STONE = ramp('#7c84a6'), stages = [];
function stage(canvas, scale, getGear, getLook) { canvas.width = W; canvas.height = H; stages.push({ ctx: canvas.getContext('2d'), g: new G(W, H), getGear, getLook, canvas }); }
setInterval(() => {
  const t = performance.now() / 1000;
  for (const s of stages) { if (!s.canvas.offsetParent) continue; const look = s.getLook(); if (!look) continue; s.g.clear(); if (!s.noPed) { s.g.begin(); s.g.ell(38.5, 65.5, 23, 5.6, STONE, true); s.g.end(); } drawHero(s.g, look, s.getGear(), { t, blink: t % 3.7 < 0.14 }); s.g.paint(s.ctx); }
}, 90);

// ---------- Vem spelar ----------
function renderWho() {
  const list = $('who-list'); list.innerHTML = ''; stages.length = 0; initStages();
  S.profiles.forEach((p) => {
    const b = document.createElement('button'), c = document.createElement('canvas');
    stage(c, 2, () => gearOf(p), () => p.look);
    b.append(c, p.name); const sm = document.createElement('small'); sm.textContent = `Level ${p.level}`; b.appendChild(sm);
    b.onclick = () => { unlock(); P = p; adopt(P); sync.sync(); enterMap(true); };
    list.appendChild(b);
  });
}

// ---------- Karta ----------
window.GAME = {
  mapReady(m) { MAP = m; if (P) syncMap(true); },
  play(k, i, node, done) {
    const w = MAP.worlds[k];
    if (node.type === 'mini') return openMini(k, node.slot != null ? node.slot : i, node);      // i = nodindex, eller sidostoppets id
    if (node.type === 'chest') { if (done) return toast('The chest is empty.'); const gold = R.chestGold(R.nodeInfo(w.id, i).rec); rec('stage', { world: w.id, node: i, kind: 'chest', win: true, stars: 1, gold, xp: 0, bv: BV }); toast(`You found ${gold} gold!`); MAP.finish(k, i, 1); return afterMapChange(); }
    // Bossens ordmätare: bossen går att utmana först när tillräckligt många av världens ord är inlärda (eller föräldern har öppnat den).
    if (node.type === 'boss' && !done) { const g = bossGate(k); if (g && !g.open) { toast(meterText(g)); return goPractice(k, g.best); } }
    startBattle(k, i, node, w);
  },
  // Kartans knapp "Practice words": till banan där flest ord kan växa.
  practice(k) { const t = practiceTarget(k); if (t) goPractice(t[0], t[1]); },
};
function afterMapChange() { P.done = JSON.parse(JSON.stringify(MAP.state.done)); passMinis(); MAP.state.gold = P.gold; pushMapInfo(); MAP.updateHud(); save(); renderBar(); }
// Barnets egen gubbe i sin utrustning som markör på kartan (halv storlek).
function mapHero() {
  if (!MAP || !MAP.setHero || !P) return;
  const g = new G(40, 38); g.push(0, 0, 0, 0.5); drawHero(g, P.look, gearOf(P), { t: 0, noShadow: true, noPet: true, noFx: true }); g.pop();
  const c = document.createElement('canvas'); c.width = 40; c.height = 38; g.paint(c.getContext('2d')); MAP.setHero(c, 19, 31);
}
// En minispelsnod i stigen spärrar aldrig: så fort barnet står vid den bokförs den som passerad (en stage-händelse utan
// guld och xp, av samma slag som butiksnoden skrev förut), spelad eller inte. Regeln läser loggens tillstånd, inte
// kartans, och nyckeln gör att två enheter skriver samma rad. En äldre klient ser händelsen som en klarad nod.
function passMinis() {
  if (!MAP || !P) return;
  const done = sync.stateFor(pid(P), today()).done; let any = false;
  for (const w of MAP.worlds) {
    const d = done[w.id] || [];
    for (let i = 0; i < w.nodes.length; i++) {
      if (d[i]) continue;
      if (i === 0 || w.nodes[i].type !== 'mini') break;
      sync.record(pid(P), 'stage', { world: w.id, node: i, kind: 'mini', win: true, stars: 1, gold: 0, xp: 0, bv: BV }, { once: `pass:${w.id}:${i}` }); any = true;
    }
  }
  if (any) adopt(P);
}
function syncMap(jump) { passMinis(); mapHero(); MAP.load(P.done, P.gold); pushMapInfo(); if (jump) { const cw = MAP.curWorld(); MAP.setView('world', cw < 0 ? MAP.worlds.length - 1 : cw, true); } }
function enterMap(jump) {
  show('map'); renderBar();
  if (!$('map-frame').src) $('map-frame').src = 'map/index.html?v=6'; else if (MAP) syncMap(jump);
}

// ---------- Orden per värld: vad som räknas, mätaren på bossen och var det lönar sig att öva ----------
// Världens innehåll så som det här barnet möter det: ung-läget och K.wordShare tar bort de sista orden på varje bana.
const THIN = {};
const wordShare = (p = P) => (p && p.young ? K.young.thin : K.wordShare ?? 1);
function contentFor(k, p = P) { const c = CONTENT[k], sh = wordShare(p); if (!c || !(sh < 1)) return c || null; const key = k + '|' + sh; return THIN[key] || (THIN[key] = thinContent(c, sh)); }
const counts = (it, p) => p.reading !== false || !!it.pic;            // den som inte läser möter nästan bara ord med bild, så bara de räknas
// Orden som en bana inför (det är dem barnet övar mest när banan spelas om).
function nodeWords(k, i, p = P) { const c = contentFor(k, p), nd = c && c.nodes[i]; if (!nd) return []; const by = c._by || (c._by = Object.fromEntries(c.items.map((it) => [it.id, it]))); return [...(nd.introduce || []), ...(nd.phrases || [])].map((id) => by[id]).filter((it) => it && counts(it, p)); }
const unlearned = (k, i, p = P) => nodeWords(k, i, p).filter((it) => tierOf((p.words || {})[it.id]) < STEEL).length;
const isDone = (k, i, p = P) => !!((p.done || {})[R.WORLD_IDS[k]] || [])[i];
// Den klarade banan i världen med flest ord som inte är inlärda (under Steel). -1 om ingen finns.
function practiceNode(k, p = P) { const c = contentFor(k, p); let best = -1, bn = 0; if (c) c.nodes.forEach((nd, i) => { if (nd.type !== 'level' || !isDone(k, i, p)) return; const u = unlearned(k, i, p); if (u > bn) { bn = u; best = i; } }); return best; }
// Samma sak, men letar bakåt i tidigare världar om den här inte har någon. Returnerar [värld, nod] eller null.
function practiceTarget(k, p = P) { for (let j = k; j >= 0; j--) { const i = practiceNode(j, p); if (i >= 0) return [j, i]; } return null; }
// Bossens ordmätare för värld k. null = världen har ingen mätare (ingen innehållsfil, eller mätaren är avstängd i balance.js).
function bossGate(k, p = P) {
  const G = K.gate && K.gate.boss, c = contentFor(k, p); if (!G || !c) return null;
  const items = c.items.filter((it) => counts(it, p)), n = items.length, have = countAt(p.words || {}, items, G.tier);
  const need = Math.ceil((p.young ? K.young.bossShare : G.share) * n - 1e-9), forced = !!(p.open && p.open[R.WORLD_IDS[k]]), best = practiceNode(k, p);
  // Finns ingen bana att öva på hålls bossen öppen: mätaren får aldrig stänga in ett barn.
  return { n, have, need, left: Math.max(0, need - have), tier: TIERS[G.tier].name, forced, best, open: have >= need || forced || best < 0 };
}
const withText = (g) => (g ? { ...g, text: meterText(g) } : null);
const meterText = (g) => `${g.have} of ${g.n} words are ${g.tier} or better. ` + (g.left > 0 ? `${g.left} to go.` : 'The boss is open!');
const meterHTML = (g) => `<div class="meter"><i style="width:${Math.min(100, Math.round(100 * g.have / Math.max(1, g.need)))}%"></i></div>`;
// Världen barnet står i: den första som inte är helt klarad.
function curWorldIdx(p = P) { const k = R.WORLD_IDS.findIndex((id, j) => { const d = (p.done || {})[id] || []; return !R.nodeCount(j) || d.length < R.nodeCount(j) || d.slice(0, R.nodeCount(j)).some((x) => !x); }); return k < 0 ? R.WORLD_IDS.length - 1 : k; }
// Det kartan behöver veta för att rita nivåer, belöning och ord kvar. Kartan har inga egna regler.
function pushMapInfo() {
  if (!MAP || !MAP.setInfo || !P) return;
  const worlds = {};
  MAP.worlds.forEach((w, k) => {
    const hasC = !!CONTENT[k], done = P.done[w.id] || [], bossI = w.nodes.findIndex((nd) => nd.type === 'boss');
    worlds[w.id] = {
      best: hasC ? practiceNode(k) : -1,
      gate: bossI >= 0 && !done[bossI] ? withText(bossGate(k)) : null,
      side: (w.side || []).map((nd) => miniInfo(w, nd, nd.after)),
      nodes: w.nodes.map((nd, i) => {
        const info = R.nodeInfo(w.id, i);
        if (nd.type === 'chest') return { gold: R.chestGold(info.rec) };
        if (nd.type === 'mini') return miniInfo(w, nd, i);
        return { rec: info.rec, f: R.rewardFactor(P.level, info.rec), bonus: done[i] ? 0 : R.levelBonus({ type: nd.type, rec: info.rec }, true, true), left: hasC && nd.type === 'level' ? unlearned(k, i) : null };
      }),
    };
  });
  MAP.setInfo({ level: P.level, free: (K.falloff && K.falloff.free) || 0, worlds });
}
// Det kartan visar i rutan för ett minispel: spelets namn och en rad om vad man gör, guldet, och om dagens guld är hämtat.
// anchor = nodindex som guldet räknas efter (nodens eget, eller noden som sidostoppet ligger efter).
function miniInfo(w, nd, anchor) {
  const gs = [].concat(nd.mini.game).filter((id) => MINI[id]).map((id) => MINI[miniFor(id, P.reading !== false)]), st = (P.mini || {})[w.id + ':' + nd.slot], rec = R.nodeInfo(w.id, anchor).rec, day = today();
  return { mini: { name: gs.map((g) => g.name).join(' or '), desc: gs.length > 1 ? 'You choose.' : gs.length ? gs[0].desc : '', first: R.miniGold(rec, true), daily: R.miniGold(rec, false), played: !!(st && st.first), got: !!(st && (st.first === day || st.last === day)) } };
}
// Till kartan med rutan för en viss bana öppen.
function goPractice(k, i) { enterMap(false); if (MAP) { afterMapChange(); if (i >= 0 && MAP.focus) MAP.focus(k, i); } }
function renderBar() {
  $('me-name').textContent = P.name; $('me-level').textContent = P.level; $('me-xp').style.width = (100 * P.xp / xpToLevel(P.level)) + '%';
  $('shop-dot').hidden = P.seenShop === today();
  const g = new G(W, H); drawHero(g, P.look, { helmet: P.eq.helmet && BY_ID[P.eq.helmet] }, { t: 0, noShadow: true });
  const full = document.createElement('canvas'); full.width = W; full.height = H; g.paint(full.getContext('2d'));
  const ctx = $('b-gear-c').getContext('2d'); ctx.clearRect(0, 0, 24, 24); ctx.drawImage(full, 27, 12, 24, 24, 0, 0, 24, 24);
  // Players: familjens tre hjältar bredvid varandra. Shop: ett marknadsstånd med randig markis och guldmynt.
  const pg = new G(40, 24); S.profiles.forEach((p, i) => { pg.push(i * 12 - 15, 2, 0, 0.55); drawHero(pg, p.look, gearOf(p), { t: 0, noShadow: true, noPet: true, noFx: true }); pg.pop(); });
  pg.paint($('b-who-c').getContext('2d'));
  const sg = new G(24, 24), RED = ramp('#d8433b'), CREAM = ramp('#f4ead0'), WOOD = ramp('#9a6b3f'), GOLD = ramp('#f2b632');
  sg.begin(); sg.rect(3, 9, 2, 13, WOOD, 2); sg.rect(19, 9, 2, 13, WOOD, 2); sg.end();
  sg.begin(); sg.rect(2, 14, 20, 7, WOOD, 3); sg.rect(2, 14, 20, 2, WOOD, 5); sg.end();
  sg.begin(); for (let i = 0; i < 5; i++) { sg.poly([[1 + i * 4.4, 9], [3.2 + i * 4.4, 3], [7.6 + i * 4.4 - 2.2, 3], [5.4 + i * 4.4, 9]], i % 2 ? CREAM : RED, 3); sg.ell(3.2 + i * 4.4, 9.5, 2.2, 2, i % 2 ? CREAM : RED, false, null, 2); } sg.end();
  sg.begin(); sg.ell(9, 12, 2.6, 2.6, GOLD); sg.ell(15, 12.5, 2.2, 2.2, GOLD); sg.end();
  sg.paint($('b-shop-c').getContext('2d'));
  const bg = new G(24, 24), COVER = ramp('#7a4cc0'), PAGE = ramp('#f4ead0');
  bg.begin(); bg.poly([[3, 6], [12, 8], [21, 6], [21, 19], [12, 21], [3, 19]], COVER, 3); bg.end();
  bg.begin(); bg.poly([[5, 5], [12, 7], [12, 19], [5, 17]], PAGE, 4); bg.poly([[12, 7], [19, 5], [19, 17], [12, 19]], PAGE, 3); bg.end();
  bg.begin(); for (const y of [9, 12, 15]) { bg.rect(7, y, 3, 1, COVER, 2); bg.rect(14, y - 1, 3, 1, COVER, 2); } bg.dot(17, 8, GOLD, 5); bg.end({ outline: false, edge: false });
  bg.paint($('b-book-c').getContext('2d'));
}
$('b-book').onclick = () => openBook(); $('b-gear').onclick = () => openGear(); $('b-shop').onclick = () => openShop(); $('b-who').onclick = () => { P = null; renderWho(); show('who'); };
document.querySelectorAll('.back').forEach((b) => (b.onclick = () => enterMap(false)));
$('mini-back').onclick = () => leaveMini();

// ---------- Strid ----------
function wordsFor(k, i) { const n = words.length, off = (k * 6 + Math.floor(i / 3) * 3) % n; return Array.from({ length: 12 }, (_, j) => words[(off + j) % n]); }
let run = null;                                              // den pågående omgången: nivå och värden vid start, ord som blivit starkare
function startBattle(k, i, node, w) {
  if (battle) { battle.destroy(); battle = null; }          // aldrig två strider samtidigt
  $('result').hidden = true;
  show('battle');
  P.words = P.words || {};
  node = { ...node, ...R.nodeInfo(w.id, i) };                // banans rekommenderade nivå och lättnad (balance.js)
  run = { level: P.level, stats: heroStats(P), words: 0, wordXp: 0 };
  const C = contentFor(k);                                   // världar med innehållsfil har byggd pedagogik, övriga kör enkla frågor tills vidare
  const quiz = C ? new Quiz({ content: C, prior: Object.keys(CONTENT).filter((j) => +j < k).flatMap((j) => contentFor(+j).items), nodeIdx: i, book: P.words, day: dayNum(), reading: P.reading !== false, play, save,
    onAnswer: (t, right, up) => { sync.record(pid(P), 'answer', { word: 'en:' + t.item.id, exercise: t.type, correct: right, stage: w.id + ':' + i }); if (up && up.up) wordUp(t.item, up); } }) : null;
  battle = new Battle($('battle-root'), { profile: P, worldIdx: k, nodeIdx: i, node, words: wordsFor(k, i), quiz, rewardMult: R.rewardFactor(P.level, node.rec), play, sfx, voiceIdle, onEnd: (r) => endBattle(r, k, i, node, w) });
  if ((P.runs || 0) < 3) { play('audio/en-listen.mp3'); toast('Listen, and choose the picture.' + sv('listen', 'Lyssna och välj bilden.')); }
}
// Ett ord har nått en ny högsta nivå i boken: xp bokförs direkt som en egen händelse, så att den finns kvar även om
// striden sedan förloras eller avbryts. Nyckeln per ord och nivå gör att samma nivå aldrig betalas två gånger, varken
// av två enheter eller efter en omstart. Nivåer som ordet nådde före balans v2 betalas inte i efterhand (mt i words.js).
function wordUp(item, up) {
  if (!K.learn || !run) return;
  let got = 0;
  for (let tier = up.top + 1; tier <= up.after; tier++) {
    const key = `w:${item.id}:${tier}`, xp = R.learnXp(tier, run.level, xpToLevel, R.learnMult(P.young));
    if (!xp || P.paid[key]) continue;
    if (sync.record(pid(P), 'grant', { gold: 0, xp, reason: 'word', word: item.id, tier, bv: BV }, { once: key })) got += xp;
    P.paid[key] = 1;
  }
  if (!got) return;
  run.words++; run.wordXp += got;
  if (battle && battle.note) battle.note(`${TIERS[up.after].name}!  +${got} XP`, TIERS[up.after].color);
}
function endBattle(r, k, i, node, w) {
  const first = !(P.done[w.id] && P.done[w.id][i]), st = run || { level: P.level, stats: heroStats(P), words: 0, wordXp: 0 };
  const rw = R.reward(r, node, first, st.level, !!CONTENT[k]), log = battle && battle.quiz ? battle.quiz.log : [];
  for (let c = 0; c < log.length; c += 30) sync.record(pid(P), 'words', { day: dayNum(), a: log.slice(c, c + 30).map((l) => { const a = [l.id, l.type, l.free && !l.right ? -1 : l.right ? 1 : 0]; if (l.start) a.push(l.start); return a; }) });
  rec('stage', { world: w.id, node: i, kind: 'battle', win: r.win, stars: r.stars, gold: rw.gold, xp: rw.xp, bv: BV });
  const ups = P.level - st.level, before = st.stats; run = null;
  const el = $('result'); el.hidden = false; el.className = r.win ? 'win' : 'lose';
  el.querySelector('h2').textContent = r.win ? 'Good job!' : 'Try again!';
  el.querySelector('.sv').textContent = r.win ? sv('good-job', 'Bra jobbat!').trim() : sv('try-again', 'Försök igen!').trim();
  el.querySelector('.stars').innerHTML = r.win ? [0, 1, 2].map((s) => (s < r.stars ? '★' : '<i>★</i>')).join('') : '';
  const target = r.win ? null : practiceTarget(k), canPractice = target && !(target[0] === k && target[1] === i), under = !r.win && P.level < node.rec;
  el.querySelector('.lines').innerHTML = (r.win ? `You won at ${node.name}.\n` : `You reached fight ${Math.min(r.kills + 1, r.fights)} of ${r.fights}.\n`) +
    `<b>+${fmt(rw.gold)} gold</b>   <b>+${fmt(rw.xp)} XP</b>` +
    (st.words ? `\n<b class="grow">${st.words} ${st.words === 1 ? 'word' : 'words'} got stronger</b>   <b>+${fmt(st.wordXp)} XP</b>` : '') +
    (rw.factor < 1 ? '\nToo easy now: small reward.' : '') +
    (ups ? `\n<b>Level ${P.level}!</b> You are stronger now.` : '') +
    (under ? `\n<b class="warn">This level is Lv ${node.rec}. You are Lv ${P.level}.</b>` : '') +
    (r.win ? '' : canPractice ? '\nMake your words stronger to level up.' : '\nYou keep your gold and XP.');
  const acts = el.querySelector('.acts'); acts.innerHTML = '';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = () => { el.hidden = true; if (battle) battle.destroy(); battle = null; if (ups) levelUp(before, fn); else fn(); }; acts.appendChild(b); };
  if (canPractice) btn('Practice words', under ? 'big' : 'alt big', () => goPractice(target[0], target[1]));
  if (!r.win) btn('Try again', under && canPractice ? 'alt' : '', () => startBattle(k, i, node, w));
  btn('Map', r.win ? '' : 'alt', () => { enterMap(false); if (r.win) { MAP.state.gold = P.gold; MAP.finish(k, i, r.stars); } afterMapChange(); });
  play(r.win ? 'audio/en-good-job.mp3' : 'audio/en-try-again.mp3');
}

// ---------- Minispel: en paus mellan striderna (noderna av typen 'mini' på kartan och sidostoppen) ----------
// Spelen ligger i minigames/ och är kopior av prototyperna. Skalet ger dem ord, ljud och en resultatruta, och bokför guldet.
// De ger aldrig xp eller utrustning och ändrar inte ordboken: svaren sparas bara under egna övningsnamn (mg_pairs och så vidare).
let mini = null;                                             // det som pågår: { k, slot, nd, w, ids, id, level, mod, stop }
const miniPlay = (it, o = {}) => play(typeof it === 'string' ? it : o.sv ? `audio/sv/${it.id}.mp3` : `audio/${it.audio}${o.slow ? '.slow' : ''}.mp3`);
// Orden till ett minispel i värld k. need = { n, spell, minLen, maxLen } (se minigames/index.js). Bara ord med bild.
// Ordning: ord barnet har mött i världen (de som vill repeteras först, sedan från svagast till starkast), sedan världens
// övriga ord i den ordning banorna inför dem, och räcker inte det fylls det på från tidigare världar på samma sätt.
// En värld utan innehållsfil (värld 4 till 6 i dag) lånar orden från närmast föregående värld som har en.
// Ung-läget och K.wordShare gäller här också (contentFor), så ett bortgallrat ord dyker aldrig upp.
function miniWords(k, need) {
  const day = dayNum(), book = P.words || {}, out = [], seen = new Set();
  let src = k; while (src > 0 && !CONTENT[src]) src--;
  for (let j = src; j >= 0 && out.length < need.n; j--) {
    const c = contentFor(j); if (!c) continue;
    const rank = (it) => { const r = book[it.id]; return !r ? 99 : isDue(r, day) ? 0 : 1 + Math.max(0, tierOf(r)); };
    const list = usable(c.items, { pic: true, spell: !!need.spell, minLen: need.minLen, maxLen: need.maxLen }).filter((it) => !seen.has(it.id) && !seen.has('en:' + it.en))
      .map((it) => [rank(it), book[it.id] ? book[it.id].s : it.node || 0, Math.random(), it]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
    for (const x of list) { if (out.length >= need.n) break; out.push(x[3]); seen.add(x[3].id); seen.add('en:' + x[3].en); }
  }
  return out;
}
// Kartan anropar den här när barnet trycker Play på ett minispel. slot = nodindex, eller sidostoppets id ('s1').
function openMini(k, slot, nd) {
  const ids = [].concat(nd.mini && nd.mini.game).filter((id) => MINI[id]);
  if (!ids.length) return toast('This game is not ready yet.');
  if (battle) { battle.destroy(); battle = null; }
  stopMini();
  mini = { k, slot, nd, w: MAP.worlds[k], ids, id: null, level: 1, mod: null, stop: null };
  $('result').hidden = true; show('mini'); $('mini-title').textContent = nd.name;
  if (ids.length > 1) chooseMini(); else startMini(ids[0]);
}
// Noden med två spel: barnet väljer med två stora knappar.
function chooseMini() {
  const m = mini, root = $('mini-root'); stopMini(); $('mini-title').textContent = m.nd.name;
  root.innerHTML = `<div class="mg-choose">${m.ids.map((id) => { const g = MINI[miniFor(id, P.reading !== false)]; return `<button data-id="${id}"><b>${g.name}</b><small>${g.desc}</small></button>`; }).join('')}</div>`;
  root.querySelectorAll('button').forEach((b) => (b.onclick = () => { sfx('tap'); startMini(b.dataset.id); }));
}
async function startMini(id) {
  const m = mini; if (!m) return;
  // Den som inte läser får spelets läge utan läsning (Foggy Window i stället för Light the Lanterns). Ung-läget ger en storlek mindre.
  m.id = miniFor(id, P.reading !== false); const g = MINI[m.id];
  m.level = Math.max(1, Math.min(g.levels, (m.nd.mini.level || 1) + (P.young && K.mini ? K.mini.youngLevel || 0 : 0)));
  $('mini-title').textContent = g.name;
  try { m.mod = await g.load(); } catch (e) { console.error(e); toast('The game could not start.'); return leaveMini(); }
  if (mini === m) runMini();                                 // annars hann barnet gå tillbaka medan spelet laddades
}
function stopMini() { if (mini && mini.stop) { try { mini.stop(); } catch (e) { console.error(e); } mini.stop = null; } $('mini-root').innerHTML = ''; }
function runMini() {
  const m = mini, g = MINI[m.id], root = $('mini-root'); stopMini();
  const need = g.pool ? g.pool(m.level) : null, list = need ? miniWords(m.k, need) : [];
  if (need && list.length < need.least) { toast('Meet more words in battle first.'); return leaveMini(); }
  const stage = m.w.id + ':' + m.slot;
  m.stop = m.mod.start(root, {
    words: list, sentences: [], reading: P.reading !== false, level: m.level, world: m.k + 1, play: miniPlay, sfx,
    // Varje svar sparas under spelets eget övningsnamn. Ordboken rörs inte (adopt läser bara händelser av typen 'words').
    log: (it, right, chosen) => { if (mini === m && it && it.id) sync.record(pid(P), 'answer', { word: 'en:' + it.id, exercise: g.ex, correct: !!right, chosen: chosen != null ? String(chosen) : null, stage }); },
    onDone: (res) => { if (mini !== m) return; if (m.stop) { try { m.stop(); } catch (e) {} m.stop = null; } miniDone(res || {}); },
  }) || null;
}
// Guldet för en spelad omgång (vinst eller inte): första gången noden spelas klart, sedan dagens första omgång, sedan inget.
// Nyckeln (once) ger händelsen samma id på alla enheter och fold räknar varje nyckel en gång, så två enheter kan inte
// få guldet två gånger. Omgångar utan guld sparas också (utan nyckel), så att det går att se hur mycket spelen används.
function miniPay(m, res) {
  const key = m.w.id + ':' + m.slot, st = (P.mini || {})[key], day = today(), rec = R.nodeInfo(m.w.id, typeof m.slot === 'number' ? m.slot : m.nd.after).rec;
  const kind = !st || !st.first ? 'first' : st.first !== day && st.last !== day ? 'daily' : 'play';
  let gold = kind === 'play' ? 0 : R.miniGold(rec, kind === 'first');
  const row = sync.record(pid(P), 'mini', { world: m.w.id, node: m.slot, game: m.id, level: m.level, won: !!res.won, stars: res.stars || 0, gold, day, kind, bv: BV }, kind === 'play' ? null : { once: `m:${key}:${kind === 'first' ? 'first' : day}` });
  if (!row) gold = 0;                                        // nyckeln fanns redan i loggen
  adopt(P);
  return { gold, kind: gold ? kind : 'play' };
}
function miniDone(res) {
  const m = mini, pay = miniPay(m, res), root = $('mini-root');
  const stars = Math.max(0, Math.min(3, res.stars == null ? (res.won ? 3 : 1) : res.stars));
  const met = (res.words || []).filter((w, i, a) => w && a.findIndex((x) => x.id === w.id) === i).slice(0, 12);
  const el = document.createElement('div'); el.className = 'mg-result';
  el.innerHTML = `<div class="mg-result-box"><h2>${res.won ? 'Well done!' : 'Nice try!'}</h2>
    <div class="mg-stars">${[0, 1, 2].map((i) => `<i class="${i < stars ? 'on' : ''}">★</i>`).join('')}</div>
    ${res.note ? `<p>${esc(res.note)}</p>` : ''}
    <p class="mg-gold">${pay.gold ? `<span class="coin"></span>+${fmt(pay.gold)} gold<small>${pay.kind === 'first' ? 'First time here!' : "Today's gold."}</small>` : '<small>No more gold here today. Play for fun!</small>'}</p>
    ${met.length ? `<div class="mg-learned">${met.map((w, i) => `<button data-i="${i}" class="mg-chip">${pic(w)}<span>${esc(w.en)}</span></button>`).join('')}</div>` : ''}
    <div class="mg-result-btns"><button class="btn again">Play again</button>${m.ids.length > 1 ? '<button class="btn alt other">Other game</button>' : ''}<button class="btn alt map">Map</button></div></div>`;
  el.querySelectorAll('.mg-chip').forEach((b) => (b.onclick = () => miniPlay(met[+b.dataset.i])));
  el.querySelector('.again').onclick = () => runMini();
  if (m.ids.length > 1) el.querySelector('.other').onclick = () => chooseMini();
  el.querySelector('.map').onclick = () => leaveMini();
  root.appendChild(el); sfx(res.won ? 'win' : 'good');
  renderBar();
}
function leaveMini() { stopMini(); mini = null; enterMap(false); }

// ---------- Level up: en egen skärm med fanfar som visar vad som blev bättre ----------
function levelUp(before, then) {
  const el = $('result'), now = heroStats(P); el.hidden = false; el.className = 'level';
  el.querySelector('h2').textContent = 'Level up!'; el.querySelector('.sv').textContent = sv('level-up', 'Ny nivå!').trim();
  el.querySelector('.stars').innerHTML = `<span class="lvnum">${P.level}</span>`;
  el.querySelector('.lines').innerHTML = `<span class="gain">⚔ Attack <b>${before.atk}</b> → <b class="up">${now.atk}</b></span>\n<span class="gain">♥ Health <b>${before.maxHp}</b> → <b class="up">${now.maxHp}</b></span>\nYou are stronger now!`;
  const acts = el.querySelector('.acts'); acts.innerHTML = '';
  const b = document.createElement('button'); b.className = 'btn'; b.textContent = 'Yes!'; b.onclick = () => { el.hidden = true; then(); }; acts.appendChild(b);
  sfx('level'); setTimeout(() => play('audio/en-level-up.mp3'), 500);
}

// ---------- Utrustning: hjälten i mitten med platserna runt om, och det man äger för vald plats ----------
let gFilter = 'weapon', gSel = null, gTab = 'items';
const HAIRS = Object.entries(HAIR_STYLES).map(([id, st]) => [id, st.name]);
const HAIR_COL = ['#2a2a33', '#5a3a22', '#6b4426', '#8a5a34', '#b5532a', '#d98a3a', '#e9c463', '#f4e6b0', '#c8ccd8', '#e56aa8', '#4a8ad8', '#3fae6a'];
const SKIN_COL = ['#fbe0c8', '#f3c7a2', '#e9b48c', '#d49a6a', '#b97a50', '#8a5a3a', '#6a4028'];
const SLOT_SIDE = { L: ['helmet', 'armor', 'back'], R: ['weapon', 'shield', 'pet'] };
function openGear() { gSel = null; show('gear'); paintGearBg(); renderGear(); }
async function paintGearBg() {
  const c = $('gear-bg'); c.width = W; c.height = H; const ctx = c.getContext('2d');
  try {
    const BD = await import('./backdrops.js'), biome = ['forest', 'desert', 'swamp', 'ice', 'volcano', 'cloud'][MAP ? Math.max(0, MAP.curWorld()) : 0] || 'forest';
    const b = new G(192, 108); BD.drawBackdrop(b, biome, 192, 108, 86, 3);
    const full = document.createElement('canvas'); full.width = 192; full.height = 108; b.paint(full.getContext('2d'));
    ctx.drawImage(full, 30, 24, W, H, 0, 0, W, H);                 // utsnitt med marken under hjältens fötter
  } catch (e) { ctx.fillStyle = '#343b6b'; ctx.fillRect(0, 0, W, H); }
}
function renderGear() {
  document.querySelectorAll('.gold').forEach((e) => (e.textContent = fmt(P.gold)));
  $('g-name').textContent = P.name; $('g-level').textContent = `Level ${P.level}`; $('g-xp').style.width = (100 * P.xp / xpToLevel(P.level)) + '%';
  const cur = heroStats(P), tmp = gSel ? heroStats({ ...P, eq: { ...P.eq, [gSel.slot]: gSel.id } }) : cur;
  const diff = (a, b) => (a === b ? '' : `<em class="${b > a ? 'up' : 'down'}">${b > a ? '+' : ''}${b - a}</em>`);
  $('gear-stats').innerHTML =
    `<div class="pill atk"><i>⚔</i><b>${tmp.atk}</b>${diff(cur.atk, tmp.atk)}<span>Attack</span><small>you ${cur.baseAtk} + gear ${tmp.gearAtk}</small></div>` +
    `<div class="pill hp"><i>♥</i><b>${tmp.maxHp}</b>${diff(cur.maxHp, tmp.maxHp)}<span>Health</span><small>you ${cur.baseHp} + gear ${tmp.gearHp}</small></div>`;
  for (const side of ['L', 'R']) {
    const col = $(side === 'L' ? 'gs-left' : 'gs-right'); col.innerHTML = '';
    for (const sid of SLOT_SIDE[side]) {
      const s = SLOTS.find((x) => x.id === sid), id = P.eq[sid], it = id && BY_ID[id], b = document.createElement('button');
      b.className = 'slot' + (gFilter === sid ? ' on' : '') + (it ? '' : ' empty');
      if (it) b.style.setProperty('--rc', RARITY[it.rarity].color);
      b.innerHTML = (it ? `<img src="${ICON[id]}" alt="">` : `<span class="ghost">${s.stat === 'atk' ? '⚔' : '♥'}</span>`) + `<small>${s.name}</small>`;
      b.onclick = () => { gFilter = sid; gSel = null; gTab = 'items'; renderGear(); }; col.appendChild(b);
    }
  }
  $('bag-tabs').innerHTML = ''; for (const [id, label] of [['items', 'Items'], ['outfit', 'Outfit']]) { const b = document.createElement('button'); b.textContent = label; b.className = gTab === id ? 'on' : ''; b.onclick = () => { gTab = id; gSel = null; renderGear(); }; $('bag-tabs').appendChild(b); }
  if (gTab === 'outfit') {            // hår, hårfärg och hudfärg. Ändringen syns direkt på gubben och sparas.
    $('bag-title').textContent = ''; $('gear-sheet').hidden = true;
    const grid = $('gear-grid'); grid.innerHTML = '';
    const sec = (title, kids) => { const d = document.createElement('div'); d.className = 'outfit'; d.innerHTML = `<h4>${title}</h4>`; const r = document.createElement('div'); r.className = 'sw'; kids.forEach((k) => r.appendChild(k)); d.appendChild(r); grid.appendChild(d); };
    const set = (patch) => { rec('look', { ...P.look, ...patch }); renderGear(); renderBar(); };
    sec('Hair', HAIRS.map(([id, label]) => { const b = document.createElement('button'); b.className = 'chip' + (P.look.style === id ? ' on' : ''); b.textContent = label; b.onclick = () => set({ style: id }); return b; }));
    sec('Hair colour', HAIR_COL.map((c) => { const b = document.createElement('button'); b.className = 'dot' + (P.look.hair === c ? ' on' : ''); b.style.background = c; b.onclick = () => set({ hair: c }); return b; }));
    sec('Skin', SKIN_COL.map((c) => { const b = document.createElement('button'); b.className = 'dot' + (P.look.skin === c ? ' on' : ''); b.style.background = c; b.onclick = () => set({ skin: c }); return b; }));
    return;
  }
  const slot = SLOTS.find((x) => x.id === gFilter), list = P.owned.map((id) => BY_ID[id]).filter((i) => i && i.slot === gFilter).sort((a, b) => b.power - a.power);
  $('bag-title').innerHTML = `${slot.name} <span>${slot.stat === 'atk' ? 'gives ⚔ Attack' : 'gives ♥ Health'}</span>`;
  const grid = $('gear-grid'); grid.innerHTML = '';
  if (!list.length) {
    const e = document.createElement('div'); e.className = 'emptybag';
    e.innerHTML = P.owned.length ? `<p>No ${slot.name.toLowerCase()} yet.</p>` : '<p><b>Your bag is empty.</b><br>Win gold in battles and visit the shop!</p>';
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = "Today's shop"; b.onclick = openShop; e.appendChild(b); grid.appendChild(e);
  }
  for (const it of list) {
    const eq = P.eq[it.slot] === it.id, c = document.createElement('button');
    c.className = 'cell' + (eq ? ' eq' : '') + (gSel === it ? ' sel' : ''); c.style.setProperty('--rc', RARITY[it.rarity].color);
    c.innerHTML = `<img src="${ICON[it.id]}" alt="${it.name}"><small>${statTag(it)}</small>` + (eq ? '<span class="worn">✓</span>' : '');
    c.onclick = () => { gSel = gSel === it ? null : it; renderGear(); }; grid.appendChild(c);
  }
  const sh = $('gear-sheet'); sh.hidden = !gSel;
  if (gSel) {
    const it = gSel, eq = P.eq[it.slot] === it.id; sh.style.setProperty('--rc', RARITY[it.rarity].color);
    sh.innerHTML = `<img src="${ICON[it.id]}" alt=""><div><b>${it.name}</b><small style="color:${RARITY[it.rarity].color}">${RARITY[it.rarity].name}</small><small>${statLine(it)}</small></div>`;
    const b = document.createElement('button'); b.className = 'btn'; b.textContent = eq ? 'Take off' : 'Put on';
    b.onclick = () => { rec('equip', { slot: it.slot, item: eq ? null : it.id }); gSel = null; renderGear(); }; sh.appendChild(b);
  }
}

// Vad ett föremål ger, skrivet så att det går att jämföra: "+5 ⚔" eller "+8 ♥", och skillnaden mot det man har på sig.
const statTag = (it) => `+${it.power} ${it.stat === 'atk' ? '⚔' : '♥'}`;
function statLine(it) {
  const cur = P.eq[it.slot] && P.eq[it.slot] !== it.id ? BY_ID[P.eq[it.slot]].power : P.eq[it.slot] === it.id ? it.power : 0, d = it.power - cur;
  return `<b style="color:#fff">+${it.power} ${it.stat === 'atk' ? '⚔ Attack' : '♥ Health'}</b>` + (d ? ` <span style="color:${d > 0 ? '#8dffb0' : '#ef7d7d'}">(${d > 0 ? '+' : ''}${d} vs now)</span>` : '');
}
// Engelska fraser får svensk översättning de fem första gångerna, sedan står de på egna ben.
function sv(key, text) { P.heard = P.heard || {}; P.heard[key] = (P.heard[key] || 0) + 1; return P.heard[key] <= 5 ? `  (${text})` : ''; }

// ---------- Boken: orden man har mött, färgade efter hur bra man kan dem. Ord man inte mött finns inte här. ----------
const CATS = [['animal', 'Animals'], ['nature', 'Nature'], ['home', 'At home'], ['game', 'The game'], ['body', 'The body'], ['food', 'Food'], ['clothes', 'Clothes'], ['thing', 'Things'], ['color', 'Colours'], ['number', 'Numbers'], ['verb', 'Doing words'], ['adj', 'Describing words'], ['small', 'Small words'], ['function', 'Small words'], ['phrase', 'Phrases']];
let bSel = null;
function openBook() { bSel = null; show('book'); renderBook(); }
function renderBook() {
  const book = P.words || {}, day = dayNum(), all = Object.values(CONTENT).flatMap((c) => c.items).filter((i) => book[i.id]);
  $('book-count').textContent = `${all.length} ${all.length === 1 ? 'word' : 'words'}`;
  $('book-legend').innerHTML = TIERS.map((t, i) => { const n = all.filter((x) => tierOf(book[x.id]) === i).length; return `<span style="background:${t.color};color:${t.ink}" class="${n ? '' : 'none'}">${t.name}${n ? ' ' + n : ''}</span>`; }).join('');
  // Världens ordmätare överst: samma tal som bossen på kartan visar.
  const mk = curWorldIdx(), mg = bossGate(mk), mEl = $('book-meter'); mEl.hidden = !mg;
  if (mg) mEl.innerHTML = `<b>${CONTENT[mk].title || 'This world'}</b> <span>${isDone(mk, R.nodeCount(mk) - 1) ? `${mg.have} of ${mg.n} words are ${mg.tier} or better.` : mg.forced && mg.left > 0 ? `${mg.have} of ${mg.n} words are ${mg.tier} or better. The boss is open.` : meterText(mg)}</span>${meterHTML(mg)}`;
  const pages = $('book-pages'); pages.innerHTML = '';
  if (!all.length) pages.innerHTML = '<div class="emptybag"><p><b>Your book is empty.</b><br>Every word you meet in battle lands here.</p></div>';
  const groups = new Map();
  for (const it of all) { const c = CATS.find((x) => x[0] === it.cat) || CATS.find((x) => x[0] === it.pos) || ['x', 'Words']; if (!groups.has(c[1])) groups.set(c[1], []); groups.get(c[1]).push(it); }
  for (const [name, list] of groups) {
    const h = document.createElement('h3'); h.textContent = name; pages.appendChild(h);
    const g = document.createElement('div'); g.className = 'wgrid'; pages.appendChild(g);
    for (const it of list.sort((a, b) => tierOf(book[b.id]) - tierOf(book[a.id]) || a.en.localeCompare(b.en))) {
      const t = TIERS[tierOf(book[it.id])], b = document.createElement('button');
      b.className = 'wtile' + (bSel === it ? ' sel' : '') + (isDue(book[it.id], day) ? ' due' : ''); b.style.background = t.color; b.style.color = t.ink;
      b.innerHTML = (it.pic ? `<i>${pic(it)}</i>` : '') + `<b>${it.en}</b>`;
      b.onclick = () => { bSel = it; play(`audio/${it.audio}.mp3`); renderBook(); }; g.appendChild(b);
    }
  }
  const sh = $('book-sheet'); sh.hidden = !bSel;
  if (bSel) {
    const rec = book[bSel.id], t = TIERS[tierOf(rec)], need = nextNeed(rec);
    sh.style.setProperty('--rc', t.color);
    sh.innerHTML = `<div class="big">${bSel.pic ? pic(bSel) : ''}</div><div><b>${bSel.en}</b> <span>= ${bSel.sv}</span><small><em style="background:${t.color};color:${t.ink}">${t.name}</em> ${rec.r} right, ${rec.w} wrong</small>` +
      `<small>${need ? `Next: <em style="background:${need.tier.color};color:${need.tier.ink}">${need.tier.name}</em> ` + (need.days ? `needs ${need.days} more ${need.days === 1 ? 'day' : 'days'}` : 'keep answering right') : 'The strongest there is!'}${isDue(rec, day) ? ' · wants practice' : ''}</small></div>`;
  }
}

// ---------- Dagens butik: fyra föremål, nya i morgon, ingen katalog ----------
let sSel = null;
function shopToday() { const day = today(); if (!P.shop || P.shop.day !== day) rec('shop', { day, ids: dailyShop(P, day) }); return P.shop.ids.map((id) => BY_ID[id]); }
function openShop() { sSel = null; show('shop'); renderShop(); }
function renderShop() {
  document.querySelectorAll('.gold').forEach((e) => (e.textContent = fmt(P.gold)));
  const list = $('shop-list'); list.innerHTML = '';
  $('shop-try').textContent = sSel ? `Trying: ${sSel.name}` : 'Tap an item to try it on.';
  for (const it of shopToday()) {
    const own = P.owned.includes(it.id), locked = it.level > P.level, poor = P.gold < it.price;
    const c = document.createElement('div'); c.className = 'offer' + (sSel === it ? ' sel' : '') + (own ? ' sold' : ''); c.style.setProperty('--rc', RARITY[it.rarity].color);
    c.innerHTML = (locked ? '<span class="tag">Dream item</span>' : '') + `<img src="${ICON[it.id]}" alt=""><b>${it.name}</b><small style="color:${RARITY[it.rarity].color}">${RARITY[it.rarity].name}</small><small class="statline">${statLine(it)}</small>`;
    c.onclick = () => { sSel = sSel === it ? null : it; renderShop(); };
    const b = document.createElement('button'); b.className = 'btn';
    b.innerHTML = own ? 'Bought' : locked ? `Level ${it.level}` : `<span class="coin"></span>${fmt(it.price)}`; b.disabled = own || locked || poor;
    b.onclick = (e) => { e.stopPropagation(); sync.record(pid(P), 'buy', { item: it.id, price: it.price }); rec('equip', { slot: it.slot, item: it.id }); sSel = null; toast(`${it.name} is yours!`); renderShop(); if (MAP) { MAP.state.gold = P.gold; MAP.updateHud(); } };
    c.appendChild(b); if (!own && !locked && poor) { const s = document.createElement('small'); s.textContent = `Need ${fmt(it.price - P.gold)} more`; c.appendChild(s); }
    list.appendChild(c);
  }
}

function initStages() {
  stage($('gear-hero'), 0, () => gearOf(P, gSel), () => P && P.look); stages[stages.length - 1].noPed = true;
  stage($('shop-hero'), 0, () => gearOf(P, sSel), () => P && P.look);
}

// ---------- Synk: när något kommer från en annan enhet, och föräldraskärmen ----------
function onSync(c) {
  if (c.reason === 'status') { renderCloud(); if (screen === 'parent') renderParent(); return; }
  if (c.reason !== 'remote') return;
  S.profiles.forEach(adopt);
  for (const r of c.rejected || []) if (P && r.profileId === pid(P)) toast(`${BY_ID[r.item] ? BY_ID[r.item].name : 'An item'} was not bought. The gold was already used.`);
  if (screen === 'who') renderWho();
  if (!P || screen === 'battle' || screen === 'mini') return;     // rita inte om mitt i en strid eller ett minispel
  renderBar();
  if (screen === 'map' && MAP) syncMap(false);
  if (screen === 'gear') renderGear();
  if (screen === 'shop') renderShop();
  if (screen === 'book') renderBook();
}
// Molnet på profilväljaren: grått = inte inloggad, grönt = allt sparat, gult = väntar på nät, rött = logga in igen.
function renderCloud() { const s = sync.status(), b = $('cloud'); b.className = !s.signedIn ? (s.needsLogin ? 'red' : 'grey') : s.pending || !s.online ? 'yellow' : 'green'; }
$('cloud').onclick = () => { show('parent'); renderParent(); };
const ERR = { 'invalid-credentials': 'Fel e-post eller lösenord.', 'not-member': 'Kontot är inte kopplat till hushållet än (säg till Claude att köra steg B).', 'no-tables': 'Tabellerna finns inte i databasen.', network: 'Inget nät just nu.', 'not-configured': 'sync-config.js är inte ifylld.', 'other-household': 'Enheten har redan ett annat hushålls framsteg.' };
// Skapar hushållskontot. Lösenordet skrivs av föräldern här och skickas direkt till Supabase, det sparas inte i spelet.
async function signUp(email, password) {
  try {
    const r = await fetch(SYNC_CONFIG.url + '/auth/v1/signup', { method: 'POST', headers: { apikey: SYNC_CONFIG.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, msg: d.msg || d.error_description || d.message || ('fel ' + r.status) };
    return { ok: true, confirmed: !!d.access_token };
  } catch (e) { return { ok: false, msg: 'inget nät' }; }
}
// Inställningar per barn sparas som en händelse av typen 'prefs' (senaste gäller), så att de följer med mellan enheter.
const savePrefs = (p, patch = {}) => { sync.record(pid(p), 'prefs', { reading: p.reading !== false, name: p.name, young: !!p.young, ...patch }); adopt(p); };
const worldTitle = (k) => (CONTENT[k] && CONTENT[k].title) || `värld ${k + 1}`;
function namesForm() {
  const pct = (x) => Math.round(x * 100);
  return '<h3>Spelarna</h3><p class="dim">Namnen och inställningarna sparas i hushållets konto och syns på alla enheter som är inloggade.</p><div id="names">' +
    S.profiles.map((p, i) => {
      const k = curWorldIdx(p), g = bossGate(k, p), wid = R.WORLD_IDS[k], forced = !!(p.open && p.open[wid]), bossDone = isDone(k, R.nodeCount(k) - 1, p);
      const gate = !g || bossDone ? '' : `<small>${worldTitle(k)}: ${g.have} av ${g.n} ord är ${g.tier} eller bättre, bossen öppnar vid ${g.need}.</small><button type="button" class="btn alt big" data-o="${i}">${forced ? 'Bossen är öppnad för hand. Stäng igen' : 'Öppna bossen för hand'}</button>`;
      return `<div class="kid"><input data-i="${i}" maxlength="12" value="${p.name.replace(/"/g, '')}" aria-label="Namn ${i + 1}"><label class="chk"><input type="checkbox" data-r="${i}" ${p.reading !== false ? 'checked' : ''}> Läser</label><label class="chk"><input type="checkbox" data-y="${i}" ${p.young ? 'checked' : ''}> Yngre barn</label>${gate}</div>`;
    }).join('') + `</div><p class="dim">Utan "Läser" får barnet nästan bara bilduppgifter, och högst två val när något ska läsas.</p>
    <p class="dim">"Yngre barn": ${pct(K.young.thin)} procent av orden på varje bana, bossen öppnar när ${pct(K.young.bossShare)} procent av världens ord är Steel (annars ${pct(K.gate.boss.share)}), och varje ord som blir starkare ger ${K.young.learnMult} gånger så mycket xp.</p>
    <p class="dim">"Öppna bossen för hand" släpper barnet förbi ordmätaren i den värld det står i. Använd den om barnet har fastnat.</p>`;
}
function bindNames() {
  document.querySelectorAll('#names input[data-r]').forEach((el) => (el.onchange = () => { savePrefs(S.profiles[+el.dataset.r], { reading: el.checked }); renderParent(); }));
  document.querySelectorAll('#names input[data-y]').forEach((el) => (el.onchange = () => { savePrefs(S.profiles[+el.dataset.y], { young: el.checked }); renderParent(); }));
  // Öppna (eller stäng) bossen för hand: en egen händelse per värld, senaste gäller, så att den synkas som allt annat.
  document.querySelectorAll('#names button[data-o]').forEach((el) => (el.onclick = () => { const p = S.profiles[+el.dataset.o], wid = R.WORLD_IDS[curWorldIdx(p)]; sync.record(pid(p), 'unlock', { world: wid, open: !(p.open && p.open[wid]) }); adopt(p); sync.sync(); renderParent(); }));
  document.querySelectorAll('#names input[data-i]').forEach((el) => (el.oninput = () => { S.profiles[+el.dataset.i].name = el.value.trim() || `Player ${+el.dataset.i + 1}`; save(); }));
  // När fältet lämnas sparas namnet som en händelse, så att det syns på familjens andra enheter.
  document.querySelectorAll('#names input[data-i]').forEach((el) => (el.onchange = () => { savePrefs(S.profiles[+el.dataset.i]); sync.sync(); }));
}
function renderParent(msg = '') {
  const s = sync.status(), box = $('parent-box');
  const when = s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString('sv-SE') : 'aldrig';
  if (!s.signedIn) {
    box.innerHTML = `<p>${s.needsLogin ? 'Inloggningen har gått ut. Logga in igen, inget är förlorat.' : 'Logga in med hushållskontot för att spara framstegen i molnet och dela dem mellan enheter. Utan inloggning sparas allt bara på den här enheten.'}</p>
      <form id="pf"><input id="pf-email" type="email" autocomplete="username" placeholder="E-post" required><input id="pf-pass" type="password" autocomplete="current-password" placeholder="Lösenord" required><button class="btn">Logga in</button><button type="button" class="btn alt" id="pf-new">Skapa nytt konto</button></form>
      <p class="msg">${msg}</p><p class="dim">Väntar på att skickas: ${s.pending}</p>` + namesForm();
    bindNames();
    $('pf-new').onclick = async () => { const em = $('pf-email').value.trim(), pw = $('pf-pass').value; if (!em || pw.length < 8) return renderParent('Fyll i e-post och ett lösenord på minst 8 tecken först.'); $('pf-pass').value = ''; renderParent('Skapar konto...'); const r = await signUp(em, pw); renderParent(r.ok ? 'Kontot är skapat.' + (r.confirmed ? '' : ' Bekräfta via mejlet som kom.') + ' Säg till Claude så kopplas kontot till hushållet. Logga sedan in här.' : 'Det gick inte: ' + r.msg); };
    $('pf').onsubmit = async (e) => { e.preventDefault(); const em = $('pf-email').value.trim(), pw = $('pf-pass').value; $('pf-pass').value = ''; renderParent('Loggar in...'); const r = await sync.signIn(em, pw); if (r.ok) { await sync.sync(); S.profiles.forEach(adopt); renderWho(); renderParent(); } else renderParent(ERR[r.error] || 'Det gick inte: ' + r.error); };
  } else {
    box.innerHTML = `<p>Inloggad som <b>${s.email || ''}</b></p><p>Senast synkat: <b>${when}</b><br>Väntar på att skickas: <b>${s.pending}</b>${s.rejected ? `<br>Rader som servern inte tog emot: <b>${s.rejected}</b>` : ''}</p>
      ${s.storage === 'memory' ? '<p class="msg">Den här webbläsaren sparar inget när sidan stängs.</p>' : ''}${s.persisted ? '' : '<p class="dim">Lägg spelet på hemskärmen så rensar inte enheten sparningen.</p>'}
      <p class="msg">${msg}</p><div class="acts"><button class="btn" id="p-sync">Synka nu</button><button class="btn alt" id="p-out">Logga ut</button></div>` + namesForm();
    bindNames();
    $('p-sync').onclick = async () => { renderParent('Synkar...'); const r = await sync.sync(); renderParent(r.ok ? `Klart. Skickade ${r.sent}, hämtade ${r.received}.` : ERR[r.error] || 'Det gick inte: ' + r.error); };
    $('p-out').onclick = async () => { if (confirm('Logga ut? Framstegen ligger kvar på enheten.')) { await sync.signOut(); renderParent(); } };
  }
}
$('parent-back').onclick = () => { renderWho(); show('who'); };

// ---------- Helskärm ----------
// På iPad och Android kan webbläsarens flikar och fält gömmas med helskärmsläget (kräver ett tryck, därför vid Play).
// iPhone saknar den funktionen i Safari: där är enda vägen att lägga spelet på hemskärmen, så då visas ett tips.
const standalone = () => navigator.standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
function goFullscreen() {
  if (standalone() || !matchMedia('(pointer: coarse)').matches) return;
  const el = document.documentElement, fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (fn) { try { const r = fn.call(el); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
  else $('fs-tip').hidden = false;
}

// ---------- Uppdateringar ----------
// En app på hemskärmen kan ligga öppen i dagar utan att laddas om. Därför jämförs versionen med servern vid start,
// varje gång appen kommer fram igen och en gång i halvtimmen. Finns en nyare version laddas sidan om, men aldrig mitt i en strid eller ett minispel.
let BUILD = null, stale = false;
const fetchBuild = async () => { try { const r = await fetch('version.json?' + Date.now(), { cache: 'no-store' }); return r.ok ? (await r.json()).build : null; } catch (e) { return null; } };
async function checkUpdate() {
  const b = await fetchBuild(); if (!b) return;
  if (!BUILD) { BUILD = b; return; }
  if (b !== BUILD) { stale = true; if (screen !== 'battle' && screen !== 'mini') location.reload(); }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
setInterval(checkUpdate, 30 * 60 * 1000);
if (location.protocol === 'https:' && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// ---------- Start ----------
(async function () {
  const art = await loadArt();
  words = (await (await fetch('audio/words.json')).json()).words;
  for (const n of [1, 2, 3]) try { CONTENT[n - 1] = await (await fetch(`content/world${n}.json`)).json(); } catch (e) { console.error(`world${n}.json`, e); }
  checkUpdate(); preloadPics();
  for (const g of Object.values(MINI)) g.load().catch(() => {});     // minispelens kod hämtas i förväg, så att de går att öppna utan nät
  await sync.init({ ...SYNC_CONFIG, xpToLevel });
  S.profiles.forEach(adopt);
  sync.subscribe(onSync);
  renderWho(); renderCloud();
  // Titelskärm, och introfilmen första gången på den här enheten (går att trycka förbi).
  const root = $('title-root'), looks = S.profiles.map((p) => p.look);
  const off = showTitle(root, { looks, onPlay: () => {
    unlock(); off(); goFullscreen();
    const go = () => { S.seenIntro = true; save(); renderWho(); show('who'); };
    if (S.seenIntro) go(); else playIntro(root, { play, look: looks[0], onDone: go });
  } });
  window.__game = { S: () => S, P: () => P, art, battle: () => battle, map: () => MAP, gate: (k) => bossGate(k), practice: (k) => practiceTarget(k), openBook, mapInfo: pushMapInfo, startBattle: (k, i) => startBattle(k, i, MAP.worlds[k].nodes[i], MAP.worlds[k]), openShop, openGear, levelUp, mini: () => mini, openMini: (k, slot) => { const w = MAP.worlds[k], nd = typeof slot === 'number' ? w.nodes[slot] : w.side.find((x) => x.slot === slot); openMini(k, slot, nd); }, miniWords, pick: (n) => { P = S.profiles[n]; enterMap(true); } };
})();
