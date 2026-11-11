// Stridsbakgrunder: sex biomer ritade i lager (himmel, avlägsna siluetter, mellanplan, mark, kantrekvisita).
// Allt ritas med exakta hexfärger (rampnivå 3) utan kontur och kantljus, utom ett par små förgrundsdelar
// i vänsterkanten. Storlekar i pixlar är i stort sett fasta, antalet föremål växer med ytan, så att
// ett utzoomat läge visar mer värld, inte större träd. Avlägsna lager skalas svagt med höjden (ks).
import { G, ramp } from './pixel.js';

// ---------- Småverktyg ----------
const B4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => (B4[((y & 3) << 2) | (x & 3)] + 0.5) / 16;      // ordnat raster 4x4
const fract = (v) => v - Math.floor(v);
const hash = (i, s = 0) => fract(Math.sin(i * 127.1 + s * 311.7 + 1.3) * 43758.5453);
const hash2 = (x, y, s = 0) => fract(Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453);
const vn = (x, s) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i, s) * (1 - u) + hash(i + 1, s) * u; };
const fbm = (x, s, oct = 3) => { let a = 0, w = 0, amp = 1; for (let o = 0; o < oct; o++) { a += vn(x * (1 << o), s + o * 17) * amp; w += amp; amp *= 0.5; } return a / w; };
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mod = (a, b) => ((a % b) + b) % b;

const MIX = new Map();
function mix(a, b, t) {
  const key = a + b + t.toFixed(3);
  let v = MIX.get(key);
  if (!v) {
    const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
    const ch = (sh) => Math.round(((A >> sh) & 255) + ((((B >> sh) & 255) - ((A >> sh) & 255)) * t));
    v = '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
    MIX.set(key, v);
  }
  return v;
}

