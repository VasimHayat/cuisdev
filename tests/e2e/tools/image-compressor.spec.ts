import { type Page, expect, test } from '@playwright/test';

/**
 * Build a real PNG in the browser so the test never depends on a fixture file.
 * The pixels come from a seeded LCG: noisy enough that JPEG beats PNG, and
 * identical on every run so the reported sizes are stable.
 */
async function noisyPng(
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
      const image = ctx.createImageData(w, h);
      let seed = 42;
      for (let i = 0; i < image.data.length; i += 4) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        image.data[i] = seed & 255;
        image.data[i + 1] = (seed >> 8) & 255;
        image.data[i + 2] = (seed >> 16) & 255;
        image.data[i + 3] = 255;
      }
      ctx.putImageData(image, 0, 0);
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

test.describe('image compressor', () => {
  test('says images stay on the device before anything is added', async ({ page }) => {
    await page.goto('/tools/image-compressor/');
    await expect(page.getByRole('status')).toContainText('never leave your browser');
    await expect(page.getByText('Compressed images appear here')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear results' })).toBeDisabled();
  });

  test('compresses a batch and reports sizes and dimensions', async ({ page }) => {
    await page.goto('/tools/image-compressor/');
    await page
      .locator('[data-file]')
      .setInputFiles([
        await noisyPng(page, 120, 90, 'one.png'),
        await noisyPng(page, 60, 40, 'two.png'),
      ]);

    await expect(rows(page)).toHaveCount(2);
    await expect(firstMeta(page)).toContainText('120 × 90');
    // "before → after" is always reported.
    await expect(firstMeta(page)).toContainText('→');
    await expect(page.locator('[data-results] li').first().locator('img')).toHaveAttribute(
      'src',
      /^blob:/,
    );
    await expect(page.locator('[data-results] li button').first()).toBeEnabled();
    await expect(page.locator('[data-totals]')).toContainText('2 images');
    await expect(page.getByRole('button', { name: 'Download all' })).toBeEnabled();
  });

  test('output format and quality change the result', async ({ page }) => {
    await page.goto('/tools/image-compressor/');
    await page.locator('[data-file]').setInputFiles([await noisyPng(page, 120, 90, 'shot.png')]);
    await expect(rows(page)).toHaveCount(1);

    await page.getByLabel('Output format').selectOption('image/jpeg');
    await expect(firstMeta(page)).toContainText('% smaller');
    const atDefaultQuality = await firstMeta(page).textContent();

    const download = page.waitForEvent('download');
    await page.locator('[data-results] li button').first().click();
    expect((await download).suggestedFilename()).toBe('shot-compressed.jpg');

    // Range inputs answer to the keyboard; Home jumps to the minimum (10).
    await page.getByLabel('Quality').press('Home');
    await expect(page.locator('[data-quality]')).toHaveText('10');
    await expect
      .poll(async () => firstMeta(page).textContent())
      .not.toBe(atDefaultQuality ?? 'unchanged');
  });

  test('max width scales the image down before encoding', async ({ page }) => {
    await page.goto('/tools/image-compressor/');
    await page.locator('[data-file]').setInputFiles([await noisyPng(page, 120, 90, 'big.png')]);
    await expect(firstMeta(page)).toContainText('120 × 90');

    await page.getByLabel('Max width (px)').fill('40');
    await expect(firstMeta(page)).toContainText('40 × 30');
  });

  test('rejects non-images and invalid options', async ({ page }) => {
    await page.goto('/tools/image-compressor/');
    await page
      .locator('[data-file]')
      .setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }]);

    const status = page.getByRole('status');
    await expect(status).toContainText('“notes.txt” is not an image');
    await expect(status).toHaveAttribute('data-tone', 'error');
    await expect(rows(page)).toHaveCount(0);

    await page.locator('[data-file]').setInputFiles([await noisyPng(page, 20, 20, 'ok.png')]);
    await expect(rows(page)).toHaveCount(1);
    await page.getByLabel('Max width (px)').fill('0');
    await expect(status).toContainText('Max width must be between 1 and 20000 pixels — got 0');
  });

  test('clear empties the results', async ({ page }) => {
    await page.goto('/tools/image-compressor/');
    await page.locator('[data-file]').setInputFiles([await noisyPng(page, 40, 40, 'x.png')]);
    await expect(rows(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear results' }).click();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByText('Compressed images appear here')).toBeVisible();
    await expect(page.locator('[data-totals]')).toHaveText('');
    await expect(page.getByRole('button', { name: 'Download all' })).toBeDisabled();
  });
});
