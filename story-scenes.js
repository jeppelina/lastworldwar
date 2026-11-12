// Berättelsens bilder och den lilla scenspelaren. Reglerna och tabellen står i story.js.
// Helskärmsstunderna använder samma scen som introfilmen (makeRoot och makeStage i intro.js): en canvas i låg upplösning,
// en engelsk rad med svensk stödrad under, och ett tryck var som helst går förbi. Stunderna på kartan ritas av
// map/story.js inne i kartan. Här finns bara deras pratbubbla (samma utseende som bossens replik) och trycklagret.
// Inget ljud skapas här: en stund som har ett befintligt klipp (audio i tabellen) spelar det via play(url).
import { G, ramp as R } from './pixel.js';
import { drawHero } from './hero.js';
import { drawBackdrop, drawAmbient } from './backdrops.js';
import { makeRoot, makeStage, drawPage, shard, spark, halo, glow, sceneStar, PAL, ease, clamp, lerp } from './intro.js';

const { sin, cos, abs, min, max, round, floor, PI } = Math;
const fract = (v) => v - floor(v);
const EM = { A: R('#4a3f78'), A2: R('#2f2752'), CP: R('#a8243f'), TR: R('#e0aa3c'), WOOD: R('#9a6b3f'), PLANK: R('#c9965a'), STEEL: R('#c8c8d8') };

// Fiendernas och bossarnas bilder hämtas först när en scen behöver dem (filerna är redan laddade av striden).
let ART = null;
async function art() {
  if (ART) return ART;
  const a = {};
  try { const m = await import('./enemies.js'); a.glomsk = m.BY_ID.glomsk; } catch (e) { console.error('story: enemies.js', e); }
  try { const m = await import('./enemies-new.js'); for (const id of ['snatchers', 'clunk', 'peeper', 'lugg']) a[id] = m.BY_ID_NEW[id]; } catch (e) { console.error('story: enemies-new.js', e); }
  return (ART = a);
}
// Kejsarens armé som lista, till rules.buildRun (se armyFor i story.js).
export async function armyPool() { const a = await art(); return ['snatchers', 'clunk', 'peeper', 'lugg'].map((id) => a[id]).filter(Boolean); }
function enemy(g, e, x, y, k, t) { if (!e) return; g.push(round(x), round(y), 0, k); try { e.draw(g, t, { attack: 0, hurt: 0 }); } catch (err) {} g.pop(); }

// Barnets egen hjälte och Page längst till vänster, som tittar på det som händer. o: { look, gear }.
function watchers(g, st, t, o, po = {}) {
  const hx = max(24, st.cx - 62), gy = st.gy;
  g.push(hx - 38.5, gy - 61); drawHero(g, o.look, o.gear || {}, { t, blink: (t % 3.4) < 0.14 }); g.pop();
  g.push(hx + 24, gy + 1 - round(po.hop || 0)); drawPage(g, t, { back: !!po.back, shut: !!po.shut }); g.pop();
  return [hx + 24, gy - 8];
}
function star(g, x, y, r, t) {
  const rot = sin(t * 1.3) * 0.2;
  g.begin(); halo(g, x, y, r + 5, '#ffe98a', 0.6); g.end({ outline: false, edge: false });
  g.begin(); shard(g, x, y, r, PAL.star, 4, rot); g.end();
  g.begin(); shard(g, x, y, r * 0.55, PAL.white, 5, rot); g.end({ outline: false, edge: false });
}
// Marken ligger på tre fjärdedelar av höjden, så att fötterna hamnar ovanför textraden även på en iPad (högre bild).
const backdrop = (biome, seed) => (W, H) => { const bg = new G(W, H), gy = round(H * 0.74); drawBackdrop(bg, biome, W, H, gy, seed); return { bg, W, H, cx: W >> 1, gy }; };