// ---------- Målaren: gemensamma lagerfunktioner ----------
function painter(g, W, H, gy, seed, salt) {
  let a = (Math.imul((seed | 0) + 1, 0x9e3779b1) ^ Math.imul(salt + 7, 0x85ebca6b)) >>> 0;
  const rnd = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < 3; i++) rnd();
  const R = (lo, hi) => lo + (hi - lo) * rnd();
  const k = H / 108, n = W / 192, ks = Math.pow(k, 0.7);
  const gTop = gy - Math.round(9 + 3 * k);          // markplanets bortre kant (horisonten)
  const S = (x, y, c) => g.set(Math.round(x), Math.round(y), c, 3);
  const p = {
    g, W, H, gy, gTop, k, n, ks, area: k * n, rnd, R, S,
    flat(y) { return new Float32Array(W).fill(y); },
    // Himmel: N band mellan färgstoppen, med rastrerad övergång mellan banden.
    sky(stops, y1, N = 9) {
      const cols = [];
      for (let i = 0; i < N; i++) { const f = (i / (N - 1)) * (stops.length - 1), j = Math.min(Math.floor(f), stops.length - 2); cols.push(ramp(mix(stops[j], stops[j + 1], f - j))); }
      for (let y = 0; y < y1; y++) {
        const f = Math.max(0, (y / y1) * N - 0.5), i = Math.floor(f), t = (f - i - 0.2) / 0.6;
        for (let x = 0; x < W; x++) g.set(x, y, cols[Math.min(N - 1, t > bay(x, y) ? i + 1 : i)], 3);
      }
    },
    // Höjdprofil ur brus. Returnerar y för överkanten per kolumn.
    ridge(base, amp, wl, oct = 3, ridged = false) {
      const s = rnd() * 999, top = new Float32Array(W);
      for (let x = 0; x < W; x++) { let v = fbm(x / wl, s, oct); if (ridged) v = 1 - Math.abs(v * 2 - 1); top[x] = base - amp * v; }
      return top;
    },
    bump(top, cx, cy, r) {
      for (let x = Math.max(0, Math.ceil(cx - r)); x <= Math.min(W - 1, Math.floor(cx + r)); x++) { const dx = x - cx, y = cy - Math.sqrt(r * r - dx * dx); if (y < top[x]) top[x] = y; }
    },
    // Fyller från profilen ner till yb. rim: överkantsrad. lit/shade: sluttningsljus de översta sd raderna.
    // haze + hazeH: rastreras mot disfärg nertill.
    fill(top, yb, hex, o = {}) {
      const c = ramp(hex), rim = o.rim ? ramp(o.rim) : -1, lit = o.lit ? ramp(o.lit) : -1, sh = o.shade ? ramp(o.shade) : -1;
      const hz = o.haze ? ramp(o.haze) : -1, hh = o.hazeH || 1, sd = o.sd || 3;
      for (let x = 0; x < W; x++) {
        const y0 = Math.round(top[x]), sl = top[Math.min(W - 1, x + 1)] - top[Math.max(0, x - 1)];
        for (let y = Math.max(0, y0); y < yb; y++) {
          const d = y - y0; let cc = c;
          if (d < sd * (0.45 + 0.6 * bay(x, y))) { if (sl > 0.35 && sh >= 0) cc = sh; else if (sl < -0.35 && lit >= 0) cc = lit; }
          if (d === 0 && rim >= 0 && sl <= 0.35) cc = rim;
          if (hz >= 0 && yb - y <= hh && bay(x, y) > (yb - y) / hh) cc = hz;
          g.set(x, y, cc, 3);
        }
      }
    },
    // Berg, pyramid, mesa eller isberg: topp i (px, py), toppbredd tw, lutningar sl/sr, ljus och skuggsida.
    mountain(px, py, yb, o) {
      const lit = ramp(o.lit), sh = ramp(o.shade), sn = o.snow ? ramp(o.snow) : -1, ss = o.snow ? ramp(o.snowShade || o.snow) : -1;
      const st = o.strata ? ramp(o.strata) : -1, hz = o.haze ? ramp(o.haze) : -1, hh = o.hazeH || 1;
      const s1 = rnd() * 999, tw = o.tw || 0, sl = o.sl || 1, sr = o.sr || 1, rough = o.rough ?? 2, cv = o.curve || 0, zig = o.zig ?? 1, capH = o.capH || 0, dv = o.div ?? 0.22;
      for (let y = Math.max(0, Math.round(py)); y < yb; y++) {
        const d = y - py, e = Math.min(1, d / 6);
        const xl = Math.round(px - tw / 2 - d * sl - cv * d * d + (vn(y * 0.3, s1) - 0.5) * rough * 2 * e);
        const xr = Math.round(px + tw / 2 + d * sr + cv * d * d + (vn(y * 0.3, s1 + 50) - 0.5) * rough * 2 * e);
        const xd = px + tw * 0.2 + d * dv * sr + zig * ((((y >> 1) & 1) ? 1.5 : -1.5) + (vn(y * 0.45, s1 + 90) - 0.5) * 5) * e;
        const strat = st >= 0 && (Math.round(d) % (o.strataStep || 5)) === (o.strataStep || 5) - 1;
        for (let x = Math.max(0, xl); x <= Math.min(W - 1, xr); x++) {
          const L = x < xd; let c = L ? lit : sh;
          if (strat && (L || (x & 1))) c = L ? st : sh;
          if (sn >= 0 && d < capH * (0.6 + 0.8 * vn(x * 0.35, s1 + 7)) + ((x >> 1) & 1)) c = L ? sn : ss;
          if (hz >= 0 && yb - y <= hh && bay(x, y) > (yb - y) / hh) c = hz;
          g.set(x, y, c, 3);
        }
      }
    },
    // Stackmoln med platt botten.
    cloud(cx, by, w, h, o) {
      const top = ramp(o.top), body = ramp(o.body), sh = ramp(o.shade), nC = Math.max(3, Math.round(w / 7)), cs = [];
      for (let i = 0; i < nC; i++) { const u = i / (nC - 1); cs.push([cx - w / 2 + u * w, h * (0.34 + 0.66 * Math.sin(u * Math.PI)) * R(0.75, 1.1)]); }
      for (let x = Math.max(0, Math.floor(cx - w / 2 - h)); x <= Math.min(W - 1, Math.ceil(cx + w / 2 + h)); x++) {
        let t = Infinity;
        for (const [ccx, r] of cs) { const dx = x - ccx; if (Math.abs(dx) < r) t = Math.min(t, by - r * 0.45 - Math.sqrt(r * r - dx * dx)); }
        if (t === Infinity) continue;
        const y0 = Math.round(t), ys = by - Math.max(1, Math.round((by - y0) * 0.3)) - ((x >> 1) & 1);
        for (let y = Math.max(0, y0); y <= by; y++) g.set(x, y, y === y0 ? top : y > ys ? sh : body, 3);
      }
    },
    // Lövklump eller rökboll i tre toner med brusig tongräns.
    blob(cx, cy, rx, ry, cols, noise = 0.35) {
      const c = cols.map(ramp), s = rnd() * 99;
      for (let y = Math.max(0, Math.floor(cy - ry)); y <= Math.min(H - 1, Math.ceil(cy + ry)); y++)
        for (let x = Math.max(0, Math.floor(cx - rx)); x <= Math.min(W - 1, Math.ceil(cx + rx)); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d2 = dx * dx + dy * dy;
          if (d2 > 1 - (hash2(x, y, s) - 0.5) * noise * 0.5) continue;
          const v = -(dx * 0.5 + dy * 0.85) + (hash2(x, y, s + 3) - 0.5) * noise;
          g.set(x, y, c[v > 0.32 ? 0 : v < -0.3 ? 2 : 1], 3);
        }
    },
    disc(cx, cy, r, hex, dither = 1) {
      const c = ramp(hex);
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(H - 1, Math.ceil(cy + r)); y++)
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(W - 1, Math.ceil(cx + r)); x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          if (dx * dx + dy * dy <= r * r && (dither >= 1 || bay(x, y) < dither)) g.set(x, y, c, 3);
        }
    },
    rect(x, y, w, h, hex) { const c = ramp(hex); x = Math.round(x); y = Math.round(y); for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g.set(xx, yy, c, 3); },
    ln(x0, y0, x1, y1, hex) {
      const c = ramp(hex), st = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
      for (let i = 0; i <= st; i++) S(x0 + ((x1 - x0) * i) / st, y0 + ((y1 - y0) * i) / st, c);
    },
    // Lövträd: stam och tre lövklumpar.
    tree(cx, by, th, cr, cols, trunk) {
      p.rect(cx - 1, by - th, 2, th, trunk[0]); p.rect(cx + 1, by - th, 1, th, trunk[1]);
      p.blob(cx - cr * 0.55, by - th - cr * 0.25, cr * 0.75, cr * 0.65, cols);
      p.blob(cx + cr * 0.55, by - th - cr * 0.2, cr * 0.72, cr * 0.62, cols);
      p.blob(cx, by - th - cr * 0.85, cr * 0.9, cr * 0.75, cols);
    },
    // Gran i våningar, med snö på vänstersidan om c.snow finns.
    pine(cx, by, h, w, c) {
      const base = ramp(c.base), lo = ramp(c.lo), sn = c.snow ? ramp(c.snow) : -1, tiers = Math.max(3, Math.round(h / 9)), th = (h - 3) / tiers;
      p.rect(cx - 1, by - 3, 2, 3, c.trunk);
      for (let y = Math.round(by - h); y < by - 3; y++) {
        const d = y - (by - h), t = Math.floor(d / th), f = d / th - t, hw = (w / 2) * ((t + f) / tiers * 0.6 + 0.4) * (0.35 + 0.65 * f) + 0.5;
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++)
          S(x, y, sn >= 0 && x < cx + 1 && f < 0.42 ? sn : x > cx + hw * 0.25 || f > 0.8 ? lo : base);
      }
    },
    // Jättesvamp. c: { cap: [ljus, bas, skugga], spot, gill, stem, stemD }
    mush(cx, by, h, cw, c) {
      const cap = c.cap.map(ramp), spot = ramp(c.spot), gill = ramp(c.gill), st = ramp(c.stem), sd = ramp(c.stemD);
      const ch = cw * 0.45, sw = Math.max(1.5, cw * 0.1), lean = R(-0.1, 0.1), capY = by - h + ch, tx = cx + lean * (h - ch), rx = cw / 2;
      for (let y = Math.round(capY); y < by; y++) {
        const u = (by - y) / (h - ch), xc = cx + lean * (by - y), hw = sw * (1 + 0.7 * (1 - u) * (1 - u));
        for (let x = Math.round(xc - hw); x <= Math.round(xc + hw); x++) S(x, y, x > xc + hw * 0.2 ? sd : st);
      }
      const spots = []; for (let i = 0, m = 2 + Math.round(cw / 9); i < m; i++) spots.push([R(-0.75, 0.75), R(-0.85, -0.15), R(0.1, 0.2)]);
      for (let y = Math.floor(capY - ch); y <= Math.round(capY) + 1; y++)
        for (let x = Math.floor(tx - rx); x <= Math.ceil(tx + rx); x++) {
          const dx = (x + 0.5 - tx) / rx, dy = (y + 0.5 - capY) / ch;
          if (dy > 0) { if (Math.abs(dx) < 0.9 && dy < 2 / ch) S(x, y, gill); continue; }
          if (dx * dx + dy * dy > 1) continue;
          const v = -dx * 0.55 - (dy + 0.55) * 0.9; let cc = cap[v > 0.3 ? 0 : v < -0.28 ? 2 : 1];
          for (const [ux, uy, ur] of spots) { const ex = (dx - ux) / ur, ey = (dy - uy) / (ur * 1.3); if (ex * ex + ey * ey < 1) cc = spot; }
          S(x, y, cc);
        }
    },
    deadTree(cx, by, h, hex) {
      const top = by - h;
      p.rect(cx - 1, by - h * 0.5, 2, h * 0.5, hex); p.ln(cx, by - h * 0.5, cx + R(-1, 1), top, hex);
      for (let i = 0, m = 3 + Math.round(h / 12); i < m; i++) {
        const y0 = by - h * R(0.35, 0.9), dir = i % 2 ? 1 : -1, len = h * R(0.15, 0.32);
        const x1 = cx + dir * len, y1 = y0 - len * R(0.5, 1.1);
        p.ln(cx, y0, x1, y1, hex); if (len > 5) p.ln(cx + dir * len * 0.6, y0 - (y0 - y1) * 0.6, cx + dir * len * 0.75, y1 - 2, hex);
      }
    },
    // Markplan: ljus kant, bortre band som rastreras mot basfärgen, lugn mittzon, mörkare förgrund nertill,
    // och korta streck som struktur (glesare runt fotlinjen).
    ground(o) {
      const lip = ramp(o.lip), base = ramp(o.base), far = ramp(o.far), near = ramp(o.near), top = o.top || p.flat(gTop);
      const fEnd = gy - 3, nStart = gy + 6;
      for (let x = 0; x < W; x++) {
        const y0 = Math.round(top[x]);
        for (let y = Math.max(0, y0); y < H; y++) {
          let c = base;
          if (y === y0) c = lip;
          else if (y < fEnd && bay(x, y) > ((y - gTop) / (fEnd - gTop)) * 1.1) c = far;
          else if (y > nStart && bay(x, y) < ((y - nStart) / (H - nStart)) * 0.95) c = near;
          g.set(x, y, c, 3);
        }
      }
      const hi = ramp(o.hi), lo = ramp(o.lo), cnt = Math.round(((W * (H - gTop)) / 42) * (o.density ?? 1));
      for (let i = 0; i < cnt; i++) {
        const x = Math.floor(R(0, W)), y = Math.floor(R(gTop + 2, H)), ps = (y - gTop) / (H - gTop);
        if (Math.abs(y - gy) <= 3 && rnd() < 0.8) continue;
        const len = 1 + Math.round(R(0.5, 2) + ps * 3), c = rnd() < 0.5 ? hi : lo;
        for (let j = 0; j < len; j++) g.set(x + j, y, c, 3);
      }
    },
    commit() { g.end({ outline: false, edge: false }); },
  };
  return p;
}

