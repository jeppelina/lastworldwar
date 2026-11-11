// Spelets regler utan DOM: fiendernas värden, turordning, skada, superattack, belöningar och stjärnor.
// Både striden i webbläsaren (battle.js) och simulatorn (sim/) kör den här filen, så att balansen
// som mäts i simulatorn är den som spelas. Hjältens värden och priserna ligger i catalog.js.
//
// Alla siffror som går att skruva på står i K. Simulatorn kan byta ut dem med setConstants()
// för att jämföra före och efter. Slumpen skickas in som funktion (rnd) så att körningar går att upprepa.

export const K = {
  lossXp: 0.25,                     // andel av erfarenheten man får behålla när man förlorar (beslutat: en fjärdedel)
  // Fiendens grundvärden växer rakt med banans löpnummer L = världsindex * 10 + nodindex.
  // Balanserat med simulatorn 2026-11-11 (docs/research/balans.md): fienderna tål mer och slår svagare än i
  // första utkastet (22 + 6 L liv, 2,5 + 0,9 L skada). Striderna blir längre, så att andelen rätta svar
  // avgör mer och enstaka slag mindre, och en bana kräver inte längre flera nivåer mer än man har när man kommer dit.
  enemy: {
    hpBase: 40, hpPerL: 5,          // sammanlagt liv för en fiende av normalstorlek
    atkBase: 1.3, atkPerL: 0.25,    // skada per slag
    goldBase: 2, goldPerL: 0.35,    // guld per slagen fiende (gånger nivåfaktorn nedan)
    xpBase: 5, xpPerL: 1,           // xp per slagen fiende (gånger nivåfaktorn nedan)
  },
  // Fiendetyper: 1 = liten, 2 = mellan, 3 = stor, boss.
  tier: {
    hp: { 1: 0.8, 2: 1.15, 3: 1.6, boss: 4.2 },
    atk: { 1: 0.8, 2: 1, 3: 1.3, boss: 1.7 },
    every: { 1: 4, 2: 3, 3: 3, boss: 3 },     // fienden slår var N:e tur även om man svarar rätt
    gold: { 1: 1, 2: 2, 3: 3, boss: 6 },
    xp: { 1: 1, 2: 2, 3: 3, boss: 5 },
  },
  // Vilka fiendetyper en bana har, efter hur långt in i världen den ligger (nodindex / 10).
  waves: [[0.25, [1, 1, 1]], [0.5, [1, 1, 2]], [0.75, [1, 2, 2]], [Infinity, [2, 2, 3]]],
  bossWaves: [2, 'boss'],
  swarmHp: 1.4,        // en svärm har så här mycket mer liv sammanlagt, delat på medlemmarna
  swarmAtk: 0.25,      // varje extra levande medlem lägger så här mycket på slaget
  superStreak: 3,      // så många rätt i rad laddar superattacken
  superMult: 2,        // superattackens skada
  spreadLo: 0.9, spreadWidth: 0.2,   // slumpen i varje slag: 0,9 till 1,1 gånger skadan
  stars: [0.66, 0.33], // andel liv kvar som ger tre respektive två stjärnor
  // Banbonusen (nodens guld i världsdatan gånger en faktor). OBS: main.js räknar bonusen själv med
  // samma två tal (0,7 och 0,4). Ändras de här måste main.js ändras också, se docs/research/balans.md.
  bonusFactor: 0.7,    // andel av nodens guld första gången banan klaras
  replayFactor: 0.4,   // andel av bonusen när en redan klarad bana spelas om
  requeueGap: 2,       // ett missat ord kommer tillbaka tidigast efter så här många frågor
  options: 4,          // antal svarskort
};

// Byter ut konstanter (djupt, bara de nycklar som anges). Används av simulatorn, inte av spelet.
export function setConstants(patch, into = K) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object' && !Array.isArray(into[k])) setConstants(v, into[k]);
    else into[k] = v;
  }
  return K;
}

