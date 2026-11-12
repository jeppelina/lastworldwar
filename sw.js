// Service worker: ser till att en installerad app (hemskärmen) alltid får senaste versionen, och att spelet går att
// starta utan nät. Kod hämtas alltid färskt från nätet (med kopian som reserv utan nät). Ljud och bilder sparas och
// återanvänds tills nästa version publiceras, då börjar ett nytt förråd och det gamla tas bort.
const BUILD = '20261112114735', CACHE = 'lww-' + BUILD;
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('lww-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('version.json')) return;
  const media = /\.(mp3|png|jpg)$/.test(url.pathname);
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (media) { const hit = await cache.match(req); if (hit) return hit; const res = await fetch(req); if (res.ok) cache.put(req, res.clone()); return res; }
    try { const res = await fetch(req, { cache: 'no-cache' }); if (res.ok) cache.put(req, res.clone()); return res; }
    catch (err) { const hit = await cache.match(req); if (hit) return hit; throw err; }
  })());
});