// ---------- Skog ----------
function forest(p) {
  const { g, W, H, gy, gTop: hz, k, n, ks, R, rnd, S } = p;
  p.sky(['#5a9fdc', '#7dbbe6', '#a9d8ee', '#d3ecec', '#f2f6dc'], hz, 10);
  for (let i = 0, m = Math.round(3 * p.area) + 1; i < m; i++) { const w = R(16, 36); p.cloud(R(-8, W + 8), R(hz * 0.14, hz * 0.62), w, w * R(0.3, 0.42), { top: '#ffffff', body: '#f6fbfc', shade: '#d6e8f2' }); }
  for (let i = 0, m = Math.max(2, Math.round(3 * n)); i < m; i++) {
    const h = R(20, 36) * ks;
    p.mountain(((i + R(0.1, 0.9)) / m) * W, hz - h, hz, { sl: R(0.9, 1.4), sr: R(1, 1.5), lit: '#b2cde0', shade: '#98b8d6', snow: '#eef5f8', snowShade: '#cfdfee', capH: h * 0.2, haze: '#c6dfe2', hazeH: 10 });
  }
  p.fill(p.ridge(hz - 6 * ks, 11 * ks, 70, 2), hz, '#95c8a8', { rim: '#abd8b4', haze: '#bfe0c2', hazeH: 7 });
  // Bortre trädlinje
  const far = p.flat(hz - 3);
  for (let x = -4; x < W + 4; x += R(4, 8)) p.bump(far, x, hz - R(4, 11) * ks, R(4, 7));
  p.fill(far, hz, '#6aae82', { lit: '#82c090', shade: '#5a9e7a', sd: 3 });
  // Mellanplan: undervegetation och träd
  p.fill(p.ridge(hz - 4, 5, 18, 2), hz, '#4a9458', { rim: '#62aa5e' });
  const cols = ['#74bc5e', '#55a253', '#3f8850'], trunk = ['#7c5c40', '#5e4636'];
  for (let i = 0, m = Math.round(W / 17); i < m; i++) {
    const cx = ((i + R(0.1, 0.9)) / m) * W, big = rnd() < 0.3, th = big ? R(12, 18) : R(6, 12), cr = big ? R(10, 13) : R(6, 10);
    p.tree(cx, hz, th, cr, cols, trunk);
  }
  for (let x = R(0, 12); x < W; x += R(9, 22)) p.blob(x, hz - 1, R(4, 7), R(3, 4.5), cols);
  // Mark: gräs med stig där figurerna står
  const top = p.flat(hz); for (let x = 0; x < W; x++) if (hash(x, 5) < 0.3) top[x] = hz - 1;
  p.ground({ top, lip: '#a6dc70', base: '#78c25c', far: '#5fac54', near: '#62ae54', hi: '#8ed268', lo: '#66b256' });
  const s = rnd() * 99, pa = ramp('#dccb92'), pb = ramp('#c9b47a'), pc = ramp('#eadba6');
  for (let x = 0; x < W; x++) {
    const y0 = gy - 3 + Math.round(vn(x / 9, s) * 2.2), y1 = gy + 4 + Math.round(vn(x / 11, s + 9) * 2.4);
    for (let y = y0; y <= y1; y++) g.set(x, y, y === y1 ? pb : y === y0 && hash2(x, y, s) < 0.5 ? pc : hash2(x, y, s) < 0.035 ? pb : pa, 3);
  }
  // Tuvor och blommor (inte på stigen)
  const tuft = ramp('#4f9c4e'), tl = ramp('#9ada70'), fl = ['#ffe36a', '#ff9ac0', '#ffffff'].map(ramp);
  for (let i = 0, m = Math.round(26 * p.area); i < m; i++) {
    const x = Math.floor(R(0, W)), y = Math.floor(R(hz + 3, H - 1));
    if (y > gy - 6 && y < gy + 9) continue;
    if (rnd() < 0.35) { g.set(x, y, fl[i % 3], 3); g.set(x, y + 1, tuft, 3); }
    else { g.set(x - 1, y, tuft, 3); g.set(x, y - 1, tl, 3); g.set(x + 1, y, tuft, 3); g.set(x, y, tuft, 3); }
  }
  // Förgrund: gräskant nertill
  const bl = ramp('#4c9a4e'), bt = ramp('#62ae54');
  for (let x = 0; x < W; x++) { const h = 1 + Math.floor(hash(x, s) * (3 + k) + vn(x / 7, s) * 3); for (let d = 0; d < h; d++) g.set(x, H - 1 - d, d === h - 1 ? bt : bl, 3); }
  // Stort träd i vänsterkanten
  const by = gy + 7, cy = by - 100, tc = ['#8a6646', '#70503a', '#584030'].map(ramp);
  for (let y = Math.max(0, cy); y < by; y++) {
    const fl2 = Math.max(0, 5 - (by - y)) * 0.9, x1 = 8 + fl2 + Math.round(vn(y / 9, s) * 1.5);
    for (let x = 0; x <= x1; x++) g.set(x, y, tc[x < 3 ? 0 : x > x1 - 3 ? 2 : (hash2(x, y >> 2, s) < 0.12 ? 2 : 1)], 3);
  }
  const fc = ['#62b056', '#44924c', '#337848'];
  for (const [dx, dy, r] of [[-6, 8, 20], [22, 6, 15], [6, -12, 22], [30, -8, 13], [14, 14, 13], [-2, -2, 22]]) p.blob(4 + dx, cy + dy, r * 1.15, r * 0.9, fc, 0.5);
  p.commit();
  // Buske och sten i vänsterkanten, med kontur
  const lf = ramp('#4c9c50'), rk = ramp('#9a9aa2');
  g.begin(); g.ell(15, by - 2, 7, 5, lf); g.ell(9, by - 5, 6, 5, lf); g.end();
  g.begin(); g.ell(24, by + 2, 4.5, 3, rk); g.end();
}

