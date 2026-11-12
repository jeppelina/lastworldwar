// Gemensamma hjälpfunktioner för minispelen: bilder, ordurval, timers och pixelfigurer ritade i kod.
// Kopia av prototypes/minigames/shared.js utan ljudmotorn och resultatrutan: i spelet kommer ljudet (play, sfx)
// från spelets egen kö i main.js, och resultatrutan med belöningen ritas av skalet (main.js).
import { picHTML } from '../pics.js';

export const GAME = new URL('../', import.meta.url).href;

// ---------- småsaker ----------
export const rnd = (n) => Math.floor(Math.random() * n);
export const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
export const sample = (a, n) => shuffle(a).slice(0, n);
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const landscape = (el) => el.clientWidth >= el.clientHeight;

// Timers som dör med spelet. wait() blir aldrig klar efter clear(), så asynkrona slingor stannar av sig själva.
export function timers() {
  const ids = new Set(); let dead = false;
  const later = (fn, ms) => { const id = setTimeout(() => { ids.delete(id); if (!dead) fn(); }, ms); ids.add(id); return id; };
  return { later, wait: (ms) => new Promise((res) => later(res, ms)), clear() { dead = true; ids.forEach(clearTimeout); ids.clear(); }, get dead() { return dead; } };
}

// ---------- bilder ----------
// pics.js vet vilka ord som har en bildfil men skriver en src som utgår från game/. Här frågas bara om filen finns.
export const hasPic = (it) => picHTML(it.id, '') !== '';
export const picOf = (it) => (hasPic(it) ? `<img class="mpic" src="${GAME}img/${it.id}.png" alt="" draggable="false">` : `<span class="memo">${esc(it.pic || it.hint || it.en)}</span>`);
export const picUrl = (it) => `${GAME}img/${it.id}.png`;

// ---------- ordurval ----------
// opts.pic: ordet måste ha en bildfil. opts.spell: ett enda ord, bara små bokstäver, minLen till maxLen tecken.
export function usable(words, { pic = false, spell = false, minLen = 3, maxLen = 7 } = {}) {
  return words.filter((w) => (!pic || hasPic(w)) && (!spell || (/^[a-z]+$/.test(w.en) && w.en.length >= minLen && w.en.length <= maxLen)));
}
export const pickWords = (words, n, opts) => sample(usable(words, opts), n);
// Felaktiga alternativ till ett ord: samma kategori först, sedan vad som helst annat med bild.
export function foilsFor(words, it, n) {
  const pool = usable(words, { pic: true }).filter((w) => w.id !== it.id && w.en !== it.en);
  const same = shuffle(pool.filter((w) => w.cat === it.cat)), other = shuffle(pool.filter((w) => w.cat !== it.cat));
  return same.concat(other).slice(0, n);
}

// ---------- pixelfigurer ritade i kod ----------
const PAL = { k: '#1d1b2e', w: '#fffdf4', y: '#ffc83d', o: '#f08a1c', b: '#7c5a3a', n: '#8a6a4a', c: '#e9d6b0', d: '#3a3f60', e: '#555c80', g: '#49d17d', s: '#9fe8ff', p: '#b06bff' };
const MAPS = {
  lantern: ['....k....', '...kkk...', '..kkkkk..', '..kyyyk..', '.kyywyyk.', '.kywwwyk.', '.kywwwyk.', '.kyywyyk.', '..kyyyk..', '..kkkkk..', '...kkk...'],
  spark: ['...w...', '...y...', '.y.y.y.', 'wyywyyw', '.y.y.y.', '...y...', '...w...'],
  page: ['.bbbbb.bbbbb.', 'bwwwwwbwwwwwb', 'bwwwwwbwwwwwb', 'bwwkwwbwwkwwb', 'bwwkwwbwwkwwb', 'bwwwwwbwwwwwb', 'bwwwwwbwwwwwb', '.bbbbbbbbbbb.', '...k.....k...', '..kk.....kk..'],
  owl: ['.n........n.', '.nn......nn.', '.nnnnnnnnnn.', 'nnwwnnnnwwnn', 'nwkkwnnwkkwn', 'nwkkwnnwkkwn', 'nnwwnoonwwnn', 'nnnnnoonnnnn', '.nnccccccnn.', '.nnccccccnn.', '..nnccccnn..', '...oo..oo...'],
};
export function sprite(name, swap = {}) {
  const rows = MAPS[name], c = document.createElement('canvas'); c.width = rows[0].length; c.height = rows.length; c.className = 'px px-' + name;
  const g = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') { g.fillStyle = swap[ch] || PAL[ch]; g.fillRect(x, y, 1, 1); } }));
  return c;
}
export const spriteHTML = (name, swap) => `<img class="px px-${name}" alt="" draggable="false" src="${sprite(name, swap).toDataURL()}">`;
