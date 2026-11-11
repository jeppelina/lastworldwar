// Spelets skal: vem spelar, karta, strid, resultat, utrustning och dagens butik.
import { G, ramp } from './pixel.js';
import { W, H, drawHero, drawIcon } from './hero.js';
import { ITEMS, BY_ID, SLOTS, RARITY, dailyShop, heroStats, xpToLevel } from './catalog.js';
import { Battle, loadArt } from './battle.js';
import { Quiz } from './quiz.js';
import { showTitle, playIntro } from './intro.js';
import { pic } from './pics.js';
import { TIERS, tierOf, isDue, nextNeed, record as wordRecord, meet as wordMeet } from './words.js';
import * as sync from './sync.js';
import { SYNC_CONFIG } from './sync-config.js';

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
// Boken räknas fram ur händelserna av typen 'words' (en per spelad bana: [ord, övningstyp, 1 rätt | 0 fel | -1 första mötet]).
function bookFor(id) {
  const book = {};
  for (const e of sync.exportLocal().events) if (e.profile === id && e.type === 'words') for (const [w, type, r] of e.payload.a || []) { if (r < 0) wordMeet(book, w, e.payload.day); else wordRecord(book, w, r > 0, type, e.payload.day); }
  return book;
}
const adopt = (p) => { Object.assign(p, sync.stateFor(pid(p), today())); p.words = bookFor(pid(p)); save(); };
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
function sfx(kind) {
  try {
    unlock(); const t = actx.currentTime, tone = (f0, f1, at, dur, type, vol) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t + at); o.frequency.exponentialRampToValueAtTime(f1, t + at + dur);
      g.gain.setValueAtTime(0.0001, t + at); g.gain.exponentialRampToValueAtTime(vol, t + at + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur); o.connect(g); g.connect(actx.destination); o.start(t + at); o.stop(t + at + dur + 0.02); };
    if (kind === 'right') { tone(784, 784, 0, 0.11, 'triangle', 0.22); tone(1175, 1175, 0.1, 0.2, 'triangle', 0.22); }
    else if (kind === 'wrong') { tone(220, 150, 0, 0.28, 'sawtooth', 0.12); tone(110, 80, 0, 0.3, 'sine', 0.2); }
  } catch (e) {}
}

// ---------- Ikoner ----------
const ICON = {};
{ const c = document.createElement('canvas'); c.width = c.height = 32; const ctx = c.getContext('2d'), g = new G(32, 32); for (const it of ITEMS) { g.clear(); drawIcon(g, it); ctx.clearRect(0, 0, 32, 32); g.paint(ctx); ICON[it.id] = c.toDataURL(); } }

function show(id) { document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('on', s.id === id)); screen = id; }
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
    if (node.type === 'chest') { if (done) return toast('The chest is empty.'); rec('stage', { world: w.id, node: i, kind: 'chest', win: true, stars: 1, gold: node.gold, xp: 0 }); toast(`You found ${node.gold} gold!`); MAP.finish(k, i, 1); return afterMapChange(); }
    if (node.type === 'shop') { if (!done) { rec('stage', { world: w.id, node: i, kind: 'shop', win: true, stars: 1, gold: 0, xp: 0 }); MAP.finish(k, i, 1); afterMapChange(); } return openShop(); }
    startBattle(k, i, node, w);
  },
};
function afterMapChange() { P.done = JSON.parse(JSON.stringify(MAP.state.done)); MAP.state.gold = P.gold; MAP.updateHud(); save(); renderBar(); }
function syncMap(jump) { MAP.load(P.done, P.gold); if (jump) { const cw = MAP.curWorld(); MAP.setView('world', cw < 0 ? MAP.worlds.length - 1 : cw, true); } }
function enterMap(jump) {
  show('map'); renderBar();
  if (!$('map-frame').src) $('map-frame').src = 'map/index.html'; else if (MAP) syncMap(jump);
}
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