// ---------- Öken ----------
function desert(p) {
  const { g, W, H, gy, gTop: hz, k, n, ks, R, rnd, S } = p;
  p.sky(['#3f9cc6', '#6dbace', '#a8d6c8', '#ecdfa6', '#fbd28e'], hz, 10);
  const sx = W * R(0.3, 0.72), sy = hz * R(0.2, 0.36), sr = 6 * ks;
  p.disc(sx, sy, sr + 6, '#f2ecc0', 0.5); p.disc(sx, sy, sr + 2.5, '#f8f0c4'); p.disc(sx, sy, sr, '#fffbe0');
  for (let i = 0, m = Math.round(3 * p.area) + 1; i < m; i++) { const x = R(-10, W), y = R(hz * 0.08, hz * 0.6), w = R(14, 34); p.rect(x + w * 0.25, y - 1, w * 0.4, 1, '#eef6e0'); p.rect(x, y, w, 1, '#e2f0dc'); p.rect(x + w * 0.15, y + 1, w * 0.95, 1, '#d4e8d6'); }
  // Mesor och pyramider
  for (let i = 0, m = Math.max(2, Math.round(2.4 * n)); i < m; i++) {
    const h = R(14, 26) * ks;
    p.mountain(((i + R(0.1, 0.9)) / m) * W, hz - h, hz, { tw: R(16, 40) * ks, sl: 0.3, sr: 0.35, curve: 0.012, rough: 1.5, zig: 0.4, div: 0.2, lit: '#e8b088', shade: '#d49a78', strata: '#dca27c', strataStep: 5, haze: '#f4d09a', hazeH: 9 });
  }
  for (let i = 0, m = Math.max(1, Math.round(1.5 * n)); i < m; i++) {
    const h = R(15, 24) * ks, px = ((i + R(0.2, 0.8)) / m) * W;
    p.mountain(px, hz - h, hz, { sl: 1.25, sr: 1.25, rough: 0, zig: 0, div: 0.18, lit: '#f4d490', shade: '#dcb070', strata: '#ecc884', strataStep: 4, haze: '#f6d89c', hazeH: 5 });
    if (rnd() < 0.6) p.mountain(px + h * R(1.1, 1.5), hz - h * 0.55, hz, { sl: 1.25, sr: 1.25, rough: 0, zig: 0, div: 0.18, lit: '#f4d490', shade: '#dcb070', haze: '#f6d89c', hazeH: 4 });
  }
  // Dyner
  p.fill(p.ridge(hz - 4 * ks, 10 * ks, 70, 2), hz, '#eec27c', { lit: '#fadc9e', shade: '#d8a466', sd: 5 });
  const mid = p.ridge(hz - 1, 7, 40, 2); p.fill(mid, hz, '#f3d28c', { lit: '#fee8ae', shade: '#e0b26c', sd: 4 });
  const cg = ramp('#8fae6a'), cd = ramp('#789a60');
  for (let i = 0, m = Math.round(5 * n); i < m; i++) { const x = Math.floor(R(4, W - 4)), y = Math.round(mid[x]); for (let d = 0; d < 5; d++) S(x, y - d, d < 4 ? cg : cd); S(x - 2, y - 3, cg); S(x - 2, y - 2, cg); S(x - 1, y - 2, cg); S(x + 2, y - 4, cd); S(x + 2, y - 3, cd); S(x + 1, y - 3, cd); }
  // Sand
  p.ground({ lip: '#fff0b8', base: '#f3d990', far: '#e8c67c', near: '#e9c87e', hi: '#fbe8aa', lo: '#e4c076', density: 0.5 });
  const s = rnd() * 99, rp = ramp('#e2bc74'), rl = ramp('#fceaae');
  for (let i = 0, m = Math.round(20 * p.area); i < m; i++) {        // vågiga sandränder
    const x0 = Math.floor(R(-6, W)), y = Math.floor(R(hz + 2, H - 1)), len = Math.round(R(6, 14) + (y - hz) * 0.4);
    if (Math.abs(y - gy) <= 4) continue;
    for (let j = 0; j < len; j++) { const yy = y + Math.round(Math.sin(j * 0.55 + i) * 1); g.set(x0 + j, yy, rp, 3); if (y > gy + 5) g.set(x0 + j, yy - 1, rl, 3); }
  }
  const pb = ramp('#c89c60'), pl = ramp('#e8c488');
  for (let i = 0, m = Math.round(9 * p.area); i < m; i++) { const x = Math.floor(R(0, W)), y = Math.floor(R(hz + 3, H - 1)); if (Math.abs(y - gy) <= 4) continue; g.set(x, y, pb, 3); g.set(x + 1, y, pb, 3); g.set(x, y - 1, pl, 3); }
  p.commit();
  // Kaktus, sten och ben i vänsterkanten
  const by = gy + 6, ca = ramp('#6fae58'), ro = ramp('#cf9058'), bo = ramp('#f6eeda');
  g.begin(); g.rect(3, by - 22, 5, 22, ca, 3); g.rect(-2, by - 14, 3, 6, ca, 3); g.rect(-2, by - 10, 6, 3, ca, 3); g.rect(10, by - 18, 3, 7, ca, 3); g.rect(7, by - 13, 6, 3, ca, 3);
  for (let y = by - 20; y < by - 1; y += 4) g.dot(5, y, ca, 5); g.end();
  g.begin(); g.ell(16, by + 2, 4.5, 3, ro); g.end();
  if (H - by > 12) { g.begin(); g.rect(8, H - 6, 9, 2, bo, 3); g.rect(7, H - 7, 2, 4, bo, 4); g.rect(16, H - 7, 2, 4, bo, 4); g.end(); }
}