// Kejsarens luftskepp: lila ballong med guldband och röd fena, en gondol under och kejsarens krona som sticker upp.
function airship(g, x, y, t) {
  x = round(x); y = round(y);
  g.begin();
  g.poly([[x + 17, y - 3], [x + 28, y - 9], [x + 28, y + 7], [x + 17, y + 3]], EM.CP, 3);
  g.ell(x, y, 22, 9, EM.A);
  g.rect(x - 2, y - 9, 3, 18, EM.TR, 3);
  g.end();
  g.begin(); g.line(x - 9, y + 8, x - 7, y + 13, PAL.dark, 1); g.line(x + 9, y + 8, x + 7, y + 13, PAL.dark, 1); g.end({ outline: false, edge: false });
  g.begin();
  g.rect(x - 2, y + 9, 5, 4, EM.A2, 2); g.rect(x - 2, y + 8, 1, 1, EM.TR, 4); g.rect(x, y + 7, 1, 2, EM.TR, 4); g.rect(x + 2, y + 8, 1, 1, EM.TR, 4);
  g.end({ outline: false, edge: false });
  g.begin(); g.set(x - 1, y + 11, PAL.gold, 5); g.set(x + 1, y + 11, PAL.gold, 5); g.end({ outline: false, edge: false });
  g.begin(); g.poly([[x - 11, y + 13], [x + 11, y + 13], [x + 8, y + 19], [x - 8, y + 19]], EM.WOOD, 3); g.rect(x - 11, y + 13, 22, 1, EM.TR, 4); g.end();
  g.begin(); g.rect(x - 6, y + 15, 2, 2, PAL.spark, 5); g.rect(x + 4, y + 15, 2, 2, PAL.spark, 5); g.rect(x + 12, y + 14 + (floor(t * 9) % 2), 1, 3, EM.STEEL, 4); g.end({ outline: false, edge: false });
}
function signpost(g, x, y, ang = 0) {
  g.push(x, y, ang);
  g.begin(); g.rect(-1, -14, 2, 15, EM.WOOD, 2); g.end();
  g.begin(); g.poly([[-9, -19], [6, -19], [10, -16], [6, -13], [-9, -13]], EM.PLANK, 4); g.rect(-6, -17, 4, 1, EM.WOOD, 1); g.rect(0, -17, 5, 1, EM.WOOD, 1); g.end();
  g.pop();
}
function flag(g, x, y, t) {
  const w = round(sin(t * 5));
  g.begin(); g.rect(x, y - 25, 1, 26, EM.STEEL, 4); g.end();
  g.begin(); g.poly([[x + 1, y - 25], [x + 14, y - 25 + w], [x + 14, y - 16 + w], [x + 1, y - 16]], EM.CP, 3); g.end();
  g.begin(); g.rect(x + 5, y - 21, 6, 2, EM.TR, 4); g.set(x + 5, y - 22, EM.TR, 5); g.rect(x + 7, y - 23, 2, 2, EM.TR, 5); g.set(x + 10, y - 22, EM.TR, 5); g.end({ outline: false, edge: false });
}

