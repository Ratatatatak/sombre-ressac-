/* Service worker de Sombres Ressacs : rend l'app jouable hors-ligne.
   Penser à incrémenter VERSION quand on ajoute ou renomme des images. */
const VERSION = 'v1';
const CACHE_APP = 'ressacs-app-' + VERSION;
const CACHE_EXT = 'ressacs-ext-' + VERSION;

const FICHIERS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/apple-touch-icon.png',
  './carte-osmanlie.webp',
  './tome2-avis-recherche.webp',
  './tome2-pieces-91.webp',
  './tome2-schema-35.webp',
  './illus/desert.webp',
  './illus/osmanlie-nuit.webp',
  './illus/t1-cite.webp',
  './illus/t1-ruines.webp',
  './illus/t2-paysage-169.webp',
  './illus/varna.webp',
  ...Array.from({ length: 24 }, (_, i) =>
    './tome2-puzzle-91/p' + String(i + 1).padStart(2, '0') + '.webp')
];

/* Ressources externes qu'on garde en cache : polices et bibliothèque Supabase.
   Les appels à l'API Supabase (connexion, synchro) ne sont jamais mis en cache. */
const EXTERNES = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then(c => c.addAll(FICHIERS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(cles => Promise.all(cles
        .filter(k => k.startsWith('ressacs-') && k !== CACHE_APP && k !== CACHE_EXT)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // La page elle-même : réseau d'abord (pour recevoir les mises à jour), cache si hors-ligne.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(rep => {
          const copie = rep.clone();
          caches.open(CACHE_APP).then(c => c.put('./index.html', copie));
          return rep;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Images et fichiers du site : cache d'abord, réseau sinon.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(enCache => enCache || fetch(req).then(rep => {
        if (rep.ok) {
          const copie = rep.clone();
          caches.open(CACHE_APP).then(c => c.put(req, copie));
        }
        return rep;
      }))
    );
    return;
  }

  // Polices et Supabase JS : on sert le cache et on le rafraîchit en arrière-plan.
  if (EXTERNES.includes(url.hostname)) {
    e.respondWith(
      caches.open(CACHE_EXT).then(c => c.match(req).then(enCache => {
        const reseau = fetch(req).then(rep => {
          if (rep.ok || rep.type === 'opaque') c.put(req, rep.clone());
          return rep;
        }).catch(() => enCache);
        return enCache || reseau;
      }))
    );
  }
});
