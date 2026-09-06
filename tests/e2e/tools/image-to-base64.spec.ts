import { type Page, expect, test } from '@playwright/test';

import { clickCopy, stubClipboard } from '../helpers';

/** The same 8 × 8 checkerboard PNG the tool ships as its Sample. */
const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAHklEQVR42mNQSjvzHxn/' +
  'P6OEghnooABdAF0DHRQAAHBip+GJeDo+AAAAAElFTkSuQmCC';

function pngFile(name: string) {
  return { name, mimeType: 'image/png', buffer: Buffer.from(SAMPLE_PNG_BASE64, 'base64') };
}

const rows = (page: Page) => page.locator('[data-results] li');
const firstMeta = (page: Page) => page.locator('[data-results] li [data-row-meta]').first();

test.describe('image to base64', () => {
  test.beforeEach(async ({ page }) => {
    await stubClipboard(page);
  });

  test('starts empty and promises nothing is uploaded', async ({ page }) => {
    await page.goto('/tools/image-to-base64/');
    await expect(page.getByRole('status')).toContainText('never leave your browser');
    await expect(page.getByText('Encoded images appear here')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy data URL' })).toBeDisabled();
  });

  test('encodes an image into every snippet flavour', async ({ page }) => {
    await page.goto('/tools/image-to-base64/');
    await page.locator('[data-file]').setInputFiles([pngFile('hero-shot.png')]);

    await expect(rows(page)).toHaveCount(1);
    await expect(firstMeta(page)).toContainText('PNG · 87 B → 138 B data URL (+58.6%)');
    await expect(firstMeta(page)).toContainText('8 × 8');
    await expect(rows(page).first().locator('img')).toHaveAttribute('src', /^blob:/);

    await expect(page.getByLabel('Data URL', { exact: true })).toHaveValue(
      `data:image/png;base64,${SAMPLE_PNG_BASE64}`,
    );
    await expect(page.getByLabel('Base64', { exact: true })).toHaveValue(SAMPLE_PNG_BASE64);
    await expect(page.getByLabel('HTML img tag', { exact: true })).toHaveValue(
      new RegExp('^<img src="data:image/png;base64,.+" alt="hero shot" />$'),
    );
    await expect(page.getByLabel('CSS background-image', { exact: true })).toHaveValue(
      /^background-image: url\('data:image\/png;base64,.+'\);$/,
    );
    await expect(page.getByLabel('Markdown image', { exact: true })).toHaveValue(
      /^!\[hero shot]\(data:image\/png;base64,.+\)$/,
    );

    const copied = await clickCopy(page, page.getByRole('button', { name: 'Copy data URL' }));
    expect(copied).toBe(`data:image/png;base64,${SAMPLE_PNG_BASE64}`);

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download the data URL for hero-shot.png' }).click();
    expect((await download).suggestedFilename()).toBe('hero-shot-base64.txt');
  });

  test('handles a batch and lets you switch which file is shown', async ({ page }) => {
    await page.goto('/tools/image-to-base64/');
    await page.locator('[data-file]').setInputFiles([pngFile('one.png'), pngFile('two.png')]);

    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('[data-totals]')).toContainText('2 images');
    await expect(page.locator('[data-selected-name]')).toContainText('one.png · PNG');

    await page.getByRole('button', { name: 'Show snippets for two.png' }).click();
    await expect(page.locator('[data-selected-name]')).toContainText('two.png · PNG');
    await expect(page.getByLabel('Markdown image', { exact: true })).toHaveValue(/!\[two]/);
    await expect(page.getByRole('button', { name: 'Show snippets for two.png' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('sample, rejection and clear', async ({ page }) => {
    await page.goto('/tools/image-to-base64/');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(rows(page)).toHaveCount(1);
    await expect(page.getByLabel('Data URL', { exact: true })).toHaveValue(/^data:image\/png/);

    await page
      .locator('[data-file]')
      .setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') }]);
    await expect(page.getByRole('status')).toContainText('“notes.txt” is not an image');
    await expect(page.getByRole('status')).toHaveAttribute('data-tone', 'error');
    await expect(rows(page)).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear files' }).click();
    await expect(rows(page)).toHaveCount(0);
    await expect(page.getByLabel('Data URL', { exact: true })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Copy data URL' })).toBeDisabled();
  });

  test('decodes a data URL back into a downloadable image', async ({ page }) => {
    await page.goto('/tools/image-to-base64/');
    await page.getByText('Decode', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Decode' })).toBeChecked();

    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(page.locator('[data-decoded]')).toBeVisible();
    await expect(page.locator('[data-decode-stats]')).toContainText('PNG · 87 B');
    await expect(page.locator('[data-decode-stats]')).toContainText('8 × 8');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download image' }).click();
    expect((await download).suggestedFilename()).toBe('image.png');
  });

  test('detects the format of a bare Base64 string and reports bad input', async ({ page }) => {
    await page.goto('/tools/image-to-base64/');
    await page.getByText('Decode', { exact: true }).click();
    const input = page.getByLabel('Data URL or Base64');

    await input.fill(SAMPLE_PNG_BASE64);
    await expect(page.getByRole('status')).toContainText(
      'Detected PNG from the file signature in the decoded bytes',
    );
    await expect(page.locator('[data-decoded]')).toBeVisible();

    await input.fill('data:image/png;base64,ab*d');
    await expect(page.getByRole('status')).toContainText(
      'Invalid Base64 character “*” at position 2',
    );
    await expect(page.locator('[data-decoded]')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Download image' })).toBeDisabled();

    await input.fill('aGVsbG8gdGhlcmUgZnJpZW5k');
    await expect(page.getByRole('status')).toContainText(
      'do not start with a known image signature',
    );

    await page.getByRole('button', { name: 'Clear pasted Base64' }).click();
    await expect(input).toHaveValue('');
    await expect(page.getByText('Paste a data URL or Base64 string to preview')).toBeVisible();
  });
});
