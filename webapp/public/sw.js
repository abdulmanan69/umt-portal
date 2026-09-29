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
  /* the page asks for a sweep when it comes back into view */
  if (event.data?.type === 'umt:check') {
    event.waitUntil(checkClasses());
    return;
  }
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

const TINTS = ['#F59B1C', '#4CC9F0', '#34D399', '#A78BFA', '#FB7185', '#38BDF8', '#FBBF24'];

function courseTint(code) {
  let n = 0;
  for (let i = 0; i < code.length; i++) n = (n * 31 + code.charCodeAt(i)) % 9973;
  return TINTS[n % TINTS.length];
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return 'data:image/jpeg;base64,' + btoa(binary);
}

/* The page paints a banner when reminders are armed, but a background wake-up can
   arrive late. Redrawing here keeps the number on the card honest. */
async function paintBanner(slot, left) {
  if (typeof OffscreenCanvas === 'undefined') return null;
  try {
    const W = 1024, H = 512;
    const canvas = new OffscreenCanvas(W, H);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const tint = courseTint(slot.code);

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#131B30');
    bg.addColorStop(1, '#0B1120');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.86, H * 0.2, 20, W * 0.86, H * 0.2, 520);
    glow.addColorStop(0, tint + '33');
    glow.addColorStop(1, '#0B112000');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, 14, H);

    const started = left < 0;
    const big = started ? String(Math.abs(left)) : left === 0 ? 'NOW' : left < 60 ? String(left) : Math.floor(left / 60) + 'h';
    const unit = started ? 'minutes ago' : left === 0 ? 'starting' : left < 60 ? 'minutes away' : 'away';

    ctx.textAlign = 'right';
    ctx.fillStyle = tint;
    ctx.font = '700 168px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(big, W - 64, 232);
    ctx.fillStyle = '#AFBBD8';
    ctx.font = '500 30px "Segoe UI", system-ui, sans-serif';
    ctx.fillText(unit, W - 64, 282);

    ctx.textAlign = 'left';
    ctx.fillStyle = tint;
    ctx.font = '600 34px "Cascadia Mono", Consolas, monospace';
    ctx.fillText(slot.code, 64, 112);

    let nameSize = 62;
    ctx.font = '600 ' + nameSize + 'px "Segoe UI", system-ui, sans-serif';
    while (nameSize > 34 && ctx.measureText(slot.name).width > W - 420) {
      nameSize -= 2;
      ctx.font = '600 ' + nameSize + 'px "Segoe UI", system-ui, sans-serif';
    }
    ctx.fillStyle = '#F1F5FF';
    ctx.fillText(slot.name, 64, 190);

    const chips = [formatClock(slot.startMinutes) + ' to ' + formatClock(slot.endMinutes)];
    chips.push(slot.room ? slot.room : 'Room to be announced');
    let x = 64;
    const y = H - 132;
    ctx.font = '500 26px "Segoe UI", system-ui, sans-serif';
    for (const chip of chips) {
      const w = ctx.measureText(chip).width + 44;
      ctx.fillStyle = '#1E2846';
      roundRect(ctx, x, y, w, 60, 30);
      ctx.fill();
      ctx.strokeStyle = '#2C3860';
      ctx.lineWidth = 2;
      roundRect(ctx, x, y, w, 60, 30);
      ctx.stroke();
      ctx.fillStyle = '#D7E0F5';
      ctx.fillText(chip, x + 22, y + 39);
      x += w + 14;
    }

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.84 });
    return await blobToDataUrl(blob);
  } catch (e) {
    return null;
  }
}

function baseOf(state) {
  return (state && state.base) ? state.base.replace(/\/$/, '') : '.';
}

/* The same card the page would raise, rebuilt from what it handed over. */
/* Built at the moment it fires, so the minutes on the card are the real ones. */
async function notificationFor(slot, left, state) {
  const urgent = left <= 5;
  const base = baseOf(state);
  const when = left > 0
    ? 'In ' + left + ' min, at ' + formatClock(slot.startMinutes)
    : left === 0
      ? 'Starting now, ' + formatClock(slot.startMinutes) + ' to ' + formatClock(slot.endMinutes)
      : 'Started ' + Math.abs(left) + ' min ago, at ' + formatClock(slot.startMinutes);
  const body = when + '  .  ' + (slot.room ? 'Room ' + slot.room : 'Room not listed');
  const image = (await paintBanner(slot, left)) || slot.image || undefined;
  return {
    title: slot.code + '  .  ' + slot.name,
    options: {
      body: body,
      icon: base + '/icons/icon-192.png',
      badge: base + '/icons/badge-72.png',
      image: image,
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
    const card = await notificationFor(slot, slot.startMinutes - minutesNow, state);
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
    const card = await notificationFor(slot, slot.startMinutes - minutesNow, state);
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
