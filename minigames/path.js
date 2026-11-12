// Mend the Path: tap a tile to turn it a quarter. Join the path from Page (left) to the spark (right).
// Puzzles are generated: walk a random path through the grid, lay matching pieces, fill the rest, then turn everything.
// It cannot be lost or locked. Tiles joined to the start glow.
import { rnd, shuffle, timers, landscape, sprite } from './shared.js';

const N = 1, E = 2, S = 4, W = 8, DIRS = [[N, -1, 0, S], [E, 0, 1, W], [S, 1, 0, N], [W, 0, -1, E]];
const rot = (m) => ((m << 1) & 15) | (m >> 3);
// Färger per värld (1 skog, 2 öken, 3 träsk, 6 moln). Övriga världar använder skogens. 3 och 6 är tillägg i spelet.
const THEME = { 3: { g1: '#3d5a4a', g2: '#365243', p: '#9a7a52', pe: '#6a5236', lit: '#d8ff8a', le: '#7fc23a' }, 6: { g1: '#8fb8e8', g2: '#84aee0', p: '#f4f0ff', pe: '#b8b0d8', lit: '#ffe14d', le: '#f0a020' }, 1: { g1: '#2f6a3a', g2: '#2a6034', p: '#b99a6a', pe: '#8a6f45', lit: '#ffd66b', le: '#f0a020' }, 2: { g1: '#d9b36a', g2: '#cfa85e', p: '#8f8266', pe: '#6f6146', lit: '#fff0a0', le: '#f0a020' } };

function walk(R, C) {
  const start = [rnd(R), 0], goal = [rnd(R), C - 1], seen = new Set([start.join()]), path = [start];
  const go = () => {
    const [r, c] = path[path.length - 1];
    if (r === goal[0] && c === goal[1]) return true;
    for (const [, dr, dc] of shuffle(DIRS)) {
      const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
      if (nr < 0 || nc < 0 || nr >= R || nc >= C || seen.has(k)) continue;
      seen.add(k); path.push([nr, nc]); if (go()) return true; path.pop();
    }
    return false;
  };
  go(); return path;
}
export function generate(R, C, tees = 0) {
  const path = [0, 1, 2, 3].map(() => walk(R, C)).sort((a, b) => a.length - b.length)[2];   // of four random walks, the second longest
  const grid = Array.from({ length: R }, () => Array(C).fill(0));
  path.forEach(([r, c], i) => {
    let m = 0;
    for (const j of [i - 1, i + 1]) { if (!path[j]) continue; const [pr, pc] = path[j]; m |= DIRS.find(([, dr, dc]) => r + dr === pr && c + dc === pc)[0]; }
    if (i === 0) m |= W; if (i === path.length - 1) m |= E;
    grid[r][c] = m;
  });
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (!grid[r][c]) grid[r][c] = [N | S, N | E, N | E, N | E | S][rnd(4)];
  for (const [r, c] of shuffle(path.slice(1, -1)).slice(0, tees)) { const free = [N, E, S, W].filter((d) => !(grid[r][c] & d)); if (free.length === 2) grid[r][c] |= free[rnd(2)]; }
  const solution = grid.map((row) => row.slice());
  let par = 0;
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const k = rnd(4); for (let i = 0; i < k; i++) grid[r][c] = rot(grid[r][c]); }
  const st = { R, C, grid, start: path[0], goal: path[path.length - 1] };
  if (reach(st).won) grid[st.start[0]][st.start[1]] = rot(grid[st.start[0]][st.start[1]]);
  for (const [r, c] of path) { let m = grid[r][c], k = 0; while (m !== solution[r][c] && k < 4) { m = rot(m); k++; } par += k; }
  return { ...st, solution, par };
}
// Which tiles are joined to the start, and is the goal reached with its exit open?
export function reach({ R, C, grid, start, goal }) {
  const lit = new Map();
  if (grid[start[0]][start[1]] & W) {
    lit.set(start.join(), null); const q = [start];
    while (q.length) {
      const [r, c] = q.shift();
      for (const [d, dr, dc, back] of DIRS) {
        const nr = r + dr, nc = c + dc, k = nr + ',' + nc;
        if (!(grid[r][c] & d) || nr < 0 || nc < 0 || nr >= R || nc >= C || lit.has(k) || !(grid[nr][nc] & back)) continue;
        lit.set(k, [r, c]); q.push([nr, nc]);
      }
    }
  }
  const won = lit.has(goal.join()) && !!(grid[goal[0]][goal[1]] & E);
  return { lit, won };
}

