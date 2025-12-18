// Pastikan versi ini SAMA dengan yang ada di config.js
const CACHE_NAME = 'fish-it-v2.1.8'; 

// Daftar file yang WAJIB ada. 
// Kalau satu saja salah nama/lokasi, error "Request failed" akan muncul.
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/js/main.js',       // Dulu script.js (SALAH) -> Ganti ke lokasi asli
    '/js/config.js',     // File config juga perlu di-cache
    '/manifest.json'
];

self.addEventListener('install', (e) => {
    // Paksa service worker baru untuk segera aktif menggantikan yang lama
    self.skipWaiting();
    
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[ServiceWorker] Caching assets...');
            return cache.addAll(ASSETS);
        }).catch(err => {
            console.error('[ServiceWorker] Gagal Caching:', err);
        })
    );
});

self.addEventListener('activate', (e) => {
    // Hapus cache versi lama biar memori gak penuh
    e.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[ServiceWorker] Hapus cache lama:', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    // Biar halaman langsung dikontrol sama SW baru tanpa perlu reload 2x
    return self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Strategi: Network First, Fallback to Cache
    // Coba ambil dari internet dulu (biar data fresh), kalau offline baru ambil cache
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request);
        })
    );
});