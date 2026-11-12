// Bossfightens ramverk: det som är gemensamt för alla bossar med egen mekanik (docs/research/bossar.md, avsnitt 2).
// En boss med egen mekanik är en vanlig strid på bossnoden där själva bosstriden byts ut: bossen pratar först, sedan
// kommer bossens egna uppgifter i tre faser, och i stället för livmätare har bossen en rad ordstenar. Reglerna
// (stenar, faser, skada, stenar som står kvar) ligger i rules.js och talen i balance.js (K.boss), så att simulatorn
// kör samma sak. Här finns bara det som syns: repliker, stenraden, fasbytet, segern och förlusten.
//
// EN NY BOSS behöver bara ett manus (se troll.js och sphinx.js) och en rad i index.js:
//   { id, title, cheer: [en, sv], lines: { intro, again, phase: [fas 2, fas 3], right: [...], wrong: [...], win, lose },
//     make(ctx) } där make returnerar mekaniken: { next(phase, retry) -> uppgift, render(uppgift, done) }.
//   Replikerna är par [engelska, svenska]. Svenskan visas som liten stödrad, som i resten av spelet.
//   done({ right, stones, retry, resume }) anropas när barnet har svarat:
//     right   uppgiften löstes (hjälten slår och stenar tänds), annars slår bossen
//     stones  antal stenar som tänds (1 om inget anges)
//     retry   det mekaniken vill ha tillbaka i nästa next() efter ett fel (samma uppgift igen, men lättare)
//     resume  funktion: uppgiften står kvar efter bossens slag (sfinxens gåta), i stället för att en ny hämtas
//   ctx ger mekaniken det den behöver: ordurval (words), ljud i tur och ordning (say), väntan som dör med striden (wait),
//   frågeraden (prompt), panelens delar (ui), bokföring i ordboken (record) och barnets läge (reading, small).
import * as R from '../rules.js';
import { K } from '../balance.js';
import { pic } from '../pics.js';
import { isDue, tierOf } from '../words.js';

export const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Ordet som bild, eller som skriven text om det saknar bild eller om text är begärd.
export const face = (item, text) => (text || !item.pic ? `<span class="bt">${esc(item.en)}</span>` : pic(item));

// Bossens ord: orden barnet kan ha mött (världens egna och tidigare världars), utan fraser och utan dubbletter.
// Ordning: mötta ord som vill repeteras först, sedan mötta ord från svagast till starkast, sist ord barnet aldrig mött
// (de används bara om de mötta inte räcker: bossen inför inga ord).
//   o.pic     bara ord med bild            o.own    bara världens egna ord (inte tidigare världar)
//   o.text    går att visa som ordkort: ett enda ord, högst o.maxLen tecken (förval 8)
export function bossWords(quiz, o = {}) {
  const book = quiz.book || {}, seen = new Set();
  const rank = (it) => { const r = book[it.id]; return !r ? 99 : isDue(r, quiz.day) ? 0 : 1 + Math.max(0, tierOf(r)); };
  return quiz.reach.filter((it) => {
    if (it.pos === 'phrase' || (o.pic && !it.pic) || (o.own && !(it.node > 0))) return false;
    if (o.text && (/\s/.test(it.en) || it.en.length > (o.maxLen || 8))) return false;
    const key = String(it.en).toLowerCase(); if (seen.has(key) || seen.has('sv:' + it.sv)) return false; seen.add(key); seen.add('sv:' + it.sv);
    return true;
  }).map((it) => [rank(it), book[it.id] ? book[it.id].s : 0, Math.random(), it]).sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]).map((x) => x[3]);
}
export const met = (quiz, it) => !!(quiz.book || {})[it.id];

