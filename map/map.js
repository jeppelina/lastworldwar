// Världskartan: terränggenerering, ritning, kamera och interaktion.
// Två vyer: 'overview' (hela kontinenten) och 'world' (en världs stig med noder).
// All världsdata kommer från data.js, all biomkonst från biomes.js.
(function () {
  'use strict';
  const PX = window.PX, D = window.GAME_DATA, BIOMES = window.BIOMES;
  const cv = document.getElementById('map'), ctx = cv.getContext('2d');
  const $ = (s) => document.querySelector(s);
  const C = PX.buildCommon();
  // En minispelsnod har ett femte fält (mini: { game, level }) och en plats (slot) som belöningen bokförs på: nodindex för
  // noden i stigen, stoppets id för ett sidostopp (w.side). Sidostoppen tar ingen plats i nodlistan, se data.js.
  const mk = ([type, name, trains, gold, mini]) => ({ type, name, trains, gold, mini });
  const worlds = D.worlds.map((w) => Object.assign({}, w, {
    nodes: w.nodes.map((n, i) => { const nd = mk(n); if (nd.type === 'mini') nd.slot = i; return nd; }),
    side: (w.side || []).map((sd) => Object.assign(mk(sd.node), { slot: sd.id, after: sd.after }))
  }));
  const qs = new URLSearchParams(location.search);

  let S = 2, vw = 0, vh = 0;
  const now = () => performance.now() / 1000;

  // ---------- tillstånd ----------
  const state = { gold: 0, done: {} };
  // Det spelets skal räknar fram åt kartan (setInfo): hjältens nivå och per nod rekommenderad nivå (rec), belöningsfaktor (f),
  // banbonus, antal ord som inte är inlärda (left), och per värld bossens ordmätare (gate) och banan med flest ord kvar (best).
  // Kartan har inga egna regler. Utan skal (kartan öppnad för sig) är INFO null och inget av det ritas.
  let INFO = null;
  const nodeInf = (w, i) => (INFO && INFO.worlds[w.id] && INFO.worlds[w.id].nodes[i]) || null;
  const worldInf = (w) => (INFO && INFO.worlds[w.id]) || null;
  // Färgen på "Lv N": grön = hjälten är på banans nivå eller över, gul = en eller två nivåer under, röd = längre under,
  // grå = banan är så lätt att belöningen är nedsatt.
  const lvColor = (inf) => (inf.f < 1 ? '#b4b4cc' : INFO.level >= inf.rec ? '#8dff9a' : INFO.level >= inf.rec - 2 ? '#ffd84a' : '#ff7a6a');
  const isStar = (nd) => nd.type === 'level' || nd.type === 'boss';
  const DEMO_STARS = [3, 2, 3, 3, 1, 3, 2, 3, 3, 2, 3, 3];
  function resetState() {
    state.gold = D.start.gold;
    worlds.forEach((w) => {
      const c = D.start.cleared[w.id], k = c === 'all' ? w.nodes.length : c || 0;
      state.done[w.id] = w.nodes.map((nd, i) => (i < k ? (isStar(nd) ? DEMO_STARS[i % 12] : 1) : 0));
    });
  }
  const curNode = (w) => state.done[w.id].indexOf(0);
  // En minispelsnod i stigen spärrar aldrig: den räknas som passerad så fort barnet står vid den, spelad eller inte.
  // Spelets skal bokför samma sak med samma regel (passMinis i main.js).
  function passMinis(w) { let c; while ((c = curNode(w)) > 0 && w.nodes[c].type === 'mini') state.done[w.id][c] = 1; }
  const worldDone = (w) => curNode(w) < 0;
  const unlocked = (i) => i === 0 || worldDone(worlds[i - 1]);
  const curWorld = () => worlds.findIndex((w) => !worldDone(w));
  const starsOf = (w) => w.nodes.reduce((a, nd, i) => a + (isStar(nd) ? state.done[w.id][i] : 0), 0);
  const maxStars = (w) => w.nodes.filter(isStar).length * 3;

  // ---------- terräng ----------
  function prep(B) {
    if (B._c) return B._c;
    const r = PX.rgb;
    return (B._c = { liq: B.liq.map(r), foam: r(B.foam), glint: r(B.glint), under: r(B.under), shore: B.shore.map(r), ground: B.ground.map(r), high: B.high.map(r), cliff: B.cliff.map(r), path: B.path.map(r), edge: r(B.pathEdge), speck: B.speck.map(r) });
  }
  const poolCache = {};
  function pool(name, mini) { const k = name + (mini ? 'm' : ''); return poolCache[k] || (poolCache[k] = BIOMES[name].sprites(mini)); }
  function chamfer(mask, W, H, val) {
    const d = new Float32Array(W * H);
    for (let i = 0; i < W * H; i++) d[i] = mask[i] === val ? 0 : 1e3;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      let m = d[i]; if (!m) continue;
      if (x > 0) m = Math.min(m, d[i - 1] + 1);
      if (y > 0) { m = Math.min(m, d[i - W] + 1); if (x > 0) m = Math.min(m, d[i - W - 1] + 1.4); if (x < W - 1) m = Math.min(m, d[i - W + 1] + 1.4); }
      d[i] = m;
    }
    for (let y = H - 1, i = W * H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--, i--) {
      let m = d[i]; if (!m) continue;
      if (x < W - 1) m = Math.min(m, d[i + 1] + 1);
      if (y < H - 1) { m = Math.min(m, d[i + W] + 1); if (x < W - 1) m = Math.min(m, d[i + W + 1] + 1.4); if (x > 0) m = Math.min(m, d[i + W - 1] + 1.4); }
      d[i] = m;
    }
    return d;
  }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // c: { W, H, seed, mode, names:[biomnamn], bi:Uint8Array|null, height(x,y,i), samples:[{x,y,nf}], clear:[{x,y,r}], fixed:[{x,y,spr}] }
  function buildTerrain(c) {
    const { W, H, seed } = c, N = W * H, ov = c.mode === 'overview';
    const Bs = c.names.map((n) => BIOMES[n]), bio = Bs.map(prep), pools = c.names.map((n) => pool(n, ov));
    const bi = c.bi || new Uint8Array(N), sea = c.sea ? prep(BIOMES[c.sea]) : null;
    const R = 16, pd = new Float32Array(N).fill(99), pf = new Float32Array(N).fill(99);
    for (const s of c.samples) {
      const x0 = Math.max(0, Math.floor(s.x - R)), x1 = Math.min(W - 1, Math.ceil(s.x + R)), y0 = Math.max(0, Math.floor(s.y - R)), y1 = Math.min(H - 1, Math.ceil(s.y + R));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const d = Math.hypot(x - s.x, y - s.y), i = y * W + x;
        if (d < pd[i]) pd[i] = d;
        if (!s.nf && d < pf[i]) pf[i] = d;
      }
    }
    const land = new Uint8Array(N), pw = ov ? 1.6 : 2.6;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      let h = c.height(x, y, i);
      if (pf[i] < 7 + PX.vnoise(x / 8, y / 8, seed + 4) * 7) h = 1;
      for (const z of c.plazas || []) { const d = Math.hypot(x - z.x, (y - z.y) * 1.5) - z.r + pw; if (d < pd[i]) pd[i] = d; if (d < 8) h = 1; }
      land[i] = h > 0.5 ? 1 : 0;
    }
    const sd = chamfer(land, W, H, 0), wd = chamfer(land, W, H, 1);
    // platåer med klippkant mot söder
    const plate = new Uint8Array(N), cl = new Uint8Array(N), ch = ov ? 3 : 4, ps = ov ? 22 : 40;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++)
      if (land[i] && sd[i] > ch + 4 && pd[i] > 12 && PX.fbm(x / ps, y / ps, seed + 50, 2) > 0.6) plate[i] = 1;
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      if (plate[i] || !land[i]) continue;
      for (let k = 1; k <= ch; k++) if (y - k >= 0 && plate[i - k * W]) { cl[i] = k; break; }
    }

    // --- mark ---
    const img = new ImageData(W, H), dd = img.data;
    const put = (i, col) => { const j = i * 4; dd[j] = col[0]; dd[j + 1] = col[1]; dd[j + 2] = col[2]; dd[j + 3] = 255; };
    const PLANK = [[204, 150, 88], [160, 108, 60], [74, 46, 26]];
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      if (!land[i]) { if (pd[i] <= pw + 0.7) put(i, pd[i] > pw - 0.5 ? PLANK[2] : (x + y) % 3 === 0 ? PLANK[1] : PLANK[0]); continue; }
      const Cc = bio[bi[i]], B = Bs[bi[i]], hs = PX.hash2(x, y, seed + 99);
      let col;
      if (pd[i] <= pw) col = hs < 0.16 ? Cc.path[1] : Cc.path[0];
      else if (pd[i] <= pw + 1) col = Cc.edge;
      else if (cl[i]) col = cl[i] === ch || PX.hash2(x, 0, seed + 3) < 0.3 ? Cc.cliff[1] : Cc.cliff[0];
      else if (sd[i] < 2.2 + PX.vnoise(x / 5, y / 5, seed + 8) * 2.4) col = Cc.shore[hs < 0.2 ? 1 : 0];
      else {
        let tone = PX.fbm(x / 34, y / 34, seed + 11, 3) * 0.7 + PX.vnoise(x / 6, y / 6, seed + 5) * 0.3;
        if (B.ripple) tone += Math.sin(y * 0.9 + PX.fbm(x / 18, y / 18, seed + 2, 2) * 9) * 0.05;
        let k = PX.clamp(Math.floor((tone - 0.5) * 9 + 2 + (PX.bayer(x, y) - 0.5) * 0.7), 0, 3);
        const pal = plate[i] ? Cc.high : Cc.ground;
        if (plate[i]) { if (!plate[i - W]) k = 3; else if (!plate[i - 1]) k = Math.min(3, k + 1); else if (!plate[i + 1]) k = 0; }
        col = pal[k];
        if (hs < 0.035) col = pal[Math.max(0, k - 1)];
        else if (hs > 1 - B.speckRate) col = Cc.speck[((hs * 1e4) | 0) % Cc.speck.length];
      }
      put(i, col);
    }
    const landCv = mkCanvas(W, H), g = landCv.getContext('2d');
    g.putImageData(img, 0, 0);

    // --- vätska i fyra animationsrutor ---
    const water = [];
    for (let f = 0; f < 4; f++) {
      const im = new ImageData(W, H), wdta = im.data;
      for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
        if (land[i]) continue;
        const Cc = sea || bio[bi[i]], w = wd[i], nz = PX.vnoise(x / 9, y / 9, seed + 31), ph = (nz * 4) | 0;
        let col;
        if ((y > 0 && land[i - W]) || (y > 1 && land[i - 2 * W])) col = Cc.under;
        else if (w < 1.6 && ((f + ph) & 3) !== 3) col = Cc.foam;
        else if (w >= 2.6 && w < 3.8 && ((f + ph) & 3) === 1 && PX.hash2(x >> 1, y, seed) < 0.55) col = Cc.foam;
        else {
          const z = w + nz * 5, b = PX.bayer(x, y) < 0.5;
          col = z < 4.5 ? Cc.liq[2] : z < 9 ? (z < 5.5 && b ? Cc.liq[2] : Cc.liq[1]) : z < 10.5 && b ? Cc.liq[1] : Cc.liq[0];
          const key = PX.hash2(x >> 2, y, seed + 40);
          if (key < 0.07) { const p = ((key * 1000) | 0) & 3; if (f === p || (f === ((p + 1) & 3) && ((x & 3) === 1 || (x & 3) === 2))) col = Cc.glint; }
        }
        const j = i * 4; wdta[j] = col[0]; wdta[j + 1] = col[1]; wdta[j + 2] = col[2]; wdta[j + 3] = 255;
      }
      const wc = mkCanvas(W, H); wc.getContext('2d').putImageData(im, 0, 0); water.push(wc);
    }

    // --- dekor ---
    const r = PX.rng(seed * 7 + 1), items = [];
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : (y | 0) * W + (x | 0));
    const clearOK = (x, y, s) => {
      const i0 = at(x, y), i1 = at(x, y - s.h * 0.6), i2 = at(x, y - s.h + 2);
      if (i0 < 0 || pd[i0] < s.w / 2 + 4) return false;
      if (i1 >= 0 && pd[i1] < s.w / 2 + 2) return false;
      if (i2 >= 0 && pd[i2] < 5) return false;
      for (const k of c.clear) if (Math.hypot(x - k.x, y - s.h / 2 - k.y) < k.r + s.w / 2) return false;
      return true;
    };
    // berg först: få, stora, med avstånd mellan sig
    const mts = [];
    Bs.forEach((B, b) => {
      const P = pools[b].mountain || []; if (!P.length || !B.mtn) return;
      let want = Math.round((ov ? 2 : (W * H) / 26000) * B.mtn), tries = 400;
      while (want > 0 && tries-- > 0) {
        const x = (r() * W) | 0, y = (r() * H) | 0, i = y * W + x, s = P[(r() * P.length) | 0];
        if (!land[i] || bi[i] !== b || cl[i] || sd[i] < 6 || !clearOK(x, y, s)) continue;
        const il = at(x - s.w / 2, y), ir = at(x + s.w / 2, y);
        if (il < 0 || ir < 0 || !land[il] || !land[ir]) continue;
        if (mts.some((m) => Math.hypot(m.x - x, (m.y - y) * 1.6) < (ov ? 16 : 34))) continue;
        mts.push({ x, y }); items.push({ x, y, s }); want--;
      }
    });
    const cell = ov ? 6 : 8;
    for (let gy = 0; gy < H / cell; gy++) for (let gx = 0; gx < W / cell; gx++) {
      const x = (gx * cell + r() * cell) | 0, y = (gy * cell + r() * cell) | 0, i = at(x, y);
      if (i < 0 || cl[i]) continue;
      const B = Bs[bi[i]], P = pools[bi[i]], liq = !land[i], cn = PX.fbm(x / 26, y / 26, seed + 21, 2);
      for (const dc of B.deco) {
        if ((dc.on === 'liq') !== liq) continue;
        if (liq) { if (wd[i] < 4 || wd[i] > 13 || pd[i] < 8) continue; }
        else if (dc.shore ? sd[i] < 2 || sd[i] > 7 : sd[i] < 4) continue;
        let p = dc.p * (ov ? 1.7 : 1);
        if (dc.cl > 0) p *= PX.smooth(0.44, 0.6, cn) * 2; else if (dc.cl < 0) p *= PX.smooth(0.56, 0.4, cn) * 1.5;
        if (r() >= p) continue;
        const arr = P[dc.s]; if (!arr || !arr.length) break;
        const s = arr[(r() * arr.length) | 0];
        if (!clearOK(x, y, s)) break;
        if (mts.some((m) => Math.abs(m.x - x) < (ov ? 9 : 20) && y < m.y + 2 && y > m.y - (ov ? 10 : 24))) break;
        items.push({ x, y, s }); break;
      }
    }
    for (const f of c.fixed || []) items.push(f);
    items.sort((a, b) => a.y - b.y);
    g.fillStyle = 'rgba(14,10,44,0.3)';
    for (const it of items) {
      const rx = it.s.sh, ry = Math.max(1, rx * 0.42); if (!rx) continue;
      for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) { const hw = Math.round(rx * Math.sqrt(1 - (dy / (ry + 0.5)) ** 2)); g.fillRect(Math.round(it.x - hw + rx * 0.35), it.y + dy, hw * 2, 1); }
    }
    const emitters = [];
    for (const it of items) {
      g.drawImage(it.s.cv, it.x - it.s.ax, it.y - it.s.ay);
      if (it.s.emit) emitters.push({ x: it.x + it.s.emit.x, y: it.y + it.s.emit.y });
    }
    return { W, H, land: landCv, water, emitters, mask: land };
  }

  // ---------- stig ----------
  function spline(pts) {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
      const n = Math.max(4, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) * 1.2)), seg = [];
      for (let s = 0; s <= n; s++) {
        const t = s / n, t2 = t * t, t3 = t2 * t;
        seg.push({
          x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
        });
      }
      segs.push(seg);
    }
    return segs;
  }

  // ---------- översikten ----------
  let OV = null; const WV = {};
  function buildOverview() {
    const n = worlds.length, ls = vw > vh, cols = ls ? Math.ceil(n / 2) : 2, rows = Math.ceil(n / cols);
    const top = 24, tz = ls ? 48 : 62;
    const cw = Math.max(94, Math.floor((ls ? vw - tz : vw) / cols)), chh = Math.max(100, Math.floor(((ls ? vh : vh - tz) - top - 4) / rows));
    const gw = cols * cw + (ls ? tz : 0), gh = top + 4 + rows * chh + (ls ? 0 : tz);
    const W = Math.max(vw, gw), H = Math.max(vh, gh), ox = (W - gw) >> 1, oy = top + ((H - gh) >> 1);
    const rad = Math.min(cw, chh) * 0.62;
    const cs = worlds.map((w, k) => {
      const rr = Math.floor(k / cols), ci = k % cols, c = rr % 2 === 0 ? ci : cols - 1 - ci;
      return {
        x: Math.round(ox + (c + 0.5) * cw + (PX.hash2(k, 1, 7) - 0.5) * cw * 0.12), y: Math.round(oy + (rows - 1 - rr + 0.5) * chh + (PX.hash2(k, 2, 7) - 0.5) * chh * 0.1 + 6),
        R: rad, biome: w.biome, isle: !!BIOMES[w.biome].floating, world: k
      };
    });
    D.coming.forEach((t, k) => {
      const f = (k + 0.5) / D.coming.length;
      cs.push(ls ? { x: W - (tz >> 1) - 1, y: Math.round(top + 10 + (H - top - 20) * f), R: 24, biome: 'mystery', isle: true, teaser: t }
        : { x: Math.round(W * f), y: H - tz + 12, R: 24, biome: 'mystery', isle: true, teaser: t });
    });
    const N = W * H, bi = new Uint8Array(N), hf = new Float32Array(N), ms = new Float32Array(cs.length);
    const mAt = (x, y) => {
      const wx = x + (PX.fbm(x / 22, y / 22, 91, 2) - 0.5) * 28, wy = y + (PX.fbm(x / 22, y / 22, 92, 2) - 0.5) * 28;
      for (let k = 0; k < cs.length; k++) ms[k] = 1 - Math.hypot(wx - cs[k].x, wy - cs[k].y) / cs[k].R;
    };
    for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
      mAt(x, y);
      let b1 = 0, b2 = 0, m1 = -9, m2 = -9, bf = -1, mf = -9;
      for (let k = 0; k < cs.length; k++) {
        if (cs[k].isle) { if (ms[k] > mf) { mf = ms[k]; bf = k; } }
        else if (ms[k] > m1) { m2 = m1; b2 = b1; m1 = ms[k]; b1 = k; } else if (ms[k] > m2) { m2 = ms[k]; b2 = k; }
      }
      let m = m1 + Math.max(0, m2) * 0.35, b = b1;
      if (m1 - m2 < 0.09 && PX.bayer(x, y) > 0.5 + (m1 - m2) / 0.18) b = b2;
      if (mf > 0.22 && mf > m1) { m = mf; b = bf; }
      bi[i] = b; hf[i] = 0.5 + (m - 0.3) * 1.2 + (PX.fbm(x / 16, y / 16, 33, 3) - 0.5) * 0.3;
    }
    const pts = cs.filter((c) => !c.teaser).map((c) => ({ x: c.x, y: c.y + 11 }));
    const segs = spline(pts), samples = [];
    segs.forEach((seg, k) => { const nf = cs[k].isle || cs[k + 1].isle; for (let s = 0; s < seg.length; s += 2) samples.push({ x: seg[s].x, y: seg[s].y, nf }); });
    const names = cs.map((c) => c.biome);
    const fixed = cs.map((c) => ({ x: c.x, y: c.y - 2, s: pool(c.biome, true).landmark }));
    const ter = buildTerrain({ W, H, seed: 3, mode: 'overview', sea: 'forest', names, bi, height: (x, y, i) => hf[i], samples, clear: cs.map((c) => ({ x: c.x, y: c.y - 10, r: 17 })), fixed });
    // dimma per värld
    const fog = cs.map((c, k) => {
      const f = mkCanvas(W, H), im = new ImageData(W, H), d = im.data, Rr = Math.ceil(c.R * 1.5);
      for (let y = Math.max(0, c.y - Rr); y < Math.min(H, c.y + Rr); y++) for (let x = Math.max(0, c.x - Rr); x < Math.min(W, c.x + Rr); x++) {
        mAt(x, y);
        let other = -9; for (let j = 0; j < cs.length; j++) if (j !== k && ms[j] > other) other = ms[j];
        const i = y * W + x, mine = bi[i] === k, lim = c.isle ? 0.1 : 0.14;
        let fv = Math.min((ms[k] - lim) / 0.1, (ms[k] - other) / 0.08 + 0.5);
        if (ter.mask[i] && !mine) fv = 0; if (ter.mask[i] && mine) fv = Math.max(fv, 1);
        if (fv <= PX.bayer(x, y)) continue;
        const wisp = PX.fbm(x / 13, y / 6, 77 + k, 2), j = i * 4, lt = wisp > 0.56;
        d[j] = lt ? 62 : 28; d[j + 1] = lt ? 70 : 32; d[j + 2] = lt ? 118 : 72; d[j + 3] = ter.mask[i] ? (lt ? 178 : 158) : lt ? 150 : 120;
      }
      f.getContext('2d').putImageData(im, 0, 0);
      return f;
    });
    const r = PX.rng(11);
    const clouds = Array.from({ length: Math.max(3, Math.round((W * H) / 22000)) }, (_, i) => ({ x: r() * W, y: 20 + r() * (H - 40), k: i % 3, v: 2 + r() * 2.5 }));
    return { W, H, ter, cs, segs, pts, fog, clouds };
  }

  // ---------- världsvyn ----------
  function buildWorld(k) {
    const w = worlds[k], B = BIOMES[w.biome], n = w.nodes.length, ls = vw > vh, per = ls ? 5 : 3, rows = Math.ceil(n / per);
    const W = Math.max(vw, per * 56 + 30), H = Math.max(vh, rows * 80 + 110);
    const top = 62, bot = 62, gap = rows > 1 ? (H - top - bot) / (rows - 1) : 0, mx = ls ? 38 : 30;
    const pts = w.nodes.map((nd, i) => {
      const rr = Math.floor(i / per), c = i % per, inRow = Math.min(per, n - rr * per);
      let t = (c + 0.5) / inRow; if (rr % 2) t = 1 - t;
      return { x: Math.round(mx + t * (W - 2 * mx)), y: Math.round(H - bot - rr * gap + Math.sin(i * 2.3 + k) * 10 - (nd.type === 'boss' ? 2 : 0)) };
    });
    const segs = spline(pts), samples = [];
    segs.forEach((seg) => { for (let s = 0; s < seg.length; s += 2) samples.push(seg[s]); });
    // Sidostopp: en kort stickväg från stigen mellan nod `after` och nästa, ut till ett tält vid sidan. Platsen väljs bland
    // några lägen på båda sidor om stigen: den som ligger längst från andra noder, deras skyltar (under) och stjärnor (över).
    const sides = w.side.map((sd) => {
      const seg = segs[Math.min(sd.after, segs.length - 1)], free = (q) => Math.min(...pts.map((p) => Math.min(Math.hypot(q.x - p.x, q.y - p.y), Math.hypot(q.x - p.x, q.y - p.y - 16) + 4, Math.hypot(q.x - p.x, q.y - p.y + 16) + 6)));
      let best = null;
      for (const f of [0.5, 0.36, 0.64]) for (const sg of [-1, 1]) for (const dist of [26, 32]) {
        const mi = Math.round((seg.length - 1) * f), a = seg[Math.max(0, mi - 2)], b = seg[Math.min(seg.length - 1, mi + 2)], c = seg[mi], dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy) || 1;
        const q = { x: Math.round(c.x - sg * dy / L * dist), y: Math.round(c.y + sg * dx / L * dist), cx: c.x, cy: c.y }, inside = q.x >= 24 && q.x <= W - 24 && q.y >= 54 && q.y <= H - 48;
        q.score = free(q) - Math.abs(f - 0.5) * 30 - (dist - 26) * 0.5 - (inside ? 0 : 60);
        if (!best || q.score > best.score) best = q;
      }
      const p = { x: PX.clamp(best.x, 24, W - 24), y: PX.clamp(best.y, 54, H - 48) };
      for (let s = 0; s <= 1; s += 0.08) samples.push({ x: best.cx + (p.x - best.cx) * s, y: best.cy + (p.y - best.cy) * s });
      return p;
    });
    const seed = 100 + k * 13;
    const ter = buildTerrain({
      W, H, seed, mode: 'world', names: [w.biome], samples,
      plazas: pts.map((p, i) => ({ x: p.x, y: p.y + 1, r: w.nodes[i].type === 'boss' ? 13 : w.nodes[i].type === 'level' ? 8 : 9 })).concat(sides.map((p) => ({ x: p.x, y: p.y + 1, r: 9 }))),
      clear: pts.map((p, i) => ({ x: p.x, y: p.y - 6, r: w.nodes[i].type === 'boss' ? 17 : 11 })).concat(sides.map((p) => ({ x: p.x, y: p.y - 6, r: 12 }))),
      height: (x, y) => {
        const e = Math.min(x, y, W - 1 - x, H - 1 - y);
        let h = 0.5 + Math.min((e - 8) / 14, 0.4) + (PX.fbm(x / 24, y / 24, seed, 3) - 0.5) * 1.2;
        const lk = PX.fbm(x / 40, y / 40, seed + 3, 2);
        if (lk < B.wet) h -= (B.wet - lk) * 10;
        return h;
      }
    });
    const r = PX.rng(seed);
    const clouds = Array.from({ length: Math.max(2, Math.round((W * H) / 40000)) }, (_, i) => ({ x: r() * W, y: 30 + r() * (H - 60), k: i % 3, v: 2 + r() * 2.5 }));
    const dens = { snow: 700, ember: 1500, leaf: 3200, firefly: 2200, sand: 2600, sparkle: 1000 }[B.particle] || 1e9;
    const parts = Array.from({ length: Math.round((W * H) / dens) }, () => ({ x: r() * W, y: r() * H, p: r() * 6.28, s: 0.5 + r() }));
    return { W, H, ter, pts, segs, sides, clouds, parts, kind: B.particle };
  }
  const getWorld = (k) => WV[k] || (WV[k] = buildWorld(k));

  // ---------- vy och kamera ----------
  const view = { mode: 'overview', world: 0, cam: { x: 0, y: 0 }, follow: true };
  let walk = null, owalk = null, unlockAnim = null, fade = null, floats = [], busy = false;
  const curMap = () => (view.mode === 'overview' ? OV : getWorld(view.world));
  function clampCam() { const m = curMap(); view.cam.x = PX.clamp(view.cam.x, 0, Math.max(0, m.W - vw)); view.cam.y = PX.clamp(view.cam.y, 0, Math.max(0, m.H - vh)); }
  function along(seg, t) { const f = PX.clamp(t, 0, 1) * (seg.length - 1), i = Math.min(seg.length - 2, Math.floor(f)), u = f - i; return { x: seg[i].x + (seg[i + 1].x - seg[i].x) * u, y: seg[i].y + (seg[i + 1].y - seg[i].y) * u }; }
  function heroPos() {
    const m = getWorld(view.world), w = worlds[view.world];
    if (walk) return along(m.segs[walk.from], (now() - walk.t0) / walk.dur);
    const ci = curNode(w), e = m.pts[m.pts.length - 1]; return ci < 0 ? { x: e.x + 17, y: e.y + 4 } : ci === m.pts.length - 1 ? { x: e.x - 18, y: e.y + 4 } : m.pts[ci];
  }
  function centerOn(p, snap) {
    const tx = p.x - vw / 2, ty = p.y - vh / 2 - 6;
    if (snap) { view.cam.x = tx; view.cam.y = ty; } else { view.cam.x += (tx - view.cam.x) * 0.12; view.cam.y += (ty - view.cam.y) * 0.12; }
    clampCam();
  }
  function setView(mode, k, instant) {
    const apply = () => {
      view.mode = mode; if (k != null) view.world = k; closeCard();
      if (mode === 'world') { view.follow = true; centerOn(heroPos(), true); } else { view.cam.x = 0; view.cam.y = Math.max(0, OV.H - vh); clampCam(); }
      updateHud();
    };
    if (instant) apply(); else fade = { t0: now(), apply, done: false };
  }

  // ---------- ritning ----------
  const img = (s, x, y) => ctx.drawImage(s.cv || s, Math.round(x - (s.ax || 0) - view.cam.x), Math.round(y - (s.ay || 0) - view.cam.y));
  const rect = (x, y, w, h) => ctx.fillRect(Math.round(x - view.cam.x), Math.round(y - view.cam.y), w, h);
  function ring(cx, cy, rx, ry, col) { ctx.fillStyle = col; const n = Math.ceil(rx * 7); for (let i = 0; i < n; i++) { const a = (i / n) * 6.2832; rect(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 1, 1); } }
  function smoke(em, t) {
    for (const e of em) {
      for (let k = 0; k < 5; k++) {
        const a = (t * 0.3 + k / 5 + e.x * 0.013) % 1, x = e.x + Math.sin(a * 5 + k) * 2 + a * 6, y = e.y - a * 18, r = 1 + ((a * 3.2) | 0);
        ctx.fillStyle = a < 0.3 ? '#5c4c5a' : a < 0.65 ? '#84768a' : '#aca0b0';
        rect(x - r / 2, y - r / 2, r, r); if (r > 2) { rect(x - r / 2 - 1, y - r / 2 + 1, r + 2, r - 2); }
      }
      ctx.fillStyle = ((t * 6 + e.x) | 0) % 2 ? '#fff0a0' : '#ffb02a'; rect(e.x - 1 + (((t * 3) | 0) % 3), e.y + 2, 1, 1);
    }
  }
  function drawClouds(m, t, dt, tintVolcano) {
    for (const c of m.clouds) { c.x += c.v * dt; if (c.x > m.W + 10) c.x = -50; }
    ctx.globalAlpha = 0.2; for (const c of m.clouds) img(C.cloudShadow[c.k], c.x + 8, c.y + 22); ctx.globalAlpha = 1;
    for (const c of m.clouds) img(tintVolcano ? C.ash[c.k] : C.cloud[c.k].cv, c.x, c.y);
  }
  function drawParts(m, t, dt) {
    const k = m.kind; if (!k) return;
    for (const p of m.parts) {
      let c = '#ffffff', w = 1, show = true;
      if (k === 'snow') { p.y += dt * (8 + p.s * 8); p.x += Math.sin(t * 1.5 + p.p) * dt * 6; }
      else if (k === 'ember') { p.y -= dt * (7 + p.s * 7); p.x += Math.sin(t * 2 + p.p) * dt * 5; c = ((t * 6 + p.p) | 0) % 2 ? '#ffb02a' : '#ff6a14'; }
      else if (k === 'leaf') { p.x += dt * (6 + p.s * 5); p.y += dt * 4 + Math.sin(t * 3 + p.p) * dt * 7; c = p.s > 1 ? '#f0d050' : '#b8e868'; w = ((t * 4 + p.p) | 0) % 2 ? 2 : 1; }
      else if (k === 'sand') { p.x += dt * (38 + p.s * 30); p.y += dt * 3; c = '#fff6c8'; w = 3; }
      else if (k === 'firefly') { p.x += Math.sin(t * 0.7 + p.p) * dt * 5; p.y += Math.cos(t * 0.9 + p.p * 2) * dt * 4; show = Math.sin(t * 2 + p.p * 3) > -0.2; c = Math.sin(t * 2 + p.p * 3) > 0.6 ? '#ffffc0' : '#c8f060'; }
      else if (k === 'sparkle') { const ph = ((t * 3 + p.p * 4) | 0) % 9; show = ph < 3; if (ph === 1) { ctx.fillStyle = '#ffffff'; rect(p.x - 1, p.y, 3, 1); rect(p.x, p.y - 1, 1, 3); } c = ph === 1 ? '#fff3a8' : '#ffffff'; }
      p.x = ((p.x % m.W) + m.W) % m.W; p.y = ((p.y % m.H) + m.H) % m.H;
      if (show) { ctx.fillStyle = c; rect(p.x, p.y, w, 1); }
    }
  }
  const bannerCache = new Map();
  function banner(name, sub, dim, star) {
    const key = name + '|' + sub + '|' + dim; if (bannerCache.has(key)) return bannerCache.get(key);
    const a = PX.text(name, dim ? '#b4b4cc' : '#fff6e0', '#1b1630'), b = sub ? PX.text(sub, '#ffd84a', '#1b1630') : null;
    const bw = b ? b.width + (star ? 8 : 0) : 0, w = Math.max(a.width, bw) + 4, h = b ? 23 : 13, c = mkCanvas(w, h), g = c.getContext('2d');
    g.fillStyle = dim ? 'rgba(27,22,48,0.6)' : 'rgba(27,22,48,0.85)'; g.fillRect(1, 0, w - 2, h); g.fillRect(0, 1, w, h - 2);
    if (!dim) { g.fillStyle = '#f4e3b0'; g.fillRect(2, 0, w - 4, 1); g.fillRect(2, h - 1, w - 4, 1); }
    g.drawImage(a, (w - a.width) >> 1, 1);
    if (b) { const bx = (w - bw) >> 1; if (star) g.drawImage(C.star.cv, bx, 13); g.drawImage(b, bx + (star ? 8 : 0), 11); }
    bannerCache.set(key, c); return c;
  }
  // Mörk platta bakom text på kartan, så att den går att läsa mot skog och sand. gold = guldkant (banan med flest ord kvar).
  function plate(x, y, w, h, dim, gold) {
    ctx.fillStyle = dim ? 'rgba(27,22,48,0.6)' : 'rgba(27,22,48,0.85)'; rect(x + 1, y, w - 2, h); rect(x, y + 1, w, h - 2);
    if (gold) { ctx.fillStyle = '#ffd84a'; rect(x + 1, y, w - 2, 1); rect(x + 1, y + h - 1, w - 2, 1); }
  }
  // Liten uppslagen bok (8 x 6 punkter): märket för "ord". gold = banan med flest ord kvar.
  function wordIcon(x, y, gold) {
    ctx.fillStyle = '#1b1630'; rect(x, y, 8, 6);
    ctx.fillStyle = gold ? '#ffd84a' : '#c3d0de'; rect(x + 1, y + 1, 3, 4); rect(x + 4, y + 1, 3, 4);
    ctx.fillStyle = '#1b1630'; rect(x + 4, y + 1, 1, 4);
  }
  // Minispelets tält. Ett öppet tält glittrar, ett som inte är nått än är mörkt.
  function drawTent(p, dark, t, seed) {
    img(dark ? C.tentDark : C.tent, p.x, p.y);
    if (dark) return;
    const ph = ((t * 4 + seed * 1.7) | 0) % 7; ctx.fillStyle = '#fff6e0';
    if (ph === 0) rect(p.x - 7, p.y - 12, 1, 1);
    else if (ph === 1) { rect(p.x - 8, p.y - 12, 3, 1); rect(p.x - 7, p.y - 13, 1, 3); }
    else if (ph === 3) rect(p.x + 7, p.y - 9, 1, 1);
    else if (ph === 4) { rect(p.x + 6, p.y - 9, 3, 1); rect(p.x + 7, p.y - 10, 1, 3); }
  }
  // Ordgymmet: en liten arena (colosseum) i sten, med valv i två våningar, en trasig överkant och en röd vimpel.
  function drawArena(p, dark, t) {
    const x = p.x, y = p.y, L = dark ? '#8a8a96' : '#e8d3a0', M = dark ? '#6a6a76' : '#c9ad72', D = dark ? '#3c3c48' : '#6b4f2c', O = '#2a1d10';
    const R = (c, a, b, w, h) => { ctx.fillStyle = c; rect(x + a, y + b, w, h); };
    R(O, -13, -12, 26, 13); R(O, -12, -15, 15, 4); R(O, 3, -13, 6, 2);                 // kontur, och den högre vänstra delen
    R(M, -12, -11, 24, 11); R(L, -12, -11, 24, 2); R(L, -11, -14, 13, 3); R(M, 4, -12, 4, 1);
    R(D, -12, -6, 24, 1);                                                              // list mellan våningarna
    for (let k = -10; k <= 8; k += 4) { R(D, k, -10, 2, 3); R(O, k, -9, 2, 2); }        // övre valv
    for (let k = -10; k <= 8; k += 4) { R(D, k, -4, 2, 4); R(O, k, -3, 2, 3); }         // nedre valv
    R(O, -2, -5, 4, 5); R(dark ? '#55556a' : '#f2b632', -1, -4, 2, 4);                 // porten lyser
    if (dark) return;
    const w = ((t * 4) | 0) % 2; R(O, -8, -21, 1, 7); R('#d8433b', -7, -21 + w, 4, 2); R('#d8433b', -7, -20, 3 + w, 1);   // vimpel
  }
  function stars3(x, y, n) { for (let s = 0; s < 3; s++) img(s < n ? C.star : C.starOff, x - 10 + s * 7 + 3, y + 6 - (s === 1 ? 2 : 0)); }

  // Berättelsen på kartan (map/story.js): det som ligger kvar efter en stund och de korta stunderna ovanpå kartan.
  // Saknas filen ritas inget. Ett fel i den får aldrig stoppa kartan.
  const STORY = window.MAP_STORY ? window.MAP_STORY({ ctx, view, rect, getWorld, worlds, heroPos, now, size: () => ({ vw, vh }) }) : null;
  const story = (fn, t) => { if (!STORY) return; try { STORY[fn](t); } catch (e) { if (!story.err) { story.err = 1; console.error('story', e); } } };

  let lastT = now();
  function frame() {
    const t = now(), dt = Math.min(0.2, t - lastT); lastT = t;
    if (!OV) return;
    if (vpW() !== builtW || vpH() !== builtH) resize();
    const m = curMap(), wf = ((t * 3.3) | 0) & 3, cx = Math.round(view.cam.x), cy = Math.round(view.cam.y);
    ctx.fillStyle = '#16326a'; ctx.fillRect(0, 0, vw, vh);
    ctx.drawImage(m.ter.water[wf], -cx, -cy); ctx.drawImage(m.ter.land, -cx, -cy);
    smoke(m.ter.emitters, t);
    if (view.mode === 'overview') drawOverview(t, dt); else drawWorld(t, dt);
    floats = floats.filter((f) => t - f.t0 < 1.4);
    for (const f of floats) { const a = (t - f.t0) / 1.4, tc = PX.text(f.text, '#ffd84a', '#1b1630'); img(tc, f.x - tc.width / 2, f.y - 22 - a * 16); }
    if (fade) {
      const a = (t - fade.t0) / 0.22;
      if (a >= 1 && !fade.done) { fade.done = true; fade.apply(); }
      const v = a < 1 ? a : 2 - a;
      if (a >= 2) fade = null; else { ctx.globalAlpha = Math.round(PX.clamp(v, 0, 1) * 5) / 5; ctx.fillStyle = '#0c0a20'; ctx.fillRect(0, 0, vw, vh); ctx.globalAlpha = 1; }
    }
  }
  function fogAmount(k) {
    const c = OV.cs[k]; if (c.teaser) return 1;
    if (unlockAnim && unlockAnim.world === k) return PX.clamp(1 - (now() - unlockAnim.t0) / 2.2, 0, 1);
    return unlocked(k) ? 0 : 1;
  }
  function drawOverview(t, dt) {
    const cw = curWorld();
    OV.cs.forEach((c, k) => {
      const fa = fogAmount(k); if (fa <= 0) return;
      const next = !c.teaser && k === cw + 1;
      ctx.globalAlpha = Math.ceil(fa * 6) / 6 * (next ? 0.86 : 1); ctx.drawImage(OV.fog[k], -Math.round(view.cam.x), -Math.round(view.cam.y));
      const np = c.teaser ? 1 : 3;
      for (let j = 0; j < np; j++) img(C.fogPuff[(j + k) % 3], c.x - 14 + Math.sin(t * 0.13 + j * 2.1 + k) * c.R * 0.5, c.y - 12 + Math.cos(t * 0.1 + j * 1.7 + k) * c.R * 0.32);
      ctx.globalAlpha = 1;
    });
    drawClouds(OV, t, dt);
    // markörer och skyltar
    OV.cs.forEach((c, k) => {
      const lm = pool(c.biome, true).landmark;
      if (c.teaser) {
        const q = PX.text('?', '#fff6e0', '#1b1630'); img(q, c.x - 3, c.y - 14 + Math.round(Math.sin(t * 2 + k) * 1));
        const b = banner(c.teaser.name, null, true); img(b, PX.clamp(c.x - b.width / 2, 1, OV.W - b.width - 1), c.y + 6); return;
      }
      const w = worlds[k], open = fogAmount(k) < 0.5;
      const b = banner(w.name, open ? starsOf(w) + '/' + maxStars(w) : null, !open, open);
      img(b, PX.clamp(c.x - b.width / 2, 1, OV.W - b.width - 1), c.y - 4 - lm.h - b.height);
      if (!open) img(C.lock, c.x, c.y - 12);
      else if (worldDone(w)) img(C.flag[((t * 4) | 0) % 2], c.x + 13, c.y + 10);
    });
    let hp = null;
    if (owalk) { const a = (t - owalk.t0) / owalk.dur; hp = along(OV.segs[owalk.from], a); if (a >= 1) owalk = null; }
    else if (cw >= 0) hp = OV.pts[cw]; else hp = OV.pts[OV.pts.length - 1];
    if (unlockAnim && t - unlockAnim.t0 > 2.4) unlockAnim = null;
    const bob = ((t * 3) | 0) % 2;
    ring(hp.x, hp.y + 1, 6 + ((t * 5) % 4), 3 + ((t * 5) % 4) * 0.5, '#fff6e0');
    img(heroSprite || C.hero[owalk ? ((t * 8) | 0) % 2 : 0], hp.x, hp.y - bob);
    img(C.arrow, hp.x + 2, hp.y - 17 - bob * 2);
  }
  function drawWorld(t, dt) {
    const k = view.world, w = worlds[k], m = getWorld(k), done = state.done[w.id], ci = curNode(w);
    if (walk && (t - walk.t0) / walk.dur >= 1) {
      // Framme vid nästa nod. Var den ett minispel är den redan passerad, och hjälten går vidare till noden efter.
      const nx = walk.from + 1;
      if (ci >= 0 && nx < ci) walk = { from: nx, t0: t, dur: 1.5 }; else { walk = null; busy = false; updateHud(); }
    }
    const hp = heroPos(), walking = !!walk;
    if (view.follow) centerOn(hp, false);
    // lysande spår längs den avklarade stigen
    const upto = ci < 0 ? m.segs.length : walking ? walk.from : ci;
    let q = 0;
    for (let s = 0; s < upto; s++) for (let j = 0; j < m.segs[s].length; j += 5, q++) {
      const p = m.segs[s][j]; ctx.fillStyle = (q - ((t * 7) | 0)) % 7 === 0 ? '#ffffff' : '#fff3a8'; rect(p.x, p.y, 1, 1);
    }
    story('ground', t);
    w.side.forEach((sd, j) => (sd.mini && sd.mini.game === 'gym' ? drawArena(m.sides[j], !done[sd.after], t) : drawTent(m.sides[j], !done[sd.after], t, 5 + j)));
    const order = m.pts.map((p, i) => i).sort((a, b) => m.pts[a].y - m.pts[b].y);
    for (const i of order) {
      const p = m.pts[i], nd = w.nodes[i], st = done[i] ? 'done' : i === ci && !walking ? 'cur' : (i === ci && walking) ? 'lock' : 'lock';
      if (st === 'cur') { const ph = (t * 1.6) % 1; ring(p.x, p.y + (nd.type === 'boss' ? 2 : 0), (nd.type === 'boss' ? 12 : 7) + ph * 6, (nd.type === 'boss' ? 6 : 4.5) + ph * 3.5, ph < 0.6 ? '#ffffff' : '#ffd84a'); }
      if (nd.type === 'boss') {
        const sp = st === 'done' ? C.skullDone : st === 'lock' ? C.skullDark : C.skull, by = st === 'cur' ? ((t * 2.5) | 0) % 2 : 0;
        img(sp, p.x, p.y - by);
        if (st !== 'done') { const blink = (t * 0.7 + i) % 4 < 0.15; if (!blink) { ctx.fillStyle = ((t * 4) | 0) % 2 ? '#ff3020' : '#ff7a40'; for (const [ex, ey] of sp.eyes) { rect(p.x - sp.ax + ex, p.y - sp.ay + ey - by, 2, 2); } ctx.fillStyle = '#ffe080'; for (const [ex, ey] of sp.eyes) rect(p.x - sp.ax + ex, p.y - sp.ay + ey - by, 1, 1); } }
        if (st === 'done') stars3(p.x, p.y - 34, done[i]);
        else if (st === 'lock') img(C.lock, p.x + 11, p.y + 1);
      } else if (nd.type === 'chest') img(st === 'done' ? C.chestOpen : st === 'lock' ? C.chestDark : C.chest, p.x, p.y - (st === 'cur' ? ((t * 3) | 0) % 2 : 0));
      else if (nd.type === 'mini') drawTent(p, st === 'lock', t, i);
      else { img(st === 'done' ? C.nodeDone : st === 'cur' ? C.nodeCur : C.nodeLock, p.x, p.y); if (st === 'done') stars3(p.x, p.y - 20, done[i]); }
      // Rekommenderad nivå under banan, och på klarade banor hur många av banans ord som inte är inlärda än.
      const inf = nodeInf(w, i), wi = worldInf(w);
      if (inf && inf.rec != null) {
        const boss = nd.type === 'boss', ly = p.y + (boss ? 9 : 6), tc = PX.text('Lv ' + inf.rec, st === 'lock' ? '#b4b4cc' : lvColor(inf), '#1b1630');
        plate(p.x - (tc.width >> 1) - 1, ly, tc.width + 2, 11, st === 'lock'); img(tc, p.x - (tc.width >> 1), ly);
        if (boss && st === 'cur' && wi.gate && !wi.gate.open) {      // bossens ordmätare är stängd: lås och hur långt det är kvar
          img(C.lock, p.x + 11, p.y + 1);
          const g = wi.gate, gt = PX.text(g.have + '/' + g.need, '#c3d0de', '#1b1630'), bx = p.x - ((gt.width + 9) >> 1);
          plate(bx - 2, ly + 11, gt.width + 12, 11); wordIcon(bx, ly + 13, false); img(gt, bx + 9, ly + 11);
        }
        if (st === 'done' && inf.left > 0) {
          const best = wi.best === i, bob = ((t * 3) | 0) % 2;
          if (best) { ring(p.x, p.y, 9 + ((t * 1.6) % 1) * 4, 5.5 + ((t * 1.6) % 1) * 2.5, '#ffd84a'); plate(p.x - 7, ly + 11 - bob, 14, 11, false, true); wordIcon(p.x - 4, ly + 13 - bob, true); }      // träna här: flest ord kvar att lära. Inga siffror på kartan, de står i rutan.
        }
      }
    }
    const step = walking ? ((t * 9) | 0) % 2 : 0, bob = walking ? step : ((t * 2.5) | 0) % 2;
    img(heroSprite || C.hero[step], hp.x, hp.y - 3 - bob);
    if (!walking && ci >= 0) img(C.arrow, hp.x + 2, hp.y - (heroSprite ? 30 : 21) - ((t * 3) | 0) % 2 * 2);
    drawParts(m, t, dt);
    drawClouds(m, t, dt, w.biome === 'volcano');
    story('sky', t);
  }

  // ---------- HUD, kort, demo ----------
  const iconURL = (s, n) => { const c = mkCanvas(s.w, s.h); c.getContext('2d').drawImage(s.cv, 0, 0); return c.toDataURL(); };
  const ICON = { coin: iconURL(C.coin), star: iconURL(C.star), starOff: iconURL(C.starOff) };
  const icon = (k, cls) => `<img class="px ${cls || ''}" src="${ICON[k]}" alt="">`;
  function updateHud() {
    const inW = view.mode === 'world', w = worlds[view.world];
    $('#back').hidden = !inW;
    $('#title b').textContent = inW ? w.name : D.continent.name;
    $('#title span').textContent = inW ? w.stage + ': ' + w.theme : D.continent.subtitle;
    const ts = worlds.reduce((a, x) => a + starsOf(x), 0), tm = worlds.reduce((a, x) => a + maxStars(x), 0);
    $('#stats').innerHTML = `${icon('coin')}${state.gold}<br>${icon('star')}${inW ? starsOf(w) + '/' + maxStars(w) : ts + '/' + tm}`;
    const demo = $('#demo'), cw = curWorld();
    $('#reset').hidden = true;
    if (inW) { demo.hidden = true; }
    else { demo.hidden = false; demo.disabled = cw < 0; demo.textContent = cw < 0 ? 'All done!' : 'Go to my level'; }
  }
  // Spelets skal skickar in barnets egen gubbe (en liten canvas) som ersätter standardfiguren på kartan.
  let heroSprite = null;
  function setHero(cvs, ax, ay) { heroSprite = cvs ? { cv: cvs, ax, ay } : null; }
  let toastT = 0;
  function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 2200); }
  const KIND = { level: 'Level', boss: 'Boss', chest: 'Treasure chest' };
  let cardNode = -1, cardSide = -1;
  // Rutan för ett minispel: spelets namn, en rad om vad man gör, belöningen och Play. inf.mini kommer från spelets skal:
  // { name, desc, first, daily, played, got } där got = dagens guld är redan hämtat.
  function miniCard(w, nd, locked, inf) {
    const el = $('#card'), mi = inf && inf.mini, coin = (n) => icon('coin', 'coin') + n + ' gold';
    el.classList.add('mini');                                 // större knappar: rutan är till för de minsta också
    el.querySelector('.kind').textContent = 'Mini-game in ' + w.name;
    el.querySelector('h2').textContent = nd.name;
    el.querySelector('.row i').textContent = 'Game';
    el.querySelector('.trains').textContent = mi ? mi.name + '. ' + mi.desc : nd.trains;
    el.querySelector('.lvrow').hidden = true; el.querySelector('.starrow').hidden = true; el.querySelector('.meter').hidden = true;
    el.querySelector('.reward').innerHTML = !mi ? 'A little gold' : mi.got ? 'Collected today' : mi.played ? coin(mi.daily) + ' today' : coin(mi.first) + ' the first time';
    el.querySelector('.note').textContent = locked ? 'Locked. Finish the levels before this one.' : mi && mi.got ? 'More gold tomorrow. You can still play for fun.' : 'A little break. You cannot lose here.';
    const play = el.querySelector('.play');
    play.hidden = false; el.querySelector('.practice').hidden = true; play.disabled = locked; play.textContent = locked ? 'Locked' : 'Play';
    el.classList.add('on');
  }
  // i = nodindex i stigen. sj = index i världens sidostopp (då gäller inte i).
  function openCard(i, sj) {
    const w = worlds[view.world], isSide = sj != null && sj >= 0, nd = isSide ? w.side[sj] : w.nodes[i], d = isSide ? 0 : state.done[w.id][i], ci = curNode(w), locked = isSide ? !state.done[w.id][nd.after] : !d && i !== ci, el = $('#card');
    cardNode = isSide ? -1 : i; cardSide = isSide ? sj : -1;
    if (nd.type === 'mini') return miniCard(w, nd, locked, isSide ? ((worldInf(w) || {}).side || [])[sj] : nodeInf(w, i));
    el.querySelector('.starrow').hidden = false; el.classList.remove('mini');
    const no = w.nodes.slice(0, i + 1).filter((x) => x.type === 'level').length;
    el.querySelector('.kind').textContent = (nd.type === 'level' ? 'Level ' + no : KIND[nd.type]) + ' in ' + w.name;
    el.querySelector('h2').textContent = nd.name;
    el.querySelector('.row i').textContent = isStar(nd) ? 'Words' : 'Inside';
    el.querySelector('.trains').textContent = nd.trains;
    const inf = nodeInf(w, i), wi = worldInf(w), gate = nd.type === 'boss' && !d && wi ? wi.gate : null, shut = !!(gate && !gate.open && !locked);
    // Rekommenderad nivå och belöning kommer från spelets skal (balance.js). Utan skal visas kartans egna tal.
    const lvRow = el.querySelector('.lvrow'); lvRow.hidden = !(inf && inf.rec != null);
    if (!lvRow.hidden) el.querySelector('.lv').innerHTML = `<b style="color:${lvColor(inf)}">Lv ${inf.rec}</b> <span>(you are Lv ${INFO.level})</span>`;
    const coin = (n) => icon('coin', 'coin') + n + ' gold';
    el.querySelector('.reward').innerHTML = !inf ? (nd.gold ? coin(nd.gold) : 'None')
      : nd.type === 'chest' ? coin(inf.gold)
      : inf.bonus ? coin(inf.bonus) + ' the first time' : inf.f < 1 ? 'Small (' + Math.round(inf.f * 100) + '%)' : 'Gold and XP';
    el.querySelector('.stars').innerHTML = isStar(nd) ? [0, 1, 2].map((s) => icon(s < d ? 'star' : 'starOff')).join('') : 'No stars here';
    const notes = [];
    if (locked) notes.push('Locked. Finish the levels before this one.');
    else if (shut) notes.push(gate.text, 'Make more words ' + gate.tier + ' to wake the boss.');
    else {
      if (inf && inf.f < 1) notes.push('Too easy now: small reward.');
      if (d && inf && inf.left > 0) { notes.push((inf.n != null ? (inf.n - inf.left) + ' of ' + inf.n + ' words here are strong.' : inf.left + ' words here are not strong yet.') + (wi && wi.best === i ? ' Best place to practise now!' : ' Play again to make them stronger.'));
        if (inf.weak && inf.weak.length) notes.push('Not strong yet: ' + inf.weak.join(', ') + (inf.left > inf.weak.length ? ' ...' : '')); }
      else if (d && !(inf && inf.f < 1)) notes.push(isStar(nd) && inf && inf.left === 0 ? 'Done. All words here are learned!' : 'Done. Play again for more stars and gold.');
      if (!d) notes.push(nd.type === 'boss' ? (gate ? gate.text + ' ' : '') + 'Beat the boss to open the next world.' : 'You are here.');
    }
    const note = el.querySelector('.note'); note.textContent = ''; notes.forEach((tx) => { const ln = document.createElement('div'); ln.textContent = tx; note.appendChild(ln); });
    const meter = el.querySelector('.meter'); meter.hidden = !gate || locked;
    if (gate) meter.firstElementChild.style.width = Math.min(100, Math.round(100 * gate.have / Math.max(1, gate.need))) + '%';
    const play = el.querySelector('.play'), practice = el.querySelector('.practice');
    play.hidden = shut; practice.hidden = !shut;
    play.disabled = locked; play.textContent = locked ? 'Locked' : nd.type === 'chest' ? 'Open' : d ? 'Play again' : 'Play';
    el.classList.add('on');
  }
  function closeCard() { $('#card').classList.remove('on'); cardNode = -1; cardSide = -1; }
  let demoCount = 0;
  function completeCurrent(stars) {
    if (busy || view.mode !== 'world') return;
    const k = view.world, w = worlds[k], ci = curNode(w); if (ci < 0) return;
    const nd = w.nodes[ci], m = getWorld(k), p = m.pts[ci];
    closeCard();
    state.done[w.id][ci] = isStar(nd) ? (stars || 1) : 1;
    passMinis(w);
    view.follow = true;
    if (ci + 1 < w.nodes.length) { busy = true; walk = { from: ci, t0: now() + 0.35, dur: 1.5 }; }
    else {
      busy = true;
      const last = k + 1 >= worlds.length;
      toast(last ? 'You finished all of ' + D.continent.name + '!' : w.name + ' is done! ' + worlds[k + 1].name + ' is open.');
      setTimeout(() => {
        setView('overview');
        setTimeout(() => { busy = false; if (!last) { unlockAnim = { world: k + 1, t0: now() + 0.3 }; owalk = { from: k, t0: now() + 0.6, dur: 2.2 }; } updateHud(); }, 260);
      }, 1500);
    }
    updateHud();
  }

  // ---------- pekhantering ----------
  let ptr = null;
  cv.addEventListener('pointerdown', (e) => { ptr = { x: e.clientX, y: e.clientY, cx: view.cam.x, cy: view.cam.y, moved: false }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} });
  cv.addEventListener('pointermove', (e) => {
    if (!ptr) return;
    const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
    if (Math.hypot(dx, dy) > 5) { ptr.moved = true; view.follow = false; }
    if (ptr.moved) { view.cam.x = ptr.cx - dx / S; view.cam.y = ptr.cy - dy / S; clampCam(); }
  });
  cv.addEventListener('pointerup', (e) => { if (ptr && !ptr.moved) tap(e.clientX / S + view.cam.x, e.clientY / S + view.cam.y); ptr = null; });
  cv.addEventListener('pointercancel', () => { ptr = null; });
  // Reserv för pekskärmar där pekhändelserna avbryts (t.ex. av systemgester): samma panorering med touch-händelser.
  let tch = null;
  cv.addEventListener('touchstart', (e) => { const t = e.touches[0]; tch = { x: t.clientX, y: t.clientY, cx: view.cam.x, cy: view.cam.y }; }, { passive: true });
  cv.addEventListener('touchmove', (e) => { if (!tch) return; const t = e.touches[0], dx = t.clientX - tch.x, dy = t.clientY - tch.y; if (Math.hypot(dx, dy) > 5) { view.follow = false; if (ptr) ptr.moved = true; view.cam.x = tch.cx - dx / S; view.cam.y = tch.cy - dy / S; clampCam(); } e.preventDefault(); }, { passive: false });
  cv.addEventListener('touchend', () => { tch = null; }, { passive: true });
  cv.addEventListener('wheel', (e) => { view.follow = false; view.cam.x += e.deltaX / S; view.cam.y += e.deltaY / S; clampCam(); e.preventDefault(); }, { passive: false });
  function tap(x, y) {
    if (fade) return;
    if (view.mode === 'overview') {
      let best = -1, bd = 1e9;
      OV.cs.forEach((c, k) => { const d = Math.hypot(x - c.x, y - (c.y - 6)); if (d < c.R * 0.66 && d < bd) { bd = d; best = k; } });
      if (best < 0) return;
      const c = OV.cs[best];
      if (c.teaser) toast(c.teaser.name + ': en ny kontinent som kommer senare.');
      else if (!unlocked(best)) toast(worlds[best].name + ' is locked. Finish ' + worlds[best - 1].name + ' first.');
      else setView('world', best);
    } else {
      const m = getWorld(view.world), w = worlds[view.world];
      let best = -1, side = -1, bd = 1e9;
      m.pts.forEach((p, i) => { const tp = w.nodes[i].type, big = tp === 'boss', mini = tp === 'mini', d = Math.hypot(x - p.x, y - (p.y - (big ? 8 : mini ? 5 : 2))); if (d < (big ? 18 : mini ? 15 : 13) && d < bd) { bd = d; best = i; } });
      m.sides.forEach((p, j) => { const d = Math.hypot(x - p.x, y - (p.y - 5)); if (d < 15 && d < bd) { bd = d; side = j; } });
      if (side >= 0) openCard(-1, side); else if (best >= 0) openCard(best); else closeCard();
    }
  }
  $('#back').onclick = () => setView('overview');
  $('#demo').onclick = () => { if (view.mode !== 'world' && curWorld() >= 0) setView('world', curWorld()); };
  $('#reset').onclick = () => { resetState(); unlockAnim = owalk = walk = null; busy = false; demoCount = 0; updateHud(); toast('Demon är nollställd.'); };
  $('#card .close').onclick = closeCard;
  // Bossens ordmätare är stängd: knappen leder till banan där flest ord kan växa (spelets skal väljer banan).
  $('#card .practice').onclick = () => { const k = view.world; closeCard(); if (window.parent && window.parent.GAME && window.parent.GAME.practice) window.parent.GAME.practice(k); };
  $('#card .play').onclick = () => {
    const k = view.world, i = cardNode, sj = cardSide, w = worlds[k]; closeCard();
    if (!window.parent || !window.parent.GAME) return;
    if (sj >= 0) window.parent.GAME.play(k, w.side[sj].slot, w.side[sj], false); else window.parent.GAME.play(k, i, w.nodes[i], !!state.done[w.id][i]);
  };

  // ---------- start ----------
  // Största av de två måtten: vissa webbläsarlägen rapporterar en för liten innerHeight.
  const vpW = () => Math.max(window.innerWidth, document.documentElement.clientWidth), vpH = () => Math.max(window.innerHeight, document.documentElement.clientHeight);
  let rz = 0, builtW = 0, builtH = 0;
  function resize() {
    const cwid = vpW(), chei = vpH(); builtW = cwid; builtH = chei;
    S = Math.min(cwid, chei) < 500 ? 2 : Math.min(cwid, chei) < 1000 ? 3 : 4;
    vw = Math.ceil(cwid / S); vh = Math.ceil(chei / S);
    cv.width = vw; cv.height = vh; cv.style.width = vw * S + 'px'; cv.style.height = vh * S + 'px';
    ctx.imageSmoothingEnabled = false;
    for (const k in WV) delete WV[k];
    OV = buildOverview();
    if (view.mode === 'world') centerOn(heroPos(), true); else { view.cam.x = 0; view.cam.y = Math.max(0, OV.H - vh); }
    clampCam(); updateHud();
  }
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 120); });
  resetState();
  // Spelets skal (game/index.html) äger tillståndet och läser in det här.
  function load(done, gold) {
    worlds.forEach((w) => { const d = (done && done[w.id]) || []; state.done[w.id] = w.nodes.map((nd, i) => d[i] || 0); passMinis(w); });
    state.gold = gold || 0; unlockAnim = owalk = walk = null; busy = false; try { updateHud(); } catch (e) {}
  }
  function finish(k, i, stars) {
    const w = worlds[k];
    if (i === curNode(w)) { if (view.mode !== 'world' || view.world !== k) setView('world', k, true); completeCurrent(stars); }
    else { state.done[w.id][i] = Math.max(state.done[w.id][i], stars || 1); passMinis(w); updateHud(); }
  }
  function setInfo(info) { INFO = info || null; if ((cardNode >= 0 || cardSide >= 0) && view.mode === 'world') openCard(cardNode, cardSide); }
  // Visar en viss bana: byter till världen, ställer kameran på noden och öppnar dess ruta.
  function focus(k, i) {
    setView('world', k, true);
    const p = getWorld(k).pts[i]; if (!p) return;
    view.follow = false; centerOn({ x: p.x, y: p.y + vh * 0.24 }, true); openCard(i);      // noden hamnar ovanför rutan, inte bakom den
  }
  load({}, 0);
  resize();
  if (qs.get('view') === 'world') setView('world', PX.clamp(+qs.get('w') || 0, 0, worlds.length - 1), true);
  if (qs.get('card')) openCard(+qs.get('card'));
  // setInterval i stället för requestAnimationFrame: tickar även när rutan är dold.
  setInterval(frame, 50);
  frame();
  window.__map = { state, view, setView, completeCurrent, worlds, unlocked, load, finish, curWorld, curNode, updateHud, setHero, setInfo, focus, openCard, closeCard, world: (k) => getWorld(k), scale: () => S, story: STORY };
  if (window.parent && window.parent.GAME && window.parent.GAME.mapReady) window.parent.GAME.mapReady(window.__map);
})();
