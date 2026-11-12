// Spelets regler utan DOM: fiendernas värden, turordning, skada, superattack, belöningar och stjärnor.
// Både striden i webbläsaren (battle.js) och simulatorn (sim/) kör den här filen, så att balansen
// som mäts i simulatorn är den som spelas. Hjältens värden och priserna ligger i catalog.js.
//
// Här står bara formler. Alla tal ligger i balance.js (K). Simulatorn kan byta ut dem med setConstants()
// för att jämföra andra förslag. Slumpen skickas in som funktion (rnd) så att körningar går att upprepa.
import { K as BK, nodes as NODES, version } from './balance.js';

export const K = BK;                       // samma objekt som i balance.js
export const BALANCE_VERSION = version;    // skrivs i varje stage-händelse (bv), så att belopp går att härleda i efterhand

// Byter ut konstanter (djupt, bara de nycklar som anges). Används av simulatorn, inte av spelet.
export function setConstants(patch, into = K) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && into[k] && typeof into[k] === 'object' && !Array.isArray(into[k])) setConstants(v, into[k]);
    else into[k] = v;
  }
  return K;
}

// ---------- Banornas rekommenderade nivå ----------
export const WORLD_IDS = Object.keys(NODES.rec);     // världarna i kartans ordning
export const nodeCount = (world) => (NODES.rec[typeof world === 'number' ? WORLD_IDS[world] : world] || []).length;
// world: index eller id. Returnerar { rec, ease, own }. Kistor och minispel saknar egen nivå (own = false)
// och räknas efter närmast föregående bana.
export function nodeInfo(world, i, src = NODES) {
  const id = typeof world === 'number' ? Object.keys(src.rec)[world] : world, recs = src.rec[id] || [], eases = (src.ease || {})[id] || [];
  let rec = recs[i] ?? null; const own = rec != null;
  if (!own) { for (let j = i; j >= 0 && rec == null; j--) rec = recs[j] ?? null; if (rec == null) rec = recs.find((x) => x != null) ?? 1; }
  return { rec, ease: eases[i] ?? 1, own };
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
export function wavesFor(nodeIdx, node) {
  if (node.type === 'boss') return K.bossWaves;
  const frac = nodeIdx / 10;
  return K.waves.find(([lim]) => frac < lim)[1];
}
// En fiendes värden ur banans rekommenderade nivå (rec) och lättnad (ease). def är posten i ROSTER (behöver bara id och count).
export function enemyStats(rec, ease, t, def) {
  const E = K.enemy, T = K.tier, n = def.count || 1, g = Math.pow(E.growth, rec - 1), total = Math.round(E.hp * g * ease * T.hp[t]);
  return {
    def, tier: t, n,
    hpEach: Math.max(1, Math.round((total * (n > 1 ? K.swarmHp : 1)) / n)),
    atk: Math.max(1, Math.round(E.atk * g * ease * T.atk[t])),
    every: T.every[t],
    gold: Math.max(1, Math.round(E.gold * Math.pow(E.goldGrowth, rec - 1) * T.gold[t])),
    xp: Math.max(1, Math.round(E.xp * Math.pow(E.xpGrowth, rec - 1) * T.xp[t])),
  };
}
// roster: listan med fiender (world, tier, count). Väljer en fiende per strid, helst olika.
// Banans nivå och lättnad läses ur node.rec och node.ease. Saknas de slås de upp i balance.js.
export function buildRun(worldIdx, nodeIdx, node, roster, rnd = Math.random) {
  const info = node.rec != null ? node : nodeInfo(worldIdx, nodeIdx), rec = info.rec, ease = info.ease ?? 1;
  const inWorld = roster.filter((e) => e.world === worldIdx || e.world === -1);
  const byTier = (t) => { const c = inWorld.filter((e) => e.tier === t); return c.length ? c : roster.filter((e) => e.tier === t); };
  const used = new Set();
  return wavesFor(nodeIdx, node).map((t) => {
    let def = pick(byTier(t), rnd); for (let i = 0; i < 6 && used.has(def.id); i++) def = pick(byTier(t), rnd); used.add(def.id);
    return enemyStats(rec, ease, t, def);
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
  const res = { win, stars: win ? stars(run) : 0, gold: run.gold, xp: win ? run.xp : Math.round(run.xp * K.lossXp), kills: run.kills, fights: run.fights.length };
  if (run.boss) res.boss = { lit: run.boss.lit, stones: run.boss.stones, keep: win ? 0 : bossKeep(run.boss), wrong: run.boss.wrong };   // stenar som står kvar tända till nästa försök
  return res;
}

// ---------- Bossfight med ordstenar ----------
// Bossar med egen mekanik (K.boss.on i balance.js, se game/boss/) har ingen livmätare. Bossen har en rad ordstenar:
// varje löst uppgift tänder en sten (ibland två), alla tända är seger. Hjältens attack avgör alltså inte bossdelen,
// det gör orden. Hjältens liv avgör hur många missar man har råd med: ett fel svar är ett slag från bossen
// (K.boss.wrong gånger bossens skada), och vid varje fasbyte kommer ETT förvarnat slag (K.boss.phaseHit) som aldrig
// kan fälla hjälten, följt av lite liv tillbaka (K.boss.phaseHeal). Nedräkningen "var tredje tur" gäller inte här.
// Förstriden före bossen går som en vanlig strid. Bossens skada (f.atk) räknas som förut ur banans rek.
export const stoneBoss = (def) => !!(K.boss && def && (K.boss.on || []).includes(def.id));
export const bossStoneCount = (young) => (young && K.young && K.young.bossStones ? K.young.bossStones : K.boss.stones);
// kept = stenar som stod kvar från förra försöket (aldrig alla). Anropas efter startFight för bosstriden.
export function startBoss(run, kept = 0, young = false) {
  const stones = bossStoneCount(young);
  run.boss = { stones, lit: Math.max(0, Math.min(stones - 1, Math.floor(kept) || 0)), wrong: 0 };
  run.boss.kept = run.boss.lit;
  return run.boss;
}
// Fasen (1 till antal trösklar + 1) följer hur många stenar som är tända.
export function bossPhase(b) { let ph = 1; for (const share of K.boss.phases) if (b.lit >= Math.floor(b.stones * share + 1e-9)) ph++; return ph; }
// En löst uppgift: n stenar tänds. Returnerar { lit, won, phaseUp }. Vid seger bokförs bossens guld och xp som för en slagen fiende.
export function bossRight(run, n = 1) {
  const b = run.boss, before = bossPhase(b);
  b.lit = Math.min(b.stones, b.lit + Math.max(1, Math.round(n)));
  const won = b.lit >= b.stones;
  if (won && !b.won) { b.won = true; const f = run.enemy.f; run.gold += f.gold; run.xp += f.xp; run.kills++; }
  return { lit: b.lit, won, phaseUp: !won && bossPhase(b) > before };
}
function bossBlow(run, mult, lethal, rnd) {
  let dmg = Math.max(1, Math.round(run.enemy.f.atk * mult * (K.spreadLo + rnd() * K.spreadWidth)));
  if (!lethal) dmg = Math.max(0, Math.min(dmg, run.hero.hp - 1));
  run.hero.hp -= dmg;
  return dmg;
}
// Fel svar: bossens slag landar. Returnerar skadan. Hjälten är besegrad om hero.hp <= 0 efteråt.
export function bossWrong(run, rnd = Math.random) { run.boss.wrong++; return bossBlow(run, K.boss.wrong, true, rnd); }
// Fasbytets förvarnade slag: lämnar alltid minst 1 liv. bossPhaseHeal ger sedan tillbaka en andel av maxlivet.
export const bossPhaseHit = (run, rnd = Math.random) => bossBlow(run, K.boss.phaseHit, false, rnd);
export function bossPhaseHeal(run) { const h = run.hero, heal = Math.max(0, Math.min(h.maxHp - h.hp, Math.round(h.maxHp * K.boss.phaseHeal))); h.hp += heal; return heal; }
export const bossKeep = (b) => Math.min(b.stones - 1, Math.floor(b.lit * K.boss.keep + 1e-9));
// En hel bosstur i ett svep, för simulatorn. correct = uppgiften löst, n = antal stenar den tänder.
export function playBossTurn(run, correct, rnd = Math.random, n = 1) {
  if (correct) {
    const r = bossRight(run, n);
    if (r.won) return 'won';
    if (r.phaseUp) { bossPhaseHit(run, rnd); bossPhaseHeal(run); }
    return 'ask';
  }
  answerWrong(run); bossWrong(run, rnd);
  return defeated(run) ? 'lost' : 'ask';
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
// Avtrappning: hur stor del av guld och xp från slagna fiender som delas ut, efter hur långt hjältens nivå
// ligger över banans rekommenderade nivå. 1 = full belöning.
export function rewardFactor(heroLevel, rec) {
  const F = K.falloff;
  if (!F || F.type !== 'level' || rec == null) return 1;
  const over = heroLevel - rec - F.free;
  return over <= 0 ? 1 : Math.max(F.floor, +(1 - F.step * over).toFixed(4));
}
export const enemyGoldAt = (rec) => enemyGold(rec);
const enemyGold = (rec) => K.enemy.gold * Math.pow(K.enemy.goldGrowth, rec - 1);
// Banbonus: bara första gången banan klaras (first). node behöver type och rec.
export function levelBonus(node, first, win) {
  if (!win) return 0;
  return Math.round((first ? (node.type === 'boss' ? K.bossBonus : K.firstBonus) : K.replayBonus || 0) * enemyGold(node.rec));
}
export const chestGold = (rec) => Math.round(K.chestBonus * enemyGold(rec));
// Guld för ett minispel på en nod med rekommenderad nivå rec: första gången noden spelas klart, eller dagens första omgång.
export const miniGold = (rec, first) => (K.mini ? Math.max(1, Math.round((first ? K.mini.first : K.mini.daily) * enemyGold(rec))) : 0);
// Guld när ett ord når en ny högsta nivå: K.learn.gold[tier] fienders guld på hjältens nivå.
export function learnGold(tier, level) { const g = K.learn && K.learn.gold; return g ? Math.round((g[Math.min(tier, g.length - 1)] || 0) * enemyGold(level)) : 0; }
// Xp när ett ord når en ny högsta nivå (tier) i ordboken: en andel av xp-kravet för hjältens nivå. mult: se learnMult.
export function learnXp(tier, level, xpToLevel, mult = 1) {
  const L = K.learn, share = L ? L.share[Math.min(tier, L.share.length - 1)] : 0;
  return share > 0 ? Math.max(1, Math.round(share * mult * xpToLevel(level))) : 0;
}
export const learnMult = (young) => (K.learn ? K.learn.mult ?? 1 : 0) * (young && K.young ? K.young.learnMult : 1);
// Andel av fiendernas xp som delas ut: lägre i världar där orden ger xp (de som har innehållsfil).
export const killXpFactor = (hasContent) => (hasContent && K.learn ? K.learn.kill : 1);
// Vad en omgång ger. res kommer från result(). node behöver type och rec. first = banan var inte klarad förut.
// Returnerar { factor, bonus, gold (fiender efter avtrappning + bonus), xp (fiender efter avtrappning) }.
export function reward(res, node, first, heroLevel, hasContent = false) {
  const factor = rewardFactor(heroLevel, node.rec), bonus = levelBonus(node, first, res.win);
  return { factor, bonus, gold: Math.round(res.gold * factor) + bonus, xp: Math.round(res.xp * factor * killXpFactor(hasContent)) };
}
// Bokför guld och xp på profilen och räknar nivåer. xpToLevel kommer från catalog.js. Returnerar { bonus, ups, gold, xp, factor }.
export function applyResult(profile, res, node, first, xpToLevel, hasContent = false) {
  const r = reward(res, node, first, profile.level, hasContent);
  profile.gold += r.gold; profile.xp += r.xp;
  let ups = 0; while (profile.xp >= xpToLevel(profile.level)) { profile.xp -= xpToLevel(profile.level); profile.level++; ups++; }
  if (!res.win) profile.defeats = (profile.defeats || 0) + 1;
  return { ...r, ups };
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
