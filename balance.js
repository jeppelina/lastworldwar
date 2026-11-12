// Spelets balans: alla tal på ett ställe. rules.js och catalog.js innehåller bara formler och läser talen härifrån.
// Simulatorn (sim/balance.mjs, sim/grind.mjs, sim/learn.mjs) läser SAMMA fil, så det som mäts är det som spelas.
// Underlag: docs/research/balans2.md (rekommenderad nivå, kurvor, avtrappning) och balans3.md (xp för ord, ordmätare).
//
// LAPPA SÅ HÄR
//   1. Ändra talet nedan, höj `version` med ett och skriv en rad i ändringsloggen (datum, vad, varför, vilken simulering).
//   2. Kör `node game/sim/learn.mjs --exp R` och jämför raderna "spelet" med föregående utskrift i sim/out/learn-R.txt.
//   3. Kör `node game/balance.test.mjs` (kontrollerar bland annat att ingen visad nivå kan sjunka).
//   Tumreglerna står i balans2.md avsnitt 12. De viktigaste:
//     - Fritt att ändra när som helst (gäller bara framtida omgångar): fiendernas tal, rek och lättnad per bana,
//       guld och xp, bonusar, avtrappningen, priser, K.learn (xp per ordnivå), K.gate (åt det snälla hållet), K.wordShare.
//     - Xp-kurvan (TUNE.xpBase, xpGrowth, xpRamp) får bara bli billigare. Blir den dyrare sjunker nivåer, och då krävs
//       en engångsgåva per profil (se levelKeep i main.js, som gjorde det för version 2).
//     - Ordmätarens tröskel får sänkas när som helst men höjas bara för världar barnet inte har börjat.
//
// VREDEN FÖR "FORTARE FRAMÅT" (förälderns önskemål 2026-11-12: lätt att lappa om barnen ska gå fortare)
//     K.wordShare        andel av varje banas ord som används (1 = alla, 0.7 = de första 70 procenten). Färre ord per värld.
//     K.gate.boss.share  andel av världens ord som ska vara Steel innan bossen öppnar (0.5). Lägre = bossen öppnar tidigare.
//     K.learn.mult       xp per ordnivå, ett tal för alla nivåer (1). K.learn.share är andelen av en nivå per ordnivå.
//     K.young            samma tre vred för barn med "Yngre barn" ikryssat på föräldraskärmen.
//
// ÄNDRINGSLOGG
//   v2  2026-11-12  Första versionen av filen. Balans2 (rek per bana, tio procent per nivå, avtrappning a, banbonus bara
//                   första gången, kistor ur formel, vapen i butiken) plus balans3 "rec": xp mest från ord (K.learn),
//                   bossen 2,6 liv och 1,15 skada, ordmätare på bossen 50 procent Steel, försprång 4 poäng, ung-läge.
//                   Mätaren längs vägen (K.gate.node) är INTE påslagen. Första mötet med ett ord har fyra kort
//                   (K.firstOptions), annars ger en gissning försprånget varannan gång.
//                   Simulering: sim/out/learn-R.txt (raderna "spelet" = den här filen, "rekommenderat" = balans3 som simulerat).
export const version = 2;

