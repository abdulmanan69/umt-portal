import QRCode from 'qrcode';
import { el } from '../ui/dom';
import { button, card, sectionHead, toast } from '../ui/components';
import { store } from '../core/store';
import { relativeTime } from '../core/time';
import {
  describeNext, permissionState, requestPermission, scheduleReminders, sendTestNotification
} from '../core/notifications';
import {
  buildSyncLink, downloadSnapshot, extensionPresent, forSyncLink, listenForExtension, readSnapshotFile
} from '../core/sync';
import { WEEKDAYS, type Weekday } from '../core/types';
import { applyTheme } from '../app/theme';
import { navigate } from '../app/router';

type Refresh = () => void;

export function renderSettings(refresh: Refresh): HTMLElement {
  const view = el('div', { class: 'view' });
  view.appendChild(el('div', { class: 'eyebrow', text: 'Reminders' }));
  view.appendChild(notificationsCard(refresh));
  view.appendChild(el('div', { class: 'eyebrow', text: 'Your data' }));
  view.appendChild(dataCard(refresh));
  view.appendChild(el('div', { class: 'eyebrow', text: 'Send to another device' }));
  view.appendChild(syncCard());
  view.appendChild(el('div', { class: 'eyebrow', text: 'This device' }));
  view.appendChild(deviceCard(refresh));
  return view;
}

function setting(title: string, note: string, control: Node): HTMLElement {
  return el('div', { class: 'setting' }, [
    el('div', { class: 'setting-info' }, [el('b', { text: title }), el('small', { text: note })]),
    control
  ]);
}

function toggle(checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const input = el('input', { type: 'checkbox' }) as HTMLInputElement;
  input.checked = checked;
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'switch' }, [input, el('span', {})]);
}

function notificationsCard(refresh: Refresh): HTMLElement {
  const settings = store.settings;
  const permission = permissionState();
  const classes = store.snapshot?.schedule?.classes ?? [];

  const status =
    permission === 'unsupported' ? 'This browser does not offer notifications.'
    : permission === 'denied' ? 'Blocked in browser settings. Allow notifications for this site, then come back.'
    : permission === 'granted' ? describeNext(classes)
    : 'Not asked yet.';

  const enable = toggle(settings.notificationsEnabled && permission === 'granted', (value) => {
    if (!value) {
      store.saveSettings({ notificationsEnabled: false });
      scheduleReminders([]);
      refresh();
      return;
    }
    void requestPermission().then((result) => {
      if (result === 'granted') {
        store.saveSettings({ notificationsEnabled: true });
        const armed = scheduleReminders(classes);
        toast(armed ? `${armed} reminder${armed === 1 ? '' : 's'} armed.` : 'Reminders on. Nothing due in the next day.', 'good');
      } else {
        toast('Notifications were not allowed.', 'bad');
      }
      refresh();
    });
  });

  const lead = el('select', {}, [5, 10, 15, 20, 30, 45, 60].map((n) =>
    el('option', { value: String(n), text: `${n} minutes before`, selected: n === settings.leadMinutes ? 'selected' : null })
  )) as HTMLSelectElement;
  lead.addEventListener('change', () => {
    store.saveSettings({ leadMinutes: Number(lead.value) });
    scheduleReminders(classes);
    toast(`Reminders now arrive ${lead.value} minutes ahead.`, 'good');
    refresh();
  });

  const dayChips = el('div', { class: 'actions' }, WEEKDAYS.map((day) => {
    const muted = settings.mutedDays.includes(day);
    const node = button(day.slice(0, 3), {
      variant: muted ? 'ghost' : 'primary',
      onClick: () => {
        const next = muted
          ? settings.mutedDays.filter((d) => d !== day)
          : [...settings.mutedDays, day as Weekday];
        store.saveSettings({ mutedDays: next });
        scheduleReminders(classes);
        refresh();
      }
    });
    node.title = muted ? `${day} reminders are off` : `${day} reminders are on`;
    return node;
  }));

  return card([
    sectionHead('Class reminders', status, [
      button('Send a test', {
        iconName: 'bell',
        onClick: () => {
          void sendTestNotification().then((ok) => { if (!ok) toast('Turn reminders on first.', 'bad'); });
        }
      })
    ]),
    setting('Remind me before class', 'A notification for every class on your timetable.', enable),
    setting('How much warning', 'Enough time to walk across campus.', lead),
    el('div', { class: 'setting' }, [
      el('div', { class: 'setting-info' }, [
        el('b', { text: 'Days to remind me' }),
        el('small', { text: 'Amber means reminders are on for that day.' })
      ]),
      dayChips
    ]),
    el('p', {
      class: 'hint',
      text: 'While this app is open, reminders fire exactly on time. Install it to your home screen and Chrome can also wake it in the background; other browsers will only remind you while it is open.'
    })
  ]);
}

