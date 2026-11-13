// Striden så som den ser ut: scen, animationer, effekter och knappar.
// Reglerna (skada, turordning, fiendens nedräkning, superattack, belöningar, stjärnor) ligger i rules.js,
// som också simulatorn i sim/ kör. Ändra siffror där, inte här.
import { G, ramp } from './pixel.js';
import { drawHero, drawPet } from './hero.js';
import { BY_ID, heroStats } from './catalog.js';
import * as R from './rules.js';
import { pic } from './pics.js';
import { looks } from './skills.js';
import * as SFX from './skillfx.js';

const BIOMES = ['forest', 'desert', 'swamp', 'ice', 'volcano', 'cloud'];
const SHADOW = ramp('#1d1b2e'), WHITE = ramp('#ffffff'), DUST = ramp('#cdbb9a'), SPARK = ramp('#ffd84a'), RED = ramp('#e2473d');
const lerp = (a, b, p) => a + (b - a) * Math.max(0, Math.min(1, p));
const ease = (p) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const bump = (p) => Math.sin(Math.max(0, Math.min(1, p)) * Math.PI);
const dash = (p, D, a = 0.35, b = 0.6) => (p < a ? D * ease(p / a) : p < b ? D : D * (1 - ease((p - b) / (1 - b))));
const seg = (p, a, b) => (p - a) / (b - a);

// ---------- Konst från agentfilerna, med enkel reserv om de saknas ----------
let ROSTER = null, BD = null;
const FALLBACK = [1, 2, 3, 'boss'].map((tier, i) => ({
  id: 'slime' + i, name: tier === 'boss' ? 'Jätteslemmet' : 'Slem', world: -1, tier, h: tier === 'boss' ? 140 : 14 + i * 8, w: tier === 'boss' ? 150 : 20 + i * 8, count: tier === 2 ? 4 : 1, fly: false,
  draw(g, t, pose) { const k = this.h / 14, q = Math.abs(Math.sin(t * 3)) * 2 * k; g.begin(); g.ell(0, -6 * k + q / 2, 9 * k + q / 2, 7 * k - q / 2, ramp(['#58c26d', '#4aa3d8', '#c25a8a', '#8a5ad0'][i])); g.rect(-5 * k, -9 * k, 2 * k, 3 * k, SHADOW, 0); g.rect(0, -9 * k, 2 * k, 3 * k, SHADOW, 0); g.end(); },
}));
export async function loadArt() {
  try { ROSTER = (await import('./enemies.js')).ROSTER; } catch (e) { ROSTER = null; }
  try { BD = await import('./backdrops.js'); } catch (e) { BD = null; }
  if (!ROSTER || !ROSTER.length) ROSTER = FALLBACK;
  return { enemies: ROSTER.length, backdrops: !!BD };
}
export const roster = () => ROSTER;

// ---------- Banans strider (reglerna står i rules.js) ----------
// army (valfri): kejsarens armé ur berättelsen, se armyFor i story.js och buildRun i rules.js. Utan den är allt som förut.
export const buildRun = (worldIdx, nodeIdx, node, army = null) => R.buildRun(worldIdx, nodeIdx, node, ROSTER, Math.random, army);

