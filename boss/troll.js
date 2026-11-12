// The Forgetful Troll (Word Forest): "Give the words back". Se docs/research/bossar.md avsnitt 3.1.
// Trollet säger eller visar några ord och tappar ett. Barnet ger tillbaka det.
//   Fas 1  Look      bilder och ljud, en bild försvinner, välj den som saknas
//   Fas 2  Listen    bara ljud, han säger orden igen men hoppar över ett, välj det han hoppade över
//   Fas 3  In order  bara ljud, tryck korten i samma ordning som han sa dem
// Efter ett fel kommer samma ord tillbaka som en fas 1-uppgift, långsamt och med bilder ("glömskan som regel").
// Stenar släcks aldrig. Storlekarna (antal ord och kort) står i balance.js (K.boss.troll).
// Barn som inte läser får bara bildkort. Läsare får ordkort från och med den andra lyssna-uppgiften och i fas 3.
import { shuffle, esc, face } from './fight.js';
import { BOSS_AS } from '../words.js';

const P = {
  look: ['Look! My words!', 'Titta! Mina ord!'], again: ['Wait. I had them just now...', 'Vänta. Jag hade dem nyss...'], listen: ['Listen! My words!', 'Lyssna! Mina ord!'],
  gone: ['Oh no. One is gone!', 'Åh nej. Ett är borta!'], twice: ['Again. But one is gone...', 'Igen. Men ett är borta...'],
  which: ['Which word is gone?', 'Vilket ord är borta?'], order: ['Give them back in order!', 'Ge tillbaka dem i samma ordning!'],
};

class Troll {
  constructor(ctx) { this.c = ctx; this.used = new Set(); this.listens = 0; }
  size() { return this.c.small ? 'small' : 'full'; }
  // n ord till en uppgift. Det första (target) är ett av barnets svagaste ord som inte redan varit med i striden,
  // resten dras bland de mötta orden. Ord som låter lika (foils) hamnar aldrig i samma rad.
  pick(n, o) {
    const all = this.c.words(o), known = all.filter(this.c.met), pool = known.length >= Math.max(6, n + 3) ? known : all;
    if (!pool.length) return null;
    let fresh = pool.filter((it) => !this.used.has(it.id)); if (!fresh.length) { this.used.clear(); fresh = pool; }
    const target = fresh[Math.floor(Math.random() * Math.min(3, fresh.length))]; this.used.add(target.id);
    const clash = (a, b) => a === b || a.sv === b.sv || (a.foils || []).includes(b.id) || (b.foils || []).includes(a.id);
    const rest = []; for (const it of shuffle(pool)) { if (rest.length >= n - 1) break; if (!clash(it, target) && !rest.some((r) => clash(r, it))) rest.push(it); }
    return { target, words: shuffle([target, ...rest]), pool: all };
  }
  // Felaktiga kort till "vilket ord saknas": ord som inte står i raden.
  foils(target, words, n, text) {
    const pool = this.c.words(text ? { text: true } : { pic: true }).filter((it) => !words.includes(it) && it.sv !== target.sv);
    const known = pool.filter(this.c.met);
    return shuffle(known.length >= n ? known : pool).slice(0, n);
  }
  look(target, words, slow) {
    const text = !target.pic;                                   // bara läsare kan få ett ord utan bild hit (efter ett fel i fas 3)
    return { kind: 'look', ex: slow ? 'boss_troll_again' : 'boss_troll_look', as: BOSS_AS.troll_look, words, target, slow: !!slow, text,
      options: shuffle([target, ...this.foils(target, words, this.c.S.troll.cards[this.size()] - 1, text)]) };
  }
  next(phase, retry) {
    const c = this.c, S = c.S.troll, sz = this.size();
    if (retry) return this.look(retry.target, retry.words, true);
    if (phase === 1) { const p = this.pick(S.say, { pic: true }); return p && this.look(p.target, p.words, false); }
    if (phase === 2) {
      const text = c.reading && !c.small && this.listens > 0; this.listens++;
      const p = this.pick(S.say, { pic: true, text }); if (!p) return null;
      return { kind: 'listen', ex: 'boss_troll_listen', as: text ? BOSS_AS.troll_listen_text : BOSS_AS.troll_listen, words: p.words, target: p.target, text, options: shuffle(p.words) };
    }
    const text = c.reading, p = this.pick(S.order[sz], text ? { text: true } : { pic: true }); if (!p) return null;
    const extra = shuffle(p.pool.filter((it) => !p.words.includes(it) && !p.words.some((w) => w.sv === it.sv))).slice(0, S.extra[sz]);
    return { kind: 'order', ex: 'boss_troll_order', as: text ? BOSS_AS.troll_order_text : BOSS_AS.troll_order, words: p.words, target: p.words[0], text, options: shuffle([...p.words, ...extra]) };
  }