// ====================================================================================================
// SCENERNA: build(W, H) ger en färdig bakgrund, draw(g, st, t) ritar det rörliga, post(ctx, st, t) lägger sken ovanpå.
// ====================================================================================================
export const SCENES = {
  // Före första bossen: trollet kliar sig i huvudet, en stjärnbit svävar över honom och ordgnistorna dras dit.
  trollWhy: (o) => ({
    build: backdrop('forest', 7),
    draw(g, st, t) {
      const { W, H, cx, gy } = st, e = ART.glomsk, k = e ? min(0.6, (gy - 22) / e.h) : 0.5, tx = min(W - 34, cx + 38);
      drawAmbient(g, 'forest', W, H, gy, t);
      enemy(g, e, tx, gy + 1, k, t);
      const sx = tx - 4, sy = max(12, gy - (e ? e.h : 120) * k - 8) + sin(t * 2) * 1.5;
      star(g, sx, sy, 9, t);
      g.begin();
      for (let i = 0; i < 14; i++) { const u = fract(t * 0.22 + i / 14), a = i * 2.4 + u * 5, rad = (1 - u) * W * 0.42 + 9; spark(g, sx + cos(a) * rad, sy + sin(a) * rad * 0.45, i % 4 === 0 ? 2 : i % 2); }
      g.end({ outline: false, edge: false });
      watchers(g, st, t, o, { hop: max(0, sin(t * 4)) * 2 });
      st.s = [sx, sy];
    },
    post(ctx, st, t) { glow(ctx, st.s[0], st.s[1], 17 + sin(t * 3) * 2, '255,235,150', 0.18); },
  }),

  // Efter trollet: kejsaren långt borta på sitt torn stampar och skakar näven, och en röd blixt slår ner i förgrunden
  // (brännmärket som sedan finns på kartan).
  emperorAngry: () => ({
    build: (W, H) => sceneStar.build(W, H),
    shake(t) { const u = t - 1.2; return u > 0 && u < 3 && abs(sin(u * 6)) < 0.25 ? [0, 1] : t > 5.1 && t < 5.5 ? [round(sin(t * 60)), round(cos(t * 47))] : [0, 0]; },
    draw(g, st, t) {
      const u = t - 1.2, hop = u > 0 && u < 3 ? abs(sin(u * 6)) * 4 : 0;
      st.emp = { dy: round(hop), pose: { fist: ease((t - 0.6) / 0.6), menace: 1 } };
      sceneStar.draw(g, st, t);
      const ex = st.tx + 1, ey = st.by - 65 - 30 - round(hop);
      g.begin();
      if (t > 0.9) for (let i = 0; i < 8; i++) { const v = fract(t * 0.9 + i / 8); g.set(round(ex + (i % 2 ? 1 : -1) * (3 + v * 9)), round(ey - v * 9), PAL.white, v < 0.5 ? 5 : 3); }   // ånga ur öronen
      const b = (t - 4.2) / 0.9, x0 = st.tx - 5, y0 = st.by - 84, x1 = round(st.cx - min(st.W * 0.34, 78)), y1 = st.hy - 9, n = 16;
      st.hit = null; st.mad = t > 0.6 && t < 4.6 ? [ex, ey + 14] : null;
      if (b > 0 && b < 1) for (let j = 0; j < n * b; j++) { const v = j / n; g.rect(round(lerp(x0, x1, v) + (j % 2 ? 2 : -2)), round(lerp(y0, y1, v)), 2, 2, j % 3 ? PAL.fire : PAL.spark, 5); }
      if (b >= 1) {                                               // nedslaget: bränd fläck med glödande sprickor
        st.hit = [x1, y1, b - 1];
        for (let j = 0; j < 9; j++) g.rect(x1 - 9 + j * 2, y1 + (j % 3) - 1, 2, 2, j % 2 ? PAL.fire : PAL.red, j % 2 ? 5 : 3);
        for (let j = 0; j < 5; j++) { const v = fract(t * 0.6 + j / 5); g.set(round(x1 - 6 + j * 3 + sin(t + j) * 1.5), round(y1 - 3 - v * 14), PAL.stone, v < 0.5 ? 3 : 2); }
      }
      g.end({ outline: false, edge: false });
    },
    post(ctx, st, t) {
      sceneStar.post(ctx, st, t);
      if (st.mad) glow(ctx, st.mad[0], st.mad[1], 15 + sin(t * 9) * 3, '255,40,30', 0.2);                 // röd av ilska
      if (st.hit) { glow(ctx, st.hit[0], st.hit[1], 16, '255,90,40', 0.2); if (st.hit[2] < 0.35) { ctx.fillStyle = `rgba(255,240,210,${clamp(0.7 - st.hit[2] * 2)})`; ctx.fillRect(0, 0, st.W, st.H); } }
    },
  }),

  // Värld 2: kejsarens trupper marscherar förbi en bit bort. Samma figurer som sedan kan dyka upp i banorna.
  march: (o) => ({
    build: backdrop('desert', 3),
    draw(g, st, t) {
      const { W, H, gy } = st, k = 0.55, x0 = W * 0.66 - t * 6, y = gy + 1;
      drawAmbient(g, 'desert', W, H, gy, t);
      enemy(g, ART.lugg, x0 + 108, y, k * 0.85, t);
      enemy(g, ART.peeper, x0 + 44, y - 26, k, t + 1);
      for (let i = 3; i >= 0; i--) enemy(g, ART.snatchers, x0 + 22 + i * 12, y, k, t + i * 0.37);
      enemy(g, ART.clunk, x0, y, k, t);
      flag(g, round(x0 - 12), y - round(abs(sin(t * 4))), t);
      g.begin();
      for (let i = 0; i < 10; i++) { const v = fract(t * 0.8 + i / 10); g.set(round(x0 + i * 12 + v * 5), round(y - v * 4), PAL.rope, v < 0.5 ? 4 : 2); }   // damm kring fötterna
      g.end({ outline: false, edge: false });
      watchers(g, st, t, o, { back: true, hop: abs(sin(t * 9)) * 0.8 });
    },
  }),

  // Efter sfinxen: luftskeppet firar ner en krok, tar vägskylten och lämnar en flagga med kejsarens krona.
  steal: (o) => ({
    build: backdrop('desert', 9),
    draw(g, st, t) {
      const { W, H, cx, gy } = st, px = min(W - 30, cx + 26), T0 = 2, T1 = 2.7, T2 = 3.4;
      drawAmbient(g, 'desert', W, H, gy, t);
      const sx = t < T0 ? lerp(W + 40, px, ease(t / T0)) : t < T2 ? px : lerp(px, -50, ease((t - T2) / 2.4)), sy = 25 + sin(t * 2) * 1.5;
      const reach = gy - 19 - (sy + 19), len = t < T0 ? 0 : t < T1 ? reach * ease((t - T0) / (T1 - T0)) : t < T2 ? lerp(reach, 9, ease((t - T1) / (T2 - T1))) : 9;
      const taken = t >= T1, hy = sy + 19 + len;
      if (!taken) signpost(g, px, gy + 1);
      else { g.begin(); g.rect(px - 1, gy - 3, 2, 4, EM.WOOD, 2); g.set(px - 1, gy - 4, EM.PLANK, 4); g.end(); }                        // stubben som blir kvar
      if (len > 0) { g.begin(); g.line(round(sx), round(sy + 19), round(sx), round(hy), PAL.rope, 3); g.rect(round(sx) - 1, round(hy), 3, 1, EM.STEEL, 4); g.end({ outline: false, edge: false }); }
      if (taken) signpost(g, round(sx), round(hy + 19), sin(t * 5) * 0.25);
      airship(g, sx, sy, t);
      if (t > 4.4) { const v = min(1, (t - 4.4) / 0.3); flag(g, px + 6, gy + 1 + round((1 - v) * 8) - round(abs(sin((t - 4.4) * 8)) * max(0, 3 - (t - 4.4) * 4)), t); }
      const [bx, by] = watchers(g, st, t, o, { hop: t > T1 ? abs(sin(t * 7)) * 3 : 0 });
      if (t > T1 && t < T1 + 2) { g.begin(); g.rect(bx - 1, by - 22, 3, 6, PAL.white, 5); g.rect(bx - 1, by - 14, 3, 2, PAL.white, 5); g.end(); }   // utropstecken över Page
    },
  }),

  // Värld 3: jätten Lugg har somnat med kejsarens säck. En stjärngnista smiter ur säcken och flyger till Page.
  lugg: (o) => ({
    build: backdrop('swamp', 5),
    draw(g, st, t) {
      const { W, H, cx, gy } = st, e = ART.lugg, k = e ? min(0.78, (gy - 12) / e.h) : 0.6, lx = min(W - 44, cx + 30);
      drawAmbient(g, 'swamp', W, H, gy, t);
      enemy(g, e, lx, gy + 1, k, t * 0.6);
      const top = gy - (e ? e.h : 100) * k, bx = lx + 26 * k, by = gy - 62 * k;
      g.begin();
      for (let i = 0; i < 3; i++) {                               // Z z z
        const v = fract(t * 0.3 + i / 3), zx = round(lx - 26 * k - v * 12), zy = round(top + 6 - v * 16), s = 3 + i;
        g.rect(zx, zy, s, 1, PAL.white, 5); g.rect(zx, zy + s - 1, s, 1, PAL.white, 5); for (let j = 1; j < s - 1; j++) g.set(zx + s - 1 - j, zy + j, PAL.white, 5);
      }
      for (let i = 0; i < 6; i++) { const v = fract(t * 0.4 + i / 6), a = i * 1.9; spark(g, bx + cos(a) * (5 + v * 8), by - 6 - v * 10 + sin(a) * 3, i % 3 === 0 ? 1 : 0); }
      g.end({ outline: false, edge: false });
      const u = clamp((t - 3) / 3), tip = t > 6, [px, py] = watchers(g, st, t, o, { hop: tip ? abs(sin((t - 6) * 6)) * 3 : max(0, sin(t * 2)) }), v = ease(u);
      st.f = null;
      if (t > 3 && !tip) { const fx = lerp(bx, px, v), fy = lerp(by, py, v) - sin(v * PI) * 26; g.begin(); spark(g, fx, fy, 2); g.end({ outline: false, edge: false }); st.f = [fx, fy]; }
      st.s = [bx, by - 6]; st.p = tip ? [px, py] : null;
    },
    post(ctx, st, t) { glow(ctx, st.s[0], st.s[1], 13 + sin(t * 2.5) * 2, '255,235,150', 0.14); if (st.f) glow(ctx, st.f[0], st.f[1], 6, '255,220,120', 0.25); if (st.p) glow(ctx, st.p[0], st.p[1], 14, '255,240,170', 0.16); },
  }),
};

