import { expect, test } from '@playwright/test';

import { clickCopy, expectEditorValue, expectError, fillEditor, stubClipboard } from '../helpers';

const URL = '/tools/sql-formatter/';

const INPUT = 'sql-formatter-input';
const OUTPUT = 'sql-formatter-output';

test.describe('sql-formatter tool', () => {
  test('formats a query with the library loaded on demand', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, INPUT, 'select id, name from users where active = true');
    await expectEditorValue(
      page,
      OUTPUT,
      'SELECT\n  id,\n  name\nFROM\n  users\nWHERE\n  active = TRUE',
    );
    await expect(page.getByRole('status')).toContainText('Formatted as Standard SQL');
    await expect(page.locator('[data-output-stats]')).toContainText('lines');
  });

  test('keyword case, indent and dialect change the output', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, INPUT, 'select id from users');

    await page.getByRole('combobox', { name: 'Keyword case' }).selectOption('lower');
    await expectEditorValue(page, OUTPUT, /^select\n/);

    await page.getByRole('combobox', { name: 'Indent' }).selectOption('4');
    await expectEditorValue(page, OUTPUT, /\n {4}id/);

    await page.getByRole('combobox', { name: 'Dialect' }).selectOption('postgresql');
    await expect(page.getByRole('status')).toContainText('Formatted as PostgreSQL');
  });

  test('formats the sample with its CTE, joins and subquery', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT, /WITH/);
    await expectEditorValue(page, OUTPUT, /INNER JOIN/);
    await expectEditorValue(page, OUTPUT, /LEFT JOIN/);
    const formatted = await page.locator(`#${OUTPUT}`).inputValue();
    expect(formatted.split('\n').length).toBeGreaterThan(20);
  });

  test('minify collapses the query but keeps string literals intact', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(
      page,
      INPUT,
      "select   id ,  name\nfrom   users\nwhere note = 'keep   me'  -- why\nand x = 1",
    );
    await page.getByText('Minify', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Minify' })).toBeChecked();
    await expectEditorValue(
      page,
      OUTPUT,
      "select id,name from users where note = 'keep   me' -- why\nand x = 1",
    );
    await expect(page.getByRole('status')).toContainText('Minified SQL');
    await expect(page.locator('[data-output-stats]')).toContainText('smaller');
    // Layout options do not apply while minifying.
    await expect(page.getByRole('combobox', { name: 'Keyword case' })).toBeDisabled();
  });

  test('reports a parse error with a position and a hint', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('combobox', { name: 'Dialect' }).selectOption('postgresql');
    await fillEditor(page, INPUT, "SELECT ' unclosed");
    await expectError(page, /SQL parse error/);
    await expect(page.getByRole('status')).toContainText('try a different SQL dialect');
    await expect(page.locator('.cm-lintRange-error').first()).toBeVisible();
    await expectEditorValue(page, OUTPUT, '');
  });

  test('copy flashes and clear empties everything', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(URL);
    await fillEditor(page, INPUT, 'select 1');
    await expectEditorValue(page, OUTPUT, 'SELECT\n  1');

    const copied = await clickCopy(page, page.locator('[data-action="copy"]'));
    expect(copied?.replace(/\r\n/g, '\n')).toBe('SELECT\n  1');

    await page.getByRole('button', { name: 'Clear' }).click();
    await expectEditorValue(page, INPUT, '');
    await expectEditorValue(page, OUTPUT, '');
    await expect(page.getByRole('status')).toHaveText('');
  });
});
