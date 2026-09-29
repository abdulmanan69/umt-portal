import { store } from '../core/store';

export function applyTheme(mode?: 'dark' | 'light'): void {
  const theme = mode ?? store.settings.theme;
  document.documentElement.setAttribute('data-theme', theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', theme === 'dark' ? '#0E1425' : '#F2F5FA');
}
