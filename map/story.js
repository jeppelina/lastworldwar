// Berättelsen på kartan: det som ligger kvar (brännmärket, flaggan, ballongen i trädet, skylten, fotspåren) och de korta
// stunderna som spelas ovanpå kartan (luftskeppet, spanaren i ballongen, kejsaren med kikaren, gnistorna vid bossens port).
// Laddas före map.js, som anropar window.MAP_STORY(api) och sedan ground() och sky() i varje bildruta i världsvyn.
// Vilka saker som finns och när en stund spelas bestäms av spelets skal (game/story.js och main.js): kartan har inga regler.
// Inget här rör nodernas platser eller stigen. Sakerna ställs på en ledig plats intill en nod (place), och allt ritas
// med några få rektanglar per bildruta.
window.MAP_STORY = function (A) {
  'use strict';
  const ctx = A.ctx, view = A.view, O = '#1b1630', GOLD = '#e0aa3c', RED = '#a8243f', PUR = '#4a3f78';
  // Rektangel i kartans koordinater med x, y som bas.
  let bx = 0, by = 0;
  const at = (x, y) => { bx = Math.round(x); by = Math.round(y); };
  const R = (c, a, b, w, h) => { ctx.fillStyle = c; A.rect(bx + a, by + b, w, h); };

  // ---------- Platser: en ledig fläck intill en nod, på land, en bit från stigen, noderna, skyltarna och sidostoppen ----------
  const ANCHOR = { scorch: -1, tree: 4, balloon: 4, sign: 2, flag: 2, tracks: 5 }, SPOT = { balloon: 'tree', flag: 'sign' };
  function place(m, ni, taken) {
    const p = m.pts[ni < 0 ? m.pts.length + ni : Math.min(ni, m.pts.length - 1)], path = [];
    for (const seg of m.segs) for (let j = 0; j < seg.length; j += 3) path.push(seg[j]);
    let best = null;
    for (const dist of [30, 38, 46, 56]) for (let a = 0; a < 16; a++) {
      const q = { x: Math.round(p.x + Math.cos(a * 0.3927) * dist), y: Math.round(p.y + Math.sin(a * 0.3927) * dist * 0.8) };
      if (q.x < 40 || q.x > m.W - 40 || q.y < 70 || q.y > m.H - 74) continue;      // inte under kartans rubrik, knapprad eller kanter
      let ok = true; for (let dx = -8; dx <= 8 && ok; dx += 4) for (let dy = -6; dy <= 2; dy += 4) if (!m.ter.mask[(q.y + dy) * m.W + q.x + dx]) { ok = false; break; }
      if (!ok) continue;
      let free = 1e9;
      for (const n of m.pts) free = Math.min(free, Math.hypot(q.x - n.x, q.y - n.y), Math.hypot(q.x - n.x, q.y - n.y - 16) + 2, Math.hypot(q.x - n.x, q.y - n.y + 22) + 4);
      for (const s of m.sides) free = Math.min(free, Math.hypot(q.x - s.x, q.y - s.y) - 4);
      for (const s of path) free = Math.min(free, Math.hypot(q.x - s.x, q.y - s.y) + 6);
      for (const s of taken) free = Math.min(free, Math.hypot(q.x - s.x, q.y - s.y) - 6);
      const score = free - (dist - 30) * 0.4;
      if (!best || score > best.score) best = { x: q.x, y: q.y, score };
    }
    return best || { x: Math.round(p.x + 28), y: Math.round(p.y - 22) };
  }
  function spot(k, kind) {
    const m = A.getWorld(k), key = SPOT[kind] || kind, sp = m._story || (m._story = {});
    return sp[key] || (sp[key] = place(m, ANCHOR[key] != null ? ANCHOR[key] : 3, Object.values(sp)));
  }

  // ---------- Det som ligger kvar ----------
  const DRAW = {
    // Brännmärket efter kejsarens blixt: en sotig fläck med glödande sprickor och en tunn rökslinga.
    scorch(p, t) {
      at(p.x, p.y);
      R('#2a2030', -8, -3, 16, 6); R('#2a2030', -6, -4, 12, 8); R('#1b1420', -5, -2, 10, 4);
      const f = ((t * 3) | 0) % 3;
      [[-4, -1], [-3, 0], [-2, 0], [-1, -1], [0, -1], [1, 0], [2, 0], [3, 1], [0, -2], [1, -3]].forEach(([x, y], i) => R((i + f) % 3 ? '#ff6a3a' : '#ffb04a', x, y, 1, 1));
      const a = (t * 0.35) % 1; R(a < 0.5 ? '#84768a' : '#aca0b0', -1 + Math.round(Math.sin(a * 6) * 2), -6 - Math.round(a * 12), 2, 2);
    },
    // Ett litet runt träd. Med ballong: spanarens kvarglömda ballong har fastnat i kronan och guppar.
    tree(p, t, balloon) {
      at(p.x, p.y);
      R(O, -2, -5, 4, 6); R('#7a5230', -1, -4, 2, 4);
      R(O, -7, -14, 14, 10); R(O, -5, -16, 10, 2); R('#3f9444', -6, -13, 12, 8); R('#3f9444', -4, -15, 8, 2); R('#7cd060', -5, -14, 6, 3); R('#2c7440', -1, -8, 6, 2);
      if (!balloon) return;
      const b = ((t * 2) | 0) % 2;
      R('#f4e3b0', 3, -19 - b, 1, 5);
      R(O, 0, -29 - b, 8, 10); R(O, 1, -30 - b, 6, 12); R(RED, 1, -28 - b, 6, 8); R(RED, 2, -29 - b, 4, 10); R(GOLD, 3, -29 - b, 1, 10); R('#f4e3b0', 5, -26 - b, 2, 2); R('#ffd0d8', 2, -28 - b, 1, 2);
    },
    balloon(p, t) { DRAW.tree(p, t, true); },
    // Vägskylten i öknen (den som kejsaren senare tar).
    sign(p) {
      at(p.x, p.y);
      R(O, -2, -11, 4, 12); R('#9a6b3f', -1, -10, 2, 10);
      R(O, -8, -16, 15, 7); R(O, 7, -15, 2, 5); R(O, 9, -14, 1, 3); R('#c9965a', -7, -15, 14, 5); R('#c9965a', 7, -14, 2, 3); R('#e8c080', -7, -15, 14, 1); R('#6b4a2a', -5, -13, 4, 1); R('#6b4a2a', 1, -13, 4, 1);
    },
    // Skylten är borta: en stubbe står kvar, och bredvid vajar kejsarens röda flagga med kronan.
    flag(p, t) {
      at(p.x - 5, p.y);
      R(O, -2, -4, 4, 5); R('#9a6b3f', -1, -3, 2, 3); R('#e8c080', -1, -4, 1, 1);
      at(p.x + 3, p.y); const w = ((t * 4) | 0) % 2;
      R(O, -1, -19, 3, 20); R('#c8c8d8', 0, -18, 1, 18);
      R(O, 1, -19, 11, 9); R(RED, 2, -18, 9, 7); R('#6a1838', 2, -12 - w, 9, 1 + w);
      R(GOLD, 4, -15, 5, 2); R(GOLD, 4, -16, 1, 1); R(GOLD, 6, -17, 1, 2); R(GOLD, 8, -16, 1, 1);
    },
    // Jättens fotspår i träsket.
    tracks(p) {
      for (const [x, y] of [[-13, 4], [-1, -4], [11, 3]]) {      // tre stora avtryck med tår, ljus lerkant nertill
        at(p.x + x, p.y + y);
        R('#9aa86a', -4, -1, 9, 6); R('#1e1a30', -4, -2, 9, 6); R('#1e1a30', -3, -3, 7, 8);
        R('#1e1a30', -4, -6, 2, 2); R('#1e1a30', -1, -7, 2, 2); R('#1e1a30', 2, -6, 2, 2);
      }
    },
  };

  // ---------- Figurer ----------
  // Spanaren Peeper i sin lappade ballong, med kikaren riktad mot hjälten. Basen är korgens botten.
  function peeper(x, y, t, look) {
    at(x, y);
    R(O, -7, -29, 14, 14); R(O, -5, -31, 10, 18); R(RED, -6, -28, 12, 12); R(RED, -4, -30, 8, 16); R(GOLD, -1, -30, 2, 16); R('#f4e3b0', 2, -25, 3, 3); R('#ffd0d8', -4, -28, 1, 3);
    R(O, -4, -14, 1, 5); R(O, 3, -14, 1, 5);
    R(O, -5, -9, 10, 7); R('#b08050', -4, -8, 8, 5); R('#8a5a34', -4, -5, 8, 1);
    R(O, -3, -14, 6, 6); R('#3a2c5e', -2, -13, 4, 4); R('#ffc23a', 0, -12, 1, 1);
    if (look) { R(O, -9, -12, 7, 4); R(GOLD, -8, -11, 6, 2); R(((t * 3) | 0) % 4 ? '#bfe8ff' : '#ffffff', -9, -11, 1, 2); }
  }
  // Kejsarens luftskepp, sett på håll. Basen är gondolens mitt.
  function airship(x, y, t) {
    at(x, y);
    R(O, 19, -27, 8, 14); R(RED, 20, -26, 6, 12);
    R(O, -15, -28, 30, 18); R(O, -20, -26, 40, 14); R(O, -24, -23, 48, 8); R(PUR, -14, -27, 28, 16); R(PUR, -19, -25, 38, 12); R(PUR, -23, -22, 46, 6); R('#6a5ca0', -13, -27, 24, 2); R('#6a5ca0', -18, -25, 5, 1); R('#2f2752', -14, -13, 28, 2); R('#2f2752', -19, -15, 38, 2);
    R(GOLD, -2, -27, 3, 16);
    R(O, -10, -11, 1, 6); R(O, 9, -11, 1, 6);
    R(O, -3, -10, 6, 5); R('#2f2752', -2, -9, 4, 4); R(GOLD, -3, -11, 1, 1); R(GOLD, -1, -12, 2, 2); R(GOLD, 2, -11, 1, 1); R('#ffc23a', -2, -8, 1, 1); R('#ffc23a', 1, -8, 1, 1);   // kejsarens krona och ögon
    R(O, -13, -6, 26, 8); R('#8a5a34', -12, -5, 24, 6); R(GOLD, -12, -5, 24, 1); R('#ffd84a', -8, -3, 2, 2); R('#ffd84a', -1, -3, 2, 2); R('#ffd84a', 6, -3, 2, 2);
    R('#c8c8d8', 14, -4 + (((t * 9) | 0) % 2) * 2, 1, 3);
  }
  // Kejsaren som kikar fram från vänsterkanten med en kikare. Basen är axelns överkant, x är hjälmens vänsterkant.
  function emperor(x, y, t, startled) {
    at(x, y);
    R(O, -8, -2, 22, 16); R(RED, -7, -1, 20, 15); R(PUR, 1, -1, 10, 6); R(GOLD, -7, -1, 20, 1);
    R(O, -1, -17, 14, 16); R(PUR, 0, -16, 12, 14); R('#2b2740', 3, -11, 9, 5);
    R(GOLD, 0, -20, 12, 4); R(GOLD, 0, -23, 2, 3); R(GOLD, 5, -25, 2, 5); R(GOLD, 10, -23, 2, 3); R('#e8433b', 5, -19, 2, 2);
    if (startled) { R('#ffc23a', 4, -10, 3, 3); R('#ffc23a', 8, -10, 3, 3); R('#ffffff', 17, -27, 3, 7); R('#ffffff', 17, -18, 3, 3); return; }      // stora ögon och ett utropstecken
    const b = Math.round(Math.sin(t * 1.6) * 1);
    R('#ffc23a', 5, -10, 2, 2);
    R(O, 8, -12 + b, 15, 5); R(GOLD, 9, -11 + b, 13, 3); R('#b88820', 14, -11 + b, 1, 3); R(((t * 2) | 0) % 3 ? '#bfe8ff' : '#ffffff', 22, -11 + b, 1, 3);
    R('#2f2752', 12, -8 + b, 3, 3);
  }

  // ---------- Stunderna. t = sekunder sedan stunden började. Koordinaterna är kartans (skärmens läge plus kameran). ----------
  const scr = (sx, sy) => [sx + view.cam.x, sy + view.cam.y];
  const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u)), ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  const watchPos = (t) => { const h = A.heroPos(); return [h.x + 24, h.y - 22 + Math.round(Math.sin(t * 1.4) * 2)]; };
  const SC = {
    // Luftskeppet glider över kartan från höger till vänster, med sin skugga på marken.
    airship(t, c) {
      const { vw, vh } = A.size(), u = t / c.dur, [x, y] = scr(lerp(vw + 34, -34, u), vh * 0.62 + Math.sin(t * 1.3) * 2);
      ctx.globalAlpha = 0.25; at(x + 10, y + 30); R('#0e0a2c', -20, -3, 40, 6); R('#0e0a2c', -15, -5, 30, 10); ctx.globalAlpha = 1;
      airship(x, y, t);
    },
    // Spanaren driver in från höger och stannar strax intill hjälten, där han sedan svävar kvar (watch).
    peeper(t, c) {
      const { vw } = A.size(), [wx, wy] = watchPos(t), [sx] = scr(vw + 16, 0), u = ease(t / 3.2);
      peeper(lerp(sx, wx, u), wy - (1 - u) * 26, t, t > 3);
    },
    // Hjälten vann: spanaren hoppar till, far iväg uppåt och tappar en liten ballong som fastnar i trädet.
    peeperOff(t, c) {
      const [wx, wy] = watchPos(0), { vw } = A.size(), [ex, ey] = scr(vw + 20, -40);
      if (t < 0.7) { peeper(wx, wy - Math.round(Math.abs(Math.sin(t * 9)) * 4), t, false); at(wx + 9, wy - 34); R('#ffffff', 0, 0, 2, 5); R('#ffffff', 0, 6, 2, 2); }
      else peeper(lerp(wx, ex, ease((t - 0.7) / 2.4)), lerp(wy, ey, ease((t - 0.7) / 2.4)), t, false);
      const tr = c.tree;
      if (tr) {
        DRAW.tree(tr, t, t >= 3.2);
        if (t > 0.9 && t < 3.2) { const u = ease((t - 0.9) / 2.3); at(lerp(wx, tr.x + 3, u), lerp(wy - 20, tr.y - 22, u) - Math.sin(u * 3.14) * 14); R(O, -3, -5, 6, 8); R(RED, -2, -4, 4, 6); R(GOLD, -1, -4, 1, 6); }
      }
    },
    // Vid bossens port: gnistor stiger från hjälten till bossen, som ett löfte om vad starka ord gör.
    gate(t, c) {
      const h = A.heroPos(), m = A.getWorld(view.world), b = m.pts[m.pts.length - 1];
      for (let i = 0; i < 9; i++) {
        const u = (t * 0.45 + i / 9) % 1, x = lerp(h.x, b.x, u), y = lerp(h.y - 10, b.y - 12, u) - Math.sin(u * 3.14) * 14 + Math.sin(t * 3 + i) * 1.5;
        at(x, y); R(i % 3 ? '#ffd84a' : '#ffffff', 0, 0, 1, 1); if (i % 3 === 0) { R('#ffd84a', -1, 0, 3, 1); R('#ffd84a', 0, -1, 1, 3); R('#ffffff', 0, 0, 1, 1); }
      }
      for (let i = 0; i < 10; i++) {                              // gnistor som kretsar kring bossen, allt tätare
        const a = t * 1.8 + i * 0.6283, r = 24 - ((t * 3 + i * 2) % 8), x = b.x + Math.cos(a) * r, y = b.y - 8 + Math.sin(a) * r * 0.55;
        at(x, y); R('#ffd84a', -1, 0, 3, 1); R('#ffd84a', 0, -1, 1, 3); R('#ffffff', 0, 0, 1, 1);
      }
    },
    // Kejsaren kikar fram från vänsterkanten. Ett tryck: han rycker till och försvinner.
    spy(t, c) {
      const { vh } = A.size(), gone = c.poked != null ? t - c.poked : c.dur - t < 0.8 ? 0.8 - (c.dur - t) + 0.25 : -1;
      const inn = gone >= 0 ? (gone < 0.25 ? 1 : 1 - ease((gone - 0.25) / 0.45)) : ease(t / 1.2), [x, y] = scr(-24 + inn * 38, vh * 0.56);
      emperor(x, y, t, c.poked != null && gone < 0.3);
    },
  };

  // ---------- Tillstånd och det map.js anropar ----------
  let decor = {}, watch = false, cur = null;
  const api = {
    // d: { decor: { världens id: [saker] }, watch } från spelets skal (decor() i game/story.js).
    set(d) { decor = (d && d.decor) || {}; watch = !!(d && d.watch); },
    // Startar en stund. o: { dur }. Bara i världsvyn. Returnerar false om stunden inte finns.
    play(kind, o) {
      if (!SC[kind] || view.mode !== 'world') return false;
      cur = { kind, t0: A.now(), dur: (o && o.dur) || 6, poked: null };
      if (kind === 'peeperOff') cur.tree = A.worlds[view.world].id === 'ordskogen' ? spot(view.world, 'tree') : null;
      return true;
    },
    // Ett tryck under en stund. Returnerar hur många millisekunder stunden behöver för att avsluta snyggt.
    poke() {
      if (!cur) return 0;
      if (cur.kind === 'spy') { if (cur.poked == null) cur.poked = A.now() - cur.t0; return Math.max(0, Math.round((cur.poked + 0.75 - (A.now() - cur.t0)) * 1000)); }
      cur = null; return 0;
    },
    stop() { cur = null; },
    busy: () => !!cur,
    // Hjältens höjd på skärmen (0 = överst, 1 = nederst), så att skalet kan lägga pratbubblan där den inte skymmer.
    heroY: () => (A.heroPos().y - view.cam.y) / Math.max(1, A.size().vh),
    spot: (k, kind) => spot(k, kind),
    state: () => ({ decor, watch, cur: cur ? cur.kind : null }),
    // Ritas före noderna: det som ligger på marken.
    ground(t) {
      const w = A.worlds[view.world], list = decor[w.id] || [];
      for (const kind of list) {
        if (!DRAW[kind]) continue;
        if (cur && cur.kind === 'peeperOff' && (kind === 'tree' || kind === 'balloon')) continue;      // stunden ritar trädet själv
        DRAW[kind](spot(view.world, kind), t);
      }
    },
    // Ritas sist, över moln och hjälte: figurerna i luften och den pågående stunden.
    sky(t) {
      if (cur) {
        const e = A.now() - cur.t0;
        if (e >= cur.dur || (cur.poked != null && e > cur.poked + 0.75)) cur = null; else SC[cur.kind](e, cur);
      }
      if (watch && !(cur && (cur.kind === 'peeper' || cur.kind === 'peeperOff'))) { const [x, y] = watchPos(t); peeper(x, y, t, true); }
    },
  };
  return api;
};
