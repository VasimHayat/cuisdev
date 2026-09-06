import { type Page, expect, test } from '@playwright/test';

import { expectError } from '../helpers';

const tool = (page: Page) => page.locator('[data-tool="password-generator"]');

test.describe('password-generator tool', () => {
  test('generates a 20-character password on load with every class present', async ({ page }) => {
    await page.goto('/tools/password-generator/');
    const output = page.getByLabel('Generated password', { exact: true });
    await expect(output).toHaveValue(/^.{20}$/);
    const pw = await output.inputValue();
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).toMatch(/[^a-zA-Z0-9]/);

    await expect(page.getByText(/Very strong · ≈ \d+ bits of entropy/)).toBeVisible();
    await expect(page.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuenow',
      '4',
    );
    await expect(page.getByRole('status')).toContainText('nothing is stored or transmitted');

    await page.getByRole('button', { name: 'Generate', exact: true }).click();
    await expect(output).not.toHaveValue(pw);
  });

  test('length and character-class options change the output and the meter', async ({ page }) => {
    await page.goto('/tools/password-generator/');
    const output = page.getByLabel('Generated password', { exact: true });
    await page.getByLabel('Length', { exact: true }).fill('12');
    await page.getByRole('checkbox', { name: /Uppercase/ }).uncheck();
    await page.getByRole('checkbox', { name: /Digits/ }).uncheck();
    await page.getByRole('checkbox', { name: 'Symbols' }).uncheck();
    await expect(output).toHaveValue(/^[a-z]{12}$/);
    await expect(page.getByText(/^Fair · /)).toBeVisible();
    await expect(page.getByLabel('Custom symbols')).toBeHidden();
  });

  test('a custom single-symbol pool produces a repeated character and a weak rating', async ({
    page,
  }) => {
    await page.goto('/tools/password-generator/');
    await page.getByLabel('Length', { exact: true }).fill('8');
    await page.getByRole('checkbox', { name: /Lowercase/ }).uncheck();
    await page.getByRole('checkbox', { name: /Uppercase/ }).uncheck();
    await page.getByRole('checkbox', { name: /Digits/ }).uncheck();
    await page.getByLabel('Custom symbols').fill('#');
    await expect(page.getByLabel('Generated password', { exact: true })).toHaveValue('########');
    await expect(page.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });

  test('reports errors for an out-of-range length and an empty pool', async ({ page }) => {
    await page.goto('/tools/password-generator/');
    const length = page.getByLabel('Length', { exact: true });
    await length.fill('200');
    await expectError(page, 'between 8 and 128');
    await expect(length).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByLabel('Generated password', { exact: true })).toHaveValue('');

    await length.fill('16');
    for (const name of [/Lowercase/, /Uppercase/, /Digits/, 'Symbols']) {
      await page.getByRole('checkbox', { name }).uncheck();
    }
    await expectError(page, 'No characters to choose from');
  });

  test('passphrase mode with words, separator, capitalisation and number', async ({ page }) => {
    await page.goto('/tools/password-generator/');
    await tool(page).getByText('Passphrase', { exact: true }).click();
    await expect(page.getByRole('radio', { name: 'Passphrase' })).toBeChecked();
    const output = page.getByLabel('Generated passphrase', { exact: true });
    await expect(output).toHaveValue(/^[a-z]+(-[a-z]+){3}$/);
    await expect(page.getByLabel('Length', { exact: true })).toBeHidden();

    await page.getByLabel('Words', { exact: true }).fill('5');
    await page.getByRole('combobox', { name: /Separator/ }).selectOption('dot');
    await page.getByRole('checkbox', { name: 'Capitalise words' }).check();
    await page.getByRole('checkbox', { name: 'Append a number' }).check();
    await expect(output).toHaveValue(/^([A-Z][a-z]+\.){5}\d{2}$/);

    await page.getByRole('combobox', { name: /Separator/ }).selectOption('custom');
    await page.getByLabel('Custom separator').fill('::');
    await expect(output).toHaveValue(/^([A-Z][a-z]+::){5}\d{2}$/);

    await page.getByLabel('Words', { exact: true }).fill('2');
    await expectError(page, 'between 3 and 10');
  });

  test('generate 10, copy flashes and clear empties the output', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/password-generator/');
    await page.getByRole('button', { name: 'Generate 10' }).click();
    const output = page.getByLabel('Generated passwords', { exact: true });
    const lines = (await output.inputValue()).split('\n');
    expect(lines).toHaveLength(10);
    expect(new Set(lines).size).toBe(10);

    // Match both names: while flashing, the button's accessible name is "Copied!".
    const copy = page.getByRole('button', { name: /^(Copy|Copied!)$/ });
    await copy.click();
    await expect(copy).toContainText('Copied!');
    // The OS clipboard may normalise line endings (CRLF on Windows).
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard.replace(/\r\n/g, '\n')).toBe(lines.join('\n'));

    await page.getByRole('button', { name: 'Clear output' }).click();
    await expect(output).toHaveValue('');
    await expect(page.getByRole('meter', { name: 'Password strength' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
  });
});
