import { expect, test } from '@playwright/test';

import { clickCopy, expectEditorValue, expectError, fillEditor, stubClipboard } from '../helpers';

const URL = '/tools/code-formatter/';

const INPUT = 'code-formatter-input';
const OUTPUT = 'code-formatter-output';

test.describe('code-formatter tool', () => {
  test('beautifies JavaScript with Prettier loaded on demand', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, INPUT, 'const a={b:1,c:[1,2]}');
    await expectEditorValue(page, OUTPUT, 'const a = { b: 1, c: [1, 2] };\n');
    await expect(page.getByRole('status')).toContainText('Formatted as JavaScript');
    await expect(page.locator('[data-output-stats]')).toContainText('lines');
  });

  test('indent, print width and quote options change the output', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(
      page,
      INPUT,
      'function f(alpha,beta){const label="x";return {alpha,beta,label}}',
    );
    await expectEditorValue(page, OUTPUT, /\n {2}const label = "x";/);

    await page.getByRole('combobox', { name: 'Indent' }).selectOption('4');
    await expectEditorValue(page, OUTPUT, /\n {4}const label = "x";/);

    await page.getByRole('checkbox', { name: 'Single quotes' }).check();
    await expectEditorValue(page, OUTPUT, /const label = 'x';/);

    await page.getByRole('checkbox', { name: 'Semicolons' }).uncheck();
    await expectEditorValue(page, OUTPUT, /const label = 'x'\n/);
  });

  test('minifies JavaScript with terser and reports the saving', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(page.getByRole('status')).toContainText('Formatted as JavaScript');

    await page.getByText('Minify', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Minify' })).toBeChecked();
    await expect(page.getByRole('status')).toContainText('Minified JavaScript');
    await expect(page.locator('[data-output-stats]')).toContainText('smaller');

    const minified = await page.locator(`#${OUTPUT}`).inputValue();
    expect(minified.split('\n').length).toBe(1);
    expect(minified).toContain('loadOrders');
    // The beautify options do not apply while minifying.
    await expect(page.getByRole('combobox', { name: 'Indent' })).toBeDisabled();
  });

  test('minifies HTML while preserving <pre> and conditional comments', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('combobox', { name: 'Language' }).selectOption('html');
    await page.getByText('Minify', { exact: true }).click();
    await fillEditor(
      page,
      INPUT,
      '<ul>\n  <li>one</li>\n</ul>\n<!-- drop -->\n<pre>  keep   me  </pre>',
    );
    await expectEditorValue(page, OUTPUT, '<ul><li>one</li></ul><pre>  keep   me  </pre>');
  });

  test('minifies CSS with csso and JSON with JSON.stringify', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('combobox', { name: 'Language' }).selectOption('css');
    await page.getByText('Minify', { exact: true }).click();
    await fillEditor(page, INPUT, 'a { color : red; }  /* gone */');
    await expectEditorValue(page, OUTPUT, 'a{color:red}');

    await page.getByRole('combobox', { name: 'Language' }).selectOption('json');
    await fillEditor(page, INPUT, '{\n  "a": [1, 2]\n}');
    await expectEditorValue(page, OUTPUT, '{"a":[1,2]}');
  });

  test('reports a syntax error with a position and underlines it', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, INPUT, 'const a = {');
    await expectError(page, /JavaScript syntax error/);
    await expect(page.getByRole('status')).toContainText(/line \d+, column \d+/);
    await expect(page.locator('.cm-lintRange-error').first()).toBeVisible();
    await expectEditorValue(page, OUTPUT, '');
  });

  test('disables Minify for TypeScript and explains why', async ({ page }) => {
    await page.goto(URL);
    await page.getByText('Minify', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Minify' })).toBeChecked();

    await page.getByRole('combobox', { name: 'Language' }).selectOption('typescript');
    await expect(page.getByRole('radio', { name: 'Minify' })).toBeDisabled();
    await expect(page.getByRole('radio', { name: 'Beautify' })).toBeChecked();
    await expectError(page, /Minify is not available for TypeScript/);

    await fillEditor(page, INPUT, 'const x:number=1');
    await expectEditorValue(page, OUTPUT, 'const x: number = 1;\n');
  });

  test('copy flashes and clear empties everything', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(URL);
    await fillEditor(page, INPUT, 'const a=1');
    await expectEditorValue(page, OUTPUT, 'const a = 1;\n');

    const copied = await clickCopy(page, page.locator('[data-action="copy"]'));
    expect(copied?.replace(/\r\n/g, '\n')).toBe('const a = 1;\n');

    await page.getByRole('button', { name: 'Clear' }).click();
    await expectEditorValue(page, INPUT, '');
    await expectEditorValue(page, OUTPUT, '');
    await expect(page.getByRole('status')).toHaveText('');
  });
});
