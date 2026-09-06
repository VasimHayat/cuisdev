import { expect, test } from '@playwright/test';

test.describe('base64 tool', () => {
  test('encodes and decodes live', async ({ page }) => {
    await page.goto('/tools/base64/');
    const input = page.getByLabel('Text to encode');
    const output = page.getByLabel('Base64', { exact: true });

    await input.fill('Hello, World!');
    await expect(output).toHaveValue('SGVsbG8sIFdvcmxkIQ==');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByLabel('Base64 to decode')).toHaveValue('SGVsbG8sIFdvcmxkIQ==');
    await expect(page.getByLabel('Decoded text')).toHaveValue('Hello, World!');
  });

  test('shows a helpful error for invalid input', async ({ page }) => {
    await page.goto('/tools/base64/');
    // The radio itself is visually hidden; click its label text.
    await page.getByText('Decode', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Decode' })).toBeChecked();
    await page.getByLabel('Base64 to decode').fill('not*valid');
    await expect(page.getByRole('status')).toContainText('Invalid character "*"');
  });

  test('url-safe option changes the alphabet', async ({ page }) => {
    await page.goto('/tools/base64/');
    await page.getByLabel('Text to encode').fill('??>');
    await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('Pz8+');
    await page.getByRole('checkbox', { name: /url-safe/i }).check();
    await expect(page.getByLabel('Base64', { exact: true })).toHaveValue('Pz8-');
  });
});
