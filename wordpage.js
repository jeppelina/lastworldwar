// Banans boksida: "orden i den här striden". Det är barnets egen ordbok, men bara den här banans ord: en rad per ord med
// bild, engelska, svenska och ordets nivåfärg ur boken. Sidan visas före striden (mode 'pre', knappen Fight!) och nås med
// bokknappen under striden (mode 'peek', knappen Back). main.js står för när den öppnas och för bokföringen (openStopPage där).
//
// Tryck på en rad säger ordet, ett tryck till på samma rad säger det långsamt, flaggan säger det svenska ordet.
// "Read to me" läser banans nya ord i tur och ordning. Orden som införs i den här striden är märkta NEW, ord som kommer
// vid senare omspel är nedtonade och märkta LATER, och ord barnet har mött har sin nivåfärg.
// Power start (charge): varje nytt ord som har hörts tänder en blixt. När alla är hörda är laddningen full (stats().power).
// Utan läsning (reading false) visas ingen svensk text: bild, ljud och knappar med symboler bär allt.
import { TIERS, tierOf } from './words.js';
import { pic } from './pics.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const enUrl = (it) => `audio/${it.audio}.mp3`, slowUrl = (it) => `audio/${it.audio}.slow.mp3`, svUrl = (it) => `audio/sv/${it.id}.mp3`;
// Så presenteras ett ord: engelska, och svenska efteråt när ordet saknar bild (då bär inget annat betydelsen).
const introUrls = (it) => (it.pic ? [enUrl(it)] : [enUrl(it), svUrl(it)]);

