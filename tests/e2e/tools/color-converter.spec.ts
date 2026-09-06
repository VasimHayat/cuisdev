import { type Locator, type Page, expect, test } from '@playwright/test';

import { expectError, lastCopied, settle, stubClipboard } from '../helpers';

const value = (page: Page, format: string) => page.locator(`[data-value="${format}"]`);

/**
 * Copy buttons carry an aria-label ("Copy RGB") so each one is distinguishable,
 * which means the visible "Copied!" flash lives in the button's text, not its
 * accessible name — assert on the text and read the stubbed clipboard.
 */
async function clickCopy(page: Page, button: Locator): Promise<string | undefined> {
  await button.click();
  await expect(button).toContainText('Copied!');
  return lastCopied(page);
}

test.describe('color-converter tool', () => {
  test('converts a CSS color into every format', async ({ page }) => {
    await page.goto('/tools/color-converter/');
    // The sample colour is pre-rendered, so the page is useful before hydration.
    await expect(value(page, 'hex')).toHaveText('#3b82f6');

    await page.getByLabel('CSS color', { exact: true }).fill('tomato');
    await settle(page);
    await expect(value(page, 'hex')).toHaveText('#ff6347');
    await expect(value(page, 'hex8')).toHaveText('#ff6347ff');
    await expect(value(page, 'rgb')).toHaveText('rgb(255, 99, 71)');
    await expect(value(page, 'rgba')).toHaveText('rgba(255, 99, 71, 1)');
    await expect(value(page, 'hsl')).toHaveText(/^hsl\(9\.\d+, 100%/);
    await expect(value(page, 'cmyk')).toHaveText('cmyk(0%, 61.2%, 72.2%, 0%)');
    await expect(value(page, 'named')).toHaveText('tomato');
  });

  test('handles alpha, other notations and the color picker', async ({ page }) => {
    await page.goto('/tools/color-converter/');
    const input = page.getByLabel('CSS color', { exact: true });

    await input.fill('oklch(0.7 0.15 200)');
    await settle(page);
    await expect(value(page, 'oklch')).toHaveText('oklch(0.7 0.15 200)');

    await input.fill('rgba(59, 130, 246, 0.5)');
    await settle(page);
    await expect(value(page, 'hex8')).toHaveText('#3b82f680');
    await expect(value(page, 'hsl')).toHaveText(/^hsla\(/);

    // The native swatch and the text field stay in sync both ways.
    await expect(page.getByLabel('Picker', { exact: true })).toHaveValue('#3b82f6');
    await page.getByLabel('Picker', { exact: true }).fill('#00ff00');
    await settle(page);
    await expect(input).toHaveValue('#00ff00');
    await expect(value(page, 'named')).toHaveText('lime');
  });

  test('shows a helpful error for an unparseable color', async ({ page }) => {
    await page.goto('/tools/color-converter/');
    await page.getByLabel('CSS color', { exact: true }).fill('bluish');
    await settle(page);
    await expectError(page, 'is not a CSS color');
    await expect(value(page, 'hex')).toHaveText('—');
    await expect(page.getByRole('button', { name: 'Copy HEX', exact: true })).toBeDisabled();
  });

  test('sample, clear and per-row copy', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/color-converter/');
    const input = page.getByLabel('CSS color', { exact: true });

    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);
    await expect(input).not.toHaveValue('');
    await expect(value(page, 'hex')).toHaveText(/^#[0-9a-f]{6}$/);

    await input.fill('#ff6347');
    await settle(page);
    const copied = await clickCopy(
      page,
      page.getByRole('button', { name: 'Copy RGB', exact: true }),
    );
    expect(copied).toBe('rgb(255, 99, 71)');

    await page.getByRole('button', { name: 'Clear color' }).click();
    await settle(page);
    await expect(input).toHaveValue('');
    await expect(page.getByRole('status').first()).toContainText('Enter a color');
  });

  test('shades and tints scale is copyable', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/color-converter/');
    await page.getByLabel('CSS color', { exact: true }).fill('#3b82f6');
    await settle(page);

    const swatches = page.locator('[data-shade]');
    await expect(swatches).toHaveCount(11);
    await expect(swatches.nth(5).locator('[data-shade-hex]')).toHaveText('#3b82f6');

    const copied = await clickCopy(
      page,
      page.getByRole('button', { name: 'Copy base color', exact: true }),
    );
    expect(copied).toBe('#3b82f6');
  });

  test('contrast checker grades WCAG levels', async ({ page }) => {
    await page.goto('/tools/color-converter/');
    const text = page.getByLabel('Text color', { exact: true });
    const background = page.getByLabel('Background color', { exact: true });
    const ratio = page.locator('[data-ratio]');

    await text.fill('#000000');
    await background.fill('#ffffff');
    await settle(page);
    await expect(ratio).toHaveText('21.00:1');
    await expect(page.locator('[data-level="aaa-normal"]')).toHaveAttribute('data-pass', 'true');
    await expect(page.locator('[data-level="aaa-normal"]')).toContainText('Pass');

    await background.fill('#767676');
    await settle(page);
    await expect(ratio).toHaveText('4.62:1');
    await expect(page.locator('[data-level="aa-normal"]')).toHaveAttribute('data-pass', 'true');
    await expect(page.locator('[data-level="aaa-normal"]')).toHaveAttribute('data-pass', 'false');
    await expect(page.locator('[data-level="aaa-normal"]')).toContainText('Fail');

    // Swapping text and background leaves the ratio unchanged.
    await page.getByRole('button', { name: /swap text and background/i }).click();
    await settle(page);
    await expect(text).toHaveValue('#767676');
    await expect(ratio).toHaveText('4.62:1');
  });
});
