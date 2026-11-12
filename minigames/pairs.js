// Spark Pairs: memory. A pair is a picture card plus a sound card (no reading) or a written word card (reading).
// Every flipped card says its word. It cannot be lost; fewer turns give more stars.
import { pickWords, shuffle, picOf, esc, timers, landscape, spriteHTML } from './shared.js';

// log(item, correct, chosen): tillägg i spelet, varje vänt par rapporteras till skalet (sparas som mg_pairs).
export function start(root, { words, reading, level = 1, play, sfx, onDone, log = () => {} }) {
  const T = timers();
  const n = level > 1 ? 6 : 4;
  const picks = pickWords(words, n, { pic: true });
  const cards = shuffle(picks.flatMap((it) => [{ it, kind: 'pic' }, { it, kind: reading ? 'word' : 'sound' }]));
  const land = landscape(root), cols = n === 6 ? (land ? 4 : 3) : (land ? 4 : 2), rows = cards.length / cols;
  root.innerHTML = `<div class="mg"><div class="mg-status"><span class="mg-say">Find the pairs!</span><span class="mg-count"></span></div>
    <div class="fit"><div class="grid pairs" style="--cols:${cols};--rows:${rows}">${cards.map((c, i) => `<button class="mtile down" data-i="${i}" data-id="${c.it.id}" data-kind="${c.kind}">
      <span class="backface">${spriteHTML('spark')}</span>
      <span class="face">${c.kind === 'pic' ? picOf(c.it) : c.kind === 'word' ? `<span class="wtxt">${esc(c.it.en)}</span>` : '🔊'}</span></button>`).join('')}</div></div></div>`;
  const els = [...root.querySelectorAll('.mtile')], count = root.querySelector('.mg-count'), say = root.querySelector('.mg-say');
  let open = [], locked = false, turns = 0, found = 0; const misses = {};
  const draw = () => { count.textContent = `${found} / ${n}`; };
  draw();
  els.forEach((b, i) => { b.onclick = () => tap(i); });

  function tap(i) {
    const b = els[i], c = cards[i];
    if (locked || !b.classList.contains('down')) return;
    b.classList.remove('down'); els.forEach((e) => e.classList.remove('glow'));
    play(c.it); sfx('flip');
    open.push(i);
    if (open.length === 1) {       // after several misses on this pair, its partner glows
      if ((misses[c.it.id] || 0) >= 3) { const j = cards.findIndex((x, k) => k !== i && x.it.id === c.it.id); els[j].classList.add('glow'); }
      return;
    }
    turns++;
    const [a, z] = open; open = [];
    if (cards[a].it.id === cards[z].it.id) {
      found++; draw(); locked = true; log(cards[a].it, true);
      T.later(() => { sfx('good'); els[a].classList.add('gone', 'right'); els[z].classList.add('gone', 'right'); locked = false;
        if (found === n) { say.textContent = 'All pairs found!'; T.later(() => onDone({ won: true, score: turns, stars: turns <= Math.ceil(n * 1.75) ? 3 : turns <= n * 3 ? 2 : 1, words: picks, note: `${turns} turns` }), 1100); } }, 650);
    } else {
      misses[cards[a].it.id] = (misses[cards[a].it.id] || 0) + 1; misses[cards[z].it.id] = (misses[cards[z].it.id] || 0) + 1;
      locked = true; log(cards[a].it, false, cards[z].it.id);
      T.later(() => { els[a].classList.add('down'); els[z].classList.add('down'); locked = false; }, 1300);
    }
  }
  return () => T.clear();
}
