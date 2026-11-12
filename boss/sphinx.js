// The Riddle Sphinx (Sun Desert): "Three kinds of riddles". Se docs/research/bossar.md avsnitt 3.2.
// Ingen brådska: varje kort går att trycka på för att höra ordet, hur många gånger som helst, och svaret låses
// först med knappen "That one!". Ett fel svar kostar ett slag, det felaktiga kortet tas bort och gåtan står kvar.
//   Fas 1  Odd one out   vilken hör inte hit? Grupperna står i content/riddles<N>.json.
//   Fas 2  Pattern       vad kommer sen? Raden läses upp i takt. Läsare får raden som skrivna ord, övriga som bilder.
//   Fas 3  What am I?    ledtrådar som är ord barnet kan, en i taget. Rätt på första ledtråden tänder två stenar.
// Ledtrådsgåtorna är skrivna för hand i content/riddles<N>.json. En gåta används bara om svaret och ALLA ledtrådar finns
// bland barnets ord (ung-läget gallrar bort ord), och för barn som inte läser bara om varje ledtråd går att visa
// (bild, färgruta eller tecken). Finns ingen gåta som duger blir fas 3 mönster och "hör inte hit" i stället.
import { shuffle, esc, face } from './fight.js';
import { BOSS_AS } from '../words.js';

const P = {
  odd: ['Which one does not belong?', 'Vilken hör inte hit?'], pattern: ['What comes next?', 'Vad kommer sen?'], clue: ['What am I?', 'Vad är jag?'],
  no: ['Not that one.', 'Inte den.'], more: ['Not that one. One more clue.', 'Inte den. En ledtråd till.'],
};
const CATS = ['animal', 'food', 'clothes'];          // reserv om innehållsfilen saknas: ordens egen kategori

