const CACHE = 'ilsanitaria-v1';
const ASSETS = [
  '/apps/ilsanitaria/',
  '/apps/ilsanitaria/index.html',
  '/apps/ilsanitaria/manifest.json',
  '/apps/ilsanitaria/icon-192.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if(e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(r => {
      const fresh = fetch(e.request).then(res => {
        if(res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      }).catch(() => {});
      return r || fresh;
    })
  );
});
