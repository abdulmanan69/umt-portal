import { store } from './store';
import type { ClassSlot } from './types';
import { describeWhen, formatClock, minutesUntil, todayName, upcoming } from './time';
import { drawBanner } from './banner';

/**
 * Web notifications cannot be trusted to fire from a page that is closed, so
 * this does three things and is honest about each:
 *   1. schedules exact timers while the app is open,
 *   2. hands the service worker the schedule, its artwork and the settings, so
 *      background sync can raise the same notification while the app is shut,
 *   3. re-arms whenever the app comes back into view.
 */

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

let timers: number[] = [];

export function permissionState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  return (await Notification.requestPermission()) as PermissionState;
}

function withBase(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

/** "2nd of 3 today" reads better than a bare class name. */
function positionToday(slot: ClassSlot, classes: readonly ClassSlot[]): string {
  const sameDay = classes
    .filter((c) => c.day === slot.day)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  const index = sameDay.findIndex((c) => c.code === slot.code && c.startMinutes === slot.startMinutes);
  if (index < 0 || sameDay.length < 2) return '';
  const ordinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][index] ?? String(index + 1);
  return `${ordinal} of ${sameDay.length} ${slot.day === todayName() ? 'today' : 'that day'}`;
}

function nextAfter(slot: ClassSlot, classes: readonly ClassSlot[]): string {
  const later = classes
    .filter((c) => c.day === slot.day && c.startMinutes > slot.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];
  return later ? `${later.code} at ${formatClock(later.startMinutes)}` : '';
}

export function notificationBody(slot: ClassSlot, minutes: number, classes: readonly ClassSlot[]): string {
  const lines: string[] = [];
  lines.push(
    minutes <= 0
      ? `Starting now, ${formatClock(slot.startMinutes)} to ${formatClock(slot.endMinutes)}`
      : `In ${minutes} min, at ${formatClock(slot.startMinutes)}`
  );
  lines.push(slot.room ? `Room ${slot.room}` : 'Room not listed');
  const position = positionToday(slot, classes);
  const after = nextAfter(slot, classes);
  if (position) lines.push(position);
  if (after) lines.push(`Then ${after}`);
  return lines.join('  .  ');
}

export function buildNotification(slot: ClassSlot, minutes: number, classes: readonly ClassSlot[]): {
  title: string;
  options: NotificationOptions;
} {
  const urgent = minutes <= 5;
  const options = {
    body: notificationBody(slot, minutes, classes),
    icon: withBase('icons/icon-192.png'),
    badge: withBase('icons/badge-72.png'),
    image: drawBanner({
      slot,
      minutesAway: minutes,
      position: positionToday(slot, classes),
      nextAfter: nextAfter(slot, classes)
    }),
    tag: `${slot.code}@${slot.day}@${slot.startMinutes}`,
    renotify: true,
    requireInteraction: urgent,
    vibrate: urgent ? [120, 60, 120, 60, 240] : [80, 50, 80],
    timestamp: Date.now(),
    data: { url: withBase('#/today'), code: slot.code, startMinutes: slot.startMinutes, day: slot.day },
    actions: [
      { action: 'open', title: 'Open timetable' },
      { action: 'snooze', title: 'Remind in 5 min' }
    ]
  } as unknown as NotificationOptions;
  return { title: `${slot.code}  .  ${slot.name}`, options };
}

async function show(slot: ClassSlot, minutes: number, classes: readonly ClassSlot[]): Promise<void> {
  const { title, options } = buildNotification(slot, minutes, classes);
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
  store.saveSettings({ lastNotifiedKey: String(options.tag ?? '') });
}

export function clearScheduled(): void {
  timers.forEach((id) => clearTimeout(id));
  timers = [];
}

/** Arm timers for everything inside the next day; anything further is re-armed later. */
export function scheduleReminders(classes: readonly ClassSlot[]): number {
  clearScheduled();
  const settings = store.settings;
  if (!settings.notificationsEnabled || permissionState() !== 'granted') {
    void handoffToServiceWorker(classes);
    return 0;
  }

  const now = new Date();
  const horizonMs = 24 * 60 * 60 * 1000;
  let armed = 0;

  for (const occurrence of upcoming(classes, now, 2)) {
    if (settings.mutedDays.includes(occurrence.slot.day)) continue;
    const fireAt = occurrence.start.getTime() - settings.leadMinutes * 60_000;
    const delay = fireAt - now.getTime();
    if (delay <= 0 || delay > horizonMs) continue;
    const id = window.setTimeout(() => {
      void show(occurrence.slot, minutesUntil(occurrence.start), classes);
      window.dispatchEvent(new CustomEvent('umt:reminder', {
        detail: { slot: occurrence.slot, start: occurrence.start }
      }));
    }, delay);
    timers.push(id);
    armed++;
  }
  void handoffToServiceWorker(classes);
  return armed;
}

/** Give the worker the schedule, the artwork and the settings. */
async function handoffToServiceWorker(classes: readonly ClassSlot[]): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  const settings = store.settings;
  if (!registration) return;

  const painted = classes.map((slot) => ({
    day: slot.day,
    code: slot.code,
    name: slot.name,
    startMinutes: slot.startMinutes,
    endMinutes: slot.endMinutes,
    room: slot.room ?? '',
    body: notificationBody(slot, settings.leadMinutes, classes),
    image: drawBanner({
      slot,
      minutesAway: settings.leadMinutes,
      position: positionToday(slot, classes),
      nextAfter: nextAfter(slot, classes)
    })
  }));

  (registration.active ?? registration.waiting)?.postMessage({
    type: 'umt:schedule',
    classes: painted,
    leadMinutes: settings.leadMinutes,
    mutedDays: settings.mutedDays,
    enabled: settings.notificationsEnabled,
    base: import.meta.env.BASE_URL
  });

  const periodic = (registration as unknown as {
    periodicSync?: { register(tag: string, options: { minInterval: number }): Promise<void> };
  }).periodicSync;
  try {
    await periodic?.register('umt-class-check', { minInterval: 30 * 60 * 1000 });
  } catch {
    /* not installed, or the browser does not offer periodic sync */
  }
}

export function nextReminder(classes: readonly ClassSlot[]): { slot: ClassSlot; start: Date; fireAt: Date } | null {
  const settings = store.settings;
  const next = upcoming(classes, new Date(), 7).find((o) => !settings.mutedDays.includes(o.slot.day));
  if (!next) return null;
  return { slot: next.slot, start: next.start, fireAt: new Date(next.start.getTime() - settings.leadMinutes * 60_000) };
}

export function describeNext(classes: readonly ClassSlot[]): string {
  const next = nextReminder(classes);
  if (!next) return 'No classes ahead this week.';
  return `${next.slot.code}, ${describeWhen(next.start).toLowerCase()} at ${formatClock(next.slot.startMinutes)}`;
}

/** The test uses your next real class, so you see exactly what will arrive. */
export async function sendTestNotification(classes: readonly ClassSlot[]): Promise<boolean> {
  if (permissionState() !== 'granted') return false;
  const registration = await navigator.serviceWorker?.getRegistration();
  const next = nextReminder(classes);
  if (next) {
    const { title, options } = buildNotification(next.slot, store.settings.leadMinutes, classes);
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
    return true;
  }
  const title = 'Reminders are working';
  const options: NotificationOptions = {
    body: `You will hear from this app ${store.settings.leadMinutes} minutes before a class.`,
    icon: withBase('icons/icon-192.png'),
    badge: withBase('icons/badge-72.png'),
    tag: 'umt-test'
  };
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
  return true;
}