class Sphinx {
  constructor(ctx) {
    this.c = ctx; this.D = ctx.data || {}; this.used = new Set(); this.n = 0;
    this.list = ctx.words({ pic: true });                         // ord med bild, svagaste först
    this.have = new Map(this.list.map((it) => [it.id, it]));
    const G = this.D.groups || Object.fromEntries(CATS.map((cat) => [cat, this.list.filter((it) => it.cat === cat).map((it) => it.id)]));
    this.groups = Object.entries(G).map(([name, ids]) => ({ name, items: ids.map((id) => this.have.get(id)).filter(Boolean) })).filter((g) => g.items.length);
    this.avoid = (this.D.avoid || []).map((p) => p.slice().sort().join('|'));
  }
  size() { return this.c.small ? 'small' : 'full'; }
  // Ord att bygga en uppgift kring: världens egna först (ibland ett ur tidigare världar som repetition), mötta före omötta,
  // och inte ett som redan varit med i striden.
  targets(ok) {
    const c = this.c, review = Math.random() < c.S.review, fresh = (it) => !this.used.has(it.id) && ok(it);
    const tiers = [(it) => fresh(it) && c.met(it) && (review ? !(it.node > 0) : it.node > 0), (it) => fresh(it) && c.met(it), fresh, ok];
    for (const t of tiers) { const a = this.list.filter(t); if (a.length) return a; }
    return [];
  }
  top(a) { return a[Math.floor(Math.random() * Math.min(3, a.length))]; }
  odd() {
    const n = this.c.S.sphinx.odd[this.size()], group = (it) => this.groups.find((g) => g.items.includes(it));
    const majors = (h, target) => shuffle(this.groups.filter((g) => g !== h && !this.avoid.includes([g.name, h.name].sort().join('|')) && g.items.filter((it) => it !== target && it.sv !== target.sv).length >= n - 1));
    const cand = this.targets((it) => { const h = group(it); return !!h && majors(h, it).length > 0; });
    if (!cand.length) return null;
    const target = this.top(cand), g = majors(group(target), target)[0], pool = g.items.filter((it) => it !== target && it.sv !== target.sv), known = pool.filter(this.c.met);
    const others = shuffle(known.length >= n - 1 ? known : pool).slice(0, n - 1);
    return { kind: 'odd', ex: 'boss_sphinx_odd', as: BOSS_AS.sphinx_odd, target, options: shuffle([target, ...others]) };
  }
  pattern() {
    const c = this.c, n = c.S.sphinx.pattern[this.size()], text = c.reading;
    const cand = this.targets(() => true); if (!cand.length) return null;
    const target = this.top(cand), clash = (a, b) => a === b || a.sv === b.sv || (a.foils || []).includes(b.id) || (b.foils || []).includes(a.id);
    const known = this.list.filter(c.met), pool = known.length >= 6 ? known : this.list, rest = [];
    for (const it of shuffle(pool)) { if (rest.length >= n - 1) break; if (!clash(it, target) && !rest.some((r) => clash(r, it))) rest.push(it); }
    if (!rest.length) return null;
    const other = rest[0], form = this.c.small ? 'ABAB' : shuffle(['ABAB', 'AABAAB', 'ABBABB'])[0];
    // Svaret är alltid target. Raden visar allt utom det sista: A B A B ? (A), B B A B B ? (A), B A A B A ? (A).
    const seq = form === 'ABAB' ? [target, other, target, other] : form === 'AABAAB' ? [other, other, target, other, other] : [other, target, target, other, target];
    return { kind: 'pattern', ex: 'boss_sphinx_pattern', as: text ? BOSS_AS.sphinx_pattern_text : BOSS_AS.sphinx_pattern, target, seq, text, form, options: shuffle([target, ...rest]) };
  }
  // Tecknet som visar en ledtråd för den som inte läser: bild, färgruta eller ett tecken ur innehållsfilen. null = går inte att visa.
  glyph(it) {
    const D = this.D, col = (D.colors || {})[it.id], g = (D.glyphs || {})[it.id];
    if (it.pic) return face(it);
    if (col) return `<span class="bsw" style="background:${esc(col)}"></span>`;
    if (g) return `<span class="bgl" style="font-size:${typeof g === 'object' && g.scale ? g.scale : 1}em">${esc(typeof g === 'object' ? g.g : g)}</span>`;
    return null;
  }
  riddles() {
    if (this.deck) return this.deck;
    const c = this.c, n = c.S.sphinx.clue[this.size()], byId = c.quiz.byId, seen = new Set(), out = [];
    for (const [list, own] of [[this.D.riddles || [], true], [this.D.review || [], false]]) for (const r of list) {
      const target = this.have.get(r.a), clues = (r.clues || []).map((id) => byId[id]).slice(0, c.S.sphinx.clues), foils = (r.foils || []).map((id) => this.have.get(id)).filter((it) => it && it !== target);
      if (!target || seen.has(target.id) || !clues.length || clues.some((x) => !x) || foils.length < n - 1) continue;      // svaret och alla ledtrådar ska finnas bland barnets ord
      if (!c.reading && clues.some((x) => !this.glyph(x))) continue;
      seen.add(target.id); out.push({ target, clues, foils, own });
    }
    return (this.deck = out);
  }
  clue() {
    const c = this.c, n = c.S.sphinx.clue[this.size()], all = this.riddles().filter((r) => !this.used.has(r.target.id));
    if (!all.length) return null;
    const review = Math.random() < c.S.review, pick = (f) => all.filter(f).sort((a, b) => this.list.indexOf(a.target) - this.list.indexOf(b.target));
    let a = pick((r) => r.own !== review && c.met(r.target) && r.clues.every(c.met)); if (!a.length) a = pick((r) => c.met(r.target)); if (!a.length) a = pick(() => true);
    const r = this.top(a);
    return { kind: 'clue', ex: 'boss_sphinx_clue', as: c.reading ? BOSS_AS.sphinx_clue_text : BOSS_AS.sphinx_clue, target: r.target, clues: r.clues, text: c.reading, options: shuffle([r.target, ...shuffle(r.foils).slice(0, n - 1)]) };
  }
  next(phase) {
    this.n++;
    const order = phase === 1 ? ['odd', 'pattern'] : phase === 2 ? ['pattern', 'odd'] : this.n % 2 ? ['clue', 'pattern', 'odd'] : ['clue', 'odd', 'pattern'];
    for (const k of order) { const t = this[k](); if (t) { this.used.add(t.target.id); return t; } }
    this.used.clear();
    for (const k of order) { const t = this[k](); if (t) return t; }
    return null;
  }

