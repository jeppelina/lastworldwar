// Owl's Echo: Simon with picture pads. The owl plays a row of words, the child taps them back in order.
// Each pad says its word. One miss replays the row; a second miss makes it one shorter. Five rows per round.
import { pickWords, rnd, picOf, timers, landscape, spriteHTML } from './shared.js';

// log(item, correct, chosen): tillägg i spelet, varje tryck i en rad rapporteras till skalet (sparas som mg_echo).
export function start(root, { words, level = 1, play, sfx, onDone, log = () => {} }) {
  const T = timers();
  const nPads = level > 1 ? 6 : 4, pads = pickWords(words, nPads, { pic: true });
  const land = landscape(root), cols = nPads === 6 ? (land ? 3 : 2) : 2, rows = nPads / cols, ROUNDS = 5;
  let seq = [rnd(nPads)], pos = 0, phase = 'listen', tries = 0, done = 0, best = 0;
  const grow = () => { let x; do { x = rnd(nPads); } while (x === seq[seq.length - 1]); seq.push(x); };
  grow();
  root.innerHTML = `<div class="mg"><div class="mg-status"><span class="owlbox">${spriteHTML('owl')}</span><span class="mg-say"></span><span class="dots"></span></div>
    <div class="fit"><div class="grid echo listen" style="--cols:${cols};--rows:${rows};--max:190px">${pads.map((p, i) => `<button class="mtile" data-i="${i}" data-id="${p.id}">${picOf(p)}</button>`).join('')}</div></div></div>`;
  const grid = root.querySelector('.echo'), els = [...grid.children], say = root.querySelector('.mg-say');
  const dots = () => { root.querySelector('.dots').innerHTML = Array.from({ length: ROUNDS }, (_, i) => `<i class="${i < done ? 'on' : i === done ? 'now' : ''}"></i>`).join(''); };
  const setPhase = (p) => { phase = p; grid.classList.toggle('listen', p !== 'input'); grid.dataset.phase = p; grid.dataset.seq = seq.join(','); };
  els.forEach((b, i) => { b.onclick = () => tap(i); });

  async function playback() {
    setPhase('listen'); say.textContent = 'Listen...'; dots();
    await T.wait(500);
    for (const i of seq) {
      els[i].classList.add('lit');
      await Promise.race([Promise.all([play(pads[i]), T.wait(650)]), T.wait(1500)]);
      els[i].classList.remove('lit');
      await T.wait(220);
    }
    pos = 0; setPhase('input'); say.textContent = 'Your turn!';
  }
  function finish() { setPhase('over'); T.later(() => onDone({ won: best >= 3, score: best, stars: best >= 5 ? 3 : best >= 4 ? 2 : 1, words: pads, note: `Longest echo: ${best} words` }), 900); }
  function tap(i) {
    if (phase !== 'input') return;
    els[i].classList.add('lit'); T.later(() => els[i].classList.remove('lit'), 260);
    play(pads[i]); log(pads[seq[pos]], i === seq[pos], i === seq[pos] ? null : pads[i].id);
    if (i === seq[pos]) {
      pos++;
      if (pos < seq.length) return;
      best = Math.max(best, seq.length); done++; tries = 0; setPhase('wait'); sfx('good'); say.textContent = 'Yes!'; dots();
      if (done >= ROUNDS) return finish();
      grow(); T.later(playback, 1100);
    } else {
      sfx('soft'); els[i].classList.remove('shake'); void els[i].offsetWidth; els[i].classList.add('shake'); setPhase('wait'); tries++;
      if (tries >= 2) { tries = 0; done++; if (seq.length > 2) seq.pop(); say.textContent = 'A shorter one.'; dots(); if (done >= ROUNDS) return finish(); }
      else say.textContent = 'Listen again.';
      T.later(playback, 1200);
    }
  }
  playback();
  return () => T.clear();
}
