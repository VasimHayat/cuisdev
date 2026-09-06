import { type Locator, type Page, expect, test } from '@playwright/test';

import { expectError, lastCopied, settle, stubClipboard } from '../helpers';

const value = (page: Page, id: string) => page.locator(`[data-value="${id}"]`);

/** Copy buttons keep a stable aria-label, so the flash shows up in their text. */
async function clickCopy(page: Page, button: Locator): Promise<string | undefined> {
  await button.click();
  await expect(button).toContainText('Copied!');
  return lastCopied(page);
}

test.describe('timestamp-converter tool', () => {
  test('converts a Unix timestamp into every format', async ({ page }) => {
    await page.goto('/tools/timestamp-converter/');
    // The sample is pre-rendered in UTC, so the page works without JavaScript.
    await expect(value(page, 'iso')).toHaveText('2026-01-01T00:00:00.000Z');

    await page.getByLabel('Unix timestamp', { exact: true }).fill('1767225600');
    await settle(page);
    await expect(value(page, 'iso')).toHaveText('2026-01-01T00:00:00.000Z');
    await expect(value(page, 'rfc')).toHaveText('Thu, 01 Jan 2026 00:00:00 GMT');
    await expect(value(page, 'weekday')).toHaveText('Thursday');
    await expect(value(page, 'day-of-year')).toHaveText('1 of 365');
    await expect(value(page, 'iso-week')).toHaveText('2026-W01');
    await expect(value(page, 'seconds')).toHaveText('1767225600');
    await expect(value(page, 'milliseconds')).toHaveText('1767225600000');
    await expect(value(page, 'relative')).not.toHaveText('—');
    await expect(page.locator('[data-detected]')).toContainText('seconds');
  });

  test('detects milliseconds and honours the unit override', async ({ page }) => {
    await page.goto('/tools/timestamp-converter/');
    const input = page.getByLabel('Unix timestamp', { exact: true });

    await input.fill('1767225600000');
    await settle(page);
    await expect(page.locator('[data-detected]')).toContainText('milliseconds');
    await expect(value(page, 'iso')).toHaveText('2026-01-01T00:00:00.000Z');

    // Nanoseconds land on the same instant.
    await input.fill('1767225600000000000');
    await settle(page);
    await expect(value(page, 'iso')).toHaveText('2026-01-01T00:00:00.000Z');

    // Forcing the unit reinterprets the same digits.
    await input.fill('1767225600');
    await page.getByLabel('Unit').selectOption('milliseconds');
    await settle(page);
    await expect(value(page, 'iso')).toHaveText('1970-01-21T10:53:45.600Z');
    await expect(page.locator('[data-detected]')).toContainText('Read as milliseconds');
  });

  test('handles pre-1970 and post-2038 timestamps', async ({ page }) => {
    await page.goto('/tools/timestamp-converter/');
    const input = page.getByLabel('Unix timestamp', { exact: true });

    await input.fill('-86400');
    await settle(page);
    await expect(value(page, 'iso')).toHaveText('1969-12-31T00:00:00.000Z');
    await expect(value(page, 'seconds')).toHaveText('-86400');

    await input.fill('2147483648');
    await settle(page);
    await expect(value(page, 'iso')).toHaveText('2038-01-19T03:14:08.000Z');
  });

  test('the time zone select changes the reported date', async ({ page }) => {
    await page.goto('/tools/timestamp-converter/');
    await page.getByLabel('Unix timestamp', { exact: true }).fill('1767225600');
    await page.getByLabel('Time zone').selectOption('Asia/Tokyo');
    await settle(page);
    await expect(value(page, 'iso-offset')).toHaveText('2026-01-01T09:00:00+09:00');
    await expect(value(page, 'weekday')).toHaveText('Thursday');

    await page.getByLabel('Time zone').selectOption('America/New_York');
    await settle(page);
    await expect(value(page, 'iso-offset')).toHaveText('2025-12-31T19:00:00-05:00');
    await expect(value(page, 'weekday')).toHaveText('Wednesday');
    // UTC never moves.
    await expect(value(page, 'iso')).toHaveText('2026-01-01T00:00:00.000Z');
  });

  test('converts a date back into a timestamp', async ({ page }) => {
    await page.goto('/tools/timestamp-converter/');
    await page.getByLabel('Time zone').selectOption('UTC');

    await page.getByLabel('Date and time (in the selected zone)').fill('2026-06-01T12:00');
    await settle(page);
    await expect(value(page, 'to-seconds')).toHaveText('1780315200');
    await expect(value(page, 'to-milliseconds')).toHaveText('1780315200000');

    await page.getByLabel('Or paste an ISO 8601 / RFC 2822 date').fill('2026-01-01T00:00:00Z');
    await settle(page);
    await expect(value(page, 'to-seconds')).toHaveText('1767225600');
    await expect(page.getByLabel('Date and time (in the selected zone)')).toHaveValue(
      /^2026-01-01T00:00(:00)?$/,
    );
  });

  test('shows helpful errors for bad input', async ({ page }) => {
    await page.goto('/tools/timestamp-converter/');
    const input = page.getByLabel('Unix timestamp', { exact: true });

    await input.fill('yesterday');
    await settle(page);
    await expectError(page, 'is not a number');
    await expect(value(page, 'iso')).toHaveText('—');
    await expect(input).toHaveAttribute('aria-invalid', 'true');

    await input.fill('99999999999999999999');
    await page.getByLabel('Unit').selectOption('seconds');
    await settle(page);
    await expectError(page, 'outside the range');

    await input.fill('1767225600');
    await page.getByLabel('Unit').selectOption('auto');
    await page.getByLabel('Or paste an ISO 8601 / RFC 2822 date').fill('next tuesday');
    await settle(page);
    await expectError(page, 'could not be read as a date');
  });

  test('live clock, copy and clear', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/timestamp-converter/');

    const clock = page.locator('[data-now-seconds]');
    await expect(clock).toHaveText(/^\d{10} s$/);
    const first = await clock.textContent();
    await page.waitForTimeout(1500);
    expect(await clock.textContent()).not.toBe(first);

    const copiedNow = await clickCopy(
      page,
      page.getByRole('button', { name: 'Copy current Unix seconds' }),
    );
    expect(copiedNow).toMatch(/^\d{10}$/);

    await page.getByLabel('Unix timestamp', { exact: true }).fill('1767225600');
    await settle(page);
    const copiedIso = await clickCopy(
      page,
      page.getByRole('button', { name: 'Copy ISO 8601 (UTC)', exact: true }),
    );
    expect(copiedIso).toBe('2026-01-01T00:00:00.000Z');

    await page.getByRole('button', { name: 'Use now' }).click();
    await settle(page);
    await expect(page.getByLabel('Unix timestamp', { exact: true })).toHaveValue(/^\d{10}$/);

    await page.getByRole('button', { name: 'Clear all fields' }).click();
    await settle(page);
    await expect(page.getByLabel('Unix timestamp', { exact: true })).toHaveValue('');
    await expect(value(page, 'iso')).toHaveText('—');
    await expect(page.getByRole('status').first()).toContainText('Enter a Unix timestamp');
  });
});
