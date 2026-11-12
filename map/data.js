// Världsdata för världskartan. Allt innehåll (världar, banor, starttillstånd) ligger här.
// En ny värld är en ny post i `worlds`. Ingen ritkod behöver ändras. Se README.md.
//
// Nodformat: [typ, namn, vad som tränas, guld]
//   typ: 'level' (vanlig bana), 'chest' (kista), 'mini' (minispel), 'boss' (sist i världen)
//   En minispelsnod har ett femte fält: { game, level }. game är spelets id i game/minigames/index.js (en lista med två
//   id betyder att barnet väljer), level är storleken (1 liten, 2 större, 3 störst). Tredje fältet är spelets namn.
//   Minispelsnoden i stigen ligger på butikens gamla plats (butiken finns i menyraden). Den spärrar aldrig: barnet går förbi.
//
// VIKTIGT: lägg aldrig till, ta bort eller flytta en nod i `nodes`. Platsen i listan (nodindex) är det som sparas i barnens
// framsteg, och samma index pekar ut banans nivå i game/balance.js och banans ord i game/content/world<N>.json.
// En ny nod mitt i listan skulle flytta alla klarade banor ett steg. Något nytt vid sidan av stigen läggs i `side`:
//   side: [{ id, after, node }]   ett sidostopp intill stigen mellan nod `after` och nästa. Det tar ingen plats i `nodes`,
//   öppnas när nod `after` är klarad och har sitt eget id ('s1'), som aldrig får ändras eller återanvändas.
//   game/balance.test.mjs kontrollerar att ordningen i `nodes` är densamma som när spelet publicerades.
//   guld: visas bara när kartan öppnas för sig (demo). I spelet räknas banbonus och kistor ur game/balance.js
//   (rekommenderad nivå per bana står där, i samma ordning som noderna här), och spelets skal skickar talen till kartan.
// Nodernas positioner räknas ut automatiskt längs en slingrande stig, i den ordning de står.
window.GAME_DATA = {
  continent: { name: 'Wordland', subtitle: 'English: from words to sentences' },

  // Kommande kontinenter (andra ämnen). Visas som dimhöljda öar i kanten av översikten.
  coming: [
    { name: 'Math Mountains' },
    { name: 'Reading Land' }
  ],

  worlds: [
    {
      id: 'ordskogen', name: 'Word Forest', biome: 'forest',
      stage: 'Words', theme: 'Animals and nature',
      nodes: [
        ['level', 'The Glade', 'cat, dog, bird', 10],
        ['level', 'The Brook', 'fish, frog, duck', 10],
        ['level', 'The Big Oak', 'tree, leaf, flower', 12],
        ['chest', 'Mossy Chest', 'A chest full of gold', 40],
        ['level', 'The Farm', 'cow, horse, pig', 12],
        ['level', 'The Fox Den', 'fox, bear, wolf', 14],
        ['mini', 'Spark Hollow', 'Spark Pairs', 0, { game: 'pairs', level: 1 }],
        ['level', 'The Bird Nest', 'egg, nest, wing', 14],
        ['level', 'The Dark Path', 'Mixed animal words', 16],
        ['level', 'The Owl Tree', 'owl, bat, moon', 16],
        ['boss', 'The Forgetful Troll', 'All words from Word Forest', 100]
      ],
      side: [{ id: 's1', after: 8, node: ['mini', 'The Broken Trail', 'Mend the Path', 0, { game: 'path', level: 1 }] }]
    },
    {
      id: 'soloknen', name: 'Sun Desert', biome: 'desert',
      stage: 'Words', theme: 'Food and things',
      nodes: [
        ['level', 'The Oasis', 'milk, juice, bread', 12],
        ['level', 'The Caravan', 'cheese, cake, carrot', 12],
        ['level', 'The Sand Dune', 'hat, shoe, sock', 14],
        ['chest', 'Buried Chest', 'A chest full of gold', 50],
        ['level', 'The Market', 'pizza, cookie, ice cream', 14],
        ['level', 'The Tent Camp', 'bed, chair, tent', 16],
        ['mini', 'The Echo Well', "Owl's Echo", 0, { game: 'echo', level: 1 }],
        ['level', 'The Cactus Field', 'plate, spoon, knife', 16],
        ['level', 'The Ruin', 'door, window, box', 18],
        ['level', 'The Sun Gate', 'boat, car, lion', 18],
        ['boss', 'The Riddle Sphinx', 'All words from Sun Desert', 120]
      ],
      side: [{ id: 's1', after: 8, node: ['mini', 'Lantern Camp', 'Light the Lanterns', 0, { game: 'lanterns', level: 1 }] }]
    },
    {
      id: 'svamptrasket', name: 'Mushroom Swamp', biome: 'swamp',
      stage: 'Words', theme: 'Doing words',
      nodes: [
        ['level', 'The Dock', 'walk, stop, hand', 14],
        ['level', 'The Lily Pond', 'wave, clap, look', 14],
        ['level', 'The Misty Glade', 'sit, stand, smile', 16],
        ['level', 'The Mushroom Ring', 'read, write, draw', 16],
        ['chest', 'Sunken Chest', 'A chest full of gold', 60],
        ['level', 'The Frog Stone', 'sing, dance, climb', 18],
        ['level', 'The Witch Hut', 'cook, give, help', 18],
        ['mini', 'The Bingo Stump', 'Word Bingo', 0, { game: 'bingo', level: 1 }],
        ['level', 'Firefly Meadow', 'think, say, he, she', 20],
        ['level', 'The Root Cave', 'you, they, not, now', 20],
        ['boss', 'The Mumbling Witch', 'All words from Mushroom Swamp', 140]
      ],
      side: [{ id: 's1', after: 8, node: ['mini', 'The Sunken Boardwalk', 'Mend the Path', 0, { game: 'path', level: 2 }] }]
    },
    {
      id: 'frostbergen', name: 'Frost Mountains', biome: 'ice',
      stage: 'Words', theme: 'Colours, numbers and how things are',
      nodes: [
        ['level', 'The Snow Field', 'red, blue, green', 16],
        ['level', 'The Ice Bridge', 'yellow, black, white', 16],
        ['level', 'Igloo Village', 'one, two, three', 18],
        ['chest', 'Frozen Chest', 'A chest full of gold', 70],
        ['level', 'The Cave', 'four, five, six', 18],
        ['level', 'The Icicles', 'big, small, cold', 20],
        ['level', 'Northern Lights', 'happy, sad, fast', 20],
        ['mini', 'The Ice Mirrors', 'Spark Pairs', 0, { game: 'pairs', level: 2 }],
        ['level', 'The Glacier', 'seven, eight, nine, ten', 22],
        ['level', 'The Peak', 'Mixed words', 22],
        ['boss', 'The Shivering Giant', 'All words from Frost Mountains', 160]
      ],
      side: [{ id: 's1', after: 8, node: ['mini', 'Echo Peak', "Owl's Echo", 0, { game: 'echo', level: 2 }] }]
    },
    {
      id: 'meningsvulkanen', name: 'Sentence Volcano', biome: 'volcano',
      stage: 'Sentences', theme: 'Put words together',
      nodes: [
        ['level', 'The Ash Field', 'a red apple', 20],
        ['level', 'The Lava Bridge', 'the big dog', 20],
        ['level', 'The Hot Spring', 'I see a cat', 22],
        ['level', 'The Quarry', 'I like milk', 22],
        ['chest', 'Glowing Chest', 'A chest full of gold', 90],
        ['level', 'The Forge', 'The dog can run', 24],
        ['level', 'Crater Lake', 'She has a hat', 24],
        ['mini', 'The Ember Lamps', 'Light the Lanterns', 0, { game: 'lanterns', level: 2 }],
        ['level', 'The Smoke Tower', 'The bird is blue', 26],
        ['level', 'Dragon Path', 'Build your own sentences', 26],
        ['level', 'The Crater Rim', 'Mixed sentences', 28],
        ['boss', 'The Word Dragon', 'All sentences from the volcano', 200]
      ],
      side: [{ id: 's1', after: 9, node: ['mini', 'The Lava Hall', 'Word Bingo', 0, { game: 'bingo', level: 1 }] }]
    },
    {
      id: 'molnslottet', name: 'Cloud Castle', biome: 'sky',
      stage: 'Sentences', theme: 'Sentences and questions',
      nodes: [
        ['level', 'Rainbow Bridge', 'Where is the key?', 24],
        ['level', 'Cloud Stairs', 'What is this?', 24],
        ['level', 'Star Garden', 'Can you see the moon?', 26],
        ['level', 'Wind Tower', 'I am happy today', 26],
        ['chest', 'Golden Chest', 'A chest full of gold', 120],
        ['level', 'The Library', 'The cat is under the table', 28],
        ['level', 'The Throne Room', 'Do you like cake?', 28],
        ['mini', 'The Sky Bridge', 'Mend the Path', 0, { game: 'path', level: 3 }],
        ['level', 'The Clock Tower', 'Answer questions', 30],
        ['level', 'The King\'s Gate', 'Tell a story in three sentences', 30],
        ['boss', 'The Babbling Cloud King', 'Everything you have learned', 300]
      ],
      side: [{ id: 's1', after: 8, node: ['mini', 'The Play Room', "Spark Pairs or Owl's Echo", 0, { game: ['pairs', 'echo'], level: 2 }] }]
    }
  ],

  // Starttillstånd för demon: hur många noder som redan är klarade per värld ('all' = hela).
  start: {
    gold: 340,
    cleared: { ordskogen: 'all', soloknen: 4 }
  }
};
