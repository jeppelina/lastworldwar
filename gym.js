// Ordgymmet: en träningslokal där barnet övar ALLA ord det har mött, för att lyfta dem högre än Steel.
// Ingen fiende och ingen risk. Belöningen är den vanliga för ord som når en ny nivå (xp och guld, se K.learn i balance.js)
// plus en liten dagsbonus första passet varje dag (K.gym.daily). main.js står för bokföringen (startGym där).
import { Quiz } from './quiz.js';
import { tierOf, isDue, nextNeed, TIERS } from './words.js';

const pickOf = (a) => a[Math.floor(Math.random() * a.length)];

// Samma övningsmotor som i striderna, men urvalet gäller hela ordboken: först ord som kan stiga i dag
// (poäng och dagar räcker snart), ord som vill repeteras, och de lägsta nivåerna före de högsta.
class GymQuiz extends Quiz {
  next() {
    this.asked++;
    if (this.requeue.length && this.asked - this.requeue[0].at >= 2) return this.task(this.requeue.shift().item);
    if (this.sentences.length && this.asked > 2 && Math.random() < 0.3) {
      const s = pickOf(this.sentences.filter((x) => x !== this.lastSentence).length ? this.sentences.filter((x) => x !== this.lastSentence) : this.sentences);
      this.lastSentence = s; return { sentence: s, type: s.gap && Math.random() < 0.3 ? 'sentence_gap' : 'build_sentence' };
    }
    const pool = this.own.filter((i) => i !== this.last && !this.seen.has(i.id)), rest = this.own.filter((i) => i !== this.last), all = pool.length ? pool : rest.length ? rest : this.own;
    // Kan ordet stiga en nivå i dag? Dagskravet räknar med att ett rätt svar i dag ger en ny dag om ordet inte redan fått det.
    const canRise = (i) => { const r = this.book[i.id], n = nextNeed(r); return !!n && n.days - (r.ld !== this.day ? 1 : 0) <= 0; };
    const key = (i) => { const r = this.book[i.id]; return (canRise(i) ? 0 : 100) + (isDue(r, this.day) ? 0 : 20) + tierOf(r) * 2 - Math.min(1.9, r.s / 30); };
    const sorted = all.slice().sort((a, b) => key(a) - key(b)), item = sorted[Math.floor(Math.random() * Math.min(sorted.length, 5))];
    this.seen.add(item.id); if (this.seen.size >= this.own.length) this.seen.clear();
    return this.task(item);
  }
}

let el = null;
function build() {
  el = document.createElement('section'); el.id = 'gym'; el.className = 'screen';
  el.innerHTML = `<header><button class="back">◀ Back</button><h2>Word Gym</h2><div class="wallet gym-count"></div></header>
    <div class="gym-stage"><div class="gym-tip"></div><div class="gym-dots"></div><div class="word"></div></div><div class="quiz"></div>
    <div class="gym-done" hidden><div class="box"><h2></h2><p class="lines"></p><div class="acts"></div></div></div>`;
  document.body.appendChild(el);
}

