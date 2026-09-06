import { expect, test } from '@playwright/test';

import { expectEditorValue, expectError, fillEditor } from '../helpers';

const INPUT = 'json-to-csv-input';
const OUTPUT = 'json-to-csv-output';

const PEOPLE = '[{"id":1,"name":"Ada","address":{"city":"London"}},{"id":2,"name":"Linus, Jr."}]';

test.describe('json-to-csv tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/json-to-csv/');
  });

  test('converts JSON to CSV live, shows row counts and swaps back to JSON', async ({ page }) => {
    await fillEditor(page, INPUT, PEOPLE);
    await expectEditorValue(page, OUTPUT, 'id,name,address.city\n1,Ada,London\n2,"Linus, Jr.",\n');
    await expect(page.locator('[data-output-stats]')).toContainText('2 rows · 3 columns');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('radio', { name: 'CSV → JSON' })).toBeChecked();
    await expectEditorValue(page, INPUT, /id,name,address.city/);
    await expectEditorValue(page, OUTPUT, /"name": "Linus, Jr\."/);
    await expect(page.locator('[data-output-stats]')).toContainText('comma delimiter');
  });

  test('delimiter, header and quote-all options change the CSV', async ({ page }) => {
    await fillEditor(page, INPUT, '[{"a":1,"b":"x"}]');
    await expectEditorValue(page, OUTPUT, 'a,b\n1,x\n');

    await page.getByLabel('Output delimiter').selectOption('Semicolon (;)');
    await expectEditorValue(page, OUTPUT, 'a;b\n1;x\n');

    await page.getByRole('checkbox', { name: 'Header row' }).uncheck();
    await expectEditorValue(page, OUTPUT, '1;x\n');

    await page.getByRole('checkbox', { name: 'Quote all fields' }).check();
    await expectEditorValue(page, OUTPUT, '"1";"x"\n');
  });

  test('converts CSV to JSON with typing, header and minify options', async ({ page }) => {
    await page.getByText('CSV → JSON', { exact: true }).click();
    await fillEditor(page, INPUT, 'name;age\nAda;36\n');
    await expectEditorValue(page, OUTPUT, '[\n  {\n    "name": "Ada",\n    "age": "36"\n  }\n]\n');
    await expect(page.locator('[data-output-stats]')).toContainText('1 row · 2 columns');

    await page.getByRole('checkbox', { name: 'Detect numbers and booleans' }).check();
    await expect(page.locator(`#${OUTPUT}`)).toHaveValue(/"age": 36/);

    await page.getByRole('checkbox', { name: 'Minified JSON' }).check();
    await expectEditorValue(page, OUTPUT, '[{"name":"Ada","age":36}]\n');

    await page.getByRole('checkbox', { name: 'First row is header' }).uncheck();
    await expectEditorValue(page, OUTPUT, '[["name","age"],["Ada",36]]\n');
  });

  test('explicit input delimiter overrides auto-detection', async ({ page }) => {
    await page.getByText('CSV → JSON', { exact: true }).click();
    await fillEditor(page, INPUT, 'a|b\n1,x|2\n');
    await page.getByLabel('Input delimiter').selectOption('Pipe (|)');
    await expectEditorValue(page, OUTPUT, /"a": "1,x"/);
    await expect(page.locator('[data-output-stats]')).toContainText('pipe delimiter');
  });

  test('explains when the JSON is not an array of objects', async ({ page }) => {
    await fillEditor(page, INPUT, '{"data":[{"a":1}]}');
    await expectError(page, /must be an array of objects.*under "data"/);
    await expectEditorValue(page, OUTPUT, '');
  });

  test('underlines invalid JSON with its position', async ({ page }) => {
    await fillEditor(page, INPUT, '[{"a":1,}]');
    await expectError(page, /Invalid JSON at line 1, column 9/);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
  });

  test('reports an unterminated quote in CSV', async ({ page }) => {
    await page.getByText('CSV → JSON', { exact: true }).click();
    await fillEditor(page, INPUT, 'a,b\n1,"oops\n');
    await expectError(page, /Invalid CSV at line 2, column 4/);
    await expectEditorValue(page, OUTPUT, '');
  });

  test('sample, copy and clear', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT, /id,name,email,address.city/);
    await expect(page.locator('[data-output-stats]')).toContainText('3 rows');

    const copy = page.getByRole('button', { name: /^Cop(y|ied!)$/ });
    await copy.click();
    await expect(copy).toHaveText(/Copied!/);

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expectEditorValue(page, INPUT, '');
    await expectEditorValue(page, OUTPUT, '');
    await expect(page.getByRole('status')).toHaveText('');
  });

  test('downloads with the right extension for each direction', async ({ page }) => {
    await fillEditor(page, INPUT, '[{"a":1}]');
    await expectEditorValue(page, OUTPUT, 'a\n1\n');
    let download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('converted.csv');

    await page.getByLabel('Output delimiter').selectOption('Tab');
    await expectEditorValue(page, OUTPUT, 'a\n1\n');
    download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('converted.tsv');

    await page.getByRole('button', { name: /swap/i }).click();
    await expectEditorValue(page, OUTPUT, /"a"/);
    download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('converted.json');
  });
});
