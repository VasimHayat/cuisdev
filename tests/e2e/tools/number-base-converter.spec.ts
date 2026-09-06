import { type Locator, type Page, expect, test } from '@playwright/test';

import { expectError, lastCopied, settle, stubClipboard } from '../helpers';

/** Copy buttons keep a stable aria-label, so the flash shows up in their text. */
async function clickCopy(page: Page, button: Locator): Promise<string | undefined> {
  await button.click();
  await expect(button).toContainText('Copied!');
  return lastCopied(page);
}

const binary = (page: Page) => page.getByLabel('Binary (base 2)');
const octal = (page: Page) => page.getByLabel('Octal (base 8)');
const decimal = (page: Page) => page.getByLabel('Decimal (base 10)');
const hex = (page: Page) => page.getByLabel('Hexadecimal (base 16)');

test.describe('number-base-converter tool', () => {
  test('keeps every base in sync as you type', async ({ page }) => {
    await page.goto('/tools/number-base-converter/');
    // The sample is pre-rendered, so the page is useful without JavaScript.
    await expect(hex(page)).toHaveValue('deadbeef');

    await decimal(page).fill('255');
    await settle(page);
    await expect(binary(page)).toHaveValue('11111111');
    await expect(octal(page)).toHaveValue('377');
    await expect(hex(page)).toHaveValue('ff');

    await hex(page).fill('dead');
    await settle(page);
    await expect(decimal(page)).toHaveValue('57005');
    await expect(binary(page)).toHaveValue('1101111010101101');
  });

  test('accepts prefixes, separators and negative values', async ({ page }) => {
    await page.goto('/tools/number-base-converter/');

    await hex(page).fill('0xDE_AD');
    await settle(page);
    await expect(decimal(page)).toHaveValue('57005');

    await decimal(page).fill('-42');
    await settle(page);
    await expect(binary(page)).toHaveValue('-101010');
    await expect(hex(page)).toHaveValue('-2a');
  });

  test('stays exact well past 2^53', async ({ page }) => {
    await page.goto('/tools/number-base-converter/');
    await hex(page).fill('ffffffffffffffff');
    await settle(page);
    await expect(decimal(page)).toHaveValue('18446744073709551615');
    await expect(page.locator('[data-value="bits"]')).toHaveText('64 bits');
  });

  test('uppercase, grouping and the custom base change the output', async ({ page }) => {
    await page.goto('/tools/number-base-converter/');
    await decimal(page).fill('3735928559');
    await settle(page);

    await page.getByRole('checkbox', { name: 'Uppercase letters' }).check();
    await settle(page);
    await expect(hex(page)).toHaveValue('DEADBEEF');

    await page.getByRole('checkbox', { name: 'Group digits' }).check();
    await settle(page);
    await expect(hex(page)).toHaveValue('DE AD BE EF');
    await expect(binary(page)).toHaveValue('1101 1110 1010 1101 1011 1110 1110 1111');

    await page.getByLabel('Custom base', { exact: true }).selectOption('7');
    await settle(page);
    await expect(page.getByLabel('Custom base value', { exact: true })).toHaveValue(/^[0-6 ]+$/);
  });

  test('shows bit length, two’s complement and the number in words', async ({ page }) => {
    await page.goto('/tools/number-base-converter/');
    await decimal(page).fill('-1');
    await page.getByLabel('Two’s complement width').selectOption('8');
    await settle(page);

    await expect(page.locator('[data-value="bits"]')).toHaveText('1 bit');
    await expect(page.locator('[data-value="twos-binary"]')).toHaveText('11111111');
    await expect(page.locator('[data-value="twos-hex"]')).toHaveText('ff');
    await expect(page.locator('[data-value="words"]')).toHaveText('minus one');

    await decimal(page).fill('300');
    await settle(page);
    await expect(page.locator('[data-value="twos-binary"]')).toContainText(
      'does not fit in 8 bits',
    );

    await page.getByLabel('Two’s complement width').selectOption('16');
    await settle(page);
    await expect(page.locator('[data-value="twos-binary"]')).toHaveText('0000000100101100');
    await expect(page.locator('[data-value="words"]')).toHaveText('three hundred');
  });

  test('names the invalid digit and the base', async ({ page }) => {
    await page.goto('/tools/number-base-converter/');
    await binary(page).fill('1029');
    await settle(page);
    await expectError(page, 'is not a valid binary digit');
    await expect(binary(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(decimal(page)).toHaveValue('');

    await binary(page).fill('1010');
    await settle(page);
    await expect(decimal(page)).toHaveValue('10');

    await hex(page).fill('zz');
    await settle(page);
    await expectError(page, 'is not a valid hexadecimal digit');
  });

  test('sample, copy and clear', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/number-base-converter/');

    await page.getByRole('button', { name: 'Clear all fields' }).click();
    await settle(page);
    await expect(decimal(page)).toHaveValue('');
    await expect(page.locator('[data-value="words"]')).toHaveText('—');
    await expect(page.getByRole('status').first()).toContainText('Enter a number');

    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);
    await expect(decimal(page)).toHaveValue('3735928559');

    expect(await clickCopy(page, page.getByRole('button', { name: 'Copy hexadecimal' }))).toBe(
      'deadbeef',
    );
    expect(
      await clickCopy(page, page.getByRole('button', { name: 'Copy the number in words' })),
    ).toContain('three billion');
  });
});
