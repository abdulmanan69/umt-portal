import './styles.css';
import { el } from './ui/dom';
import { toast } from './ui/components';
import { store } from './core/store';
import { applyTheme } from './app/theme';
import { createShell } from './app/shell';
import { defineRoutes } from './app/router';
import { renderGate } from './views/gate';
import { renderToday } from './views/today';
import { renderFees, renderRecord, renderWeek } from './views/week';
import { renderSettings } from './views/settings';
import { renderClassEditor } from './views/paste';
import { readSyncLink } from './core/sync';
import { scheduleReminders } from './core/notifications';

const root = document.getElementById('app');
if (!root) throw new Error('The app needs a #app element to mount into.');

const shell = createShell();

defineRoutes([
  { path: '/today', title: 'Today', subtitle: 'What is next, and when', icon: 'clock', render: renderToday },
  { path: '/week', title: 'Week', subtitle: 'Your whole timetable', icon: 'calendar', render: renderWeek },
  { path: '/record', title: 'Record', subtitle: 'Semesters, grades and CGPA', icon: 'graduation', render: renderRecord },
  { path: '/fees', title: 'Fees', subtitle: 'Every payment on file', icon: 'wallet', render: renderFees },
  { path: '/settings', title: 'Settings', subtitle: 'Reminders, data and this device', icon: 'settings', render: () => renderSettings(() => shell.refresh()) },
  { path: '/classes', title: 'Timetable editor', subtitle: 'Paste, add or correct your classes', icon: 'plus', hidden: true, render: () => renderClassEditor(() => shell.refresh()) }
]);

async function boot(): Promise<void> {
  applyTheme();

  /* A sync link hands us a snapshot before anything else is decided. */
  const fromLink = await readSyncLink();
  if (fromLink) {
    store.mergeSnapshot(fromLink);
    history.replaceState(null, '', location.pathname + location.search + '#/today');
    toast('Record loaded from the sync link.', 'good');
  }

  if (!store.hasData || !store.isUnlocked) {
    root!.replaceChildren(renderGate(() => { void start(); }));
    return;
  }
  await start();
}

async function start(): Promise<void> {
  shell.mount(root!);
  const classes = store.snapshot?.schedule?.classes ?? [];
  if (store.settings.notificationsEnabled) scheduleReminders(classes);

  /* Re-arm when the tab comes back, since timers do not survive a sleep. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && store.settings.notificationsEnabled) {
      scheduleReminders(store.snapshot?.schedule?.classes ?? []);
      shell.refresh();
    }
  });

  /* Keep the countdown honest without redrawing the world. */
  setInterval(() => {
    if (document.visibilityState === 'visible' && location.hash.includes('/today')) shell.refresh();
  }, 60_000);
}

void boot();

/* ---- progressive web app -------------------------------------------------- */
declare const __BUILD_ID__: string;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const url = `${import.meta.env.BASE_URL}sw.js?v=${__BUILD_ID__}`;
    navigator.serviceWorker.register(url, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          installing?.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              toast('A newer version is ready. Reload to pick it up.', 'info');
            }
          });
        });
      })
      .catch(() => {
        /* the app still works, it just will not run offline */
      });
  });
}

let installPrompt: Event | null = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event;
  const bar = el('div', { class: 'toast good' }, [
    el('span', { text: 'Add this to your home screen for reminders' }),
    (() => {
      const b = el('button', { class: 'btn primary', text: 'Install' });
      b.addEventListener('click', async () => {
        bar.remove();
        await (installPrompt as unknown as { prompt(): Promise<void> })?.prompt();
        installPrompt = null;
      });
      return b;
    })()
  ]);
  let host = document.querySelector('.toasts');
  if (!host) {
    host = el('div', { class: 'toasts' });
    document.body.appendChild(host);
  }
  host.appendChild(bar);
});
