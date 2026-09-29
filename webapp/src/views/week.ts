import { el } from '../ui/dom';
import { button, card, empty, sectionHead, stat } from '../ui/components';
import { store } from '../core/store';
import { relativeTime } from '../core/time';
import { courseCards, summarise, weekBoard } from './schedule';
import { navigate } from '../app/router';

export function renderWeek(): HTMLElement {
  const snapshot = store.snapshot;
  const schedule = snapshot?.schedule;
  const view = el('div', { class: 'view' });

  if (!schedule || !schedule.classes.length) {
    view.appendChild(empty(
      'No timetable stored',
      'Load your record once and the whole week appears here, offline.',
      button('Go to settings', { variant: 'primary', onClick: () => navigate('/settings') })
    ));
    return view;
  }

  const totals = summarise(schedule);
  view.appendChild(el('div', { class: 'stats' }, [
    stat('Classes', String(totals.classes), 'every week', 'calendar'),
    stat('Contact hours', `${totals.hours}`, 'teaching time', 'clock'),
    stat('Days on campus', String(totals.days), 'of seven', 'pin'),
    stat('Credit hours', String(totals.credits), `${schedule.courses.length} courses`, 'graduation')
  ]));

  view.appendChild(el('div', { class: 'eyebrow', text: schedule.term ? `Week . ${schedule.term}` : 'Week' }));
  view.appendChild(weekBoard(schedule));

  if (schedule.courses.length) {
    view.appendChild(el('div', { class: 'eyebrow', text: 'Registered courses' }));
    view.appendChild(courseCards(schedule));
  }

  view.appendChild(el('p', {
    class: 'hint',
    text: `Timetable read ${relativeTime(snapshot?.readAt?.schedule)}. Refresh it from the extension when your registration changes.`
  }));
  return view;
}

export function renderRecord(): HTMLElement {
  const snapshot = store.snapshot;
  const transcript = snapshot?.transcript;
  const view = el('div', { class: 'view' });

  if (!transcript || !transcript.semesters.length) {
    view.appendChild(empty(
      'No academic record stored',
      'Include your full records when you sync, and your semesters, grades and CGPA land here.',
      button('Go to settings', { variant: 'primary', onClick: () => navigate('/settings') })
    ));
    return view;
  }

  const totals = transcript.totals;
  view.appendChild(el('div', { class: 'stats' }, [
    stat('CGPA', totals.cgpa.toFixed(2), 'out of 4.00', 'graduation'),
    stat('Credit hours', String(totals.creditsEarned), 'earned', 'check'),
    stat('Grade points', totals.gradePoints.toFixed(2), 'quality points', 'grid'),
    stat('Semesters', String(transcript.semesters.length), 'on record', 'calendar')
  ]));

  [...transcript.semesters].reverse().forEach((semester) => {
    view.appendChild(el('div', { class: 'eyebrow', text: semester.term }));
    view.appendChild(card([
      sectionHead(
        semester.term,
        `${semester.creditsEarned} credit hours` +
          (semester.sgpa ? `, SGPA ${semester.sgpa.toFixed(2)}` : '') +
          (semester.cgpa ? `, CGPA ${semester.cgpa.toFixed(2)}` : '')
      ),
      el('div', { class: 'rows' }, semester.courses.map((course) => el('div', { class: 'row' }, [
        el('span', { class: 'when', text: course.code }),
        el('span', { class: 'what' }, [
          el('b', { text: course.title }),
          el('small', { text: `${course.creditHours} credit hours` })
        ]),
        el('span', { class: `gchip g-${bandOf(course.grade)}`, text: course.grade || '--' })
      ])))
    ]));
  });
  return view;
}

function bandOf(grade: string): string {
  const g = (grade || '').trim().toUpperCase();
  if (!g || ['SA', 'P', 'NA', 'I', 'W'].includes(g)) return 'x';
  if (g.startsWith('A')) return 'a';
  if (g.startsWith('B')) return 'b';
  if (g.startsWith('C')) return 'c';
  return 'f';
}

export function renderFees(): HTMLElement {
  const snapshot = store.snapshot;
  const payments = snapshot?.payments;
  const view = el('div', { class: 'view' });

  if (!payments || !payments.items.length) {
    view.appendChild(empty(
      'No payment history stored',
      'Include your full records when you sync to see every challan here.',
      button('Go to settings', { variant: 'primary', onClick: () => navigate('/settings') })
    ));
    return view;
  }

  const items = [...payments.items].sort((a, b) => b.at - a.at);
  const total = items.reduce((n, i) => n + i.amount, 0);
  const money = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;
  const thisYear = String(new Date().getFullYear());
  const yearTotal = items.filter((i) => i.date.endsWith(thisYear)).reduce((n, i) => n + i.amount, 0);

  view.appendChild(el('div', { class: 'stats' }, [
    stat('Total paid', money(total), `${items.length} payments`, 'wallet'),
    stat('Last payment', money(items[0].amount), items[0].date, 'clock'),
    stat('This year', money(yearTotal), thisYear, 'calendar')
  ]));

  view.appendChild(el('div', { class: 'eyebrow', text: 'Every payment' }));
  view.appendChild(card([
    el('div', { class: 'rows' }, items.map((item) => el('div', { class: 'row' }, [
      el('span', { class: 'when', text: item.date }),
      el('span', { class: 'what' }, [
        el('b', { text: item.account }),
        el('small', { text: `Challan ${item.challan}${item.bank ? ` | ${item.bank}` : ''}` })
      ]),
      el('span', { class: 'amount', text: money(item.amount) })
    ])))
  ]));
  return view;
}
