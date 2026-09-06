import { expect, test } from '@playwright/test';

import { expectError } from '../helpers';

const CLASSIC = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit';

test.describe('lorem ipsum generator', () => {
  test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

  test('generates paragraphs on load and honours the count', async ({ page }) => {
    await page.goto('/tools/lorem-ipsum-generator/');
    const output = page.getByLabel('Generated text');

    await expect(output).toHaveValue(new RegExp(`^${CLASSIC}`));
    expect((await output.inputValue()).split('\n\n')).toHaveLength(3);
    await expect(page.locator('[data-stats]')).toContainText(/[\d,]+ words · [\d,]+ chars/);

    await page.getByLabel('Count').fill('5');
    await expect.poll(async () => (await output.inputValue()).split('\n\n').length).toBe(5);
  });

  test('switches format and unit', async ({ page }) => {
    await page.goto('/tools/lorem-ipsum-generator/');
    const output = page.getByLabel('Generated text');
    const plain = await output.inputValue();

    await page.getByLabel('Format').selectOption('html');
    await expect(output).toHaveValue(/^<p>Lorem ipsum/);
    expect((await output.inputValue()).match(/<p>/g)).toHaveLength(3);

    await page.getByLabel('Format').selectOption('json');
    const json = JSON.parse(await output.inputValue()) as string[];
    expect(json).toHaveLength(3);
    // Same seed: the JSON items are the same paragraphs as the plain output.
    expect(json.join('\n\n')).toBe(plain);

    await page.getByLabel('Format').selectOption('markdown');
    await expect(output).toHaveValue(plain);

    await page.getByLabel('Generate', { exact: true }).selectOption('sentences');
    await page.getByLabel('Count').fill('4');
    await expect.poll(async () => (await output.inputValue()).match(/\./g)?.length ?? 0).toBe(4);
    await expect(output).not.toHaveValue(/\n/);

    await page.getByLabel('Generate', { exact: true }).selectOption('words');
    await page.getByLabel('Count').fill('10');
    await expect.poll(async () => (await output.inputValue()).split(' ').length).toBe(10);
    await expect(output).toHaveValue(/^Lorem ipsum dolor/);

    await page.getByRole('checkbox', { name: /start with/i }).uncheck();
    await expect(output).not.toHaveValue(/^Lorem ipsum dolor sit amet consectetur/);
  });

  test('regenerate changes the text, clear empties it, copy flashes', async ({ page }) => {
    await page.goto('/tools/lorem-ipsum-generator/');
    const output = page.getByLabel('Generated text');
    const before = await output.inputValue();

    await page.getByRole('button', { name: 'Regenerate' }).click();
    await expect(output).not.toHaveValue(before);
    await expect(output).toHaveValue(new RegExp(`^${CLASSIC}`));

    const copy = page.locator('[data-action="copy"]');
    await copy.click();
    await expect(copy).toContainText('Copied!');

    await page.getByRole('button', { name: 'Clear output' }).click();
    await expect(output).toHaveValue('');
    await expect(page.locator('[data-stats]')).toHaveText('');

    await page.getByRole('button', { name: 'Regenerate' }).click();
    await expect(output).not.toHaveValue('');
  });

  test('shows an error for an out-of-range count', async ({ page }) => {
    await page.goto('/tools/lorem-ipsum-generator/');
    const count = page.getByLabel('Count');
    await count.fill('500');
    await expectError(page, /between 1 and 100 paragraphs — got 500/);
    await expect(page.getByLabel('Generated text')).toHaveValue('');
    await expect(count).toHaveAttribute('aria-invalid', 'true');

    await count.fill('2');
    await expect(page.getByLabel('Generated text')).not.toHaveValue('');
    await expect(page.getByRole('status')).toHaveText('');
  });
});
