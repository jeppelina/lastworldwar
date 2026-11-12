// Ikonerna till trädets steg ritas med samma kod som effekterna, på barnets egen hjälte. Då visar ikonen precis det man
// får, och den följer med när hjälten ritas om. Varje ikon är 32x32 pixlar, som föremålens ikoner i spelet.
import { G, ramp } from './pixel.js';
import { looks } from './skills.js';
import * as FX from './skillfx.js';

// Utsnitt ur hjältens 80x72-ruta (övre vänstra hörnet) för steg som syns på kroppen. Mätt mot den omritade hjälten.
const CROP = {
  'might.1': [18, 5], 'might.2': [22, 26], 'might.4': [24, 28], 'might.6': [12, 26],
  'magic.1': [26, 9], 'magic.2': [22, 28], 'magic.4': [22, 24], 'magic.6': [24, 2],
  'shadow.1': [16, 8], 'shadow.2': [16, 24], 'shadow.4': [22, 38], 'shadow.6': [18, 8],
  'druid.1': [22, 0], 'druid.2': [20, 28], 'druid.4': [48, 38], 'druid.6': [12, 26],
};
// Steg som är en händelse i striden ritas som en stillbild av effekten.
const SCENE = {
  'might.3': (g) => FX.drawFxAt(g, 'might-hit', { x: 16, y: 14, gy: 25 }, 0.32, 0.55),
  'magic.3': (g) => FX.drawFxAt(g, 'magic-hit', { x: 16, y: 16, gy: 28 }, 0.6, 0.45),
  'shadow.3': (g) => FX.drawFxAt(g, 'shadow-hit', { x: 16, y: 16, gy: 28 }, 0.5, 0.4),
  'druid.3': (g) => FX.drawFxAt(g, 'druid-hit', { x: 15, y: 12, gy: 28 }, 0.45, 0.7),
  'might.5': (g) => { const { spike } = FX.iconParts; spike(g, 6, 28, 9, 7, -1); spike(g, 16, 28, 20, 10, 1); spike(g, 26, 28, 13, 8, -1); },
  'magic.5': (g) => { const { bigStar, flat } = FX.iconParts, C = ramp('#7fe9ff'), V = ramp('#9a6bff');
    g.begin(); for (const [x, y] of [[21, 21], [10, 13]]) for (let k = 2; k < 9; k++) g.set(Math.round(x - k * 1.6), Math.round(y - k * 2.6), k < 5 ? C : V, 5); flat(g);
    bigStar(g, 21, 21, 7); bigStar(g, 10, 13, 4); bigStar(g, 26, 7, 3); },
  'shadow.5': (g) => { const { slash, flat } = FX.iconParts; g.begin(); slash(g, 16, 16, -0.55, 30, 0.45); slash(g, 16, 16, 0.75, 30, 0.45); slash(g, 16, 16, -1.4, 28, 0.45); flat(g); },
  'druid.5': (g) => FX.drawStag(g, 10, 31, 0.1, 0.62),
};
function toUrl(g, sx = 0, sy = 0) {
  const full = document.createElement('canvas'); full.width = g.w; full.height = g.h; g.paint(full.getContext('2d'));
  const c = document.createElement('canvas'); c.width = c.height = 32; c.getContext('2d').drawImage(full, sx, sy, 32, 32, 0, 0, 32, 32);
  return c.toDataURL();
}
export function nodeIcon(node, look) {
  if (SCENE[node.id]) { const g = new G(32, 32); SCENE[node.id](g); return toUrl(g); }
  const g = new G(80, 72), lk = looks({ got: [node.id], worn: { [node.step]: node.id } }), st = FX.newFxState(), t = 0.9, [sx, sy] = CROP[node.id] || [24, 16];
  FX.drawHeroWithSkills(g, look, {}, { t, noShadow: true }, lk, st);
  if (node.id === 'shadow.2') { st.hist = [{ x: -16, y: 0, t: t - 0.15 }, { x: -8, y: 0, t: t - 0.07 }]; g.clear(); FX.drawHeroWithSkills(g, look, {}, { t, noShadow: true, busy: true }, lk, st); }   // två efterbilder
  return toUrl(g, sx, sy);
}
// Vägarnas märken (16x16): låga, stjärna, månskära, horn.
export function crestIcon(pathId) {
  const g = new G(16, 16), R = ramp;
  if (pathId === 'might') { g.begin(); g.poly([[8, 1], [11, 6], [13, 4], [14, 10], [11, 15], [5, 15], [2, 10], [4, 5], [6, 8]], R('#ff7a1f'), 3); g.end(); g.begin(); g.poly([[8, 7], [10.5, 11], [8.5, 14.5], [6, 11]], R('#ffd84a'), 5); g.end({ outline: false, edge: false }); }
  if (pathId === 'magic') FX.iconParts.bigStar(g, 8, 8, 7);
  if (pathId === 'shadow') { g.begin(); g.ell(8, 8, 6.6, 6.6, R('#4fe0c0'), true, (dx, dy) => (dx - 0.42) ** 2 + (dy + 0.12) ** 2 > 0.62); g.end(); }
  if (pathId === 'druid') { const B = R('#e8dcc0'); g.begin(); g.thick(8, 14, 8, 9, 2.2, B, 3); g.thick(8, 9, 4, 5, 2, B, 3); g.thick(4, 5, 2, 6, 1.6, B, 4); g.thick(4, 5, 4, 1, 1.6, B, 4); g.thick(8, 9, 12, 5, 2, B, 3); g.thick(12, 5, 14, 6, 1.6, B, 4); g.thick(12, 5, 12, 1, 1.6, B, 4); g.end(); g.begin(); for (const [x, y] of [[4, 0], [12, 0], [1, 6], [14, 6]]) g.dot(x, y, R('#b4f060'), 5); g.end({ outline: false, edge: false }); }
  const c = document.createElement('canvas'); c.width = c.height = 16; g.paint(c.getContext('2d')); return c.toDataURL();
}
