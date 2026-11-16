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
//   v3  2026-11-12  Minispel på kartan (K.mini): lite guld första gången en minispelsnod spelas klart, några mynt en gång
//                   per dag därefter, sedan inget. Ingen xp, ingen utrustning, inga ändringar i ordboken. Inga andra tal
//                   är ändrade: fiender, xp, priser och rek per bana är som i v2. Butiksnoden på kartan är nu en
//                   minispelsnod på samma plats i listan (rek null som förut). Simuleringen (learn.mjs --exp R) ger
//                   samma tal som före ändringen: simulatorn spelar inte minispel och räknar inte deras guld.
//   v4  2026-11-12  Barnen sprang igenom åtta banor på en kvart, kom till The Dark Path (rek 6) på nivå 3 och förlorade
//                   16 gånger i rad utan att spela om något. xpBase 85 -> 42 (hälften så mycket xp per nivå, nivåerna stiger
//                   direkt för alla eftersom nivån räknas ur summan) och guld per fiende 2 -> 2.6. Ordmätaren på bossen
//                   är oförändrad, så orden måste fortfarande läras. Inte simulerat före lappen.
//   v5  2026-11-12  Högst K.newPerRun nya ord per omgång (resten kommer när banan spelas om), så att en bana med elva nya ord
//                   inte lär ut alla på en gång. Orden 'a' och 'the' frågas inte längre ensamma (isolated: false i innehållet).
//   v6  2026-11-12  Bossfighter med ordstenar för The Forgetful Troll och The Riddle Sphinx (K.boss, K.young.bossStones,
//                   reglerna under "Bossfight med ordstenar" i rules.js). Förstriden och de fyra andra bossarna är orörda.
//                   Bossen har 8 ordstenar i stället för liv (ung-läge 6), nedräkningen "var tredje tur" är borta i de två
//                   bossfighterna: fel svar 1,5 x bossens skada, ett förvarnat slag 1,5 x vid varje fasbyte som aldrig kan
//                   fälla hjälten, sedan 12 procent av maxlivet tillbaka, och hälften av stenarna står kvar efter en förlust.
//                   Inga andra tal är ändrade. Simulering: node game/sim/boss.mjs (sim/out/boss.txt). På rek med väntad
//                   utrustning, 50 / 70 / 85 procent rätt: trollet 7 / 68 / 99 procent vinst före och 9 / 66 / 97 efter,
//                   sfinxen 8 / 66 / 98 före och 10 / 69 / 98 efter. Hjältens attack avgör inte längre bossdelen (bara
//                   förstriden), så en hjälte under rek klarar sig bättre än förut och en över rek kan inte slå sig förbi orden.
//   v7  2026-11-12  Guld när ett ord når en ny nivå i ordboken (K.learn.gold, i fiendeguld på hjältens nivå), så att det
//                   lönar sig att träna ord och inte bara att vinna banor. Mål: ungefär ett föremål extra per speldag.
//                   Butiken fyller på dagens hylla om den är kortare än den nya storleken. Inte simulerat.
//   v8  2026-11-12  Steel går att nå samma dag: kravet på två olika dagar flyttat till Gold (NEED_DAYS i words.js), Steel 7 -> 5
//                   poäng och svagare avtagande för rätta svar samma dag (1 + 0,25 * antal i stället för 1 + antal). Barnen stod vid
//                   bossen med 37 och 48 ord på Iron och inget på Steel, och inget de gjorde samma dag kunde ändra det.
//                   Kartans stjärnor visar nu ordens nivå på banan (1 = klarad, 2 = hälften Steel, 3 = nästan alla Steel). Inte simulerat.
//   v9  2026-11-12  Skillträdet (K.skill, game/skills.js, docs/research/skilltree.md): sparks som låser upp utseendesteg.
//                   En spark på nivå 4 och sedan var tredje nivå (7, 10, 13 ...), en per slagen världsboss och en per 20 ord
//                   som nått Steel i boken (högst fyra). Trädet är BARA utseende: förmånerna på nivå 4 (K.skill.perks) är
//                   avstängda och inga regler läser dem. Inga andra tal är ändrade, och ingen strid räknas annorlunda.
//   v10  2026-11-12  Ordgymmet (gym.js, K.gym): träna alla mötta ord utan fiende. Mer guld för nivåerna över Steel
//                   (K.learn.gold Gold 5 -> 8, Emerald 6 -> 12, Crystal 7 -> 16, Star 7 -> 20, Neutron Star 7 -> 25) och en dagsbonus
//                   för första passet varje dag. Inte simulerat.
//   v11  2026-11-12  Försprånget K.knownStart 4 -> 2,5: ett ord barnet kan första gången behöver nu fyra till fem rätta svar
//                   för Steel (förut räckte två). Gäller bara nya svar: försprånget står sparat per svar i loggen.
//   v12  2026-11-12  Berättelsen (K.story, game/story.js): korta stunder med kejsaren, minst K.story.gap vunna strider emellan.
//                   Efter stunden "w2-march" kan EN fiende i en vanlig bana bytas mot en ur kejsarens armé av samma typ
//                   (K.story.army.chance per bana, högst K.story.army.max per bana, aldrig i en bossbana). Fiendens liv, skada,
//                   guld och xp räknas som förut ur banans rek och typ, så inga andra tal är ändrade. Inte simulerat:
//                   simulatorn skickar inte in någon armé och drar därför exakt samma slumptal som före ändringen.
//   v13  2026-11-13  Banans boksida (K.page, game/wordpage.js): sidan ur barnets ordbok för just den banan visas före striden,
//                   och nås med bokknappen under striden. Nya ord kommer först som ett "möt ordet"-kort (K.meet): ett tryck är
//                   ett gratis slag utan risk (fiendens nedräkning tickar inte), ordet hamnar i boken utan poäng och kommer
//                   tillbaka som en vanlig fråga med alla kort efter K.meet.gap frågor. Det ersätter den riskfria första
//                   frågan och lär in-kortet. Försprånget K.knownStart 2,5 -> 0 (förälderns beslut: det är bara bra att
//                   repetera ord man kan). Gäller bara nya svar: försprång som redan står sparade per svar i loggen spelas upp
//                   som förut. Power start (K.powerStart): har barnet hört alla banans nya ord på sidan slår första rätta
//                   svaret dubbelt. Ordbokens poäng påverkas inte av det. Bokknappen mitt i en fråga på ett av sidans ord
//                   (K.page.peek 'helped'): svaret spelas som vanligt i striden men ger ordet inga poäng den gången.
//                   Simulering: node game/sim/learn.mjs --exp R (se PLAN.md, tillägget 2026-11-13, för hur talen rörde sig).
//   v14  2026-11-16  Minibossar (K.miniboss, game/miniboss.js): en stor fiende per värld kan komma som SISTA striden i en vanlig
//                   bana (sannolikhet chance per omgång, bara banor vars sista strid är typ 2 eller 3, aldrig i en bossbana).
//                   Den har typens värden för den platsen gånger hp (liv) och atk (skada), xp gånger xp, och guld plus `gold`
//                   fienders guld på banans rek. Nedräkningen (every) är som för typen. Inga andra tal är ändrade: vanliga
//                   fiender, bossarna och trollets och sfinxens bossfighter räknas som förut. Inte simulerat: simulatorn
//                   skickar inte in minibossar och drar därför exakt samma slumptal som före ändringen.
//   v15  2026-11-16  Andra lagret i berättelsen (K.happen, game/story.js och game/map/story.js): små händelser på kartan.
//                   Bara hur ofta saker syns: korta stunder (BEATS) delar avståndet K.story.gap med de stora stunderna,
//                   spår som ligger kvar (flagga, staty, kista, blommor) och liv på kartan (djur, väder, vagn, båt, fyrverkeri,
//                   husdjuret, bossen som städar, fiender i en buske). Inget ger eller tar guld, xp, ord eller banor, och
//                   kistan på kartan innehåller bara ett skämt. Inga andra tal är ändrade. Inte simulerat (inget att simulera).
//   v16  2026-11-16  Ordurvalet (K.pick, quiz.js): ett ord frågas högst K.pick.perBattle gånger per strid och K.pick.perDay per dag,
//                   så att ett svagt ord inte fastnar först i kön (ett barn fick 'sad' 53 gånger på en dag). Ett ord som missas två
//                   gånger i en strid lärs ut igen med ett möt-kort. Efter fel svar trycker barnet på rätt kort innan striden går vidare.
//                   Svåra ord (fler fel än rätt, minst K.pick.hardWrong fel) får bara två val. Bilder till känslor, verb och tal.
//                   Underlag: docs/research/ovningar2.md. Inte simulerat.
//   v17  2026-11-16  Butiken är en plats i varje värld (K.shop.worlds): varje världs butik säljer sitt eget materialspann med ett
//                   stegs överlapp (Ordskogen Wooden och Iron, Solöknen Iron och Steel, Svampträsket Steel och Golden, Frostbergen
//                   Golden och Emerald, Meningsvulkanen Emerald till Fire, Molnslottet Fire till Star). Varje hyllplats har chansen
//                   K.shop.up1 att bli ett fynd ett material över spannet och up2 två material över. Hyllan dras per barn, värld och
//                   dag. Varje värld säljer också bara sina föremålstyper (K.shop.types): Ordskogen dolk, klubba, svärd, mössa,
//                   luva, tunika och rund sköld; varje ny värld lägger till nya sorter (yxa, spjut, båge, hjälm, ringbrynja,
//                   drakesköld, cape och de första husdjuren i Solöknen, och så vidare upp till slagsvärd, krona, jetpack och
//                   babydraken i Molnslottet). Priser, styrka och nivåkrav är orörda. Simulering: sim/out/grind-E.txt och
//                   grind-A.txt (barnet handlar i butiken i världen det står i).
//   v18  2026-11-16  Övningarna (quiz.js, words.js). Antalet val växer med ordets nivå (K.choices): två kort på Wood, tre på Iron,
//                   fyra från Steel, för bildkort och skrivna kort. Den som inte läser får fortfarande högst två skrivna val och
//                   svåra ord (K.pick.hardWrong) fortfarande två. Förut fick alla ord fyra kort. Nya övningar (K.ex): räkna
//                   (count_pick, count_word), bild och ord (picword_sv, picword_hear), rätta Page (fix_page), hör meningen och
//                   välj scenen (scene_hunt) och trollformeln ur ljudet (spell_chant). De nya ordövningarna bokförs i ordboken
//                   under en äldre typ med samma vikt (NEW_AS i words.js), så gamla loggar och äldre klienter räknar som förut.
//                   Underlag: docs/research/ovningar2.md och förälderns önskemål 2026-11-16. Inte simulerat.
export const version = 18;

