export interface Route {
  readonly path: string;
  readonly title: string;
  readonly subtitle: string;
  readonly icon: string;
  readonly render: () => HTMLElement;
  /** Hidden routes stay out of the navigation but remain reachable. */
  readonly hidden?: boolean;
}

let routes: Route[] = [];
let onChange: ((route: Route) => void) | null = null;

export function defineRoutes(list: Route[]): void {
  routes = list;
}

export function currentPath(): string {
  const raw = location.hash.replace(/^#/, '');
  const path = raw.split('?')[0];
  return path && path.startsWith('/') ? path : '/today';
}

export function resolve(path = currentPath()): Route {
  return routes.find((r) => r.path === path) ?? routes[0];
}

export function navigate(path: string): void {
  if (currentPath() === path) {
    notify();
    return;
  }
  location.hash = path;
}

export function startRouter(handler: (route: Route) => void): void {
  onChange = handler;
  window.addEventListener('hashchange', notify);
  notify();
}

export function visibleRoutes(): Route[] {
  return routes.filter((r) => !r.hidden);
}

function notify(): void {
  onChange?.(resolve());
}
