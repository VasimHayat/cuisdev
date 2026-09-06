import { expect, test } from '@playwright/test';

import { editorFor, expectEditorValue, expectError, fillEditor } from '../helpers';

const URL = '/tools/json-schema-validator/';
const SCHEMA_ID = 'json-schema-validator-schema';
const DATA_ID = 'json-schema-validator-data';

test.describe('json-schema-validator tool', () => {
  test('sample shows both deliberate violations and clicking one jumps to the data', async ({
    page,
  }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();

    const errors = page.locator('[data-error-list] button');
    await expect(errors).toHaveCount(2);
    await expect(errors.nth(0)).toContainText('/email');
    await expect(errors.nth(0)).toContainText('must match format "email"');
    await expect(errors.nth(0)).toContainText('format');
    await expect(errors.nth(1)).toContainText('/age');
    await expect(errors.nth(1)).toContainText('must be >= 13');
    await expect(errors.nth(1)).toContainText('minimum');
    await expectError(page, /2 errors found/);
    await expect(page.locator('[data-schema-stats]')).toContainText('Draft 2020-12');

    await errors.nth(1).click();
    await expect(editorFor(page, DATA_ID)).toBeFocused();
  });

  test('fixing the data turns the result green', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(page.locator('[data-error-list] button')).toHaveCount(2);

    await fillEditor(
      page,
      DATA_ID,
      '{"id": 42, "name": "Ada Lovelace", "email": "ada@example.com", "age": 36, "roles": ["admin"]}',
    );
    await expect(page.locator('[data-view="valid"]')).toBeVisible();
    await expect(page.locator('[data-view="valid"]')).toContainText('Valid');
    const status = page.getByRole('status').first();
    await expect(status).toContainText('Valid — no errors found (Draft 2020-12)');
    await expect(status).toHaveAttribute('data-tone', 'success');
  });

  test('invalid JSON data is reported as a data problem with its location', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, SCHEMA_ID, '{"type": "object"}');
    await fillEditor(page, DATA_ID, '{"id": 1,}');

    await expectError(page, /JSON data is not valid JSON at line 1, column \d+/);
    await expect(page.locator('[data-view="problem"]')).toBeVisible();
    await expect(page.locator('[data-problem-title]')).toHaveText('JSON data problem');
    await expect(page.locator('[data-problem-text]')).toContainText('trailing commas');
    await expect(page.locator('[data-error-list]')).toBeHidden();
  });

  test('schema compile errors are shown distinctly from data errors', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, DATA_ID, '{}');
    await fillEditor(page, SCHEMA_ID, '{"type": "banana"}');

    await expectError(page, /Schema error: Schema is invalid/);
    await expect(page.locator('[data-problem-title]')).toHaveText('Schema problem');
    await expect(page.locator('[data-problem-text]')).toContainText(
      '/type must be equal to one of the allowed values',
    );
    await expect(page.locator('[data-error-list]')).toBeHidden();
  });

  test('generate from data drafts a schema the data satisfies', async ({ page }) => {
    await page.goto(URL);
    await fillEditor(page, DATA_ID, '{"id": 1, "tags": ["a"], "price": 9.5}');
    await page.getByRole('button', { name: 'Generate from data' }).click();

    await expectEditorValue(
      page,
      SCHEMA_ID,
      /"\$schema": "https:\/\/json-schema.org\/draft\/2020-12\/schema"/,
    );
    await expectEditorValue(page, SCHEMA_ID, /"price": \{\s*"type": "number"\s*\}/);
    await expectEditorValue(page, SCHEMA_ID, /"required": \[\s*"id",\s*"tags",\s*"price"\s*\]/);
    await expect(page.locator('[data-view="valid"]')).toBeVisible();
    await expect(page.getByRole('status').first()).toContainText(
      'Generated a draft 2020-12 schema',
    );
  });

  test('clear empties both editors', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(page.locator('[data-error-list] button')).toHaveCount(2);

    await page.getByRole('button', { name: 'Clear' }).click();
    await expectEditorValue(page, SCHEMA_ID, '');
    await expectEditorValue(page, DATA_ID, '');
    await expect(page.locator('[data-view="empty"]')).toBeVisible();
    await expect(page.locator('[data-error-list]')).toBeHidden();
  });

  test.describe('clipboard', () => {
    test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

    test('copy errors as JSON flashes Copied! and copies Ajv-style errors', async ({ page }) => {
      await page.goto(URL);
      await page.getByRole('button', { name: 'Sample' }).click();
      await expect(page.locator('[data-error-list] button')).toHaveCount(2);

      // Locate by action, not name: the flash changes the accessible name to "Copied!".
      const copy = page.locator('button[data-action="copy-errors"]');
      await expect(copy).toHaveText(/Copy errors as JSON/);
      await copy.click();
      await expect(copy).toContainText('Copied!');

      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      const parsed = JSON.parse(clipboard) as { instancePath: string; keyword: string }[];
      expect(parsed.map((e) => e.instancePath)).toEqual(['/email', '/age']);
      expect(parsed.map((e) => e.keyword)).toEqual(['format', 'minimum']);
    });
  });
});
