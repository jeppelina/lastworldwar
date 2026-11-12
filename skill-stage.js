// Provscenen på fliken Powers: hjälten och en träningsdocka, med stridens egna attackrörelser (ATTACKS ur battle.js).
// Här visar stegen som hör till striden (spår och träff på nivå 3, superattack och segerpose på nivå 5) upp sig själva.
// Kopia av prototypes/skilltree/stage.js. Det som skiljer: attackerna importeras i stället för att kopieras, och
// scenen klarar spelets alla vapen (klotet som laddas över huvudet, pilar).
import { G, ramp } from './pixel.js';
import { drawHero } from './hero.js';
import { ATTACKS } from './battle.js';
import * as FX from './skillfx.js';

export const SW = 152, SH = 84, GROUND = 70, HOME = 42, DUMMY = 120;
const WOOD = ramp('#9a6b3f'), STRAW = ramp('#d8c08a'), DARK = ramp('#2b2740'), WHITE = ramp('#ffffff'), SHADOW = ramp('#1d1b2e'), REDC = ramp('#d8433b');
const lerp = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));

export class Stage {
  constructor(canvas) {
    canvas.width = SW; canvas.height = SH;
    this.ctx = canvas.getContext('2d'); this.g = new G(SW, SH);
    this.look = null; this.gear = {}; this.lk = null; this.st = FX.newFxState();
    this.fx = []; this.anim = null; this.shake = 0; this.hurtAt = -9; this.flashUntil = 0; this.plain = false; this.cost = 0; this.onBanner = () => {};
  }
  set(look, gear, lk) { this.look = look; this.gear = gear; this.lk = lk; }
  busy() { return !!this.anim; }
  // ----- samma anrop som battle.js gör -----
  attack(now, sup) {
    if (this.anim) return;
    const type = this.gear.weapon ? this.gear.weapon.type : 'none', A = ATTACKS[type] || ATTACKS.sword;
    this.anim = { who: 'hero', A, t0: now, dur: A.dur * (sup ? 1.15 : 1), sup, fired: new Set(), D: DUMMY - 12 - HOME - 24 };
    if (sup) {
      const until = (A.ev.find((e) => e.hit !== undefined) || A.ev[0]).at * this.anim.dur;
      this.fx.push(...FX.superFx(this.plain ? null : this.lk, { now, x: DUMMY, y: GROUND - 14, gy: GROUND, hx: HOME, hy: GROUND - 26, until }));
      this.onBanner('SUPER!');
    }
  }
  hit(now, ev) {
    const a = this.anim, mat = this.gear.weapon ? ramp(this.gear.weapon.hex) : WHITE, x = DUMMY, y = GROUND - 14;
    this.hurtAt = now; this.flashUntil = now + 0.12; this.shake = Math.max(this.shake, (a.A.shake || 2) * (a.sup ? 1.5 : 1));
    for (let i = 0; i < (a.sup ? 14 : 7); i++) { const an = Math.random() * 6.283, v = 60 * (0.3 + Math.random() * 0.7); this.fx.push({ kind: 'p', t0: now, dur: 0.25 + Math.random() * 0.35, x, y, vx: Math.cos(an) * v, vy: Math.sin(an) * v - 20, rp: mat, lv: 3 + (i % 3) }); }   // spelets vanliga gnistskur
    if (ev.fx === 'slash' || ev.fx === 'bigslash') this.fx.push({ kind: 'slash', t0: now, dur: 0.16, x: x - 4, y, r: (ev.fx === 'bigslash' ? 22 : 12) * (a.sup ? 1.4 : 1), mat });
    this.fx.push(...FX.impactFx(this.plain ? null : this.lk, { now, x, y, gy: GROUND, hx: HOME, hy: GROUND - 26 }));                                   // vägens träff ovanpå
  }
  cheer(now) {
    if (this.anim) return;
    this.anim = { who: 'cheer', t0: now, dur: 1.1 };
    this.fx.push(...FX.cheerFx(this.plain ? null : this.lk, { now, x: HOME, y: GROUND - 26, gy: GROUND, hx: HOME, hy: GROUND - 26 }));
  }
  // ----- bildrutan -----
  frame(now) {
    const g = this.g; if (!this.look) return;
    g.clear();
    const sh = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0; this.shake *= 0.8;
    const a = this.anim, p = a ? Math.min(1, (now - a.t0) / a.dur) : 0, lk = this.plain ? null : this.lk;
    const hp = !a ? {} : a.who === 'hero' ? a.A.pose(p, a.D) || {} : FX.victoryPose(lk, p);
    const dx = Math.round(hp.dx || 0), dy = Math.round(hp.dy || 0), hx = HOME + dx + sh;
    // dockan
    const hurt = now < this.hurtAt ? 0 : Math.max(0, 1 - (now - this.hurtAt) / 0.35);
    g.begin(); g.ell(DUMMY + sh, GROUND + 1.5, 9, 2.2, SHADOW, false, null, 1); g.end({ outline: false, edge: false });
    g.push(DUMMY + sh, GROUND, Math.sin((now - this.hurtAt) * 34) * 0.16 * hurt); g.flash = now < this.flashUntil;
    g.begin(); g.rect(-1.5, -22, 3, 23, WOOD, 2); g.rect(-6, -1, 12, 3, WOOD, 3); g.thick(-8, -15, 8, -15, 2.6, WOOD, 3); g.end();
    g.begin(); g.ell(0, -12, 6, 7, STRAW, true); g.rect(-5, -10, 10, 1, WOOD, 2); g.rect(-5, -14, 10, 1, REDC, 3); g.end();
    g.begin(); g.ell(0, -25, 4.6, 4.6, STRAW, true); g.end();
    g.begin(); g.dot(-2, -26, DARK, 0); g.dot(1, -26, DARK, 0); g.rect(-2, -23, 4, 1, DARK, 1); g.end({ outline: false, edge: false });
    g.flash = false; g.pop();
    // hjälten
    const t0 = performance.now();
    if (!FX.heroHidden(lk, a && a.sup, p)) {
      g.push(Math.round(hx - 38.5), Math.round(GROUND - 61 + dy));
      const args = { t: now, blink: now % 3.7 < 0.14, wAng: hp.wAng, hand: hp.hand }, gear = hp.noW ? { ...this.gear, weapon: null } : this.gear;
      if (lk) FX.drawHeroWithSkills(g, this.look, gear, { ...args, off: [dx, dy], busy: !!a }, lk, this.st); else drawHero(g, this.look, gear, args);
      this.tip = g.anchor.tip || g.anchor.hand; this.hand = g.anchor.hand; this.over3 = [this.hand[0] - 4, this.hand[1] - 34]; g.pop();
      if (a && a.who === 'hero' && lk && !this.fx.some((e) => e.kind === 'proj')) FX.trailPush(this.st, this.tip, this.hand, now);   // medan ett skott flyger hör spåret till skottet
    }
    if (lk) FX.drawTrail(g, this.st, lk, now);
    // attackens händelser
    if (a && a.who === 'hero') {
      a.A.ev.forEach((ev, i) => {
        if (p < ev.at || a.fired.has(i)) return; a.fired.add(i);
        if (ev.shoot) { const from = ev.shoot.from === 'tip' ? this.tip : ev.shoot.from === 'over' ? this.over3 : this.hand; this.fx.push({ kind: 'proj', t0: now, dur: ev.shoot.dur, x0: from[0], y0: from[1], x1: DUMMY, y1: GROUND - 14, r: Math.min(6, ev.shoot.r || 2), mat: this.gear.weapon ? ramp(this.gear.weapon.hex) : WHITE }); }
        else this.hit(now, ev);
      });
    }
    if (a && p >= 1) this.anim = null;
    // effekter: spelets egna (p, slash, proj) och skillträdets (sk)
    g.begin(); let any = false;
    this.fx = this.fx.filter((e) => {
      if (e.kind === 'sk') return true;
      const q = (now - e.t0) / e.dur; if (q >= 1) return false; any = true;
      if (e.kind === 'p') { const tt = now - e.t0; g.set(Math.round(e.x + e.vx * tt), Math.round(e.y + e.vy * tt + 60 * tt * tt), e.rp, q < 0.5 ? e.lv : 3); }
      if (e.kind === 'slash') for (let k = -1; k <= 1; k += 0.08) { const an = k * 1.1, rr = e.r * (0.8 + q * 0.5); g.set(Math.round(e.x + Math.cos(an) * rr), Math.round(e.y + Math.sin(an) * rr), k * k < 0.3 ? WHITE : e.mat, 5); }
      if (e.kind === 'proj') { const x = lerp(e.x0, e.x1, q), y = lerp(e.y0, e.y1, q); for (let yy = -e.r; yy <= e.r; yy++) for (let xx = -e.r; xx <= e.r; xx++) if (xx * xx + yy * yy <= e.r * e.r) g.set(Math.round(x + xx), Math.round(y + yy), e.mat, xx + yy < 0 ? 5 : 4); if (lk) FX.trailPush(this.st, [x, y], [x - 1, y], now); }
      return true;
    });
    if (any) g.end({ outline: false, edge: false });
    this.fx = this.fx.filter((e) => e.kind !== 'sk' || FX.drawFx(g, e, now, this.st));
    this.cost = performance.now() - t0;
    g.paint(this.ctx);
  }
}
