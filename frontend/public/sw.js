/* MCH English service worker (public/sw.js).
 *
 * Plain JavaScript on purpose: Next.js serves /public verbatim, so this file
 * runs un-bundled inside the worker. Two jobs:
 *   1. Precache the app shell + offline page so navigation keeps working
 *      without connectivity (network-first, cache fallback).
 *   2. Best-effort offline audio for dictation sessions: authenticated fetches
 *      can't be replayed verbatim by the browser, so we cache the raw
 *      ArrayBuffer in IndexedDB keyed by sentence id and rebuild the Response.
 */
"use strict";

const VERSION = "v1";
const SHELL_CACHE = `mch-shell-${VERSION}`;
const RUNTIME_CACHE = `mch-runtime-${VERSION}`;
const KNOWN_CACHES = [SHELL_CACHE, RUNTIME_CACHE];
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon.svg",
  "/icons/icon-maskable.svg",
];

// ---------------------------------------------------------------------------
// Audio payload store (IndexedDB) -- Cache Storage can't serve a Response for
// a request whose Authorization header changed, so dictation audio is stored
// as raw bytes keyed by sentence id and re-wrapped on demand.
// ---------------------------------------------------------------------------
const AUDIO_DB_NAME = "mch-offline-audio";
const AUDIO_DB_VERSION = 1;
const AUDIO_STORE = "dictation-audio";

function openAudioDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(AUDIO_DB_NAME, AUDIO_DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(AUDIO_STORE)) {
        request.result.createObjectStore(AUDIO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putAudio(sentenceId, buffer, contentType) {
  const db = await openAudioDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readwrite");
      tx.objectStore(AUDIO_STORE).put({ buffer, contentType }, `audio:${sentenceId}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function getAudio(sentenceId) {
  const db = await openAudioDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_STORE, "readonly");
      const request = tx.objectStore(AUDIO_STORE).get(`audio:${sentenceId}`);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !KNOWN_CACHES.includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});


// ---------------------------------------------------------------------------
// Messages from the page (registration / audio warm-up / outbox telemetry)
// ---------------------------------------------------------------------------
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (data.type === "CACHE_DICTATION_AUDIO" && typeof data.sentenceId === "string" && data.buffer) {
    event.waitUntil(putAudio(data.sentenceId, data.buffer, data.contentType || "audio/wav"));
    return;
  }

  // The offline outbox (localStorage) lives in page context, so the SW asks
  // the page to flush it once connectivity is back and relays the outcome to
  // every open tab -- that drives the "N resultados pendientes" pill.
  if (data.type === "REQUEST_OUTBOX_FLUSH") {
    event.waitUntil(notifyClients({ type: "OUTBOX_SYNC_REQUESTED" }));
    return;
  }

  if (data.type === "OUTBOX_SYNCED") {
    event.waitUntil(
      notifyClients({ type: "OUTBOX_SYNCED", synced: Number(data.synced) || 0, remaining: Number(data.remaining) || 0 })
    );
  }
});

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  for (const client of clients) client.postMessage(message);
}

// ---------------------------------------------------------------------------
// Fetch strategy
// ---------------------------------------------------------------------------
const DICTATION_AUDIO_PATTERN = /\/dictation\/audio\/([^/?#]+)$/;

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Dictation audio: network-first, IndexedDB fallback so an interrupted
  // dictation session can keep playing sentences already listened to.
  const audioMatch = url.pathname.match(DICTATION_AUDIO_PATTERN);
  if (audioMatch) {
    event.respondWith(handleDictationAudio(request, audioMatch[1]));
    return;
  }

  // Navigations: network-first, cache, then the offline shell. Keeps an
  // in-progress practice session alive through dead wifi without ever serving
  // stale HTML while online.
  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  // Same-origin static assets: stale-while-revalidate.
  if (url.origin === self.location.origin && isStaticAsset(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
});

function isStaticAsset(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.json" ||
    pathname === "/offline.html" ||
    pathname === "/pdf.worker.min.mjs"
  );
}

async function handleNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    return offline ?? new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached ?? (await network) ?? Response.error();
}

async function handleDictationAudio(request, sentenceId) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const buffer = await response.clone().arrayBuffer();
      await putAudio(sentenceId, buffer, response.headers.get("Content-Type") || "audio/wav");
    }
    return response;
  } catch {
    const cached = await getAudio(sentenceId);
    if (cached) {
      return new Response(cached.buffer, {
        status: 200,
        headers: { "Content-Type": cached.contentType || "audio/wav", "X-MCH-Offline": "1" },
      });
    }
    return new Response("Audio no disponible sin conexion", { status: 503, statusText: "Offline" });
  }
}
