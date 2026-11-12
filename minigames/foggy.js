// Foggy Window: a picture hides behind fog tiles. Wipe tiles, then pick the word. Fewer tiles wiped, more stars.
// Reading: written answer cards. No reading: speaker buttons with a tick button to choose (two options on level 1).
import { pickWords, foilsFor, shuffle, picUrl, esc, timers } from './shared.js';

// log(item, correct, chosen): tillägg i spelet, varje gissning rapporteras till skalet (sparas som mg_foggy).
export function start(root, { words, reading, level = 1, play, sfx, onDone, log = () => {} }) {
  const T = timers();
  const picks = pickWords(words, 5, { pic: true }), N = level > 1 ? 4 : 3, nOpt = !reading && level === 1 ? 2 : 3;
  let idx = -1, cur = null, wiped = 0, busy = false, right = 0, starSum = 0;
  root.innerHTML = `<div class="mg"><div class="mg-status"><span class="mg-say"></span><span class="dots"></span></div>
    <div class="mg-row"><div class="fogwrap"><div class="fit"><div class="grid fog" style="--cols:${N};--rows:${N};--max:200px"></div></div></div><div class="answers"></div></div></div>`;
  const $ = (s) => root.querySelector(s), fog = $('.fog'), ans = $('.answers'), say = $('.mg-say');

  function next() {
    idx++;
    if (idx >= picks.length) return onDone({ won: right >= 3, score: right, stars: right === 0 ? 1 : Math.max(1, Math.round(starSum / picks.length)), words: picks, note: `${right} of ${picks.length} pictures` });
    cur = picks[idx]; wiped = 0; busy = false;
    $('.dots').innerHTML = picks.map((p, i) => `<i class="${i < idx ? 'on' : i === idx ? 'now' : ''}"></i>`).join('');
    say.textContent = 'Wipe the fog. What is it?';
    fog.style.backgroundImage = `url("${picUrl(cur)}")`; fog.dataset.id = cur.id;
    fog.innerHTML = Array.from({ length: N * N }, () => '<button></button>').join('');
    fog.querySelectorAll('button').forEach((b) => { b.onclick = () => { if (busy) return; b.classList.add('clear'); wiped++; sfx('turn'); ans.classList.remove('wait'); }; });
    const opts = shuffle([cur, ...foilsFor(words, cur, nOpt - 1)]);
    ans.className = 'answers wait';
    ans.innerHTML = opts.map((o, i) => (reading
      ? `<div class="opt"><button class="wordbtn pick" data-i="${i}" data-id="${o.id}">${esc(o.en)}</button></div>`
      : `<div class="opt"><button class="rbtn hear" data-i="${i}">🔊</button><button class="rbtn ok pick" data-i="${i}" data-id="${o.id}">✓</button></div>`)).join('');
    ans.querySelectorAll('.hear').forEach((b) => { b.onclick = () => play(opts[+b.dataset.i]); });
    ans.querySelectorAll('.pick').forEach((b) => { b.onclick = () => choose(opts[+b.dataset.i], b, opts); });
  }
  function choose(o, b, opts) {
    if (busy) return;
    if (!wiped) { say.textContent = 'Wipe a square first.'; fog.classList.remove('shake'); void fog.offsetWidth; fog.classList.add('shake'); return; }
    busy = true; fog.querySelectorAll('button').forEach((x) => x.classList.add('clear'));
    const ok = o.id === cur.id; log(cur, ok, ok ? null : o.id);
    const rightEl = ans.querySelectorAll('.opt')[opts.indexOf(cur)];
    rightEl.classList.add('right'); if (!ok) b.closest('.opt').classList.add('wrong');
    if (ok) { right++; starSum += wiped <= N ? 3 : wiped <= 2 * N ? 2 : 1; sfx('good'); say.textContent = 'Yes!'; play(cur); }
    else { starSum += 0; sfx('soft'); say.textContent = `It was: ${reading ? cur.en : ''}`; play(cur, { slow: true }); }
    if (!reading) say.textContent = ok ? 'Yes!' : 'Listen. It was this one.';
    T.later(next, ok ? 1900 : 2800);
  }
  next();
  return () => T.clear();
}
