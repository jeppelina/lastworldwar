// Övningsmotorn. Väljer nästa ord och övning utifrån hur bra barnet kan ordet (words.js), ritar övningen i
// frågepanelen och rapporterar rätt eller fel till striden. Innehållet kommer från content/world<N>.json.
import { record, meet, tasksFor, tierOf, isDue, NEW_AS, numOf } from './words.js';
import { pic, artStillURL } from './pics.js';
import { K } from './balance.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const SENT_TYPES = ['scene_hunt', 'spell_chant', 'build_sentence', 'sentence_gap'];
// Testkrok: sätt globalThis.__quizForce till en övningstyp (t.ex. 'count_house', 'scene_hunt') så väljer striden den när det går.
const forced = () => globalThis.__quizForce || null;
// Färgerna i meningarnas scener (scene.color) som en ram runt scenen.
const COL = { red: '#e2473d', green: '#2fae62', blue: '#3d7be2', yellow: '#f2c632', black: '#26262e', white: '#ffffff', brown: '#8a5a2b', pink: '#ff8ad8', orange: '#f08a20', purple: '#8a4ad8', grey: '#8a8a96', gray: '#8a8a96' };
// Plural till räknefraserna ("Five cats."). Samma lista som i prototypes/audio/gen_count.py. Bara substantiv med ett ord kommer hit.
const ODD = { mouse: 'mice', fish: 'fish', sheep: 'sheep', foot: 'feet', tooth: 'teeth', man: 'men', woman: 'women', child: 'children', person: 'people', deer: 'deer', goose: 'geese', leaf: 'leaves', wolf: 'wolves', knife: 'knives', tomato: 'tomatoes', potato: 'potatoes', cactus: 'cacti' };
// Ord som inte går att räkna ("How many waters?"). De väljs aldrig som det som ska räknas.
const MASS = new Set(['water', 'milk', 'juice', 'bread', 'cheese', 'rice', 'soup', 'tea', 'coffee', 'sand', 'snow', 'rain', 'ice', 'money', 'breakfast', 'lunch', 'dinner', 'grass', 'sun', 'moon', 'sky', 'fire', 'food', 'music', 'homework', 'hair', 'pasta', 'yoghurt', 'jam', 'butter', 'sugar', 'salt', 'meat', 'fish_food', 'wind', 'weather', 'air', 'gold', 'school', 'preschool', 'football', 'battle', 'gear', 'porridge', 'paper', 'forest', 'pants', 'enemy']);
const plural = (w) => ODD[w] || (/(s|sh|ch|x|z)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's');
// Räkna med örat (2026-11-16): ord som inte räknas alls. Kroppsdelar ("Put five noses in the house") och huset självt.
const COUNT_SKIP = new Set(['house', 'hand', 'foot', 'eye', 'ear', 'nose', 'mouth', 'tooth', 'leg', 'arm']);
// Vilka räkneklipp som finns: audio/count/index.json (skrivs av prototypes/audio/gen_count.py). Hämtas en gång när modulen
// laddas i webbläsaren. Tills den är hämtad (och i node) är mängden tom, och då hörs talet och sedan ordet i plural.
const CLIPS = new Set();
if (typeof document !== 'undefined' && typeof fetch === 'function') fetch('audio/count/index.json').then((r) => (r.ok ? r.json() : null)).then((j) => { for (const c of (j && j.clips) || []) CLIPS.add(c); }).catch(() => {});
// En sak att räkna, som stillbild (ritade bilder rör sig annars, och det som rör sig är svårare att räkna).
const thing = (o) => { const s = artStillURL(o.id || o.en); return s ? `<img class="pimg" src="${s}" alt="" draggable="false">` : pic(o); };
// Mönster för k saker på ett kort: 1 till 3 i rad, 4 i fyrkant som på en tärning, 5 i en rad, 6 i två rader om tre,
// 7 till 10 som en tiorad (fem överst, resten under). Högst två rader, så att sakerna blir stora. Ger [rader, kolumner].
const GRID = (k) => (k <= 3 ? [1, k] : k === 4 ? [2, 2] : k === 5 ? [1, 5] : k === 6 ? [2, 3] : [2, 5]);
const SPOTS = (k) => { const [, c] = GRID(k); return Array.from({ length: k }, (_, i) => [Math.floor(i / c) + 1, (i % c) + 1]); };
// sz = [rader, kolumner] som storleken räknas på: den största i frågan, så att sakerna är lika stora på alla kort (annars
// skulle storleken avslöja antalet).
const groupHTML = (o, k, sz = GRID(k)) => { const [r, c] = GRID(k), one = thing(o); return `<span class="qgrid" style="--r:${r};--c:${c};--rs:${sz[0]};--cs:${sz[1]}">${SPOTS(k).map(([y, x]) => `<i style="grid-area:${y}/${x}">${one}</i>`).join('')}</span>`; };
// Page, bokens ägare, som en liten bild (samma ritning som på boksidan). Ritas första gången den behövs; tills dess en bok.
let PAGE_SRC = null;
const pageIcon = () => {
  if (PAGE_SRC === null && typeof document !== 'undefined') {
    PAGE_SRC = '';
    Promise.all([import('./pixel.js'), import('./intro.js')]).then(([px, intro]) => {
      const g = new px.G(24, 22); g.push(12, 21); intro.drawPage(g, 0.4, {}); g.pop();
      const c = document.createElement('canvas'); c.width = 24; c.height = 22; g.paint(c.getContext('2d')); PAGE_SRC = c.toDataURL();
      document.querySelectorAll('.qpgi').forEach((e) => { e.innerHTML = pageIcon(); });
    }).catch(() => {});
  }
  return PAGE_SRC ? `<img class="qpg" src="${PAGE_SRC}" alt="Page">` : '📖';
};

