// Synk: lokal händelselogg med utkorg, och en kopia i Supabase som hinner ikapp.
//
// Grundregeln: en enhet skickar aldrig "läget", bara sina egna nya händelser. Varje händelse har ett id
// som skapas här i klienten, så samma händelse kan skickas hur många gånger som helst utan att räknas två
// gånger. Tillståndet (guld, nivå, stjärnor, föremål) räknas fram ur alla händelser med fold() nedan och
// lagras aldrig som sanning. Därför kan en gammal eller tom enhet inte skriva över något.
//
// Modulen har inga beroenden utöver webbläsaren. Den pratar direkt med Supabase Auth och REST via fetch.
// Lagring och fetch går att byta ut (se createSync), vilket testerna i sync.test.mjs använder.
// Design och integrationsbeskrivning: docs/research/synk.md.

const PAGE = 1000;      // rader per hämtning
const OVERLAP = 200;    // så här många löpnummer bakåt läses om vid varje hämtning (se _pull)
const BATCH = 200;      // rader per skickning
const QUARANTINE = [400, 413, 422];   // svar som betyder "just den här raden är trasig", inte "försök senare"

// ---------- Dag ----------
// "I dag" räknas alltid i svensk tid, oavsett vilken tidszon enheten står i. Då byter butiken hylla
// samtidigt på alla enheter, även på resa. Formatet är ÅÅÅÅ-MM-DD och går att jämföra som text.
export function dayKey(now = Date.now(), offsetDays = 0, timeZone = 'Europe/Stockholm') {
  const d = new Date(now + offsetDays * 864e5);
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch (e) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}

// ---------- Från händelser till tillstånd ----------
// Samma kurva som catalog.js räknar ur balance.js (TUNE.xpBase 85, xpRamp 5, xpGrowth 1,05). Används bara om ingen kurva
// skickas in. Modulen ska inte ha några beroenden, så talen står här också: sync.test.mjs kontrollerar att de stämmer.
const defaultXpToLevel = (level) => Math.round(85 * Math.min(level, 5) / 5 * Math.pow(1.05, level - 1));
const int = (v) => (Number.isFinite(+v) ? Math.round(+v) : 0);
const order = (a, b) => a.ts - b.ts || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// Ren funktion. Samma mängd händelser ger samma tillstånd på alla enheter, oavsett i vilken ordning de kom.
// Händelserna spelas upp i ordningen (ts, id). Reglerna:
//   stage  : guld och xp läggs till. Vinst ger banan max(stjärnor). En kista ger guld bara första gången.
//   grant  : guld och xp läggs till (felsökning, flytt av gamla framsteg, förälderns rättning, xp för ordnivåer).
//            Har gåvan en nyckel (payload.once) räknas bara den första med den nyckeln, så att samma sak aldrig
//            betalas två gånger även om två enheter skulle ha bokfört den under olika id.
//   buy    : gäller bara om guldet räcker just då och föremålet inte redan ägs. Annars underkänns köpet
//            (ingen kostnad, inget föremål). Guldet kan därför aldrig bli negativt.
//   equip  : senaste i ordningen vinner per plats. Föremål man inte äger går inte att ta på.
//   shop   : första hyllan som skapats för en dag gäller för den dagen.
//   Okända typer och okända fält hoppas över (en äldre klient ser nyare händelser utan att gå sönder).
// Returnerar samma form som profilerna i main.js (utan name, look och heard som stannar på enheten).
export function fold(events, opts = {}) {
  const xpToLevel = opts.xpToLevel || defaultXpToLevel, day = opts.day || dayKey();
  const evs = [...events].sort(order);
  let earned = 0, spent = 0, xpTotal = 0, runs = 0, defeats = 0, shop = null;
  const owned = [], has = new Set(), eq = {}, done = {}, chests = new Set(), rejected = [], once = new Set();
  for (const e of evs) {
    const p = e.payload || {};
    if (e.type === 'stage') {
      const node = int(p.node), world = String(p.world || ''), key = world + ':' + node;
      if (p.kind === 'chest') { if (!chests.has(key)) { chests.add(key); earned += Math.max(0, int(p.gold)); } }
      else earned += Math.max(0, int(p.gold));
      xpTotal += Math.max(0, int(p.xp));
      if (p.kind === 'battle') { runs++; if (!p.win) defeats++; }
      if (p.win && world && node >= 0 && node < 1000) {
        const arr = done[world] || (done[world] = []);
        while (arr.length <= node) arr.push(0);
        arr[node] = Math.max(arr[node], Math.min(3, Math.max(1, int(p.stars))));
      }
    } else if (e.type === 'grant') {
      if (p.once != null) { const k = String(p.once); if (once.has(k)) continue; once.add(k); }
      earned += int(p.gold); xpTotal += int(p.xp);
    } else if (e.type === 'buy') {
      const item = String(p.item || ''), price = Math.max(0, int(p.price));
      if (!item || has.has(item)) continue;                       // samma sak köpt två gånger: betalas en gång
      if (earned - spent >= price) { spent += price; has.add(item); owned.push(item); }
      else rejected.push({ id: e.id, item, price });
    } else if (e.type === 'equip') {
      const slot = String(p.slot || '');
      if (!slot) continue;
      if (!p.item) delete eq[slot]; else if (has.has(p.item)) eq[slot] = p.item;
    } else if (e.type === 'shop') {
      if (p.day === day && !shop && Array.isArray(p.ids)) shop = { day: p.day, ids: p.ids.slice(), dream: null };
    }
  }
  let level = 1, xp = Math.max(0, xpTotal);
  for (let i = 0; i < 10000 && xp >= xpToLevel(level); i++) { xp -= xpToLevel(level); level++; }
  return { level, xp, gold: Math.max(0, earned - spent), owned, eq, done, shop, seenShop: shop ? shop.day : '', runs, defeats, rejected };
}

