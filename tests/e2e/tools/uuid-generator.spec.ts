import { expect, test } from '@playwright/test';

import { expectError } from '../helpers';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test.describe('uuid-generator tool', () => {
  test('generates v4 UUIDs on load and regenerates on click', async ({ page }) => {
    await page.goto('/tools/uuid-generator/');
    const output = page.getByLabel('Generated UUIDs');
    await expect(output).not.toHaveValue('');
    const first = (await output.inputValue()).split('\n');
    expect(first).toHaveLength(5);
    for (const id of first) expect(id).toMatch(V4);

    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    const second = (await output.inputValue()).split('\n');
    expect(second).not.toEqual(first);
    await expect(page.getByRole('status')).toContainText('Generated 5 v4 UUIDs locally');
  });

  test('v7 with count, uppercase, no hyphens and JSON format', async ({ page }) => {
    await page.goto('/tools/uuid-generator/');
    await page.getByText('v7 time-ordered', { exact: true }).click();
    await page.getByLabel('Count').fill('3');
    const output = page.getByLabel('Generated UUIDs');
    await expect(output).toHaveValue(/^([0-9a-f-]{36}\n){2}[0-9a-f-]{36}$/);
    const ids = (await output.inputValue()).split('\n');
    for (const id of ids) expect(id).toMatch(V7);
    expect([...ids].sort()).toEqual(ids);

    await page.getByLabel('Format').selectOption('json');
    await expect(output).toHaveValue(/^\[\n {2}"[0-9a-f-]{36}",\n/);
    await page.getByRole('checkbox', { name: 'Uppercase' }).check();
    await page.getByRole('checkbox', { name: 'Remove hyphens' }).check();
    const json = JSON.parse(await output.inputValue()) as string[];
    expect(json).toHaveLength(3);
    for (const id of json) expect(id).toMatch(/^[0-9A-F]{32}$/);
  });

  test('nil and max versions, quotes and TypeScript array', async ({ page }) => {
    await page.goto('/tools/uuid-generator/');
    const output = page.getByLabel('Generated UUIDs');
    await page.getByLabel('Count').fill('2');
    await page.getByText('Nil', { exact: true }).click();
    await expect(output).toHaveValue(
      '00000000-0000-0000-0000-000000000000\n00000000-0000-0000-0000-000000000000',
    );
    await page.getByRole('checkbox', { name: 'Wrap in quotes' }).check();
    await expect(output).toHaveValue(/^"0{8}-/);
    await page.getByText('Max', { exact: true }).click();
    await page.getByLabel('Format').selectOption('ts');
    await expect(output).toHaveValue(
      "const uuids: string[] = [\n  'ffffffff-ffff-ffff-ffff-ffffffffffff',\n  'ffffffff-ffff-ffff-ffff-ffffffffffff',\n];",
    );
  });

  test('rejects an out-of-range count', async ({ page }) => {
    await page.goto('/tools/uuid-generator/');
    await page.getByLabel('Count').fill('5000');
    await expectError(page, 'between 1 and 1000');
    await expect(page.getByLabel('Count')).toHaveAttribute('aria-invalid', 'true');
  });

  test('inspects a pasted v7 UUID and reports errors for junk', async ({ page }) => {
    await page.goto('/tools/uuid-generator/');
    const inspect = page.getByLabel('Parse / inspect a UUID');
    await inspect.fill('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
    await expect(page.getByText('7 — Unix Epoch time-based')).toBeVisible();
    await expect(page.getByText('RFC 9562', { exact: true })).toBeVisible();
    await expect(page.getByText('2022-02-22T19:22:22.000Z')).toBeVisible();

    await inspect.fill('not-a-uuid');
    await expect(page.locator('[data-inspect-status]')).toContainText('Invalid character "n"');
    await expect(inspect).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('button', { name: 'Use first result' }).click();
    await expect(inspect).toHaveValue(/^[0-9a-f-]{36}$/);
    await expect(page.getByText('4 — Random')).toBeVisible();
  });

  test('copy flashes and clear empties the output', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/uuid-generator/');
    // Match both names: while flashing, the button's accessible name is "Copied!".
    const copy = page.getByRole('button', { name: /^(Copy all|Copied!)$/ });
    await copy.click();
    await expect(copy).toContainText('Copied!');

    await page.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(page.getByLabel('Generated UUIDs')).toHaveValue('');
  });
});
