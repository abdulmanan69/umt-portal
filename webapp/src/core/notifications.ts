import { store } from './store';
import type { ClassSlot } from './types';
import { describeWhen, formatClock, minutesUntil, upcoming } from './time';

/**
 * Web notifications cannot be trusted to fire from a page that is closed, so
 * this does three things and is honest about each:
 *   1. schedules exact timers while the app is open,
 *   2. asks the service worker to re-check on periodic background sync, which
 *      Chrome grants to installed apps,
 *   3. catches anything that came due while the app was shut, on next open.
 */

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

let timers: number[] = [];

export function permissionState(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission as PermissionState;
}

export async function requestPermission(): Promise<PermissionState> {
  if (typeof Notification === 'undefined') return 'unsupported';
  const result = await Notification.requestPermission();
  return result as PermissionState;
}

export function notificationKey(slot: ClassSlot, start: Date): string {
  return `${slot.code}@${start.toISOString().slice(0, 16)}`;
}

function body(slot: ClassSlot, minutes: number): string {
  const where = slot.room ? ` in ${slot.room}` : '';
  const when = minutes <= 0 ? 'starting now' : `in ${minutes} min`;
  return `${formatClock(slot.startMinutes)}${where}, ${when}`;
}

async function show(slot: ClassSlot, start: Date, minutes: number): Promise<void> {
  const title = `${slot.code} - ${slot.name}`;
  const options: NotificationOptions = {
    body: body(slot, minutes),
    tag: notificationKey(slot, start),
    icon: withBase('icons/icon-192.png'),
    badge: withBase('icons/badge-72.png'),
    requireInteraction: false,
    data: { url: withBase('#/today') }
  };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
  store.saveSettings({ lastNotifiedKey: options.tag ?? null });
}

function withBase(path: string): string {
  const base = document.querySelector('base')?.getAttribute('href') ?? import.meta.env.BASE_URL;
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export function clearScheduled(): void {
  timers.forEach((id) => clearTimeout(id));
  timers = [];
}

/** Arm timers for everything inside the next day; anything further is re-armed later. */
export function scheduleReminders(classes: readonly ClassSlot[]): number {
  clearScheduled();
  const settings = store.settings;
  if (!settings.notificationsEnabled || permissionState() !== 'granted') return 0;

  const now = new Date();
  const horizonMs = 24 * 60 * 60 * 1000;
  let armed = 0;

  for (const occurrence of upcoming(classes, now, 2)) {
    if (settings.mutedDays.includes(occurrence.slot.day)) continue;
    const fireAt = occurrence.start.getTime() - settings.leadMinutes * 60_000;
    const delay = fireAt - now.getTime();
    if (delay <= 0 || delay > horizonMs) continue;
    const id = window.setTimeout(() => {
      void show(occurrence.slot, occurrence.start, minutesUntil(occurrence.start));
    }, delay);
    timers.push(id);
    armed++;
  }
  void handoffToServiceWorker(classes);
  return armed;
}

/** Give the worker the schedule so background sync has something to work with. */
async function handoffToServiceWorker(classes: readonly ClassSlot[]): Promise<void> {
  const registration = await navigator.serviceWorker?.getRegistration();
  const settings = store.settings;
  registration?.active?.postMessage({
    type: 'umt:schedule',
    classes,
    leadMinutes: settings.leadMinutes,
    mutedDays: settings.mutedDays,
    enabled: settings.notificationsEnabled
  });

  const periodic = (registration as unknown as {
    periodicSync?: { register(tag: string, options: { minInterval: number }): Promise<void> };
  })?.periodicSync;
  try {
    await periodic?.register('umt-class-check', { minInterval: 30 * 60 * 1000 });
  } catch {
    /* not installed, or the browser does not offer periodic sync */
  }
}

/** Next class that still deserves a reminder, for the UI to show. */
export function nextReminder(classes: readonly ClassSlot[]): { slot: ClassSlot; start: Date; fireAt: Date } | null {
  const settings = store.settings;
  const next = upcoming(classes, new Date(), 7).find((o) => !settings.mutedDays.includes(o.slot.day));
  if (!next) return null;
  return {
    slot: next.slot,
    start: next.start,
    fireAt: new Date(next.start.getTime() - settings.leadMinutes * 60_000)
  };
}

export function describeNext(classes: readonly ClassSlot[]): string {
  const next = nextReminder(classes);
  if (!next) return 'No classes ahead this week.';
  return `${next.slot.code}, ${describeWhen(next.start).toLowerCase()} at ${formatClock(next.slot.startMinutes)}`;
}

export async function sendTestNotification(): Promise<boolean> {
  if (permissionState() !== 'granted') return false;
  const registration = await navigator.serviceWorker?.getRegistration();
  const title = 'Reminders are working';
  const options: NotificationOptions = {
    body: `You will hear from this app ${store.settings.leadMinutes} minutes before a class.`,
    icon: withBase('icons/icon-192.png'),
    tag: 'umt-test'
  };
  if (registration) await registration.showNotification(title, options);
  else new Notification(title, options);
  return true;
}
