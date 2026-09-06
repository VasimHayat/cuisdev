import { expect, test } from '@playwright/test';

import { expectError, fillEditor } from '../helpers';

test.describe('url-encoder tool', () => {
  test('encodes live, shows the URL breakdown and swaps to decode', async ({ page }) => {
    await page.goto('/tools/url-encoder/');
    const output = page.getByLabel('URL-encoded', { exact: true });

    await page.getByLabel('Style').selectOption('full');
    await fillEditor(page, 'url-encoder-input', 'https://example.com/a b?q=café&x=1#top');
    await expect(output).toHaveValue('https://example.com/a%20b?q=caf%C3%A9&x=1#top');

    const breakdown = page.locator('[data-breakdown]');
    await expect(breakdown).toBeVisible();
    await expect(breakdown.getByRole('row', { name: /Host/ })).toContainText('example.com');
    await expect(breakdown.getByRole('row', { name: /Query/ })).toContainText('café');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('radio', { name: 'Decode' })).toBeChecked();
    await expect(page.getByLabel('Decoded text')).toHaveValue(
      'https://example.com/a b?q=café&x=1#top',
    );
  });

  test('component vs form style changes how spaces are encoded', async ({ page }) => {
    await page.goto('/tools/url-encoder/');
    const output = page.getByLabel('URL-encoded', { exact: true });
    await fillEditor(page, 'url-encoder-input', 'a b&c');
    await expect(output).toHaveValue('a%20b%26c');
    await page.getByLabel('Style').selectOption('form');
    await expect(output).toHaveValue('a+b%26c');
  });

  test('reports malformed percent sequences with an offset', async ({ page }) => {
    await page.goto('/tools/url-encoder/');
    await page.getByText('Decode', { exact: true }).click();
    await fillEditor(page, 'url-encoder-input', 'abc%2');
    await expectError(page, /Malformed percent-escape "%2" at offset 3/);
    await expect(page.getByLabel('Decoded text')).toHaveValue('');
  });

  test('decode until stable unwraps double encoding', async ({ page }) => {
    await page.goto('/tools/url-encoder/');
    await page.getByText('Decode', { exact: true }).click();
    await fillEditor(page, 'url-encoder-input', 'a%2520b');
    await expect(page.getByLabel('Decoded text')).toHaveValue('a%20b');
    await page.getByRole('checkbox', { name: /until stable/i }).check();
    await expect(page.getByLabel('Decoded text')).toHaveValue('a b');
    await expect(page.getByRole('status')).toContainText('2 layers');
  });

  test('sample, copy and clear', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/url-encoder/');
    await page.getByRole('button', { name: 'Sample' }).click();
    const output = page.getByLabel('URL-encoded', { exact: true });
    await expect(output).toHaveValue(/caf%C3%A9%20au%20lait/);

    // Located by its stable hook: while flashing, the accessible name is "Copied!", not "Copy".
    const copy = page.locator('[data-action="copy"]');
    await copy.click();
    await expect(copy).toContainText('Copied!');

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expect(page.getByLabel('Text to encode')).toHaveValue('');
    await expect(output).toHaveValue('');
    await expect(page.locator('[data-breakdown]')).toBeHidden();
  });
});
