/* UMT Companion service worker: offline shell, plus a background nudge for classes. */
/* The build stamps its id onto the registration URL, so each deploy gets its own
   cache and the previous one is cleared on activate. */
const BUILD = new URL(self.location.href).searchParams.get('v') || 'dev';
const VERSION = 'umt-' + BUILD;
const SHELL = self.__UMT_SHELL__ || [];
const DB_NAME = 'umt-companion';
const STORE = 'state';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL.concat(['./', './index.html']))).catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache first for our own assets, network for anything else. */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match('./index.html').then((page) => page || Response.error()));
    })
  );
});

/* ---- the schedule the page hands us -------------------------------------- */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putState(value) {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, 'schedule');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getState() {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get('schedule');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'umt:schedule') {
    event.waitUntil(putState({
      classes: event.data.classes || [],
      leadMinutes: event.data.leadMinutes || 15,
      mutedDays: event.data.mutedDays || [],
      enabled: Boolean(event.data.enabled),
      sent: []
    }));
  }
});

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function formatClock(minutes) {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return h + ':' + String(m).padStart(2, '0') + suffix;
}

/* Anything whose reminder window opened in the last 20 minutes and has not been sent. */
async function checkClasses() {
  const state = await getState();
  if (!state || !state.enabled || !state.classes.length) return;

  const now = new Date();
  const dayName = WEEKDAYS[(now.getDay() + 6) % 7];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const sent = new Set(state.sent || []);
  let changed = false;

  for (const slot of state.classes) {
    if (slot.day !== dayName) continue;
    if ((state.mutedDays || []).includes(slot.day)) continue;
    const fireAt = slot.startMinutes - state.leadMinutes;
    if (minutesNow < fireAt || minutesNow > fireAt + 20) continue;
    const key = slot.code + '@' + now.toDateString() + '@' + slot.startMinutes;
    if (sent.has(key)) continue;
    sent.add(key);
    changed = true;
    const left = Math.max(0, slot.startMinutes - minutesNow);
    await self.registration.showNotification(slot.code + ' - ' + slot.name, {
      body: formatClock(slot.startMinutes) + (slot.room ? ' in ' + slot.room : '') +
        (left > 0 ? ', in ' + left + ' min' : ', starting now'),
      tag: key,
      icon: './icons/icon-192.png',
      badge: './icons/badge-72.png'
    });
  }

  if (changed) {
    await putState({ ...state, sent: Array.from(sent).slice(-60) });
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'umt-class-check') event.waitUntil(checkClasses());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'umt-class-check') event.waitUntil(checkClasses());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => client.url.includes(self.registration.scope));
      if (open) return open.focus();
      return self.clients.openWindow(target);
    })
  );
});