function dataCard(refresh: Refresh): HTMLElement {
  const snapshot = store.snapshot;
  const readAt = snapshot?.readAt ?? {};

  const pull = button('Pull from the extension', {
    variant: 'primary',
    iconName: 'refresh',
    onClick: () => {
      const stop = listenForExtension((incoming) => {
        stop();
        store.mergeSnapshot(incoming);
        toast('Record updated from the extension.', 'good');
        refresh();
      });
      void extensionPresent().then((present) => {
        if (!present) {
          stop();
          toast('No extension answered on this device.', 'bad');
        }
      });
    }
  });

  const picker = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none' }) as HTMLInputElement;
  picker.addEventListener('change', () => {
    const file = picker.files?.[0];
    if (!file) return;
    void readSnapshotFile(file).then((incoming) => {
      if (!incoming) {
        toast('That file was not a companion export.', 'bad');
        return;
      }
      store.mergeSnapshot(incoming);
      toast('Record loaded from the file.', 'good');
      refresh();
    });
  });

  const line = (label: string, note: string, stored: boolean) =>
    setting(label, note, el('span', { class: `pill ${stored ? 'good' : ''}`.trim(), text: stored ? 'stored' : 'empty' }));

  return card([
    sectionHead('What is stored here', 'Everything stays on this device. Nothing is uploaded.', [
      pull,
      button('Import a file', { iconName: 'upload', onClick: () => picker.click() }),
      button('Export', { iconName: 'download', onClick: () => { if (snapshot) downloadSnapshot(snapshot); } }),
      button('Paste or edit classes', { iconName: 'plus', onClick: () => navigate('/classes') })
    ]),
    picker,
    line('Timetable', snapshot?.schedule ? `${snapshot.schedule.classes.length} classes, read ${relativeTime(readAt.schedule)}` : 'Not loaded', Boolean(snapshot?.schedule)),
    line('Academic record', snapshot?.transcript ? `${snapshot.transcript.semesters.length} semesters, read ${relativeTime(readAt.transcript)}` : 'Not loaded', Boolean(snapshot?.transcript)),
    line('Payments', snapshot?.payments ? `${snapshot.payments.items.length} payments, read ${relativeTime(readAt.payments)}` : 'Not loaded', Boolean(snapshot?.payments))
  ]);
}

function syncCard(): HTMLElement {
  const snapshot = store.snapshot;
  const host = el('div', {});
  const includeRecords = el('input', { type: 'checkbox' }) as HTMLInputElement;

  const make = () => {
    if (!snapshot) {
      toast('Nothing to send yet.', 'bad');
      return;
    }
    void buildSyncLink(forSyncLink(snapshot, includeRecords.checked)).then(async (link) => {
      const canvas = el('canvas', {}) as HTMLCanvasElement;
      try {
        await QRCode.toCanvas(canvas, link, { width: 260, margin: 1, errorCorrectionLevel: 'L' });
      } catch {
        toast('Too much data for one QR code. Untick the full records and try again.', 'bad');
        return;
      }
      const field = el('input', { type: 'text', readonly: 'readonly', value: link }) as HTMLInputElement;
      host.replaceChildren(
        el('div', { class: 'qr' }, [canvas]),
        el('div', { class: 'linkbox', style: 'margin-top:14px' }, [
          field,
          button('Copy', {
            iconName: 'link',
            onClick: () => { void navigator.clipboard.writeText(link).then(() => toast('Link copied.', 'good')); }
          })
        ]),
        el('p', {
          class: 'hint',
          text: 'Scan this on your phone, then add the app to your home screen there. The data rides in the link fragment, which browsers never send to a server.'
        })
      );
    });
  };

  return card([
    sectionHead('Sync link and QR code', 'Move your timetable to a phone without a server in the middle.', [
      button('Make a link', { variant: 'primary', iconName: 'link', onClick: make })
    ]),
    el('div', { class: 'setting' }, [
      el('div', { class: 'setting-info' }, [
        el('b', { text: 'Include full records' }),
        el('small', { text: 'Transcript and payments as well as the timetable. Makes the QR denser.' })
      ]),
      el('label', { class: 'switch' }, [includeRecords, el('span', {})])
    ]),
    host
  ]);
}

function deviceCard(refresh: Refresh): HTMLElement {
  const settings = store.settings;
  const theme = el('div', { class: 'seg' }, (['dark', 'light'] as const).map((mode) => {
    const node = el('button', {
      type: 'button',
      text: mode === 'dark' ? 'Dark' : 'Light',
      'aria-pressed': String(settings.theme === mode)
    });
    node.addEventListener('click', () => {
      store.saveSettings({ theme: mode });
      applyTheme(mode);
      refresh();
    });
    return node;
  }));

  const passInput = el('input', {
    type: 'password',
    inputmode: 'numeric',
    placeholder: store.hasPasscode ? 'Set a new passcode' : 'Choose a passcode'
  }) as HTMLInputElement;

  return card([
    sectionHead('This device', 'Appearance, lock and stored data.'),
    setting('Theme', 'Dark keeps the screen quiet at night.', theme),
    el('div', { class: 'setting' }, [
      el('div', { class: 'setting-info' }, [
        el('b', { text: store.hasPasscode ? 'Change the passcode' : 'Lock with a passcode' }),
        el('small', { text: 'Asked once per session. It locks this device, it does not encrypt the data.' })
      ]),
      el('div', { class: 'actions' }, [
        passInput,
        button('Save', {
          onClick: () => {
            if (passInput.value.length < 4) {
              toast('Use at least four characters.', 'bad');
              return;
            }
            void store.setPasscode(passInput.value).then(() => {
              passInput.value = '';
              toast('Passcode saved.', 'good');
              refresh();
            });
          }
        }),
        store.hasPasscode
          ? button('Remove', {
              variant: 'danger',
              onClick: () => { void store.setPasscode(null).then(() => { toast('Passcode removed.'); refresh(); }); }
            })
          : null
      ])
    ]),
    setting('Erase everything', 'Removes the stored record, settings and passcode from this device.',
      button('Erase', {
        variant: 'danger',
        iconName: 'trash',
        onClick: () => {
          if (!confirm('Erase the stored record, settings and passcode from this device?')) return;
          store.clearEverything();
          location.hash = '/today';
          location.reload();
        }
      })
    )
  ]);
}
