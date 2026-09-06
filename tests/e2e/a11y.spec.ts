/**
 * Accessibility + mobile gate for EVERY indexable page. URLs come from the
 * built sitemap, so a new tool is covered automatically the moment it exists.
 */
import { readFileSync } from 'node:fs';

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

function sitemapPaths(): string[] {
  const xml = readFileSync('dist/sitemap-0.xml', 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? '').pathname).sort();
}

const pages = sitemapPaths();

test('sitemap lists the core pages', () => {
  expect(pages).toEqual(
    expect.arrayContaining(['/', '/tools/', '/about/', '/privacy/', '/terms/']),
  );
  expect(pages.length).toBeGreaterThan(5);
});

for (const path of pages) {
  test.describe(path, () => {
    test('has no WCAG 2.2 AA violations (light)', async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });

    test('has no WCAG 2.2 AA violations (dark)', async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'dark' });
      await page.goto(path);
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });

    test('never scrolls horizontally', async ({ page }) => {
      await page.goto(path);
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(overflow.scrollWidth, JSON.stringify(overflow)).toBeLessThanOrEqual(
        overflow.innerWidth,
      );
    });

    test('has exactly one h1 and a meta description', async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length ?? 0).toBeGreaterThan(50);
    });
  });
}
