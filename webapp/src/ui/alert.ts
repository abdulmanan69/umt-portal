import { el } from './dom';
import { icon } from './components';
import { formatClock } from '../core/time';
import { courseTint } from '../core/banner';
import type { ClassSlot } from '../core/types';

/**
 * An OS notification is drawn by the operating system, so a web app cannot
 * animate it. This is the part that can be animated: when a reminder fires
 * while the app is on screen, it arrives as a card with a draining ring.
 */

export function showClassAlert(slot: ClassSlot, start: Date): void {
  document.querySelector('.class-alert')?.remove();

  const total = Math.max(1, Math.round((start.getTime() - Date.now()) / 60000));
  const tint = courseTint(slot.code);

  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ring.setAttribute('viewBox', '0 0 72 72');
  ring.setAttribute('class', 'alert-ring');
  ring.innerHTML = `
    <circle cx="36" cy="36" r="30" class="track" fill="none" stroke-width="6" />
    <circle cx="36" cy="36" r="30" class="fill" fill="none" stroke-width="6"
      stroke-linecap="round" stroke="${tint}" />`;

  const counter = el('b', { class: 'alert-count', text: String(total) });

  const card = el('div', { class: 'class-alert', role: 'alert', style: `--course:${tint}` }, [
    el('div', { class: 'alert-dial' }, [ring, counter, el('small', { text: 'min' })]),
    el('div', { class: 'alert-body' }, [
      el('span', { class: 'alert-eyebrow', text: 'Class starting soon' }),
      el('b', { text: `${slot.code}  .  ${slot.name}` }),
      el('small', {
        text: `${formatClock(slot.startMinutes)} to ${formatClock(slot.endMinutes)}${slot.room ? `  .  ${slot.room}` : ''}`
      })
    ]),
    (() => {
      const close = el('button', { class: 'alert-close', type: 'button', 'aria-label': 'Dismiss' }, [icon('check', 16)]);
      close.addEventListener('click', () => dismiss(card));
      return close;
    })()
  ]);

  document.body.appendChild(card);
  requestAnimationFrame(() => card.setAttribute('data-open', '1'));

  /* keep the dial honest while the card is up */
  const tick = window.setInterval(() => {
    const left = Math.max(0, Math.round((start.getTime() - Date.now()) / 60000));
    counter.textContent = String(left);
    const fill = ring.querySelector('.fill') as SVGCircleElement | null;
    if (fill) fill.style.setProperty('--progress', String(left / total));
    if (left <= 0) {
      counter.textContent = '0';
      window.clearInterval(tick);
    }
  }, 15000);

  window.setTimeout(() => {
    window.clearInterval(tick);
    dismiss(card);
  }, 90_000);
}

function dismiss(card: HTMLElement): void {
  card.setAttribute('data-open', '0');
  window.setTimeout(() => card.remove(), 400);
}
