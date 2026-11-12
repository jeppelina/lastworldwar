// Bilder till orden: game/img/<nyckel>.png (Fluent Emoji 3D, MIT-licens, se img/LICENSE-fluentui-emoji.txt).
// Saknas en bild används emojin som reserv.
const HAVE = new Set(['apple', 'bag', 'ball', 'banana', 'bat', 'bear', 'bed', 'bee', 'bird', 'boat', 'book', 'box', 'bread', 'cactus', 'cake', 'camel', 'car', 'carrot', 'cat', 'chair', 'cheese', 'clock', 'coin', 'cold', 'cookie', 'cow', 'cup', 'dog', 'door', 'dragon', 'duck', 'egg', 'fire', 'fish', 'flower', 'forest', 'fox', 'frog', 'hat', 'horse', 'hot', 'house', 'ice_cream', 'juice', 'key', 'knife', 'leaf', 'lion', 'milk', 'money', 'moon', 'mouse', 'nest', 'orange', 'owl', 'pig', 'pizza', 'plate', 'rain', 'shield', 'shirt', 'shoe', 'snake', 'sock', 'spoon', 'star', 'sun', 'sword', 'tent', 'tomato', 'tree', 'troll', 'water', 'window']);
export const picHTML = (key, emoji = '') => (HAVE.has(key) ? `<img class="pimg" src="img/${key}.png" alt="" draggable="false">` : emoji);
// Alla bilder hämtas och avkodas i förväg vid start, så att korten aldrig visas tomma medan en bild laddas.
export function preloadPics() { for (const k of HAVE) { const im = new Image(); im.src = `img/${k}.png`; if (im.decode) im.decode().catch(() => {}); (preloadPics.keep || (preloadPics.keep = [])).push(im); } }
export const pic = (item) => picHTML(item.id || item.en, item.pic);