// ---------- Träsk ----------
const hazed = (c, to, t) => ({ cap: c.cap.map((h) => mix(h, to, t)), spot: mix(c.spot, to, t), gill: mix(c.gill, to, t), stem: mix(c.stem, to, t), stemD: mix(c.stemD, to, t) });
const CAPS = [
  { cap: ['#c078ea', '#9a52cc', '#6c34a0'], spot: '#f4e6ff', gill: '#4a2470', stem: '#e6dec8', stemD: '#b4aa96' },
  { cap: ['#f07890', '#d04866', '#9a2c4c'], spot: '#fff0f0', gill: '#6a1c30', stem: '#e6dec8', stemD: '#b4aa96' },
  { cap: ['#6cd8c8', '#34aaa2', '#1e7c7c'], spot: '#f0fff8', gill: '#0e4a50', stem: '#e6dec8', stemD: '#b4aa96' },
];
function swamp(p) {
  const { g, W, H, gy, gTop: hz, k, n, ks, R, rnd, S } = p;
  p.sky(['#1e3844', '#294c50', '#3c6858', '#5f8862', '#90a872'], hz, 10);
  const mx = W * R(0.3, 0.75), my = hz * R(0.16, 0.3), mr = 5.5 * ks;
  p.disc(mx, my, mr + 6, '#3a6258', 0.5); p.disc(mx, my, mr + 2.5, '#4a7260'); p.disc(mx, my, mr, '#e4eec2'); p.disc(mx + mr * 0.35, my - mr * 0.2, mr * 0.45, '#cedcae', 0.5);
  // Avlägsna jättesvampar i dis
  for (let i = 0, m = Math.max(3, Math.round(4 * n)); i < m; i++) {
    const h = R(30, 62) * ks, c = hazed(CAPS[i % 3], '#577e62', 0.72);
    p.mush(((i + R(0.1, 0.9)) / m) * W, hz, h, R(24, 44) * ks, c);
  }
  // Dimma längs horisonten
  const fog = ramp('#86a072'), fog2 = ramp('#6e9068');
  for (let y = hz - Math.round(16 * ks); y < hz; y++) { const d = (hz - y) / (16 * ks); for (let x = 0; x < W; x++) if (bay(x, y) > d * 1.15) g.set(x, y, d < 0.4 ? fog : fog2, 3); }
  // Mellanplan: döda träd, närmare svampar, snår
  for (let i = 0, m = Math.round(3 * n); i < m; i++) p.deadTree(((i + R(0.1, 0.9)) / m) * W, hz, R(18, 34) * ks, '#33503f');
  for (let i = 0, m = Math.max(3, Math.round(5 * n)); i < m; i++) {
    const c = hazed(CAPS[(i + 1) % 3], '#4c7058', 0.42);
    p.mush(((i + R(0.1, 0.9)) / m) * W, hz, R(12, 30), R(12, 24), c);
  }
  const und = p.ridge(hz - 3, 5, 14, 2); p.fill(und, hz, '#3c5c40', { rim: '#527448' });
  const gl = ['#b8ff7a', '#ff9ad8', '#9af0e0'].map(ramp);
  for (let i = 0, m = Math.round(9 * n); i < m; i++) { const x = Math.floor(R(2, W - 2)), y = Math.round(und[x]); S(x, y - 1, gl[i % 3]); S(x + 1, y - 1, gl[i % 3]); }
  // Rankor som hänger ner från överkanten i vänstra delen
  const vc = ramp('#2c4a3c'), vl = ramp('#3e6248');
  for (let i = 0, m = Math.round(4 * n); i < m; i++) { const x = Math.floor(R(0, W * 0.3)), len = Math.round(R(8, 26) * ks); for (let y = 0; y < len; y++) { const xx = x + Math.round(Math.sin(y * 0.3 + i) * 1.2); S(xx, y, vc); if (y % 5 === 3) S(xx + (y % 2 ? 1 : -1), y, vl); } }
  // Mark: mossa, pölar i förgrunden
  p.ground({ lip: '#98aa60', base: '#6f884a', far: '#566e3e', near: '#5a7240', hi: '#829a54', lo: '#607a44' });
  const wa = ramp('#34585a'), wl = ramp('#6a9484'), wr = ramp('#4c6438'), lily = ramp('#7cba54'), pk = ramp('#ff9ad0');
  for (let i = 0, m = Math.round(3 * p.area); i < m; i++) {
    const cx = R(0, W), cy = R(gy + 10, H - 2), rx = R(8, 18), ry = R(1.6, 3.2);
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, d2 = dx * dx + dy * dy;
      if (d2 < 1) g.set(x, y, dy < -0.2 && dx < 0.3 && dx > -0.6 && d2 > 0.3 && d2 < 0.75 ? wl : wa, 3); else if (d2 < 1.5 && dy < 0) g.set(x, y, wr, 3);
    }
    g.set(Math.round(cx + rx * 0.3), Math.round(cy), lily, 3); g.set(Math.round(cx + rx * 0.3) + 1, Math.round(cy), lily, 3); if (i % 2) g.set(Math.round(cx + rx * 0.3) + 1, Math.round(cy) - 1, pk, 3);
  }
  // Vass i vänsterkanten och längs nederkanten
  const rd = ramp('#55703c'), rt = ramp('#7a5a34');
  for (let x = 0; x < W; x++) { const ed = x < 20 ? 1 : 0.25; if (hash(x, 3) > ed * 0.55) continue; const h = Math.round((2 + hash(x, 4) * 6) * (x < 20 ? 1.8 : 1)); for (let d = 0; d < h; d++) g.set(x, H - 1 - d, d >= h - 2 && h > 6 ? rt : rd, 3); }
  p.commit();
  // Stor svamp i vänsterkanten, med kontur
  const by = gy + 7, cp = ramp('#9a58c8'), stc = ramp('#e2dac4'), wh = ramp('#f4e6ff');
  g.begin(); g.poly([[1, by], [8, by], [6, by - 24], [2, by - 24]], stc, 3); g.rect(5, by - 24, 2, 24, stc, 2); g.end();
  g.begin(); g.ell(2, by - 24, 14, 10, cp, true, (dx, dy) => dy < 0.12); g.ell(-2, by - 30, 3, 2.2, wh, false, null, 4); g.ell(9, by - 28, 2.4, 1.8, wh, false, null, 4); g.ell(12, by - 27, 1.3, 1.1, wh, false, null, 4); g.end();
  g.begin(); g.ell(17, by + 1, 3.5, 3, ramp('#34aaa2'), true, (dx, dy) => dy < 0.2); g.rect(16, by + 1, 2, 3, stc, 3); g.end();
}

