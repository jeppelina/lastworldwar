// Pixelverktyg: brus, pixelbuffert, pixelfont och spritegeneratorer.
// All grafik ritas i kod. Ljuset kommer alltid snett uppifrån vänster.
(function () {
  'use strict';
  const PX = (window.PX = {});

  // ---------- slump och brus ----------
  PX.rng = function (a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  PX.hash2 = function (x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  PX.vnoise = function (x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = PX.hash2(xi, yi, s), b = PX.hash2(xi + 1, yi, s), c = PX.hash2(xi, yi + 1, s), d = PX.hash2(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  PX.fbm = function (x, y, s, o) {
    let a = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < (o || 3); i++) { a += PX.vnoise(x * f, y * f, s + i * 17) * amp; n += amp; amp *= 0.5; f *= 2; }
    return a / n;
  };
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  PX.bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  PX.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  PX.smooth = (a, b, v) => { const t = PX.clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  PX.rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  PX.mix = function (a, b, t) {
    const A = PX.rgb(a), B = PX.rgb(b);
    return '#' + [0, 1, 2].map((i) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join('');
  };

  // ---------- pixelbuffert ----------
  class Pix {
    constructor(w, h) { w = Math.ceil(w); h = Math.ceil(h); this.w = w; this.h = h; this.d = new Array(w * h).fill(null); }
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
    get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.d[y * this.w + x]; }
    rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
    // Skuggad ellips. tones går från mörkast till ljusast.
    disc(cx, cy, rx, ry, tones, dith) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x - cx) / rx, ny = (y - cy) / ry;
          if (nx * nx + ny * ny > 1) continue;
          const l = (-nx * 0.55 - ny * 0.8) * 0.5 + 0.5;
          const k = PX.clamp(Math.floor(l * tones.length + (PX.bayer(x, y) - 0.5) * (dith == null ? 0.7 : dith)), 0, tones.length - 1);
          this.set(x, y, tones[k]);
        }
    }
    outline(c) {
      const add = [];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * this.w + x);
      }
      for (const i of add) this.d[i] = c;
      return this;
    }
    blit(o, ox, oy) { for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) { const c = o.d[y * o.w + x]; if (c) this.set(ox + x, oy + y, c); } }
    canvas() {
      const cv = document.createElement('canvas'); cv.width = this.w; cv.height = this.h;
      const g = cv.getContext('2d');
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) { const c = this.d[y * this.w + x]; if (c) { g.fillStyle = c; g.fillRect(x, y, 1, 1); } }
      return cv;
    }
  }
  PX.Pix = Pix;
  PX.ascii = function (rows, pal, pad) {
    const w = Math.max(...rows.map((r) => r.length)) + (pad ? 2 : 0), p = new Pix(w, rows.length + (pad ? 2 : 0));
    rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) { const c = pal[r[x]]; if (c) p.set(x + (pad ? 1 : 0), y + (pad ? 1 : 0), c); } });
    return p;
  };
  // Gör en sprite: ankare längst ner i mitten om inget annat anges.
  PX.spr = function (pix, o) {
    o = o || {};
    return Object.assign({ cv: pix.canvas(), w: pix.w, h: pix.h, ax: Math.floor(pix.w / 2), ay: pix.h - 1, sh: pix.w * 0.42 }, o);
  };
  PX.tint = function (cv, color, alpha) {
    const c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
    const g = c.getContext('2d'); g.drawImage(cv, 0, 0);
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = alpha; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
    return c;
  };

  // ---------- pixelfont 5x7 (versaler, svenska tecken) ----------
  const F = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#', B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.###./#...#/#..../#..../#..../#...#/.###.', D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####', F: '#####/#..../#..../####./#..../#..../#....',
    G: '.###./#...#/#..../#.###/#...#/#...#/.###.', H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '###/.#./.#./.#./.#./.#./###', J: '..###/...#./...#./...#./...#./#..#./.##..',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#', L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#', N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.', P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#', R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.', T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.', V: '#...#/#...#/#...#/#...#/.#.#./.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#', X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..', Z: '#####/....#/...#./..#../.#.../#..../#####',
    'Å': '..#../.#.#./..#../.###./#...#/#...#/#####/#...#/#...#', 'Ä': '.#.#./...../.###./#...#/#...#/#####/#...#/#...#/#...#',
    'Ö': '.#.#./...../.###./#...#/#...#/#...#/#...#/#...#/.###.',
    0: '.###./#...#/#..##/#.#.#/##..#/#...#/.###.', 1: '.#./##./.#./.#./.#./.#./###',
    2: '.###./#...#/....#/...#./..#../.#.../#####', 3: '####./....#/....#/.###./....#/....#/####.',
    4: '...#./..##./.#.#./#..#./#####/...#./...#.', 5: '#####/#..../####./....#/....#/#...#/.###.',
    6: '.###./#..../#..../####./#...#/#...#/.###.', 7: '#####/....#/...#./..#../..#../..#../..#..',
    8: '.###./#...#/#...#/.###./#...#/#...#/.###.', 9: '.###./#...#/#...#/.####/....#/....#/.###.',
    ' ': '../../../../../../..', '?': '.###./#...#/....#/...#./..#../...../..#..', '!': '#/#/#/#/#/./#',
    '/': '..#/..#/.#./.#./.#./#../#..', '-': '.../.../.../###/.../.../...', '.': './././././#/#', ':': './#/#/./#/#/.',
    '+': '.../.../.#./###/.#./.../...'
  };
  const textCache = new Map();
  // Returnerar en canvas med texten, 1 px mörk kontur runt om.
  PX.text = function (str, color, shadow) {
    str = String(str).toUpperCase();
    const key = str + '|' + color + '|' + shadow;
    if (textCache.has(key)) return textCache.get(key);
    const gl = [...str].map((ch) => (F[ch] || F['?']).split('/'));
    const w = gl.reduce((a, g) => a + g[0].length + 1, 0) + 1;
    const p = new Pix(w, 11);
    let x = 1;
    for (const g of gl) { const off = 10 - g.length; for (let r = 0; r < g.length; r++) for (let c = 0; c < g[r].length; c++) if (g[r][c] === '#') p.set(x + c, r + off, color); x += g[0].length + 1; }
    if (shadow) p.outline(shadow);
    const cv = p.canvas(); textCache.set(key, cv); return cv;
  };

  // ---------- generatorer för naturföremål ----------
  // Lövträd: tre överlappande klot + stam. P = { leaf:[4 toner], trunk, o }
  PX.treeRound = function (P, r) {
    const w = r * 2 + 5, h = r * 2 + 6, p = new Pix(w, h), cx = r + 2;
    p.rect(cx - 1, h - 5, r > 4 ? 3 : 2, 4, P.trunk); p.set(cx + (r > 4 ? 1 : 0), h - 3, P.trunkD || P.trunk); p.set(cx + (r > 4 ? 1 : 0), h - 2, P.trunkD || P.trunk);
    if (r >= 4) { p.disc(cx - r * 0.55, r * 1.35 + 1, r * 0.62, r * 0.62, P.leaf); p.disc(cx + r * 0.6, r * 1.4 + 1, r * 0.6, r * 0.6, P.leaf); }
    p.disc(cx, r + 1, r, r * 0.95, P.leaf);
    p.outline(P.o);
    return PX.spr(p, { sh: r * 0.95 });
  };
  // Gran i tre våningar. P = { l, m, d, dd, trunk, o, snowL, snowD }
  PX.pine = function (P, h, snow) {
    const tiers = 3, th = Math.max(2, Math.floor((h - 2) / tiers)), maxhw = Math.floor(h * 0.3) + 1;
    const w = maxhw * 2 + 3, p = new Pix(w, tiers * th + 4), cx = maxhw + 1;
    for (let j = 0; j < tiers * th; j++) {
      const tier = Math.floor(j / th), jj = j % th;
      let hw = Math.round((0.3 + (jj / Math.max(1, th - 1)) * 0.7) * maxhw * (tier + 1.3) / (tiers + 0.3));
      if (j === 0) hw = 0;
      for (let x = -hw; x <= hw; x++) {
        let c = x < 0 ? P.l : x === 0 ? P.m : P.d;
        if (jj === th - 1 && x > -hw + 1) c = x < 0 ? P.m : P.dd;
        if (snow && (jj === 0 || (jj === 1 && x <= 0) || j < 2)) c = x <= 0 ? P.snowL : P.snowD;
        p.set(cx + x, j + 1, c);
      }
    }
    p.rect(cx - 1, tiers * th + 1, 2, 2, P.trunk);
    p.outline(P.o);
    return PX.spr(p, { sh: maxhw * 0.9 });
  };
  // En bergstopp ritad in i en buffert. P = { l, m, d, o, sl, sd }
  PX.peak = function (p, cx, by, w, h, P, snowH, r) {
    let ridge = 0;
    for (let j = 0; j < h; j++) {
      const y = by - h + 1 + j, t = j / Math.max(1, h - 1);
      const hw = Math.max(0, Math.round(t * (w / 2) + (j > 2 ? (r() - 0.5) * 1.8 : 0)));
      if (j % 2 === 1) ridge += r() < 0.5 ? -1 : 1;
      const lim = Math.floor(hw * 0.35); ridge = PX.clamp(ridge, -lim, lim);
      const xr = cx + ridge + Math.floor(t * w * 0.07);
      for (let x = cx - hw; x <= cx + hw; x++) {
        const lit = x <= xr, hs = PX.hash2(x, y, 5);
        const snowy = j < snowH + (((x * 7 + 3) % 5) < 2 ? 2 : 0) + (lit ? 1 : -1);
        let c;
        if (x === cx - hw || x === cx + hw) c = P.o;
        else if (snowy) c = lit ? P.sl : P.sd;
        else if (x === xr + 1) c = P.d;
        else c = lit ? (hs < 0.16 ? P.m : P.l) : (hs < 0.14 ? P.m : P.d);
        p.set(x, y, c);
      }
    }
    p.set(cx, by - h, P.o);
  };
  // Bergskedja med en till tre toppar.
  PX.mountain = function (P, w, h, snow, seed, n) {
    const r = PX.rng(seed), p = new Pix(w + 4, h + 2);
    n = n || 1;
    if (n >= 3) PX.peak(p, 2 + w * 0.76, h + 1, w * 0.46, h * 0.62, P, snow * 0.4, r);
    PX.peak(p, 2 + (n > 1 ? w * 0.42 : w * 0.5), h + 1, n > 1 ? w * 0.78 : w, h, P, snow, r);
    if (n >= 2) PX.peak(p, 2 + w * 0.2, h + 1, w * 0.4, h * 0.5, P, snow * 0.3, r);
    return PX.spr(p, { sh: w * 0.46 });
  };
  // Vulkan: stympad topp med lavakrater och lavaström. Får en rökkälla (emit).
  PX.volcano = function (P, w, h, seed) {
    const r = PX.rng(seed), p = new Pix(w + 4, h + 2), cx = 2 + Math.floor(w / 2), cut = Math.max(3, Math.floor(h * 0.24));
    PX.peak(p, cx, h + 1, w, h + cut, P, 0, r);
    for (let y = 0; y < 2; y++) for (let x = 0; x < p.w; x++) p.d[y * p.w + x] = null;
    // krater
    const top = 2; let x0 = p.w, x1 = 0;
    for (let x = 0; x < p.w; x++) if (p.get(x, top + 1)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    for (let x = x0; x <= x1; x++) { p.set(x, top, P.o); p.set(x, top + 1, x === x0 || x === x1 ? P.o : (x + 1) % 2 ? '#ffd04a' : '#ff8c1e'); }
    let lx = cx - 1;
    for (let y = top + 2; y < top + 2 + h * 0.55; y++) { p.set(lx, y, y % 2 ? '#ff8c1e' : '#ffd04a'); if (y % 3 === 0) p.set(lx + 1, y, '#d8480f'); if (r() < 0.45) lx -= 1; }
    return PX.spr(p, { sh: w * 0.46, emit: { x: 0, y: -(h - 1), kind: 'smoke' } });
  };
  PX.rock = function (tones, o, r) {
    const p = new Pix(r * 2 + 3, Math.round(r * 1.5) + 3);
    p.disc(r + 1, r * 0.75 + 1, r, r * 0.75, tones, 0.4); p.outline(o);
    return PX.spr(p, { sh: r });
  };
  PX.bush = function (tones, o, r) {
    const p = new Pix(r * 2 + 3, r * 2 + 2);
    p.disc(r + 1, r + 0.5, r, r * 0.85, tones); p.outline(o);
    return PX.spr(p, { sh: r * 0.9 });
  };
  // Svamp: skuggad hatt med prickar, ljus fot.
  PX.mushroom = function (P, r) {
    const sh = Math.max(2, Math.round(r * 0.9)), w = r * 2 + 3, p = new Pix(w, r + sh + 3), cx = r + 1;
    const sw = Math.max(1, Math.round(r * 0.35));
    for (let y = 0; y < sh; y++) for (let x = -sw; x <= sw; x++) p.set(cx + x, r + 1 + y, x > 0 ? P.stemD : P.stem);
    for (let y = 0; y <= r; y++) for (let x = -r; x <= r; x++) {
      const nx = x / r, ny = (y - r) / (r * 0.95);
      if (nx * nx + ny * ny > 1) continue;
      const l = (-nx * 0.55 - ny * 0.8) * 0.5 + 0.5;
      p.set(cx + x, y + 1, P.cap[PX.clamp(Math.floor(l * P.cap.length + (PX.bayer(x + 8, y) - 0.5) * 0.6), 0, P.cap.length - 1)]);
    }
    for (let x = -r + 1; x < r; x++) p.set(cx + x, r + 1, P.gill);
    const spots = r > 6 ? [[-0.5, 0.45], [0.2, 0.25], [0.55, 0.6], [-0.15, 0.75], [-0.75, 0.8]] : [[-0.4, 0.5], [0.35, 0.55]];
    for (const s of spots) { const sx = cx + Math.round(s[0] * r), sy = 1 + Math.round(s[1] * r); p.set(sx, sy, P.spot); if (r > 4) { p.set(sx + 1, sy, P.spot); } if (r > 7) { p.set(sx, sy + 1, P.spot); p.set(sx + 1, sy + 1, P.spot); } }
    p.outline(P.o);
    return PX.spr(p, { sh: r * 0.8 });
  };
  PX.iceSpike = function (P, w, h, seed) {
    const r = PX.rng(seed), p = new Pix(w + 3, h + 2), cx = 1 + Math.floor(w / 2);
    for (let j = 0; j < h; j++) {
      const t = j / Math.max(1, h - 1), hw = Math.round(t * t * 0.4 * w / 2 + t * 0.6 * w / 2);
      for (let x = -hw; x <= hw; x++) p.set(cx + x, j + 1, x < 0 ? (PX.hash2(x, j, seed) < 0.2 ? P.hi : P.l) : x === 0 ? P.hi : P.d);
    }
    if (r() < 0.6) for (let j = 0; j < h * 0.5; j++) { const hw = Math.round((j / (h * 0.5)) * w * 0.25); for (let x = -hw; x <= hw; x++) p.set(cx + Math.round(w * 0.32) + x, Math.round(h * 0.5) + j + 1, x <= 0 ? P.l : P.d); }
    p.outline(P.o);
    return PX.spr(p, { sh: w * 0.45 });
  };
  // Moln: bulor på en platt botten. tones = [skugga, ljus, ljus...]
  PX.cloud = function (tones, w, h, o) {
    const p = new Pix(w, h);
    const b = [[0.22, 0.2], [0.48, 0.3], [0.74, 0.22], [0.36, 0.24], [0.62, 0.26]];
    for (const [fx, fr] of b) { const rr = Math.min(fr * w, h * 0.62); p.disc(fx * w, h - 2 - rr * 0.45, rr, rr * 0.9, tones, 0.3); }
    for (let x = 2; x < w - 2; x++) { if (p.get(x, h - 3)) { p.set(x, h - 2, tones[0]); } }
    for (let x = 0; x < w; x++) p.d[(h - 1) * w + x] = null;
    if (o) p.outline(o);
    return PX.spr(p, { sh: 0 });
  };
  function tower(p, x, y, w, h, L, D) { p.rect(x, y, w, h, L); p.rect(x + Math.ceil(w * 0.55), y, w - Math.ceil(w * 0.55), h, D); }
  function cone(p, cx, y, hw, h, L, D) {
    for (let j = 0; j < h; j++) { const ww = Math.round(((j + 1) / h) * hw); for (let x = -ww; x <= ww; x++) p.set(cx + x, y + j, x <= 0 ? L : D); }
  }
  // Slott på ett moln (landmärke för molnvärlden).
  PX.castle = function () {
    const p = new Pix(35, 33), L = '#f6f0ff', D = '#c6b6e4', RL = '#f0558a', RD = '#b02e66', K = '#4a3470';
    tower(p, 9, 15, 17, 10, L, D);
    for (let x = 9; x < 26; x += 2) p.set(x, 14, x < 18 ? L : D);
    tower(p, 5, 10, 7, 15, L, D); tower(p, 23, 10, 7, 15, L, D); tower(p, 14, 6, 7, 13, L, D);
    cone(p, 8, 4, 4, 6, RL, RD); cone(p, 26, 4, 4, 6, RL, RD); cone(p, 17, 0, 4, 6, RL, RD);
    p.set(8, 3, '#ffd84a'); p.set(26, 3, '#ffd84a');
    [[7, 13], [25, 13], [17, 9], [7, 18], [25, 18], [16, 13], [18, 13]].forEach(([x, y]) => { p.set(x, y, K); p.set(x, y + 1, K); });
    p.rect(16, 20, 3, 5, K); p.set(17, 19, K);
    p.outline(K);
    const c = PX.cloud(['#d9c6ee', '#ffffff', '#ffffff'], 35, 13);
    const q = new Pix(35, 33); q.blit(p, 0, 1);
    const cp = new Pix(35, 13); const g = c.cv.getContext('2d').getImageData(0, 0, 35, 13).data;
    for (let i = 0; i < 35 * 13; i++) if (g[i * 4 + 3]) cp.d[i] = '#' + [0, 1, 2].map((k) => g[i * 4 + k].toString(16).padStart(2, '0')).join('');
    q.blit(cp, 0, 21);
    return PX.spr(q, { sh: 0 });
  };
  PX.pyramid = function (P, hw) {
    const p = new Pix(hw * 2 + 3 + Math.floor(hw * 0.9), hw + 3), cx = hw + 1;
    const one = (cx, by, hw) => {
      for (let j = 0; j <= hw; j++) for (let x = -j; x <= j; x++) {
        const lit = x < Math.floor(j * 0.3);
        let c = lit ? (j % 3 === 2 ? P.m : P.l) : (j % 3 === 2 ? P.dd : P.d);
        if (x === -j || x === j) c = P.o;
        p.set(cx + x, by - hw + j, c);
      }
      p.set(cx, by - hw - 1, P.o);
    };
    one(cx + hw + Math.floor(hw * 0.25), hw + 2, Math.floor(hw * 0.55));
    one(cx, hw + 2, hw);
    return PX.spr(p, { sh: hw, ax: cx });
  };

  // ---------- gemensamma sprites (noder, hjälte, ikoner) ----------
  const O = '#1b1630';
  function disc3(tones, side, rim) {
    const p = new Pix(17, 15);
    for (let y = 0; y < 3; y++) p.disc(8, 7.5 + y, 7, 4.6, [side], 0);
    p.disc(8, 6.4, 7, 4.6, [rim], 0);
    p.disc(8, 6.4, 5.4, 3.3, tones, 0.3);
    p.outline(O);
    return PX.spr(p, { ax: 8, ay: 8 });
  }
  function skull() {
    const p = new Pix(25, 26), bone = ['#8c86a0', '#c4bed6', '#ece8f6', '#ffffff'];
    // sockel av mörk sten
    p.disc(12, 21, 11, 4, ['#2a2236', '#3c3350', '#54496c'], 0.4);
    p.rect(3, 19, 19, 3, '#3c3350'); p.rect(13, 19, 9, 3, '#2a2236');
    // horn
    const hl = '#d64545', hd = '#8e2230';
    [[5, 7], [4, 6], [3, 5], [3, 4], [2, 3], [2, 2], [2, 1]].forEach(([x, y], i) => { p.set(x, y, hl); if (i < 5) p.set(x + 1, y, hd); });
    [[19, 7], [20, 6], [21, 5], [21, 4], [22, 3], [22, 2], [22, 1]].forEach(([x, y], i) => { p.set(x, y, hd); if (i < 5) p.set(x - 1, y, hl); });
    // skalle och käke
    p.rect(8, 14, 9, 5, bone[1]); p.rect(13, 14, 4, 5, bone[0]);
    p.disc(12, 9.5, 7.4, 6.6, bone, 0.5);
    for (let x = 9; x <= 15; x += 2) { p.set(x, 17, O); p.set(x, 18, O); }
    p.rect(7, 9, 4, 4, O); p.rect(14, 9, 4, 4, O); p.set(12, 13, O); p.set(12, 14, O); p.set(11, 14, O);
    p.outline(O);
    return PX.spr(p, { ax: 12, ay: 21, eyes: [[8, 10], [15, 10]] });
  }
  // Minispelets skylt på kartan: ett randigt tält med en stjärna på toppen och en gnista i öppningen.
  function tent() {
    const p = new Pix(21, 20), a = '#7a4cf0', b = '#ffd84a';
    p.set(10, 1, '#fff3a8'); p.rect(9, 2, 3, 1, '#ffd84a'); p.set(10, 2, '#ffffff'); p.set(10, 3, '#ffd84a'); p.set(10, 4, '#f4e3b0');
    for (let j = 0; j < 6; j++) { const hw = Math.floor(1 + j * 1.4); for (let x = -hw; x <= hw; x++) p.set(10 + x, 5 + j, ((Math.abs(x) + 1) >> 1) & 1 ? b : a); }
    for (let x = -8; x <= 8; x++) p.set(10 + x, 11, ((Math.abs(x) + 1) >> 1) & 1 ? '#c8861c' : '#4f2fb0');
    p.rect(4, 12, 13, 6, '#f4ead0'); p.rect(13, 12, 4, 6, '#d4c4a0');
    p.rect(8, 13, 5, 5, '#2a2046');
    p.set(10, 14, '#fff3a8'); p.set(9, 15, '#ffd84a'); p.set(10, 15, '#ffffff'); p.set(11, 15, '#ffd84a'); p.set(10, 16, '#fff3a8');
    p.outline(O);
    return PX.spr(p, { ax: 10, ay: 16 });
  }
  PX.buildCommon = function () {
    const C = {};
    C.nodeDone = disc3(['#e09a20', '#f8c030', '#ffdc50', '#fff6b8'], '#9a5c14', '#fff3a8');
    C.nodeCur = disc3(['#c02a20', '#e8412f', '#ff6a50', '#ffc2b0'], '#7e1410', '#ffffff');
    C.nodeLock = disc3(['#565668', '#6a6a82', '#80809a', '#9898b2'], '#3c3c4e', '#b0b0c8');
    C.skull = skull();
    C.skullDark = Object.assign({}, C.skull, { cv: PX.tint(C.skull.cv, '#0e0a1c', 0.62) });
    C.skullDone = Object.assign({}, C.skull, { cv: PX.tint(C.skull.cv, '#8a7a5a', 0.45) });
    const chestPal = { o: O, W: '#c47a30', D: '#86501e', y: '#ffd84a', Y: '#c8861c', k: '#3a2410' };
    C.chest = PX.spr(PX.ascii(['.ooooooooo.', 'oWWWWWWWWDo', 'oyyyyyyyyYo', 'oWWWWWWWWDo', 'ooooyYooooo', 'oWWWyYWWWDo', 'oWWWWWWWWDo', 'oDDDDDDDDDo', '.ooooooooo.'], chestPal), { ay: 6 });
    C.chestOpen = PX.spr(PX.ascii(['.ooooooooo.', 'oWWWWWWWWDo', 'ooooooooooo', 'okyYyyyYyko', 'ooooooooooo', 'oWWWyYWWWDo', 'oWWWWWWWWDo', 'oDDDDDDDDDo', '.ooooooooo.'], chestPal), { ay: 6 });
    C.chestDark = Object.assign({}, C.chest, { cv: PX.tint(C.chest.cv, '#14102a', 0.6) });
    C.tent = tent();
    C.tentDark = Object.assign({}, C.tent, { cv: PX.tint(C.tent.cv, '#14102a', 0.6) });
    C.lock = PX.spr(PX.ascii(['..ooo..', '.oyyyo.', '.oy.yo.', 'ooooooo', 'oyyyyyo', 'oyyoyyo', 'oyyyyyo', 'ooooooo'], { o: O, y: '#c9c9de' }), { ay: 4 });
    C.star = PX.spr(PX.ascii(['..y..', '.yyy.', 'yyYyy', '.yYy.', '.y.y.'], { y: '#ffd84a', Y: '#fff3a8' }, true).outline(O));
    C.starOff = PX.spr(PX.ascii(['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'], { y: '#4a4660' }, true).outline(O));
    C.coin = PX.spr(PX.ascii(['.yyy.', 'yYYyd', 'yYyyd', 'yyydd', '.ddd.'], { y: '#ffd84a', Y: '#fff3a8', d: '#c8861c' }, true).outline(O));
    const hp = { o: O, r: '#ff4a3a', h: '#e4e8f4', H: '#98a2c0', f: '#f6cfa6', c: '#3a78f0', C: '#2450b8', s: '#ffffff', S: '#aab4d0', b: '#6a4426', y: '#ffd84a', Y: '#c8861c' };
    C.hero = [0, 1].map((f) => PX.spr(PX.ascii([
      '....rr.....', '...orro....', '..ohhhHo...', '.ohhhhHHo..', '.ohffffHo.s', '.ohfofoHo.s', '..offffo..s', '.occccCCo.s', 'oyYoccCCoos', 'oyYocCCofSo', '.oooccCo.o.',
      f ? '..obo.oBo..' : '..oboooBo..', f ? '..oo...oo..' : '..oo..oo...'
    ], hp).outline(O), { ax: 5, ay: 12 }));
    C.flag = [0, 1].map((f) => PX.spr(PX.ascii(f ? ['k', 'krrrr.', 'krrrrr', 'k.rrrr', 'k', 'k', 'k', 'k'] : ['k', 'k.rrrr', 'krrrrr', 'krrrr.', 'k', 'k', 'k', 'k'], { k: '#f4e3b0', r: '#ff4a3a' }, true).outline(O), { ax: 1, ay: 8 }));
    C.arrow = PX.spr(PX.ascii(['yyyyy', '.yyy.', '..y..'], { y: '#fff3a8' }, true).outline(O), { ay: 4 });
    C.cloud = [PX.cloud(['#c8d8f0', '#ffffff', '#ffffff'], 30, 12), PX.cloud(['#c8d8f0', '#ffffff', '#ffffff'], 22, 9), PX.cloud(['#c8d8f0', '#ffffff', '#ffffff'], 40, 14)];
    C.cloudShadow = C.cloud.map((c) => PX.tint(c.cv, '#0a0a28', 1));
    C.fogPuff = C.cloud.map((c) => PX.tint(c.cv, '#3a4270', 0.72));
    C.ash = [30, 22, 40].map((w, i) => PX.cloud(['#3c2e3c', '#5e4e5c', '#74626e'], w, [12, 9, 14][i]).cv);
    return C;
  };
})();