// Hur varje vapentyp träffar. hits = skadefaktor per träff i attacken, cleave = antal fiender som träffas,
// aoe = alla fiender träffas. Animationen i battle.js avgör bara när träffarna syns.
export const WEAPON_RULES = {
  none: { hits: [1] },
  dagger: { hits: [0.6, 0.6] },
  club: { hits: [1] },
  sword: { hits: [1] },
  axe: { hits: [1], cleave: 2 },
  spear: { hits: [1] },
  hammer: { hits: [1], aoe: true },
  great: { hits: [1], cleave: 2 },
  staff: { hits: [1] },
  orb: { hits: [1], aoe: true },
  bow: { hits: [1] },
};

// ---------- Banans strider ----------
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
export const levelNumber = (worldIdx, nodeIdx) => worldIdx * 10 + nodeIdx;
export function wavesFor(nodeIdx, node) {
  if (node.type === 'boss') return K.bossWaves;
  const frac = nodeIdx / 10;
  return K.waves.find(([lim]) => frac < lim)[1];
}
// En fiendes värden. def är posten i ROSTER (behöver bara id och count).
export function enemyStats(L, t, def) {
  const e = K.enemy, T = K.tier, n = def.count || 1, total = Math.round((e.hpBase + L * e.hpPerL) * T.hp[t]);
  return {
    def, tier: t, n,
    hpEach: Math.max(1, Math.round((total * (n > 1 ? K.swarmHp : 1)) / n)),
    atk: Math.max(1, Math.round((e.atkBase + L * e.atkPerL) * T.atk[t])),
    every: T.every[t],
    gold: Math.round((e.goldBase + L * e.goldPerL) * T.gold[t]),
    xp: Math.round((e.xpBase + L * e.xpPerL) * T.xp[t]),
  };
}
// roster: listan med fiender (world, tier, count). Väljer en fiende per strid, helst olika.
export function buildRun(worldIdx, nodeIdx, node, roster, rnd = Math.random) {
  const L = levelNumber(worldIdx, nodeIdx);
  const inWorld = roster.filter((e) => e.world === worldIdx || e.world === -1);
  const byTier = (t) => { const c = inWorld.filter((e) => e.tier === t); return c.length ? c : roster.filter((e) => e.tier === t); };
  const used = new Set();
  return wavesFor(nodeIdx, node).map((t) => {
    let def = pick(byTier(t), rnd); for (let i = 0; i < 6 && used.has(def.id); i++) def = pick(byTier(t), rnd); used.add(def.id);
    return enemyStats(L, t, def);
  });
}

// ---------- En omgång (en bana): tillstånd och turordning ----------
// hero: { maxHp, atk } från heroStats. Livet följer med mellan striderna.
export function newRun(hero, fights) {
  return { hero: { hp: hero.maxHp, maxHp: hero.maxHp, atk: hero.atk }, fights, fi: -1, enemy: null, streak: 0, gold: 0, xp: 0, kills: 0 };
}
export function startFight(run) {
  run.fi++;
  const f = run.fights[run.fi];
  run.enemy = { f, cd: f.every, members: Array.from({ length: f.n }, () => ({ hp: f.hpEach, maxHp: f.hpEach })) };
  return run.enemy;
}
export const alive = (run) => run.enemy.members.filter((m) => m.hp > 0);

// Rätt svar på första försöket: returnerar true om attacken blir en superattack.
export function answerRight(run) {
  const sup = run.streak >= K.superStreak;
  run.streak = sup ? 0 : run.streak + 1;
  return sup;
}
// Fel svar: raden bryts. (Fienden slår direkt, se resetCountdown och enemyStrike.)
export function answerWrong(run) { run.streak = 0; }