// ---------- Isberg ----------
function ice(p) {
  const { g, W, H, gy, gTop: hz, k, n, ks, R, rnd, S } = p;
  p.sky(['#2e58a8', '#4c7ec8', '#80b2e4', '#b8dcf4', '#e6f5fb'], hz, 10);
  // Norrsken överst
  const s = rnd() * 99, au = [ramp('#56aec6'), ramp('#5f8fd2')];
  for (let b = 0; b < 2; b++) for (let x = 0; x < W; x++) {
    const yc = hz * (0.08 + b * 0.12) + Math.sin(x / (30 + b * 11) + s + b * 2) * hz * 0.045 + vn(x / 44, s + b) * hz * 0.07, L = (3 + vn(x / 6, s + b * 9) * 9) * ks;
    for (let d = 0; d < L; d++) { const yy = Math.round(yc + d); if ((d < 1 && !b) || (((x + yy) & 1) && bay(x >> 1, yy >> 1) < (1 - d / L) * (b ? 0.6 : 0.85))) S(x, yy, au[b]); }
  }
  // Avlägsna berg med snö
  for (let i = 0, m = Math.max(3, Math.round(3.6 * n)); i < m; i++) {
    const h = R(26, 46) * ks;
    p.mountain(((i + R(0.1, 0.9)) / m) * W, hz - h, hz, { sl: R(0.8, 1.2), sr: R(0.9, 1.3), lit: '#c4d8f0', shade: '#98b2da', snow: '#ffffff', snowShade: '#d6e3f6', capH: h * 0.42, haze: '#cfe4f6', hazeH: 8 });
  }
  // Hav med isberg
  const sh = Math.round(7 + 3 * k), sea = ramp('#4a84c8'), seaL = ramp('#8cc0ea'), seaD = ramp('#3c72b8'), gli = ramp('#7ab0e0');
  for (let y = hz - sh; y < hz + 3; y++) for (let x = 0; x < W; x++) g.set(x, y, y === hz - sh ? seaL : hash2(x >> 2, y, s) < 0.12 ? gli : bay(x, y) < (y - (hz - sh)) / sh * 0.5 ? seaD : sea, 3);
  const rf = ramp('#9cc8ec');
  for (let i = 0, m = Math.max(3, Math.round(4.5 * n)); i < m; i++) {
    const cx = ((i + R(0.1, 0.9)) / m) * W, by = hz - Math.round(R(1, sh - 3)), h = R(8, 20) * Math.sqrt(ks), tw = R(3, 12);
    p.mountain(cx, by - h, by, { tw, sl: R(0.25, 0.6), sr: R(0.3, 0.7), rough: 1.2, zig: 0.8, div: 0.3, lit: '#e2f4fe', shade: '#8ebce6', snow: '#ffffff', snowShade: '#b8d8f2', capH: 2 });
    if (rnd() < 0.6) p.mountain(cx + tw * 0.5 + R(3, 7), by - h * 0.55, by, { tw: 2, sl: 0.3, sr: 0.5, rough: 1, zig: 0.5, lit: '#d4eefc', shade: '#84b4e2' });
    for (let x = Math.round(cx - tw / 2 - h * 0.4); x < cx + tw / 2 + h * 0.6; x++) { if (bay(x, by) < 0.6) g.set(x, by, rf, 3); if (bay(x, by + 1) < 0.25) g.set(x, by + 1, rf, 3); }
  }
  // Snö
  const top = p.ridge(hz + 1, 2.5, 30, 2);
  p.ground({ top, lip: '#ffffff', base: '#e8f2fb', far: '#c6daf0', near: '#d2e3f5', hi: '#ffffff', lo: '#d2e2f4', density: 0.6 });
  const dr = ramp('#cbddf2'), wh = ramp('#ffffff');
  for (let i = 0, m = Math.round(16 * p.area); i < m; i++) {           // drivor: mjuka bågar
    const x0 = Math.floor(R(-8, W)), y = Math.floor(R(hz + 4, H - 1)), len = Math.round(R(8, 18) + (y - hz) * 0.4);
    if (Math.abs(y - gy) <= 4) continue;
    for (let j = 0; j < len; j++) { const yy = y - Math.round(Math.sin((j / len) * Math.PI) * 1.6); g.set(x0 + j, yy, dr, 3); g.set(x0 + j, yy - 1, wh, 3); }
  }
  const ip = ramp('#bcdcf4'), ig = ramp('#f4fbff');
  for (let i = 0, m = Math.round(2 * p.area); i < m; i++) {            // isfläckar i förgrunden
    const cx = R(W * 0.1, W), cy = R(gy + 11, H - 2), rx = R(7, 15), ry = R(1.5, 2.6);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { const dx = (x - cx) / rx, dy = (y - cy) / ry; if (dx * dx + dy * dy < 1) g.set(x, y, (x + y * 2) % 7 === 0 ? ig : ip, 3); }
  }
  // Snöig gran i vänsterkanten
  const by = gy + 6;
  p.pine(6, by, 46, 26, { base: '#4a8884', lo: '#346c70', snow: '#ffffff', trunk: '#5e4636' });
  p.pine(19, by - 9, 24, 14, { base: '#5a9690', lo: '#447a7c', snow: '#ffffff', trunk: '#5e4636' });
  p.commit();
  // Iskristaller med kontur
  const ic = ramp('#a8e0fa');
  g.begin(); g.poly([[17, by + 2], [19, by - 9], [22, by - 12], [24, by - 5], [25, by + 2]], ic, 4); g.poly([[22, by - 12], [24, by - 5], [25, by + 2], [22, by + 2]], ic, 2);
  g.poly([[25, by + 2], [27, by - 5], [29, by - 6], [31, by + 2]], ic, 3); g.poly([[12, by + 2], [13, by - 4], [15, by - 5], [17, by + 2]], ic, 5); g.end();
}

