(() => {
  const KEY = 'cuisdev:theme';
  let theme = 'light';
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') theme = stored;
    else if (matchMedia('(prefers-color-scheme: dark)').matches) theme = 'dark';
  } catch {
    /* storage unavailable — fall back to light */
  }
  document.documentElement.dataset.theme = theme;
})();
