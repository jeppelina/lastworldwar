// Bilder till orden: game/img/<nyckel>.png (Fluent Emoji 3D, MIT-licens, se img/LICENSE-fluentui-emoji.txt).
// Saknas en bild används emojin som reserv.
import { hasArt, artHTML, warmArt, artStill } from './wordart.js';
const HAVE = new Set(['apple', 'arm', 'bag', 'ball', 'banana', 'bat', 'battle', 'bear', 'bed', 'bee', 'bird', 'boat', 'book', 'box', 'bread', 'breakfast', 'brush_my_teeth', 'cactus', 'cake', 'camel', 'car', 'carrot', 'cat', 'chair', 'cheese', 'clap', 'clean_my_room', 'climb', 'clock', 'coin', 'cold', 'cook', 'cookie', 'cow', 'cry', 'cup', 'dance', 'do_homework', 'dog', 'door', 'dragon', 'draw', 'duck', 'ear', 'eat', 'egg', 'eight', 'enemy', 'eye', 'fast', 'fire', 'fish', 'five', 'flower', 'foot', 'forest', 'four', 'fox', 'frog', 'give', 'go_skiing', 'go_to_bed', 'hand', 'happy', 'hat', 'horse', 'hot', 'house', 'hug', 'ice_cream', 'juice', 'jump', 'key', 'knife', 'laugh', 'leaf', 'leg', 'lion', 'listen_to_music', 'look', 'map', 'milk', 'money', 'moon', 'mouse', 'mouth', 'mushroom', 'music', 'nest', 'nine', 'nose', 'one', 'orange', 'owl', 'pants', 'paper', 'pencil', 'pig', 'pizza', 'plate', 'play_football', 'play_video_games', 'porridge', 'rain', 'read_a_book', 'ride_a_bike', 'run', 'sad', 'school', 'seven', 'shield', 'shirt', 'shoe', 'sing', 'six', 'sleep', 'slow', 'smile', 'snake', 'sock', 'spoon', 'stand', 'star', 'stop', 'sun', 'swim', 'sword', 'take_a_shower', 'ten', 'tent', 'think', 'three', 'tomato', 'tooth', 'tree', 'troll', 'two', 'wait', 'walk', 'walk_the_dog', 'wash_my_hands', 'watch_tv', 'water', 'wave', 'window', 'witch', 'write']);
// Ord som har en bild ritad i kod (wordart.js) visar den i stället för bildfilen, rörlig där rörelsen bär betydelsen.
// Ritas den inte (ingen canvas, eller ordet är avstängt i OFF i wordart.js) används bildfilen och sist emojin.
// localStorage 'wordart' = 'off' visar bara de gamla bildfilerna (för att jämföra).
const ARTON = (() => { try { return localStorage.getItem('wordart') !== 'off'; } catch (e) { return true; } })();
export const artPic = (key, cls = 'pimg') => (ARTON && hasArt(key) ? artHTML(key, cls) : '');
export const picHTML = (key, emoji = '') => artPic(key) || (HAVE.has(key) ? `<img class="pimg" src="img/${key}.png" alt="" draggable="false">` : emoji);
// Alla bilder hämtas och avkodas i förväg vid start, så att korten aldrig visas tomma medan en bild laddas.
export function preloadPics() { if (ARTON) warmArt(); for (const k of HAVE) { const im = new Image(); im.src = `img/${k}.png`; if (im.decode) im.decode().catch(() => {}); (preloadPics.keep || (preloadPics.keep = [])).push(im); } }
export const pic = (item) => picHTML(item.id || item.en, item.pic);
// Stillbild (första rutan) som data-url för ord med en ritad bild, annars null. Minispelen använder den.
export const artStillURL = (key) => (ARTON && hasArt(key) ? artStill(key) : null);
