import { expect, test } from '@playwright/test';

import { clickCopy, fillEditor, settle, stubClipboard } from '../helpers';

const FOX = 'The quick brown fox jumps over the lazy dog.';

test.describe('word-counter tool', () => {
  test('counts words, characters, sentences and lines live', async ({ page }) => {
    await page.goto('/tools/word-counter/');
    await fillEditor(page, 'word-counter-input', FOX);

    await expect(page.locator('[data-stat="words"]')).toHaveText('9');
    await expect(page.locator('[data-stat="characters"]')).toHaveText('44');
    await expect(page.locator('[data-stat="charactersNoSpaces"]')).toHaveText('36');
    await expect(page.locator('[data-stat="uniqueWords"]')).toHaveText('8');
    await expect(page.locator('[data-stat="sentences"]')).toHaveText('1');
    await expect(page.locator('[data-stat="paragraphs"]')).toHaveText('1');
    await expect(page.locator('[data-stat="lines"]')).toHaveText('1');
    await expect(page.locator('[data-stat="longestWord"]')).toHaveText('quick');
    await expect(page.locator('[data-stat="bytes"]')).toContainText('44 bytes');
    await expect(page.locator('[data-stat="readingSeconds"]')).toHaveText('3 sec');
  });

  test('reading time follows the words-per-minute box and rejects bad values', async ({ page }) => {
    await page.goto('/tools/word-counter/');
    await fillEditor(
      page,
      'word-counter-input',
      Array.from({ length: 400 }, () => 'word').join(' '),
    );
    await expect(page.locator('[data-stat="readingSeconds"]')).toHaveText('2 min');

    const wpm = page.getByLabel('Reading speed (wpm)');
    await wpm.fill('250');
    await settle(page);
    await expect(page.locator('[data-reading-label]')).toHaveText('Reading time (250 wpm)');
    await expect(page.locator('[data-stat="readingSeconds"]')).toHaveText('1 min 36 sec');

    await wpm.fill('0');
    await settle(page);
    const status = page.getByRole('status').last();
    await expect(status).toContainText('Reading speed must be a number between 50 and 1000');
    await expect(status).toHaveAttribute('data-tone', 'error');
    await expect(wpm).toHaveAttribute('aria-invalid', 'true');
  });

  test('character limits count down and go negative', async ({ page }) => {
    await page.goto('/tools/word-counter/');
    await fillEditor(page, 'word-counter-input', 'a'.repeat(100));

    await expect(page.getByLabel('Twitter/X characters remaining')).toHaveText('180 left');
    await expect(page.getByLabel('Title tag characters remaining')).toHaveText('40 over');
    await expect(page.getByLabel('Title tag characters remaining')).toHaveAttribute(
      'data-over',
      'true',
    );
  });

  test('top words respects the stop-word toggle', async ({ page }) => {
    await page.goto('/tools/word-counter/');
    await fillEditor(page, 'word-counter-input', 'the cat sat on the mat the cat ran');

    const firstWord = page.locator('[data-top-row="0"] [data-top-word]');
    await expect(firstWord).toHaveText('cat');

    await page.getByRole('checkbox', { name: /Ignore common words/ }).uncheck();
    await settle(page);
    await expect(firstWord).toHaveText('the');
    await expect(page.locator('[data-top-row="0"] [data-top-count]')).toHaveText('3');
  });

  test('sample, copy stats and clear', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/word-counter/');

    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);
    await expect(page.getByLabel('Text to count')).toHaveValue(/Writing is thinking/);
    await expect(page.locator('[data-stat="paragraphs"]')).toHaveText('2');

    const copied = (await clickCopy(page, page.locator('[data-action="copy-stats"]'))) ?? '';
    const report = copied.replace(/\r\n/g, '\n');
    expect(report).toContain('Words: ');
    expect(report).toContain('Reading time (200 wpm): ');
    expect(report).toContain('Top words:');

    await page.getByRole('button', { name: 'Clear input' }).click();
    await settle(page);
    await expect(page.getByLabel('Text to count')).toHaveValue('');
    await expect(page.locator('[data-stat="words"]')).toHaveText('0');
    await expect(page.locator('[data-stat="longestWord"]')).toHaveText('—');
  });
});
