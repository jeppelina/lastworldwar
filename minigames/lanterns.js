// Light the Lanterns: hangman without a gallows. A hidden word, six lanterns, a small letter tray in ABC order.
// A wrong letter puts out one lantern. When all are out the word is shown and read slowly, and it comes back once.
// Level 1: picture and sound as the clue. Level 2: sound only, longer words.
import { pickWords, shuffle, picOf, timers, sprite } from './shared.js';

const TWIN = { c: 'k', k: 'c', a: 'e', e: 'a', i: 'y', y: 'i', w: 'v', v: 'w', s: 'z', o: 'u', u: 'o' };
const COMMON = 'etaoinsrhldcumfpgwybvk';

// log(item, correct, chosen): tillägg i spelet, varje ord rapporteras till skalet (sparas som mg_lanterns). chosen = antal fel bokstäver.
export function start(root, { words, level = 1, play, sfx, onDone, log = () => {} }) {
  const T = timers();
  const picks = pickWords(words, 3, level > 1 ? { pic: true, spell: true, minLen: 4, maxLen: 7 } : { pic: true, spell: true, minLen: 3, maxLen: 5 });
  const queue = picks.slice(), again = new Set(), doneIds = new Set(), traySize = level > 1 ? 12 : 10;
  let solved = 0, lost = 0, turn = 0, cur = null, lit = 6, busy = false;
  root.innerHTML = `<div class="mg"><div class="mg-status"><span class="lamps"></span><span class="mg-say"></span><span class="dots"></span></div>
    <div class="lan-mid"><div class="lan-clue"><button class="lan-pic"></button><div class="col"><button class="rbtn again">🔊</button><button class="rbtn slow">🐢</button></div></div><div class="lslots"></div></div>
    <div class="tray"></div></div>`;
  const $ = (s) => root.querySelector(s), say = $('.mg-say');
  $('.again').onclick = () => cur && play(cur); $('.slow').onclick = () => cur && play(cur, { slow: true }); $('.lan-pic').onclick = () => cur && play(cur);

  function tray(word) {
    const set = new Set(word);
    for (const ch of shuffle([...new Set(word)])) { if (set.size >= traySize) break; if (TWIN[ch] && !set.has(TWIN[ch]) && [...set].filter((x) => !word.includes(x)).length < 3) set.add(TWIN[ch]); }
    for (const ch of shuffle([...COMMON])) { if (set.size >= traySize) break; set.add(ch); }
    return [...set].sort();
  }
  function lamps() { const box = $('.lamps'); box.innerHTML = ''; for (let i = 0; i < 6; i++) { const c = sprite('lantern', i < lit ? {} : { y: '#3a3f60', w: '#555c80' }); if (i >= lit) c.classList.add('off'); box.appendChild(c); } box.dataset.lit = lit; }
  function next() {
    if (!queue.length) return onDone({ won: solved > 0, score: solved, stars: solved === 0 ? 1 : lost <= 3 ? 3 : lost <= 9 ? 2 : 1, words: picks, note: `${solved} of ${picks.length} words spelled` });
    cur = queue.shift(); lit = 6; busy = false; turn++;
    $('.dots').innerHTML = picks.map((p) => `<i class="${doneIds.has(p.id) ? 'on' : p === cur ? 'now' : ''}"></i>`).join('');
    say.textContent = 'Which word is it?';
    const pic = $('.lan-pic'); pic.innerHTML = picOf(cur); pic.classList.toggle('hidden', level > 1);
    $('.lslots').innerHTML = [...cur.en].map(() => '<i></i>').join(''); $('.lslots').dataset.word = cur.en;
    $('.tray').innerHTML = tray(cur.en).map((ch) => `<button data-ch="${ch}">${ch}</button>`).join('');
    root.querySelectorAll('.tray button').forEach((b) => { b.onclick = () => guess(b); });
    lamps(); play(cur);
  }
  function guess(b) {
    if (busy || b.classList.contains('hit') || b.classList.contains('miss')) return;
    const ch = b.dataset.ch, slots = [...root.querySelectorAll('.lslots i')];
    if (cur.en.includes(ch)) {
      b.classList.add('hit'); sfx('good');
      [...cur.en].forEach((c, i) => { if (c === ch) { slots[i].textContent = ch; slots[i].classList.add('on'); } });
      if (slots.every((s) => s.textContent)) {
        busy = true; solved++; doneIds.add(cur.id); log(cur, true, String(6 - lit)); $('.lan-pic').classList.remove('hidden'); say.textContent = 'You found the spark!';
        T.later(() => { play(cur); sfx('win'); }, 350); T.later(next, 2300);
      }
    } else {
      b.classList.add('miss'); sfx('soft'); lit--; lost++; lamps();
      if (lit === 0) {
        busy = true; $('.lan-pic').classList.remove('hidden'); log(cur, false, '6');
        [...cur.en].forEach((c, i) => { if (!slots[i].textContent) { slots[i].textContent = c; slots[i].classList.add('shown'); } });
        say.textContent = 'The spark got away. It will come back!';
        play(cur, { slow: true });
        if (!again.has(cur.id)) { again.add(cur.id); queue.push(cur); }
        T.later(next, 3200);
      }
    }
  }
  next();
  return () => T.clear();
}