// En träff i hjältens attack. hitIdx = vilken av vapnets träffar. Returnerar [{ m, dmg, died }].
export function heroHit(run, weaponType, hitIdx, sup, rnd = Math.random) {
  const W = WEAPON_RULES[weaponType] || WEAPON_RULES.none, al = alive(run), targets = W.aoe ? al : al.slice(0, W.cleave || 1), out = [];
  for (const m of targets) {
    const dmg = Math.max(1, Math.round(run.hero.atk * W.hits[hitIdx] * (sup ? K.superMult : 1) * (K.spreadLo + rnd() * K.spreadWidth)));
    m.hp -= dmg;
    out.push({ m, dmg, died: m.hp <= 0 });
  }
  return out;
}
// Efter hjältens attack. Antingen är fienden slagen (belöningen bokförs), eller så tickar fiendens
// nedräkning: 'enemy' = fienden slår nu, 'ask' = nästa fråga.
export function afterHeroAttack(run) {
  if (!alive(run).length) {
    const f = run.enemy.f; run.gold += f.gold; run.xp += f.xp; run.kills++;
    return run.fi + 1 < run.fights.length ? 'next' : 'won';
  }
  return --run.enemy.cd <= 0 ? 'enemy' : 'ask';
}
// Fienden börjar slå: nedräkningen börjar om (gäller både fel svar och när nedräkningen gått ut).
export function resetCountdown(run) { run.enemy.cd = run.enemy.f.every; }
// Fiendens slag landar. Returnerar skadan. Hjälten är besegrad om hero.hp <= 0 efteråt.
export function enemyStrike(run, rnd = Math.random) {
  const f = run.enemy.f, n = alive(run).length;
  const dmg = Math.max(1, Math.round(f.atk * (1 + K.swarmAtk * (n - 1)) * (K.spreadLo + rnd() * K.spreadWidth)));
  run.hero.hp -= dmg;
  return dmg;
}
export const defeated = (run) => run.hero.hp <= 0;

export function stars(run) { const frac = run.hero.hp / run.hero.maxHp; return frac > K.stars[0] ? 3 : frac > K.stars[1] ? 2 : 1; }
export function result(run, win) {
  return { win, stars: win ? stars(run) : 0, gold: run.gold, xp: win ? run.xp : Math.round(run.xp * K.lossXp), kills: run.kills, fights: run.fights.length };
}

// ---------- Vilket ord som frågas ----------
// q: { queue: [], asked: 0, target: null }. Ett missat ord kommer tillbaka efter requeueGap frågor,
// annars dras ett slumpat ord som inte är samma som förra.
export const newQuiz = () => ({ queue: [], asked: 0, target: null });
export function nextWord(q, words, rnd = Math.random) {
  let t = q.queue.length && q.asked - q.queue[0].at >= K.requeueGap ? q.queue.shift().w : null;
  for (let i = 0; !t && i < 20; i++) { const c = pick(words, rnd); if (c !== q.target) t = c; }
  q.target = t; q.asked++;
  return t;
}
export function missWord(q) { q.queue.push({ w: q.target, at: q.asked }); }

// ---------- Belöning efter banan ----------
// first = banan var inte klarad förut. Speglar endBattle i main.js.
export function levelBonus(node, first, win) { return win ? Math.round(node.gold * (first ? 1 : K.replayFactor) * K.bonusFactor) : 0; }
// Bokför guld och xp på profilen och räknar nivåer. xpToLevel kommer från catalog.js. Returnerar { bonus, ups }.
export function applyResult(profile, res, node, first, xpToLevel) {
  const bonus = levelBonus(node, first, res.win);
  profile.gold += res.gold + bonus; profile.xp += res.xp;
  let ups = 0; while (profile.xp >= xpToLevel(profile.level)) { profile.xp -= xpToLevel(profile.level); profile.level++; ups++; }
  if (!res.win) profile.defeats = (profile.defeats || 0) + 1;
  return { bonus, ups };
}

// ---------- En hel tur i ett svep, för simulatorn ----------
// Samma steg som Battle går igenom med animationer emellan. correct = rätt på första försöket.
// Returnerar 'ask' (nästa fråga), 'next' (fienden slagen, ny strid väntar), 'won' eller 'lost'.
export function playTurn(run, correct, weaponType, rnd = Math.random) {
  if (correct) {
    const sup = answerRight(run), W = WEAPON_RULES[weaponType] || WEAPON_RULES.none;
    for (let i = 0; i < W.hits.length; i++) heroHit(run, weaponType, i, sup, rnd);
    const next = afterHeroAttack(run);
    if (next !== 'enemy') return next;
  } else answerWrong(run);
  resetCountdown(run);
  enemyStrike(run, rnd);
  return defeated(run) ? 'lost' : 'ask';
}