// ---------- Striden och belöningarna (formlerna står i rules.js) ----------
export const K = {
  lossXp: 0.25,                     // andel av fiendernas xp man får behålla när man förlorar (beslutat: en fjärdedel)
  // Fiendens värden räknas ur banans rekommenderade nivå (rek): tal * growth^(rek - 1) * banans lättnad * typfaktor.
  enemy: {
    hp: 60, atk: 4.4, growth: 1.10,     // liv och skada på rek 1, och tillväxten per rek-nivå (hör ihop med TUNE.heroGrowth)
    gold: 2, goldGrowth: 1.065,         // guld per slagen fiende (hör ihop med TUNE.priceGrowth)
    xp: 5, xpGrowth: 1.05,              // xp per slagen fiende (hör ihop med TUNE.xpGrowth)
  },
  // Fiendetyper: 1 = liten, 2 = mellan, 3 = stor, boss.
  tier: {
    hp: { 1: 0.8, 2: 1.15, 3: 1.6, boss: 2.6 },
    atk: { 1: 0.8, 2: 1, 3: 1.3, boss: 1.15 },
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
  requeueGap: 2,       // ett missat ord kommer tillbaka tidigast efter så här många frågor (världar utan innehållsfil)
  options: 4,          // antal svarskort (världar utan innehållsfil)

  // Banbonus: så många fienders guld (på banans rek) första gången banan klaras. Inget vid omspel.
  firstBonus: 4, bossBonus: 30, replayBonus: 0,
  chestBonus: 12,      // en kista ger så många fienders guld
  shop: { weaponFirst: true },      // så länge hjälten inte äger något vapen finns alltid ett vapen på hyllan
  // Avtrappning (regel a): full belöning från slagna fiender upp till `free` nivåer över banans rek, sedan
  // minus `step` per nivå, lägst `floor`. Banbonusen och xp för ord påverkas inte. type 'none' stänger av.
  falloff: { type: 'level', free: 3, step: 0.25, floor: 0.1 },

  // ---------- Lärandet ger styrka (balans3) ----------
  // Xp när ett ord når en ny högsta nivå i ordboken: share[nivå] * mult * xp-kravet för hjältens nivå.
  // Nivåerna: 0 Wood, 1 Iron, 2 Steel, 3 Gold, 4 Emerald, 5 Crystal, 6 Star, 7 Neutron Star.
  // kill: andel av fiendernas xp som finns kvar i världar som har innehållsfil (övriga världar ger full fiende-xp).
  learn: { share: [0, 0.01, 0.025, 0.035, 0.045, 0.05, 0.05, 0.05], mult: 1, kill: 0.2 },
  // Ordmätare. boss: bossen går att utmana när `share` av världens ord har nått nivå `tier` (2 = Steel).
  // node: mätaren längs vägen (en ny bana öppnas när share av de tidigare banornas ord är Iron). INTE BYGGD i spelet:
  // föräldern har inte bett om den och ett lås på vanliga banor kan stänga in ett barn. `on` läses bara av simulatorn.
  gate: { boss: { share: 0.5, tier: 2 }, node: { on: false, share: 0.6, tier: 1 } },
  knownStart: 4,       // rätt svar första gången barnet möter ett ord ger ordet minst så här många poäng (försprång)
  firstOptions: 4,     // antal kort vid första mötet (skrivna val för barn som inte läser är alltid två, och ger då inget försprång)
  wordShare: 1,        // andel av varje banas ord som används (introduce och phrases, de första i listan). 1 = alla.
  // Ung-läge (bocken "Yngre barn" per barn på föräldraskärmen).
  young: { thin: 0.5, bossShare: 0.35, learnMult: 3 },
};

// ---------- Hjälten, föremålen och nivåerna (formlerna står i catalog.js) ----------
export const TUNE = {
  heroAtk: 12, heroHp: 40, heroGrowth: 1.10,   // hjältens värden utan utrustning: tal * heroGrowth^(nivå - 1)
  powerBase: 6, powerGrowth: 1.4641,           // föremålets styrka = powerBase * powerGrowth^materialnivå * typens faktor * platsens faktor (1,4641 = 1,10^4)
  hpPower: 2.4,                                // ett föremål som ger liv ger så här många gånger mer än ett som ger attack
  priceBase: 170, priceGrowth: 1.2155,         // pris = priceBase * priceGrowth^materialnivå * typens faktor * platsens faktor
  pricePet: 1.6, priceBack: 1.3,               // prisfaktor för följeslagare och ryggsaker (övriga platser använder sin styrkefaktor)
  levelPerTier: 4,                             // nivåkrav = 1 + materialnivå * levelPerTier + typens extra krav
  xpBase: 85, xpGrowth: 1.05, xpRamp: 5,       // xp till nästa nivå = xpBase * min(nivå, xpRamp) / xpRamp * xpGrowth^(nivå - 1)
};

// ---------- Banorna: rekommenderad nivå (rek) och lättnad per nod ----------
// Ordningen följer map/data.js (nod för nod). null = kista eller butik (de räknas efter närmast föregående bana).
// ease: andel av fiendens liv och skada (1 om inget anges). En boss som visar sig för hård lappas här, inte i kurvorna.
export const nodes = {
  rec: {
    ordskogen:       [1, 2, 3, null, 4, 5, null, 6, 6, 7, 8],
    soloknen:        [8, 9, 10, null, 10, 11, null, 12, 12, 13, 14],
    svamptrasket:    [14, 15, 16, 16, null, 17, 18, null, 18, 19, 20],
    frostbergen:     [20, 21, 22, null, 22, 23, 24, null, 24, 25, 26],
    meningsvulkanen: [26, 27, 27, 28, null, 28, 29, null, 30, 30, 31, 32],
    molnslottet:     [32, 33, 34, 34, null, 35, 36, null, 36, 37, 38],
  },
  ease: {
    ordskogen: [0.45, 0.5, 0.55, null, 0.6, 0.68, null, 0.76, 0.84, 0.92, 1],
  },
  bossGearTier: [0, 1, 2, 3, 4, 6],      // väntad utrustning vid varje boss (bara simulatorns spärrkarta)
};

// Äldre kurvor, för nivåskyddet när en kurva byts (levelKeepGrant i catalog.js). Ändra aldrig en rad här.
export const history = {
  v1: { xpBase: 20, xpPerLevel: 12 },    // före 2026-11-12: xp till nästa nivå = 20 + 12 * nivå
};

export default { version, K, TUNE, nodes, history };
