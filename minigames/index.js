// Minispelen som finns i spelet. Varje spel är en modul med en funktion:
//   start(rootEl, { words, sentences, reading, level, world, play, sfx, log, onDone }) -> stop()
// Modulerna är kopior av prototypes/minigames/ med två små tillägg: log(item, correct, chosen) anropas för varje
// svar (skalet sparar dem under spelets eget övningsnamn, ex), och Mend the Path har en tredje storlek.
// Vilket spel som ligger var på kartan står i map/data.js. Guldet står i balance.js (K.mini).
//
//   pool(level) = vilka ord spelet behöver: n = hur många ord skalet skickar in (lite fler än spelet använder,
//                 så att omgångarna inte blir likadana), least = minsta antal för att spelet ska fungera.
//                 Alla spel med ord använder bara ord som har bild. null = spelet använder inga ord.
//   nonReader   = spelet som öppnas i stället för barn som inte läser.
//   levels      = antal storlekar (1 = liten).
export const MINI = {
  pairs: { name: 'Spark Pairs', desc: 'Find the pairs.', ex: 'mg_pairs', levels: 2, pool: (lv) => ({ n: lv > 1 ? 9 : 6, least: lv > 1 ? 6 : 4 }), load: () => import('./pairs.js') },
  lanterns: { name: 'Light the Lanterns', desc: 'Spell the hidden word.', ex: 'mg_lanterns', levels: 2, nonReader: 'foggy', pool: (lv) => ({ n: 5, least: 3, spell: true, minLen: lv > 1 ? 4 : 3, maxLen: lv > 1 ? 7 : 5 }), load: () => import('./lanterns.js') },
  foggy: { name: 'Foggy Window', desc: 'Wipe the fog. What is it?', ex: 'mg_foggy', levels: 2, pool: () => ({ n: 8, least: 5 }), load: () => import('./foggy.js') },
  path: { name: 'Mend the Path', desc: 'Turn the tiles. Join the path.', ex: 'mg_path', levels: 3, pool: null, load: () => import('./path.js') },
  echo: { name: "Owl's Echo", desc: 'Listen. Tap the same order.', ex: 'mg_echo', levels: 2, pool: (lv) => ({ n: lv > 1 ? 9 : 6, least: lv > 1 ? 6 : 4 }), load: () => import('./echo.js') },
  bingo: { name: 'Word Bingo', desc: 'Hear a word. Find it.', ex: 'mg_bingo', levels: 1, pool: () => ({ n: 16, least: 12 }), load: () => import('./bingo.js') },
};
// Spelet som faktiskt öppnas för ett barn: den som inte läser får spelets läge utan läsning.
export const miniFor = (id, reading) => { const g = MINI[id]; return g && g.nonReader && !reading ? g.nonReader : id; };
