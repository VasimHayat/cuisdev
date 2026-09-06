import { expect, test } from '@playwright/test';

test.describe('recently used tools', () => {
  test('visited tools appear first in the command palette', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.goto('/tools/json-formatter/');

    await page.goto('/');
    await page.getByRole('button', { name: 'Search tools' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search tools' });
    await expect(dialog).toBeVisible();

    await expect(dialog.locator('.palette__group').first()).toHaveText('Recently used');
    const first = dialog.getByRole('option').first();
    await expect(first).toContainText('JSON Formatter');
    // The most recent visit wins.
    await expect(dialog.getByRole('option').nth(1)).toContainText('Base64');
  });

  test('a fresh visitor sees categories, not a recent group', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Search tools' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Search tools' });
    await expect(dialog.locator('.palette__group').first()).not.toHaveText('Recently used');
  });

  test('history stays on the device and survives storage being blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get() {
          throw new Error('blocked');
        },
      });
    });
    await page.goto('/tools/base64/');
    // The tool still works with storage unavailable.
    await page.getByLabel('Text to encode').fill('hi');
    await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('aGk=');
  });
});
