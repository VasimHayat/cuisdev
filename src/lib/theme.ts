/** Runtime theme switching. The initial value is set pre-paint by theme-init.js. */
export type Theme = 'light' | 'dark';

const KEY = 'cuisdev:theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
}

export function setTheme(theme: Theme): void {
  applyTheme(theme);
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* ignore */
  }
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
}

/** Follow the OS while the user has not chosen explicitly. */
export function watchSystemTheme(): void {
  media().addEventListener('change', (e) => {
    try {
      if (localStorage.getItem(KEY)) return;
    } catch {
      /* ignore */
    }
    applyTheme(e.matches ? 'dark' : 'light');
  });
}
