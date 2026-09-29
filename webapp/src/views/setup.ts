import { el } from '../ui/dom';
import { button, icon, toast } from '../ui/components';
import { store } from '../core/store';
import { parsePastedSchedule } from '../core/parse';
import { permissionState, requestPermission, scheduleReminders, sendTestNotification } from '../core/notifications';
import { extensionPresent, listenForExtension, readSnapshotFile, readSyncLink } from '../core/sync';
import type { Snapshot } from '../core/types';
import { SAMPLE } from './sample';

type Done = () => void;

const PORTAL = 'https://online.umt.edu.pk/Home/Index';

let installPrompt: { prompt(): Promise<void> } | null = null;
window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPrompt = event as unknown as { prompt(): Promise<void> };
});

export function renderSetup(onDone: Done): HTMLElement {
  const body = el('div', {});
  const dots = el('div', { class: 'dots' });
  const root = el('div', { class: 'gate' }, [
    el('div', { class: 'gate-card' }, [
      el('div', { class: 'brand' }, [
        el('span', { class: 'brand-mark', text: 'U' }),
        el('div', {}, [el('b', { text: 'UMT Companion' }), el('small', { text: 'timetable . reminders . record' })])
      ]),
      dots,
      body
    ])
  ]);

  const paint = (step: 1 | 2 | 3) => {
    dots.replaceChildren(...[1, 2, 3].map((n) => el('i', { class: n === step ? 'on' : n < step ? 'done' : '' })));
    if (step === 1) stepTimetable(body, () => paint(2), onDone);
    if (step === 2) stepReminders(body, () => paint(3));
    if (step === 3) stepInstall(body, onDone);
  };

  if (store.hasPasscode && store.hasData && !store.isUnlocked) {
    dots.remove();
    lockScreen(body, onDone);
  } else if (store.hasData) {
    paint(2);
  } else {
    paint(1);
  }
  return root;
}

function heading(title: string, note: string): HTMLElement[] {
  return [el('h1', { text: title }), el('p', { class: 'lede', text: note })];
}

/* ---- step one: the timetable --------------------------------------------- */
function stepTimetable(host: HTMLElement, next: Done, onDone: Done): void {
  const area = el('textarea', { rows: '5', placeholder: 'Or paste the copied table here' }) as HTMLTextAreaElement;
  const result = el('div', {});

  const accept = (text: string, how: string) => {
    const parsed = parsePastedSchedule(text, store.snapshot?.schedule ?? null);
    if (!parsed.schedule.classes.length) {
      toast(parsed.warnings[0] ?? 'Nothing recognised in that.', 'bad');
      return;
    }
    const current = store.snapshot;
    store.saveSnapshot({
      version: 1,
      student: current?.student ?? null,
      schedule: parsed.schedule,
      transcript: current?.transcript ?? null,
      payments: current?.payments ?? null,
      readAt: { ...current?.readAt, schedule: Date.now() },
      exportedAt: Date.now()
    });
    toast(`${parsed.schedule.classes.length} classes saved from ${how}.`, 'good');
    next();
  };

  area.addEventListener('input', () => {
    const parsed = parsePastedSchedule(area.value, store.snapshot?.schedule ?? null);
    result.replaceChildren(
      parsed.schedule.classes.length
        ? el('div', { class: 'ready' }, [
            icon('check', 15),
            el('span', { text: `${parsed.schedule.classes.length} classes found${parsed.schedule.term ? `, ${parsed.schedule.term}` : ''}` }),
            button('Use these', { variant: 'primary', onClick: () => accept(area.value, 'your paste') })
          ])
        : el('p', { class: 'hint', text: area.value.trim() ? 'Not recognised yet. Copy the whole table, headings included.' : '' })
    );
  });

  host.replaceChildren(
    ...heading('Get your timetable in', 'One copy from the portal is all it takes. Nothing is uploaded anywhere.'),
    el('ol', { class: 'steps' }, [
      el('li', {}, ['Open ', el('a', { href: PORTAL, target: '_blank', rel: 'noreferrer noopener', text: 'the portal dashboard' }), ', open the Timetable panel']),
      el('li', { text: 'Select the table and copy it' }),
      el('li', { text: 'Come back and press the button below' })
    ]),
    el('div', { class: 'actions stack' }, [
      button('Paste from clipboard', {
        variant: 'primary',
        iconName: 'upload',
        onClick: () => {
          navigator.clipboard.readText()
            .then((text) => {
              if (!text.trim()) return toast('The clipboard is empty.', 'bad');
              accept(text, 'your clipboard');
            })
            .catch(() => toast('This browser would not share the clipboard. Paste into the box instead.', 'bad'));
        }
      })
    ]),
    el('div', { class: 'field' }, [area]),
    result,
    el('details', { class: 'more' }, [
      el('summary', { text: 'Other ways in' }),
      el('div', { class: 'actions stack' }, [
        button('Try a sample timetable', { iconName: 'calendar', onClick: () => { applySample(); next(); } }),
        button('Pull from the browser extension', {
          iconName: 'link',
          onClick: () => {
            const stop = listenForExtension((snapshot: Snapshot) => { stop(); store.mergeSnapshot(snapshot); toast('Record loaded from the extension.', 'good'); next(); });
            void extensionPresent().then((there) => { if (!there) { stop(); toast('No extension answered on this device.', 'bad'); } });
          }
        }),
        button('Open a sync link', {
          iconName: 'link',
          onClick: () => {
            const value = prompt('Paste the sync link');
            if (!value) return;
            void readSyncLink(value).then((snapshot) => {
              if (!snapshot) return toast('That link held no readable record.', 'bad');
              store.mergeSnapshot(snapshot);
              next();
            });
          }
        }),
        button('Open an exported file', {
          iconName: 'download',
          onClick: () => {
            const picker = el('input', { type: 'file', accept: 'application/json,.json' }) as HTMLInputElement;
            picker.addEventListener('change', () => {
              const file = picker.files?.[0];
              if (!file) return;
              void readSnapshotFile(file).then((snapshot) => {
                if (!snapshot) return toast('That was not a companion export.', 'bad');
                store.mergeSnapshot(snapshot);
                next();
              });
            });
            picker.click();
          }
        }),
        store.hasData ? button('Skip, use what is stored', { onClick: onDone }) : null
      ].filter(Boolean) as HTMLElement[])
    ])
  );
}

