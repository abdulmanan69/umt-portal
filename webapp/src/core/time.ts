import { WEEKDAYS, type ClassSlot, type Weekday } from './types';

/** "03:30 PM" -> 930. Returns null when the portal hands us something odd. */
export function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})\s*([AP])M$/i.exec((value || '').trim());
  if (!m) return null;
  const hour = Number(m[1]) % 12 + (m[3].toUpperCase() === 'P' ? 12 : 0);
  const minute = Number(m[2]);
  if (minute > 59) return null;
  return hour * 60 + minute;
}

export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'pm' : 'am';
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${String(m).padStart(2, '0')}${suffix}`;
}

export function formatRange(slot: ClassSlot): string {
  return `${formatClock(slot.startMinutes)} - ${formatClock(slot.endMinutes)}`;
}

/** Monday is 0, matching WEEKDAYS. */
export function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function todayName(date = new Date()): Weekday {
  return WEEKDAYS[weekdayIndex(date)];
}

export function minutesOfDay(date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export interface Occurrence {
  readonly slot: ClassSlot;
  /** Absolute time the class starts. */
  readonly start: Date;
  readonly end: Date;
}

/** Every class start in the next `days` days, in order. */
export function upcoming(classes: readonly ClassSlot[], from = new Date(), days = 7): Occurrence[] {
  const out: Occurrence[] = [];
  const base = weekdayIndex(from);
  const nowMinutes = minutesOfDay(from);

  for (let ahead = 0; ahead <= days; ahead++) {
    const dayName = WEEKDAYS[(base + ahead) % 7];
    const onDay = classes
      .filter((c) => c.day === dayName)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    for (const slot of onDay) {
      if (ahead === 0 && slot.startMinutes <= nowMinutes) continue;
      const start = new Date(from);
      start.setDate(start.getDate() + ahead);
      start.setHours(Math.floor(slot.startMinutes / 60), slot.startMinutes % 60, 0, 0);
      const end = new Date(start);
      end.setHours(Math.floor(slot.endMinutes / 60), slot.endMinutes % 60, 0, 0);
      out.push({ slot, start, end });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function runningNow(classes: readonly ClassSlot[], at = new Date()): ClassSlot | null {
  const day = todayName(at);
  const mins = minutesOfDay(at);
  return classes.find((c) => c.day === day && mins >= c.startMinutes && mins <= c.endMinutes) ?? null;
}

export function relativeTime(stamp: number | undefined, now = Date.now()): string {
  if (!stamp) return 'never';
  const seconds = Math.max(0, (now - stamp) / 1000);
  if (seconds < 90) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d ago`;
  return new Date(stamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function describeWhen(start: Date, now = new Date()): string {
  const sameDay = start.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (sameDay) return 'Today';
  if (start.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return WEEKDAYS[weekdayIndex(start)];
}

export function minutesUntil(start: Date, now = new Date()): number {
  return Math.round((start.getTime() - now.getTime()) / 60000);
}