// ---------- Attacker: en per vapentyp. pose(p, D) ger hjältens läge, events avfyras när p passerar "at".
// hit = vilken av vapnets träffar i WEAPON_RULES (rules.js) som landar. Skadan och hur många som träffas står där. ----------
const swingArc = (rest, p, up, down, a = 0.3, b = 0.5) => (p < a ? lerp(rest, up, ease(seg(p, 0, a))) : p < b ? lerp(up, down, seg(p, a, b)) : p < 0.75 ? down : lerp(down, rest, seg(p, 0.75, 1)));
export const ATTACKS = {      // exporteras för provscenen på fliken Powers (skill-stage.js)
  none: { dur: 0.6, ev: [{ at: 0.5, hit: 0 }], pose: (p, D) => ({ dx: dash(p, D), hand: [p > 0.42 && p < 0.6 ? 7 : 0, -2] }) },
  dagger: { dur: 0.8, ev: [{ at: 0.4, hit: 0 }, { at: 0.56, hit: 1 }], pose: (p, D) => ({ dx: dash(p, D, 0.3, 0.68), wAng: 1.5, hand: [(p > 0.36 && p < 0.45) || (p > 0.52 && p < 0.61) ? 8 : 0, -3] }) },
  club: { dur: 0.8, ev: [{ at: 0.5, hit: 0, fx: 'dust' }], pose: (p, D) => ({ dx: dash(p, D), wAng: swingArc(0.55, p, -1.1, 2.0) }) },
  sword: { dur: 0.8, ev: [{ at: 0.5, hit: 0, fx: 'slash' }], pose: (p, D) => ({ dx: dash(p, D), wAng: swingArc(0.42, p, -1.0, 2.1) }) },
  axe: { dur: 0.95, ev: [{ at: 0.5, hit: 0, fx: 'slash' }], pose: (p, D) => ({ dx: dash(p, D, 0.3, 0.65), wAng: 0.35 + (p < 0.2 ? 0 : p < 0.6 ? seg(p, 0.2, 0.6) * (Math.PI * 2 + 1.6) : (1 - seg(p, 0.6, 1)) * 1.6) }) },
  spear: { dur: 0.75, ev: [{ at: 0.45, hit: 0, fx: 'slash' }], pose: (p, D) => ({ dx: dash(p, D - 12, 0.3, 0.58), wAng: 1.5, hand: [p > 0.38 && p < 0.56 ? 11 : -4, -4] }) },
  hammer: { dur: 1.05, shake: 6, ev: [{ at: 0.6, hit: 0, fx: 'shock' }], pose: (p, D) => ({ dx: dash(p, D, 0.5, 0.74), dy: p < 0.6 ? -bump(p / 0.6) * 26 : 0, wAng: p < 0.45 ? lerp(0.3, -1.3, ease(p / 0.45)) : p < 0.6 ? lerp(-1.3, 2.3, seg(p, 0.45, 0.6)) : p < 0.78 ? 2.3 : lerp(2.3, 0.3, seg(p, 0.78, 1)) }) },
  great: { dur: 1.15, shake: 8, ev: [{ at: 0.62, hit: 0, fx: 'bigslash' }], drag: true, pose: (p, D) => ({ dx: dash(p, D, 0.45, 0.76), wAng: p < 0.12 ? lerp(0.3, -2.08, ease(p / 0.12)) : p < 0.45 ? -2.08 : p < 0.62 ? lerp(-2.08, 2.15, seg(p, 0.45, 0.62)) : p < 0.8 ? 2.15 : lerp(2.15, 0.3, seg(p, 0.8, 1)) }) },   // vilar upprätt (HOLD.great = 0.3) och svingar därifrån
  staff: { dur: 1.1, ev: [{ at: 0.5, shoot: { r: 5, dur: 0.3, from: 'tip' } }, { at: 0.8, hit: 0, fx: 'boom' }], charge: { from: 0.08, to: 0.5, r0: 1, r1: 5, at: 'tip' }, pose: (p) => ({ wAng: p < 0.5 ? lerp(0.12, -0.35, ease(p / 0.5)) : p < 0.6 ? lerp(-0.35, 0.9, seg(p, 0.5, 0.6)) : lerp(0.9, 0.12, seg(p, 0.6, 1)), hand: [0, p < 0.5 ? -4 * ease(p / 0.5) : 0] }) },
  orb: { dur: 1.45, shake: 5, ev: [{ at: 0.62, shoot: { r: 15, dur: 0.26, from: 'over' } }, { at: 0.88, hit: 0, fx: 'bigboom' }], charge: { from: 0.05, to: 0.62, r0: 3, r1: 15, at: 'over' }, pose: (p) => ({ wAng: 0, noW: p > 0.05 && p < 0.95, hand: [p < 0.62 ? 0 : 5, p < 0.62 ? -9 * ease(p / 0.3) : -3] }) },
  bow: { dur: 0.85, ev: [{ at: 0.42, shoot: { arrow: true, dur: 0.18, from: 'hand' } }, { at: 0.6, hit: 0, fx: 'slash' }], pose: (p) => ({ wAng: 0, hand: [p < 0.42 ? 3 - 3 * ease(p / 0.42) : 4, -5] }) },
};