  // ----- ritning -----
  render(task, done) {
    const c = this.c, ui = c.ui, target = task.target, clues = task.clues || null;
    let sel = null, locked = true, busy = false, tries = 0, shown = 0;
    ui.clear(); ui.cards.className = 'cards n' + task.options.length;
    ui.side.innerHTML = '<button class="btn big lock" disabled>That one!</button>' + (clues && clues.length > 1 ? '<button class="btn alt big more">One more clue</button>' : '');
    const lock = ui.side.querySelector('.lock'), more = ui.side.querySelector('.more');
    const btns = task.options.map((o) => {
      const b = document.createElement('button'); b.className = 'card pick'; b.innerHTML = face(o); b.dataset.id = o.id;
      b.onclick = () => { if (locked || b.disabled) return; sel = o; btns.forEach((x) => x.classList.toggle('sel', x === b)); lock.disabled = false; c.say(o); };      // tryck = lyssna och markera, kostar ingenting
      ui.cards.appendChild(b); return b;
    });
    const replay = (fn) => async () => { if (busy) return; busy = true; await fn(); busy = false; };
    const chipHTML = (it) => (task.text ? `<span class="bt">${esc(it.en)}</span>` : this.glyph(it) || '<span class="bsnd">🔊</span>');
    const addClue = async () => {
      if (!clues || shown >= clues.length) return;
      const it = clues[shown++], d = document.createElement('button'); d.className = 'bchip now'; d.innerHTML = chipHTML(it); d.dataset.id = it.id; d.onclick = () => c.say(it);
      ui.row.appendChild(d); if (more && shown >= clues.length) more.hidden = true;
      c.talk(1); await c.say(it); c.talk(0); d.classList.remove('now');
    };
    const answer = () => {
      if (locked || !sel) return; const b = btns.find((x) => x.dataset.id === sel.id), first = tries === 0;
      if (sel === target) {
        locked = true; b.classList.add('right'); b.classList.remove('sel');
        const q = ui.row.querySelector('.bslot.gone'); if (q) { q.className = 'bslot ok'; q.innerHTML = face(target, task.text); }
        if (first) c.record(target, true, task.as, task.ex);
        done({ right: true, stones: clues && first && shown === 1 ? c.S.clueBonus : 1 });
      } else {
        locked = true; lock.disabled = true; b.classList.add('wrong'); b.classList.remove('sel'); b.disabled = true;
        if (first) c.record(target, false, task.as, task.ex, sel.en);
        sel = null;
        tries++;
        const moreLeft = clues && shown < clues.length;
        done({ right: false, say: moreLeft ? P.more : P.no, resume: () => {
          locked = false; c.prompt(...P[task.kind], 'sphinx-' + task.kind);
          // Läsare får nu svenskan under ledtrådarna som redan visats, som stöd. Sedan en ledtråd till.
          if (clues && task.text) [...ui.row.children].forEach((d, i) => { if (!d.querySelector('small')) d.insertAdjacentHTML('beforeend', `<small>${esc(clues[i].sv)}</small>`); });
          if (moreLeft) addClue();
        } });
      }
    };
    lock.onclick = answer;
    if (more) more.onclick = () => { if (!locked && !busy) replay(addClue)(); };
    c.setAuto((right) => {
      if (locked) return false;
      const b = btns.find((x) => !x.disabled && (x.dataset.id === target.id) === !!right); if (!b) return false;
      b.click(); lock.click(); return true;
    });
    (async () => {
      c.prompt(...P[task.kind], 'sphinx-' + task.kind);
      if (task.kind === 'pattern') {
        ui.row.className = 'brow slots n' + (task.seq.length + 1) + (task.text ? ' txt' : '');
        ui.row.innerHTML = task.seq.map(() => '<div class="bslot"></div>').join('') + '<div class="bslot gone">?</div>';
        const slots = [...ui.row.children], read = async () => { for (let i = 0; i < task.seq.length; i++) { slots[i].innerHTML = face(task.seq[i], task.text); slots[i].classList.add('now'); await c.say(task.seq[i]); await c.wait(120); slots[i].classList.remove('now'); } };
        c.talk(1); busy = true; await read(); busy = false; c.talk(0);
        ui.again(replay(read));
      } else if (clues) {
        ui.row.className = 'brow chips';
        busy = true; await addClue(); busy = false;
        ui.again(replay(async () => { for (const d of [...ui.row.children]) { d.classList.add('now'); await c.say(clues.find((x) => x.id === d.dataset.id)); d.classList.remove('now'); } }));
      }
      locked = false;
    })();
  }
}

export const SPHINX = {
  id: 'gatfull', title: 'Three kinds of riddles', cheer: ['Riddles solved!', 'Gåtorna är lösta!'],
  lines: {
    intro: ['Answer my riddles. Take your time.', 'Svara på mina gåtor. Ta den tid du behöver.'],
    again: ['Back again? Good. I like company.', 'Tillbaka? Bra. Jag gillar sällskap.'],
    phase: [['Hm. Now a pattern. What comes next?', 'Hm. Nu ett mönster. Vad kommer sen?'], ['Now my best riddles. What am I?', 'Nu mina bästa gåtor. Vad är jag?']],
    right: [['Hm. Correct.', 'Hm. Rätt.'], ['Well. Yes.', 'Nåväl. Ja.'], ['You are quick.', 'Du är snabb.']],
    wrong: [P.no],
    win: ['Ha! You are cleverer than me.', 'Ha! Du är klyftigare än jag.'],
    lose: ['Think again, little one. I will wait.', 'Tänk efter, lilla vän. Jag väntar.'],
  },
  make: (ctx) => new Sphinx(ctx),
};
