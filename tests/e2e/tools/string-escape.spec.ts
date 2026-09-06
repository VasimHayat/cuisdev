import { expect, test } from '@playwright/test';

import { expectError, fillEditor } from '../helpers';

test.describe('string-escape tool', () => {
  test('escapes for JSON live and swaps back to unescape', async ({ page }) => {
    await page.goto('/tools/string-escape/');
    const output = page.getByLabel('Escaped', { exact: true });

    await fillEditor(page, 'string-escape-input', 'say "hi"\\ok');
    await expect(output).toHaveValue('say \\"hi\\"\\\\ok');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('radio', { name: 'Unescape' })).toBeChecked();
    await expect(page.getByLabel('Escaped JSON string to unescape')).toHaveValue(
      'say \\"hi\\"\\\\ok',
    );
    await expect(page.getByLabel('Unescaped')).toHaveValue('say "hi"\\ok');
  });

  test('the target changes the escaping and the hint', async ({ page }) => {
    await page.goto('/tools/string-escape/');
    const output = page.getByLabel('Escaped', { exact: true });
    const targetSelect = page.getByLabel('Target');
    await fillEditor(page, 'string-escape-input', "it's <b>&</b>");

    await targetSelect.selectOption('shell');
    await expect(output).toHaveValue("'it'\\''s <b>&</b>'");
    await expect(page.locator('[data-hint]')).toContainText('single quotes');

    await targetSelect.selectOption('html-attribute');
    await expect(output).toHaveValue('it&#39;s &lt;b&gt;&amp;&lt;/b&gt;');

    await targetSelect.selectOption('sql');
    await expect(output).toHaveValue("it''s <b>&</b>");
  });

  test('reports a bad escape sequence with its offset when unescaping', async ({ page }) => {
    await page.goto('/tools/string-escape/');
    await page.getByText('Unescape', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Unescape' })).toBeChecked();
    await fillEditor(page, 'string-escape-input', 'ab\\qcd');
    await expectError(page, /Unknown escape "\\q" at offset 2/);
    await expect(page.getByLabel('Unescaped')).toHaveValue('');
  });

  test('regex and SQL are escape-only: Unescape and Swap are disabled with a hint', async ({
    page,
  }) => {
    await page.goto('/tools/string-escape/');
    await page.getByText('Unescape', { exact: true }).click();
    await page.getByLabel('Target').selectOption('regex');

    const unescapeRadio = page.getByRole('radio', { name: 'Unescape' });
    await expect(unescapeRadio).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Escape', exact: true })).toBeChecked();
    await expect(page.getByRole('button', { name: /swap/i })).toBeDisabled();
    await expect(page.locator('[data-hint]')).toContainText('Unescape is unavailable');

    await fillEditor(page, 'string-escape-input', '1.5*(a+b)?');
    await expect(page.getByLabel('Escaped', { exact: true })).toHaveValue('1\\.5\\*\\(a\\+b\\)\\?');

    await page.getByLabel('Target').selectOption('json');
    await expect(unescapeRadio).toBeEnabled();
    await expect(page.getByRole('button', { name: /swap/i })).toBeEnabled();
  });

  test('sample, copy and clear', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/string-escape/');
    await page.getByRole('button', { name: 'Sample' }).click();
    const output = page.getByLabel('Escaped', { exact: true });
    await expect(output).toHaveValue(/\\"it's in C:\\\\temp\\"\\n/);

    // Located by its stable hook: while flashing, the accessible name is "Copied!", not "Copy".
    const copy = page.locator('[data-action="copy"]');
    await copy.click();
    await expect(copy).toContainText('Copied!');

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expect(page.getByLabel('Text to escape')).toHaveValue('');
    await expect(output).toHaveValue('');
  });
});
