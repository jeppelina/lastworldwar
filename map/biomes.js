// Biomer: palett, terrängparametrar och dekor per biom.
// En biom är ren konfiguration plus en liten funktion som bygger dess sprites med PX-generatorerna.
// Fält:
//   liq [djup, mellan, grunt], foam, glint, under (skuggkant under landets sydkust)
//   shore [2], ground [4 mörk till ljus], high [4, platåer], cliff [ljus, mörk]
//   path [fyllning, sten], pathEdge, speck (småprickar i marken), wet (andel sjöar), mtn (antal berg)
//   particle: 'leaf' | 'sand' | 'firefly' | 'snow' | 'ember' | 'sparkle'
//   deco: [{ s: spritenamn, p: sannolikhet per ruta, cl: 1 = i klungor, -1 = i öppen mark,
//            on: 'liq' = i vätskan, shore: true = bara nära strand }]
//   sprites(mini): returnerar { namn: [sprite, ...], mountain: [...], landmark: sprite }
(function () {
  'use strict';
  const PX = window.PX, O = '#1b1630';
  const many = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const A = (rows, pal, o) => PX.spr(PX.ascii(rows, pal, true).outline(o || O));

  const deadTree = (T, D) => A(['.T..T...T.', 'T.T.T..T..', '.TT.TT.T..', '..TTTTT...', '...TTD....', '...TTD....', '...TTD....', '..TTTDD...'], { T, D });
  const cactus = (L, D) => A(['...LD....', '...LD..L.', 'L..LD..LD', 'LD.LD.LLD', 'LLLLDDDD.', '.LLLD....', '...LD....', '...LD....', '...LD....'], { L, D });
  const cactusMini = (L, D) => A(['..L..', 'L.LD.', 'LLLDD', '..LD.', '..LD.'], { L, D });

  window.BIOMES = {
    forest: {
      liq: ['#1f4e96', '#2c6fc0', '#4d9ae6'], foam: '#d8f1ff', glint: '#8cc8f7', under: '#173a6e',
      shore: ['#e6d490', '#d2bb72'], ground: ['#2e7d3a', '#3f9644', '#57ad4b', '#7cc65a'],
      high: ['#4c9a3c', '#66b048', '#86c656', '#a8d96a'], cliff: ['#a67c4a', '#6e4c2a'],
      path: ['#e8cc8e', '#cfae6e'], pathEdge: '#7c5a2e',
      speck: ['#ffe36a', '#ff9ac0', '#ffffff'], speckRate: 0.006, wet: 0.31, mtn: 1, particle: 'leaf',
      deco: [{ s: 'tree', p: 0.5, cl: 1 }, { s: 'pine', p: 0.3, cl: 1 }, { s: 'bush', p: 0.06 }, { s: 'rock', p: 0.02 }, { s: 'tree', p: 0.05 }],
      sprites(mini) {
        const leaf = { leaf: ['#1c5a30', '#2f7d38', '#48a044', '#84d05c'], trunk: '#7a4e28', trunkD: '#553418', o: O };
        const leaf2 = { leaf: ['#2a6a2a', '#44902e', '#6cb23a', '#a6dc5a'], trunk: '#7a4e28', trunkD: '#553418', o: O };
        const pn = { l: '#3c9a5c', m: '#2b7a4e', d: '#1c5a40', dd: '#123c30', trunk: '#553418', o: O };
        const mt = { l: '#b4b0a8', m: '#8e8a86', d: '#5e5a64', o: O, sl: '#ffffff', sd: '#c4d4ec' };
        return {
          tree: mini ? [PX.treeRound(leaf, 3), PX.treeRound(leaf2, 3), PX.treeRound(leaf, 2)] : [PX.treeRound(leaf, 6), PX.treeRound(leaf2, 5), PX.treeRound(leaf, 5), PX.treeRound(leaf2, 7)],
          pine: mini ? [PX.pine(pn, 8), PX.pine(pn, 7)] : [PX.pine(pn, 15), PX.pine(pn, 12), PX.pine(pn, 18)],
          bush: [PX.bush(leaf.leaf, O, mini ? 1.6 : 2.6)], rock: [PX.rock(['#6a6670', '#928e96', '#bcb8bc'], O, mini ? 2 : 3)],
          mountain: mini ? many(2, (i) => PX.mountain(mt, 16, 11, 3, 10 + i, 2)) : many(3, (i) => PX.mountain(mt, 38 + i * 6, 26 + i * 3, 7, 20 + i, 2 + (i % 2))),
          landmark: PX.treeRound({ leaf: ['#1c5a30', '#2f7d38', '#4eaa46', '#9ae066'], trunk: '#7a4e28', trunkD: '#553418', o: O }, 11)
        };
      }
    },

    desert: {
      liq: ['#12788c', '#1fa1a6', '#5ed3c2'], foam: '#e9fff6', glint: '#a4efe0', under: '#0d5566',
      shore: ['#fbeeb4', '#f0dc98'], ground: ['#d59a48', '#e4b45c', '#f0cc78', '#f8e09a'],
      high: ['#c8743c', '#dc8c48', '#eaa65c', '#f4c078'], cliff: ['#b4623a', '#7a3e24'],
      path: ['#b87646', '#9c5e34'], pathEdge: '#6a3c20', ripple: 1,
      speck: ['#b07a3a', '#fff6c8'], speckRate: 0.008, wet: 0.24, mtn: 0.8, particle: 'sand',
      deco: [{ s: 'palm', p: 0.45, shore: true }, { s: 'dune', p: 0.1, cl: -1 }, { s: 'cactus', p: 0.035 }, { s: 'rock', p: 0.035 }, { s: 'bones', p: 0.012 }, { s: 'cactus', p: 0.12, cl: 1 }, { s: 'dune', p: 0.04 }],
      sprites(mini) {
        const mt = { l: '#f0a45c', m: '#d88446', d: '#a05430', o: '#4a2418', sl: '#ffd89a', sd: '#d88446' };
        const palm = A(['..LLL.LLL..', '.LLDDLLDDD.', 'LLD.LTL.DDD', 'LD..LT...DD', 'L...TD....D', '....TD.....', '...TD......', '...TD......', '..TTD......'], { L: '#58b848', D: '#2c7a34', T: '#b4844a' });
        const palmMini = A(['.LL.LL.', 'LDLTLDD', 'L..T..D', '..TD...', '..TD...'], { L: '#58b848', D: '#2c7a34', T: '#b4844a', });
        return {
          palm: [mini ? palmMini : palm],
          cactus: mini ? [cactusMini('#5cb04a', '#2e7a3a')] : [cactus('#5cb04a', '#2e7a3a'), cactusMini('#5cb04a', '#2e7a3a')],
          rock: [PX.rock(['#a8683c', '#d08c50', '#f0b874'], '#4a2418', mini ? 2 : 3), PX.rock(['#a8683c', '#d08c50', '#f0b874'], '#4a2418', mini ? 2 : 4)],
          dune: [PX.spr(PX.ascii(['..lllll..', '.l.....d.', 'l.......d'], { l: '#fff2bc', d: '#c88c46' }), { sh: 0 }), PX.spr(PX.ascii(['.llll.', 'l....d'], { l: '#fff2bc', d: '#c88c46' }), { sh: 0 })],
          bones: [A(['w.w.w.', 'wwwwww', '.w.w.w'], { w: '#fff6e0' }, '#7a5a3a')],
          mountain: mini ? many(2, (i) => PX.mountain(mt, 16, 9, 0, 30 + i, 2)) : many(3, (i) => PX.mountain(mt, 40 + i * 5, 22 + i * 2, 0, 40 + i, 3)),
          landmark: PX.pyramid({ l: '#fbe08a', m: '#e8c060', d: '#c08a40', dd: '#a06e30', o: '#4a2418' }, 12)
        };
      }
    },

    swamp: {
      liq: ['#243a40', '#335854', '#4c7a62'], foam: '#8fb07c', glint: '#7aa272', under: '#16262a',
      shore: ['#6e6642', '#5a5434'], ground: ['#32462e', '#425a34', '#56703c', '#72864a'],
      high: ['#56683a', '#6a7e44', '#829450', '#9caa60'], cliff: ['#6a5644', '#3c2e26'],
      path: ['#c0a272', '#a48858'], pathEdge: '#4a3a24',
      speck: ['#c77dff', '#ff8ad8', '#b8ff7a'], speckRate: 0.006, wet: 0.4, mtn: 0.3, particle: 'firefly',
      deco: [{ s: 'lily', p: 0.14, on: 'liq' }, { s: 'reeds', p: 0.5, shore: true }, { s: 'shroom', p: 0.2, cl: -1 }, { s: 'tree', p: 0.36, cl: 1 }, { s: 'dead', p: 0.1 }, { s: 'shroom', p: 0.05 }],
      sprites(mini) {
        const leaf = { leaf: ['#1e3a2c', '#2e5434', '#44703c', '#688e48'], trunk: '#5a4630', trunkD: '#382a1e', o: O };
        const capP = { cap: ['#6a2a9a', '#9440c8', '#b860e8', '#dc98ff'], spot: '#f8e8ff', gill: '#4a1c70', stem: '#efe6d0', stemD: '#b8ac98', o: O };
        const capR = { cap: ['#9a2440', '#d03858', '#f0607a', '#ffa0b0'], spot: '#fff0f0', gill: '#6a1428', stem: '#efe6d0', stemD: '#b8ac98', o: O };
        const capT = { cap: ['#1c7a7a', '#2aa6a0', '#50d0c0', '#a0f4e0'], spot: '#f0fff8', gill: '#0e4a50', stem: '#efe6d0', stemD: '#b8ac98', o: O };
        const mt = { l: '#7a7a6a', m: '#5e5e56', d: '#3c3c40', o: O, sl: '#9aa884', sd: '#6a7860' };
        return {
          tree: mini ? [PX.treeRound(leaf, 3), PX.treeRound(leaf, 2)] : [PX.treeRound(leaf, 6), PX.treeRound(leaf, 5), PX.treeRound(leaf, 7)],
          shroom: mini ? [PX.mushroom(capP, 2), PX.mushroom(capR, 2), PX.mushroom(capT, 3)] : [PX.mushroom(capP, 4), PX.mushroom(capR, 3), PX.mushroom(capT, 5), PX.mushroom(capP, 6), PX.mushroom(capR, 5)],
          dead: [mini ? A(['T.T.T', '.TTT.', '..T..', '..T..'], { T: '#6e5a48' }) : deadTree('#7e6a54', '#4e3e30')],
          reeds: [PX.spr(PX.ascii(['.b...b', '.b.b.b', '.g.b.g', '.g.g.g', 'gg.g.g'], { b: '#6a4a2a', g: '#7a9a4a' }), { sh: 0 })],
          lily: [PX.spr(PX.ascii(['.gGg', 'gGGp', '.gg.'], { g: '#4a8a3a', G: '#6eb04a', p: '#ff9ad0' }), { sh: 0 }), PX.spr(PX.ascii(['gGg', 'gg.'], { g: '#4a8a3a', G: '#6eb04a' }), { sh: 0 })],
          mountain: mini ? [PX.mountain(mt, 14, 8, 0, 51, 2)] : [PX.mountain(mt, 34, 18, 0, 52, 3)],
          landmark: PX.mushroom(capP, 11)
        };
      }
    },

    ice: {
      liq: ['#1e4484', '#2f68b4', '#5d9adc'], foam: '#ffffff', glint: '#a8d4f8', under: '#16326a',
      shore: ['#c4def2', '#aecce8'], ground: ['#b4d0ea', '#cde2f4', '#e4f0fa', '#f8fcff'],
      high: ['#d0e2f4', '#e4effa', '#f2f8fe', '#ffffff'], cliff: ['#8fb4dc', '#5a80b4'],
      path: ['#b89a7a', '#9c8062'], pathEdge: '#5e4a3a',
      speck: ['#ffffff', '#9fd8ff'], speckRate: 0.01, wet: 0.34, mtn: 1.6, particle: 'snow',
      deco: [{ s: 'floe', p: 0.12, on: 'liq' }, { s: 'pine', p: 0.5, cl: 1 }, { s: 'spike', p: 0.1, cl: -1 }, { s: 'rock', p: 0.03 }, { s: 'pine', p: 0.05 }, { s: 'igloo', p: 0.012 }],
      sprites(mini) {
        const pn = { l: '#3c8a7a', m: '#2b6a66', d: '#1c4a54', dd: '#123444', trunk: '#553418', o: O, snowL: '#ffffff', snowD: '#c4d8f0' };
        const ic = { l: '#b8ecff', hi: '#ffffff', d: '#5aa0e0', o: '#1c3a78' };
        const mt = { l: '#a8bcd8', m: '#8098bc', d: '#566c98', o: '#1c2a54', sl: '#ffffff', sd: '#b8d0f0' };
        const floe = (w) => { const p = new PX.Pix(w + 2, 5); p.disc(w / 2 + 1, 2, w / 2, 1.6, ['#c4dcf4', '#ffffff', '#ffffff'], 0); for (let x = 0; x < w + 2; x++) if (p.get(x, 3) && !p.get(x, 4)) p.set(x, 4, '#7aa8dc'); return PX.spr(p, { sh: 0 }); };
        return {
          pine: mini ? [PX.pine(pn, 8, true), PX.pine(pn, 7, true)] : [PX.pine(pn, 15, true), PX.pine(pn, 12, true), PX.pine(pn, 18, true)],
          spike: mini ? [PX.iceSpike(ic, 4, 7, 3)] : [PX.iceSpike(ic, 7, 13, 1), PX.iceSpike(ic, 5, 9, 2), PX.iceSpike(ic, 9, 17, 4)],
          rock: [PX.rock(['#7a98c4', '#a8c4e4', '#e4f0fc'], '#1c3a78', mini ? 2 : 3)],
          floe: [floe(mini ? 4 : 8), floe(mini ? 3 : 5)],
          igloo: [A(['..wwww..', '.wwwwWW.', 'wwwkkWWW', 'wwwkkWWW'], { w: '#ffffff', W: '#c4d8f0', k: '#2a3a6a' }, '#1c3a78')],
          mountain: mini ? many(2, (i) => PX.mountain(mt, 17, 12, 6, 60 + i, 2)) : many(3, (i) => PX.mountain(mt, 40 + i * 6, 28 + i * 4, 13 + i, 70 + i, 2 + (i % 2))),
          landmark: PX.mountain(mt, 34, 26, 13, 77, 3)
        };
      }
    },

    volcano: {
      liq: ['#9a1f0c', '#d8480f', '#ff8c1e'], foam: '#ffe066', glint: '#ffc23a', under: '#5a0f08',
      shore: ['#40282a', '#301e24'], ground: ['#2c2329', '#3a2f35', '#4b3d40', '#5f4e4c'],
      high: ['#44363e', '#56464c', '#6a585a', '#806c66'], cliff: ['#32242a', '#170f14'],
      path: ['#b0a29a', '#94867e'], pathEdge: '#1c1418',
      speck: ['#ff7a1e', '#ffd04a'], speckRate: 0.005, wet: 0.38, mtn: 1.2, particle: 'ember',
      deco: [{ s: 'cone', p: 0.03 }, { s: 'dead', p: 0.09, cl: 1 }, { s: 'rock', p: 0.1, cl: -1 }, { s: 'crack', p: 0.05 }, { s: 'rock', p: 0.04 }],
      sprites(mini) {
        const mt = { l: '#7c6a68', m: '#5c4c50', d: '#30262e', o: '#0e0a10', sl: '#7c6a68', sd: '#30262e' };
        return {
          cone: mini ? [PX.volcano(mt, 11, 7, 80)] : [PX.volcano(mt, 19, 12, 81), PX.volcano(mt, 15, 9, 82)],
          dead: [mini ? A(['T.T.T', '.TTT.', '..T..', '..T..'], { T: '#1c1418' }, '#5a4648') : deadTree('#241a1e', '#120c10')],
          rock: [PX.rock(['#1e161c', '#3a2e36', '#6a5a5c'], '#0e0a10', mini ? 2 : 3), PX.iceSpike({ l: '#6a5a5c', hi: '#8c7a76', d: '#2a2028', o: '#0e0a10' }, mini ? 3 : 5, mini ? 5 : 9, 9)],
          crack: [PX.spr(PX.ascii(['y....', '.oy..', '..oyo', '....y'], { y: '#ffb02a', o: '#ff6a14' }), { sh: 0 })],
          mountain: mini ? many(2, (i) => PX.mountain(mt, 16, 11, 0, 90 + i, 2)) : [PX.volcano(mt, 44, 26, 91), PX.mountain(mt, 42, 26, 0, 92, 3), PX.volcano(mt, 34, 20, 93)],
          landmark: PX.volcano(mt, 36, 22, 99)
        };
      }
    },

    sky: {
      floating: true,
      liq: ['#4a6cd0', '#6a94ec', '#9cc0fa'], foam: '#ffffff', glint: '#c4dcff', under: '#a890d0',
      shore: ['#ffffff', '#f6ecff'], ground: ['#f0b0c8', '#f6c8d4', '#fbdde0', '#fff0ea'],
      high: ['#ffd486', '#ffe2a2', '#ffeec2', '#fffae0'], cliff: ['#e4a8cc', '#b07cb4'],
      path: ['#ffe27a', '#f0c040'], pathEdge: '#a8742a',
      speck: ['#ffffff', '#ffe27a'], speckRate: 0.012, wet: 0.4, mtn: 0, particle: 'sparkle',
      deco: [{ s: 'puff', p: 0.07, on: 'liq' }, { s: 'tree', p: 0.4, cl: 1 }, { s: 'spire', p: 0.05, cl: -1 }, { s: 'crystal', p: 0.08, cl: -1 }, { s: 'tree', p: 0.04 }],
      sprites(mini) {
        const candy = { leaf: ['#d868a8', '#f08cc0', '#ffb4d8', '#ffe0f0'], trunk: '#f6f0ff', trunkD: '#c6b6e4', o: '#4a3470' };
        const mint = { leaf: ['#58b8c8', '#7cd4dc', '#a8ecec', '#e0fffa'], trunk: '#f6f0ff', trunkD: '#c6b6e4', o: '#4a3470' };
        const cr = { l: '#ffe890', hi: '#ffffff', d: '#f0a030', o: '#7a4a1a' };
        const spire = A(['..r..', '.rrR.', '.rrR.', 'rrrRR', '.wwW.', '.wkW.', '.wwW.', '.wkW.', '.wwW.', 'wwwWW'], { r: '#f0558a', R: '#b02e66', w: '#f6f0ff', W: '#c6b6e4', k: '#4a3470' }, '#4a3470');
        return {
          tree: mini ? [PX.treeRound(candy, 3), PX.treeRound(mint, 2)] : [PX.treeRound(candy, 6), PX.treeRound(mint, 5), PX.treeRound(candy, 5), PX.treeRound(mint, 7)],
          spire: [mini ? A(['.r.', 'rrR', 'wwW', 'wkW', 'wwW'], { r: '#f0558a', R: '#b02e66', w: '#f6f0ff', W: '#c6b6e4', k: '#4a3470' }, '#4a3470') : spire],
          crystal: mini ? [PX.iceSpike(cr, 3, 5, 6)] : [PX.iceSpike(cr, 5, 9, 5), PX.iceSpike(cr, 7, 12, 7)],
          puff: mini ? [PX.cloud(['#c4d0f4', '#ffffff', '#ffffff'], 10, 5)] : [PX.cloud(['#c4d0f4', '#ffffff', '#ffffff'], 18, 8), PX.cloud(['#c4d0f4', '#ffffff', '#ffffff'], 12, 6)],
          mountain: [],
          landmark: PX.castle()
        };
      }
    },

    // Kommande kontinenter: grå, okänd mark. Alltid höljd i dimma.
    mystery: {
      liq: ['#1f4e96', '#2c6fc0', '#4d9ae6'], foam: '#d8f1ff', glint: '#8cc8f7', under: '#173a6e',
      shore: ['#8a8aa0', '#74748c'], ground: ['#4a4e66', '#565c76', '#646a86', '#747c98'],
      high: ['#646a86', '#747c98', '#868eaa', '#989fba'], cliff: ['#3c4058', '#2a2c40'],
      path: ['#8a8aa0', '#74748c'], pathEdge: '#2a2c40',
      speck: ['#868eaa'], speckRate: 0.004, wet: 0, mtn: 0, particle: null,
      deco: [{ s: 'rock', p: 0.2 }],
      sprites() {
        const mt = { l: '#8a90aa', m: '#6a708a', d: '#44485e', o: '#1c1e30', sl: '#8a90aa', sd: '#44485e' };
        return { rock: [PX.rock(['#44485e', '#6a708a', '#8a90aa'], '#1c1e30', 2)], mountain: [PX.mountain(mt, 14, 10, 0, 5, 2)], landmark: PX.mountain(mt, 18, 13, 0, 6, 2) };
      }
    }
  };
})();
