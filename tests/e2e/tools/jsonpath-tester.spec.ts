import { expect, test } from '@playwright/test';

import { expectEditorValue, expectError, fillEditor } from '../helpers';

const URL = '/tools/jsonpath-tester/';
const INPUT_ID = 'jsonpath-tester-input';
const OUTPUT_ID = 'jsonpath-tester-output';

test.describe('jsonpath-tester tool', () => {
  test('sample query returns the two books under 10', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();

    await expect(page.getByLabel('JSONPath expression')).toHaveValue(
      '$.store.book[?(@.price < 10)].title',
    );
    await expectEditorValue(page, OUTPUT_ID, /"Sayings of the Century",\s+"Moby Dick"/);
    await expect(page.locator('[data-output-stats]')).toHaveText('2 matches');
  });

  test('result type switches between values, paths and pointers', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT_ID, /Moby Dick/);

    // The radios are visually hidden; click their label text inside the group
    // (the FAQ also mentions "Paths").
    const resultType = page.getByRole('group', { name: 'Result type' });
    await resultType.getByText('Paths', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Paths' })).toBeChecked();
    await expectEditorValue(page, OUTPUT_ID, /\$\['store'\]\['book'\]\[0\]\['title'\]/);

    await resultType.getByText('Pointers', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Pointers' })).toBeChecked();
    await expectEditorValue(
      page,
      OUTPUT_ID,
      /"\/store\/book\/0\/title",\s+"\/store\/book\/2\/title"/,
    );
    await expect(page.locator('[data-output-stats]')).toHaveText('2 matches');
  });

  test('evaluates a typed expression live', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, INPUT_ID, '{"a": [1, 2, 3], "b": {"a": 4}}');
    const expression = page.getByLabel('JSONPath expression');

    await expression.fill('$.a[1:]');
    await expectEditorValue(page, OUTPUT_ID, /^\[\s*2,\s*3\s*\]$/);
    await expect(page.locator('[data-output-stats]')).toHaveText('2 matches');

    await expression.fill('$..a');
    await expect(page.locator('[data-output-stats]')).toHaveText('2 matches');

    await expression.fill('$.b.a');
    await expectEditorValue(page, OUTPUT_ID, /^\[\s*4\s*\]$/);
    await expect(page.locator('[data-output-stats]')).toHaveText('1 match');
  });

  test('an invalid expression shows a clear error', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT_ID, /Moby Dick/);

    const expression = page.getByLabel('JSONPath expression');
    await expression.fill('$.store.book[');
    await expectError(page, /Missing 1 closing "\]"/);
    await expect(expression).toHaveAttribute('aria-invalid', 'true');
    await expectEditorValue(page, OUTPUT_ID, '');
  });

  test('invalid JSON is reported with its location', async ({ page }) => {
    await page.goto(URL);
    await page.getByLabel('JSONPath expression').fill('$');
    await fillEditor(page, INPUT_ID, '{"a": 1,}');

    await expectError(page, /JSON input is not valid JSON at line 1, column \d+/);
    await expectEditorValue(page, OUTPUT_ID, '');
    await expect(page.locator('[data-output-stats]')).toHaveText('');
  });

  test('clear empties the input, the expression and the result', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT_ID, /Moby Dick/);

    await page.getByRole('button', { name: /clear/i }).click();
    await expectEditorValue(page, INPUT_ID, '');
    await expectEditorValue(page, OUTPUT_ID, '');
    await expect(page.getByLabel('JSONPath expression')).toHaveValue('');
    await expect(page.locator('[data-output-stats]')).toHaveText('');
  });

  test('download saves the result as JSON', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT_ID, /Moby Dick/);

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('jsonpath-result.json');
  });

  test.describe('clipboard', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('copy flashes Copied! and copies the result array', async ({ page }) => {
      await page.goto(URL);
      await page.getByRole('button', { name: 'Sample' }).click();
      await expectEditorValue(page, OUTPUT_ID, /Moby Dick/);

      // Locate by action, not name: the flash changes the accessible name to "Copied!".
      const copy = page.locator('button[data-action="copy"]');
      await expect(copy).toHaveText(/Copy/);
      await copy.click();
      await expect(copy).toContainText('Copied!');
      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(JSON.parse(clipboard)).toEqual(['Sayings of the Century', 'Moby Dick']);
    });
  });
});