export class Battle {
  // el: tomt element. o: { profile, worldIdx, nodeIdx, node (med rec och ease), words, play(url), onEnd(result),
  //   rewardMult (avtrappningen: andel av fiendernas guld som delas ut, bara för siffran som flyger upp),
  //   bossFor(striden, bossens post i ROSTER) -> BossFight eller null: bossar med egen mekanik (boss/index.js). Finns en
  //   sådan (this.bf) tar den över bosstriden: uppgifterna, stenraden, fasbytena, segern och förlusten. Övriga bossar går som förut.
  //   onBook() (valfri): bokknappen i scenen visas och anropar den. bookCount() -> talet i knappens märke (nya ord kvar).
  //   power, powerMult: Power start. Första rätta svaret slår powerMult gånger skadan (bara skadan, inget i ordboken). }
  // Striden kan vänta (pause, resume) medan boken är öppen: klockan som animationerna går efter står då still, och
  // väntetider som går ut under tiden körs först när striden fortsätter (later, hold). Bossar med egen mekanik har egna
  // väntetider och pausas aldrig: bokknappen finns inte i bossbanor.
  constructor(el, o) {
    Object.assign(this, o); this.el = el;
    this.gear = Object.fromEntries(Object.entries(o.profile.eq).filter(([, id]) => id).map(([k, id]) => [k, BY_ID[id]]));
    // run = regeltillståndet (liv, strid, rad, guld, xp). Scenen lägger bara till det som behövs för att rita.
    this.run = R.newRun(heroStats(o.profile), buildRun(o.worldIdx, o.nodeIdx, o.node, o.army || null));
    this.hero = Object.assign(this.run.hero, { flashUntil: 0, hurtAt: -9 });
    this.fx = []; this.anim = null; this.phase = 'intro'; this.shake = 0;
    this.q = R.newQuiz(); this.target = null; this.over = false; this.bf = null;
    this.paused = false; this.pauseAt = 0; this.away = 0; this.held = []; this.task = null;
    // Skillträdet: det hjälten bär (bara utseende, se skills.js och skillfx.js). lk = null när inget bärs, då ritas allt som förut.
    const lk = o.profile.skills && o.profile.skills.worn ? looks(o.profile.skills) : null;
    this.lk = lk && lk.any ? lk : null; this.sk = SFX.newFxState(); this.cheered = false;
    el.innerHTML = `<div class="scene"><canvas class="bg"></canvas><canvas class="fg"></canvas><div class="floaters"></div>
      <div class="hud"><div class="hp me"><b>♥</b><div class="bar"><i></i></div><span></span></div>
      <div class="mid"><span class="wave"></span><span class="streak"><i></i><i></i><i></i></span></div>
      <div class="hp foe"><span class="name"></span><div class="bar"><i></i></div><span class="cd"></span></div></div>
      <button class="flee">Give up</button><button class="bookbtn" aria-label="Word Book" hidden>📖<i></i></button><div class="word"></div><div class="banner"></div></div>
      <div class="quiz"><div class="speak"><button class="again" aria-label="Spela igen">🔊</button><button class="slow" aria-label="Långsamt">🐢</button></div><div class="cards"></div></div>`;
    this.$ = (s) => el.querySelector(s);
    this.$('.again').onclick = () => this.target && this.play(`audio/${this.target.en}.mp3`);
    this.$('.slow').onclick = () => this.target && this.play(`audio/${this.target.en}.slow.mp3`);
    this.$('.flee').onclick = () => { if (!this.over) { this.gaveUp = true; this.finish(false); } };
    if (this.onBook) { const bb = this.$('.bookbtn'); bb.hidden = false; bb.onclick = () => { if (!this.over && !this.paused) this.onBook(); }; }
    this.timer = setInterval(() => this.frame(), 45);
    this.nextFight();
  }
  destroy() { this.over = true; this.held = []; if (this.bf) this.bf.stop(); clearInterval(this.timer); clearTimeout(this.bt); this.el.innerHTML = ''; }
  // Stridens klocka i sekunder. Den står still medan striden väntar, så att en attack som pågick fortsätter där den var.
  now() { return ((this.paused ? this.pauseAt : performance.now()) - this.away) / 1000; }
  pause() { if (this.paused || this.over) return false; this.pauseAt = performance.now(); this.paused = true; return true; }
  resume() {
    if (!this.paused) return;
    const gone = performance.now() - this.pauseAt; this.away += gone; this.paused = false;
    if (this.answeredAt) this.answeredAt += gone;
    if (this.task && this.task.ms === undefined) this.task.away = (this.task.away || 0) + gone;      // svarstiden räknar inte tiden i boken
    const held = this.held; this.held = []; for (const fn of held) fn();
  }
  hold(fn) { if (this.paused) this.held.push(fn); else fn(); }
  later(fn, ms) { setTimeout(() => this.hold(fn), ms); }
  // Frågan som är uppe och inte besvarad (inte ett möt-kort), eller null. Används av bokknappens regel.
  openQuestion() { const t = this.task; return this.phase === 'ask' && !this.over && t && !t.meet && t.ms === undefined ? t : null; }
  // Ett litet bokmärke vid ordet: svaret på den här frågan har fått hjälp av boken.
  markHelped() { const w = this.$('.word'); if (w && !w.querySelector('.helped')) w.insertAdjacentHTML('beforeend', '<span class="helped" aria-label="Helped by the book">📖</span>'); }

