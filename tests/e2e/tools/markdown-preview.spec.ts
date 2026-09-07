import { expect, test } from '@playwright/test';

import { clickCopy, expectError, fillEditor, settle, stubClipboard } from '../helpers';

const URL = '/tools/markdown-preview/';
const EDITOR = 'markdown-preview-input';

test.describe('markdown-preview tool', () => {
  test('renders Markdown as you type', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, EDITOR, '# Title\n\nSome **bold** text and a `snippet`.');

    const preview = page.locator('[data-preview]');
    await expect(preview.locator('h1')).toHaveText('Title');
    await expect(preview.locator('strong')).toHaveText('bold');
    await expect(preview.locator('code')).toHaveText('snippet');
    await expect(page.locator('[data-stats]')).toContainText('words');
  });

  test('GitHub Flavored Markdown can be switched off', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, EDITOR, '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n~~gone~~');

    const preview = page.locator('[data-preview]');
    await expect(preview.locator('table')).toBeVisible();
    await expect(preview.locator('del')).toHaveText('gone');

    await page.getByRole('checkbox', { name: 'GitHub Flavored Markdown' }).uncheck();
    await settle(page);
    await expect(preview.locator('table')).toHaveCount(0);
    await expect(preview.locator('del')).toHaveCount(0);
  });

  test('the line breaks option turns newlines into <br>', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, EDITOR, 'first line\nsecond line');

    const preview = page.locator('[data-preview]');
    await expect(preview.locator('br')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Line breaks' }).check();
    await settle(page);
    await expect(preview.locator('br')).toHaveCount(1);
  });

  test('shows the sanitised HTML source', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, EDITOR, '## Heading\n\n- one\n- two');

    await page.getByText('HTML source', { exact: true }).click();
    const source = page.getByLabel('Sanitised HTML');
    await expect(source).toBeVisible();
    await expect(source).toHaveValue(/<h2>Heading<\/h2>/);
    await expect(source).toHaveValue(/<li>one<\/li>/);
    await expect(page.locator('[data-preview]')).toBeHidden();
  });

  test('strips scripts, event handlers and javascript: URLs', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(
      page,
      EDITOR,
      [
        '# Safe',
        '',
        '<script>window.__pwned = true;<' + '/script>',
        '',
        '<img src="x" onerror="window.__pwned = true">',
        '',
        '<p style="color:red">styled</p>',
        '',
        '[click me](javascript:window.__pwned=true)',
      ].join('\n'),
    );

    const preview = page.locator('[data-preview]');
    await expect(preview.locator('h1')).toHaveText('Safe');
    expect(await preview.locator('script').count()).toBe(0);
    expect(await page.evaluate(() => (window as { __pwned?: boolean }).__pwned)).toBeUndefined();

    const dangerous = await preview.evaluate((el) => ({
      html: el.innerHTML,
      imgHasHandler: el.querySelector('img')?.hasAttribute('onerror') ?? false,
      styled: el.querySelector('p')?.hasAttribute('style') ?? false,
      linkHref: el.querySelector('a')?.getAttribute('href'),
    }));
    expect(dangerous.html).not.toContain('<script');
    expect(dangerous.html).not.toContain('onerror');
    expect(dangerous.imgHasHandler).toBe(false);
    expect(dangerous.styled).toBe(false);
    expect(dangerous.linkHref).toBeNull();
  });

  test('hardens external links', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, EDITOR, 'Read the [guide](https://example.com/guide).');

    const link = page.locator('[data-preview] a');
    await expect(link).toHaveAttribute('href', 'https://example.com/guide');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  test('copies the rendered HTML', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(URL);
    await fillEditor(page, EDITOR, '# Copy me');
    // marked/DOMPurify load lazily; wait for the render before copying.
    await expect(page.locator('[data-preview] h1')).toHaveText('Copy me');

    const copied = await clickCopy(page, page.locator('[data-action="copy-html"]'));
    expect(copied?.replace(/\r\n/g, '\n')).toContain('<h1>Copy me</h1>');
  });

  test('explains that there is nothing to copy yet', async ({ page }) => {
    await page.goto(URL);
    await page.locator('[data-action="copy-html"]').click();
    await expectError(page, 'nothing to copy yet');
  });

  test('sample loads a full document and clear empties it', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);

    const preview = page.locator('[data-preview]');
    await expect(preview.locator('h1')).toContainText('Release notes');
    await expect(preview.locator('table')).toBeVisible();
    await expect(preview.locator('pre code')).toContainText('greet');
    await expect(preview.locator('input[type="checkbox"]').first()).toBeDisabled();

    await page.getByRole('button', { name: 'Clear' }).click();
    await settle(page);
    await expect(preview.locator('h1')).toHaveCount(0);
    await expect(page.locator(`#${EDITOR}`)).toHaveValue('');
  });
});
