import { expect, test } from '@playwright/test';

import { expectEditorValue, expectError, fillEditor } from '../helpers';

const URL = 'https://www.cuisdev.com/tools/qr-code-generator/';

test.describe('qr code generator', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('renders a code live, switches to SVG and downloads both formats', async ({ page }) => {
    await page.goto('/tools/qr-code-generator/');
    const canvas = page.locator('[data-canvas]');
    const svg = page.locator('[data-svg] svg');
    const stats = page.locator('[data-stats]');

    await expect(page.getByText('Your QR code appears here')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download PNG' })).toBeDisabled();

    await fillEditor(page, 'qr-code-generator-input', URL);
    await expect(canvas).toBeVisible();
    await expect(stats).toContainText(
      new RegExp(`^${URL.length} chars · ${URL.length} bytes · version \\d+ · \\d+×\\d+ modules`),
    );
    await expect(stats).toContainText('256×256 px');

    await page.getByText('SVG', { exact: true }).click();
    await expect(svg).toBeVisible();
    await expect(canvas).toBeHidden();
    await expect(svg).toHaveAttribute('width', '256');

    const svgDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download SVG' }).click();
    expect((await svgDownload).suggestedFilename()).toBe('qr-text.svg');

    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    expect((await pngDownload).suggestedFilename()).toBe('qr-text.png');
  });

  test('appearance options change the code', async ({ page }) => {
    await page.goto('/tools/qr-code-generator/');
    await page.getByText('SVG', { exact: true }).click();
    await fillEditor(page, 'qr-code-generator-input', URL);
    const svg = page.locator('[data-svg] svg');
    const stats = page.locator('[data-stats]');
    await expect(svg).toBeVisible();

    const versionOf = async () =>
      Number(/version (\d+)/.exec((await stats.textContent()) ?? '')?.[1]);
    const lowVersion = await versionOf();
    await page.getByLabel('Error correction').selectOption('H');
    await expect.poll(versionOf).toBeGreaterThan(lowVersion);

    const modules = Number(/(\d+)×\d+ modules/.exec((await stats.textContent()) ?? '')?.[1]);
    // Default margin is 4 modules on each side.
    await expect(svg).toHaveAttribute('viewBox', `0 0 ${modules + 8} ${modules + 8}`);
    await page.getByLabel('Margin (modules)').fill('0');
    await expect(svg).toHaveAttribute('viewBox', `0 0 ${modules} ${modules}`);

    await page.getByLabel('Size (px)').fill('512');
    await expect(svg).toHaveAttribute('width', '512');
    await expect(stats).toContainText('512×512 px');

    await page.getByLabel('Foreground colour').fill('#ff0000');
    await expect(svg.locator('path[stroke]')).toHaveAttribute('stroke', '#ff0000');
  });

  test('presets build the right payloads', async ({ page }) => {
    await page.goto('/tools/qr-code-generator/');
    const preset = page.getByLabel('Content type');

    await preset.selectOption('wifi');
    await page.getByLabel('Network name (SSID)').fill('Cafe; "Free"');
    await page.getByLabel('Wi-Fi password').fill('p:a,s\\s');
    await expectEditorValue(
      page,
      'qr-code-generator-payload',
      'WIFI:T:WPA;S:Cafe\\; \\"Free\\";P:p\\:a\\,s\\\\s;H:false;;',
    );
    await page.getByRole('checkbox', { name: 'Hidden network' }).check();
    await expectEditorValue(page, 'qr-code-generator-payload', /H:true;;$/);
    await expect(page.locator('[data-canvas]')).toBeVisible();

    await preset.selectOption('email');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(
      page,
      'qr-code-generator-payload',
      /^mailto:hello@example\.com\?subject=Table%20for%20two%20on%20Friday&body=Hi%2C%0A/,
    );

    await preset.selectOption('phone');
    await page.getByLabel('Phone number').fill('+1 (555) 123-4567');
    await expectEditorValue(page, 'qr-code-generator-payload', 'tel:+15551234567');

    await preset.selectOption('sms');
    await page.getByLabel('SMS recipient').fill('555 1234');
    await page.getByLabel('SMS message').fill('Hello there');
    await expectEditorValue(page, 'qr-code-generator-payload', 'smsto:5551234:Hello there');

    await preset.selectOption('vcard');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(
      page,
      'qr-code-generator-payload',
      // A textarea normalises the vCard's CRLF line endings to LF.
      /^BEGIN:VCARD\nVERSION:3\.0\nN:Lovelace;Ada;;;\nFN:Ada Lovelace\nORG:Analytical Engines Ltd\nTEL;TYPE=CELL:\+442079460958\nEMAIL;TYPE=INTERNET:ada@example\.com\nEND:VCARD$/,
    );
    const pngDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download PNG' }).click();
    expect((await pngDownload).suggestedFilename()).toBe('qr-vcard.png');
  });

  test('reports content that is too long and invalid options', async ({ page }) => {
    await page.goto('/tools/qr-code-generator/');
    await fillEditor(page, 'qr-code-generator-input', 'a'.repeat(2400));
    await expectError(
      page,
      /too long for a QR code \(2,400 bytes; the maximum at error-correction level M is 2,331 bytes\)/,
    );
    await expect(page.locator('[data-canvas]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Download SVG' })).toBeDisabled();

    await page.getByLabel('Error correction').selectOption('L');
    await expect(page.locator('[data-canvas]')).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('');

    await page.getByLabel('Size (px)').fill('64');
    await expectError(page, /Size must be a whole number between 128 and 1024 pixels — got 64/);

    await page.getByLabel('Size (px)').fill('256');
    await page.getByLabel('Background colour').fill('#000000');
    await expectError(page, /identical/);
  });

  test('validates preset fields', async ({ page }) => {
    await page.goto('/tools/qr-code-generator/');
    await page.getByLabel('Content type').selectOption('wifi');
    await page.getByLabel('Network name (SSID)').fill('Home');
    await expectError(page, /Wi-Fi password is required/);

    await page.getByLabel('Security').selectOption('nopass');
    await expectEditorValue(page, 'qr-code-generator-payload', 'WIFI:T:nopass;S:Home;H:false;;');
    await expect(page.getByRole('status')).toHaveText('');

    await page.getByLabel('Content type').selectOption('email');
    await page.getByLabel('Email address').fill('not-an-email');
    await expectError(page, /does not look like an email address/);
  });

  test('sample, copy and clear', async ({ page }) => {
    await page.goto('/tools/qr-code-generator/');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, 'qr-code-generator-input', URL);
    await expect(page.locator('[data-canvas]')).toBeVisible();

    const copy = page.locator('[data-action="copy"]');
    await copy.click();
    await expect(copy).toContainText('Copied!');

    await page.getByText('SVG', { exact: true }).click();
    await expect(page.locator('[data-svg] svg')).toBeVisible();
    await copy.click();
    await expect(copy).toContainText('Copied!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^<svg /);

    await page.getByRole('button', { name: 'Clear content' }).click();
    await expectEditorValue(page, 'qr-code-generator-input', '');
    await expect(page.locator('[data-svg] svg')).toHaveCount(0);
    await expect(page.getByText('Your QR code appears here')).toBeVisible();
    await expect(page.locator('[data-stats]')).toHaveText('');
    await expect(copy).toBeDisabled();
  });
});
