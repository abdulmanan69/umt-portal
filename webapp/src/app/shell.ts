import { el, clear } from '../ui/dom';
import { icon } from '../ui/components';
import { store } from '../core/store';
import { currentPath, navigate, startRouter, visibleRoutes, type Route } from './router';

export interface Shell {
  mount(root: HTMLElement): void;
  refresh(): void;
}

export function createShell(): Shell {
  const content = el('main', { class: 'main' });
  const crumb = el('div', { class: 'crumb' });
  const railNav = el('nav', {});
  const tabbar = el('nav', { class: 'tabbar' });
  const rail = el('aside', { class: 'rail' });
  const scrim = el('div', { class: 'scrim' });

  const setNav = (open: boolean) => document.documentElement.setAttribute('data-nav', open ? 'open' : 'closed');
  scrim.addEventListener('click', () => setNav(false));

  const menuBtn = el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Open navigation' }, [icon('grid', 16)]);
  menuBtn.addEventListener('click', () => {
    setNav(document.documentElement.getAttribute('data-nav') !== 'open');
  });

  const topbar = el('header', { class: 'topbar' }, [menuBtn, crumb]);
  content.appendChild(topbar);

  const shell = el('div', { class: 'shell' }, [rail, content]);

  function buildNav(active: Route): void {
    const links = visibleRoutes().map((route) => {
      const link = el('a', {
        class: 'nav',
        href: `#${route.path}`,
        'aria-current': route.path === active.path ? 'page' : null
      }, [icon(route.icon, 17), el('span', { text: route.title })]);
      link.addEventListener('click', () => setNav(false));
      return link;
    });
    clear(railNav).append(...links);

    const tabs = visibleRoutes().slice(0, 5).map((route) =>
      el('a', {
        href: `#${route.path}`,
        'aria-current': route.path === active.path ? 'page' : null
      }, [icon(route.icon, 18), el('span', { text: route.title })])
    );
    clear(tabbar).append(...tabs);
  }

  function buildRail(): void {
    const student = store.snapshot?.student;
    clear(rail).append(
      el('div', { class: 'brand' }, [
        el('span', { class: 'brand-mark', text: 'U' }),
        el('div', {}, [el('b', { text: 'UMT Companion' }), el('small', { text: 'timetable . reminders' })])
      ]),
      railNav,
      el('div', { class: 'rail-foot' }, [
        student
          ? el('div', { class: 'who' }, [
              el('b', { text: student.name }),
              el('small', { text: student.id })
            ])
          : null,
        store.hasPasscode
          ? (() => {
              const lock = el('a', { class: 'nav', href: '#/today' }, [icon('lock', 17), el('span', { text: 'Lock this device' })]);
              lock.addEventListener('click', () => {
                store.lock();
                location.reload();
              });
              return lock;
            })()
          : null
      ])
    );
  }

  let currentRoute: Route | null = null;

  function paint(route: Route): void {
    currentRoute = route;
    buildRail();
    buildNav(route);
    clear(crumb).append(el('b', { text: route.title }), el('small', { text: route.subtitle }));
    const existing = content.querySelector('.view');
    existing?.remove();
    content.appendChild(route.render());
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }

  return {
    mount(root: HTMLElement) {
      clear(root).append(shell, scrim, tabbar);
      setNav(false);
      startRouter(paint);
    },
    refresh() {
      if (currentRoute) paint(currentRoute);
      else navigate(currentPath());
    }
  };
}
