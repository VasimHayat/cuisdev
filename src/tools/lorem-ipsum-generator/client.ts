import { $, copyText, debounce, downloadText, flashButton, setStatus } from '@/lib/dom';

import {
  FORMAT_EXTENSIONS,
  FORMAT_MIME_TYPES,
  LOREM_FORMATS,
  LOREM_UNITS,
  type LoremFormat,
  type LoremUnit,
  generateLorem,
  randomSeed,
} from './logic';

const root = $<HTMLElement>('[data-tool="lorem-ipsum-generator"]');
const unitSelect = $<HTMLSelectElement>('[data-opt="unit"]', root);
const countInput = $<HTMLInputElement>('[data-opt="count"]', root);
const formatSelect = $<HTMLSelectElement>('[data-opt="format"]', root);
const startCheckbox = $<HTMLInputElement>('[data-opt="start"]', root);
const output = $<HTMLTextAreaElement>('[data-output]', root);
const stats = $('[data-stats]', root);
const status = $('[data-status]', root);

/** Seed of the text currently shown. Option changes re-use it; Regenerate replaces it. */
let seed = randomSeed();

function unit(): LoremUnit {
  const value = unitSelect.value as LoremUnit;
  return LOREM_UNITS.includes(value) ? value : 'paragraphs';
}

function format(): LoremFormat {
  const value = formatSelect.value as LoremFormat;
  return LOREM_FORMATS.includes(value) ? value : 'plain';
}

function run(): void {
  const raw = countInput.value.trim();
  const count = raw === '' ? Number.NaN : Number(raw);
  try {
    const result = generateLorem({
      unit: unit(),
      count,
      startWithLorem: startCheckbox.checked,
      format: format(),
      seed,
    });
    output.value = result.output;
    stats.textContent = `${result.words.toLocaleString()} words · ${result.characters.toLocaleString()} chars`;
    countInput.removeAttribute('aria-invalid');
    setStatus(status, '');
  } catch (err) {
    output.value = '';
    stats.textContent = '';
    countInput.setAttribute('aria-invalid', 'true');
    setStatus(status, err instanceof Error ? err.message : 'Could not generate text.', 'error');
  }
}

const runDebounced = debounce(run, 60);

unitSelect.addEventListener('change', run);
formatSelect.addEventListener('change', run);
startCheckbox.addEventListener('change', run);
countInput.addEventListener('input', runDebounced);

root.addEventListener('click', async (e) => {
  const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]');
  if (!button) return;

  switch (button.dataset.action) {
    case 'generate':
      seed = randomSeed();
      run();
      break;

    case 'clear':
      output.value = '';
      stats.textContent = '';
      setStatus(status, '');
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

    case 'download': {
      if (!output.value) return;
      const f = format();
      downloadText(output.value, `lorem-ipsum.${FORMAT_EXTENSIONS[f]}`, FORMAT_MIME_TYPES[f]);
      break;
    }
  }
});

run();
