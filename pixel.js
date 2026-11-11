// Pixelmotor: former rastreras i låg upplösning, varje del får automatisk kantskuggning och kontur.
// Färger anges som ramper (6 steg: kontur, 2 skuggor, bas, 2 ljus) som räknas fram ur en enda basfärg
// med nyansskift (skuggor mot blålila, ljus mot gult). Ett nytt material är alltså en hexkod.

const RAMPS = [];
const RKEY = new Map();
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function hex2hsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function hsl2rgb(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
const toward = (h, target, f) => (h + ((((target - h + 540) % 360) - 180) * f) + 360) % 360;

export function ramp(hex) {
  if (RKEY.has(hex)) return RKEY.get(hex);
  const [h, s, l] = hex2hsl(hex);
  const mk = (hh, ss, ll) => hsl2rgb(hh, clamp(ss), clamp(ll));
  const sh = Math.max(s, 0.14); // grå metaller får lätt blå skugga
  RAMPS.push([
    mk(toward(h, 265, 0.4), sh * 0.9, l * 0.2),
    mk(toward(h, 265, 0.28), Math.min(1, sh * 1.05), l * 0.48),
    mk(toward(h, 265, 0.14), s, l * 0.74),
    mk(h, s, l),
    mk(toward(h, 55, 0.14), s * 0.95, l + (1 - l) * 0.3),
    mk(toward(h, 55, 0.28), s * 0.75, l + (1 - l) * 0.62),
  ]);
  RKEY.set(hex, RAMPS.length - 1);
  return RAMPS.length - 1;
}

export class G {
  constructor(w, h) {
    this.w = w; this.h = h;
    const n = w * h;
    this.R = new Int16Array(n).fill(-1); this.L = new Int8Array(n);   // färdig bild
    this.r = new Int16Array(n).fill(-1); this.l = new Int8Array(n);   // delen som ritas just nu
    this.t = { x: 0, y: 0, a: 0, c: 1, s: 0, k: 1 };
    this.stack = [];
    this.anchor = {};
    this.img = null;
    this.flash = false;                       // true = delen ritas ljus (träffblixt)
    this.bx0 = w; this.by0 = h; this.bx1 = -1; this.by1 = -1;   // delens omslutande ruta
  }
  clear() { this.R.fill(-1); this.r.fill(-1); this.t = { x: 0, y: 0, a: 0, c: 1, s: 0, k: 1 }; this.stack = []; this.anchor = {}; }
  push(x, y, ang = 0, k = 1) {
    this.stack.push(this.t);
    const [nx, ny] = this.pt(x, y), a = this.t.a + ang;
    this.t = { x: nx, y: ny, a, c: Math.cos(a), s: Math.sin(a), k: this.t.k * k };
  }
  pop() { this.t = this.stack.pop(); }
  pt(x, y) { const t = this.t; return [t.x + (x * t.c - y * t.s) * t.k, t.y + (x * t.s + y * t.c) * t.k]; }
  set(x, y, rp, lv) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x; this.r[i] = rp; this.l[i] = lv;
    if (x < this.bx0) this.bx0 = x; if (x > this.bx1) this.bx1 = x; if (y < this.by0) this.by0 = y; if (y > this.by1) this.by1 = y;
  }
  begin() { /* delen byggs i r/l tills end() */ }

  poly(pts, rp, lv = 3) {
    const P = pts.map((p) => this.pt(p[0], p[1]));
    let y0 = Infinity, y1 = -Infinity;
    for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(this.h - 1, Math.ceil(y1)); y++) {
      const sy = y + 0.5, xs = [];
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length];
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) xs.push(a[0] + ((sy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2)
        for (let x = Math.max(0, Math.round(xs[i])); x < Math.min(this.w, Math.round(xs[i + 1])); x++) this.set(x, y, rp, lv);
    }
  }
  rect(x, y, w, h, rp, lv = 3) { this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], rp, lv); }
  // Tjock linje som fyrhörning (armar, skaft).
  thick(x0, y0, x1, y1, w, rp, lv = 3) {
    const dx = x1 - x0, dy = y1 - y0, d = Math.hypot(dx, dy) || 1, nx = (-dy / d) * w / 2, ny = (dx / d) * w / 2;
    this.poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]], rp, lv);
  }
  // Ellips. shade=true ger klotskuggning i band, annars platt nivå lv. pred(dx,dy,d2) klipper.
  ell(cx, cy, rx, ry, rp, shade = true, pred = null, lv = 3) {
    const [X, Y] = this.pt(cx, cy), k = this.t.k; rx *= k; ry *= k;
    for (let y = Math.max(0, Math.floor(Y - ry)); y <= Math.min(this.h - 1, Math.ceil(Y + ry)); y++)
      for (let x = Math.max(0, Math.floor(X - rx)); x <= Math.min(this.w - 1, Math.ceil(X + rx)); x++) {
        const dx = (x + 0.5 - X) / rx, dy = (y + 0.5 - Y) / ry, d2 = dx * dx + dy * dy;
        if (d2 > 1) continue;
        if (pred && !pred(dx, dy, d2)) continue;
        if (!shade) { this.set(x, y, rp, lv); continue; }
        const st = shade === true ? 1.9 : shade;   // tal < 1.5 ger mjuk skuggning (hud)
        this.set(x, y, rp, clamp(Math.round(3 + (st < 1.5 ? 0.3 : 0) - (dx * 0.55 + dy * 0.8) * st), 1, 5));
      }
  }
  dot(x, y, rp, lv = 3) { const [X, Y] = this.pt(x + 0.5, y + 0.5); this.set(Math.floor(X), Math.floor(Y), rp, lv); }
  line(x0, y0, x1, y1, rp, lv = 3) {
    let [ax, ay] = this.pt(x0 + 0.5, y0 + 0.5), [bx, by] = this.pt(x1 + 0.5, y1 + 0.5);
    ax = Math.floor(ax); ay = Math.floor(ay); bx = Math.floor(bx); by = Math.floor(by);
    const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
    let e = dx + dy;
    for (;;) { this.set(ax, ay, rp, lv); if (ax === bx && ay === by) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; ax += sx; } if (e2 <= dx) { e += dx; ay += sy; } }
  }
  // Avslutar en del: kantljus uppe/vänster, kantskugga nere/höger, mörk kontur runt, lägg på bilden.
  end({ outline = true, edge = true } = {}) {
    const { w, h, r, l, R, L } = this;
    if (this.bx1 < 0) return;                                  // inget ritat
    const x0 = Math.max(0, this.bx0 - 1), x1 = Math.min(w - 1, this.bx1 + 1), y0 = Math.max(0, this.by0 - 1), y1 = Math.min(h - 1, this.by1 + 1);
    this.bx0 = w; this.by0 = h; this.bx1 = -1; this.by1 = -1;
    const filled = (x, y) => x >= 0 && y >= 0 && x < w && y < h && r[y * w + x] >= 0;
    if (this.flash) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (r[i] >= 0) l[i] = 5; } }
    else if (edge) {
      const adj = [];
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const i = y * w + x; if (r[i] < 0 || l[i] === 0) continue;
        const a = (!filled(x, y - 1) || !filled(x - 1, y) ? 1 : 0) - (!filled(x, y + 1) || !filled(x + 1, y) ? 1 : 0);
        if (a) adj.push(i, a);
      }
      for (let j = 0; j < adj.length; j += 2) l[adj[j]] = clamp(l[adj[j]] + adj[j + 1], 1, 5);
    }
    const ol = [];
    if (outline) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x; if (r[i] >= 0) continue;
      const nb = filled(x, y - 1) ? r[i - w] : filled(x, y + 1) ? r[i + w] : filled(x - 1, y) ? r[i - 1] : filled(x + 1, y) ? r[i + 1] : -1;
      if (nb >= 0) ol.push(i, nb);
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x; if (r[i] >= 0) { R[i] = r[i]; L[i] = l[i]; r[i] = -1; } }
    for (let j = 0; j < ol.length; j += 2) { R[ol[j]] = ol[j + 1]; L[ol[j]] = 0; }
  }
  // Ritar bilden på en canvas-kontext i skala 1 (skala upp med CSS, image-rendering: pixelated).
  paint(ctx) {
    if (!this.img) this.img = ctx.createImageData(this.w, this.h);
    const d = this.img.data;
    for (let i = 0, j = 0; i < this.R.length; i++, j += 4) {
      if (this.R[i] < 0) { d[j + 3] = 0; continue; }
      const c = RAMPS[this.R[i]][this.L[i]];
      d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = 255;
    }
    ctx.putImageData(this.img, 0, 0);
  }
}