export function start(root, { level = 1, world = 1, sfx, onDone }) {
  const T = timers(), th = THEME[world] || THEME[1], land = landscape(root);
  // Storlek 3 (störst) är ett tillägg i spelet: högst 4 x 6 rutor, som designnoten tillåter på en liggande telefon.
  const sizes = (level > 2 ? [[4, 5, 2], [4, 5, 3], [4, 6, 4]] : level > 1 ? [[4, 4, 0], [4, 5, 1], [4, 5, 3]] : [[3, 3, 0], [3, 4, 0], [4, 4, 0]]).map(([r, c, t]) => (land ? [r, c, t] : [c, r, t]));
  const U = 16, page = sprite('page'), spark = sprite('spark');
  let n = -1, pz = null, taps = 0, parSum = 0, tapSum = 0, busy = false, walker = null;
  root.innerHTML = `<div class="mg"><div class="mg-status"><span class="mg-say">Turn the tiles. Mend the path!</span><span class="dots"></span></div><div class="fit"></div></div>`;
  const fit = root.querySelector('.fit'), say = root.querySelector('.mg-say');
  let cv, g;

  function next() {
    n++;
    if (n >= sizes.length) return onDone({ won: true, score: tapSum, stars: tapSum <= parSum * 1.6 + 6 ? 3 : tapSum <= parSum * 2.6 + 12 ? 2 : 1, note: `${sizes.length} paths mended` });
    const [R, C, tees] = sizes[n]; pz = generate(R, C, tees); taps = 0; busy = false; walker = null; parSum += pz.par;
    root.querySelector('.dots').innerHTML = sizes.map((_, i) => `<i class="${i < n ? 'on' : i === n ? 'now' : ''}"></i>`).join('');
    say.textContent = 'Turn the tiles. Mend the path!';
    fit.innerHTML = `<div class="grid pathboard" style="--cols:${C + 2};--rows:${R};--pc:${C};--max:120px;width:calc(var(--cell) * ${C + 2});height:calc(var(--cell) * ${R})"><canvas width="${(C + 2) * U}" height="${R * U}"></canvas>
      <div class="cells">${Array.from({ length: R * C }, (_, i) => `<button data-r="${Math.floor(i / C)}" data-c="${i % C}"></button>`).join('')}</div></div>`;
    cv = fit.querySelector('canvas'); g = cv.getContext('2d');
    fit.querySelectorAll('.cells button').forEach((b) => { b.onclick = () => turn(+b.dataset.r, +b.dataset.c); });
    draw();
  }
  function turn(r, c) {
    if (busy) return;
    pz.grid[r][c] = rot(pz.grid[r][c]); taps++; tapSum++; sfx('turn');
    const { lit, won } = draw();
    if (won) {
      busy = true; sfx('win'); say.textContent = 'The path is whole!';
      const steps = []; let k = pz.goal; while (k) { steps.unshift(k); k = lit.get(k.join()); }
      steps.forEach((s, i) => T.later(() => { walker = s; draw(); }, 250 + i * 170));
      T.later(next, 250 + steps.length * 170 + 900);
    }
  }
  function draw() {
    const res = reach(pz), { R, C, grid, start: st, goal } = pz; fit.firstElementChild.dataset.won = res.won ? '1' : '';
    g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
    for (let r = 0; r < R; r++) for (let c = 0; c < C + 2; c++) { g.fillStyle = (r + c) % 2 ? th.g1 : th.g2; g.fillRect(c * U, r * U, U, U); }
    const strip = (x, y, w, h, on) => { g.fillStyle = on ? th.le : th.pe; g.fillRect(x - 1, y - 1, w + 2, h + 2); return () => { g.fillStyle = on ? th.lit : th.p; g.fillRect(x, y, w, h); }; };
    const piece = (cx, cy, m, on) => {
      const fills = [strip(cx + 6, cy + 6, 4, 4, on)];
      if (m & N) fills.push(strip(cx + 6, cy, 4, 6, on)); if (m & S) fills.push(strip(cx + 6, cy + 10, 4, 6, on));
      if (m & W) fills.push(strip(cx, cy + 6, 6, 4, on)); if (m & E) fills.push(strip(cx + 10, cy + 6, 6, 4, on));
      fills.forEach((f) => f());
    };
    piece(0, st[0] * U, E, true); piece((C + 1) * U, goal[0] * U, W, res.won);
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) piece((c + 1) * U, r * U, grid[r][c], res.lit.has(r + ',' + c));
    g.strokeStyle = '#0003'; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) g.strokeRect((c + 1) * U + 0.5, r * U + 0.5, U - 1, U - 1);
    const at = walker ? [(walker[1] + 1) * U + 1, walker[0] * U + 3] : [1, st[0] * U + 3];
    g.drawImage(page, at[0], at[1]);
    g.drawImage(spark, (C + 1) * U + 5, goal[0] * U + 5);
    return res;
  }
  next();
  // Test hook: the current puzzle, so a script can solve it by turning tiles toward the stored solution.
  root.__path = () => pz;
  return () => T.clear();
}
