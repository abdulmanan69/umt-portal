import { el, svg } from './dom';

export function icon(name: string, size = 16): SVGElement {
  const paths: Record<string, string> = {
    clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
    bell: 'M18 8A6 6 0 1 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
    graduation: 'M22 10 12 5 2 10l10 5 10-5ZM6 12v5c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5',
    wallet: 'M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0 0 4h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5M16 13h2',
    grid: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2 2 2 0 1 1-4 0 1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a2 2 0 1 1 0-4 1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 4.6a2 2 0 1 1 4 0 1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9 2 2 0 1 1 0 4Z',
    pin: 'M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    play: 'm10 8 6 4-6 4V8ZM21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    check: 'm5 13 4 4L19 7',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3A5 5 0 0 0 13.5 3.5l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3A5 5 0 0 0 10.5 20.5l1.7-1.7',
    download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
    upload: 'M12 21V9m0 0 4 4m-4-4-4 4M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2',
    lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z',
    refresh: 'M21 12a9 9 0 0 1-15.4 6.4M3 12a9 9 0 0 1 15.4-6.4M3 5v5h5M21 19v-5h-5',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4 7h16M10 11v6M14 11v6M5 7l1 13a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1l1-13M9 7V4h6v3'
  };
  const node = svg('svg', {
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none',
    stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round',
    'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'ico'
  }, [svg('path', { d: paths[name] ?? paths.grid })]);
  return node;
}

export function card(children: (Node | string | null | false)[], className = ''): HTMLElement {
  return el('section', { class: `card ${className}`.trim() }, children);
}

export function sectionHead(title: string, note?: string, actions?: Node[]): HTMLElement {
  return el('div', { class: 'section-head' }, [
    el('div', {}, [el('h2', { text: title }), note ? el('p', { text: note }) : null]),
    actions?.length ? el('div', { class: 'actions' }, actions) : null
  ]);
}

export function button(
  label: string,
  options: { variant?: 'primary' | 'ghost' | 'danger'; iconName?: string; onClick?: () => void; type?: string } = {}
): HTMLButtonElement {
  const node = el('button', {
    class: `btn ${options.variant ?? 'ghost'}`,
    type: options.type ?? 'button'
  }, [options.iconName ? icon(options.iconName, 15) : null, el('span', { text: label })]);
  if (options.onClick) node.addEventListener('click', options.onClick);
  return node;
}

export function pill(text: string, tone = ''): HTMLElement {
  return el('span', { class: `pill ${tone}`.trim(), text });
}

export function stat(label: string, value: string, note?: string, iconName = 'grid'): HTMLElement {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat-ico' }, [icon(iconName, 16)]),
    el('div', { class: 'stat-body' }, [
      el('small', { text: label }),
      el('b', { text: value }),
      note ? el('em', { text: note }) : null
    ])
  ]);
}

export function empty(title: string, note: string, action?: Node): HTMLElement {
  return el('div', { class: 'empty' }, [
    el('h3', { text: title }),
    el('p', { text: note }),
    action ?? null
  ]);
}

export function toast(message: string, tone: 'good' | 'bad' | 'info' = 'info'): void {
  let host = document.querySelector('.toasts');
  if (!host) {
    host = el('div', { class: 'toasts' });
    document.body.appendChild(host);
  }
  const node = el('div', { class: `toast ${tone}` }, [
    icon(tone === 'bad' ? 'bell' : 'check', 15),
    el('span', { text: message })
  ]);
  host.appendChild(node);
  setTimeout(() => node.remove(), 4800);
}
