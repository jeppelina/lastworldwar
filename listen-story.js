// Listen to the story: en kort berättelse efter striden på ett stopp (docs/pedagogik/lyssna-berattelse.md och
// berattelser-varld2.md). Rösten läser, och där ett av stoppets ord står blir det ibland en lucka: barnet trycker på rätt
// bild, bilden landar i texten och berättelsen fortsätter. Till sist läses hela berättelsen en gång till.
// Data: content/listen-stories.json (byggs av prototypes/story-listen/export.py), ljud i audio/story/.
// Ljudet spelas med Web Audio i hela klipp; inget klipps mitt i tal.
//
// playStory(opts) visar berättelsen i ett eget lager över striden. opts:
//   story, data          berättelsen och hela datafilen (steps, lines, plans)
//   item(id)             ordet med det id:t (eller null), pic(item) bilden, ctx() en AudioContext som är igång
//   canGap(item)         får ordet bli en lucka (barnet har mött det, och det räknas för barnet)
//   pool                 ord barnet har mött, som felkort kan väljas bland
//   young                yngre läget: färre luckor, paus före ordet, högst tre kort
//   onAnswer(item, right) första försöket på en lucka.  onDone({ right, n }) när barnet trycker Continue.
const rnd = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((x) => x[1]);
const norm = (s) => s.toLowerCase().replace(/[^a-z]/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GROUP = { phrase: 'phrase', home: 'do', action: 'do', describe: 'describe', number: 'number', small: 'place' };
const groupOf = (it) => GROUP[it.cat] || (it.cat === 'animal' ? 'animal' : it.cat === 'food' ? 'food' : 'thing');
const SKIP = new Set(['hot_milk', 'cold_milk']);      // bilderna väntar på beslut

export function playStory(o) {
  const { story: ST, data: D, item, pic } = o, step = D.steps[ST.step];
  const nGaps = o.young ? Math.min(step.gaps, ST.step >= 5 ? 3 : 2) : step.gaps, nCards = o.young ? Math.min(3, step.cards) : step.cards, pause = !!o.young || ST.step <= 3;
  const el = document.createElement('div'); el.id = 'lstory';
  el.innerHTML = `<div class="ls-bar"><button class="ls-snd" aria-label="Again">🔊</button><button class="ls-snd slow" aria-label="Slowly">🐢</button><b class="ls-title"></b><div class="ls-dots"></div></div>
    <div class="ls-story"></div><div class="ls-cards"></div>`;
  document.body.appendChild(el);
  const $ = (s) => el.querySelector(s); $('.ls-title').textContent = ST.title;
  let src = null, gen = 0, dead = false;
  const BUF = {}, actx = o.ctx();
  const buf = (f) => (BUF[f] = BUF[f] || fetch(`audio/story/${f}.mp3`).then((r) => r.arrayBuffer()).then((a) => new Promise((ok, no) => actx.decodeAudioData(a, ok, no))));
  const litOff = () => el.querySelectorAll('.lit').forEach((e) => e.classList.remove('lit'));
  function stop() { gen++; if (src) { const s = src; src = null; try { s.stop(); } catch (e) {} } litOff(); }
  async function play(file, slow, onTime) {
    const my = gen, k = slow ? 1 / 0.75 : 1; let b; try { b = await buf(file + (slow ? '.slow' : '')); } catch (e) { return !dead; }      // saknas ett klipp går berättelsen vidare
    if (my !== gen || dead) return false;
    const s = actx.createBufferSource(); s.buffer = b; s.connect(actx.destination); src = s; const at = actx.currentTime + 0.02; s.start(at);
    return new Promise((done) => {
      let fin = false; const end = (ok) => { if (fin) return; fin = true; if (src === s) src = null; if (onTime) onTime(-1); done(ok); };
      s.onended = () => end(my === gen && !dead);
      const tick = () => { if (fin) return; if (my !== gen) return end(false); if (onTime) onTime((actx.currentTime - at) / k); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
  }

  // ----- raderna: ord och möjliga luckor, som i prototypes/story-listen/index.html -----
  const LINES = ST.lines.map((line, li) => {
    const key = `${ST.id}_${li + 1}`, tm = D.lines[key], parts = []; let wi = 0, ci = 0;
    for (const m of line.matchAll(/\{([^}|]+)(?:\|([^}]+))?\}|([^{]+)/g)) {
      if (m[3]) { for (const tok of m[3].split(/(\s+)/)) { if (!tok) continue; if (/^\s+$/.test(tok) || !norm(tok)) parts.push({ sp: tok }); else parts.push({ w: tok, i: wi++ }); } }
      else { const first = wi; wi += m[1].match(/[A-Za-z']+/g).length; parts.push({ cand: ci++, gap: m[1], id: m[2] || m[1].replace(/ /g, '_'), words: m[1].split(' '), i0: first, i1: wi - 1 }); }
    }
    return { li, key, tm, parts, cands: parts.filter((p) => p.cand != null) };
  });
  // Luckorna: bland ord barnet har mött, utspridda, högst två per rad. Stoppets nya ord först om det går.
  {
    const ok = (c) => { const it = item(c.id); return it && o.canGap(it); }, pick = new Set(), per = new Map();
    const fresh = new Set(o.fresh || []), order = (L) => rnd(L.cands.filter(ok)).sort((a, b) => (fresh.has(b.id) ? 1 : 0) - (fresh.has(a.id) ? 1 : 0));
    for (const round of [0, 1]) for (const L of rnd(LINES.filter((L) => L.cands.length))) {
      if (pick.size >= nGaps) break; if ((per.get(L) || 0) > round) continue;
      const c = order(L).find((x) => !pick.has(x)); if (!c) continue; pick.add(c); per.set(L, (per.get(L) || 0) + 1);
    }
    for (const L of LINES) for (const c of L.cands) c.chosen = pick.has(c);
  }
  // Ritas: valda luckor som tomma rutor, övriga möjliga luckor som bild med ordet under.
  const story = $('.ls-story');
  for (const L of LINES) {
    const p = document.createElement('p'); p.className = 'ls-ln hidden'; L.el = p;
    for (const part of L.parts) {
      if (part.sp) p.append(part.sp);
      else if (part.w) { const s = document.createElement('span'); s.className = 'w'; s.textContent = part.w; part.el = s; p.append(s); }
      else if (part.chosen) { const g = document.createElement('span'); g.className = 'gap'; g.innerHTML = '<span class="box">?</span><small></small>'; g.dataset.id = part.id; part.el = g; p.append(g); }
      else {
        const it = item(part.id), cw = document.createElement('span'); cw.className = 'cw';
        part.els = part.words.map((w) => { const s = document.createElement('span'); s.className = 'w'; s.textContent = w; return s; });
        if (it && /^</.test(pic(it))) { cw.innerHTML = `<span class="pbox">${pic(it)}</span>`; const sm = document.createElement('small'); part.els.forEach((s, k) => { if (k) sm.append(' '); sm.append(s); }); cw.append(sm); cw.classList.add('pw'); }
        else part.els.forEach((s, k) => { if (k) cw.append(' '); cw.append(s); });
        p.append(cw);
      }
    }
    p.onclick = () => replayLine(L);
    story.append(p);
    L.gaps = L.cands.filter((c) => c.chosen); const mask = L.gaps.reduce((m, c) => m | (1 << c.cand), 0);
    if (!mask) L.pieces = null;
    else {
      const P = (D.plans[L.key][mask] || []).map((q) => ({ ...q })); let since = [], pi = 0;
      for (const part of L.parts) {
        if (part.w) since.push(part.el); else if (part.cand != null && !part.chosen) since.push(...part.els);
        else if (part.chosen) { const q = P[pi++] || {}; q.before = since; q.g = part; part.piece = q; since = []; }
      }
      if (P[pi] && P[pi].kind === 'text') P[pi].before = since;
      L.pieces = P;
    }
  }
  const dots = $('.ls-dots'); for (const L of LINES) for (const g of L.gaps) { const d = document.createElement('i'); g.dot = d; dots.append(d); }
  const syncCw = () => el.querySelectorAll('.cw').forEach((c) => c.classList.toggle('lit', !!c.querySelector('.w.lit')));
  const light = (els, wt) => (t) => { const on = new Set(); els.forEach((e, i) => { if (e && wt && wt[i] && t >= wt[i][1] - 0.02 && t < wt[i][2] + 0.04) on.add(e); }); for (const e of new Set(els)) if (e) e.classList.toggle('lit', on.has(e)); syncCw(); };
  const karaoke = (L) => (t) => { const on = (a, b) => t >= a - 0.02 && t < b + 0.06, W = L.tm.words;
    for (const part of L.parts) {
      if (part.w && part.el && W[part.i]) part.el.classList.toggle('lit', on(W[part.i][1], W[part.i][2]));
      else if (part.chosen && part.el && W[part.i0]) part.el.classList.toggle('lit', on(W[part.i0][1], W[part.i1][2]));
      else if (part.els) part.els.forEach((e, k) => W[part.i0 + k] && e.classList.toggle('lit', on(W[part.i0 + k][1], W[part.i0 + k][2])));
    } syncCw(); };
  const gapEls = (q) => Array(q.g.gap.match(/[A-Za-z']+/g).length).fill(q.g.el), aEls = (q) => [...q.before, ...gapEls(q)];
  async function upToGap(q, slow) {
    const my = gen;
    if (pause) {
      if (q.lead && !(await play(q.lead, slow, light(q.before, q.leadWords)))) return false;
      await sleep(slow ? 800 : 600); if (my !== gen || dead) return false;
      q.g.el.classList.add('hear'); const ok = await play(q.word, slow); q.g.el.classList.remove('hear'); return ok;
    }
    return play(q.a, slow, light(aEls(q), q.aWords));
  }
  async function lineUpTo(L, q, slow) { for (const p of L.pieces) { if (p === q) return upToGap(q, slow); if (!(await play(p.a, slow, light(aEls(p), p.aWords)))) return false; } return false; }

  // ----- felkorten -----
  const inStory = new Set(LINES.flatMap((L) => L.cands.map((c) => c.id)));
  function foilsFor(right) {
    const ok = (it) => it && it.id !== right.id && !SKIP.has(it.id) && /^</.test(pic(it)) && !it.en.includes(right.en) && !right.en.includes(it.en), out = [];
    if (step.foilsFromStory) out.push(...rnd([...inStory].map(item).filter((it) => ok(it) && o.canGap(it) && groupOf(it) === groupOf(right))));
    const pool = o.pool.filter((it) => ok(it) && (!inStory.has(it.id) || groupOf(right) === 'place') && !out.includes(it));
    out.push(...rnd(pool.filter((it) => groupOf(it) === groupOf(right))), ...rnd(pool.filter((it) => groupOf(it) !== groupOf(right))));
    return out.slice(0, nCards - 1);
  }
  let cur = { L: null, q: null }; const result = [];
  function ask(L, q) {
    const g = q.g, right = item(g.id);
    return new Promise((done) => {
      const box = $('.ls-cards'), list = rnd([right, ...foilsFor(right)]); let miss = 0, idle;
      box.innerHTML = '';
      const nudge = () => { clearTimeout(idle); idle = setTimeout(async () => { if (dead || cur.q !== q) return; g.el.classList.add('hear'); await play(q.word, false); g.el.classList.remove('hear'); nudge(); }, 8000); };
      const fill = async (b) => {
        clearTimeout(idle); cur.q = null; stop(); [...box.children].forEach((c) => c !== b && c.classList.add('gone')); b.classList.add('show');
        await sleep(350); if (dead) return done(null);
        g.el.classList.remove('now'); g.el.classList.add('full'); g.el.querySelector('.box').innerHTML = pic(right); g.el.querySelector('small').textContent = g.gap;
        g.dot.classList.add(miss ? 'miss' : 'done'); result.push(!miss); box.innerHTML = '';
        g.el.classList.add('lit'); await play(q.word, false); g.el.classList.remove('lit');
        if (dead) return done(null); await sleep(250); done(!miss);
      };
      for (const it of list) {
        const b = document.createElement('button'); b.className = 'card'; b.dataset.id = it.id; b.innerHTML = pic(it);
        b.onclick = async () => {
          if (cur.q !== q) return;
          if (it === right) { if (!miss) o.onAnswer(right, true); return fill(b); }
          if (!miss) o.onAnswer(right, false, it);
          miss++; b.classList.add('wrong'); stop(); const me = gen;
          if (miss >= 2 || list.length === 2) { const rb = [...box.children][list.indexOf(right)]; rb.classList.add('show'); cur.q = null; await sleep(1000); return dead ? done(null) : fill(rb); }
          await lineUpTo(L, q, true); if (me === gen) { litOff(); nudge(); }
        };
        box.append(b);
      }
      cur.q = q; nudge();
    });
  }
  async function again(slow) { if (!cur.q) return; stop(); const my = gen; await lineUpTo(cur.L, cur.q, slow); if (my === gen) litOff(); }
  let over = false;
  async function replayLine(L) {
    if (L.el.classList.contains('hidden')) return;
    if (L === cur.L && cur.q) return again(false);
    if (!cur.q && !over) return; if (L.li >= (cur.L ? cur.L.li : 0) && !over) return;
    stop(); const my = gen; await play(L.key, false, karaoke(L)); if (my === gen) litOff();
  }
  $('.ls-snd').onclick = () => again(false); $('.ls-snd.slow').onclick = () => again(true);

  (async () => {
    await sleep(300);
    for (const L of LINES) {
      cur.L = L; L.el.classList.remove('hidden'); el.querySelectorAll('.ls-ln.cur').forEach((e) => e.classList.remove('cur')); L.el.classList.add('cur'); L.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!L.pieces) { if (!(await play(L.key, false, karaoke(L)))) return; }
      for (const q of L.pieces || []) {
        if (q.kind === 'text') { if (!(await play(q.file, false, light(q.before, q.words)))) return; continue; }
        q.g.el.classList.add('now'); q.g.dot.classList.add('now');
        if (!(await upToGap(q, false))) return;
        if ((await ask(L, q)) === null) return;
      }
      await sleep(450); if (dead) return;
    }
    // Hela berättelsen en gång till, med bilderna på plats.
    $('.ls-cards').innerHTML = '<span class="ls-hint">Listen to the whole story.</span>'; el.querySelectorAll('.ls-ln.cur').forEach((e) => e.classList.remove('cur'));
    await sleep(700);
    for (const L of LINES) { if (dead) return; L.el.classList.add('cur'); const ok = await play(L.key, false, karaoke(L)); litOff(); L.el.classList.remove('cur'); if (!ok) break; await sleep(250); }
    if (dead) return; over = true;
    const n = result.length, r = result.filter(Boolean).length;
    $('.ls-cards').innerHTML = `<div class="ls-end"><span class="ls-stars">${'★'.repeat(r === n ? 3 : r >= n / 2 ? 2 : 1)}</span><button class="btn">Continue</button></div>`;
    $('.ls-end .btn').onclick = () => { dead = true; stop(); el.remove(); o.onDone({ right: r, n }); };
  })();
  return { close: () => { dead = true; stop(); el.remove(); } };
}
