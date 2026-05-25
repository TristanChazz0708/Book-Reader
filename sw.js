const CACHE_NAME = 'nova-reader-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    // We cache the CDNs so they load offline
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js',
    'https://cdn.jsdelivr.net/npm/page-flip/dist/js/page-flip.browser.js',
    'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/localforage/1.10.0/localforage.min.js'
];

// Install Event - Caches your core files
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
        .then(cache => cache.addAll(ASSETS_TO_CACHE))
        .then(() => self.skipWaiting())
    );
});

// Activate Event - Cleans up old caches if you update the app
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});

// Fetch Event - Serves files from cache when offline
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
        .then(response => {
            // Return cached version or fetch from network
            return response || fetch(event.request);
        }).catch(() => {
            // Fallback if network fails and not in cache
            console.log('Offline and resource not cached:', event.request.url);
        })
    );
});