  // ----- scenens geometri -----
  nextFight() {
    const en = R.startFight(this.run), f = en.f, d = f.def, n = f.n;
    const spread = n > 1 ? Math.min(d.w * 0.85, 26) : 0, swarmW = d.w + spread * (n - 1);
    // Zoomen bestäms av höjden (108, 162 eller 216 pixlar); bredden följer skärmens form så att scenen fyller hela bredden i liggande läge.
    const sc = this.$('.scene'), asp = Math.max(1.5, Math.min(3.4, sc.clientHeight > 40 ? sc.clientWidth / sc.clientHeight : 16 / 9));
    const H = d.h > 100 || swarmW > 162 * asp * 0.42 ? 216 : d.h > 52 || swarmW > 108 * asp * 0.42 ? 162 : 108, W = Math.round(H * asp);
    this.W = W; this.H = H; this.groundY = Math.round(H * 0.8); this.heroX = Math.round(W * 0.17) + 10;
    const cx = Math.round(W * 0.74) - Math.max(0, swarmW / 2 - W * 0.2);
    en.members.forEach((m, i) => Object.assign(m, { x: Math.round(cx + (i - (n - 1) / 2) * spread), flashUntil: 0, hurtAt: -9, deadAt: 0, ph: i * 0.61 }));
    this.enemy = en;
    this.enemy.front = Math.min(...this.enemy.members.map((m) => m.x)) - d.w / 2;
    const scene = this.$('.scene'), bg = this.$('.bg'), fg = this.$('.fg');
    bg.width = fg.width = W; bg.height = fg.height = H;
    this.g = new G(W, H); this.ctx = fg.getContext('2d');
    const b = new G(W, H), biome = BIOMES[this.worldIdx] || 'forest';
    if (BD) { try { BD.drawBackdrop(b, biome, W, H, this.groundY, this.worldIdx * 100 + this.nodeIdx * 7 + this.run.fi); } catch (e) { console.error(e); } }
    else { b.begin(); b.rect(0, 0, W, this.groundY, ramp('#7fb7e6'), 3); b.rect(0, this.groundY - 3, W, H, ramp('#5aa257'), 3); b.end({ outline: false, edge: false }); }
    b.paint(bg.getContext('2d'));
    this.bf = f.tier === 'boss' && this.bossFor && this.quiz && R.stoneBoss(d) ? this.bossFor(this, d) : null;      // boss med egen mekanik
    this.banner(f.tier === 'boss' ? `BOSS: ${d.name}` : n > 1 ? `${n} × ${d.name}` : d.name, f.tier === 'boss');
    this.hud(); this.phase = 'intro'; this.introAt = this.now();
    this.later(() => { if (!this.over) this.ask(); }, f.tier === 'boss' ? 1500 : 900);
  }
  banner(text, big) { const b = this.$('.banner'); b.textContent = text; b.className = 'banner on' + (big ? ' boss' : ''); clearTimeout(this.bt); this.bt = setTimeout(() => (b.className = 'banner'), big ? 1600 : 1000); }
  alive() { return R.alive(this.run); }
  hud() {
    const h = this.hero, e = this.enemy, f = e.f, hp = e.members.reduce((s, m) => s + Math.max(0, m.hp), 0), mx = e.members.length * f.hpEach;
    this.$('.me i').style.width = (100 * h.hp / h.maxHp) + '%'; this.$('.me span').textContent = Math.max(0, h.hp);
    this.$('.foe .name').textContent = f.def.name + (f.n > 1 ? ` ×${this.alive().length}` : '');
    this.$('.foe i').style.width = (100 * hp / mx) + '%';
    this.$('.cd').textContent = '⚔'.repeat(Math.max(0, f.every - e.cd + 1)) + '·'.repeat(Math.max(0, e.cd - 1));
    this.$('.cd').classList.toggle('now', e.cd <= 1);
    this.$('.wave').textContent = `Fight ${this.run.fi + 1}/${this.run.fights.length}`;
    this.el.querySelectorAll('.streak i').forEach((p, i) => p.classList.toggle('on', !!this.power || i < this.run.streak));      // Power start: alla tre lyser tills den är använd
    this.$('.streak').classList.toggle('full', !!this.power || this.run.streak >= R.K.superStreak);
    if (this.bookCount) this.$('.bookbtn i').textContent = this.bookCount() || '';
    if (this.bf) this.bf.hud();                                  // ordstenar i stället för livmätare och nedräkning
  }
  // Ett ord blev starkare i boken: en rad som stiger över hjälten, i ordnivåns färg.
  note(text, color) { const f = document.createElement('div'); f.className = 'fl grow'; f.textContent = text; f.style.left = '50%'; f.style.top = '34%'; if (color) f.style.color = color; this.$('.floaters').appendChild(f); setTimeout(() => f.remove(), 1500); }
  float(text, x, y, cls = '') { const f = document.createElement('div'); f.className = 'fl ' + cls; f.textContent = text; f.style.left = (100 * x / this.W) + '%'; f.style.top = (100 * y / this.H) + '%'; this.$('.floaters').appendChild(f); setTimeout(() => f.remove(), 900); }

