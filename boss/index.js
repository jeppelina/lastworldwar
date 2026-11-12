// Bossar med egen mekanik. Nyckeln är bossens id i ROSTER (enemies.js). Vilka som är påslagna står i balance.js
// (K.boss.on): en boss som saknas där, eller här, går som en vanlig frågestrid.
// data: bossens innehållsfil under content/ (hämtas av main.js vid start), om den har någon.
import { BossFight } from './fight.js';
import { TROLL } from './troll.js';
import { SPHINX } from './sphinx.js';

export const BOSSES = {
  glomsk: { spec: TROLL, data: null },
  gatfull: { spec: SPHINX, data: 'content/riddles2.json' },
};
export const bossFiles = () => [...new Set(Object.values(BOSSES).map((b) => b.data).filter(Boolean))];
// bt: striden. def: bossens post i ROSTER. o: { kept, young, data: { fil: innehåll }, svShow, tempo }. null om bossen saknar mekanik.
export function makeBoss(bt, def, o = {}) {
  const b = BOSSES[def.id]; if (!b) return null;
  return new BossFight(bt, b.spec, { ...o, data: b.data ? (o.data || {})[b.data] || null : null });
}
