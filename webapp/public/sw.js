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

/* The page itself is fetched from the network first, so a new deploy is picked
   up on the next load; the cached copy is the fallback when there is no signal.
   Hashed assets never change under a name, so those are cache first. */
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const isPage = request.mode === 'navigate' || request.destination === 'document';

  if (isPage) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html')).then((hit) => hit || Response.error()))
    );
    return;
  }

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
    event.waitUntil((async () => {
      const previous = (await getState()) || {};
      await putState({
        classes: event.data.classes || [],
        leadMinutes: event.data.leadMinutes || 15,
        mutedDays: event.data.mutedDays || [],
        enabled: Boolean(event.data.enabled),
        base: event.data.base || './',
        sent: previous.sent || [],
        snoozed: previous.snoozed || []
      });
    })());
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

function baseOf(state) {
  return (state && state.base) ? state.base.replace(/\/$/, '') : '.';
}

/* The same card the page would raise, rebuilt from what it handed over. */
function notificationFor(slot, left, state) {
  const urgent = left <= 5;
  const base = baseOf(state);
  return {
    title: slot.code + '  .  ' + slot.name,
    options: {
      body: slot.body || (formatClock(slot.startMinutes) + (slot.room ? ' in ' + slot.room : '') +
        (left > 0 ? ', in ' + left + ' min' : ', starting now')),
      icon: base + '/icons/icon-192.png',
      badge: base + '/icons/badge-72.png',
      image: slot.image || undefined,
      tag: slot.code + '@' + slot.day + '@' + slot.startMinutes,
      renotify: true,
      requireInteraction: urgent,
      vibrate: urgent ? [120, 60, 120, 60, 240] : [80, 50, 80],
      timestamp: Date.now(),
      data: { url: base + '/#/today', code: slot.code, startMinutes: slot.startMinutes, day: slot.day },
      actions: [
        { action: 'open', title: 'Open timetable' },
        { action: 'snooze', title: 'Remind in 5 min' }
      ]
    }
  };
}

/* Anything whose reminder window opened in the last 20 minutes and has not been sent. */
async function checkClasses() {
  const state = await getState();
  if (!state || !state.enabled || !state.classes.length) return;

  const now = new Date();
  const dayName = WEEKDAYS[(now.getDay() + 6) % 7];
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const sent = new Set(state.sent || []);
  const snoozed = (state.snoozed || []).filter((s) => s.at > Date.now() - 60 * 60 * 1000);
  let changed = false;

  /* anything the student pushed back, now due again */
  for (const entry of snoozed.slice()) {
    if (entry.at > Date.now()) continue;
    snoozed.splice(snoozed.indexOf(entry), 1);
    changed = true;
    const slot = state.classes.find((c) => c.code === entry.code && c.startMinutes === entry.startMinutes && c.day === entry.day);
    if (!slot) continue;
    const card = notificationFor(slot, Math.max(0, slot.startMinutes - minutesNow), state);
    await self.registration.showNotification(card.title, card.options);
  }

  for (const slot of state.classes) {
    if (slot.day !== dayName) continue;
    if ((state.mutedDays || []).includes(slot.day)) continue;
    const fireAt = slot.startMinutes - state.leadMinutes;
    if (minutesNow < fireAt || minutesNow > fireAt + 20) continue;
    const key = slot.code + '@' + now.toDateString() + '@' + slot.startMinutes;
    if (sent.has(key)) continue;
    sent.add(key);
    changed = true;
    const card = notificationFor(slot, Math.max(0, slot.startMinutes - minutesNow), state);
    await self.registration.showNotification(card.title, card.options);
  }

  if (changed) {
    await putState({ ...state, sent: Array.from(sent).slice(-60), snoozed });
  }
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'umt-class-check') event.waitUntil(checkClasses());
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'umt-class-check') event.waitUntil(checkClasses());
});

self.addEventListener('notificationclick', (event) => {
  const data = event.notification.data || {};
  event.notification.close();

  if (event.action === 'snooze') {
    event.waitUntil((async () => {
      const state = (await getState()) || { snoozed: [] };
      const snoozed = (state.snoozed || []).concat([{
        code: data.code, startMinutes: data.startMinutes, day: data.day, at: Date.now() + 5 * 60 * 1000
      }]);
      await putState({ ...state, snoozed });
      setTimeout(() => { checkClasses(); }, 5 * 60 * 1000 + 1000);
    })());
    return;
  }

  const target = data.url || './';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const open = list.find((client) => client.url.includes(self.registration.scope));
      if (open) { open.navigate(target).catch(() => undefined); return open.focus(); }
      return self.clients.openWindow(target);
    })
  );
});
