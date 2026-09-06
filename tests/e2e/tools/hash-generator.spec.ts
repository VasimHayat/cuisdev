import { expect, test } from '@playwright/test';

const FOX = 'The quick brown fox jumps over the lazy dog';
const FOX_SHA256 = 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592';
const FOX_MD5 = '9e107d9d372bb6826bd81d3542a419d6';

test.describe('hash-generator tool', () => {
  test('hashes text live with every algorithm', async ({ page }) => {
    await page.goto('/tools/hash-generator/');
    // Empty input still yields digests (MD5 of "").
    await expect(page.getByLabel('MD5 digest', { exact: true })).toHaveText(
      'd41d8cd98f00b204e9800998ecf8427e',
    );

    await page.getByLabel('Text to hash').fill(FOX);
    await expect(page.getByLabel('SHA-256 digest', { exact: true })).toHaveText(FOX_SHA256);
    await expect(page.getByLabel('MD5 digest', { exact: true })).toHaveText(FOX_MD5);
    await expect(page.getByLabel('SHA-1 digest', { exact: true })).toHaveText(
      '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
    );
    await expect(page.getByLabel('CRC32 digest', { exact: true })).toHaveText('414fa339');
    await expect(page.getByLabel('SHA3-256 digest', { exact: true })).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByLabel('SHA-512 digest', { exact: true })).toHaveText(/^[0-9a-f]{128}$/);
  });

  test('uppercase and Base64 toggles change the output format', async ({ page }) => {
    await page.goto('/tools/hash-generator/');
    await page.getByLabel('Text to hash').fill('abc');
    const sha256 = page.getByLabel('SHA-256 digest', { exact: true });
    await expect(sha256).toHaveText(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    await page.getByRole('checkbox', { name: 'Uppercase' }).check();
    await expect(sha256).toHaveText(
      'BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD',
    );
    await page.getByRole('checkbox', { name: 'Base64 output' }).check();
    await expect(sha256).toHaveText('ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=');
  });

  test('HMAC mode keys the SHA rows and disables MD5/CRC32', async ({ page }) => {
    await page.goto('/tools/hash-generator/');
    await page.getByLabel('Text to hash').fill('what do ya want for nothing?');
    await page.getByRole('checkbox', { name: 'HMAC' }).check();
    await page.getByLabel('Secret key').fill('Jefe');
    await expect(page.getByLabel('SHA-256 digest', { exact: true })).toHaveText(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
    await expect(page.getByLabel('MD5 digest', { exact: true })).toHaveText(
      'Not available with HMAC',
    );
    await expect(page.getByRole('button', { name: 'Copy MD5 digest' })).toBeDisabled();
  });

  test('compare box reports match and no match', async ({ page }) => {
    await page.goto('/tools/hash-generator/');
    await page.getByLabel('Text to hash').fill(FOX);
    const compare = page.getByLabel('Compare with expected hash');
    await compare.fill(`  ${FOX_MD5.toUpperCase()}  `);
    const verdict = page.getByRole('status').filter({ hasText: /match/i });
    await expect(verdict).toContainText('Match — MD5');
    await expect(verdict).toHaveAttribute('data-tone', 'success');

    await compare.fill('deadbeef');
    await expect(verdict).toContainText('No match');
    await expect(verdict).toHaveAttribute('data-tone', 'error');
    await expect(compare).toHaveAttribute('aria-invalid', 'true');
  });

  test('hashes a dropped file in chunks', async ({ page }) => {
    await page.goto('/tools/hash-generator/');
    await page.getByLabel('File', { exact: true }).setInputFiles({
      name: 'fox.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(FOX),
    });
    await expect(page.getByLabel('SHA-256 digest', { exact: true })).toHaveText(FOX_SHA256);
    await expect(page.getByRole('status').last()).toContainText('Hashed “fox.txt”');
    await expect(page.getByLabel('Text to hash')).toHaveAttribute('placeholder', /fox\.txt/);
  });

  test('sample, per-row copy and clear', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/hash-generator/');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(page.getByLabel('Text to hash')).toHaveValue(FOX);
    await expect(page.getByLabel('SHA-256 digest', { exact: true })).toHaveText(FOX_SHA256);

    const copy = page.getByRole('button', { name: 'Copy SHA-256 digest' });
    await copy.click();
    await expect(copy).toContainText('Copied!');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(FOX_SHA256);

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expect(page.getByLabel('Text to hash')).toHaveValue('');
    await expect(page.getByLabel('MD5 digest', { exact: true })).toHaveText(
      'd41d8cd98f00b204e9800998ecf8427e',
    );
  });
});