// ---------- Strid ----------
function wordsFor(k, i) { const n = words.length, off = (k * 6 + Math.floor(i / 3) * 3) % n; return Array.from({ length: 12 }, (_, j) => words[(off + j) % n]); }
function startBattle(k, i, node, w) {
  show('battle');
  P.words = P.words || {};
  const quiz = CONTENT[k] ? new Quiz({ content: CONTENT[k], nodeIdx: i, book: P.words, day: dayNum(), play, save, onAnswer: (t, right) => sync.record(pid(P), 'answer', { word: 'en:' + t.item.id, exercise: t.type, correct: right, stage: w.id + ':' + i }) }) : null;   // värld 1 har byggd pedagogik, övriga kör enkla frågor tills vidare
  battle = new Battle($('battle-root'), { profile: P, worldIdx: k, nodeIdx: i, node, words: wordsFor(k, i), quiz, play, sfx, voiceIdle, onEnd: (r) => endBattle(r, k, i, node, w) });
  if ((P.runs || 0) < 3) { play('audio/en-listen.mp3'); toast('Listen, and choose the picture.' + sv('listen', 'Lyssna och välj bilden.')); }
}
function endBattle(r, k, i, node, w) {
  const first = !(P.done[w.id] && P.done[w.id][i]), bonus = r.win ? Math.round(node.gold * (first ? 1 : 0.4) * 0.7) : 0;
  const lv = P.level, log = battle && battle.quiz ? battle.quiz.log : [];
  for (let c = 0; c < log.length; c += 30) sync.record(pid(P), 'words', { day: dayNum(), a: log.slice(c, c + 30).map((l) => [l.id, l.type, l.free && !l.right ? -1 : l.right ? 1 : 0]) });
  rec('stage', { world: w.id, node: i, kind: 'battle', win: r.win, stars: r.stars, gold: r.gold + bonus, xp: r.xp });
  const ups = P.level - lv;
  const el = $('result'); el.hidden = false; el.className = r.win ? 'win' : 'lose';
  el.querySelector('h2').textContent = r.win ? 'Good job!' : 'Try again!';
  el.querySelector('.sv').textContent = r.win ? sv('good-job', 'Bra jobbat!').trim() : sv('try-again', 'Försök igen!').trim();
  el.querySelector('.stars').innerHTML = r.win ? [0, 1, 2].map((s) => (s < r.stars ? '★' : '<i>★</i>')).join('') : '';
  el.querySelector('.lines').innerHTML = (r.win ? `You won at ${node.name}.\n` : `You reached fight ${Math.min(r.kills + 1, r.fights)} of ${r.fights}.\n`) +
    `<b>+${fmt(r.gold + bonus)} gold</b>` + (ups ? `\n<b>Level ${P.level}!</b> You are stronger now.` : '') +
    (r.win ? '' : '\nYou keep your gold. Play an easier level again to get stronger.');
  const acts = el.querySelector('.acts'); acts.innerHTML = '';
  const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = () => { el.hidden = true; if (battle) battle.destroy(); battle = null; fn(); }; acts.appendChild(b); };
  if (!r.win) btn('Try again', '', () => startBattle(k, i, node, w));
  btn('Map', r.win ? '' : 'alt', () => { enterMap(false); if (r.win) { MAP.state.gold = P.gold; MAP.finish(k, i, r.stars); } afterMapChange(); });
  play(r.win ? 'audio/en-good-job.mp3' : 'audio/en-try-again.mp3');
}

// ---------- Utrustning: hjälten i mitten med platserna runt om, och det man äger för vald plats ----------
let gFilter = 'weapon', gSel = null;
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
      b.onclick = () => { gFilter = sid; gSel = null; renderGear(); }; col.appendChild(b);
    }
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
const CATS = [['animal', 'Animals'], ['nature', 'Nature'], ['food', 'Food'], ['thing', 'Things'], ['color', 'Colours'], ['number', 'Numbers'], ['verb', 'Doing words'], ['adj', 'Describing words'], ['small', 'Small words'], ['function', 'Small words'], ['phrase', 'Phrases']];
let bSel = null;
function openBook() { bSel = null; show('book'); renderBook(); }
function renderBook() {
  const book = P.words || {}, day = dayNum(), all = Object.values(CONTENT).flatMap((c) => c.items).filter((i) => book[i.id]);
  $('book-count').textContent = `${all.length} ${all.length === 1 ? 'word' : 'words'}`;
  $('book-legend').innerHTML = TIERS.map((t, i) => { const n = all.filter((x) => tierOf(book[x.id]) === i).length; return `<span style="background:${t.color};color:${t.ink}" class="${n ? '' : 'none'}">${t.name}${n ? ' ' + n : ''}</span>`; }).join('');
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
  if (!P || screen === 'battle') return;                          // rita inte om mitt i en strid
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
function namesForm() {
  return '<h3>Spelarnas namn</h3><p class="dim">Namnen sparas bara på den här enheten, inte i molnet.</p><div id="names">' +
    S.profiles.map((p, i) => `<input data-i="${i}" maxlength="12" value="${p.name.replace(/"/g, '')}" aria-label="Namn ${i + 1}">`).join('') + '</div>';
}
function bindNames() { document.querySelectorAll('#names input').forEach((el) => (el.oninput = () => { S.profiles[+el.dataset.i].name = el.value.trim() || `Player ${+el.dataset.i + 1}`; save(); })); }
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

// ---------- Start ----------
(async function () {
  const art = await loadArt();
  words = (await (await fetch('audio/words.json')).json()).words;
  try { CONTENT[0] = await (await fetch('content/world1.json')).json(); } catch (e) { console.error('world1.json', e); }
  await sync.init({ ...SYNC_CONFIG, xpToLevel });
  S.profiles.forEach(adopt);
  sync.subscribe(onSync);
  renderWho(); renderCloud();
  // Titelskärm, och introfilmen första gången på den här enheten (går att trycka förbi).
  const root = $('title-root'), looks = S.profiles.map((p) => p.look);
  const off = showTitle(root, { looks, onPlay: () => {
    unlock(); off();
    const go = () => { S.seenIntro = true; save(); renderWho(); show('who'); };
    if (S.seenIntro) go(); else playIntro(root, { play, look: looks[0], onDone: go });
  } });
  window.__game = { S: () => S, P: () => P, art, battle: () => battle, map: () => MAP, startBattle: (k, i) => startBattle(k, i, MAP.worlds[k].nodes[i], MAP.worlds[k]), openShop, openGear, pick: (n) => { P = S.profiles[n]; enterMap(true); } };
})();
