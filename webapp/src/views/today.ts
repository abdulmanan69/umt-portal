import { el } from '../ui/dom';
import { button, card, empty, icon, sectionHead, stat } from '../ui/components';
import { store } from '../core/store';
import { describeWhen, formatClock, minutesUntil, relativeTime, runningNow, upcoming } from '../core/time';
import { permissionState } from '../core/notifications';
import { dayStrip, nextUpLine, summarise } from './schedule';
import { navigate } from '../app/router';

function countdownText(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function renderToday(): HTMLElement {
  const snapshot = store.snapshot;
  const schedule = snapshot?.schedule;
  const view = el('div', { class: 'view' });

  if (!schedule || !schedule.classes.length) {
    view.appendChild(empty(
      'No timetable yet',
      'Bring your record across from the extension or a sync link, and this screen fills in.',
      button('Go to settings', { variant: 'primary', onClick: () => navigate('/settings') })
    ));
    return view;
  }

  const now = new Date();
  const next = upcoming(schedule.classes, now, 7)[0] ?? null;
  const live = runningNow(schedule.classes, now);
  const totals = summarise(schedule);
  const student = snapshot?.student;

  const heroRight = next
    ? el('div', { class: 'countdown' }, [
        el('small', { text: live ? 'In class now' : 'Next class in' }),
        el('b', { text: live ? formatClock(live.endMinutes) : countdownText(minutesUntil(next.start, now)) }),
        el('span', { text: live ? `${live.code} runs until then` : `${next.slot.code} . ${nextUpLine(next.slot, describeWhen(next.start, now))}` })
      ])
    : el('div', { class: 'countdown' }, [
        el('small', { text: 'Next class' }),
        el('b', { text: '--' }),
        el('span', { text: 'Nothing left this week' })
      ]);

  view.appendChild(el('section', { class: 'hero' }, [
    el('div', {}, [
      el('div', { class: 'hero-eyebrow' }, [icon('calendar', 12), greeting()]),
      el('h1', { text: student?.name ? firstName(student.name) : 'Your week' }),
      el('p', { text: student?.degree ? `${student.degree}${schedule.term ? ` . ${schedule.term}` : ''}` : schedule.term || 'This semester' }),
      el('div', { class: 'meta' }, [
        student?.id ? el('span', { class: 'pill', text: student.id }) : null,
        el('span', { class: 'pill', text: `${totals.classes} classes a week` }),
        el('span', { class: 'pill', text: `${totals.hours} contact hours` }),
        el('span', { class: 'pill', text: `${totals.credits} credit hours` })
      ]),
      el('div', { class: 'actions', style: 'margin-top:18px' }, [
        button('See the week', { variant: 'primary', iconName: 'calendar', onClick: () => navigate('/week') }),
        permissionState() === 'granted' && store.settings.notificationsEnabled
          ? null
          : button('Turn on reminders', { iconName: 'bell', onClick: () => navigate('/settings') })
      ])
    ]),
    heroRight
  ]));

  view.appendChild(el('div', { class: 'eyebrow', text: 'Today' }));
  view.appendChild(dayStrip(schedule, now));

  const ahead = upcoming(schedule.classes, now, 7).slice(0, 5);
  if (ahead.length) {
    view.appendChild(el('div', { class: 'eyebrow', text: 'Coming up' }));
    view.appendChild(card([
      sectionHead('Next five classes', 'Across the rest of this week.'),
      el('div', { class: 'rows' }, ahead.map((occurrence) => el('div', { class: 'row' }, [
        el('span', { class: 'when', text: `${describeWhen(occurrence.start, now)} ${formatClock(occurrence.slot.startMinutes)}` }),
        el('span', { class: 'what' }, [
          el('b', { text: `${occurrence.slot.code} - ${occurrence.slot.name}` }),
          el('small', { text: occurrence.slot.room ? `Room ${occurrence.slot.room}` : 'Room to be announced' })
        ]),
        el('span', { class: 'amount', text: countdownText(minutesUntil(occurrence.start, now)) })
      ])))
    ]));
  }

  view.appendChild(el('div', { class: 'eyebrow', text: 'At a glance' }));
  view.appendChild(el('div', { class: 'stats' }, [
    stat('Classes a week', String(totals.classes), `${totals.days} days on campus`, 'calendar'),
    stat('Contact hours', `${totals.hours}`, 'scheduled teaching', 'clock'),
    stat('Credit hours', String(totals.credits), `${schedule.courses.length} courses`, 'graduation'),
    stat('Timetable read', relativeTime(snapshot?.readAt?.schedule), schedule.term || 'current term', 'refresh')
  ]));

  return view;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function firstName(full: string): string {
  const first = full.trim().split(/\s+/)[0] ?? full;
  return first.charAt(0) + first.slice(1).toLowerCase();
}
