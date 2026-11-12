// Word Bingo: a 3 x 3 card. A word is called; tap it on the card, or tap "Not here!" if it is not there.
// Three in a row is bingo. Three cards per round. No reading: picture card. Reading: written words on the card.
import { pickWords, shuffle, picOf, esc, timers } from './shared.js';

const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// log(item, correct, chosen): tillägg i spelet, varje svar på ett utropat ord rapporteras till skalet (sparas som mg_bingo).
export function start(root, { words, reading, play, sfx, onDone, log = () => {} }) {
  const T = timers(), CARDS = 3, met = new Map();
  let n = -1, card = [], calls = [], cur = null, marked = new Set(), busy = true, mistakes = 0;
  root.innerHTML = `<div class="mg"><div class="mg-status"><span class="mg-say"></span><span class="dots"></span></div>
    <div class="mg-row"><div class="fit"><div class="grid bingo" style="--cols:3;--rows:3;--max:150px"></div></div>
    <div class="bside"><div class="calls"><button class="rbtn again">🔊</button><button class="rbtn slow">🐢</button></div><button class="btn alt nothere">Not here!</button></div></div></div>`;
  const grid = root.querySelector('.bingo'), say = root.querySelector('.mg-say'), nh = root.querySelector('.nothere');
  root.querySelector('.again').onclick = () => cur && play(cur); root.querySelector('.slow').onclick = () => cur && play(cur, { slow: true });
  nh.onclick = () => answer(-1);

  function nextCard() {
    n++;
    if (n >= CARDS) return onDone({ won: true, score: CARDS, stars: mistakes <= 1 ? 3 : mistakes <= 5 ? 2 : 1, words: [...met.values()], note: mistakes ? `${mistakes} ${mistakes === 1 ? 'slip' : 'slips'}` : 'No slips' });
    const all = pickWords(words, 12, { pic: true }); card = all.slice(0, 9); calls = shuffle(all); marked = new Set(); card.forEach((w) => met.set(w.id, w));
    root.querySelector('.dots').innerHTML = Array.from({ length: CARDS }, (_, i) => `<i class="${i < n ? 'on' : i === n ? 'now' : ''}"></i>`).join('');
    grid.innerHTML = card.map((w, i) => `<button class="mtile ${reading ? 'txt' : ''}" data-i="${i}" data-id="${w.id}">${reading ? esc(w.en) : picOf(w)}</button>`).join('');
    grid.querySelectorAll('.mtile').forEach((b) => { b.onclick = () => answer(+b.dataset.i); });
    T.later(nextCall, 500);
  }
  function nextCall() {
    cur = calls.shift(); busy = false; grid.dataset.call = cur.id; grid.dataset.on = card.indexOf(cur);
    say.textContent = 'Listen. Is it on your card?'; play(cur);
  }
  function mark(i) { marked.add(i); grid.children[i].classList.add('marked'); }
  function bingo() { return LINES.find((l) => l.every((i) => marked.has(i))); }
  function proceed(delay) {
    const line = bingo();
    if (line) { T.later(() => { line.forEach((i) => grid.children[i].classList.add('line')); sfx('win'); say.textContent = 'Bingo!'; }, Math.max(300, delay - 500)); return T.later(nextCard, delay + 1500); }
    T.later(nextCall, delay);
  }
  function answer(i) {
    if (busy) return;
    if (i >= 0 && marked.has(i)) return;
    const on = card.indexOf(cur);
    busy = true; log(cur, i === on, i === on ? null : i >= 0 ? card[i].id : 'not_here');
    if (i === on) {
      sfx('good');
      if (on >= 0) { mark(on); say.textContent = 'Yes!'; } else say.textContent = 'Right. Not here!';
      return proceed(900);
    }
    mistakes++; sfx('soft');
    const el = i >= 0 ? grid.children[i] : nh; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    play(cur, { slow: true });
    const target = on >= 0 ? grid.children[on] : nh; target.classList.remove('blink'); void target.offsetWidth; target.classList.add('blink');
    say.textContent = on >= 0 ? 'Listen again. It was this one.' : 'Listen again. It was not here.';
    if (on >= 0) T.later(() => mark(on), 1200);
    T.later(() => proceed(300), 1900);
  }
  nextCard();
  return () => T.clear();
}