  // ----- ritning -----
  render(task, done) {
    const c = this.c, ui = c.ui, words = task.words, miss = words.indexOf(task.target);
    ui.clear(); ui.row.className = 'brow slots n' + words.length + (task.text ? ' txt' : '');
    ui.row.innerHTML = words.map(() => '<div class="bslot"></div>').join('');
    const slots = [...ui.row.children], blank = (s) => { s.className = 'bslot'; s.innerHTML = ''; };
    const reveal = () => slots.forEach((s, i) => { s.className = 'bslot' + (i === miss ? ' ok' : ''); s.innerHTML = face(words[i]); });
    // Trollet säger orden i tur och ordning. show: med bild. skip: hoppa över det ordet (rutan visar ett frågetecken).
    const speak = async (show, skip = -1, slow = false) => {
      for (let i = 0; i < words.length; i++) {
        slots[i].classList.add('now');
        if (i === skip) { slots[i].classList.add('gone'); slots[i].textContent = '?'; await c.wait(700); }
        else { slots[i].classList.remove('gone'); slots[i].innerHTML = show ? face(words[i]) : '<span class="bsnd">🔊</span>'; await c.say(words[i], slow); await c.wait(150); }
        slots[i].classList.remove('now');
      }
    };
    let locked = false, busy = false;
    const replay = (fn) => async () => { if (busy || locked) return; busy = true; await fn(); busy = false; };
    const cards = (opts, text, onPick) => {
      ui.cards.className = 'cards n' + opts.length; ui.cards.innerHTML = '';
      return opts.map((o) => { const b = document.createElement('button'); b.className = 'card' + (text ? ' txt' : ''); b.innerHTML = text ? esc(o.en) : face(o); b.dataset.id = o.id; b.onclick = () => onPick(o, b); ui.cards.appendChild(b); return b; });
    };
    // Ett kort är rätt: ordet som saknas.
    const choose = (text) => {
      const btns = cards(task.options, text, (o, b) => {
        if (locked) return; locked = true; reveal();
        if (o === task.target) { b.classList.add('right'); c.say(task.target); c.record(task.target, true, task.as, task.ex); done({ right: true }); }
        else { b.classList.add('wrong'); btns.forEach((x) => x.dataset.id === task.target.id && x.classList.add('right')); c.say(task.target, true); c.record(task.target, false, task.as, task.ex, o.en); done({ right: false, retry: { words, target: task.target } }); }
      });
      c.setAuto((right) => { const b = btns.find((x) => (x.dataset.id === task.target.id) === !!right); if (b) b.click(); return !!b; });
    };
    (async () => {
      c.talk(1);
      if (task.kind === 'look') {
        c.prompt(...(task.slow ? P.again : P.look)); await speak(true, -1, task.slow);
        c.talk(0); c.prompt(...P.gone); slots.forEach(blank); await c.wait(500);
        slots.forEach((s, i) => { if (i === miss) { s.classList.add('gone'); s.textContent = '?'; } else s.innerHTML = face(words[i]); });
        c.prompt(...P.which, 'troll-which'); choose(task.text);
        const rest = async (slow) => { for (let i = 0; i < words.length; i++) if (i !== miss) { slots[i].classList.add('now'); await c.say(words[i], slow); slots[i].classList.remove('now'); } };
        ui.again(replay(() => rest(false))); ui.slow(replay(() => rest(true)));
      } else if (task.kind === 'listen') {
        c.prompt(...P.listen); await speak(false);
        c.prompt(...P.twice); await c.wait(400); await speak(false, miss);
        c.talk(0); c.prompt(...P.which, 'troll-which'); choose(task.text);
        ui.again(replay(() => speak(false, miss))); ui.slow(replay(() => speak(false, miss, true)));
      } else {
        c.prompt(...P.listen); await speak(false);
        c.talk(0); c.prompt(...P.order, 'troll-order'); slots.forEach(blank);
        let at = 0;
        const btns = cards(task.options, task.text, (o, b) => {
          if (locked || busy || b.disabled) return;
          if (o === words[at]) {
            b.disabled = true; b.classList.add('right'); slots[at].innerHTML = face(o, task.text); slots[at].classList.add('ok'); c.say(o); c.record(o, true, task.as, task.ex); at++;
            if (at === words.length) { locked = true; done({ right: true }); }
          } else {
            locked = true; b.classList.add('wrong'); const want = words[at];
            slots.forEach((s, i) => { s.innerHTML = face(words[i], task.text); if (i >= at) s.classList.add('shown'); });
            c.say(want, true); c.record(want, false, task.as, task.ex, o.en); done({ right: false, retry: { words, target: want } });
          }
        });
        c.setAuto((right) => {
          if (!right) { const b = btns.find((x) => !x.disabled && x.dataset.id !== words[at].id); if (b) b.click(); return !!b; }
          for (let i = at; i < words.length && !locked; i++) { const b = btns.find((x) => x.dataset.id === words[i].id); if (b) b.click(); }
          return true;
        });
        ui.again(replay(() => speak(false))); ui.slow(replay(() => speak(false, -1, true)));
      }
    })();
  }
}

export const TROLL = {
  id: 'glomsk', title: 'Give the words back', cheer: ['He remembers!', 'Han minns!'],
  lines: {
    intro: ['Who are you? And who am I?', 'Vem är du? Och vem är jag?'],
    again: ['You again! Who are you?', 'Du igen! Vem är du?'],
    phase: [['Where are my pictures? Listen!', 'Var är mina bilder? Lyssna!'], ['So many words! In order, please!', 'Så många ord! I ordning, tack!']],
    right: [['Oh! I know that word!', 'Åh! Det ordet kan jag!'], ['Yes! That one!', 'Ja! Det där!'], ['Mine! Thank you!', 'Mitt! Tack!']],
    wrong: [['Oh. I forgot.', 'Oj. Jag glömde.'], ['Wait. What am I doing?', 'Vänta. Vad håller jag på med?']],
    win: ['I remember! I remember the words!', 'Jag minns! Jag minns orden!'],
    lose: ['I win! What did I win?', 'Jag vann! Vad vann jag?'],
  },
  make: (ctx) => new Troll(ctx),
};
