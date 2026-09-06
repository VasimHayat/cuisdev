import { expect, type Page, test } from '@playwright/test';

/**
 * The site claims it keeps working without a connection. These tests prove it:
 * register the service worker, cut the network, and use a tool.
 */

/**
 * Resolve once the worker controls this page and has finished caching it and
 * every same-origin asset it loaded (caching happens asynchronously after load).
 */
async function waitForServiceWorker(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      if (navigator.serviceWorker.controller === null) return false;
      const assets = performance
        .getEntriesByType('resource')
        .filter(
          (entry) =>
            entry.name.startsWith(location.origin) &&
            /\.(?:js|css|woff2?)(?:\?|$)/.test(entry.name),
        )
        .map((entry) => entry.name);
      const found = await Promise.all(
        [location.href, ...new Set(assets)].map((url) => caches.match(url)),
      );
      return found.every(Boolean);
    },
    null,
    { timeout: 20_000 },
  );
}

/**
 * Cut the network. The message first wakes the worker: Chromium will not always
 * start an idle service worker once offline emulation is on, which would fail
 * the navigation before the worker could answer it from cache.
 */
async function goOffline(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    registration.active?.postMessage({ type: 'ping' });
  });
  await page.context().setOffline(true);
}

test.describe('offline support', () => {
  // Runs in the dedicated "offline" project (see playwright.config.ts), which is
  // serial and runs after every other project so nothing else is in flight.
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test('a visited tool still works with the network cut', async ({ page }) => {
    await page.goto('/tools/base64/');
    await waitForServiceWorker(page);
    await goOffline(page);

    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Base64');
    await page.getByLabel('Text to encode').fill('offline works');
    await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('b2ZmbGluZSB3b3Jrcw==');
  });

  test('an unvisited page falls back to the offline notice', async ({ page }) => {
    await page.goto('/');
    await waitForServiceWorker(page);
    await goOffline(page);

    await page.goto('/tools/json-formatter/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('offline');
    await expect(page.getByRole('link', { name: /browse cached tools/i })).toBeVisible();
  });

  test('the worker is served correctly and is not indexed', async ({ page, request }) => {
    const response = await request.get('/sw.js');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('javascript');

    await page.goto('/sitemap-0.xml');
    const sitemap = await page.content();
    expect(sitemap).not.toContain('/sw.js');
    expect(sitemap).not.toContain('/offline/');
  });
});