// ---------- Lagring ----------
// Ett lagringslager är fyra små tabeller (events, outbox, dead, meta) där varje rad har nyckeln id.
// Minnesvarianten används i tester och som nödlösning om IndexedDB inte går att öppna.
const TABLES = ['events', 'outbox', 'dead', 'meta'];

export function memoryStorage() {
  const t = Object.fromEntries(TABLES.map((n) => [n, new Map()]));
  const copy = (v) => JSON.parse(JSON.stringify(v));
  return {
    kind: 'memory',
    async getAll(table) { return [...t[table].values()].map(copy); },
    async get(table, id) { const v = t[table].get(id); return v === undefined ? undefined : copy(v); },
    async put(table, rows) { for (const r of rows) t[table].set(r.id, copy(r)); },
    async del(table, ids) { for (const id of ids) t[table].delete(id); },
    async clear(tables) { for (const n of tables) t[n].clear(); },
  };
}

// IndexedDB i stället för localStorage: loggen växer med någon megabyte per år och localStorage tar bara
// omkring fem, skrivs om i sin helhet vid varje ändring och blockerar sidan medan det sker.
export function indexedDbStorage(name = 'larovarlden-sync-v1') {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => { for (const n of TABLES) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('IndexedDB är blockerad av en annan flik'));
  }));
  const run = async (tables, mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => {
      const tx = db.transaction(tables, mode);
      let out; try { out = fn(tx); } catch (e) { rej(e); return; }
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('IndexedDB avbröt skrivningen'));
    });
  };
  return {
    kind: 'indexeddb',
    getAll: (table) => run(table, 'readonly', (tx) => tx.objectStore(table).getAll()),
    get: (table, id) => run(table, 'readonly', (tx) => tx.objectStore(table).get(id)),
    put: (table, rows) => run(table, 'readwrite', (tx) => { const s = tx.objectStore(table); for (const r of rows) s.put(r); }),
    del: (table, ids) => run(table, 'readwrite', (tx) => { const s = tx.objectStore(table); for (const id of ids) s.delete(id); }),
    clear: (tables) => run(tables, 'readwrite', (tx) => { for (const n of tables) tx.objectStore(n).clear(); }),
  };
}

