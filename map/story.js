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
  // ANCHOR = noden som saken står intill (-1 = bossen). SPOT = saker som delar plats (det nya ersätter det gamla).
  const ANCHOR = { scorch: -1, tree: 4, balloon: 4, sign: 2, flag: 2, tracks: 5,
    heroFlag: -1, statue: 0, chest: 2, sack: 3, lanternDark: 8, hole: 2, crate: 7, bridgeOld: 5, snowman: 2, camp: 5, garden: 1, chores: -1, bush: 4 };
  const SPOT = { balloon: 'tree', flag: 'sign', lantern: 'lanternDark', bridge: 'bridgeOld', chestOpen: 'chest' };
  // Platserna räknas i en fast ordning för alla saker som någon gång kan stå i världen (keys från spelets skal), så att
  // ingen sak flyttar sig när en ny tillkommer. De fyra första är första lagrets saker, i den ordning de alltid fått plats.
  const ORDER = ['tree', 'sign', 'scorch', 'tracks', 'heroFlag', 'chores', 'statue', 'chest', 'sack', 'lanternDark', 'hole', 'crate', 'bridgeOld', 'snowman', 'camp', 'garden', 'bush'];
  const FIRST = ['tree', 'sign', 'scorch', 'tracks'];
  let keys = null;
  // col: andra lagrets saker (upp till 22 punkter höga) håller sig också undan nodens hela kolumn: stjärnorna ovanför och
  // Lv-skylten under. Första lagrets saker (träd, skylt, brännmärke, fotspår) placeras som förut, så att de inte flyttar sig.
  function place(m, ni, taken, col) {
    const p = m.pts[ni < 0 ? m.pts.length + ni : Math.min(ni, m.pts.length - 1)], path = [];
    for (const seg of m.segs) for (let j = 0; j < seg.length; j += 3) path.push(seg[j]);
    let best = null;
    for (const dist of col ? [30, 38, 46, 56, 66] : [30, 38, 46, 56]) for (let a = 0; a < 16; a++) {
      const q = { x: Math.round(p.x + Math.cos(a * 0.3927) * dist), y: Math.round(p.y + Math.sin(a * 0.3927) * dist * 0.8) };
      if (q.x < 40 || q.x > m.W - 40 || q.y < 70 || q.y > m.H - 74) continue;      // inte under kartans rubrik, knapprad eller kanter
      let ok = true; for (let dx = -8; dx <= 8 && ok; dx += 4) for (let dy = -6; dy <= 2; dy += 4) if (!m.ter.mask[(q.y + dy) * m.W + q.x + dx]) { ok = false; break; }
      if (!ok) continue;
      let free = 1e9;
      for (const n of m.pts) free = Math.min(free, Math.hypot(q.x - n.x, q.y - n.y), Math.hypot(q.x - n.x, q.y - n.y - 16) + 2, Math.hypot(q.x - n.x, q.y - n.y + 22) + 4);
      if (col) {
        // aldrig ovanpå en nod, dess stjärnor eller Lv-skylten (saken är upp till 20 bred och 22 hög)
        if (m.pts.some((n) => Math.abs(q.x - n.x) < 31 && q.y > n.y - 30 && q.y - 22 < n.y + 24)) continue;
        if (taken.some((o) => Math.abs(o.x - q.x) < 20 && Math.abs(o.y - q.y) < 16)) continue;      // och inte ovanpå en annan sak
        for (const n of m.pts) { const dx = Math.max(0, Math.abs(q.x - n.x) - 22), dy = Math.max(0, n.y - 34 - q.y, q.y - 24 - (n.y + 24)); free = Math.min(free, Math.hypot(dx, dy) + 4); }
      }
      // Världens butik (sidostoppet 's3', 2026-11-16) är ett hårt hinder: ingen sak står på ståndet eller på myntet över det.
      // Den räknas inte i avståndet nedan, så att sakerna står kvar där de stod före butiken om de inte krockar med den.
      if (m.sides.some((s) => s.shop && Math.abs(q.x - s.x) < 25 && q.y > s.y - 38 && q.y < s.y + 26)) continue;
      for (const s of m.sides) if (!s.shop) free = Math.min(free, Math.hypot(q.x - s.x, q.y - s.y) - 4);
      for (const s of path) free = Math.min(free, Math.hypot(q.x - s.x, q.y - s.y) + 6);
      for (const s of taken) free = Math.min(free, Math.hypot(q.x - s.x, q.y - s.y) - 6);
      const score = free - (dist - 30) * 0.4;
      if (!best || score > best.score) best = { x: q.x, y: q.y, score };
    }
    return best || (col ? null : { x: Math.round(p.x + 28), y: Math.round(p.y - 22) });
  }
  // Andra lagrets saker: ankarnoden först, sedan noderna närmast den. Får saken ingen ledig plats alls (en smal karta i
  // stående läge) ritas den inte (hide), hellre än att den hamnar ovanpå en nod.
  function place2(m, ni, taken) {
    const n = m.pts.length, i = ni < 0 ? n + ni : Math.min(ni, n - 1), order = [...Array(n).keys()].sort((a, b) => Math.abs(a - i) - Math.abs(b - i));
    for (const j of order) { const q = place(m, j, taken, true); if (q) return q; }
    return { x: -999, y: -999, hide: true };
  }
  function spot(k, kind) {
    const m = A.getWorld(k), key = SPOT[kind] || kind, sp = m._story || (m._story = {}); built.add(k);
    if (!sp[key] && keys && !m._storyAll) {
      m._storyAll = 1;
      const can = new Set(((keys[A.worlds[k].id]) || []).map((x) => SPOT[x] || x).concat(['chores', 'bush']));
      for (const o of ORDER) if (can.has(o) && !sp[o]) sp[o] = FIRST.includes(o) ? place(m, ANCHOR[o], Object.values(sp)) : place2(m, ANCHOR[o], Object.values(sp));
    }
    const a = ANCHOR[key] != null ? ANCHOR[key] : 3;
    return sp[key] || (sp[key] = FIRST.includes(key) ? place(m, a, Object.values(sp)) : place2(m, a, Object.values(sp)));
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
    // ----- Andra lagret: spår och saker som händelserna lämnar -----
    // Hjältens flagga vid en slagen boss, i hjältens färg (rustningens färg, annars blå). Vajar fortare efter ett tryck.
    heroFlag(p, t) {
      at(p.x, p.y); const c = HERO.color || '#3a8ee6', w = ((t * (poked('heroFlag', t) ? 12 : 4)) | 0) % 2;
      R('#6b4a2a', -3, -1, 7, 2); R(O, -1, -21, 3, 21); R('#e8e0c8', 0, -20, 1, 20); R(GOLD, -1, -23, 3, 2);
      R(O, 1, -20, 12, 9); R(c, 2, -19, 10, 7); R('rgba(0,0,0,0.22)', 2, -14 + w, 10, 2 - w);
      R('#ffffff', 6, -17, 3, 1); R('#ffffff', 7, -18, 1, 3); R(c, 12, -19 + w, 1, 6);
    },
    // Staty av hjälten på en stensockel (spelets skal skickar en grå bild av barnets egen gubbe). Glimtar ibland.
    statue(p, t) {
      at(p.x, p.y);
      R(O, -9, -7, 18, 8); R('#9a9aa8', -8, -6, 16, 6); R('#c8c8d4', -8, -6, 16, 1); R('#6c6c7a', -8, -1, 16, 1); R('#6c6c7a', -3, -4, 6, 1);
      if (HERO.statue) A.img(HERO.statue, p.x, p.y - 6);
      else { at(p.x, p.y - 6); R(O, -4, -16, 8, 16); R('#b4b4c0', -3, -15, 6, 14); R('#d8d8e0', -2, -14, 2, 4); }
      const g = (t * 0.7) % 5; if (g < 0.3) { at(p.x, p.y); R('#ffffff', 3, -24, 1, 3); R('#ffffff', 2, -23, 3, 1); }
    },
    // Den hittade kistan: stängd, med en glimt som lockar till ett tryck.
    chest(p, t) {
      at(p.x, p.y); const j = poked('chest', t) ? (((t * 20) | 0) % 2) : 0;
      R(O, -7 + j, -9, 14, 10); R('#9a6b3f', -6 + j, -8, 12, 8); R('#c9965a', -6 + j, -8, 12, 3); R(GOLD, -6 + j, -5, 12, 1); R(GOLD, -1 + j, -6, 2, 3);
      const g = ((t * 2.2) | 0) % 6; if (g < 2) { R('#ffffff', 6, -12 + g, 1, 1); R('#fff3a8', 5, -11 + g, 3, 1); }
    },
    // Den öppnade kistan, och skämtet bredvid: en strumpa (värld 1), en badanka (värld 2), en papperskrona (värld 3).
    chestOpen(p, t) {
      at(p.x, p.y);
      R(O, -7, -6, 14, 7); R('#9a6b3f', -6, -5, 12, 5); R(GOLD, -6, -3, 12, 1); R(O, -7, -12, 14, 6); R('#c9965a', -6, -11, 12, 4); R('#3a2a1a', -5, -6, 10, 1);
      const k = view.world;
      if (k === 0) { R(O, 8, -6, 5, 7); R('#e8433b', 9, -5, 3, 4); R('#e8433b', 9, -2, 5, 2); R('#ffffff', 9, -5, 3, 1); }
      else if (k === 1) { R(O, 8, -6, 7, 7); R('#ffd84a', 9, -5, 3, 3); R('#ffd84a', 9, -3, 5, 3); R('#ff8a2a', 12, -4, 2, 1); R(O, 10, -4, 1, 1); }
      else { R(O, 8, -5, 9, 6); R('#f4e3b0', 9, -4, 7, 4); R('#f4e3b0', 9, -6, 1, 2); R('#f4e3b0', 12, -6, 1, 2); R('#f4e3b0', 15, -6, 1, 2); }
    },
    // Blommor där orden blev starka: en per K.happen.bloomEvery starka ord, i världen där barnet var.
    garden(p, t) {
      const n = BLOOM[A.worlds[view.world].id] || 0, COL = ['#ff7ab0', '#ffd84a', '#ffffff', '#b28aff', '#ff9a3a', '#7ad0ff', '#ff5a6a', '#fff3a8'];
      for (let i = 0; i < n; i++) {
        const [x, y] = GARDEN[i], s = Math.round(Math.sin(t * 1.5 + i) * 0.6);
        at(p.x + x, p.y + y); R('#2c7440', 0, -3, 1, 3); R(COL[i], -1 + s, -5, 3, 1); R(COL[i], s, -6, 1, 3); R('#ffd84a', s, -5, 1, 1);
      }
    },
    // Stjärnsnapparnas tappade säck. Ett tryck: den sprattlar och en gnista hoppar ut.
    sack(p, t) {
      at(p.x, p.y); const j = poked('sack', t) ? Math.round(Math.sin(t * 30)) : 0;
      R(O, -6 + j, -8, 12, 9); R(O, -4 + j, -10, 8, 3); R('#8a5a34', -5 + j, -7, 10, 7); R('#b07a48', -4 + j, -7, 4, 3); R('#5a3a20', -3 + j, -9, 6, 2); R(GOLD, -2 + j, -10, 4, 1);
      if (((t * 1.3) | 0) % 4 === 0) R('#ffd84a', 4, -11, 1, 1);
    },
    // Lyktan vid den mörka stigen: släckt, och tänd (med ett varmt sken som fladdrar).
    lanternDark(p) { at(p.x, p.y); R(O, -1, -16, 3, 17); R('#6b4a2a', 0, -15, 1, 15); R(O, -4, -21, 9, 7); R('#3a3450', -3, -20, 7, 5); R('#5a5470', -3, -20, 7, 1); },
    lantern(p, t) {
      const f = Math.sin(t * 7) * 0.06 + Math.sin(t * 2.3) * 0.04;
      ctx.globalAlpha = 0.18 + f; at(p.x, p.y - 17); R('#ffd84a', -9, -5, 18, 10); R('#ffd84a', -6, -8, 12, 16); ctx.globalAlpha = 1;
      at(p.x, p.y); R(O, -1, -16, 3, 17); R('#6b4a2a', 0, -15, 1, 15); R(O, -4, -21, 9, 7); R('#ffd84a', -3, -20, 7, 5); R('#fff6c8', -1, -19, 3, 3); R(GOLD, -3, -20, 7, 1);
    },
    // Hålet där Clunk grävde, med skon han hittade bredvid.
    hole(p) {
      at(p.x, p.y); R('#e8c080', -9, -2, 18, 4); R('#2a1d10', -6, -2, 12, 3); R('#1b1420', -4, -1, 8, 2); R('#f4d8a0', -9, -3, 4, 1); R('#f4d8a0', 6, -3, 3, 1);
      at(p.x + 11, p.y); R(O, -3, -4, 7, 5); R('#c0503a', -2, -3, 5, 3); R('#c0503a', 2, -2, 2, 2); R('#ffffff', -2, -1, 5, 1);
    },
    // Lådan som föll ur luftskeppet: kejsarens röda krona på sidan. Skakar ibland (någon är där inne). Ett tryck: ögon i springan.
    crate(p, t) {
      const pk = poked('crate', t), j = pk || (t % 6) < 0.3 ? (((t * 18) | 0) % 2) : 0;
      at(p.x + j, p.y); R(O, -7, -12, 14, 13); R('#b07a48', -6, -11, 12, 11); R('#8a5a34', -6, -6, 12, 1); R('#8a5a34', -1, -11, 1, 11); R(RED, -4, -9, 5, 3); R(GOLD, -4, -10, 1, 1); R(GOLD, -2, -10, 1, 1); R(GOLD, 0, -10, 1, 1);
      if (pk) { R('#1b1420', -5, -7, 10, 1); R('#ffd84a', -3, -7, 1, 1); R('#ffd84a', 1, -7, 1, 1); }
    },
    // Den trasiga bron över en pöl, och samma bro lagad.
    bridgeOld(p) { puddle(p); at(p.x, p.y); R('#8a5a34', -9, -2, 3, 2); R('#8a5a34', 7, -3, 3, 2); R('#6b4a2a', -2, 0, 2, 1); R('#6b4a2a', 3, -1, 2, 1); },
    bridge(p) { puddle(p); at(p.x, p.y); R(O, -10, -3, 21, 4); for (let i = -9; i < 10; i += 3) { R('#c9965a', i, -2, 2, 2); R('#e8c080', i, -2, 2, 1); } R('#6b4a2a', -10, -4, 1, 2); R('#6b4a2a', 10, -4, 1, 2); },
    // Snögubben med näsan på magen (där den hamnade när den sattes tillbaka). Ett tryck: han vinkar med pinnarmen.
    snowman(p, t) {
      at(p.x, p.y); const wv = poked('snowman', t) ? ((t * 8) | 0) % 2 : 0;
      R(O, -6, -10, 12, 11); R('#ffffff', -5, -9, 10, 9); R('#d8e8f8', -5, -2, 10, 2);
      R(O, -4, -17, 8, 8); R('#ffffff', -3, -16, 6, 6); R(O, -2, -14, 1, 1); R(O, 1, -14, 1, 1);
      R(O, -4, -20, 8, 3); R('#3a3450', -3, -20, 6, 2); R(RED, -3, -18, 6, 1);
      R('#ff8a2a', 0, -6, 3, 1); R('#ff8a2a', 0, -5, 2, 1);
      R('#6b4a2a', -9, -9, 3, 1); R('#6b4a2a', 6, -9 - wv * 2, 3, 1); R('#6b4a2a', 8, -10 - wv * 3, 1, 1);
    },
    // Kejsarens arméläger: ett rött tält, en lila vimpel med krona och en liten eld.
    camp(p, t) {
      at(p.x, p.y);
      R(O, -9, -11, 16, 12); R(RED, -8, -9, 14, 9); R(RED, -6, -11, 10, 2); R('#6a1838', -2, -6, 3, 6); R(GOLD, -8, -9, 14, 1);
      R(O, 9, -20, 1, 21); R(O, 10, -20, 8, 6); R(PUR, 10, -19, 7, 4); R(GOLD, 12, -18, 3, 1); R(GOLD, 12, -19, 1, 1); R(GOLD, 14, -19, 1, 1);
      const f = ((t * 6) | 0) % 2; R('#6b4a2a', -14, -1, 5, 1); R('#ff6a3a', -13, -3 - f, 3, 2); R('#ffd84a', -12, -4, 1, 1 + f);
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

  // ---------- Andra lagrets figurer (små, några rektanglar var). Basen är fötterna. ----------
  const GARDEN = [[-6, 0], [0, -3], [6, 1], [-3, 4], [4, 5], [-9, 4], [9, -2], [1, 8]];
  function puddle(p) { at(p.x, p.y); R('#2a4a80', -12, -3, 24, 5); R('#2a4a80', -9, -4, 18, 7); R('#4a7ac0', -10, -3, 20, 4); R('#8ab8f0', -6, -3, 4, 1); }
  // Page: den lilla boken med ben. flip = håller kartan upp och ner, map = håller en karta över huvudet.
  function page(x, y, t, o = {}) {
    at(x, y - (o.hop || 0)); const s = ((t * 6) | 0) % 2;
    R(O, -3, -2, 2, 2 + s); R(O, 1, -2, 2, 3 - s);
    R(O, -6, -11, 12, 10); R('#2f8f8a', -5, -10, 10, 8); R('#f4e3b0', -4, -10, 4, 7); R('#f4e3b0', 1, -10, 4, 7); R('#2f8f8a', 0, -10, 1, 8);
    R(O, -3, -8, 1, 2); R(O, 2, -8, 1, 2); R('#ff9ab0', -4, -6, 1, 1); R('#ff9ab0', 4, -6, 1, 1); R(RED, 3, -13, 1, 3);
    if (o.map) {
      at(x, y - (o.hop || 0)); const up = !!o.flip;
      R(O, -9, -22, 18, 11); R('#f4e3b0', -8, -21, 16, 9); R('#c9a870', -8, up ? -21 : -13, 16, 1); R('#3f9444', -6, -19, 4, 3); R('#4a7ac0', 2, -17, 4, 3);
      R(RED, up ? 4 : -4, up ? -14 : -19, 2, 2); R(O, -1, -12, 2, 2);
    }
  }
  // En stjärnsnappare: liten lila figur med gula ögon. sack = bär säcken på ryggen.
  function snatcher(x, y, t, sack) {
    at(x, y); const s = ((t * 10) | 0) % 2;
    R(O, -4, -2, 3, 2 + s); R(O, 1, -2, 3, 3 - s);
    R(O, -5, -11, 10, 10); R(O, -5, -14, 2, 3); R(O, 3, -14, 2, 3); R('#8a6ad0', -4, -10, 8, 8); R('#b09ae8', -4, -10, 8, 2); R('#8a6ad0', -4, -13, 1, 2); R('#8a6ad0', 4, -13, 1, 2);
    R('#ffffff', -3, -8, 3, 3); R('#ffffff', 1, -8, 3, 3); R(O, -2, -7, 1, 2); R(O, 2, -7, 1, 2); R(O, -1, -4, 3, 1);
    if (sack) { R(O, 3, -15, 9, 9); R('#8a5a34', 4, -14, 7, 7); R('#b07a48', 4, -14, 3, 2); R(GOLD, 6, -15, 3, 1); }
  }
  // Sergeant Clunk: en plåtsoldat med röd plym. dig = spaden i luften.
  function clunk(x, y, t, dig) {
    at(x, y); const s = ((t * 6) | 0) % 2;
    R(O, -3, -3, 2, 3); R(O, 1, -3, 2, 3);
    R(O, -5, -12, 10, 10); R('#a8b0c8', -4, -11, 8, 8); R('#d8dce8', -4, -11, 8, 1); R(GOLD, -4, -7, 8, 1);
    R(O, -4, -18, 8, 7); R('#a8b0c8', -3, -17, 6, 5); R(O, -2, -15, 4, 1); R('#ffd84a', -2, -15, 1, 1); R('#ffd84a', 1, -15, 1, 1); R(RED, -1, -21, 3, 3);
    if (dig) { const a = dig > 0 ? s : 0; R('#6b4a2a', 5, -14 + a * 3, 1, 9); R('#c8c8d8', 4, -6 + a * 3, 3, 3); }
  }
  // Handelsbjörnen med en kamelpuckel som hatt.
  function bear(x, y, t, still) {
    at(x, y); const s = still ? 0 : ((t * 6) | 0) % 2;
    R(O, -5, -2, 3, 2 + s); R(O, 2, -2, 3, 2 - s + 1);
    R(O, -6, -12, 12, 11); R('#8a5a34', -5, -11, 10, 9); R('#c9965a', -3, -8, 6, 5);
    R(O, -5, -18, 10, 7); R('#8a5a34', -4, -17, 8, 5); R(O, -5, -19, 3, 2); R(O, 2, -19, 3, 2); R(O, -2, -15, 1, 1); R(O, 1, -15, 1, 1); R('#3a2010', -1, -14, 2, 1);
    R(O, -4, -23, 8, 5); R('#e8c080', -3, -22, 6, 4); R('#f4d8a0', -2, -22, 2, 1); R('#c9965a', -4, -19, 8, 1);
  }
  // Snörar ett "Z" i pixlar (s = storlek 1 eller 2).
  function zed(x, y, s, c) { at(x, y); R(c, 0, 0, 4 * s, s); R(c, 2 * s, s, s, s); R(c, s, 2 * s, s, s); R(c, 0, 3 * s, 4 * s, s); }
  function sparkle(x, y, c) { at(x, y); R(c || '#ffd84a', -1, 0, 3, 1); R(c || '#ffd84a', 0, -1, 1, 3); R('#ffffff', 0, 0, 1, 1); }

  // ---------- Andra lagret: livet på kartan (ingen händelse bokförs, inget ger eller tar något) ----------
  // Högst EN resande sak åt gången (djur, väder, vagn, båt, fyrverkeri, husdjuret, ögon i busken), aldrig under en stund
  // ur berättelsen. Därtill den slagna bossen som pysslar vid sin nod i värld 1 till 3. Tiderna kommer från K.happen.ambient.
  let HERO = {}, BLOOM = {}, AMBK = { first: 8, pause: [18, 40], dur: [7, 11] }, onOpen = null, ready = false;
  const POKE = {}, POP = {}, floats = [], textCache = new Map(), built = new Set();
  const pokeKey = (key) => view.world + ':' + key;
  const poked = (key, t) => POKE[pokeKey(key)] != null && t - POKE[pokeKey(key)] < 1.2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const land = (m, x, y) => x > 2 && y > 2 && x < m.W - 2 && y < m.H - 2 && !!m.ter.mask[(y | 0) * m.W + (x | 0)];
  function say(text, x, y, t) { floats.push({ text, x, y, t0: t }); if (floats.length > 3) floats.shift(); }
  function drawFloats(t) {
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i], a = (t - f.t0) / 1.8; if (a >= 1) { floats.splice(i, 1); continue; }
      let tc = textCache.get(f.text); if (!tc) { tc = window.PX.text(f.text, '#fff6e0', '#1b1630'); textCache.set(f.text, tc); }
      A.img(tc, f.x - (tc.width >> 1), f.y - 26 - a * 10);
    }
  }
  const bossDone = (k) => { const w = A.worlds[k], d = A.state.done[w.id] || []; return !!d[w.nodes.length - 1]; };
  // Synligt område i kartans koordinater, utan rubriken överst och knappraden nederst.
  const viewBox = () => { const { vw, vh } = A.size(); return { x0: view.cam.x + 12, y0: view.cam.y + 40, x1: view.cam.x + vw - 12, y1: view.cam.y + vh - 44 }; };
  // En rak sträcka på land genom bilden, för djur och husdjur. null om ingen hittas.
  function landRun(m, len) {
    const b = viewBox();
    for (let n = 0; n < 14; n++) {
      const x = rnd(b.x0, b.x1), y = rnd(b.y0 + 20, b.y1), d = Math.random() < 0.5 ? -1 : 1, x2 = x + d * len;
      let ok = true; for (let s = 0; s <= 1 && ok; s += 0.1) ok = land(m, x + (x2 - x) * s, y) && land(m, x + (x2 - x) * s, y - 4);
      if (ok) return { x, y, x2 };
    }
    return null;
  }
  // Vattenfläckar där en båt får plats, långt från stigen (räknas en gång per värld).
  function water(m) {
    if (m._water) return m._water;
    const out = [], path = []; for (const seg of m.segs) for (let j = 0; j < seg.length; j += 4) path.push(seg[j]);
    for (let y = 60; y < m.H - 50; y += 9) for (let x = 24; x < m.W - 24; x += 9) {
      let ok = true; for (let dx = -12; dx <= 12 && ok; dx += 4) for (let dy = -6; dy <= 4 && ok; dy += 5) if (m.ter.mask[(y + dy) * m.W + x + dx]) ok = false;
      if (ok && path.every((p) => Math.hypot(p.x - x, p.y - y) > 16)) out.push({ x, y });
    }
    return (m._water = out);
  }
  const inView = (p, pad = 0) => { const b = viewBox(); return p.x > b.x0 + pad && p.x < b.x1 - pad && p.y > b.y0 + pad && p.y < b.y1 - pad; };
  const CRIT = { forest: ['rabbit', 'Hop hop!'], desert: ['lizard', 'Zip!'], swamp: ['frog', 'Ribbit!'], ice: ['penguin', 'Wheee!'], volcano: ['newt', 'Hot, hot!'], sky: ['bird', 'Tweet!'] };
  const SKYK = { forest: 'rain', swamp: 'rain', sky: 'rain', desert: 'dust', ice: 'snow', volcano: 'ash' };
  // Ett nytt litet liv. kinds = det som går i den här världen just nu, med vikter. Samma sak två gånger i rad undviks.
  function spawn(t) {
    const k = view.world, w = A.worlds[k], m = A.getWorld(k), opts = [['critter', 3], ['weather', 2], ['cart', 1.4], ['peek', 1.6]];
    if (water(m).some((p) => inView(p, 10))) opts.push(['boat', 1.6]);
    if (bossDone(k)) opts.push(['fireworks', 2.2]);
    if (HERO.pet) opts.push(['pet', 2]);
    const pool = opts.filter((o) => o[0] !== amb.last), sum = pool.reduce((a, o) => a + o[1], 0);
    let r = Math.random() * sum, kind = pool[0][0]; for (const o of pool) { if ((r -= o[1]) <= 0) { kind = o[0]; break; } }
    return make(kind, t, k, m, w);
  }
  function make(kind, t, k, m, w) {
    const dur = rnd(AMBK.dur[0], AMBK.dur[1]), a = { kind, t0: t, dur, k }, b = viewBox();
    if (kind === 'critter') { const r = landRun(m, rnd(50, 90)); if (!r) return null; Object.assign(a, r, { who: CRIT[w.biome] || CRIT.forest }); }
    else if (kind === 'weather') Object.assign(a, { x: b.x0 - 20, x2: b.x1 + 20, y: rnd(b.y0 + 10, b.y0 + (b.y1 - b.y0) * 0.45), sky: SKYK[w.biome] || 'rain', dur: dur + 4 });
    else if (kind === 'cart') {
      const segs = m.segs.map((s, i) => [s, i]).filter(([s]) => inView(s[s.length >> 1], 0)); if (!segs.length) return null;
      Object.assign(a, { seg: segs[(Math.random() * segs.length) | 0][0], back: Math.random() < 0.5 });
    }
    else if (kind === 'boat') { const ws = water(m).filter((p) => inView(p, 10)); if (!ws.length) return null; Object.assign(a, ws[(Math.random() * ws.length) | 0]); }
    else if (kind === 'fireworks') { const bp = m.pts[m.pts.length - 1]; Object.assign(a, { x: inView(bp) ? bp.x : (b.x0 + b.x1) / 2, y: Math.max(b.y0 + 24, (inView(bp) ? bp.y : b.y0 + 70) - 40), bursts: [0.3, 1.5, 2.6, 4, 5.2].map((s, i) => ({ s, dx: rnd(-26, 26), dy: rnd(-12, 10), c: ['#ffd84a', '#ff7ab0', '#7ad0ff', '#8dff9a', '#ffffff'][(i + k) % 5] })) }); }
    else if (kind === 'pet') { if (!HERO.pet) return null; const h = A.heroPos(), side = Math.random() < 0.5 ? -1 : 1; Object.assign(a, { x: side < 0 ? b.x0 - 10 : b.x1 + 10, side }); if (!land(m, h.x + side * 14, h.y)) a.side = -side; }
    else if (kind === 'peek') { const p = spot(k, 'bush'); if (!inView(p)) return null; Object.assign(a, { x: p.x, y: p.y, dur: dur * 0.7 }); }
    return a;
  }
  // Var den resande saken är just nu (för tryck). e = sekunder sedan start.
  function ambPos(a, e) {
    const u = Math.min(1, e / a.dur);
    if (a.kind === 'critter') { const hop = a.who[0] === 'penguin' || a.who[0] === 'newt' || a.who[0] === 'lizard' ? 0 : Math.abs(Math.sin(e * 6)) * 4; return { x: lerp(a.x, a.x2, u), y: a.y - hop - (a.jump && e - a.jump < 0.5 ? Math.sin((e - a.jump) * 6.28) * 8 : 0) }; }
    if (a.kind === 'weather') return { x: lerp(a.x, a.x2, u), y: a.y };
    if (a.kind === 'cart') { const s = a.seg, f = (a.back ? 1 - u : u) * (s.length - 1), i = Math.min(s.length - 2, f | 0), v = f - i; return { x: s[i].x + (s[i + 1].x - s[i].x) * v, y: s[i].y + (s[i + 1].y - s[i].y) * v }; }
    if (a.kind === 'boat') return { x: a.x + Math.sin(e * 0.6) * 6, y: a.y };
    if (a.kind === 'pet') { const h = A.heroPos(), inn = ease(e / 1.6), out = ease((e - (a.dur - 1.6)) / 1.6), ang = e * 2; const sx = h.x + a.side * 14 + Math.cos(ang) * 4, sy = h.y + 2 + Math.sin(ang) * 2; return { x: e < a.dur - 1.6 ? lerp(a.x, sx, inn) : lerp(sx, a.x, out), y: sy }; }
    return { x: a.x, y: a.y };
  }
  const AMBDRAW = {
    critter(a, e, t) {
      const { x, y } = ambPos(a, e), d = a.x2 > a.x ? 1 : -1, s = ((t * 8) | 0) % 2; at(x, y);
      const k = a.who[0];
      if (k === 'rabbit') { R(O, -4, -6, 8, 6); R('#e8e0d8', -3, -5, 6, 4); R(O, d > 0 ? 1 : -3, -10, 2, 5); R('#e8e0d8', d > 0 ? 2 : -2, -9, 1, 3); R(O, d > 0 ? 3 : -4, -4, 1, 1); R('#ffffff', d > 0 ? -5 : 3, -4, 2, 2); }
      else if (k === 'lizard') { R(O, -6, -3, 12, 3); R('#5ab04a', -5, -2, 10, 1); R('#5ab04a', d * 6 - (d > 0 ? 0 : 2), -3, 3, 2); R(O, -2 + s, 0, 1, 1); R(O, 2 - s, 0, 1, 1); R('#5ab04a', d > 0 ? -9 : 6, -2, 4, 1); }
      else if (k === 'frog') { R(O, -4, -5, 8, 5); R('#5ab04a', -3, -4, 6, 3); R(O, -3, -7, 2, 2); R(O, 1, -7, 2, 2); R('#ffffff', -3, -7, 1, 1); R('#ffffff', 2, -7, 1, 1); R('#8ad070', -2, -2, 4, 1); }
      else if (k === 'penguin') { R(O, -3, -9, 6, 9); R('#2a2a3a', -2, -8, 4, 7); R('#ffffff', -1, -7, 2, 5); R('#ff8a2a', d > 0 ? 2 : -3, -7, 2, 1); R('#ff8a2a', -2, 0, 4, 1); }
      else if (k === 'newt') { R(O, -6, -3, 12, 3); R('#ff7a3a', -5, -2, 10, 1); R('#ffd84a', -3, -2, 1, 1); R('#ffd84a', 1, -2, 1, 1); R('#ff7a3a', d > 0 ? 5 : -7, -3, 3, 2); R('#ff7a3a', d > 0 ? -9 : 6, -2, 4, 1); }
      else { const f = ((t * 10) | 0) % 2; R(O, -3, -4, 6, 4); R('#ffffff', -2, -3, 4, 2); R('#ffffff', -6, -4 - f * 2, 4, 1); R('#ffffff', 2, -4 - f * 2, 4, 1); R('#ffd84a', d > 0 ? 3 : -4, -3, 1, 1); }
    },
    weather(a, e, t) {
      const { x, y } = ambPos(a, e), in_ = Math.min(1, e / 1, (a.dur - e) / 1);
      ctx.globalAlpha = Math.max(0, in_) * 0.85;
      if (a.sky === 'dust') {
        for (let i = 0; i < 9; i++) { const r = 2 + i * 0.9, ang = t * 9 + i; at(x + Math.cos(ang) * r, y + 30 - i * 3); R('#f4d8a0', -1, -1, 2 + (i >> 2), 2); }
      } else {
        const c = a.sky === 'ash' ? '#84768a' : a.sky === 'snow' ? '#e8f0f8' : '#c3d0de', d = a.sky === 'ash' ? '#5c4c5a' : a.sky === 'snow' ? '#b8c8e0' : '#8a9ab0';
        at(x, y); R(d, -14, -2, 28, 6); R(c, -12, -6, 24, 7); R(c, -6, -9, 12, 4); R('#ffffff', -8, -6, 6, 1);
        const drop = a.sky === 'snow' ? '#ffffff' : a.sky === 'ash' ? '#aca0b0' : '#8ab8f0';
        for (let i = 0; i < 8; i++) { const ph = (t * (a.sky === 'rain' ? 1.6 : 0.6) + i * 0.37) % 1; at(x - 11 + i * 3 + (a.sky === 'rain' ? 0 : Math.sin(t * 2 + i) * 2), y + 5 + ph * 26); R(drop, 0, 0, 1, a.sky === 'rain' ? 2 : 1); }
        if (a.rainbow && e - a.rainbow < 2.5) { const RB = ['#ff5a6a', '#ffd84a', '#8dff9a', '#7ad0ff', '#b28aff']; RB.forEach((col, i) => { ctx.fillStyle = col; for (let q = 0; q <= 16; q++) { const an = Math.PI * q / 16; A.rect(x + Math.cos(an) * (22 - i), y + 22 - Math.sin(an) * (14 - i), 2, 1); } }); }
      }
      ctx.globalAlpha = 1;
    },
    cart(a, e, t) {
      const { x, y } = ambPos(a, e), s = ((t * 6) | 0) % 2, d = a.back ? -1 : 1, wave = a.wave && e - a.wave < 1.2;
      bear(x - d * 9, y, t, false); if (wave) { at(x - d * 9, y); R('#8a5a34', 5, -16 - s * 2, 2, 4); }
      at(x + d * 4, y); R(O, -7, -9, 14, 7); R('#b07a48', -6, -8, 12, 5); R('#e8433b', -5, -12, 4, 4); R('#ffd84a', -1, -11, 3, 3); R('#5ab04a', 2, -12, 4, 4);
      R(O, -5, -3, 4, 4); R(O, 2, -3, 4, 4); R('#c9965a', -4 + s, -2, 1, 1); R('#c9965a', 3 + s, -2, 1, 1);
    },
    boat(a, e, t) {
      const { x, y } = ambPos(a, e), b = ((t * 1.5) | 0) % 2; at(x, y + b);
      R(O, -9, -4, 18, 5); R('#9a6b3f', -8, -3, 16, 3); R('#c9965a', -8, -3, 16, 1); R(O, -5, -11, 5, 7); R('#3a8ee6', -4, -10, 3, 5); R('#f3c7a2', -4, -12, 3, 2);
      R('#6b4a2a', -1, -15, 1, 12); ctx.fillStyle = '#e8e0d8'; for (let q = 0; q < 10; q++) A.rect(x + q, y + b - 15 + q * q * 0.12, 1, 1);
      if (a.fish && e - a.fish < 1.2) { const f = (e - a.fish) / 1.2; at(x + 10 + f * 6, y - Math.sin(f * 3.14) * 14); R(O, -3, -2, 7, 4); R('#7ad0ff', -2, -1, 5, 2); R('#7ad0ff', 3, -2, 2, 4); }
      ctx.globalAlpha = 0.5; at(x, y + 2); R('#ffffff', -11 + ((t * 3) | 0) % 3, 0, 4, 1); R('#ffffff', 8 - ((t * 3) | 0) % 3, 0, 4, 1); ctx.globalAlpha = 1;
    },
    fireworks(a, e, t) {
      for (const bu of a.bursts) {
        const u = e - bu.s; if (u < 0 || u > 1.6) continue;
        const cx = a.x + bu.dx, cy = a.y + bu.dy;
        if (u < 0.5) { at(cx, cy + (0.5 - u) * 40); R('#fff6c8', 0, 0, 1, 2); continue; }
        const r = 4 + (u - 0.5) * 30, fall = (u - 0.5) * (u - 0.5) * 10; ctx.globalAlpha = u > 1.2 ? 0.5 : 1;
        for (let i = 0; i < 12; i++) { const an = i * 0.5236, ox = Math.cos(an), oy = Math.sin(an) * 0.8; at(cx + ox * r, cy + oy * r + fall); R(bu.c, -1, -1, 2, 2); R('#ffffff', 0, 0, 1, 1); at(cx + ox * r * 0.7, cy + oy * r * 0.7 + fall); R(bu.c, 0, 0, 1, 1); }
        ctx.globalAlpha = 1;
      }
    },
    pet(a, e, t) {
      if (!HERO.pet) { a.dur = 0; return; }      // husdjuret togs av medan det var på besök
      const { x, y } = ambPos(a, e), cv = HERO.pet[((t * 3) | 0) % HERO.pet.length]; A.img(cv, x, y);
      if (a.love && e - a.love < 1.4) { const u = (e - a.love) / 1.4; for (let i = 0; i < 3; i++) { at(x - 6 + i * 6, y - 14 - u * 12 - i * 2); R('#ff5a7a', 0, 0, 2, 1); R('#ff5a7a', 3, 0, 2, 1); R('#ff5a7a', 0, 1, 5, 1); R('#ff5a7a', 1, 2, 3, 1); R('#ff5a7a', 2, 3, 1, 1); } }
    },
    peek(a, e, t) {
      const hid = a.hid != null, u = hid ? Math.max(0, 1 - (e - a.hid) * 5) : Math.min(1, e / 0.8, Math.max(0, (a.dur - e) / 0.6)), up = Math.round(u * 6), blink = (e % 2.2) < 0.15;
      at(a.x, a.y); const hue = PEEKC[A.worlds[view.world].biome] || '#5ab04a';
      if (up > 0) { R(O, -4, -8 - up, 8, 6); R(hue, -3, -7 - up, 6, 5); if (!blink) { R('#ffffff', -2, -6 - up, 2, 2); R('#ffffff', 1, -6 - up, 2, 2); R(O, -1, -5 - up, 1, 1); R(O, 2, -5 - up, 1, 1); } }
    },
  };
  const PEEKC = { forest: '#d8433b', desert: '#8a6ad0', swamp: '#e0aa3c', ice: '#8a6ad0', volcano: '#ffd84a', sky: '#8a6ad0' };      // en färg som syns mot världens mark
  // Busken där fienderna tittar fram (finns i alla världar, i världens färger).
  const BUSH = { forest: ['#2c7440', '#3f9444'], desert: ['#6b8a3a', '#8aa84a'], swamp: ['#3a5a3a', '#5a7a4a'], ice: ['#b8c8e0', '#e8f0f8'], volcano: ['#3a3040', '#5a4a5a'], sky: ['#c8d8f0', '#ffffff'] };
  function bush(p, t, shake) { const c = BUSH[A.worlds[view.world].biome] || BUSH.forest, j = shake ? Math.round(Math.sin(t * 30)) : 0; at(p.x + j, p.y); R(O, -8, -9, 16, 10); R(O, -5, -11, 10, 2); R(c[0], -7, -8, 14, 8); R(c[0], -4, -10, 8, 2); R(c[1], -5, -9, 6, 3); R(c[1], 2, -6, 3, 2); }
  // Den slagna bossen pysslar vid sin nod: trollet sopar, sfinxen sover, häxan rör i grytan.
  const CHORE = [['What was I doing?', 'troll'], ['Hm. Lucky.', 'sphinx'], ['Bubble, bubble!', 'witch']];
  function chores(p, t, k) {
    at(p.x, p.y); const s = ((t * 3) | 0) % 2, pk = poked('chores', t);
    if (k === 0) {
      R(O, -6, -15, 12, 15); R(O, -8, -12, 2, 3); R(O, 6, -12, 2, 3); R('#6a9a5a', -5, -14, 10, 13); R('#8aba7a', -3, -7, 6, 5); R('#3a5a30', -2, -17, 4, 2);
      R('#ffffff', -3, -12, 2, 2); R('#ffffff', 1, -12, 2, 2); R(O, -2, -11, 1, 1); R(O, 2, -11, 1, 1); R('#4a7a3a', -1, -10, 2, 3); R(O, -2, -6, 4, 1); R('#ffffff', 1, -7, 1, 1);
      R('#9a6b3f', -9 - s, -12, 1, 12); R(O, -12 - s * 2, -1, 7, 3); R('#e0c060', -11 - s * 2, 0, 5, 1); if (s) R('#d8d0b0', -15, -2, 2, 1);
      if (pk) { at(p.x, p.y); R('#ffffff', 4, -24, 2, 4); R('#ffffff', 3, -25, 4, 1); R('#ffffff', 4, -19, 2, 2); }
    } else if (k === 1) {
      R(O, -9, -7, 18, 7); R('#e0aa3c', -8, -6, 16, 6); R(O, 4, -14, 7, 8); R('#e0aa3c', 5, -13, 5, 7); R('#3a8ee6', 4, -14, 7, 2); R(O, 6, -10, 3, 1);
      if (!pk) zed(p.x + 9, p.y - 22 - (((t * 1.2) | 0) % 3) * 2, 1, '#ffffff'); else { at(p.x, p.y); R(O, 6, -11, 1, 1); R(O, 8, -11, 1, 1); }
    } else {
      R(O, -8, -5, 9, 6); R('#3a3450', -7, -4, 7, 4); ctx.fillStyle = '#8dff9a'; A.rect(p.x - 6, p.y - 6 + s, 5, 1);
      at(p.x + 6, p.y); R(O, -3, -14, 6, 14); R('#6a4a9a', -2, -13, 4, 12); R('#a0d080', -2, -16, 4, 3); R(O, -4, -18, 8, 2); R('#3a2a5a', -2, -22, 4, 4); R('#6b4a2a', -5 + s, -12, 1, 8);
      for (let i = 0; i < 2; i++) { const ph = (t * 0.8 + i * 0.5) % 1; at(p.x - 4 + i * 2, p.y - 8 - ph * 10); R('#c8f0a0', 0, 0, 2, 2); }
    }
  }
  const amb = { cur: null, next: null, last: null, world: -1 };
  function ambTick(t, layer) {
    if (!ready || view.mode !== 'world') { amb.cur = null; amb.world = -1; return; }
    if (amb.world !== view.world) { amb.world = view.world; amb.cur = null; amb.next = t + AMBK.first; }
    if (cur) { if (amb.cur) amb.next = t + AMBK.pause[0]; amb.cur = null; return; }      // en stund pågår: inget annat rör sig
    if (layer === 'ground') {
      if (!amb.cur && t >= amb.next) { amb.cur = spawn(t); if (amb.cur) amb.last = amb.cur.kind; else amb.next = t + 4; }
      if (amb.cur && t - amb.cur.t0 >= amb.cur.dur) { amb.cur = null; amb.next = t + rnd(AMBK.pause[0], AMBK.pause[1]); }
    }
    const a = amb.cur; if (!a || a.kind === 'peek') return;      // ögonen i busken ritas av ground(), bakom busken
    const sky = a.kind === 'weather' || a.kind === 'fireworks';
    if ((layer === 'sky') === sky) AMBDRAW[a.kind](a, t - a.t0, t);
  }

  // ---------- Stunderna. t = sekunder sedan stunden började. Koordinaterna är kartans (skärmens läge plus kameran). ----------
  const scr = (sx, sy) => [sx + view.cam.x, sy + view.cam.y];
  const lerp = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u)), ease = (u) => { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); };
  const watchPos = (t) => { const h = A.heroPos(); return [h.x + 24, h.y - 22 + Math.round(Math.sin(t * 1.4) * 2)]; };
  const SC = {
    // ----- Andra lagrets händelser (BEATS i game/story.js) -----
    // Page kommer fram till hjälten med kartan upp och ner, tittar, och vänder på den.
    pageMap(t, c) {
      const h = A.heroPos(), x = lerp(h.x + 60, h.x + 16, ease(t / 1.6)), flip = t < 3.2, hop = t > 3.2 && t < 3.6 ? 3 : 0;
      page(x, h.y, t < 1.6 ? t : 0, { map: true, flip, hop });
      if (t > 2.2 && t < 3.2) { at(x + 9, h.y - 30); R('#ffffff', 0, 0, 2, 4); R('#ffffff', 0, 5, 2, 2); }
      if (t > 3.6) sparkle(x - 10, h.y - 26 - ((t * 4) | 0) % 3, '#fff3a8');
    },
    // Tre stjärnsnappare springer genom bilden. Den sista tappar sin säck, som hoppar till och blir liggande.
    snatchers(t, c) {
      const p = spot(view.world, 'sack'), { vw } = A.size(), [rx] = scr(vw + 16, 0), [lx] = scr(-16, 0);
      for (let i = 0; i < 3; i++) {
        const u = (t - i * 0.45) / 4.6; if (u <= 0 || u >= 1) continue;
        snatcher(lerp(rx, lx, u), p.y + (i - 1) * 3 - Math.abs(Math.sin(t * 9 + i)) * 2, t + i, i === 2 && lerp(rx, lx, u) > p.x);
      }
      const ud = (t - 0.9) / 4.6;
      if (lerp(rx, lx, ud) <= p.x) { const b = Math.max(0, 0.6 - (t - (0.9 + 4.6 * (rx - p.x) / (rx - lx)))) * 10; at(p.x, p.y - Math.round(Math.abs(Math.sin(b)) * b)); DRAW.sack({ x: p.x, y: p.y - Math.round(Math.abs(Math.sin(b)) * b) }, t); }
    },
    // Gnistor flyger från hjälten till den släckta lyktan, som tänds.
    lantern(t, c) {
      const h = A.heroPos(), p = spot(view.world, 'lanternDark');
      if (t < 2.4) { for (let i = 0; i < 6; i++) { const u = Math.max(0, Math.min(1, t / 2.2 - i * 0.06)); sparkle(lerp(h.x, p.x, u), lerp(h.y - 14, p.y - 18, u) - Math.sin(u * 3.14) * 16); } }
      else { DRAW.lantern(p, t); if (t < 3.4) for (let i = 0; i < 8; i++) { const a = i * 0.785, r = (t - 2.4) * 18; sparkle(p.x + Math.cos(a) * r, p.y - 18 + Math.sin(a) * r * 0.7); } }
    },
    // En lysande sida flyger in och fastnar i Page, som hoppar av glädje.
    pageNew(t, c) {
      const h = A.heroPos(), px = h.x + 16, py = h.y, u = ease(t / 2.4), [sx, sy] = scr(A.size().vw - 10, 20);
      page(px, py, t, { hop: t > 2.4 && t < 4.4 ? Math.round(Math.abs(Math.sin(t * 7)) * 4) : 0 });
      if (t < 2.4) { const x = lerp(sx, px, u), y = lerp(sy, py - 10, u) + Math.sin(t * 6) * 3; at(x, y); R(O, -3, -4, 7, 9); R('#fff6c8', -2, -3, 5, 7); R('#c9a870', -1, -1, 3, 1); R('#c9a870', -1, 1, 3, 1); sparkle(x + 5, y - 5); }
      else if (t < 3.6) for (let i = 0; i < 6; i++) { const a = i * 1.047 + t, r = (t - 2.4) * 14; sparkle(px + Math.cos(a) * r, py - 8 + Math.sin(a) * r * 0.7); }
    },
    // Clunk gräver (sanden yr), drar upp en sko, kliar sig i huvudet och marscherar iväg.
    dig(t, c) {
      const p = spot(view.world, 'hole'), { vw } = A.size(), [rx] = scr(vw + 16, 0);
      if (t < 1.4) { clunk(lerp(rx, p.x - 8, ease(t / 1.4)), p.y, t, 0); return; }
      if (t < 4.2) {
        at(p.x, p.y); R('#e8c080', -9, -2, 18, 4); R('#2a1d10', -6, -2, 12, 3);
        clunk(p.x - 8, p.y, t, 1);
        for (let i = 0; i < 5; i++) { const a = ((t * 2.5 + i / 5) % 1); at(p.x + 2 + a * 14 * (i % 2 ? 1 : -0.4), p.y - 4 - Math.sin(a * 3.14) * 12); R('#f4d8a0', 0, 0, 2, 2); }
        return;
      }
      DRAW.hole(p);
      const sh = t < 5 ? (t - 4.2) / 0.8 : 1; at(p.x + 11, p.y - Math.round(Math.sin(sh * 3.14) * 14));
      if (t < 6) { clunk(p.x - 8, p.y, 0, 0); if (t > 5) { at(p.x - 6, p.y - 26); R('#ffffff', 0, 0, 2, 4); R('#ffffff', -1, -1, 4, 1); R('#ffffff', 1, 5, 1, 1); } }
      else clunk(lerp(p.x - 8, rx, ease((t - 6) / 2)), p.y, t, 0);
    },
    // Björnen i kamelhatt går förbi, stannar och tittar på oss, och går vidare.
    camel(t, c) {
      const h = A.heroPos(), { vw } = A.size(), [lx] = scr(-16, 0), [rx] = scr(vw + 16, 0), mid = h.x + 30, y = h.y + 14;
      const x = t < 2.5 ? lerp(lx, mid, ease(t / 2.5)) : t < 4.6 ? mid : lerp(mid, rx, ease((t - 4.6) / 2.2));
      bear(x, y, t, t >= 2.5 && t < 4.6);
    },
    // Luftskeppet glider förbi och tappar en låda, som studsar ner på marken.
    crate(t, c) {
      const p = spot(view.world, 'crate'), { vw } = A.size(), [sx] = scr(vw + 34, 0), [ex] = scr(-34, 0), ay = p.y - 60, u = t / c.dur;
      const x = lerp(sx, ex, u), drop = (sx - p.x) / (sx - ex) * c.dur;
      if (t > drop) { const f = Math.min(1, (t - drop) / 0.7), y = lerp(ay + 6, p.y, f * f), b = f >= 1 ? Math.max(0, 0.4 - (t - drop - 0.7)) * 12 : 0; DRAW.crate({ x: p.x, y: y - Math.round(Math.abs(Math.sin(b * 2)) * b) }, 0); if (f >= 1 && t - drop < 1.3) { at(p.x, p.y); R('#f4d8a0', -12, -2, 4, 2); R('#f4d8a0', 9, -2, 4, 2); } }
      airship(x, ay, t);
    },
    // Stora Z stiger ur jättens fotspår, och marken skakar lite.
    snore(t, c) {
      const p = spot(view.world, 'tracks');
      for (let i = 0; i < 4; i++) { const a = ((t * 0.5 + i / 4) % 1), sz = a < 0.4 ? 1 : 2; zed(p.x - 4 + Math.sin(a * 6 + i) * 6 + a * 10, p.y - 10 - a * 34, sz, a < 0.75 ? '#ffffff' : '#c3d0de'); }
    },
    // Plankor flyger från hjälten och lägger sig på den trasiga bron.
    bridge(t, c) {
      const h = A.heroPos(), p = spot(view.world, 'bridgeOld');
      if (t < 2.8) { DRAW.bridgeOld(p); for (let i = 0; i < 6; i++) { const u = Math.max(0, Math.min(1, t / 2.4 - i * 0.07)); at(lerp(h.x, p.x - 8 + i * 3, u), lerp(h.y - 12, p.y - 2, u) - Math.sin(u * 3.14) * 18); R('#c9965a', 0, 0, 2, 2); } }
      else { DRAW.bridge(p); if (t < 3.8) for (let i = 0; i < 6; i++) sparkle(p.x - 9 + i * 4, p.y - 6 - (t - 2.8) * 10); }
    },
    // En stjärnbit far över himlen och försvinner långt bort, med en glimt vid kanten.
    starFall(t, c) {
      const { vw, vh } = A.size(), [sx, sy] = scr(vw * 0.92, vh * 0.2), [ex, ey] = scr(vw * 0.04, vh * 0.42), u = Math.min(1, t / 3.2), x = lerp(sx, ex, u), y = lerp(sy, ey, u);
      if (u < 1) {
        for (let i = 12; i >= 1; i--) { const v = Math.max(0, u - i * 0.012); ctx.globalAlpha = 1 - i / 13; at(lerp(sx, ex, v), lerp(sy, ey, v)); R(i < 4 ? '#ffffff' : '#ffd84a', -1, -1, 3, 3); }
        ctx.globalAlpha = 0.35; at(x, y); R('#fff3a8', -6, -6, 13, 13); ctx.globalAlpha = 1;
        at(x, y); R(O, -4, -4, 9, 9); R('#ffd84a', -3, -3, 7, 7); R('#ffd84a', -5, 0, 11, 1); R('#ffd84a', 0, -5, 1, 11); R('#ffffff', -1, -1, 3, 3);
      }
      else if (t < 4.6) { const k = ((t * 6) | 0) % 2; at(ex, ey); R('#ffd84a', -2 - k * 2, 0, 5 + k * 4, 1); R('#ffd84a', 0, -2 - k * 2, 1, 5 + k * 4); R('#ffffff', -1, -1, 3, 3); }
    },
    // Snögubbens näsa ramlar av, hoppar runt och sätts tillbaka (på magen).
    snowman(t, c) {
      const p = spot(view.world, 'snowman');
      at(p.x, p.y); R(O, -6, -10, 12, 11); R('#ffffff', -5, -9, 10, 9); R(O, -4, -17, 8, 8); R('#ffffff', -3, -16, 6, 6); R(O, -2, -14, 1, 1); R(O, 1, -14, 1, 1); R(O, -4, -20, 8, 3); R('#3a3450', -3, -20, 6, 2); R(RED, -3, -18, 6, 1);
      R('#6b4a2a', -9, -9, 3, 1); R('#6b4a2a', 6, -9, 3, 1);
      if (t < 1.2) { at(p.x, p.y); R('#ff8a2a', 0, -13, 4, 1); }
      else if (t < 4.2) { const u = (t - 1.2) / 3, x = p.x + 4 + Math.sin(u * 9) * 6, y = p.y - Math.abs(Math.sin(u * 9.4)) * 8; at(x, y); R('#ff8a2a', 0, -1, 3, 1); if (t < 2.4) { at(p.x - 4, p.y - 25); R('#ffffff', 0, 0, 2, 4); R('#ffffff', 0, 5, 2, 2); } }
      else DRAW.snowman(p, t);
    },
    // Luftskeppet stannar, skakar och nyser: snö yr och skeppet åker baklänges ut ur bilden.
    achoo(t, c) {
      const { vw, vh } = A.size(), [sx, y0] = scr(vw + 34, vh * 0.3), [mx] = scr(vw * 0.55, 0);
      let x = t < 2 ? lerp(sx, mx, ease(t / 2)) : t < 3.4 ? mx + (t > 2.6 ? Math.round(Math.sin(t * 40)) : 0) : lerp(mx, sx + 20, ease((t - 3.4) / 1.6));
      airship(x, y0, t);
      if (t > 3.4 && t < 5.4) for (let i = 0; i < 10; i++) { const a = (t - 3.4) * 30 + i * 4; at(x - 20 - a + Math.sin(i) * 4, y0 - 14 + (i - 5) * 2 + Math.sin(a * 0.2 + i) * 3); R('#ffffff', 0, 0, 2, 2); }
    },
    // Tält dyker upp ett i taget, och en vakt tittar ut.
    camp(t, c) {
      const p = spot(view.world, 'camp');
      if (t < 1.2) { const s = ease(t / 1.2); at(p.x, p.y); R(RED, -Math.round(7 * s), -Math.round(10 * s), Math.round(14 * s), Math.round(10 * s)); }
      else DRAW.camp(p, t);
      if (t > 2 && t < 5.5) snatcher(p.x + 1, p.y, t, false);
    },
    // En borttappad sida singlar ner i sicksack till Page, som hoppar.
    lostPage(t, c) {
      const h = A.heroPos(), px = h.x + 16, u = Math.min(1, t / 3.4), [, top] = scr(0, 0), x = px + Math.sin(t * 2.4) * 18 * (1 - u), y = lerp(top + 20, h.y - 12, u);
      page(px, h.y, t, { hop: t > 3.4 && t < 5 ? Math.round(Math.abs(Math.sin(t * 7)) * 4) : 0 });
      if (u < 1) { at(x, y); const f = ((t * 4) | 0) % 2; R(O, -3, -4, 7 - f * 2, 9); R('#fff6c8', -2, -3, 5 - f * 2, 7); R('#c9a870', -1, -1, 3 - f, 1); }
      else if (t < 4.6) for (let i = 0; i < 6; i++) { const a = i * 1.047 + t, r = (t - 3.4) * 14; sparkle(px + Math.cos(a) * r, h.y - 8 + Math.sin(a) * r * 0.7); }
    },
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
  // Under en händelse ritar scenen själv det som den ändrar på marken.
  const SKIP = { peeperOff: ['tree', 'balloon'], snatchers: ['sack'], dig: ['hole'], crate: ['crate'], bridge: ['bridgeOld', 'bridge'], snowman: ['snowman'], camp: ['camp'], lantern: ['lantern'] };
  // Saker på marken som svarar på ett tryck, och vad de säger.
  const TAPS = { sack: 'Squeak!', crate: 'Hello?', statue: 'That is you!', heroFlag: 'Yay!', snowman: 'Hi!', lantern: 'So bright!', chest: null, chestOpen: null };
  function popRing(p, t, t0) { const u = (t - t0) / 1.6; for (let i = 0; i < 8; i++) { const a = i * 0.785 + u * 2, r = 6 + u * 14; sparkle(p.x + Math.cos(a) * r, p.y - 8 + Math.sin(a) * r * 0.7, i % 2 ? '#ffffff' : '#ffd84a'); } }
  const api = {
    // d: { decor: { världens id: [saker] }, watch } från spelets skal (decorAll() i game/story.js), och för andra lagret:
    //   keys (alla saker som kan stå i varje värld), bloom (blommor per värld), hero ({ color, statue, pet: [bilder] }),
    //   amb (K.happen.ambient), fresh ([[världens id, sak]] som nyss tillkommit: de dyker upp med ett glitter),
    //   onOpen(k) (barnet tryckte upp kistan i värld k; svarar med skämtet som ska stå över kistan).
    set(d) {
      decor = (d && d.decor) || {}; watch = !!(d && d.watch);
      if (d && d.keys) { const was = JSON.stringify(keys); keys = d.keys; if (was !== JSON.stringify(keys)) built.forEach((k) => { const m = A.getWorld(k); if (m._storyAll) { m._story = {}; m._storyAll = 0; } }); }
      BLOOM = (d && d.bloom) || {}; HERO = (d && d.hero) || {}; if (d && d.amb) AMBK = d.amb; onOpen = (d && d.onOpen) || null;
      for (const [w, kind] of (d && d.fresh) || []) POP[w + ':' + kind] = -1;
      ready = true;
    },
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
    state: () => ({ decor, watch, cur: cur ? cur.kind : null, amb: amb.cur ? amb.cur.kind : null, next: amb.next, bloom: BLOOM }),
    // Ett tryck på kartan som inte träffade någon nod (map.js frågar först noderna). true = något här svarade.
    tap(x, y) {
      if (!ready || view.mode !== 'world' || cur) return false;
      const t = A.now(), k = view.world, w = A.worlds[k], near = (p, r, dy = 6) => Math.hypot(x - p.x, y - (p.y - dy)) < r;
      const a = amb.cur;
      if (a) {
        const e = t - a.t0, p = ambPos(a, e);
        if (a.kind === 'fireworks' ? Math.hypot(x - a.x, y - a.y) < 46 : near(p, a.kind === 'weather' ? 18 : 13, a.kind === 'weather' ? 0 : 5)) {
          if (a.kind === 'critter') { a.jump = e; say(a.who[1], p.x, p.y, t); }
          else if (a.kind === 'weather') { if (a.sky === 'rain') { a.rainbow = e; say('Rainbow!', p.x, p.y + 20, t); } else if (a.sky === 'dust') { a.dur = e + 0.3; say('Poof!', p.x, p.y + 20, t); } else say(a.sky === 'snow' ? 'Brrr!' : 'Puff!', p.x, p.y + 20, t); }
          else if (a.kind === 'cart') { a.wave = e; say('Hello!', p.x, p.y, t); }
          else if (a.kind === 'boat') { a.fish = e; say('A fish!', p.x, p.y, t); }
          else if (a.kind === 'fireworks') { a.bursts.push({ s: e - 0.5, dx: x - a.x, dy: y - a.y, c: '#ffd84a' }); a.dur = Math.max(a.dur, e + 1.4); say('Hooray!', x, y + 10, t); }
          else if (a.kind === 'pet') a.love = e;
          else if (a.kind === 'peek' && a.hid == null) { a.hid = e; a.dur = e + 0.4; POKE[pokeKey('bush')] = t; say('Eek!', a.x, a.y, t); }
          return true;
        }
      }
      if (k < 3 && bossDone(k)) { const p = spot(k, 'chores'); if (near(p, 13)) { POKE[pokeKey('chores')] = t; say(CHORE[k][0], p.x, p.y, t); return true; } }
      for (const kind of decor[w.id] || []) {
        if (!(kind in TAPS)) continue;
        const p = spot(k, kind); if (!near(p, 13, kind === 'heroFlag' || kind === 'statue' ? 10 : 5)) continue;
        POKE[pokeKey(SPOT[kind] || kind)] = t;
        if (kind === 'chest') { const joke = onOpen ? onOpen(k) : null; if (joke) { say(joke, p.x, p.y, t); POP[w.id + ':chestOpen'] = t; } }
        else if (kind === 'chestOpen') say(['A sock! Just one sock.', 'A rubber duck! Quack.', 'A paper crown!'][k] || 'Empty!', p.x, p.y, t);
        else say(TAPS[kind], p.x, p.y, t);
        return true;
      }
      return false;
    },
    // Testkrok: tvingar fram ett litet liv nu (critter, weather, cart, boat, fireworks, pet, peek). true = det kom.
    happen(kind) {
      if (!ready || view.mode !== 'world' || cur) return false;
      const k = view.world, a = make(kind, A.now(), k, A.getWorld(k), A.worlds[k]); if (!a) return false;
      amb.world = k; amb.cur = a; amb.last = kind; return true;
    },
    amb: () => (amb.cur ? { kind: amb.cur.kind, pos: ambPos(amb.cur, A.now() - amb.cur.t0), left: amb.cur.dur - (A.now() - amb.cur.t0) } : null),
    // Ritas före noderna: det som ligger på marken.
    ground(t) {
      const k = view.world, w = A.worlds[k], list = decor[w.id] || [], skip = cur ? SKIP[cur.kind] || [] : [];
      for (const kind of list) {
        if (!DRAW[kind] || skip.includes(kind)) continue;
        const p = spot(k, kind); if (p.hide) continue; DRAW[kind](p, t);
        const pk = w.id + ':' + kind; if (POP[pk] === -1) POP[pk] = t;
        if (POP[pk] != null && t - POP[pk] < 1.6) popRing(p, t, POP[pk]);
      }
      if (!ready) return;
      if (k < 3 && bossDone(k) && !spot(k, 'chores').hide) chores(spot(k, 'chores'), t, k);
      const bp = spot(k, 'bush'), pe = amb.cur && amb.cur.kind === 'peek' && !cur;
      if (pe) AMBDRAW.peek(amb.cur, t - amb.cur.t0, t);
      if (!bp.hide) bush(bp, t, poked('bush', t));
      ambTick(t, 'ground');
    },
    // Ritas sist, över moln och hjälte: figurerna i luften och den pågående stunden.
    sky(t) {
      if (cur) {
        const e = A.now() - cur.t0;
        if (e >= cur.dur || (cur.poked != null && e > cur.poked + 0.75)) cur = null; else SC[cur.kind](e, cur);
      }
      if (watch && !(cur && (cur.kind === 'peeper' || cur.kind === 'peeperOff'))) { const [x, y] = watchPos(t); peeper(x, y, t, true); }
      if (ready && view.mode === 'world') { ambTick(t, 'sky'); drawFloats(t); }
    },
  };
  return api;
};
