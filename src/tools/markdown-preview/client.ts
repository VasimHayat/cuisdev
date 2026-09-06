import { $, $$, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';
import { mountEditor } from '@/lib/editor';

import {
  describeStats,
  extractTitle,
  hardenLinks,
  type HookElement,
  markdownStats,
  renderMarkdown,
  SANITIZE_CONFIG,
  standaloneHtml,
  toFileName,
} from './logic';

const SAMPLE = [
  '# Release notes — Markdown Preview',
  '',
  'A **fast**, private Markdown editor. Everything renders in your browser, so nothing you paste',
  'is uploaded anywhere.',
  '',
  '## What it does',
  '',
  '- Live preview as you type',
  '- GitHub Flavored Markdown: tables, task lists and ~~strikethrough~~',
  '- Export a standalone `.html` file, or save your `.md` back to disk',
  '',
  '## Checklist',
  '',
  '- [x] Write the document',
  '- [ ] Proof-read it',
  '- [ ] Ship it',
  '',
  '## Syntax reference',
  '',
  '| Element | Markdown        | Renders as        |',
  '| ------- | --------------- | ----------------- |',
  '| Heading | `## Title`      | a section heading |',
  '| Bold    | `**bold**`      | **bold**          |',
  '| Link    | `[text](url)`   | a link            |',
  '',
  '## Code',
  '',
  '```js',
  'export function greet(name) {',
  "  return 'Hello, ' + name + '!';",
  '}',
  '```',
  '',
  '> Anything you type stays in this tab — the preview is rendered locally and sanitised',
  '> before it is shown.',
  '',
  'More syntax lives in the [Markdown guide](https://www.markdownguide.org/basic-syntax/).',
  '',
].join('\n');

import type DOMPurifyDefault from 'dompurify';

type Purifier = typeof DOMPurifyDefault;

const root = $<HTMLElement>('[data-tool="markdown-preview"]');
const inputArea = $<HTMLTextAreaElement>('[data-input]', root);
const htmlArea = $<HTMLTextAreaElement>('[data-html]', root);
const preview = $<HTMLElement>('[data-preview]', root);
const sourceView = $<HTMLElement>('[data-source]', root);
const outputTitle = $('[data-output-title]', root);
const statsEl = $('[data-stats]', root);
const status = $('[data-status]', root);
const gfmOpt = $<HTMLInputElement>('[data-opt="gfm"]', root);
const breaksOpt = $<HTMLInputElement>('[data-opt="breaks"]', root);
const viewInputs = $$<HTMLInputElement>('[data-view] input', root);

const editor = mountEditor(inputArea, {
  language: 'text',
  placeholder: '# Start typing Markdown…',
  onChange: () => renderDebounced(),
});

/** The sanitised HTML currently on screen — what Copy and Download hand out. */
let currentHtml = '';
let renderToken = 0;
let purifier: Purifier | null = null;

/**
 * `marked` and `dompurify` are ~100 KB together, so they are fetched the first
 * time there is something to render rather than on page load.
 */
async function loadPurifier(): Promise<Purifier> {
  if (purifier) return purifier;
  const loaded = (await import('dompurify')).default;
  // Runs after DOMPurify's own attribute pass, so it sees the surviving links.
  loaded.addHook('afterSanitizeAttributes', (node) => {
    hardenLinks(node as unknown as HookElement);
  });
  purifier = loaded;
  return loaded;
}

const view = (): 'preview' | 'html' =>
  (viewInputs.find((radio) => radio.checked)?.value as 'preview' | 'html' | undefined) ?? 'preview';

function applyView(): void {
  const html = view() === 'html';
  sourceView.hidden = !html;
  preview.hidden = html;
  outputTitle.textContent = html ? 'HTML source' : 'Preview';
}

function clearOutput(): void {
  currentHtml = '';
  preview.replaceChildren();
  htmlArea.value = '';
}

async function render(): Promise<void> {
  const markdown = editor.getValue();
  statsEl.textContent = describeStats(markdownStats(markdown));
  const token = ++renderToken;

  if (markdown.trim() === '') {
    clearOutput();
    setStatus(status, '');
    return;
  }

  if (!purifier) setStatus(status, 'Loading the Markdown renderer…');

  try {
    const [dirty, purify] = await Promise.all([
      renderMarkdown(markdown, { gfm: gfmOpt.checked, breaks: breaksOpt.checked }),
      loadPurifier(),
    ]);
    if (token !== renderToken) return; // a newer keystroke won

    // Sanitised first, then assigned: scripts, event handlers and unsafe URLs
    // are gone by the time this HTML touches the document.
    currentHtml = purify.sanitize(dirty, SANITIZE_CONFIG);
    preview.innerHTML = currentHtml;
    htmlArea.value = currentHtml;
    setStatus(status, '');
  } catch (err) {
    if (token !== renderToken) return;
    clearOutput();
    setStatus(
      status,
      err instanceof Error ? `Could not render this Markdown: ${err.message}` : 'Could not render.',
      'error',
    );
  }
}

const renderDebounced = debounce(() => void render(), 80);

// --- events ------------------------------------------------------------------

for (const option of [gfmOpt, breaksOpt]) {
  option.addEventListener('change', () => void render());
}
for (const radio of viewInputs) radio.addEventListener('change', applyView);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;
  const title = extractTitle(editor.getValue(), 'markdown');

  switch (button.dataset.action) {
    case 'sample':
      editor.setValue(SAMPLE);
      await render();
      break;

    case 'clear':
      editor.setValue('');
      await render();
      editor.focus();
      break;

    case 'copy-html': {
      if (!currentHtml) {
        setStatus(status, 'There is nothing to copy yet — type some Markdown first.', 'error');
        return;
      }
      if (await copyText(currentHtml)) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — switch to HTML source and copy manually.',
          'error',
        );
      break;
    }

    case 'download-html':
      if (!currentHtml) {
        setStatus(status, 'There is nothing to download yet — type some Markdown first.', 'error');
        return;
      }
      downloadText(standaloneHtml(currentHtml, title), toFileName(title, 'html'), 'text/html');
      break;

    case 'download-md': {
      const markdown = editor.getValue();
      if (!markdown) {
        setStatus(status, 'There is nothing to download yet — type some Markdown first.', 'error');
        return;
      }
      downloadText(markdown, toFileName(title, 'md'), 'text/markdown');
      break;
    }
  }
});

applyView();
void render();