export class BossFight {
  // bt: striden (Battle i battle.js), efter att R.startFight har startat bosstriden. spec: bossens manus.
  // o: { kept (stenar som står kvar från förra försöket), young, data (bossens innehållsfil), svShow(nyckel) -> visa svensk stödrad?, tempo }
  constructor(bt, spec, o = {}) {
    this.bt = bt; this.spec = spec; this.o = o; this.b = R.startBoss(bt.run, o.kept || 0, !!o.young);
    this.tempo = o.tempo ?? 1; this.started = false; this.talk = 0; this.lineNo = 0; this.mouth = 0; this.defeated = 0; this.pending = 0; this.blow = null; this.last = null;
    this.retry = null; this.resume = null; this.missed = []; this.timers = new Set(); this.auto = null; this.asked = 0;
    const quiz = bt.$('.quiz'); quiz.className = 'quiz boss b-' + spec.id;
    quiz.innerHTML = '<div class="speak"><button class="again" aria-label="Play again">🔊</button><button class="slow" aria-label="Slowly">🐢</button></div><div class="bmain"><div class="brow"></div><div class="cards"></div></div><div class="bside"></div>';
    const $ = (s) => quiz.querySelector(s); let again = null, slow = null;
    $('.again').onclick = () => again && again(); $('.slow').onclick = () => slow && slow();
    const speak = () => { $('.speak').style.visibility = again || slow ? '' : 'hidden'; $('.slow').style.visibility = slow ? '' : 'hidden'; };
    this.ui = { quiz, row: $('.brow'), cards: $('.cards'), side: $('.bside'),
      again: (fn) => { again = fn || null; speak(); }, slow: (fn) => { slow = fn || null; speak(); },
      clear: () => { $('.brow').innerHTML = ''; $('.brow').className = 'brow'; $('.cards').innerHTML = ''; $('.cards').className = 'cards'; $('.bside').innerHTML = ''; again = slow = null; speak(); } };
    this.ui.clear();
    this.bubble = document.createElement('button'); this.bubble.className = 'bsay'; this.bubble.hidden = true; bt.$('.scene').appendChild(this.bubble);
    bt.$('.word').textContent = '';
    this.mech = spec.make(this.ctx());
    this.hud();
  }
  alive() { return !this.bt.over && !this.dead; }
  stop() { this.dead = true; this.timers.forEach(clearTimeout); this.timers.clear(); }
  later(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); if (this.alive()) fn(); }, Math.max(0, ms * this.tempo)); this.timers.add(id); return id; }
  wait(ms) { return new Promise((res) => this.later(res, ms)); }           // blir aldrig klar när striden är slut, så slingor stannar av sig själva
  // Ett ord sägs, och löftet blir klart när rösten har pratat färdigt (högst några sekunder, så att inget fastnar utan ljud).
  say(item, slow) {
    if (!this.alive()) return new Promise(() => {});
    if (this.tempo < 0.2) return Promise.resolve();                         // testkörning i hög fart: inget ljud
    const done = this.bt.play(`audio/${item.audio}${slow ? '.slow' : ''}.mp3`);
    return Promise.race([done, new Promise((r) => setTimeout(r, 3500))]).then(() => (this.alive() ? undefined : new Promise(() => {})));
  }
  ctx() {
    const bt = this.bt, q = bt.quiz, reading = q.reading !== false, young = !!this.o.young;
    return { quiz: q, reading, young, small: !reading || young, S: K.boss, data: this.o.data || null, ui: this.ui, sfx: (k) => bt.sfx && bt.sfx(k),
      words: (o) => bossWords(q, o), met: (it) => met(q, it), alive: () => this.alive(), wait: (ms) => this.wait(ms), say: (it, slow) => this.say(it, slow),
      talk: (on) => { this.mouth = on ? 1 : 0; }, prompt: (en, sv, key) => this.prompt(en, sv, key), record: (item, right, as, ex, chosen) => this.record(item, right, as, ex, chosen),
      setAuto: (fn) => { this.auto = fn; } };
  }
  // Frågeraden i scenens nederkant: kort engelsk text, och svenskan som liten rad de fem första gångerna (som i resten av spelet).
  prompt(en, sv, key) {
    const w = this.bt.$('.word'); w.className = 'word long bprompt';
    const show = sv && (!this.o.svShow || this.o.svShow('boss-' + (key || en)));
    w.innerHTML = en ? esc(en) + (show ? `<small class="below">${esc(sv)}</small>` : '') : '';
  }
  // Svaret bokförs som ett vanligt stridssvar: samma record() i words.js, med vikten för övningstypen `as`.
  // ex = bossuppgiftens eget namn i svarsloggen (lv_answers). Ordboken ser bara `as`, så äldre klienter räknar likadant.
  // chosen = det barnet valde vid ett fel. ms = tiden sedan uppgiften kom upp (bossens uppläsning inräknad).
  record(item, right, as, ex, chosen) {
    if (!item) return;
    if (!right && !this.missed.includes(item)) this.missed.push(item);
    this.bt.quiz.done({ item, type: as, ex, free: false, ms: Date.now() - (this.t0 || Date.now()), chosen: right || chosen == null ? undefined : String(chosen) }, !!right);
  }
  // En replik från bossen i en pratbubbla, med munnen i rörelse. Klar efter en stund eller när barnet trycker på bubblan.
  line(pair, ms = K.boss.talkMs) {
    if (!pair || !this.alive()) return Promise.resolve();
    return new Promise((res) => {
      const b = this.bubble, no = ++this.lineNo; let done = false;
      const end = () => { if (done) return; done = true; if (no === this.lineNo) { b.hidden = true; b.onclick = null; this.talk = 0; } res(); };      // en nyare replik får stå kvar
      b.innerHTML = `<b>${esc(pair[0])}</b>${pair[1] ? `<small>${esc(pair[1])}</small>` : ''}`; b.hidden = false; b.onclick = end; this.talk = 1; this.skip = end;
      this.later(end, ms);
    });
  }
  // En kort kommentar som inte väntar in något (efter rätt och fel svar).
  quip(list) { if (!list || !list.length) return; const p = Array.isArray(list[0]) ? list[Math.floor(Math.random() * list.length)] : list; this.line(p, 1500); }
  phaseNow() { return R.bossPhase(this.b); }
  lastPhase() { return this.phaseNow() > K.boss.phases.length; }
  // Stenraden står där fiendens liv brukar stå. Stenar som stod kvar från förra försöket har en egen ton.
  hud() {
    const bt = this.bt, foe = bt.$('.foe'), b = this.b; foe.classList.add('stonebar');
    let row = foe.querySelector('.stones');
    if (!row) { row = document.createElement('span'); row.className = 'stones'; row.innerHTML = Array.from({ length: b.stones }, () => '<i></i>').join(''); foe.appendChild(row); }
    [...row.children].forEach((el, i) => { el.classList.toggle('lit', i < b.lit); el.classList.toggle('kept', i < b.kept); });
    row.setAttribute('aria-label', `${b.lit} of ${b.stones} stones`);
    bt.$('.wave').textContent = `Phase ${this.phaseNow()}/${K.boss.phases.length + 1}`;
    bt.$('.streak').style.display = 'none';
  }
  // Det som skickas med till bossens ritfunktion (bosses.js): vilken attack, andra skepnaden i sista fasen, segerposen, munnen.
  pose(anim) { return { attackKind: anim && anim.who === 'enemy' ? anim.kind || 0 : 0, phase: this.lastPhase() && !this.defeated ? 2 : 1, defeated: this.defeated, talk: this.talk || this.mouth }; }

  // ----- turordningen -----
  async ask() {
    const bt = this.bt; if (!this.alive()) return;
    if (!this.started) {
      this.started = true; bt.phase = 'talk';
      await this.line(this.b.kept ? this.spec.lines.again : this.spec.lines.intro);
      if (this.b.kept) { bt.banner(`${this.b.kept} ${this.b.kept === 1 ? 'stone is' : 'stones are'} still lit!`, false); await this.wait(900); }
    }
    bt.phase = 'ask'; bt.first = true; this.ui.quiz.classList.remove('ok', 'bad'); this.auto = null; this.asked++;
    const retry = this.retry; this.retry = null; this.ui.clear();
    let task; try { task = this.mech.next(this.phaseNow(), retry); } catch (e) { console.error('boss task', e); task = null; }
    if (!task) { console.error('boss: no task'); return this.answer({ right: true }); }      // ska inte hända: hellre en sten än en strid som står still
    this.task = task; this.t0 = Date.now();
    this.mech.render(task, (r) => this.answer(r));
  }
  answer(r) {
    const bt = this.bt; if (bt.phase !== 'ask' || !this.alive()) return;
    bt.mark(!!r.right); bt.phase = 'anim';
    if (r.right) { this.pending = Math.max(1, r.stones || 1); this.resume = null; bt.heroAttack(false); if ((r.stones || 1) > 1) { bt.banner('DOUBLE!', true); bt.$('.banner').classList.add('cheer'); } else this.quip(this.spec.lines.right); }
    else { R.answerWrong(bt.run); this.retry = r.retry || null; this.resume = r.resume || null; this.blow = 'wrong'; bt.enemyAttack(0); this.quip(r.say || this.spec.lines.wrong); }
    this.hud();
  }
  // Hjältens slag landar: stenarna tänds vid attackens första träff. Bossen har inget liv att ta av.
  heroHits(ev) {
    const bt = this.bt, m = bt.enemy.members[0];
    if (!this.pending) return [{ m, dmg: '' }];
    const n = this.pending; this.pending = 0; this.last = R.bossRight(bt.run, n);
    if (bt.sfx) bt.sfx('good');
    this.hud();
    return [{ m, dmg: `+${n} ◆` }];
  }
  afterHero() {
    const bt = this.bt, r = this.last || {}; this.last = null;
    if (r.won) return this.win();
    if (r.phaseUp) return this.phaseBeat();
    bt.hud(); bt.phase = 'wait'; bt.askSoon(1300);
  }
  // Fasbytet ser likadant ut hos alla bossar: bossen blinkar och säger en replik, ett förvarnat slag (attack 1), lite liv tillbaka.
  async phaseBeat() {
    const bt = this.bt, m = bt.enemy.members[0], ph = this.phaseNow(); bt.phase = 'talk'; bt.hud(); this.ui.clear(); this.prompt('');
    for (let i = 0; i < 3; i++) { m.flashUntil = bt.now() + 0.1; await this.wait(190); }
    bt.banner(`Phase ${ph}`, true); await this.wait(1100);
    await this.line(this.spec.lines.phase[ph - 2]);
    bt.banner('Watch out!', true); await this.wait(700);
    this.blow = 'phase'; bt.phase = 'anim'; bt.enemyAttack(1);
  }
  // Bossens slag landar. Returnerar skadan (fasbytets slag kan bli 0 om hjälten bara har 1 liv kvar).
  strike() { return this.blow === 'phase' ? R.bossPhaseHit(this.bt.run) : R.bossWrong(this.bt.run); }
  afterEnemy() {
    const bt = this.bt, blow = this.blow; this.blow = null;
    if (blow === 'phase') {
      const heal = R.bossPhaseHeal(bt.run);
      if (heal > 0) { bt.float(`+${heal} ♥`, bt.heroX, bt.groundY - 62, 'heal'); if (bt.sfx) bt.sfx('good'); }
      bt.hud(); bt.phase = 'wait'; bt.answeredAt = performance.now(); return bt.askSoon(1200);
    }
    if (R.defeated(bt.run)) return this.lose();
    bt.hud(); bt.phase = 'wait';
    const resume = this.resume; this.resume = null;
    if (!resume) return bt.askSoon(2000);
    this.later(() => { bt.phase = 'ask'; this.ui.quiz.classList.remove('ok', 'bad'); resume(); }, 1500);      // samma gåta står kvar
  }
  // Seger: bossen är hjälpt, inte slagen. Den står kvar i segerposen, gnistorna flyger, och bossen säger sin sista replik.
  async win() {
    const bt = this.bt, f = bt.enemy.f, m = bt.enemy.members[0]; bt.phase = 'talk'; this.defeated = 1; this.ui.clear(); this.prompt('');
    bt.hud(); bt.banner(this.spec.cheer[0], true); bt.$('.banner').classList.add('cheer'); if (bt.sfx) bt.sfx('win');
    await this.wait(300);
    for (let i = 0; i < 4; i++) { bt.sparks(m.x - f.def.w * 0.1 + (i - 1.5) * 14, bt.groundY - f.def.h * (0.45 + 0.1 * i), 12); await this.wait(240); }
    const gold = Math.round(f.gold * (bt.rewardMult ?? 1));
    if (gold > 0) bt.float(`+${gold} gold`, m.x, bt.groundY - f.def.h - 14, 'gold');
    await this.line(this.spec.lines.win, K.boss.talkMs * 1.3);
    bt.sparks(m.x, bt.groundY - f.def.h * 0.6, 16);
    await this.wait(500);
    bt.finish(true);
  }
  // Förlust: snäll. Bossen säger något dumt, och resultatskärmen visar vilka ord som är värda att öva.
  async lose() {
    const bt = this.bt; bt.phase = 'talk'; bt.hero.deadAt = bt.now(); this.ui.clear(); this.prompt('');
    await this.wait(500);
    await this.line(this.spec.lines.lose, K.boss.talkMs * 1.2);
    bt.finish(false);
  }
  // Det resultatskärmen behöver utöver stridens vanliga resultat.
  summary() { return { id: this.spec.id, title: this.spec.title, cheer: this.spec.cheer, lose: this.spec.lines.lose, missed: this.missed.slice(0, 6) }; }
}
