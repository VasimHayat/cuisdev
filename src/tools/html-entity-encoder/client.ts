import { $, $$, copyText, debounce, flashButton, formatBytes, setStatus } from '@/lib/dom';

import { type EncodeMode, decode, encode, findUnknownEntities, hasEntities } from './logic';

type Mode = 'encode' | 'decode';

const SAMPLE = {
  encode: '<a href="?a=1&b=2" title=\'Café\'>Tom & Jerry’s café — “quoted” © 2026</a>',
  decode:
    '&lt;a href=&quot;?a=1&amp;b=2&quot;&gt;Tom &amp; Jerry&rsquo;s caf&eacute; &mdash; &ldquo;quoted&rdquo; &copy; 2026&lt;/a&gt; &#128075; &#x2764;',
};
const PLACEHOLDER = {
  encode: 'Type or paste text or HTML…',
  decode: 'Paste text containing &amp;, &#169; or &copy; entities…',
};

const root = $<HTMLElement>('[data-tool="html-entity-encoder"]');
const input = $<HTMLTextAreaElement>('[data-input]', root);
const output = $<HTMLTextAreaElement>('[data-output]', root);
const inputLabel = $('[data-input-label]', root);
const outputLabel = $('[data-output-label]', root);
const inputStats = $('[data-input-stats]', root);
const outputStats = $('[data-output-stats]', root);
const status = $('[data-status]', root);
const level = $<HTMLSelectElement>('[data-opt="level"]', root);
const encodeOnly = $$('[data-encode-only]', root);
const modeInputs = $$<HTMLInputElement>('[data-mode] input', root);

const encoder = new TextEncoder();

const mode = (): Mode => (modeInputs.find((r) => r.checked)?.value as Mode | undefined) ?? 'encode';

function setMode(next: Mode): void {
  for (const r of modeInputs) r.checked = r.value === next;
  updateLabels();
}

function updateLabels(): void {
  const encoding = mode() === 'encode';
  inputLabel.textContent = encoding ? 'Text to encode' : 'HTML to decode';
  outputLabel.textContent = encoding ? 'HTML-encoded' : 'Decoded text';
  input.placeholder = PLACEHOLDER[mode()];
  for (const el of encodeOnly) el.toggleAttribute('hidden', !encoding);
}

function stats(el: HTMLElement, text: string): void {
  el.textContent =
    text.length === 0
      ? ''
      : `${text.length.toLocaleString()} chars · ${formatBytes(encoder.encode(text).length)}`;
}

function run(): void {
  const text = input.value;
  stats(inputStats, text);

  if (text === '') {
    output.value = '';
    outputStats.textContent = '';
    setStatus(status, '');
    return;
  }

  try {
    if (mode() === 'encode') {
      output.value = encode(text, level.value as EncodeMode);
      setStatus(status, '');
    } else {
      output.value = decode(text);
      const unknown = findUnknownEntities(text);
      if (unknown.length > 0) {
        const shown = unknown.slice(0, 3).join(', ');
        const more = unknown.length > 3 ? ` and ${unknown.length - 3} more` : '';
        setStatus(
          status,
          `Left unchanged — not a known entity: ${shown}${more}. Check the spelling; names are case-sensitive.`,
        );
      } else if (!hasEntities(text)) {
        setStatus(status, 'Nothing to decode — the input contains no HTML entities.');
      } else {
        setStatus(status, '');
      }
    }
    stats(outputStats, output.value);
  } catch (err) {
    output.value = '';
    outputStats.textContent = '';
    setStatus(status, err instanceof Error ? err.message : 'Could not process the input.', 'error');
  }
}

const runDebounced = debounce(run, 60);

// --- events -----------------------------------------------------------------

input.addEventListener('input', runDebounced);
for (const r of modeInputs) {
  r.addEventListener('change', () => {
    updateLabels();
    run();
  });
}
level.addEventListener('change', run);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'sample':
      input.value = SAMPLE[mode()];
      if (mode() === 'encode' && level.value === 'essential') level.value = 'non-ascii';
      run();
      input.focus();
      break;

    case 'clear':
      input.value = '';
      run();
      input.focus();
      break;

    case 'copy': {
      if (!output.value) return;
      const ok = await copyText(output.value);
      if (ok) flashButton(button);
      else
        setStatus(
          status,
          'Clipboard access was blocked — select the output and copy manually.',
          'error',
        );
      break;
    }

    case 'swap': {
      if (!output.value) return;
      input.value = output.value;
      setMode(mode() === 'encode' ? 'decode' : 'encode');
      run();
      break;
    }
  }
});

updateLabels();
run();