  // ----- frågan -----
  // Tydligt besked om svaret: ljud, grön eller röd ram runt frågepanelen och en stor bock eller ett kryss.
  mark(right) { this.answeredAt = performance.now(); if (this.sfx) this.sfx(right ? 'right' : 'wrong'); const q = this.$('.quiz'); q.classList.remove('ok', 'bad'); q.classList.add(right ? 'ok' : 'bad'); }
  // Nästa fråga kommer först när beskedet har hunnit synas (minMs sedan svaret) och rösten har pratat klart.
  askSoon(minMs) {
    const wait = Math.max(0, minMs - (performance.now() - (this.answeredAt || 0)));
    const idle = this.voiceIdle ? Promise.race([this.voiceIdle(), new Promise((r) => setTimeout(r, 3500))]) : Promise.resolve();
    Promise.all([idle, new Promise((r) => setTimeout(r, wait))]).then(() => this.hold(() => { if (!this.over) this.ask(); }));
  }
  ask() {
    if (this.over) return;
    if (this.bf) return this.bf.ask();                           // bossens egna uppgifter i stället för den vanliga frågan
    this.phase = 'ask'; this.first = true; this.$('.quiz').classList.remove('ok', 'bad');
    if (this.quiz) { this.target = null; this.task = this.quiz.next(); this.quiz.render(this.task, this.$('.quiz'), this.$('.word'), (r) => this.onTask(r)); return; }   // världar med byggd pedagogik
    const t = this.target = R.nextWord(this.q, this.words);
    const opts = [t, ...this.words.filter((w) => w !== t).sort(() => Math.random() - 0.5).slice(0, R.K.options - 1)].sort(() => Math.random() - 0.5);
    const cards = this.$('.cards'); cards.innerHTML = '';
    for (const o of opts) { const b = document.createElement('button'); b.className = 'card'; b.innerHTML = pic(o); b.dataset.en = o.en; b.onclick = () => this.answer(o, b); cards.appendChild(b); }
    this.$('.word').textContent = t.en;                       // ordet står utskrivet så att man tränar att läsa det
    this.play(`audio/${t.en}.mp3`);
  }
  // Svar från övningsmotorn. meet = ett nytt ord visades som ett kort och barnet tryckte på det: ett gratis slag, utan
  // risk och utan att raden eller fiendens nedräkning rörs. free = riskfri första fråga (bara när möt-korten är av):
  // fel svar kostar inget, ordet lärs in och kommer tillbaka.
  onTask(r) {
    if (this.phase !== 'ask' || this.over) return;
    if (r.meet) { this.phase = 'anim'; this.answeredAt = performance.now(); if (this.sfx) this.sfx('good'); this.note('Free hit!', '#8dffb0'); this.heroAttack(false, { free: true }); return this.hud(); }
    this.mark(r.right);
    if (!r.right && r.free) return this.ask();
    this.phase = 'anim';
    if (r.right && this.task && this.task.helped) this.note('📖 No points', '#ffd9a0');      // boken hjälpte: slaget är som vanligt, ordet får inga poäng
    if (r.right) { const mult = this.power ? this.powerMult || 1 : 1; this.power = false; this.heroAttack(R.answerRight(this.run), { mult }); }
    else { R.answerWrong(this.run); this.enemyAttack(); }
    this.hud();
  }
  answer(o, btn) {
    if (this.phase !== 'ask') return;
    this.phase = 'anim'; this.mark(o === this.target);
    if (o === this.target) {
      btn.classList.add('right');
      this.heroAttack(R.answerRight(this.run));
    } else {
      btn.classList.add('wrong'); R.answerWrong(this.run);
      [...this.el.querySelectorAll('.card')].forEach((c) => { if (c.dataset.en === this.target.en) c.classList.add('right'); });
      R.missWord(this.q);
      this.play(`audio/${this.target.en}.slow.mp3`);
      this.enemyAttack();
    }
    this.hud();
  }

