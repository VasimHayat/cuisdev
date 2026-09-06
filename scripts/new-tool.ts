#!/usr/bin/env node
/**
 * Scaffold a new tool.
 *
 *   npm run new-tool -- <slug> --name "Display Name" --category <id> [--icon <name>]
 *
 * Example:
 *   npm run new-tool -- url-encoder --name "URL Encoder / Decoder" --category encoding --icon code
 *
 * Runs on plain Node (>= 22.6 type-stripping) — no build step.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

const CATEGORIES = ['json', 'encoding', 'generators', 'text', 'web', 'images'];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    category: { type: 'string' },
    icon: { type: 'string', default: 'code' },
  },
});

const slug = positionals[0];
const name = values.name;
const category = values.category;
const icon = values.icon ?? 'code';

function fail(message: string): never {
  console.error(`\n  ✖ ${message}\n`);
  console.error(
    '  Usage: npm run new-tool -- <slug> --name "Display Name" --category <id> [--icon <name>]\n',
  );
  process.exit(1);
}

if (!slug || !SLUG.test(slug)) fail('slug is required and must be kebab-case (e.g. url-encoder)');
if (!name) fail('--name is required');
if (!category || !CATEGORIES.includes(category))
  fail(`--category must be one of: ${CATEGORIES.join(', ')}`);

const dir = join(process.cwd(), 'src', 'tools', slug);
if (existsSync(dir)) fail(`src/tools/${slug} already exists`);

const today = new Date().toISOString().slice(0, 10);
const pascal = slug
  .split('-')
  .map((s) => (s[0] ?? '').toUpperCase() + s.slice(1))
  .join('');

const files: Record<string, string> = {
  'meta.ts': `import type { ToolMeta } from '@/tools/_types';

export const meta: ToolMeta = {
  slug: '${slug}',
  name: '${name}',
  seoTitle: '${name} Online — Free',
  tagline: 'One sentence that says what this tool does and why it is better here.',
  description:
    'Free online ${name.toLowerCase()}. Describe the primary use case with the main keyword, mention the privacy hook, stay within 110–160 characters.',
  category: '${category}',
  icon: '${icon}',
  keywords: ['${slug.replace(/-/g, ' ')}', '${slug.replace(/-/g, ' ')} online'],
  intro: [
    'What the tool does and the problem it solves (keyword-natural, 2–3 sentences).',
    'What makes this implementation useful: options, edge cases handled, formats supported.',
    'Everything runs in your browser — nothing is uploaded.',
  ],
  howTo: [
    'Paste or type your input.',
    'Adjust the options.',
    'Copy or download the result.',
  ],
  example: {
    input: 'sample input',
    output: 'sample output',
  },
  faq: [
    { question: 'Question drawn from a real search query?', answer: 'Concise, accurate answer.' },
    { question: 'Second common question?', answer: 'Answer. Inline <code>code</code> is allowed.' },
    { question: 'Is my data uploaded anywhere?', answer: 'No. Processing happens entirely in your browser.' },
  ],
  status: 'beta',
  added: '${today}',
};
`,

  'logic.ts': `/**
 * ${name} — pure functions, no DOM. Everything here must be unit-tested.
 */

export function transform(input: string): string {
  return input;
}
`,

  'logic.test.ts': `import { describe, expect, it } from 'vitest';

import { transform } from './logic';

describe('${slug} transform', () => {
  it('returns the input unchanged (replace me)', () => {
    expect(transform('abc')).toBe('abc');
  });
});
`,

  'Tool.astro': `---
import Icon from '@/components/Icon.astro';

import './tool.scss';
---

<section class="tool tool-${slug}" data-tool="${slug}" aria-labelledby="${slug}-heading">
  <h2 id="${slug}-heading" class="visually-hidden">${name}</h2>

  <div class="tool__panes">
    <div class="tool__pane">
      <div class="tool__pane-header">
        <label class="tool__pane-title" for="${slug}-input">Input</label>
        <div class="tool__pane-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="clear">
            <Icon name="trash" /><span>Clear</span>
          </button>
        </div>
      </div>
      <textarea id="${slug}-input" class="field__textarea" spellcheck="false" data-input></textarea>
    </div>

    <div class="tool__pane">
      <div class="tool__pane-header">
        <span class="tool__pane-title" id="${slug}-output-label">Output</span>
        <div class="tool__pane-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-action="copy">
            <Icon name="copy" /><span data-label>Copy</span>
          </button>
        </div>
      </div>
      <textarea
        class="field__textarea"
        readonly
        aria-labelledby="${slug}-output-label"
        data-output></textarea>
    </div>
  </div>

  <p class="tool__status" role="status" aria-live="polite" data-status></p>
</section>

<script>
  import './client';
</script>
`,

  'client.ts': `import { $, copyText, debounce, flashButton, setStatus } from '@/lib/dom';

import { transform } from './logic';

const root = $<HTMLElement>('[data-tool="${slug}"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const output = $<HTMLTextAreaElement>('[data-output]', root);
const status = $('[data-status]', root);

function run(): void {
  try {
    output.value = transform(input.value);
    setStatus(status, '');
  } catch (err) {
    output.value = '';
    setStatus(status, err instanceof Error ? err.message : 'Something went wrong.', 'error');
  }
}

input.addEventListener('input', debounce(run, 60));

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;
  switch (button.dataset.action) {
    case 'clear':
      input.value = '';
      run();
      input.focus();
      break;
    case 'copy':
      if (output.value && (await copyText(output.value))) flashButton(button);
      break;
  }
});

run();
`,

  '../../../tests/e2e/tools/${slug}.spec.ts': `import { expect, test } from '@playwright/test';

test.describe('${slug} tool', () => {
  test('transforms input live', async ({ page }) => {
    await page.goto('/tools/${slug}/');
    await page.getByLabel('Input').fill('abc');
    await expect(page.getByLabel('Output')).toHaveValue('abc'); // replace with the real expectation
  });

  test('shows an error for invalid input', async ({ page }) => {
    await page.goto('/tools/${slug}/');
    // await page.getByLabel('Input').fill('<invalid>');
    // await expect(page.getByRole('status')).toContainText('...');
  });

  test('clear empties both panes', async ({ page }) => {
    await page.goto('/tools/${slug}/');
    await page.getByLabel('Input').fill('abc');
    await page.getByRole('button', { name: 'Clear' }).click();
    await expect(page.getByLabel('Input')).toHaveValue('');
    await expect(page.getByLabel('Output')).toHaveValue('');
  });
});
`,

  'tool.scss': `// ${name} — tool-specific styles. Shared chrome lives in styles/components/_tool.scss.
.tool-${slug} {
  // Add overrides here.
}
`,
};

mkdirSync(dir, { recursive: true });
for (const [file, content] of Object.entries(files)) {
  const target = join(dir, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

console.log(`
  ✔ Created src/tools/${slug}/ (${pascal})

  Next steps:
    1. Fill in meta.ts — the registry validates it at build time.
    2. Implement logic.ts and cover it in logic.test.ts   (npm run test:watch)
    3. Build the UI in Tool.astro + client.ts             (npm run dev → http://localhost:4321/tools/${slug}/)
    4. Fill in tests/e2e/tools/${slug}.spec.ts (created) and add '/tools/${slug}/' to tests/e2e/a11y.spec.ts.
       Both unit and browser tests must pass before the tool is done.
`);
