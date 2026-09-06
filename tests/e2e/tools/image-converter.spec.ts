import { type Page, expect, test } from '@playwright/test';

/** A real PNG built in the browser — with a transparent left half, so the
 *  JPEG background-fill option has something to flatten. */
async function transparentPng(
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
      ctx.fillStyle = '#3355ff';
      ctx.fillRect(w / 2, 0, w / 2, h);
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

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="#e11"/></svg>`;

const rows = (page: Page) => page.locator('[data-results] li');
const firstMeta = (page: Page) => page.locator('[data-results] li [data-row-meta]').first();

test.describe('image format converter', () => {
  test('shows the privacy promise and an empty state', async ({ page }) => {
    await page.goto('/tools/image-converter/');
    await expect(page.getByRole('status')).toContainText('never leave your browser');
    await expect(page.getByText('Converted images appear here')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
  });

  test('converts a batch to WebP and reports sizes and dimensions', async ({ page }) => {
    await page.goto('/tools/image-converter/');
    await page
      .locator('[data-file]')
      .setInputFiles([
        await transparentPng(page, 120, 90, 'one.png'),
        await transparentPng(page, 40, 20, 'two.png'),
      ]);

    await expect(rows(page)).toHaveCount(2);
    await expect(firstMeta(page)).toContainText('PNG → WebP');
    await expect(firstMeta(page)).toContainText('120 × 90');
    await expect(firstMeta(page)).toContainText('→');
    await expect(rows(page).first().locator('img')).toHaveAttribute('src', /^blob:/);
    await expect(page.locator('[data-totals]')).toContainText('2 files converted to WebP');

    const download = page.waitForEvent('download');
    await rows(page).first().getByRole('button').click();
    expect((await download).suggestedFilename()).toBe('one.webp');
  });

  test('target format drives the file name, quality and background controls', async ({ page }) => {
    await page.goto('/tools/image-converter/');
    await page
      .locator('[data-file]')
      .setInputFiles([await transparentPng(page, 60, 60, 'logo.png')]);
    await expect(rows(page)).toHaveCount(1);

    const quality = page.getByLabel('Quality');
    const background = page.getByLabel('Background colour');
    await expect(quality).toBeEnabled();
    await expect(background).toBeDisabled();

    await page.getByLabel('Convert to').selectOption('image/png');
    await expect(quality).toBeDisabled();
    await expect(background).toBeDisabled();
    await expect(firstMeta(page)).toContainText('same format, re-encoded');

    await page.getByLabel('Convert to').selectOption('image/jpeg');
    await expect(quality).toBeEnabled();
    await expect(background).toBeEnabled();
    await expect(firstMeta(page)).toContainText('PNG → JPEG');

    const download = page.waitForEvent('download');
    await rows(page).first().getByRole('button').click();
    expect((await download).suggestedFilename()).toBe('logo.jpg');
  });

  test('rasterises an SVG through the canvas', async ({ page }) => {
    await page.goto('/tools/image-converter/');
    await page.getByLabel('Convert to').selectOption('image/png');
    await page
      .locator('[data-file]')
      .setInputFiles([{ name: 'badge.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(SVG) }]);

    await expect(rows(page)).toHaveCount(1);
    await expect(firstMeta(page)).toContainText('SVG → PNG');
    await expect(firstMeta(page)).toContainText('64 × 32');
  });

  test('only offers AVIF when this browser can encode it', async ({ page }) => {
    await page.goto('/tools/image-converter/');
    const target = page.getByLabel('Convert to');
    const encodesAvif = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.width = 1;
          canvas.height = 1;
          canvas.toBlob((blob) => resolve(blob?.type === 'image/avif'), 'image/avif', 0.5);
        }),
    );
    const options = target.locator('option[value="image/avif"]');
    await expect(options).toHaveCount(encodesAvif ? 1 : 0);
  });

  test('rejects unsupported files and clears the list', async ({ page }) => {
    await page.goto('/tools/image-converter/');
    await page
      .locator('[data-file]')
      .setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }]);

    const status = page.getByRole('status');
    await expect(status).toContainText('is not an image this tool can read');
    await expect(status).toHaveAttribute('data-tone', 'error');
    await expect(rows(page)).toHaveCount(0);

    await page.locator('[data-file]').setInputFiles([await transparentPng(page, 30, 30, 'ok.png')]);
    await expect(rows(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear results' }).click();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText('Converted images appear here')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
  });
});
