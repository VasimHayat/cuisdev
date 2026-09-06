import { expect, test } from '@playwright/test';

import { fillEditor, lastCopied, settle, stubClipboard } from '../helpers';

test.describe('case-converter tool', () => {
  test('converts every case live', async ({ page }) => {
    await page.goto('/tools/case-converter/');
    await fillEditor(page, 'case-converter-input', 'XMLHttpRequest returns JSON');

    await expect(page.getByLabel('camelCase', { exact: true })).toHaveText(
      'xmlHttpRequestReturnsJson',
    );
    await expect(page.getByLabel('PascalCase', { exact: true })).toHaveText(
      'XmlHttpRequestReturnsJson',
    );
    await expect(page.getByLabel('snake_case', { exact: true })).toHaveText(
      'xml_http_request_returns_json',
    );
    await expect(page.getByLabel('SCREAMING_SNAKE_CASE', { exact: true })).toHaveText(
      'XML_HTTP_REQUEST_RETURNS_JSON',
    );
    await expect(page.getByLabel('kebab-case', { exact: true })).toHaveText(
      'xml-http-request-returns-json',
    );
    await expect(page.getByLabel('dot.case', { exact: true })).toHaveText(
      'xml.http.request.returns.json',
    );
    await expect(page.getByLabel('Train-Case', { exact: true })).toHaveText(
      'Xml-Http-Request-Returns-Json',
    );
    await expect(page.getByLabel('UPPER CASE', { exact: true })).toHaveText(
      'XMLHTTPREQUEST RETURNS JSON',
    );
    await expect(page.locator('[data-input-stats]')).toHaveText('27 characters · 5 words');
  });

  test('title case keeps small words lower-case and sentence case does not', async ({ page }) => {
    await page.goto('/tools/case-converter/');
    await fillEditor(page, 'case-converter-input', 'the lord of the rings');

    await expect(page.getByLabel('Title Case', { exact: true })).toHaveText(
      'The Lord of the Rings',
    );
    await expect(page.getByLabel('Sentence case', { exact: true })).toHaveText(
      'The lord of the rings',
    );
    await expect(page.getByLabel('aLtErNaTiNg', { exact: true })).toHaveText(
      'tHe LoRd Of ThE rInGs',
    );
  });

  test('converts a multi-line list line by line', async ({ page }) => {
    await page.goto('/tools/case-converter/');
    await fillEditor(page, 'case-converter-input', 'first name\nlast name');
    await expect(page.getByLabel('snake_case', { exact: true })).toHaveText(
      /first_name\s+last_name/,
    );
  });

  test('shows a helpful error for text over the limit', async ({ page }) => {
    await page.goto('/tools/case-converter/');
    await fillEditor(page, 'case-converter-input', 'a'.repeat(100_001));

    const status = page.getByRole('status').last();
    await expect(status).toContainText('The limit is 100,000');
    await expect(status).toHaveAttribute('data-tone', 'error');
    await expect(page.getByLabel('camelCase', { exact: true })).toHaveText('');
  });

  test('sample, per-row copy, copy all and clear', async ({ page }) => {
    await stubClipboard(page);
    await page.goto('/tools/case-converter/');

    await page.getByRole('button', { name: 'Sample' }).click();
    await settle(page);
    await expect(page.getByLabel('Text to convert')).toHaveValue(/quick brown fox/);

    const copyKebab = page.getByRole('button', { name: 'Copy kebab-case' });
    await copyKebab.click();
    await expect(copyKebab).toContainText('Copied!');
    expect((await lastCopied(page)) ?? '').toContain('the-quick-brown-fox-jumps-over-the-lazy-dog');

    await page.getByRole('button', { name: 'Copy all' }).click();
    const all = ((await lastCopied(page)) ?? '').replace(/\r\n/g, '\n');
    expect(all).toContain('UPPER CASE\n');
    expect(all).toContain('camelCase\ntheQuickBrownFoxJumpsOverTheLazyDog');

    await page.getByRole('button', { name: 'Clear input' }).click();
    await settle(page);
    await expect(page.getByLabel('Text to convert')).toHaveValue('');
    await expect(page.getByLabel('camelCase', { exact: true })).toHaveText('');
  });

  test('copying with an empty input reports why nothing was copied', async ({ page }) => {
    await page.goto('/tools/case-converter/');
    await page.getByRole('button', { name: 'Copy all' }).click();
    const status = page.getByRole('status').last();
    await expect(status).toContainText('nothing to copy yet');
    await expect(status).toHaveAttribute('data-tone', 'error');
  });
});