// o: { items (mötta ord), sentences, book, day, reading, play, sfx, save, questions, onAnswer(task, right, up), onDone(log) -> { words, xp, gold, bonus }, onClose() }
export function openGym(o) {
  if (!el) build();
  const $ = (q) => el.querySelector(q); let total = o.questions || 15;
  const wordEl = $('.word'), quizEl = $('.quiz'), done = $('.gym-done');
  let asked = 0, right = 0, closed = false, quiz = null;
  const close = () => { closed = true; quizEl.innerHTML = ''; wordEl.innerHTML = ''; o.onClose(); };
  $('.back').onclick = () => { if (asked > 0 && done.hidden) finish(true); else close(); };
  done.hidden = true; quizEl.className = 'quiz';

  if (o.items.length < 4) {
    $('.gym-tip').textContent = 'Meet more words in battle first. Then come back to train them!'; $('.gym-dots').innerHTML = ''; $('.gym-count').textContent = '';
    wordEl.innerHTML = ''; quizEl.innerHTML = ''; return;
  }
  // Välj vad som ska tränas: en nivå i taget (Wood till Iron, Iron till Steel ...) eller allt blandat.
  if (o.tier === undefined) {
    const groups = TIERS.map((t, i) => ({ t, i, n: o.items.filter((it) => tierOf(o.book[it.id]) === i).length })).filter((g) => g.n > 0 && g.i < TIERS.length - 1);
    $('.gym-tip').innerHTML = 'What do you want to train? <small>(Vad vill du träna?)</small>'; $('.gym-dots').innerHTML = ''; $('.gym-count').textContent = ''; wordEl.innerHTML = '';
    quizEl.innerHTML = '<div class="gym-pick"></div>'; const box = quizEl.querySelector('.gym-pick');
    const add = (html, tier, style) => { const b = document.createElement('button'); b.className = 'gym-opt'; b.innerHTML = html; if (style) b.style.cssText = style; b.onclick = () => openGym({ ...o, tier, again: () => ({ ...o, tier: undefined }) }); box.appendChild(b); };
    for (const g of groups) add(`<b>${g.t.name} → ${TIERS[g.i + 1].name}</b><small>${g.n} ${g.n === 1 ? 'word' : 'words'}</small>`, g.i, `background:linear-gradient(90deg, ${g.t.color}, ${TIERS[g.i + 1].color});color:${g.t.ink}`);
    add(`<b>Mix</b><small>all ${o.items.length} words</small>`, -1, '');
    return;
  }
  const mine = o.tier >= 0 ? o.items.filter((it) => tierOf(o.book[it.id]) === o.tier) : o.items;
  if (o.tier >= 0) total = Math.min(total, Math.max(5, mine.length * 3));      // få ord på nivån: kortare pass, inte samma ord femton gånger
  // Alla mötta ord finns med som felalternativ (reach), men frågorna gäller bara den valda nivåns ord (introduce).
  const content = { items: o.items.map((it) => ({ ...it, node: 1 })), sentences: o.tier >= 0 ? [] : o.sentences || [], nodes: [{ n: 1, type: 'level', introduce: mine.map((it) => it.id), phrases: [], sentences: o.tier >= 0 ? [] : (o.sentences || []).map((s) => s.id) }] };
  quiz = new GymQuiz({ content, nodeIdx: 0, book: o.book, day: o.day, reading: o.reading, play: o.play, save: o.save, sfx: o.sfx, newCap: 0, onAnswer: o.onAnswer });
  quiz.seen = new Set();
  quiz.onSlip = () => {};                 // i gymmet finns ingen fiende: ett fel ord i en mening kostar inget, barnet fortsätter
  $('.gym-tip').innerHTML = (o.tier >= 0 ? `${TIERS[o.tier].name} → ${TIERS[o.tier + 1].name}: ` : '') + 'Train your words to make them stronger. <small>(Träna dina ord så blir de starkare.)</small>';

  const dots = () => { $('.gym-dots').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < asked ? 'on' : ''}"></i>`).join(''); $('.gym-count').textContent = `${Math.min(asked + 1, total)} / ${total}`; };
  function ask() {
    if (closed) return;
    if (asked >= total) return finish(false);
    dots(); quizEl.classList.remove('ok', 'bad');
    const task = quiz.next();
    quiz.render(task, quizEl, wordEl, (r) => {
      asked++; if (r.right) right++;
      quizEl.classList.add(r.right ? 'ok' : 'bad'); if (o.sfx) o.sfx(r.right ? 'right' : 'wrong');
      setTimeout(ask, r.right ? 1700 : 2900);
    });
  }
  function finish(early) {
    const sum = o.onDone(quiz.log) || {};
    quizEl.innerHTML = ''; wordEl.innerHTML = ''; dots();
    done.hidden = false;
    $('.gym-done h2').textContent = early ? 'Good work!' : 'Workout done!';
    const tiers = {}; for (const it of o.items) { const t = tierOf(o.book[it.id]); if (t >= 0) tiers[t] = (tiers[t] || 0) + 1; }
    $('.gym-done .lines').innerHTML = `${right} of ${asked} right.` +
      (sum.words ? `\n<b class="grow">${sum.words} ${sum.words === 1 ? 'word' : 'words'} got stronger</b>   <b>+${sum.xp} XP</b>   <b>+${sum.gold} gold</b>` : '\nNo word reached a new level this time. Higher levels need practice on more days.') +
      (sum.bonus ? `\n<b>Gym bonus today: +${sum.bonus} gold</b>` : '') +
      '\n' + TIERS.map((t, i) => (tiers[i] ? `<span class="chip" style="background:${t.color};color:${t.ink}">${t.name} ${tiers[i]}</span>` : '')).join(' ');
    const acts = $('.gym-done .acts'); acts.innerHTML = '';
    const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = 'btn ' + cls; b.textContent = label; b.onclick = fn; acts.appendChild(b); };
    btn('Train again', 'big', () => openGym(o.again ? o.again() : o));
    btn('Back', 'alt', close);
    if (sum.after) sum.after();
  }
  ask();
}