// ---------- Vulkan ----------
function volcano(p) {
  const { g, W, H, gy, gTop: hz, k, n, ks, R, rnd, S } = p;
  p.sky(['#1e1626', '#33202e', '#562634', '#863830', '#bc5a2e', '#e08a3a'], hz, 11);
  for (let i = 0, m = Math.round(3 * p.area) + 1; i < m; i++) { const w = R(22, 50); p.cloud(R(-10, W + 10), R(hz * 0.06, hz * 0.4), w, w * R(0.22, 0.32), { top: '#3c2c3a', body: '#2c2030', shade: '#5a2a34' }); }
  // Vulkankäglan med krater, lavaströmmar och rök
  const vh = hz * R(0.5, 0.62), vx = W * R(0.3, 0.68), vy = hz - vh, tw = 9 * ks, dir = rnd() < 0.5 ? -1 : 1;
  for (let i = 9; i >= 0; i--) { const r = (5 + i * 2.6) * ks; p.blob(vx + dir * i * i * 0.9 * ks, vy - 4 - i * 6.5 * ks, r * 1.25, r, ['#4a3846', '#392a38', '#6a3236'], 0.3); }
  p.disc(vx, vy, tw * 1.4, '#8c3a30', 0.5); p.disc(vx, vy, tw * 0.9, '#b8502e'); p.disc(vx, vy, tw * 0.55, '#e88a34');
  p.mountain(vx, vy, hz, { tw, sl: 0.75, sr: 0.75, curve: 0.006 / ks, rough: 2.5, lit: '#523c48', shade: '#392a36', div: 0.25 });
  const l1 = ramp('#ff8a24'), l2 = ramp('#ffd04a'), l3 = ramp('#d8501a');
  for (let x = Math.round(vx - tw / 2); x <= vx + tw / 2; x++) { S(x, vy, l2); S(x, vy + 1, l1); }
  for (let i = 0; i < 3; i++) {
    let x = vx + (i - 1) * tw * 0.33, len = vh * R(0.35, 0.8), drift = (i - 1) * 0.5 + R(-0.25, 0.25);
    for (let d = 1; d < len; d++) { x += drift + (rnd() - 0.5) * 1.6; const c = d < len * 0.3 ? l2 : d < len * 0.75 ? l1 : l3; S(x, vy + d, c); if (d < len * 0.5 || d % 3) S(x + 1, vy + d, d < len * 0.75 ? l1 : l3); }
  }
  // Bergskam framför, med glödkant
  p.fill(p.ridge(hz - 5 * ks, 17 * ks, 34, 3, true), hz, '#2e2230', { rim: '#6a3438', lit: '#402a36', sd: 3 });
  // Lavaflod längs horisonten och glöd över den
  const lh = Math.round(3 + 2 * k), s = rnd() * 99, lt = ramp('#ffc24a'), cr = ramp('#6e2c24'), lc = ramp('#a03c20'), gw = ramp('#8c3a30');
  for (let y = hz - lh - 6; y < hz - lh; y++) for (let x = 0; x < W; x++) if (bay(x, y) > (hz - lh - y) / 6 + 0.3) g.set(x, y, gw, 3);
  for (let y = hz - lh; y < hz; y++) for (let x = 0; x < W; x++) {
    const v = vn(x / 7 + y * 0.9, s + y * 3);
    g.set(x, y, v > 0.8 ? lt : v > 0.62 ? l1 : v < 0.3 ? cr : v < 0.4 ? lc : l3, 3);
  }
  // Klippspetsar framför lavan
  for (let i = 0, m = Math.round(5 * n); i < m; i++) {
    const h = R(6, 15), x = ((i + R(0.05, 0.95)) / m) * W;
    p.mountain(x, hz - h, hz, { tw: R(1, 4), sl: R(0.25, 0.5), sr: R(0.3, 0.6), rough: 1, zig: 0.5, lit: '#5c444c', shade: '#2e222c', div: 0.3 });
  }
  // Mark: basalt med sprickor, glödande sprickor bara i förgrunden
  p.ground({ lip: '#a88070', base: '#7a6866', far: '#5e4c52', near: '#625256', hi: '#8c7872', lo: '#665658', density: 0.7 });
  const ck = ramp('#463640'), cl = ramp('#907c76');
  for (let i = 0, m = Math.round(16 * p.area); i < m; i++) {
    let x = Math.floor(R(0, W)), y = Math.floor(R(hz + 3, H - 1)); const len = Math.round(R(4, 10));
    if (Math.abs(y - gy) <= 4) continue;
    for (let j = 0; j < len; j++) { g.set(x, y, ck, 3); g.set(x, y + 1, cl, 3); x += 1; if (rnd() < 0.35) y += rnd() < 0.5 ? 1 : -1; }
  }
  for (let i = 0, m = Math.round(3 * p.area); i < m; i++) {
    let x = Math.floor(R(W * 0.08, W)), y = Math.floor(R(gy + 11, H - 2)); const len = Math.round(R(7, 16));
    for (let j = 0; j < len; j++) { g.set(x, y - 1, ck, 3); g.set(x, y, j % 4 === 1 ? l2 : l1, 3); g.set(x, y + 1, l3, 3); x += 1; if (rnd() < 0.3) y += rnd() < 0.5 ? 1 : -1; if (y > H - 2) y = H - 2; }
  }
  p.commit();
  // Klippor i vänsterkanten, med kontur
  const by = gy + 7, rk = ramp('#5a4a52');
  g.begin(); g.poly([[-1, by], [1, by - 20], [5, by - 27], [9, by - 16], [11, by]], rk, 3); g.poly([[5, by - 27], [9, by - 16], [11, by], [6, by]], rk, 2); g.end();
  g.begin(); g.poly([[10, by + 2], [12, by - 7], [16, by - 10], [20, by - 3], [21, by + 2]], rk, 3); g.poly([[16, by - 10], [20, by - 3], [21, by + 2], [17, by + 2]], rk, 2); g.end();
}

// ---------- Molnslott ----------
function cloud(p) {
  const { g, W, H, gy, gTop: hz, k, n, ks, R, rnd, S } = p;
  p.sky(['#6f88e0', '#96a2ea', '#c4b2ec', '#f0bedc', '#ffd6cc', '#ffecd6'], hz, 11);
  const st = ramp('#ffffff'), st2 = ramp('#dcd6ff');
  for (let i = 0, m = Math.round(12 * p.area); i < m; i++) { const x = Math.floor(R(0, W)), y = Math.floor(R(1, hz * 0.4)); g.set(x, y, st, 3); if (i % 4 === 0) { g.set(x - 1, y, st2, 3); g.set(x + 1, y, st2, 3); g.set(x, y - 1, st2, 3); g.set(x, y + 1, st2, 3); } }
  // Regnbåge, rastrerad så att den ser genomskinlig ut
  const rc = ['#ff9aac', '#ffc694', '#fff0a2', '#a6e6b4', '#98c8f8', '#c2aaf0'].map(ramp), rx = W * R(0.25, 0.75), ry = hz + 6, rr = hz * R(0.62, 0.78), bw = Math.max(1.5, 1.6 * ks);
  for (let y = 0; y < hz; y++) for (let x = 0; x < W; x++) {
    const d = Math.hypot(x - rx, (y - ry) * 1.15), b = Math.floor((rr - d) / bw);
    if (b >= 0 && b < 6 && ((x + y) & 1)) g.set(x, y, rc[b], 3);
  }
  for (let i = 0, m = Math.round(3 * p.area) + 1; i < m; i++) { const w = R(16, 38); p.cloud(R(-8, W + 8), R(hz * 0.2, hz * 0.62), w, w * R(0.3, 0.4), { top: '#ffffff', body: '#fff2f2', shade: '#f2cfe2' }); }
  // Bortre molnbank
  const far = p.flat(hz - 4);
  for (let x = -6; x < W + 6; x += R(7, 13)) p.bump(far, x, hz - R(5, 15) * ks, R(6, 10) * Math.sqrt(ks));
  p.fill(far, hz, '#ecc6e4', { rim: '#fbe0ee', shade: '#dcb4dc', sd: 3 });
  // Slottet
  const cx = W * R(0.3, 0.62), cb = hz - Math.round(4 * ks), u = ks;
  const tower = (x, w, h, roof) => {
    x = Math.round(x); w = Math.round(w); h = Math.round(h);
    p.rect(x, cb - h, w, h, '#f2e0f2'); p.rect(x + Math.ceil(w * 0.6), cb - h, w - Math.ceil(w * 0.6), h, '#d4bce2');
    if (roof) { const rh = Math.round(w * 1.3); for (let d = 0; d < rh; d++) { const hw = ((d + 1) / rh) * (w / 2 + 1); for (let xx = Math.round(x + w / 2 - hw); xx < Math.round(x + w / 2 + hw); xx++) S(xx, cb - h - rh + d, xx < x + w * 0.55 ? ramp('#e894b4') : ramp('#c874a2')); }
      S(x + w / 2, cb - h - rh - 1, ramp('#f6d070')); S(x + w / 2, cb - h - rh - 2, ramp('#f6d070')); S(x + w / 2 + 1, cb - h - rh - 2, ramp('#f6d070'));
    } else for (let xx = x; xx < x + w; xx += 2) S(xx, cb - h - 1, ramp(xx < x + w * 0.6 ? '#f2e0f2' : '#d4bce2'));
    const wn = ramp('#a48cc8'); for (let yy = cb - h + 3; yy < cb - 3; yy += Math.max(5, Math.round(5 * u))) { S(x + w * 0.3, yy, wn); S(x + w * 0.3, yy + 1, wn); }
  };
  tower(cx - 15 * u, 5 * u, 20 * u, 1); tower(cx + 11 * u, 5 * u, 22 * u, 1);
  tower(cx - 9 * u, 19 * u, 14 * u, 0);
  tower(cx - 6 * u, 5 * u, 30 * u, 1); tower(cx + 3 * u, 6 * u, 36 * u, 1); tower(cx - 21 * u, 4 * u, 11 * u, 1); tower(cx + 18 * u, 4 * u, 12 * u, 1);
  const door = ramp('#b49cd0'); for (let d = 0; d < 4 * u; d++) for (let xx = -1; xx <= 1 * u; xx++) S(cx + xx, cb - 1 - d, door);
  // Närmare molnbank som slottet vilar i
  const near = p.flat(hz - 1);
  for (let x = -6; x < W + 6; x += R(6, 11)) p.bump(near, x, hz - R(0, 5), R(5, 8));
  p.fill(near, hz + 6, '#fff6f2', { rim: '#ffffff', shade: '#f0d2e2', sd: 3 });
  // Molngolv: bullig överkant och bågar som antyder molntussar
  const top = p.flat(hz + 2);
  for (let x = -5; x < W + 5; x += R(6, 11)) p.bump(top, x, hz + R(3, 5), R(4, 7));
  p.ground({ top, lip: '#ffffff', base: '#fdeeee', far: '#f4d4e2', near: '#ecd4ea', hi: '#ffffff', lo: '#f6dce6', density: 0.25 });
  const ar = ramp('#f0cede'), aw = ramp('#ffffff');
  for (let i = 0, m = Math.round(20 * p.area); i < m; i++) {
    const cx2 = R(-4, W + 4), cy2 = R(hz + 8, H + 4), r = R(4, 8) + (cy2 - hz) * 0.08;
    if (Math.abs(cy2 - r - gy) <= 4) continue;
    for (let x = Math.ceil(cx2 - r); x <= cx2 + r; x++) { const dx = x - cx2, y = Math.round(cy2 - Math.sqrt(r * r - dx * dx) * 0.6); if (y <= hz + 5 || y >= H) continue; g.set(x, y, aw, 3); g.set(x, y - 1, ar, 3); }
  }
  p.commit();
  // Marmorpelare i vänsterkanten, med kontur
  const by = gy + 6, mb = ramp('#efe6f6'), gd = ramp('#f2c860');
  g.begin(); g.rect(3, by - 40, 7, 40, mb, 3); g.rect(5, by - 40, 1, 40, mb, 5); g.rect(8, by - 40, 2, 40, mb, 2); g.end();
  g.begin(); g.rect(1, by - 44, 11, 4, gd, 3); g.rect(1, by - 2, 11, 4, gd, 3); g.end();
}