  // ----- hjältens attack -----
  // x.free: gratis slag (möt-kortet), nedräkningen tickar inte efteråt. x.mult: Power start, skadan gånger mult.
  heroAttack(sup, x = {}) {
    const type = this.gear.weapon ? this.gear.weapon.type : 'none', A = ATTACKS[type];
    this.anim = { who: 'hero', type, A, t0: this.now(), dur: A.dur * (sup ? 1.15 : 1), sup, free: !!x.free, mult: x.mult > 1 ? x.mult : 1, fired: new Set(), D: Math.max(0, this.enemy.front - this.heroX - 24) };
    if (sup) this.banner('SUPER!', true); else if (this.anim.mult > 1) this.banner('POWER!', true);
    // Superattackens utseende följer det burna steget på nivå 5. until = sekunder till första träffen, så att effekten landar med skadan.
    if (sup && this.lk) { const [tx, ty] = this.target3(), hit = A.ev.find((e) => e.hit !== undefined) || A.ev[0]; this.fx.push(...SFX.superFx(this.lk, { now: this.anim.t0, x: tx, y: ty, gy: this.groundY, hx: this.heroX, hy: this.groundY - 26, until: hit.at * this.anim.dur })); }
  }
  // Segerposen efter sista fienden: följer superattacken på nivå 5 (en rörelse och gnistor, inget i reglerna). Utan ett buret steg där händer inget.
  cheer() {
    if (this.cheered || !this.lk || !this.lk.pose || this.anim) return;
    this.cheered = true; const now = this.now();
    this.anim = { who: 'cheer', t0: now, dur: 0.9, fired: new Set() };
    this.fx.push(...SFX.cheerFx(this.lk, { now, x: this.heroX, y: this.groundY - 26, gy: this.groundY, hx: this.heroX, hy: this.groundY - 26 }));
  }
  target3() { const f = this.enemy.f.def, a = this.alive()[0] || this.enemy.members[0]; return [a.x, this.groundY - f.h * 0.5]; }
  fire(ev) {
    const a = this.anim, mat = this.gear.weapon ? ramp(this.gear.weapon.hex) : WHITE, [tx, ty] = this.target3();
    if (ev.shoot) {
      const from = ev.shoot.from === 'tip' ? this.tip : ev.shoot.from === 'over' ? this.over3 : this.hand;
      const shots = ev.shoot.arrow && a.sup ? [-10, 0, 10] : [0];
      for (const off of shots) this.fx.push({ kind: 'proj', t0: this.now(), dur: ev.shoot.dur, x0: from[0], y0: from[1], x1: tx, y1: ty + off, r: ev.shoot.r * (a.sup ? 1.3 : 1), arrow: ev.shoot.arrow, mat });
      return;
    }
    // träff
    for (const { m, dmg } of this.bf ? this.bf.heroHits(ev) : R.heroHit(this.run, a.type, ev.hit, a.sup, Math.random, a.mult || 1)) {
      m.flashUntil = this.now() + 0.12; m.hurtAt = this.now();
      this.float(dmg, m.x, this.groundY - this.enemy.f.def.h - 6, a.sup || a.mult > 1 ? 'crit' : '');
      this.burst(m.x, this.groundY - this.enemy.f.def.h * 0.5, a.sup ? 14 : 7, mat, 60);
      if (m.hp <= 0 && !m.deadAt) { m.deadAt = this.now(); this.burst(m.x, this.groundY - this.enemy.f.def.h * 0.4, 12, DUST, 40); }
    }
    this.shake = Math.max(this.shake, (a.A.shake || 2) * (a.sup ? 1.5 : 1));
    if (this.lk) this.fx.push(...SFX.impactFx(this.lk, { now: this.now(), x: tx, y: ty, gy: this.groundY, hx: this.heroX, hy: this.groundY - 26 }));   // träffen från det burna steget på nivå 3
    if (ev.fx === 'slash' || ev.fx === 'bigslash') this.fx.push({ kind: 'slash', t0: this.now(), dur: 0.16, x: tx - 4, y: ty, r: (ev.fx === 'bigslash' ? 22 : 12) * (a.sup ? 1.4 : 1), mat });
    if (ev.fx === 'shock' || ev.fx === 'dust') this.fx.push({ kind: 'shock', t0: this.now(), dur: 0.4, x: this.heroX + a.D + 18, y: this.groundY, r: ev.fx === 'shock' ? 60 : 16 });
    if (ev.fx === 'boom' || ev.fx === 'bigboom') this.burst(tx, ty, ev.fx === 'bigboom' ? 40 : 18, mat, ev.fx === 'bigboom' ? 130 : 80);
    this.hud();
  }
  sparks(x, y, n) { this.burst(x, y, n, SPARK, 90); }
  burst(x, y, n, rp, speed) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, v = speed * (0.3 + Math.random() * 0.7); this.fx.push({ kind: 'p', t0: this.now(), dur: 0.25 + Math.random() * 0.35, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, rp, lv: 3 + (i % 3) }); } }

  // a = attacken som just tog slut. Ett gratis slag (a.free) kan fälla fienden, men tickar inte nedräkningen.
  afterHero(a) {
    if (this.bf) return this.bf.afterHero();
    const free = !!(a && a.free), next = R.afterHeroAttack(this.run, free);
    if (next === 'next' || next === 'won') {
      const f = this.enemy.f;
      const gold = Math.round(f.gold * (this.rewardMult ?? 1));      // samma avtrappning som resultatskärmen räknar med (reward i rules.js)
      if (gold > 0) this.float(`+${gold} gold`, this.enemy.members[0].x, this.groundY - f.def.h - 14, 'gold');
      if (next === 'won') this.cheer();
      this.later(() => { if (this.over) return; if (next === 'next') this.nextFight(); else this.finish(true); }, 900);
      return;
    }
    if (next === 'enemy') this.enemyAttack(); else { this.hud(); this.phase = 'wait'; this.askSoon(free ? 900 : 2000); }
  }
  // kind: vilken av bossens två attacker som spelas (bara bossar med egen mekanik skickar med den).
  enemyAttack(kind) { R.resetCountdown(this.run); this.anim = { who: 'enemy', t0: this.now(), dur: this.bf ? 1.05 : 0.85, fired: new Set(), kind: kind || 0 }; }
  enemyHit() {
    const dmg = this.bf ? this.bf.strike() : R.enemyStrike(this.run);
    this.hero.flashUntil = this.now() + 0.14; this.hero.hurtAt = this.now(); this.shake = Math.max(this.shake, this.bf ? 6 : 4);
    this.float(dmg > 0 ? `-${dmg}` : 'Phew!', this.heroX, this.groundY - 56, 'hurt'); this.burst(this.heroX, this.groundY - 26, 8, RED, 60); this.hud();
  }
  // Ett snedsteg mitt i en uppgift (fel ord när en mening byggs): fienden slår, men uppgiften står kvar och nedräkningen rörs inte.
  slip() {
    if (this.over || this.phase !== 'ask' || this.bf) return;
    if (this.anim) { this.enemyHit(); return this.afterSlip(); }               // redan mitt i ett slag: skadan direkt
    this.anim = { who: 'enemy', t0: this.now(), dur: 0.7, fired: new Set(), kind: 0, slip: true };
  }
  afterSlip() { if (R.defeated(this.run)) { this.phase = 'anim'; this.hero.deadAt = this.now(); this.later(() => this.finish(false), 900); } else this.hud(); }
  afterEnemy() { if (this.bf) return this.bf.afterEnemy(); if (R.defeated(this.run)) { this.hero.deadAt = this.now(); this.later(() => this.finish(false), 900); } else { this.hud(); this.phase = 'wait'; this.askSoon(3200); } }
  finish(win) {
    if (this.over) return; this.over = true; this.phase = 'over';
    const res = R.result(this.run, win); if (this.gaveUp) res.gaveUp = true;
    if (this.bf) { if (res.boss) Object.assign(res.boss, this.bf.summary()); this.bf.stop(); }
    this.onEnd(res);
  }

  // ----- bildrutan -----
  frame() {
    if (this.paused) return;                                     // boken är öppen: scenen står still
    const now = this.now(), g = this.g, { W, H, groundY } = this; if (!g) return;
    g.clear();
    const sh = this.shake > 0.3 ? Math.round((Math.random() - 0.5) * this.shake) : 0; this.shake *= 0.8;
    if (BD && BD.drawAmbient) { try { BD.drawAmbient(g, BIOMES[this.worldIdx] || 'forest', W, H, groundY, now); } catch (e) {} }
    // hjältens läge
    const lk = this.lk;
    if (lk && this.bf && this.bf.defeated && !this.cheered && !this.anim) this.cheer();      // en hjälpt boss: segerposen medan bossen säger sin sista replik
    let hp = {}, a = this.anim, p = a ? (now - a.t0) / a.dur : 0;
    if (a && a.who === 'hero') hp = a.A.pose(Math.min(1, p), a.D) || {};
    else if (a && a.who === 'cheer') hp = SFX.victoryPose(lk, Math.min(1, p)) || {};
    const hurt = Math.max(0, 1 - (now - this.hero.hurtAt) / 0.25), dx = (hp.dx || 0) - hurt * 5, dy = hp.dy || 0;
    const hx = this.heroX + dx + sh;
    g.begin(); g.ell(hx, groundY + 1.5, 12 + dy / 6, 2.4, SHADOW, false, null, 1); g.end({ outline: false, edge: false });
    const deadFor = this.hero.deadAt ? now - this.hero.deadAt : -1;
    if (deadFor < 0 || Math.floor(deadFor * 12) % 2 === 0) {
      if (this.gear.pet) drawPet(g, this.gear.pet, hx - 28, groundY - 30 + Math.round(Math.sin(now * 2) * 2), now);
      if (!(lk && SFX.heroHidden(lk, a && a.who === 'hero' && a.sup, Math.min(1, p)))) {      // under Shadow Strike är hjälten borta en stund
        g.push(Math.round(hx - 38.5), Math.round(groundY - 61 + dy)); g.flash = now < this.hero.flashUntil;
        const gear = hp.noW ? Object.assign({}, this.gear, { weapon: null }) : this.gear, args = { t: now, wAng: hp.wAng, hand: hp.hand, noShadow: true, noPet: true };
        // off = hur långt hjälten är från sin plats (så att sällskapet står kvar), busy = småvanorna vilar under attacker
        if (lk) SFX.drawHeroWithSkills(g, this.profile.look, gear, { ...args, off: [Math.round(dx), Math.round(dy)], busy: !!a }, lk, this.sk); else drawHero(g, this.profile.look, gear, args);
        g.flash = false; this.tip = g.anchor.tip || g.anchor.hand; this.hand = g.anchor.hand; this.over3 = [this.hand[0] - 4, this.hand[1] - 34]; g.pop();
        if (lk && lk.trail && a && a.who === 'hero' && !this.fx.some((e) => e.kind === 'proj')) SFX.trailPush(this.sk, this.tip, this.hand, now);   // medan ett skott flyger hör spåret till skottet
      }
    }
    if (lk) SFX.drawTrail(g, this.sk, lk, now);
    // storsvärdet river upp gnistor när det släpas
    if (a && a.who === 'hero' && a.A.drag && p > 0.12 && p < 0.45 && this.tip) this.fx.push({ kind: 'p', t0: now, dur: 0.25, x: this.tip[0], y: groundY, vx: -30 - Math.random() * 30, vy: -20 - Math.random() * 30, rp: SPARK, lv: 5 });
    // fienderna
    const f = this.enemy.f, d = f.def, ea = a && a.who === 'enemy' ? Math.min(1, p) : 0, al = this.alive();
    this.enemy.members.forEach((m, i) => {
      const dead = m.deadAt ? now - m.deadAt : -1; if (dead > 0.5) return;
      const lunge = ea && (al[0] === m || f.n > 1) ? -bump(ea) * Math.max(0, m.x - this.heroX - d.w / 2 - 14) * (f.tier === 'boss' ? 0.35 : 0.8) : 0;
      const hurtE = Math.max(0, 1 - (now - m.hurtAt) / 0.3), intro = Math.max(0, 1 - (now - this.introAt) / 0.5);
      const ex = Math.round(m.x + lunge + hurtE * 4 + intro * intro * 80 + sh);
      if (d.fly) { g.begin(); g.ell(ex, groundY + 1.5, d.w * 0.3, 2, SHADOW, false, null, 1); g.end({ outline: false, edge: false }); }
      if (dead >= 0 && Math.floor(dead * 16) % 2) return;
      g.push(ex, groundY + (dead > 0 ? Math.round(dead * 8) : 0)); g.flash = now < m.flashUntil;
      const pose = { attack: ea && (al[0] === m || f.n > 1) ? ea : 0, hurt: hurtE };
      if (this.bf) Object.assign(pose, this.bf.pose(a));         // attackKind, phase, defeated, talk (valfria fält i bosses.js)
      try { d.draw(g, now + m.ph, pose); } catch (e) { if (!this.err) { this.err = 1; console.error(d.id, e); } }
      g.flash = false; g.pop();
    });
    // händelser
    if (a) {
      if (a.who === 'hero') {
        const c = a.A.charge, mat = this.gear.weapon ? ramp(this.gear.weapon.hex) : WHITE;
        if (c && p >= c.from && p < c.to) { const at = c.at === 'tip' ? this.tip : this.over3, r = lerp(c.r0, c.r1, seg(p, c.from, c.to)) * (a.sup ? 1.3 : 1); g.begin(); g.ell(at[0], at[1], r, r, mat); g.end(); if (Math.random() < 0.6) this.fx.push({ kind: 'p', t0: now, dur: 0.3, x: at[0] + (Math.random() - 0.5) * r * 4, y: at[1] + (Math.random() - 0.5) * r * 4, vx: 0, vy: -10, rp: mat, lv: 5 }); }
        a.A.ev.forEach((ev, i) => { if (p >= ev.at && !a.fired.has(i)) { a.fired.add(i); this.fire(ev); } });
        if (p >= 1) { this.anim = null; this.afterHero(a); }
      } else if (a.who === 'cheer') { if (p >= 1) this.anim = null; }
      else {
        if (p >= 0.5 && !a.fired.has(0)) { a.fired.add(0); this.enemyHit(); }
        if (p >= 1) { const slip = a.slip; this.anim = null; if (slip) this.afterSlip(); else this.afterEnemy(); }
      }
    }
    // effekter
    g.begin(); let any = false;
    this.fx = this.fx.filter((e) => {
      if (e.kind === 'sk') return true;                          // skillträdets effekter ritas för sig längre ner
      const q = (now - e.t0) / e.dur; if (q >= 1) return false; any = true;
      if (e.kind === 'p') { const tt = now - e.t0; g.set(Math.round(e.x + e.vx * tt), Math.round(e.y + e.vy * tt + 60 * tt * tt), e.rp, q < 0.5 ? e.lv : 3); }
      if (e.kind === 'shock') for (let s = -1; s <= 1; s += 2) for (let j = 0; j < 5; j++) g.set(Math.round(e.x + s * (q * e.r + j * 2)), Math.round(e.y - j * (1 - q) * 2 - 1), DUST, 4 - (j % 2));
      if (e.kind === 'slash') for (let k = -1; k <= 1; k += 0.08) { const an = k * 1.1, rr = e.r * (0.8 + q * 0.5); g.set(Math.round(e.x + Math.cos(an) * rr), Math.round(e.y + Math.sin(an) * rr), k * k < 0.3 ? WHITE : e.mat, 5); g.set(Math.round(e.x + Math.cos(an) * (rr - 1)), Math.round(e.y + Math.sin(an) * rr), e.mat, 4); }
      return true;
    });
    if (any) g.end({ outline: false, edge: false });
    for (const e of this.fx) if (e.kind === 'proj') {
      const q = Math.min(1, (now - e.t0) / e.dur), x = lerp(e.x0, e.x1, q), y = lerp(e.y0, e.y1, q) - (e.arrow ? bump(q) * 6 : 0);
      g.begin();
      if (e.arrow) { const an = Math.atan2(e.y1 - e.y0, e.x1 - e.x0); g.push(x, y, an); g.thick(-9, 0, 2, 0, 1.6, DUST, 3); g.poly([[2, -2.5], [7, 0], [2, 2.5]], e.mat, 4); g.poly([[-9, -2], [-6, 0], [-9, 2]], WHITE, 4); g.pop(); }
      else g.ell(x, y, e.r, e.r, e.mat);
      g.end();
      if (Math.random() < 0.8) this.fx.push({ kind: 'p', t0: now, dur: 0.25, x: x - 3, y: y + (Math.random() - 0.5) * e.r, vx: -20, vy: 0, rp: e.mat, lv: 5 });
      if (lk && lk.trail) SFX.trailPush(this.sk, [x, y], [x - 1, y], now);
    }
    if (lk || this.fx.some((e) => e.kind === 'sk')) this.fx = this.fx.filter((e) => e.kind !== 'sk' || SFX.drawFx(g, e, now, this.sk));
    g.paint(this.ctx);
  }
}