// ====================================================================================================
// SPELAREN
// ====================================================================================================
const CSS = `
#story { position:fixed; inset:0; z-index:40; background:#07061a; } #story[hidden] { display:none; }
#story .wl-skip { min-height:56px; min-width:72px; }
#story-tap { position:fixed; inset:0; z-index:14; touch-action:manipulation; -webkit-tap-highlight-color:transparent; cursor:pointer; } #story-tap[hidden] { display:none; }
.st-cap { position:absolute; left:50%; top:max(52px, calc(env(safe-area-inset-top) + 52px)); transform:translateX(-50%); display:flex; align-items:center; gap:10px; width:max-content; max-width:min(92vw, 520px); min-height:56px; box-sizing:border-box;
  padding:6px 16px 6px 8px; border-radius:16px; background:#fffdf4; color:#1d1b2e; box-shadow:0 4px 0 #8f8266, 0 0 0 3px #1d1b2e33; text-align:left; }
.st-cap.low { top:auto; bottom:max(96px, calc(env(safe-area-inset-bottom) + 96px)); }
.st-cap canvas { width:48px; height:44px; flex:none; image-rendering:pixelated; image-rendering:crisp-edges; image-rendering:pixelated; }
.st-cap b { display:block; font-size:clamp(15px, 2.7vw, 22px); font-weight:800; line-height:1.15; }
.st-cap small { display:block; font-size:clamp(11px, 1.7vw, 15px); font-weight:600; color:#5a5f7a; margin-top:2px; }
`;
function host(id) {
  if (!document.getElementById('story-css')) { const s = document.createElement('style'); s.id = 'story-css'; s.textContent = CSS; document.head.appendChild(s); }
  let el = document.getElementById(id);
  if (!el) { el = document.createElement('div'); el.id = id; el.hidden = true; document.body.appendChild(el); }
  return el;
}
const setLine = (en, sv, line) => { en.textContent = line ? line[0] : ''; sv.textContent = line ? line[1] : ''; };

