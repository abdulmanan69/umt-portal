import { el } from '../ui/dom';
import { button, card, sectionHead, toast } from '../ui/components';
import { store } from '../core/store';
import { parsePastedSchedule } from '../core/parse';
import { formatClock, parseClock } from '../core/time';
import { WEEKDAYS, type ClassSlot, type Snapshot, type Weekday } from '../core/types';
import { scheduleReminders } from '../core/notifications';

const PORTAL_TIMETABLE = 'https://online.umt.edu.pk/Home/Index';

function saveSchedule(
  classes: ClassSlot[],
  courses = store.snapshot?.schedule?.courses ?? [],
  term = store.snapshot?.schedule?.term ?? ''
): void {
  const current = store.snapshot;
  const next: Snapshot = {
    version: 1,
    student: current?.student ?? null,
    schedule: { term, classes, courses },
    transcript: current?.transcript ?? null,
    payments: current?.payments ?? null,
    readAt: { ...current?.readAt, schedule: Date.now() },
    exportedAt: Date.now()
  };
  store.saveSnapshot(next);
  if (store.settings.notificationsEnabled) scheduleReminders(classes);
}

/** The paste panel, used both on the gate and inside the editor. */
export function pastePanel(onDone: () => void): HTMLElement {
  const area = el('textarea', {
    placeholder: 'Select the timetable on the portal, copy it, and paste here.',
    rows: '8'
  }) as HTMLTextAreaElement;
  const preview = el('div', {});

  const parseNow = () => {
    const result = parsePastedSchedule(area.value, store.snapshot?.schedule ?? null);
    const { classes, courses, term } = result.schedule;
    if (!classes.length) {
      preview.replaceChildren(el('p', { class: 'hint', text: result.warnings[0] ?? 'Nothing recognised yet.' }));
      return;
    }
    const byDay = WEEKDAYS
      .map((day) => ({ day, count: classes.filter((c) => c.day === day).length }))
      .filter((d) => d.count > 0);

    preview.replaceChildren(
      el('div', { class: 'stats', style: 'margin:16px 0' }, [
        figure('Classes', String(classes.length)),
        figure('Courses', String(courses.length)),
        figure('Term', term || '--')
      ]),
      el('div', { class: 'rows' }, classes.slice(0, 40).map((slot) => el('div', { class: 'row' }, [
        el('span', { class: 'when', text: `${slot.day.slice(0, 3)} ${formatClock(slot.startMinutes)}` }),
        el('span', { class: 'what' }, [
          el('b', { text: `${slot.code} - ${slot.name}` }),
          el('small', { text: slot.room ? `Room ${slot.room}` : 'No room listed' })
        ]),
        el('span', { class: 'amount', text: `${slot.endMinutes - slot.startMinutes} min` })
      ]))),
      el('p', { class: 'hint', text: byDay.map((d) => `${d.day.slice(0, 3)} ${d.count}`).join(' . ') }),
      ...(result.warnings.length ? [el('p', { class: 'hint', text: result.warnings.join(' ') })] : []),
      el('div', { class: 'actions', style: 'margin-top:14px' }, [
        button('Save this timetable', {
          variant: 'primary',
          iconName: 'check',
          onClick: () => {
            saveSchedule([...classes], [...courses], term);
            toast(`${classes.length} classes saved on this device.`, 'good');
            onDone();
          }
        })
      ])
    );
  };

  area.addEventListener('input', parseNow);
  area.addEventListener('paste', () => setTimeout(parseNow, 0));

  return el('div', {}, [
    el('ol', { class: 'steps' }, [
      el('li', {}, [
        'Open the portal dashboard: ',
        el('a', { href: PORTAL_TIMETABLE, target: '_blank', rel: 'noreferrer noopener', text: 'online.umt.edu.pk' })
      ]),
      el('li', { text: 'Open the Timetable panel, select the table, and copy it.' }),
      el('li', { text: 'Paste below. Registered Courses can go in the same box.' })
    ]),
    el('div', { class: 'field' }, [area]),
    preview
  ]);
}

function figure(label: string, value: string): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('div', { class: 'stat-body' }, [el('small', { text: label }), el('b', { text: value })])
  ]);
}

