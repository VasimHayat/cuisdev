import { type Page, expect, test } from '@playwright/test';

/** A real PNG built in the browser, so the test needs no fixture files. */
async function png(
  page: Page,
  width: number,
  height: number,
  name: string,
): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const dataUrl = await page.evaluate(
    ({ width: w, height: h }) => {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.fillStyle = '#2266cc';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffcc22';
      ctx.fillRect(0, 0, w / 2, h / 2);
      return canvas.toDataURL('image/png');
    },
    { width, height },
  );
  return {
    name,
    mimeType: 'image/png',
    buffer: Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'),
  };
}

const rows = (page: Page) => page.locator('[data-results] li');
const firstMeta = (page: Page) => page.locator('[data-results] li [data-row-meta]').first();
const caption = (page: Page) => page.locator('[data-preview-caption]');

test.describe('image resizer and cropper', () => {
  test('starts empty, with the privacy promise', async ({ page }) => {
    await page.goto('/tools/image-resizer/');
    await expect(page.getByRole('status')).toContainText('never leave your browser');
    await expect(page.getByText('The first image you add is previewed here')).toBeVisible();
    await expect(page.locator('[data-canvas]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
  });

  test('resizes to an exact size and previews the image', async ({ page }) => {
    await page.goto('/tools/image-resizer/');
    await page.locator('[data-file]').setInputFiles([await png(page, 1600, 900, 'wide.png')]);

    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('[data-canvas]')).toBeVisible();
    await expect(caption(page)).toContainText('wide.png · 1600 × 900 · no crop');
    await expect(firstMeta(page)).toContainText('1600 × 900 → 1280 × 720');

    await page.getByLabel('Width (px)', { exact: true }).fill('800');
    // The lock keeps the 16:9 ratio, so the height follows.
    await expect(page.getByLabel('Height (px)', { exact: true })).toHaveValue('450');
    await expect(firstMeta(page)).toContainText('1600 × 900 → 800 × 450');

    const download = page.waitForEvent('download');
    await rows(page).first().getByRole('button').click();
    expect((await download).suggestedFilename()).toBe('wide-800x450.png');
  });

  test('percentage and preset modes', async ({ page }) => {
    await page.goto('/tools/image-resizer/');
    await page.locator('[data-file]').setInputFiles([await png(page, 400, 200, 'small.png')]);
    await expect(rows(page)).toHaveCount(1);

    await page.getByLabel('Resize mode').selectOption('percent');
    await expect(page.getByLabel('Width (px)', { exact: true })).toBeDisabled();
    await page.getByLabel('Scale (%)').fill('25');
    await expect(firstMeta(page)).toContainText('400 × 200 → 100 × 50');

    await page.getByLabel('Resize mode').selectOption('preset');
    await expect(page.getByLabel('Scale (%)')).toBeDisabled();
    await page.getByLabel('Preset size').selectOption('32x32');
    await expect(firstMeta(page)).toContainText('400 × 200 → 32 × 32');
    await expect(caption(page)).toContainText('output 32 × 32');
  });

  test('crop presets are centred and custom crops are editable', async ({ page }) => {
    await page.goto('/tools/image-resizer/');
    await page.locator('[data-file]').setInputFiles([await png(page, 1600, 900, 'wide.png')]);
    await expect(rows(page)).toHaveCount(1);

    await page.getByLabel('Crop shape').selectOption('1:1');
    await expect(caption(page)).toContainText('crop 350, 0 → 900 × 900');
    await expect(page.getByLabel('Crop X (px)')).toHaveValue('350');
    await expect(page.getByLabel('Crop width (px)')).toHaveValue('900');
    await expect(page.getByLabel('Crop X (px)')).toBeDisabled();

    await page.getByLabel('Crop shape').selectOption('custom');
    await expect(page.getByLabel('Crop X (px)')).toBeEnabled();
    await page.getByLabel('Crop X (px)').fill('100');
    await page.getByLabel('Crop Y (px)').fill('50');
    await page.getByLabel('Crop width (px)').fill('400');
    await page.getByLabel('Crop height (px)').fill('200');
    await expect(caption(page)).toContainText('crop 100, 50 → 400 × 200');
  });

  test('reports crop and dimension errors', async ({ page }) => {
    await page.goto('/tools/image-resizer/');
    await page.locator('[data-file]').setInputFiles([await png(page, 200, 200, 'square.png')]);
    await expect(rows(page)).toHaveCount(1);

    await page.getByLabel('Crop shape').selectOption('custom');
    await page.getByLabel('Crop X (px)').fill('900');
    await page.getByLabel('Crop width (px)').fill('50');
    await page.getByLabel('Crop height (px)').fill('50');
    await expect(page.getByRole('status')).toContainText(
      'Crop X (900) is outside the image, which is only 200 px wide',
    );
    await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');

    await page.getByLabel('Crop shape').selectOption('none');
    await page.getByLabel('Width (px)', { exact: true }).fill('0');
    await expect(page.getByRole('status')).toContainText(
      'Width must be between 1 and 20000 pixels — got 0',
    );
  });

  test('rejects non-images and clears', async ({ page }) => {
    await page.goto('/tools/image-resizer/');
    await page
      .locator('[data-file]')
      .setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }]);
    await expect(page.getByRole('status')).toContainText('“notes.txt” is not an image');
    await expect(rows(page)).toHaveCount(0);

    await page.locator('[data-file]').setInputFiles([await png(page, 100, 100, 'ok.png')]);
    await expect(rows(page)).toHaveCount(1);
    await expect(page.locator('[data-canvas]')).toBeVisible();

    await page.getByRole('button', { name: 'Clear results' }).click();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.locator('[data-canvas]')).toBeHidden();
    await expect(caption(page)).toHaveText('');
    await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
  });
});
