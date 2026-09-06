import { type Page, expect, test } from '@playwright/test';

import { expectError, fillEditor } from '../helpers';

/** The jwt.io example token, signed with "your-256-bit-secret". */
const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

/** HS256 header, payload { sub, iat, nbf, exp: 1000000000 } (expired in 2001), bogus signature. */
const EXPIRED =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJleHBpcmVkLXVzZXIiLCJpYXQiOjk5OTk5OTAwMCwibmJmIjo5OTk5OTkwMDAsImV4cCI6MTAwMDAwMDAwMH0.c2ln';

const header = (page: Page) => page.getByLabel('Header', { exact: true });
const payload = (page: Page) => page.getByLabel('Payload', { exact: true });
const secret = (page: Page) => page.locator('#jwt-decoder-secret');

test.describe('jwt-decoder tool', () => {
  test('decodes a pasted token and lists its claims', async ({ page }) => {
    await page.goto('/tools/jwt-decoder/');
    await fillEditor(page, 'jwt-decoder-input', `Bearer ${SAMPLE}`);

    await expect(header(page)).toHaveValue(/"alg": "HS256"/);
    await expect(payload(page)).toHaveValue(/"name": "John Doe"/);
    await expect(page.locator('[data-signature]')).toHaveText(
      'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    );

    const claims = page.locator('[data-claims]');
    await expect(claims).toBeVisible();
    await expect(claims.getByRole('row', { name: /^sub/ })).toContainText('1234567890');
    const iat = claims.getByRole('row', { name: /^iat/ });
    await expect(iat).toContainText('2018-01-18T01:30:22Z');
    await expect(iat).toContainText('years ago');

    const status = page.getByRole('status');
    await expect(status).toContainText('Signature not verified');
    await expect(status).toContainText('Nothing is sent anywhere');
    await expect(page.locator('[data-signature-badge]')).toHaveText('Not verified');
  });

  test('verifies an HS256 signature with the secret and rejects a wrong one', async ({ page }) => {
    await page.goto('/tools/jwt-decoder/');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(secret(page)).toHaveValue('your-256-bit-secret');
    await expect(page.locator('[data-signature-badge]')).toHaveText('Verified');
    await expect(page.getByRole('status')).toContainText('Signature verified with HS256');

    await secret(page).fill('wrong-secret');
    await expectError(page, /Signature does not match this secret/);
    await expect(page.locator('[data-signature-badge]')).toHaveText('Invalid signature');
  });

  test('flags an expired token', async ({ page }) => {
    await page.goto('/tools/jwt-decoder/');
    await fillEditor(page, 'jwt-decoder-input', EXPIRED);
    await expect(page.locator('[data-expiry-badge]')).toHaveText('Expired');
    await expect(page.getByRole('status')).toContainText('Token expired');
    const exp = page.locator('[data-claims]').getByRole('row', { name: /^exp/ });
    await expect(exp).toContainText('2001-09-09T01:46:40Z');
    await expect(exp).toContainText('ago');
    await expect(exp.getByText('Expired')).toBeVisible();
  });

  test('shows a helpful error for malformed input', async ({ page }) => {
    await page.goto('/tools/jwt-decoder/');
    await fillEditor(page, 'jwt-decoder-input', 'not-a-token');
    await expectError(page, /3 dot-separated segments.*has 1/);
    await expect(header(page)).toHaveValue('');
    await expect(page.locator('[data-claims]')).toBeHidden();

    await fillEditor(page, 'jwt-decoder-input', 'aGVsbG8.eyJhIjoxfQ.c2ln');
    await expectError(page, /Header is not valid JSON/);
  });

  test('copies header and payload, then clears everything', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are Chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/tools/jwt-decoder/');
    await page.getByRole('button', { name: 'Sample' }).click();
    await expect(payload(page)).toHaveValue(/John Doe/);

    const copyHeader = page.getByRole('button', { name: 'Copy header' });
    await copyHeader.click();
    await expect(copyHeader).toContainText('Copied!');
    const copyPayload = page.getByRole('button', { name: 'Copy payload' });
    await copyPayload.click();
    await expect(copyPayload).toContainText('Copied!');

    await page.getByRole('button', { name: 'Clear input' }).click();
    await expect(page.getByLabel('Encoded JWT')).toHaveValue('');
    await expect(secret(page)).toHaveValue('');
    await expect(header(page)).toHaveValue('');
    await expect(payload(page)).toHaveValue('');
    await expect(page.locator('[data-claims]')).toBeHidden();
  });
});
