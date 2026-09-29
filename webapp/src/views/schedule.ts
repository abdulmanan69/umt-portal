import { el } from '../ui/dom';
import { icon, pill } from '../ui/components';
import { formatClock, formatRange, minutesOfDay, todayName } from '../core/time';
import { WEEKDAYS, type ClassSlot, type Schedule } from '../core/types';

const TINTS = ['#F59B1C', '#4CC9F0', '#34D399', '#A78BFA', '#FB7185', '#38BDF8', '#FBBF24'];

export function courseTint(code: string): string {
  let n = 0;
  for (let i = 0; i < code.length; i++) n = (n * 31 + code.charCodeAt(i)) % 9973;
  return TINTS[n % TINTS.length];
}

export function classCard(slot: ClassSlot, now = new Date()): HTMLElement {
  const today = todayName(now);
  const minutes = minutesOfDay(now);
  const running = slot.day === today && minutes >= slot.startMinutes && minutes <= slot.endMinutes;
  const finished = slot.day === today && minutes > slot.endMinutes;

  const meta: HTMLElement[] = [];
  if (slot.room) meta.push(el('span', { class: 'pill' }, [icon('pin', 11), slot.room]));
  if (slot.type) meta.push(pill(slot.type));
  if (slot.mode) meta.push(pill(slot.mode));
  if (slot.faculty) meta.push(pill(slot.faculty));

  const card = el('article', {
    class: 'klass',
    style: `--course:${courseTint(slot.code)}`,
    title: `${slot.code} ${slot.name}`
  }, [
    el('time', { text: formatRange(slot) }),
    el('b', {}, [el('span', { text: slot.code }), slot.name]),
    meta.length ? el('div', { class: 'meta' }, meta) : null
  ]);
  if (running) card.setAttribute('data-now', '1');
  if (finished) card.setAttribute('data-past', '1');
  return card;
}

export function weekBoard(schedule: Schedule, now = new Date()): HTMLElement {
  const today = todayName(now);
  const daysWithClasses = WEEKDAYS.filter((day) => schedule.classes.some((c) => c.day === day));
  const days = daysWithClasses.length ? daysWithClasses : WEEKDAYS.slice(0, 5);

  return el('div', { class: 'week' }, days.map((day) => {
    const list = schedule.classes
      .filter((c) => c.day === day)
      .sort((a, b) => a.startMinutes - b.startMinutes);
    const minutes = list.reduce((n, c) => n + (c.endMinutes - c.startMinutes), 0);

    const box = el('section', { class: 'day' }, [
      el('header', { class: 'day-head' }, [
        el('b', { text: day.slice(0, 3) }),
        el('small', { text: list.length ? `${list.length} | ${Math.round(minutes / 6) / 10}h` : 'free' })
      ]),
      list.length
        ? el('div', { class: 'day-body' }, list.map((slot) => classCard(slot, now)))
        : el('p', { class: 'day-free', text: 'No classes' })
    ]);
    if (day === today) box.setAttribute('data-today', '1');
    return box;
  }));
}

export function courseCards(schedule: Schedule): HTMLElement {
  return el('div', { class: 'week' }, schedule.courses.map((course) => {
    const perWeek = schedule.classes.filter((c) => c.code === course.code).length;
    const meta: HTMLElement[] = [];
    if (course.creditHours) meta.push(pill(`${course.creditHours} cr`));
    if (course.type) meta.push(pill(course.type.replace(/ Course$/, '')));
    if (course.section) meta.push(pill(`Section ${course.section}`));
    if (perWeek) meta.push(pill(`${perWeek} / week`));
    return el('article', { class: 'klass', style: `--course:${courseTint(course.code)}` }, [
      el('b', {}, [el('span', { text: course.code }), course.title]),
      el('div', { class: 'meta' }, meta)
    ]);
  }));
}

export function dayStrip(schedule: Schedule, now = new Date()): HTMLElement {
  const today = todayName(now);
  const list = schedule.classes
    .filter((c) => c.day === today)
    .sort((a, b) => a.startMinutes - b.startMinutes);
  if (!list.length) {
    return el('div', { class: 'empty' }, [
      el('h3', { text: `Nothing scheduled for ${today}` }),
      el('p', { text: 'Enjoy it. The week view shows when your next class lands.' })
    ]);
  }
  return el('div', { class: 'week' }, list.map((slot) => classCard(slot, now)));
}

export function summarise(schedule: Schedule): { classes: number; hours: number; credits: number; days: number } {
  const minutes = schedule.classes.reduce((n, c) => n + (c.endMinutes - c.startMinutes), 0);
  const credits = schedule.courses.reduce((n, c) => n + (c.creditHours || 0), 0);
  const days = new Set(schedule.classes.map((c) => c.day)).size;
  return { classes: schedule.classes.length, hours: Math.round(minutes / 6) / 10, credits, days };
}

export function nextUpLine(slot: ClassSlot, when: string): string {
  return `${when} at ${formatClock(slot.startMinutes)}${slot.room ? ` in ${slot.room}` : ''}`;
}
