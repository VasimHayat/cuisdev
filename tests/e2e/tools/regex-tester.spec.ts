import { expect, type Page, test } from '@playwright/test';

import { clickCopy, expectError, settle, stubClipboard } from '../helpers';

const URL = '/tools/regex-tester/';

// The tool section is labelled "Regular expression tester", so locate the
// fields by role to avoid matching the landmark itself.
const pattern = (page: Page) => page.getByRole('textbox', { name: /^Regular expression/ });
const testString = (page: Page) => page.getByRole('textbox', { name: 'Test string', exact: true });
const replacement = (page: Page) => page.getByRole('textbox', { name: /^Replacement/ });
const replacedText = (page: Page) => page.getByRole('textbox', { name: 'Replaced text' });

test.describe('regex-tester tool', () => {
  test('highlights matches and lists them as you type', async ({ page }) => {
    await page.goto(URL);
    await pattern(page).fill('\\d+');
    await testString(page).fill('a1 bb22 c333');
    await settle(page);

    await expect(page.locator('[data-count]')).toHaveText('3 matches');
    await expect(page.locator('mark.regex__match')).toHaveCount(3);
    await expect(page.locator('mark.regex__match').first()).toHaveText('1');
    // Adjacent matches alternate tint so they stay readable.
    await expect(page.locator('mark.regex__match--alt')).toHaveCount(1);

    const rows = page.locator('[data-rows] tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(2)).toContainText('333');
    await expect(rows.nth(2)).toContainText('9–12');
  });

  test('flags change the result', async ({ page }) => {
    await page.goto(URL);
    await pattern(page).fill('abc');
    await testString(page).fill('ABC abc');
    await settle(page);
    await expect(page.locator('[data-count]')).toHaveText('1 match');

    await page.getByRole('checkbox', { name: 'i ignore case' }).check();
    await settle(page);
    await expect(page.locator('[data-count]')).toHaveText('2 matches');

    // Without g only the first match is reported.
    await page.getByRole('checkbox', { name: 'g global' }).uncheck();
    await settle(page);
    await expect(page.locator('[data-count]')).toHaveText('1 match');
  });

  test('sample loads named capture groups', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);

    await expect(pattern(page)).toHaveValue(/\(\?<user>/);
    await expect(page.locator('[data-count]')).toHaveText('4 matches');
    const firstRow = page.locator('[data-rows] tr').first();
    await expect(firstRow).toContainText('user');
    await expect(firstRow).toContainText('domain');
    await expect(firstRow).toContainText('ada@example.com');
  });

  test('replacement expands named groups and can be copied', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(URL);
    await pattern(page).fill('(?<n>\\d+)');
    await testString(page).fill('a1 b22');
    await replacement(page).fill('[$<n>]');
    await settle(page);

    await expect(replacedText(page)).toHaveValue('a[1] b[22]');

    const copied = await clickCopy(page, page.locator('[data-action="copy-replaced"]'));
    expect(copied?.replace(/\r\n/g, '\n')).toBe('a[1] b[22]');
  });

  test('copy matches puts one match per line on the clipboard', async ({ page }) => {
    await stubClipboard(page);
    await page.goto(URL);
    await pattern(page).fill('\\w+');
    await testString(page).fill('one two');
    // Matching runs in a worker; wait for its result rather than a fixed delay.
    await expect(page.locator('[data-count]')).toHaveText('2 matches');

    const copied = await clickCopy(page, page.locator('[data-action="copy-matches"]'));
    expect(copied?.replace(/\r\n/g, '\n')).toBe('one\ntwo');
  });

  test('shows the engine error and marks the pattern invalid', async ({ page }) => {
    await page.goto(URL);
    await testString(page).fill('abc');
    await pattern(page).fill('(');
    await settle(page);

    await expectError(page, 'Invalid regular expression');
    await expect(pattern(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('mark.regex__match')).toHaveCount(0);

    await pattern(page).fill('(a)');
    await settle(page);
    await expect(pattern(page)).toHaveAttribute('aria-invalid', 'false');
  });

  test('rejects an impossible flag combination', async ({ page }) => {
    await page.goto(URL);
    await pattern(page).fill('a');
    await testString(page).fill('a');
    await page.getByRole('checkbox', { name: 'u unicode', exact: true }).check();
    await page.getByRole('checkbox', { name: 'v unicode sets' }).check();
    await settle(page);
    await expectError(page, 'cannot be used together');
  });

  test('stops a catastrophically backtracking pattern', async ({ page }) => {
    await page.goto(URL);
    await testString(page).fill(`${'a'.repeat(30)}!`);
    await pattern(page).fill('^(a+)+$');

    await expect(page.getByRole('status')).toContainText('Pattern took too long', {
      timeout: 15_000,
    });
    // The page is still responsive afterwards.
    await pattern(page).fill('a+');
    await settle(page);
    await expect(page.locator('[data-count]')).toHaveText('1 match');
  });

  test('clear empties every field', async ({ page }) => {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);
    await expect(page.locator('[data-rows] tr').first()).toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();
    await settle(page);
    await expect(pattern(page)).toHaveValue('');
    await expect(testString(page)).toHaveValue('');
    await expect(replacedText(page)).toHaveValue('');
    await expect(page.locator('[data-count]')).toHaveText('No matches');
    await expect(page.locator('[data-rows] tr')).toHaveCount(0);
  });

  test('the cheat sheet is available below the tool', async ({ page }) => {
    await page.goto(URL);
    const summary = page.getByText('Lookarounds', { exact: true });
    await expect(summary).toBeVisible();
    await expect(page.getByText('negative lookbehind')).toBeHidden();
    await summary.click();
    await expect(page.getByText('negative lookbehind')).toBeVisible();
  });
});
