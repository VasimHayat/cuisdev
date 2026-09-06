import { expect, test } from '@playwright/test';

import { fillEditor } from '../helpers';

test.describe('html-entity-encoder tool', () => {
  test('encodes live and swaps to decode', async ({ page }) => {
    await page.goto('/tools/html-entity-encoder/');
    const output = page.getByLabel('HTML-encoded', { exact: true });

    await fillEditor(page, 'html-entity-encoder-input', '<b>Tom & Jerry</b> café');
    await expect(output).toHaveValue('&lt;b&gt;Tom &amp; Jerry&lt;/b&gt; café');

    await page.getByRole('button', { name: /swap/i }).click();
    await expect(page.getByRole('radio', { name: 'Decode' })).toBeChecked();
    await expect(page.getByLabel('HTML to decode')).toHaveValue(
      '&lt;b&gt;Tom &amp; Jerry&lt;/b&gt; café',
    );
    await expect(page.getByLabel('Decoded text')).toHaveValue('<b>Tom & Jerry</b> café');
  });

  test('encode level changes the output', async ({ page }) => {
    await page.goto('/tools/html-entity-encoder/');
    const output = page.getByLabel('HTML-encoded', { exact: true });
    // The radio group also has an "Encode" option, so target the select by role.
    const level = page.getByRole('combobox', { name: 'Encode', exact: true });
    await fillEditor(page, 'html-entity-encoder-input', 'é<');

    await level.selectOption('non-ascii');
    await expect(output).toHaveValue('&eacute;&lt;');
    await level.selectOption('decimal');
    await expect(output).toHaveValue('&#233;&#60;');
    await level.selectOption('hex');
    await expect(output).toHaveValue('&#xE9;&#x3C;');
  });

  test('decodes named, numeric and legacy entities and flags unknown ones', async ({ page }) => {
    await page.goto('/tools/html-entity-encoder/');
    await page.getByText('Decode', { exact: true }).click();
    await fillEditor(page, 'html-entity-encoder-input', '&copy 2026 &#169; &#xA9; &hellip; &nope;');
    await expect(page.getByLabel('Decoded text')).toHaveValue('© 2026 © © … &nope;');
    await expect(page.getByRole('status')).toContainText('not a known entity: &nope;');
  });

  test('sample, copy and clear', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/html-entity-encoder/');
    await page.getByRole('button', { name: 'Sample' }).click();
    const output = page.getByLabel('HTML-encoded', { exact: true });
    await expect(output).toHaveValue(/&lt;a href=&quot;/);
    await expect(output).toHaveValue(/caf&eacute;/);

    // Located by its stable hook: while flashing, the accessible name is "Copied!", not "Copy".
    const copy = page.locator('[data-action="copy"]');
    await copy.click();
    await expect(copy).toContainText('Copied!');

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expect(page.getByLabel('Text to encode')).toHaveValue('');
    await expect(output).toHaveValue('');
  });
});