const BIOMES = { forest, desert, swamp, ice, volcano, cloud };
const ORDER = Object.keys(BIOMES);

// Ritar en statisk bakgrund i g (en ny tom G med storlek W x H). groundY är y-raden där fötter står.
export function drawBackdrop(g, biome, W, H, groundY, seed = 0) {
  const b = BIOMES[biome] ? biome : 'forest';
  g.begin();
  BIOMES[b](painter(g, W, H, groundY, seed, ORDER.indexOf(b)));
}

// ---------- Rörliga smådelar ----------
const A = {
  leaf: ramp('#6cb84c'), leaf2: ramp('#e8c44a'), sand: ramp('#f6e2a6'), fly: ramp('#d4f470'), snow: ramp('#ffffff'),
  fire: ramp('#ff7a1f'), fire2: ramp('#ffd84a'), star: ramp('#ffffff'), gold: ramp('#ffe27a'),
};
// Ritas ovanpå varje bildruta. Skriver råa pixlar (g.set), en enda del utan kontur.
export function drawAmbient(g, biome, W, H, groundY, t) {
  const N = Math.min(36, Math.round((8 * W * H) / (192 * 108)) + 2);
  const put = (x, y, c, lv) => g.set(Math.round(x), Math.round(y), c, lv);
  g.begin();
  for (let i = 0; i < N; i++) {
    const h1 = hash(i, 1), h2 = hash(i, 2), h3 = hash(i, 3);
    if (biome === 'forest') {
      const y = mod(h1 * H + t * (5 + h3 * 6), groundY + 4), x = mod(h2 * W + t * 4 + Math.sin(t * 1.7 + i * 2.1) * 5, W), c = i % 3 ? A.leaf : A.leaf2;
      put(x, y, c, 4); put(x + 1, y + (Math.sin(t * 3 + i) > 0 ? 0 : 1), c, 3);
    } else if (biome === 'desert') {
      const x = mod(h2 * W + t * (26 + h3 * 20), W + 10) - 5, y = groundY - 16 + h1 * 26 + Math.sin(t * 2 + i) * 1.5;
      put(x, y, A.sand, 5); put(x - 1, y, A.sand, 4); put(x - 2, y, A.sand, 3);
    } else if (biome === 'swamp') {
      const b = Math.sin(t * (1.2 + h3) + i * 4);
      if (b < 0.2) continue;
      const x = h2 * W + Math.sin(t * 0.5 + i * 1.9) * 9, y = 6 + h1 * (groundY - 8) + Math.cos(t * 0.4 + i * 2.7) * 6;
      put(x, y, A.fly, 5); if (b > 0.75) { put(x - 1, y, A.fly, 3); put(x + 1, y, A.fly, 3); put(x, y - 1, A.fly, 3); put(x, y + 1, A.fly, 3); }
    } else if (biome === 'ice') {
      const y = mod(h1 * H + t * (9 + h3 * 7), H), x = mod(h2 * W - t * 5 + Math.sin(t * 1.3 + i * 1.7) * 3, W);
      put(x, y, A.snow, 5); if (i % 4 === 0) put(x + 1, y, A.snow, 4);
    } else if (biome === 'volcano') {
      const y = groundY + 6 - mod(h1 * H + t * (10 + h3 * 9), groundY + 6), x = mod(h2 * W + t * 2 + Math.sin(t * 1.3 + i * 2.3) * 4, W);
      const c = hash(Math.floor(t * 8) + i, 5) < 0.5 ? A.fire2 : A.fire;
      put(x, y, c, y < groundY * 0.4 ? 3 : 5); if (i % 3 === 0) put(x, y + 1, A.fire, 3);
    } else if (biome === 'cloud') {
      const ph = t * 0.6 + h3, cyc = Math.floor(ph), f = ph - cyc;
      if (f > 0.5) continue;
      const x = hash(i + cyc * 31, 1) * W, y = hash(i + cyc * 17, 2) * H * 0.92, big = Math.sin(f * 2 * Math.PI) > 0.6;
      put(x, y, A.star, 5); if (big) { put(x - 1, y, A.gold, 4); put(x + 1, y, A.gold, 4); put(x, y - 1, A.gold, 4); put(x, y + 1, A.gold, 4); }
    }
  }
  g.end({ outline: false, edge: false });
}
