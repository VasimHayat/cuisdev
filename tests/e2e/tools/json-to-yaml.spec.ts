import { expect, test } from '@playwright/test';

import { expectEditorValue, expectError, fillEditor } from '../helpers';

const INPUT = 'json-to-yaml-input';
const OUTPUT = 'json-to-yaml-output';

test.describe('json-to-yaml tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/tools/json-to-yaml/');
  });

  test('converts JSON to YAML live and swaps back to JSON', async ({ page }) => {
    await fillEditor(page, INPUT, '{"name":"app","ports":[80,443]}');
    await expectEditorValue(page, OUTPUT, 'name: app\nports:\n  - 80\n  - 443\n');
    await expect(page.locator('[data-output-stats]')).toContainText('4 lines');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('radio', { name: 'YAML → JSON' })).toBeChecked();
    await expectEditorValue(page, INPUT, /name: app/);
    await expectEditorValue(
      page,
      OUTPUT,
      '{\n  "name": "app",\n  "ports": [\n    80,\n    443\n  ]\n}\n',
    );
  });

  test('converts YAML to JSON with the minified option', async ({ page }) => {
    await page.getByText('YAML → JSON', { exact: true }).click();
    // Continuation lines are not indented: the browser turns leading spaces typed
    // into a contenteditable into non-breaking spaces, which YAML rightly rejects.
    await fillEditor(page, INPUT, 'a: 1\nb:\n- x\n- y\n');
    await expectEditorValue(page, OUTPUT, '{\n  "a": 1,\n  "b": [\n    "x",\n    "y"\n  ]\n}\n');

    await page.getByRole('checkbox', { name: 'Minified JSON' }).check();
    await expectEditorValue(page, OUTPUT, '{"a":1,"b":["x","y"]}\n');
  });

  test('indent option changes the YAML output', async ({ page }) => {
    await fillEditor(page, INPUT, '{"a":{"b":1}}');
    await expectEditorValue(page, OUTPUT, 'a:\n  b: 1\n');
    await page.getByLabel('Indent').selectOption('4');
    await expectEditorValue(page, OUTPUT, 'a:\n    b: 1\n');
  });

  test('shows a positioned error for invalid JSON and underlines it', async ({ page }) => {
    await fillEditor(page, INPUT, '{"a": 1,}');
    await expectError(page, /Invalid JSON at line 1, column 9/);
    await expect(page.locator('.cm-lintRange-error')).toHaveCount(1);
    await expectEditorValue(page, OUTPUT, '');
  });

  test('shows a positioned error for invalid YAML', async ({ page }) => {
    await page.getByText('YAML → JSON', { exact: true }).click();
    await fillEditor(page, INPUT, 'a: [1, 2\nb: 3');
    await expectError(page, /Invalid YAML at line 2, column 1/);
  });

  test('sample, copy and clear', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expectEditorValue(page, OUTPUT, /service: checkout-api/);

    const copy = page.getByRole('button', { name: /^Cop(y|ied!)$/ });
    await copy.click();
    await expect(copy).toHaveText(/Copied!/);

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expectEditorValue(page, INPUT, '');
    await expectEditorValue(page, OUTPUT, '');
    await expect(page.getByRole('status')).toHaveText('');
  });

  test('downloads the output with the right extension', async ({ page }) => {
    await fillEditor(page, INPUT, '{"a":1}');
    await expectEditorValue(page, OUTPUT, 'a: 1\n');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download' }).click();
    expect((await download).suggestedFilename()).toBe('converted.yaml');
  });
});