/** Add, change or remove classes by hand, for anyone who cannot copy from the portal. */
export function renderClassEditor(refresh: () => void): HTMLElement {
  const view = el('div', { class: 'view' });
  const classes = [...(store.snapshot?.schedule?.classes ?? [])];

  view.appendChild(el('div', { class: 'eyebrow', text: 'Paste from the portal' }));
  view.appendChild(card([
    sectionHead(
      'Copy your timetable across',
      'The portal sends X-Frame-Options: SAMEORIGIN, so no other site may embed it. Copying the table is the quickest way in.'
    ),
    pastePanel(refresh)
  ]));

  view.appendChild(el('div', { class: 'eyebrow', text: 'Classes on this device' }));
  view.appendChild(card([
    sectionHead(
      `${classes.length} class${classes.length === 1 ? '' : 'es'}`,
      'Fix anything that came across wrong, or add one the portal missed.'
    ),
    classes.length
      ? el('div', { class: 'rows' }, classes.map((slot, index) => el('div', { class: 'row' }, [
          el('span', { class: 'when', text: `${slot.day.slice(0, 3)} ${formatClock(slot.startMinutes)}` }),
          el('span', { class: 'what' }, [
            el('b', { text: `${slot.code} - ${slot.name}` }),
            el('small', { text: `${formatClock(slot.startMinutes)} to ${formatClock(slot.endMinutes)}${slot.room ? ` . ${slot.room}` : ''}` })
          ]),
          button('Remove', {
            variant: 'danger',
            iconName: 'trash',
            onClick: () => {
              saveSchedule(classes.filter((_, i) => i !== index));
              toast('Class removed.');
              refresh();
            }
          })
        ])))
      : el('p', { class: 'hint', text: 'Nothing stored yet.' })
  ]));

  view.appendChild(el('div', { class: 'eyebrow', text: 'Add a class' }));
  view.appendChild(card([addClassForm(refresh)]));
  return view;
}

function addClassForm(refresh: () => void): HTMLElement {
  const day = el('select', {}, WEEKDAYS.map((d) => el('option', { value: d, text: d }))) as HTMLSelectElement;
  const code = el('input', { type: 'text', placeholder: 'CY461' }) as HTMLInputElement;
  const name = el('input', { type: 'text', placeholder: 'Digital Forensics' }) as HTMLInputElement;
  const start = el('input', { type: 'time', value: '09:30' }) as HTMLInputElement;
  const end = el('input', { type: 'time', value: '10:45' }) as HTMLInputElement;
  const room = el('input', { type: 'text', placeholder: 'SST1-703B' }) as HTMLInputElement;

  const fromTimeInput = (value: string): number | null => {
    const m = /^(\d{2}):(\d{2})$/.exec(value);
    return m ? Number(m[1]) * 60 + Number(m[2]) : parseClock(value);
  };

  const form = el('form', { class: 'grid-form' }, [
    el('div', { class: 'field' }, [el('label', { text: 'Day' }), day]),
    el('div', { class: 'field' }, [el('label', { text: 'Course code' }), code]),
    el('div', { class: 'field' }, [el('label', { text: 'Course name' }), name]),
    el('div', { class: 'field' }, [el('label', { text: 'Starts' }), start]),
    el('div', { class: 'field' }, [el('label', { text: 'Ends' }), end]),
    el('div', { class: 'field' }, [el('label', { text: 'Room' }), room]),
    el('div', { class: 'actions' }, [button('Add class', { variant: 'primary', iconName: 'plus', type: 'submit' })])
  ]);

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const startMinutes = fromTimeInput(start.value);
    const endMinutes = fromTimeInput(end.value);
    if (!code.value.trim() || startMinutes === null || endMinutes === null) {
      toast('A course code and both times are needed.', 'bad');
      return;
    }
    if (endMinutes <= startMinutes) {
      toast('The end time has to come after the start.', 'bad');
      return;
    }
    const slot: ClassSlot = {
      day: day.value as Weekday,
      code: code.value.trim().toUpperCase(),
      name: name.value.trim() || code.value.trim().toUpperCase(),
      startMinutes,
      endMinutes,
      room: room.value.trim(),
      faculty: '',
      type: '',
      mode: ''
    };
    saveSchedule([...(store.snapshot?.schedule?.classes ?? []), slot]);
    toast(`${slot.code} added.`, 'good');
    code.value = '';
    name.value = '';
    room.value = '';
    refresh();
  });

  return form;
}