// ---------- Striden och belöningarna (formlerna står i rules.js) ----------
export const K = {
  lossXp: 0.25,                     // andel av fiendernas xp man får behålla när man förlorar (beslutat: en fjärdedel)
  // Fiendens värden räknas ur banans rekommenderade nivå (rek): tal * growth^(rek - 1) * banans lättnad * typfaktor.
  enemy: {
    hp: 60, atk: 4.4, growth: 1.10,     // liv och skada på rek 1, och tillväxten per rek-nivå (hör ihop med TUNE.heroGrowth)
    gold: 2.6, goldGrowth: 1.065,         // guld per slagen fiende (hör ihop med TUNE.priceGrowth)
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
  newPerRun: 5,        // högst så här många nya ord per omgång på en bana (ung-läge: newPerRunYoung). Resten kommer vid omspel.
  newPerRunYoung: 3,
  pick: { perBattle: 3, perDay: 12, reteachAfter: 2, hardWrong: 2, fixTap: true },   // ordurvalet i quiz.js, se ändringsloggen v16
  // Antal val per fråga efter ordets nivå (v18). byTier[nivå] (0 Wood, 1 Iron, 2 Steel, sista talet gäller uppåt) för bildkort
  // och skrivna kort. written: högsta antalet skrivna val för den som inte läser. hard: svåra ord (K.pick.hardWrong).
  // Gäller inte ja eller nej (alltid två), saknad bokstav (fyra) och meningens lucka (valen står i innehållet).
  choices: { byTier: [2, 3, 4], written: 2, hard: 2 },
  // De nya övningarna (v18, quiz.js och tasksFor i words.js). share = andel av frågorna på ett ord som passar övningen.
  //   count    räkna bilder: "How many cats?". Ord för talen min till max. Siffror och ljud, skrivna tal från readFrom (läsare).
  //   picword  bild och skrivet ord: läsare väljer svenskan, den som inte läser hör två ord och väljer. Nivåerna from till to.
  //   fix      Page säger fel ord (andelen wrong) eller rätt ord under en bild. Bara substantiv, från nivån from.
  //   hunt     hör meningen och välj scenen. share = andel av läsarnas meningsturer, noread = chans per fråga för den som
  //            inte läser (deras enda meningar). cards = antal scener. Bara meningar med scen utan rörelse (verben ritas om).
  //   chant    meningen byggs ur ljudet, utan svensk mening. share = andel av läsarnas meningsturer. Högst maxTiles brickor.
  //   Både hunt och chant kräver att meningens innehållsord är mötta.
  ex: {
    on: true,
    count: { share: 0.4, min: 2, max: 10, readFrom: 2 },
    picword: { share: 0.25, from: 1, to: 2 },
    fix: { share: 0.15, from: 1, wrong: 0.6 },
    hunt: { share: 0.3, noread: 0.2, cards: { read: 4, noread: 3 } },
    chant: { share: 0.3, maxTiles: 5 },
  },
  requeueGap: 2,       // ett missat ord kommer tillbaka tidigast efter så här många frågor (världar utan innehållsfil)
  options: 4,          // antal svarskort (världar utan innehållsfil)

  // Banbonus: så många fienders guld (på banans rek) första gången banan klaras. Inget vid omspel.
  firstBonus: 4, bossBonus: 30, replayBonus: 0,
  chestBonus: 12,      // en kista ger så många fienders guld
  // Butiken: weaponFirst = så länge hjälten inte äger något vapen finns alltid ett vapen på hyllan.
  // worlds: varje världs butik (i kartans ordning) säljer materialen lo till hi (index i MATS: 0 Wooden, 1 Iron, 2 Steel,
  // 3 Golden, 4 Emerald, 5 Ice, 6 Fire, 7 Shadow, 8 Crystal, 9 Star). up1 och up2: chansen per hyllplats för ett fynd ett
  // respektive två material över hi. Ett fynd får kräva högst `reach` nivåer över hjältens (det visar då nivån det kräver).
  shop: {
    weaponFirst: true,
    worlds: [{ lo: 0, hi: 1 }, { lo: 1, hi: 2 }, { lo: 2, hi: 3 }, { lo: 3, hi: 4 }, { lo: 4, hi: 6 }, { lo: 6, hi: 9 }],
    up1: 0.03, up2: 0.01, reach: 4,
    // types: i vilken värld (index i kartans ordning) varje föremålstyp börjar säljas. Världens butik säljer bara typer
    // med tal <= världens, så att en ny värld ger nya sorters utrustning och inte bara ny färg. Ett fynd (up1, up2) får
    // också vara en typ från nästa värld. Ägda föremål går alltid att bära, vilken typ de än är. Saknas en typ: värld 0.
    types: {
      weapon: { dagger: 0, club: 0, sword: 0, axe: 1, spear: 1, bow: 1, hammer: 2, staff: 2, orb: 4, great: 5 },
      helmet: { cap: 0, hood: 0, helm: 1, phones: 2, horned: 2, wizard: 3, great: 3, crown: 5 },
      armor: { tunic: 0, chain: 1, robe: 2, plate: 4 },
      shield: { round: 0, kite: 1, tower: 3 },
      back: { cape: 1, wings: 2, dragonwings: 4, jetpack: 5 },
      pet: { slime: 1, bat: 1, ghost: 3, drone: 4, dragon: 5 },
    },
  },
  // Avtrappning (regel a): full belöning från slagna fiender upp till `free` nivåer över banans rek, sedan
  // minus `step` per nivå, lägst `floor`. Banbonusen och xp för ord påverkas inte. type 'none' stänger av.
  falloff: { type: 'level', free: 3, step: 0.25, floor: 0.1 },

  // ---------- Lärandet ger styrka (balans3) ----------
  // Xp när ett ord når en ny högsta nivå i ordboken: share[nivå] * mult * xp-kravet för hjältens nivå.
  // Nivåerna: 0 Wood, 1 Iron, 2 Steel, 3 Gold, 4 Emerald, 5 Crystal, 6 Star, 7 Neutron Star.
  // kill: andel av fiendernas xp som finns kvar i världar som har innehållsfil (övriga världar ger full fiende-xp).
  learn: { share: [0, 0.01, 0.025, 0.035, 0.045, 0.05, 0.05, 0.05], mult: 1, kill: 0.2,
    gold: [0, 2, 4, 8, 12, 16, 20, 25] },   // guld per ordnivå, räknat i fiendeguld på hjältens nivå (Iron 2, Steel 4 ...). 0 = inget guld för ord.
  // Ordmätare. boss: bossen går att utmana när `share` av världens ord har nått nivå `tier` (2 = Steel).
  // node: mätaren längs vägen (en ny bana öppnas när share av de tidigare banornas ord är Iron). INTE BYGGD i spelet:
  // föräldern har inte bett om den och ett lås på vanliga banor kan stänga in ett barn. `on` läses bara av simulatorn.
  gate: { boss: { share: 0.5, tier: 2 }, node: { on: false, share: 0.6, tier: 1 } },
  gym: { questions: 15, daily: 5 },   // ordgymmet: frågor per pass, och dagsbonus (fiendeguld på hjältens nivå) för första passet varje dag
  knownStart: 0,       // försprånget är borttaget (v13). Var 2,5 poäng för rätt svar vid första mötet. Gamla svar i loggen har sitt försprång sparat och spelas upp som förut.
  firstOptions: 4,     // antal kort vid en riskfri första fråga. Används bara när K.meet.on är false (annars möts nya ord som kort).
  // Banans boksida och det som hör till den (game/wordpage.js, quiz.js, battle.js, startBattle i main.js). Gäller vanliga banor.
  // Bossbanor har varken sidan eller bokknappen. Trollets och sfinxens egna uppgifter, ordgymmet och minispelen berörs inte.
  page: {
    on: true,          // false: ingen sida före striden och ingen bokknapp i striden
    peek: 'helped',    // boken öppnas mitt i en fråga på ett av sidans ord: 'helped' = svaret ger ordet inga poäng den gången, 'free' = kostar inget
  },
  // "Möt ordet": första gången ett ord kommer upp är det ett kort att trycka på, inte en fråga. gap = så många frågor senare
  // kommer ordet tillbaka som en riktig fråga. on false ger tillbaka den riskfria första frågan med lär in-kort vid fel svar.
  meet: { on: true, gap: 2 },
  // Power start: alla banans nya ord hörda på sidan före striden ger första rätta svaret mult gånger skadan. Bara skadan.
  powerStart: { on: true, mult: 2 },
  wordShare: 1,        // andel av varje banas ord som används (introduce och phrases, de första i listan). 1 = alla.
  // Minispel (noderna av typen 'mini' i map/data.js och sidostoppen). Guldet räknas som fiendeguld på nodens rek, så att det
  // växer med världarna: first = så många fienders guld första gången noden spelas klart (vinst eller inte), daily = första
  // omgången per dag därefter. Fler omgångar samma dag ger inget. Jämför: en bana ger ungefär 5 till 7 fienders guld plus
  // banbonusen 4 första gången, en kista 12. youngLevel: så många storlekar mindre spelar ett barn i ung-läget (lägst 1).
  mini: { first: 5, daily: 1.5, youngLevel: -1 },
  // Bossfighter med ordstenar (bossar som har en egen mekanik, se game/boss/ och "Bossfight med ordstenar" i rules.js).
  // Förstriden före bossen är en vanlig strid och rörs inte. Tas ett id bort ur `on` blir den bossen en vanlig frågestrid igen.
  boss: {
    on: ['glomsk', 'gatfull'],   // The Forgetful Troll (Word Forest) och The Riddle Sphinx (Sun Desert)
    stones: 8,                   // ordstenar: en per löst uppgift, alla tända är seger
    phases: [1 / 3, 2 / 3],      // andel tända stenar där fas 2 och fas 3 börjar (8 stenar: efter 2 och 5, alltså 2 + 3 + 3 uppgifter)
    wrong: 1.5,                  // fel svar: bossens slag är så här många gånger bossens skada (K.tier.atk.boss gäller som förut)
    phaseHit: 1.5,               // det förvarnade slaget vid varje fasbyte, gånger bossens skada. Det kan aldrig fälla hjälten
    phaseHeal: 0.12,             // efter fasbytet får hjälten tillbaka så här stor andel av sitt maxliv
    keep: 0.5,                   // andel av de tända stenarna som står kvar till nästa försök efter en förlust (avrundas nedåt)
    clueBonus: 2,                // stenar för en ledtrådsgåta som löses på första ledtråden utan miss (sfinxen)
    // Uppgifternas storlek. full = barn som läser och inte har ung-läget, small = barn som inte läser eller har ung-läget.
    troll: { say: 3, cards: { full: 3, small: 2 }, order: { full: 3, small: 2 }, extra: { full: 1, small: 0 } },
    sphinx: { odd: { full: 4, small: 3 }, pattern: { full: 3, small: 2 }, clue: { full: 3, small: 2 }, clues: 3 },
    review: 0.3,                 // andel av uppgifterna som hämtar sitt ord ur tidigare världar (repetition)
    talkMs: 2600,                // så länge står en replik från bossen kvar (går att trycka bort)
  },
  // Minibossar (game/miniboss.js, buildRun i rules.js). ids: en fiende per värld i kartans ordning (index = världens index).
  // Med sannolikheten chance blir SISTA striden i en vanlig bana världens miniboss, om den platsen är minst typ minTier
  // (vågorna i K.waves: banor från nodindex 3 och framåt). Aldrig i en bossbana. Värdena är typens för den platsen, och sedan:
  // liv gånger hp, skada gånger atk, xp gånger xp och guld plus `gold` fienders guld på banans rek (samma avtrappning som
  // annat fiendeguld). Ta bort ett id (sätt null) så kommer den världen aldrig att ha någon miniboss.
  miniboss: {
    ids: ['morr', 'snubbel', 'grumpstump', 'gasp', 'glodhund', 'rostis'],   // Growl, Stumbles, Grumpstump, Snooze, Scorch, Sir Clank
    chance: 0.35, minTier: 2,
    hp: 1.35, atk: 1.1, xp: 1.5, gold: 3,
  },
  // Berättelsen (game/story.js). gap: så många vunna strider (banor eller bossar, omspel räknas) måste ligga mellan två
  // stunder, om stunden inte har ett eget tal i tabellen. army: när kejsarens trupper har visat sig (stunden w2-march) kan
  // en fiende i en vanlig bana bytas mot en ur armén av samma typ. chance = sannolikhet per bana, max = högst så många per bana.
  story: { gap: 3, army: { chance: 0.2, max: 1 } },
  // Andra lagret i berättelsen (v15): små händelser på kartan. Påverkar aldrig balansen, bara hur ofta något syns.
  //   ambient.first  sekunder i en världsvy innan det första lilla livet (djur, väder, vagn, båt, fyrverkeri, husdjur, buske) kommer
  //   ambient.pause  [minst, högst] sekunder mellan två sådana. Högst ett åt gången, aldrig under en stund ur berättelsen.
  //   ambient.dur    [minst, högst] sekunder som ett sådant syns
  //   chestDays      speldagar sedan första striden i en värld innan världens hittade kista dyker upp (värld 1 till 3)
  //   chestLevels    och minst så många klarade banor i världen
  //   statueDays     speldagar efter dagen då bossen slogs innan statyn av hjälten står där ("byggd över natten")
  //   bloomEvery     en blomma per så många starka ord (Steel eller bättre), i världen där barnet är. bloomMax = högst så många
  happen: { ambient: { first: 8, pause: [18, 40], dur: [7, 11] }, chestDays: 3, chestLevels: 3, statueDays: 1, bloomEvery: 10, bloomMax: 8 },
  // Ung-läge (bocken "Yngre barn" per barn på föräldraskärmen). bossStones: antal ordstenar i en bossfight.
  young: { thin: 0.5, bossShare: 0.35, learnMult: 3, bossStones: 6 },
  // Skillträdet (game/skills.js): sparks låser upp steg som ändrar hur hjälten ser ut. Antalet sparks sparas aldrig, det
  // räknas fram ur nivån, klarade världsbossar och boken, minus de steg som är upplåsta. Talen får bara ändras åt det
  // generösa hållet: blir en spark dyrare kan ett barn ha fler upplåsta steg än sparks, och då faller de senast
  // upplåsta stegen bort ur uppspelningen (foldSkills hoppar över dem) tills barnet har tjänat ikapp.
  skill: {
    levelFirst: 4, levelEvery: 3,          // första sparken på hjältenivå 4, sedan var tredje nivå (7, 10, 13 ...)
    perBoss: 1,                            // en spark första gången varje världs slutboss besegras
    bookStep: 20, bookTier: 2, bookMax: 4, // en spark per 20 ord som nått Steel (2) eller bättre i boken, högst fyra sådana
    // FÖRMÅNERNA ÄR AVSTÄNGDA (on: false). De fyra stegen på nivå 4 (Champ Belt, Rune Ring, Smoke Step, Wolf Spirit) var
    // tänkta att ge en liten förmån var. Talen nedan är förslagen ur docs/research/skilltree.md avsnitt 3, mätta med
    // påhittade omgångar FÖRE balans v4 till v8 (xp-kurvan, guldet, bossfighterna med ordstenar, Steel samma dag). De
    // måste mätas om mot den nuvarande balansen innan de slås på: se "Vad som måste mätas om" i designnoten, och lägg
    // till de två spelarna "bär alltid starkaste förmånen" och "bär aldrig någon" i simulatorn. Att sätta on: true
    // räcker inte: reglerna (rules.js, catalog.js, battle.js) läser inte förmånerna ännu, det är steg 7 i designnoten
    // och inte byggt. Så länge on är falsk visar trädet inga förmåner och perks() i skills.js ger bara nollor.
    perks: { on: false, atkPct: 3, superAdd: 0.1, dodge: 0.5, healPct: 2 },
  },
};

// ---------- Hjälten, föremålen och nivåerna (formlerna står i catalog.js) ----------
export const TUNE = {
  heroAtk: 12, heroHp: 40, heroGrowth: 1.10,   // hjältens värden utan utrustning: tal * heroGrowth^(nivå - 1)
  powerBase: 6, powerGrowth: 1.4641,           // föremålets styrka = powerBase * powerGrowth^materialnivå * typens faktor * platsens faktor (1,4641 = 1,10^4)
  hpPower: 2.4,                                // ett föremål som ger liv ger så här många gånger mer än ett som ger attack
  priceBase: 170, priceGrowth: 1.2155,         // pris = priceBase * priceGrowth^materialnivå * typens faktor * platsens faktor
  pricePet: 1.6, priceBack: 1.3,               // prisfaktor för följeslagare och ryggsaker (övriga platser använder sin styrkefaktor)
  levelPerTier: 4,                             // nivåkrav = 1 + materialnivå * levelPerTier + typens extra krav
  xpBase: 42, xpGrowth: 1.05, xpRamp: 5,       // xp till nästa nivå = xpBase * min(nivå, xpRamp) / xpRamp * xpGrowth^(nivå - 1)
};

// ---------- Banorna: rekommenderad nivå (rek) och lättnad per nod ----------
// Ordningen följer map/data.js (nod för nod). null = kista eller minispel (de räknas efter närmast föregående bana).
// Listorna får aldrig bli längre eller kortare på mitten: nodindex är det som sparas i barnens framsteg.
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