function applySample(): void {
  store.saveSnapshot(SAMPLE);
  toast('Sample timetable loaded. Replace it whenever you like.', 'good');
}

/* ---- step two: reminders -------------------------------------------------- */
function stepReminders(host: HTMLElement, next: Done): void {
  const classes = store.snapshot?.schedule?.classes ?? [];
  const state = permissionState();

  const lead = el('select', {}, [5, 10, 15, 20, 30, 45].map((n) =>
    el('option', { value: String(n), text: `${n} minutes before`, selected: n === store.settings.leadMinutes ? 'selected' : null })
  )) as HTMLSelectElement;
  lead.addEventListener('change', () => store.saveSettings({ leadMinutes: Number(lead.value) }));

  const turnOn = button('Allow reminders', {
    variant: 'primary',
    iconName: 'bell',
    onClick: () => {
      void requestPermission().then((result) => {
        if (result !== 'granted') {
          toast('Notifications were not allowed. You can turn them on later in Settings.', 'bad');
          return;
        }
        store.saveSettings({ notificationsEnabled: true });
        const armed = scheduleReminders(classes);
        void sendTestNotification(classes);
        toast(armed ? `${armed} reminder${armed === 1 ? '' : 's'} armed for the next day.` : 'Reminders on.', 'good');
        next();
      });
    }
  });

  const already = button('Already allowed, continue', {
    variant: 'primary',
    iconName: 'check',
    onClick: () => {
      store.saveSettings({ notificationsEnabled: true });
      scheduleReminders(classes);
      next();
    }
  });

  host.replaceChildren(
    ...heading('Never walk in late', 'A notification before every class, with the room and how long you have.'),
    el('div', { class: 'preview-card' }, [
      el('span', { class: 'preview-eyebrow', text: 'What arrives' }),
      el('b', { text: classes[0] ? `${classes[0].code}  .  ${classes[0].name}` : 'CY461  .  Digital Forensics' }),
      el('small', { text: 'In 15 min, at 3:30pm  .  Room SST1-703B  .  2nd of 3 today' }),
      el('div', { class: 'preview-actions' }, [
        el('span', { text: 'Open timetable' }),
        el('span', { text: 'Remind in 5 min' })
      ])
    ]),
    el('div', { class: 'field' }, [el('label', { text: 'How much warning' }), lead]),
    el('div', { class: 'actions stack' }, [
      state === 'granted' ? already : turnOn,
      button('Not now', { onClick: next })
    ]),
    el('p', {
      class: 'hint',
      text: state === 'denied'
        ? 'Your browser is blocking notifications for this site. Allow them in site settings, then reopen this app.'
        : 'Reminders are exact while the app is open. Installed on Android, they also arrive when it is closed.'
    })
  );
}

/* ---- step three: install -------------------------------------------------- */
function stepInstall(host: HTMLElement, onDone: Done): void {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  const how = standalone
    ? 'This is already running as an installed app. You are set.'
    : isIOS
      ? 'Tap the Share button, then Add to Home Screen.'
      : isAndroid
        ? 'Tap the browser menu, then Install app.'
        : 'Use the install icon in the address bar, or the browser menu.';

  const actions: HTMLElement[] = [];
  if (installPrompt && !standalone) {
    actions.push(button('Install now', {
      variant: 'primary',
      iconName: 'download',
      onClick: () => { void installPrompt?.prompt().then(() => onDone()); }
    }));
  }
  actions.push(button(standalone ? 'Start using it' : 'Continue in the browser', {
    variant: standalone || !installPrompt ? 'primary' : 'ghost',
    iconName: 'check',
    onClick: onDone
  }));

  host.replaceChildren(
    ...heading('Put it on your home screen', 'Installed, it opens like an app, works with no signal, and can remind you in the background.'),
    el('div', { class: 'preview-card plain' }, [
      el('b', { text: standalone ? 'Installed' : 'How to install here' }),
      el('small', { text: how })
    ]),
    el('div', { class: 'actions stack' }, actions)
  );
}

/* ---- the lock, when a passcode is set ------------------------------------- */
function lockScreen(host: HTMLElement, onDone: Done): void {
  const input = el('input', {
    type: 'password', inputmode: 'numeric', autocomplete: 'current-password', placeholder: 'Passcode'
  }) as HTMLInputElement;
  const form = el('form', { class: 'field' }, [
    el('label', { text: 'Passcode' }),
    input,
    button('Unlock', { variant: 'primary', iconName: 'lock', type: 'submit' })
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    void store.unlock(input.value).then((ok) => {
      if (ok) onDone();
      else {
        toast('That passcode did not match.', 'bad');
        input.value = '';
        input.focus();
      }
    });
  });
  host.replaceChildren(
    ...heading('Welcome back', 'Enter your passcode to unlock this device.'),
    form,
    el('p', { class: 'hint', text: 'Forgot it? Clearing site data removes the passcode and the stored record together.' })
  );
  setTimeout(() => input.focus(), 50);
}
