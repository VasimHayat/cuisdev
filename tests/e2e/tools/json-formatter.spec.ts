import { expect, test } from '@playwright/test';

import {
  clickCopy,
  expectEditorValue,
  expectError,
  fillEditor,
  stubClipboard,
  typeInEditor,
} from '../helpers';

const URL = '/tools/json-formatter/';

test.describe('json-formatter tool', () => {
  test('formats typed JSON live and reports stats', async ({ page }) => {
    await page.goto(URL);
    await typeInEditor(page, 'json-formatter-input', '{"b":1,"a":[true,null]}');
    await expectEditorValue(
      page,
      'json-formatter-output',
      '{\n  "b": 1,\n  "a": [\n    true,\n    null\n  ]\n}',
    );
    await expect(page.getByRole('status')).toContainText('Valid JSON');
    await expect(page.locator('[data-output-stats]')).toContainText('2 keys');
  });

  test('indent, sort keys and minify change the output', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, 'json-formatter-input', '{"b":1,"a":2}');
    await page.getByText('4 spaces', { exact: true }).click();
    await expectEditorValue(page, 'json-formatter-output', '{\n    "b": 1,\n    "a": 2\n}');
    await page.getByLabel('Sort keys').check();
    await expectEditorValue(page, 'json-formatter-output', '{\n    "a": 2,\n    "b": 1\n}');
    await page.getByRole('button', { name: 'Minify' }).click();
    await expectEditorValue(page, 'json-formatter-output', '{"a":2,"b":1}');
  });

  test('shows line/column, a hint, and offers a one-click fix', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, 'json-formatter-input', '{\n  "a": 1,\n}');
    await expectError(page, /line 3, column 1/);
    await expect(page.getByRole('status')).toContainText('Trailing comma');
    await expect(page.locator('.cm-lintRange-error').first()).toBeVisible();
    await page.getByRole('button', { name: 'Fix common mistakes' }).click();
    await expect(page.getByRole('status')).toContainText('Valid JSON');
    await expectEditorValue(page, 'json-formatter-output', '{\n  "a": 1\n}');
  });

  test('repairs JavaScript-style input', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, 'json-formatter-input', "{ host: 'localhost', // dev\n  port: 8080, }");
    await expectError(page, /quoted property name|Unexpected/);
    await page.getByRole('button', { name: 'Fix common mistakes' }).click();
    await expectEditorValue(
      page,
      'json-formatter-output',
      '{\n  "host": "localhost",\n  "port": 8080\n}',
    );
  });

  test('tree view renders nodes and can collapse/expand', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await page.getByText('Tree', { exact: true }).click();
    const tree = page.getByRole('tree', { name: 'JSON tree view' });
    await expect(tree).toBeVisible();
    await expect(tree.locator('.json-tree__key', { hasText: /^roles$/ })).toBeVisible();
    await expect(
      tree.locator('.json-tree__value--string', { hasText: '"Ada Lovelace"' }),
    ).toBeVisible();
    // Deeper nodes start collapsed
    await expect(tree.locator('.json-tree__value--string', { hasText: '"London"' })).toBeHidden();
    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(tree.locator('.json-tree__value--string', { hasText: '"London"' })).toBeVisible();
    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(tree.locator('details[open]')).toHaveCount(0);
  });

  test('copy flashes and clear empties everything', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(URL);
    await fillEditor(page, 'json-formatter-input', '[1]');
    const copied = await clickCopy(page, page.getByRole('button', { name: 'Copy' }));
    expect(copied).toBe('[\n  1\n]');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expectEditorValue(page, 'json-formatter-input', '');
    await expectEditorValue(page, 'json-formatter-output', '');
    await expect(page.getByRole('status')).toHaveText('');
  });
});