// ---------- Fel ----------
class SyncError extends Error { constructor(code, detail) { super(code); this.code = code; this.detail = detail; } }
const codeFor = (status) => (status === 401 ? 'needs-login' : status === 403 ? 'forbidden' : status === 404 ? 'no-tables' : 'server');

function makeUuid() {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return c.randomUUID();
  // randomUUID finns bara på https och localhost. Samma sak för hand, för utveckling över lokalt nät.
  const b = new Uint8Array(16); c.getRandomValues(b); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Ett bestämt id (i uuid-form, tabellens id-kolumn är uuid) ur en text. Samma text ger samma id på alla enheter.
// Fyra 32-bitarshashar med olika frön, alltså 122 slumpmässiga bitar som i ett vanligt uuid.
export function uuidFrom(text) {
  const h = (seed) => { let a = 0xdeadbeef ^ seed, b = 0x41c6ce57 ^ seed; for (let i = 0; i < text.length; i++) { const c = text.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909); b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909); return [a >>> 0, b >>> 0]; };
  const x = [...h(1), ...h(2)].map((n) => n.toString(16).padStart(8, '0')).join('').split('');
  x[12] = '5'; x[16] = '89ab'[parseInt(x[16], 16) & 3];
  const t = x.join('');
  return `${t.slice(0, 8)}-${t.slice(8, 12)}-${t.slice(12, 16)}-${t.slice(16, 20)}-${t.slice(20)}`;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Synkmotorn ----------
// createSync ger en fristående instans (testerna skapar en per låtsasenhet). Spelet använder de
// exporterade funktionerna längst ner, som delar på en instans.
//
// config: { url, key }            projektadress och publicerbar nyckel (från sync-config.js)
//         { xpToLevel }           nivåkurvan från catalog.js
//         { storage, fetch, now, uuid, auto, pushDelay, timeoutMs }   utbytbara delar, mest för tester
export function createSync(config = {}) {
  const cfg = {
    url: String(config.url || '').replace(/\/+$/, ''), key: config.key || '',
    xpToLevel: config.xpToLevel || defaultXpToLevel,
    storage: config.storage || null,
    fetch: config.fetch || ((...a) => globalThis.fetch(...a)),
    now: config.now || (() => Date.now()),
    uuid: config.uuid || makeUuid,
    auto: config.auto !== undefined ? config.auto : typeof window !== 'undefined',
    pushDelay: config.pushDelay !== undefined ? config.pushDelay : 1500,
    timeoutMs: config.timeoutMs || 15000,
  };
  const configured = /^https?:\/\//.test(cfg.url) && !!cfg.key && !/DITT-PROJEKT|FYLL-I/.test(cfg.url + cfg.key);

  let storage = cfg.storage, started = false;
  const events = new Map();            // id -> händelse (egna och andras)
  let outbox = [];                     // { id, t: 'e' | 'a', row } i den ordning de skapades
  let dead = [];                       // rader som servern vägrat ta emot, sparas och visas i status
  const meta = {};                     // deviceId, session, householdId, cursor, lastSyncAt, legacy:<profil>
  const cache = new Map();             // profil|dag -> framräknat tillstånd
  const subs = new Set();
  let maxTs = 0, online = true, lastError = null, needsLogin = false, persisted = false, busy = 0;
  let counter = 0;                     // ordningsnummer i utkorgen
  let writes = Promise.resolve(), queue = Promise.resolve(), refreshing = null, kickT = null;

  // ----- små hjälpare -----
  const write = (fn) => { writes = writes.then(fn).catch((e) => { lastError = 'storage'; console.warn('[sync] lagring misslyckades', e); }); return writes; };
  const setMeta = (k, v) => { if (v === undefined || v === null) { delete meta[k]; return write(() => storage.del('meta', [k])); } meta[k] = v; return write(() => storage.put('meta', [{ id: k, v }])); };
  const emit = (change) => { for (const fn of [...subs]) { try { fn(change); } catch (e) { console.warn('[sync] lyssnare kastade', e); } } };
  const invalidate = (profiles) => { for (const k of [...cache.keys()]) if (!profiles || profiles.includes(k.split('|')[0])) cache.delete(k); };
  // Logisk klocka: enhetens tid, men aldrig lägre än något som enheten redan har sett. Ett köp som görs
  // efter att guldet synkats hit hamnar därför alltid efter guldet, även om enhetens klocka går fel.
  const nextTs = () => (maxTs = Math.max(cfg.now(), maxTs + 1));
  const eventsOf = (profileId) => { const out = []; for (const e of events.values()) if (e.profile === profileId) out.push(e); return out; };
  const rejectedIds = (profileId) => new Set(fold(eventsOf(profileId), { xpToLevel: cfg.xpToLevel }).rejected.map((r) => r.id));

  // ----- start -----
  async function start() {
    if (started) return status();
    if (!storage) {
      try { if (typeof indexedDB === 'undefined') throw new Error('saknas'); storage = indexedDbStorage(); await storage.getAll('meta'); }
      catch (e) { console.warn('[sync] IndexedDB går inte att använda, framsteg sparas bara tills sidan stängs', e); storage = memoryStorage(); }
    }
    for (const r of await storage.getAll('meta')) meta[r.id] = r.v;
    for (const e of await storage.getAll('events')) events.set(e.id, e);
    outbox = (await storage.getAll('outbox')).sort((a, b) => a.row.ts - b.row.ts || a.n - b.n);
    dead = await storage.getAll('dead');
    for (const o of outbox) if (o.n > counter) counter = o.n;
    // Om sidan dog mellan två skrivningar kan en händelse finnas i utkorgen men inte i loggen.
    for (const o of outbox) if (o.t === 'e' && !events.has(o.id)) { events.set(o.id, o.row); write(() => storage.put('events', [o.row])); }
    for (const e of events.values()) if (e.ts > maxTs) maxTs = e.ts;
    if (!meta.deviceId) setMeta('deviceId', 'd-' + cfg.uuid().slice(0, 8));
    started = true;
    try { if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) persisted = await navigator.storage.persist(); } catch (e) {}
    if (cfg.auto && typeof window !== 'undefined') {
      window.addEventListener('online', () => sync());
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sync(); else run('push'); });
      setInterval(() => { if (meta.session && (outbox.length || cfg.now() - (meta.lastSyncAt || 0) > 5 * 60000)) sync(); }, 30000);
      sync();
    }
    return status();
  }
  const need = () => { if (!started) throw new Error('sync: anropa init() först'); };

  // ----- nät -----
  async function http(path, { method = 'GET', body, headers = {}, token } = {}) {
    const h = { apikey: cfg.key, ...headers };
    if (body !== undefined) h['Content-Type'] = 'application/json';
    if (token) h.Authorization = 'Bearer ' + token;
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), cfg.timeoutMs) : null;
    let res, text;
    try {
      res = await cfg.fetch(cfg.url + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
      text = await res.text();
    } catch (e) { online = false; throw new SyncError('network', String(e && e.message || e)); }
    finally { if (timer) clearTimeout(timer); }
    online = true;
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) {}
    return { ok: res.ok, status: res.status, data };
  }

  // ----- inloggning -----
  const keepSession = (d) => setMeta('session', {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(cfg.now() / 1000) + (d.expires_in || 3600),
    user_id: d.user && d.user.id, email: d.user && d.user.email,
  });

  async function refresh() {
    if (refreshing) return refreshing;
    const work = async () => {
      // En annan flik kan ha hunnit förnya. En förnyelsenyckel får bara användas en gång.
      const stored = await storage.get('meta', 'session');
      if (stored && stored.v && meta.session && stored.v.refresh_token !== meta.session.refresh_token) { meta.session = stored.v; return; }
      const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: meta.session.refresh_token } });
      if (r.ok && r.data && r.data.access_token) { await keepSession(r.data); return; }
      if ([400, 401, 403].includes(r.status)) {      // sessionen är död. Utkorgen ligger kvar tills pappan loggar in igen.
        await setMeta('session', null); needsLogin = true; emit({ reason: 'status' });
        throw new SyncError('needs-login');
      }
      throw new SyncError('server', r.status);
    };
    const locks = typeof navigator !== 'undefined' && navigator.locks;
    refreshing = (locks ? locks.request('larovarlden-sync-auth', work) : work()).finally(() => { refreshing = null; });
    return refreshing;
  }

  // Anrop som kräver inloggning. Förnyar åtkomstnyckeln i förväg, och en gång till om servern ändå säger 401.
  async function rest(method, path, body, headers) {
    if (!meta.session) throw new SyncError(needsLogin ? 'needs-login' : 'signed-out');
    if (meta.session.expires_at * 1000 - cfg.now() < 60000) await refresh();
    let r = await http(path, { method, body, headers, token: meta.session.access_token });
    if (r.status === 401) { await refresh(); r = await http(path, { method, body, headers, token: meta.session.access_token }); }
    return r;
  }

  async function loadMembership() {
    const r = await rest('GET', '/rest/v1/lv_members?select=household_id&limit=1');
    if (!r.ok) throw new SyncError(codeFor(r.status), r.data);
    const hh = r.data && r.data[0] && r.data[0].household_id;
    if (!hh) throw new SyncError('not-member');
    // Skydd mot att fel konto loggas in på en enhet som redan har ett annat hushålls framsteg.
    if (meta.householdId && meta.householdId !== hh && (events.size || outbox.length)) throw new SyncError('other-household');
    await setMeta('householdId', hh);
  }

  // Lösenordet skickas till Supabase och sparas aldrig. Det som sparas är sessionen (två nycklar).
  async function signIn(email, password) {
    need();
    if (!configured) return { ok: false, error: 'not-configured' };
    try {
      const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
      if (!r.ok || !r.data || !r.data.access_token) return { ok: false, error: r.status === 400 || r.status === 401 ? 'invalid-credentials' : 'server' };
      await keepSession(r.data); needsLogin = false;
      try { await loadMembership(); }
      catch (e) { if (e.code !== 'network') await setMeta('session', null); emit({ reason: 'status' }); return { ok: false, error: e.code || 'server' }; }
      lastError = null; emit({ reason: 'status' });
      const s = await sync();
      return { ok: true, synced: s.ok, sent: s.sent, received: s.received };
    } catch (e) { return { ok: false, error: e.code || 'server' }; }
  }

  // Utloggning rör inte loggen eller utkorgen. Barnen kan spela vidare, och allt skickas vid nästa inloggning.
  async function signOut() {
    need();
    const s = meta.session;
    await setMeta('session', null); needsLogin = false; emit({ reason: 'status' });
    if (s) { try { await http('/auth/v1/logout?scope=local', { method: 'POST', token: s.access_token }); } catch (e) {} }
    return { ok: true };
  }

  // ----- skriva -----
  // Lägger händelsen i loggen och utkorgen direkt (tillståndet är uppdaterat när funktionen returnerar)
  // och försöker skicka strax efteråt. type 'answer' är ett svar på en fråga och går till en egen tabell,
  // eftersom svaren är många och inte påverkar guld eller nivå.
  //
  // opts.once = en nyckel för något som bara får hända en gång per barn (xp för ett ord som nått en nivå, en
  // engångsgåva vid en balansändring). Händelsen får då ett bestämt id ur hushåll, profil och nyckel, så att två
  // enheter eller en omstart skapar samma rad (servern tar emot den första, id är primärnyckel). Nyckeln skrivs
  // också i payload.once, som fold() använder för att aldrig räkna samma nyckel två gånger. Finns händelsen redan
  // här returneras null och inget skrivs. Före inloggning är hushållet okänt, då används enhetens id i stället:
  // skulle samma nyckel senare komma från en annan enhet under ett annat id räknas den ändå bara en gång av fold().
  // opts.id = ett eget id i uuid-form (samma regel: finns det redan returneras null).
  function record(profileId, type, payload = {}, opts = null) {
    need();
    const device = meta.deviceId;
    let id = cfg.uuid();
    if (opts && type !== 'answer' && (opts.once != null || opts.id)) {
      if (opts.once != null) payload = { ...payload, once: String(opts.once) };
      id = opts.id ? String(opts.id).toLowerCase() : uuidFrom(`${meta.householdId || meta.deviceId}|${profileId}|${opts.once}`);
      if (!UUID.test(id)) throw new Error('sync: id måste vara ett uuid');
      if (events.has(id)) return null;
    }
    let item;
    if (type === 'answer') {
      const p = payload;
      item = { id, t: 'a', n: ++counter, row: { id, profile: profileId, word: String(p.word), exercise: String(p.exercise || 'listen_pick'), correct: !!p.correct,
        ms: Number.isFinite(p.ms) ? Math.max(0, Math.min(600000, Math.round(p.ms))) : null, chosen: p.chosen != null ? String(p.chosen) : null,
        stage: p.stage != null ? String(p.stage) : null, ts: cfg.now(), device } };
    } else {
      const ev = { id, profile: profileId, type, payload: JSON.parse(JSON.stringify(payload)), ts: nextTs(), device };
      item = { id, t: 'e', n: ++counter, row: ev };
      events.set(id, ev); invalidate([profileId]);
    }
    outbox.push(item);
    write(() => storage.put('outbox', [item]));                       // utkorgen först, se start()
    if (item.t === 'e') write(() => storage.put('events', [item.row]));
    emit({ reason: 'local', profiles: [profileId] });
    if (cfg.auto) { clearTimeout(kickT); kickT = setTimeout(() => run('push'), cfg.pushDelay); }
    return item.row;
  }

  // Flyttar in framsteg som gjorts innan synken fanns (profilen så som main.js sparade den i localStorage).
  // Görs en gång per profil och enhet. Guld och xp blir en gåva, föremål blir köp för noll guld.
  function importLegacy(profileId, old) {
    need();
    if (!old || meta['legacy:' + profileId]) return 0;
    let total = Math.max(0, int(old.xp)), n = 0;
    for (let l = 1; l < int(old.level || 1) && l < 10000; l++) total += cfg.xpToLevel(l);
    const add = (type, payload) => { record(profileId, type, payload); n++; };
    if (int(old.gold) > 0 || total > 0) add('grant', { gold: Math.max(0, int(old.gold)), xp: total, reason: 'legacy' });
    for (const item of old.owned || []) add('buy', { item, price: 0, reason: 'legacy' });
    for (const [slot, item] of Object.entries(old.eq || {})) if (item) add('equip', { slot, item });
    for (const [world, arr] of Object.entries(old.done || {})) (arr || []).forEach((stars, node) => { if (stars > 0) add('stage', { world, node, kind: 'legacy', win: true, stars, gold: 0, xp: 0 }); });
    setMeta('legacy:' + profileId, true);
    return n;
  }

  // ----- skicka -----
  async function send(table, batch) {
    const rows = batch.map((o) => ({ ...o.row, household_id: meta.householdId }));
    const r = await rest('POST', `/rest/v1/${table}?on_conflict=id`, rows, { Prefer: 'resolution=ignore-duplicates,return=minimal' });
    const ids = batch.map((o) => o.id);
    if (r.ok) { outbox = outbox.filter((o) => !ids.includes(o.id)); await write(() => storage.del('outbox', ids)); return batch.length; }
    if (!QUARANTINE.includes(r.status)) throw new SyncError(codeFor(r.status), r.data);
    // Servern underkände innehållet. Hitta den trasiga raden genom att skicka en i taget, och lägg den
    // åt sidan (den raderas inte) så att resten av utkorgen inte fastnar bakom den.
    if (batch.length > 1) { let n = 0; for (const o of batch) n += await send(table, [o]); return n; }
    const bad = { ...batch[0], error: r.data && (r.data.message || r.data.code) || String(r.status), at: cfg.now() };
    dead.push(bad); outbox = outbox.filter((o) => o.id !== bad.id);
    await write(() => storage.put('dead', [bad])); await write(() => storage.del('outbox', [bad.id]));
    return 0;
  }
  async function pushAll() {
    let sent = 0;
    for (const [t, table] of [['e', 'lv_events'], ['a', 'lv_answers']]) {
      for (;;) { const batch = outbox.filter((o) => o.t === t).slice(0, BATCH); if (!batch.length) break; sent += await send(table, batch); }
    }
    return sent;
  }

  // ----- hämta -----
  // Markören är serverns löpnummer (seq). Två skrivningar som pågår samtidigt kan bli synliga i omvänd
  // ordning, så varje hämtning läser om de senaste OVERLAP numren. Dubbletter sorteras bort på id.
  async function pullAll(full) {
    let after = full ? 0 : Math.max(0, (meta.cursor || 0) - OVERLAP), top = meta.cursor || 0;
    const fresh = [], seen = new Set();
    for (;;) {
      const r = await rest('GET', `/rest/v1/lv_events?select=id,profile,type,payload,ts,device,seq&seq=gt.${after}&order=seq.asc&limit=${PAGE}`);
      if (!r.ok) throw new SyncError(codeFor(r.status), r.data);
      const rows = r.data || [];
      if (!rows.length) break;
      for (const row of rows) { if (!events.has(row.id) && !seen.has(row.id)) { seen.add(row.id); fresh.push(row); } if (row.seq > top) top = row.seq; }
      after = rows[rows.length - 1].seq;
    }
    if (fresh.length) {
      const profiles = [...new Set(fresh.map((e) => e.profile))];
      const before = new Map(profiles.map((p) => [p, rejectedIds(p)]));
      for (const e of fresh) { events.set(e.id, e); if (e.ts > maxTs) maxTs = e.ts; }
      invalidate(profiles);
      await write(() => storage.put('events', fresh));
      // Köp som var giltiga här men som förlorade mot ett tidigare köp på en annan enhet.
      const rejected = [];
      for (const p of profiles) for (const r of fold(eventsOf(p), { xpToLevel: cfg.xpToLevel }).rejected) if (!before.get(p).has(r.id)) rejected.push({ profileId: p, ...r });
      if (top !== meta.cursor) await setMeta('cursor', top);
      emit({ reason: 'remote', profiles, rejected });
    } else if (top !== meta.cursor) await setMeta('cursor', top);
    return fresh.length;
  }

  // ----- kö: en synk i taget -----
  function run(kind, opts = {}) {
    need();
    const job = queue.then(async () => {
      const out = { ok: false, sent: 0, received: 0 };
      if (!configured) return { ...out, error: 'not-configured' };
      if (!meta.session) return { ...out, error: needsLogin ? 'needs-login' : 'signed-out' };
      busy++; emit({ reason: 'status' });
      try {
        if (!meta.householdId) await loadMembership();
        if (kind !== 'pull') out.sent = await pushAll();
        if (kind !== 'push') out.received = await pullAll(opts.full);
        out.ok = true; lastError = null;
        if (kind === 'sync') await setMeta('lastSyncAt', cfg.now());
      } catch (e) { out.error = e.code || 'server'; lastError = out.error; if (!e.code) console.warn('[sync]', e); }
      busy--; emit({ reason: 'status' });
      return out;
    });
    queue = job.catch(() => {});
    return job;
  }
  const sync = (opts) => run('sync', opts);
  const pull = (opts) => run('pull', opts);
  const push = () => run('push');

  // ----- läsa -----
  // Tillståndet för en profil, i samma form som main.js använder. day styr vilken dags butikshylla som
  // följer med (standard: i dag i svensk tid). Svaret är en kopia som får ändras fritt.
  function stateFor(profileId, day) {
    need();
    day = day || dayKey(cfg.now());
    const k = profileId + '|' + day;
    if (!cache.has(k)) cache.set(k, fold(eventsOf(profileId), { xpToLevel: cfg.xpToLevel, day }));
    return JSON.parse(JSON.stringify(cache.get(k)));
  }

  function status() {
    const s = meta.session;
    return {
      configured, signedIn: !!s, needsLogin, email: s ? s.email || null : null,
      online, syncing: busy > 0, pending: outbox.length, rejected: dead.length,
      lastSyncAt: meta.lastSyncAt || null, lastError,
      storage: storage ? storage.kind : null, persisted, deviceId: meta.deviceId || null,
    };
  }

  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  // Tömmer enhetens lokala kopia och hämtar allt på nytt. Vägrar om något ligger oskickat, om inte force.
  async function resetLocal({ force = false } = {}) {
    need();
    await writes;
    if (outbox.length && !force) return { ok: false, error: 'pending', pending: outbox.length };
    events.clear(); outbox = []; dead = []; maxTs = 0; invalidate();
    // Flaggorna för flyttade framsteg (legacy:<profil>) ligger kvar, annars skulle gamla localStorage-data
    // flyttas in en gång till och räknas dubbelt.
    delete meta.cursor; delete meta.lastSyncAt;
    await write(async () => { await storage.clear(['events', 'outbox', 'dead']); await storage.del('meta', ['cursor', 'lastSyncAt']); });
    emit({ reason: 'remote', profiles: null, rejected: [] });
    return meta.session ? pull({ full: true }) : { ok: true, sent: 0, received: 0 };
  }

  // En profils händelser i den ordning fold() spelar upp dem. Används av main.js för det som räknas fram utanför
  // fold(): ordboken, inställningar per barn och vilka engångsnycklar som redan finns.
  const eventsFor = (profileId) => { need(); return eventsOf(profileId).sort(order); };

  // Allt som finns lokalt, för en säkerhetskopia som pappan kan ladda ner från föräldraskärmen.
  const exportLocal = () => ({ exportedAt: cfg.now(), deviceId: meta.deviceId, events: [...events.values()].sort(order), outbox: outbox.map((o) => o.row), rejected: dead });

  // Väntar tills pågående skrivningar och synkar är klara. Används av testerna.
  const idle = async () => { await queue; await writes; };

  return { start, signIn, signOut, status, record, importLegacy, push, pull, sync, stateFor, eventsFor, subscribe, resetLocal, exportLocal, idle };
}

// ---------- Spelets gränssnitt: en delad instans ----------
let main = null;
const inst = () => { if (!main) throw new Error('sync: anropa init() först'); return main; };

// init({ url, key, xpToLevel }) läser in loggen från enheten. Ska vara klar innan första skärmen ritas.
export async function init(config = {}) { if (!main) main = createSync(config); return main.start(); }
export const signIn = (email, password) => inst().signIn(email, password);
export const signOut = () => inst().signOut();
export const status = () => inst().status();
export const record = (profileId, type, payload, opts) => inst().record(profileId, type, payload, opts);
export const importLegacy = (profileId, oldProfile) => inst().importLegacy(profileId, oldProfile);
export const pull = (opts) => inst().pull(opts);
export const push = () => inst().push();
export const sync = (opts) => inst().sync(opts);
export const stateFor = (profileId, day) => inst().stateFor(profileId, day);
export const eventsFor = (profileId) => inst().eventsFor(profileId);
export const subscribe = (fn) => inst().subscribe(fn);
export const resetLocal = (opts) => inst().resetLocal(opts);
export const exportLocal = () => inst().exportLocal();
