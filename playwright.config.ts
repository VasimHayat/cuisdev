import { defineConfig, devices } from '@playwright/test';

// Not 4321: that is `astro dev`'s port, and `reuseExistingServer` would silently
// test a running dev server (with stale content collections) instead of `dist/`.
const PORT = Number(process.env.PW_PORT ?? 4329);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    // Full Chromium in new-headless mode; avoids the separate headless-shell download.
    channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium',
  },
  webServer: {
    // Not `astro preview`: it daemonises itself and Playwright cannot supervise it.
    command: `node scripts/serve-dist.ts --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
});
