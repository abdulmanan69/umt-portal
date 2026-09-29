import { el } from '../ui/dom';
import { button, icon, toast } from '../ui/components';
import { store } from '../core/store';
import { extensionPresent, listenForExtension, readSnapshotFile, readSyncLink } from '../core/sync';
import type { Snapshot } from '../core/types';
import { pastePanel } from './paste';

type Done = () => void;

/**
 * There is no portal login here on purpose: the portal does not allow a browser
 * on another origin to sign in on your behalf. Data arrives from the extension,
 * a sync link, or a file, and a passcode locks this device.
 */
export function renderGate(onDone: Done): HTMLElement {
  const body = el('div', { class: 'choice' });
  const root = el('div', { class: 'gate' }, [
    el('div', { class: 'gate-card' }, [
      el('div', { class: 'brand' }, [
        el('span', { class: 'brand-mark', text: 'U' }),
        el('div', {}, [el('b', { text: 'UMT Companion' }), el('small', { text: 'timetable . reminders . record' })])
      ]),
      el('h1', { text: store.hasPasscode && store.hasData ? 'Welcome back' : 'Bring in your record' }),
      el('p', {
        text: store.hasPasscode && store.hasData
          ? 'Enter your passcode to unlock this device.'
          : 'The UMT portal will not let another website sign in for you, so your data comes across from the extension, a sync link, or a file. It then lives on this device only.'
      }),
      body
    ])
  ]);

  if (store.hasPasscode && store.hasData && !store.isUnlocked) renderUnlock(body, onDone);
  else renderSources(body, onDone);
  return root;
}

function renderUnlock(host: HTMLElement, onDone: Done): void {
  const input = el('input', { type: 'password', inputmode: 'numeric', autocomplete: 'current-password', placeholder: 'Passcode' });
  const form = el('form', { class: 'field' }, [
    el('label', { text: 'Passcode', for: 'passcode' }),
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
  host.replaceChildren(form, el('p', {
    class: 'hint',
    text: 'Forgot it? Clearing site data removes the passcode and the stored record together.'
  }));
  setTimeout(() => input.focus(), 50);
}

function sourceButton(iconName: string, title: string, note: string, onClick: () => void): HTMLElement {
  const node = el('button', { type: 'button' }, [
    el('span', { class: 'ico-box' }, [icon(iconName, 17)]),
    el('span', {}, [el('b', { text: title }), el('small', { text: note })]),
    icon('plus', 15)
  ]);
  node.addEventListener('click', onClick);
  return node;
}

function renderSources(host: HTMLElement, onDone: Done): void {
  const accept = (snapshot: Snapshot, how: string) => {
    store.mergeSnapshot(snapshot);
    toast(`Record loaded from ${how}.`, 'good');
    onDone();
  };

  const fromExtension = sourceButton(
    'link',
    'Connect the browser extension',
    'Fastest on a computer where you already use the portal',
    () => {
      const stop = listenForExtension((snapshot) => {
        stop();
        accept(snapshot, 'the extension');
      });
      void extensionPresent().then((present) => {
        if (!present) {
          stop();
          toast('No extension answered. Install it, open the portal once, then try again.', 'bad');
        }
      });
    }
  );

  const fromLink = sourceButton('upload', 'Paste a sync link', 'Made on your computer under Settings, for moving to a phone', () => {
    const area = el('textarea', { placeholder: 'https://.../#s=...' });
    const panel = el('div', { class: 'field' }, [
      el('label', { text: 'Sync link' }),
      area,
      button('Load it', {
        variant: 'primary',
        onClick: () => {
          void readSyncLink(area.value).then((snapshot) => {
            if (snapshot) accept(snapshot, 'the sync link');
            else toast('That link did not contain a readable record.', 'bad');
          });
        }
      })
    ]);
    host.replaceChildren(panel, backLink(host, onDone));
    area.focus();
  });

  const fromFile = sourceButton('download', 'Open an exported file', 'The .json this app or the extension saved', () => {
    const picker = el('input', { type: 'file', accept: 'application/json,.json' });
    picker.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (!file) return;
      void readSnapshotFile(file).then((snapshot) => {
        if (snapshot) accept(snapshot, 'the file');
        else toast('That file was not a companion export.', 'bad');
      });
    });
    picker.click();
  });

  const fromPortal = sourceButton('upload', 'Paste from the portal', 'Works on a phone with no extension: copy the timetable, paste it here', () => {
    host.replaceChildren(
      el('h2', { style: 'font:600 16px/1.3 var(--display);margin-bottom:6px', text: 'Copy your timetable across' }),
      el('p', { class: 'hint', style: 'margin-top:0', text: 'The portal refuses to be embedded by other sites, so this is the way in without an extension.' }),
      pastePanel(onDone),
      backLink(host, onDone)
    );
  });

  const items: HTMLElement[] = [fromPortal, fromExtension, fromLink, fromFile];
  if (store.hasData) {
    items.push(sourceButton('check', 'Continue with what is stored', 'Use the record already on this device', onDone));
  }
  host.replaceChildren(...items);
}

function backLink(host: HTMLElement, onDone: Done): HTMLElement {
  return el('p', { class: 'hint' }, [
    el('a', {
      href: '#',
      text: 'Back to the other ways in',
      onclick: (event: Event) => {
        event.preventDefault();
        renderSources(host, onDone);
      }
    })
  ]);
}
