// Bilder till orden: game/img/<nyckel>.png (Fluent Emoji 3D, MIT-licens, se img/LICENSE-fluentui-emoji.txt).
// Saknas en bild används emojin som reserv.
const HAVE = new Set(['apple', 'bag', 'banana', 'bat', 'bear', 'bed', 'bee', 'bird', 'boat', 'bread', 'cake', 'car', 'cat', 'chair', 'cheese', 'cow', 'dog', 'door', 'dragon', 'duck', 'egg', 'fire', 'fish', 'flower', 'forest', 'fox', 'frog', 'hat', 'horse', 'house', 'key', 'leaf', 'lion', 'milk', 'moon', 'mouse', 'nest', 'owl', 'pig', 'rain', 'shield', 'shoe', 'snake', 'star', 'sun', 'sword', 'tree', 'troll', 'water']);
export const picHTML = (key, emoji = '') => (HAVE.has(key) ? `<img class="pimg" src="img/${key}.png" alt="" draggable="false">` : emoji);
// Alla bilder hämtas och avkodas i förväg vid start, så att korten aldrig visas tomma medan en bild laddas.
export function preloadPics() { for (const k of HAVE) { const im = new Image(); im.src = `img/${k}.png`; if (im.decode) im.decode().catch(() => {}); (preloadPics.keep || (preloadPics.keep = [])).push(im); } }
export const pic = (item) => picHTML(item.id || item.en, item.pic);
