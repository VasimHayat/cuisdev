import { expect, test } from '@playwright/test';

test.describe('site shell', () => {
  test('home page renders and links to tools', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Cuisdev/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Developer tools');
    await page.getByRole('link', { name: /browse all/i }).click();
    await expect(page).toHaveURL(/\/tools\/$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('All developer tools');
  });

  test('command palette opens with Ctrl+K and navigates', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard shortcut is desktop-only');
    await page.goto('/');
    await page.keyboard.press('Control+k');
    const dialog = page.getByRole('dialog', { name: 'Search tools' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('combobox').fill('base64');
    await expect(dialog.getByRole('option').first()).toContainText('Base64');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/tools\/base64\/$/);
  });

  test('theme toggle persists across reloads', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    const before = await html.getAttribute('data-theme');
    await page.getByRole('button', { name: /switch to .* theme/i }).click();
    const after = await html.getAttribute('data-theme');
    expect(after).not.toBe(before);
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', after ?? '');
  });

  test('404 page is served with a search affordance', async ({ page }) => {
    const response = await page.goto('/this-does-not-exist/');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toContainText("couldn't find");
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Search tools' }),
    ).toBeVisible();
  });

  test('SEO essentials are present on a tool page', async ({ page }) => {
    await page.goto('/tools/base64/');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://www.cuisdev.com/tools/base64/',
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Base64/);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /\/og\/base64\.png$/,
    );
    const schemas = await page.locator('script[type="application/ld+json"]').allTextContents();
    const types = schemas.map((s) => (JSON.parse(s) as { '@type': string })['@type']);
    expect(types).toEqual(
      expect.arrayContaining([
        'Organization',
        'SoftwareApplication',
        'BreadcrumbList',
        'FAQPage',
        'HowTo',
      ]),
    );
  });
});