// En helskärmsstund. m = raden i MOMENTS. o: { play(url), look, gear, onDone, t (fryst tid i sekunder, för skärmbilder) }.
// Ett tryck var som helst (eller Skip) avslutar, annars tar stunden slut av sig själv efter m.dur sekunder.
// Returnerar en funktion som avslutar stunden (onDone anropas alltid precis en gång).
export function playFull(m, o = {}) {
  const el = host('story'); el.innerHTML = ''; el.hidden = false;
  let done = false, stage = null, tick = 0; const born = performance.now();
  const finish = () => { if (done) return; done = true; clearInterval(tick); if (stage) stage.stop(); el.hidden = true; el.innerHTML = ''; if (o.onDone) o.onDone(); };
  art().then(() => {
    if (done) return;
    const make = SCENES[m.scene]; if (!make) return finish();
    const root = makeRoot(el); stage = makeStage(root, o.t);
    const cap = document.createElement('div'); cap.className = 'wl-cap'; cap.innerHTML = '<div class="en"></div><div class="sv"></div>'; setLine(cap.firstChild, cap.lastChild, m.line);
    const skip = document.createElement('button'); skip.className = 'wl-skip'; skip.innerHTML = 'Skip &#9654;&#9654;';
    root.append(cap, skip);
    stage.set(make({ look: o.look || { skin: '#f3c7a2', hair: '#6b4426', style: 'spiky' }, gear: o.gear || {} }));
    root.onclick = () => { if (performance.now() - born > 350) finish(); };      // samma tryck som öppnade stunden ska inte stänga den
    skip.onclick = (e) => { e.stopPropagation(); finish(); };
    if (m.audio && o.play && o.t === undefined) { try { o.play(m.audio); } catch (e) {} }
    tick = setInterval(() => { if (o.t === undefined && stage.time() > (m.dur || 8)) finish(); }, 100);
  });
  return finish;
}

// Pratbubblan och trycklagret för en stund på kartan. Bilden ritas av kartan själv (map/story.js). o: { play, onTap, low }.
// low = bubblan läggs nertill (ovanför knappraden) i stället för upptill, när hjälten står högt upp på skärmen.
// Returnerar en funktion som tar bort bubblan och lagret.
let pageIcon = null;
export function mapCaption(m, o = {}) {
  const el = host('story-tap'); el.innerHTML = ''; el.hidden = false;
  if (m.line) {
    if (!pageIcon) { const g = new G(24, 22); g.push(12, 21); drawPage(g, 0.4, {}); g.pop(); pageIcon = document.createElement('canvas'); pageIcon.width = 24; pageIcon.height = 22; g.paint(pageIcon.getContext('2d')); }
    const cap = document.createElement('div'); cap.className = 'st-cap' + (o.low ? ' low' : ''); cap.innerHTML = '<div><b></b><small></small></div>'; cap.prepend(pageIcon);
    setLine(cap.querySelector('b'), cap.querySelector('small'), m.line); el.appendChild(cap);
  }
  const born = performance.now();
  el.onclick = () => { if (performance.now() - born > 350 && o.onTap) o.onTap(); };
  if (m.audio && o.play) { try { o.play(m.audio); } catch (e) {} }
  return () => { el.hidden = true; el.onclick = null; el.innerHTML = ''; };
}
