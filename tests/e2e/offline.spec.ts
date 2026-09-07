import { expect, type Page, test } from '@playwright/test';

/**
 * The site claims it keeps working without a connection. These tests cut the
 * network and use a tool.
 *
 * `page.waitForFunction` does not await an async predicate — it sees the
 * returned Promise, which is always truthy, and resolves immediately. Anything
 * asynchronous (the Cache API is) must be polled with `expect.poll` instead.
 */

/** Every same-origin URL the document needs in order to work on a repeat visit. */
function collectAssets(): string[] {
  const urls = new Set<string>([location.href]);
  const add = (value: string | null) => {
    if (!value) return;
    const url = new URL(value, location.href);
    if (url.origin === location.origin) urls.add(url.href);
  };
  document.querySelectorAll('script[src]').forEach((el) => add(el.getAttribute('src')));
  document
    .querySelectorAll('link[rel="modulepreload"], link[rel="stylesheet"]')
    .forEach((el) => add(el.getAttribute('href')));
  return [...urls];
}

async function requiredAssets(page: Page): Promise<string[]> {
  return page.evaluate(collectAssets);
}

/** Wait until the worker controls this page and has cached everything it needs. */
async function waitForServiceWorker(page: Page): Promise<void> {
  await expect
    .poll(
      async () => {
        const controlled = await page.evaluate(() => navigator.serviceWorker.controller !== null);
        if (!controlled) return false;
        const assets = await requiredAssets(page);
        return page.evaluate(
          async (urls) => (await Promise.all(urls.map((url) => caches.match(url)))).every(Boolean),
          assets,
        );
      },
      { timeout: 20_000, message: 'the service worker never cached the page and its assets' },
    )
    .toBe(true);
}

test.describe('offline support', () => {
  // Runs in the dedicated "offline" project (see playwright.config.ts): serial,
  // and after every other project so nothing else is in flight.
  test.describe.configure({ mode: 'serial' });

  test.afterEach(async ({ context }) => {
    await context.setOffline(false);
  });

  test('a visited tool still works with the network cut', async ({ page, context }) => {
    await page.goto('/tools/base64/');
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Base64');
    await page.getByLabel('Text to encode').fill('offline works');
    await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('b2ZmbGluZSB3b3Jrcw==');
  });

  test('one visit caches the tool page and every asset it needs', async ({ page }) => {
    await page.goto('/tools/base64/');
    await waitForServiceWorker(page);

    const assets = await requiredAssets(page);
    expect(assets.some((url) => url.endsWith('.js'))).toBe(true);
    expect(assets.some((url) => url.endsWith('.css'))).toBe(true);

    const cachedHtml = await page.evaluate(async () => {
      const response = await caches.match(location.href);
      return response ? response.text() : null;
    });
    expect(cachedHtml).toContain('Base64 Encoder / Decoder');
  });

  test('an unvisited page falls back to the offline notice', async ({ page, context }) => {
    await page.goto('/');
    await waitForServiceWorker(page);

    await context.setOffline(true);
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
