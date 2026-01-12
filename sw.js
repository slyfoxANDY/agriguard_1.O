// KrishiMitra Service Worker
const CACHE_NAME = 'krishimitra-v1.0.0';
const STATIC_CACHE = 'krishimitra-static-v1';
const DYNAMIC_CACHE = 'krishimitra-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/css/components.css',
    '/css/animations.css',
    '/js/config.js',
    '/js/utils.js',
    '/js/gemini.js',
    '/js/weather.js',
    '/js/voice.js',
    '/js/eye.js',
    '/js/specialist.js',
    '/js/strategist.js',
    '/js/partner.js',
    '/js/app.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// API endpoints to cache
const API_CACHE_URLS = [
    'api.open-meteo.com'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Static assets cached');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[Service Worker] Cache failed:', err);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => {
                            return name !== STATIC_CACHE && 
                                   name !== DYNAMIC_CACHE &&
                                   name.startsWith('krishimitra-');
                        })
                        .map(name => {
                            console.log('[Service Worker] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Claiming clients');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip Gemini API requests (always fresh)
    if (url.hostname.includes('generativelanguage.googleapis.com')) {
        return;
    }
    
    // Handle API requests with network-first strategy
    if (API_CACHE_URLS.some(api => url.hostname.includes(api))) {
        event.respondWith(networkFirst(request));
        return;
    }
    
    // Handle static assets with cache-first strategy
    event.respondWith(cacheFirst(request));
});

// Cache-first strategy
async function cacheFirst(request) {
    try {
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            // Return cached version and update in background
            refreshCache(request);
            return cachedResponse;
        }
        
        // Not in cache, fetch from network
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        return createOfflineResponse(request);
    }
}

// Network-first strategy
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache');
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return createOfflineResponse(request);
    }
}

// Refresh cache in background
async function refreshCache(request) {
    try {
        const networkResponse = await fetch(request);
        
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse);
        }
    } catch (error) {
        // Silently fail - background update
    }
}

// Create offline response
function createOfflineResponse(request) {
    const url = new URL(request.url);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
        return new Response(
            `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Offline - KrishiMitra</title>
                <style>
                    body {
                        font-family: system-ui, -apple-system, sans-serif;
                        background: linear-gradient(135deg, #2D5A27 0%, #1a3d1a 100%);
                        color: white;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin: 0;
                        padding: 20px;
                    }
                    .container {
                        text-align: center;
                        max-width: 400px;
                    }
                    .icon {
                        font-size: 80px;
                        margin-bottom: 20px;
                    }
                    h1 {
                        font-size: 24px;
                        margin-bottom: 10px;
                    }
                    p {
                        opacity: 0.8;
                        margin-bottom: 30px;
                    }
                    button {
                        background: white;
                        color: #2D5A27;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                    }
                    button:hover {
                        transform: scale(1.05);
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">🌾</div>
                    <h1>You're Offline</h1>
                    <p>KrishiMitra needs an internet connection for AI features. Please check your connection and try again.</p>
                    <button onclick="location.reload()">Try Again</button>
                </div>
            </body>
            </html>`,
            {
                headers: { 'Content-Type': 'text/html' }
            }
        );
    }
    
    // Return empty response for other requests
    return new Response('Offline', { status: 503 });
}

// Handle push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data?.text() || 'New update from KrishiMitra',
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            { action: 'view', title: 'View', icon: '/icons/check.png' },
            { action: 'dismiss', title: 'Dismiss', icon: '/icons/close.png' }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('KrishiMitra', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-analyses') {
        event.waitUntil(syncAnalyses());
    }
});

// Sync pending analyses when back online
async function syncAnalyses() {
    try {
        // Get pending analyses from IndexedDB
        // This would sync any offline analyses
        console.log('[Service Worker] Syncing analyses...');
    } catch (error) {
        console.error('[Service Worker] Sync failed:', error);
    }
}

// Periodic background sync
self.addEventListener('periodicsync', event => {
    if (event.tag === 'weather-update') {
        event.waitUntil(updateWeatherCache());
    }
});

// Update weather cache periodically
async function updateWeatherCache() {
    try {
        const position = await getStoredLocation();
        if (position) {
            const response = await fetch(
                `https://api.open-meteo.com/v1/forecast?latitude=${position.lat}&longitude=${position.lon}&current=temperature_2m,weather_code&timezone=auto`
            );
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put('weather-cache', response);
        }
    } catch (error) {
        console.error('[Service Worker] Weather update failed:', error);
    }
}

// Get stored location from IndexedDB
async function getStoredLocation() {
    // Would retrieve from IndexedDB
    return null;
}

console.log('[Service Worker] Loaded');
