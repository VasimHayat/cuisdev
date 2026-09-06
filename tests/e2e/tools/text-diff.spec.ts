import { expect, test } from '@playwright/test';

import { clickCopy, fillEditor, settle, stubClipboard } from '../helpers';

const ORIGINAL = 'alpha\nbravo\ncharlie';
const CHANGED = 'alpha\nBRAVO\ncharlie\ndelta';

/** Below 64em the tool always renders the inline view. */
function isNarrow(width: number | undefined): boolean {
  return (width ?? 1280) < 1024;
}

test.describe('text-diff tool', () => {
  test('compares two texts live', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await fillEditor(page, 'text-diff-original', ORIGINAL);
    await fillEditor(page, 'text-diff-changed', CHANGED);

    const view = page.locator('[data-view]');
    await expect(view).toContainText('BRAVO');
    await expect(view).toContainText('delta');
    await expect(page.locator('[data-stats]')).toHaveText(
      '2 additions · 1 deletion · 2 unchanged lines',
    );
    await expect(page.locator('[data-original-stats]')).toHaveText('3 lines');
    await expect(page.locator('[data-changed-stats]')).toHaveText('4 lines');
  });

  test('reports identical texts and respects ignore case', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await fillEditor(page, 'text-diff-original', 'Hello World');
    await fillEditor(page, 'text-diff-changed', 'hello world');
    await expect(page.locator('[data-stats]')).toHaveText(
      '1 addition · 1 deletion · 0 unchanged lines',
    );

    await page.getByRole('checkbox', { name: 'Ignore case' }).check();
    await settle(page);
    await expect(page.locator('[data-view]')).toContainText('The two texts are identical.');
    await expect(page.getByRole('status').first()).toContainText('No differences found.');
  });

  test('word granularity highlights the changed words only', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await fillEditor(page, 'text-diff-original', 'the quick brown fox');
    await fillEditor(page, 'text-diff-changed', 'the slow brown fox');

    await page.getByRole('combobox', { name: 'Compare by' }).selectOption('words');
    await settle(page);
    await expect(page.locator('.diff__seg--removed')).toHaveText('quick');
    await expect(page.locator('.diff__seg--added')).toHaveText('slow');
  });

  test('switches between side-by-side and inline views', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await fillEditor(page, 'text-diff-original', ORIGINAL);
    await fillEditor(page, 'text-diff-changed', CHANGED);

    if (!isNarrow(page.viewportSize()?.width)) {
      // Side by side pairs the modified line into one row.
      await expect(page.locator('.diff__line--changed')).toHaveCount(1);
    }

    // The radio itself is visually hidden; click its label text.
    await page.getByText('Inline', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Inline' })).toBeChecked();
    await settle(page);
    await expect(page.locator('.diff__line--changed')).toHaveCount(0);
    await expect(page.locator('.diff__line--removed')).toHaveCount(1);
    await expect(page.locator('.diff__line--added')).toHaveCount(2);
  });

  test('shows a helpful error when character mode gets too much text', async ({ page }) => {
    await page.goto('/tools/text-diff/');
    await page.getByRole('combobox', { name: 'Compare by' }).selectOption('chars');
    await fillEditor(page, 'text-diff-original', 'a'.repeat(100_001));
    await fillEditor(page, 'text-diff-changed', 'b');

    const status = page.getByRole('status').first();
    await expect(status).toContainText('Character-by-character comparison is limited to 100,000');
    await expect(status).toHaveAttribute('data-tone', 'error');
  });

  test('sample, swap, copy and clear', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/text-diff/');

    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);
    await expect(page.getByLabel('Original')).toHaveValue(/listen 80;/);
    await expect(page.getByLabel('Changed')).toHaveValue(/listen 443 ssl;/);
    await expect(page.locator('[data-stats]')).toContainText('5 additions · 4 deletions');

    await page.getByRole('button', { name: 'Swap sides' }).click();
    await settle(page);
    await expect(page.getByLabel('Original')).toHaveValue(/listen 443 ssl;/);
    await expect(page.locator('[data-stats]')).toContainText('4 additions · 5 deletions');

    const copied = await clickCopy(page, page.locator('[data-action="copy"]'));
    const patch = (copied ?? '').replace(/\r\n/g, '\n');
    expect(patch).toContain('--- a/original.txt');
    expect(patch).toContain('+++ b/changed.txt');
    expect(patch).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(patch).toContain('-  listen 443 ssl;');

    await page.getByRole('button', { name: 'Clear both texts' }).click();
    await settle(page);
    await expect(page.getByLabel('Original')).toHaveValue('');
    await expect(page.getByLabel('Changed')).toHaveValue('');
    await expect(page.locator('[data-view]')).toContainText('Paste or type both versions above');
  });
});