// host: elementet som sidan läggs över (sidan täcker det helt). o: {
//   title            banans namn
//   words            banans ord i den ordning övningsmotorn inför dem (quiz.own)
//   book             barnets ordbok (läses bara)
//   fresh            orden som införs i den här striden (quiz.newNow()), de märks NEW
//   reading          false = ingen svensk text
//   mode             'pre' (före striden) eller 'peek' (öppnad under striden)
//   helped           peek: en fråga på ett av sidans ord var uppe, och svaret ger inga poäng den här gången
//   charge           true = Power start går att ladda här (bara om det finns nya ord)
//   heard            Set med id för nya ord som redan har hörts (delas mellan öppningarna under samma strid)
//   say(...urls)     säger klippen i tur och ordning och bryter det som spelas. Löftet blir klart när de är sagda eller brutna
//   hush()           tystar allt
//   sfx(namn)        litet ljud (valfri)
//   img              bild på Page till rubriken (data-url, valfri)
//   svShow(nyckel)   ska den svenska stödraden visas? (de fem första gångerna, som i resten av spelet)
//   onClose(stats)   Fight! eller Back
//   onLeave(stats)   bara 'pre', valfri: knappen tillbaka till kartan }
// stats = { secs, taps (tryck på rader och flaggor), words (olika ord som hörts), heard (nya ord hörda), power }
// Returnerar { el, close(), stats() }.
export function openWordPage(host, o) {
  const book = o.book || {}, fresh = o.fresh || [], heard = o.heard || new Set(), reading = o.reading !== false, pre = o.mode !== 'peek';
  const isFresh = (it) => !book[it.id] && fresh.includes(it), isLater = (it) => !book[it.id] && !fresh.includes(it);
  const rank = (it) => (isFresh(it) ? -1 : isLater(it) ? 99 : tierOf(book[it.id]));
  const list = o.words.slice().sort((a, b) => rank(a) - rank(b) || o.words.indexOf(a) - o.words.indexOf(b));      // nya först, sedan svagast till starkast, sist de som kommer senare
  const news = list.filter(isFresh), charge = !!o.charge && pre && news.length > 0;
  const t0 = performance.now(), touched = new Set(); let taps = 0, sel = null, readTok = 0, open = true;
  const full = () => charge && news.every((it) => heard.has(it.id));
  const stats = () => ({ secs: Math.round((performance.now() - t0) / 1000), taps, words: touched.size, heard: news.filter((it) => heard.has(it.id)).length, power: full() });
  const sv = (key, text) => (reading && (!o.svShow || o.svShow(key)) ? ` <small>(${esc(text)})</small>` : '');

  const el = document.createElement('div'); el.className = 'wpage' + (reading ? '' : ' noread') + (pre ? ' pre' : ' peek');
  const tierChips = TIERS.map((t, j) => { const n = list.filter((it) => tierOf(book[it.id]) === j).length; return n ? `<span style="background:${t.color};color:${t.ink}">${t.name} ${n}</span>` : ''; }).join('');
  const note = !pre && o.helped ? '📖 No points for this word now.' + sv('page-helped', 'Inga poäng för ordet nu.') : charge ? '<span class="pips"></span><span class="chargelab"></span>' : '';
  el.innerHTML = `<div class="head">${pre && o.onLeave ? '<button class="leave" aria-label="Map">◀</button>' : ''}${o.img ? `<img src="${o.img}" alt="">` : '<span class="bk">📖</span>'}<div class="t"><b>${esc(o.title || 'Words')}</b><small>My Word Book</small></div>
      <div class="legend">${news.length ? `<span class="nw">NEW ${news.length}</span>` : ''}${tierChips}</div></div>
    <div class="note${!pre && o.helped ? ' warn' : ''}">${note}</div><div class="rows"></div>
    <div class="foot"><button class="btn alt big readme" aria-label="Read to me">🔊 <span>Read to me</span></button><button class="btn big fight" aria-label="${pre ? 'Fight' : 'Back to the fight'}">⚔️ ${pre ? 'Fight!' : 'Back'}</button></div>`;
  const $ = (q) => el.querySelector(q), rows = $('.rows'), rowOf = new Map();
  const chargeLab = charge ? 'Hear the new words' + sv('page-charge', 'Lyssna på de nya orden') : '';

  function select(it) { for (const [x, r] of rowOf) r.classList.toggle('sel', x === it); }
  function pips() {
    if (!charge) return;
    $('.pips').innerHTML = news.map((it) => `<i class="${heard.has(it.id) ? 'on' : ''}">⚡</i>`).join('');
    const f = full(); $('.fight').classList.toggle('power', f); $('.chargelab').innerHTML = f ? '<b>Power start!</b>' : chargeLab;
  }
  function markHeard(it) {
    touched.add(it.id);
    if (!isFresh(it) || heard.has(it.id)) return;
    heard.add(it.id); const r = rowOf.get(it); if (r) r.classList.add('heard');
    const was = $('.fight').classList.contains('power'); pips();
    if (charge && !was && full() && o.sfx) o.sfx('good');
  }
  const stopReading = () => { readTok++; $('.readme').classList.remove('on'); };

  for (const it of list) {
    const t = TIERS[tierOf(book[it.id])], row = document.createElement('div'), f = isFresh(it), l = isLater(it);
    row.className = 'wrow' + (f ? ' fresh' : l ? ' later' : '') + (f && heard.has(it.id) ? ' heard' : '');
    if (t) { row.style.background = t.color; row.style.color = t.ink; }
    const tag = f ? '<em class="tag">NEW</em>' : l ? '<em class="tag">LATER</em>' : `<em class="tag" style="background:${t.ink};color:${t.color}">${t.name}</em>`;
    row.innerHTML = `<button class="main" aria-label="${esc(it.en)}"><span class="p${it.pic ? '' : ' none'}">${it.pic ? pic(it) : '💬'}</span><span class="txt"><b>${esc(it.en)}</b><span class="sv">${esc(it.sv)}</span></span>${tag}<span class="turtle">🐢</span></button><button class="svb" aria-label="Swedish">🇸🇪</button>`;
    // Första trycket säger ordet, nästa tryck på samma rad säger det långsamt. Flaggan säger det svenska ordet.
    row.querySelector('.main').onclick = () => { stopReading(); taps++; const again = sel === it; sel = it; select(it); o.say(again ? slowUrl(it) : enUrl(it)); markHeard(it); };
    row.querySelector('.svb').onclick = () => { stopReading(); taps++; touched.add(it.id); o.say(svUrl(it)); };
    rowOf.set(it, row); rows.appendChild(row);
  }
  // "Read to me": läser banans nya ord i tur och ordning (alla ord om inget är nytt). Vilket tryck som helst avbryter.
  $('.readme').onclick = async () => {
    const btn = $('.readme'), wasOn = btn.classList.contains('on'); stopReading(); o.hush(); if (wasOn) return;
    const todo = news.length ? news : list, my = readTok; btn.classList.add('on');
    for (const it of todo) {
      if (my !== readTok || !open) return;
      sel = null; select(it); const r = rowOf.get(it); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' });
      await o.say(...introUrls(it));
      if (my !== readTok || !open) return;
      markHeard(it);
    }
    btn.classList.remove('on'); select(null);
  };
  function close() { if (!open) return; open = false; readTok++; o.hush(); el.remove(); }
  $('.fight').onclick = () => { const s = stats(); close(); if (o.onClose) o.onClose(s); };
  if ($('.leave')) $('.leave').onclick = () => { const s = stats(); close(); o.onLeave(s); };
  pips();
  host.appendChild(el);
  return { el, close, stats };
}
