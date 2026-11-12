// Övningsmotorn. Väljer nästa ord och övning utifrån hur bra barnet kan ordet (words.js), ritar övningen i
// frågepanelen och rapporterar rätt eller fel till striden. Innehållet kommer från content/world<N>.json.
import { record, meet, tasksFor, tierOf, isDue } from './words.js';
import { pic } from './pics.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export class Quiz {
  // o: { content, prior (ord från tidigare världar), nodeIdx, book (profilens ordbok, ändras på plats), day, play(url), save() }
  constructor(o) {
    Object.assign(this, o);
    this.node = o.content.nodes[o.nodeIdx] || o.content.nodes[o.content.nodes.length - 1];
    this.items = [...(o.prior || []).map((i) => ({ ...i, node: 0 })), ...o.content.items]; this.byId = Object.fromEntries(this.items.map((i) => [i.id, i]));
    const n = this.node.n, boss = this.node.type === 'boss';
    this.reach = this.items.filter((i) => i.node <= n);                                   // allt barnet kan ha mött hittills
    this.own = boss ? this.reach.filter((i) => i.node > 0) : [...(this.node.introduce || []), ...(this.node.phrases || [])].map((id) => this.byId[id]).filter(Boolean);
    this.earlier = this.reach.filter((i) => !this.own.includes(i));
    this.sentences = (this.node.sentences || []).map((id) => o.content.sentences.find((s) => s.id === id)).filter(Boolean);
    if (this.reading === undefined) this.reading = true;
    if (!this.reading) {          // utan läsning: ord utan bild tas nästan inte med (ungefär vart sjunde), och inga meningar
      const keep = (i) => !!i.pic || Math.random() < 0.15, hasPic = this.own.some((i) => i.pic);
      if (hasPic) this.own = this.own.filter(keep); this.earlier = this.earlier.filter((i) => !!i.pic); this.sentences = [];
    }
    this.asked = 0; this.lastNew = -9; this.requeue = []; this.last = null; this.log = [];
  }

  // ----- vilket ord och vilken övning -----
  next() {
    this.asked++;
    if (this.requeue.length && this.asked - this.requeue[0].at >= 2) return this.task(this.requeue.shift().item);
    if (this.sentences.length && this.asked > 2 && Math.random() < 0.3) { const s = pick(this.sentences); return { sentence: s, type: s.gap && Math.random() < 0.5 ? 'sentence_gap' : 'build_sentence' }; }
    const met = (i) => !!this.book[i.id], fresh = this.own.filter((i) => !met(i)), known = this.own.filter(met);
    if (fresh.length && (this.asked - this.lastNew >= 2 || !known.length)) { this.lastNew = this.asked; return this.task(fresh[0]); }   // nya ord ett i taget, med gamla emellan
    const due = this.earlier.filter((i) => isDue(this.book[i.id], this.day) && i !== this.last);
    if (due.length && Math.random() < 0.4) return this.task(pick(due));                                                             // gamla ord som vill repeteras
    const pool = known.filter((i) => i !== this.last);
    if (pool.length) { const weak = pool.slice().sort((a, b) => this.book[a.id].s - this.book[b.id].s); return this.task(Math.random() < 0.6 ? weak[Math.floor(Math.random() * Math.ceil(weak.length / 2))] : pick(pool)); }
    const any = this.reach.filter((i) => met(i) && i !== this.last);
    return this.task(any.length ? pick(any) : fresh[0] || this.own[0]);
  }
  task(item) { const rec = this.book[item.id]; this.last = item; return { item, type: pick(tasksFor(item, rec, this.reading)), free: !rec }; }   // första mötet är riskfritt

  foils(item, n, needPic) {
    const ok = (i) => i && i !== item && i.pos !== 'phrase' === (item.pos !== 'phrase') && (!needPic || i.pic) && i.sv !== item.sv;
    const out = (item.foils || []).map((id) => this.byId[id]).filter((i) => ok(i) && i.node <= this.node.n);
    const same = shuffle(this.reach.filter((i) => ok(i) && !out.includes(i) && (i.cat === item.cat || i.pos === item.pos)));
    const rest = shuffle(this.reach.filter((i) => ok(i) && !out.includes(i) && !same.includes(i)));
    return shuffle([...out, ...same, ...rest].slice(0, n));
  }
  done(task, right) {
    if (task.item) {
      if (task.free && !right) meet(this.book, task.item.id, this.day);
      else record(this.book, task.item.id, right, task.type, this.day);
      if (!right) this.requeue.push({ item: task.item, at: this.asked });
      this.log.push({ id: task.item.id, type: task.type, right, free: !!task.free });
      if (this.onAnswer) this.onAnswer(task, right);
    }
    this.save();
  }

  // ----- ritning -----
  // quizEl: panelen under scenen. wordEl: rutan i scenens nederkant. cb({ right, free }) när barnet har svarat.
  render(task, quizEl, wordEl, cb) {
    const it = task.item, s = task.sentence, P = this.play, T = task.type;
    const en = it ? `audio/${it.audio}.mp3` : `audio/${s.audio}.mp3`, slow = en.replace('.mp3', '.slow.mp3'), svA = `audio/sv/${(it || s).id}.mp3`;
    let promptAudio = en, locked = false;
    const finish = (right) => {
      if (locked) return; locked = true; this.done(task, right);
      if (!right && task.free) return this.teach(it, quizEl, wordEl, () => cb({ right: false, free: true }));
      cb({ right, free: false });
    };
    const frame = (inner, audio = true) => { quizEl.innerHTML = `<div class="speak"${audio ? '' : ' style="visibility:hidden"'}><button class="again" aria-label="Play again">🔊</button><button class="slow" aria-label="Slowly">🐢</button></div>${inner}`;
      quizEl.querySelector('.again').onclick = () => P(promptAudio); quizEl.querySelector('.slow').onclick = () => P(promptAudio === en ? slow : promptAudio); };
    const word = (html, cls = '') => { wordEl.className = 'word ' + cls; wordEl.innerHTML = html; };
    const newTag = task.free ? '<span class="new">NEW</span>' : '';

    // Flerval: ett kort är rätt. Vid fel visas rätt kort och ordet läses långsamt.
    const choice = (opts, txt) => {
      frame(`<div class="cards n${opts.length}"></div>`, promptAudio !== null);
      const box = quizEl.querySelector('.cards');
      for (const o of opts) {
        const b = document.createElement('button'); b.className = 'card' + (txt ? ' txt' : '') + (o.cls ? ' ' + o.cls : ''); b.innerHTML = o.html;
        b.onclick = () => { if (locked) return; if (o.ok) { b.classList.add('right'); if (promptAudio !== en) P(en); } else { b.classList.add('wrong'); [...box.children].forEach((c, i) => opts[i].ok && c.classList.add('right')); P(slow); } finish(!!o.ok); };
        box.appendChild(b); if (o.ok) this._auto = () => b.click();          // används av testkörningar
      }
      if (promptAudio) P(promptAudio);
    };
    const withFoils = (n, needPic, html) => shuffle([it, ...this.foils(it, n, needPic)]).map((o) => ({ html: html(o), ok: o === it }));
    const nOpt = task.free ? 1 : 3;                                       // första mötet: bara två val
    const nTxt = task.free || !this.reading ? 1 : 3;                      // skrivna alternativ: två val för den som inte läser än

    if (T === 'listen_pick_picture') { word(esc(it.en) + newTag); return choice(withFoils(nOpt, true, (o) => pic(o))); }
    if (T === 'read_pick_picture') { promptAudio = null; word(esc(it.en)); return choice(withFoils(3, true, (o) => pic(o))); }
    if (T === 'picture_pick_word') { promptAudio = null; word(`<span class="pic">${pic(it)}</span>`); return choice(withFoils(nTxt, false, (o) => esc(o.en)), true); }
    if (T === 'listen_pick_word') { word('🔊 ?'); return choice(withFoils(3, false, (o) => esc(o.en)), true); }
    if (T === 'en_to_sv') { word(esc(it.en) + newTag); return choice(withFoils(nTxt, false, (o) => esc(o.sv)), true); }
    if (T === 'sv_to_en') { promptAudio = svA; word(`<small>SV</small> ${esc(it.sv)}`, 'sv'); return choice(withFoils(3, false, (o) => esc(o.en)), true); }
    if (T === 'true_false') {
      const truth = Math.random() < 0.5, shown = truth ? it : this.foils(it, 1, true)[0] || it;
      promptAudio = `audio/${shown.audio}.mp3`; word(`<span class="pic">${pic(it)}</span> ${esc(shown.en)}?`);
      return choice([{ html: '👍 Yes', ok: shown === it }, { html: '👎 No', ok: shown !== it }], true);
    }
    if (T === 'missing_letter') {
      const w = it.en, i2 = Math.floor(Math.random() * w.length), ch = w[i2];
      promptAudio = en; word((it.pic ? `<span class="pic sm">${pic(it)}</span> ` : `<small>SV</small> ${esc(it.sv)}: `) + `<span class="gap">${esc(w.slice(0, i2))}<u>_</u>${esc(w.slice(i2 + 1))}</span>`);
      const letters = shuffle('abcdefghiklmnoprstuwy'.split('').filter((c) => c !== ch.toLowerCase())).slice(0, 3);
      return choice(shuffle([{ html: ch, ok: true }, ...letters.map((c) => ({ html: c }))]), true);
    }
    if (T === 'sentence_gap') {
      const t = s.tiles.slice(), ans = t[s.gap.index]; t[s.gap.index] = '<u>___</u>'; promptAudio = null;
      word(`<span class="gap">${t.join(' ')}</span><small class="below">${esc(s.sv)}</small>`, 'long');
      return choice(shuffle(s.gap.options.map((o) => ({ html: esc(o), ok: o.toLowerCase() === ans.toLowerCase() }))), true);
    }
    // Brickor i rätt ordning: bokstäver (stava) eller ord (bygg mening). Första felet räknas som fel svar.
    const pieces = T === 'build_sentence' ? s.tiles : it.en.split('');
    if (T === 'build_sentence') word(`<small>SV</small> ${esc(s.sv)}`, 'sv long'); else word(it.pic ? `<span class="pic">${pic(it)}</span>` : `<small>SV</small> ${esc(it.sv)}`, it.pic ? '' : 'sv');
    frame(`<div class="tilebox"><div class="slots">${pieces.map(() => '<i></i>').join('')}</div><div class="tiles"></div></div>`);
    const slots = [...quizEl.querySelectorAll('.slots i')], tiles = quizEl.querySelector('.tiles'); let at = 0;
    for (const p of shuffle(pieces.map((p, i) => ({ p, i })))) {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = p.p;
      b.onclick = () => { if (locked || b.disabled) return;
        if (p.p.toLowerCase() === pieces[at].toLowerCase()) { slots[at].textContent = pieces[at]; slots[at].classList.add('ok'); b.disabled = true; at++; if (at === pieces.length) { P(en); finish(true); } }
        else { b.classList.add('wrong'); slots.forEach((sl, i) => { sl.textContent = pieces[i]; if (i >= at) sl.classList.add('shown'); }); P(slow); finish(false); } };
      tiles.appendChild(b);
    }
    this._auto = () => { const b = [...tiles.children].find((x) => !x.disabled && x.textContent.toLowerCase() === pieces[at].toLowerCase()); if (b) b.click(); };
    P(T === 'build_sentence' ? en : it.pic ? en : svA);
  }

  // Lär in-kort: visas när barnet svarar fel första gången det möter ett ord. Ingen fiendeattack.
  teach(it, quizEl, wordEl, go) {
    wordEl.className = 'word'; wordEl.innerHTML = esc(it.en) + '<span class="new">NEW</span>';
    quizEl.innerHTML = `<div class="teach"><div class="big">${it.pic ? pic(it) : ''}</div><div><b>${esc(it.en)}</b><span>= ${esc(it.sv)}</span></div><button class="again">🔊</button><button class="btn ok">OK!</button></div>`;
    const en = `audio/${it.audio}.mp3`; quizEl.querySelector('.again').onclick = () => this.play(en); quizEl.querySelector('.ok').onclick = go;
    this.play(en.replace('.mp3', '.slow.mp3'));
  }
}
