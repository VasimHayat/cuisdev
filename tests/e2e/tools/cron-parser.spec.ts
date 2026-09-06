import { type Locator, type Page, expect, test } from '@playwright/test';

import { expectError, lastCopied, settle, stubClipboard } from '../helpers';

/** Copy buttons keep a stable aria-label, so the flash shows up in their text. */
async function clickCopy(page: Page, button: Locator): Promise<string | undefined> {
  await button.click();
  await expect(button).toContainText('Copied!');
  return lastCopied(page);
}

test.describe('cron-parser tool', () => {
  test('describes an expression and lists its next runs', async ({ page }) => {
    await page.goto('/tools/cron-parser/');
    const input = page.getByLabel('Cron expression', { exact: true });
    const description = page.locator('[data-description]');

    // The sample description is pre-rendered, so it is right without JavaScript.
    await expect(description).toContainText('09:00');

    await input.fill('*/15 * * * *');
    await settle(page);
    await expect(description).toHaveText('Every 15 minutes');

    const runs = page.locator('[data-run-utc]');
    await expect(runs).toHaveCount(10);
    for (const cell of await runs.all()) {
      await expect(cell).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:(00|15|30|45):00$/);
    }
    await expect(page.locator('[data-run-relative]').first()).not.toHaveText('—');
  });

  test('breaks the expression down field by field', async ({ page }) => {
    await page.goto('/tools/cron-parser/');
    await page.getByLabel('Cron expression', { exact: true }).fill('0 9 * * 1-5');
    await settle(page);

    const rows = page.locator('[data-fields] tr');
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(1)).toContainText('Hours');
    await expect(rows.nth(4)).toContainText('Monday through Friday');

    // A sixth leading field is read as seconds.
    await page.getByLabel('Cron expression', { exact: true }).fill('30 0 9 * * 1-5');
    await settle(page);
    await expect(rows).toHaveCount(6);
    await expect(rows.first()).toContainText('Seconds');
  });

  test('time zone select changes the schedule column', async ({ page }) => {
    await page.goto('/tools/cron-parser/');
    await page.getByLabel('Cron expression', { exact: true }).fill('0 0 * * *');
    await page.getByLabel('Time zone').selectOption('UTC');
    await settle(page);

    await expect(page.locator('[data-zone-heading]')).toHaveText('UTC');
    await expect(page.locator('[data-run-utc]').first()).toHaveText(/ 00:00:00$/);

    await page.getByLabel('Time zone').selectOption('Asia/Tokyo');
    await settle(page);
    await expect(page.locator('[data-zone-heading]')).toHaveText('Asia/Tokyo');
    // Midnight in Tokyo is 15:00 UTC the previous day.
    await expect(page.locator('[data-run-zone]').first()).toHaveText(/ 00:00:00$/);
    await expect(page.locator('[data-run-utc]').first()).toHaveText(/ 15:00:00$/);
  });

  test('preset buttons fill the expression in', async ({ page }) => {
    await page.goto('/tools/cron-parser/');
    await page.getByRole('button', { name: 'First of month' }).click();
    await settle(page);
    await expect(page.getByLabel('Cron expression', { exact: true })).toHaveValue('0 0 1 * *');
    await expect(page.locator('[data-description]')).toContainText('day 1 of the month');

    await page.getByRole('button', { name: 'Every minute', exact: true }).click();
    await settle(page);
    await expect(page.locator('[data-description]')).toHaveText('Every minute');
  });

  test('shows a helpful error for invalid expressions', async ({ page }) => {
    await page.goto('/tools/cron-parser/');
    const input = page.getByLabel('Cron expression', { exact: true });

    await input.fill('* * * *');
    await settle(page);
    await expectError(page, 'needs 5 fields');
    await expect(page.locator('[data-run-utc]').first()).toHaveText('—');

    await input.fill('99 * * * *');
    await settle(page);
    await expectError(page, /minutes part must be/i);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('copies the expression and the next runs, and clears', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/cron-parser/');
    const input = page.getByLabel('Cron expression', { exact: true });

    await input.fill('  0   9  *  *  1-5 ');
    await page.getByLabel('Time zone').selectOption('UTC');
    await settle(page);

    const expression = await clickCopy(
      page,
      page.getByRole('button', { name: /copy expression/i }),
    );
    expect(expression).toBe('0 9 * * 1-5');

    const runs = await clickCopy(page, page.getByRole('button', { name: /copy next runs/i }));
    expect(runs?.split('\n')).toHaveLength(10);
    expect(runs?.split('\n')[0]).toMatch(/^1\. \d{4}-\d{2}-\d{2} 09:00:00 UTC$/);

    await page.getByRole('button', { name: 'Clear expression' }).click();
    await settle(page);
    await expect(input).toHaveValue('');
    await expectError(page, 'Enter a cron expression');
  });
});