export class Quiz {
  // o: { content, prior (ord från tidigare världar), nodeIdx, book (profilens ordbok, ändras på plats), day, play(url), save(),
  //      onAnswer(task, right, up) där up = { before, after, top, up } från words.js (ordets nivå före och efter) }
  // Färre ord per bana (ung-läget, K.wordShare) görs av anroparen: content och prior skickas in redan gallrade med thinContent.
  // firstOptions och meet (möt-kort på eller av) går att skicka in, annars gäller balance.js.
  // Nya ord (K.meet.on): första gången ett ord kommer upp är uppgiften ett möt-kort (task.meet), inte en fråga. render() ritar
  // kortet, och trycket bokför ordet som mött utan poäng (met) och ställer det i kö som en riktig fråga K.meet.gap frågor senare.
  // Hjälp av boken: sätter anroparen task.helped innan svaret ger ett rätt svar inga poäng i ordboken (done).
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
    this.meetOn = o.meet !== undefined ? !!o.meet : !!(K.meet && K.meet.on); this.meetGap = (K.meet && K.meet.gap) || 2;
    if (this.firstOptions === undefined) this.firstOptions = K.firstOptions || 2;
    // De nya övningarna (K.ex): i striderna. Ordgymmet (GymQuiz i gym.js) får samma övningar som förut om det inte ber om dem.
    this.extra = o.extra !== undefined ? !!o.extra : new.target === Quiz && !!(K.ex && K.ex.on);
    this.hunts = this.extra ? this.sentences.filter((s) => this.huntable(s)) : [];     // meningar med scen (Scene Hunt), även för den som inte läser
    if (!this.reading) {          // utan läsning: ord utan bild tas nästan inte med (ungefär vart sjunde), och inga meningar
      const keep = (i) => !!i.pic || Math.random() < 0.15, hasPic = this.own.some((i) => i.pic);
      if (hasPic) this.own = this.own.filter(keep); this.earlier = this.earlier.filter((i) => !!i.pic); this.sentences = [];
    }
    this.newCap = o.newCap || K.newPerRun || 99; this.newSeen = 0; this.intro = new Set();      // tak för nya ord per omgång, och de nya ord som redan har kommit upp
    this.asked = 0; this.lastNew = -9; this.requeue = []; this.last = null; this.log = [];
    this.pk = K.pick || {}; this.cnt = {}; this.miss = {};                    // frågor och fel per ord i den här striden
  }

  // ----- vilket ord och vilken övning -----
  // Får ordet frågas igen? Högst pick.perBattle gånger i den här striden och pick.perDay gånger i dag.
  room(i) { const r = this.book[i.id], pb = this.pk.perBattle || 99, pd = this.pk.perDay || 999; return (this.cnt[i.id] || 0) < pb && !(r && r.qday === this.day && r.qn >= pd); }
  next() {
    this.asked++;
    while (this.requeue.length && !this.requeue[0].reteach && !this.room(this.requeue[0].item)) this.requeue.shift();      // ord som har frågats nog i dag kommer inte tillbaka
    if (this.requeue.length && this.asked - this.requeue[0].at >= (this.requeue[0].gap || 2)) { const q = this.requeue.shift(); if (q.reteach) { this.last = q.item; return { item: q.item, type: 'meet', meet: true, reteach: true }; } return this.task(q.item); }
    const F = forced(), fs = SENT_TYPES.includes(F);
    if (!this.reading && this.hunts.length && (F === 'scene_hunt' || (this.asked > 2 && Math.random() < K.ex.hunt.noread))) {      // den som inte läser: meningar som scener
      const ok = this.hunts.filter((s) => this.ready(s)), s = pick(ok.filter((x) => x !== this.lastSentence).length ? ok.filter((x) => x !== this.lastSentence) : ok);
      if (s) { this.lastSentence = s; return { sentence: s, type: 'scene_hunt' }; }
    }
    if (this.sentences.length && ((fs && this.reading) || (this.asked > 2 && Math.random() < 0.45))) {
      let list = this.sentences.filter((x) => x !== this.lastSentence).length ? this.sentences.filter((x) => x !== this.lastSentence) : this.sentences;
      if (F === 'scene_hunt' && list.some((x) => this.canHunt(x))) list = list.filter((x) => this.canHunt(x));
      if (F === 'spell_chant' && list.some((x) => this.canChant(x))) list = list.filter((x) => this.canChant(x));
      if (F === 'sentence_gap' && list.some((x) => x.gap)) list = list.filter((x) => x.gap);
      const s = pick(list); this.lastSentence = s; return { sentence: s, type: this.sentenceType(s, F) };
    }
    if (F === 'count_group' || F === 'count_house') {       // testkroken: ett mött tal att räkna, helst ett där typen passar (nivån)
      const n = this.reach.filter((i) => numOf(i) >= K.ex.count.min && numOf(i) <= K.ex.count.max && this.book[i.id] && i !== this.last);
      const fit = n.filter((i) => tasksFor(i, this.book[i.id], this.reading, this.extra).includes(F));
      if (n.length) return this.task(pick(fit.length ? fit : n));
    }
    const met = (i) => !!this.book[i.id], fresh = this.own.filter((i) => !met(i)), known = this.own.filter(met);
    if (fresh.length && (this.newSeen < this.newCap || !known.length) && (this.asked - this.lastNew >= 2 || !known.length)) { this.lastNew = this.asked; this.newSeen++; this.intro.add(fresh[0].id); return this.task(fresh[0]); }   // nya ord ett i taget, med gamla emellan
    const due = this.earlier.filter((i) => isDue(this.book[i.id], this.day) && i !== this.last && this.room(i));
    if (due.length && Math.random() < 0.4) return this.task(pick(due));                                                             // gamla ord som vill repeteras
    const pool = known.filter((i) => i !== this.last && this.room(i));
    // Svagast först, men ord som redan frågats i den här striden hamnar längre bak, så att ett missat ord inte tar över.
    if (pool.length) { const weak = pool.slice().sort((a, b) => ((this.cnt[a.id] || 0) - (this.cnt[b.id] || 0)) * 4 + (this.book[a.id].s - this.book[b.id].s) / 3), low = weak.filter((i) => tierOf(this.book[i.id]) < 2);
      if (low.length && Math.random() < 0.85) return this.task(low[Math.floor(Math.random() * Math.min(low.length, 4))]);          // ord under Steel först, de svagaste fyra
      return this.task(Math.random() < 0.6 ? weak[Math.floor(Math.random() * Math.ceil(weak.length / 2))] : pick(pool)); }
    const any0 = this.reach.filter((i) => met(i) && i !== this.last), any1 = any0.filter((i) => this.room(i)), any = any1.length ? any1 : any0;
    if (!any.length && fresh.length) { this.lastNew = this.asked; this.newSeen++; this.intro.add(fresh[0].id); }      // inget annat att fråga på: nästa nya ord, och det räknas mot taket
    return this.task(any.length ? pick(any) : fresh[0] || this.own[0]);
  }
  // Första mötet: ett möt-kort (meet), eller med K.meet.on av en riskfri första fråga (free).
  // En ny övning (K.ex) som inte går att göra just nu (prep säger nej) byts mot en ur den vanliga listan.
  task(item) {
    const rec = this.book[item.id]; this.last = item; this.cnt[item.id] = (this.cnt[item.id] || 0) + 1;
    const list = tasksFor(item, rec, this.reading, this.extra), F = forced();
    const t = { item, type: F && list.includes(F) ? F : pick(list), free: !rec && !this.meetOn, meet: !rec && this.meetOn };
    if (NEW_AS[t.type] && !this.prep(t)) t.type = pick(tasksFor(item, rec, this.reading));
    return t;
  }
  // Förbereder en ny ordövning: vad som ska räknas, vilket ord Page säger, vilket ord som hörs bredvid. false = går inte nu.
  prep(t) {
    const it = t.item, E = K.ex;
    if (t.type === 'count_group' || t.type === 'count_house') {
      const n = numOf(it); if (n < E.count.min || n > E.count.max || !this.book[it.id]) return false;
      const objs = this.countables(); if (!objs.length) return false;
      // Helst ett ord som har en inspelad fras för just det här talet, och helst ett ord barnet kan (Iron eller mer).
      const key = (i) => (t.type === 'count_house' ? 'put_' : '') + `${String(it.en).toLowerCase()}_${i.id}`;
      const said = objs.filter((i) => CLIPS.has(key(i))), base = said.length ? said : objs, strong = base.filter((i) => tierOf(this.book[i.id]) >= 1);
      t.count = { obj: pick(strong.length ? strong : base), n }; return true;
    }
    if (t.type === 'picword_sv' || t.type === 'picword_hear') { if (!it.pic) return false; t.alt = this.foils(it, 1, false)[0]; return !!t.alt; }
    if (t.type === 'fix_page') {
      if (!it.pic || it.pos !== 'noun') return false;
      const cl = this.foils(it, 3, false).find((o) => o.pos === 'noun'); if (!cl) return false;
      t.claim = Math.random() < E.fix.wrong ? cl : it; t.alt = cl; return true;
    }
    return true;
  }
  // Det som går att räkna: mötta substantiv med bild, ett ord, inte ett tal, inte ett ämne (MASS) och inte i COUNT_SKIP.
  countables() { return this.reach.filter((i) => this.book[i.id] && i.pic && i.pos === 'noun' && !numOf(i) && /^[a-z]+$/.test(i.en) && !MASS.has(i.en) && !COUNT_SKIP.has(i.en)); }
  // Andra antal på korten i "välj gruppen": k olika antal från 1 till 10, inte n, helst högst fyra ifrån. Inga ord, bara bilder.
  countFoils(n, k) {
    const all = Array.from({ length: 10 }, (_, i) => i + 1).filter((c) => c !== n);
    return [...shuffle(all.filter((c) => Math.abs(c - n) <= 4)), ...shuffle(all.filter((c) => Math.abs(c - n) > 4))].slice(0, k);
  }
  // Vad rösten säger: frasen ("Five cats." eller "Put five cats in the house.") om klippet finns, annars talet och sedan
  // ordet i plural (eller ordet som det är). urls spelas i tur och ordning, slow är samma sak långsamt.
  countSay(t, house) {
    const { obj } = t.count, num = t.item, ph = (house ? 'put_' : '') + `${String(num.en).toLowerCase()}_${obj.id}`;
    const urls = CLIPS.has(ph) ? [`audio/count/${ph}.mp3`] : [`audio/${num.audio}.mp3`, CLIPS.has('pl_' + obj.id) ? `audio/count/pl_${obj.id}.mp3` : `audio/${obj.audio}.mp3`];
    return { urls, slow: urls.map((u) => u.replace('.mp3', '.slow.mp3')), text: `${house ? 'Put ' + String(num.en).toLowerCase() : String(num.en).charAt(0).toUpperCase() + String(num.en).slice(1).toLowerCase()} ${plural(obj.en)}${house ? ' in the house' : ''}.` };
  }
  // Meningens innehållsord (uses, annars brickorna som finns som ord). Småorden (isolated: false) finns inte bland orden i spelet.
  usesOf(s) {
    if (s.uses && s.uses.length) return s.uses.filter((id) => this.byId[id]);
    const en = new Map(this.items.map((i) => [String(i.en).toLowerCase(), i.id]));
    return [...new Set((s.tiles || []).map((t) => en.get(String(t).toLowerCase().replace(/[^a-z' ]/g, ''))).filter(Boolean))];
  }
  ready(s) { return this.usesOf(s).every((id) => !!this.book[id]); }      // alla innehållsord är mötta
  // Scene Hunt: meningen har en scen och felscener, och ingen av dem är en rörelse (verbens bilder ritas om).
  huntable(s) { const all = [s.scene, ...(s.foils || [])]; return !!s.scene && (s.foils || []).length >= 2 && all.every((x) => x && !x.anim); }
  canHunt(s) { return this.extra && this.huntable(s) && this.ready(s); }
  canChant(s) { return this.extra && (s.tiles || []).length <= K.ex.chant.maxTiles && this.ready(s); }
  sentenceType(s, F) {
    if (F === 'scene_hunt' && this.canHunt(s)) return 'scene_hunt';
    if (F === 'spell_chant' && this.canChant(s)) return 'spell_chant';
    if (F === 'sentence_gap' && s.gap) return 'sentence_gap';
    if (F === 'build_sentence') return 'build_sentence';
    const r = Math.random(), E = K.ex;
    if (this.extra && r < E.hunt.share && this.canHunt(s)) return 'scene_hunt';
    if (this.extra && r >= E.hunt.share && r < E.hunt.share + E.chant.share && this.canChant(s)) return 'spell_chant';
    return s.gap && Math.random() < 0.3 ? 'sentence_gap' : 'build_sentence';
  }
  // Antal val för ordet (K.choices): efter ordets nivå, två för svåra ord, och högst två skrivna för den som inte läser.
  nOpts(it, written) {
    const C = K.choices || { byTier: [4] }, by = C.byTier, rr = it && this.book[it.id], t = Math.max(0, tierOf(rr));
    let n = by[Math.min(t, by.length - 1)];
    if (rr && rr.w >= (this.pk.hardWrong || 99) && rr.w > rr.r) n = Math.min(n, C.hard || 2);
    if (written && !this.reading) n = Math.min(n, C.written || 2);
    return Math.max(2, n);
  }
  // Orden som införs den här omgången, i den ordning de kommer: banans ej mötta ord upp till taket. Boksidan märker dem NEW.
  // Ett ord vars möt-kort är uppe men inte tryckt räknas fortfarande som nytt här.
  newNow() { let left = Math.max(0, this.newCap - this.newSeen); return this.own.filter((i) => !this.book[i.id] && (this.intro.has(i.id) || left-- > 0)); }

  foils(item, n, needPic) {
    const ok = (i) => i && i !== item && i.pos !== 'phrase' === (item.pos !== 'phrase') && (!needPic || i.pic) && i.sv !== item.sv;
    const out = (item.foils || []).map((id) => this.byId[id]).filter((i) => ok(i) && i.node <= this.node.n);
    const same = shuffle(this.reach.filter((i) => ok(i) && !out.includes(i) && (i.cat === item.cat || i.pos === item.pos)));
    const rest = shuffle(this.reach.filter((i) => ok(i) && !out.includes(i) && !same.includes(i)));
    return shuffle([...out, ...same, ...rest].slice(0, n));
  }
  // Möt-kortet är tryckt: ordet hamnar i boken utan poäng och kommer tillbaka som en riktig fråga meetGap frågor senare.
  // I svarsloggen står det som ett första möte (-1 i händelsen 'words', se logRows i words.js), som en äldre klient förstår.
  met(task) {
    const it = task.item; meet(this.book, it.id, this.day);
    this.requeue.push({ item: it, at: this.asked, gap: this.meetGap });
    task.ex = 'meet';                                                           // övningens namn i svarsloggen (lv_answers)
    this.log.push({ id: it.id, type: task.type, right: false, free: true, meet: true });
    if (this.onAnswer) this.onAnswer(task, true, null);
    this.save();
  }
  // Ett rätt svar som fått hjälp av boken (task.helped) ger ordet inga poäng: ordet räknas bara som mött. Ett fel svar
  // bokförs som ett vanligt fel. Striden spelar svaret som vanligt i båda fallen.
  done(task, right) {
    if (task.item) {
      let up = null; const helped = !!task.helped && right;
      if (helped || (task.free && !right)) meet(this.book, task.item.id, this.day);
      const as = NEW_AS[task.type]; if (as) task.ex = task.type;            // ny övning: eget namn i svarsloggen, äldre typ i ordboken
      if (!(helped || (task.free && !right))) up = record(this.book, task.item.id, right, as || task.type, this.day);
      if (!right) { const n = this.miss[task.item.id] = (this.miss[task.item.id] || 0) + 1;
        if (this.meetOn && n === (this.pk.reteachAfter || 99)) this.requeue.push({ item: task.item, at: this.asked, gap: 1, reteach: true });      // missat två gånger: möt-kortet igen
        else this.requeue.push({ item: task.item, at: this.asked }); }
      const lt = as || task.type;
      this.log.push(task.helped ? { id: task.item.id, type: lt, right, free: !!task.free, helped: true } : { id: task.item.id, type: lt, right, free: !!task.free });
      if (this.onAnswer) this.onAnswer(task, right, up);
    } else if (task.sentence && this.onAnswer) this.onAnswer(task, right, null);     // meningar sparas också i svarsloggen (inte i ordboken)
    this.save();
  }

  // ----- ritning -----
  // quizEl: panelen under scenen. wordEl: rutan i scenens nederkant. cb({ right, free }) när barnet har svarat.
  render(task, quizEl, wordEl, cb) {
    if (task.meet) return this.renderMeet(task, quizEl, wordEl, cb);
    const it = task.item, s = task.sentence, P = (u) => this.play(u), T = task.type;
    const en = it ? `audio/${it.audio}.mp3` : `audio/${s.audio}.mp3`, slow = en.replace('.mp3', '.slow.mp3'), svA = `audio/sv/${(it || s).id}.mp3`;
    let promptAudio = en, locked = false;
    const t0 = Date.now();                                  // svarstid: från att uppgiften visas till svaret
    const finish = (right) => {
      if (locked) return; locked = true; task.ms = Math.max(0, Date.now() - t0 - (task.away || 0)); this.done(task, right);      // away = tid då striden väntade (boken öppen)
      if (!right && task.free) { quizEl.classList.add('bad'); if (this.sfx) this.sfx('wrong'); return setTimeout(() => { quizEl.classList.remove('bad'); this.teach(it, quizEl, wordEl, () => cb({ right: false, free: true })); }, 1600); }   // låt det röda kortet synas innan ordet lärs ut
      cb({ right, free: false });
    };
    const frame = (inner, audio = true) => { quizEl.innerHTML = `<div class="speak"${audio ? '' : ' style="visibility:hidden"'}><button class="again" aria-label="Play again">🔊</button><button class="slow" aria-label="Slowly">🐢</button></div>${inner}`;
      quizEl.querySelector('.again').onclick = () => P(promptAudio); quizEl.querySelector('.slow').onclick = () => P(promptAudio === en ? slow : promptAudio); };
    const word = (html, cls = '') => { wordEl.className = 'word ' + cls; wordEl.innerHTML = html; };
    const say = (urls) => urls.reduce((p, u) => p.then(() => P(u)), Promise.resolve());      // klipp i tur och ordning
    const newTag = task.free ? '<span class="new">NEW</span>' : '';

    // Flerval: ett kort är rätt. Vid fel visas rätt kort och ordet läses långsamt.
    // x.seq: ljud som spelas i tur och ordning, ett per kort (kortet lyser medan dess ord hörs). o.next: rätt kort leder till
    // ett andra steg i samma uppgift (rätta Page) i stället för att uppgiften är klar.
    const choice = (opts, txt, x = {}) => {
      task.shown = opts.length; let fixing = false, stepped = false; const fixOn = !!this.pk.fixTap && !task.free;
      frame(`<div class="cards n${opts.length}"></div>`, promptAudio !== null || !!x.seq || !!x.say);
      const box = quizEl.querySelector('.cards');
      const runSeq = (urls) => { const cs = [...box.children]; let p = Promise.resolve();
        urls.forEach((u, i) => { p = p.then(() => { cs.forEach((c) => c.classList.remove('playing')); if (cs[i]) cs[i].classList.add('playing'); return P(u); }); });
        p.then(() => cs.forEach((c) => c.classList.remove('playing'))); };
      for (const o of opts) {
        const b = document.createElement('button'); b.className = 'card' + (txt ? ' txt' : '') + (o.cls ? ' ' + o.cls : ''); b.innerHTML = o.html;
        b.onclick = () => { if (locked || stepped) return;
          if (fixing) { if (o.ok) { b.classList.remove('tapme'); P(en); fixing = false; finish(false); } return; }      // efter fel svar: barnet trycker på rätt kort, och hör ordet, innan striden går vidare
          if (o.ok && o.next) { stepped = true; b.classList.add('right'); return o.next(); }
          if (o.ok) { b.classList.add('right'); if (promptAudio !== en) P(en); } else { b.classList.add('wrong'); [...box.children].forEach((c, i) => opts[i].ok && c.classList.add('right')); P(slow); task.chosen = (o.label != null ? String(o.label) : b.textContent.trim() || ((b.querySelector('img') || { getAttribute: () => '' }).getAttribute('src') || '').split('/').pop().replace('.png', '')).slice(0, 64);
            if (fixOn) { fixing = true; [...box.children].forEach((x, i) => opts[i].ok && x.classList.add('tapme')); return; } }
          finish(!!o.ok); };
        box.appendChild(b); if (o.ok) this._auto = () => b.click();          // används av testkörningar
      }
      if (x.seq) { quizEl.querySelector('.again').onclick = () => runSeq(x.seq); quizEl.querySelector('.slow').onclick = () => runSeq(x.seq.map((u) => u.replace('.mp3', '.slow.mp3'))); runSeq(x.seq); }
      else if (x.say) { quizEl.querySelector('.again').onclick = () => say(x.say.urls); quizEl.querySelector('.slow').onclick = () => say(x.say.slow); say(x.say.urls); }      // en fras i flera klipp (räkna)
      else if (promptAudio) P(promptAudio);
    };
    // Ljudkort: ett nummer i en färgad ring och en högtalare. Orden hörs i kortens ordning (x.seq).
    const soundCards = (list) => list.map((o, i) => ({ html: `<span class="qsnd"><b class="q${i}">${i + 1}</b>🔊</span>`, ok: o === it }));
    const withFoils = (n, needPic, html) => shuffle([it, ...this.foils(it, n, needPic)]).map((o) => ({ html: html(o), ok: o === it }));
    const nFirst = Math.max(1, this.firstOptions - 1);                   // riskfri första fråga (bara när möt-korten är av): firstOptions kort (balance.js)
    const rr = it && this.book[it.id], hard = !!rr && rr.w >= (this.pk.hardWrong || 99) && rr.w > rr.r;      // svårt ord: fler fel än rätt. Då bara två val.
    // Antal felalternativ efter ordets nivå (K.choices, v18): två kort på Wood, tre på Iron, fyra från Steel.
    const nOpt = task.free ? nFirst : this.nOpts(it, false) - 1;                                  // bildkort
    const nTxt = !this.reading || hard ? 1 : task.free ? nFirst : this.nOpts(it, true) - 1;       // skrivna alternativ: alltid två val för den som inte läser än

    if (T === 'listen_pick_picture') { word(esc(it.en) + newTag); return choice(withFoils(nOpt, true, (o) => pic(o))); }
    if (T === 'read_pick_picture') { promptAudio = null; word(esc(it.en)); return choice(withFoils(nOpt, true, (o) => pic(o))); }
    if (T === 'picture_pick_word') { promptAudio = null; word(`<span class="pic">${pic(it)}</span>`); return choice(withFoils(nTxt, false, (o) => esc(o.en)), true); }
    if (T === 'listen_pick_word') { word('🔊 ?'); return choice(withFoils(nTxt, false, (o) => esc(o.en)), true); }
    if (T === 'en_to_sv') { word(esc(it.en) + newTag); return choice(withFoils(nTxt, false, (o) => esc(o.sv)), true); }
    if (T === 'sv_to_en') { promptAudio = svA; word(`<small>SV</small> ${esc(it.sv)}`, 'sv'); return choice(withFoils(nTxt, false, (o) => esc(o.en)), true); }
    // ----- nya övningar (v18) -----
    // ----- räkna med örat (2026-11-16) -----
    // Välj gruppen: rösten säger "Five cats." och barnet väljer kortet med just så många. Korten visar olika antal av samma
    // sak i tärningsmönster, inget att läsa. Läsare från K.ex.count.readFrom ser också frasen skriven.
    if (T === 'count_group') {
      const { obj, n } = task.count, sp = this.countSay(task, false), rd = this.reading && Math.max(0, tierOf(this.book[it.id])) >= K.ex.count.readFrom;
      promptAudio = null;
      word(`🔊 ${rd ? esc(sp.text) : 'Listen!'}<small class="below">Lyssna och välj rätt antal.</small>`, 'long qcnt');
      const ks = [n, ...this.countFoils(n, this.nOpts(it, false) - 1)], sz = [Math.max(...ks.map((k) => GRID(k)[0])), Math.max(...ks.map((k) => GRID(k)[1]))];
      return choice(shuffle(ks).map((k) => ({ html: groupHTML(obj, k, sz), ok: k === n, cls: 'qgrp', label: k })), false, { say: sp });
    }
    // Lägg dem i huset: rösten säger "Put five cats in the house." Fler saker än som behövs står på gården. Ett tryck skickar en
    // sak hoppande in i huset (det går också att dra), ett tryck i huset skickar den ut igen. Inga siffror: huset fylls, och
    // Done kontrollerar. För få eller för många: rösten säger talet igen, de extra hoppar ut eller tomma platser visar hur
    // många som fattas, och barnet gör klart (som att trycka på rätt kort efter ett fel, K.pick.fixTap). Svaret är då fel en gång.
    if (T === 'count_house') {
      const { obj, n } = task.count, sp = this.countSay(task, true), X = K.ex.count, fixOn = !!this.pk.fixTap && !task.free;
      const rd = this.reading && Math.max(0, tierOf(this.book[it.id])) >= X.readFrom, one = thing(obj);
      const m = Math.min(X.most, n + X.extra[0] + Math.floor(Math.random() * (X.extra[1] - X.extra[0] + 1)));
      promptAudio = null;
      word(`🏠 ${rd ? esc(sp.text) : '🔊 Listen!'}<small class="below">Lyssna och lägg rätt antal i huset.</small>`, 'long qcnt');
      frame(`<div class="qhouse"><div class="qyard"></div><div class="qhome"><i class="qroof"></i><div class="qin"></div></div><button class="qdone">✓ Done<small>Klar</small></button></div>`);
      quizEl.querySelector('.again').onclick = () => say(sp.urls); quizEl.querySelector('.slow').onclick = () => say(sp.slow);
      const yard = quizEl.querySelector('.qyard'), home = quizEl.querySelector('.qhome'), inn = quizEl.querySelector('.qin'), done = quizEl.querySelector('.qdone');
      task.shown = m; let fixing = false, quick = false; const inside = [];      // quick: testkörningar hoppar över hoppen
      document.querySelectorAll('.qfly').forEach((f) => f.remove());
      // Huset ritas om efter varje drag: sakerna i huset i rader om fem, och efter ett fel de tomma platserna som fattas.
      const draw = () => {
        inn.innerHTML = '';
        for (const b of inside) { const s = document.createElement('button'); s.className = 'qslot'; s.innerHTML = one; s.setAttribute('aria-label', obj.en); s.onclick = () => out(b); inn.appendChild(s); b.qs = s; }
        if (fixing) for (let i = inside.length; i < n; i++) { const e = document.createElement('i'); e.className = 'qslot empty'; inn.appendChild(e); }
        home.classList.toggle('some', inside.length > 0); done.classList.toggle('tapme', fixing && inside.length === n);
      };
      // Hoppet är bara utseende: en kopia flyger från rutan r till elementet to. Själva flytten är redan gjord.
      const hop = (r, to) => {
        if (quick || !r || !to || typeof to.animate !== 'function' || !r.width) return;
        const b = to.getBoundingClientRect(); if (!b.width) return;
        const f = document.createElement('div'); f.className = 'qfly'; f.innerHTML = one; Object.assign(f.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }); document.body.appendChild(f);
        const dx = b.left + b.width / 2 - (r.left + r.width / 2), dy = b.top + b.height / 2 - (r.top + r.height / 2), k = b.width / r.width;
        to.style.visibility = 'hidden';
        const a = f.animate([{ transform: 'translate(0, 0) scale(1)' }, { transform: `translate(${dx / 2}px, ${Math.min(0, dy) / 2 - 46}px) scale(${(1 + k) / 2 + 0.1})`, offset: 0.5 }, { transform: `translate(${dx}px, ${dy}px) scale(${k})` }], { duration: 380, easing: 'ease-in-out' });
        const end = () => { f.remove(); to.style.visibility = ''; }; a.onfinish = end; a.oncancel = end; setTimeout(end, 900);
      };
      const into = (b, r) => {
        if (locked || b.in) return;
        if (fixing && inside.length >= n) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); return; }      // efter ett fel: huset är fullt
        r = r || (quick ? null : b.getBoundingClientRect()); b.in = true; inside.push(b); b.classList.add('gone'); draw(); hop(r, b.qs);
      };
      const out = (b, force) => {
        if ((locked && !force) || !b.in) return;
        const r = !quick && b.qs && b.qs.getBoundingClientRect(); b.in = false; inside.splice(inside.indexOf(b), 1); draw(); b.classList.remove('gone'); hop(r, b);
      };
      const things = Array.from({ length: m }, () => {
        const b = document.createElement('button'); b.className = 'qthing'; b.innerHTML = one; b.setAttribute('aria-label', obj.en); yard.appendChild(b);
        b.onclick = () => { if (performance.now() - (b.dragEnd || -1e9) < 400) return; into(b); };
        // Dra: saken följer fingret, och släpps den över huset (med god marginal) går den in. Annars glider den tillbaka.
        b.onpointerdown = (e) => {
          if (locked || b.in) return;
          const sx = e.clientX, sy = e.clientY; let moved = false;
          try { b.setPointerCapture(e.pointerId); } catch (err) { /* äldre webbläsare */ }
          b.onpointermove = (ev) => { const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 10) return; moved = true; b.classList.add('drag'); b.style.transform = `translate(${dx}px, ${dy}px) scale(1.12)`; };
          b.onpointerup = b.onpointercancel = (ev) => {
            b.onpointermove = b.onpointerup = b.onpointercancel = null; if (!moved) return;
            b.dragEnd = performance.now(); const r = b.getBoundingClientRect(), h = home.getBoundingClientRect(), pad = 36;
            b.classList.remove('drag'); b.style.transform = '';
            if (ev.type === 'pointerup' && ev.clientX > h.left - pad && ev.clientX < h.right + pad && ev.clientY > h.top - pad && ev.clientY < h.bottom + pad) into(b, r);
          };
        };
        return b;
      });
      const numSlow = `audio/${it.audio}.slow.mp3`;
      done.onclick = () => {
        if (locked) return;
        const k = inside.length;
        if (fixing) { if (k === n) { done.classList.remove('tapme'); home.classList.remove('bad'); P(en); finish(false); } else say([numSlow]); return; }      // efter fel: klart när huset har rätt antal
        if (k === n) { home.classList.add('ok'); P(en); return finish(true); }
        task.chosen = String(k); fixing = true; home.classList.add('bad'); if (this.sfx) this.sfx('wrong');
        say([numSlow]);                                                       // rösten säger talet igen, långsamt
        const extra = inside.slice(n);
        if (extra.length) { extra.forEach((b) => b.qs && b.qs.classList.add('extra')); setTimeout(() => extra.forEach((b) => out(b, true)), 650); }      // de extra hoppar ut
        draw(); extra.forEach((b) => b.qs && b.qs.classList.add('extra'));
        if (!fixOn) { while (inside.length > n) out(inside[inside.length - 1], true); finish(false); }
      };
      this._auto = () => { quick = true; while (inside.length > n) out(inside[inside.length - 1], true); for (const b of things) if (inside.length < n && !b.in) into(b); done.click(); };      // används av testkörningar
      say(sp.urls); return;
    }
    // Bild och skrivet ord tillsammans: läsaren väljer svenskan, den som inte läser hör två ord och väljer det som hör till bilden.
    if (T === 'picword_sv') { word(`<span class="pic">${pic(it)}</span> ${esc(it.en)}`); return choice(withFoils(this.nOpts(it, true) - 1, false, (o) => esc(o.sv)), true); }
    if (T === 'picword_hear') {
      const two = shuffle([it, task.alt]); promptAudio = null;
      word(`<span class="pic">${pic(it)}</span> ${esc(it.en)}`);
      return choice(soundCards(two), false, { seq: two.map((o) => `audio/${o.audio}.mp3`) });
    }
    // Rätta Page: Page säger ett ord under bilden (ljudklippet för ordet). Rätt eller fel? Har Page fel väljer barnet sedan rätt ord.
    if (T === 'fix_page') {
      const cl = task.claim, wrongClaim = cl !== it;
      promptAudio = `audio/${cl.audio}.mp3`;
      word(`<span class="pic">${pic(it)}</span><span class="qsay"><i class="qpgi">${pageIcon()}</i>${esc(cl.en.charAt(0).toUpperCase() + cl.en.slice(1))}!</span><small class="below">Is Page right? (Har Page rätt?)</small>`, 'long qfix');
      const step2 = () => {
        word(`<span class="pic">${pic(it)}</span><span class="qsay"><i class="qpgi">${pageIcon()}</i>Oops! What is it?</span><small class="below">Vad är det?</small>`, 'long qfix');
        if (this.reading) { promptAudio = null; const rest = this.foils(it, 6, false).filter((o) => o !== cl && o.en !== cl.en).slice(0, Math.max(0, this.nOpts(it, true) - 2)); return choice(shuffle([it, cl, ...rest]).map((o) => ({ html: esc(o.en), ok: o === it })), true); }
        const two = shuffle([it, cl]); promptAudio = null;
        return choice(soundCards(two), false, { seq: two.map((o) => `audio/${o.audio}.mp3`) });
      };
      return choice([{ html: '👍 Right', ok: !wrongClaim }, { html: '👎 Wrong', ok: wrongClaim, next: wrongClaim ? step2 : null }], true);
    }
    // Hör meningen och välj scenen (meningens scen och felscener ur innehållet, ritade med ordens bilder).
    if (T === 'scene_hunt') {
      const C = K.ex.hunt.cards, n = Math.min(1 + s.foils.length, this.reading ? C.read : C.noread);
      word('🔊 ?');
      const opts = [{ html: this.sceneHTML(s.scene), ok: true }, ...shuffle(s.foils).slice(0, n - 1).map((f) => ({ html: this.sceneHTML(f) }))];
      return choice(shuffle(opts).map((o) => ({ ...o, cls: 'qscn' })));
    }
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
    // spell_chant (v18): samma brickor som build_sentence, men bara ljudet. Ingen svensk mening. Varje rätt bricka gnistrar.
    const chant = T === 'spell_chant', sent = T === 'build_sentence' || chant, pieces = sent ? s.tiles : it.en.split('');
    if (chant) word('🪄 🔊 <small class="below">Listen and build the spell!</small>', 'long qchant');
    else if (T === 'build_sentence') word(`<small>SV</small> ${esc(s.sv)}`, 'sv long'); else word(it.pic ? `<span class="pic">${pic(it)}</span>` : `<small>SV</small> ${esc(it.sv)}`, it.pic ? '' : 'sv');
    frame(`<div class="tilebox"><div class="slots">${pieces.map(() => '<i></i>').join('')}</div><div class="tiles"></div></div>`);
    const slots = [...quizEl.querySelectorAll('.slots i')], tiles = quizEl.querySelector('.tiles'); let at = 0;
    for (const p of shuffle(pieces.map((p, i) => ({ p, i })))) {
      const b = document.createElement('button'); b.className = 'tile'; b.textContent = p.p;
      b.onclick = () => { if (locked || b.disabled) return;
        if (p.p.toLowerCase() === pieces[at].toLowerCase()) { slots[at].textContent = pieces[at]; slots[at].classList.add('ok'); if (chant) slots[at].classList.add('zap'); b.disabled = true; b.classList.remove('hint'); at++; if (at === pieces.length) { P(en); finish(true); } }
        else if (sent && this.onSlip) {                       // fel ord i meningen: fienden slår (onSlip), men barnet får fortsätta bygga
          task.slips = (task.slips || 0) + 1; b.classList.add('wrong'); setTimeout(() => b.classList.remove('wrong'), 650); if (this.sfx) this.sfx('wrong'); this.onSlip(task);
          if (task.slips >= 2) { const next = [...tiles.children].find((x) => !x.disabled && x.textContent.toLowerCase() === pieces[at].toLowerCase()); if (next) next.classList.add('hint'); }   // efter två fel visas nästa ord
          if (task.slips === 1 || task.slips === 3) P(slow); }
        else { b.classList.add('wrong'); slots.forEach((sl, i) => { sl.textContent = pieces[i]; if (i >= at) sl.classList.add('shown'); }); P(slow); finish(false); } };
      tiles.appendChild(b);
    }
    this._auto = () => { const b = [...tiles.children].find((x) => !x.disabled && x.textContent.toLowerCase() === pieces[at].toLowerCase()); if (b) b.click(); };
    P(sent ? en : it.pic ? en : svA);
  }

  // En scen ur innehållet: {pic, n, size, color, mood, speed} eller {pics: [..]}. Emojin byts mot ordets bild när ett ord har den.
  sceneHTML(sc) {
    if (!this.byPic) { this.byPic = {}; for (const i of this.items) if (i.pic && !this.byPic[i.pic]) this.byPic[i.pic] = i; }
    const one = (e) => (this.byPic[e] ? pic(this.byPic[e]) : `<span class="qemo">${esc(e)}</span>`);
    const list = sc.pics ? sc.pics : Array.from({ length: Math.max(1, Math.min(sc.n || 1, 10)) }, () => sc.pic);
    const badge = sc.mood === 'happy' ? '😊' : sc.mood === 'sad' ? '😢' : sc.speed === 'fast' ? '💨' : sc.speed === 'slow' ? '🐌' : '';
    const col = sc.color ? ` style="--qc:${COL[sc.color] || '#888'}"` : '';
    return `<span class="qsc${sc.size ? ' ' + sc.size : ''}${sc.color ? ' col' : ''} k${list.length}"${col}>${list.map(one).join('')}${badge ? `<i class="qbadge">${badge}</i>` : ''}</span>`;
  }

  // Möt-kortet: ett nytt ord visas som ett kort med bild, ord och ljud (svenskan som text för den som läser, annars på
  // flaggknappen). Ett tryck på kortet är ett gratis slag i striden: cb({ right: true, meet: true }). Ingen fråga, ingen risk.
  renderMeet(task, quizEl, wordEl, cb) {
    const it = task.item, P = this.play, en = `audio/${it.audio}.mp3`, svA = `audio/sv/${it.id}.mp3`, t0 = Date.now();
    wordEl.className = 'word'; wordEl.innerHTML = esc(it.en) + '<span class="new">NEW</span>';
    quizEl.innerHTML = `<div class="speak"><button class="again" aria-label="Play again">🔊</button><button class="slow svq" aria-label="Swedish">🇸🇪</button></div>
      <button class="teach meet${this.reading ? '' : ' noread'}" aria-label="${esc(it.en)}"><div class="big${it.pic ? '' : ' none'}">${it.pic ? pic(it) : '💬'}</div><div><b>${esc(it.en)}</b><span>= ${esc(it.sv)}</span></div><i class="tap">⚔️</i></button>`;
    quizEl.querySelector('.again').onclick = () => P(en); quizEl.querySelector('.svq').onclick = () => P(svA);
    const card = quizEl.querySelector('.meet'); let used = false;
    card.onclick = () => { if (used) return; used = true; card.classList.add('done'); task.ms = Math.max(0, Date.now() - t0 - (task.away || 0)); this.met(task); cb({ right: true, meet: true }); };
    this._auto = () => card.click();                                     // används av testkörningar
    P(en); if (!it.pic) P(svA);                                          // utan bild bär svenskan betydelsen
  }

  // Lär in-kort: visas när barnet svarar fel på en riskfri första fråga (bara när möt-korten är av, K.meet.on). Ingen fiendeattack.
  teach(it, quizEl, wordEl, go) {
    wordEl.className = 'word'; wordEl.innerHTML = esc(it.en) + '<span class="new">NEW</span>';
    quizEl.innerHTML = `<div class="teach"><div class="big">${it.pic ? pic(it) : ''}</div><div><b>${esc(it.en)}</b><span>= ${esc(it.sv)}</span></div><button class="again">🔊</button><button class="btn ok">OK!</button></div>`;
    const en = `audio/${it.audio}.mp3`; quizEl.querySelector('.again').onclick = () => this.play(en); quizEl.querySelector('.ok').onclick = go;
    this.play(en.replace('.mp3', '.slow.mp3'));
  }
}
